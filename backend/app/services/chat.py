"""Booking-gated chat (spec §4).

Rooms are event-sourced: only a confirmed purchase creates a chat room
(BOOKING_CONFIRMED event). No user search, no pre-booking free text — the
offer `message` field remains the only structured pre-booking channel.
"""

from datetime import datetime, timezone

from app.core.db import get_doc, set_doc


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
