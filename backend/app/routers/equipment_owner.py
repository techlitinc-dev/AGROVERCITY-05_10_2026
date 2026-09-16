import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.equipment import EquipmentUpsertRequest, RejectEquipmentBookingRequest
from app.routers.equipment import IST, promote_waitlist_head
from app.routers.users import require_role
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
async def create_equipment(body: EquipmentUpsertRequest, uid: str = Depends(_owner)):
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
