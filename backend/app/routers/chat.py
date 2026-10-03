import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.routers.purchases import TERMINAL_STATUSES
from app.services.chat import ensure_chat_room, ensure_direct_room, ensure_offer_room, first_name
from app.services.notify import notify_user
from app.services.users import get_user

router = APIRouter(prefix="/chat", tags=["chat"])

MAX_TEXT_LEN = 500  # spec §4.2
MIN_MESSAGE_GAP_SECONDS = 2  # light rate limit (spec §4.2 rate-limits)
OFFER_TERMINAL_STATUSES = ("accepted", "rejected", "withdrawn", "expired")


def _error(status_code: int, code: str, message: str):
    raise HTTPException(status_code=status_code, detail={"code": code, "message": message, "fieldErrors": {}})


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _load_room(room_id: str, uid: str) -> tuple[dict, bool]:
    """Return (room, terminal). terminal=True → read-only archive.

    Rooms: `kind` "purchase" (booking-gated, spec §4.1), "offer"
    (negotiation thread), "direct" (simple 1:1), or "transport" (trip
    booking chat — unlocked by the ACCEPTED event). Deal closure still goes
    through the structured engines; chat is the coordination layer.
    """
    room = await get_doc("chat_rooms", room_id)
    if room is None:
        purchase = await get_doc("purchases", room_id)
        if purchase is not None:
            room = await ensure_chat_room(purchase)
        else:
            offer = await get_doc("offers", room_id)
            if offer is None:
                _error(404, "ROOM_NOT_FOUND", "chat room not found")
            room = await ensure_offer_room(offer)
    if uid not in (room.get("farmerId"), room.get("buyerId")):
        _error(403, "CHAT_LOCKED_FOR_BOOKING", "chat unlocks between deal parties only")
    kind = room.get("kind") or "purchase"
    if kind == "direct":
        terminal = False  # direct conversations never close
    elif kind == "offer":
        offer = await get_doc("offers", room_id) or {}
        terminal = offer.get("status") in OFFER_TERMINAL_STATUSES
    elif kind == "transport":
        booking = await get_doc("transport_bookings", room_id) or {}
        terminal = booking.get("status") in ("delivered", "cancelled")
    else:
        purchase = await get_doc("purchases", room_id) or {}
        terminal = purchase.get("status") in TERMINAL_STATUSES
    return room, terminal


def _side(room: dict, uid: str) -> str:
    return "farmer" if uid == room.get("farmerId") else "buyer"


def _room_view(room: dict, uid: str) -> dict:
    is_farmer = uid == room.get("farmerId")
    unread = not (room.get("readByFarmer") if is_farmer else room.get("readByBuyer"))
    return {
        **room,
        "kind": room.get("kind") or "purchase",
        "counterpartyName": room.get("buyerName") if is_farmer else room.get("farmerName"),
        "unread": unread,
    }


@router.get("/rooms")
async def list_rooms(uid: str = Depends(current_user_id)):
    """All my deal threads — offer negotiations + booking chats (spec G1:
    no user directory exists; threads appear only around a live offer or
    confirmed booking)."""
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    as_farmer = await query("chat_rooms", [("farmerId", "==", uid)], limit=500)
    as_buyer = await query("chat_rooms", [("buyerId", "==", uid)], limit=500)
    rooms = as_farmer + as_buyer
    rooms.sort(key=lambda r: r.get("lastMessageAt") or r.get("createdAt", ""), reverse=True)
    return {"data": [_room_view(r, uid) for r in rooms], "total": len(rooms)}


@router.get("/rooms/{room_id}")
async def get_room(room_id: str, uid: str = Depends(current_user_id)):
    room, terminal = await _load_room(room_id, uid)
    return {**_room_view(room, uid), "terminal": terminal}


class MessageIn(BaseModel):
    text: str = Field(default="", max_length=MAX_TEXT_LEN)
    imageUrl: str = ""


class DirectChatIn(BaseModel):
    """Open a simple direct chat scoped to a listing: the other party is the
    lot's farmer or the demand's buyer. One stable room per user pair."""

    lotId: str = ""
    demandId: str = ""


@router.post("/direct")
async def open_direct_chat(body: DirectChatIn, uid: str = Depends(current_user_id)):
    if not body.lotId and not body.demandId:
        _error(422, "VALIDATION_ERROR", "lotId or demandId is required")
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    if body.lotId:
        lot = await get_doc("market_lots", body.lotId)
        if lot is None:
            _error(404, "LOT_NOT_FOUND", "lot not found")
        if lot.get("farmerId") == uid:
            _error(400, "OWN_LISTING", "this is your own listing")
        room = await ensure_direct_room(
            lot["farmerId"],
            (await get_user(lot["farmerId"]) or {}).get("name", ""),
            uid,
            user.get("name", ""),
            lot.get("crop", ""),
        )
    else:
        demand = await get_doc("demands", body.demandId)
        if demand is None:
            _error(404, "DEMAND_NOT_FOUND", "demand not found")
        if demand.get("buyerId") == uid:
            _error(400, "OWN_LISTING", "this is your own demand")
        room = await ensure_direct_room(
            demand["buyerId"],
            demand.get("buyerName", ""),
            uid,
            user.get("name", ""),
            demand.get("crop", ""),
        )
    return _room_view(room, uid)


@router.get("/rooms/{room_id}/messages")
async def list_messages(
    room_id: str,
    page: int = 1,
    pageSize: int = 30,
    uid: str = Depends(current_user_id),
):
    room, _terminal = await _load_room(room_id, uid)
    docs = await query(f"chat_rooms/{room['id']}/messages", [], limit=1000)
    docs.sort(key=lambda m: m.get("createdAt", ""))
    total = len(docs)
    start = (page - 1) * pageSize
    return {"data": docs[start:start + pageSize], "page": page, "pageSize": pageSize, "total": total}


@router.post("/rooms/{room_id}/messages", status_code=201)
async def post_message(room_id: str, body: MessageIn, uid: str = Depends(current_user_id)):
    room, terminal = await _load_room(room_id, uid)
    if terminal:
        _error(409, "CHAT_CLOSED", "this thread is closed — chat is read-only")
    text = (body.text or "").strip()
    if not text and not body.imageUrl:
        _error(422, "VALIDATION_ERROR", "message needs text or an image")
    # Light rate limit: max one message every 2s per sender.
    recent = await query(f"chat_rooms/{room['id']}/messages", [("fromId", "==", uid)], limit=3)
    recent.sort(key=lambda m: m.get("createdAt", ""), reverse=True)
    if recent:
        try:
            last_at = datetime.fromisoformat(recent[0]["createdAt"])
            if (datetime.now(timezone.utc) - last_at).total_seconds() < MIN_MESSAGE_GAP_SECONDS:
                _error(429, "RATE_LIMITED", "please wait a moment between messages")
        except ValueError:
            pass
    sender = await get_user(uid) or {}
    doc = {
        "id": f"msg_{uuid.uuid4().hex[:12]}",
        "fromId": uid,
        "fromName": first_name(sender.get("name", "")),
        "fromSide": _side(room, uid),
        "text": text,
        "imageUrl": body.imageUrl or None,
        "createdAt": _now(),
    }
    await set_doc(f"chat_rooms/{room['id']}/messages", doc["id"], doc)
    room["lastMessageAt"] = doc["createdAt"]
    room["lastMessageText"] = text or "📷"
    if doc["fromSide"] == "farmer":
        room["readByFarmer"] = True
        room["readByBuyer"] = False
    else:
        room["readByBuyer"] = True
        room["readByFarmer"] = False
    await set_doc("chat_rooms", room["id"], room)
    # Ping the counterpart (content snippet stays in-app per spec C7).
    other = room.get("buyerId") if doc["fromSide"] == "farmer" else room.get("farmerId")
    kind = room.get("kind") or "purchase"
    if kind == "offer":
        path = f"/dashboard/p/myOffers/{room['id']}/chat"
    elif kind == "transport":
        path = f"/dashboard/p/transport/trips/{room['id']}/chat"
    elif kind == "direct":
        path = f"/dashboard/p/chats/{room['id']}"
    else:
        path = f"/dashboard/p/purchases/{room['id']}/chat"
    await notify_user(
        other,
        type="chat_message",
        title="New message / नया संदेश",
        body=f"{doc['fromName']}: {(text or '📷')[:80]}",
        path=path,
    )
    return doc


@router.post("/rooms/{room_id}/read")
async def mark_read(room_id: str, uid: str = Depends(current_user_id)):
    room, _terminal = await _load_room(room_id, uid)
    if _side(room, uid) == "farmer":
        room["readByFarmer"] = True
    else:
        room["readByBuyer"] = True
    await set_doc("chat_rooms", room["id"], room)
    return {"ok": True}
