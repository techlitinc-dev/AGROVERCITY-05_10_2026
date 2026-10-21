"""Superadmin SOP modules 10/11/13 — land leasing & disputes, AI advisory &
soil tests, farm diary & P&L oversight.

All data comes from the same Firestore collections the farmer/landlord routers
read and write (no shadow stores):

- land:      `land_listings`, `users/{uid}/land_leases`, `users/{uid}/land_plots`,
             `lease_terminations` (SOP-10)
- advisory:  `disease_scans` (SOP-11 calls this `advisory_scans`; the real writer
             is routers/advisory.py), `users/{uid}/soil_tests` (SOP-11 calls it
             `soil_tests`; the real writer is routers/soil_tests.py)
- diary/pnl: `users/{uid}/diary_entries` (SOP-13 calls it `farm_diary_entries`),
             benchmarks live in `platform_config/pnl_benchmarks` — the same
             config doc pattern admin_console.py uses for settlements/chatbot.

Mutations require the `X-Audit-Reason` header (admin_mutation_context) and write
an immutable `audit_logs` record via services.audit.
"""
import uuid
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.db import get_doc, query, set_doc
from app.services import notifications, reports
from app.services.admin_auth import admin_mutation_context, current_admin_user
from app.services.audit import log_admin_action
from app.services.notify import notify_user

router = APIRouter(prefix="/admin", tags=["admin"])

# Same low-confidence threshold routers/advisory.py uses to open expert tickets.
LOW_CONFIDENCE_THRESHOLD = 0.7

BENCHMARKS_CONFIG_DOC = ("platform_config", "pnl_benchmarks")


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _envelope(rows: list[dict], page: int, pageSize: int) -> dict:
    start = (page - 1) * pageSize
    return {"data": rows[start:start + pageSize], "page": page, "pageSize": pageSize, "total": len(rows)}


async def _find_lease_across_users(lease_id: str) -> tuple[str, dict] | None:
    """Locate a lease doc in `users/{landlordUid}/land_leases` (same scan the
    farmer-facing agreement endpoint in routers/land.py performs)."""
    for user in await query("users", [], limit=1000):
        lease = await get_doc(f"users/{user['id']}/land_leases", lease_id)
        if lease is not None:
            return user["id"], lease
    return None


# ---------------------------------------------------------------------------
# SOP-10 — land listings, lease agreements, arbitrated termination
# ---------------------------------------------------------------------------


def _listing_audit_flags(listing: dict) -> list[str]:
    """Audit flags derived from the AI qualityAssessment stored on the listing
    (written by routers/land.py create/update listing)."""
    assessment = listing.get("qualityAssessment") or {}
    flags = []
    if assessment.get("rentBandOk") is False:
        flags.append("rent_outside_village_band")
    try:
        if float(assessment.get("completeness", 1.0)) < 0.5:
            flags.append("low_listing_completeness")
    except (TypeError, ValueError):
        flags.append("unparseable_quality_assessment")
    if not assessment:
        flags.append("no_quality_assessment")
    return flags


@router.get("/land/listings")
async def list_land_listings(
    status: str | None = Query(None),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_admin_user),
):
    listings = await query("land_listings", [], limit=1000)
    rows = []
    for listing in listings:
        if status is not None and listing.get("status") != status:
            continue
        if search:
            s = search.lower()
            haystack = " ".join(
                str(listing.get(k) or "") for k in ("id", "landlordName", "village", "district", "landlordId")
            ).lower()
            if s not in haystack:
                continue
        rows.append(
            {
                "id": listing.get("id"),
                "landlordId": listing.get("landlordId"),
                "landlordName": listing.get("landlordName"),
                "village": listing.get("village"),
                "district": listing.get("district"),
                "areaAcres": listing.get("areaAcres"),
                "expectedRentRupees": listing.get("expectedRentRupees"),
                "status": listing.get("status"),
                "plotId": listing.get("plotId"),
                "createdAt": listing.get("createdAt"),
                "qualityAssessment": listing.get("qualityAssessment"),
                "auditFlags": _listing_audit_flags(listing),
            }
        )
    rows.sort(key=lambda r: r.get("createdAt") or "", reverse=True)
    return _envelope(rows, page, pageSize)


@router.get("/land/leases/{lease_id}/agreement")
async def inspect_lease_agreement(
    lease_id: str,
    user: dict = Depends(current_admin_user),
):
    """Inspect the generated lease agreement: the lease record plus a freshly
    built agreement PDF url (same builders as routers/land.py, without the
    per-user Pro-plan gate — superadmin inspection is always allowed)."""
    resolved = await _find_lease_across_users(lease_id)
    if resolved is None:
        _error(404, "LEASE_NOT_FOUND", "lease not found")
    landlord_id, lease = resolved
    landlord = await get_doc("users", landlord_id) or {}
    tenant = {"name": lease.get("tenantName", ""), "phone": lease.get("tenantPhone", "")}
    if lease.get("tenantFarmerId"):
        tenant_user = await get_doc("users", lease["tenantFarmerId"]) or {}
        tenant = {"name": tenant_user.get("name") or tenant["name"], "phone": tenant_user.get("phone") or tenant["phone"]}
    if lease.get("plotId"):
        plot = await get_doc(f"users/{landlord_id}/land_plots", lease["plotId"])
        if plot is not None:
            lease = {**lease, "plotName": plot.get("name"), "gatNumber": plot.get("gatNumber")}
    path = reports.build_lease_agreement_pdf(lease, landlord, tenant)
    url = reports.upload_to_storage(path, f"agreements/{landlord_id}/{lease_id}.pdf")
    return {
        "leaseId": lease_id,
        "landlordId": landlord_id,
        "tenant": tenant,
        "lease": lease,
        "agreementUrl": url,
    }


class AdminLeaseTerminateIn(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500)
    terminationDate: str | None = Field(None, min_length=10)


@router.put("/land/leases/{lease_id}/terminate")
async def terminate_lease_arbitrated(
    lease_id: str,
    body: AdminLeaseTerminateIn,
    ctx: dict = Depends(admin_mutation_context),
):
    """Arbitrated lease termination (SOP-10 'Mediate').

    Follows the lease semantics of routers/land_ops.py terminate: only active
    leases can be terminated, the plot reverts to vacant, a terminated lease
    reopens its marketplace listing, and a `lease_terminations` record is
    written. `terminatedBy` is `admin` and the audit reason is preserved on
    the lease as the arbitration reason.
    """
    resolved = await _find_lease_across_users(lease_id)
    if resolved is None:
        _error(404, "LEASE_NOT_FOUND", "lease not found")
    landlord_id, lease = resolved
    if lease.get("status") != "active":
        _error(409, "LEASE_NOT_ACTIVE", "only active leases can be terminated")

    admin = ctx["admin"]
    previous = {"status": lease.get("status"), "terminationReason": lease.get("terminationReason")}
    termination_day = date.today()
    if body.terminationDate:
        try:
            termination_day = date.fromisoformat(body.terminationDate[:10])
        except ValueError:
            _error(422, "INVALID_DATE", "terminationDate must be an ISO date", {"terminationDate": "invalid date"})

    lease["status"] = "terminated"
    lease["terminatedAt"] = _now()
    lease["terminatedBy"] = "admin"
    lease["terminationReason"] = body.reason
    lease["terminationDate"] = termination_day.isoformat()
    lease["arbitratedBy"] = admin.get("id") or admin.get("uid")
    await set_doc(f"users/{landlord_id}/land_leases", lease_id, lease)

    plot_id = lease.get("plotId")
    if plot_id:
        plot = await get_doc(f"users/{landlord_id}/land_plots", plot_id)
        if plot is not None:
            plot["status"] = "vacant"
            await set_doc(f"users/{landlord_id}/land_plots", plot_id, plot)

    record = {
        "id": f"trm_{uuid.uuid4().hex[:12]}",
        "leaseId": lease_id,
        "landlordId": landlord_id,
        "farmerId": lease.get("tenantFarmerId"),
        "terminatedBy": "admin",
        "reason": body.reason,
        "terminationDate": termination_day.isoformat(),
        "arbitratedBy": lease["arbitratedBy"],
        "createdAt": _now(),
    }
    await set_doc("lease_terminations", record["id"], record)

    listing_id = lease.get("listingId")
    if listing_id:
        listing = await get_doc("land_listings", listing_id)
        if listing is not None and listing.get("status") == "leased":
            listing["status"] = "open"
            await set_doc("land_listings", listing_id, listing)

    await log_admin_action(
        admin,
        "land",
        "LEASE_TERMINATE_ARBITRATED",
        lease_id,
        previous,
        {
            "status": "terminated",
            "terminatedBy": "admin",
            "terminationReason": body.reason,
            "terminationDate": termination_day.isoformat(),
            "plotRevertedTo": "vacant" if plot_id else None,
            "terminationRecordId": record["id"],
        },
        ctx["reason"],
        ctx["ip"],
    )
    return {
        "leaseId": lease_id,
        "landlordId": landlord_id,
        "status": "terminated",
        "terminationDate": termination_day.isoformat(),
        "terminationReason": body.reason,
        "terminationRecordId": record["id"],
    }


# ---------------------------------------------------------------------------
# SOP-11 — disease scan audit, soil test lab results
# ---------------------------------------------------------------------------


def _confidence(scan: dict) -> float:
    try:
        return float(scan.get("confidence") or 0.0)
    except (TypeError, ValueError):
        return 0.0


@router.get("/advisory/scans")
async def audit_advisory_scans(
    farmerId: str | None = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_admin_user),
):
    """Audit trail of AI disease scans with confidence metrics. Real collection:
    `disease_scans` (written by routers/advisory.py disease-scan)."""
    filters = [("farmerId", "==", farmerId)] if farmerId else []
    scans = await query("disease_scans", filters, limit=1000)
    scans.sort(key=lambda s: s.get("createdAt") or "", reverse=True)

    confidences = []
    for scan in scans:
        confidences.append(_confidence(scan))
    low_confidence = sum(1 for c in confidences if c < LOW_CONFIDENCE_THRESHOLD)
    metrics = {
        "totalScans": len(scans),
        "averageConfidence": round(sum(confidences) / len(confidences), 4) if confidences else 0.0,
        "lowConfidenceCount": low_confidence,
        "lowConfidenceThreshold": LOW_CONFIDENCE_THRESHOLD,
        "lowConfidenceRatePercent": round((low_confidence / len(confidences)) * 100, 2) if confidences else 0.0,
    }
    rows = [
        {
            "scanId": scan.get("scan_id"),
            "farmerId": scan.get("farmerId"),
            "plotId": scan.get("plotId"),
            "photoUrl": scan.get("photo_url"),
            "diagnosis": scan.get("diagnosis"),
            "confidence": scan.get("confidence"),
            "lowConfidence": _confidence(scan) < LOW_CONFIDENCE_THRESHOLD,
            "createdAt": scan.get("createdAt"),
        }
        for scan in scans
    ]
    return {**_envelope(rows, page, pageSize), "metrics": metrics}


async def _iter_soil_tests() -> list[tuple[str, dict]]:
    """All soil tests across users, paired with their owner uid. Real location:
    `users/{uid}/soil_tests` (written by routers/soil_tests.py book)."""
    rows = []
    for user_doc in await query("users", [], limit=1000):
        uid = user_doc["id"]
        for test in await query(f"users/{uid}/soil_tests", [], limit=200):
            rows.append((uid, test))
    return rows


@router.get("/soil-tests")
async def list_soil_tests(
    status: str = Query("pending", description="pending | all | booked | sampleCollected | reportReady"),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_admin_user),
):
    rows = []
    for uid, test in await _iter_soil_tests():
        test_status = test.get("status")
        if status == "pending":
            if test_status == "reportReady":
                continue
        elif status != "all" and test_status != status:
            continue
        if search:
            s = search.lower()
            haystack = " ".join(str(v or "") for v in (test.get("id"), test.get("plotId"), test.get("address"))).lower()
            if s not in haystack:
                continue
        rows.append(
            {
                "id": test.get("id"),
                "userId": uid,
                "plotId": test.get("plotId"),
                "address": test.get("address"),
                "slot": test.get("slot"),
                "status": test_status,
                "resultPdfUrl": test.get("resultPdfUrl"),
                "bookedAt": test.get("bookedAt"),
                "npk": {
                    k: test.get(k)
                    for k in ("nitrogen", "phosphorus", "potassium", "ph", "organicCarbon")
                    if test.get(k) is not None
                },
            }
        )
    rows.sort(key=lambda r: r.get("bookedAt") or "", reverse=True)
    return _envelope(rows, page, pageSize)


class SoilTestResultIn(BaseModel):
    resultUrl: str = Field(..., min_length=1)
    nitrogen: float | None = Field(None, ge=0)
    phosphorus: float | None = Field(None, ge=0)
    potassium: float | None = Field(None, ge=0)
    ph: float | None = Field(None, ge=0, le=14)
    organicCarbon: float | None = Field(None, ge=0)
    notes: str | None = Field(None, max_length=1000)


@router.post("/soil-tests/{test_id}/results", status_code=201)
async def upload_soil_test_result(
    test_id: str,
    body: SoilTestResultIn,
    ctx: dict = Depends(admin_mutation_context),
):
    """Record a lab result for a booked soil test and notify the farmer.

    The farmer-facing router stores the report on `resultPdfUrl` and uses the
    `reportReady` status literal (models/soil_tests.py), so the admin upload
    writes the same fields the mobile app reads.
    """
    owner_uid = None
    test = None
    for uid, candidate in await _iter_soil_tests():
        if candidate.get("id") == test_id:
            owner_uid, test = uid, candidate
            break
    if test is None or owner_uid is None:
        _error(404, "SOIL_TEST_NOT_FOUND", "soil test not found")

    previous = {"status": test.get("status"), "resultPdfUrl": test.get("resultPdfUrl")}
    test["resultPdfUrl"] = body.resultUrl
    test["status"] = "reportReady"
    test["resultRecordedAt"] = _now()
    test["resultRecordedBy"] = ctx["admin"].get("id") or ctx["admin"].get("uid")
    for field, value in (
        ("nitrogen", body.nitrogen),
        ("phosphorus", body.phosphorus),
        ("potassium", body.potassium),
        ("ph", body.ph),
        ("organicCarbon", body.organicCarbon),
    ):
        if value is not None:
            test[field] = value
    if body.notes:
        test["resultNotes"] = body.notes
    await set_doc(f"users/{owner_uid}/soil_tests", test_id, test)

    await notifications.send_fcm_to_user(
        owner_uid,
        "Soil test report ready",
        "Your soil test lab report is now available.",
        {"type": "soil_test_report", "soilTestId": test_id, "resultUrl": body.resultUrl},
    )

    await log_admin_action(
        ctx["admin"],
        "soil_tests",
        "SOIL_TEST_RESULT_UPLOADED",
        test_id,
        previous,
        {
            "status": "reportReady",
            "resultPdfUrl": body.resultUrl,
            "farmerId": owner_uid,
            **{k: v for k, v in (("nitrogen", body.nitrogen), ("phosphorus", body.phosphorus), ("potassium", body.potassium)) if v is not None},
        },
        ctx["reason"],
        ctx["ip"],
    )
    return {"soilTestId": test_id, "farmerId": owner_uid, "status": "reportReady", "resultPdfUrl": body.resultUrl}


# ---------------------------------------------------------------------------
# SOP-13 — regional diary expenditure, crop cost benchmarks
# ---------------------------------------------------------------------------


@router.get("/diary/summary")
async def diary_regional_summary(
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    user: dict = Depends(current_admin_user),
):
    """Regional farm expenditure statistics aggregated from the real
    `users/{uid}/diary_entries` collection (SOP-13 calls it `farm_diary_entries`),
    grouped by the user's district and by diary category."""
    districts: dict[str, dict] = {}
    totals = {"farmers": set(), "entryCount": 0, "income": 0.0, "expense": 0.0, "net": 0.0}
    for user_doc in await query("users", [], limit=1000):
        uid = user_doc["id"]
        filters = []
        if from_date:
            filters.append(("date", ">=", from_date))
        if to_date:
            filters.append(("date", "<=", to_date))
        entries = await query(f"users/{uid}/diary_entries", filters, limit=1000)
        if not entries:
            continue
        district = user_doc.get("district") or "Unknown"
        bucket = districts.setdefault(
            district,
            {
                "district": district,
                "farmers": set(),
                "entryCount": 0,
                "income": 0.0,
                "expense": 0.0,
                "net": 0.0,
                "categories": {},
            },
        )
        bucket["farmers"].add(uid)
        totals["farmers"].add(uid)
        for entry in entries:
            try:
                amount = float(entry.get("amount") or 0.0)
            except (TypeError, ValueError):
                amount = 0.0
            entry_type = entry.get("type") or "farmActivity"
            bucket["entryCount"] += 1
            totals["entryCount"] += 1
            if entry_type == "income":
                bucket["income"] += amount
                totals["income"] += amount
            elif entry_type == "expense":
                bucket["expense"] += amount
                totals["expense"] += amount
            category_key = (entry.get("category") or "uncategorized", entry_type)
            cat = bucket["categories"].setdefault(
                category_key, {"category": category_key[0], "type": category_key[1], "amount": 0.0, "count": 0}
            )
            cat["amount"] += amount
            cat["count"] += 1
        bucket["net"] = bucket["income"] - bucket["expense"]

    district_rows = []
    for bucket in districts.values():
        district_rows.append(
            {
                "district": bucket["district"],
                "farmers": len(bucket["farmers"]),
                "entryCount": bucket["entryCount"],
                "income": round(bucket["income"], 2),
                "expense": round(bucket["expense"], 2),
                "net": round(bucket["net"], 2),
                "byCategory": sorted(
                    ({"category": c["category"], "type": c["type"], "amount": round(c["amount"], 2), "count": c["count"]} for c in bucket["categories"].values()),
                    key=lambda c: c["amount"],
                    reverse=True,
                ),
            }
        )
    district_rows.sort(key=lambda r: r["expense"], reverse=True)
    return {
        "from": from_date,
        "to": to_date,
        "districts": district_rows,
        "totals": {
            "districts": len(district_rows),
            "farmers": len(totals["farmers"]),
            "entryCount": totals["entryCount"],
            "income": round(totals["income"], 2),
            "expense": round(totals["expense"], 2),
            "net": round(totals["income"] - totals["expense"], 2),
        },
    }


@router.get("/pnl/benchmarks")
async def get_pnl_benchmarks(user: dict = Depends(current_admin_user)):
    """State-level crop production-cost benchmarks. Stored as a platform_config
    doc (`pnl_benchmarks`) following the same config-doc pattern as
    platform_config/settlements and platform_config/chatbot; empty until the
    first PUT seeds a crop."""
    doc = await get_doc(*BENCHMARKS_CONFIG_DOC) or {}
    return {
        "benchmarks": doc.get("benchmarks") or {},
        "updatedAt": doc.get("updatedAt"),
        "updatedBy": doc.get("updatedBy"),
    }


class PnlBenchmarkIn(BaseModel):
    costPerAcreRupees: float = Field(..., gt=0)
    seedCostPerAcreRupees: float | None = Field(None, ge=0)
    fertiliserCostPerAcreRupees: float | None = Field(None, ge=0)
    pesticideCostPerAcreRupees: float | None = Field(None, ge=0)
    labourCostPerAcreRupees: float | None = Field(None, ge=0)
    expectedYieldQuintalsPerAcre: float | None = Field(None, gt=0)
    notes: str | None = Field(None, max_length=1000)


@router.put("/pnl/benchmarks/{crop}")
async def put_pnl_benchmark(
    crop: str,
    body: PnlBenchmarkIn,
    ctx: dict = Depends(admin_mutation_context),
):
    """Update (merge) or create the cost benchmark for one crop."""
    doc = await get_doc(*BENCHMARKS_CONFIG_DOC) or {"benchmarks": {}}
    benchmarks = doc.get("benchmarks") or {}
    previous = benchmarks.get(crop)
    entry = dict(previous) if previous else {}
    entry.update({k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None})
    entry["crop"] = crop
    entry["updatedAt"] = _now()
    entry["updatedBy"] = ctx["admin"].get("id") or ctx["admin"].get("uid")
    benchmarks[crop] = entry
    doc["benchmarks"] = benchmarks
    doc["updatedAt"] = entry["updatedAt"]
    doc["updatedBy"] = entry["updatedBy"]
    await set_doc(BENCHMARKS_CONFIG_DOC[0], BENCHMARKS_CONFIG_DOC[1], doc)

    await log_admin_action(
        ctx["admin"],
        "pnl",
        "PNL_BENCHMARK_UPSERT",
        crop,
        previous,
        entry,
        ctx["reason"],
        ctx["ip"],
    )
    return {"crop": crop, "benchmark": entry}


# ===========================================================================
# Platform config — carbon credits & 7/12 land-records integration (P2)
# ===========================================================================

_CARBON_CONFIG_DOC = "carbon_config"
_CARBON_DEFAULTS = {
    "kgCo2PerTreePerYear": 21.0,
    "creditPricePaisePerKg": 80,
    "ecoCoinsPerCredit": 10,
    "payoutThresholdCredits": 10,
}

_LAND_RECORDS_CONFIG_DOC = "land_records_config"


class CarbonConfigIn(BaseModel):
    kgCo2PerTreePerYear: Optional[float] = Field(default=None, gt=0)
    creditPricePaisePerKg: Optional[int] = Field(default=None, gt=0)
    ecoCoinsPerCredit: Optional[int] = Field(default=None, ge=0)
    payoutThresholdCredits: Optional[int] = Field(default=None, ge=1)


@router.get("/platform-config/carbon")
async def get_carbon_config(user: dict = Depends(current_admin_user)):
    """Carbon-credit economics: per-tree CO2 sequestration, credit price,
    EcoCoins conversion and the payout threshold."""
    doc = await get_doc("platform_config", _CARBON_CONFIG_DOC)
    merged = {**_CARBON_DEFAULTS, **{k: doc[k] for k in _CARBON_DEFAULTS if k in (doc or {})}}
    return {**merged, "updatedAt": (doc or {}).get("updatedAt"), "updatedBy": (doc or {}).get("updatedBy")}


@router.put("/platform-config/carbon")
async def update_carbon_config(
    body: CarbonConfigIn,
    ctx: dict = Depends(admin_mutation_context),
):
    existing = await get_doc("platform_config", _CARBON_CONFIG_DOC) or {}
    new_cfg = {
        **existing,
        **body.model_dump(exclude_none=True),
        "id": _CARBON_CONFIG_DOC,
        "updatedAt": _now(),
        "updatedBy": ctx["admin"].get("id") or ctx["admin"].get("uid"),
    }
    await set_doc("platform_config", _CARBON_CONFIG_DOC, new_cfg)
    await log_admin_action(
        ctx["admin"], "climate", "carbon.config.update", _CARBON_CONFIG_DOC,
        existing, new_cfg, ctx["reason"], ctx["ip"],
    )
    return new_cfg


class LandRecordsConfigIn(BaseModel):
    provider: Optional[str] = Field(default=None, min_length=2, max_length=80)
    apiUrl: Optional[str] = Field(default=None, min_length=4, max_length=500)
    apiKey: Optional[str] = Field(default=None, description="write-only; reads return apiKeyMasked")
    syncEnabled: Optional[bool] = None
    syncCron: Optional[str] = Field(default=None, max_length=60)
    timeoutMs: Optional[int] = Field(default=None, ge=100, le=60000)


def _mask_api_key(api_key: str | None) -> str | None:
    if not api_key:
        return None
    if len(api_key) <= 4:
        return "****"
    return "****" + api_key[-4:]


@router.get("/land-records/config")
async def get_land_records_config(user: dict = Depends(current_admin_user)):
    """7/12 land-records integration config. The stored apiKey is never
    returned — only `apiKeyMasked` (last 4)."""
    doc = await get_doc("platform_config", _LAND_RECORDS_CONFIG_DOC) or {}
    return {
        "provider": doc.get("provider"),
        "apiUrl": doc.get("apiUrl"),
        "apiKeyMasked": _mask_api_key(doc.get("apiKey")),
        "syncEnabled": bool(doc.get("syncEnabled")),
        "syncCron": doc.get("syncCron"),
        "timeoutMs": doc.get("timeoutMs"),
        "updatedAt": doc.get("updatedAt"),
        "updatedBy": doc.get("updatedBy"),
    }


@router.put("/land-records/config")
async def update_land_records_config(
    body: LandRecordsConfigIn,
    ctx: dict = Depends(admin_mutation_context),
):
    """Upsert the 7/12 integration config; a provided apiKey replaces the
    stored one, an omitted apiKey keeps it."""
    existing = await get_doc("platform_config", _LAND_RECORDS_CONFIG_DOC) or {}
    new_cfg = {
        **existing,
        **{k: v for k, v in body.model_dump(exclude_none=True).items() if k != "apiKey"},
        "id": _LAND_RECORDS_CONFIG_DOC,
        "updatedAt": _now(),
        "updatedBy": ctx["admin"].get("id") or ctx["admin"].get("uid"),
    }
    if body.apiKey:
        new_cfg["apiKey"] = body.apiKey
    await set_doc("platform_config", _LAND_RECORDS_CONFIG_DOC, new_cfg)
    await log_admin_action(
        ctx["admin"], "land-records", "config.update", _LAND_RECORDS_CONFIG_DOC,
        {k: ("***" if k == "apiKey" else v) for k, v in existing.items()},
        {k: ("***" if k == "apiKey" else v) for k, v in new_cfg.items()},
        ctx["reason"], ctx["ip"],
    )
    return {
        "provider": new_cfg.get("provider"),
        "apiUrl": new_cfg.get("apiUrl"),
        "apiKeyMasked": _mask_api_key(new_cfg.get("apiKey")),
        "syncEnabled": bool(new_cfg.get("syncEnabled")),
        "syncCron": new_cfg.get("syncCron"),
        "timeoutMs": new_cfg.get("timeoutMs"),
        "updatedAt": new_cfg.get("updatedAt"),
        "updatedBy": new_cfg.get("updatedBy"),
    }


# ===========================================================================
# Crop advisory CMS — articles with farmer push (P2)
# ===========================================================================

_ADVISORY_STATUSES = ("draft", "published")


class AdvisoryArticleIn(BaseModel):
    crop: str = Field(..., min_length=1, max_length=120)
    region: Optional[str] = Field(default=None, max_length=120, description="state/district scope; null = all")
    season: Optional[str] = Field(default=None, max_length=60)
    title: str = Field(..., min_length=3, max_length=200)
    body: str = Field(..., min_length=3)
    status: str = Field(default="draft", description="draft | published")


class AdvisoryArticleUpdateIn(BaseModel):
    crop: Optional[str] = Field(default=None, min_length=1, max_length=120)
    region: Optional[str] = Field(default=None, max_length=120)
    season: Optional[str] = Field(default=None, max_length=60)
    title: Optional[str] = Field(default=None, min_length=3, max_length=200)
    body: Optional[str] = Field(default=None, min_length=3)
    status: Optional[str] = Field(default=None, description="draft | published")


def _require_article_status(status: str) -> None:
    if status not in _ADVISORY_STATUSES:
        _error(
            422,
            "VALIDATION_ERROR",
            f"status must be one of {', '.join(_ADVISORY_STATUSES)}",
            {"status": "invalid status"},
        )


@router.post("/advisory/articles", status_code=201)
async def create_advisory_article(
    body: AdvisoryArticleIn,
    ctx: dict = Depends(admin_mutation_context),
):
    """Create a crop advisory article (draft or published) in `advisories`."""
    _require_article_status(body.status)
    article_id = f"adv_{uuid.uuid4().hex[:12]}"
    doc = {
        "articleId": article_id,
        "crop": body.crop,
        "region": body.region,
        "season": body.season,
        "title": body.title,
        "body": body.body,
        "status": body.status,
        "createdBy": ctx["admin"].get("id") or ctx["admin"].get("uid"),
        "createdAt": _now(),
        "updatedAt": _now(),
    }
    await set_doc("advisories", article_id, doc)
    await log_admin_action(
        ctx["admin"], "advisory", "article.create", article_id,
        None, {"status": body.status, "crop": body.crop}, ctx["reason"], ctx["ip"],
    )
    return {"success": True, "article": doc}


@router.get("/advisory/articles")
async def list_advisory_articles(
    status: Optional[str] = Query(None, description="draft | published | all"),
    crop: Optional[str] = Query(None),
    user: dict = Depends(current_admin_user),
):
    """All advisory articles (admin sees drafts too)."""
    docs = await query("advisories", None, limit=1000)
    rows = []
    for doc in docs:
        doc_status = doc.get("status") or "draft"
        if status and status != "all" and doc_status != status:
            continue
        if crop and crop.lower() not in (doc.get("crop") or "").lower():
            continue
        rows.append(doc)
    rows.sort(key=lambda r: r.get("updatedAt") or "", reverse=True)
    return {"data": rows, "total": len(rows)}


async def _find_article(article_id: str) -> dict:
    doc = await get_doc("advisories", article_id)
    if doc is None:
        _error(404, "ARTICLE_NOT_FOUND", "advisory article not found")
    return doc


@router.get("/advisory/articles/{article_id}")
async def get_advisory_article(
    article_id: str,
    user: dict = Depends(current_admin_user),
):
    return {"article": await _find_article(article_id)}


@router.put("/advisory/articles/{article_id}")
async def update_advisory_article(
    article_id: str,
    body: AdvisoryArticleUpdateIn,
    ctx: dict = Depends(admin_mutation_context),
):
    doc = await _find_article(article_id)
    updates = body.model_dump(exclude_none=True)
    if "status" in updates:
        _require_article_status(updates["status"])
    previous = {k: doc.get(k) for k in updates}
    doc.update(updates)
    doc["updatedAt"] = _now()
    doc["updatedBy"] = ctx["admin"].get("id") or ctx["admin"].get("uid")
    await set_doc("advisories", article_id, doc)
    await log_admin_action(
        ctx["admin"], "advisory", "article.update", article_id,
        previous, updates, ctx["reason"], ctx["ip"],
    )
    return {"success": True, "article": doc}


@router.delete("/advisory/articles/{article_id}")
async def delete_advisory_article(
    article_id: str,
    ctx: dict = Depends(admin_mutation_context),
):
    doc = await _find_article(article_id)
    previous = {"status": doc.get("status")}
    doc["status"] = "draft"
    doc["active"] = False
    doc["updatedAt"] = _now()
    doc["updatedBy"] = ctx["admin"].get("id") or ctx["admin"].get("uid")
    await set_doc("advisories", article_id, doc)
    await log_admin_action(
        ctx["admin"], "advisory", "article.delete", article_id,
        previous, {"active": False}, ctx["reason"], ctx["ip"],
    )
    return {"success": True, "articleId": article_id, "active": False}


@router.post("/advisory/articles/{article_id}/push")
async def push_advisory_article(
    article_id: str,
    ctx: dict = Depends(admin_mutation_context),
):
    """Notify all farmers (region-filtered when the article sets `region`) of a
    published article. One notification per farmer via services/notify."""
    doc = await _find_article(article_id)
    if doc.get("status") != "published":
        _error(409, "ARTICLE_NOT_PUBLISHED", "only published articles can be pushed")

    region = (doc.get("region") or "").strip().lower()
    users_list = await query("users", None, limit=2000)
    notified = 0
    for user_doc in users_list:
        profiles = user_doc.get("linkedProfiles") or []
        if "farmer" not in profiles and user_doc.get("activeProfile") != "farmer" and user_doc.get("primaryProfile") != "farmer":
            continue
        if region:
            user_region = " ".join(
                str(user_doc.get(k) or "") for k in ("state", "district", "village")
            ).strip().lower()
            if region not in user_region:
                continue
        uid = user_doc.get("id")
        if not uid:
            continue
        await notify_user(
            uid,
            type="advisory_article",
            title=doc.get("title") or "New advisory",
            body=f"{doc.get('crop', '')} — {doc.get('title', '')}",
            deepLink=f"/dashboard/p/advisory/articles/{article_id}",
        )
        notified += 1

    doc["lastPushedAt"] = _now()
    doc["lastPushedBy"] = ctx["admin"].get("id") or ctx["admin"].get("uid")
    await set_doc("advisories", article_id, doc)
    await log_admin_action(
        ctx["admin"], "advisory", "article.push", article_id,
        None, {"notified": notified}, ctx["reason"], ctx["ip"],
    )
    return {"success": True, "articleId": article_id, "notified": notified}
