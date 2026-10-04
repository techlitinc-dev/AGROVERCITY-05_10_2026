import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.broker import DealMessageCreate, EvidenceKind, RespondRequest
from app.routers.broker import MAX_EVIDENCE_PER_DEAL, _last10
from app.routers.users import require_role
from app.services import storage
from app.services.notify import notify_user
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
    return bool(target) and target == _last10(deal.get("sellerPhone", ""))


async def _load_deal(user: dict, deal_id: str) -> dict:
    doc = await get_doc("broker_deals", deal_id)
    if not doc or not _matches(user, doc):
        _error(404, "DEAL_NOT_FOUND", "Deal not found")
    return doc


async def _notify(uid: str | None, *, type: str, title: str, body: str, path: str | None = None):
    if not uid:
        return
    try:
        await notify_user(uid, type=type, title=title, body=body, path=path)
    except Exception:
        pass  # notifications are best-effort — never break the deal flow


@router.get("/deals")
async def list_deals(
    status: str | None = None,
    page: int = 1,
    pageSize: int = 20,
    ctx: tuple = Depends(_farmer_user),
):
    user, _ = ctx
    docs = await query("broker_deals", [], limit=1000)
    docs = [d for d in docs if _matches(user, d)]

    if status:
        docs = [d for d in docs if d.get("status") == status]
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    total = len(docs)
    start = (page - 1) * pageSize
    return {"data": docs[start:start + pageSize], "page": page, "pageSize": pageSize, "total": total}


@router.get("/deals/{deal_id}")
async def get_deal(deal_id: str, ctx: tuple = Depends(_farmer_user)):
    user, _ = ctx
    return await _load_deal(user, deal_id)


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
        body_text = f"Counter-offer ₹{body.amountOffer}/quintal for {deal.get('commodity', '')}".strip()
    else:
        body_text = f"New message on {deal.get('commodity', 'deal')} — {body.text[:80]}"
    await _notify(
        deal.get("brokerId"),
        type="deal_counter_offer",
        title="Counter-offer / काउंटर ऑफर",
        body=body_text,
        path=DEAL_PATH.format(deal_id),
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
        doc["status"] = "accepted"
        if not doc.get("sellerUid"):
            doc["sellerUid"] = uid
    else:
        if current_status not in ("negotiating", "contract_issued"):
            _error(409, "INVALID_STATE", f"cannot decline a deal in status {current_status}")
        doc["status"] = "cancelled"
        doc["cancelReason"] = body.reason

    doc["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("broker_deals", deal_id, doc)

    if body.action == "accept":
        await _notify(
            doc.get("brokerId"),
            type="deal_accepted",
            title="Farmer accepted / किसान ने स्वीकारा",
            body=f"{doc.get('commodity', '')} — {doc.get('quantityQuintals', 0)}q @ ₹{doc.get('agreedRate', 0)}/quintal",
            path=DEAL_PATH.format(deal_id),
        )
    return doc


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
