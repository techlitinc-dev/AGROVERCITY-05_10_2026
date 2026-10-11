"""ai.B17 weather spray-window classifier (`weather.spray_window.v1`, phase-08).

Farmer advisory for disease/pest spraying: given the hourly forecast windows
ahead (rain, wind, humidity, temperature), classify the next ~48 hours as
GO / CAUTION / NO-GO, name the first clean window, and explain the call in
plain language ("spray in the next 36 hours"). The decision is made ONLY
through `app/services/ai/gateway.py` (rule 10); `suggest` level — the farmer
always decides, and the advisory degrades to the registered deterministic
window-scan on any AI failure (budget trip / provider error / module flag off),
never a 500.
"""
import logging

from app.services.ai import gateway, privacy, question_sets

log = logging.getLogger(__name__)

MODULE = "spray_window"
QUESTION_SET_ID = "weather.spray_window.v1"

ANSWER_KEYS = ("window_class", "best_window_hours", "reasons")


def build_spray_window_state(
    windows: list[dict],
    crop: str | None = None,
    spray_type: str | None = None,
) -> dict:
    """B17 state builder: the forecast windows + crop/spray type only — no
    location finer than district, no PII (rule 11), ≤1500 tokens."""
    clean_windows = []
    for window in (windows or [])[:72]:
        if not isinstance(window, dict):
            continue
        clean_windows.append(
            {
                "hours_from_now": int(window.get("hoursFromNow") or 0),
                "rain_mm": float(window.get("rainMm") or 0.0),
                "wind_kmph": float(window.get("windKmph") or 0.0),
                "humidity_pct": float(window.get("humidityPct") or 0.0),
                "temp_celsius": float(window.get("tempCelsius") or 0.0),
            }
        )
    state = {
        "crop": str(crop or "")[:60],
        "spray_type": str(spray_type or "spray")[:40],
        "windows": clean_windows,
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
        log.warning("spray_window decide failed (%s) — heuristic fallback", exc)
        return {
            "answers": question_sets.fallback_answers(QUESTION_SET_ID, state),
            "confidence": 0.0,
            "source": "fallback",
            "decisionId": None,
        }


async def classify_spray_window(
    windows: list[dict],
    crop: str | None = None,
    spray_type: str | None = None,
) -> dict:
    """Classify the spray window for the given forecast; never raises."""
    state = build_spray_window_state(windows, crop=crop, spray_type=spray_type)
    meta = await _decide(state)
    answers = meta["answers"]
    return {
        "crop": state["crop"] or None,
        "sprayType": state["spray_type"],
        "windowClass": str(answers.get("window_class") or "no_go"),
        "bestWindowHours": answers.get("best_window_hours"),
        "reasons": list(answers.get("reasons") or []),
        "confidence": meta["confidence"],
        "source": meta["source"],
        "decisionId": meta["decisionId"],
        "aiSuggestion": True,
    }
