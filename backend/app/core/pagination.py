"""Cursor pagination helper (rule 7).

Firestore-backed: ordered queries with `start_after` cursors; the response
shape is the standard `{"items": [...], "nextCursor": ...}`. Cursors are
opaque base64 values of the order field's last value.
"""
import base64
import json
from typing import Any

from app.core import db

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100


class InvalidCursor(ValueError):
    """Raised when a cursor cannot be decoded."""


def encode_cursor(value: Any) -> str:
    payload = json.dumps({"v": value})
    return base64.urlsafe_b64encode(payload.encode()).decode()


def decode_cursor(cursor: str) -> Any:
    try:
        payload = base64.urlsafe_b64decode(cursor.encode()).decode()
        return json.loads(payload)["v"]
    except Exception as exc:  # noqa: BLE001 — any malformed cursor is invalid
        raise InvalidCursor("invalid cursor") from exc


async def fetch_page(
    collection: str,
    filters: list[tuple[str, str, Any]] | None = None,
    order_field: str = "createdAt",
    descending: bool = True,
    cursor: str | None = None,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> dict:
    size = max(1, min(int(page_size or DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE))
    cursor_value = decode_cursor(cursor) if cursor else None
    rows = await db.query_cursor(
        collection, filters, order_field, descending, cursor_value, size + 1
    )
    has_more = len(rows) > size
    items = rows[:size]
    next_cursor = None
    if has_more and items:
        next_cursor = encode_cursor(items[-1].get(order_field))
    return {"items": items, "nextCursor": next_cursor}
