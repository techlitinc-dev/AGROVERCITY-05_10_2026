import logging
import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.core.db import get_doc, query, set_doc
from app.models.claims import AppealIn, InsuranceClaimRecord
from app.services import claims as claims_service
from app.services import storage
from app.services.ai import config_store, decision_log, gateway, question_sets
from app.services.ai.privacy import build_claim_triage_state
from app.routers.insurance import _error, _require_insurance_user, _write_audit

log = logging.getLogger(__name__)

router = APIRouter(prefix="/insurance", tags=["insurance"])

MAX_CLAIM_PHOTOS = 5

# --- WS-07 M15 — ClaimsDesk triage -----------------------------------------
# Annotates the intimation response (same-day retake guidance) and the provider
# console. `fraudSignal > 0.8` flags only — it NEVER auto-rejects; filing and the
# human decision path are byte-identical with the AI flag on or off.
CLAIM_TRIAGE_MODULE = "insurance_triage"
CLAIM_TRIAGE_QUESTION_SET = "insurance.triage.v1"
FRAUD_FLAG_THRESHOLD = 0.8

PHOTO_GUIDELINES = [
    "पूरे खेत की एक चौड़ी फोटो लें",
    "नुकसान वाले पौधों की नज़दीक से फोटो लें",
    "GPS चालू रखें — लोकेशन अपने आप जुड़ती है",
]


async def _compute_claim_triage(claim: dict) -> dict | None:
    """M15 triage for a freshly intimated claim. Returns None when the
    `insurance_triage` flag is off (filing is unchanged). Provider failures
    degrade to the deterministic fallback, logged with `fallbackUsed`."""
    if not await config_store.module_enabled(CLAIM_TRIAGE_MODULE):
        return None

    state = build_claim_triage_state(claim)
    try:
        decision = await gateway.decide(
            state,
            CLAIM_TRIAGE_QUESTION_SET,
            ctx=claim.get("userId"),
            module=CLAIM_TRIAGE_MODULE,
        )
        answers = dict(decision.answers or {})
        confidence = float(decision.confidence or 0.0)
        decision_id = decision.decision_id
    except Exception as exc:  # noqa: BLE001 — degrade, never block filing
        log.warning("claim triage failed (%s) — degrading to fallback", exc)
        answers = question_sets.fallback_answers(CLAIM_TRIAGE_QUESTION_SET, state)
        confidence = 0.0
        decision_id = await decision_log.log_decision(
            module=CLAIM_TRIAGE_MODULE,
            question_set_id=CLAIM_TRIAGE_QUESTION_SET,
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

    guidance = answers.get("retakeGuidance") or {}
    completeness = answers.get("completeness")
    try:
        completeness = float(completeness) if completeness is not None else 1.0
    except (TypeError, ValueError):
        completeness = 1.0
    try:
        fraud_signal = float(answers.get("fraudSignal") or 0.0)
    except (TypeError, ValueError):
        fraud_signal = 0.0

    return {
        "photoQuality": answers.get("photoQuality") or "ok",
        "completeness": completeness,
        "retakeGuidance": {"en": str(guidance.get("en") or ""), "hi": str(guidance.get("hi") or "")},
        "fraudSignal": fraud_signal,
        "triageReasons": [str(reason) for reason in (answers.get("triageReasons") or [])],
        "suggestedSurveyor": answers.get("suggestedSurveyor"),
        "confidence": round(confidence, 3),
        "decisionId": decision_id,
    }


def triage_annotation(triage: dict) -> dict:
    """The instant-feedback subset returned to the farmer at intimation."""
    return {
        "photoQuality": triage.get("photoQuality") or "ok",
        "completeness": float(triage.get("completeness") or 0.0),
        "retakeGuidance": triage.get("retakeGuidance") or {"en": "", "hi": ""},
    }


async def _bank_account_last4(uid: str, user: dict) -> str | None:
    accounts = await query(f"users/{uid}/bank_accounts", [], limit=100)
    primary = next(
        (a for a in accounts if a.get("isPrimary") and a.get("verifyStatus") == "verified"),
        None,
    )
    if primary is not None:
        return str(primary["accountNumber"])[-4:]
    digits = re.sub(r"\D", "", user.get("phone", ""))
    return digits[-4:] if digits else None


@router.post("/claims", status_code=201)
async def submit_claim(
    policyId: str = Form(...),
    cropName: str = Form(...),
    calamityType: str = Form(...),
    dateOfDamage: str = Form(...),
    cropStage: str = Form(...),
    estimatedLossPercent: float = Form(..., ge=0, le=100),
    gpsCoordinates: str = Form(...),
    village: str = Form(...),
    damagePhotos: list[UploadFile] = File(...),
    user: dict = Depends(_require_insurance_user),
):
    uid = user["id"]
    policy = await get_doc(f"users/{uid}/insurance_policies", policyId)
    if policy is None:
        _error(404, "POLICY_NOT_FOUND", "पॉलिसी नहीं मिली")
    if len(damagePhotos) > MAX_CLAIM_PHOTOS:
        _error(422, "TOO_MANY_PHOTOS", "अधिकतम 5 फोटो स्वीकार्य हैं")
    urls = []
    for photo in damagePhotos:
        data = await storage.validate_upload(photo)
        blob_path, _ = storage.upload_user_file(
            uid, data, photo.filename or "photo", photo.content_type, prefix="claims"
        )
        urls.append(storage.signed_download_url(blob_path))
    now = datetime.now(timezone.utc).isoformat()
    claim = {
        "id": uuid.uuid4().hex,
        "claimNumber": await claims_service.next_claim_number(user.get("state", "")),
        "policyId": policyId,
        "cropName": cropName,
        "calamityType": calamityType,
        "dateOfDamage": dateOfDamage,
        "cropStage": cropStage,
        "estimatedLossPercent": estimatedLossPercent,
        "requestedAmount": round(policy["sumInsured"] * estimatedLossPercent / 100, 2),
        "approvedAmount": None,
        "status": "intimated",
        "statusText": claims_service.STATUS_TEXT["intimated"],
        **claims_service.auto_assign_surveyor(user.get("district", "")),
        "gpsCoordinates": gpsCoordinates,
        "village": village,
        "damagePhotos": urls,
        "submittedAt": now,
        "dbtTransactionId": None,
        "bankAccountLast4": await _bank_account_last4(uid, user),
        "appealCount": 0,
        "rejectionReason": None,
        "timeline": [
            {"status": "intimated", "at": now, "note": "Claim intimated within 72h window"}
        ],
        "userId": uid,
        "farmerName": user.get("name", "Farmer"),
        "farmerPhone": user.get("phone", ""),
        "farmerDistrict": user.get("district", ""),
        "farmerState": user.get("state", ""),
    }
    # WS-07 M15 — annotate (never block) the intimation with instant triage.
    triage = await _compute_claim_triage(claim)
    if triage is not None:
        claim["triage"] = triage
        claim["fraudFlag"] = bool(float(triage.get("fraudSignal") or 0.0) > FRAUD_FLAG_THRESHOLD)
    await set_doc(f"users/{uid}/insurance_claims", claim["id"], claim)
    await set_doc("insurance_claims", claim["id"], claim)
    # Rule 3: every claim mutation writes an audit_logs row.
    await _write_audit(
        f"aud_claim_intimate_{claim['id']}",
        {
            "actor": uid,
            "action": "CLAIM_INTIMATE",
            "claimId": claim["id"],
            "claimNumber": claim.get("claimNumber"),
            "policyId": policyId,
            "reason": calamityType,
            "amountPaisa": int(round(float(claim.get("requestedAmount") or 0) * 100)),
            "at": now,
        },
    )
    response = {**InsuranceClaimRecord(**claim).model_dump(), "photoGuidelines": PHOTO_GUIDELINES}
    if triage is not None:
        response["triage"] = triage_annotation(triage)
    return response


@router.get("/claims")
async def list_claims(user: dict = Depends(_require_insurance_user)):
    uid = user["id"]
    docs = await query(f"users/{uid}/insurance_claims", [], limit=200)
    docs.sort(key=lambda d: d.get("submittedAt", ""), reverse=True)
    items = [InsuranceClaimRecord(**d).model_dump() for d in docs]
    return {"data": items, "page": 1, "pageSize": 20, "total": len(items)}


@router.get("/claims/{claim_id}")
async def get_claim(claim_id: str, user: dict = Depends(_require_insurance_user)):
    uid = user["id"]
    claim = await get_doc(f"users/{uid}/insurance_claims", claim_id)
    if claim is None:
        _error(404, "CLAIM_NOT_FOUND", "दावा नहीं मिला")
    return InsuranceClaimRecord(**claim).model_dump()


@router.post("/claims/{claim_id}/appeal")
async def appeal_claim(
    claim_id: str, body: AppealIn, user: dict = Depends(_require_insurance_user)
):
    uid = user["id"]
    claim = await get_doc(f"users/{uid}/insurance_claims", claim_id)
    if claim is None:
        _error(404, "CLAIM_NOT_FOUND", "दावा नहीं मिला")
    if claim["status"] != "rejected":
        _error(409, "CLAIM_NOT_REJECTED", "दावा अस्वीकृत स्थिति में नहीं है")
    merged = claim.get("damagePhotos", []) + body.photos
    if len(merged) > MAX_CLAIM_PHOTOS:
        _error(422, "TOO_MANY_PHOTOS", "अधिकतम 5 फोटो स्वीकार्य हैं")
    claim = claims_service.appeal(claim, body.reason)
    claim["damagePhotos"] = merged
    await set_doc(f"users/{uid}/insurance_claims", claim_id, claim)
    await set_doc("insurance_claims", claim_id, claim)
    # Rule 3: appeal/resubmit is a claim mutation — audit it.
    await _write_audit(
        f"aud_claim_appeal_{claim_id}_{claim.get('appealCount')}",
        {
            "actor": uid,
            "action": "CLAIM_APPEAL",
            "claimId": claim_id,
            "claimNumber": claim.get("claimNumber"),
            "reason": body.reason,
            "appealCount": claim.get("appealCount"),
            "at": datetime.now(timezone.utc).isoformat(),
        },
    )
    return InsuranceClaimRecord(**claim).model_dump()
