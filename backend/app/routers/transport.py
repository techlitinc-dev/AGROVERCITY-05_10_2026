import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.transport import (
    AcceptBookingRequest,
    AvailabilityRequest,
    CreateBookingRequest,
    FareEstimateOut,
    FareEstimateRequest,
    OwnerVehicleRequest,
    RejectBookingRequest,
    UpdateBookingRequest,
    VehicleTypeOut,
)
from app.routers.users import require_role
from app.services.notifications import send_fcm_to_user
from app.services.users import get_user

router = APIRouter(prefix="/transport", tags=["transport"])

VEHICLE_TYPES = [
    {"type": "Tata Ace", "baseFare": 500, "perKmRate": 35, "capacityTonnes": 0.75},
    {"type": "Bolero Maxi", "baseFare": 800, "perKmRate": 45, "capacityTonnes": 1.5},
    {"type": "Tractor Trolley", "baseFare": 1000, "perKmRate": 30, "capacityTonnes": 3.0},
]

ALLOWED_TRANSITIONS = {
    "requested": {"accepted", "cancelled"},
    "accepted": {"enRoute", "cancelled"},
    "enRoute": {"delivered"},
}


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def _booker(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer", "seller")
    return uid


async def _viewer(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer", "seller", "transport")
    return uid


async def _transporter(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "transport")
    return uid


def _vehicle_type(name: str) -> dict:
    for vt in VEHICLE_TYPES:
        if vt["type"] == name:
            return vt
    _error(422, "UNKNOWN_VEHICLE_TYPE", "unknown vehicle type", {"vehicleType": "unknown type"})


async def _get_booking(booking_id: str) -> dict:
    booking = await get_doc("transport_bookings", booking_id)
    if booking is None:
        _error(404, "BOOKING_NOT_FOUND", "booking not found")
    return booking


async def _assign_vehicle(booking: dict, uid: str, vehicle_id: str | None, vehicle_no: str | None):
    if vehicle_id is None:
        return
    vehicle = await get_doc("vehicles", vehicle_id)
    if vehicle is None or vehicle.get("ownerId") != uid:
        _error(403, "NOT_VEHICLE_OWNER", "vehicle does not belong to this transporter")
    if vehicle.get("docStatus") != "verified":
        _error(422, "VEHICLE_NOT_VERIFIED", "vehicle documents are not verified", {"vehicleId": "documents not verified"})
    booking["vehicleId"] = vehicle_id
    booking["vehicleNo"] = vehicle_no or vehicle.get("registrationNo")


async def _own_vehicle(vehicle_id: str, uid: str) -> dict:
    vehicle = await get_doc("vehicles", vehicle_id)
    if vehicle is None:
        _error(404, "VEHICLE_NOT_FOUND", "vehicle not found")
    if vehicle.get("ownerId") != uid:
        _error(403, "NOT_VEHICLE_OWNER", "vehicle belongs to another transporter")
    return vehicle


@router.get("/vehicles")
async def list_vehicle_types(uid: str = Depends(_viewer)):
    return {"data": [VehicleTypeOut(**vt).model_dump() for vt in VEHICLE_TYPES]}


@router.post("/vehicles", status_code=201)
async def create_vehicle(body: OwnerVehicleRequest, uid: str = Depends(_transporter)):
    # docStatus verify/reject is an admin action in the Day 14 KYC queue
    doc = {
        **body.model_dump(),
        "id": f"veh_{uuid.uuid4().hex[:12]}",
        "ownerId": uid,
        "active": True,
        "docStatus": "pending",
        "rejectionReason": None,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("vehicles", doc["id"], doc)
    return doc


@router.get("/vehicles/my")
async def list_my_vehicles(verifiedOnly: bool = False, uid: str = Depends(_transporter)):
    docs = await query("vehicles", [("ownerId", "==", uid)], limit=1000)
    docs = [d for d in docs if d.get("active", True)]
    if verifiedOnly:
        docs = [d for d in docs if d.get("docStatus") == "verified"]
    return {"data": docs}


@router.put("/vehicles/{vehicle_id}")
async def update_vehicle(vehicle_id: str, body: OwnerVehicleRequest, uid: str = Depends(_transporter)):
    vehicle = await _own_vehicle(vehicle_id, uid)
    vehicle.update(body.model_dump())
    await set_doc("vehicles", vehicle_id, vehicle)
    return vehicle


@router.delete("/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: str, uid: str = Depends(_transporter)):
    vehicle = await _own_vehicle(vehicle_id, uid)
    vehicle["active"] = False
    await set_doc("vehicles", vehicle_id, vehicle)
    return {"ok": True, "active": False}


@router.get("/vehicles/{vehicle_id}/calendar")
async def vehicle_calendar(vehicle_id: str, uid: str = Depends(_transporter)):
    await _own_vehicle(vehicle_id, uid)
    bookings = await query("transport_bookings", [("vehicleId", "==", vehicle_id)], limit=1000)
    trips = [
        {
            "bookingId": b["id"],
            "date": b.get("date"),
            "status": b.get("status"),
            "pickup": b.get("pickup"),
            "drop": b.get("drop"),
        }
        for b in bookings
        if b.get("status") in ("accepted", "enRoute")
    ]
    return {"vehicleId": vehicle_id, "bookings": trips}


@router.put("/vehicles/{vehicle_id}/availability")
async def set_availability(vehicle_id: str, body: AvailabilityRequest, uid: str = Depends(_transporter)):
    vehicle = await _own_vehicle(vehicle_id, uid)
    vehicle["availableDates"] = body.availableDates
    await set_doc("vehicles", vehicle_id, vehicle)
    return vehicle


@router.post("/fare-estimate", response_model=FareEstimateOut)
async def fare_estimate(body: FareEstimateRequest, uid: str = Depends(_viewer)):
    vt = _vehicle_type(body.vehicleType)
    distance_fare = vt["perKmRate"] * body.distanceKm
    return FareEstimateOut(
        baseFare=vt["baseFare"],
        distanceFare=distance_fare,
        totalFare=vt["baseFare"] + distance_fare,
    )


@router.post("/bookings")
async def create_booking(body: CreateBookingRequest, uid: str = Depends(_booker)):
    vt = _vehicle_type(body.vehicleType)
    if body.lotId is not None:
        lot = await get_doc("market_lots", body.lotId)
        if lot is None or lot.get("farmerId") != uid:
            _error(404, "LOT_NOT_FOUND", "lot not found")
        if lot.get("status") != "open":
            _error(409, "LOT_NOT_OPEN", "lot is not open")
    fare = vt["baseFare"] + vt["perKmRate"] * body.distanceKm
    doc = {
        "id": f"trb_{uuid.uuid4().hex[:12]}",
        "userId": uid,
        "vehicleType": body.vehicleType,
        "distanceKm": body.distanceKm,
        "pickup": body.pickup,
        "drop": body.drop,
        "date": body.date,
        "lotId": body.lotId,
        "fare": int(round(fare)),
        "status": "requested",
        "vehicleId": None,
        "vehicleNo": None,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("transport_bookings", doc["id"], doc)
    return doc


@router.get("/bookings")
async def list_bookings(
    status: str | None = None,
    page: int = 1,
    pageSize: int = 20,
    uid: str = Depends(_transporter),
):
    docs = await query("transport_bookings", [], limit=1000)
    vehicles = await query("vehicles", [("ownerId", "==", uid)], limit=1000)
    vehicle_ids = {v["id"] for v in vehicles}
    docs = [d for d in docs if d.get("status") == "requested" or d.get("vehicleId") in vehicle_ids]
    if status:
        docs = [d for d in docs if d.get("status") == status]
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    total = len(docs)
    start = (page - 1) * pageSize
    page_docs = docs[start:start + pageSize]
    for d in page_docs:
        if d.get("lotId"):
            lot = await get_doc("market_lots", d["lotId"])
            d["lot"] = (
                {"crop": lot["crop"], "quantityQuintals": lot["quantityQuintals"], "expectedRate": lot["expectedRate"]}
                if lot
                else None
            )
    return {"data": page_docs, "page": page, "pageSize": pageSize, "total": total}


@router.patch("/bookings/{booking_id}")
async def update_booking(booking_id: str, body: UpdateBookingRequest, uid: str = Depends(_transporter)):
    # canonical accept/reject paths are POST /bookings/{id}/accept and /reject
    booking = await _get_booking(booking_id)
    allowed = ALLOWED_TRANSITIONS.get(booking.get("status"), set())
    if body.status not in allowed:
        _error(409, "ILLEGAL_TRANSITION", f"cannot move from {booking.get('status')} to {body.status}")
    if body.status == "accepted":
        await _assign_vehicle(booking, uid, body.vehicleId, body.vehicleNo)
    if body.status == "delivered":
        field_errors = {}
        if not body.podPhotos:
            field_errors["podPhotos"] = "at least one delivery photo is required"
        if not body.receiverName or not body.receiverName.strip():
            field_errors["receiverName"] = "receiver name is required"
        if field_errors:
            _error(422, "POD_REQUIRED", "proof of delivery is required", field_errors)
        booking["pod"] = {
            "photos": body.podPhotos,
            "receiverName": body.receiverName.strip(),
            "deliveredAt": datetime.now(timezone.utc).isoformat(),
        }
    booking["status"] = body.status
    await set_doc("transport_bookings", booking_id, booking)
    return booking


@router.post("/bookings/{booking_id}/accept")
async def accept_booking(booking_id: str, body: AcceptBookingRequest, uid: str = Depends(_transporter)):
    booking = await _get_booking(booking_id)
    if booking.get("status") != "requested":
        _error(409, "ILLEGAL_TRANSITION", "only a requested booking can be accepted")
    await _assign_vehicle(booking, uid, body.vehicleId, body.vehicleNo)
    booking["status"] = "accepted"
    booking["transporterId"] = uid
    await set_doc("transport_bookings", booking_id, booking)
    vehicle_label = booking.get("vehicleNo") or "वाहन"
    await send_fcm_to_user(
        booking["userId"],
        "बुकिंग स्वीकृत",
        f"{vehicle_label} आपकी बुकिंग स्वीकार कर रहा है",
        {"type": "booking_accepted", "bookingId": booking_id},
    )
    return booking


@router.post("/bookings/{booking_id}/reject")
async def reject_booking(booking_id: str, body: RejectBookingRequest, uid: str = Depends(_transporter)):
    booking = await _get_booking(booking_id)
    if booking.get("status") != "requested":
        _error(409, "ILLEGAL_TRANSITION", "only a requested booking can be rejected")
    booking["status"] = "cancelled"
    booking["cancellationReason"] = body.reason
    booking["cancelledBy"] = "transporter"
    await set_doc("transport_bookings", booking_id, booking)
    await send_fcm_to_user(
        booking["userId"],
        "बुकिंग अस्वीकृत",
        f"ट्रांसपोर्टर ने आपकी बुकिंग अस्वीकार की: {body.reason}",
        {"type": "booking_rejected", "bookingId": booking_id},
    )
    return booking
