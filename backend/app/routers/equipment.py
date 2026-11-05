import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.db import delete_doc, get_doc, query, set_doc
from app.core.deps import current_user_id
from app.core.security import verify_mpin
from app.models.equipment import BookSlotRequest, EquipmentOut, EquipmentQuoteIn, SlotOut
from app.routers.ratings import provider_rating_fields
from app.routers.users import require_role
from app.services.notify import notify_user
from app.services.users import get_user
from app.services.tasks import emit_task, module_deep_link
from app.services.verification import is_identity_verified, verification_map

router = APIRouter(prefix="/equipment", tags=["equipment"])

IST = timezone(timedelta(hours=5, minutes=30))

# Direct-connect terms (spec §10) — versioned like the trade flow.
EQUIPMENT_TERMS_VERSION = "eq-dc-1.0"
WORK_UNITS = ("acres", "hours", "days")

DEFAULT_SLOTS = [
    {"slotName": "6:00 AM – 10:00 AM", "duration": "4 hours", "priceRupees": 800, "recommendedTask": "Ploughing, tilling (जुताई)"},
    {"slotName": "10:00 AM – 2:00 PM", "duration": "4 hours", "priceRupees": 800, "recommendedTask": "Sowing, spraying (बुवाई)"},
    {"slotName": "2:00 PM – 6:00 PM", "duration": "4 hours", "priceRupees": 800, "recommendedTask": "Harvesting, transport (कटाई)"},
    {"slotName": "6:00 PM – 10:00 PM", "duration": "4 hours", "priceRupees": 800, "recommendedTask": "Irrigation, light work (सिंचाई)"},
]

# max 2 slots/farmer/day — server-enforced, 409 on third
MAX_BOOKINGS_PER_DAY = 2
CANCEL_NOTICE_HOURS = 2
BOOKING_COINS = 50


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def _viewer(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer", "equipmentRental")
    return uid


async def _farmer(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer")
    return uid


def today_ist() -> str:
    return datetime.now(IST).date().isoformat()


def slot_start_minutes(slot_name: str) -> int | None:
    start = slot_name.split("–")[0].split("-")[0].strip()
    try:
        parsed = datetime.strptime(start, "%I:%M %p")
    except ValueError:
        return None
    return parsed.hour * 60 + parsed.minute


def slot_start_dt(date: str, slot_name: str) -> datetime | None:
    minutes = slot_start_minutes(slot_name)
    if minutes is None:
        return None
    day = datetime.strptime(date, "%Y-%m-%d")
    return datetime(day.year, day.month, day.day, minutes // 60, minutes % 60, tzinfo=IST)


async def get_or_generate_slots(equipment: dict, date: str) -> list[dict]:
    slots = await query(
        "equipment_slots",
        [("equipmentId", "==", equipment["id"]), ("date", "==", date)],
        limit=50,
    )
    if not slots:
        template = equipment.get("slotTemplate") or DEFAULT_SLOTS
        now = datetime.now(timezone.utc).isoformat()
        for index, entry in enumerate(template):
            slot = {
                "id": f"{equipment['id']}_{date}_{index}",
                "equipmentId": equipment["id"],
                "date": date,
                "slotIndex": index,
                "slotName": entry["slotName"],
                "duration": entry["duration"],
                "status": "available",
                "bookedByName": None,
                "priceRupees": entry["priceRupees"],
                "recommendedTask": entry["recommendedTask"],
                "createdAt": now,
            }
            await set_doc("equipment_slots", slot["id"], slot)
            slots.append(slot)
    slots.sort(key=lambda s: (slot_start_minutes(s["slotName"]) is None, slot_start_minutes(s["slotName"]) or 0))
    return slots


async def create_booking_for_slot(
    equipment: dict,
    slot: dict,
    uid: str,
    farmer_name: str,
    extra: dict | None = None,
) -> dict:
    # FPO machines auto-confirm; private machines wait for owner approval.
    # Status vocabulary maps to the direct-connect flow: pending=requested,
    # booked=accepted, in_progress, completed, rejected=declined, cancelled.
    status = "booked" if equipment.get("ownerType") == "fpo" else "pending"
    booking = {
        "id": f"eqb_{uuid.uuid4().hex[:12]}",
        "userId": uid,
        "farmerName": farmer_name,
        "slotId": slot["id"],
        "equipmentId": equipment["id"],
        "date": slot["date"],
        "slotName": slot["slotName"],
        "priceRupees": slot["priceRupees"],
        "ownerType": equipment.get("ownerType", "private"),
        "status": status,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        **(extra or {}),
    }
    await set_doc("equipment_bookings", booking["id"], booking)
    slot["status"] = status
    slot["bookedByName"] = farmer_name
    await set_doc("equipment_slots", slot["id"], slot)
    return booking


async def promote_waitlist_head(slot: dict, equipment: dict) -> dict | None:
    entries = await query("equipment_waitlists", [("slotId", "==", slot["id"])], limit=100)
    if not entries:
        return None
    entries.sort(key=lambda e: e.get("createdAt", ""))
    head = entries[0]
    user = await get_user(head["userId"])
    farmer_name = (user or {}).get("name") or "Farmer"
    booking = await create_booking_for_slot(equipment, slot, head["userId"], farmer_name)
    await delete_doc("equipment_waitlists", head["id"])
    return booking


@router.get("")
async def list_equipment(
    type: str | None = None,
    q: str | None = None,
    district: str | None = None,
    operator: str | None = None,
    date: str | None = None,
    lat: float | None = None,
    lng: float | None = None,
    uid: str = Depends(_viewer),
):
    """Public discovery for farmers — spec §6. Visibility is owner-controlled:
    an ACTIVE machine is listed here; `docStatus` drives only the
    equipment-verification badge, never discoverability or booking. Cards
    carry the owner identity-verification badge and, only when genuinely
    document-verified, the equipment-verification badge. NEVER owner
    phone/WhatsApp/address/docs.
    """
    docs = await query("equipment", [], limit=1000)
    docs = [
        d for d in docs
        if d.get("active", True) and (type is None or d.get("type") == type)
    ]
    # SR 27: substring search over machine type / name / location (case-insensitive)
    needle = q.strip().lower() if q else None
    if needle:
        docs = [
            d for d in docs
            if needle in str(d.get("name") or "").lower()
            or needle in str(d.get("type") or "").lower()
            or needle in str(d.get("location") or "").lower()
        ]
    if district:
        dneedle = district.strip().lower()
        docs = [d for d in docs if dneedle in str(d.get("location") or "").lower()]
    if operator:
        # withOperator machines offer an operator; "both" covers both modes.
        docs = [
            d for d in docs
            if d.get("operatorOption", "withoutOperator") in ("both", operator)
        ]
    # WS-04 step 10: priority listing — Pro/Enterprise owners rank first.
    # Per-doc plan lookups happen once per owner, not per machine.
    from app.services.billing import effective_plan

    priority_by_owner: dict[str, int] = {}

    async def _priority(doc: dict) -> int:
        owner = doc.get("ownerId") or ""
        if owner not in priority_by_owner:
            plan = await effective_plan(owner, "equipmentRental")
            priority_by_owner[owner] = 0 if "priorityListing" in (plan.get("features") or []) else 1
        return priority_by_owner[owner]

    ranked = [(await _priority(d), d) for d in docs]
    ranked.sort(key=lambda pd: pd[0])
    docs = [d for _, d in ranked]

    # Batched verification + availability summaries (one scan each, not N+1).
    verified_by_owner = await verification_map([d.get("ownerId") or "" for d in docs])
    slots = await query("equipment_slots", [], limit=5000)
    next_available: dict[str, str] = {}
    for s in slots:
        if s.get("status") != "available":
            continue
        eq = s.get("equipmentId") or ""
        day = s.get("date") or ""
        if day and (eq not in next_available or day < next_available[eq]):
            next_available[eq] = day

    out = []
    for d in docs:
        d = dict(d)
        d.update(await provider_rating_fields(d["id"]))
        owner_id = d.get("ownerId") or ""
        owner = await get_doc("users", owner_id) if owner_id else None
        d["ownerVerified"] = verified_by_owner.get(owner_id, False)
        # Equipment Verified means a COMPLETED equipment-document review only —
        # never derived from the owner's identity KYC (spec §5).
        d["equipmentVerified"] = d.get("docStatus") == "verified"
        d["ownerName"] = ((owner or {}).get("name") or "").strip().split(" ")[0]
        if date:
            want = next_available.get(d["id"])
            if want and want > date:
                continue  # nothing available on/before the required date
        d["nextAvailableDate"] = next_available.get(d["id"])
        d["pricingUnit"] = d.get("pricingUnit") or "perHour"
        out.append(EquipmentOut(**d).model_dump())
    return {"data": out}


@router.get("/my-bookings")
async def my_bookings(uid: str = Depends(_farmer)):
    """The caller's equipment bookings, newest first, with a machine snapshot
    (SR 27) — the renter-side counterpart of the owner's fleet bookings view.
    Owner contact snapshots appear ONLY after the acceptance unlock."""
    bookings = await query("equipment_bookings", [("userId", "==", uid)], limit=500)
    bookings.sort(key=lambda b: b.get("createdAt", ""), reverse=True)
    verified_by_owner = await verification_map(
        [
            (await get_doc("equipment", b.get("equipmentId") or "") or {}).get("ownerId") or ""
            for b in bookings
        ]
    )
    out = []
    for booking in bookings:
        machine = await get_doc("equipment", booking.get("equipmentId") or "")
        owner_id = (machine or {}).get("ownerId")
        owner = await get_doc("users", owner_id) if owner_id else None
        row = {
            **booking,
            "machineName": (machine or {}).get("name"),
            "machineType": (machine or {}).get("type"),
            "ownerId": owner_id,
            "ownerName": (owner or {}).get("name"),
            "ownerVerified": verified_by_owner.get(owner_id or "", False),
        }
        if not booking.get("contactRevealedAt"):
            row.pop("ownerContact", None)
        out.append(row)
    return {"data": out, "page": 1, "pageSize": len(out), "total": len(out)}


class EquipmentIssueReportIn(BaseModel):
    targetUserId: str
    bookingId: str = ""
    category: str = "other"  # workNotCompleted | equipmentIssue | conduct | safety | other
    details: str = ""


@router.post("/reports", status_code=201)
async def report_issue(body: EquipmentIssueReportIn, uid: str = Depends(_viewer)):
    """Issue reporting for EITHER participant (spec §13). Moderation reviews
    it — it never freezes escrow, triggers refunds, or determines liability.
    """
    if body.category not in ("workNotCompleted", "equipmentIssue", "conduct", "safety", "other"):
        _error(422, "VALIDATION_ERROR", "unknown report category", {"category": "unsupported"})
    target = await get_user(body.targetUserId)
    if target is None:
        _error(404, "USER_NOT_FOUND", "user not found")
    if body.bookingId:
        booking = await get_doc("equipment_bookings", body.bookingId) or {}
        machine = await get_doc("equipment", booking.get("equipmentId") or "") or {}
        if uid not in (booking.get("userId"), machine.get("ownerId")):
            _error(403, "FORBIDDEN", "only booking participants can report on this booking")
    doc = {
        "id": f"rep_{uuid.uuid4().hex[:12]}",
        "reporterId": uid,
        "targetUserId": body.targetUserId,
        "bookingId": body.bookingId,
        "module": "equipment",
        "category": body.category,
        "reason": body.category,
        "details": body.details,
        "status": "open",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("user_reports", doc["id"], doc)
    return doc


@router.get("/{equipment_id}/slots")
async def get_slots(equipment_id: str, date: str | None = None, uid: str = Depends(_viewer)):
    equipment = await get_doc("equipment", equipment_id)
    if equipment is None or not equipment.get("active", True):
        _error(404, "EQUIPMENT_NOT_FOUND", "equipment not found")
    slots = await get_or_generate_slots(equipment, date or today_ist())
    return {"data": [SlotOut(**s).model_dump() for s in slots]}


@router.post("/{equipment_id}/quote")
async def quote_equipment(equipment_id: str, body: EquipmentQuoteIn, uid: str = Depends(_viewer)):
    """WS-04 step 6: pricing-engine quote in integer paisa. The machine doc's
    `pricing` block ({hourly?, perAcre?, package?}) takes precedence over the
    legacy flat rates."""
    equipment = await get_doc("equipment", equipment_id)
    if equipment is None or not equipment.get("active", True):
        _error(404, "EQUIPMENT_NOT_FOUND", "equipment not found")
    pricing = equipment.get("pricing") or {}
    hourly = float(pricing.get("hourly") or equipment.get("hourlyRate") or 0)
    per_acre = float(pricing.get("perAcre") or equipment.get("perAcreRate") or 0)

    if body.mode == "hourly":
        if body.hours <= 0:
            _error(422, "VALIDATION_ERROR", "hours must be positive", {"hours": "must be > 0"})
        unit = hourly
        total = round(unit * body.hours, 2)
        unit_label = "hour"
        qty = body.hours
    elif body.mode == "perAcre":
        if body.acres <= 0:
            _error(422, "VALIDATION_ERROR", "acres must be positive", {"acres": "must be > 0"})
        if per_acre <= 0:
            _error(422, "UNSUPPORTED_MODE", "this machine has no per-acre rate")
        unit = per_acre
        total = round(unit * body.acres, 2)
        unit_label = "acre"
        qty = body.acres
    elif body.mode == "package":
        packages = pricing.get("package") or {}
        name = body.packageName or next(iter(packages), None)
        if name is None or name not in packages:
            _error(422, "PACKAGE_NOT_FOUND", "package not available for this machine", {"packageName": "unknown package"})
        unit = float(packages[name])
        total = unit
        unit_label = f"package:{name}"
        qty = 1
    else:
        _error(422, "INVALID_MODE", "mode must be hourly, perAcre or package", {"mode": "hourly|perAcre|package"})

    return {
        "equipmentId": equipment_id,
        "mode": body.mode,
        "quantity": qty,
        "unitPriceRupees": unit,
        "unitLabel": unit_label,
        "totalRupees": total,
        "totalPaisa": int(round(total * 100)),
        "currency": "INR",
    }


@router.post("/slots/{slot_id}/book")
async def book_slot(slot_id: str, body: BookSlotRequest, uid: str = Depends(_farmer)):
    slot = await get_doc("equipment_slots", slot_id)
    if slot is None or slot.get("status") != "available":
        _error(409, "SLOT_UNAVAILABLE", "स्लॉट अब उपलब्ध नहीं")
    same_day = await query("equipment_bookings", [("userId", "==", uid), ("date", "==", slot["date"])], limit=100)
    active = [b for b in same_day if b.get("status") in ("booked", "pending")]
    if len(active) >= MAX_BOOKINGS_PER_DAY:
        _error(409, "MAX_SLOTS_PER_DAY", "एक दिन में अधिकतम 2 स्लॉट बुक कर सकते हैं")
    equipment = await get_doc("equipment", slot["equipmentId"])
    if equipment is None or not equipment.get("active", True):
        _error(404, "EQUIPMENT_NOT_FOUND", "equipment not found")
    if equipment.get("ownerId") == uid:
        _error(403, "OWN_EQUIPMENT", "cannot request your own equipment")
    # Direct-connect request validation (spec §7) — terms acknowledged here,
    # KYC verified for BOTH parties before any contact is shared.
    if not body.termsAccepted:
        _error(422, "TERMS_REQUIRED", "accept the direct-connect terms to send a request")
    if body.workQuantity is not None and body.workUnit not in WORK_UNITS:
        _error(422, "VALIDATION_ERROR", "workUnit must be acres, hours or days", {"workUnit": "acres|hours|days"})
    farmer = await get_user(uid)
    if not await is_identity_verified(farmer):
        _error(403, "KYC_REQUIRED", "complete identity verification (KYC) to request equipment")
    owner_id = equipment.get("ownerId")
    if owner_id:
        owner = await get_user(owner_id)
        # Demo/fleet machines without a real owning account have no contact to
        # unlock — the gate applies whenever an owner account exists.
        if owner is not None and not await is_identity_verified(owner):
            _error(403, "COUNTERPARTY_UNVERIFIED", "the equipment owner has not completed identity verification")
    # No duplicate active request for the same farmer + equipment + schedule.
    dup = await query(
        "equipment_bookings",
        [("userId", "==", uid), ("equipmentId", "==", equipment["id"]), ("slotId", "==", slot_id)],
        limit=20,
    )
    if any(b.get("status") in ("pending", "booked", "in_progress") for b in dup):
        _error(409, "DUPLICATE_REQUEST", "you already have an active request for this equipment and schedule")
    now = datetime.now(timezone.utc).isoformat()
    request_extra = {
        "workLocation": body.workLocation,
        "workType": body.workType,
        "workQuantity": body.workQuantity,
        "workUnit": body.workUnit,
        "notes": body.notes,
        # Farmer terms acknowledgement (spec §10).
        "farmerTermsAccepted": True,
        "farmerTermsVersion": EQUIPMENT_TERMS_VERSION,
        "farmerTermsAcceptedAt": now,
        "statusHistory": [{"status": "requested", "at": now, "by": uid}],
    }
    booking = await create_booking_for_slot(equipment, slot, uid, body.farmerName, extra=request_extra)
    # WS-05 task emission (module: equipment) — owner approval needed.
    owner_uid = equipment.get("ownerId")
    if owner_uid:
        await emit_task(
            owner_uid,
            persona="equipmentRental",
            module="equipment",
            kind="booking_approval_needed",
            title_en="Booking approval needed",
            title_hi="बुकिंग स्वीकृति चाहिए",
            subtitle=f"{equipment.get('name', '')} · {slot.get('date', '')}",
            priority="urgent",
            deep_link=module_deep_link("equipment"),
            source_id=booking.get("id", slot_id),
            due_at=slot.get("date"),
        )
        # Owner booking notification + SMS alert (best-effort, DLT-stubbed).
        from app.services.sms import send_sms

        await notify_user(
            owner_uid,
            type="equipment_booking",
            title="New booking request / नई बुकिंग",
            body=f"{body.farmerName} requested {equipment.get('name', '')} · {slot.get('date', '')} {slot.get('slotName', '')} (₹{slot.get('priceRupees', 0)})",
            deepLink="/equipment/requests",
        )
        owner_user = await get_user(owner_uid)
        if owner_user and owner_user.get("phone"):
            await send_sms(
                owner_user["phone"],
                "equipment_booking_alert",
                {"name": body.farmerName, "machine": equipment.get("name", ""), "date": slot.get("date", "")},
            )
    user = await get_user(uid)
    user["agriCoins"] = user.get("agriCoins", 0) + BOOKING_COINS
    await set_doc("users", uid, user)
    return {"booking": booking, "status": booking["status"], "agriCoinsEarned": BOOKING_COINS}


@router.post("/slots/{slot_id}/waitlist")
async def join_waitlist(slot_id: str, uid: str = Depends(_farmer)):
    slot = await get_doc("equipment_slots", slot_id)
    if slot is None:
        _error(404, "SLOT_NOT_FOUND", "slot not found")
    doc_id = f"{slot_id}_{uid}"
    if await get_doc("equipment_waitlists", doc_id) is not None:
        _error(409, "ALREADY_WAITLISTED", "you are already on the waitlist for this slot")
    await set_doc("equipment_waitlists", doc_id, {
        "id": doc_id,
        "slotId": slot_id,
        "userId": uid,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    })
    return {"ok": True}


class CancelBookingIn(BaseModel):
    reason: str = ""


async def _cancel_booking(booking_id: str, reason: str, uid: str):
    booking = await get_doc("equipment_bookings", booking_id)
    if booking is None:
        _error(404, "BOOKING_NOT_FOUND", "booking not found")
    if booking.get("userId") != uid:
        _error(403, "NOT_BOOKING_OWNER", "booking belongs to another farmer")
    if booking.get("status") == "cancelled":
        _error(409, "ILLEGAL_TRANSITION", "booking is already cancelled")
    start = slot_start_dt(booking["date"], booking["slotName"])
    if start is not None and datetime.now(IST) > start - timedelta(hours=CANCEL_NOTICE_HOURS):
        _error(409, "CANCEL_WINDOW_CLOSED", "स्लॉट शुरू होने से 2 घंटे पहले तक ही बुकिंग रद्द कर सकते हैं")
    now = datetime.now(timezone.utc).isoformat()
    booking["status"] = "cancelled"
    booking["cancellationReason"] = reason or None
    history = list(booking.get("statusHistory") or [])
    history.append({"status": "cancelled", "at": now, "by": uid, "reason": reason})
    booking["statusHistory"] = history
    await set_doc("equipment_bookings", booking_id, booking)
    slot = await get_doc("equipment_slots", booking["slotId"])
    equipment = await get_doc("equipment", booking["equipmentId"])
    promoted = None
    if slot is not None and equipment is not None:
        promoted_booking = await promote_waitlist_head(slot, equipment)
        if promoted_booking is not None:
            promoted = promoted_booking["userId"]
        else:
            slot["status"] = "available"
            slot["bookedByName"] = None
            await set_doc("equipment_slots", slot["id"], slot)
    # Notify the owner — cancellation releases only THIS request's slot.
    owner_id = (equipment or {}).get("ownerId")
    if owner_id:
        await notify_user(
            owner_id,
            type="equipment_booking_cancelled",
            title="Booking cancelled / बुकिंग रद्द",
            body=f"{booking.get('farmerName', 'A farmer')} cancelled {equipment.get('name', 'the equipment')} on {booking.get('date', '')} {booking.get('slotName', '')}."
            + (f" Reason: {reason}" if reason else ""),
            deepLink="/equipment/requests",
        )
    return {"ok": True, "promotedUserId": promoted}


@router.post("/bookings/{booking_id}/cancel")
async def cancel_booking_with_reason(booking_id: str, body: CancelBookingIn, uid: str = Depends(_farmer)):
    """Cancellation with an optional reason (spec §11) — releases only this
    request's availability block and notifies the owner."""
    return await _cancel_booking(booking_id, body.reason, uid)


@router.delete("/bookings/{booking_id}")
async def cancel_booking(booking_id: str, uid: str = Depends(_farmer)):
    return await _cancel_booking(booking_id, "", uid)
