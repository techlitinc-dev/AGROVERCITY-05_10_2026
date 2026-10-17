import hashlib
import json
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Form, HTTPException, Response, UploadFile

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.broker import (
    BuyerRequirementCreate,
    DealCancelRequest,
    DealCreate,
    DealUpdate,
    DealDisputeCreate,
    DealMessageCreate,
    EvidenceKind,
    LeadCreate,
    LeadUpdate,
    MAX_VAULT_PER_KIND,
    MilestoneCreate,
    VAULT_KINDS,
    VehicleUpdate,
)
from app.routers.users import require_role
from app.services import broker_ai, storage
from app.services.ai.privacy import build_broker_deadlock_state, build_broker_lead_score_state
from app.services.billing import entitlement_guard, record_usage
from app.services.notify import notify_user
from app.services.tasks import DEEP_LINKS, emit_task
from app.services.users import get_user

router = APIRouter(prefix="/broker", tags=["broker"])

MAX_EVIDENCE_PER_DEAL = 20
# WS-05 step 2: counter-offer rounds cap — at 3 the deal locks to accept/decline.
COUNTER_ROUND_CAP = 3

# P0-5 (B12/E7): the captured buyer payment is held in escrow and released
# only after delivery confirmation + this silent window; a dispute pauses it.
ESCROW_RELEASE_WINDOW_HOURS = 48
# P1-9 (E6): weighbridge divergence beyond this tolerance raises a pro-rata
# adjustment proposal on the deal.
WEIGH_TOLERANCE_PCT = 2.0
E6_DISPUTE_WINDOW_HOURS = 24

# WS-05 step 1: offer TTL — configurable 24–48h (default 24h), versioned config
# the way transport_penalties is; the router only consumes.
OFFER_TTL_DEFAULTS = {"ttlHours": 24, "version": 1, "effectiveFrom": "2026-10-01T00:00:00+00:00"}


async def _offer_ttl_hours() -> int:
    config = await get_doc("platform_config", "broker_offer_ttl")
    if config is None:
        config = dict(OFFER_TTL_DEFAULTS)
        await set_doc("platform_config", "broker_offer_ttl", config)
    try:
        hours = int(config.get("ttlHours", 24))
    except (TypeError, ValueError):
        hours = 24
    return min(48, max(24, hours))


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def _broker_user(uid: str = Depends(current_user_id)) -> tuple[dict, str]:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "broker")
    return user, uid


def _last10(phone: str) -> str:
    digits = "".join(ch for ch in str(phone or "") if ch.isdigit())
    return digits[-10:]


async def _find_uid_by_phone(phone: str) -> str | None:
    if not phone:
        return None
    hits = await query("users", [("phone", "==", phone)], limit=1)
    if hits:
        return hits[0].get("id")
    target = _last10(phone)
    if target:
        for user in await query("users", [], limit=1000):
            if _last10(user.get("phone", "")) == target:
                return user.get("id")
    return None


async def _notify(uid: str | None, *, type: str, title: str, body: str, deepLink: str | None = None):
    if not uid:
        return
    try:
        await notify_user(uid, type=type, title=title, body=body, deepLink=deepLink)
    except Exception:
        pass  # notifications are best-effort — never break the deal flow


def _mask_plate(number: str) -> str:
    """B8: mask an Indian vehicle plate for display — keep the first two
    segments (state + RTO code) and the last segment, mask the middle:
    "MH 12 AB 3456" -> "MH 12 •• 3456". The full plate stays stored."""
    segments = str(number or "").split()
    if len(segments) >= 3:
        return " ".join([segments[0], segments[1], "••", segments[-1]])
    if len(segments) == 2:
        return f"{segments[0]} •• {segments[1]}"
    return "••"


def _mask_phone(phone: str) -> str:
    """C1: phones are never shown post-auth — "+91 •• •••• •006"."""
    digits = "".join(ch for ch in str(phone or "") if ch.isdigit())
    last3 = digits[-3:] if len(digits) >= 3 else digits
    return f"+91 •• •••• •{last3}" if digits else ""


def _serialize_deal(deal: dict) -> dict:
    """P1-12 (B8): single deal serializer — masks the vehicle plate everywhere
    a deal doc leaves the API (detail, list, commissions, farmer side)."""
    out = dict(deal)
    vehicle = out.get("vehicle")
    if vehicle and vehicle.get("vehicleNumber"):
        masked = dict(vehicle)
        masked["vehicleNumber"] = _mask_plate(masked["vehicleNumber"])
        out["vehicle"] = masked
    return out


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _first_name(name: str) -> str:
    return (name or "").strip().split(" ")[0]


async def _load_owned_deal(deal_id: str, uid: str) -> dict:
    deal = await get_doc("broker_deals", deal_id)
    if not deal or deal.get("brokerId") != uid:
        _error(404, "DEAL_NOT_FOUND", "Deal not found")
    return deal


async def _deal_party(deal_id: str, uid: str = Depends(current_user_id)) -> tuple[dict, str]:
    """Deal-party dependency for party-facing documents (contract/receipt):
    the owning broker or the farmer matched by phone (P2 contract)."""
    deal = await get_doc("broker_deals", deal_id)
    if deal is None:
        _error(404, "DEAL_NOT_FOUND", "Deal not found")
    if deal.get("brokerId") == uid:
        return deal, uid
    user = await get_user(uid) or {}
    target = _last10(user.get("phone", ""))
    if target and target == _last10(deal.get("sellerPhone", "")):
        return deal, uid
    _error(404, "DEAL_NOT_FOUND", "Deal not found")


@router.get("/deals")
async def list_deals(
    status: str | None = None,
    page: int = 1,
    pageSize: int = 20,
    ctx: tuple = Depends(_broker_user),
):
    _, uid = ctx
    docs = await query("broker_deals", [("brokerId", "==", uid)], limit=1000)

    if status:
        docs = [d for d in docs if d.get("status") == status]
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    total = len(docs)
    start = (page - 1) * pageSize
    return {"data": [_serialize_deal(d) for d in docs[start:start + pageSize]], "page": page, "pageSize": pageSize, "total": total}


@router.post("/deals", status_code=201)
async def create_deal(
    body: DealCreate,
    ctx: tuple = Depends(_broker_user),
    _plan: dict = Depends(entitlement_guard("broker", "deals")),
):
    user, uid = ctx
    deal_id = f"deal_{uuid.uuid4().hex[:12]}"
    gross_amount = round(body.quantityQuintals * body.agreedRate, 2)
    commission_amount = round(gross_amount * (body.brokerCommissionPct / 100.0), 2)
    now = datetime.now(timezone.utc).isoformat()

    doc = {
        **body.model_dump(),
        "id": deal_id,
        "brokerId": uid,
        "brokerName": user.get("fullName") or user.get("vernacularName", "Broker"),
        "status": "negotiating",
        "grossAmount": gross_amount,
        "commissionAmount": commission_amount,
        # WS-05 step 1: every offer expires TTL hours out (default 24h)
        "expiresAt": (datetime.now(timezone.utc) + timedelta(hours=await _offer_ttl_hours())).isoformat(),
        "evidence": [],
        "createdAt": now,
        "updatedAt": now,
    }
    seller_uid = await _find_uid_by_phone(body.sellerPhone)
    if seller_uid:
        doc["sellerUid"] = seller_uid
    buyer_uid = await _find_uid_by_phone(body.buyerPhone)
    if buyer_uid:
        doc["buyerUid"] = buyer_uid
    await set_doc("broker_deals", deal_id, doc)
    await record_usage(uid, "deals")
    # WS-05 task emission (module: broker) — seller confirmation.
    if seller_uid:
        await emit_task(
            seller_uid,
            persona="farmer",
            module="broker",
            kind="deal_confirmation_pending",
            title_en="Deal awaiting your confirmation",
            title_hi="सौदा आपकी पुष्टि की प्रतीक्षा में",
            subtitle=f"{body.commodity} · {body.quantityQuintals}q @ ₹{body.agreedRate}/quintal",
            priority="today",
            deep_link=f"{DEEP_LINKS['farmer_deals']}/{deal_id}",
            source_id=deal_id,
        )
    await _notify(
        seller_uid,
        type="deal_offer_received",
        title="New offer / नया ऑफर",
        body=(
            f"{doc['brokerName']} offered ₹{body.agreedRate}/quintal for "
            f"{body.quantityQuintals}q {body.commodity}"
        ),
        deepLink=f"/dashboard/p/farmer/deals/{deal_id}",
    )
    return doc


@router.get("/deals/{deal_id}")
async def get_deal(deal_id: str, ctx: tuple = Depends(_broker_user)):
    _, uid = ctx
    doc = await get_doc("broker_deals", deal_id)
    if not doc or doc.get("brokerId") != uid:
        _error(404, "DEAL_NOT_FOUND", "Deal not found")
    return _serialize_deal(doc)


@router.put("/deals/{deal_id}")
async def update_deal(deal_id: str, body: DealUpdate, ctx: tuple = Depends(_broker_user)):
    _, uid = ctx
    doc = await get_doc("broker_deals", deal_id)
    if not doc or doc.get("brokerId") != uid:
        _error(404, "DEAL_NOT_FOUND", "Deal not found")

    previous_status = doc.get("status")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    doc.update(updates)
    if "quantityQuintals" in updates or "agreedRate" in updates:
        q = doc.get("quantityQuintals", 0)
        r = doc.get("agreedRate", 0)
        doc["grossAmount"] = round(q * r, 2)
        pct = doc.get("brokerCommissionPct", 2.0)
        doc["commissionAmount"] = round(doc["grossAmount"] * (pct / 100.0), 2)

    doc["updatedAt"] = datetime.now(timezone.utc).isoformat()

    new_status = doc.get("status")
    if new_status == "completed" and not doc.get("deliveredAt"):
        # P0-5: completion is the delivery confirmation — it starts the
        # escrow release clock (deliveredAt + 48h silent window).
        doc["deliveredAt"] = doc["updatedAt"]
        escrow = doc.get("escrow")
        if escrow and escrow.get("status") == "held" and not escrow.get("releaseAt"):
            delivered_at = _parse_iso(doc["deliveredAt"])
            if delivered_at:
                escrow["releaseAt"] = (
                    delivered_at + timedelta(hours=ESCROW_RELEASE_WINDOW_HOURS)
                ).isoformat()
            doc["escrow"] = escrow
    await set_doc("broker_deals", deal_id, doc)

    if new_status != previous_status:
        commodity = doc.get("commodity", "")
        if new_status == "contract_issued":
            await _notify(
                doc.get("sellerUid"),
                type="deal_contract_issued",
                title="Contract ready / कॉन्ट्रैक्ट तैयार",
                body=f"{commodity} — accept the contract to confirm the deal",
                deepLink=f"/dashboard/p/farmer/deals/{deal_id}",
            )
        elif new_status == "in_transit":
            await _notify(
                doc.get("sellerUid"),
                type="deal_in_transit",
                title="Pickup done / गाड़ी रवाना",
                body=f"{commodity} — pickup completed, goods in transit",
                deepLink=f"/dashboard/p/farmer/deals/{deal_id}",
            )
        elif new_status == "completed":
            await _notify(
                doc.get("sellerUid"),
                type="deal_completed",
                title="Delivered / डिलीवरी पूरी",
                body=(
                    f"{commodity} — gross ₹{doc.get('grossAmount', 0)}, "
                    f"commission ₹{doc.get('commissionAmount', 0)}"
                ),
                deepLink=f"/dashboard/p/farmer/deals/{deal_id}",
            )
    return _serialize_deal(doc)


@router.delete("/deals/{deal_id}")
async def cancel_deal(
    deal_id: str,
    body: DealCancelRequest | None = None,
    ctx: tuple = Depends(_broker_user),
):
    _, uid = ctx
    doc = await get_doc("broker_deals", deal_id)
    if not doc or doc.get("brokerId") != uid:
        _error(404, "DEAL_NOT_FOUND", "Deal not found")
    doc["status"] = "cancelled"
    if body is not None and body.reason:
        doc["cancelReason"] = body.reason
    doc["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("broker_deals", deal_id, doc)
    return {"ok": True, "status": "cancelled"}


@router.get("/deals/{deal_id}/messages")
async def get_deal_messages(deal_id: str, ctx: tuple = Depends(_broker_user)):
    _, uid = ctx
    deal = await get_doc("broker_deals", deal_id)
    if not deal or deal.get("brokerId") != uid:
        _error(404, "DEAL_NOT_FOUND", "Deal not found")
    docs = await query("deal_messages", [("dealId", "==", deal_id)], limit=500)
    docs.sort(key=lambda d: d.get("createdAt", ""))
    return {"data": docs}


async def _assert_counter_round_available(deal_id: str):
    """WS-05 step 2: at 3 counter rounds the deal locks to accept/decline."""
    messages = await query("deal_messages", [("dealId", "==", deal_id)], limit=500)
    rounds = sum(1 for m in messages if m.get("amountOffer") is not None)
    if rounds >= COUNTER_ROUND_CAP:
        _error(
            409,
            "COUNTER_LIMIT_REACHED",
            f"counter limit reached ({COUNTER_ROUND_CAP} rounds) — the deal is locked to accept or decline",
        )


async def _evaluate_round_two_deadlock(deal_id: str, deal: dict, amount_offer: float, broker_id: str):
    messages = await query("deal_messages", [("dealId", "==", deal_id)], limit=500)
    round_no = sum(1 for m in messages if m.get("amountOffer") is not None)
    if round_no == 2:
        initial_rate = float(deal.get("agreedRate") or 1.0)
        price_gap_pct = abs(amount_offer - initial_rate) / initial_rate * 100.0
        ttl_left = 24.0
        expires_at = deal.get("expiresAt")
        if expires_at:
            try:
                exp_dt = datetime.fromisoformat(expires_at)
                ttl_left = max(0.0, (exp_dt - datetime.now(timezone.utc)).total_seconds() / 3600.0)
            except Exception:
                pass
        deadlock_state = build_broker_deadlock_state(
            deal=deal,
            messages=messages,
            counter_round=round_no,
            price_gap_pct=price_gap_pct,
            ttl_hours_remaining=ttl_left,
            broker_id=broker_id,
        )
        deadlock_risk = await broker_ai.predict_deadlock(deadlock_state, broker_id)
        if deadlock_risk is not None:
            deal["deadlockRisk"] = deadlock_risk
            if deadlock_risk >= 0.5:
                deal["suggestMediator"] = True
                deal["suggestedAction"] = "mediator"
            await set_doc("broker_deals", deal_id, deal)


@router.post("/deals/{deal_id}/messages", status_code=201)
async def send_deal_message(deal_id: str, body: DealMessageCreate, ctx: tuple = Depends(_broker_user)):
    user, uid = ctx
    deal = await get_doc("broker_deals", deal_id)
    if not deal or deal.get("brokerId") != uid:
        _error(404, "DEAL_NOT_FOUND", "Deal not found")
    await moderate_deal_text(body.text, uid)
    if body.amountOffer is not None:
        await _assert_counter_round_available(deal_id)
    msg_id = f"msg_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    sender_name = body.senderName or user.get("fullName") or user.get("vernacularName", "Broker")

    doc = {
        "id": msg_id,
        "dealId": deal_id,
        "senderId": uid,
        "senderRole": body.senderRole,
        "senderName": sender_name,
        "text": body.text,
        "amountOffer": body.amountOffer,
        "createdAt": now,
    }
    await set_doc("deal_messages", msg_id, doc)

    if body.amountOffer is not None:
        await _evaluate_round_two_deadlock(deal_id, deal, body.amountOffer, uid)

    return doc


@router.post("/deals/{deal_id}/evidence", status_code=201)
async def upload_deal_evidence(
    deal_id: str,
    file: UploadFile,
    kind: EvidenceKind = Form("photo"),
    ctx: tuple = Depends(_broker_user),
):
    _, uid = ctx
    deal = await get_doc("broker_deals", deal_id)
    if not deal or deal.get("brokerId") != uid:
        _error(404, "DEAL_NOT_FOUND", "Deal not found")
    evidence = list(deal.get("evidence") or [])
    if len(evidence) >= MAX_EVIDENCE_PER_DEAL:
        _error(409, "EVIDENCE_LIMIT_REACHED", f"maximum {MAX_EVIDENCE_PER_DEAL} evidence files per deal")
    # B4: typed vault kinds are capped separately (5 per kind)
    if kind in VAULT_KINDS:
        kind_count = sum(1 for e in evidence if e.get("kind") == kind)
        if kind_count >= MAX_VAULT_PER_KIND:
            _error(409, "VAULT_KIND_LIMIT", f"maximum {MAX_VAULT_PER_KIND} {kind} documents per deal")
    data = await storage.validate_upload(file)
    blob_path, _ = storage.upload_user_file(uid, data, file.filename, file.content_type, prefix="deals")
    entry = {
        "id": f"evi_{uuid.uuid4().hex[:12]}",
        "blobPath": blob_path,
        "kind": kind,
        "uploadedBy": uid,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    evidence.append(entry)
    deal["evidence"] = evidence
    deal["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("broker_deals", deal_id, deal)
    return entry


@router.get("/leads")
async def list_leads(
    type: str | None = None,
    status: str | None = None,
    ctx: tuple = Depends(_broker_user),
):
    _, uid = ctx
    docs = await query("broker_leads", [("brokerId", "==", uid)], limit=500)

    if type:
        docs = [d for d in docs if d.get("type") == type]
    if status:
        docs = [d for d in docs if d.get("status") == status]
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return {"data": docs, "total": len(docs)}


@router.post("/leads", status_code=201)
async def create_lead(body: LeadCreate, ctx: tuple = Depends(_broker_user)):
    _, uid = ctx
    lead_id = f"lead_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        **body.model_dump(),
        "id": lead_id,
        "brokerId": uid,
        "status": "active",
        "createdAt": now,
        "updatedAt": now,
    }
    try:
        lead_state = build_broker_lead_score_state(doc, broker_id=uid)
        scores = await broker_ai.score_lead(lead_state, uid, default_quality=0.5)
        doc["score"] = scores["score"]
        doc["deadlockRisk"] = scores["deadlockRisk"]
    except Exception:
        doc["score"] = 0.5
        doc["deadlockRisk"] = 0.0

    await set_doc("broker_leads", lead_id, doc)
    return doc


@router.put("/leads/{lead_id}")
async def update_lead(lead_id: str, body: LeadUpdate, ctx: tuple = Depends(_broker_user)):
    _, uid = ctx
    doc = await get_doc("broker_leads", lead_id)
    if not doc or doc.get("brokerId") != uid:
        _error(404, "LEAD_NOT_FOUND", "Lead not found")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    doc.update(updates)
    doc["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("broker_leads", lead_id, doc)
    return doc


@router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, ctx: tuple = Depends(_broker_user)):
    _, uid = ctx
    doc = await get_doc("broker_leads", lead_id)
    if not doc or doc.get("brokerId") != uid:
        _error(404, "LEAD_NOT_FOUND", "Lead not found")
    doc["status"] = "dropped"
    await set_doc("broker_leads", lead_id, doc)
    return {"ok": True, "status": "dropped"}


@router.get("/commissions")
async def list_commissions(ctx: tuple = Depends(_broker_user)):
    _, uid = ctx
    deals = await query("broker_deals", [("brokerId", "==", uid)], limit=1000)
    completed = [d for d in deals if d.get("status") == "completed"]
    total_commission = sum(d.get("commissionAmount", 0) for d in completed)
    pending_commission = sum(d.get("commissionAmount", 0) for d in deals if d.get("status") in ("negotiating", "contract_issued", "accepted", "in_transit"))

    return {
        "totalEarned": round(total_commission, 2),
        "pendingPayout": round(pending_commission, 2),
        "completedDealsCount": len(completed),
        "activeDealsCount": len(deals) - len(completed),
        "deals": [_serialize_deal(d) for d in deals[:50]],
    }


# ==========================================
# DEADLOCK ESCALATION (WS-05 step 2)
# ==========================================

@router.post("/deals/{deal_id}/escalate")
async def escalate_deadlocked_deal(deal_id: str, reason: str = "", ctx: tuple = Depends(_broker_user)):
    """Round-3 locked deal with no accept/decline — the broker escalates to
    the admin mediator queue (WS-05 step 2; AI deadlock-risk prediction at
    round 2 is WS-06 M19)."""
    _, uid = ctx
    deal = await get_doc("broker_deals", deal_id)
    if deal is None or deal.get("brokerId") != uid:
        _error(404, "DEAL_NOT_FOUND", "Deal not found")
    if deal.get("escalatedAt"):
        _error(409, "ALREADY_ESCALATED", "deal is already in the mediator queue")
    now = datetime.now(timezone.utc).isoformat()
    deal["escalatedAt"] = now
    deal["escalationReason"] = reason
    deal["updatedAt"] = now
    await set_doc("broker_deals", deal_id, deal)
    await emit_task(
        "admin",
        persona="admin",
        module="broker",
        kind="deal_deadlock_escalation",
        title_en=f"Deadlocked deal needs a mediator: {deal.get('commodity', '')}",
        title_hi=f"मध्यस्थता चाहिए: {deal.get('commodity', '')}",
        subtitle=reason or "counter limit reached with no accept/decline",
        priority="high",
        deep_link=f"{DEEP_LINKS['broker']}/deals/{deal_id}",
        source_id=deal_id,
    )
    return deal


# ==========================================
# DEAL DOCUMENTS VAULT (B4)
# ==========================================

VAULT_OPEN_STATUSES = ("accepted", "in_transit", "completed")


@router.get("/deals/{deal_id}/vault")
async def view_deal_vault(deal_id: str, ctx: tuple = Depends(_broker_user)):
    """B4: the typed vault (weigh_slip / quality_report / payment_proof) opens
    to both parties only after the deal is accepted — not while negotiating."""
    _, uid = ctx
    deal = await get_doc("broker_deals", deal_id)
    if not deal or deal.get("brokerId") != uid:
        _error(404, "DEAL_NOT_FOUND", "Deal not found")
    if deal.get("status") not in VAULT_OPEN_STATUSES:
        _error(409, "VAULT_LOCKED", "the document vault opens once the deal is accepted")
    evidence = [e for e in (deal.get("evidence") or []) if e.get("kind") in VAULT_KINDS]
    return {
        "dealId": deal_id,
        "status": deal.get("status"),
        "data": evidence,
        "total": len(evidence),
    }


# ==========================================
# PAYMENT SPLIT AT CAPTURE (B7)
# ==========================================

@router.post("/deals/{deal_id}/payment-capture")
async def capture_deal_payment(deal_id: str, ctx: tuple = Depends(_broker_user)):
    """B7: the buyer's payment splits at capture — farmer leg + commission leg
    via the phase-00 Razorpay route/split integration. Integer paisa; the legs
    sum to the gross; every capture writes audit_logs (rule 3)."""
    from app.services import settlements as settlements_service
    from app.services import kyc as kyc_service
    from app.services.payments import create_razorpay_split_payment

    _, uid = ctx
    # B1: money only moves for a KYC-verified broker (arhtiya licence + GST
    # through the phase-00 pipeline).
    kyc_case = await kyc_service.get_case(kyc_service.case_id_for(uid, "broker"))
    verified_types = {
        doc.get("type")
        for doc in (kyc_case or {}).get("docs") or []
        if doc.get("status") == "verified"
    }
    if not {"arhtiya_licence", "gst"} <= verified_types:
        _error(403, "BROKER_KYC_REQUIRED", "broker KYC must be verified before capturing payments")
    deal = await get_doc("broker_deals", deal_id)
    if not deal or deal.get("brokerId") != uid:
        _error(404, "DEAL_NOT_FOUND", "Deal not found")
    if deal.get("status") not in ("accepted", "in_transit"):
        _error(409, "INVALID_STATE", f"cannot capture payment in status {deal.get('status')}")
    if deal.get("paymentCapture"):
        _error(409, "ALREADY_CAPTURED", "payment already captured for this deal")

    config = await settlements_service._config()
    pct = float(config.get("brokerPct", 2))
    gross_paisa = int(round(float(deal.get("grossAmount", 0) or 0) * 100))
    commission_paisa = int(round(gross_paisa * pct / 100))
    farmer_paisa = gross_paisa - commission_paisa

    split = await create_razorpay_split_payment(
        gross_paisa, farmer_paisa, commission_paisa, f"deal_{deal_id}"
    )
    now = datetime.now(timezone.utc).isoformat()
    deal["paymentCapture"] = {
        "grossPaisa": gross_paisa,
        "farmerLegPaisa": farmer_paisa,
        "commissionLegPaisa": commission_paisa,
        "commissionPct": pct,
        "razorpayRef": split.get("id"),
        "capturedAt": now,
    }
    # P0-5 (B12/E7): the captured amount is NOT split to the farmer at capture
    # — it is held in escrow on the deal and released after delivery
    # confirmation + a 48h silent window (release_deal_escrow performs the
    # split). A dispute opened on the deal pauses the release.
    delivered_at = _parse_iso(deal.get("deliveredAt"))
    deal["escrow"] = {
        "status": "held",
        "amountPaisa": gross_paisa,
        "releaseAt": (
            (delivered_at + timedelta(hours=ESCROW_RELEASE_WINDOW_HOURS)).isoformat()
            if delivered_at
            else None
        ),
        "disputeWindowHours": ESCROW_RELEASE_WINDOW_HOURS,
        "disputeOpenedAt": None,
        "disputeResolvedAt": None,
        "heldAt": now,
        "captureRef": split.get("id"),
    }
    deal["updatedAt"] = now
    await set_doc("broker_deals", deal_id, deal)
    await set_doc(
        "audit_logs",
        f"aud_deal_capture_{deal_id}_{now[:19]}",
        {
            "action": "DEAL_PAYMENT_CAPTURE",
            "actorId": uid,
            "dealId": deal_id,
            "grossPaisa": gross_paisa,
            "farmerLegPaisa": farmer_paisa,
            "commissionLegPaisa": commission_paisa,
            "razorpayRef": split.get("id"),
            "timestamp": now,
        },
    )
    return {**deal["paymentCapture"], "escrow": deal["escrow"]}


async def release_deal_escrow(deal: dict) -> dict:
    """P0-5 (B12/E7): release a deal's held escrow — the actual farmer/platform
    split. The captured amount leaves escrow only when the delivery + 48h
    silent window closed and no dispute is open; the farmer leg (held amount
    minus commission) lands as a farmer settlement row and the commission leg
    is recorded to the platform, each with an audit_logs entry.

    This is the module-level helper the nightly payout job imports; it is
    idempotent (an already-released/paused/not-due escrow is a no-op) and
    persists the mutated deal before returning it."""
    from app.services.escrow import is_due, is_paused

    escrow = deal.get("escrow") or {}
    if escrow.get("status") != "held" or is_paused(escrow) or not is_due(escrow):
        return deal

    now = datetime.now(timezone.utc).isoformat()
    amount_paisa = int(escrow.get("amountPaisa") or 0)
    capture = deal.get("paymentCapture") or {}
    commission_paisa = int(capture.get("commissionLegPaisa") or 0)
    farmer_net_paisa = amount_paisa - commission_paisa
    escrow.update(
        {
            "status": "released",
            "releasedAt": now,
            "commissionPaisa": commission_paisa,
            "netReleasePaisa": farmer_net_paisa,
        }
    )
    deal["escrow"] = escrow
    deal["updatedAt"] = now
    await set_doc("broker_deals", deal["id"], deal)

    # The split: farmer leg -> farmer settlement row; commission -> platform.
    seller_uid = deal.get("sellerUid")
    await set_doc(
        "settlements",
        f"st_deal_farmer_{deal['id']}",
        {
            "id": f"st_deal_farmer_{deal['id']}",
            "role": "farmer",
            "kind": "broker_deal",
            "entityId": seller_uid or deal.get("sellerPhone", ""),
            "dealId": deal["id"],
            "grossRupees": amount_paisa // 100,
            "commissionRupees": commission_paisa // 100,
            "netRupees": farmer_net_paisa // 100,
            "status": "pending",
            "sourceIds": [deal["id"]],
            "createdAt": now,
        },
    )
    await set_doc(
        "audit_logs",
        f"aud_deal_escrow_release_{deal['id']}_{now[:19]}",
        {
            "action": "DEAL_ESCROW_RELEASED",
            "actorId": deal.get("brokerId"),
            "dealId": deal["id"],
            "amountPaisa": amount_paisa,
            "farmerLegPaisa": farmer_net_paisa,
            "commissionPaisa": commission_paisa,
            "timestamp": now,
        },
    )
    await _notify(
        seller_uid,
        type="deal_payout_released",
        title="Payout released / भुगतान जारी",
        body=(
            f"₹{farmer_net_paisa / 100:.2f} for {deal.get('commodity', '')} "
            f"({deal.get('quantityQuintals', 0)}q) released to your settlement"
        ),
        deepLink=f"/dashboard/p/farmer/deals/{deal['id']}",
    )
    return deal


@router.post("/deals/{deal_id}/release-payout")
async def release_deal_payout(deal_id: str, ctx: tuple = Depends(_broker_user)):
    """B12: broker-triggered payout release — the endpoint twin of the nightly
    job. Enforces the escrow rules before delegating to release_deal_escrow:
    delivery + 48h silent window closed, and no open dispute (a dispute
    pauses the release until resolved)."""
    from app.services.escrow import is_due, is_paused

    _, uid = ctx
    deal = await _load_owned_deal(deal_id, uid)
    escrow = deal.get("escrow") or {}
    if escrow.get("status") != "held":
        _error(409, "INVALID_STATE", "no held escrow to release for this deal")
    if is_paused(escrow):
        _error(409, "DISPUTE_OPEN", "an open dispute pauses the payout release")
    if not is_due(escrow):
        _error(
            409,
            "RELEASE_WINDOW_OPEN",
            f"the {escrow.get('disputeWindowHours', ESCROW_RELEASE_WINDOW_HOURS)}h silent window "
            "after delivery has not closed yet",
        )
    deal = await release_deal_escrow(deal)
    return _serialize_deal(deal)


# ==========================================
# BUYER REQUIREMENT POSTINGS (B3)
# ==========================================

@router.post("/buyer-requirements", status_code=201)
async def post_buyer_requirement(body: BuyerRequirementCreate, uid: str = Depends(current_user_id)):
    """A wholesale buyer posts a requirement ("need 50q onion @ ₹X") brokers
    can respond to. Writes are idempotency-keyed downstream (respond)."""
    user = await get_user(uid) or {}
    doc = {
        "id": f"req_{uuid.uuid4().hex[:10]}",
        "buyerId": uid,
        "buyerName": user.get("fullName") or user.get("vernacularName") or user.get("name", "Buyer"),
        "buyerPhone": user.get("phone", ""),
        **body.model_dump(),
        "status": "open",
        "responsesCount": 0,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("buyer_requirements", doc["id"], doc)
    return doc


@router.get("/buyer-requirements")
async def list_buyer_requirements(ctx: tuple = Depends(_broker_user)):
    """The broker's B3 board: open wholesale requirements."""
    _, uid = ctx
    docs = await query("buyer_requirements", [("status", "==", "open")], limit=500)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return {"data": docs, "total": len(docs)}


@router.post("/buyer-requirements/{requirement_id}/respond", status_code=201)
async def respond_to_requirement(requirement_id: str, ctx: tuple = Depends(_broker_user)):
    """Broker responds — a lead is prefilled into their pipeline off the
    requirement (the existing 'Make deal' prefill), linked back by id."""
    from app.services import idempotency

    _, uid = ctx
    requirement = await get_doc("buyer_requirements", requirement_id)
    if requirement is None:
        _error(404, "REQUIREMENT_NOT_FOUND", "requirement not found")
    if requirement.get("status") != "open":
        _error(409, "REQUIREMENT_CLOSED", "requirement is no longer open")

    lead_id = f"lead_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    lead = {
        "id": lead_id,
        "name": requirement["buyerName"],
        "phone": requirement.get("buyerPhone", ""),
        "type": "buyer",
        "commodity": requirement["commodity"],
        "quantityExpected": requirement["quantityQuintals"],
        "targetRate": requirement["targetRate"],
        "location": requirement.get("location", ""),
        "notes": f"From requirement {requirement_id}: {requirement.get('notes', '')}",
        "brokerId": uid,
        "requirementId": requirement_id,
        "status": "active",
        "createdAt": now,
        "updatedAt": now,
    }
    try:
        lead_state = build_broker_lead_score_state(lead, demand_fit=True, broker_id=uid)
        scores = await broker_ai.score_lead(lead_state, uid, default_quality=0.8)
        lead["score"] = scores["score"]
        lead["deadlockRisk"] = scores["deadlockRisk"]
    except Exception:
        lead["score"] = 0.8
        lead["deadlockRisk"] = 0.0

    await set_doc("broker_leads", lead_id, lead)

    requirement["responsesCount"] = int(requirement.get("responsesCount", 0)) + 1
    requirement["updatedAt"] = now
    await set_doc("buyer_requirements", requirement_id, requirement)
    return {"lead": lead, "requirement": requirement}


# ==========================================
# PROVEN BROKER TIER + APPROVAL SLA (B1)
# ==========================================

# B1: approval SLA — configurable 48–72h window (default 72h), versioned.
BROKER_KYC_SLA_DEFAULTS = {"slaHours": 72, "version": 1, "effectiveFrom": "2026-10-01T00:00:00+00:00"}


async def _broker_kyc_sla_hours() -> int:
    config = await get_doc("platform_config", "broker_kyc_sla")
    if config is None:
        config = dict(BROKER_KYC_SLA_DEFAULTS)
        await set_doc("platform_config", "broker_kyc_sla", config)
    try:
        hours = int(config.get("slaHours", 72))
    except (TypeError, ValueError):
        hours = 72
    return min(72, max(48, hours))


@router.get("/trust-tier")
async def broker_trust_tier(ctx: tuple = Depends(_broker_user)):
    """B1: the broker's trust record — KYC case status, the approval SLA clock
    (visible to the broker), and the 'Proven Broker' tier once verified. A
    breached SLA escalates to the admin queue (dedupe-safe)."""
    from app.services import kyc as kyc_service

    user, uid = ctx
    case = await kyc_service.get_case(kyc_service.case_id_for(uid, "broker")) or {}
    now = datetime.now(timezone.utc)
    sla_hours = await _broker_kyc_sla_hours()

    record = {
        "caseId": case.get("caseId"),
        "caseStatus": case.get("status", "missing"),
        "slaHours": sla_hours,
        "slaDeadline": None,
        "slaBreached": False,
        "proven": bool(user.get("brokerProven")),
    }
    submitted_at = case.get("submittedAt")
    if case.get("status") == "pending" and submitted_at:
        try:
            deadline = datetime.fromisoformat(str(submitted_at)) + timedelta(hours=sla_hours)
            if deadline.tzinfo is None:
                deadline = deadline.replace(tzinfo=timezone.utc)
            record["slaDeadline"] = deadline.isoformat()
            if now > deadline:
                record["slaBreached"] = True
                await emit_task(
                    "admin",
                    persona="admin",
                    module="broker",
                    kind="broker_kyc_sla_breach",
                    title_en=f"Broker KYC SLA breached: {user.get('name', uid)}",
                    title_hi=f"ब्रोकर KYC SLA उल्लंघन: {user.get('name', uid)}",
                    subtitle=f"approval pending beyond {sla_hours}h",
                    priority="high",
                    deep_link=f"{DEEP_LINKS['broker']}/trust-tier",
                    source_id=case.get("caseId", uid),
                )
        except ValueError:
            pass
    return record


# ==========================================
# DEAL DISPUTE WORKFLOW (WS-05 step 9)
# ==========================================

# Evidence on a disputed deal is frozen until the dispute resolves.
DISPUTE_SLA_HOURS = 72


@router.post("/deals/{deal_id}/disputes", status_code=201)
async def open_deal_dispute(deal_id: str, body: DealDisputeCreate, ctx: tuple = Depends(_broker_user)):
    """WS-05 step 9: dispute record with category, evidence freeze and an SLA
    timer, wired to the admin queue (console lands in phase-07)."""
    _, uid = ctx
    deal = await get_doc("broker_deals", deal_id)
    if not deal or deal.get("brokerId") != uid:
        _error(404, "DEAL_NOT_FOUND", "Deal not found")
    if deal.get("status") not in ("accepted", "in_transit", "completed"):
        _error(409, "INVALID_STATE", f"cannot dispute a deal in status {deal.get('status')}")
    existing = await query("deal_disputes", [("dealId", "==", deal_id), ("status", "==", "open")], limit=1)
    if existing:
        _error(409, "DISPUTE_ALREADY_OPEN", "an open dispute already exists for this deal")
    now = datetime.now(timezone.utc)
    dispute = {
        "id": f"dsp_{uuid.uuid4().hex[:10]}",
        "dealId": deal_id,
        "category": body.category,
        "reason": body.reason,
        "evidenceFreeze": True,
        "slaHours": DISPUTE_SLA_HOURS,
        "slaDeadline": (now + timedelta(hours=DISPUTE_SLA_HOURS)).isoformat(),
        "status": "open",
        "createdBy": uid,
        "createdAt": now.isoformat(),
    }
    await set_doc("deal_disputes", dispute["id"], dispute)
    deal["evidenceFrozenAt"] = now.isoformat()
    # P0-5: an open dispute pauses the escrow payout release.
    escrow = deal.get("escrow")
    if escrow and escrow.get("status") == "held" and not escrow.get("disputeOpenedAt"):
        escrow["disputeOpenedAt"] = now.isoformat()
        deal["escrow"] = escrow
    deal["updatedAt"] = now.isoformat()
    await set_doc("broker_deals", deal_id, deal)
    await emit_task(
        "admin",
        persona="admin",
        module="broker",
        kind="deal_dispute_opened",
        title_en=f"Deal dispute opened: {deal.get('commodity', '')}",
        title_hi=f"सौदा विवाद खुला: {deal.get('commodity', '')}",
        subtitle=f"{body.category} — {body.reason}",
        priority="high",
        deep_link=f"{DEEP_LINKS['broker']}/deals/{deal_id}",
        source_id=dispute["id"],
    )
    return dispute


@router.get("/deals/{deal_id}/disputes")
async def list_deal_disputes(deal_id: str, ctx: tuple = Depends(_broker_user)):
    _, uid = ctx
    deal = await get_doc("broker_deals", deal_id)
    if not deal or deal.get("brokerId") != uid:
        _error(404, "DEAL_NOT_FOUND", "Deal not found")
    disputes = await query("deal_disputes", [("dealId", "==", deal_id)], limit=50)
    disputes.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return {"data": disputes, "total": len(disputes)}


# ==========================================
# DELIVERY MILESTONES (P1-9, spec F9/B9 + E6)
# ==========================================

MILESTONE_OPEN_STATUSES = ("accepted", "in_transit", "completed")


def _weigh_adjustment(deal: dict, weight_kg: float, at: str, uid: str) -> dict | None:
    """E6: weighbridge divergence beyond tolerance -> a pro-rata adjustment
    proposal on the deal (adjusted payout = weighed qty × agreed rate);
    either party may dispute within 24h."""
    claimed_q = float(deal.get("quantityQuintals") or 0)
    if claimed_q <= 0:
        return None
    claimed_kg = claimed_q * 100.0
    variance_pct = abs(float(weight_kg) - claimed_kg) / claimed_kg * 100.0
    if variance_pct <= WEIGH_TOLERANCE_PCT:
        return None
    rate = float(deal.get("agreedRate") or 0)
    pct = float(deal.get("brokerCommissionPct") or 0)
    weighed_q = float(weight_kg) / 100.0
    adjusted_gross = round(weighed_q * rate, 2)
    adjusted_commission = round(adjusted_gross * pct / 100.0, 2)
    return {
        "kind": "pro_rata_weighbridge",
        "claimedQuantityQuintals": claimed_q,
        "weighedWeightKg": float(weight_kg),
        "weighedQuantityQuintals": round(weighed_q, 3),
        "variancePct": round(variance_pct, 2),
        "tolerancePct": WEIGH_TOLERANCE_PCT,
        "agreedRate": rate,
        "adjustedGrossAmount": adjusted_gross,
        "adjustedCommissionAmount": adjusted_commission,
        "adjustedPayout": round(adjusted_gross - adjusted_commission, 2),
        "status": "proposed",
        "disputeWindowHours": E6_DISPUTE_WINDOW_HOURS,
        "proposedAt": at,
        "proposedBy": uid,
    }


@router.post("/deals/{deal_id}/milestones", status_code=201)
async def add_deal_milestone(deal_id: str, body: MilestoneCreate, ctx: tuple = Depends(_broker_user)):
    """P1-9 (F9/B9): broker-pushed, event-based delivery milestones — no GPS
    telemetry. 'weighed' may carry weightKg; divergence beyond tolerance
    raises the E6 pro-rata adjustment proposal on the deal."""
    _, uid = ctx
    deal = await _load_owned_deal(deal_id, uid)
    if deal.get("status") not in MILESTONE_OPEN_STATUSES:
        _error(
            409,
            "INVALID_STATE",
            f"cannot add milestones to a deal in status {deal.get('status')}",
        )
    at = _parse_iso(body.at) if body.at else None
    if body.at and at is None:
        _error(422, "VALIDATION_ERROR", "at must be an ISO-8601 timestamp", {"at": "invalid timestamp"})
    at = at or datetime.now(timezone.utc)
    now = datetime.now(timezone.utc).isoformat()
    milestone = {
        "id": f"ms_{uuid.uuid4().hex[:10]}",
        "dealId": deal_id,
        "type": body.type,
        "note": body.note,
        "at": at.isoformat(),
        "weightKg": body.weightKg,
        "createdBy": uid,
        "createdAt": now,
    }
    await set_doc("deal_milestones", milestone["id"], milestone)

    if body.type == "delivered":
        deal["deliveredAt"] = at.isoformat()
        escrow = deal.get("escrow")
        if escrow and escrow.get("status") == "held" and not escrow.get("releaseAt"):
            escrow["releaseAt"] = (at + timedelta(hours=ESCROW_RELEASE_WINDOW_HOURS)).isoformat()
            deal["escrow"] = escrow
    if body.type == "weighed" and body.weightKg is not None:
        proposal = _weigh_adjustment(deal, body.weightKg, at.isoformat(), uid)
        if proposal:
            deal["adjustmentProposal"] = proposal
            await _notify(
                deal.get("sellerUid"),
                type="deal_adjustment_proposed",
                title="Weighbridge adjustment / तौल समायोजन",
                body=(
                    f"{deal.get('commodity', '')}: weighed {body.weightKg}kg vs booked "
                    f"{float(deal.get('quantityQuintals', 0)) * 100}kg — pro-rata payout "
                    f"₹{proposal['adjustedPayout']} proposed; dispute within "
                    f"{E6_DISPUTE_WINDOW_HOURS}h to contest"
                ),
                deepLink=f"/dashboard/p/farmer/deals/{deal_id}",
            )
    deal["updatedAt"] = now
    await set_doc("broker_deals", deal_id, deal)
    return milestone


@router.get("/deals/{deal_id}/milestones")
async def list_deal_milestones(deal_id: str, ctx: tuple = Depends(_broker_user)):
    _, uid = ctx
    await _load_owned_deal(deal_id, uid)
    docs = await query("deal_milestones", [("dealId", "==", deal_id)], limit=200)
    docs.sort(key=lambda d: d.get("at", ""))
    return {"data": docs, "total": len(docs)}


# ==========================================
# POST-ACCEPTANCE DEAL CHAT (P1-10, spec D1/B7)
# ==========================================

DEAL_CHAT_OPEN_STATUSES = ("accepted", "in_transit", "completed")


async def ensure_broker_deal_room(deal: dict, broker_user: dict, farmer: dict | None) -> dict | None:
    """P1-10: booking-gated chat room for a broker deal — local copy of the
    room shape from services/chat.py `ensure_transport_room` (kind
    "broker_deal"; parties broker + farmer)."""
    existing = await get_doc("chat_rooms", deal["id"])
    if existing is not None:
        return existing
    farmer_id = deal.get("sellerUid") or (farmer or {}).get("id")
    if not farmer_id:
        return None
    farmer_name = (farmer or {}).get("fullName") or (farmer or {}).get("name") or deal.get("sellerName", "")
    broker_name = (
        broker_user.get("fullName")
        or broker_user.get("vernacularName")
        or deal.get("brokerName", "")
    )
    now = datetime.now(timezone.utc).isoformat()
    room = {
        "id": deal["id"],
        "kind": "broker_deal",
        "dealId": deal["id"],
        "purchaseId": None,
        "farmerId": farmer_id,
        "farmerName": _first_name(farmer_name),
        "buyerId": deal["brokerId"],
        "buyerName": _first_name(broker_name),
        "crop": deal.get("commodity", ""),
        "createdAt": now,
        "lastMessageAt": None,
        "lastMessageText": "",
        "readByFarmer": True,
        "readByBuyer": True,
    }
    await set_doc("chat_rooms", room["id"], room)
    return room


@router.post("/deals/{deal_id}/chat-room", status_code=201)
async def open_deal_chat_room(deal_id: str, ctx: tuple = Depends(_broker_user)):
    """P1-10 (D1): chat unlocks only after the deal is accepted; the room is
    lazily created on first request and idempotent thereafter."""
    user, uid = ctx
    deal = await _load_owned_deal(deal_id, uid)
    if deal.get("status") not in DEAL_CHAT_OPEN_STATUSES:
        _error(409, "CHAT_LOCKED", "chat opens after the deal is accepted")
    farmer = None
    farmer_id = deal.get("sellerUid") or await _find_uid_by_phone(deal.get("sellerPhone", ""))
    if farmer_id:
        farmer = await get_user(farmer_id)
    room = await ensure_broker_deal_room(deal, user, farmer)
    if room is None:
        _error(409, "COUNTERPARTY_MISSING", "the farmer party could not be resolved for this deal")
    return room


# ==========================================
# VEHICLE & PICKUP DETAILS (P1-12, spec B8)
# ==========================================

@router.put("/deals/{deal_id}/vehicle")
async def set_deal_vehicle(deal_id: str, body: VehicleUpdate, ctx: tuple = Depends(_broker_user)):
    """B8: vehicle type, number (stored in full, masked in every deal
    response) and driver name — no driver phone is ever stored or shown."""
    _, uid = ctx
    deal = await _load_owned_deal(deal_id, uid)
    if deal.get("status") not in MILESTONE_OPEN_STATUSES:
        _error(409, "INVALID_STATE", "vehicle details are set once the deal is accepted")
    deal["vehicle"] = {
        "vehicleType": body.vehicleType,
        "vehicleNumber": body.vehicleNumber,
        "driverName": body.driverName,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    deal["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("broker_deals", deal_id, deal)
    return _serialize_deal(deal)


# ==========================================
# E-CONTRACT + RECEIPT DOCUMENTS (P0-6 C5/F6, P2-8 F12)
# ==========================================

def _deal_terms_rows(deal: dict) -> list[list[str]]:
    gross = float(deal.get("grossAmount") or 0)
    commission = float(deal.get("commissionAmount") or 0)
    return [
        ["Deal ID", str(deal.get("id", ""))],
        ["Status", str(deal.get("status", ""))],
        ["Broker", str(deal.get("brokerName", ""))],
        ["Buyer", f"{deal.get('buyerName', '')} ({_mask_phone(deal.get('buyerPhone', ''))})"],
        ["Seller / Farmer", f"{deal.get('sellerName', '')} ({_mask_phone(deal.get('sellerPhone', ''))})"],
        ["Commodity", str(deal.get("commodity", ""))],
        ["Variety", str(deal.get("variety", "") or "-")],
        ["Grade", str(deal.get("grade", ""))],
        ["Quantity", f"{deal.get('quantityQuintals', 0)} quintals"],
        ["Agreed Rate", f"Rs {deal.get('agreedRate', 0)}/quintal"],
        ["Gross Amount", f"Rs {gross}"],
        ["Commission", f"{deal.get('brokerCommissionPct', 0)}% = Rs {commission}"],
        ["Farmer Payout", f"Rs {round(gross - commission, 2)}"],
        ["Payment Terms", str(deal.get("paymentTerms", ""))],
        ["Delivery Location", str(deal.get("deliveryLocation", "") or "-")],
    ]


def _deal_integrity_hash(deal: dict, acceptances: list[dict]) -> str:
    """P0-6: SHA-256 over the canonical deal terms + acceptance log — printed
    on the contract so any later tampering is detectable."""
    payload = json.dumps(
        {
            "dealId": deal.get("id"),
            "commodity": deal.get("commodity"),
            "quantityQuintals": deal.get("quantityQuintals"),
            "agreedRate": deal.get("agreedRate"),
            "grossAmount": deal.get("grossAmount"),
            "commissionAmount": deal.get("commissionAmount"),
            "paymentTerms": deal.get("paymentTerms"),
            "status": deal.get("status"),
            "acceptances": [
                {
                    "userId": a.get("userId"),
                    "signatureData": a.get("signatureData"),
                    "consentTimestamp": a.get("consentTimestamp"),
                    "acceptedAt": a.get("acceptedAt"),
                }
                for a in acceptances
            ],
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(payload.encode()).hexdigest()


def _deal_pdf_bytes(
    title: str,
    subtitle: str,
    sections: list[tuple[str, list[list[str]]]],
    footer_lines: list[str],
) -> bytes:
    from io import BytesIO

    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import (
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    buffer = BytesIO()
    styles = getSampleStyleSheet()
    story = [
        Paragraph(title, styles["Title"]),
        Paragraph(subtitle, styles["Normal"]),
        Spacer(1, 12),
    ]
    for heading, rows in sections:
        story.append(Paragraph(heading, styles["Heading2"]))
        table = Table(rows, colWidths=[150, 320])
        table.setStyle(
            TableStyle(
                [
                    ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ]
            )
        )
        story.append(table)
        story.append(Spacer(1, 10))
    for line in footer_lines:
        story.append(Paragraph(line, styles["Normal"]))
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    doc.build(story)
    return buffer.getvalue()


@router.get("/deals/{deal_id}/contract")
async def deal_contract_pdf(party: tuple = Depends(_deal_party)):
    """P0-6 (C5/F6): the e-contract document — the deal terms, the digital
    acceptance log (acceptances subcollection) and a SHA-256 integrity hash.
    Accessible to both deal parties."""
    deal, deal_id = party
    acceptances = await query(f"broker_deals/{deal_id}/acceptances", [], limit=50)
    acceptances.sort(key=lambda a: a.get("acceptedAt", ""))
    generated_at = datetime.now(timezone.utc).isoformat()
    digest = _deal_integrity_hash(deal, acceptances)
    acceptance_rows = [["Party", "Accepted At", "Consent Timestamp", "Signature"]]
    for acceptance in acceptances:
        acceptance_rows.append(
            [
                str(acceptance.get("userId", "")),
                str(acceptance.get("acceptedAt", "")),
                str(acceptance.get("consentTimestamp", "") or "-"),
                "recorded" if acceptance.get("signatureData") else "-",
            ]
        )
    if len(acceptance_rows) == 1:
        acceptance_rows.append(["-", "awaiting acceptance", "-", "-"])
    pdf = _deal_pdf_bytes(
        "AgroverCity — Broker Deal E-Contract",
        f"Deal {deal_id} · Generated {generated_at}",
        [
            ("Deal Terms", _deal_terms_rows(deal)),
            ("Digital Acceptance Log", acceptance_rows),
        ],
        [
            f"Integrity hash (SHA-256): {digest}",
            "This e-contract is binding once accepted in-app (MPIN e-sign). "
            "Post-booking price changes are not permitted; deductions only via "
            "dispute ruling (spec C3/E8).",
        ],
    )
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="deal_{deal_id}_contract.pdf"'},
    )


@router.get("/deals/{deal_id}/receipt")
async def deal_receipt_pdf(party: tuple = Depends(_deal_party)):
    """P2-8 (F12): downloadable deal receipt — amounts, commission and payout
    for the farmer, with the payment/escrow state. Accessible to deal parties."""
    deal, deal_id = party
    capture = deal.get("paymentCapture") or {}
    escrow = deal.get("escrow") or {}
    gross = float(deal.get("grossAmount") or 0)
    commission = float(deal.get("commissionAmount") or 0)
    adjustment = deal.get("adjustmentProposal") or {}
    payout = round(gross - commission, 2)
    if adjustment.get("status") == "proposed":
        payout = float(adjustment.get("adjustedPayout") or payout)
    rows = _deal_terms_rows(deal) + [
        ["Delivered At", str(deal.get("deliveredAt", "") or "-")],
        ["Payment Reference", str(capture.get("razorpayRef", "") or "-")],
        ["Escrow Status", str(escrow.get("status", "not held"))],
    ]
    if adjustment.get("status") == "proposed":
        rows.append(
            [
                "Weighbridge Adjustment",
                f"weighed {adjustment.get('weighedWeightKg')}kg "
                f"({adjustment.get('variancePct')}% off) — payout ₹{payout}",
            ]
        )
    rows.append(["Payout To Farmer", f"Rs {payout}"])
    generated_at = datetime.now(timezone.utc).isoformat()
    pdf = _deal_pdf_bytes(
        "AgroverCity — Deal Receipt",
        f"Receipt for deal {deal_id} · Generated {generated_at}",
        [("Receipt Details", rows)],
        [
            "Payout is released after delivery confirmation + the escrow "
            "silent window, net of platform commission (spec B12/E7).",
        ],
    )
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="deal_{deal_id}_receipt.pdf"'},
    )


# ==========================================
# BROKER DASHBOARD SUMMARY (WS-05 step 10)
# ==========================================

@router.get("/dashboard")
async def broker_dashboard(ctx: tuple = Depends(_broker_user)):
    """Home-screen summary: pipeline by stage, new leads, offers awaiting
    response with TTL countdown, deals needing evidence, commission
    earned/pending/paid (integer paisa), and network size."""
    _, uid = ctx
    now = datetime.now(timezone.utc)
    deals = await query("broker_deals", [("brokerId", "==", uid)], limit=1000)
    active = [d for d in deals if d.get("status") not in ("cancelled", "expired", "completed")]

    pipeline: dict[str, int] = {}
    for d in active:
        pipeline[d["status"]] = pipeline.get(d["status"], 0) + 1

    awaiting = []
    for d in deals:
        if d.get("status") != "negotiating" or not d.get("expiresAt"):
            continue
        try:
            due = datetime.fromisoformat(str(d["expiresAt"]))
            if due.tzinfo is None:
                due = due.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
        awaiting.append({
            "dealId": d["id"],
            "commodity": d.get("commodity"),
            "ttlHoursLeft": round(max(0.0, (due - now).total_seconds()) / 3600, 1),
            "expired": due <= now,
        })
    awaiting.sort(key=lambda a: a["ttlHoursLeft"])

    leads = await query("broker_leads", [("brokerId", "==", uid)], limit=1000)
    new_leads = sum(1 for l in leads if l.get("status") == "active")
    network_farmers = len({d.get("sellerPhone") for d in deals if d.get("sellerPhone")})
    network_buyers = len({d.get("buyerPhone") for d in deals if d.get("buyerPhone")})

    completed = [d for d in deals if d.get("status") == "completed"]
    earned_paisa = sum(int(round(float(d.get("commissionAmount", 0) or 0) * 100)) for d in completed)
    settlements = await query("settlements", [("role", "==", "broker"), ("entityId", "==", uid)], limit=100)
    paid_paisa = sum(
        int(round(float(s.get("netRupees", 0) or 0) * 100))
        for s in settlements if s.get("status") == "paid"
    )
    pending_paisa = sum(
        int(round(float(s.get("netRupees", 0) or 0) * 100))
        for s in settlements if s.get("status") == "pending"
    )

    return {
        "pipeline": pipeline,
        "activeDeals": len(active),
        "newLeads": new_leads,
        "offersAwaiting": {"count": len(awaiting), "data": awaiting[:10]},
        "dealsNeedingEvidence": sum(
            1 for d in deals
            if d.get("status") in ("accepted", "in_transit") and not (d.get("evidence") or [])
        ),
        "commission": {
            "earnedPaisa": earned_paisa,
            "pendingPaisa": pending_paisa,
            "paidPaisa": paid_paisa,
        },
        "network": {"farmers": network_farmers, "buyers": network_buyers},
    }


# ==========================================
# DEAL MESSAGE MODERATION (WS-05 step 17, rule 4)
# ==========================================

import re  # noqa: E402

MODERATION_PATTERNS = [
    ("phone", re.compile(r"(\+?91[\s-]?)?[6-9]\d{9}")),
    ("upi_id", re.compile(r"[a-zA-Z0-9._-]{2,}@(upi|ybl|okhdfcbank|okicici|oksbi|paytm|phonepe)", re.I)),
    ("external_link", re.compile(r"(https?://|www\.)", re.I)),
]
MODERATION_STRIKE_LIMIT = 3


async def moderate_deal_text(text: str, uid: str):
    """Server-side moderation for deal messages (rule 4): phone numbers, UPI
    IDs and external links are rejected and strike-laddered per sender."""
    if not text:
        return
    hits = [label for label, pattern in MODERATION_PATTERNS if pattern.search(text)]
    if not hits:
        return
    user = await get_user(uid) or {}
    strikes = int(user.get("moderationStrikes", 0)) + 1
    user["moderationStrikes"] = strikes
    await set_doc("users", uid, user)
    if strikes >= MODERATION_STRIKE_LIMIT:
        user["messagingRestricted"] = True
        await set_doc("users", uid, user)
        _error(
            429,
            "MESSAGING_RESTRICTED",
            f"messaging restricted after {MODERATION_STRIKE_LIMIT} strikes — contact support",
        )
    _error(
        422,
        "MESSAGE_BLOCKED",
        "phone numbers, UPI IDs and external links are not allowed in deal chat",
        {"text": f"blocked: {', '.join(hits)}", "strikes": strikes},
    )
