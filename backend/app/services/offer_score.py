"""ai.A5 trade offer-quality scoring (`trade.offer_score.v1`, phase-08).

Scores and ranks procurement offers (vyapari offers on lots/demands) before the
farmer sees them — every offer gets a 0-1 score, a grade (A-D), an
accept/counter/wait recommendation and a short explanation. The decision is
made ONLY through `app/services/ai/gateway.py` (rule 10); the state is
pseudonymized via `app/services/ai/privacy.py` (rule 11). `suggest` level: the
farmer always decides.

On any AI degradation (budget trip, provider error, module flag off) the
gateway — and, belt-and-braces, this service — falls back to the deterministic
heuristic registered in `question_sets.py`, so the endpoint never returns 500.
"""
import logging

from app.services.ai import gateway, privacy, question_sets

log = logging.getLogger(__name__)

MODULE = "offer_score"
QUESTION_SET_ID = "trade.offer_score.v1"

ANSWER_KEYS = ("score", "grade", "recommended_action", "explanation")


def build_offer_score_state(offer: dict, buyer: dict | None = None) -> dict:
    """A5 state builder: offer economics + buyer reliability signals only,
    pseudonymized, ≤1500 tokens, no PII (rule 11). Money is integer paisa."""
    buyer = buyer or {}
    offer_id = str(offer.get("offerId") or offer.get("id") or "")
    state = {
        "offer_pseudo_id": privacy.hash_user_id(offer_id) if offer_id else "anonymous",
        "crop": str(offer.get("crop") or "")[:60],
        "quantity_quintals": float(offer.get("quantityQuintals") or 0.0),
        "offer_price_paisa": int(offer.get("offerPricePaisa") or 0),
        "mandi_modal_paisa": int(offer.get("mandiModalPaisa") or 0),
        "mandi_trend_7d_pct": float(offer.get("mandiTrend7dPct") or 0.0),
        "payment_terms_days": int(offer.get("paymentTermsDays") or 0),
        "pickup_arranged": bool(offer.get("pickupArranged")),
        "acceptance_rate": float(buyer.get("acceptanceRate") or 0.0),
        "deals_completed": int(buyer.get("dealsCompleted") or 0),
        "buyer_verified": bool(buyer.get("verified")),
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
        log.warning("offer_score decide failed (%s) — heuristic fallback", exc)
        return {
            "answers": question_sets.fallback_answers(QUESTION_SET_ID, state),
            "confidence": 0.0,
            "source": "fallback",
            "decisionId": None,
        }


def _premium_vs_mandi(state: dict) -> float | None:
    """Raw premium vs today's mandi modal (no trend) for the UI badge."""
    offer = float(state.get("offer_price_paisa") or 0)
    modal = float(state.get("mandi_modal_paisa") or 0)
    if modal <= 0:
        return None
    return round((offer - modal) / modal * 100.0, 1)


async def score_offers(offers: list[dict]) -> dict:
    """Score + rank a batch of offers. Ranking is score descending with an
    offerId ascending tie-break, so shim / AI-off runs are byte-identical."""
    items = []
    for offer in offers:
        state = build_offer_score_state(offer, offer.get("buyer") or {})
        meta = await _decide(state)
        answers = meta["answers"]
        items.append(
            {
                "offerId": str(offer.get("offerId") or offer.get("id") or ""),
                "crop": state["crop"],
                "score": float(answers.get("score") or 0.0),
                "grade": str(answers.get("grade") or "D"),
                "recommendedAction": str(answers.get("recommended_action") or "wait"),
                "explanation": str(answers.get("explanation") or ""),
                "premiumVsMandiPct": _premium_vs_mandi(state),
                "confidence": meta["confidence"],
                "source": meta["source"],
                "decisionId": meta["decisionId"],
            }
        )
    items.sort(key=lambda item: (-item["score"], item["offerId"]))
    return {
        "offers": items,
        "ranking": [item["offerId"] for item in items],
        "aiSuggestion": True,
    }
