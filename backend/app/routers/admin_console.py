"""Phase-07 admin console — P2 commercial, P3 agronomy, P4 financial and P5
ecosystem module endpoints (WS-03..WS-06).

Every mutation enforces `X-Audit-Reason` + `X-Admin-Role` (via
`admin_mutation_context`), is RBAC-gated with `require_admin_role`, and writes
an immutable `audit_logs` entry. Money is integer paisa throughout; amounts over
the thresholds route through maker-checker (`approvals.maybe_require_approval`).
"""
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.db import get_doc, query, set_doc
from app.services import approvals
from app.services import disputes as disputes_service
from app.services.admin_auth import (
    admin_mutation_context,
    require_admin_role,
)
from app.services.audit import log_admin_action
from app.services.users import get_user

router = APIRouter(prefix="/admin", tags=["admin-console"])

MANDI_BAND = 0.15
SETTLEMENT_DUAL_SIGNOFF_PAISE = 5_000_000  # ₹50,000
DEFAULT_COMMISSIONS = {
    "transporterPct": 10,
    "equipmentPct": 12,
    "brokerPct": 2,
}


def _err(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code, detail={"code": code, "message": message, "fieldErrors": {}}
    )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _paginate(docs: list[dict], page: int, page_size: int) -> dict:
    start = (page - 1) * page_size
    return {"data": docs[start : start + page_size], "total": len(docs), "page": page, "pageSize": page_size}


def _sorted(docs: list[dict], field: str = "createdAt") -> list[dict]:
    return sorted(docs, key=lambda d: d.get(field) or "", reverse=True)


# ===========================================================================
# WS-03 — P2 commercial
# ===========================================================================
@router.get("/mandi/rates")
async def list_mandi_rates(
    status: str = Query("pending"),
    user: dict = Depends(require_admin_role("superadmin", "operations_lead", "finance_admin")),
):
    filters = [("status", "==", status)] if status and status != "all" else None
    rows = await query("vyapari_rates", filters, limit=2000)
    out = []
    for row in _sorted(rows):
        modal = row.get("modalPrice") or row.get("agmarknetModal")
        rate = row.get("rate")
        out_of_band = False
        if modal and rate:
            try:
                out_of_band = not (float(modal) * (1 - MANDI_BAND) <= float(rate) <= float(modal) * (1 + MANDI_BAND))
            except (TypeError, ValueError):
                out_of_band = False
        out.append({**row, "modalPrice": modal, "outOfBand": out_of_band})
    return {"data": out, "total": len(out)}


async def _mandi_decide(rate_id: str, status: str, reason: str, ctx: dict) -> dict:
    row = await get_doc("vyapari_rates", rate_id)
    if row is None:
        _err(404, "NOT_FOUND", "rate not found")
    previous = {"status": row.get("status")}
    row["status"] = status
    row["reviewReason"] = reason
    await set_doc("vyapari_rates", rate_id, row)
    await log_admin_action(ctx["admin"], "mandi", f"rate.{status}", rate_id, previous, {"status": status}, ctx["reason"], ctx["ip"])
    return {"success": True, "id": rate_id, "status": status}


class ReasonBody(BaseModel):
    reason: Optional[str] = None


@router.post("/mandi/rates/{rate_id}/approve")
async def approve_mandi_rate(
    rate_id: str,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "operations_lead", "finance_admin")),
):
    return await _mandi_decide(rate_id, "approved", ctx["reason"], ctx)


@router.post("/mandi/rates/{rate_id}/reject")
async def reject_mandi_rate(
    rate_id: str,
    body: ReasonBody,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "operations_lead", "finance_admin")),
):
    if not (body.reason or "").strip():
        _err(422, "VALIDATION_ERROR", "a rejection reason is required")
    return await _mandi_decide(rate_id, "rejected", body.reason or ctx["reason"], ctx)


@router.get("/lots")
async def list_lots(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_admin_role("superadmin", "operations_lead", "finance_admin")),
):
    docs = await query("market_lots", None, limit=2000)
    if status:
        docs = [d for d in docs if d.get("status") == status]
    return _paginate(_sorted(docs), page, pageSize)


@router.get("/deals")
async def list_deals(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_admin_role("superadmin", "operations_lead", "finance_admin")),
):
    deals = await query("deals", None, limit=2000)
    procurements = await query("procurements", None, limit=2000)
    docs = deals + procurements
    if status:
        docs = [d for d in docs if d.get("status") == status]
    return _paginate(_sorted(docs), page, pageSize)


@router.post("/deals/{deal_id}/escalate")
async def escalate_deal(
    deal_id: str,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "operations_lead", "finance_admin")),
):
    dispute = await disputes_service.ingest_purchase_dispute(deal_id, {"summary": "deal escalated to dispute"})
    await log_admin_action(ctx["admin"], "lots", "escalate", deal_id, None, dispute, ctx["reason"], ctx["ip"])
    return {"success": True, "dispute": dispute}


@router.get("/orders")
async def list_orders(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_admin_role("superadmin", "operations_lead", "finance_admin")),
):
    docs = await query("orders", None, limit=2000)
    if status:
        docs = [d for d in docs if d.get("status") == status]
    if search:
        needle = search.lower()
        docs = [d for d in docs if needle in str(d.get("id", "")).lower() or needle in str(d.get("userId", "")).lower()]
    return _paginate(_sorted(docs), page, pageSize)


class RefundIn(BaseModel):
    amountPaise: int = Field(..., ge=0, description="integer paisa")


@router.post("/orders/{order_id}/refund")
async def refund_order(
    order_id: str,
    body: RefundIn,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "finance_admin")),
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
):
    idem_id = f"refund_{idempotency_key}"
    existing = await get_doc("idempotency_keys", idem_id)
    if existing is not None:
        return existing["result"]
    if body.amountPaise > approvals.MAKER_CHECKER_THRESHOLD_PAISE:
        pending = await approvals.maybe_require_approval(
            ctx["admin"], "orders", "refund", {"amountPaise": body.amountPaise, "targetId": order_id}, ctx["reason"]
        )
        if pending is not None:
            result = {"success": True, "requiresApproval": True, "approval": pending}
            await set_doc("idempotency_keys", idem_id, {"result": result})
            return result
    result = {"success": True, "orderId": order_id, "refundedPaise": body.amountPaise, "status": "refunded"}
    await set_doc("idempotency_keys", idem_id, {"result": result})
    await log_admin_action(ctx["admin"], "orders", "refund", order_id, None, result, ctx["reason"], ctx["ip"])
    return result


@router.get("/buyers")
async def list_buyers(
    status: str = Query("pending"),
    user: dict = Depends(require_admin_role("superadmin", "operations_lead")),
):
    filters = [("status", "==", status)] if status and status != "all" else None
    return {"data": _sorted(await query("buyer_contracts", filters, limit=1000))}


async def _buyer_decide(buyer_id: str, status: str, ctx: dict) -> dict:
    doc = await get_doc("buyer_contracts", buyer_id)
    if doc is None:
        _err(404, "NOT_FOUND", "buyer not found")
    previous = {"status": doc.get("status")}
    doc["status"] = status
    await set_doc("buyer_contracts", buyer_id, doc)
    await log_admin_action(ctx["admin"], "buyers", f"buyer.{status}", buyer_id, previous, {"status": status}, ctx["reason"], ctx["ip"])
    return {"success": True, "id": buyer_id, "status": status}


@router.post("/buyers/{buyer_id}/verify")
async def verify_buyer(
    buyer_id: str,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "operations_lead")),
):
    return await _buyer_decide(buyer_id, "verified", ctx)


@router.post("/buyers/{buyer_id}/suspend")
async def suspend_buyer(
    buyer_id: str,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "operations_lead")),
):
    return await _buyer_decide(buyer_id, "suspended", ctx)


@router.get("/transport/vehicles")
async def list_vehicles(
    status: str = Query("pending"),
    user: dict = Depends(require_admin_role("superadmin", "operations_lead")),
):
    filters = [("status", "==", status)] if status and status != "all" else None
    return {"data": _sorted(await query("vehicles", filters, limit=1000))}


@router.post("/transport/vehicles/{vehicle_id}/verify")
async def verify_vehicle(
    vehicle_id: str,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "operations_lead")),
):
    doc = await get_doc("vehicles", vehicle_id)
    if doc is None:
        _err(404, "NOT_FOUND", "vehicle not found")
    previous = {"status": doc.get("status")}
    doc["status"] = "verified"
    await set_doc("vehicles", vehicle_id, doc)
    await log_admin_action(ctx["admin"], "transport", "vehicle.verified", vehicle_id, previous, {"status": "verified"}, ctx["reason"], ctx["ip"])
    return {"success": True, "id": vehicle_id, "status": "verified"}


@router.post("/transport/transporters/{transporter_id}/suspend")
async def suspend_transporter(
    transporter_id: str,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "operations_lead")),
):
    doc = await get_user(transporter_id)
    if doc is None:
        _err(404, "NOT_FOUND", "transporter not found")
    previous = {"status": doc.get("status")}
    doc["status"] = "suspended"
    await set_doc("users", transporter_id, doc)
    await log_admin_action(ctx["admin"], "transport", "transporter.suspended", transporter_id, previous, {"status": "suspended"}, ctx["reason"], ctx["ip"])
    return {"success": True, "id": transporter_id, "status": "suspended"}


@router.get("/equipment")
async def list_equipment(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_admin_role("superadmin", "operations_lead")),
):
    docs = await query("equipment", None, limit=2000)
    if status:
        docs = [d for d in docs if d.get("status") == status]
    return _paginate(_sorted(docs), page, pageSize)


@router.post("/equipment/bookings/{booking_id}/escalate")
async def escalate_equipment_booking(
    booking_id: str,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "operations_lead")),
):
    dispute = await disputes_service.ingest_equipment_dispute(booking_id, {"summary": "equipment slot dispute"})
    await log_admin_action(ctx["admin"], "equipment", "escalate", booking_id, None, dispute, ctx["reason"], ctx["ip"])
    return {"success": True, "dispute": dispute}


# --- Settlements & payout console (SOP-25) -------------------------------
@router.get("/settlements")
async def list_settlements(
    status: str = Query("pending"),
    user: dict = Depends(require_admin_role("superadmin", "finance_admin")),
):
    filters = [("status", "==", status)] if status and status != "all" else None
    rows = _sorted(await query("settlements", filters, limit=2000))
    all_rows = await query("settlements", None, limit=2000)
    holds = [r for r in all_rows if r.get("held") or r.get("payoutStatus") == "onHold"]
    return {"data": rows, "holds": holds, "total": len(rows)}


class MarkPaidIn(BaseModel):
    paymentRef: str = Field(..., min_length=3)


async def _apply_mark_paid(settlement: dict, payment_ref: str, admin: dict, reason: str, ip: Optional[str]) -> dict:
    previous = {"status": settlement.get("status"), "paymentRef": settlement.get("paymentRef")}
    settlement["status"] = "paid"
    settlement["paymentRef"] = payment_ref
    settlement["paidAt"] = _now()
    await set_doc("settlements", settlement["id"], settlement)
    await log_admin_action(
        admin, "settlements", "mark-paid", settlement["id"], previous,
        {"status": "paid", "paymentRef": payment_ref}, reason, ip,
    )
    return {"success": True, "id": settlement["id"], "status": "paid", "paymentRef": payment_ref}


@router.post("/settlements/{settlement_id}/mark-paid")
async def mark_settlement_paid(
    settlement_id: str,
    body: MarkPaidIn,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "finance_admin")),
):
    settlement = await get_doc("settlements", settlement_id)
    if settlement is None:
        _err(404, "NOT_FOUND", "settlement not found")
    net_paisa = int(settlement.get("netRupees") or 0) * 100
    if net_paisa > SETTLEMENT_DUAL_SIGNOFF_PAISE:
        pending = await approvals.maybe_require_approval(
            ctx["admin"], "settlements", "mark-paid",
            {"amountPaise": net_paisa, "targetId": settlement_id, "paymentRef": body.paymentRef},
            ctx["reason"],
        )
        if pending is not None:
            return {"success": True, "requiresApproval": True, "approval": pending}
    return await _apply_mark_paid(settlement, body.paymentRef, ctx["admin"], ctx["reason"], ctx["ip"])


async def _exec_mark_paid(approval: dict, approver: dict) -> None:
    payload = approval.get("payload") or {}
    settlement = await get_doc("settlements", payload.get("targetId") or "")
    if settlement is not None:
        await _apply_mark_paid(
            settlement, payload.get("paymentRef") or "", approver,
            approval.get("reason") or "maker-checker approved", approver.get("ip"),
        )


class BatchRunIn(BaseModel):
    periodStart: Optional[str] = None
    periodEnd: Optional[str] = None


@router.post("/jobs/settlements/run")
async def run_settlement_batch(
    body: BatchRunIn,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "finance_admin")),
):
    from app.services.settlements import run_settlements

    period_start, period_end = body.periodStart, body.periodEnd
    if not period_start or not period_end:
        today = datetime.now(timezone.utc).date()
        monday = today - timedelta(days=today.weekday() + 7)
        period_start = monday.isoformat()
        period_end = (monday + timedelta(days=6)).isoformat()
    summary = await run_settlements(period_start, period_end)
    await log_admin_action(ctx["admin"], "settlements", "batch-run", f"{period_start}..{period_end}", None, summary, ctx["reason"], ctx["ip"])
    return {"success": True, "summary": summary, "periodStart": period_start, "periodEnd": period_end}


@router.get("/platform-config/commissions")
async def get_commissions(user: dict = Depends(require_admin_role("superadmin", "finance_admin"))):
    doc = await get_doc("platform_config", "settlements") or {}
    return {
        "rates": {
            "transporterPct": doc.get("transportPct", DEFAULT_COMMISSIONS["transporterPct"]),
            "equipmentPct": doc.get("equipmentRentalPct", DEFAULT_COMMISSIONS["equipmentPct"]),
            "brokerPct": doc.get("brokerPct", DEFAULT_COMMISSIONS["brokerPct"]),
        },
        "versions": doc.get("versions") or [],
        "effectiveFrom": doc.get("effectiveFrom"),
    }


class CommissionsIn(BaseModel):
    rates: dict
    effectiveFrom: str = Field(..., min_length=4)


async def _apply_commissions(payload: dict, admin: dict, reason: str, ip: Optional[str]) -> dict:
    doc = await get_doc("platform_config", "settlements") or {}
    previous = {k: doc.get(k) for k in ("transportPct", "equipmentRentalPct", "brokerPct", "versions", "effectiveFrom")}
    versions = list(doc.get("versions") or [])
    rates = payload.get("rates") or {}
    effective_from = payload.get("effectiveFrom")
    if versions:
        versions[-1]["effectiveTo"] = effective_from
    versions.append({"rates": rates, "effectiveFrom": effective_from, "createdBy": payload.get("createdBy")})
    doc["transportPct"] = rates.get("transporterPct", doc.get("transportPct", 10))
    doc["equipmentRentalPct"] = rates.get("equipmentPct", doc.get("equipmentRentalPct", 12))
    doc["brokerPct"] = rates.get("brokerPct", doc.get("brokerPct", 2))
    doc["versions"] = versions
    doc["effectiveFrom"] = effective_from
    await set_doc("platform_config", "settlements", doc)
    await log_admin_action(admin, "settlements", "commission-config", "platform_config/settlements", previous, {"rates": rates, "effectiveFrom": effective_from}, reason, ip)
    return {"success": True, "rates": rates, "versions": versions, "effectiveFrom": effective_from}


@router.put("/platform-config/commissions")
async def put_commissions(
    body: CommissionsIn,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "finance_admin")),
):
    payload = {
        "rates": body.rates,
        "effectiveFrom": body.effectiveFrom,
        "createdBy": ctx["admin"].get("id"),
    }
    pending = await approvals.maybe_require_approval(
        ctx["admin"], "settlements", "commission-config", payload, ctx["reason"], force=True
    )
    if pending is not None:
        return {"success": True, "requiresApproval": True, "approval": pending}
    return await _apply_commissions(payload, ctx["admin"], ctx["reason"], ctx["ip"])


async def _exec_commissions(approval: dict, approver: dict) -> None:
    await _apply_commissions(
        approval.get("payload") or {}, approver,
        approval.get("reason") or "maker-checker approved", approver.get("ip"),
    )


@router.get("/jobs/cron-logs")
async def list_cron_logs(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_admin_role("superadmin", "finance_admin", "operations_lead")),
):
    docs = _sorted(await query("cron_job_logs", None, limit=2000), field="ranAt")
    return _paginate(docs, page, pageSize)


@router.get("/diary/entries")
async def list_diary_entries(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_admin_role("superadmin", "operations_lead")),
):
    return _paginate(_sorted(await query("farm_diary_entries", None, limit=2000)), page, pageSize)


approvals.register_executor("settlements", "mark-paid", _exec_mark_paid)
approvals.register_executor("settlements", "commission-config", _exec_commissions)


# ===========================================================================
# WS-04 — P3 agronomy / AI modules + M22 dispute triage
# ===========================================================================
@router.get("/land/leases")
async def list_land_leases(
    status: Optional[str] = Query(None),
    user: dict = Depends(require_admin_role("superadmin", "operations_lead", "compliance_officer")),
):
    leases = await query("land_leases", None, limit=2000)
    records = await query("land_records_712", None, limit=2000)
    record_surveys = {r.get("surveyNumber") for r in records}
    rows = []
    for lease in _sorted(leases):
        if status and lease.get("status") != status:
            continue
        lease["recordMismatch"] = bool(lease.get("surveyNumber")) and lease.get("surveyNumber") not in record_surveys
        rows.append(lease)
    return {"data": rows, "total": len(rows)}


@router.get("/advisory/scans/accuracy")
async def advisory_scan_accuracy(
    user: dict = Depends(require_admin_role("superadmin", "agronomist", "scientist")),
):
    scans = await query("advisory_scans", None, limit=2000)
    total = len(scans)
    false_positives = sum(1 for s in scans if s.get("feedback") in ("false_positive", "incorrect"))
    return {
        "totalScans": total,
        "falsePositiveRate": round(false_positives / total, 3) if total else 0.0,
        "feedbackCount": sum(1 for s in scans if s.get("feedback")),
    }


class PestAlertIn(BaseModel):
    district: str
    crop: str
    severity: str = "medium"
    message: str = ""


@router.post("/advisory/pest-alerts")
async def dispatch_pest_alert(
    body: PestAlertIn,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "agronomist", "scientist")),
):
    alert_id = f"pest_{uuid4().hex[:12]}"
    doc = {**body.model_dump(), "id": alert_id, "status": "dispatched", "createdAt": _now()}
    await set_doc("pest_alerts", alert_id, doc)
    await log_admin_action(ctx["admin"], "advisory", "pest-alert", alert_id, None, doc, ctx["reason"], ctx["ip"])
    return {"success": True, "alert": doc}


@router.get("/advisory/soil-tests")
async def list_soil_tests(
    status: str = Query("pending"),
    user: dict = Depends(require_admin_role("superadmin", "agronomist", "scientist")),
):
    filters = [("status", "==", status)] if status and status != "all" else None
    return {"data": _sorted(await query("soil_tests", filters, limit=1000))}


class SoilValidateIn(BaseModel):
    notes: Optional[str] = None


@router.post("/advisory/soil-tests/{test_id}/validate")
async def validate_soil_test(
    test_id: str,
    body: SoilValidateIn,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "agronomist", "scientist")),
):
    doc = await get_doc("soil_tests", test_id)
    if doc is None:
        _err(404, "NOT_FOUND", "soil test not found")
    previous = {"status": doc.get("status")}
    doc["status"] = "validated"
    doc["validationNotes"] = body.notes
    await set_doc("soil_tests", test_id, doc)
    await log_admin_action(ctx["admin"], "advisory", "soil-test.validate", test_id, previous, {"status": "validated"}, ctx["reason"], ctx["ip"])
    return {"success": True, "id": test_id, "status": "validated"}


@router.get("/chatbot/sessions")
async def list_chatbot_sessions(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_admin_role("superadmin", "content_moderator", "compliance_officer")),
):
    return _paginate(_sorted(await query("chatbot_sessions", None, limit=2000)), page, pageSize)


@router.get("/chatbot/sessions/{session_id}")
async def get_chatbot_session(
    session_id: str,
    user: dict = Depends(require_admin_role("superadmin", "content_moderator", "compliance_officer")),
):
    session = await get_doc("chatbot_sessions", session_id)
    if session is None:
        _err(404, "NOT_FOUND", "session not found")
    messages = await query("chatbot_messages", [("sessionId", "==", session_id)], limit=1000)
    messages.sort(key=lambda m: m.get("createdAt") or "")
    return {"session": session, "messages": messages}


@router.get("/chatbot/prompt-config")
async def get_prompt_config(user: dict = Depends(require_admin_role("superadmin", "content_moderator"))):
    doc = await get_doc("platform_config", "chatbot") or {}
    return {"promptConfig": doc.get("promptConfig") or {}}


class PromptConfigIn(BaseModel):
    promptConfig: dict


@router.put("/chatbot/prompt-config")
async def put_prompt_config(
    body: PromptConfigIn,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "content_moderator")),
):
    payload = {"promptConfig": body.promptConfig}
    pending = await approvals.maybe_require_approval(ctx["admin"], "chatbot", "prompt-config", payload, ctx["reason"], force=True)
    if pending is not None:
        return {"success": True, "requiresApproval": True, "approval": pending}
    previous = await get_doc("platform_config", "chatbot") or {}
    await set_doc("platform_config", "chatbot", payload)
    await log_admin_action(ctx["admin"], "chatbot", "prompt-config", "platform_config/chatbot", previous, payload, ctx["reason"], ctx["ip"])
    return {"success": True, "promptConfig": body.promptConfig}


async def _exec_prompt_config(approval: dict, approver: dict) -> None:
    await set_doc("platform_config", "chatbot", approval.get("payload") or {})


@router.get("/experts")
async def list_experts(user: dict = Depends(require_admin_role("superadmin", "agronomist", "content_moderator"))):
    return {"data": _sorted(await query("experts", None, limit=1000))}


class ExpertIn(BaseModel):
    name: Optional[str] = None
    specializations: Optional[list] = None
    active: Optional[bool] = None


@router.put("/experts/{expert_id}")
async def put_expert(
    expert_id: str,
    body: ExpertIn,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "agronomist", "content_moderator")),
):
    doc = await get_doc("experts", expert_id) or {"id": expert_id}
    previous = dict(doc)
    doc.update({k: v for k, v in body.model_dump().items() if v is not None})
    await set_doc("experts", expert_id, doc)
    await log_admin_action(ctx["admin"], "experts", "expert.update", expert_id, previous, doc, ctx["reason"], ctx["ip"])
    return {"success": True, "expert": doc}


@router.get("/land-records/health")
async def land_records_health(user: dict = Depends(require_admin_role("superadmin", "operations_lead", "agronomist"))):
    from app.services import gateway_health

    return {"data": await gateway_health.latest_probes()}


@router.get("/water/schedules")
async def list_water_schedules(user: dict = Depends(require_admin_role("superadmin", "operations_lead"))):
    canal = await query("canal_schedules", None, limit=1000)
    water = await query("water_schedules", None, limit=1000)
    return {"canal": _sorted(canal), "water": _sorted(water)}


class WaterScheduleIn(BaseModel):
    rotationStart: Optional[str] = None
    rotationEnd: Optional[str] = None
    notes: Optional[str] = None


@router.put("/water/schedules/{schedule_id}")
async def put_water_schedule(
    schedule_id: str,
    body: WaterScheduleIn,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "operations_lead")),
):
    doc = await get_doc("water_schedules", schedule_id)
    if doc is None:
        doc = await get_doc("canal_schedules", schedule_id)
        collection = "canal_schedules"
    else:
        collection = "water_schedules"
    if doc is None:
        _err(404, "NOT_FOUND", "schedule not found")
    previous = dict(doc)
    doc.update({k: v for k, v in body.model_dump().items() if v is not None})
    await set_doc(collection, schedule_id, doc)
    await log_admin_action(ctx["admin"], "water", "schedule.update", schedule_id, previous, doc, ctx["reason"], ctx["ip"])
    return {"success": True, "schedule": doc}


@router.get("/cold-storages")
async def list_cold_storages(user: dict = Depends(require_admin_role("superadmin", "operations_lead"))):
    return {"data": _sorted(await query("cold_storages", None, limit=1000))}


class ColdStorageIn(BaseModel):
    name: str = Field(..., min_length=2)
    capacityMT: Optional[float] = None
    temperatureMin: Optional[float] = None
    temperatureMax: Optional[float] = None
    monthlyRatePaise: Optional[int] = None


@router.post("/cold-storages")
async def create_cold_storage(
    body: ColdStorageIn,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "operations_lead")),
):
    store_id = f"cs_{uuid4().hex[:12]}"
    doc = {**body.model_dump(), "id": store_id, "createdAt": _now()}
    await set_doc("cold_storages", store_id, doc)
    await log_admin_action(ctx["admin"], "climate", "cold-storage.create", store_id, None, doc, ctx["reason"], ctx["ip"])
    return {"success": True, "storage": doc}


@router.put("/cold-storages/{storage_id}")
async def update_cold_storage(
    storage_id: str,
    body: ColdStorageIn,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "operations_lead")),
):
    doc = await get_doc("cold_storages", storage_id)
    if doc is None:
        _err(404, "NOT_FOUND", "cold storage not found")
    previous = dict(doc)
    doc.update({k: v for k, v in body.model_dump().items() if v is not None})
    await set_doc("cold_storages", storage_id, doc)
    await log_admin_action(ctx["admin"], "climate", "cold-storage.update", storage_id, previous, doc, ctx["reason"], ctx["ip"])
    return {"success": True, "storage": doc}


@router.get("/climate/varieties")
async def list_climate_varieties(user: dict = Depends(require_admin_role("superadmin", "operations_lead"))):
    return {"data": _sorted(await query("climate_varieties", None, limit=1000))}


@router.get("/disputes")
async def list_disputes(
    role: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    user: dict = Depends(require_admin_role("superadmin", "compliance_officer", "finance_admin", "operations_lead")),
):
    docs = await query("disputes", None, limit=2000)
    if role:
        docs = [d for d in docs if d.get("routedRole") == role]
    if status:
        docs = [d for d in docs if d.get("status") == status]
    now = datetime.now(timezone.utc).isoformat()
    rows = []
    for d in _sorted(docs):
        d["slaBreached"] = bool(d.get("slaDueAt")) and d.get("slaDueAt") < now and d.get("status") == "open"
        rows.append(d)
    return {"data": rows, "total": len(rows)}


@router.get("/disputes/{dispute_id}")
async def get_dispute(
    dispute_id: str,
    user: dict = Depends(require_admin_role("superadmin", "compliance_officer", "finance_admin", "operations_lead")),
):
    doc = await get_doc("disputes", dispute_id)
    if doc is None:
        _err(404, "NOT_FOUND", "dispute not found")
    return doc


class ResolveDisputeIn(BaseModel):
    resolution: str = Field(..., min_length=3)


@router.post("/disputes/{dispute_id}/resolve")
async def resolve_dispute(
    dispute_id: str,
    body: ResolveDisputeIn,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "compliance_officer", "finance_admin", "operations_lead")),
):
    doc = await get_doc("disputes", dispute_id)
    if doc is None:
        _err(404, "NOT_FOUND", "dispute not found")
    previous = {"status": doc.get("status")}
    doc["status"] = "resolved"
    doc["resolution"] = body.resolution
    doc["resolvedBy"] = ctx["admin"].get("id")
    doc["resolvedAt"] = _now()
    await set_doc("disputes", dispute_id, doc)
    await log_admin_action(ctx["admin"], "disputes", "resolve", dispute_id, previous, {"status": "resolved", "resolution": body.resolution}, ctx["reason"], ctx["ip"])
    return {"success": True, "dispute": doc}


approvals.register_executor("chatbot", "prompt-config", _exec_prompt_config)


# ===========================================================================
# WS-05 — P4 financial modules (banking, KCC, insurance)
# ===========================================================================
@router.get("/finance/bank-accounts")
async def list_bank_accounts(
    verification: str = Query("failed"),
    user: dict = Depends(require_admin_role("superadmin", "finance_admin", "compliance_officer")),
):
    docs = await query("bank_accounts", None, limit=2000)
    if verification == "failed":
        docs = [d for d in docs if d.get("verifyStatus") == "failed"]
    elif verification and verification != "all":
        docs = [d for d in docs if d.get("verifyStatus") == verification]
    return {"data": _sorted(docs), "total": len(docs)}


class OverrideVerifyIn(BaseModel):
    amountPaise: Optional[int] = None


@router.post("/finance/bank-accounts/{account_id}/override-verify")
async def override_bank_account(
    account_id: str,
    body: OverrideVerifyIn,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "finance_admin")),
):
    account = await get_doc("bank_accounts", account_id)
    if account is None:
        _err(404, "NOT_FOUND", "bank account not found")
    previous = {"verifyStatus": account.get("verifyStatus")}
    if (body.amountPaise or 0) > approvals.MAKER_CHECKER_THRESHOLD_PAISE:
        pending = await approvals.maybe_require_approval(
            ctx["admin"], "banking", "penny-drop-override",
            {"amountPaise": body.amountPaise, "targetId": account_id}, ctx["reason"],
        )
        if pending is not None:
            return {"success": True, "requiresApproval": True, "approval": pending}
    account["verifyStatus"] = "verified"
    account["overriddenBy"] = ctx["admin"].get("id")
    await set_doc("bank_accounts", account_id, account)
    await log_admin_action(ctx["admin"], "banking", "penny-drop-override", account_id, previous, {"verifyStatus": "verified"}, ctx["reason"], ctx["ip"])
    return {"success": True, "id": account_id, "verifyStatus": "verified"}


@router.get("/finance/kcc")
async def list_kcc_records(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_admin_role("superadmin", "finance_admin", "compliance_officer")),
):
    return _paginate(_sorted(await query("kcc_records", None, limit=2000)), page, pageSize)


@router.get("/insurance/claims")
async def list_insurance_claims(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_admin_role("superadmin", "finance_admin", "compliance_officer")),
):
    docs = await query("insurance_claims", None, limit=2000)
    if status:
        docs = [d for d in docs if d.get("status") == status]
    return _paginate(_sorted(docs), page, pageSize)


@router.get("/insurance/rates")
async def list_insurance_rates(
    product: Optional[str] = Query(None),
    user: dict = Depends(require_admin_role("superadmin", "finance_admin")),
):
    docs = await query("insurance_rates", None, limit=2000)
    if product:
        docs = [d for d in docs if d.get("product") == product]
    docs.sort(key=lambda d: d.get("effectiveFrom") or "", reverse=True)
    return {"data": docs, "total": len(docs)}


class RateIn(BaseModel):
    product: str = Field(..., min_length=2)
    rate: float
    effectiveFrom: str = Field(..., min_length=4)


def _overlaps(existing: dict, start: str, end: Optional[str]) -> bool:
    ex_start = existing.get("effectiveFrom") or ""
    ex_end = existing.get("effectiveTo") or "9999-12-31"
    new_end = end or "9999-12-31"
    return ex_start <= new_end and start <= ex_end


@router.post("/insurance/rates")
async def create_insurance_rate(
    body: RateIn,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "finance_admin")),
):
    existing = await query("insurance_rates", [("product", "==", body.product)], limit=1000)
    for row in existing:
        if row.get("effectiveFrom") == body.effectiveFrom:
            _err(409, "RATE_PERIOD_OVERLAP", "an overlapping rate row already exists for this product")
        if row.get("effectiveTo") is not None and _overlaps(row, body.effectiveFrom, None):
            _err(409, "RATE_PERIOD_OVERLAP", "an overlapping rate row already exists for this product")
    payload = {
        "product": body.product,
        "rate": body.rate,
        "effectiveFrom": body.effectiveFrom,
        "effectiveTo": None,
        "createdBy": ctx["admin"].get("id"),
    }
    pending = await approvals.maybe_require_approval(ctx["admin"], "insurance", "rate-table", payload, ctx["reason"], force=True)
    if pending is not None:
        return {"success": True, "requiresApproval": True, "approval": pending}
    return {"success": True, "rate": await _apply_rate_table(payload, ctx["admin"], ctx["reason"], ctx["ip"])}


async def _apply_rate_table(payload: dict, admin: dict, reason: str, ip) -> dict:
    product = payload.get("product")
    start = payload.get("effectiveFrom")
    existing = await query("insurance_rates", [("product", "==", product)], limit=1000)
    for row in existing:
        if row.get("effectiveTo") is None and (row.get("effectiveFrom") or "") <= (start or ""):
            row["effectiveTo"] = start
            await set_doc("insurance_rates", row["id"], row)
    rate_id = f"rate_{uuid4().hex[:12]}"
    doc = {"id": rate_id, **payload}
    await set_doc("insurance_rates", rate_id, doc)
    await log_admin_action(admin, "insurance", "rate-table", rate_id, None, doc, reason, ip)
    return doc


async def _exec_rate_table(approval: dict, approver: dict) -> None:
    await _apply_rate_table(
        approval.get("payload") or {}, approver,
        approval.get("reason") or "maker-checker approved", approver.get("ip"),
    )


approvals.register_executor("insurance", "rate-table", _exec_rate_table)


# ===========================================================================
# WS-06 — P5 ecosystem modules
# ===========================================================================
@router.get("/fpos")
async def list_fpos(status: str = Query("pending"), user: dict = Depends(require_admin_role("superadmin", "operations_lead"))):
    filters = [("status", "==", status)] if status and status != "all" else None
    return {"data": _sorted(await query("fpos", filters, limit=1000))}


async def _decide_status(collection: str, doc_id: str, status: str, module: str, ctx: dict) -> dict:
    doc = await get_doc(collection, doc_id)
    if doc is None:
        _err(404, "NOT_FOUND", f"{collection} record not found")
    previous = {"status": doc.get("status")}
    doc["status"] = status
    await set_doc(collection, doc_id, doc)
    await log_admin_action(ctx["admin"], module, f"{module}.{status}", doc_id, previous, {"status": status}, ctx["reason"], ctx["ip"])
    return {"success": True, "id": doc_id, "status": status}


@router.post("/fpos/{fpo_id}/verify")
async def verify_fpo(fpo_id: str, ctx: dict = Depends(admin_mutation_context), _role: dict = Depends(require_admin_role("superadmin", "operations_lead"))):
    return await _decide_status("fpos", fpo_id, "verified", "fpo", ctx)


@router.post("/fpos/{fpo_id}/reject")
async def reject_fpo(fpo_id: str, body: ReasonBody, ctx: dict = Depends(admin_mutation_context), _role: dict = Depends(require_admin_role("superadmin", "operations_lead"))):
    if not (body.reason or "").strip():
        _err(422, "VALIDATION_ERROR", "a rejection reason is required")
    return await _decide_status("fpos", fpo_id, "rejected", "fpo", ctx)


@router.get("/fpos/{fpo_id}/pools")
async def fpo_pools(fpo_id: str, user: dict = Depends(require_admin_role("superadmin", "operations_lead"))):
    pools = await query("fpo_pools", [("fpoId", "==", fpo_id)], limit=200)
    members = await query("fpo_pool_members", [("fpoId", "==", fpo_id)], limit=500)
    return {"pools": pools, "members": members}


@router.get("/vets")
async def list_vets(status: str = Query("pending"), user: dict = Depends(require_admin_role("superadmin", "operations_lead"))):
    filters = [("status", "==", status)] if status and status != "all" else None
    return {"data": _sorted(await query("vets", filters, limit=1000))}


@router.post("/vets/{vet_id}/verify")
async def verify_vet(vet_id: str, ctx: dict = Depends(admin_mutation_context), _role: dict = Depends(require_admin_role("superadmin", "operations_lead"))):
    return await _decide_status("vets", vet_id, "verified", "vets", ctx)


@router.post("/vets/{vet_id}/reject")
async def reject_vet(vet_id: str, body: ReasonBody, ctx: dict = Depends(admin_mutation_context), _role: dict = Depends(require_admin_role("superadmin", "operations_lead"))):
    if not (body.reason or "").strip():
        _err(422, "VALIDATION_ERROR", "a rejection reason is required")
    return await _decide_status("vets", vet_id, "rejected", "vets", ctx)


@router.get("/gaushalas")
async def list_gaushalas(user: dict = Depends(require_admin_role("superadmin", "operations_lead"))):
    return {"data": _sorted(await query("gaushalas", None, limit=1000))}


@router.get("/nurseries")
async def list_nurseries(user: dict = Depends(require_admin_role("superadmin", "operations_lead"))):
    return {"data": _sorted(await query("nurseries", None, limit=1000))}


class NewsIn(BaseModel):
    title: str = Field(..., min_length=2)
    body: str = ""
    breaking: bool = False
    scheduledAt: Optional[str] = None


@router.get("/content/news")
async def list_news(user: dict = Depends(require_admin_role("superadmin", "content_moderator"))):
    return {"data": _sorted(await query("agri_news", None, limit=1000))}


@router.post("/content/news")
async def create_news(body: NewsIn, ctx: dict = Depends(admin_mutation_context), _role: dict = Depends(require_admin_role("superadmin", "content_moderator"))):
    news_id = f"news_{uuid4().hex[:12]}"
    doc = {**body.model_dump(), "id": news_id, "status": "published", "createdAt": _now()}
    await set_doc("agri_news", news_id, doc)
    await log_admin_action(ctx["admin"], "content", "news.create", news_id, None, doc, ctx["reason"], ctx["ip"])
    return {"success": True, "news": doc}


@router.put("/content/news/{news_id}")
async def update_news(news_id: str, body: NewsIn, ctx: dict = Depends(admin_mutation_context), _role: dict = Depends(require_admin_role("superadmin", "content_moderator"))):
    doc = await get_doc("agri_news", news_id)
    if doc is None:
        _err(404, "NOT_FOUND", "news not found")
    previous = dict(doc)
    doc.update({k: v for k, v in body.model_dump().items() if v is not None})
    await set_doc("agri_news", news_id, doc)
    await log_admin_action(ctx["admin"], "content", "news.update", news_id, previous, doc, ctx["reason"], ctx["ip"])
    return {"success": True, "news": doc}


class ModerateChannelIn(BaseModel):
    action: str = Field(..., description="approve | suspend")


@router.post("/content/channels/{channel_id}/moderate")
async def moderate_channel(channel_id: str, body: ModerateChannelIn, ctx: dict = Depends(admin_mutation_context), _role: dict = Depends(require_admin_role("superadmin", "content_moderator"))):
    if body.action not in ("approve", "suspend"):
        _err(422, "VALIDATION_ERROR", "action must be approve or suspend")
    return await _decide_status("agri_channels", channel_id, "live" if body.action == "approve" else "suspended", "content", ctx)


@router.get("/content/workshops")
async def list_workshops(user: dict = Depends(require_admin_role("superadmin", "content_moderator"))):
    return {"data": _sorted(await query("workshops", None, limit=1000))}


class WorkshopIn(BaseModel):
    featured: Optional[bool] = None
    status: Optional[str] = None


@router.put("/content/workshops/{workshop_id}")
async def update_workshop(workshop_id: str, body: WorkshopIn, ctx: dict = Depends(admin_mutation_context), _role: dict = Depends(require_admin_role("superadmin", "content_moderator"))):
    doc = await get_doc("workshops", workshop_id)
    if doc is None:
        _err(404, "NOT_FOUND", "workshop not found")
    previous = dict(doc)
    doc.update({k: v for k, v in body.model_dump().items() if v is not None})
    await set_doc("workshops", workshop_id, doc)
    await log_admin_action(ctx["admin"], "content", "workshop.update", workshop_id, previous, doc, ctx["reason"], ctx["ip"])
    return {"success": True, "workshop": doc}


@router.get("/ngos")
async def list_ngos(status: str = Query("pending"), user: dict = Depends(require_admin_role("superadmin", "operations_lead", "content_moderator"))):
    filters = [("status", "==", status)] if status and status != "all" else None
    return {"data": _sorted(await query("ngos", filters, limit=1000))}


@router.post("/ngos/{ngo_id}/verify")
async def verify_ngo(ngo_id: str, ctx: dict = Depends(admin_mutation_context), _role: dict = Depends(require_admin_role("superadmin", "operations_lead", "content_moderator"))):
    return await _decide_status("ngos", ngo_id, "verified", "trees", ctx)


@router.get("/sapling-requests")
async def list_sapling_requests(status: Optional[str] = Query(None), user: dict = Depends(require_admin_role("superadmin", "operations_lead", "content_moderator"))):
    docs = await query("sapling_requests", None, limit=1000)
    if status:
        docs = [d for d in docs if d.get("status") == status]
    return {"data": _sorted(docs)}


class SaplingReviewIn(BaseModel):
    decision: str = Field(..., description="approve | reject")


@router.post("/sapling-requests/{request_id}/review")
async def review_sapling_request(request_id: str, body: SaplingReviewIn, ctx: dict = Depends(admin_mutation_context), _role: dict = Depends(require_admin_role("superadmin", "operations_lead", "content_moderator"))):
    if body.decision not in ("approve", "reject"):
        _err(422, "VALIDATION_ERROR", "decision must be approve or reject")
    return await _decide_status("sapling_requests", request_id, "approved" if body.decision == "approve" else "rejected", "trees", ctx)


@router.get("/biofuel-trees")
async def list_biofuel_trees(user: dict = Depends(require_admin_role("superadmin", "operations_lead", "content_moderator"))):
    return {"data": _sorted(await query("biofuel_trees", None, limit=1000))}


@router.get("/gamification/circulation")
async def coin_circulation(user: dict = Depends(require_admin_role("superadmin", "content_moderator", "finance_admin"))):
    ledger = await query("agri_coins_ledger", None, limit=5000)
    daily: dict[str, dict] = {}
    for row in ledger:
        day = (row.get("at") or row.get("createdAt") or "")[:10]
        if not day:
            continue
        bucket = daily.setdefault(day, {"date": day, "minted": 0, "burned": 0})
        delta = int(row.get("deltaCoins") or row.get("coins") or 0)
        if delta >= 0:
            bucket["minted"] += delta
        else:
            bucket["burned"] += -delta
    return {"data": [daily[k] for k in sorted(daily)]}


class CoinAdjustIn(BaseModel):
    uid: str
    deltaCoins: int
    marketValueRupees: int = 0


@router.post("/gamification/adjust")
async def adjust_coins(body: CoinAdjustIn, ctx: dict = Depends(admin_mutation_context), _role: dict = Depends(require_admin_role("superadmin", "content_moderator", "finance_admin"))):
    amount_paisa = abs(body.marketValueRupees) * 100
    if amount_paisa > approvals.MAKER_CHECKER_THRESHOLD_PAISE:
        pending = await approvals.maybe_require_approval(
            ctx["admin"], "gamification", "coin-adjust",
            {"amountPaise": amount_paisa, "targetId": body.uid, "deltaCoins": body.deltaCoins}, ctx["reason"],
        )
        if pending is not None:
            return {"success": True, "requiresApproval": True, "approval": pending}
    ledger_id = f"coin_{uuid4().hex[:12]}"
    await set_doc("agri_coins_ledger", ledger_id, {"id": ledger_id, "uid": body.uid, "deltaCoins": body.deltaCoins, "at": _now(), "source": "admin"})
    await log_admin_action(ctx["admin"], "gamification", "coin-adjust", body.uid, None, {"deltaCoins": body.deltaCoins}, ctx["reason"], ctx["ip"])
    return {"success": True, "uid": body.uid, "deltaCoins": body.deltaCoins}


@router.get("/gamification/referral-fraud")
async def referral_fraud(user: dict = Depends(require_admin_role("superadmin", "content_moderator", "compliance_officer"))):
    coupons = await query("reward_coupons", None, limit=1000)
    fraud_holds = await query("fraud_queue", [("status", "==", "open")], limit=1000)
    return {"coupons": coupons, "fraudHolds": fraud_holds}


@router.get("/shgs")
async def list_shgs(status: str = Query("pending"), user: dict = Depends(require_admin_role("superadmin", "operations_lead", "finance_admin"))):
    filters = [("status", "==", status)] if status and status != "all" else None
    return {"data": _sorted(await query("women_shgs", filters, limit=1000))}


@router.post("/shgs/{shg_id}/verify")
async def verify_shg(shg_id: str, ctx: dict = Depends(admin_mutation_context), _role: dict = Depends(require_admin_role("superadmin", "operations_lead", "finance_admin"))):
    return await _decide_status("women_shgs", shg_id, "verified", "shg", ctx)


@router.post("/shgs/{shg_id}/reject")
async def reject_shg(shg_id: str, body: ReasonBody, ctx: dict = Depends(admin_mutation_context), _role: dict = Depends(require_admin_role("superadmin", "operations_lead", "finance_admin"))):
    if not (body.reason or "").strip():
        _err(422, "VALIDATION_ERROR", "a rejection reason is required")
    return await _decide_status("women_shgs", shg_id, "rejected", "shg", ctx)


@router.get("/shgs/{shg_id}/deposits")
async def shg_deposits(shg_id: str, user: dict = Depends(require_admin_role("superadmin", "operations_lead", "finance_admin"))):
    return {"data": await query("shg_deposits", [("shgId", "==", shg_id)], limit=500)}


@router.get("/shgs/{shg_id}/enterprises")
async def shg_enterprises(shg_id: str, user: dict = Depends(require_admin_role("superadmin", "operations_lead", "finance_admin"))):
    return {"data": await query("home_enterprises", [("shgId", "==", shg_id)], limit=500)}
