"""ai.C4 demand forecast (`demand.forecast.v1`, phase-08).

Buying-signal forecast for vyapari / dairy managers: expected demand for a
crop or product over the next N days from daily sales history + season +
festival days, with a low/expected/high band and a stock-up/hold/reduce
suggestion. The forecast is made ONLY through `app/services/ai/gateway.py`
(rule 10); it is always labeled an estimate (honesty rule) and stays at
`suggest` — the buyer always decides. On any AI degradation (budget trip /
provider error / module flag off) the answer degrades to the registered
deterministic heuristic, never a 500.
"""
import logging

from app.services.ai import gateway, privacy, question_sets

log = logging.getLogger(__name__)

MODULE = "demand_forecast"
QUESTION_SET_ID = "demand.forecast.v1"

ANSWER_KEYS = (
    "expected_units",
    "low_units",
    "high_units",
    "trend_pct",
    "recommendation",
    "explanation",
)


def build_demand_forecast_state(payload: dict) -> dict:
    """C4 state builder: daily unit history + season/festival counters only,
    pseudonymized, ≤1500 tokens, no PII (rule 11)."""
    history = []
    for value in (payload.get("historyUnits") or [])[:60]:
        try:
            units = float(value)
        except (TypeError, ValueError):
            units = 0.0
        history.append(round(max(0.0, units), 2))
    state = {
        "product": str(payload.get("product") or "")[:80],
        "category": str(payload.get("category") or "crop")[:20],
        "history_units": history,
        "horizon_days": int(payload.get("horizonDays") or 7),
        "month": int(payload.get("month") or 0),
        "festival_days": int(payload.get("festivalDays") or 0),
        "current_stock_units": float(payload.get("currentStockUnits") or 0.0),
    }
    return privacy.sanitize_state(state)


async def _decide(state: dict) -> dict:
    """One gateway decide; missing answer keys and hard failures both degrade
    to the registered deterministic fallback (never raises)."""
    try:
        decision = await gateway.decide(state, QUESTION_SET_ID, module=MODULE)
        answers = dict(decision.answers or {})
        if any(key not in answers for key in ANSWER_KEYS):
            answers = {**question_sets.fallback_answers(QUESTION_SET_ID, state), **answers}
        return {
            "answers": answers,
            "confidence": decision.confidence,
            "source": decision.source,
            "decisionId": decision.decision_id,
        }
    except Exception as exc:  # noqa: BLE001 — degrade, never error the request
        log.warning("demand_forecast decide failed (%s) — heuristic fallback", exc)
        return {
            "answers": question_sets.fallback_answers(QUESTION_SET_ID, state),
            "confidence": 0.0,
            "source": "fallback",
            "decisionId": None,
        }


async def forecast_demand(payload: dict) -> dict:
    """Forecast demand for one product; the result is an honest estimate band,
    never invented precision. Never raises."""
    state = build_demand_forecast_state(payload)
    meta = await _decide(state)
    answers = meta["answers"]
    return {
        "product": state["product"],
        "category": state["category"],
        "horizonDays": state["horizon_days"],
        "expectedUnits": float(answers.get("expected_units") or 0.0),
        "lowUnits": float(answers.get("low_units") or 0.0),
        "highUnits": float(answers.get("high_units") or 0.0),
        "band": ["low", "expected", "high"],
        "trendPct": float(answers.get("trend_pct") or 0.0),
        "recommendation": str(answers.get("recommendation") or "hold"),
        "explanation": str(answers.get("explanation") or ""),
        "confidence": meta["confidence"],
        "source": meta["source"],
        "decisionId": meta["decisionId"],
        "estimate": True,
        "aiSuggestion": True,
    }
