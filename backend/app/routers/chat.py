import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.core.ratelimit import hit
from app.routers.purchases import TERMINAL_STATUSES
from app.services import chat_moderation
from app.services.ai import gateway, privacy
from app.services.chat import (
    contains_banned_content,
    ensure_batch_room,
    ensure_chat_room,
    ensure_direct_room,
    ensure_offer_room,
    first_name,
    record_strike,
)
from app.services.notify import notify_user
from app.services.users import get_user

router = APIRouter(prefix="/chat", tags=["chat"])

log = logging.getLogger(__name__)

MAX_TEXT_LEN = 500  # spec §4.2
MIN_MESSAGE_GAP_SECONDS = 2  # light rate limit (spec §4.2 rate-limits)
OFFER_TERMINAL_STATUSES = ("accepted", "rejected", "withdrawn", "expired")


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _clean_chat_image(uid: str, url: str) -> tuple[str, bytes | None]:
    """Fetch the image, strip EXIF, re-upload. Returns (cleaned_url, cleaned_bytes).

    Falls back to the original URL (and no bytes) when the fetch or the strip
    fails — this path makes no AI calls, so it works with the AI flag off.
    """
    import httpx

    from app.services.storage import signed_download_url, upload_user_file

    try:
        async with httpx.AsyncClient(timeout=10.0) as http:
            response = await http.get(url)
            response.raise_for_status()
            raw = response.content
    except Exception as exc:  # noqa: BLE001 — never block a chat send on the fetch
        log.warning("chat image fetch failed (%s) — storing original url", exc)
        return url, None
    try:
        cleaned = chat_moderation.strip_exif(raw)
        blob_path, _ = upload_user_file(uid, cleaned, "chat.jpg", "image/jpeg", prefix="chat")
        return signed_download_url(blob_path), cleaned
    except Exception as exc:  # noqa: BLE001 — keep the original if Pillow/storage fails
        log.warning("chat image exif strip failed (%s) — storing original url", exc)
        return url, None


async def _load_room(room_id: str, uid: str) -> tuple[dict, bool]:
    """Return (room, terminal). terminal=True → read-only archive.

    Rooms: `kind` "purchase" (booking-gated, spec §4.1), "offer"
    (negotiation thread), "direct" (simple 1:1), or "transport" (trip
    booking chat — unlocked by the ACCEPTED event). Deal closure still goes
    through the structured engines; chat is the coordination layer.
    """
    room = await get_doc("chat_rooms", room_id)
    if room is None:
        batch = await get_doc("course_batches", room_id)
        if batch is not None:
            room = await ensure_batch_room(batch, [])
        else:
            purchase = await get_doc("purchases", room_id)
            if purchase is not None:
                room = await ensure_chat_room(purchase)
            else:
                offer = await get_doc("offers", room_id)
                if offer is None:
                    _error(404, "ROOM_NOT_FOUND", "chat room not found")
                room = await ensure_offer_room(offer)
    kind = room.get("kind") or "purchase"
    if kind == "batch":
        # WS-02 task 2.35: batch group chat. The instructor is admin and confirmed
        # (`paid`) enrollments are the members; `memberIds` is refreshed on every
        # read so revoked enrollments lose access. A sealed room or a completed
        # batch makes the thread read-only.
        batch = await get_doc("course_batches", room.get("batchId") or room["id"]) or {}
        purchases = await query(
            "course_purchases", [("courseId", "==", batch.get("courseId"))], limit=2000
        )
        room["memberIds"] = [
            p.get("userId") for p in purchases if p.get("status") == "paid" and p.get("userId")
        ]
        await set_doc("chat_rooms", room["id"], room)
        if uid != room.get("instructorId") and uid not in room["memberIds"]:
            _error(403, "CHAT_LOCKED_FOR_BOOKING", "chat unlocks for confirmed enrollments only")
        terminal = bool(room.get("sealed")) or batch.get("status") == "completed"
        return room, terminal
    if uid not in (room.get("farmerId"), room.get("buyerId")):
        _error(403, "CHAT_LOCKED_FOR_BOOKING", "chat unlocks between deal parties only")
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


async def _room_view(room: dict, uid: str) -> dict:
    is_farmer = uid == room.get("farmerId")
    unread = not (room.get("readByFarmer") if is_farmer else room.get("readByBuyer"))
    unread_count = 0
    if unread:
        messages = await query(f"chat_rooms/{room['id']}/messages", [], limit=1000)
        unread_count = sum(1 for m in messages if m.get("fromId") != uid)
    counterparty_id = room.get("buyerId") if is_farmer else room.get("farmerId")
    counterparty = await get_user(counterparty_id) if counterparty_id else None
    return {
        **room,
        "kind": room.get("kind") or "purchase",
        "counterpartyName": room.get("buyerName") if is_farmer else room.get("farmerName"),
        "counterpartyTrustTier": (counterparty or {}).get("trustTier"),
        "unread": unread,
        "unreadCount": unread_count,
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
    return {"data": [await _room_view(r, uid) for r in rooms], "total": len(rooms)}


@router.get("/rooms/{room_id}")
async def get_room(room_id: str, uid: str = Depends(current_user_id)):
    room, terminal = await _load_room(room_id, uid)
    return {**await _room_view(room, uid), "terminal": terminal}


class MessageIn(BaseModel):
    text: str = Field(default="", max_length=MAX_TEXT_LEN)
    imageUrl: str = ""
    # WS-02 task 2.36(f): in-platform lesson cards (gated content module only).
    lessonCardId: str = ""


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
        counterparty_id = lot["farmerId"]
        counterparty = await get_user(counterparty_id) or {}
        crop = lot.get("crop", "")
    else:
        demand = await get_doc("demands", body.demandId)
        if demand is None:
            _error(404, "DEMAND_NOT_FOUND", "demand not found")
        if demand.get("buyerId") == uid:
            _error(400, "OWN_LISTING", "this is your own demand")
        counterparty_id = demand["buyerId"]
        counterparty = await get_user(counterparty_id) or {}
        crop = demand.get("crop", "")

    # WS-02 task 2.37: farmers cannot DM each other (instructions §WS-02 step 7).
    if user.get("activeProfile") == "farmer" and counterparty.get("activeProfile") == "farmer":
        _error(403, "FARMER_DM_BLOCKED", "farmers cannot message each other directly")

    room = await ensure_direct_room(
        counterparty_id,
        counterparty.get("name", ""),
        uid,
        user.get("name", ""),
        crop,
    )
    return await _room_view(room, uid)


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


async def _post_batch_message(room: dict, body: "MessageIn", uid: str) -> dict:
    """WS-02 task 2.36: batch group chat posting rules (server-enforced).

    instructor broadcast-only; text + in-platform lesson cards only; blocked by
    a sealed room, the strike-ladder mute, or banned content (phone/UPI/URL)."""
    # (a) a dispute seals the room (frozen evidence snapshot).
    if room.get("sealed"):
        _error(409, "ROOM_SEALED", "this room is sealed for a dispute")
    # (b) broadcast-only: only the instructor (admin) may post.
    if uid != room.get("instructorId"):
        _error(403, "BATCH_BROADCAST_ONLY", "only the instructor can post in batch chat")
    # (c) no voice notes / files — text + lesson cards only.
    if body.imageUrl:
        _error(422, "ATTACHMENT_NOT_ALLOWED", "batch chat accepts text and lesson cards only")
    text = (body.text or "").strip()
    if not text and not body.lessonCardId:
        _error(422, "VALIDATION_ERROR", "message needs text or a lesson card")
    # (d) moderation regex + strike ladder (global rule 4).
    banned = contains_banned_content(text)
    if banned:
        await record_strike(uid, "batch_chat", banned)
        _error(422, "MODERATION_BLOCKED", "no phone numbers, UPI IDs or links in chat")
    # (e) strike-ladder mute.
    sender = await get_user(uid) or {}
    muted_until = sender.get("chatMutedUntil")
    if muted_until:
        try:
            if datetime.fromisoformat(muted_until) > datetime.now(timezone.utc):
                _error(429, "CHAT_MUTED", "you are muted — try again later")
        except ValueError:
            pass
    # (f) lesson cards must reference a real lesson in the batch's course.
    lesson_card_id = body.lessonCardId or None
    if lesson_card_id:
        batch = await get_doc("course_batches", room.get("batchId") or room["id"]) or {}
        course = await get_doc("courses", batch.get("courseId") or "") or {}
        lesson_ids = {
            lesson.get("id")
            for module in course.get("modules", [])
            for lesson in module.get("lessons", [])
        }
        if lesson_card_id not in lesson_ids:
            _error(404, "LESSON_CARD_NOT_FOUND", "lesson card not found")
    doc = {
        "id": f"msg_{uuid.uuid4().hex[:12]}",
        "fromId": uid,
        "fromName": first_name(sender.get("name", "")),
        "fromSide": "instructor",
        "text": text,
        "imageUrl": None,
        "lessonCardId": lesson_card_id,
        "createdAt": _now(),
    }
    await set_doc(f"chat_rooms/{room['id']}/messages", doc["id"], doc)
    room["lastMessageAt"] = doc["createdAt"]
    room["lastMessageText"] = text or "📎"
    room["readByFarmer"] = False
    room["readByBuyer"] = True
    await set_doc("chat_rooms", room["id"], room)
    for member_id in room.get("memberIds", []):
        if member_id and member_id != uid:
            await notify_user(
                member_id,
                type="chat_message",
                title="Batch announcement / बैच घोषणा",
                body=f"{doc['fromName']}: {(text or '📎')[:80]}",
                deepLink="/dashboard/p/batches",
            )
    return doc


@router.post("/rooms/{room_id}/messages", status_code=201)
async def post_message(room_id: str, body: MessageIn, uid: str = Depends(current_user_id)):
    await hit("chat", uid, 60, 60)
    room, terminal = await _load_room(room_id, uid)

    # WS-01 task 1.4 — strike-ladder enforcement (mute / suspension) before write.
    strike_state = await chat_moderation.get_strike_state(uid)
    if strike_state["suspended"]:
        _error(403, "CHAT_SUSPENDED", "chat suspended pending admin review")
    muted_until = strike_state["mutedUntil"]
    if muted_until:
        try:
            if datetime.fromisoformat(str(muted_until).replace("Z", "+00:00")) > datetime.now(timezone.utc):
                _error(403, "CHAT_MUTED", "chat muted for 24 hours")
        except ValueError:
            pass

    if (room.get("kind") or "purchase") == "batch":
        return await _post_batch_message(room, body, uid)
    if terminal:
        _error(409, "CHAT_CLOSED", "this thread is closed — chat is read-only")
    text = (body.text or "").strip()
    if not text and not body.imageUrl:
        _error(422, "VALIDATION_ERROR", "message needs text or an image")

    # WS-01 task 1.4 — regex fast-path. A violating message is rejected (422)
    # and never stored; a strike is recorded on the ladder.
    if text:
        scan_result = chat_moderation.scan(text)
        if scan_result["violation"]:
            count = await chat_moderation.record_strike(uid, scan_result["kind"], None, room_id)
            _error(
                422,
                "CHAT_MODERATION_VIOLATION",
                f"message blocked: {scan_result['kind']}",
                {"count": count},
            )

        # WS-01 task 1.12 — M6 guardrail for messages the regex missed. Runs only
        # on the cost-saving pre-filter; any exception/timeout allows the message.
        if chat_moderation.needs_guardrail(text):
            state = privacy.build_chat_guardrail_state(text, uid)
            try:
                decision = await gateway.decide(
                    state, "chat.guardrail.v1", module=chat_moderation.GUARDRAIL_MODULE
                )
                answers = decision.answers or {}
                if any(
                    bool(answers.get(key))
                    for key in ("shares_contact", "shares_payment_handle", "abuse")
                ):
                    count = await chat_moderation.record_strike(uid, "guardrail", None, room_id)
                    _error(
                        422,
                        "CHAT_MODERATION_VIOLATION",
                        "message blocked: guardrail",
                        {"count": count},
                    )
            except HTTPException:
                raise
            except Exception as exc:  # noqa: BLE001 — fail open, never lose a message
                log.warning("chat guardrail unavailable (%s) — allowing message", exc)

    # WS-01 task 1.8/1.9 — image messages: EXIF strip always (flag-off safe);
    # OCR through the regex scan only when the chat-guardrail flag is on.
    image_url = body.imageUrl or None
    if body.imageUrl:
        image_url, image_bytes = await _clean_chat_image(uid, body.imageUrl)
        if image_bytes and await chat_moderation.guardrail_enabled():
            ocr = await gateway.analyze_image(
                image_bytes,
                "Extract any visible text from this chat image.",
                module=chat_moderation.GUARDRAIL_MODULE,
            )
            extracted = str(ocr.get("text") or ocr.get("extractedText") or "")
            if extracted:
                ocr_result = chat_moderation.scan(extracted)
                if ocr_result["violation"]:
                    count = await chat_moderation.record_strike(uid, ocr_result["kind"], None, room_id)
                    _error(
                        422,
                        "CHAT_MODERATION_VIOLATION",
                        f"message blocked: {ocr_result['kind']}",
                        {"count": count},
                    )

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
        "imageUrl": image_url,
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
        deepLink=path,
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
