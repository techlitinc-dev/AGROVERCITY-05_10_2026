"""Seller rate-check AI (S2 area, suggest level).

Scores a posted vyapari rate against the mandi modal via
`seller.rate_check.v1`. The ±25% deterministic band stays in the router; this
service only wraps the gateway call (rule 10) and logs the fallback row when
the provider fails.
"""
from app.services.ai import decision_log, gateway

SELLER_RATE_CHECK_MODULE = "seller_rate_check"
SELLER_RATE_CHECK_QUESTION_SET = "seller.rate_check.v1"


async def check_posted_rate(state: dict, seller_id: str) -> dict | None:
    """Returns the decision answers, or None after logging a fallback row when
    the model call raises (the router then uses the deterministic band only)."""
    try:
        decision = await gateway.decide(
            state,
            SELLER_RATE_CHECK_QUESTION_SET,
            ctx=seller_id,
            module=SELLER_RATE_CHECK_MODULE,
        )
        return decision.answers
    except Exception:
        await decision_log.log_decision(
            module=SELLER_RATE_CHECK_MODULE,
            question_set_id=SELLER_RATE_CHECK_QUESTION_SET,
            version="v1",
            state=state,
            answers={"within_fair_band": True, "manipulation_signal": 0.0},
            confidence=0.0,
            latency_ms=0,
            cost_usd=0.0,
            model="none",
            source="fallback",
            fallback_used=True,
        )
        return None
