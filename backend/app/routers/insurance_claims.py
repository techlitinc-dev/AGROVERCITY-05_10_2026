import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.core.db import get_doc, query, set_doc
from app.models.claims import AppealIn, InsuranceClaimRecord
from app.services import claims as claims_service
from app.services import storage
from app.routers.insurance import _error, _require_insurance_user

router = APIRouter(prefix="/insurance", tags=["insurance"])

MAX_CLAIM_PHOTOS = 5

PHOTO_GUIDELINES = [
    "पूरे खेत की एक चौड़ी फोटो लें",
    "नुकसान वाले पौधों की नज़दीक से फोटो लें",
    "GPS चालू रखें — लोकेशन अपने आप जुड़ती है",
]


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
    await set_doc(f"users/{uid}/insurance_claims", claim["id"], claim)
    await set_doc("insurance_claims", claim["id"], claim)
    return {**InsuranceClaimRecord(**claim).model_dump(), "photoGuidelines": PHOTO_GUIDELINES}


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
    return InsuranceClaimRecord(**claim).model_dump()
