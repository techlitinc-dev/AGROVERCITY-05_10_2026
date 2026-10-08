import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.notification import NotificationCreate
from app.services import idempotency
from app.services.notify import get_prefs

router = APIRouter(prefix="/notifications", tags=["notifications"])

_LIST_FIELDS = ("id", "userId", "title", "body", "type", "read", "createdAt", "data")


class NotificationPrefsIn(BaseModel):
    categories: dict[str, bool] | None = None
    channels: dict[str, bool] | None = None
    quietHoursOverride: bool | None = None
    digestMode: bool | None = None


def _error(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": {}},
    )


def _shape(doc: dict) -> dict:
    item = {f: doc.get(f) for f in _LIST_FIELDS}
    item["read"] = bool(doc.get("read"))
    item["type"] = doc.get("type") or "general"
    item["data"] = doc.get("data") or {}
    return item


@router.get("")
async def list_notifications(
    page: int = 1, pageSize: int = 20, uid: str = Depends(current_user_id)
):
    docs = await query("notifications", [("userId", "==", uid)], limit=1000)
    docs.sort(key=lambda d: d.get("createdAt") or "", reverse=True)
    total = len(docs)
    start = (page - 1) * pageSize
    return {
        "data": [_shape(d) for d in docs[start : start + pageSize]],
        "page": page,
        "pageSize": pageSize,
        "total": total,
    }


@router.put("/read-all")
async def read_all(uid: str = Depends(current_user_id)):
    docs = await query("notifications", [("userId", "==", uid)], limit=1000)
    now = datetime.now(timezone.utc).isoformat()
    updated = 0
    for doc in docs:
        if doc.get("read"):
            continue
        doc["read"] = True
        doc["readAt"] = now
        await set_doc("notifications", doc["id"], doc)
        updated += 1
    return {"updated": updated}


@router.post("/{notification_id}/read")
async def read_one(notification_id: str, uid: str = Depends(current_user_id)):
    doc = await get_doc("notifications", notification_id)
    if doc is None or doc.get("userId") != uid:
        _error(404, "NOT_FOUND", "notification not found")
    doc["read"] = True
    doc["readAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("notifications", notification_id, doc)
    return {"ok": True}


@router.post("", status_code=201)
async def create_notification(body: NotificationCreate):
    doc = {
        "id": f"ntf_{uuid.uuid4().hex}",
        "userId": body.userId,
        "title": body.title,
        "body": body.body,
        "type": body.type,
        "read": False,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("notifications", doc["id"], doc)
    return _shape(doc)


@router.get("/preferences")
async def get_notification_preferences(uid: str = Depends(current_user_id)):
    """Per-category/channel preferences + quiet-hours override + digest opt-in."""
    return await get_prefs(uid)


@router.put("/preferences")
async def put_notification_preferences(
    body: NotificationPrefsIn,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(current_user_id),
):
    stored = await idempotency.replay("notifications.preferences", idempotency_key)
    if stored is not None:
        return stored
    prefs = await get_prefs(uid)
    if body.categories is not None:
        prefs["categories"].update(body.categories)
    if body.channels is not None:
        prefs["channels"].update(body.channels)
    if body.quietHoursOverride is not None:
        prefs["quietHoursOverride"] = body.quietHoursOverride
    if body.digestMode is not None:
        prefs["digestMode"] = body.digestMode
    await set_doc(f"users/{uid}/notification_prefs", "current", prefs)
    if idempotency_key:
        await idempotency.store("notifications.preferences", idempotency_key, prefs)
    return prefs
