"""Produce-lot and buyer-demand leads — the direct-connect (lead-gen) trading model.

Lot leads: a buyer taps "Contact Farmer" on an open lot, accepts the platform
terms and verifies their MPIN; the platform records a lead, opens a direct chat
room between the two parties, and reveals both sides' contact details (phone +
WhatsApp).

Demand leads (source="demand"): a farmer applies on an institutional buyer's
posted demand ("Industry Buyer Demands") with a price/quantity quote, accepts
the platform terms and verifies their MPIN; the same lead + chat + contact
reveal happens, and the buyer sees the application as a Farmer Lead on their
procurement desk.

The deal itself — price, payment, pickup, quality — is finalized directly
between the parties, off the platform. Agrovercity connects; it is not a
transaction counterparty.
"""
from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.core.ratelimit import hit
from app.core.security import verify_mpin
from app.routers.users import require_role
from app.services.chat import ensure_direct_room
from app.services.notify import notify_user
from app.services.tasks import emit_task, module_deep_link
from app.services.users import get_user

router = APIRouter(prefix="/leads", tags=["leads"])

LIVE_LEAD_STATUSES = ("new", "contacted")
# Demand-sourced leads: the farmer applies on a buyer's posted demand
# ("Industry Buyer Demands"), the buyer sees them as Farmer Leads.
LEAD_SOURCE_LOT = "lot"
LEAD_SOURCE_DEMAND = "demand"


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _digits(phone: str | None) -> str | None:
    digits = "".join(ch for ch in str(phone or "") if ch.isdigit())
    return digits or None


def _contact_of(user: dict) -> dict:
    phone = user.get("phone") or ""
    whatsapp = user.get("whatsapp") or phone
    return {
        "name": (user.get("name") or "").strip().split(" ")[0],
        "fullName": user.get("name") or "",
        "village": user.get("village", ""),
        "district": user.get("district", ""),
        "phone": phone,
        "phoneDigits": _digits(phone),
        "whatsappDigits": _digits(whatsapp),
    }


class LeadCreate(BaseModel):
    lotId: str | None = None
    demandId: str | None = None
    # Farmer's quote — required when applying on a buyer demand (demandId).
    pricePerUnit: int | None = Field(default=None, gt=0)
    quantity: float | None = Field(default=None, gt=0)
    message: str = ""
    termsAccepted: bool = False
    mpin: str | None = None


class LeadStatusUpdate(BaseModel):
    status: Literal["new", "contacted", "sold", "dismissed"]
    finalRate: int | None = None


async def _blocked(a: str, b: str) -> bool:
    if await get_doc(f"users/{a}/blocks", b) is not None:
        return True
    if await get_doc(f"users/{b}/blocks", a) is not None:
        return True
    return False


def _with_contacts(lead: dict) -> dict:
    return {
        **lead,
        "farmerContact": lead.get("farmerContact"),
        "buyerContact": lead.get("buyerContact"),
    }


@router.post("", status_code=201)
async def create_lead(body: LeadCreate, response: Response, uid: str = Depends(current_user_id)):
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    if bool(body.lotId) == bool(body.demandId):
        _error(422, "VALIDATION_ERROR", "exactly one of lotId or demandId is required")
    if body.demandId:
        return await _create_demand_lead(body, user, uid, response)
    return await _create_lot_lead(body, user, uid, response)


async def _create_lot_lead(body: LeadCreate, user: dict, uid: str, response: Response):
    lot = await get_doc("market_lots", body.lotId)
    if lot is None:
        _error(404, "LOT_NOT_FOUND", "lot not found")
    if lot.get("farmerId") == uid:
        _error(403, "OWN_LOT", "cannot contact yourself about your own lot")
    if lot.get("status") != "open":
        _error(409, "LOT_NOT_OPEN", "lot is not open for leads")
    if not body.termsAccepted:
        _error(422, "TERMS_REQUIRED", "accept the terms & conditions to contact the farmer")
    # MPIN step-up: only enforced when this account has an MPIN on file —
    # accounts without one proceed (same contract as contract e-sign).
    if user.get("mpinHash"):
        if not body.mpin:
            _error(401, "WRONG_MPIN", "mpin is required to reveal contact details")
        if not verify_mpin(body.mpin, user["mpinHash"]):
            _error(401, "WRONG_MPIN", "incorrect MPIN")
    await hit("leads", uid, 30, 60)
    if await _blocked(uid, lot["farmerId"]):
        _error(403, "BLOCKED", "contact cannot be shared between these accounts")

    existing = await query("leads", [("lotId", "==", body.lotId), ("buyerId", "==", uid)], limit=100)
    live = next((l for l in existing if l.get("status") in LIVE_LEAD_STATUSES), None)
    if live is not None:
        response.status_code = 200
        return {"lead": _with_contacts(live), "chatRoomId": live.get("chatRoomId")}

    farmer = await get_user(lot["farmerId"]) or {}
    now = _now()
    doc = {
        "id": f"lead_{uuid4().hex[:12]}",
        "source": LEAD_SOURCE_LOT,
        "lotId": body.lotId,
        "lotCrop": lot.get("crop", ""),
        "lotVariety": lot.get("variety", ""),
        "lotGrade": lot.get("grade", ""),
        "quantityQuintals": lot.get("quantityQuintals") or lot.get("quantityQuintal"),
        "expectedRate": lot.get("expectedRate") or lot.get("expectedPricePerQuintal"),
        "farmerId": lot["farmerId"],
        "buyerId": uid,
        "buyerRole": user.get("activeProfile", ""),
        "buyerVerified": bool(user.get("vyapariVerified")),
        "status": "new",
        "termsAcceptedAt": now,
        "finalRate": None,
        "farmerContact": _contact_of(farmer),
        "buyerContact": {
            **_contact_of(user),
            "verified": bool(user.get("vyapariVerified")),
            "role": user.get("activeProfile", ""),
        },
        "createdAt": now,
        "updatedAt": now,
    }
    room = await ensure_direct_room(
        lot["farmerId"],
        farmer.get("name", ""),
        uid,
        user.get("name", ""),
        crop=lot.get("crop", ""),
    )
    doc["chatRoomId"] = room["id"]
    await set_doc("leads", doc["id"], doc)

    # Context line in the thread so the farmer sees why the room exists.
    msg = {
        "id": f"msg_{uuid4().hex[:12]}",
        "fromId": uid,
        "fromName": doc["buyerContact"]["name"],
        "fromSide": "buyer",
        "text": (
            f"📋 Lead: {doc['buyerContact']['name']} is interested in your "
            f"{lot.get('crop', 'produce')} lot ({doc['quantityQuintals']} q, "
            f"expecting ₹{doc['expectedRate']}/q). Contact shared — connect directly."
        ),
        "imageUrl": None,
        "createdAt": now,
    }
    await set_doc(f"chat_rooms/{room['id']}/messages", msg["id"], msg)
    room["lastMessageAt"] = now
    room["lastMessageText"] = msg["text"]
    room["readByBuyer"] = True
    room["readByFarmer"] = False
    await set_doc("chat_rooms", room["id"], room)

    buyer_label = doc["buyerContact"]["name"] or "A buyer"
    await notify_user(
        lot["farmerId"],
        type="lead_received",
        title="New lead / नया लीड",
        body=f"{buyer_label} wants your {lot.get('crop', 'produce')} lot — contact shared, chat is open",
        deepLink=f"/chat?room={room['id']}",
    )
    await emit_task(
        lot["farmerId"],
        persona="farmer",
        module="trade",
        kind="new_leads",
        title_en="New lead on your listing",
        title_hi="आपकी लिस्टिंग पर नया लीड",
        subtitle=f"{buyer_label} · {lot.get('crop', 'produce')} ({doc['quantityQuintals']} q)",
        priority="today",
        deep_link=module_deep_link("trade"),
        source_id=doc["id"],
    )
    return {"lead": _with_contacts(doc), "chatRoomId": room["id"]}


async def _create_demand_lead(body: LeadCreate, user: dict, uid: str, response: Response):
    """Farmer applies on a buyer's posted demand — T&C + MPIN, contact shared."""
    require_role(user, "farmer", "seller")
    demand = await get_doc("demands", body.demandId)
    if demand is None:
        _error(404, "DEMAND_NOT_FOUND", "demand not found")
    if demand.get("buyerId") == uid:
        _error(403, "OWN_DEMAND", "cannot apply on your own demand")
    if demand.get("status") != "open":
        _error(409, "DEMAND_CLOSED", "demand is closed for applications")
    if body.pricePerUnit is None or body.quantity is None:
        _error(
            422,
            "VALIDATION_ERROR",
            "invalid application",
            {"pricePerUnit": "required", "quantity": "required"},
        )
    if not body.termsAccepted:
        _error(422, "TERMS_REQUIRED", "accept the terms & conditions to apply")
    # Same MPIN step-up contract as lot leads: enforced when an MPIN is on file.
    if user.get("mpinHash"):
        if not body.mpin:
            _error(401, "WRONG_MPIN", "mpin is required to share your contact")
        if not verify_mpin(body.mpin, user["mpinHash"]):
            _error(401, "WRONG_MPIN", "incorrect MPIN")
    await hit("leads", uid, 30, 60)
    buyer_id = demand.get("buyerId") or ""
    if await _blocked(uid, buyer_id):
        _error(403, "BLOCKED", "contact cannot be shared between these accounts")

    existing = await query(
        "leads", [("demandId", "==", body.demandId), ("farmerId", "==", uid)], limit=100
    )
    live = next((l for l in existing if l.get("status") in LIVE_LEAD_STATUSES), None)
    if live is not None:
        response.status_code = 200
        return {"lead": _with_contacts(live), "chatRoomId": live.get("chatRoomId")}

    buyer = await get_user(buyer_id) or {}
    now = _now()
    doc = {
        "id": f"lead_{uuid4().hex[:12]}",
        "source": LEAD_SOURCE_DEMAND,
        "demandId": body.demandId,
        "demandCrop": demand.get("crop", ""),
        "demandVariety": demand.get("variety", ""),
        "pricePerUnit": body.pricePerUnit,
        "quantity": body.quantity,
        "message": body.message,
        "farmerId": uid,
        "buyerId": buyer_id,
        "buyerRole": buyer.get("activeProfile", ""),
        "buyerVerified": bool(buyer.get("vyapariVerified")),
        "status": "new",
        "termsAcceptedAt": now,
        "finalRate": None,
        "farmerContact": _contact_of(user),
        "buyerContact": {
            **_contact_of(buyer),
            "verified": bool(buyer.get("vyapariVerified")),
            "role": buyer.get("activeProfile", ""),
        },
        "createdAt": now,
        "updatedAt": now,
    }
    room = await ensure_direct_room(
        buyer_id,
        buyer.get("name", ""),
        uid,
        user.get("name", ""),
        crop=demand.get("crop", ""),
    )
    doc["chatRoomId"] = room["id"]
    await set_doc("leads", doc["id"], doc)

    # Context line in the thread so the buyer sees why the room exists.
    farmer_label = doc["farmerContact"]["name"] or "A farmer"
    msg = {
        "id": f"msg_{uuid4().hex[:12]}",
        "fromId": uid,
        "fromName": farmer_label,
        "fromSide": "farmer",
        "text": (
            f"📋 Farmer Lead: {farmer_label} applied to your "
            f"{demand.get('crop', 'crop')} demand — {body.quantity} q @ "
            f"₹{body.pricePerUnit}/q. Contact shared — connect directly."
        ),
        "imageUrl": None,
        "createdAt": now,
    }
    await set_doc(f"chat_rooms/{room['id']}/messages", msg["id"], msg)
    room["lastMessageAt"] = now
    room["lastMessageText"] = msg["text"]
    room["readByBuyer"] = False
    room["readByFarmer"] = True
    await set_doc("chat_rooms", room["id"], room)

    await notify_user(
        buyer_id,
        type="farmer_lead_received",
        title="New farmer lead / नया किसान लीड",
        body=(
            f"{farmer_label} applied to your {demand.get('crop', 'crop')} demand — "
            f"{body.quantity} q @ ₹{body.pricePerUnit}/q. Contact shared, chat is open"
        ),
        deepLink=f"/chat?room={room['id']}",
    )
    return {"lead": _with_contacts(doc), "chatRoomId": room["id"]}


@router.get("/mine")
async def list_my_leads(
    filter: str = "received",
    status: str | None = None,
    source: str | None = None,
    page: int = 1,
    pageSize: int = 20,
    uid: str = Depends(current_user_id),
):
    field = "buyerId" if filter == "sent" else "farmerId"
    docs = await query("leads", [(field, "==", uid)], limit=1000)
    if source:
        # Legacy lot leads predate the source field — treat missing as "lot".
        docs = [d for d in docs if d.get("source", LEAD_SOURCE_LOT) == source]
    if status:
        docs = [d for d in docs if d.get("status") == status]
    else:
        docs = [d for d in docs if d.get("status") != "dismissed"]
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    total = len(docs)
    start = (page - 1) * pageSize
    return {"data": [_with_contacts(d) for d in docs[start:start + pageSize]], "page": page, "pageSize": pageSize, "total": total}


@router.patch("/{lead_id}")
async def update_lead_status(lead_id: str, body: LeadStatusUpdate, uid: str = Depends(current_user_id)):
    lead = await get_doc("leads", lead_id)
    if lead is None or lead.get("farmerId") != uid:
        _error(404, "LEAD_NOT_FOUND", "lead not found")
    lead["status"] = body.status
    if body.finalRate is not None:
        if body.finalRate < 0:
            _error(422, "VALIDATION_ERROR", "invalid rate", {"finalRate": "must be 0 or more"})
        lead["finalRate"] = body.finalRate
    lead["updatedAt"] = _now()
    await set_doc("leads", lead_id, lead)
    if body.status == "sold":
        lot = await get_doc("market_lots", lead.get("lotId", ""))
        if lot is not None and lot.get("status") == "open":
            lot["status"] = "sold"
            if body.finalRate is not None:
                lot["finalRate"] = body.finalRate
            lot["updatedAt"] = _now()
            await set_doc("market_lots", lot["id"], lot)
        await notify_user(
            lead.get("buyerId"),
            type="lead_marked_sold",
            title="Lot sold / लॉट बिक गया",
            body=f"The {lead.get('lotCrop', 'produce')} lot you enquired about is marked sold on Agrovercity.",
            deepLink="/farmer/lots",
        )
    return _with_contacts(lead)
