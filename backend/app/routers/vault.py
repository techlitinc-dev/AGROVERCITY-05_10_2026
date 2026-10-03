import logging
import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile

from app.core.db import delete_doc, get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.vault import VaultDocumentOut
from app.services import storage
from app.services.users import get_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/vault", tags=["vault"])

MAX_FILE_BYTES = 5 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "application/pdf"}


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
    }
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
