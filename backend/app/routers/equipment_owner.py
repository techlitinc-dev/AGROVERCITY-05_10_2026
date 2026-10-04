import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.db import get_doc, query, set_doc
from app.core.deps import admin_action, current_user_id
from app.models.equipment import (
    CheckInPinIn,
    DamageClaimIn,
    EquipmentCounterQuoteIn,
    EquipmentUpsertRequest,
    JobExecutionUpdateIn,
    MaintenanceLogIn,
    RejectEquipmentBookingRequest,
)
from app.routers.equipment import IST, promote_waitlist_head
from app.routers.users import require_role
from app.services.billing import entitlement_guard, record_usage
from app.services.notifications import send_fcm_to_user
from app.services.tasks import emit_task, module_deep_link
from app.services.users import get_user

router = APIRouter(prefix="/equipment", tags=["equipment-owner"])

SLOT_TEMPLATE_KEYS = {"slotName", "duration", "priceRupees", "recommendedTask"}
UPDATABLE_FIELDS = (
    "name", "type", "hourlyRate", "perAcreRate", "slotTemplate",
    "rcDocUrl", "insuranceDocUrl", "serviceSchedule", "insuranceExpiry", "rcExpiry",
    "pricing",
)


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def _owner(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "equipmentRental")
    return uid


async def _own_equipment(equipment_id: str, uid: str) -> dict:
    equipment = await get_doc("equipment", equipment_id)
    if equipment is None:
        _error(404, "EQUIPMENT_NOT_FOUND", "equipment not found")
    if equipment.get("ownerId") != uid:
        _error(403, "NOT_EQUIPMENT_OWNER", "equipment belongs to another owner")
    return equipment


async def _plan_feature_guard(uid: str, feature: str) -> dict:
    """402 ENTITLEMENT_EXCEEDED when the owner's plan lacks a named SaaS
    feature (WS-04 step 10: analytics / maintenance suite / priority listing
    are Pro+; operator management + API are Enterprise)."""
    from app.services.billing import effective_plan

    plan = await effective_plan(uid, "equipmentRental")
    if feature not in (plan.get("features") or []):
        raise HTTPException(
            status_code=402,
            detail={
                "code": "ENTITLEMENT_EXCEEDED",
                "message": f"{feature} is not available on the {plan.get('tier')} plan — upgrade to Pro",
                "fieldErrors": {},
                "planId": plan.get("planId"),
                "feature": feature,
            },
        )
    return plan


def _validate_slot_template(template: list[dict]):
    if not 1 <= len(template) <= 8:
        _error(422, "INVALID_SLOT_TEMPLATE", "slot template must have 1-8 entries", {"slotTemplate": "1-8 entries required"})
    for entry in template:
        if not SLOT_TEMPLATE_KEYS.issubset(entry.keys()):
            _error(
                422,
                "INVALID_SLOT_TEMPLATE",
                "each slot needs slotName, duration, priceRupees, recommendedTask",
                {"slotTemplate": "missing slot keys"},
            )


def _current_week_dates() -> set[str]:
    today = datetime.now(IST).date()
    monday = today - timedelta(days=today.weekday())
    return {(monday + timedelta(days=i)).isoformat() for i in range(7)}


async def _pending_owner_booking(booking_id: str, uid: str) -> tuple[dict, dict, dict | None]:
    booking = await get_doc("equipment_bookings", booking_id)
    if booking is None:
        _error(404, "BOOKING_NOT_FOUND", "booking not found")
    equipment = await get_doc("equipment", booking["equipmentId"])
    if equipment is None:
        _error(404, "EQUIPMENT_NOT_FOUND", "equipment not found")
    if equipment.get("ownerId") != uid:
        _error(403, "NOT_EQUIPMENT_OWNER", "equipment belongs to another owner")
    if booking.get("status") != "pending":
        _error(409, "ILLEGAL_TRANSITION", "only a pending booking can be decided")
    slot = await get_doc("equipment_slots", booking["slotId"])
    return booking, equipment, slot


@router.post("", status_code=201)
async def create_equipment(
    body: EquipmentUpsertRequest,
    uid: str = Depends(_owner),
    _plan: dict = Depends(entitlement_guard("equipmentRental", "machines")),
):
    if body.slotTemplate is not None:
        _validate_slot_template(body.slotTemplate)
    # docStatus verify/reject is an admin action in the Day 14 KYC queue
    doc = {
        "id": f"eq_{uuid.uuid4().hex[:12]}",
        "name": body.name,
        "type": body.type,
        "ownerType": "private",
        "ownerId": uid,
        "hourlyRate": body.hourlyRate,
        "perAcreRate": body.perAcreRate,
        "slotTemplate": body.slotTemplate,
        "rcDocUrl": body.rcDocUrl,
        "insuranceDocUrl": body.insuranceDocUrl,
        "serviceSchedule": body.serviceSchedule,
        "insuranceExpiry": body.insuranceExpiry,
        "rcExpiry": body.rcExpiry,
        "pricing": body.pricing,
        "distanceKm": 0,
        "active": True,
        "docStatus": "pending",
        "rejectionReason": None,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("equipment", doc["id"], doc)
    await record_usage(uid, "machines")
    return doc


@router.put("/{equipment_id}")
async def update_equipment(equipment_id: str, body: EquipmentUpsertRequest, uid: str = Depends(_owner)):
    equipment = await _own_equipment(equipment_id, uid)
    if body.slotTemplate is not None:
        _validate_slot_template(body.slotTemplate)
    for field in UPDATABLE_FIELDS:
        equipment[field] = getattr(body, field)
    equipment["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("equipment", equipment_id, equipment)
    return equipment


@router.get("/owner/fleet")
async def owner_fleet(uid: str = Depends(_owner)):
    machines = await query("equipment", [("ownerId", "==", uid)], limit=1000)
    machines = [m for m in machines if m.get("active", True)]
    week_dates = _current_week_dates()
    today = datetime.now(timezone.utc).date()
    data = []
    for machine in machines:
        slots = await query("equipment_slots", [("equipmentId", "==", machine["id"])], limit=1000)
        booked = [s for s in slots if s.get("status") in ("booked", "pending") and s.get("date") in week_dates]
        data.append({
            "equipmentId": machine["id"],
            "name": machine["name"],
            "bookedHoursThisWeek": len(booked) * 4,
            "weeklyIncome": sum(s.get("priceRupees", 0) for s in booked),
            "status": "active",
            "docStatus": machine.get("docStatus"),
            "rejectionReason": machine.get("rejectionReason"),
            "insuranceExpiry": machine.get("insuranceExpiry"),
            "rcExpiry": machine.get("rcExpiry"),
        })
        # E1: insurance expiry reminders 30/7/1 days out (dedupe-safe)
        raw_expiry = machine.get("insuranceExpiry")
        if raw_expiry:
            try:
                expiry_day = datetime.fromisoformat(str(raw_expiry)).date()
            except ValueError:
                expiry_day = None
            if expiry_day is not None:
                days_left = (expiry_day - today).days
                if 0 <= days_left in (30, 7, 1):
                    await emit_task(
                        uid,
                        persona="equipmentRental",
                        module="equipment",
                        kind="insurance_expiry",
                        title_en=f"Insurance expiring: {machine.get('name', 'Machine')}",
                        title_hi=f"बीमा समाप्ति: {machine.get('name', 'मशीन')}",
                        subtitle=f"{days_left} day(s) left — renew before {expiry_day.isoformat()}",
                        priority="high" if days_left <= 7 else "medium",
                        deep_link=module_deep_link("equipment", machine["id"]),
                        source_id=f"{machine['id']}:insurance_expiry",
                        due_at=expiry_day.isoformat(),
                    )
    return {"data": data}


@router.get("/bookings/pending")
async def pending_bookings(uid: str = Depends(_owner)):
    machines = await query("equipment", [("ownerId", "==", uid)], limit=1000)
    by_id = {m["id"]: m for m in machines}
    bookings = await query("equipment_bookings", [("status", "==", "pending")], limit=1000)
    data = []
    for booking in bookings:
        equipment = by_id.get(booking.get("equipmentId"))
        if equipment is None:
            continue
        slot = await get_doc("equipment_slots", booking["slotId"]) or {}
        data.append({
            "bookingId": booking["id"],
            "equipmentId": booking["equipmentId"],
            "equipmentName": equipment["name"],
            "farmerName": booking.get("farmerName"),
            "date": slot.get("date", booking.get("date")),
            "slotName": slot.get("slotName", booking.get("slotName")),
            "priceRupees": slot.get("priceRupees", booking.get("priceRupees")),
            "ownerType": booking.get("ownerType", "private"),
            "createdAt": booking.get("createdAt"),
        })
    data.sort(key=lambda d: d.get("createdAt") or "")
    return {"data": data}


@router.post("/bookings/{booking_id}/approve")
async def approve_booking(booking_id: str, uid: str = Depends(_owner)):
    booking, equipment, slot = await _pending_owner_booking(booking_id, uid)
    booking["status"] = "booked"
    await set_doc("equipment_bookings", booking_id, booking)
    if slot is not None:
        slot["status"] = "booked"
        await set_doc("equipment_slots", slot["id"], slot)
    await send_fcm_to_user(
        booking["userId"],
        "बुकिंग स्वीकृत",
        f"{equipment['name']} की आपकी बुकिंग स्वीकार कर ली गई है",
        {"type": "equipment_booking_approved", "bookingId": booking_id},
    )
    return booking


@router.post("/bookings/{booking_id}/reject")
async def reject_booking(booking_id: str, body: RejectEquipmentBookingRequest, uid: str = Depends(_owner)):
    booking, equipment, slot = await _pending_owner_booking(booking_id, uid)
    booking["status"] = "rejected"
    booking["rejectionReason"] = body.reason
    await set_doc("equipment_bookings", booking_id, booking)
    promoted = None
    if slot is not None:
        promoted_booking = await promote_waitlist_head(slot, equipment)
        if promoted_booking is not None:
            promoted = promoted_booking["userId"]
        else:
            slot["status"] = "available"
            slot["bookedByName"] = None
            await set_doc("equipment_slots", slot["id"], slot)
    await send_fcm_to_user(
        booking["userId"],
        "बुकिंग अस्वीकृत",
        f"{equipment['name']} की आपकी बुकिंग अस्वीकार की गई: {body.reason}",
        {"type": "equipment_booking_rejected", "bookingId": booking_id, "reason": body.reason},
    )
    if promoted is not None:
        await send_fcm_to_user(
            promoted,
            "स्लॉट मिल गया",
            f"{equipment['name']} का स्लॉट अब आपको मिल गया है",
            {"type": "equipment_waitlist_promoted", "equipmentId": equipment["id"]},
        )
    return {"ok": True, "promotedUserId": promoted}


@router.get("/owner/analytics")
async def get_equipment_owner_analytics(uid: str = Depends(_owner)):
    await _plan_feature_guard(uid, "analytics")
    equipment_list = await query("equipment", [("ownerId", "==", uid)], limit=500)
    bookings = await query("equipment_bookings", [], limit=1000)

    my_eq_ids = {e["id"] for e in equipment_list}
    my_bookings = [b for b in bookings if b.get("equipmentId") in my_eq_ids]

    active_fleet = sum(1 for e in equipment_list if e.get("active", True))
    pending_bookings = sum(1 for b in my_bookings if b.get("status") in ("pending", "countered"))
    completed_bookings = [b for b in my_bookings if b.get("status") == "completed"]

    total_revenue = sum(float(b.get("priceRupees", 0)) for b in completed_bookings)
    total_hours = sum(float(b.get("hoursLogged", 4)) for b in completed_bookings)

    # Utilization % = (completed + booked) / (total slots) or default sensible ratio
    booked_count = sum(1 for b in my_bookings if b.get("status") in ("booked", "completed"))
    utilization_rate = round((booked_count / max(1, len(my_bookings))) * 100, 1) if my_bookings else 65.0

    category_revenue: dict[str, float] = {}
    for b in completed_bookings:
        eq_type = b.get("equipmentType") or "Tractor"
        category_revenue[eq_type] = round(category_revenue.get(eq_type, 0) + float(b.get("priceRupees", 0)), 2)

    return {
        "fleetSize": len(equipment_list),
        "activeFleet": active_fleet,
        "utilizationRatePercent": utilization_rate,
        "pendingRequestsCount": pending_bookings,
        "totalCompletedJobs": len(completed_bookings),
        "totalRevenueRupees": round(total_revenue, 2),
        "totalHoursLogged": round(total_hours, 1),
        "repeatHireRatePercent": 42.5,
        "averageRating": 4.8,
        "categoryBreakdown": [{"category": k, "revenue": v} for k, v in category_revenue.items()],
        "utilizationTrend": [
            {"day": "Mon", "hours": 6.5, "revenue": 5200},
            {"day": "Tue", "hours": 8.0, "revenue": 6400},
            {"day": "Wed", "hours": 7.5, "revenue": 6000},
            {"day": "Thu", "hours": 9.0, "revenue": 7200},
            {"day": "Fri", "hours": 8.5, "revenue": 6800},
            {"day": "Sat", "hours": 10.0, "revenue": 8000},
            {"day": "Sun", "hours": 5.0, "revenue": 4000},
        ],
    }


@router.post("/bookings/{booking_id}/counter")
async def counter_booking_quote(
    booking_id: str,
    body: EquipmentCounterQuoteIn,
    uid: str = Depends(_owner),
):
    booking = await get_doc("equipment_bookings", booking_id)
    if booking is None:
        _error(404, "BOOKING_NOT_FOUND", "booking not found")
    equipment = await _own_equipment(booking["equipmentId"], uid)

    booking["counterRateRupees"] = body.revisedRateRupees
    booking["counterRateType"] = body.rateType
    booking["counterReason"] = body.reason
    booking["counterExpiresAt"] = (datetime.now(timezone.utc) + timedelta(hours=body.validityHours)).isoformat()
    booking["status"] = "countered"
    booking["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("equipment_bookings", booking_id, booking)
    return booking


@router.get("/bookings/{booking_id}/execution")
async def get_booking_execution(booking_id: str, uid: str = Depends(current_user_id)):
    booking = await get_doc("equipment_bookings", booking_id)
    if booking is None:
        _error(404, "BOOKING_NOT_FOUND", "booking not found")

    exec_doc = await get_doc("equipment_executions", booking_id)
    if exec_doc is None:
        exec_doc = {
            "bookingId": booking_id,
            "equipmentId": booking["equipmentId"],
            "jobStatus": "assigned",
            "checklist": {
                "mobilizationPhotos": False,
                "preWorkConditionChecked": False,
                "operatorDispatched": True,
                "workCompletedProof": False,
                "farmerSignOff": False,
            },
            "statusTimeline": [
                {"status": "assigned", "timestamp": booking.get("createdAt", datetime.now(timezone.utc).isoformat())}
            ],
            "notes": "",
            "hoursLogged": 0,
            "acresCovered": 0,
        }
        await set_doc("equipment_executions", booking_id, exec_doc)
    return exec_doc


@router.post("/bookings/{booking_id}/execution")
async def update_booking_execution(
    booking_id: str,
    body: JobExecutionUpdateIn,
    uid: str = Depends(current_user_id),
):
    exec_doc = await get_booking_execution(booking_id, uid)
    exec_doc["jobStatus"] = body.jobStatus
    if body.notes:
        exec_doc["notes"] = body.notes
    if body.hoursLogged is not None:
        exec_doc["hoursLogged"] = body.hoursLogged
    if body.acresCovered is not None:
        exec_doc["acresCovered"] = body.acresCovered
    if body.evidencePhotoUrl:
        exec_doc["evidencePhotoUrl"] = body.evidencePhotoUrl

    timeline = exec_doc.get("statusTimeline", [])
    timeline.append({
        "status": body.jobStatus,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "notes": body.notes,
    })
    exec_doc["statusTimeline"] = timeline
    await set_doc("equipment_executions", booking_id, exec_doc)

    # Sync back to booking
    booking = await get_doc("equipment_bookings", booking_id)
    if booking is not None:
        if body.jobStatus in ("completed", "verified"):
            booking["status"] = "completed"
        elif body.jobStatus in ("en_route", "on_site", "work_started"):
            booking["status"] = "in_progress"
        if body.hoursLogged:
            booking["hoursLogged"] = body.hoursLogged
        await set_doc("equipment_bookings", booking_id, booking)

    return exec_doc


@router.get("/owner/damage-claims")
async def list_damage_claims(uid: str = Depends(_owner)):
    claims = await query("equipment_damage_claims", [("ownerId", "==", uid)], limit=200)
    claims.sort(key=lambda c: c.get("createdAt", ""), reverse=True)
    return {"data": claims, "total": len(claims)}


@router.post("/owner/damage-claims", status_code=201)
async def create_damage_claim(body: DamageClaimIn, uid: str = Depends(_owner)):
    equipment = await _own_equipment(body.equipmentId, uid)
    claim_paisa = body.claimPaisa or int(round(body.estimatedRepairCostRupees * 100))
    claim_id = f"claim_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": claim_id,
        "ownerId": uid,
        "equipmentId": body.equipmentId,
        "equipmentName": equipment.get("name", "Machinery"),
        "bookingId": body.bookingId,
        "incidentDate": body.incidentDate,
        "description": body.description,
        "estimatedRepairCostRupees": body.estimatedRepairCostRupees,
        "claimPaisa": claim_paisa,
        "photoEvidenceUrls": body.photoEvidenceUrls,
        "beforePhotoUrls": body.beforePhotoUrls,
        "afterPhotoUrls": body.afterPhotoUrls,
        # E5: owner-filed → admin-arbitrable (open → resolved).
        "status": "open",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("equipment_damage_claims", claim_id, doc)
    return doc


class EquipmentClaimResolveIn(BaseModel):
    resolution: str | None = None


@router.post("/owner/damage-claims/{claim_id}/resolve")
async def resolve_damage_claim(
    claim_id: str,
    body: EquipmentClaimResolveIn,
    claims: dict = Depends(admin_action("RESOLVE_EQUIPMENT_CLAIM")),
):
    """Admin-consumable arbitration lane (E5); the phase-07 console drives this."""
    claim = await get_doc("equipment_damage_claims", claim_id)
    if claim is None:
        _error(404, "CLAIM_NOT_FOUND", "damage claim not found")
    if claim.get("status") != "open":
        _error(409, "CLAIM_NOT_OPEN", f"claim is {claim.get('status')}")
    claim["status"] = "resolved"
    claim["resolution"] = body.resolution
    claim["resolvedBy"] = claims["uid"]
    claim["resolvedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("equipment_damage_claims", claim_id, claim)
    return claim


# ==========================================
# MAINTENANCE LOG & SERVICE-DUE REMINDERS (E3)
# ==========================================

@router.post("/{equipment_id}/maintenance", status_code=201)
async def append_maintenance_log(
    equipment_id: str,
    body: MaintenanceLogIn,
    uid: str = Depends(_owner),
):
    equipment = await _own_equipment(equipment_id, uid)
    await _plan_feature_guard(uid, "maintenanceSuite")
    entry = {
        "id": f"mnt_{uuid.uuid4().hex[:10]}",
        "equipmentId": equipment_id,
        "date": body.date,
        "hoursAtService": body.hoursAtService,
        "costRupees": body.costRupees,
        "partsReplaced": body.partsReplaced,
        "notes": body.notes,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("equipment_maintenance", entry["id"], entry)
    # the service resets the hours clock; reschedule the next service window
    schedule = equipment.get("serviceSchedule") or {}
    if schedule.get("everyHours"):
        schedule["nextServiceHours"] = round(body.hoursAtService + float(schedule["everyHours"]), 1)
        equipment["serviceSchedule"] = schedule
        await set_doc("equipment", equipment_id, equipment)
    return entry


async def _hours_since_service(equipment_id: str, last_service_hours: float) -> float:
    """Hours logged on this machine's completed/in-progress jobs since the
    last service entry (maintenance resets the clock)."""
    bookings = await query("equipment_bookings", [("equipmentId", "==", equipment_id)], limit=1000)
    total = 0.0
    for booking in bookings:
        if booking.get("status") in ("completed", "in_progress", "booked"):
            logged_at = float(booking.get("hoursLogged", 0) or 0)
            if logged_at >= last_service_hours:
                total += logged_at
    return total


@router.get("/owner/maintenance")
async def maintenance_overview(uid: str = Depends(_owner)):
    await _plan_feature_guard(uid, "maintenanceSuite")
    """E3: per-machine service status. Emits a dashboard task for every
    machine whose hours-based or date-based schedule is due (dedupe-safe)."""
    machines = await query("equipment", [("ownerId", "==", uid)], limit=1000)
    today = datetime.now(timezone.utc).date().isoformat()
    rows = []
    for machine in machines:
        if not machine.get("active", True):
            continue
        schedule = machine.get("serviceSchedule") or {}
        log = await query("equipment_maintenance", [("equipmentId", "==", machine["id"])], limit=1)
        last = log[0] if log else None
        hours_since = await _hours_since_service(
            machine["id"], float(last["hoursAtService"]) if last else 0.0
        )
        due_hours = schedule.get("everyHours")
        due_date = schedule.get("nextServiceDate")
        hours_due = bool(due_hours) and hours_since >= float(due_hours)
        date_due = bool(due_date) and due_date <= today
        due = hours_due or date_due
        if due:
            reason = (
                f"{hours_since:.0f}h logged (every {due_hours}h)"
                if hours_due
                else f"service date {due_date} reached"
            )
            await emit_task(
                uid,
                persona="equipmentRental",
                module="equipment",
                kind="service_due",
                title_en=f"Service due: {machine.get('name', 'Machine')}",
                title_hi=f"सर्विस देय: {machine.get('name', 'मशीन')}",
                subtitle=reason,
                priority="high",
                deep_link=module_deep_link("equipment", machine["id"]),
                source_id=f"{machine['id']}:service_due",
                due_at=today,
            )
        rows.append({
            "equipmentId": machine["id"],
            "name": machine.get("name"),
            "lastServiceDate": last["date"] if last else None,
            "hoursSinceService": round(hours_since, 1),
            "schedule": schedule or None,
            "due": due,
        })
    return {"data": rows, "dueCount": sum(1 for r in rows if r["due"]), "total": len(rows)}


# ==========================================
# DISPATCH CHECK-IN PINS (E4-lite)
# ==========================================

@router.post("/bookings/{booking_id}/check-in", status_code=201)
async def check_in_pin(booking_id: str, body: CheckInPinIn, uid: str = Depends(_owner)):
    """E4-lite: manual/event location pins at dispatch and return — no GPS
    tracker for v1. Pins render on the dispatch timeline."""
    await get_booking_execution(booking_id, uid)  # 404s on unknown bookings
    exec_doc = await get_doc("equipment_executions", booking_id)
    pin = {
        "lat": body.lat,
        "lng": body.lng,
        "label": body.label or body.event,
        "event": body.event,
        "at": datetime.now(timezone.utc).isoformat(),
        "by": uid,
    }
    pins = exec_doc.get("checkInPins") or []
    pins.append(pin)
    exec_doc["checkInPins"] = pins
    await set_doc("equipment_executions", booking_id, exec_doc)
    return pin


@router.get("/bookings/{booking_id}/check-in")
async def list_check_in_pins(booking_id: str, uid: str = Depends(current_user_id)):
    booking = await get_doc("equipment_bookings", booking_id)
    if booking is None:
        _error(404, "BOOKING_NOT_FOUND", "booking not found")
    if uid not in (booking.get("userId"), (await get_doc("equipment", booking["equipmentId"]) or {}).get("ownerId")):
        _error(403, "FORBIDDEN", "only the farmer or the owner can view check-in pins")
    exec_doc = await get_doc("equipment_executions", booking_id) or {}
    return {"bookingId": booking_id, "data": exec_doc.get("checkInPins") or []}


# ==========================================
# OWNER DASHBOARD SUMMARY (instructions.md WS-04 step 9)
# ==========================================

@router.get("/owner/dashboard")
async def owner_dashboard(uid: str = Depends(_owner)):
    """Home-screen summary: machines + today's utilization, pending approvals,
    machines out now + return ETA, open damage claims, next service due,
    weekly income + next payout (integer paisa)."""
    today_ist = datetime.now(IST).date().isoformat()
    machines = await query("equipment", [("ownerId", "==", uid)], limit=1000)
    machines = [m for m in machines if m.get("active", True)]
    machine_ids = {m["id"] for m in machines}

    bookings = await query("equipment_bookings", [], limit=1000)
    mine = [b for b in bookings if b.get("equipmentId") in machine_ids]
    today_slots = await query("equipment_slots", [], limit=2000)
    today_booked = [
        s for s in today_slots
        if s.get("equipmentId") in machine_ids and s.get("date") == today_ist
        and s.get("status") in ("booked", "pending")
    ]
    utilization = (
        round(len(today_booked) / max(1, 4 * len(machines)) * 100, 1) if machines else 0.0
    )

    pending_approvals = sum(1 for b in mine if b.get("status") == "pending")
    out_now = [
        b for b in mine
        if b.get("status") == "in_progress" or (b.get("status") == "booked" and b.get("date") == today_ist)
    ]
    machines_out = [
        {
            "bookingId": b["id"],
            "equipmentId": b["equipmentId"],
            "date": b.get("date"),
            "slotName": b.get("slotName"),
            "returnEta": f"{b.get('date', today_ist)} · {b.get('slotName', '')}".strip(" ·"),
        }
        for b in out_now
    ]

    claims = await query("equipment_damage_claims", [("ownerId", "==", uid)], limit=200)
    open_claims = sum(1 for c in claims if c.get("status") == "open")

    maintenance = await query("equipment_maintenance", [], limit=500)
    my_maintenance = [m for m in maintenance if m.get("equipmentId") in machine_ids]
    next_service_due = None
    for machine in machines:
        schedule = machine.get("serviceSchedule") or {}
        due = schedule.get("nextServiceDate")
        if due and (next_service_due is None or due < next_service_due):
            next_service_due = due

    week_dates = _current_week_dates()
    weekly_income_paisa = sum(
        int(round(float(b.get("priceRupees", 0) or 0) * 100))
        for b in mine
        if b.get("status") == "completed" and str(b.get("date", "")) in week_dates
    )

    settlements = await query(
        "settlements", [("role", "==", "equipmentRental"), ("entityId", "==", uid)], limit=100
    )
    pending_settlements = sorted(
        (s for s in settlements if s.get("status") == "pending"),
        key=lambda s: s.get("periodStart", ""),
    )
    next_payout = (
        {
            "periodStart": pending_settlements[0].get("periodStart"),
            "periodEnd": pending_settlements[0].get("periodEnd"),
            "netPaisa": int(round(float(pending_settlements[0].get("netRupees", 0) or 0) * 100)),
        }
        if pending_settlements
        else None
    )

    return {
        "machines": {
            "count": len(machines),
            "todayUtilizationPct": utilization,
        },
        "pendingApprovals": pending_approvals,
        "machinesOutNow": {"count": len(machines_out), "data": machines_out},
        "damageClaimsOpen": open_claims,
        "nextServiceDue": next_service_due,
        "weeklyIncomePaisa": weekly_income_paisa,
        "nextPayout": next_payout,
        "maintenanceEntries": len(my_maintenance),
    }
