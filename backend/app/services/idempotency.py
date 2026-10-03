"""Idempotency-Key replay store for write endpoints (rule 7).

Same key + scope replays the stored first response instead of performing the
transition twice. Kept self-contained here so routers never reinvent it.
"""
import hashlib
from datetime import datetime, timezone

from app.core.db import get_doc, set_doc

COLLECTION = "idempotency_keys"


def _key_id(scope: str, key: str) -> str:
    digest = hashlib.sha256(f"{scope}:{key}".encode()).hexdigest()[:24]
    return f"idem_{digest}"


async def replay(scope: str, key: str | None) -> dict | None:
    """Return the stored response for a replayed key, else None."""
    if not key:
        return None
    doc = await get_doc(COLLECTION, _key_id(scope, key))
    return (doc or {}).get("response")


async def store(scope: str, key: str, response: dict) -> None:
    await set_doc(
        COLLECTION,
        _key_id(scope, key),
        {"response": response, "at": datetime.now(timezone.utc).isoformat()},
    )
