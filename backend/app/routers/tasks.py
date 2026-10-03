"""Task engine router (phase-01 WS-01) — the action layer at /v1/tasks.

Numbers live in /intelligence; this router never duplicates aggregates — it
serves actionable tasks with the standard error envelope, cursor pagination,
and Idempotency-Key-protected transitions.
"""
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.core.pagination import InvalidCursor, fetch_page
from app.services import idempotency, task_ranking
from app.services import tasks as tasks_service
from app.services.ai.outcomes import record_outcome

router = APIRouter(prefix="/tasks", tags=["tasks"])

VALID_STATUSES = ("open", "done", "dismissed")


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sort_key(task: dict):
    """Urgent first, then dueAt ascending (deterministic tie-break by taskId)."""
    return (
        0 if task.get("priority") == "urgent" else 1,
        task.get("dueAt") or "9999-12-31",
        task.get("taskId") or "",
    )


class TaskDecisionIn(BaseModel):
    decisionId: str | None = None


async def _own_task(task_id: str, uid: str) -> dict:
    doc = await get_doc(tasks_service.COLLECTION, task_id)
    if doc is None or doc.get("userId") != uid:
        _error(404, "TASK_NOT_FOUND", "task not found")
    return doc


async def _maybe_record_outcome(task: dict) -> None:
    """WS-03 outcome hook: task completed within 24 h of being headlined."""
    decision_id = task.get("decisionId")
    if not decision_id:
        return
    decision = await get_doc("ai_decisions", decision_id)
    if decision is None:
        return
    try:
        created = datetime.fromisoformat(decision.get("at"))
    except (TypeError, ValueError):
        return
    if datetime.now(timezone.utc) - created <= timedelta(hours=24):
        try:
            await record_outcome(decision_id, "task-completed-within-24h")
        except ValueError:
            return


@router.get("/today")
async def tasks_today(uid: str = Depends(current_user_id)):
    """Open tasks due today or explicitly prioritized urgent/today, AI-ranked
    via tasks.rank.v1 (deterministic fallback; flag-off = plain due-date order)."""
    rows = await query(
        tasks_service.COLLECTION, [("userId", "==", uid), ("status", "==", "open")], limit=1000
    )
    today = date.today().isoformat()
    items = [
        task
        for task in rows
        if task.get("priority") in ("urgent", "today")
        or (task.get("dueAt") or "")[:10] <= today
    ]
    items.sort(key=_sort_key)
    ranked, _headline = await task_ranking.rank_tasks(uid, "all", items)
    return {"items": ranked}


@router.get("")
async def list_tasks(
    persona: str | None = Query(None),
    status: str | None = Query(None),
    cursor: str | None = Query(None),
    pageSize: int = Query(20, ge=1, le=100),
    uid: str = Depends(current_user_id),
):
    if status is not None and status not in VALID_STATUSES:
        _error(400, "INVALID_STATUS", f"status must be one of {', '.join(VALID_STATUSES)}")
    filters: list[tuple[str, str, str]] = [("userId", "==", uid)]
    if persona:
        filters.append(("persona", "==", persona))
    if status:
        filters.append(("status", "==", status))
    try:
        page = await fetch_page(
            tasks_service.COLLECTION,
            filters,
            order_field="createdAt",
            descending=True,
            cursor=cursor,
            page_size=pageSize,
        )
    except InvalidCursor:
        _error(400, "INVALID_CURSOR", "the pagination cursor is malformed")
    return page


@router.post("/{task_id}/done")
async def complete_task(
    task_id: str,
    body: TaskDecisionIn | None = None,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(current_user_id),
):
    if not idempotency_key:
        _error(400, "IDEMPOTENCY_KEY_REQUIRED", "an Idempotency-Key header is required")
    stored = await idempotency.replay("tasks.done", idempotency_key)
    if stored is not None:
        return stored

    doc = await _own_task(task_id, uid)
    if doc.get("status") == "done":
        response = {"ok": True, "task": doc}
    elif doc.get("status") == "dismissed":
        _error(409, "TASK_ALREADY_DISMISSED", "a dismissed task cannot be completed")
    else:
        doc["status"] = "done"
        doc["updatedAt"] = _now()
        if body is not None and body.decisionId:
            doc["decisionId"] = body.decisionId
        await set_doc(tasks_service.COLLECTION, task_id, doc)
        await _maybe_record_outcome(doc)
        response = {"ok": True, "task": doc}

    await idempotency.store("tasks.done", idempotency_key, response)
    return response


@router.post("/{task_id}/dismiss")
async def dismiss_task(
    task_id: str,
    body: TaskDecisionIn | None = None,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(current_user_id),
):
    if not idempotency_key:
        _error(400, "IDEMPOTENCY_KEY_REQUIRED", "an Idempotency-Key header is required")
    stored = await idempotency.replay("tasks.dismiss", idempotency_key)
    if stored is not None:
        return stored

    doc = await _own_task(task_id, uid)
    if doc.get("status") == "dismissed":
        response = {"ok": True, "task": doc}
    elif doc.get("status") == "done":
        _error(409, "TASK_ALREADY_DONE", "a completed task cannot be dismissed")
    else:
        doc["status"] = "dismissed"
        doc["updatedAt"] = _now()
        if body is not None and body.decisionId:
            doc["decisionId"] = body.decisionId
        await set_doc(tasks_service.COLLECTION, task_id, doc)
        response = {"ok": True, "task": doc}

    await idempotency.store("tasks.dismiss", idempotency_key, response)
    return response


@router.get("/summary")
async def tasks_summary(
    persona: str | None = Query(None, description="persona id, or the literal all"),
    uid: str = Depends(current_user_id),
):
    """Per-module open counts + top-3 urgent items per persona."""
    rows = await query(
        tasks_service.COLLECTION, [("userId", "==", uid), ("status", "==", "open")], limit=1000
    )
    if persona and persona != "all":
        rows = [task for task in rows if task.get("persona") == persona]

    grouped: dict[str, dict] = {}
    for task in rows:
        key = task.get("persona") or "unknown"
        bucket = grouped.setdefault(key, {"moduleCounts": {}, "topUrgent": [], "_all": []})
        module = task.get("module") or "unknown"
        bucket["moduleCounts"][module] = bucket["moduleCounts"].get(module, 0) + 1
        bucket["_all"].append(task)

    for persona_key, bucket in grouped.items():
        # WS-03: rank each persona's open tasks; topUrgent keeps its shape but
        # ranked items carry decisionId and the per-persona headline marker.
        ranked, _headline = await task_ranking.rank_tasks(uid, persona_key, bucket.pop("_all"))
        urgent = [task for task in ranked if task.get("priority") == "urgent"]
        bucket["topUrgent"] = urgent[:3]
    return {"personas": grouped}
