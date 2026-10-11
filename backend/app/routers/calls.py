"""Platform call-session manager (masking policy + history).

There is no telephony provider in the stack: this module validates that the
caller may reach the callee through a shared business context, applies the
platform_config/call_masking policy to decide which number the client dialer
gets, and keeps the session/history ledger. The client dials natively.
"""

import hashlib
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.core.ratelimit import hit
from app.models.calls import CallRequest
from app.services.notify import notify_user
from app.services.users import get_user

router = APIRouter(prefix="/calls", tags=["calls"])

TERMINAL_STATUSES = ("ended", "declined", "cancelled")

CALL_MASKING_DOC = "call_masking"


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _parse_iso(value):
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


async def _get_call(call_id: str) -> dict:
    call = await get_doc("calls", call_id)
    if call is None:
        _error(404, "CALL_NOT_FOUND", "call not found")
    return call


def _assert_participant(call: dict, uid: str):
    if uid not in (call.get("callerId"), call.get("calleeId")):
        _error(403, "CALL_FORBIDDEN", "only a call participant can access this call")


async def _assert_context_access(uid: str, context_type: str, context_id: str) -> dict:
    """Raise 404 CONTEXT_NOT_FOUND for a missing doc/context and
    403 CALL_FORBIDDEN when uid has no legitimate interest in it.

    resale_listing / quote / export_order collections are built by other
    modules; the lookups are defensive so calling works the day they land.
    """
    if context_type == "transport_booking":
        booking = await get_doc("transport_bookings", context_id)
        if booking is None:
            _error(404, "CONTEXT_NOT_FOUND", "booking not found")
        if uid in (booking.get("userId"), booking.get("transporterId")):
            return booking
        caller = await get_user(uid) or {}
        phone = caller.get("phone")
        if phone and booking.get("driverPhone") == phone:
            return booking
        _error(403, "CALL_FORBIDDEN", "you are not a party to this booking")
    if context_type == "vehicle":
        vehicle = await get_doc("vehicles", context_id)
        if vehicle is None:
            _error(404, "CONTEXT_NOT_FOUND", "vehicle not found")
        return vehicle  # business inquiry — any authenticated user may call
    if context_type == "offer":
        offer = await get_doc("offers", context_id)
        if offer is None:
            _error(404, "CONTEXT_NOT_FOUND", "offer not found")
        if uid in (offer.get("fromId"), offer.get("toId")):
            return offer
        _error(403, "CALL_FORBIDDEN", "you are not a party to this offer")
    if context_type == "purchase":
        purchase = await get_doc("purchases", context_id)
        if purchase is None:
            _error(404, "CONTEXT_NOT_FOUND", "purchase not found")
        if uid in (purchase.get("buyerId"), purchase.get("farmerId")):
            return purchase
        _error(403, "CALL_FORBIDDEN", "you are not a party to this purchase")
    if context_type == "resale_listing":
        listing = await get_doc("resale_listings", context_id)
        if listing is None:
            _error(404, "CONTEXT_NOT_FOUND", "resale listing not found")
        return listing  # business inquiry — any authenticated user may call
    if context_type == "quote":
        quote = await get_doc("export_quotes", context_id)
        if quote is None:
            _error(404, "CONTEXT_NOT_FOUND", "quote not found")
        if uid in (quote.get("exporterId"), quote.get("sellerId")):
            return quote
        _error(403, "CALL_FORBIDDEN", "you are not a party to this quote")
    if context_type == "export_order":
        order = await get_doc("export_orders", context_id)
        if order is None:
            _error(404, "CONTEXT_NOT_FOUND", "export order not found")
        seller_ids = [line.get("sellerId") for line in (order.get("lines") or [])]
        if uid == order.get("exporterId") or uid in seller_ids:
            return order
        _error(403, "CALL_FORBIDDEN", "you are not a party to this export order")
    _error(404, "CONTEXT_NOT_FOUND", "unknown call context")


@router.post("", status_code=201)
async def create_call(body: CallRequest, uid: str = Depends(current_user_id)):
    await hit("calls", uid, 30, 60)
    callee = await get_user(body.toUserId)
    if callee is None:
        _error(404, "USER_NOT_FOUND", "callee not found")
    if body.toUserId == uid:
        _error(422, "SELF_CALL_FORBIDDEN", "cannot place a call to yourself")
    context_doc = await _assert_context_access(uid, body.contextType, body.contextId)
    if body.contextType == "vehicle" and body.toUserId != (context_doc or {}).get("ownerId"):
        _error(403, "CALL_FORBIDDEN", "callee does not own this vehicle")
    if body.contextType == "resale_listing" and body.toUserId != (context_doc or {}).get("sellerId"):
        _error(403, "CALL_FORBIDDEN", "callee does not own this listing")

    callee_phone = (callee or {}).get("phone")
    if not callee_phone:
        _error(422, "CALLEE_PHONE_UNAVAILABLE", "callee has no phone number on file")

    call_id = f"cal_{uuid.uuid4().hex[:12]}"
    masking = await get_doc("platform_config", CALL_MASKING_DOC) or {}
    proxies = masking.get("proxyNumbers") or []
    masked = False
    dial_number = callee_phone
    proxy_number = None
    if masking.get("mode") == "proxy" and proxies:
        digest = hashlib.sha256(call_id.encode()).hexdigest()
        proxy_number = proxies[int(digest, 16) % len(proxies)]
        dial_number = proxy_number
        masked = True

    caller = await get_user(uid) or {}
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": call_id,
        "callerId": uid,
        "calleeId": body.toUserId,
        "contextType": body.contextType,
        "contextId": body.contextId,
        "status": "ringing",
        "callerName": caller.get("name", ""),
        "createdAt": now,
    }
    if proxy_number:
        doc["proxyNumber"] = proxy_number
    await set_doc("calls", call_id, doc)
    await notify_user(
        body.toUserId,
        type="incoming_call",
        title="Incoming call",
        body=f"Call from {caller.get('name', '')}",
        deepLink=f"/calls/{call_id}",
    )
    return {
        "call": doc,
        "dial": {"number": dial_number, "masked": masked},
        "caller": {"id": uid, "name": caller.get("name", "")},
    }


@router.post("/{call_id}/answer")
async def answer_call(call_id: str, uid: str = Depends(current_user_id)):
    call = await _get_call(call_id)
    if uid != call.get("calleeId"):
        _error(403, "CALL_FORBIDDEN", "only the callee can answer this call")
    if call.get("status") != "ringing":
        _error(409, "CALL_NOT_RINGING", "call is not ringing")
    call["status"] = "ongoing"
    call["answeredAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("calls", call_id, call)
    return {"call": call}


@router.post("/{call_id}/decline")
async def decline_call(call_id: str, uid: str = Depends(current_user_id)):
    call = await _get_call(call_id)
    if uid != call.get("calleeId"):
        _error(403, "CALL_FORBIDDEN", "only the callee can decline this call")
    if call.get("status") != "ringing":
        _error(409, "CALL_NOT_RINGING", "call is not ringing")
    call["status"] = "declined"
    call["endedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("calls", call_id, call)
    return {"call": call}


@router.post("/{call_id}/end")
async def end_call(call_id: str, uid: str = Depends(current_user_id)):
    call = await _get_call(call_id)
    _assert_participant(call, uid)
    if call.get("status") in TERMINAL_STATUSES:
        _error(409, "CALL_ALREADY_ENDED", "call has already ended")
    now = datetime.now(timezone.utc)
    if call.get("status") == "ongoing":
        call["status"] = "ended"
        answered_at = _parse_iso(call.get("answeredAt"))
        call["durationSec"] = (
            int(max((now - answered_at).total_seconds(), 0)) if answered_at else 0
        )
    elif uid == call.get("callerId"):
        call["status"] = "cancelled"  # caller hung up before the callee answered
    else:
        call["status"] = "declined"  # callee ended an unanswered ring
    call["endedAt"] = now.isoformat()
    await set_doc("calls", call_id, call)
    return {"call": call}


@router.get("")
async def list_calls(
    contextType: str | None = None,
    contextId: str | None = None,
    direction: str | None = None,
    page: int = 1,
    pageSize: int = 20,
    uid: str = Depends(current_user_id),
):
    docs = await query("calls", [], limit=1000)
    mine = [d for d in docs if uid in (d.get("callerId"), d.get("calleeId"))]
    if contextType:
        mine = [d for d in mine if d.get("contextType") == contextType]
    if contextId:
        mine = [d for d in mine if d.get("contextId") == contextId]
    if direction == "incoming":
        mine = [d for d in mine if d.get("calleeId") == uid]
    elif direction == "outgoing":
        mine = [d for d in mine if d.get("callerId") == uid]
    mine.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    total = len(mine)
    start = (page - 1) * pageSize
    data = [
        {**d, "direction": "outgoing" if d.get("callerId") == uid else "incoming"}
        for d in mine[start:start + pageSize]
    ]
    return {"data": data, "page": page, "pageSize": pageSize, "total": total}


@router.get("/{call_id}")
async def get_call(call_id: str, uid: str = Depends(current_user_id)):
    call = await _get_call(call_id)
    _assert_participant(call, uid)
    return {**call, "direction": "outgoing" if call.get("callerId") == uid else "incoming"}
