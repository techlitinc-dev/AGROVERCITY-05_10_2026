import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.ratings import RatingIn, RatingOut
from app.services.users import get_user

router = APIRouter(prefix="/ratings", tags=["ratings"])

# terminal-status rules per booking kind:
# transport "delivered" (Day 7 state machine), vet "completed" (no completion
# transition exists yet — set when one lands), equipment "booked" (the furthest
# success status Day 8 implements; there is no completed transition yet)
TERMINAL_STATUS = {"transport": "delivered", "vet": "completed", "equipment": "booked"}


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def provider_rating_fields(provider_id: str) -> dict:
    aggregate = await get_doc("provider_ratings", provider_id)
    if aggregate is None:
        return {"ratingAvg": None, "ratingCount": 0}
    return {"ratingAvg": aggregate["ratingAvg"], "ratingCount": aggregate["ratingCount"]}


async def _resolve_provider(kind: str, booking_id: str, uid: str, target_role: str | None = None) -> str:
    if kind == "deal":
        # WS-05 step 8: two-sided deal ratings — the rater must be a deal
        # participant and the deal must be completed.
        deal = await get_doc("broker_deals", booking_id)
        if deal is None:
            _error(404, "DEAL_NOT_FOUND", "deal not found")
        if uid not in (deal.get("brokerId"), deal.get("sellerUid")):
            _error(403, "FORBIDDEN", "only a deal party can rate this deal")
        if deal.get("status") != "completed":
            _error(409, "NOT_COMPLETED", "only completed deals can be rated")
        if target_role == "broker":
            if uid != deal.get("sellerUid"):
                _error(403, "FORBIDDEN", "only the farmer rates the broker")
            return deal["brokerId"]
        if target_role == "farmer":
            if uid != deal.get("brokerId"):
                _error(403, "FORBIDDEN", "only the broker rates the farmer")
            seller = deal.get("sellerUid")
            if not seller:
                _error(404, "DEAL_NOT_FOUND", "deal has no linked farmer")
            return seller
        _error(422, "VALIDATION_ERROR", "targetRole is required for deal ratings", {"targetRole": "broker|farmer"})
    if kind == "transport":
        booking = await get_doc("transport_bookings", booking_id)
        if booking is None or booking.get("userId") != uid:
            _error(404, "BOOKING_NOT_FOUND", "booking not found")
        if booking.get("status") != TERMINAL_STATUS[kind]:
            _error(409, "NOT_COMPLETED", "पूरी न हुई बुकिंग रेट नहीं की जा सकती")
        provider_id = booking.get("transporterId")
        if provider_id is None:
            _error(404, "BOOKING_NOT_FOUND", "booking has no assigned provider")
        return provider_id
    if kind == "vet":
        booking = await get_doc(f"users/{uid}/vet_bookings", booking_id)
        if booking is None:
            _error(404, "BOOKING_NOT_FOUND", "booking not found")
        if booking.get("status") != TERMINAL_STATUS[kind]:
            _error(409, "NOT_COMPLETED", "पूरी न हुई बुकिंग रेट नहीं की जा सकती")
        return booking["vetId"]
    booking = await get_doc("equipment_bookings", booking_id)
    if booking is None or booking.get("userId") != uid:
        _error(404, "BOOKING_NOT_FOUND", "booking not found")
    if booking.get("status") != TERMINAL_STATUS[kind]:
        _error(409, "NOT_COMPLETED", "पूरी न हुई बुकिंग रेट नहीं की जा सकती")
    return booking["equipmentId"]


@router.post("", status_code=201)
async def create_rating(body: RatingIn, uid: str = Depends(current_user_id)):
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    provider_id = await _resolve_provider(body.bookingKind, body.bookingId, uid, body.targetRole)
    # WS-05 step 8: deal ratings are two-sided — one rating per PARTY per deal
    filters = [("bookingId", "==", body.bookingId), ("bookingKind", "==", body.bookingKind)]
    if body.bookingKind == "deal":
        filters.append(("raterId", "==", uid))
    existing = await query("ratings", filters, limit=1)
    if existing:
        _error(409, "ALREADY_RATED", "आप पहले ही रेटिंग दे चुके हैं")
    rating_id = f"rat_{uuid.uuid4().hex[:12]}"
    created_at = datetime.now(timezone.utc).isoformat()
    await set_doc(
        "ratings",
        rating_id,
        {
            "id": rating_id,
            "bookingKind": body.bookingKind,
            "bookingId": body.bookingId,
            "stars": body.stars,
            "comment": body.comment,
            "raterId": uid,
            "providerId": provider_id,
            "createdAt": created_at,
        },
    )
    provider_ratings = await query("ratings", [("providerId", "==", provider_id)], limit=1000)
    count = len(provider_ratings)
    avg = round(sum(r["stars"] for r in provider_ratings) / count, 1)
    await set_doc(
        "provider_ratings",
        provider_id,
        {"id": provider_id, "ratingCount": count, "ratingAvg": avg},
    )
    return RatingOut(
        id=rating_id,
        providerId=provider_id,
        createdAt=created_at,
        **body.model_dump(),
    )
