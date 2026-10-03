import os
from typing import Any

from google.cloud import firestore
from google.oauth2 import service_account

from app.core.config import settings

_client = None


def get_db():
    global _client
    if _client is None:
        path = settings.firebase_service_account_path
        if os.path.exists(path):
            creds = service_account.Credentials.from_service_account_file(path)
            _client = firestore.AsyncClient(project=settings.firebase_project_id, credentials=creds)
        else:
            _client = firestore.AsyncClient(project=settings.firebase_project_id)
    return _client


async def get_doc(collection: str, doc_id: str) -> dict | None:
    snap = await get_db().collection(collection).document(doc_id).get()
    return snap.to_dict() if snap.exists else None


async def set_doc(collection: str, doc_id: str, data: dict):
    await get_db().collection(collection).document(doc_id).set(data)


async def delete_doc(collection: str, doc_id: str):
    await get_db().collection(collection).document(doc_id).delete()


async def query(collection: str, filters: list[tuple[str, str, Any]] | None = None, limit: int = 100) -> list[dict]:
    q = get_db().collection(collection)
    if filters:
        for field, op, value in filters:
            q = q.where(field, op, value)
    return [doc.to_dict() async for doc in q.limit(limit).stream()]


async def query_cursor(
    collection: str,
    filters: list[tuple[str, str, Any]] | None = None,
    order_field: str = "createdAt",
    descending: bool = True,
    cursor_value: Any | None = None,
    limit: int = 20,
) -> list[dict]:
    """Ordered Firestore query with real cursor semantics (start_after).

    The shared pagination helper (`app/core/pagination.py`) calls this; the
    fake store in tests mirrors the same contract. Never limit-100-then-slice.
    """
    q = get_db().collection(collection)
    if filters:
        for field, op, value in filters:
            q = q.where(field, op, value)
    direction = firestore.Query.DESCENDING if descending else firestore.Query.ASCENDING
    q = q.order_by(order_field, direction=direction)
    if cursor_value is not None:
        q = q.start_after({order_field: cursor_value})
    return [doc.to_dict() async for doc in q.limit(limit).stream()]
