"""Task ranking (phase-01 WS-03, brief M5).

Builds the pseudonymized `tasks.rank.v1` state (privacy-sanitized, ≤10 tasks
per decide() call), routes through the AI gateway only (rule 10), and degrades
to the deterministic due-date order on any failure/flag-off — the user still
taps (automation stays `suggest`).
"""
from app.services.ai import config_store, gateway, privacy
from app.services.ai.question_sets import _due_date_order

RANK_QUESTION_SET = "tasks.rank.v1"
MAX_TASKS_PER_CALL = 10
MODULE_FLAG = "tasks"


def build_state(
    uid: str, persona: str, tasks: list[dict], money_ctx: dict | None = None
) -> dict:
    """Pseudonymized ranking state: hashed user id, task facts, money context."""
    return {
        "user": privacy.hash_user_id(uid),
        "persona": persona,
        "tasks": [
            {
                "id": task.get("taskId"),
                "module": task.get("module"),
                "kind": task.get("kind"),
                "priority": task.get("priority"),
                "dueAt": task.get("dueAt"),
                "title": (task.get("title") or {}).get("en"),
            }
            for task in tasks
        ],
        "money": money_ctx or {},
    }


def due_date_order(tasks: list[dict]) -> list[dict]:
    """Deterministic fallback ordering (urgent-first, then dueAt)."""
    state = {"tasks": [{"id": t.get("taskId"), "priority": t.get("priority"), "dueAt": t.get("dueAt")} for t in tasks]}
    ordered_ids = _due_date_order(state)
    by_id = {t.get("taskId"): t for t in tasks}
    return [by_id[task_id] for task_id in ordered_ids if task_id in by_id]


async def rank_tasks(
    uid: str,
    persona: str,
    tasks: list[dict],
    money_ctx: dict | None = None,
) -> tuple[list[dict], str | None]:
    """Return (ranked_tasks, headline_task_id). Never raises."""
    if not tasks:
        return tasks, None

    if not await config_store.module_enabled(MODULE_FLAG):
        # Flag off: plain due-date order, zero AI calls, zero ai_decisions docs.
        return due_date_order(tasks), None

    ranked: list[dict] = []
    seen: set[str] = set()
    headline_id: str | None = None
    headline_confidence: float | None = None
    by_id = {task.get("taskId"): task for task in tasks}

    for start in range(0, len(tasks), MAX_TASKS_PER_CALL):
        chunk = tasks[start : start + MAX_TASKS_PER_CALL]
        state = build_state(uid, persona, chunk, money_ctx)
        try:
            result = await gateway.decide(state, RANK_QUESTION_SET, module=MODULE_FLAG)
        except Exception:  # noqa: BLE001 — degrade, never break the endpoint
            result = None
        if result is None:
            for task in due_date_order(chunk):
                task_id = task.get("taskId")
                if task_id in seen:
                    continue
                seen.add(task_id)
                ranked.append(dict(task))
            continue
        ranking = [task_id for task_id in (result.answers.get("ranking") or []) if task_id in by_id]
        # Deterministic completion: anything the model omitted keeps due-date order.
        for task in due_date_order(chunk):
            task_id = task.get("taskId")
            if task_id not in ranking:
                ranking.append(task_id)
        for task_id in ranking:
            if task_id in seen:
                continue
            seen.add(task_id)
            item = dict(by_id[task_id])
            item["decisionId"] = result.decision_id
            ranked.append(item)
        if headline_id is None and result.answers.get("headline_task"):
            headline_id = result.answers["headline_task"]
            headline_confidence = result.confidence

    for item in ranked:
        if item.get("taskId") == headline_id:
            item["headline_task"] = True
            item["rank_confidence"] = headline_confidence if headline_confidence is not None else 0.0
    return ranked, headline_id
