"""Transport matching and batch scoring service (M16, flow 5.5).

Evaluates route fit, vehicle type, capacity, and history to match vehicles
and open loads, predicts no-show risk, and ranks return loads.
Automation level is suggest-only (rule 12). Fallback is distance sort.
Outcome hooks record completed / cancelled outcomes for model calibration.
"""
import logging
from datetime import datetime, timezone
from typing import Any

from app.core.db import set_doc
from app.services.ai import decision_log, gateway, privacy

log = logging.getLogger(__name__)


async def score_transport_match(
    entity: dict,
    candidates: list[dict] | None = None,
    history: dict | None = None,
    ctx: str | None = None,
) -> dict[str, Any]:
    """Scores match candidates (vehicles or loads) against an entity (trip/load).

    Falls back to distance sort if the gateway fails or the flag is disabled.
    """
    candidates = list(candidates or [])
    state = privacy.build_transport_match_state(
        entity=entity,
        candidates=candidates,
        history=history,
        transporter_id=ctx,
    )

    try:
        decision = await gateway.decide(
            state=state,
            question_set_id="transport.match.v1",
            ctx=ctx,
            module="transport_match",
        )
        answers = dict(decision.answers or {})
        ranking = list(answers.get("ranking") or [])
        fit = float(answers.get("fit", 0.7))
        noshow_risk = float(answers.get("noshow_risk", 0.05))
        return {
            "fit": fit,
            "noshow_risk": noshow_risk,
            "ranking": ranking,
            "decision_id": decision.decision_id,
            "source": decision.source,
        }
    except Exception as exc:
        log.warning("Transport match AI failed: %s — falling back to distance sort", exc)
        # Distance sort fallback
        sorted_candidates = sorted(
            candidates,
            key=lambda c: float(c.get("distance_km") or c.get("distanceKm") or c.get("distance") or 0.0),
        )
        ranking = [c.get("id") for c in sorted_candidates if c.get("id")]
        fallback_answers = {
            "fit": 0.5,
            "noshow_risk": 0.05,
            "ranking": ranking,
        }
        decision_id = await decision_log.log_decision(
            module="transport_match",
            question_set_id="transport.match.v1",
            version="v1",
            state=state,
            answers=fallback_answers,
            confidence=0.0,
            latency_ms=0,
            cost_usd=0.0,
            model="none",
            source="fallback",
            fallback_used=True,
        )
        return {
            "fit": 0.5,
            "noshow_risk": 0.05,
            "ranking": ranking,
            "decision_id": decision_id,
            "source": "fallback",
        }


async def rank_return_loads(trip: dict, return_loads: list[dict]) -> list[dict]:
    """Ranks return-load matches using transport.match.v1; fallback is the original distance/date order."""
    if not return_loads:
        return []

    result = await score_transport_match(
        entity=trip,
        candidates=return_loads,
        ctx=trip.get("transporterId"),
    )
    ranking = result.get("ranking") or []
    noshow_risk = result.get("noshow_risk", 0.05)
    fit = result.get("fit", 0.7)

    # Annotate all candidates with noshow_risk and fit
    annotated = []
    for item in return_loads:
        copy_item = dict(item)
        copy_item["noshow_risk"] = noshow_risk
        copy_item["fit"] = fit
        annotated.append(copy_item)

    if not ranking:
        return annotated

    # Reorder according to AI ranking
    rank_map = {item_id: idx for idx, item_id in enumerate(ranking)}
    annotated.sort(key=lambda x: rank_map.get(x.get("id"), 9999))
    return annotated


async def record_transport_outcome(
    booking_id: str,
    outcome: str,
    details: dict | None = None,
) -> None:
    """Outcome hook recording completed / cancelled outcomes back to the AI module (SDR step 6)."""
    record = {
        "id": f"outcome_{booking_id}_{outcome}",
        "bookingId": booking_id,
        "module": "transport_match",
        "questionSetId": "transport.match.v1",
        "outcome": outcome,  # "completed" or "cancelled"
        "details": details or {},
        "recordedAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("ai_outcomes", record["id"], record)
