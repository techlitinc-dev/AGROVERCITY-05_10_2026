import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.notification import NotificationCreate

router = APIRouter(prefix="/notifications", tags=["notifications"])

_LIST_FIELDS = ("id", "userId", "title", "body", "type", "read", "createdAt", "data")


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
