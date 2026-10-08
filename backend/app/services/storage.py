"""Firebase Storage access for user documents.

Encryption at rest is provided by Cloud Storage (AES-256/GMEK by default) —
that is what the UI's 'AES-256' badge refers to. Never log Aadhaar numbers
or file bytes.
"""
import logging
import os
import uuid
from datetime import timedelta
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.core.config import settings

logger = logging.getLogger(__name__)

_LOCAL_UPLOAD_ROOT = Path(__file__).resolve().parent.parent.parent / ".local_uploads"

IMAGE_CONTENT_TYPES = {"image/jpeg", "image/png"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024


async def validate_upload(
    file: UploadFile,
    allowed_types: set[str] = IMAGE_CONTENT_TYPES,
    max_bytes: int = MAX_UPLOAD_BYTES,
) -> bytes:
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=415,
            detail={
                "code": "UNSUPPORTED_FILE_TYPE",
                "message": "केवल JPG/PNG फोटो स्वीकार्य हैं",
                "fieldErrors": {},
            },
        )
    data = await file.read()
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail={
                "code": "FILE_TOO_LARGE",
                "message": "फोटो बहुत बड़ी है (अधिकतम 5 MB)",
                "fieldErrors": {},
            },
        )
    return data


def _dev_mode() -> bool:
    return settings.env == "dev"


def upload_user_file(
    uid: str, data: bytes, filename: str, content_type: str, prefix: str = "vault"
) -> tuple[str, int]:
    blob_path = f"{prefix}/{uid}/{uuid.uuid4().hex}_{filename}"
    if _dev_mode():
        target = _LOCAL_UPLOAD_ROOT / blob_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        logger.warning("dev mode: stored upload locally at %s", blob_path)
        return blob_path, len(data)
    import firebase_admin.storage

    blob = firebase_admin.storage.bucket().blob(blob_path)
    blob.upload_from_string(data, content_type=content_type)
    return blob_path, len(data)


def signed_download_url(blob_path: str, minutes: int = 60) -> str:
    if _dev_mode():
        return f"file://{_LOCAL_UPLOAD_ROOT / blob_path}"
    import firebase_admin.storage

    blob = firebase_admin.storage.bucket().blob(blob_path)
    return blob.generate_signed_url(expiration=timedelta(minutes=minutes), method="GET")


def read_blob(blob_path: str) -> bytes:
    """Read an uploaded blob's bytes (used by the receipt-scan vision path).

    Dev mode reads the local upload store; a missing file returns b"" so the
    shim/test path still works without a live bucket.
    """
    if _dev_mode():
        target = _LOCAL_UPLOAD_ROOT / blob_path
        try:
            return target.read_bytes()
        except OSError:
            return b""
    import firebase_admin.storage

    return firebase_admin.storage.bucket().blob(blob_path).download_as_bytes()


def delete_blob(blob_path: str):
    if _dev_mode():
        try:
            os.remove(_LOCAL_UPLOAD_ROOT / blob_path)
        except OSError:
            pass
        return
    import firebase_admin.storage

    firebase_admin.storage.bucket().blob(blob_path).delete()
