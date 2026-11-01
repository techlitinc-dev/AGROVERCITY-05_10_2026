"""Produce-lot and buyer-demand leads — the direct-connect (lead-gen) trading model.

Lot leads: a buyer taps "Contact Farmer" on an open lot, accepts the platform
terms and verifies their MPIN; the platform records a lead, opens a direct chat
room between the two parties, and reveals both sides' contact details (phone +
WhatsApp).

Demand leads (source="demand"): the industrial-sourcing application. A farmer
applies on a buyer's posted requirement ("Industrial Buyer Requirements") with
quantity, price, availability and supply basis, and acknowledges the
contact-sharing terms (+ MPIN step-up when the account has one). The
application lands on the buyer's desk with contacts HIDDEN. When the buyer
chooses "Contact Farmer" they accept the terms and verify their MPIN; the
application is marked contacted, contact details unlock for both parties, one
chat room is opened and both parties are notified.

The deal itself — sampling, final quantity/price, payment, pickup, quality,
delivery, invoices, supply agreements, disputes — is finalized directly between
the parties, off the platform. Agrovercity connects; it is not a transaction
counterparty and never creates purchase orders, supply contracts, invoices or
payments from this flow.
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
from app.models.direct import LeadOutcomeIn
from app.routers.users import require_role
from app.services.chat import ensure_direct_room
from app.services.notify import notify_user
from app.services.tasks import emit_task, module_deep_link
from app.services.users import get_user
from app.services.verification import is_identity_verified

router = APIRouter(prefix="/leads", tags=["leads"])

# Live (non-terminal) lead statuses. Stored canonical + legacy values.
LIVE_LEAD_STATUSES = ("submitted", "contacted", "new")
TERMINAL_LEAD_STATUSES = ("dealDone", "dismissed", "withdrawn", "rejected", "sold")
# Demand-sourced leads: the farmer applies on a buyer's posted demand
# ("Industry Buyer Demands"), the buyer sees them as Farmer Leads.
LEAD_SOURCE_LOT = "lot"
LEAD_SOURCE_DEMAND = "demand"

SUPPLY_BASES = ("farmGate", "buyerCollection", "deliveryToBuyer")

# Direct-connect terms acknowledgement (spec §8). Versioned so future wording
# changes can tell old acceptances apart.
TERMS_VERSION = "dc-1.0"


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _today():
    return datetime.now(timezone.utc).date()


def _parse_date(value: str, field: str):
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        _error(422, "VALIDATION_ERROR", "invalid date", {field: "must be YYYY-MM-DD"})


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


# ---------------------------------------------------------------------------
# Status mapping (spec §11): stored canonical statuses going forward; legacy
# records (`new`/`sold`) are normalised on read. No destructive migration.
# ---------------------------------------------------------------------------

_STATUS_READ_MAP = {"new": "submitted", "sold": "dealDone"}
_STATUS_WRITE_MAP = {"new": "submitted", "sold": "dealDone"}


def _public_status(status: str | None) -> str:
    return _STATUS_READ_MAP.get(status or "", status or "")


def _canonical_status(status: str) -> str:
    return _STATUS_WRITE_MAP.get(status, status)


class LeadCreate(BaseModel):
    lotId: str | None = None
    demandId: str | None = None
    # Farmer's quote — required when applying on a buyer demand (demandId).
    pricePerUnit: int | None = Field(default=None, gt=0)
    quantity: float | None = Field(default=None, gt=0)
    message: str = ""
    termsAccepted: bool = False
    mpin: str | None = None
    # ---- Industrial sourcing application fields (demandId) ----
    supplyBasis: Literal["farmGate", "buyerCollection", "deliveryToBuyer"] = "farmGate"
    availableDate: str = ""  # YYYY-MM-DD available/harvest date
    supplyLocation: str = ""
    canRecur: bool | None = None  # required when the requirement is recurring
    availabilityNote: str = ""
    sourceLotId: str | None = None  # existing produce lot for prefill/reference
    qualityDetails: str = ""
    photos: list[str] = Field(default_factory=list)
    packagingCapability: str = ""
    certifications: list[str] = Field(default_factory=list)


class LeadStatusUpdate(BaseModel):
    status: Literal[
        "new", "submitted", "contacted", "sold", "dealDone",
        "dismissed", "withdrawn", "rejected",
    ]
    finalRate: int | None = None


async def _blocked(a: str, b: str) -> bool:
    if await get_doc(f"users/{a}/blocks", b) is not None:
        return True
    if await get_doc(f"users/{b}/blocks", a) is not None:
        return True
    return False


def _contacts_unlocked(lead: dict) -> bool:
    """Contact details are visible only after the connection is unlocked
    (buyer contact-unlock) or on legacy records revealed before gating."""
    return bool(lead.get("contactRevealedAt"))


def _with_contacts(lead: dict, viewer_id: str | None = None) -> dict:
    """Viewer-scoped serialization: application statuses are normalised for
    display and BOTH parties' contact details stay hidden until the connection
    is unlocked. The raw stored doc keeps the snapshots for the reveal moment.
    """
    public = {**lead, "status": _public_status(lead.get("status"))}
    if not _contacts_unlocked(lead):
        public["farmerContact"] = None
        public["buyerContact"] = None
    return public


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
    if not await is_identity_verified(user):
        _error(403, "KYC_REQUIRED", "complete identity verification (KYC) to contact farmers")
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
        # Idempotent revisit — the connection already exists and both parties
        # already hold each other's contact.
        response.status_code = 200
        return {"lead": _with_contacts(live, uid), "chatRoomId": live.get("chatRoomId")}

    farmer = await get_user(lot["farmerId"]) or {}
    if not await is_identity_verified(farmer):
        _error(403, "COUNTERPARTY_UNVERIFIED", "the farmer has not completed identity verification")

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
        "buyerVerified": bool(user.get("vyapariVerified")) or await is_identity_verified(user),
        "status": "new",
        "termsAccepted": True,
        "termsVersion": TERMS_VERSION,
        "termsAcceptedAt": now,
        "termsAcceptedBy": uid,
        "contactRevealedAt": now,
        "finalRate": None,
        "farmerContact": _contact_of(farmer),
        "buyerContact": {
            **_contact_of(user),
            "verified": bool(user.get("vyapariVerified")) or await is_identity_verified(user),
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
    return {"lead": _with_contacts(doc, uid), "chatRoomId": room["id"]}


def _derive_supply_type(demand: dict) -> str:
    if demand.get("supplyType") in ("oneTime", "recurring"):
        return demand["supplyType"]
    return "recurring" if demand.get("frequency") in ("weekly", "fortnightly", "monthly") else "oneTime"


async def _create_demand_lead(body: LeadCreate, user: dict, uid: str, response: Response):
    """Farmer applies on a buyer's posted requirement — quote + availability +
    supply basis + T&C (+ MPIN). Contacts stay hidden until the buyer unlocks."""
    require_role(user, "farmer", "seller")
    demand = await get_doc("demands", body.demandId)
    if demand is None:
        _error(404, "DEMAND_NOT_FOUND", "demand not found")
    if demand.get("buyerId") == uid:
        _error(403, "OWN_DEMAND", "cannot apply on your own demand")
    if demand.get("status") not in ("open", "applicationsReceived"):
        _error(409, "DEMAND_CLOSED", "demand is closed for applications")
    if body.pricePerUnit is None or body.quantity is None:
        _error(
            422,
            "VALIDATION_ERROR",
            "invalid application",
            {"pricePerUnit": "required", "quantity": "required"},
        )
    if not body.availableDate:
        _error(422, "VALIDATION_ERROR", "invalid application", {"availableDate": "required"})
    if _parse_date(body.availableDate, "availableDate") < _today():
        _error(422, "VALIDATION_ERROR", "invalid date", {"availableDate": "must not be in the past"})
    if body.supplyBasis not in SUPPLY_BASES:
        _error(422, "VALIDATION_ERROR", "invalid supply basis", {"supplyBasis": "farmGate | buyerCollection | deliveryToBuyer"})
    # Partial-quantity rule: below the full requirement only when allowed.
    if float(body.quantity) < float(demand.get("quantity") or 0) and demand.get("partialAllowed") is False:
        _error(422, "PARTIAL_NOT_ALLOWED", "this requirement needs the full quantity — partial supply is not allowed")
    # Recurring requirements: the farmer must say whether they can support
    # recurring supply (sourcing interest only — no orders are generated).
    if _derive_supply_type(demand) == "recurring" and body.canRecur is None:
        _error(422, "RECURRING_ANSWER_REQUIRED", "state whether you can support recurring supply", {"canRecur": "required"})
    # Existing-lot prefill/reference: ownership is verified server-side and
    # ownership-sensitive lot data is never trusted from the client.
    source_lot = None
    if body.sourceLotId:
        lot = await get_doc("market_lots", body.sourceLotId)
        if lot is None:
            _error(404, "LOT_NOT_FOUND", "source lot not found")
        if lot.get("farmerId") != uid:
            _error(403, "NOT_YOUR_LOT", "source lot belongs to another farmer")
        source_lot = lot
    if not body.termsAccepted:
        _error(422, "TERMS_REQUIRED", "accept the terms & conditions to apply")
    if not await is_identity_verified(user):
        _error(403, "KYC_REQUIRED", "complete identity verification (KYC) to apply")
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
        # Idempotent re-apply — return the existing application/connection.
        response.status_code = 200
        return {"lead": _with_contacts(live, uid), "chatRoomId": live.get("chatRoomId")}

    buyer = await get_user(buyer_id) or {}
    if not await is_identity_verified(buyer):
        _error(403, "COUNTERPARTY_UNVERIFIED", "the buyer has not completed identity verification")
    farmer_verified = await is_identity_verified(user)
    supply_location = body.supplyLocation or ", ".join(
        x for x in (user.get("village", ""), user.get("district", "")) if x
    )
    now = _now()
    doc = {
        "id": f"lead_{uuid4().hex[:12]}",
        "source": LEAD_SOURCE_DEMAND,
        "demandId": body.demandId,
        "demandCrop": demand.get("crop", ""),
        "demandVariety": demand.get("variety", ""),
        "pricePerUnit": body.pricePerUnit,
        "quantity": body.quantity,
        "unit": demand.get("unit", "quintal"),
        "supplyBasis": body.supplyBasis,
        "availableDate": body.availableDate,
        "supplyLocation": supply_location,
        "canRecur": body.canRecur,
        "availabilityNote": body.availabilityNote,
        "sourceLotId": body.sourceLotId,
        "sourceLot": (
            {
                "lotId": source_lot["id"],
                "crop": source_lot.get("crop", ""),
                "quantityQuintals": source_lot.get("quantityQuintals") or source_lot.get("quantityQuintal"),
                "harvestDate": source_lot.get("harvestDate", ""),
                "photos": source_lot.get("photos") or [],
                "location": ", ".join(
                    x for x in (source_lot.get("village", ""), source_lot.get("district", "")) if x
                ),
            }
            if source_lot
            else None
        ),
        "qualityDetails": body.qualityDetails,
        "photos": body.photos or ((source_lot or {}).get("photos") or []),
        "packagingCapability": body.packagingCapability,
        "certifications": body.certifications,
        "message": body.message,
        "farmerId": uid,
        "buyerId": buyer_id,
        "buyerRole": buyer.get("activeProfile", ""),
        "buyerVerified": bool(buyer.get("vyapariVerified")) or await is_identity_verified(buyer),
        "status": "submitted",
        "termsAccepted": True,
        "termsVersion": TERMS_VERSION,
        "termsAcceptedAt": now,
        "termsAcceptedBy": uid,
        "contactRevealedAt": None,
        "finalRate": None,
        "farmerContact": {**_contact_of(user), "verified": farmer_verified},
        "buyerContact": {
            **_contact_of(buyer),
            "verified": bool(buyer.get("vyapariVerified")) or await is_identity_verified(buyer),
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

    # First application flips the requirement to applicationsReceived — it
    # stays discoverable/open for more (multi-farmer) applications.
    if demand.get("status") == "open":
        demand["status"] = "applicationsReceived"
        demand["applicationsCount"] = (demand.get("applicationsCount") or 0) + 1
        demand["updatedAt"] = now
        await set_doc("demands", demand["id"], demand)
    else:
        demand["applicationsCount"] = (demand.get("applicationsCount") or 0) + 1
        demand["updatedAt"] = now
        await set_doc("demands", demand["id"], demand)

    # Context line in the thread so the buyer sees why the room exists.
    farmer_label = doc["farmerContact"]["name"] or "A farmer"
    msg = {
        "id": f"msg_{uuid4().hex[:12]}",
        "fromId": uid,
        "fromName": farmer_label,
        "fromSide": "farmer",
        "text": (
            f"📋 Farmer Lead: {farmer_label} applied to your "
            f"{demand.get('crop', 'crop')} requirement — {body.quantity} {doc['unit']} @ "
            f"₹{body.pricePerUnit}/{doc['unit']} ({body.supplyBasis}, available {body.availableDate})."
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
        title="New farmer application / नया किसान आवेदन",
        body=(
            f"{farmer_label} applied to your {demand.get('crop', 'crop')} requirement — "
            f"{body.quantity} {doc['unit']} @ ₹{body.pricePerUnit}/{doc['unit']}. Review and contact from your desk."
        ),
        deepLink="/directbuyer/applications",
    )
    return {"lead": _with_contacts(doc, uid), "chatRoomId": room["id"]}


@router.get("/mine")
async def list_my_leads(
    filter: str = "received",
    status: str | None = None,
    source: str | None = None,
    page: int = 1,
    pageSize: int = 20,
    uid: str = Depends(current_user_id),
):
    """My connections, keyed by platform role: `sent` = leads where I am the
    buyer (lot enquiries I initiated, applications landing on my requirements),
    `received` = leads where I am the farmer (buyer leads on my lots,
    applications I sent on requirements)."""
    field = "buyerId" if filter == "sent" else "farmerId"
    docs = await query("leads", [(field, "==", uid)], limit=1000)
    if source:
        # Legacy lot leads predate the source field — treat missing as "lot".
        docs = [d for d in docs if d.get("source", LEAD_SOURCE_LOT) == source]
    if status:
        wanted = {_canonical_status(status), status}
        docs = [d for d in docs if d.get("status") in wanted]
    else:
        docs = [d for d in docs if d.get("status") != "dismissed"]
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    total = len(docs)
    start = (page - 1) * pageSize
    return {
        "data": [_with_contacts(d, uid) for d in docs[start:start + pageSize]],
        "page": page,
        "pageSize": pageSize,
        "total": total,
    }


class LeadUnlock(BaseModel):
    termsAccepted: bool = False
    mpin: str | None = None


@router.post("/{lead_id}/unlock")
async def unlock_lead_contact(lead_id: str, body: LeadUnlock, uid: str = Depends(current_user_id)):
    """Buyer-side contact unlock ("Contact Farmer") — and participant revisit.

    Verifies (in order): participant, industrial-buyer role + requirement
    ownership for the buyer side, application eligibility (no unlock on
    closed/invalid applications), verified KYC for both parties, the
    direct-connect terms and the caller's MPIN (when one is on file).

    Idempotent: repeated unlocks return the same lead with the same contacts;
    nothing new is created. Atomically marks the application `contacted`,
    stores consent/audit metadata, unlocks contact details for both
    participants, opens the (single) chat room and notifies both parties.
    Accepting contact does NOT accept the quote or create any purchase,
    purchase order, supply contract, invoice or payment obligation.
    """
    lead = await get_doc("leads", lead_id)
    if lead is None or uid not in (lead.get("farmerId"), lead.get("buyerId")):
        _error(404, "LEAD_NOT_FOUND", "lead not found")
    user = await get_user(uid)

    if uid == lead.get("buyerId") and lead.get("source") == LEAD_SOURCE_DEMAND:
        # The buyer side must hold an industrial-buyer role and own the
        # requirement this application belongs to.
        require_role(user, "directBuyer", "seller", "exporter")
        demand = await get_doc("demands", lead.get("demandId", ""))
        if demand is None or demand.get("buyerId") != uid:
            _error(403, "FORBIDDEN", "you do not own this requirement")
        if lead.get("status") not in LIVE_LEAD_STATUSES:
            _error(409, "APPLICATION_NOT_ELIGIBLE", "this application is no longer open for contact")
    elif uid == lead.get("farmerId") and not _contacts_unlocked(lead):
        # The applicant may revisit the connection only after the buyer
        # unlocked it — their own contact details must never be revealed to
        # themselves before the buyer accepts the connection.
        _error(409, "NOT_UNLOCKED_YET", "the buyer has not unlocked this connection yet")

    if not await is_identity_verified(user):
        _error(403, "KYC_REQUIRED", "complete identity verification (KYC) to unlock contacts")
    other_id = lead.get("buyerId") if uid == lead.get("farmerId") else lead.get("farmerId")
    other = await get_user(other_id) or {}
    if not await is_identity_verified(other):
        _error(403, "COUNTERPARTY_UNVERIFIED", "the other party has not completed identity verification")
    if not body.termsAccepted:
        _error(422, "TERMS_REQUIRED", "accept the terms & conditions to unlock contact details")
    if user.get("mpinHash"):
        if not body.mpin:
            _error(401, "WRONG_MPIN", "mpin is required to reveal contact details")
        if not verify_mpin(body.mpin, user["mpinHash"]):
            _error(401, "WRONG_MPIN", "incorrect MPIN")
    await hit("leads", uid, 30, 60)

    now = _now()
    first_unlock = lead.get("contactRevealedAt") is None
    lead["contactRevealedAt"] = lead.get("contactRevealedAt") or now
    lead["termsAccepted"] = True
    lead["termsVersion"] = lead.get("termsVersion") or TERMS_VERSION
    lead["termsAcceptedAt"] = lead.get("termsAcceptedAt") or now
    lead.setdefault("unlocks", [])
    if not any(u.get("by") == uid for u in lead["unlocks"]):
        lead["unlocks"] = [*lead["unlocks"], {"by": uid, "at": now, "termsVersion": lead["termsVersion"]}]
    if lead.get("status") in ("new", "submitted"):
        lead["status"] = "contacted"
    lead["updatedAt"] = now
    await set_doc("leads", lead_id, lead)

    crop = lead.get("lotCrop") or lead.get("demandCrop") or "produce"
    caller_name = ((user.get("name") or "").strip().split(" ") or [""])[0] or "The other party"
    if first_unlock:
        # Both parties are notified (spec §17) — no phone numbers in payloads.
        await notify_user(
            other_id,
            type="contact_unlocked",
            title="Contact unlocked / संपर्क उघडला",
            body=f"{caller_name} unlocked the contact for your {crop} connection — call, WhatsApp or chat directly.",
            deepLink=f"/chat?room={lead['chatRoomId']}" if lead.get("chatRoomId") else "/farmer/connections",
        )
        await notify_user(
            uid,
            type="contact_unlocked",
            title="Contact unlocked / संपर्क उघडला",
            body=f"Contact details are now shared for your {crop} connection — call, WhatsApp or chat directly.",
            deepLink=f"/chat?room={lead['chatRoomId']}" if lead.get("chatRoomId") else "/directbuyer/suppliers",
        )
    return _with_contacts(lead, uid)


@router.patch("/{lead_id}")
async def update_lead_status(lead_id: str, body: LeadStatusUpdate, uid: str = Depends(current_user_id)):
    """Deal outcome update — restricted to the two connected parties. The
    outcome is user-reported only; it never creates or verifies any payment,
    purchase, procurement, or settlement object."""
    lead = await get_doc("leads", lead_id)
    if lead is None or uid not in (lead.get("farmerId"), lead.get("buyerId")):
        _error(404, "LEAD_NOT_FOUND", "lead not found")
    canonical = _canonical_status(body.status)
    lead["status"] = canonical
    if body.finalRate is not None:
        if body.finalRate < 0:
            _error(422, "VALIDATION_ERROR", "invalid rate", {"finalRate": "must be 0 or more"})
        lead["finalRate"] = body.finalRate
    lead["updatedAt"] = _now()
    await set_doc("leads", lead_id, lead)

    other_id = lead.get("buyerId") if uid == lead.get("farmerId") else lead.get("farmerId")
    crop = lead.get("lotCrop") or lead.get("demandCrop") or "produce"
    other_link = "/directbuyer/suppliers" if other_id == lead.get("buyerId") else "/farmer/connections"
    if canonical == "dealDone":
        lot = await get_doc("market_lots", lead.get("lotId", ""))
        if lot is not None and lot.get("status") == "open":
            lot["status"] = "sold"
            if body.finalRate is not None:
                lot["finalRate"] = body.finalRate
            lot["updatedAt"] = _now()
            await set_doc("market_lots", lot["id"], lot)
        await notify_user(
            other_id,
            type="lead_outcome_updated",
            title="Deal marked completed / सौदा पूर्ण",
            body=f"The {crop} connection was marked 'deal completed' — a user-reported outcome, not a payment record.",
            deepLink=other_link,
        )
    elif canonical == "dismissed":
        await notify_user(
            other_id,
            type="lead_outcome_updated",
            title="Connection closed / संपर्क बंद",
            body=f"The {crop} connection was marked 'did not happen'.",
            deepLink=other_link,
        )
    elif canonical == "withdrawn":
        await notify_user(
            other_id,
            type="application_withdrawn",
            title="Application withdrawn / आवेदन मागे",
            body=f"The {crop} application was withdrawn.",
            deepLink=other_link,
        )
    return _with_contacts(lead, uid)


@router.post("/{lead_id}/outcome")
async def record_lead_outcome(lead_id: str, body: LeadOutcomeIn, uid: str = Depends(current_user_id)):
    """User-reported outcome after contact (spec §11) — still in contact /
    supply arrangement completed offline / did not happen / withdrawn, with
    optional dealDone details (final quantity, price, supply start, one-time or
    recurring arrangement). These details are NOT platform-verified payment,
    quality, contract or delivery evidence, and nothing (purchase order, supply
    contract, invoice, delivery order, payment, settlement, recurring billing)
    is created from them."""
    lead = await get_doc("leads", lead_id)
    if lead is None or uid not in (lead.get("farmerId"), lead.get("buyerId")):
        _error(404, "LEAD_NOT_FOUND", "lead not found")
    if lead.get("status") in ("submitted", "new") and body.outcome == "withdrawn" and uid == lead.get("buyerId"):
        _error(409, "NOT_CONTACTED", "the application is not in contact yet — dismiss it instead")
    outcome_status = {
        "still_in_contact": "contacted",
        "deal_done_offline": "dealDone",
        "did_not_happen": "dismissed",
        "withdrawn": "withdrawn",
    }[body.outcome]
    now = _now()
    lead["status"] = outcome_status
    if body.outcome == "deal_done_offline":
        if body.supplyStartDate:
            _parse_date(body.supplyStartDate, "supplyStartDate")
        lead["dealDetails"] = {
            "finalQuantity": body.finalQuantity,
            "finalUnit": body.finalUnit or lead.get("unit") or "",
            "finalPrice": body.finalPrice,
            "finalPriceUnit": body.finalPriceUnit or body.finalUnit or lead.get("unit") or "",
            "supplyStartDate": body.supplyStartDate,
            "arrangementType": body.arrangementType,
            "reportedBy": uid,
            "at": now,
        }
    lead["updatedAt"] = now
    await set_doc("leads", lead_id, lead)

    other_id = lead.get("buyerId") if uid == lead.get("farmerId") else lead.get("farmerId")
    crop = lead.get("lotCrop") or lead.get("demandCrop") or "produce"
    other_link = "/directbuyer/suppliers" if other_id == lead.get("buyerId") else "/farmer/connections"
    labels = {
        "still_in_contact": "still in contact",
        "deal_done_offline": "supply arrangement completed offline (user-reported)",
        "did_not_happen": "did not happen",
        "withdrawn": "withdrawn",
    }
    await notify_user(
        other_id,
        type="lead_outcome_updated",
        title="Outcome updated / परिणाम अद्यतित",
        body=f"The {crop} connection outcome was updated: {labels[body.outcome]}.",
        deepLink=other_link,
    )
    return _with_contacts(lead, uid)
