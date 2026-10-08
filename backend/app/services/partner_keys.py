"""B2B partner API keys (phase-08 WS-03, robust.md §8.9 G11).

Keys are shown in plaintext exactly once at creation and stored only as a
SHA-256 hash. Revoked keys fail immediately. Scopes gate the read endpoints
(`mandi:read`, `saturation:read`).
"""
import hashlib
import secrets
import uuid
from datetime import datetime, timezone

from app.core.db import get_doc, query, set_doc

COLLECTION = "partner_api_keys"
VALID_SCOPES = ("mandi:read", "saturation:read")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _hash_key(plaintext: str) -> str:
    return hashlib.sha256(plaintext.encode()).hexdigest()


async def issue_key(partner_id: str, scopes: list[str], rate_limit: int = 60) -> dict:
    """Create a key; returns the plaintext key exactly once."""
    key_id = f"pk_{uuid.uuid4().hex[:12]}"
    plaintext = f"agvk_{secrets.token_urlsafe(24)}"
    doc = {
        "keyId": key_id,
        "partnerId": partner_id,
        "scopes": [s for s in scopes if s in VALID_SCOPES],
        "rateLimit": int(rate_limit),
        "keyHash": _hash_key(plaintext),
        "createdAt": _now(),
        "revokedAt": None,
    }
    await set_doc(COLLECTION, key_id, doc)
    public = {k: v for k, v in doc.items() if k != "keyHash"}
    return {"key": plaintext, **public}


async def revoke_key(key_id: str) -> dict:
    doc = await get_doc(COLLECTION, key_id)
    if doc is None:
        raise ValueError("key not found")
    doc["revokedAt"] = _now()
    await set_doc(COLLECTION, key_id, doc)
    return {k: v for k, v in doc.items() if k != "keyHash"}


async def get_key(key_id: str) -> dict | None:
    doc = await get_doc(COLLECTION, key_id)
    if doc is None:
        return None
    return {k: v for k, v in doc.items() if k != "keyHash"}


async def list_keys(partner_id: str | None = None) -> list[dict]:
    filters = [("partnerId", "==", partner_id)] if partner_id else None
    rows = await query(COLLECTION, filters, limit=500)
    return [{k: v for k, v in r.items() if k != "keyHash"} for r in rows]


async def verify_key(plaintext: str) -> dict | None:
    """Return the key doc for a valid, non-revoked key; else None."""
    if not plaintext:
        return None
    rows = await query(COLLECTION, [("keyHash", "==", _hash_key(plaintext))], limit=1)
    doc = rows[0] if rows else None
    if doc is None or doc.get("revokedAt"):
        return None
    return {k: v for k, v in doc.items() if k != "keyHash"}
