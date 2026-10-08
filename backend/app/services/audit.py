"""Immutable admin audit log (phase-07 WS-01).

`audit_logs` documents are append-only: this module exposes exactly one write
helper (`log_admin_action`) and deliberately no update/delete path anywhere.
"""
from datetime import datetime, timezone
from uuid import uuid4

from app.core.db import set_doc


async def log_admin_action(
    admin: dict,
    module: str,
    action: str,
    target_id: str,
    previous: dict | None,
    new: dict | None,
    reason: str,
    ip: str | None,
) -> str:
    """Write one canonical `audit_logs` document and return its id."""
    audit_id = f"aud_{uuid4().hex}"
    await set_doc(
        "audit_logs",
        audit_id,
        {
            "id": audit_id,
            "adminId": admin.get("id") or admin.get("uid"),
            "adminEmail": admin.get("email"),
            "module": module,
            "action": action,
            "targetId": target_id,
            "previousState": previous,
            "newState": new,
            "reason": reason,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "ipAddress": ip,
        },
    )
    return audit_id
