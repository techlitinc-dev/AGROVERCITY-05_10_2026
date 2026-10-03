import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.config import settings
from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.data.insurance_seed import SCHEMES
from app.models.claims import InsuranceClaimRecord
from app.models.insurance import (
    ClaimDisburseIn,
    ClaimReviewIn,
    ClaimScheduleSurveyIn,
    ClaimSurveyReportIn,
    CropInsurancePolicy,
    CropPremiumRate,
    InsuranceScheme,
    PolicyApplyIn,
    PolicyReviewIn,
    RateCreateIn,
)
from app.services import claims as claims_service
from app.services import reports
from app.services.notifications import send_fcm_to_user
from app.services.users import get_user

router = APIRouter(prefix="/insurance", tags=["insurance"])

INSURANCE_ROLES = ("farmer", "farmLandlord", "insuranceProvider", "admin")
PROVIDER_ROLES = ("insuranceProvider", "admin")

SEASON_WINDOWS = {
    "Kharif": ("07-01", "12-31"),
    "Rabi": ("11-01", "04-30"),
    "Annual": ("01-01", "12-31"),
}


def _error(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": {}},
    )


async def _require_insurance_user(uid: str = Depends(current_user_id)) -> dict:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    profiles = user.get("linkedProfiles") or [user.get("activeProfile") or "farmer"]
    active = user.get("activeProfile", "")
    if active not in INSURANCE_ROLES and not any(p in INSURANCE_ROLES for p in profiles) and not user.get("isAdmin", False):
        _error(403, "FORBIDDEN_ROLE", "insufficient role for this action")
    return user


async def _require_insurance_provider(uid: str = Depends(current_user_id)) -> dict:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    profiles = user.get("linkedProfiles") or [user.get("activeProfile") or "farmer"]
    active = user.get("activeProfile", "")
    if active not in PROVIDER_ROLES and not any(p in PROVIDER_ROLES for p in profiles) and not user.get("isAdmin", False):
        _error(403, "FORBIDDEN_ROLE", "insufficient role for insurance provider actions")
    return user


def _assess_risk(crop: str, season: str, acres: float, irrigation: str) -> tuple[int, str]:
    score = 25
    if season == "Kharif":
        score += 15
    if acres > 10:
        score += 10
    if "rainfed" in (irrigation or "").lower() or "वर्षा" in (irrigation or ""):
        score += 25
    category = "High" if score >= 60 else ("Medium" if score >= 40 else "Low")
    return score, category


def _demo_policy(uid: str = "demo-user", user: dict | None = None) -> dict:
    return {
        "id": "demo-policy-1",
        "policyNumber": "PMFBY-2026-0001",
        "schemeName": "PMFBY",
        "cropName": "Wheat",
        "season": "Kharif",
        "year": 2026,
        "landAreaAcres": 2.0,
        "sumInsured": 80000,
        "farmerPremium": 1600,
        "govtSubsidy": 8400,
        "status": "active",
        "insuranceCompany": "AIC of India",
        "coverageStartDate": "2026-07-01",
        "coverageEndDate": "2026-12-31",
        "bankName": "SBI",
        "kccAccountNo": "XXXX4521",
        "certificateUrl": None,
        "userId": uid,
        "farmerName": (user or {}).get("name", "Ram Singh (किसान)"),
        "farmerPhone": (user or {}).get("phone", "+919999999999"),
        "village": (user or {}).get("village", "Rampur"),
        "district": (user or {}).get("district", "Nashik"),
        "state": (user or {}).get("state", "Maharashtra"),
        "category": "crop",
        "riskScore": 25,
        "riskCategory": "Low",
        "appliedAt": "2026-07-01T00:00:00Z",
        "reviewedAt": "2026-07-02T10:00:00Z",
        "reviewedBy": "AIC Underwriter",
        "rejectionReason": None,
        "underwriterNotes": "Standard coverage approved under PMFBY guidelines.",
    }


def _season_window(season: str, year: int) -> tuple[str, str]:
    start_md, end_md = SEASON_WINDOWS.get(season, ("01-01", "12-31"))
    end_year = year + 1 if season == "Rabi" else year
    return f"{year}-{start_md}", f"{end_year}-{end_md}"


# ==============================================================================
# Farmer / Landlord Policy Endpoints
# ==============================================================================


@router.get("/policies")
async def list_policies(
    status: str | None = None,
    user: dict = Depends(_require_insurance_user),
):
    uid = user["id"]
    docs = await query(f"users/{uid}/insurance_policies", [], limit=100)
    if not docs and settings.env == "dev":
        demo = _demo_policy(uid, user)
        await set_doc(f"users/{uid}/insurance_policies", demo["id"], demo)
        await set_doc("insurance_policies", demo["id"], demo)
        docs = [demo]
    if status and status != "all":
        docs = [d for d in docs if d.get("status") == status]
    items = [CropInsurancePolicy(**d).model_dump() for d in docs]
    return {"data": items, "page": 1, "pageSize": 20, "total": len(items)}


@router.post("/policies/apply", status_code=201, response_model=CropInsurancePolicy)
async def apply_policy(body: PolicyApplyIn, user: dict = Depends(_require_insurance_user)):
    uid = user["id"]
    rates = await query(
        "insurance_rates",
        [("cropName", "==", body.cropName), ("season", "==", body.season)],
    )
    if not rates:
        _error(404, "RATE_NOT_FOUND", "इस फसल/सीज़न की दर उपलब्ध नहीं")
    rate = rates[0]
    sum_insured = rate["sumInsuredPerAcre"] * body.landAreaAcres
    farmer_premium = round(sum_insured * rate["farmerSharePercent"] / 100, 2)
    govt_subsidy = round(
        sum_insured * (rate["totalActuarialRatePercent"] - rate["farmerSharePercent"]) / 100, 2
    )
    existing = await query(f"users/{uid}/insurance_policies", [], limit=100)
    year = datetime.now(timezone.utc).year
    start, end = _season_window(body.season, year)
    now = datetime.now(timezone.utc).isoformat()
    risk_score, risk_cat = _assess_risk(
        body.cropName, body.season, body.landAreaAcres, user.get("irrigationType", "")
    )

    policy = {
        "id": uuid.uuid4().hex,
        "policyNumber": f"PMFBY-{year}-{len(existing) + 1:04d}",
        "schemeName": body.schemeName or "PMFBY",
        "cropName": body.cropName,
        "season": body.season,
        "year": year,
        "landAreaAcres": body.landAreaAcres,
        "sumInsured": sum_insured,
        "farmerPremium": farmer_premium,
        "govtSubsidy": govt_subsidy,
        "status": "pending_approval",
        "insuranceCompany": "AIC of India",
        "coverageStartDate": start,
        "coverageEndDate": end,
        "bankName": user.get("bankName", ""),
        "kccAccountNo": "",
        "certificateUrl": None,
        "userId": uid,
        "farmerName": user.get("name", "Farmer"),
        "farmerPhone": user.get("phone", ""),
        "village": user.get("village", ""),
        "district": user.get("district", ""),
        "state": user.get("state", ""),
        "category": body.category,
        "khasraNumber": body.khasraNumber,
        "sowingDate": body.sowingDate,
        "riskScore": risk_score,
        "riskCategory": risk_cat,
        "appliedAt": now,
        "reviewedAt": None,
        "reviewedBy": None,
        "rejectionReason": None,
        "underwriterNotes": None,
    }
    await set_doc(f"users/{uid}/insurance_policies", policy["id"], policy)
    await set_doc("insurance_policies", policy["id"], policy)
    return CropInsurancePolicy(**policy)


@router.get("/policies/{policy_id}/certificate")
async def policy_certificate(policy_id: str, user: dict = Depends(_require_insurance_user)):
    uid = user["id"]
    policy = await get_doc(f"users/{uid}/insurance_policies", policy_id)
    if policy is None:
        policy = await get_doc("insurance_policies", policy_id)
    if policy is None:
        _error(404, "POLICY_NOT_FOUND", "पॉलिसी नहीं मिली")
    pdf_path = reports.build_policy_certificate_pdf(policy)
    url = reports.upload_to_storage(pdf_path, f"certificates/{uid}/{policy_id}.pdf")
    policy["certificateUrl"] = url
    await set_doc(f"users/{uid}/insurance_policies", policy_id, policy)
    await set_doc("insurance_policies", policy_id, policy)
    return {"certificateUrl": url}


@router.get("/rates")
async def list_rates(
    season: str | None = None,
    crop: str | None = None,
    user: dict = Depends(_require_insurance_user),
):
    filters = []
    if season:
        filters.append(("season", "==", season))
    if crop:
        filters.append(("cropName", "==", crop))
    docs = await query("insurance_rates", filters, limit=100)
    items = [CropPremiumRate(**d).model_dump() for d in docs]
    return {"data": items, "page": 1, "pageSize": 20, "total": len(items)}


@router.get("/schemes")
async def list_schemes(user: dict = Depends(_require_insurance_user)):
    docs = await query("insurance_schemes", [], limit=50)
    if not docs:
        docs = SCHEMES
    items = [InsuranceScheme(**d).model_dump() for d in docs]
    return {"data": items, "total": len(items)}


# ==============================================================================
# Insurance Provider Workspace & Review Endpoints
# ==============================================================================


@router.get("/provider/policies")
async def provider_list_policies(
    status: str | None = Query(None),
    crop: str | None = Query(None),
    category: str | None = Query(None),
    q: str | None = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    provider: dict = Depends(_require_insurance_provider),
):
    filters = []
    if status and status != "all":
        filters.append(("status", "==", status))
    if crop:
        filters.append(("cropName", "==", crop))
    if category:
        filters.append(("category", "==", category))

    docs = await query("insurance_policies", filters if filters else None, limit=2000)
    if not docs and settings.env == "dev":
        demo = _demo_policy()
        await set_doc("insurance_policies", demo["id"], demo)
        docs = [demo]

    docs.sort(key=lambda d: d.get("appliedAt") or d.get("coverageStartDate") or "", reverse=True)
    if q:
        needle = q.lower()
        docs = [
            d
            for d in docs
            if needle in (d.get("farmerName") or "").lower()
            or needle in (d.get("farmerPhone") or "")
            or needle in (d.get("policyNumber") or "").lower()
            or needle in (d.get("cropName") or "").lower()
            or needle in (d.get("village") or "").lower()
        ]
    start = (page - 1) * pageSize
    items = [CropInsurancePolicy(**d).model_dump() for d in docs[start : start + pageSize]]
    return {"data": items, "page": page, "pageSize": pageSize, "total": len(docs)}


@router.get("/provider/policies/{policy_id}")
async def provider_get_policy(
    policy_id: str,
    provider: dict = Depends(_require_insurance_provider),
):
    policy = await get_doc("insurance_policies", policy_id)
    if policy is None:
        _error(404, "POLICY_NOT_FOUND", "पॉलिसी नहीं मिली")
    return CropInsurancePolicy(**policy).model_dump()


@router.post("/provider/policies/{policy_id}/review")
async def provider_review_policy(
    policy_id: str,
    body: PolicyReviewIn,
    provider: dict = Depends(_require_insurance_provider),
):
    policy = await get_doc("insurance_policies", policy_id)
    if policy is None:
        _error(404, "POLICY_NOT_FOUND", "पॉलिसी नहीं मिली")

    now = datetime.now(timezone.utc).isoformat()
    farmer_uid = policy.get("userId")

    if body.action == "approve":
        policy["status"] = "active"
        policy["reviewedAt"] = now
        policy["reviewedBy"] = provider["id"]
        policy["insuranceCompany"] = (
            body.insuranceCompany or provider.get("companyName") or policy.get("insuranceCompany") or "AIC of India"
        )
        policy["underwriterNotes"] = body.underwriterNotes or "Underwriting verification successful. Policy endorsed."
        try:
            pdf_path = reports.build_policy_certificate_pdf(policy)
            url = reports.upload_to_storage(pdf_path, f"certificates/{farmer_uid or 'farmer'}/{policy_id}.pdf")
            policy["certificateUrl"] = url
        except Exception:
            pass

        if farmer_uid:
            try:
                await send_fcm_to_user(
                    farmer_uid,
                    "फसल बीमा स्वीकृत! 🎉",
                    f"आपकी पॉलिसी {policy.get('policyNumber')} बीमा प्रदाता द्वारा स्वीकृत कर दी गई है। ई-प्रमाणपत्र उपलब्ध है।",
                    {"channel": "insurance", "policyId": policy_id},
                )
            except Exception:
                pass
    elif body.action == "reject":
        if not body.rejectionReason:
            _error(422, "REASON_REQUIRED", "अस्वीकृति का कारण आवश्यक है")
        policy["status"] = "rejected"
        policy["reviewedAt"] = now
        policy["reviewedBy"] = provider["id"]
        policy["rejectionReason"] = body.rejectionReason
        policy["underwriterNotes"] = body.underwriterNotes

        if farmer_uid:
            try:
                await send_fcm_to_user(
                    farmer_uid,
                    "फसल बीमा आवेदन अस्वीकृत",
                    f"आपकी पॉलिसी {policy.get('policyNumber')} अस्वीकृत: {body.rejectionReason}",
                    {"channel": "insurance", "policyId": policy_id},
                )
            except Exception:
                pass

    await set_doc("insurance_policies", policy_id, policy)
    if farmer_uid:
        await set_doc(f"users/{farmer_uid}/insurance_policies", policy_id, policy)

    return CropInsurancePolicy(**policy).model_dump()


# ==============================================================================
# Insurance Provider Claims Review & Settlement Endpoints
# ==============================================================================


@router.get("/provider/claims")
async def provider_list_claims(
    status: str | None = Query(None),
    calamityType: str | None = Query(None),
    q: str | None = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    provider: dict = Depends(_require_insurance_provider),
):
    filters = []
    if status and status != "all":
        filters.append(("status", "==", status))
    if calamityType:
        filters.append(("calamityType", "==", calamityType))

    docs = await query("insurance_claims", filters if filters else None, limit=2000)
    docs.sort(key=lambda d: d.get("submittedAt", ""), reverse=True)
    if q:
        needle = q.lower()
        docs = [
            d
            for d in docs
            if needle in (d.get("farmerName") or "").lower()
            or needle in (d.get("farmerPhone") or "")
            or needle in (d.get("claimNumber") or "").lower()
            or needle in (d.get("cropName") or "").lower()
            or needle in (d.get("village") or "").lower()
        ]
    start = (page - 1) * pageSize
    items = [InsuranceClaimRecord(**d).model_dump() for d in docs[start : start + pageSize]]
    return {"data": items, "page": page, "pageSize": pageSize, "total": len(docs)}


@router.get("/provider/claims/{claim_id}")
async def provider_get_claim(
    claim_id: str,
    provider: dict = Depends(_require_insurance_provider),
):
    claim = await get_doc("insurance_claims", claim_id)
    if claim is None:
        _error(404, "CLAIM_NOT_FOUND", "दावा नहीं मिला")
    return InsuranceClaimRecord(**claim).model_dump()


@router.post("/provider/claims/{claim_id}/schedule_survey")
async def provider_schedule_survey(
    claim_id: str,
    body: ClaimScheduleSurveyIn,
    provider: dict = Depends(_require_insurance_provider),
):
    claim = await get_doc("insurance_claims", claim_id)
    if claim is None:
        _error(404, "CLAIM_NOT_FOUND", "दावा नहीं मिला")

    if claim["status"] == "intimated":
        claim = claims_service.advance_status(
            claim,
            "surveyorAssigned",
            note=body.notes or f"सर्वेयर {body.surveyorName} ({body.surveyorPhone}) {body.surveyorVisitDate} हेतु नियुक्त",
        )
    claim["surveyorName"] = body.surveyorName
    claim["surveyorPhone"] = body.surveyorPhone
    claim["surveyorVisitDate"] = body.surveyorVisitDate

    farmer_uid = claim.get("userId")
    await set_doc("insurance_claims", claim_id, claim)
    if farmer_uid:
        await set_doc(f"users/{farmer_uid}/insurance_claims", claim_id, claim)
        try:
            await send_fcm_to_user(
                farmer_uid,
                "सर्वेयर नियुक्त किया गया",
                f"{body.surveyorName} ({body.surveyorPhone}) {body.surveyorVisitDate} को खेत का निरीक्षण करेंगे।",
                {"channel": "insurance", "claimId": claim_id},
            )
        except Exception:
            pass

    return InsuranceClaimRecord(**claim).model_dump()


@router.post("/provider/claims/{claim_id}/survey_report")
async def provider_submit_survey_report(
    claim_id: str,
    body: ClaimSurveyReportIn,
    provider: dict = Depends(_require_insurance_provider),
):
    claim = await get_doc("insurance_claims", claim_id)
    if claim is None:
        _error(404, "CLAIM_NOT_FOUND", "दावा नहीं मिला")

    if claim["status"] == "surveyorAssigned":
        claim = claims_service.advance_status(
            claim,
            "fieldAssessed",
            note=body.surveyorNotes or f"सर्वेयर द्वारा {body.assessedLossPercent}% फसल नुकसान का सत्यापन किया गया",
        )
    claim["assessedLossPercent"] = body.assessedLossPercent
    if body.cropStageVerified:
        claim["cropStageVerified"] = body.cropStageVerified

    farmer_uid = claim.get("userId")
    await set_doc("insurance_claims", claim_id, claim)
    if farmer_uid:
        await set_doc(f"users/{farmer_uid}/insurance_claims", claim_id, claim)
        try:
            await send_fcm_to_user(
                farmer_uid,
                "खेत का मूल्यांकन पूर्ण",
                f"सर्वेयर ने {body.assessedLossPercent}% नुकसान सत्यापित किया है। रिपोर्ट बीमा समिति को प्रेषित।",
                {"channel": "insurance", "claimId": claim_id},
            )
        except Exception:
            pass

    return InsuranceClaimRecord(**claim).model_dump()


@router.post("/provider/claims/{claim_id}/review")
async def provider_review_claim(
    claim_id: str,
    body: ClaimReviewIn,
    provider: dict = Depends(_require_insurance_provider),
):
    claim = await get_doc("insurance_claims", claim_id)
    if claim is None:
        _error(404, "CLAIM_NOT_FOUND", "दावा नहीं मिला")

    farmer_uid = claim.get("userId")

    if body.action == "approve":
        loss_pct = claim.get("assessedLossPercent", claim.get("estimatedLossPercent", 0))
        approved_amt = body.approvedAmount or round(claim.get("requestedAmount", 0) * (loss_pct / 100), 2)
        if approved_amt <= 0:
            approved_amt = claim.get("requestedAmount", 0)
        claim["approvedAmount"] = approved_amt

        if claim["status"] in ("surveyorAssigned", "intimated"):
            claim = claims_service.advance_status(claim, "fieldAssessed", note="Direct provider fast-track approval")
        if claim["status"] == "fieldAssessed":
            claim = claims_service.advance_status(
                claim,
                "dbtApproved",
                note=body.notes or f"₹{approved_amt} का दावा स्वीकृत — DBT प्रेषण प्रक्रियाधीन",
            )

        if farmer_uid:
            try:
                await send_fcm_to_user(
                    farmer_uid,
                    "दावा राशि स्वीकृत! 💰",
                    f"₹{approved_amt} की दावा राशि स्वीकृत की गई है। DBT अंतरण जल्द पूरा होगा।",
                    {"channel": "insurance", "claimId": claim_id},
                )
            except Exception:
                pass
    elif body.action == "reject":
        if not body.rejectionReason:
            _error(422, "REASON_REQUIRED", "अस्वीकृति का कारण आवश्यक है")
        if claim["status"] in ("intimated", "surveyorAssigned"):
            claim = claims_service.advance_status(claim, "fieldAssessed", note="Provider review before determination")
        if claim["status"] == "fieldAssessed":
            claim = claims_service.advance_status(
                claim,
                "rejected",
                note=body.rejectionReason,
            )
        claim["rejectionReason"] = body.rejectionReason

        if farmer_uid:
            try:
                await send_fcm_to_user(
                    farmer_uid,
                    "दावा अस्वीकृत",
                    f"आपका बीमा दावा अस्वीकृत: {body.rejectionReason}",
                    {"channel": "insurance", "claimId": claim_id},
                )
            except Exception:
                pass

    await set_doc("insurance_claims", claim_id, claim)
    if farmer_uid:
        await set_doc(f"users/{farmer_uid}/insurance_claims", claim_id, claim)

    return InsuranceClaimRecord(**claim).model_dump()


@router.post("/provider/claims/{claim_id}/disburse")
async def provider_disburse_claim(
    claim_id: str,
    body: ClaimDisburseIn,
    provider: dict = Depends(_require_insurance_provider),
):
    claim = await get_doc("insurance_claims", claim_id)
    if claim is None:
        _error(404, "CLAIM_NOT_FOUND", "दावा नहीं मिला")

    if claim["status"] != "dbtApproved":
        _error(409, "NOT_APPROVED", "दावा अभी DBT स्वीकृत स्थिति में नहीं है")

    now = datetime.now(timezone.utc).isoformat()
    dbt_ref = body.dbtTransactionId or f"DBT{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    claim = claims_service.advance_status(
        claim,
        "disbursed",
        note=body.notes or f"राशि DBT द्वारा प्रेषित — ref {dbt_ref}",
    )
    claim["dbtTransactionId"] = dbt_ref
    claim["disbursedAt"] = now

    farmer_uid = claim.get("userId")
    await set_doc("insurance_claims", claim_id, claim)
    if farmer_uid:
        await set_doc(f"users/{farmer_uid}/insurance_claims", claim_id, claim)
        try:
            await send_fcm_to_user(
                farmer_uid,
                "बीमा क्लेम DBT भुगतान सफल! 🏦",
                f"₹{claim.get('approvedAmount', 0)} आपके खाते में अंतरित कर दी गई है। संदर्भ: {dbt_ref}",
                {"channel": "insurance", "claimId": claim_id},
            )
        except Exception:
            pass

    return InsuranceClaimRecord(**claim).model_dump()


# ==============================================================================
# Provider Executive Analytics & Rates
# ==============================================================================


@router.get("/provider/stats")
async def provider_stats(provider: dict = Depends(_require_insurance_provider)):
    policies = await query("insurance_policies", limit=3000)
    claims = await query("insurance_claims", limit=3000)

    by_status_policies: dict[str, int] = {}
    by_crop: dict[str, int] = {}
    total_sum_insured = 0.0
    total_farmer_premium = 0.0
    total_govt_subsidy = 0.0

    for p in policies:
        st = p.get("status", "unknown")
        by_status_policies[st] = by_status_policies.get(st, 0) + 1
        crop = p.get("cropName", "Other")
        by_crop[crop] = by_crop.get(crop, 0) + 1
        total_sum_insured += float(p.get("sumInsured", 0))
        total_farmer_premium += float(p.get("farmerPremium", 0))
        total_govt_subsidy += float(p.get("govtSubsidy", 0))

    by_status_claims: dict[str, int] = {}
    by_calamity: dict[str, int] = {}
    total_requested = 0.0
    total_approved = 0.0
    total_disbursed = 0.0

    for c in claims:
        st = c.get("status", "unknown")
        by_status_claims[st] = by_status_claims.get(st, 0) + 1
        cal = c.get("calamityType", "Other")
        by_calamity[cal] = by_calamity.get(cal, 0) + 1
        total_requested += float(c.get("requestedAmount", 0))
        if c.get("approvedAmount"):
            total_approved += float(c["approvedAmount"])
            if st == "disbursed":
                total_disbursed += float(c["approvedAmount"])

    loss_ratio = round((total_disbursed / total_farmer_premium * 100), 1) if total_farmer_premium > 0 else 0.0

    return {
        "totalPolicies": len(policies),
        "pendingPolicies": by_status_policies.get("pending_approval", 0),
        "activePolicies": by_status_policies.get("active", 0),
        "rejectedPolicies": by_status_policies.get("rejected", 0),
        "totalSumInsured": round(total_sum_insured, 2),
        "totalFarmerPremium": round(total_farmer_premium, 2),
        "totalGovtSubsidy": round(total_govt_subsidy, 2),
        "totalClaims": len(claims),
        "pendingClaims": sum(
            by_status_claims.get(s, 0) for s in ("intimated", "surveyorAssigned", "fieldAssessed", "dbtApproved")
        ),
        "approvedClaims": by_status_claims.get("dbtApproved", 0),
        "disbursedClaims": by_status_claims.get("disbursed", 0),
        "totalClaimRequested": round(total_requested, 2),
        "totalClaimApproved": round(total_approved, 2),
        "totalClaimDisbursed": round(total_disbursed, 2),
        "lossRatioPercent": loss_ratio,
        "byPolicyStatus": by_status_policies,
        "byClaimStatus": by_status_claims,
        "byCrop": by_crop,
        "byCalamity": by_calamity,
    }


@router.post("/provider/rates", status_code=201)
async def provider_create_rate(
    body: RateCreateIn,
    provider: dict = Depends(_require_insurance_provider),
):
    rate_id = f"{body.cropName.lower()}-{body.season.lower()}"
    rate = {
        "id": rate_id,
        "cropName": body.cropName,
        "category": body.category,
        "season": body.season,
        "sumInsuredPerAcre": body.sumInsuredPerAcre,
        "farmerSharePercent": body.farmerSharePercent,
        "totalActuarialRatePercent": body.totalActuarialRatePercent,
        "cutoffDate": body.cutoffDate,
    }
    await set_doc("insurance_rates", rate_id, rate)
    return CropPremiumRate(**rate).model_dump()
