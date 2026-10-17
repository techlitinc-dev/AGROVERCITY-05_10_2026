"""Saved searches & harvest-window alerts (features/Vyapari.md V12, P2-3).

Allows traders, buyers, and farmers to persist crop/variety/mandi discovery filters
and configure harvest-window push alerts.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.db import delete_doc, get_doc, query, set_doc
from app.core.deps import current_user_id
from app.services.users import get_user

router = APIRouter(prefix="/saved-searches", tags=["saved-searches"])


def _error(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": {}},
    )


class SavedSearchCreate(BaseModel):
    queryText: str = Field("", description="Keyword search query")
    crop: Optional[str] = None
    variety: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    minPrice: Optional[float] = None
    maxPrice: Optional[float] = None
    minQuantityQuintals: Optional[float] = None
    harvestWindowDays: Optional[int] = 14
    alertsEnabled: bool = True


class AlertConfigIn(BaseModel):
    enabled: bool = True
    pushNotification: bool = True
    sms: bool = False
    harvestWindowDays: Optional[int] = 14


@router.post("", status_code=201)
async def create_saved_search(body: SavedSearchCreate, uid: str = Depends(current_user_id)):
    """P2-3: Save discovery search filters for harvest-window alerts."""
    user = await get_user(uid)
    if not user:
        _error(404, "NOT_FOUND", "user not found")
    search_id = f"srch_{uuid.uuid4().hex[:10]}"
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": search_id,
        "userId": uid,
        **body.model_dump(),
        "createdAt": now,
        "updatedAt": now,
    }
    await set_doc("saved_searches", search_id, doc)
    return doc


@router.get("")
async def list_saved_searches(uid: str = Depends(current_user_id)):
    """P2-3: List saved searches for current user."""
    docs = await query("saved_searches", [("userId", "==", uid)], limit=100)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return {"data": docs, "total": len(docs)}


@router.get("/{search_id}")
async def get_saved_search(search_id: str, uid: str = Depends(current_user_id)):
    """P2-3: Retrieve a saved search by ID."""
    doc = await get_doc("saved_searches", search_id)
    if not doc or doc.get("userId") != uid:
        _error(404, "NOT_FOUND", "saved search not found")
    return doc


@router.delete("/{search_id}")
async def delete_saved_search(search_id: str, uid: str = Depends(current_user_id)):
    """P2-3: Delete a saved search."""
    doc = await get_doc("saved_searches", search_id)
    if not doc or doc.get("userId") != uid:
        _error(404, "NOT_FOUND", "saved search not found")
    await delete_doc("saved_searches", search_id)
    return {"success": True, "id": search_id}


@router.post("/{search_id}/alerts")
async def configure_search_alerts(
    search_id: str,
    body: AlertConfigIn,
    uid: str = Depends(current_user_id),
):
    """P2-3: Enable/configure harvest-window alerts for a saved search."""
    doc = await get_doc("saved_searches", search_id)
    if not doc or doc.get("userId") != uid:
        _error(404, "NOT_FOUND", "saved search not found")
    doc["alertsEnabled"] = body.enabled
    doc["alertConfig"] = body.model_dump()
    doc["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("saved_searches", search_id, doc)
    return {"success": True, "savedSearch": doc}
