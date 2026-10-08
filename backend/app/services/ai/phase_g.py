"""Phase-G automation-raise gate (phase-08 WS-02).

Any `suggest → require_confirm` raise in `platform_config/ai` is refused unless
the question set has (a) ≥1,000 logged outcomes, (b) >90% top-bucket accuracy in
the latest calibration report, and (c) maker-checker approval. Credit /
insurance / legal sets are hard-capped at `require_confirm` and never offer
`auto` (rule 12; nothing in this program raises to `auto`).
"""
from app.core.db import query

MIN_OUTCOMES = 1000
TOP_BUCKET_ACCURACY = 0.90
RAISE_FROM = "suggest"
RAISE_TO = "require_confirm"
# Credit / insurance / legal question sets — never above require_confirm.
HARD_CAPPED = ("loans.prescreen.v1", "insurance.triage.v1", "dispute.triage.v1")


class PhaseGGateError(ValueError):
    """Raised when an automation raise lacks the required evidence."""


async def _outcome_count(question_set_id: str) -> int:
    rows = await query("ai_outcomes", [("questionSetId", "==", question_set_id)], limit=20000)
    return len(rows)


async def _latest_calibration() -> dict | None:
    reports = await query("ai_calibration", [], limit=200)
    if not reports:
        return None
    reports.sort(key=lambda d: str(d.get("week") or ""), reverse=True)
    return reports[0]


def _top_bucket_accuracy(report: dict, question_set_id: str) -> float:
    metric = (report.get("metrics") or {}).get(question_set_id)
    if not metric:
        return 0.0
    reliability = metric.get("confidenceBucketReliability") or {}
    if reliability:
        return max(float(value) for value in reliability.values())
    return float(metric.get("accuracy") or 0.0)


async def enforce_automation_raise(previous: dict | None, new: dict | None) -> None:
    """Raise `PhaseGGateError` when a raise lacks evidence. Call before applying."""
    old_auto = (previous or {}).get("automation") or {}
    new_auto = (new or {}).get("automation") or {}
    for question_set_id, level in new_auto.items():
        old_level = old_auto.get(question_set_id, RAISE_FROM)
        if level == old_level:
            continue
        if level == "auto":
            raise PhaseGGateError("AI_AUTOMATION_LEVEL_FORBIDDEN")
        if old_level == RAISE_FROM and level == RAISE_TO:
            if await _outcome_count(question_set_id) < MIN_OUTCOMES:
                raise PhaseGGateError("PHASE_G_INSUFFICIENT_OUTCOMES")
            report = await _latest_calibration()
            if report is None or _top_bucket_accuracy(report, question_set_id) <= TOP_BUCKET_ACCURACY:
                raise PhaseGGateError("PHASE_G_ACCURACY_BELOW_THRESHOLD")
