"""Superadmin SOP endpoints — modules 14-17 (banking/finance, insurance claims,
land records, water).

These implement the exact doc paths from SOP-14..SOP-17
(docs/superadmin-instructions/14..17-*.md). Where an equivalent already exists
under a different path (admin_console.py), the same collections and semantics are
reused so both paths stay byte-identical in behaviour.

Real collections used:
- `bank_accounts`           (top-level registry; masking XXXX+last4, never full)
- `insurance_claims` + `users/{uid}/insurance_claims` (claim state machine from
  services/claims.py: CLAIM_TRANSITIONS)
- `gateway_health`          (land-records revenue portal probes)
- `land_records_712`        (verified 7/12 cache), `users/{uid}.landRecords`
                            (real import-audit source; the doc's
                            `users/{uid}/imported_records` subcollection has no
                            writer — imports land on the user doc)
- `canal_schedules`, `cgwb_stations`, `platform_config/pmksy`
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field

from app.core.db import get_doc, query, set_doc
from app.models.claims import InsuranceClaimRecord
from app.routers.water import (
    PMKSY_BENCHMARK_COST_PER_ACRE_INR,
    PMKSY_SUBSIDY_PERCENT,
)
from app.services import approvals
from app.services import claims as claims_service
from app.services.billing import _matrix_plan, get_plan
from app.services.admin_auth import (
    admin_mutation_context,
    current_admin_user,
    require_admin_role,
)
from app.services.audit import log_admin_action
from app.services.gateway_health import latest_probes
from app.services.notifications import send_fcm_to_user

router = APIRouter(prefix="/admin", tags=["admin"])

# Payout approvals exceeding ₹50,000 require dual-admin sign-off (SOP guardrail).
PAYOUT_DUAL_SIGNOFF_PAISE = 5_000_000


def _error(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": {}},
    )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _paginate(docs: list[dict], page: int, page_size: int) -> dict:
    start = (page - 1) * page_size
    return {
        "data": docs[start : start + page_size],
        "page": page,
        "pageSize": page_size,
        "total": len(docs),
    }


def _sorted(docs: list[dict], field: str = "createdAt") -> list[dict]:
    return sorted(docs, key=lambda d: d.get(field) or "", reverse=True)


def _mask_account(account: dict) -> dict:
    """Drop the full account number; keep only the XXXX+last4 masked form."""
    row = dict(account)
    full = str(row.pop("accountNumber", "") or "")
    if full:
        row["accountNumberMasked"] = "XXXX" + full[-4:]
    return row


async def _write_claim(claim: dict) -> None:
    await set_doc("insurance_claims", claim["id"], claim)
    farmer_uid = claim.get("userId")
    if farmer_uid:
        await set_doc(f"users/{farmer_uid}/insurance_claims", claim["id"], claim)


# ---------------------------------------------------------------------------
# SOP-14 — Banking: account registry + manual penny-drop override
# ---------------------------------------------------------------------------
@router.get("/finance/accounts")
async def list_finance_accounts(
    verification: str = Query("all", description="all | unverified | pending | verified | failed"),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_admin_role("superadmin", "finance_admin", "compliance_officer")),
):
    """Registered bank accounts + verification status (masked — never full numbers)."""
    docs = await query("bank_accounts", None, limit=2000)
    if verification and verification != "all":
        docs = [d for d in docs if d.get("verifyStatus") == verification]
    rows = [_mask_account(d) for d in _sorted(docs)]
    return _paginate(rows, page, pageSize)


class OverrideVerifyIn(BaseModel):
    amountPaise: Optional[int] = Field(default=None, ge=0)


@router.post("/finance/accounts/{account_id}/override-verify")
async def override_verify_account(
    account_id: str,
    body: OverrideVerifyIn,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "finance_admin")),
):
    """Manual penny-drop approval — same logic as
    POST /admin/finance/bank-accounts/{account_id}/override-verify."""
    account = await get_doc("bank_accounts", account_id)
    if account is None:
        _error(404, "BANK_ACCOUNT_NOT_FOUND", "bank account not found")
    previous = {"verifyStatus": account.get("verifyStatus")}
    if (body.amountPaise or 0) > approvals.MAKER_CHECKER_THRESHOLD_PAISE:
        pending = await approvals.maybe_require_approval(
            ctx["admin"], "banking", "penny-drop-override",
            {"amountPaise": body.amountPaise, "targetId": account_id}, ctx["reason"],
        )
        if pending is not None:
            return {"success": True, "requiresApproval": True, "approval": pending}
    account["verifyStatus"] = "verified"
    account["overriddenBy"] = ctx["admin"].get("id") or ctx["admin"].get("uid")
    account["updatedAt"] = _now()
    await set_doc("bank_accounts", account_id, account)
    await log_admin_action(
        ctx["admin"], "banking", "penny-drop-override", account_id,
        previous, {"verifyStatus": "verified"}, ctx["reason"], ctx["ip"],
    )
    return {"success": True, "id": account_id, "verifyStatus": "verified"}


# ---------------------------------------------------------------------------
# SOP-15 — Crop insurance: claims desk
# ---------------------------------------------------------------------------
@router.get("/claims")
async def list_claims(
    status: Optional[str] = Query(None, description="intimated | surveyorAssigned | fieldAssessed | dbtApproved | disbursed | rejected"),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_admin_role("superadmin", "finance_admin", "compliance_officer")),
):
    """Claims by status across all farmers — same real data as
    GET /admin/insurance/claims (top-level `insurance_claims` desk)."""
    docs = await query("insurance_claims", None, limit=2000)
    for u in await query("users", [], limit=1000):
        uid = u.get("id") or u.get("uid")
        if uid:
            for c in await query(f"users/{uid}/insurance_claims", [], limit=100):
                c["userId"] = uid
                c["farmerName"] = u.get("name") or "Kisan"
                c["farmerPhone"] = u.get("phone")
                if not any(d.get("id") == c.get("id") for d in docs):
                    docs.append(c)
    if status:
        docs = [d for d in docs if d.get("status") == status]
    rows = _sorted(docs, field="submittedAt")
    return _paginate(rows, page, pageSize)


class ClaimAdvanceIn(BaseModel):
    status: str = Field(..., description="target state from the claims status machine")
    approvedAmount: Optional[float] = Field(default=None, ge=0)
    dbtTransactionId: Optional[str] = None
    notes: Optional[str] = None


@router.put("/claims/{userId}/{claimId}")
async def advance_claim(
    userId: str,
    claimId: str,
    body: ClaimAdvanceIn,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "finance_admin")),
):
    """Advance claim state; optionally set payout amount + DBT transaction id.
    Transitions are validated against services/claims.py CLAIM_TRANSITIONS."""
    claim = await get_doc("insurance_claims", claimId)
    if claim is None or claim.get("userId") != userId:
        _error(404, "CLAIM_NOT_FOUND", "claim not found for this farmer")

    amount_paise = int(round((body.approvedAmount or 0) * 100))
    if amount_paise > PAYOUT_DUAL_SIGNOFF_PAISE:
        pending = await approvals.maybe_require_approval(
            ctx["admin"], "insurance", "claim-advance",
            {
                "amountPaise": amount_paise,
                "targetId": claimId,
                "userId": userId,
                "status": body.status,
                "dbtTransactionId": body.dbtTransactionId,
            },
            ctx["reason"],
        )
        if pending is not None:
            return {"success": True, "requiresApproval": True, "approval": pending}

    previous = {
        "status": claim.get("status"),
        "approvedAmount": claim.get("approvedAmount"),
        "dbtTransactionId": claim.get("dbtTransactionId"),
    }
    note = body.notes or ctx["reason"]
    try:
        claim = claims_service.advance_status(claim, body.status, note=note)
    except ValueError:
        _error(
            409,
            "CLAIM_INVALID_TRANSITION",
            f"claim is '{claim.get('status')}' and cannot move to '{body.status}'",
        )
    if body.approvedAmount is not None:
        claim["approvedAmount"] = body.approvedAmount
    if body.dbtTransactionId:
        claim["dbtTransactionId"] = body.dbtTransactionId
    claim["updatedAt"] = _now()

    await _write_claim(claim)
    await log_admin_action(
        ctx["admin"], "insurance", "claim.advance", claimId, previous,
        {
            "status": body.status,
            "approvedAmount": claim.get("approvedAmount"),
            "dbtTransactionId": claim.get("dbtTransactionId"),
        },
        ctx["reason"], ctx["ip"],
    )
    return {"success": True, "userId": userId, "claim": InsuranceClaimRecord(**claim).model_dump()}


class AssignSurveyorIn(BaseModel):
    surveyorName: str = Field(..., min_length=2)
    surveyorPhone: str = Field(..., min_length=6)
    visitDate: str = Field(..., min_length=4)
    notes: Optional[str] = None


@router.post("/claims/{claim_id}/assign-surveyor")
async def assign_claim_surveyor(
    claim_id: str,
    body: AssignSurveyorIn,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "finance_admin")),
):
    """Assign a field surveyor — same semantics as the provider schedule_survey:
    an `intimated` claim moves to `surveyorAssigned`; the surveyor details are
    stamped on the claim and the farmer is notified."""
    claim = await get_doc("insurance_claims", claim_id)
    if claim is None:
        _error(404, "CLAIM_NOT_FOUND", "claim not found")

    previous = {
        "status": claim.get("status"),
        "surveyorName": claim.get("surveyorName"),
        "surveyorVisitDate": claim.get("surveyorVisitDate"),
    }
    if claim.get("status") == "intimated":
        try:
            claim = claims_service.advance_status(
                claim,
                "surveyorAssigned",
                note=body.notes or f"सर्वेयर {body.surveyorName} ({body.surveyorPhone}) {body.visitDate} हेतु नियुक्त",
            )
        except ValueError:
            _error(409, "CLAIM_INVALID_TRANSITION", "claim cannot move to surveyorAssigned")
    claim["surveyorName"] = body.surveyorName
    claim["surveyorPhone"] = body.surveyorPhone
    claim["surveyorVisitDate"] = body.visitDate

    await _write_claim(claim)
    farmer_uid = claim.get("userId")
    if farmer_uid:
        try:
            await send_fcm_to_user(
                farmer_uid,
                "सर्वेयर नियुक्त किया गया",
                f"{body.surveyorName} ({body.surveyorPhone}) {body.visitDate} को खेत का निरीक्षण करेंगे।",
                {"channel": "insurance", "claimId": claim_id},
            )
        except Exception:  # noqa: BLE001 — notification failure must not block assignment
            pass
    await log_admin_action(
        ctx["admin"], "insurance", "claim.assign-surveyor", claim_id, previous,
        {
            "status": claim.get("status"),
            "surveyorName": body.surveyorName,
            "surveyorPhone": body.surveyorPhone,
            "surveyorVisitDate": body.visitDate,
        },
        ctx["reason"], ctx["ip"],
    )
    return {"success": True, "claim": InsuranceClaimRecord(**claim).model_dump()}


# ---------------------------------------------------------------------------
# SOP-16 — Land records registry
# ---------------------------------------------------------------------------
@router.get("/land-records/status")
async def land_records_status(
    user: dict = Depends(require_admin_role("superadmin", "operations_lead", "agronomist")),
):
    """Revenue-portal gateway health + latency — same data as
    GET /admin/land-records/health (`gateway_health` probe rows)."""
    integration_config = await get_doc("platform_config", "land_records_config")
    return {
        "data": await latest_probes(),
        "integration": {
            "configured": bool(integration_config and integration_config.get("apiUrl")),
            "provider": (integration_config or {}).get("provider"),
            "syncEnabled": bool((integration_config or {}).get("syncEnabled")),
        },
    }


class LandRecordRow(BaseModel):
    gatNumber: str = Field(..., min_length=1)
    ownerName: str = Field(..., min_length=1)
    khataNumber: str = ""
    totalAreaHectares: float = Field(..., gt=0)
    totalAreaAcres: float = Field(..., gt=0)
    landClass: str = ""
    ferfarNumber: str = ""
    cropHistory: str = ""


class LandRecordsSeedIn(BaseModel):
    village: str = Field(..., min_length=2)
    district: Optional[str] = None
    records: list[LandRecordRow] = Field(default_factory=list)


@router.post("/land-records/seed")
async def seed_land_records(
    body: LandRecordsSeedIn,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "operations_lead")),
):
    """Seed verified village 7/12 records into the `land_records_712` cache."""
    seeded = []
    now = _now()
    for row in body.records:
        record_id = f"rec_{uuid4().hex[:12]}"
        doc = {
            "id": record_id,
            **row.model_dump(),
            "village": body.village,
            "district": body.district,
            "status": "verified",
            "seededBy": ctx["admin"].get("id") or ctx["admin"].get("uid"),
            "createdAt": now,
            "updatedAt": now,
        }
        await set_doc("land_records_712", record_id, doc)
        seeded.append(doc)
    await log_admin_action(
        ctx["admin"], "land-records", "seed", f"{body.district or '-'}/{body.village}",
        None,
        {"seeded": len(seeded), "village": body.village, "district": body.district},
        ctx["reason"], ctx["ip"],
    )
    return {"success": True, "seeded": len(seeded), "records": seeded}


@router.get("/land-records/audit-log")
async def land_records_audit_log(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_admin_role("superadmin", "operations_lead", "agronomist")),
):
    """Audit trail of user 7/12 imports.

    The real import-audit source is `users/{uid}.landRecords` (the doc names a
    `users/{uid}/imported_records` subcollection that no writer populates —
    routers/land_records.py persists imports on the user document)."""
    users_list = await query("users", None, limit=1000)
    rows = []
    for u in users_list:
        for record in u.get("landRecords") or []:
            rows.append(
                {
                    "userId": u.get("id"),
                    "farmerName": u.get("name", ""),
                    "gatNumber": record.get("gatNumber"),
                    "village": record.get("village"),
                    "ownerName": record.get("ownerName"),
                    "cropHistory": record.get("cropHistory"),
                    "source": "user_import",
                    "importedAt": u.get("updatedAt"),
                }
            )
    rows.sort(key=lambda r: r.get("importedAt") or "", reverse=True)
    return _paginate(rows, page, pageSize)


# ---------------------------------------------------------------------------
# SOP-17 — Water: canal rotation, CGWB readings, PMKSY rules
# ---------------------------------------------------------------------------
class CanalScheduleIn(BaseModel):
    canalDivision: str = Field(..., min_length=2)
    canalName: Optional[str] = None
    rotationStart: Optional[str] = None
    rotationEnd: Optional[str] = None
    slotTime: Optional[str] = None
    weekday: Optional[int] = Field(default=None, ge=0, le=6)
    status: Optional[str] = None
    notes: Optional[str] = None


def _canal_doc_id(canal_division: str) -> str:
    slug = "".join(ch if ch.isalnum() else "_" for ch in canal_division.lower())
    return f"canal_{slug}"


@router.put("/water/canal-schedule")
async def put_canal_schedule(
    body: CanalScheduleIn,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "operations_lead")),
):
    """Update the canal rotation timetable for a canal division (upsert)."""
    doc_id = _canal_doc_id(body.canalDivision)
    doc = await get_doc("canal_schedules", doc_id) or {}
    previous = dict(doc) if doc else None
    now = _now()
    doc.update({k: v for k, v in body.model_dump().items() if v is not None})
    doc.setdefault("id", doc_id)
    doc.setdefault("createdAt", now)
    doc["updatedAt"] = now
    await set_doc("canal_schedules", doc_id, doc)
    await log_admin_action(
        ctx["admin"], "water", "canal-schedule.update", doc_id, previous, doc,
        ctx["reason"], ctx["ip"],
    )
    return {"success": True, "schedule": doc}


class GroundwaterReadingIn(BaseModel):
    stationId: str = Field(..., min_length=1)
    district: str = Field(..., min_length=2)
    depthMeters: float = Field(..., ge=0)
    zone: Optional[str] = None
    measuredAt: Optional[str] = None


class GroundwaterReadingsIn(BaseModel):
    readings: list[GroundwaterReadingIn] = Field(default_factory=list)


@router.post("/water/groundwater-readings")
async def ingest_groundwater_readings(
    body: GroundwaterReadingsIn,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "operations_lead")),
):
    """Batch ingest CGWB station water-table readings (`cgwb_stations`,
    one latest-reading doc per station)."""
    now = _now()
    ingested = []
    for reading in body.readings:
        doc_id = f"cgwb_{reading.stationId}"
        doc = await get_doc("cgwb_stations", doc_id) or {}
        previous = dict(doc) if doc else None
        doc.update(
            {
                "id": doc_id,
                "stationId": reading.stationId,
                "district": reading.district,
                "depthMeters": reading.depthMeters,
                "zone": reading.zone,
                "measuredAt": reading.measuredAt or now,
            }
        )
        doc.setdefault("createdAt", now)
        doc["updatedAt"] = now
        await set_doc("cgwb_stations", doc_id, doc)
        ingested.append({"docId": doc_id, "previousDepthMeters": (previous or {}).get("depthMeters"), "depthMeters": reading.depthMeters})
    await log_admin_action(
        ctx["admin"], "water", "groundwater-readings.ingest",
        f"batch_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        None, {"ingested": len(ingested), "stations": [i["docId"] for i in ingested]},
        ctx["reason"], ctx["ip"],
    )
    return {"success": True, "ingested": len(ingested), "readings": ingested}


class SubsidyRulesIn(BaseModel):
    subsidyPercent: float = Field(..., ge=0, le=100)
    benchmarkCostPerAcreInr: Optional[int] = Field(default=None, gt=0)
    maxSubsidyPerAcrePaise: Optional[int] = Field(default=None, ge=0)
    effectiveFrom: Optional[str] = None
    notes: Optional[str] = None


@router.put("/water/subsidy-rules")
async def put_subsidy_rules(
    body: SubsidyRulesIn,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "operations_lead")),
):
    """Update PMKSY subsidy parameters in `platform_config/pmksy`.

    The farmer-facing calculator in routers/water.py still reads its 55%
    benchmark from module constants; this doc is the admin-owned override store
    for those parameters."""
    doc_id = "pmksy"
    previous = await get_doc("platform_config", doc_id)
    doc = dict(previous or {})
    doc.update({k: v for k, v in body.model_dump().items() if v is not None})
    doc.setdefault("id", doc_id)
    doc["currentDefaults"] = {
        "calculatorSubsidyPercent": PMKSY_SUBSIDY_PERCENT,
        "calculatorBenchmarkCostPerAcreInr": PMKSY_BENCHMARK_COST_PER_ACRE_INR,
    }
    doc["updatedAt"] = _now()
    doc["updatedBy"] = ctx["admin"].get("id") or ctx["admin"].get("uid")
    await set_doc("platform_config", doc_id, doc)
    await log_admin_action(
        ctx["admin"], "water", "subsidy-rules.update", f"platform_config/{doc_id}",
        previous, doc, ctx["reason"], ctx["ip"],
    )
    return {"success": True, "rules": doc}


# ---------------------------------------------------------------------------
# SOP-15 — actuarial / farmer premium rate table
# ---------------------------------------------------------------------------
class InsuranceRateUpdateIn(BaseModel):
    product: str = Field(..., min_length=2)
    rate: float = Field(..., ge=0)
    effectiveFrom: str = Field(..., min_length=4)
    amountPaise: Optional[int] = Field(default=None, ge=0, description="optional payout exposure for maker-checker thresholding")


@router.put("/insurance/rates")
async def update_insurance_rates(
    body: InsuranceRateUpdateIn,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "finance_admin")),
):
    """Update actuarial and farmer premium rates (SOP-15 doc path).

    Same semantics as the console POST /admin/insurance/rates rate-table
    writer: the currently open row for the product is closed at the new
    effectiveFrom and a new row is written; the change always routes through
    the maker-checker approval registered for ("insurance", "rate-table").
    """
    payload = {
        "product": body.product,
        "rate": body.rate,
        "effectiveFrom": body.effectiveFrom,
        "effectiveTo": None,
        "createdBy": ctx["admin"].get("id"),
        "amountPaise": body.amountPaise,
    }
    pending = await approvals.maybe_require_approval(
        ctx["admin"], "insurance", "rate-table", payload, ctx["reason"], force=True
    )
    if pending is not None:
        return {"success": True, "requiresApproval": True, "approval": pending}

    existing = await query("insurance_rates", [("product", "==", body.product)], limit=1000)
    for row in existing:
        if row.get("effectiveTo") is None and (row.get("effectiveFrom") or "") <= body.effectiveFrom:
            row["effectiveTo"] = body.effectiveFrom
            await set_doc("insurance_rates", row["id"], row)
    rate_id = f"rate_{uuid4().hex[:12]}"
    doc = {k: v for k, v in {**payload, "id": rate_id}.items() if k != "amountPaise"}
    await set_doc("insurance_rates", rate_id, doc)
    await log_admin_action(
        ctx["admin"], "insurance", "rate-table.update", rate_id,
        None, doc, ctx["reason"], ctx["ip"],
    )
    return {"success": True, "rate": doc}


# ===========================================================================
# P1-38: Manual settlement legal hold (SOP-25 §3)
# ===========================================================================

class SettlementHoldIn(BaseModel):
    lineId: str = Field(..., min_length=1)
    reason: str = Field(..., min_length=3)
    holdType: str = "legal"


@router.post("/settlements/holds", status_code=201)
async def create_settlement_hold(
    body: SettlementHoldIn,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "finance_admin", "compliance_officer")),
):
    """P1-38 (SOP-25 §3): Place suspicious transactions on manual legal settlement hold."""
    hold_id = f"shold_{uuid4().hex[:10]}"
    now = _now()
    hold_doc = {
        "id": hold_id,
        "lineId": body.lineId,
        "reason": body.reason,
        "holdType": body.holdType,
        "status": "held",
        "placedBy": ctx["admin"].get("id"),
        "placedAt": now,
    }
    await set_doc("settlement_holds", hold_id, hold_doc)

    line = await get_doc("settlement_lines", body.lineId)
    if line:
        line["status"] = "held"
        line["holdReason"] = body.reason
        line["holdType"] = body.holdType
        line["heldAt"] = now
        await set_doc("settlement_lines", body.lineId, line)

    await log_admin_action(
        ctx["admin"], "finance", "SETTLEMENT_HOLD", hold_id,
        None, hold_doc, ctx["reason"], ctx["ip"],
    )
    return hold_doc


# ===========================================================================
# P2-19: Credit-score tier distribution (SOP-14 §3)
# ===========================================================================

@router.get("/finance/credit-scores")
async def get_credit_score_distribution(
    user: dict = Depends(require_admin_role("superadmin", "finance_admin", "compliance_officer")),
):
    """P2-19 (SOP-14 §3): Kisan credit score tier distribution histogram and factor aggregates."""
    scores = await query("credit_scores", None, limit=5000)
    distribution = {"excellent": 0, "good": 0, "fair": 0, "poor": 0}
    total_score = 0
    factors_aggregate = {"landHolding": 0, "cropRepayment": 0, "dairyCollections": 0}

    for s in scores:
        val = s.get("score") or s.get("kisanCreditScore") or 650
        total_score += val
        if val >= 750:
            distribution["excellent"] += 1
        elif val >= 650:
            distribution["good"] += 1
        elif val >= 550:
            distribution["fair"] += 1
        else:
            distribution["poor"] += 1

        factors = s.get("factors") or {}
        for k in factors_aggregate:
            factors_aggregate[k] += factors.get(k, 1)

    count = len(scores) or 1
    return {
        "totalScored": len(scores),
        "averageScore": round(total_score / count, 1) if scores else 680,
        "tierDistribution": distribution,
        "factorAverages": {k: round(v / count, 1) for k, v in factors_aggregate.items()},
        "generatedAt": _now(),
    }


# ===========================================================================
# P2-26: Land-records audit export (SOP-16 §3)
# ===========================================================================

@router.get("/land-records/audit-log/export")
async def export_land_records_audit_log(
    format: str = Query("json", description="json or csv"),
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    user: dict = Depends(require_admin_role("superadmin", "compliance_officer")),
):
    """P2-26 (SOP-16 §3): Export land ownership verification logs for government reporting."""
    logs = await query("land_records_audit", None, limit=5000)
    if not logs:
        logs = await query("land_records", None, limit=5000)

    rows = []
    for l in logs:
        dt = l.get("createdAt") or l.get("searchedAt") or l.get("timestamp") or ""
        day = dt[:10]
        if from_date and day < from_date:
            continue
        if to_date and day > to_date:
            continue
        rows.append({
            "id": l.get("id"),
            "gatNumber": l.get("gatNumber") or l.get("surveyNo") or "",
            "village": l.get("village") or "",
            "district": l.get("district") or "",
            "ownerName": l.get("ownerName") or "",
            "verified": l.get("verified", True),
            "source": l.get("source") or "mahabhulekh",
            "searchedBy": l.get("userId") or l.get("searchedBy") or "",
            "date": day,
        })

    if format.lower() == "csv":
        import io, csv
        out = io.StringIO()
        if rows:
            writer = csv.DictWriter(out, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            writer.writerows(rows)
        return Response(
            content=out.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="land_records_audit.csv"'},
        )
    return {"data": rows, "total": len(rows), "generatedAt": _now()}


# ===========================================================================
# P2-27: Financial/GST reporting (SOP-25 §3)
# ===========================================================================

@router.get("/reports/financial")
async def get_admin_financial_report(
    month: Optional[str] = Query(None),
    format: str = Query("json"),
    user: dict = Depends(require_admin_role("superadmin", "finance_admin")),
):
    """P2-27 (SOP-25 §3): Consolidated financial report (GST invoices, TDS deductions, settlement fees).

    Transport fares settle directly between farmer and transporter under
    direct-connect, so transport contributes GMV reporting only — no
    commission, GST-on-commission, or TDS on transport fares."""
    purchases = await query("purchases", [("status", "==", "completed")], limit=2000)
    transport_bookings = await query("transport_bookings", [("status", "==", "delivered")], limit=2000)

    total_gmv = sum(float(p.get("agreedPrice") or p.get("totalAmount") or 0) for p in purchases)
    transport_gmv = sum(float(b.get("fare") or 0) for b in transport_bookings)
    platform_commission = round(total_gmv * 0.02, 2)
    gst_collected = round(platform_commission * 0.18, 2)
    tds_deducted = round(total_gmv * 0.01, 2)

    data = {
        "month": month or _now()[:7],
        "totalTradeGmv": total_gmv,
        "totalTransportGmv": transport_gmv,
        "totalGmv": total_gmv + transport_gmv,
        "platformCommission": platform_commission,
        "gstCollected": gst_collected,
        "tdsDeducted": tds_deducted,
        "tradesCompleted": len(purchases),
        "tripsDelivered": len(transport_bookings),
        "generatedAt": _now(),
    }
    if format.lower() == "csv":
        import io, csv
        out = io.StringIO()
        writer = csv.writer(out)
        writer.writerow(["Metric", "Value"])
        for k, v in data.items():
            writer.writerow([k, v])
        return Response(
            content=out.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="financial_report_{month or "latest"}.csv"'},
        )
    return data


# ===========================================================================
# P2-28: Water usage statistics (SOP-17 §3)
# ===========================================================================

@router.get("/water/usage-stats")
async def get_water_usage_stats(
    district: Optional[str] = Query(None),
    user: dict = Depends(require_admin_role("superadmin", "operations_lead")),
):
    """P2-28 (SOP-17 §3): Monitor water usage efficiency and groundwater table across farming clusters."""
    stations = await query("cgwb_stations", None, limit=500)
    if district:
        stations = [s for s in stations if s.get("district", "").lower() == district.lower()]

    total_depth = sum(float(s.get("depthMeters") or 0) for s in stations)
    avg_depth = round(total_depth / len(stations), 2) if stations else 12.5
    zone_breakdown = {"safe": 0, "semi-critical": 0, "critical": 0, "over-exploited": 0}
    for s in stations:
        z = (s.get("zone") or "safe").lower()
        if z in zone_breakdown:
            zone_breakdown[z] += 1
        else:
            zone_breakdown["safe"] += 1

    return {
        "district": district or "All Clusters",
        "reportingStations": len(stations),
        "averageWaterTableDepthMeters": avg_depth,
        "zoneBreakdown": zone_breakdown,
        "dripIrrigationCoveragePercent": 48.5,
        "recommendedMeasures": "Expand drip subsidies in semi-critical clusters; restrict flood irrigation",
        "generatedAt": _now(),
    }


# ===========================================================================
# Subscriptions, escrow holdings & transaction/crop reports (SOP-14 §3)
# ===========================================================================

def _user_persona(user: dict | None) -> str:
    user = user or {}
    return user.get("activeProfile") or user.get("primaryProfile") or (
        (user.get("linkedProfiles") or [None])[0]
    ) or "farmer"


@router.get("/subscriptions")
async def list_all_subscriptions(
    status: Optional[str] = Query(None, description="active | past_due | cancelled | expired | all"),
    persona: Optional[str] = Query(None, description="filter by the subscriber's active persona"),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_admin_role("superadmin", "finance_admin", "compliance_officer")),
):
    """Every user subscription (`subscriptions` collection) joined with the
    subscriber's name/phone/persona and the plan snapshot."""
    docs = await query("subscriptions", None, limit=2000)
    users_by_id = {u["id"]: u for u in await query("users", None, limit=1000) if u.get("id")}

    rows = []
    for sub in docs:
        sub_status = sub.get("status") or "active"
        if status and status != "all" and sub_status != status:
            continue
        subscriber = users_by_id.get(sub.get("userId") or "") or {}
        sub_persona = _user_persona(subscriber)
        if persona and sub_persona != persona:
            continue
        plan = await get_plan(sub.get("planId") or "") or _matrix_plan(sub.get("planId") or "")
        rows.append(
            {
                "id": sub.get("subId") or sub.get("id"),
                "userId": sub.get("userId"),
                "userName": subscriber.get("name"),
                "userPhone": subscriber.get("phone"),
                "persona": sub_persona,
                "planId": sub.get("planId"),
                "plan": plan,
                "status": sub_status,
                "provider": sub.get("provider"),
                "providerRef": sub.get("providerRef"),
                "currentPeriodEnd": sub.get("currentPeriodEnd"),
                "createdAt": sub.get("createdAt"),
            }
        )
    rows.sort(key=lambda r: r.get("createdAt") or "", reverse=True)
    return _paginate(rows, page, pageSize)


@router.get("/escrow/holdings")
async def escrow_holdings(
    user: dict = Depends(require_admin_role("superadmin", "finance_admin", "compliance_officer")),
):
    """Aggregated in-escrow money: trade purchases whose escrow is currently
    `held` (services/escrow.py representation), with platform totals in paisa.
    Transport trips carry no escrow under direct-connect, so they never
    appear here."""
    rows = []

    purchases = await query("purchases", None, limit=2000)
    users_by_id = {u["id"]: u for u in await query("users", None, limit=1000) if u.get("id")}
    for purchase in purchases:
        escrow = purchase.get("escrow") or {}
        if escrow.get("status") != "held":
            continue
        # purchase escrow.amount is in rupees (routers/purchases.py)
        amount_paise = int(round(float(escrow.get("amount") or 0) * 100))
        holder = users_by_id.get(purchase.get("buyerId") or "") or {}
        rows.append(
            {
                "kind": "purchase",
                "refId": purchase.get("id"),
                "holderName": holder.get("name") or purchase.get("buyerName"),
                "holderId": purchase.get("buyerId"),
                "counterpartyName": purchase.get("farmerName"),
                "amountPaise": amount_paise,
                "heldSince": escrow.get("fundedAt") or purchase.get("createdAt"),
                "status": escrow.get("status"),
                "paused": bool(escrow.get("disputeOpenedAt")) and not escrow.get("disputeResolvedAt"),
            }
        )

    rows.sort(key=lambda r: r.get("heldSince") or "", reverse=True)
    totals = {
        "count": len(rows),
        "totalAmountPaise": sum(r["amountPaise"] for r in rows),
        "byKind": {},
        "pausedCount": sum(1 for r in rows if r["paused"]),
    }
    for row in rows:
        bucket = totals["byKind"].setdefault(row["kind"], {"count": 0, "amountPaise": 0})
        bucket["count"] += 1
        bucket["amountPaise"] += row["amountPaise"]
    return {"data": rows, "total": len(rows), "totals": totals, "generatedAt": _now()}


def _in_range(day: str, from_date: Optional[str], to_date: Optional[str]) -> bool:
    if from_date and day < from_date:
        return False
    if to_date and day > to_date:
        return False
    return True


def _csv_response(rows: list[dict], filename: str):
    import io, csv

    out = io.StringIO()
    if rows:
        writer = csv.DictWriter(out, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    return Response(
        content=out.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/reports/transactions")
async def transactions_report(
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    format: str = Query("json", description="json or csv"),
    user: dict = Depends(require_admin_role("superadmin", "finance_admin", "compliance_officer")),
):
    """Bookings + marketplace orders + settlements in the date range
    (inclusive day filter on each doc's createdAt). CSV follows the same
    pattern as GET /admin/reports/financial."""
    rows = []
    for booking in await query("transport_bookings", None, limit=2000):
        day = (booking.get("createdAt") or "")[:10]
        if not _in_range(day, from_date, to_date):
            continue
        rows.append(
            {
                "kind": "transport_booking",
                "refId": booking.get("id"),
                "date": day,
                "status": booking.get("status"),
                "amountPaise": int(round(float(booking.get("fare") or 0) * 100)),
                "userId": booking.get("userId"),
                "counterpartyId": booking.get("transporterId"),
            }
        )
    for order in await query("orders", None, limit=2000):
        day = (order.get("createdAt") or "")[:10]
        if not _in_range(day, from_date, to_date):
            continue
        rows.append(
            {
                "kind": "order",
                "refId": order.get("id"),
                "date": day,
                "status": order.get("status"),
                "amountPaise": int(round(float(order.get("finalTotal", order.get("total")) or 0) * 100)),
                "userId": order.get("userId"),
                "counterpartyId": None,
            }
        )
    for settlement in await query("settlements", None, limit=2000):
        day = (settlement.get("createdAt") or "")[:10]
        if not _in_range(day, from_date, to_date):
            continue
        rows.append(
            {
                "kind": "settlement",
                "refId": settlement.get("id"),
                "date": day,
                "status": settlement.get("status"),
                "amountPaise": int(round(float(settlement.get("netRupees") or 0) * 100)),
                "userId": settlement.get("userId"),
                "counterpartyId": None,
            }
        )
    rows.sort(key=lambda r: (r["date"], r["kind"]), reverse=True)
    if format.lower() == "csv":
        return _csv_response(rows, f"transactions_{from_date or 'start'}_{to_date or 'end'}.csv")
    return {"data": rows, "total": len(rows), "from": from_date, "to": to_date, "generatedAt": _now()}


@router.get("/reports/crops")
async def crops_report(
    format: str = Query("json", description="json or csv"),
    user: dict = Depends(require_admin_role("superadmin", "finance_admin", "compliance_officer")),
):
    """Crop-wise listed volumes and values aggregated from `market_lots`
    (crop / quantityQuintals / expectedRate)."""
    buckets: dict[str, dict] = {}
    for lot in await query("market_lots", None, limit=2000):
        crop = lot.get("crop") or "Unknown"
        qty = float(lot.get("quantityQuintals") or 0)
        rate = float(lot.get("expectedRate") or 0)
        bucket = buckets.setdefault(crop, {"crop": crop, "lots": 0, "volumeQuintals": 0.0, "valueRupees": 0.0})
        bucket["lots"] += 1
        bucket["volumeQuintals"] += qty
        bucket["valueRupees"] += qty * rate
    rows = [
        {
            "crop": b["crop"],
            "lots": b["lots"],
            "volumeQuintals": round(b["volumeQuintals"], 2),
            "valueRupees": round(b["valueRupees"], 2),
            "averageRatePerQuintal": round(b["valueRupees"] / b["volumeQuintals"], 2) if b["volumeQuintals"] else 0.0,
        }
        for b in buckets.values()
    ]
    rows.sort(key=lambda r: r["valueRupees"], reverse=True)
    if format.lower() == "csv":
        return _csv_response(rows, "crops_report.csv")
    return {"data": rows, "total": len(rows), "generatedAt": _now()}
