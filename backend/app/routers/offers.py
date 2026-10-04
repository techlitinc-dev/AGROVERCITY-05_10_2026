from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.direct import OfferCounter, OfferCreate
from app.routers.purchases import create_purchase_from_offer
from app.services.chat import ensure_offer_room
from app.services.notify import notify_user
from app.services.tasks import emit_task, module_deep_link
from app.services.users import get_user

router = APIRouter(prefix="/offers", tags=["offers"])

NEGOTIABLE_STATUSES = ("pending", "countered")
# Spec P2: alternating counters, capped at three rounds per offer.
MAX_NEGOTIATION_ROUNDS = 3
# Spec V5: offer expiry timer (24-48h configurable) — default window.
OFFER_EXPIRY_HOURS = 24


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _now().isoformat()


def _expiry_iso() -> str:
    from datetime import timedelta

    return (_now() + timedelta(hours=OFFER_EXPIRY_HOURS)).isoformat()


def _is_expired(doc: dict) -> bool:
    expires_at = doc.get("expiresAt")
    if not expires_at:
        return False
    if doc.get("status") not in NEGOTIABLE_STATUSES:
        return False
    try:
        return _now() >= datetime.fromisoformat(expires_at)
    except ValueError:
        return False


async def _expire_if_due(doc: dict) -> dict:
    """Lazy expiry (Firestore has no cron): flip to `expired` on access."""
    if _is_expired(doc):
        doc["status"] = "expired"
        doc["updatedAt"] = _now_iso()
        await set_doc("offers", doc["id"], doc)
        other = doc.get("fromId") if doc.get("counter") else doc.get("toId")
        await notify_user(
            other,
            type="offer_expired",
            title="Offer expired / ऑफर समाप्त",
            body=f"{doc.get('quantity')} {doc.get('unit', 'quintal')} @ ₹{doc.get('pricePerUnit')}",
            path=f"/dashboard/p/myOffers/{doc['id']}",
        )
    return doc


async def _load_target(body: OfferCreate, uid: str) -> dict:
    if body.targetType == "demand":
        target = await get_doc("demands", body.targetId)
        if target is None:
            _error(404, "DEMAND_NOT_FOUND", "demand not found")
        if target.get("buyerId") == uid:
            _error(403, "OWN_DEMAND", "cannot offer on your own demand")
        if target.get("status") != "open":
            _error(409, "DEMAND_CLOSED", "demand is not open for offers")
        return target
    target = await get_doc("market_lots", body.targetId)
    if target is None:
        _error(404, "LOT_NOT_FOUND", "lot not found")
    if target.get("farmerId") == uid:
        _error(403, "OWN_LOT", "cannot offer on your own lot")
    if target.get("status") != "open":
        _error(409, "LOT_NOT_OPEN", "lot is not open for offers")
    return target


@router.post("", status_code=201)
async def create_offer(body: OfferCreate, response: Response, uid: str = Depends(current_user_id)):
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    target = await _load_target(body, uid)
    existing = await query(
        "offers",
        [("fromId", "==", uid), ("targetType", "==", body.targetType), ("targetId", "==", body.targetId)],
        limit=100,
    )
    live = next((o for o in existing if o.get("status") == "pending" and not _is_expired(o)), None)
    if live is not None:
        response.status_code = 200
        return await _expire_if_due(live)
    is_demand = body.targetType == "demand"
    now = _now_iso()
    doc = {
        "id": f"off_{uuid4().hex[:12]}",
        "targetType": body.targetType,
        "targetId": body.targetId,
        "fromId": uid,
        "fromName": user.get("name", ""),
        "fromRole": user.get("activeProfile", ""),
        "toId": target.get("buyerId") if is_demand else target.get("farmerId"),
        "toName": target.get("buyerName") if is_demand else (await get_user(target["farmerId"]) or {}).get("name", ""),
        "pricePerUnit": body.pricePerUnit,
        "quantity": body.quantity,
        "unit": target.get("unit", "quintal") if is_demand else "quintal",
        "message": body.message,
        "status": "pending",
        "counter": None,
        "rounds": 0,
        "negotiationLog": [],
        "expiresAt": _expiry_iso(),
        "createdAt": now,
        "updatedAt": now,
    }
    await set_doc("offers", doc["id"], doc)
    if is_demand:
        target["offersCount"] = (target.get("offersCount") or 0) + 1
        target["updatedAt"] = _now_iso()
        await set_doc("demands", target["id"], target)
    await ensure_offer_room(doc)  # negotiation thread opens with the offer
    offer_body = (
        f"{user.get('name') or 'A buyer'} offered ₹{body.pricePerUnit}/"
        f"{doc['unit']} for {body.quantity} {doc['unit']}"
    )
    await notify_user(
        doc["toId"],
        type="offer_received",
        title="New offer / नया ऑफर",
        body=offer_body,
        path=f"/dashboard/p/myOffers/{doc['id']}",
    )
    # WS-05 task emission (module: trade).
    await emit_task(
        doc["toId"],
        persona="farmer",
        module="trade",
        kind="new_offers",
        title_en="New offer on your listing",
        title_hi="आपकी लिस्टिंग पर नया ऑफर",
        subtitle=f"₹{body.pricePerUnit}/{doc['unit']} for {body.quantity} {doc['unit']}",
        priority="today",
        deep_link=module_deep_link("trade"),
        source_id=doc["id"],
        due_at=doc.get("expiresAt"),
    )
    return doc


@router.get("/mine")
async def list_my_offers(
    filter: str = "sent",
    targetType: str | None = None,
    page: int = 1,
    pageSize: int = 20,
    uid: str = Depends(current_user_id),
):
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    field = "fromId" if filter == "sent" else "toId"
    docs = await query("offers", [(field, "==", uid)], limit=1000)
    if targetType:
        docs = [d for d in docs if d.get("targetType") == targetType]
    docs = [await _expire_if_due(d) for d in docs]
    docs = [await _with_verified_flag(d) for d in docs]
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    total = len(docs)
    start = (page - 1) * pageSize
    return {"data": docs[start:start + pageSize], "page": page, "pageSize": pageSize, "total": total}


async def _participant_offer(offer_id: str, uid: str) -> dict:
    doc = await get_doc("offers", offer_id)
    if doc is None:
        _error(404, "OFFER_NOT_FOUND", "offer not found")
    if uid not in (doc.get("fromId"), doc.get("toId")):
        _error(403, "FORBIDDEN", "not an offer participant")
    return doc


async def _with_verified_flag(doc: dict) -> dict:
    """WS-03: expose the buyer's Verified Vyapari tier so farmer-facing offer
    surfaces can render the trust badge."""
    from_user = await get_user(doc.get("fromId") or "")
    enriched = dict(doc)
    enriched["fromVerified"] = bool((from_user or {}).get("vyapariVerified"))
    return enriched


@router.get("/{offer_id}")
async def get_offer(offer_id: str, uid: str = Depends(current_user_id)):
    return await _with_verified_flag(await _expire_if_due(await _participant_offer(offer_id, uid)))


@router.post("/{offer_id}/accept")
async def accept_offer(offer_id: str, uid: str = Depends(current_user_id)):
    offer = await _expire_if_due(await _participant_offer(offer_id, uid))
    if offer.get("status") == "expired":
        _error(400, "OFFER_EXPIRED", "offer has expired")
    if offer.get("status") not in NEGOTIABLE_STATUSES:
        _error(400, "OFFER_NOT_ACCEPTABLE", f"offer is {offer.get('status')}")
    if offer.get("status") == "pending" and uid != offer.get("toId"):
        _error(403, "FORBIDDEN", "only the target owner can accept a pending offer")
    if offer.get("status") == "countered" and uid == (offer.get("counter") or {}).get("by"):
        _error(403, "FORBIDDEN", "only the other party can accept the latest counter")
    purchase = await create_purchase_from_offer(offer)
    offer["status"] = "accepted"
    offer["updatedAt"] = _now_iso()
    await set_doc("offers", offer_id, offer)
    await notify_user(
        purchase["farmerId"],
        type="booking_confirmed",
        title="Booking confirmed / बुकिंग पक्की",
        body=f"{purchase['crop']} — {purchase['quantity']} {purchase['unit']} @ ₹{purchase['agreedPricePerUnit']}",
        path=f"/dashboard/p/purchases/{purchase['id']}",
    )
    await notify_user(
        purchase["buyerId"],
        type="booking_confirmed",
        title="Booking confirmed / बुकिंग पक्की",
        body=f"{purchase['crop']} — {purchase['quantity']} {purchase['unit']} @ ₹{purchase['agreedPricePerUnit']}",
        path=f"/dashboard/p/purchases/{purchase['id']}",
    )
    return {"offer": offer, "purchase": purchase}


@router.post("/{offer_id}/reject")
async def reject_offer(offer_id: str, uid: str = Depends(current_user_id)):
    offer = await _expire_if_due(await _participant_offer(offer_id, uid))
    if offer.get("status") == "expired":
        _error(400, "OFFER_EXPIRED", "offer has expired")
    if uid != offer.get("toId"):
        _error(403, "FORBIDDEN", "only the target owner can reject an offer")
    if offer.get("status") not in NEGOTIABLE_STATUSES:
        _error(400, "OFFER_NOT_NEGOTIABLE", f"offer is {offer.get('status')}")
    offer["status"] = "rejected"
    offer["updatedAt"] = _now_iso()
    await set_doc("offers", offer_id, offer)
    await notify_user(
        offer.get("fromId"),
        type="offer_rejected",
        title="Offer declined / ऑफर मना",
        body=f"₹{offer.get('pricePerUnit')}/{offer.get('unit', 'quintal')} — {offer.get('quantity')} {offer.get('unit', 'quintal')}",
        path=f"/dashboard/p/myOffers/{offer_id}",
    )
    return offer


@router.post("/{offer_id}/withdraw")
async def withdraw_offer(offer_id: str, uid: str = Depends(current_user_id)):
    offer = await _expire_if_due(await _participant_offer(offer_id, uid))
    if offer.get("status") == "expired":
        _error(400, "OFFER_EXPIRED", "offer has expired")
    if uid != offer.get("fromId"):
        _error(403, "FORBIDDEN", "only the offer maker can withdraw")
    if offer.get("status") not in NEGOTIABLE_STATUSES:
        _error(400, "OFFER_NOT_NEGOTIABLE", f"offer is {offer.get('status')}")
    offer["status"] = "withdrawn"
    offer["updatedAt"] = _now_iso()
    await set_doc("offers", offer_id, offer)
    await notify_user(
        offer.get("toId"),
        type="offer_withdrawn",
        title="Offer withdrawn / ऑफर वापस",
        body=f"₹{offer.get('pricePerUnit')}/{offer.get('unit', 'quintal')} — {offer.get('quantity')} {offer.get('unit', 'quintal')}",
        path=f"/dashboard/p/myOffers/{offer_id}",
    )
    return offer


@router.post("/{offer_id}/counter")
async def counter_offer(offer_id: str, body: OfferCounter, uid: str = Depends(current_user_id)):
    offer = await _expire_if_due(await _participant_offer(offer_id, uid))
    if offer.get("status") == "expired":
        _error(400, "OFFER_EXPIRED", "offer has expired")
    if offer.get("status") == "countered":
        if (offer.get("counter") or {}).get("by") == uid:
            _error(400, "NEGOTIATION_CLOSED", "counter already made; accept, reject or withdraw")
    elif offer.get("status") == "pending":
        if uid != offer.get("toId"):
            _error(403, "FORBIDDEN", "only the target owner can counter")
    else:
        _error(400, "OFFER_NOT_NEGOTIABLE", f"offer is {offer.get('status')}")
    rounds = int(offer.get("rounds") or 0)
    if rounds >= MAX_NEGOTIATION_ROUNDS:
        _error(400, "NEGOTIATION_CLOSED", "three counter rounds used; accept, reject or withdraw")
    rounds += 1
    counter = {"pricePerUnit": body.pricePerUnit, "by": uid, "note": body.note, "at": _now_iso(), "round": rounds}
    offer["counter"] = counter
    offer["rounds"] = rounds
    history = offer.get("negotiationLog") or []
    history.append(
        {"round": rounds, "by": uid, "pricePerUnit": body.pricePerUnit, "note": body.note, "at": counter["at"]}
    )
    offer["negotiationLog"] = history
    offer["status"] = "countered"
    # A counter restarts the negotiation clock.
    offer["expiresAt"] = _expiry_iso()
    offer["updatedAt"] = _now_iso()
    await set_doc("offers", offer_id, offer)
    other = offer.get("fromId") if uid == offer.get("toId") else offer.get("toId")
    await notify_user(
        other,
        type="offer_countered",
        title="Counter-offer / काउंटर ऑफर",
        body=f"₹{body.pricePerUnit}/{offer.get('unit', 'quintal')} for {offer.get('quantity')} {offer.get('unit', 'quintal')} (round {rounds}/{MAX_NEGOTIATION_ROUNDS})",
        path=f"/dashboard/p/myOffers/{offer_id}",
    )
    return offer
