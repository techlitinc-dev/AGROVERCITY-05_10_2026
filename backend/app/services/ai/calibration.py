"""Weekly AI calibration (phase-07 WS-08, ai_implementation_plan §7).

Aggregates the `ai_decisions` collection into per-question-set metrics —
accuracy (against outcome hooks), confidence-bucket reliability, fallback rate,
cost per module — and writes `ai_calibration/weekly-YYYY-WW`. A > 5pt accuracy
drop versus the previous week flags `regressionAlert`.
"""
import logging
from datetime import datetime, timedelta, timezone

from app.core.db import get_doc, query, set_doc

log = logging.getLogger(__name__)
REGRESSION_DROP = 0.05


def iso_week_id(offset_weeks: int = 0) -> str:
    day = datetime.now(timezone.utc).date() - timedelta(weeks=offset_weeks)
    iso = day.isocalendar()
    return f"{iso[0]}-W{iso[1]:02d}"


def _bucket(confidence: float) -> str:
    if confidence >= 0.8:
        return "0.8-1.0"
    if confidence >= 0.6:
        return "0.6-0.8"
    if confidence >= 0.4:
        return "0.4-0.6"
    return "0.0-0.4"


async def run_weekly_calibration() -> dict:
    decisions = await query("ai_decisions", None, limit=20000)
    buckets: dict[str, dict] = {}
    for decision in decisions:
        qs = decision.get("questionSetId") or "unknown"
        bucket = buckets.setdefault(
            qs,
            {"count": 0, "fallback": 0, "cost": 0.0, "outcomeTotal": 0, "outcomeHits": 0, "confBuckets": {}},
        )
        bucket["count"] += 1
        if decision.get("fallbackUsed"):
            bucket["fallback"] += 1
        bucket["cost"] += float(decision.get("costUsd") or 0.0)
        outcome = decision.get("outcome")
        if outcome is not None:
            bucket["outcomeTotal"] += 1
            if outcome is True:
                bucket["outcomeHits"] += 1
        cb = _bucket(float(decision.get("confidence") or 0.0))
        cbucket = bucket["confBuckets"].setdefault(cb, {"n": 0, "hits": 0})
        cbucket["n"] += 1
        if outcome is True:
            cbucket["hits"] += 1

    metrics: dict[str, dict] = {}
    for qs, bucket in buckets.items():
        accuracy = (bucket["outcomeHits"] / bucket["outcomeTotal"]) if bucket["outcomeTotal"] else 0.0
        fallback_rate = (bucket["fallback"] / bucket["count"]) if bucket["count"] else 0.0
        reliability = {
            name: round(v["hits"] / v["n"], 3) if v["n"] else 0.0
            for name, v in bucket["confBuckets"].items()
        }
        metrics[qs] = {
            "questionSetId": qs,
            "accuracy": round(accuracy, 3),
            "confidenceBucketReliability": reliability,
            "fallbackRate": round(fallback_rate, 3),
            "costPerModule": round(bucket["cost"], 4),
            "sampleCount": bucket["count"],
        }

    week = iso_week_id(0)
    doc = {
        "id": f"weekly-{week}",
        "week": week,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "metrics": metrics,
    }
    previous = await get_doc("ai_calibration", f"weekly-{iso_week_id(1)}")
    if previous:
        prev_metrics = previous.get("metrics") or {}
        for qs, metric in metrics.items():
            prev = prev_metrics.get(qs)
            if prev and (float(prev.get("accuracy") or 0) - float(metric["accuracy"])) > REGRESSION_DROP:
                metric["regressionAlert"] = True
                log.warning(
                    "AI calibration regression for %s: accuracy dropped >5pts vs %s",
                    qs,
                    previous.get("week"),
                )
    await set_doc("ai_calibration", doc["id"], doc)
    return doc


async def backfill(weeks: int = 6) -> dict:
    """Write calibration reports for any missing recent weeks (task 2.11).

    Reuses the current aggregate so the admin AI Health page always has a
    trailing baseline to compare against; existing weeks are never overwritten.
    """
    current = await run_weekly_calibration()
    written = 0
    for offset in range(1, weeks + 1):
        week = iso_week_id(offset)
        doc_id = f"weekly-{week}"
        if await get_doc("ai_calibration", doc_id) is not None:
            continue
        await set_doc(
            "ai_calibration",
            doc_id,
            {
                "id": doc_id,
                "week": week,
                "generatedAt": datetime.now(timezone.utc).isoformat(),
                "metrics": current.get("metrics") or {},
                "backfilled": True,
            },
        )
        written += 1
    return {"written": written, "currentWeek": current.get("week")}
