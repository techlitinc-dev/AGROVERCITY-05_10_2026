"""Generic media upload endpoint (audit P0-8).

Any authenticated user can upload files here and receive Firebase Storage URLs
suitable for `mediaUrl`/`thumbnailUrl`/`previewUrl` fields (SOP-27 §2) on
courses, podcasts, and the T13 content library — the scoped KYC/diary/loan
upload routes cannot serve those flows.
"""
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.core.deps import current_user_id
from app.services import storage

router = APIRouter(prefix="/uploads", tags=["uploads"])

MAX_FILES_PER_UPLOAD = 5

UPLOAD_CONTENT_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
}


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


class UploadedFileOut(BaseModel):
    url: str
    storagePath: str
    contentType: str
    sizeBytes: int


@router.post("", status_code=200, response_model=list[UploadedFileOut])
async def upload_files(
    files: list[UploadFile] = File(...),
    uid: str = Depends(current_user_id),
):
    if not 1 <= len(files) <= MAX_FILES_PER_UPLOAD:
        _error(
            400,
            "VALIDATION_ERROR",
            f"between 1 and {MAX_FILES_PER_UPLOAD} files allowed",
            {"files": f"between 1 and {MAX_FILES_PER_UPLOAD} files allowed"},
        )
    uploaded = []
    for file in files:
        if file.content_type not in UPLOAD_CONTENT_TYPES:
            _error(
                400,
                "VALIDATION_ERROR",
                "unsupported content type",
                {"files": f"unsupported content type: {file.content_type}"},
            )
        data = await file.read()
        if len(data) > storage.MAX_UPLOAD_BYTES:
            _error(
                400,
                "VALIDATION_ERROR",
                "file exceeds 5 MB",
                {"files": "file exceeds 5 MB"},
            )
        ext = UPLOAD_CONTENT_TYPES[file.content_type]
        blob_path, size_bytes = storage.upload_user_file(
            uid,
            data,
            f"{uuid.uuid4().hex}.{ext}",
            file.content_type,
            prefix="uploads",
        )
        uploaded.append(
            UploadedFileOut(
                url=storage.signed_download_url(blob_path),
                storagePath=blob_path,
                contentType=file.content_type,
                sizeBytes=size_bytes,
            )
        )
    return uploaded
