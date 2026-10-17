"""SOP-08 / SOP-09 — superadmin transport-fleet & dispatch and equipment
yantra-slot logistics (docs/superadmin-instructions/08 & 09).

Endpoints (all under /v1/admin, admin-token gated):
- GET    /transport/bookings                          active+historical bookings
- PUT    /transport/bookings/{booking_id}/status      manual trip-status intervention
- PUT    /equipment/{equipment_id}/verify             approve machine for public booking
- GET    /equipment/bookings                          slot bookings + waitlist entries
- DELETE /equipment/bookings/{booking_id}             admin force-cancellation w/ refund

The transport status machine (ALLOWED_TRANSITIONS) is imported from the real
router; equipment cancel reuses the real slot-release + waitlist-promotion and
the refunds-ledger convention from the equipment routers. Every mutation
requires X-Audit-Reason (admin_mutation_context) and writes an audit_logs row.
"""
import uuid
from datetime import datetime, timezone

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.db import get_doc, query, set_doc
from app.routers.equipment import promote_waitlist_head
from app.routers.transport import ALLOWED_TRANSITIONS
from app.services.admin_auth import admin_mutation_context, current_admin_user
from app.services.audit import log_admin_action
from app.services.chat import ensure_transport_room
from app.services.notifications import send_fcm_to_user
from app.services.notify import notify_user
from app.services.rating_prompts import open_rating_prompt

router = APIRouter(prefix="/admin", tags=["admin"])

# Waypoint labels mirror routers/transport.py update_booking.
_WAYPOINT_LABELS = {
    "accepted": "स्वीकृत",
    "enRoute": "रास्ते में",
    "delivered": "डिलीवर पूर्ण",
    "cancelled": "रद्द",
}


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _admin_id(admin: dict) -> str:
    return admin.get("id") or admin.get("uid") or "admin"


# ===========================================================================
# SOP-08 — transport bookings oversight
# ===========================================================================

@router.get("/transport/bookings")
async def list_transport_bookings(
    status: str | None = Query(None, description="booking status filter; 'all' = no filter"),
    search: str | None = Query(None, description="matches id, parties, route, commodity, vehicle"),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_admin_user),
):
    """Active + historical transport_bookings, newest first, enveloped."""
    docs = await query("transport_bookings", [], limit=2000)
    if status and status != "all":
        docs = [d for d in docs if d.get("status") == status]
    if search:
        needle = search.lower()
        keys = ("id", "userId", "transporterId", "pickup", "drop", "commodity", "vehicleNo", "driverName")
        docs = [
            d for d in docs
            if any(needle in str(d.get(k) or "").lower() for k in keys)
        ]
    docs.sort(key=lambda d: d.get("createdAt") or "", reverse=True)
    total = len(docs)
    start = (page - 1) * pageSize
    rows = docs[start:start + pageSize]
    # Lot snapshot enrichment, identical to routers/transport.py list_bookings.
    for d in rows:
        if d.get("lotId"):
            lot = await get_doc("market_lots", d["lotId"])
            d["lot"] = (
                {"crop": lot["crop"], "quantityQuintals": lot["quantityQuintals"], "expectedRate": lot["expectedRate"]}
                if lot
                else None
            )
    return {"data": rows, "page": page, "pageSize": pageSize, "total": total}


class TransportBookingStatusIn(BaseModel):
    status: str = Field(..., description="accepted | enRoute | delivered | cancelled")
    reason: str | None = Field(None, description="optional detail; X-Audit-Reason is the audit reason")
    transporterId: str | None = None
    vehicleId: str | None = None
    vehicleNo: str | None = None
    driverName: str | None = None
    driverPhone: str | None = None
    podPhotos: list[str] | None = None
    receiverName: str | None = None
    receiverPhone: str | None = None
    damageNotes: str | None = None


@router.put("/transport/bookings/{booking_id}/status")
async def intervene_transport_booking_status(
    booking_id: str,
    body: TransportBookingStatusIn,
    ctx: dict = Depends(admin_mutation_context),
):
    """Manual trip-status intervention. Legality comes from the real status
    machine in routers/transport.py (ALLOWED_TRANSITIONS); side effects mirror
    update_booking: waypoint log, chat unlock on accept, party notifications,
    POD capture + two-way rating prompts on delivery, cancellation reason."""
    booking = await get_doc("transport_bookings", booking_id)
    if booking is None:
        _error(404, "BOOKING_NOT_FOUND", "booking not found")
    current = booking.get("status")
    allowed = ALLOWED_TRANSITIONS.get(current, set())
    if body.status not in allowed:
        _error(409, "ILLEGAL_TRANSITION", f"cannot move from {current} to {body.status}")

    previous = {"status": current}
    now = _now()
    admin_id = _admin_id(ctx["admin"])
    detail_reason = (body.reason or "").strip() or ctx["reason"]

    if body.status == "accepted":
        if body.transporterId:
            booking["transporterId"] = body.transporterId
        for field in ("vehicleId", "vehicleNo", "driverName", "driverPhone"):
            value = getattr(body, field)
            if value:
                booking[field] = value
        if booking.get("transporterId") and booking.get("userId"):
            room = await ensure_transport_room(booking)
            if room:
                for party in (booking["userId"], booking["transporterId"]):
                    await notify_user(
                        party,
                        type="chat_unlocked",
                        title="Chat unlocked / चैट खुली",
                        body=f"{booking.get('commodity') or booking.get('vehicleType', 'Trip')} — coordinate the pickup in-app",
                        deepLink=f"/dashboard/p/transport/trips/{booking_id}/chat",
                    )
    elif body.status == "enRoute":
        if booking.get("userId"):
            await notify_user(
                booking["userId"],
                type="trip_enroute",
                title="Vehicle en route / गाड़ी निकली",
                body=f"{booking.get('commodity') or booking.get('vehicleType', 'Trip')} — {booking.get('vehicleNo') or 'vehicle'} is heading to pickup",
                deepLink=f"/dashboard/p/transport/trips/{booking_id}",
            )
    elif body.status == "delivered":
        if body.podPhotos and body.receiverName and body.receiverName.strip():
            booking["pod"] = {
                "photos": body.podPhotos,
                "receiverName": body.receiverName.strip(),
                "receiverPhone": body.receiverPhone,
                "damageNotes": body.damageNotes,
                "deliveredAt": now,
            }
        await open_rating_prompt(
            booking.get("userId"), booking.get("transporterId"), booking_id, "transport_delivery"
        )
        await open_rating_prompt(
            booking.get("transporterId"), booking.get("userId"), booking_id, "transport_shipper"
        )
        if booking.get("userId"):
            await notify_user(
                booking["userId"],
                type="trip_delivered",
                title="Delivered / डिलीवर हुआ",
                body="Proof of delivery filed — inspect and rate your transporter",
                deepLink=f"/dashboard/p/transport/trips/{booking_id}",
            )
    elif body.status == "cancelled":
        booking["cancellationReason"] = detail_reason
        booking["cancelledBy"] = "admin"
        for party in (booking.get("userId"), booking.get("transporterId")):
            if not party:
                continue
            await notify_user(
                party,
                type="booking_cancelled",
                title="Booking cancelled by admin / बुकिंग एडमिन द्वारा रद्द",
                body=f"{booking.get('commodity') or booking.get('vehicleType', 'Trip')} — {detail_reason}",
                deepLink=f"/dashboard/p/transport/trips/{booking_id}",
            )

    booking["status"] = body.status
    waypoints = booking.get("waypointsLog") or []
    label = _WAYPOINT_LABELS.get(body.status, body.status)
    if body.status == "cancelled":
        label = f"{label}: {detail_reason}"
    waypoints.append({
        "waypoint": body.status,
        "label": label,
        "time": now,
        "by": "admin",
        "adminId": admin_id,
    })
    booking["waypointsLog"] = waypoints
    booking["updatedAt"] = now
    await set_doc("transport_bookings", booking_id, booking)

    await log_admin_action(
        ctx["admin"], "transport", "booking.status", booking_id,
        previous, {"status": body.status, "reason": detail_reason},
        ctx["reason"], ctx["ip"],
    )
    return {"success": True, "booking": booking}


# ===========================================================================
# SOP-09 — equipment verification, bookings & force cancellation
# ===========================================================================

class EquipmentVerifyIn(BaseModel):
    notes: str | None = Field(None, description="optional verification note")


@router.put("/equipment/{equipment_id}/verify")
async def verify_equipment(
    equipment_id: str,
    body: EquipmentVerifyIn | None = None,
    ctx: dict = Depends(admin_mutation_context),
):
    """Approve a machine for public booking. The public browse surface
    (routers/equipment.py list_equipment) only shows docStatus == 'verified'
    machines, so verification flips docStatus following the equipment_owner.py
    field convention (docStatus / rejectionReason)."""
    equipment = await get_doc("equipment", equipment_id)
    if equipment is None:
        _error(404, "EQUIPMENT_NOT_FOUND", "equipment not found")
    if equipment.get("docStatus") == "verified":
        _error(409, "ALREADY_VERIFIED", "equipment is already verified")
    previous = {"docStatus": equipment.get("docStatus"), "rejectionReason": equipment.get("rejectionReason")}
    equipment["docStatus"] = "verified"
    equipment["rejectionReason"] = None
    equipment["verifiedAt"] = _now()
    equipment["verifiedBy"] = _admin_id(ctx["admin"])
    if body and body.notes:
        equipment["verificationNotes"] = body.notes
    equipment["updatedAt"] = _now()
    await set_doc("equipment", equipment_id, equipment)

    owner_id = equipment.get("ownerId")
    if owner_id:
        await send_fcm_to_user(
            owner_id,
            "मशीन सत्यापित",
            f"{equipment.get('name', 'मशीन')} अब सार्वजनिक बुकिंग के लिए सत्यापित है",
            {"type": "equipment_verified", "equipmentId": equipment_id},
        )
    await log_admin_action(
        ctx["admin"], "equipment", "equipment.verified", equipment_id,
        previous, {"docStatus": "verified"}, ctx["reason"], ctx["ip"],
    )
    return {"success": True, "equipment": equipment}


@router.get("/equipment/bookings")
async def list_equipment_bookings(
    status: str | None = Query(None, description="booking status filter, or 'waitlist' for waitlist entries only; 'all' = both"),
    search: str | None = Query(None, description="matches id, farmer, machine, slot"),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_admin_user),
):
    """equipment_bookings (all statuses) plus waitlist entries from
    equipment_waitlists, newest first, enveloped."""
    equipment_index = {e["id"]: e for e in await query("equipment", [], limit=1000)}
    bookings = await query("equipment_bookings", [], limit=2000)

    rows: list[dict] = []
    if not status or status in ("all", "waitlist"):
        slots = {s["id"]: s for s in await query("equipment_slots", [], limit=2000)}
        for entry in await query("equipment_waitlists", [], limit=1000):
            slot = slots.get(entry.get("slotId")) or {}
            rows.append({
                **entry,
                "entryType": "waitlist",
                "equipmentId": slot.get("equipmentId"),
                "date": slot.get("date"),
                "slotName": slot.get("slotName"),
                "slotStatus": slot.get("status"),
                "equipmentName": (equipment_index.get(slot.get("equipmentId") or "") or {}).get("name"),
            })
    if status != "waitlist":
        for b in bookings:
            if status and status != "all" and b.get("status") != status:
                continue
            eq = equipment_index.get(b.get("equipmentId") or "") or {}
            rows.append({
                **b,
                "entryType": "booking",
                "equipmentName": eq.get("name"),
                "ownerId": eq.get("ownerId"),
            })

    if search:
        needle = search.lower()
        keys = ("id", "userId", "farmerName", "equipmentId", "equipmentName", "slotName", "date")
        rows = [r for r in rows if any(needle in str(r.get(k) or "").lower() for k in keys)]

    rows.sort(key=lambda r: r.get("createdAt") or "", reverse=True)
    total = len(rows)
    start = (page - 1) * pageSize
    return {"data": rows[start:start + pageSize], "page": page, "pageSize": pageSize, "total": total}


class EquipmentBookingCancelIn(BaseModel):
    refund: bool = Field(True, description="record a full auto-refund of paid amounts on the booking")
    refundAmountRupees: float | None = Field(None, description="partial refund override; defaults to paid − refunded")
    reason: str | None = Field(None, description="optional detail; X-Audit-Reason is the audit reason")


@router.delete("/equipment/bookings/{booking_id}")
async def admin_cancel_equipment_booking(
    booking_id: str,
    body: EquipmentBookingCancelIn | None = None,
    ctx: dict = Depends(admin_mutation_context),
):
    """Admin force cancellation with refund. Follows the real cancel semantics:
    404 on a missing booking, 409 when already cancelled, slot release with
    waitlist promotion (routers/equipment.py), a refunds-ledger entry in the
    routers/equipment_rental.py convention, and party notifications. The
    farmer-side 2-hour CANCEL_WINDOW_CLOSED gate is an admin override and does
    not apply. The booking is marked cancelledBy=admin with full audit."""
    booking = await get_doc("equipment_bookings", booking_id)
    if booking is None:
        _error(404, "BOOKING_NOT_FOUND", "booking not found")
    if booking.get("status") == "cancelled":
        _error(409, "ILLEGAL_TRANSITION", "booking is already cancelled")

    previous = {"status": booking.get("status")}
    now = _now()
    admin_id = _admin_id(ctx["admin"])
    reason = ((body.reason if body else None) or "").strip() or ctx["reason"]

    # Refund flag: auto-refund everything paid (minus already-refunded), using
    # the refunds[] convention from routers/equipment_rental.py.
    refunded_rupees = 0.0
    refund_entry = None
    if body is None or body.refund:
        paid = round(sum(float(p.get("amountRupees") or 0) for p in booking.get("payments") or []), 2)
        already = round(sum(float(r.get("amountRupees") or 0) for r in booking.get("refunds") or []), 2)
        refundable = round(paid - already, 2)
        amount = body.refundAmountRupees if (body and body.refundAmountRupees is not None) else refundable
        amount = round(min(max(float(amount or 0), 0.0), refundable), 2)
        if amount > 0:
            refund_entry = {
                "id": f"eqr_{uuid.uuid4().hex[:10]}",
                "amountRupees": amount,
                "reason": f"admin force-cancel: {reason}",
                "by": admin_id,
                "at": now,
            }
            booking.setdefault("refunds", []).append(refund_entry)
            refunded_rupees = amount
    if refund_entry is not None:
        booking["refundIssued"] = True

    booking["status"] = "cancelled"
    booking["cancelledBy"] = "admin"
    booking["cancellationReason"] = reason
    booking["adminCancelledBy"] = admin_id
    booking["adminCancelledAt"] = now
    booking["updatedAt"] = now
    await set_doc("equipment_bookings", booking_id, booking)

    # Slot release with waitlist promotion — identical to the farmer cancel
    # and owner reject flows. Promotion failure still releases the slot.
    promoted_user_id = None
    slot = await get_doc("equipment_slots", booking.get("slotId") or "")
    equipment = await get_doc("equipment", booking.get("equipmentId") or "")
    if slot is not None and equipment is not None:
        try:
            promoted = await promote_waitlist_head(slot, equipment)
            promoted_user_id = promoted["userId"] if promoted is not None else None
        except Exception:  # noqa: BLE001 — force-cancel must still release the slot
            promoted = None
        if promoted is None:
            slot["status"] = "available"
            slot["bookedByName"] = None
            await set_doc("equipment_slots", slot["id"], slot)

    # Party notifications.
    machine_label = (equipment or {}).get("name") or booking.get("equipmentId") or "मशीन"
    if booking.get("userId"):
        await send_fcm_to_user(
            booking["userId"],
            "बुकिंग रद्द की गई",
            f"{machine_label} की बुकिंग प्लेटफ़ॉर्म द्वारा रद्द की गई: {reason}",
            {"type": "equipment_booking_cancelled", "bookingId": booking_id, "reason": reason},
        )
    owner_id = (equipment or {}).get("ownerId")
    if owner_id:
        await notify_user(
            owner_id,
            type="equipment_booking_cancelled",
            title="Booking cancelled by admin / बुकिंग एडमिन द्वारा रद्द",
            body=f"{machine_label} · {booking.get('date', '')} {booking.get('slotName', '')} — {reason}",
            deepLink=f"/dashboard/p/equipment/bookings/{booking_id}",
        )

    await log_admin_action(
        ctx["admin"], "equipment", "booking.admin-cancel", booking_id,
        previous,
        {
            "status": "cancelled",
            "cancelledBy": "admin",
            "reason": reason,
            "refundedRupees": refunded_rupees,
            "promotedUserId": promoted_user_id,
        },
        ctx["reason"], ctx["ip"],
    )
    return {
        "success": True,
        "bookingId": booking_id,
        "status": "cancelled",
        "cancelledBy": "admin",
        "refundedRupees": refunded_rupees,
        "promotedUserId": promoted_user_id,
    }


# ===========================================================================
# P1-32: Transport fare engine config (SOP-08 §3)
# ===========================================================================

class TransportPricingRulesIn(BaseModel):
    baseFares: Optional[dict[str, float]] = None
    perKmRates: Optional[dict[str, float]] = None
    surgeCapMultiplier: Optional[float] = Field(default=None, le=2.5, ge=1.0)
    surgeWindows: Optional[list[str]] = None
    freeWaitingMinutes: Optional[int] = Field(default=None, ge=15)
    waitingRatePerHalfHourRupees: Optional[float] = Field(default=None, ge=0)


@router.get("/transport/pricing-rules")
async def get_transport_pricing_rules(user: dict = Depends(current_admin_user)):
    """P1-32 (SOP-08 §3): Read transport fare engine pricing rules (base fares, per-km rates, surge caps)."""
    rules = await get_doc("platform_config", "transport_pricing")
    if not rules:
        rules = {
            "id": "transport_pricing",
            "baseFares": {"pickup": 1200.0, "truck_mini": 1800.0, "truck_heavy": 3500.0, "tractor_trailer": 1500.0},
            "perKmRates": {"pickup": 16.0, "truck_mini": 22.0, "truck_heavy": 38.0, "tractor_trailer": 20.0},
            "surgeCapMultiplier": 1.5,
            "surgeWindows": ["06:00-10:00", "17:00-21:00"],
            "freeWaitingMinutes": 60,
            "waitingRatePerHalfHourRupees": 150.0,
            "updatedAt": _now(),
        }
    return rules


@router.put("/transport/pricing-rules")
async def update_transport_pricing_rules(
    body: TransportPricingRulesIn,
    ctx: dict = Depends(admin_mutation_context),
):
    """P1-32 (SOP-08 §3): Update transport fare engine config."""
    existing = await get_doc("platform_config", "transport_pricing") or {}
    new_rules = {
        **existing,
        **body.model_dump(exclude_none=True),
        "id": "transport_pricing",
        "updatedAt": _now(),
        "updatedBy": ctx["admin"].get("id"),
    }
    await set_doc("platform_config", "transport_pricing", new_rules)
    await log_admin_action(
        ctx["admin"], "transport", "UPDATE_PRICING_RULES", "transport_pricing",
        existing, new_rules, ctx["reason"], ctx["ip"],
    )
    return new_rules
