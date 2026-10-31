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
    """Write one canonical `audit_logs` and `admin_audit_logs` document and return its id."""
    audit_id = f"aud_{uuid4().hex}"
    now_iso = datetime.now(timezone.utc).isoformat()
    actor_id = admin.get("id") or admin.get("uid")

    await set_doc(
        "audit_logs",
        audit_id,
        {
            "id": audit_id,
            "adminId": actor_id,
            "adminEmail": admin.get("email"),
            "module": module,
            "action": action,
            "targetId": target_id,
            "previousState": previous,
            "newState": new,
            "reason": reason,
            "timestamp": now_iso,
            "ipAddress": ip,
        },
    )

    # Superadmin audit requirements (Phase 1 WS):
    # admin_audit_logs: target_user_id, actor_admin_id, action, metadata, created_at
    await set_doc(
        "admin_audit_logs",
        audit_id,
        {
            "id": audit_id,
            "target_user_id": target_id,
            "actor_admin_id": actor_id,
            "action": action,
            "metadata": {
                "module": module,
                "previousState": previous,
                "newState": new,
                "reason": reason,
                "ip": ip,
            },
            "created_at": now_iso,
        },
    )

    return audit_id
