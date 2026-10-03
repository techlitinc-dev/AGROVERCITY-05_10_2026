"""Outcome linkage (ai.md §7): connects a logged ai_decision to its real-world
resolution so the weekly calibration dataset can measure accuracy."""
from datetime import datetime, timezone

from app.core.db import get_doc, set_doc


async def record_outcome(decision_id: str, outcome: dict) -> dict:
    decision = await get_doc("ai_decisions", decision_id)
    if decision is None:
        raise ValueError(f"unknown decision: {decision_id}")
    record = {
        "decisionId": decision_id,
        "module": decision.get("module"),
        "questionSetId": decision.get("questionSetId"),
        "outcome": outcome,
        "recordedAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("ai_outcomes", decision_id, record)
    return record
