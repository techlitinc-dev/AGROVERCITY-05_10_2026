import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.ratings import RatingIn, RatingOut
from app.services import chat_moderation, idempotency
from app.services.rating_prompts import close_prompt, pending_prompts
from app.services.trust import refresh_trust_tier
from app.services.users import get_user

router = APIRouter(prefix="/ratings", tags=["ratings"])

# terminal-status rules per booking kind:
# transport "delivered" (Day 7 state machine), vet "completed" (no completion
# transition exists yet — set when one lands), equipment "booked" (FPO
# auto-confirm) or "completed" (owner-logged job completion) — both are
# rateable success states.
TERMINAL_STATUS = {"transport": "delivered", "vet": "completed", "equipment": "booked"}
EQUIPMENT_TERMINAL = ("booked", "completed")

# WS-03 transaction kinds opened by rating prompts; the ratee is read from the
# prompt doc the completion path wrote.
PROMPT_KINDS = {
    "lot_sale", "lot_purchase", "transport_delivery", "equipment_booking",
    "land_lease", "dairy_collection", "course_enrollment", "contract_delivery",
    "marketplace_order",
}


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
    if kind in PROMPT_KINDS:
        # WS-03: the completion path already opened a prompt with the ratee.
        prompt = await get_doc(f"users/{uid}/rating_prompts", booking_id)
        if prompt is None:
            # Fallback for marketplace_order if prompt not yet stored
            order = await get_doc("orders", booking_id)
            if order is not None:
                provider = order.get("nurseryId") or order.get("sellerId")
                if not provider and order.get("items"):
                    p = await get_doc("products", order["items"][0].get("productId", ""))
                    if p:
                        provider = p.get("nurseryId") or p.get("sellerId")
                if provider:
                    return provider
            _error(404, "PROMPT_NOT_FOUND", "no rating prompt for this transaction")
        return prompt["rateeUid"]
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
    if kind in ("vet", "vet_booking"):
        booking = await get_doc(f"users/{uid}/vet_bookings", booking_id)
        if booking is None:
            _error(404, "BOOKING_NOT_FOUND", "booking not found")
        if booking.get("status") != TERMINAL_STATUS["vet"]:
            _error(409, "NOT_COMPLETED", "पूरी न हुई बुकिंग रेट नहीं की जा सकती")
        return booking["vetId"]
    if kind == "nursery":
        order = await get_doc("orders", booking_id)
        if order is not None:
            provider = order.get("nurseryId") or order.get("sellerId")
            if not provider and order.get("items"):
                p = await get_doc("products", order["items"][0].get("productId", ""))
                if p:
                    provider = p.get("nurseryId") or p.get("sellerId")
            if provider:
                return provider
        nursery = await get_doc("nurseries", booking_id)
        if nursery is not None:
            return booking_id
        return booking_id

    booking = await get_doc("equipment_bookings", booking_id)
    if booking is None or booking.get("userId") != uid:
        _error(404, "BOOKING_NOT_FOUND", "booking not found")
    if booking.get("status") not in EQUIPMENT_TERMINAL:
        _error(409, "NOT_COMPLETED", "पूरी न हुई बुकिंग रेट नहीं की जा सकती")
    return booking["equipmentId"]


@router.get("/pending")
async def list_pending_ratings(uid: str = Depends(current_user_id)):
    """Open rating prompts for the caller (WS-03 X8)."""
    prompts = await pending_prompts(uid)
    return {"data": prompts, "total": len(prompts)}


@router.post("", status_code=201)
async def create_rating(body: RatingIn, uid: str = Depends(current_user_id)):
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    # WS-03: free-text goes through the same moderation scan as chat.
    if body.comment:
        scan_result = chat_moderation.scan(body.comment)
        if scan_result["violation"]:
            _error(422, "RATING_TEXT_BLOCKED", "rating text contains a blocked pattern")
    provider_id = await _resolve_provider(body.bookingKind, body.bookingId, uid, body.targetRole)
    # One rating per PARTY per booking: FT-3 made transport ratings two-way
    # (the transporter's rate-farmer write mirrors into this collection), so
    # the same booking legitimately carries one rating from each side.
    filters = [
        ("bookingId", "==", body.bookingId),
        ("bookingKind", "==", body.bookingKind),
        ("raterId", "==", uid),
    ]
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
            "tags": list(body.tags or []),
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
    # WS-03: close the rater's prompt and refresh the ratee's trust tier.
    await close_prompt(uid, body.bookingId)
    await refresh_trust_tier(provider_id)
    return RatingOut(
        id=rating_id,
        providerId=provider_id,
        createdAt=created_at,
        **body.model_dump(),
    )


# ---------------------------------------------------------------------------
# Ratings self-service (WS-03): my aggregate, ratings I gave, owner replies
# ---------------------------------------------------------------------------


class RatingReplyIn(BaseModel):
    reply: str = Field(min_length=1, max_length=500)


@router.get("/mine")
async def my_ratings(
    limit: int = Query(10, ge=1, le=50),
    uid: str = Depends(current_user_id),
):
    """Aggregate + latest received ratings for the caller."""
    aggregate = await provider_rating_fields(uid)
    user = await get_user(uid) or {}
    docs = await query("ratings", [("providerId", "==", uid)], limit=200)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    recent = []
    for doc in docs[:limit]:
        rater = await get_doc("users", doc.get("raterId") or "")
        recent.append(
            {
                "id": doc["id"],
                "raterName": (rater or {}).get("name"),
                "rating": doc.get("stars"),
                "comment": doc.get("comment", ""),
                "tags": doc.get("tags") or [],
                "kind": doc.get("bookingKind"),
                "createdAt": doc.get("createdAt"),
                "reply": doc.get("reply"),
            }
        )
    return {
        "average": aggregate["ratingAvg"],
        "count": aggregate["ratingCount"],
        "trustTier": user.get("trustTier"),
        "recent": recent,
    }


@router.get("/given")
async def ratings_given(
    limit: int = Query(20, ge=1, le=100),
    uid: str = Depends(current_user_id),
):
    """Rating docs the caller authored, newest first."""
    docs = await query("ratings", [("raterId", "==", uid)], limit=200)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return {"items": docs[:limit], "total": len(docs)}


@router.post("/{rating_id}/reply", status_code=200)
async def reply_to_rating(
    rating_id: str,
    body: RatingReplyIn,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(current_user_id),
):
    """The rated party answers a review once."""
    scope = f"ratings.reply.{rating_id}"
    replayed = await idempotency.replay(scope, idempotency_key)
    if replayed is not None:
        return replayed
    rating = await get_doc("ratings", rating_id)
    if rating is None:
        _error(404, "RATING_NOT_FOUND", "rating not found")
    if rating.get("providerId") != uid:
        _error(403, "FORBIDDEN", "only the rated party can reply")
    if rating.get("reply"):
        _error(409, "ALREADY_REPLIED", "this rating already has a reply")
    rating["reply"] = body.reply
    rating["repliedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("ratings", rating_id, rating)
    if idempotency_key:
        await idempotency.store(scope, idempotency_key, rating)
    return rating
