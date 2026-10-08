"""Maker-checker approvals (phase-07 WS-01).

Any admin action whose payload amount exceeds ₹10,000 (1,000,000 integer paisa)
must be requested by one admin and approved by a *different* admin before it
executes. Requests and decisions are audit-logged; `audit_logs` stays immutable.

Modules register an executor for `(module, action)` — the function that finally
applies the approved change. `approve()` flips the approval doc and then runs the
registered executor (if any), so execution happens only after approval.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Awaitable, Callable
from uuid import uuid4

from fastapi import HTTPException

from app.core.db import get_doc, set_doc
from app.services.audit import log_admin_action

# ₹10,000 in integer paisa — never a float.
MAKER_CHECKER_THRESHOLD_PAISE = 1_000_000

_EXECUTORS: dict[tuple[str, str], Callable[[dict, dict], Awaitable[None]]] = {}


def _error(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": {}},
    )


def register_executor(
    module: str, action: str, fn: Callable[[dict, dict], Awaitable[None]]
) -> None:
    """Register the function that applies an approved `(module, action)` change.

    `fn(approval_doc, approver)` is awaited by `approve()` after the approval is
    recorded."""
    _EXECUTORS[(module, action)] = fn


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def maybe_require_approval(
    admin: dict,
    module: str,
    action: str,
    payload: dict,
    reason: str,
    force: bool = False,
) -> dict | None:
    """Create a pending approval when the payload exceeds the threshold (or when
    `force` is set, e.g. a config change that always needs a second admin).

    Returns the pending doc (the caller MUST NOT execute) or None (the caller
    executes directly)."""
    try:
        amount = int(payload.get("amountPaise") or 0)
    except (TypeError, ValueError):
        amount = 0
    if not force and amount <= MAKER_CHECKER_THRESHOLD_PAISE:
        return None

    approval_id = f"apr_{uuid4().hex}"
    doc = {
        "id": approval_id,
        "action": action,
        "module": module,
        "payload": payload,
        "requestedBy": admin.get("id") or admin.get("uid"),
        "status": "pending",
        "reason": reason,
        "requestedAt": _now(),
    }
    await set_doc("admin_approvals", approval_id, doc)
    await log_admin_action(
        admin,
        module,
        "approval.requested",
        approval_id,
        None,
        doc,
        reason,
        admin.get("ip"),
    )
    return doc


async def _load_pending(approval_id: str, approver: dict, reason: str) -> dict:
    doc = await get_doc("admin_approvals", approval_id)
    if doc is None:
        _error(404, "NOT_FOUND", "approval not found")
    if doc.get("status") != "pending":
        _error(409, "APPROVAL_ALREADY_DECIDED", "this approval has already been decided")
    approver_id = approver.get("id") or approver.get("uid")
    if approver_id == doc.get("requestedBy"):
        _error(403, "SELF_APPROVAL_FORBIDDEN", "the requester cannot approve their own action")
    return doc


async def approve(approval_id: str, approver: dict, reason: str, ip: str | None) -> dict:
    doc = await _load_pending(approval_id, approver, reason)
    previous = dict(doc)
    doc["status"] = "approved"
    doc["decidedBy"] = approver.get("id") or approver.get("uid")
    doc["decidedAt"] = _now()
    doc["decisionReason"] = reason
    await set_doc("admin_approvals", approval_id, doc)
    await log_admin_action(
        approver, doc["module"], "approval.approved", approval_id, previous, doc, reason, ip
    )
    executor = _EXECUTORS.get((doc["module"], doc["action"]))
    if executor is not None:
        await executor(doc, approver)
    return doc


async def reject(approval_id: str, approver: dict, reason: str, ip: str | None) -> dict:
    doc = await _load_pending(approval_id, approver, reason)
    previous = dict(doc)
    doc["status"] = "rejected"
    doc["decidedBy"] = approver.get("id") or approver.get("uid")
    doc["decidedAt"] = _now()
    doc["decisionReason"] = reason
    await set_doc("admin_approvals", approval_id, doc)
    await log_admin_action(
        approver, doc["module"], "approval.rejected", approval_id, previous, doc, reason, ip
    )
    return doc


async def list_approvals(status: str = "pending") -> list[dict]:
    from app.core.db import query

    docs = await query("admin_approvals", [("status", "==", status)], limit=500)
    docs.sort(key=lambda d: d.get("requestedAt") or "", reverse=True)
    return docs
