"""Dairy milk-adulteration AI (M17, suggest level).

Annotates a milk collection with an adulteration flag via
`dairy.adulteration.v1` over the member's 30-day FAT/SNF baseline. Provider
failures degrade to the deterministic fallback, logged with `fallbackUsed`;
the collection write is never blocked.
"""
import logging
from datetime import datetime, timedelta, timezone

from app.core.db import query
from app.services.ai import config_store, decision_log, gateway, question_sets
from app.services.ai.privacy import build_adulteration_state

log = logging.getLogger(__name__)

DAIRY_ADULTERATION_MODULE = "dairy_adulteration"
DAIRY_ADULTERATION_QUESTION_SET = "dairy.adulteration.v1"
DAIRY_ADULTERATION_WINDOW_DAYS = 30


def _window_start(date_str: str) -> str:
    try:
        day = datetime.fromisoformat(date_str).date()
    except (TypeError, ValueError):
        day = datetime.now(timezone.utc).date()
    return (day - timedelta(days=DAIRY_ADULTERATION_WINDOW_DAYS)).isoformat()


async def _member_milk_baseline(collection: dict) -> list[dict]:
    """Prior FAT/SNF readings for the same member inside the 30-day window."""
    member_id = collection.get("memberId")
    farmer_code = collection.get("farmerCode")
    if not member_id and not farmer_code:
        return []
    target_date = str(collection.get("date") or "")
    window_start = _window_start(target_date)
    docs = await query("milk_collections", [], limit=2000)
    history: list[dict] = []
    for doc in docs:
        if doc.get("id") == collection.get("id"):
            continue
        if member_id:
            if doc.get("memberId") != member_id:
                continue
        elif doc.get("farmerCode") != farmer_code:
            continue
        day = str(doc.get("date") or "")
        if day and window_start <= day <= (target_date or day):
            history.append(doc)
    history.sort(key=lambda d: d.get("date") or "")
    return history


async def annotate_collection_adulteration(collection: dict) -> dict | None:
    """M17 — annotate one collection with an adulteration flag.

    Returns `{anomaly, confidence, baseline, sampleCount, decisionId}` or None
    when the `dairy_adulteration` flag is off (the collection saves unchanged).
    The write is NEVER blocked: provider failures degrade to the deterministic
    fallback and are logged with `fallbackUsed` via the gateway/decision log.
    """
    if not await config_store.module_enabled(DAIRY_ADULTERATION_MODULE):
        return None

    history = await _member_milk_baseline(collection)
    today = {
        "memberId": collection.get("memberId"),
        "fatPercent": collection.get("fatPercent"),
        "snfPercent": collection.get("snfPercent"),
        "date": collection.get("date"),
        "windowDays": DAIRY_ADULTERATION_WINDOW_DAYS,
    }
    state = build_adulteration_state(history, today)
    try:
        decision = await gateway.decide(
            state,
            DAIRY_ADULTERATION_QUESTION_SET,
            ctx=collection.get("memberId"),
            module=DAIRY_ADULTERATION_MODULE,
        )
        answers = dict(decision.answers or {})
        confidence = float(decision.confidence or 0.0)
        decision_id = decision.decision_id
    except Exception as exc:  # noqa: BLE001 — degrade, never block the collection
        log.warning("dairy adulteration decide failed (%s) — degrading to fallback", exc)
        answers = question_sets.fallback_answers(DAIRY_ADULTERATION_QUESTION_SET, state)
        confidence = 0.0
        decision_id = await decision_log.log_decision(
            module=DAIRY_ADULTERATION_MODULE,
            question_set_id=DAIRY_ADULTERATION_QUESTION_SET,
            version="v1",
            state=state,
            answers=answers,
            confidence=0.0,
            latency_ms=0,
            cost_usd=0.0,
            model="none",
            source="fallback",
            fallback_used=True,
        )

    baseline = answers.get("baseline") or {}
    return {
        "anomaly": bool(answers.get("anomaly")),
        "confidence": round(confidence, 3),
        "baseline": {
            "fatAvg": baseline.get("fatAvg"),
            "snfAvg": baseline.get("snfAvg"),
            "windowDays": baseline.get("windowDays") or DAIRY_ADULTERATION_WINDOW_DAYS,
        },
        "sampleCount": len(history),
        "decisionId": decision_id,
    }
