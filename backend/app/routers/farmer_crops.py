from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.services.users import get_user

router = APIRouter(prefix="/farmer", tags=["farmer"])


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


class CropCyclePatchIn(BaseModel):
    """Partial update of a farmer's own crop cycle."""

    stage: str | None = Field(default=None, max_length=100)
    status: str | None = Field(default=None, max_length=100)
    notes: str | None = Field(default=None, max_length=2000)


@router.get("/crops")
async def list_crop_cycles(uid: str = Depends(current_user_id)):
    """The caller's crop cycles (sowing intents + confirmed plans), newest first."""
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    docs = await query("crop_cycles", [("userId", "==", uid)], limit=500)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return {"data": docs, "page": 1, "pageSize": 50, "total": len(docs)}


@router.patch("/crops/{cycle_id}")
async def patch_crop_cycle(
    cycle_id: str,
    body: CropCyclePatchIn,
    uid: str = Depends(current_user_id),
):
    """Update stage/status/notes on the caller's own cycle; anything else is a 404."""
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    doc = await get_doc("crop_cycles", cycle_id)
    if doc is None or doc.get("userId") != uid:
        _error(404, "CROP_CYCLE_NOT_FOUND", "crop cycle not found")
    doc.update(body.model_dump(exclude_none=True))
    doc["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("crop_cycles", cycle_id, doc)
    return doc
