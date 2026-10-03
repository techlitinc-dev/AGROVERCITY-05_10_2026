"""KYC router (WS-04): case submission, status, and signed-URL document upload.

Never stores unmasked Aadhaar — callers submit storage paths/masked references.
"""
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.core.deps import current_user_id
from app.services import kyc as kyc_service
from app.services import storage

router = APIRouter(prefix="/kyc", tags=["kyc"])

KYC_CONTENT_TYPES = {"image/jpeg", "image/png", "application/pdf"}


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


class KycDocIn(BaseModel):
    type: str
    storagePath: str | None = None
    expiresAt: str | None = None
    extractedRef: str | None = None


class KycCaseIn(BaseModel):
    persona: str = Field(..., min_length=1)
    docs: list[KycDocIn] = Field(default_factory=list)


@router.post("/cases", status_code=201)
async def submit_kyc_case(body: KycCaseIn, uid: str = Depends(current_user_id)):
    try:
        case = await kyc_service.submit_case(
            uid, body.persona, [doc.model_dump() for doc in body.docs]
        )
    except ValueError as exc:
        _error(422, "INVALID_DOCUMENT_MATRIX", str(exc))
    return {"case": case, "requiredDocs": kyc_service.doc_matrix_for(body.persona)}


@router.get("/status")
async def kyc_status(uid: str = Depends(current_user_id)):
    cases = await kyc_service.cases_for_user(uid)
    return {"data": cases, "total": len(cases)}


@router.post("/cases/{case_id}/docs/{doc_id}/upload", status_code=201)
async def upload_kyc_document(
    case_id: str,
    doc_id: str,
    file: UploadFile = File(...),
    uid: str = Depends(current_user_id),
):
    case = await kyc_service.get_case(case_id)
    if case is None:
        _error(404, "KYC_CASE_NOT_FOUND", "kyc case not found")
    if case.get("userId") != uid:
        _error(403, "FORBIDDEN", "not your kyc case")
    if file.content_type not in KYC_CONTENT_TYPES:
        _error(400, "VALIDATION_ERROR", "unsupported content type", {"file": file.content_type})
    data = await file.read()
    if len(data) > storage.MAX_UPLOAD_BYTES:
        _error(400, "VALIDATION_ERROR", "file exceeds 5 MB", {"file": "too large"})
    blob_path, _ = storage.upload_user_file(
        uid,
        data,
        file.filename or f"{uuid.uuid4().hex}.bin",
        file.content_type,
        prefix="kyc",
    )
    try:
        updated = await kyc_service.reupload_doc(case_id, doc_id, blob_path)
    except ValueError:
        _error(404, "KYC_DOC_NOT_FOUND", "document not found in case")
    return {"case": updated, "fileUrl": storage.signed_download_url(blob_path)}
