import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.core.security import verify_mpin
from app.models.broker import DealDisputeCreate, DealMessageCreate, EvidenceKind, RespondRequest
from app.routers.broker import (
    DISPUTE_SLA_HOURS,
    MAX_EVIDENCE_PER_DEAL,
    _last10,
    _serialize_deal,
)
from app.routers.users import require_role
from app.services import blocks, storage
from app.services.disputes import ingest_dispute
from app.services.notify import notify_user
from app.services.tasks import DEEP_LINKS, emit_task
from app.services.users import get_user

router = APIRouter(prefix="/farmer", tags=["farmer"])

DEAL_PATH = "/dashboard/p/broker/deals/{}"


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def _farmer_user(uid: str = Depends(current_user_id)) -> tuple[dict, str]:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer")
    return user, uid


def _matches(user: dict, deal: dict) -> bool:
    target = _last10(user.get("phone", ""))
    phone_match = bool(target) and target == _last10(deal.get("sellerPhone", ""))
    id_match = bool(deal.get("farmerId")) and deal.get("farmerId") == user.get("id")
    return phone_match or id_match


async def _load_deal(user: dict, deal_id: str) -> dict:
    doc = await get_doc("broker_deals", deal_id)
    if not doc or not _matches(user, doc):
        _error(404, "DEAL_NOT_FOUND", "Deal not found")
    return doc


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
    ctx: tuple = Depends(_farmer_user),
):
    user, uid = ctx
    docs = await query("broker_deals", [], limit=1000)
    docs = [d for d in docs if _matches(user, d)]
    # WS-03 task 3.3 — hide deals whose broker has a block relationship with the viewer.
    hidden = await blocks.hidden_ids(uid)
    if hidden:
        docs = [d for d in docs if d.get("brokerId") not in hidden]

    if status:
        docs = [d for d in docs if d.get("status") == status]
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    total = len(docs)
    start = (page - 1) * pageSize
    return {"data": [_serialize_deal(d) for d in docs[start:start + pageSize]], "page": page, "pageSize": pageSize, "total": total}


@router.get("/deals/{deal_id}")
async def get_deal(deal_id: str, ctx: tuple = Depends(_farmer_user)):
    user, _ = ctx
    return _serialize_deal(await _load_deal(user, deal_id))


@router.get("/deals/{deal_id}/messages")
async def get_deal_messages(deal_id: str, ctx: tuple = Depends(_farmer_user)):
    user, _ = ctx
    await _load_deal(user, deal_id)
    docs = await query("deal_messages", [("dealId", "==", deal_id)], limit=500)
    docs.sort(key=lambda d: d.get("createdAt", ""))
    return {"data": docs}


@router.post("/deals/{deal_id}/messages", status_code=201)
async def send_deal_message(deal_id: str, body: DealMessageCreate, ctx: tuple = Depends(_farmer_user)):
    user, uid = ctx
    deal = await _load_deal(user, deal_id)
    from app.routers.broker import moderate_deal_text

    await moderate_deal_text(body.text, uid)
    if body.amountOffer is not None:
        from app.routers.broker import _assert_counter_round_available

        await _assert_counter_round_available(deal_id)
    msg_id = f"msg_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    sender_name = user.get("fullName") or user.get("vernacularName") or user.get("name", "Farmer")

    doc = {
        "id": msg_id,
        "dealId": deal_id,
        "senderId": uid,
        "senderRole": "seller",
        "senderName": sender_name,
        "text": body.text,
        "amountOffer": body.amountOffer,
        "createdAt": now,
    }
    await set_doc("deal_messages", msg_id, doc)
    if body.amountOffer is not None:
        from app.routers.broker import _evaluate_round_two_deadlock
        await _evaluate_round_two_deadlock(deal_id, deal, body.amountOffer, deal.get("brokerId"))
        body_text = f"Counter-offer ₹{body.amountOffer}/quintal for {deal.get('commodity', '')}".strip()
    else:
        body_text = f"New message on {deal.get('commodity', 'deal')} — {body.text[:80]}"
    await _notify(
        deal.get("brokerId"),
        type="deal_counter_offer",
        title="Counter-offer / काउंटर ऑफर",
        body=body_text,
        deepLink=DEAL_PATH.format(deal_id),
    )
    return doc


@router.post("/deals/{deal_id}/respond")
async def respond_to_deal(deal_id: str, body: RespondRequest, ctx: tuple = Depends(_farmer_user)):
    user, uid = ctx
    doc = await _load_deal(user, deal_id)

    current_status = doc.get("status")
    if body.action == "accept":
        if current_status != "contract_issued":
            _error(409, "INVALID_STATE", f"cannot accept a deal in status {current_status}")
        # P0-6 (C5/F6): MPIN e-sign. The gate applies only when this farmer has
        # an MPIN on file — farmers without an MPIN accept with a recorded
        # consentTimestamp instead (their account has nothing to verify against).
        if user.get("mpinHash"):
            if not body.mpin:
                _error(401, "WRONG_MPIN", "mpin is required to accept this contract")
            if not verify_mpin(body.mpin, user["mpinHash"]):
                _error(401, "WRONG_MPIN", "incorrect MPIN")
        doc["status"] = "accepted"
        if not doc.get("sellerUid"):
            doc["sellerUid"] = uid
    else:
        if current_status not in ("negotiating", "contract_issued"):
            _error(409, "INVALID_STATE", f"cannot decline a deal in status {current_status}")
        doc["status"] = "cancelled"
        doc["cancelReason"] = body.reason

    now = datetime.now(timezone.utc).isoformat()
    if body.action == "accept":
        # E-sign convention: the acceptance subdoc is the audit trail surfaced
        # in the contract PDF (GET /v1/broker/deals/{id}/contract).
        await set_doc(
            f"broker_deals/{deal_id}/acceptances",
            uid,
            {
                "userId": uid,
                "signatureData": body.signatureData or "",
                "consentTimestamp": body.consentTimestamp or now,
                "acceptedAt": now,
            },
        )
    doc["updatedAt"] = now
    await set_doc("broker_deals", deal_id, doc)

    if body.action == "accept":
        await _notify(
            doc.get("brokerId"),
            type="deal_accepted",
            title="Farmer accepted / किसान ने स्वीकारा",
            body=f"{doc.get('commodity', '')} — {doc.get('quantityQuintals', 0)}q @ ₹{doc.get('agreedRate', 0)}/quintal",
            deepLink=DEAL_PATH.format(deal_id),
        )
    return _serialize_deal(doc)


class DealAcceptIn(BaseModel):
    mpin: str | None = None
    signatureData: str | None = None
    consentTimestamp: str | None = None


@router.post("/deals/{deal_id}/accept")
async def accept_deal(
    deal_id: str,
    body: DealAcceptIn = DealAcceptIn(),
    ctx: tuple = Depends(_farmer_user),
):
    """P0-6: Farmer e-signs and accepts the broker deal contract with MPIN."""
    req = RespondRequest(
        action="accept",
        mpin=body.mpin,
        signatureData=body.signatureData,
        consentTimestamp=body.consentTimestamp,
    )
    return await respond_to_deal(deal_id, req, ctx)


@router.post("/deals/{deal_id}/evidence", status_code=201)
async def upload_deal_evidence(
    deal_id: str,
    file: UploadFile,
    kind: EvidenceKind = Form("photo"),
    ctx: tuple = Depends(_farmer_user),
):
    user, uid = ctx
    deal = await _load_deal(user, deal_id)
    evidence = list(deal.get("evidence") or [])
    if len(evidence) >= MAX_EVIDENCE_PER_DEAL:
        _error(409, "EVIDENCE_LIMIT_REACHED", f"maximum {MAX_EVIDENCE_PER_DEAL} evidence files per deal")
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


@router.get("/deals/{deal_id}/vault")
async def view_deal_vault(deal_id: str, ctx: tuple = Depends(_farmer_user)):
    """B4: farmer-side view of the typed vault — same post-acceptance gate."""
    from app.models.broker import VAULT_KINDS
    from app.routers.broker import VAULT_OPEN_STATUSES

    _, uid = ctx
    deal = await _load_deal_user(deal_id, uid)
    if deal.get("status") not in VAULT_OPEN_STATUSES:
        _error(409, "VAULT_LOCKED", "the document vault opens once the deal is accepted")
    evidence = [e for e in (deal.get("evidence") or []) if e.get("kind") in VAULT_KINDS]
    return {"dealId": deal_id, "status": deal.get("status"), "data": evidence, "total": len(evidence)}


async def _load_deal_user(deal_id: str, uid: str) -> dict:
    doc = await _load_deal(await get_user(uid) or {}, deal_id)
    return doc


# ==========================================
# DELIVERY TRACKING VIEW (P1-9, spec F9)
# ==========================================

@router.get("/deals/{deal_id}/milestones")
async def list_deal_milestones(deal_id: str, ctx: tuple = Depends(_farmer_user)):
    """F9: the farmer's read view of the broker-pushed delivery milestones."""
    user, _ = ctx
    await _load_deal(user, deal_id)
    docs = await query("deal_milestones", [("dealId", "==", deal_id)], limit=200)
    docs.sort(key=lambda d: d.get("at", ""))
    return {"data": docs, "total": len(docs)}


# ==========================================
# FARMER-SIDE DEAL DISPUTE (P1-11, spec C9)
# ==========================================

@router.post("/deals/{deal_id}/disputes", status_code=201)
async def open_farmer_deal_dispute(
    deal_id: str, body: DealDisputeCreate, ctx: tuple = Depends(_farmer_user)
):
    """C9 "user opens dispute (farmer or broker)": the farmer side. Mirrors the
    broker flow — canonical disputes triage, evidence freeze, SLA — and pauses
    the escrow payout release (P0-5) until the dispute resolves."""
    user, uid = ctx
    deal = await _load_deal(user, deal_id)
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
    await ingest_dispute(
        "broker_deal",
        deal_id,
        {
            "summary": f"{body.category}: {body.reason}",
            "evidence": {"category": body.category, "dealId": deal_id, "openedBy": uid},
        },
    )
    deal["evidenceFrozenAt"] = now.isoformat()
    # P0-5: an open dispute pauses the escrow payout release.
    escrow = deal.get("escrow")
    if escrow and escrow.get("status") == "held" and not escrow.get("disputeOpenedAt"):
        escrow["disputeOpenedAt"] = now.isoformat()
        deal["escrow"] = escrow
    deal["updatedAt"] = now.isoformat()
    await set_doc("broker_deals", deal_id, deal)

    await _notify(
        deal.get("brokerId"),
        type="deal_dispute_opened",
        title="Dispute opened / विवाद खुला",
        body=f"{body.category} — {body.reason}",
        deepLink=DEAL_PATH.format(deal_id),
    )
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
