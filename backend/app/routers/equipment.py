import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import delete_doc, get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.equipment import BookSlotRequest, EquipmentOut, EquipmentQuoteIn, SlotOut
from app.routers.ratings import provider_rating_fields
from app.routers.users import require_role
from app.services import kyc as kyc_service
from app.services.users import get_user
from app.services.tasks import emit_task, module_deep_link

router = APIRouter(prefix="/equipment", tags=["equipment"])

IST = timezone(timedelta(hours=5, minutes=30))

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


async def _assert_equipment_bookable(equipment: dict):
    """E1: an owned machine needs the owner's equipment KYC case verified
    (equipment_rc + equipment_insurance through the phase-00 pipeline) and a
    live insurance expiry. Expired insurance blocks NEW bookings only —
    in-flight bookings finish the season unimpeded."""
    owner_id = equipment.get("ownerId")
    if not owner_id:
        return  # demo/fleet machines without an owning account stay bookable
    case = await kyc_service.get_case(kyc_service.case_id_for(owner_id, "equipmentRental"))
    verified_types = {
        doc.get("type")
        for doc in (case or {}).get("docs") or []
        if doc.get("status") == "verified"
    }
    if not {"equipment_rc", "equipment_insurance"} <= verified_types:
        _error(422, "EQUIPMENT_NOT_VERIFIED", "machine documents are not verified")
    raw_expiry = equipment.get("insuranceExpiry")
    if raw_expiry:
        try:
            expires = datetime.fromisoformat(str(raw_expiry))
            if expires.tzinfo is None:
                expires = expires.replace(tzinfo=timezone.utc)
        except ValueError:
            expires = None
        if expires is not None and expires <= datetime.now(timezone.utc):
            _error(
                422,
                "INSURANCE_EXPIRED",
                "machine insurance has expired — renew to accept new bookings",
            )


async def create_booking_for_slot(equipment: dict, slot: dict, uid: str, farmer_name: str) -> dict:
    await _assert_equipment_bookable(equipment)
    # FPO machines auto-confirm; private machines wait for owner approval
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
    lat: float | None = None,
    lng: float | None = None,
    uid: str = Depends(_viewer),
):
    docs = await query("equipment", [], limit=1000)
    docs = [
        d for d in docs
        if d.get("active", True) and d.get("docStatus") == "verified" and (type is None or d.get("type") == type)
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
    out = []
    for d in docs:
        d.update(await provider_rating_fields(d["id"]))
        out.append(EquipmentOut(**d).model_dump())
    return {"data": out}


@router.get("/{equipment_id}/slots")
async def get_slots(equipment_id: str, date: str | None = None, uid: str = Depends(_viewer)):
    equipment = await get_doc("equipment", equipment_id)
    if equipment is None or not equipment.get("active", True) or equipment.get("docStatus") != "verified":
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
    if equipment is None:
        _error(404, "EQUIPMENT_NOT_FOUND", "equipment not found")
    booking = await create_booking_for_slot(equipment, slot, uid, body.farmerName)
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


@router.delete("/bookings/{booking_id}")
async def cancel_booking(booking_id: str, uid: str = Depends(_farmer)):
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
    booking["status"] = "cancelled"
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
    return {"ok": True, "promotedUserId": promoted}
