"""M26 SHG readiness (phase-08 WS-01, robust.md §7.12).

Computes an SHG's loan-readiness from real ledger signals via the Jev gateway
(`women.shg_readiness.v1`, `suggest`), names the biggest gap, and — once the
readiness crosses the configured threshold — surfaces a suggest-only link card
to the loan marketplace. Never auto-applies (hard rule 12).

The result is cached in the `shg_readiness` collection (plus a Redis key) so a
dashboard page view never triggers a model call (rule 10 + ai caching standard).
"""
from app.core.cache import cache_get, cache_set
from app.core.db import get_doc, set_doc
from app.services.ai import gateway, privacy

MODULE = "women_shg_readiness"
QUESTION_SET_ID = "women.shg_readiness.v1"
COLLECTION = "shg_readiness"
CACHE_TTL_SECONDS = 6 * 3600
# Readiness at/above which the loan-marketplace link card is surfaced.
LOAN_READINESS_THRESHOLD = 0.7

GAP_LABELS = {
    "savings_regularity": "regular monthly savings",
    "meeting_attendance": "meeting attendance",
    "enterprise_income": "home-enterprise income records",
    "record_keeping": "record keeping",
}

NEXT_STEP = {
    "savings_regularity": {
        "en": "Deposit the monthly amount on time for the next 3 months to build a savings streak.",
        "hi": "अगले 3 महीने समय पर मासिक जमा करें ताकि बचत की निरंतरता बने।",
    },
    "meeting_attendance": {
        "en": "Attend the next SHG meetings and mark attendance to improve the group's record.",
        "hi": "अगली SHG बैठकों में उपस्थित रहें और उपस्थिति दर्ज करें।",
    },
    "enterprise_income": {
        "en": "Record a few home-enterprise income entries this quarter to show business activity.",
        "hi": "इस तिमाही कुछ गृह-उद्यम आय प्रविष्टियाँ दर्ज करें।",
    },
    "record_keeping": {
        "en": "Start recording deposits and meeting minutes in the app to keep clean books.",
        "hi": "साफ़ बही-खाते के लिए ऐप में जमा और बैठक विवरण दर्ज करना शुरू करें।",
    },
}

LOAN_LINK_COPY = {
    "en": "Your group is loan-ready. Explore group loans in the loan marketplace.",
    "hi": "आपका समूह ऋण के योग्य है। ऋण बाज़ार में समूह ऋण देखें।",
}


async def _cached(shg_id: str) -> dict | None:
    cached = await cache_get(f"shg:readiness:{shg_id}")
    if cached:
        import json

        try:
            return json.loads(cached)
        except ValueError:
            return None
    return await get_doc(COLLECTION, str(shg_id))


def _shape(shg_id: str, state: dict, decision) -> dict:
    answers = decision.answers or {}
    factors = answers.get("factors") or {
        "savings_regularity": state.get("savings_regularity", 0.0),
        "meeting_attendance": state.get("meeting_attendance_rate", 0.0),
        "enterprise_income": state.get("enterprise_income_trend", 0.0),
        "record_keeping": 1.0 if state.get("record_keeping") else 0.3,
    }
    gap = answers.get("gap") or min(factors, key=lambda key: (factors[key], key))
    readiness = float(answers.get("readiness") or 0.0)
    loan_link = None
    if readiness >= LOAN_READINESS_THRESHOLD:
        loan_link = {
            "enabled": True,
            "deepLink": "/dashboard/p/loanMarketplace",
            "copy": dict(LOAN_LINK_COPY),
        }
    return {
        "available": True,
        "shgId": shg_id,
        "readiness": readiness,
        "gap": gap,
        "factors": factors,
        "suggestedNextStep": dict(NEXT_STEP.get(gap, NEXT_STEP["record_keeping"])),
        "loanMarketplaceLink": loan_link,
        "decisionId": decision.decision_id,
        "confidence": decision.confidence,
        "source": decision.source,
    }


async def get_shg_readiness(shg_id: str, *, force: bool = False) -> dict:
    """Return the cached readiness card payload, computing it once if needed."""
    if not force:
        cached = await _cached(shg_id)
        if cached is not None:
            return cached
    state = await privacy.build_shg_readiness_state(shg_id)
    decision = await gateway.decide(state, QUESTION_SET_ID, module=MODULE)
    payload = _shape(shg_id, state, decision)
    await set_doc(COLLECTION, str(shg_id), payload)
    await cache_set(f"shg:readiness:{shg_id}", __import__("json").dumps(payload), CACHE_TTL_SECONDS)
    return payload
