import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.broker import (
    DealCancelRequest,
    DealCreate,
    DealUpdate,
    DealMessageCreate,
    EvidenceKind,
    LeadCreate,
    LeadUpdate,
)
from app.routers.users import require_role
from app.services import storage
from app.services.notify import notify_user
from app.services.users import get_user

router = APIRouter(prefix="/broker", tags=["broker"])

MAX_EVIDENCE_PER_DEAL = 20


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
async def create_deal(body: DealCreate, ctx: tuple = Depends(_broker_user)):
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
    await _notify(
        seller_uid,
        type="deal_offer_received",
        title="New offer / नया ऑफर",
        body=(
            f"{doc['brokerName']} offered ₹{body.agreedRate}/quintal for "
            f"{body.quantityQuintals}q {body.commodity}"
        ),
        path=f"/dashboard/p/farmer/deals/{deal_id}",
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
                path=f"/dashboard/p/farmer/deals/{deal_id}",
            )
        elif new_status == "in_transit":
            await _notify(
                doc.get("sellerUid"),
                type="deal_in_transit",
                title="Pickup done / गाड़ी रवाना",
                body=f"{commodity} — pickup completed, goods in transit",
                path=f"/dashboard/p/farmer/deals/{deal_id}",
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
                path=f"/dashboard/p/farmer/deals/{deal_id}",
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


@router.post("/deals/{deal_id}/messages", status_code=201)
async def send_deal_message(deal_id: str, body: DealMessageCreate, ctx: tuple = Depends(_broker_user)):
    user, uid = ctx
    deal = await get_doc("broker_deals", deal_id)
    if not deal or deal.get("brokerId") != uid:
        _error(404, "DEAL_NOT_FOUND", "Deal not found")
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
