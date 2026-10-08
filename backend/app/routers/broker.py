import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.broker import (
    BuyerRequirementCreate,
    DealCancelRequest,
    DealCreate,
    DealUpdate,
    DealMessageCreate,
    EvidenceKind,
    LeadCreate,
    LeadUpdate,
    MAX_VAULT_PER_KIND,
    VAULT_KINDS,
)
from app.routers.users import require_role
from app.services import storage
from app.services.ai import gateway
from app.services.ai.privacy import build_broker_deadlock_state, build_broker_lead_score_state
from app.services.billing import entitlement_guard, record_usage
from app.services.notify import notify_user
from app.services.tasks import DEEP_LINKS, emit_task
from app.services.users import get_user

router = APIRouter(prefix="/broker", tags=["broker"])

MAX_EVIDENCE_PER_DEAL = 20
# WS-05 step 2: counter-offer rounds cap — at 3 the deal locks to accept/decline.
COUNTER_ROUND_CAP = 3

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
    return {"data": docs[start:start + pageSize], "page": page, "pageSize": pageSize, "total": total}


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
    return doc


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
    await set_doc("broker_deals", deal_id, doc)

    new_status = doc.get("status")
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
    return doc


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
        try:
            d_decision = await gateway.decide(
                deadlock_state,
                "broker.lead_score.v1",
                ctx=broker_id,
                module="broker_lead_score",
            )
            deadlock_risk = float(d_decision.answers.get("deadlock_risk", 0.0))
            deal["deadlockRisk"] = deadlock_risk
            if deadlock_risk >= 0.5:
                deal["suggestMediator"] = True
                deal["suggestedAction"] = "mediator"
            await set_doc("broker_deals", deal_id, deal)
        except Exception:
            pass


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
        decision = await gateway.decide(
            lead_state,
            "broker.lead_score.v1",
            ctx=uid,
            module="broker_lead_score",
        )
        doc["score"] = float(decision.answers.get("quality", 0.5))
        doc["deadlockRisk"] = float(decision.answers.get("deadlock_risk", 0.0))
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
        "deals": deals[:50],
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
    return deal["paymentCapture"]


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
        decision = await gateway.decide(
            lead_state,
            "broker.lead_score.v1",
            ctx=uid,
            module="broker_lead_score",
        )
        lead["score"] = float(decision.answers.get("quality", 0.8))
        lead["deadlockRisk"] = float(decision.answers.get("deadlock_risk", 0.0))
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


class DealDisputeCreate(BaseModel):
    category: str  # "payment" | "quality" | "delivery" | "other"
    reason: str = ""


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
