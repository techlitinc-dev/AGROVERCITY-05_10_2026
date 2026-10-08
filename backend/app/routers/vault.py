import logging
import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile

from app.core.db import delete_doc, get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.vault import VaultDocumentOut
from app.services import storage
from app.services.ai import gateway, kyc_schemas, privacy
from app.services.users import get_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/vault", tags=["vault"])

MAX_FILE_BYTES = 5 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "application/pdf"}
KYC_RISK_AUTO_ADVANCE = 0.3


def _names_match(a: object, b: object) -> bool:
    """Profile-consistency check; unknown on either side counts as a match."""
    left = str(a or "").strip().casefold()
    right = str(b or "").strip().casefold()
    if not left or not right:
        return True
    return left == right


async def _run_kyc_ai(uid: str, data: bytes, doc: dict) -> None:
    """M11: extract fields (vision) then score authenticity risk. risk < 0.3
    auto-advances to `verified-pending-bank`; otherwise the doc stays pending for
    the human queue with the reasons attached. Never auto-rejects."""
    doc_type = doc["docType"]
    defaults = kyc_schemas.schema_defaults(doc_type)
    if not defaults:
        return
    raw = await gateway.analyze_image(
        data,
        prompt=f"AGROVERCITY KYC document extraction for {doc_type}. Return the extracted fields as JSON.",
        schema=defaults,
        module="kyc_extract",
    )
    parsed = kyc_schemas.parse_extract(doc_type, raw or {})
    if parsed is None:
        # invalid/unreadable extraction → human queue, no fabricated fields
        doc["riskScore"] = 1.0
        doc["riskReasons"] = ["extraction failed — manual review required"]
        return

    doc["extracted"] = parsed  # masked Aadhaar only (schema-enforced)
    user = await get_user(uid) or {}
    name_field = kyc_schemas.NAME_FIELD.get(doc_type)
    name_match = _names_match(user.get("name"), parsed.get(name_field or ""))
    dob_match = _names_match(
        user.get("dob") or user.get("dateOfBirth"), parsed.get("dob")
    )
    risk_state = privacy.build_kyc_risk_state(
        doc_type,
        name_match=name_match,
        dob_match=dob_match,
        image_quality_ok=True,
        extracted_field_count=len(parsed),
    )
    decision = await gateway.decide(
        risk_state, "kyc.authenticity_risk.v1", module="kyc_risk"
    )
    answers = decision.answers or {}
    risk_score = answers.get("riskScore", 1.0)
    doc["riskScore"] = risk_score
    doc["riskReasons"] = answers.get("riskReasons") or []
    try:
        if float(risk_score) < KYC_RISK_AUTO_ADVANCE:
            doc["status"] = "verified-pending-bank"
    except (TypeError, ValueError):
        pass


def _error(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": {}},
    )


async def _uid(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    return uid


def _out(doc: dict) -> VaultDocumentOut:
    return VaultDocumentOut(
        id=doc["id"],
        docType=doc["docType"],
        fileName=doc["fileName"],
        downloadUrl=storage.signed_download_url(doc["blobPath"]),
        uploadedAt=doc["uploadedAt"],
        sizeBytes=doc["sizeBytes"],
    )


@router.post("/documents", status_code=201, response_model=VaultDocumentOut)
async def upload_document(
    file: UploadFile,
    docType: Literal["aadhaar", "712", "bankPassbook", "soilHealthCard", "other"] = Form(...),
    uid: str = Depends(_uid),
):
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        _error(415, "UNSUPPORTED_FILE_TYPE", "केवल JPEG, PNG या PDF फ़ाइलें स्वीकार्य हैं")
    data = await file.read()
    if len(data) > MAX_FILE_BYTES:
        _error(413, "FILE_TOO_LARGE", "फ़ाइल 5 MB से बड़ी नहीं हो सकती")
    doc_id = uuid.uuid4().hex
    blob_path, size = storage.upload_user_file(
        uid, data, file.filename or "document", file.content_type
    )
    doc = {
        "id": doc_id,
        "docType": docType,
        "fileName": file.filename or "document",
        "blobPath": blob_path,
        "uploadedAt": datetime.now(timezone.utc).isoformat(),
        "sizeBytes": size,
        "status": "pending",
    }
    await set_doc(f"users/{uid}/vault_documents", doc_id, doc)
    await _run_kyc_ai(uid, data, doc)
    await set_doc(f"users/{uid}/vault_documents", doc_id, doc)
    # never log Aadhaar numbers or file bytes
    logger.info("vault upload uid=%s doc_id=%s doc_type=%s size=%d", uid, doc_id, docType, size)
    return _out(doc)


@router.get("/documents")
async def list_documents(uid: str = Depends(_uid)):
    docs = await query(f"users/{uid}/vault_documents", [], limit=200)
    items = [_out(d).model_dump() for d in docs]
    return {"data": items, "page": 1, "pageSize": 20, "total": len(items)}


@router.delete("/documents/{doc_id}", status_code=204)
async def delete_document(doc_id: str, uid: str = Depends(_uid)):
    doc = await get_doc(f"users/{uid}/vault_documents", doc_id)
    if doc is None:
        _error(404, "DOCUMENT_NOT_FOUND", "document not found")
    storage.delete_blob(doc["blobPath"])
    await delete_doc(f"users/{uid}/vault_documents", doc_id)
    # never log Aadhaar numbers or file bytes
    logger.info("vault delete uid=%s doc_id=%s", uid, doc_id)
