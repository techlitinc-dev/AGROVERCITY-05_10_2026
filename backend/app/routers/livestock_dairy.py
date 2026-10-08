import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Response

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.livestock_mgmt import (
    DairyAgentIn,
    DairyMemberIn,
    MilkSaleCustomerIn,
    MilkSaleOrderIn,
    MilkSaleOrderStatusIn,
    PaymentBatchGenerateIn,
    PaymentBatchMarkPaidIn,
    RateChartIn,
    StockAdjustIn,
    StockItemIn,
)
from app.routers.users import require_role
from app.services import idempotency
from app.services.ai import config_store, decision_log, gateway, question_sets
from app.services.ai.privacy import build_adulteration_state
from app.services.billing import entitlement_guard, record_usage, require_entitlement
from app.services.notifications import send_fcm_to_user
from app.services.rating_prompts import open_rating_prompt
from app.services.settlements import create_razorpayx_payout
from app.services.tasks import DEEP_LINKS, emit_task
from app.services import kyc as kyc_service
from app.services.users import get_user

log = logging.getLogger(__name__)

router = APIRouter(tags=["livestock"])

# --- WS-07 M17 — Dairy milk adulteration -----------------------------------
# A per-collection FAT/SNF anomaly flag computed against the member's own
# 30-day baseline. Collections ALWAYS save: the flag only annotates the ledger
# and the member statement; automation stays at `suggest` (the manager
# confirms/dismisses via the flag-review endpoint, which is the outcome hook).
DAIRY_ADULTERATION_MODULE = "dairy_adulteration"
DAIRY_ADULTERATION_QUESTION_SET = "dairy.adulteration.v1"
DAIRY_ADULTERATION_WINDOW_DAYS = 30

_ORDER_NEXT = {"scheduled": "delivered", "delivered": "billed", "billed": "paid"}


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def assert_fssai_kyc(uid: str):
    cases = await kyc_service.cases_for_user(uid)
    has_fssai = False
    for c in cases:
        for d in c.get("docs") or []:
            if (d.get("type") == "fssai" or d.get("docType") == "fssai") and d.get("status") in ("verified", "approved"):
                has_fssai = True
                break
        if has_fssai:
            break
    if not has_fssai:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "KYC_REQUIRED",
                "message": "FSSAI licence document must be verified before proceeding",
                "deepLink": "/dashboard/profile?section=kyc&docType=fssai",
            },
        )



def _envelope(docs: list[dict], page: int, page_size: int) -> dict:
    total = len(docs)
    start = (page - 1) * page_size
    return {"data": docs[start:start + page_size], "page": page, "pageSize": page_size, "total": total}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _notify(uid: str, title: str, body: str, data: dict):
    if not uid:
        return
    await send_fcm_to_user(uid, title, body, data)


async def send_unlinked_slip_if_eligible(
    manager_id: str,
    member_id: str | None,
    farmer_code: str | None,
    slip_doc: dict,
) -> None:
    member = None
    if member_id:
        member = await get_doc("dairy_members", member_id)
    elif farmer_code:
        m_list = await query(
            "dairy_members",
            [("centerId", "==", manager_id), ("memberCode", "==", farmer_code)],
            limit=1,
        )
        if m_list:
            member = m_list[0]

    if not member or member.get("farmerUid"):
        return

    from app.services.billing import effective_plan

    plan = await effective_plan(manager_id, "dairyManager")
    is_pro = plan.get("tier") in ("pro", "enterprise") or "auto_sms_slips" in (
        plan.get("features") or []
    )
    if not is_pro:
        return

    slip_no = slip_doc.get("slipNumber", "")
    liters = slip_doc.get("liters", 0)
    fat = slip_doc.get("fatPercent", 0)
    snf = slip_doc.get("snfPercent", 0)
    rate = slip_doc.get("ratePerLiter", 0)
    amount = slip_doc.get("totalAmount", 0)

    title = f"दूध पर्ची (Milk Slip): {slip_no}"
    body_msg = (
        f"पर्ची: {slip_no} | मात्रा: {liters}L | "
        f"फैट: {fat}% | SNF: {snf}% | "
        f"दर: ₹{rate}/L | कुल: ₹{amount}"
    )
    recipient_id = member.get("phone") or member.get("id") or manager_id
    data = {
        "kind": "milk_slip_sms",
        "type": "milk_slip_sms",
        "slipNumber": str(slip_no),
        "liters": str(liters),
        "fatPercent": str(fat),
        "snfPercent": str(snf),
        "rate": str(rate),
        "amount": str(amount),
        "memberId": member.get("id", ""),
        "phone": member.get("phone", ""),
    }
    await _notify(recipient_id, title, body_msg, data)


def _window_start(date_str: str) -> str:
    try:
        day = datetime.fromisoformat(date_str).date()
    except (TypeError, ValueError):
        day = datetime.now(timezone.utc).date()
    return (day - timedelta(days=DAIRY_ADULTERATION_WINDOW_DAYS)).isoformat()


async def _member_milk_baseline(collection: dict) -> list[dict]:
    """Prior FAT/SNF readings for the same member inside the 30-day window."""
    member_id = collection.get("memberId")
    farmer_code = collection.get("farmerCode")
    if not member_id and not farmer_code:
        return []
    target_date = str(collection.get("date") or "")
    window_start = _window_start(target_date)
    docs = await query("milk_collections", [], limit=2000)
    history: list[dict] = []
    for doc in docs:
        if doc.get("id") == collection.get("id"):
            continue
        if member_id:
            if doc.get("memberId") != member_id:
                continue
        elif doc.get("farmerCode") != farmer_code:
            continue
        day = str(doc.get("date") or "")
        if day and window_start <= day <= (target_date or day):
            history.append(doc)
    history.sort(key=lambda d: d.get("date") or "")
    return history


async def annotate_collection_adulteration(collection: dict) -> dict | None:
    """M17 — annotate one collection with an adulteration flag.

    Returns `{anomaly, confidence, baseline, sampleCount, decisionId}` or None
    when the `dairy_adulteration` flag is off (the collection saves unchanged).
    The write is NEVER blocked: provider failures degrade to the deterministic
    fallback and are logged with `fallbackUsed` via the gateway/decision log.
    """
    if not await config_store.module_enabled(DAIRY_ADULTERATION_MODULE):
        return None

    history = await _member_milk_baseline(collection)
    today = {
        "memberId": collection.get("memberId"),
        "fatPercent": collection.get("fatPercent"),
        "snfPercent": collection.get("snfPercent"),
        "date": collection.get("date"),
        "windowDays": DAIRY_ADULTERATION_WINDOW_DAYS,
    }
    state = build_adulteration_state(history, today)
    try:
        decision = await gateway.decide(
            state,
            DAIRY_ADULTERATION_QUESTION_SET,
            ctx=collection.get("memberId"),
            module=DAIRY_ADULTERATION_MODULE,
        )
        answers = dict(decision.answers or {})
        confidence = float(decision.confidence or 0.0)
        decision_id = decision.decision_id
    except Exception as exc:  # noqa: BLE001 — degrade, never block the collection
        log.warning("dairy adulteration decide failed (%s) — degrading to fallback", exc)
        answers = question_sets.fallback_answers(DAIRY_ADULTERATION_QUESTION_SET, state)
        confidence = 0.0
        decision_id = await decision_log.log_decision(
            module=DAIRY_ADULTERATION_MODULE,
            question_set_id=DAIRY_ADULTERATION_QUESTION_SET,
            version="v1",
            state=state,
            answers=answers,
            confidence=0.0,
            latency_ms=0,
            cost_usd=0.0,
            model="none",
            source="fallback",
            fallback_used=True,
        )

    baseline = answers.get("baseline") or {}
    return {
        "anomaly": bool(answers.get("anomaly")),
        "confidence": round(confidence, 3),
        "baseline": {
            "fatAvg": baseline.get("fatAvg"),
            "snfAvg": baseline.get("snfAvg"),
            "windowDays": baseline.get("windowDays") or DAIRY_ADULTERATION_WINDOW_DAYS,
        },
        "sampleCount": len(history),
        "decisionId": decision_id,
    }


async def _manager(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "dairyManager")
    return uid


async def dairy_agent_record(uid: str) -> dict | None:
    """Active pickup-agent sub-account for this identity, if any (agents are scoped to a center)."""
    docs = await query("dairy_agents", [("uid", "==", uid)], limit=10)
    return next((d for d in docs if d.get("active")), None)


async def forbid_dairy_agent(uid: str) -> None:
    if await dairy_agent_record(uid) is not None:
        _error(
            403,
            "AGENT_ROLE_FORBIDDEN",
            "pickup agents may only record collections and collection checks",
            {"deepLink": "/dashboard/p/dairyDashboard"},
        )


async def _manager_no_agents(uid: str = Depends(current_user_id)) -> str:
    await forbid_dairy_agent(uid)
    return await _manager(uid)


async def _manager_or_agent(uid: str = Depends(current_user_id)) -> str:
    """Manager identity that also lets an active pickup agent through (collection writes)."""
    if await dairy_agent_record(uid) is not None:
        return uid
    return await _manager(uid)


async def _livestock_user(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer", "seller", "dairyManager")
    return uid


async def _center_members(center_id: str) -> list[dict]:
    docs = await query("dairy_members", [("centerId", "==", center_id)], limit=500)
    docs.sort(key=lambda d: d.get("createdAt", ""))
    return docs


# =========================================================================
# Dairy members
# =========================================================================

@router.get("/livestock/dairy/members")
async def list_members(
    status: str | None = None,
    page: int = 1,
    pageSize: int = 50,
    uid: str = Depends(_manager),
):
    docs = await _center_members(uid)
    if status:
        docs = [d for d in docs if d.get("status") == status]
    return _envelope(docs, page, pageSize)


@router.post("/livestock/dairy/members", status_code=201)
async def create_member(
    body: DairyMemberIn,
    uid: str = Depends(_manager_no_agents),
    _plan: dict = Depends(require_entitlement("dairyManager", "members")),
):
    member_id = f"mem_{uuid.uuid4().hex[:12]}"
    doc = {
        "id": member_id,
        "centerId": uid,
        "farmerUid": body.farmerUid,
        "name": body.name,
        "phone": body.phone,
        "village": body.village,
        "memberCode": body.memberCode or f"M-{uuid.uuid4().hex[:6].upper()}",
        "bankDetails": body.bankDetails,
        "defaultSpecies": body.defaultSpecies,
        "deduction": body.deduction,
        "status": body.status,
        "createdAt": _now(),
    }
    await set_doc("dairy_members", member_id, doc)
    await record_usage(uid, "members")
    return doc


@router.put("/livestock/dairy/members/{member_id}")
async def update_member(member_id: str, body: DairyMemberIn, uid: str = Depends(_manager_no_agents)):
    doc = await get_doc("dairy_members", member_id)
    if not doc or doc.get("centerId") != uid:
        _error(404, "MEMBER_NOT_FOUND", "member not found")
    doc.update({
        "farmerUid": body.farmerUid,
        "name": body.name,
        "phone": body.phone,
        "village": body.village,
        "bankDetails": body.bankDetails,
        "defaultSpecies": body.defaultSpecies,
        "deduction": body.deduction,
        "status": body.status,
        "updatedAt": _now(),
    })
    if body.memberCode:
        doc["memberCode"] = body.memberCode
    await set_doc("dairy_members", member_id, doc)
    return doc


@router.delete("/livestock/dairy/members/{member_id}")
async def delete_member(member_id: str, uid: str = Depends(_manager_no_agents)):
    doc = await get_doc("dairy_members", member_id)
    if not doc or doc.get("centerId") != uid:
        _error(404, "MEMBER_NOT_FOUND", "member not found")
    doc["status"] = "inactive"
    doc["updatedAt"] = _now()
    await set_doc("dairy_members", member_id, doc)
    return doc


@router.get("/livestock/dairy/members/{member_id}/statement")
async def member_statement(
    member_id: str,
    date_from: str | None = None,
    date_to: str | None = None,
    format: str | None = None,
    accept: str | None = Header(None),
    uid: str = Depends(current_user_id),
):
    member = await get_doc("dairy_members", member_id)
    if not member:
        _error(404, "MEMBER_NOT_FOUND", "member not found")
    is_manager = member.get("centerId") == uid
    is_farmer = bool(member.get("farmerUid")) and member.get("farmerUid") == uid
    if not (is_manager or is_farmer):
        _error(403, "FORBIDDEN", "access denied to member statement")

    collections = await query("milk_collections", [("memberId", "==", member_id)], limit=1000)
    if date_from:
        collections = [c for c in collections if c.get("date", "") >= date_from]
    if date_to:
        collections = [c for c in collections if c.get("date", "") <= date_to]
    collections.sort(key=lambda d: d.get("date", ""))
    payments = await query("payment_entries", [("memberId", "==", member_id)], limit=1000)
    if date_from:
        payments = [p for p in payments if p.get("createdAt", "")[:10] >= date_from]
    if date_to:
        payments = [p for p in payments if p.get("createdAt", "")[:10] <= date_to]
    payments.sort(key=lambda d: d.get("createdAt", ""))

    if format == "pdf" or (accept and "application/pdf" in accept):
        from app.services.reports import build_member_statement_pdf

        pdf_path = build_member_statement_pdf(
            member, collections, payments, date_from or "", date_to or ""
        )
        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="statement-{member_id}.pdf"'},
        )

    flagged = [c for c in collections if (c.get("adulteration") or {}).get("anomaly")]
    flag_note = None
    if flagged:
        count = len(flagged)
        flag_note = {
            "en": (
                f"{count} collection(s) in this period were flagged for a possible "
                "FAT/SNF anomaly against this member's 30-day baseline — please verify the readings."
            ),
            "hi": (
                f"इस अवधि की {count} पर्ची(याँ) सदस्य के 30-दिन के आधार की तुलना में संभावित "
                "FAT/SNF असामान्यता के लिए चिह्नित हैं — कृपया रीडिंग जाँचें।"
            ),
        }

    return {
        "member": member,
        "collections": collections,
        "payments": payments,
        "totals": {
            "liters": round(sum(c.get("liters", 0.0) for c in collections), 2),
            "amount": round(sum(c.get("totalAmount", 0.0) for c in collections), 2),
            "paid": round(sum(p.get("netAmount", 0.0) for p in payments if p.get("status") == "paid"), 2),
        },
        "flaggedCount": len(flagged),
        "flagNote": flag_note,
    }


# =========================================================================
# Pickup agents (Pro-tier sub-accounts, R2)
# =========================================================================

@router.get("/livestock/dairy/agents")
async def list_dairy_agents(uid: str = Depends(_manager)):
    docs = await query("dairy_agents", [("centerId", "==", uid)], limit=200)
    docs.sort(key=lambda d: d.get("createdAt", ""))
    return {"data": docs, "total": len(docs)}


@router.post("/livestock/dairy/agents", status_code=201)
async def create_dairy_agent(
    body: DairyAgentIn,
    uid: str = Depends(_manager),
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    _plan: dict = Depends(entitlement_guard("dairyManager", "agentSeats")),
):
    stored = await idempotency.replay("dairy.agent.create", idempotency_key)
    if stored is not None:
        return stored
    invitee = await get_user(body.uid)
    if invitee is None:
        _error(404, "NOT_FOUND", "agent user not registered")
    existing = await dairy_agent_record(body.uid)
    if existing is not None and existing.get("centerId") == uid:
        _error(409, "AGENT_EXISTS", "user is already an agent for this center")
    agent_id = f"agt_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": agent_id,
        "uid": body.uid,
        "centerId": uid,
        "name": body.name,
        "phone": body.phone,
        "routeIds": body.routeIds,
        "active": True,
        "createdAt": _now(),
    }
    await set_doc("dairy_agents", agent_id, doc)
    await record_usage(uid, "agentSeats")
    if idempotency_key:
        await idempotency.store("dairy.agent.create", idempotency_key, doc)
    return doc


@router.delete("/livestock/dairy/agents/{agent_uid}")
async def deactivate_dairy_agent(agent_uid: str, uid: str = Depends(_manager)):
    docs = await query("dairy_agents", [("uid", "==", agent_uid), ("centerId", "==", uid)], limit=5)
    doc = next((d for d in docs if d.get("active")), None)
    if doc is None:
        _error(404, "AGENT_NOT_FOUND", "agent not found")
    doc["active"] = False
    doc["updatedAt"] = _now()
    await set_doc("dairy_agents", doc["id"], doc)
    return doc


# =========================================================================
# Rate charts
# =========================================================================

async def _deactivate_other_charts(center_id: str, species: str, keep_id: str):
    charts = await query(
        "rate_charts",
        [("centerId", "==", center_id), ("species", "==", species), ("active", "==", True)],
        limit=100,
    )
    for chart in charts:
        if chart["id"] != keep_id:
            chart["active"] = False
            await set_doc("rate_charts", chart["id"], chart)


@router.get("/livestock/dairy/rate-chart")
async def get_active_rate_chart(species: str = "cow", uid: str = Depends(_livestock_user)):
    user = await get_user(uid)
    docs = await query("rate_charts", [("species", "==", species), ("active", "==", True)], limit=100)
    profile = (user or {}).get("activeProfile", "")
    preferred: list[dict] = []
    if profile == "dairyManager":
        preferred = [d for d in docs if d.get("centerId") == uid]
    else:
        memberships = await query(
            "dairy_members", [("farmerUid", "==", uid), ("status", "==", "active")], limit=10
        )
        center_ids = {m.get("centerId") for m in memberships}
        preferred = [d for d in docs if d.get("centerId") in center_ids]
    pool = preferred or docs
    if not pool:
        _error(404, "RATE_CHART_NOT_FOUND", "no active rate chart for this species")
    pool.sort(key=lambda d: d.get("effectiveFrom", ""), reverse=True)
    return pool[0]


@router.get("/livestock/dairy/rate-chart/versions")
async def list_rate_chart_versions(
    species: str | None = None,
    page: int = 1,
    pageSize: int = 50,
    uid: str = Depends(_manager),
):
    docs = await query("rate_charts", [("centerId", "==", uid)], limit=500)
    if species:
        docs = [d for d in docs if d.get("species") == species]
    docs.sort(key=lambda d: d.get("effectiveFrom", ""), reverse=True)
    return _envelope(docs, page, pageSize)


@router.post("/livestock/dairy/rate-chart", status_code=201)
async def create_rate_chart(body: RateChartIn, uid: str = Depends(_manager_no_agents)):
    await assert_fssai_kyc(uid)
    chart_id = f"rc_{uuid.uuid4().hex[:12]}"
    doc = {
        "id": chart_id,
        "centerId": uid,
        "species": body.species,
        "effectiveFrom": body.effectiveFrom,
        "baseRate": body.baseRate,
        "fatBase": body.fatBase,
        "snfBase": body.snfBase,
        "fatStep": body.fatStep,
        "snfStep": body.snfStep,
        "minRate": body.minRate,
        "minFat": body.minFat,
        "minSnf": body.minSnf,
        "active": body.active,
        "createdAt": _now(),
    }
    await set_doc("rate_charts", chart_id, doc)
    if body.active:
        await _deactivate_other_charts(uid, body.species, chart_id)
    return doc


@router.put("/livestock/dairy/rate-chart/{chart_id}")
async def update_rate_chart(chart_id: str, body: RateChartIn, uid: str = Depends(_manager_no_agents)):
    await assert_fssai_kyc(uid)
    doc = await get_doc("rate_charts", chart_id)
    if not doc or doc.get("centerId") != uid:
        _error(404, "RATE_CHART_NOT_FOUND", "rate chart not found")
    doc.update({
        "species": body.species,
        "effectiveFrom": body.effectiveFrom,
        "baseRate": body.baseRate,
        "fatBase": body.fatBase,
        "snfBase": body.snfBase,
        "fatStep": body.fatStep,
        "snfStep": body.snfStep,
        "minRate": body.minRate,
        "minFat": body.minFat,
        "minSnf": body.minSnf,
        "active": body.active,
        "updatedAt": _now(),
    })
    await set_doc("rate_charts", chart_id, doc)
    if body.active:
        await _deactivate_other_charts(uid, body.species, chart_id)
    return doc


# =========================================================================
# Payment batches
# =========================================================================

@router.get("/livestock/dairy/payments/batches")
async def list_payment_batches(
    page: int = 1,
    pageSize: int = 20,
    uid: str = Depends(_manager),
):
    docs = await query("payment_batches", [("centerId", "==", uid)], limit=500)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return _envelope(docs, page, pageSize)


@router.post("/livestock/dairy/payments/batches", status_code=201)
async def generate_payment_batch(body: PaymentBatchGenerateIn, uid: str = Depends(_manager_no_agents)):
    await assert_fssai_kyc(uid)
    members = await _center_members(uid)
    member_ids = {m["id"] for m in members}
    collections = await query("milk_collections", [], limit=2000)
    collections = [
        c for c in collections
        if c.get("memberId") in member_ids and body.periodFrom <= c.get("date", "") <= body.periodTo
    ]
    by_member: dict[str, dict] = {}
    for col in collections:
        bucket = by_member.setdefault(col["memberId"], {"liters": 0.0, "amount": 0.0})
        bucket["liters"] += col.get("liters", 0.0)
        bucket["amount"] += col.get("totalAmount", 0.0)
    batch_id = f"pb_{uuid.uuid4().hex[:12]}"
    entries = []
    for member in members:
        totals = by_member.get(member["id"])
        if not totals:
            continue
        deduction = round(member.get("deduction", 0.0), 2)
        amount = round(totals["amount"], 2)
        entry_id = f"pe_{uuid.uuid4().hex[:12]}"
        entries.append({
            "id": entry_id,
            "batchId": batch_id,
            "centerId": uid,
            "memberId": member["id"],
            "memberName": member.get("name", ""),
            "liters": round(totals["liters"], 2),
            "amount": amount,
            "deduction": deduction,
            "netAmount": round(amount - deduction, 2),
            "payoutRef": "",
            "status": "pending",
            "createdAt": _now(),
        })
    batch = {
        "id": batch_id,
        "centerId": uid,
        "periodFrom": body.periodFrom,
        "periodTo": body.periodTo,
        "status": "draft",
        "totalLiters": round(sum(e["liters"] for e in entries), 2),
        "totalAmount": round(sum(e["amount"] for e in entries), 2),
        "totalDeduction": round(sum(e["deduction"] for e in entries), 2),
        "totalNet": round(sum(e["netAmount"] for e in entries), 2),
        "createdAt": _now(),
    }
    await set_doc("payment_batches", batch_id, batch)
    for entry in entries:
        await set_doc("payment_entries", entry["id"], entry)
    # WS-05 task emission (module: dairy) — batch ready to approve.
    await emit_task(
        uid,
        persona="dairyManager",
        module="dairy",
        kind="payment_batch_ready",
        title_en="Milk payment batch ready",
        title_hi="दूध भुगतान बैच तैयार",
        subtitle=f"₹{batch['totalNet']} across {len(entries)} members",
        priority="today",
        deep_link=f"{DEEP_LINKS['dairy']}/payments/{batch_id}",
        source_id=batch_id,
    )
    return {**batch, "entries": entries}


@router.post("/livestock/dairy/payments/batches/{batch_id}/mark-paid")
async def mark_batch_paid(batch_id: str, body: PaymentBatchMarkPaidIn, uid: str = Depends(_manager_no_agents)):
    batch = await get_doc("payment_batches", batch_id)
    if not batch or batch.get("centerId") != uid:
        _error(404, "BATCH_NOT_FOUND", "payment batch not found")
    if batch.get("status") == "paid":
        _error(409, "ALREADY_PAID", "batch is already marked paid")
    entries = await query("payment_entries", [("batchId", "==", batch_id)], limit=1000)
    now_str = _now()
    for entry in entries:
        member = await get_doc("dairy_members", entry["memberId"])
        bank_details = (member or {}).get("bankDetails") or {}
        fund_account_id = (
            bank_details.get("fundAccountId")
            or bank_details.get("razorpayFundAccountId")
            or bank_details.get("accountNumber")
            or (member or {}).get("farmerUid")
            or entry["memberId"]
        )
        amount_paisa = int(round(float(entry.get("netAmount", 0)) * 100))
        ref_id = f"batch_{batch_id}_{entry['id']}"
        payout = await create_razorpayx_payout(fund_account_id, amount_paisa, ref_id)
        payout_id = body.payoutRef or payout.get("id") or f"UTR-{uuid.uuid4().hex[:10].upper()}"

        entry["status"] = "paid"
        entry["payoutRef"] = payout_id
        entry["paidAt"] = now_str
        await set_doc("payment_entries", entry["id"], entry)

        audit_id = f"aud_dairy_payout_{batch_id}_{entry['id']}"
        await set_doc(
            "audit_logs",
            audit_id,
            {
                "id": audit_id,
                "actor": uid,
                "action": "DAIRY_BATCH_PAYOUT",
                "status": "paid",
                "batchId": batch_id,
                "batch_id": batch_id,
                "memberId": entry["memberId"],
                "member_id": entry["memberId"],
                "amount": amount_paisa,
                "amountPaisa": amount_paisa,
                "payoutRef": payout_id,
                "entryId": entry["id"],
                "createdAt": now_str,
                "at": now_str,
            },
        )

        farmer_uid = (member or {}).get("farmerUid", "")
        await _notify(
            farmer_uid,
            "दूध भुगतान जमा (Milk Payment Paid)",
            f"आपका दूध भुगतान ₹{entry['netAmount']} जमा हो गया है।",
            {"kind": "payment_paid", "batchId": batch_id, "entryId": entry["id"],
             "netAmount": str(entry["netAmount"]), "payoutRef": payout_id},
        )
    batch["status"] = "paid"
    batch["paidAt"] = now_str
    if body.payoutRef:
        batch["payoutRef"] = body.payoutRef
    await set_doc("payment_batches", batch_id, batch)
    return batch


# =========================================================================
# Farmer self views
# =========================================================================

async def _member_for_farmer(uid: str) -> dict | None:
    members = await query("dairy_members", [("farmerUid", "==", uid)], limit=10)
    return members[0] if members else None


@router.get("/livestock/dairy/farmer/payments")
async def farmer_payments(
    page: int = 1,
    pageSize: int = 20,
    uid: str = Depends(_livestock_user),
):
    member = await _member_for_farmer(uid)
    if not member:
        return _envelope([], page, pageSize)
    docs = await query("payment_entries", [("memberId", "==", member["id"])], limit=500)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return _envelope(docs, page, pageSize)


@router.get("/livestock/dairy/farmer/slips")
async def farmer_slips(
    date_from: str | None = None,
    date_to: str | None = None,
    page: int = 1,
    pageSize: int = 20,
    uid: str = Depends(_livestock_user),
):
    member = await _member_for_farmer(uid)
    docs = await query("milk_collections", [], limit=2000)
    if member:
        code = member.get("memberCode", "")
        docs = [d for d in docs if d.get("farmerCode") == code or d.get("farmerId") == uid or d.get("memberId") == member["id"]]
    else:
        docs = [d for d in docs if d.get("farmerId") == uid]
    if date_from:
        docs = [d for d in docs if d.get("date", "") >= date_from]
    if date_to:
        docs = [d for d in docs if d.get("date", "") <= date_to]
    docs.sort(key=lambda d: d.get("date", ""), reverse=True)
    return {
        **_envelope(docs, page, pageSize),
        "memberCode": (member or {}).get("memberCode", ""),
        "memberId": (member or {}).get("id", ""),
    }


# =========================================================================
# Milk sales
# =========================================================================

@router.get("/livestock/dairy/sales/customers")
async def list_sale_customers(
    page: int = 1,
    pageSize: int = 50,
    uid: str = Depends(_manager),
):
    docs = await query("milk_sale_customers", [("centerId", "==", uid)], limit=500)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return _envelope(docs, page, pageSize)


@router.post("/livestock/dairy/sales/customers", status_code=201)
async def create_sale_customer(body: MilkSaleCustomerIn, uid: str = Depends(_manager)):
    customer_id = f"msc_{uuid.uuid4().hex[:12]}"
    doc = {
        "id": customer_id,
        "centerId": uid,
        "name": body.name,
        "phone": body.phone,
        "type": body.type,
        "address": body.address,
        "route": body.route,
        "dailyLitersAM": body.dailyLitersAM,
        "dailyLitersPM": body.dailyLitersPM,
        "ratePerLiter": body.ratePerLiter,
        "status": body.status,
        "createdAt": _now(),
    }
    await set_doc("milk_sale_customers", customer_id, doc)
    return doc


@router.put("/livestock/dairy/sales/customers/{customer_id}")
async def update_sale_customer(customer_id: str, body: MilkSaleCustomerIn, uid: str = Depends(_manager)):
    doc = await get_doc("milk_sale_customers", customer_id)
    if not doc or doc.get("centerId") != uid:
        _error(404, "CUSTOMER_NOT_FOUND", "customer not found")
    doc.update({
        "name": body.name,
        "phone": body.phone,
        "type": body.type,
        "address": body.address,
        "route": body.route,
        "dailyLitersAM": body.dailyLitersAM,
        "dailyLitersPM": body.dailyLitersPM,
        "ratePerLiter": body.ratePerLiter,
        "status": body.status,
        "updatedAt": _now(),
    })
    await set_doc("milk_sale_customers", customer_id, doc)
    return doc


@router.get("/livestock/dairy/sales/orders")
async def list_sale_orders(
    status: str | None = None,
    page: int = 1,
    pageSize: int = 50,
    uid: str = Depends(_manager),
):
    docs = await query("milk_sale_orders", [("centerId", "==", uid)], limit=1000)
    if status:
        docs = [d for d in docs if d.get("status") == status]
    docs.sort(key=lambda d: d.get("orderDate", ""), reverse=True)
    return _envelope(docs, page, pageSize)


@router.post("/livestock/dairy/sales/orders", status_code=201)
async def create_sale_order(body: MilkSaleOrderIn, uid: str = Depends(_manager)):
    customer = await get_doc("milk_sale_customers", body.customerId)
    if not customer or customer.get("centerId") != uid:
        _error(404, "CUSTOMER_NOT_FOUND", "customer not found")
    if body.items:
        amount = round(sum(i.qty * i.unitPrice for i in body.items), 2)
    elif body.amount is not None:
        amount = body.amount
    else:
        amount = round(body.liters * customer.get("ratePerLiter", 0.0), 2)
    order_id = f"mso_{uuid.uuid4().hex[:12]}"
    doc = {
        "id": order_id,
        "centerId": uid,
        "customerId": body.customerId,
        "customerName": customer.get("name", ""),
        "orderDate": body.orderDate,
        "shift": body.shift,
        "liters": body.liters,
        "items": [i.model_dump() for i in body.items],
        "amount": amount,
        "status": "scheduled",
        "createdAt": _now(),
    }
    await set_doc("milk_sale_orders", order_id, doc)
    return doc


@router.post("/livestock/dairy/sales/orders/{order_id}/status")
async def update_sale_order_status(order_id: str, body: MilkSaleOrderStatusIn, uid: str = Depends(_manager)):
    doc = await get_doc("milk_sale_orders", order_id)
    if not doc or doc.get("centerId") != uid:
        _error(404, "ORDER_NOT_FOUND", "order not found")
    if _ORDER_NEXT.get(doc.get("status")) != body.status:
        _error(409, "INVALID_TRANSITION", f"cannot move order from {doc.get('status')} to {body.status}")
    doc["status"] = body.status
    if body.status == "delivered":
        doc["deliveredAt"] = _now()
        # WS-03: buyer rates the dairy center on delivered collection order.
        await open_rating_prompt(doc.get("buyerId"), doc.get("centerId") or uid, order_id, "dairy_collection")
    doc["updatedAt"] = _now()
    await set_doc("milk_sale_orders", order_id, doc)
    return doc


@router.get("/livestock/dairy/sales/summary")
async def sales_summary(date_from: str | None = None, date_to: str | None = None, uid: str = Depends(_manager)):
    docs = await query("milk_sale_orders", [("centerId", "==", uid)], limit=1000)
    if date_from:
        docs = [d for d in docs if d.get("orderDate", "") >= date_from]
    if date_to:
        docs = [d for d in docs if d.get("orderDate", "") <= date_to]
    by_status: dict[str, int] = {}
    for d in docs:
        key = d.get("status", "unknown")
        by_status[key] = by_status.get(key, 0) + 1
    return {
        "totalOrders": len(docs),
        "totalLiters": round(sum(d.get("liters", 0.0) for d in docs), 2),
        "totalAmount": round(sum(d.get("amount", 0.0) for d in docs), 2),
        "collectedAmount": round(sum(d.get("amount", 0.0) for d in docs if d.get("status") == "paid"), 2),
        "byStatus": by_status,
    }


# =========================================================================
# Stock
# =========================================================================

@router.get("/livestock/dairy/stock/items")
async def list_stock_items(
    page: int = 1,
    pageSize: int = 50,
    uid: str = Depends(_manager),
):
    docs = await query("dairy_stock_items", [("centerId", "==", uid)], limit=500)
    docs.sort(key=lambda d: d.get("name", ""))
    return _envelope(docs, page, pageSize)


@router.post("/livestock/dairy/stock/items", status_code=201)
async def create_stock_item(body: StockItemIn, uid: str = Depends(_manager)):
    item_id = f"stk_{uuid.uuid4().hex[:12]}"
    doc = {
        "id": item_id,
        "centerId": uid,
        "name": body.name,
        "category": body.category,
        "unit": body.unit,
        "stockQty": body.stockQty,
        "unitPrice": body.unitPrice,
        "expiryDate": body.expiryDate,
        "createdAt": _now(),
    }
    await set_doc("dairy_stock_items", item_id, doc)
    return doc


@router.post("/livestock/dairy/stock/items/{item_id}/adjust")
async def adjust_stock_item(item_id: str, body: StockAdjustIn, uid: str = Depends(_manager)):
    doc = await get_doc("dairy_stock_items", item_id)
    if not doc or doc.get("centerId") != uid:
        _error(404, "STOCK_NOT_FOUND", "stock item not found")
    doc["stockQty"] = round(doc.get("stockQty", 0.0) + body.delta, 2)
    doc["lastAdjustment"] = {"delta": body.delta, "reason": body.reason, "at": _now()}
    await set_doc("dairy_stock_items", item_id, doc)
    return doc


# =========================================================================
# Reports
# =========================================================================

@router.get("/livestock/dairy/reports/daily")
async def daily_report(date: str | None = None, uid: str = Depends(_manager)):
    target = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    collections = await query("milk_collections", [("date", "==", target)], limit=1000)
    collections = [c for c in collections if c.get("dairyId") == uid]
    orders = await query("milk_sale_orders", [("centerId", "==", uid)], limit=1000)
    orders = [o for o in orders if o.get("orderDate") == target]
    stock = await query("dairy_stock_items", [("centerId", "==", uid)], limit=500)
    return {
        "date": target,
        "collections": {
            "count": len(collections),
            "liters": round(sum(c.get("liters", 0.0) for c in collections), 2),
            "amount": round(sum(c.get("totalAmount", 0.0) for c in collections), 2),
        },
        "sales": {
            "orders": len(orders),
            "liters": round(sum(o.get("liters", 0.0) for o in orders), 2),
            "amount": round(sum(o.get("amount", 0.0) for o in orders), 2),
        },
        "closingStock": [
            {"id": s["id"], "name": s.get("name"), "stockQty": s.get("stockQty", 0.0), "unit": s.get("unit")}
            for s in stock
        ],
    }


@router.get("/livestock/dairy/reports/pl")
async def pl_report(month: str | None = None, uid: str = Depends(_manager)):
    target = month or datetime.now(timezone.utc).strftime("%Y-%m")
    collections = await query("milk_collections", [], limit=2000)
    collections = [
        c for c in collections
        if c.get("dairyId") == uid and c.get("date", "").startswith(target)
    ]
    orders = await query("milk_sale_orders", [("centerId", "==", uid)], limit=1000)
    orders = [
        o for o in orders
        if o.get("orderDate", "").startswith(target) and o.get("status") in ("delivered", "billed", "paid")
    ]
    procurement_cost = round(sum(c.get("totalAmount", 0.0) for c in collections), 2)
    sales_income = round(sum(o.get("amount", 0.0) for o in orders), 2)
    return {
        "month": target,
        "procurementCost": procurement_cost,
        "salesIncome": sales_income,
        "grossProfit": round(sales_income - procurement_cost, 2),
        "collectionsCount": len(collections),
        "ordersCount": len(orders),
    }


# =========================================================================
# Analytics
# =========================================================================

def _shift_month(month: str, delta: int) -> str:
    year, mon = int(month[:4]), int(month[5:7])
    mon += delta
    while mon > 12:
        mon -= 12
        year += 1
    while mon < 1:
        mon += 12
        year -= 1
    return f"{year:04d}-{mon:02d}"


def _last_months(n: int) -> list[str]:
    current = datetime.now(timezone.utc).strftime("%Y-%m")
    return [_shift_month(current, -i) for i in range(n - 1, -1, -1)]


def _daily_series(docs: list[dict], date_key: str) -> list[dict]:
    by_date: dict[str, dict] = {}
    for d in docs:
        day = by_date.setdefault(d.get(date_key, ""), {"liters": 0.0, "amount": 0.0, "count": 0})
        day["liters"] = round(day["liters"] + d.get("liters", 0.0), 2)
        day["amount"] = round(day["amount"] + d.get("totalAmount", d.get("amount", 0.0)), 2)
        day["count"] += 1
    return [
        {"date": day, **vals}
        for day, vals in sorted(by_date.items(), key=lambda kv: kv[0])
    ]


@router.get("/livestock/dairy/analytics")
async def dairy_analytics(month: str | None = None, uid: str = Depends(_manager)):
    target = month or datetime.now(timezone.utc).strftime("%Y-%m")
    previous = _shift_month(target, -1)
    collections = await query("milk_collections", [], limit=3000)
    mine = [c for c in collections if c.get("dairyId") == uid]
    month_cols = [c for c in mine if c.get("date", "").startswith(target)]
    prev_cols = [c for c in mine if c.get("date", "").startswith(previous)]

    members = await _center_members(uid)
    name_by_id = {m["id"]: m.get("name", "") for m in members}
    by_member: dict[str, dict] = {}
    for c in month_cols:
        key = c.get("memberId") or c.get("farmerCode") or "unknown"
        bucket = by_member.setdefault(key, {"memberId": key, "name": "", "liters": 0.0, "amount": 0.0, "collections": 0})
        bucket["liters"] = round(bucket["liters"] + c.get("liters", 0.0), 2)
        bucket["amount"] = round(bucket["amount"] + c.get("totalAmount", 0.0), 2)
        bucket["collections"] += 1
    top_members = sorted(by_member.values(), key=lambda b: b["liters"], reverse=True)[:10]
    for bucket in top_members:
        bucket["name"] = name_by_id.get(bucket["memberId"], bucket["memberId"])

    by_species: dict[str, dict] = {}
    by_shift: dict[str, dict] = {}
    for c in month_cols:
        sp = by_species.setdefault(c.get("milkType", "cow"), {"liters": 0.0, "amount": 0.0})
        sp["liters"] = round(sp["liters"] + c.get("liters", 0.0), 2)
        sp["amount"] = round(sp["amount"] + c.get("totalAmount", 0.0), 2)
        sh = by_shift.setdefault(c.get("shift", "morning"), {"liters": 0.0, "count": 0})
        sh["liters"] = round(sh["liters"] + c.get("liters", 0.0), 2)
        sh["count"] += 1

    orders = await query("milk_sale_orders", [("centerId", "==", uid)], limit=1000)
    month_orders = [o for o in orders if o.get("orderDate", "").startswith(target)]
    prev_orders = [o for o in orders if o.get("orderDate", "").startswith(previous)]
    by_status: dict[str, int] = {}
    for o in month_orders:
        key = o.get("status", "unknown")
        by_status[key] = by_status.get(key, 0) + 1

    entries = await query("payment_entries", [("centerId", "==", uid)], limit=1000)
    pending = [e for e in entries if e.get("status") == "pending"]

    def _cols_totals(cols: list[dict]) -> dict:
        return {
            "liters": round(sum(c.get("liters", 0.0) for c in cols), 2),
            "amount": round(sum(c.get("totalAmount", 0.0) for c in cols), 2),
        }

    def _orders_totals(os: list[dict]) -> dict:
        return {
            "liters": round(sum(o.get("liters", 0.0) for o in os), 2),
            "amount": round(sum(o.get("amount", 0.0) for o in os), 2),
            "orders": len(os),
        }

    return {
        "month": target,
        "collections": {
            **_cols_totals(month_cols),
            "count": len(month_cols),
            "avgFat": round(sum(c.get("fatPercent", 0.0) for c in month_cols) / len(month_cols), 2) if month_cols else 0.0,
            "avgSnf": round(sum(c.get("snfPercent", 0.0) for c in month_cols) / len(month_cols), 2) if month_cols else 0.0,
            "bySpecies": by_species,
            "byShift": by_shift,
            "daily": _daily_series(month_cols, "date"),
            "topMembers": top_members,
        },
        "sales": {
            **_orders_totals(month_orders),
            "byStatus": by_status,
            "daily": _daily_series(month_orders, "orderDate"),
        },
        "dues": {
            "pendingNet": round(sum(e.get("netAmount", 0.0) for e in pending), 2),
            "pendingEntries": len(pending),
        },
        "previousMonth": {
            "collections": _cols_totals(prev_cols),
            "sales": _orders_totals(prev_orders),
        },
    }


@router.get("/livestock/dairy/farmer/analytics")
async def farmer_analytics(uid: str = Depends(_livestock_user)):
    member = await _member_for_farmer(uid)
    months = _last_months(6)
    zero_totals = {"liters": 0.0, "amount": 0.0, "paid": 0.0, "pending": 0.0}
    if not member:
        return {"member": None, "monthly": [], "totals": zero_totals}
    collections = await query("milk_collections", [], limit=3000)
    code = member.get("memberCode", "")
    mine = [
        c for c in collections
        if c.get("memberId") == member["id"] or (code and c.get("farmerCode") == code)
    ]
    payments = await query("payment_entries", [("memberId", "==", member["id"])], limit=500)
    monthly_map: dict[str, dict] = {
        m: {"month": m, "liters": 0.0, "amount": 0.0, "paid": 0.0} for m in months
    }
    for c in mine:
        key = c.get("date", "")[:7]
        if key in monthly_map:
            monthly_map[key]["liters"] = round(monthly_map[key]["liters"] + c.get("liters", 0.0), 2)
            monthly_map[key]["amount"] = round(monthly_map[key]["amount"] + c.get("totalAmount", 0.0), 2)
    for p in payments:
        key = p.get("createdAt", "")[:7]
        if p.get("status") == "paid" and key in monthly_map:
            monthly_map[key]["paid"] = round(monthly_map[key]["paid"] + p.get("netAmount", 0.0), 2)
    return {
        "member": {"id": member["id"], "name": member.get("name", ""), "memberCode": code},
        "monthly": [monthly_map[m] for m in months],
        "totals": {
            "liters": round(sum(c.get("liters", 0.0) for c in mine), 2),
            "amount": round(sum(c.get("totalAmount", 0.0) for c in mine), 2),
            "paid": round(sum(p.get("netAmount", 0.0) for p in payments if p.get("status") == "paid"), 2),
            "pending": round(sum(p.get("netAmount", 0.0) for p in payments if p.get("status") == "pending"), 2),
        },
    }
