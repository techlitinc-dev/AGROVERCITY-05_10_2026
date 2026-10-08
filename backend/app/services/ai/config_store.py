"""Reader for the `platform_config/ai` Firestore doc (ai_implementation_plan §1.2).

Shape: {modules: {<flag>: bool}, thresholds: {"<id>.v1": 0.75},
        automation: {"<id>.v1": "suggest"}}

Edits are maker-checker + audited in the admin console (phase-07); this module
provides the cached reader and the dev seed only. 60 s cache TTL.
"""
import time

from app.core.db import get_doc, set_doc

DEFAULT_AI_CONFIG = {
    "modules": {
        "seller_rate_check": True,
        "transport_match": True,
        "broker_lead_score": True,
        "equipment_booking_rec": True,
        "land_listing_quality": True,
        "loans_prescreen": True,
        "insurance_triage": True,
        "dairy_adulteration": True,
        "contracts_attractiveness": True,
        # Brief M20 — course recommendations (suggest-level catalog annotation).
        "courses_recommend": True,
        # Brief M20 — objective auto-grading of assignment submissions. Prefill
        # only: the instructor must confirm before a grade is published.
        "courses_autograde": True,
        # Brief M21 (WS-05) — government-scheme matching. The rules engine
        # decides eligibility; the model only ranks + explains. `suggest`.
        "schemes_match": True,
        # Phase-08 WS-01 — M26 women SHG-readiness AI (real SHG data, suggest).
        "women_shg_readiness": True,
        # Phase-08 WS-01 — M28 receipt/weigh-slip scan (vision, confirm-only).
        "receipt_scan": True,
        # Phase-08 WS-01 — M28 churn re-engagement (nightly, suggest).
        "churn_signal": True,
        # Phase-08 WS-01 — M29 farmer standing agent (confirm-only, suggest).
        "agent_rules": True,
        # Phase-08 WS-01 — M33 onboarding copilot (language/crop suggestions).
        "onboarding_copilot": True,
    },
    "thresholds": {
        "seller.rate_check.v1": 0.75,
        "transport.match.v1": 0.75,
        "broker.lead_score.v1": 0.75,
        "equipment.booking_rec.v1": 0.75,
        "land.listing_quality.v1": 0.75,
        "loans.prescreen.v1": 0.75,
        "insurance.triage.v1": 0.75,
        "dairy.adulteration.v1": 0.75,
        "contracts.attractiveness.v1": 0.75,
        "courses.recommend.v1": 0.75,
        "courses.grade_suggest.v1": 0.75,
        "schemes.match.v1": 0.75,
        "women.shg_readiness.v1": 0.75,
        "churn.signal.v1": 0.75,
        "agent.rule_match.v1": 0.75,
    },
    "automation": {
        "seller.rate_check.v1": "suggest",
        "transport.match.v1": "suggest",
        "broker.lead_score.v1": "suggest",
        "equipment.booking_rec.v1": "suggest",
        "land.listing_quality.v1": "suggest",
        "loans.prescreen.v1": "suggest",
        "insurance.triage.v1": "suggest",
        "dairy.adulteration.v1": "suggest",
        "contracts.attractiveness.v1": "suggest",
        "courses.recommend.v1": "suggest",
        # Auto-grading never publishes on its own — instructor confirm required.
        "courses.grade_suggest.v1": "require_confirm",
        # M21 matching annotates the discovery list only — never auto-applies.
        "schemes.match.v1": "suggest",
        "women.shg_readiness.v1": "suggest",
        "churn.signal.v1": "suggest",
        "agent.rule_match.v1": "suggest",
    },
}
CACHE_TTL_SECONDS = 60.0

_cache: dict = {"doc": None, "at": 0.0}


def clear_cache() -> None:
    _cache["doc"] = None
    _cache["at"] = 0.0


async def get_ai_config(force: bool = False) -> dict:
    now = time.monotonic()
    if not force and _cache["doc"] is not None and now - _cache["at"] < CACHE_TTL_SECONDS:
        return _cache["doc"]
    doc = await get_doc("platform_config", "ai") or {}
    merged = {
        "modules": doc.get("modules") or {},
        "thresholds": doc.get("thresholds") or {},
        "automation": doc.get("automation") or {},
    }
    _cache["doc"] = merged
    _cache["at"] = now
    return merged


async def module_enabled(module: str) -> bool:
    config = await get_ai_config()
    return bool(config["modules"].get(module, True))


async def threshold_for(question_set_id: str, default: float = 0.75) -> float:
    config = await get_ai_config()
    value = config["thresholds"].get(question_set_id)
    return float(value) if value is not None else default


async def automation_for(question_set_id: str, default: str = "suggest") -> str:
    config = await get_ai_config()
    return config["automation"].get(question_set_id) or default


async def seed_ai_config() -> None:
    existing = await get_doc("platform_config", "ai")
    if existing is None:
        await set_doc("platform_config", "ai", dict(DEFAULT_AI_CONFIG))
