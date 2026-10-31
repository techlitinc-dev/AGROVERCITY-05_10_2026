import json
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


# --- Firestore usage counters -----------------------------------------------
# Billed-volume telemetry: every helper increments these so a request
# middleware can log per-endpoint document reads/writes (Firestone bills per
# document read/write regardless of payload size). Monotonic per process.

_usage = {"reads": 0, "writes": 0}


def firestore_usage() -> dict:
    """Snapshot of billed document reads/writes since process start."""
    return dict(_usage)


def _bill_read(n: int):
    _usage["reads"] += max(1, n)


def _bill_write(n: int = 1):
    _usage["writes"] += n


def _filter(field: str, op: str, value: Any):
    return firestore.FieldFilter(field, op, value)


async def get_doc(collection: str, doc_id: str) -> dict | None:
    snap = await get_db().collection(collection).document(doc_id).get()
    _bill_read(1 if snap.exists else 1)
    return snap.to_dict() if snap.exists else None


async def set_doc(collection: str, doc_id: str, data: dict):
    await get_db().collection(collection).document(doc_id).set(data)
    _bill_write()


async def delete_doc(collection: str, doc_id: str):
    await get_db().collection(collection).document(doc_id).delete()
    _bill_write()


async def query(collection: str, filters: list[tuple[str, str, Any]] | None = None, limit: int = 100) -> list[dict]:
    q = get_db().collection(collection)
    if filters:
        for field, op, value in filters:
            q = q.where(filter=_filter(field, op, value))
    docs = [doc.to_dict() async for doc in q.limit(limit).stream()]
    _bill_read(len(docs))
    return docs


async def count(collection: str, filters: list[tuple[str, str, Any]] | None = None) -> int:
    """Server-side COUNT aggregation.

    Bills ~1 read per 1000 index entries scanned (min 1) instead of 1 read per
    matched document — use instead of ``len(await query(...))`` for totals and
    badges. Equality filters only (composite order-by is not required).
    """
    q = get_db().collection(collection)
    if filters:
        for field, op, value in filters:
            q = q.where(filter=_filter(field, op, value))
    result = await q.count().get()
    _bill_read(1)
    return int(result[0][0].value)


async def latest(
    collection: str,
    order_field: str = "createdAt",
    limit: int = 10,
    *,
    ascending: bool = False,
    offset: int = 0,
) -> list[dict]:
    """Ordered page by a single field, NO filters.

    Ordering alone needs no composite index (single-field indexes are
    automatic), so this is the only safe order+limit pushdown while the
    project ships zero composite indexes. ``offset`` gives index-free offset
    pagination for subcollections (e.g. chat messages) whose full scan used to
    cost up to ``limit`` reads per page view.
    """
    direction = firestore.Query.ASCENDING if ascending else firestore.Query.DESCENDING
    q = get_db().collection(collection).order_by(order_field, direction=direction)
    if offset:
        q = q.offset(offset)
    docs = [doc.to_dict() async for doc in q.limit(limit).stream()]
    _bill_read(len(docs))
    return docs


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
            q = q.where(filter=_filter(field, op, value))
    direction = firestore.Query.DESCENDING if descending else firestore.Query.ASCENDING
    q = q.order_by(order_field, direction=direction)
    if cursor_value is not None:
        q = q.start_after({order_field: cursor_value})
    docs = [doc.to_dict() async for doc in q.limit(limit).stream()]
    _bill_read(len(docs))
    return docs


async def cached_query(
    cache_key: str,
    collection: str,
    filters: list[tuple[str, str, Any]] | None = None,
    *,
    limit: int = 1000,
    ttl_seconds: int = 60,
) -> list[dict]:
    """Redis-cached ``query`` for shared/hot read paths.

    On a hit, Firestore is not touched at all; on a miss the full result set is
    cached for ``ttl_seconds`` so concurrent requests share one read burst.
    Cache entries are keyed by the caller and must NOT include per-user data
    unless the key does. Values round-trip through JSON (app data is
    JSON-native: timestamps are stored as ISO strings, not Firestore
    Timestamp objects).
    """
    from app.core.cache import cache_get, cache_set  # deferred: cache imports nothing from db

    cached = await cache_get(cache_key)
    if cached is not None:
        return json.loads(cached)
    docs = await query(collection, filters, limit=limit)
    await cache_set(cache_key, json.dumps(docs, default=str), ttl_seconds=ttl_seconds)
    return docs
