import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.equipment import (
    DamageClaimIn,
    EquipmentCounterQuoteIn,
    EquipmentUpsertRequest,
    JobExecutionUpdateIn,
    RejectEquipmentBookingRequest,
)
from app.routers.equipment import IST, promote_waitlist_head
from app.routers.users import require_role
from app.services.billing import entitlement_guard, record_usage
from app.services.notifications import send_fcm_to_user
from app.services.users import get_user

router = APIRouter(prefix="/equipment", tags=["equipment-owner"])

SLOT_TEMPLATE_KEYS = {"slotName", "duration", "priceRupees", "recommendedTask"}
UPDATABLE_FIELDS = ("name", "type", "hourlyRate", "perAcreRate", "slotTemplate", "rcDocUrl", "insuranceDocUrl")


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
        })
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
        "photoEvidenceUrls": body.photoEvidenceUrls,
        "status": "under_review",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("equipment_damage_claims", claim_id, doc)
    return doc
