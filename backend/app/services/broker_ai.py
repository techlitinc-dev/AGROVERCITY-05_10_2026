"""Broker AI (WS-05 step 2 / WS-06 M19, suggest level).

Lead-quality scoring and round-2 deadlock-risk prediction both ride on
`broker.lead_score.v1` via the gateway (rule 10). Provider failures degrade to
the caller-supplied defaults; the router keeps all deal/lead mutation.
"""
from app.services.ai import gateway

BROKER_LEAD_SCORE_MODULE = "broker_lead_score"
BROKER_LEAD_SCORE_QUESTION_SET = "broker.lead_score.v1"


async def score_lead(state: dict, broker_id: str, default_quality: float = 0.5) -> dict:
    """Scores a lead at creation/respond time. Returns {score, deadlockRisk}
    (the defaults on any failure)."""
    try:
        decision = await gateway.decide(
            state,
            BROKER_LEAD_SCORE_QUESTION_SET,
            ctx=broker_id,
            module=BROKER_LEAD_SCORE_MODULE,
        )
        return {
            "score": float(decision.answers.get("quality", default_quality)),
            "deadlockRisk": float(decision.answers.get("deadlock_risk", 0.0)),
        }
    except Exception:
        return {"score": default_quality, "deadlockRisk": 0.0}


async def predict_deadlock(state: dict, broker_id: str) -> float | None:
    """Round-2 deadlock risk, or None when the model call fails (the deal is
    then left untouched, exactly like the pre-refactor router)."""
    try:
        decision = await gateway.decide(
            state,
            BROKER_LEAD_SCORE_QUESTION_SET,
            ctx=broker_id,
            module=BROKER_LEAD_SCORE_MODULE,
        )
        return float(decision.answers.get("deadlock_risk", 0.0))
    except Exception:
        return None
