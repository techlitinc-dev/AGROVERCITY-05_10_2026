"""Golden-set regression alerting (phase-08 WS-02 tasks 2.7–2.8).

The nightly golden run (live models in prod; shim in CI) stores each set's
accuracy in `ai_golden_baselines/<id>`. A drop of more than 5 points versus the
trailing baseline fires a Sentry alert AND sets the banner flag the admin AI
Health page reads (`ai_golden_banner/current`).
"""
import json
import logging
import os
from datetime import datetime, timezone

import sentry_sdk

from app.core.db import get_doc, set_doc
from app.services.ai import question_sets

log = logging.getLogger(__name__)

REGRESSION_DROP = 0.05
BANNER_COLLECTION = "ai_golden_banner"
BASELINE_COLLECTION = "ai_golden_baselines"
GOLDEN_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "tests", "fixtures", "ai", "golden")
)


async def record_golden_accuracy(question_set_id: str, accuracy: float) -> bool:
    """Store a set's golden accuracy; alert when it drops >5pt vs the baseline."""
    now = datetime.now(timezone.utc).isoformat()
    previous = await get_doc(BASELINE_COLLECTION, question_set_id)
    baseline = float(previous["accuracy"]) if previous and previous.get("accuracy") is not None else None
    alert = False
    if baseline is not None and (baseline - accuracy) > REGRESSION_DROP:
        alert = True
        log.error(
            "AI golden regression for %s: %.3f -> %.3f (>5pt)",
            question_set_id, baseline, accuracy,
        )
        sentry_sdk.capture_message(
            f"AI golden regression for {question_set_id}: {baseline:.3f} -> {accuracy:.3f}",
            level="error",
        )
        await set_doc(
            BANNER_COLLECTION,
            "current",
            {
                "questionSetId": question_set_id,
                "regressionAlert": True,
                "baseline": baseline,
                "accuracy": accuracy,
                "at": now,
            },
        )
    await set_doc(
        BASELINE_COLLECTION,
        question_set_id,
        {"questionSetId": question_set_id, "accuracy": accuracy, "updatedAt": now},
    )
    return alert


def _score(answers: dict, expected: dict) -> tuple[int, int]:
    matched = total = 0
    for key, value in (expected or {}).items():
        total += 1
        if answers.get(key) == value:
            matched += 1
    return matched, total


async def run_golden_suite() -> dict:
    """Score every question set's deterministic answers against its golden cases.

    Used by CI (shim) and the nightly job (live models). Writes baselines and
    fires regression alerts when a set drops >5pt.
    """
    scored = 0
    alerts = 0
    for question_set_id in question_sets.REGISTRY:
        path = os.path.join(GOLDEN_DIR, f"{question_set_id}.jsonl")
        if not os.path.exists(path):
            continue
        matched = total = 0
        with open(path, encoding="utf-8") as handle:
            for line in handle:
                if not line.strip():
                    continue
                record = json.loads(line)
                if "output" not in record:
                    continue
                answers = question_sets.fallback_answers(question_set_id, record.get("input") or {})
                m, t = _score(answers, record["output"])
                matched += m
                total += t
        if total == 0:
            continue
        accuracy = matched / total
        scored += 1
        if await record_golden_accuracy(question_set_id, accuracy):
            alerts += 1
    return {"scored": scored, "alerts": alerts}
