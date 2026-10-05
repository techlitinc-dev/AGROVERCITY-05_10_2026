"""Booking-gated chat (spec §4).

Rooms are event-sourced: only a confirmed purchase creates a chat room
(BOOKING_CONFIRMED event). No user search, no pre-booking free text — the
offer `message` field remains the only structured pre-booking channel.
"""

import re
import uuid
from datetime import datetime, timedelta, timezone

from app.core.db import get_doc, query, set_doc
from app.services.payments import refund_razorpay_payment


def first_name(name: str) -> str:
    """Anonymized display name (spec §4.1: first name + role badge only)."""
    return (name or "").strip().split(" ")[0]


def room_shape(purchase: dict) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "id": purchase["id"],
        "purchaseId": purchase["id"],
        "kind": "purchase",
        "farmerId": purchase["farmerId"],
        "farmerName": first_name(purchase.get("farmerName", "")),
        "buyerId": purchase["buyerId"],
        "buyerName": first_name(purchase.get("buyerName", "")),
        "crop": purchase.get("crop", ""),
        "createdAt": now,
        "lastMessageAt": None,
        "lastMessageText": "",
        "readByFarmer": True,
        "readByBuyer": True,
    }


async def ensure_chat_room(purchase: dict) -> dict:
    """Idempotent room creation (lazy mirror of the BOOKING_CONFIRMED event)."""
    existing = await get_doc("chat_rooms", purchase["id"])
    if existing is not None:
        return existing
    room = room_shape(purchase)
    await set_doc("chat_rooms", room["id"], room)
    return room


def room_shape_offer(offer: dict, crop: str) -> dict:
    """Negotiation thread for a live offer (product decision: farmer ↔ vyapari
    chat to finalize a deal; closure still goes through the structured
    offer engine — accept creates the booking)."""
    is_demand = offer["targetType"] == "demand"
    farmer_id = offer["fromId"] if is_demand else offer["toId"]
    buyer_id = offer["toId"] if is_demand else offer["fromId"]
    farmer_name = offer.get("fromName") if is_demand else offer.get("toName")
    buyer_name = offer.get("toName") if is_demand else offer.get("fromName")
    now = datetime.now(timezone.utc).isoformat()
    return {
        "id": offer["id"],
        "offerId": offer["id"],
        "kind": "offer",
        "farmerId": farmer_id,
        "buyerId": buyer_id,
        "farmerName": first_name(farmer_name or ""),
        "buyerName": first_name(buyer_name or ""),
        "crop": crop,
        "createdAt": now,
        "lastMessageAt": None,
        "lastMessageText": "",
        "readByFarmer": True,
        "readByBuyer": True,
    }


async def ensure_offer_room(offer: dict) -> dict:
    existing = await get_doc("chat_rooms", offer["id"])
    if existing is not None:
        return existing
    crop = ""
    if offer["targetType"] == "demand":
        target = await get_doc("demands", offer["targetId"]) or {}
        crop = target.get("crop", "")
    else:
        target = await get_doc("market_lots", offer["targetId"]) or {}
        crop = target.get("crop", "")
    room = room_shape_offer(offer, crop)
    await set_doc("chat_rooms", room["id"], room)
    return room


def direct_room_id(user_a: str, user_b: str) -> str:
    pair = sorted([user_a, user_b])
    return f"dm_{pair[0]}_{pair[1]}"


async def ensure_direct_room(
    owner_id: str,
    owner_name: str,
    initiator_id: str,
    initiator_name: str,
    crop: str = "",
) -> dict:
    """Simple direct conversation (product: 'chat with farmer / seller').

    One stable room per user pair. `farmerId`/`buyerId` are just the two
    party slots — owner vs initiator — so all existing room queries,
    message, read and unread logic work unchanged. Direct rooms never close.
    """
    room_id = direct_room_id(owner_id, initiator_id)
    existing = await get_doc("chat_rooms", room_id)
    if existing is not None:
        return existing
    now = datetime.now(timezone.utc).isoformat()
    room = {
        "id": room_id,
        "kind": "direct",
        "farmerId": owner_id,
        "farmerName": first_name(owner_name),
        "buyerId": initiator_id,
        "buyerName": first_name(initiator_name),
        "crop": crop,
        "createdAt": now,
        "lastMessageAt": None,
        "lastMessageText": "",
        "readByFarmer": True,
        "readByBuyer": True,
    }
    await set_doc("chat_rooms", room_id, room)
    return room


async def ensure_transport_room(booking: dict) -> dict:
    """Booking-gated room for a transport trip (spec S5/D — created by the
    ACCEPTED event). Parties: booker (farmerId slot) + transporter."""
    existing = await get_doc("chat_rooms", booking["id"])
    if existing is not None:
        return existing
    if not booking.get("transporterId"):
        return None
    farmer = await get_doc("users", booking["userId"]) or {}
    transporter = await get_doc("users", booking["transporterId"]) or {}
    now = datetime.now(timezone.utc).isoformat()
    room = {
        "id": booking["id"],
        "kind": "transport",
        "purchaseId": None,
        "farmerId": booking["userId"],
        "farmerName": first_name(farmer.get("name", "")),
        "buyerId": booking["transporterId"],
        "buyerName": first_name(transporter.get("name", "")),
        "crop": booking.get("commodity") or booking.get("vehicleType", ""),
        "createdAt": now,
        "lastMessageAt": None,
        "lastMessageText": "",
        "readByFarmer": True,
        "readByBuyer": True,
    }
    await set_doc("chat_rooms", room["id"], room)
    return room


async def ensure_batch_room(batch: dict, member_ids: list[str]) -> dict:
    """Batch group chat room (WS-02 task 2.35). One room per batch, instructor
    as admin (broadcast-only). Idempotent — refreshes `memberIds` on re-entry."""
    existing = await get_doc("chat_rooms", batch["id"])
    if existing is not None:
        existing["memberIds"] = list(member_ids)
        await set_doc("chat_rooms", existing["id"], existing)
        return existing
    now = datetime.now(timezone.utc).isoformat()
    room = {
        "id": batch["id"],
        "kind": "batch",
        "batchId": batch["id"],
        "instructorId": batch["instructorId"],
        "memberIds": list(member_ids),
        "sealed": False,
        "createdAt": now,
        "lastMessageAt": None,
        "lastMessageText": "",
        "readByFarmer": True,
        "readByBuyer": True,
    }
    await set_doc("chat_rooms", room["id"], room)
    return room
# Moderation (WS-02 task 2.34) — global rule 4: no phone numbers, UPI IDs or
# external links in chat; violations follow the strike ladder.
# ---------------------------------------------------------------------------
PHONE_RE = re.compile(r"(\+91[\-\s]?)?[6-9]\d{9}")
UPI_RE = re.compile(r"[\w.\-]{2,}@[a-zA-Z]{2,}")
URL_RE = re.compile(r"(https?://|www\.)")

MUTED_HOURS = 24


def contains_banned_content(text: str) -> str | None:
    """Return "phone"/"upi"/"url" for the first banned pattern match, else None."""
    body = text or ""
    if PHONE_RE.search(body):
        return "phone"
    if UPI_RE.search(body):
        return "upi"
    if URL_RE.search(body):
        return "url"
    return None


async def record_strike(uid: str, surface: str, reason: str) -> dict:
    """Append a strike and apply the ladder (warning → 24h mute → booking
    restriction → suspension). Returns `{strikes, action}`."""
    now = datetime.now(timezone.utc)
    strike_id = f"str_{uuid.uuid4().hex[:12]}"
    strike = {"id": strike_id, "surface": surface, "reason": reason, "at": now.isoformat()}
    await set_doc(f"users/{uid}/strikes", strike_id, strike)

    strikes = await query(f"users/{uid}/strikes", [], limit=1000)
    count = len(strikes)

    user = await get_doc("users", uid) or {}
    if count <= 1:
        action = "warning"
        await set_doc("users", uid, user)
    elif count == 2:
        action = "mute"
        user["chatMutedUntil"] = (now + timedelta(hours=MUTED_HOURS)).isoformat()
        await set_doc("users", uid, user)
    elif count == 3:
        action = "booking_restriction"
        user["bookingRestricted"] = True
        await set_doc("users", uid, user)
    else:
        action = "suspension"
        user["suspended"] = True
        await set_doc("users", uid, user)
    return {"strikes": count, "action": action}


async def seal_room_for_dispute(room_id: str, dispute_id: str) -> dict:
    """WS-02 task 2.39: freeze a room for a dispute (evidence snapshot).

    Messages stay readable; posting is blocked (task 2.36 rejects sealed rooms)."""
    room = await get_doc("chat_rooms", room_id)
    if room is None:
        raise ValueError("chat room not found")
    room["sealed"] = True
    room["sealedByDispute"] = dispute_id
    room["sealedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("chat_rooms", room_id, room)
    return room


async def resolve_batch_dispute(
    room_id: str, outcome: str, *, order_id: str | None = None
) -> dict:
    """WS-02 task 2.39: dispute outcomes. `instructor_no_show` refunds the full
    order amount to source via the phase-00 rail, strikes the instructor and
    writes an `audit_logs` entry. Unknown outcomes raise `ValueError`."""
    if outcome != "instructor_no_show":
        raise ValueError(f"unknown dispute outcome: {outcome}")

    room = await get_doc("chat_rooms", room_id)
    if room is None:
        raise ValueError("chat room not found")

    purchase = await get_doc("course_purchases", order_id) if order_id else None
    amount_paisa = int(round(float((purchase or {}).get("amountRupees") or 0) * 100))
    payment_id = (purchase or {}).get("razorpayPaymentId") or order_id or ""
    await refund_razorpay_payment(payment_id, amount_paisa)

    instructor_id = room.get("instructorId")
    strike = await record_strike(instructor_id, "dispute", "instructor_no_show")

    now = datetime.now(timezone.utc).isoformat()
    await set_doc(
        "audit_logs",
        f"aud_dispute_{room_id}_{now[:19]}",
        {
            "action": "DISPUTE_RESOLVED",
            "roomId": room_id,
            "orderId": order_id,
            "outcome": outcome,
            "instructorId": instructor_id,
            "refundPaisa": amount_paisa,
            "strike": strike,
            "reason": "instructor_no_show",
            "at": now,
        },
    )
    return {"refunded": True}
