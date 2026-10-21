import logging
import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile

from app.core.db import get_doc, query, set_doc
from app.core.deps import admin_action
from app.models.claims import AppealIn, ClaimFromUploadsIn, InsuranceClaimRecord, PayoutApprovalRequestIn
from app.routers import admin_sop_finance
from app.services import approvals
from app.services import claims as claims_service
from app.services import storage
from app.routers.insurance import _error, _require_insurance_provider, _require_insurance_user, _write_audit

log = logging.getLogger(__name__)

router = APIRouter(prefix="/insurance", tags=["insurance"])
admin_router = admin_sop_finance.router

MAX_CLAIM_PHOTOS = 5

# SOP-15 §6.3 — payouts above ₹50,000 need dual-admin sign-off before the
# provider can disburse. Registered with the maker-checker approvals service so
# the second admin's decision executes the claim release.
PAYOUT_SIGNOFF_MODULE = "insurance"
PAYOUT_SIGNOFF_ACTION = "claim-payout"
PAYOUT_SIGNOFF_THRESHOLD_PAISE = admin_sop_finance.PAYOUT_DUAL_SIGNOFF_PAISE

# --- WS-07 M15 — ClaimsDesk triage -----------------------------------------
# Annotates the intimation response (same-day retake guidance) and the provider
# console. `fraudSignal > 0.8` flags only — it NEVER auto-rejects; filing and the
# human decision path are byte-identical with the AI flag on or off. The AI call
# lives in services/claims.py (rule 10).
FRAUD_FLAG_THRESHOLD = 0.8

PHOTO_GUIDELINES = [
    "पूरे खेत की एक चौड़ी फोटो लें",
    "नुकसान वाले पौधों की नज़दीक से फोटो लें",
    "GPS चालू रखें — लोकेशन अपने आप जुड़ती है",
]


async def _compute_claim_triage(claim: dict) -> dict | None:
    """M15 triage for a freshly intimated claim — delegated to
    services/claims.py (rule 10)."""
    return await claims_service.compute_claim_triage(claim)


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
    if len(damagePhotos) > MAX_CLAIM_PHOTOS:
        _error(422, "TOO_MANY_PHOTOS", "अधिकतम 5 फोटो स्वीकार्य हैं")
    urls = []
    for photo in damagePhotos:
        data = await storage.validate_upload(photo)
        blob_path, _ = storage.upload_user_file(
            uid, data, photo.filename or "photo", photo.content_type, prefix="claims"
        )
        urls.append(storage.signed_download_url(blob_path))
    return await _intimate_claim(
        uid,
        user,
        policyId=policyId,
        cropName=cropName,
        calamityType=calamityType,
        dateOfDamage=dateOfDamage,
        cropStage=cropStage,
        estimatedLossPercent=estimatedLossPercent,
        gpsCoordinates=gpsCoordinates,
        village=village,
        photo_urls=urls,
    )


@router.post("/claims/from-uploads", status_code=201)
async def submit_claim_from_uploads(
    body: ClaimFromUploadsIn,
    user: dict = Depends(_require_insurance_user),
):
    """JSON intimation for clients that uploaded damage photos through
    POST /uploads first — same record, same triage, same audit trail."""
    uid = user["id"]
    if len(body.damagePhotoUrls) > MAX_CLAIM_PHOTOS:
        _error(422, "TOO_MANY_PHOTOS", "अधिकतम 5 फोटो स्वीकार्य हैं")
    return await _intimate_claim(
        uid,
        user,
        policyId=body.policyId,
        cropName=body.cropName,
        calamityType=body.calamityType,
        dateOfDamage=body.dateOfDamage,
        cropStage=body.cropStage,
        estimatedLossPercent=body.estimatedLossPercent,
        gpsCoordinates=body.gpsCoordinates,
        village=body.village,
        photo_urls=list(body.damagePhotoUrls),
    )


async def _intimate_claim(
    uid: str,
    user: dict,
    *,
    policyId: str,
    cropName: str,
    calamityType: str,
    dateOfDamage: str,
    cropStage: str,
    estimatedLossPercent: float,
    gpsCoordinates: str,
    village: str,
    photo_urls: list[str],
) -> dict:
    policy = await get_doc(f"users/{uid}/insurance_policies", policyId)
    if policy is None:
        _error(404, "POLICY_NOT_FOUND", "पॉलिसी नहीं मिली")
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
        "damagePhotos": photo_urls,
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


# ---------------------------------------------------------------------------
# P0-14 / SOP-15 §6.3 — dual sign-off on large claim payouts
# ---------------------------------------------------------------------------

def _claim_payout_paisa(claim: dict) -> int:
    return int(round(float(claim.get("approvedAmount") or 0) * 100))


async def create_claim_payout_signoff(claim: dict, provider: dict, notes: str | None) -> str:
    """Route a large payout through dual-admin sign-off.

    Creates the `admin_approvals` request (module `insurance`, action
    `claim-payout`) and leaves the claim in
    `payoutApprovalStatus="pending_second_signoff"` — it is NOT advanced to
    `dbtApproved`, so `…/disburse` stays blocked (409 PAYOUT_APPROVAL_REQUIRED)
    until a second admin approves. Idempotent: a still-pending request is
    reused instead of creating a duplicate."""
    existing_id = claim.get("payoutApprovalId")
    if claim.get("payoutApprovalStatus") == "pending_second_signoff" and existing_id:
        existing = await get_doc("admin_approvals", existing_id)
        if existing is not None and existing.get("status") == "pending":
            return existing_id

    reason = notes or "SOP-15 dual sign-off: claim payout above ₹50,000"
    approval = await approvals.maybe_require_approval(
        provider,
        PAYOUT_SIGNOFF_MODULE,
        PAYOUT_SIGNOFF_ACTION,
        {
            "amountPaise": _claim_payout_paisa(claim),
            "targetId": claim["id"],
            "userId": claim.get("userId"),
            "claimNumber": claim.get("claimNumber"),
            "approvedAmount": claim.get("approvedAmount"),
            "notes": notes,
        },
        reason,
        force=True,
    )

    claim["payoutApprovalStatus"] = "pending_second_signoff"
    claim["payoutApprovalId"] = approval["id"]
    claim.setdefault("timeline", []).append(
        {
            "status": claim["status"],
            "at": datetime.now(timezone.utc).isoformat(),
            "note": "₹50,000 से अधिक भुगतान — द्वितीय एडमिन हस्ताक्षर लंबित (SOP-15 §6.3)",
        }
    )
    await set_doc("insurance_claims", claim["id"], claim)
    farmer_uid = claim.get("userId")
    if farmer_uid:
        await set_doc(f"users/{farmer_uid}/insurance_claims", claim["id"], claim)
    await _write_audit(
        f"aud_claim_payout_signoff_{claim['id']}",
        {
            "actor": provider["id"],
            "action": "CLAIM_PAYOUT_SIGNOFF_REQUESTED",
            "claimId": claim["id"],
            "claimNumber": claim.get("claimNumber"),
            "reason": reason,
            "approvalId": approval["id"],
            "amountPaisa": _claim_payout_paisa(claim),
            "at": datetime.now(timezone.utc).isoformat(),
        },
    )
    return approval["id"]


async def _claim_payout_signoff_executor(approval_doc: dict, approver: dict) -> None:
    """Second sign-off consumed: release the claim for provider disbursement."""
    payload = approval_doc.get("payload") or {}
    claim_id = payload.get("targetId")
    if not claim_id:
        return
    claim = await get_doc("insurance_claims", claim_id)
    if claim is None or claim.get("payoutApprovalStatus") != "pending_second_signoff":
        return
    claim["payoutApprovalStatus"] = "approved"
    claim["payoutApprovedBy"] = approver.get("id") or approver.get("uid")
    if claim.get("status") == "fieldAssessed":
        try:
            claim = claims_service.advance_status(
                claim,
                "dbtApproved",
                note="द्वितीय एडमिन हस्ताक्षर पूर्ण — DBT भुगतान स्वीकृत (SOP-15 §6.3)",
            )
        except ValueError:
            pass
    await set_doc("insurance_claims", claim_id, claim)
    farmer_uid = claim.get("userId")
    if farmer_uid:
        await set_doc(f"users/{farmer_uid}/insurance_claims", claim_id, claim)
    await _write_audit(
        f"aud_claim_payout_signoff_done_{claim_id}",
        {
            "actor": claim["payoutApprovedBy"],
            "action": "CLAIM_PAYOUT_SIGNOFF_APPROVED",
            "claimId": claim_id,
            "claimNumber": claim.get("claimNumber"),
            "approvalId": approval_doc.get("id"),
            "amountPaisa": _claim_payout_paisa(claim),
            "at": datetime.now(timezone.utc).isoformat(),
        },
    )


approvals.register_executor(
    PAYOUT_SIGNOFF_MODULE, PAYOUT_SIGNOFF_ACTION, _claim_payout_signoff_executor
)


@router.post("/provider/claims/{claim_id}/payout-approval-request")
async def provider_request_payout_approval(
    claim_id: str,
    body: PayoutApprovalRequestIn,
    provider: dict = Depends(_require_insurance_provider),
):
    """Explicit second-signature trigger (SOP-15 §6.3): request dual-admin
    sign-off for a large payout. Same behaviour as an over-threshold review —
    the claim stays `pending_second_signoff` until an admin approves."""
    claim = await get_doc("insurance_claims", claim_id)
    if claim is None:
        _error(404, "CLAIM_NOT_FOUND", "दावा नहीं मिला")
    if not claim.get("approvedAmount") or claim["approvedAmount"] <= 0:
        _error(409, "NOT_APPROVED", "पहले दावा राशि स्वीकृत करें")
    if _claim_payout_paisa(claim) <= PAYOUT_SIGNOFF_THRESHOLD_PAISE:
        _error(409, "APPROVAL_NOT_REQUIRED", "राशि द्वितीय हस्ताक्षर की सीमा (₹50,000) से कम है")
    approval_id = await create_claim_payout_signoff(claim, provider, body.notes)
    return {
        **InsuranceClaimRecord(**claim).model_dump(),
        "requiresApproval": True,
        "approvalId": approval_id,
    }


@admin_router.post("/insurance/claim-payout-approvals/{approval_id}/approve")
async def approve_claim_payout_signoff(
    approval_id: str,
    admin: dict = Depends(admin_action("CLAIM_PAYOUT_APPROVE")),
    x_audit_reason: str | None = Header(None, alias="X-Audit-Reason"),
):
    """Second sign-off (SOP-15 §6.3): approving the payout approval releases the
    claim to `dbtApproved`, after which the provider can disburse."""
    doc = await approvals.approve(
        approval_id,
        {"id": admin.get("uid"), "uid": admin.get("uid")},
        (x_audit_reason or "").strip() or "second sign-off",
        None,
    )
    return {"success": True, "approval": doc}
