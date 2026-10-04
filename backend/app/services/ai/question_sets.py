"""Question-set registry (ai_implementation_plan §1.1).

Scaffolding only: individual question sets land with their briefs in later
phases. A set declares its schema (field -> default), confidence threshold,
automation level, and an optional deterministic fallback builder.
"""
from dataclasses import dataclass, field
from typing import Any, Callable

AUTOMATION_LEVELS = ("suggest", "require_confirm", "auto")


def _due_date_order(state: dict) -> list[str]:
    """Canonical ordering: urgent first, then dueAt ascending, then id."""
    tasks = state.get("tasks") or []
    ordered = sorted(
        tasks,
        key=lambda task: (
            0 if task.get("priority") == "urgent" else 1,
            task.get("dueAt") or "9999-12-31",
            task.get("id") or "",
        ),
    )
    return [task.get("id") for task in ordered if task.get("id")]


def _rank_fallback(state: dict) -> dict:
    """Deterministic due-date sort (SDR step 5 fallback for tasks.rank.v1)."""
    ranking = _due_date_order(state)
    return {
        "ranking": ranking,
        "headline_task": ranking[0] if ranking else None,
        "confidence": 0.0,
        "impacts": {},
    }


@dataclass
class QuestionSet:
    id: str
    version: str
    schema: dict[str, Any] = field(default_factory=dict)
    state_builder: Callable | None = None
    confidence_threshold: float = 0.75
    automation_level: str = "suggest"
    fallback_fn: Callable | None = None


REGISTRY: dict[str, QuestionSet] = {}


def register(question_set: QuestionSet) -> QuestionSet:
    REGISTRY[question_set.id] = question_set
    return question_set


def get(question_set_id: str) -> QuestionSet | None:
    return REGISTRY.get(question_set_id)


def schema_defaults(question_set_id: str) -> dict[str, Any]:
    question_set = get(question_set_id)
    if question_set is None:
        return {}
    return dict(question_set.schema)


def fallback_answers(question_set_id: str, state: dict | None = None) -> dict[str, Any]:
    question_set = get(question_set_id)
    if question_set is not None and question_set.fallback_fn is not None:
        return question_set.fallback_fn(state or {})
    return schema_defaults(question_set_id)


register(
    QuestionSet(
        id="sample.agronomy.v1",
        version="v1",
        schema={"crop": "unknown", "sowingWindow": "not-available"},
        confidence_threshold=0.75,
        automation_level="suggest",
    )
)

# Brief M5 — task ranking: orders /v1/tasks/* and picks the hero next-best
# action. Ranking annotates; the user still taps (automation stays `suggest`).
register(
    QuestionSet(
        id="tasks.rank.v1",
        version="v1",
        schema={"ranking": [], "headline_task": None, "confidence": 0.0, "impacts": {}},
        confidence_threshold=0.75,
        automation_level="suggest",
        fallback_fn=_rank_fallback,
    )
)

# Brief M2 — Kisan Mitra intent routing: routes human_needed / low-answerable
# messages to the existing expert-ticket path; money intent stays neutral.
register(
    QuestionSet(
        id="chatbot.intent.v1",
        version="v1",
        schema={"intent": "human_needed", "answerable": 0.0},
        confidence_threshold=0.6,
        automation_level="suggest",
    )
)

# Brief M2 — safety post-check on bot replies (contact info / financial
# advice / medical certainty). Any flag strips + regenerates once.
register(
    QuestionSet(
        id="chatbot.safety.v1",
        version="v1",
        schema={
            "has_contact_info": False,
            "has_financial_advice": False,
            "has_medical_certainty": False,
        },
        confidence_threshold=0.75,
        automation_level="suggest",
    )
)


def _seller_rate_check_fallback(state: dict) -> dict:
    """Deterministic ±25% Agmarknet modal band fallback (M4)."""
    rate = float(state.get("posted_rate") or state.get("postedRate") or 0.0)
    modal = float(state.get("mandi_modal") or state.get("mandiModal") or 0.0)
    if rate > 0 and modal > 0:
        rate_q = rate * 100 if rate < modal / 2 else rate
        within_fair_band = (modal * 0.75 <= rate_q <= modal * 1.25)
    else:
        within_fair_band = True
    return {
        "within_fair_band": within_fair_band,
        "manipulation_signal": 0.0,
    }


# Brief M4 — seller rate-band guard + demand forecast (flow 5.6)
register(
    QuestionSet(
        id="seller.rate_check.v1",
        version="v1",
        schema={"within_fair_band": True, "manipulation_signal": 0.0},
        confidence_threshold=0.75,
        automation_level="suggest",
        fallback_fn=_seller_rate_check_fallback,
    )
)


def _transport_match_fallback(state: dict) -> dict:
    """Deterministic distance-sort fallback for transport.match.v1 (M16)."""
    candidates = state.get("candidates") or state.get("loads") or state.get("vehicles") or []
    sorted_candidates = sorted(
        candidates,
        key=lambda c: float(c.get("distance_km") or c.get("distanceKm") or c.get("distance") or 0.0),
    )
    ranking = [c.get("id") for c in sorted_candidates if isinstance(c, dict) and c.get("id")]
    return {
        "fit": 0.5,
        "noshow_risk": 0.05,
        "matches": sorted_candidates,
        "ranking": ranking,
    }


# Brief M16 — transport matching & return loads (flow 5.5)
register(
    QuestionSet(
        id="transport.match.v1",
        version="v1",
        schema={"fit": 0.0, "noshow_risk": 0.0, "matches": []},
        confidence_threshold=0.75,
        automation_level="suggest",
        fallback_fn=_transport_match_fallback,
    )
)


def _broker_lead_score_fallback(state: dict) -> dict:
    """Deterministic fallback for broker.lead_score.v1 (M19)."""
    price_gap = float(state.get("price_gap_pct") or state.get("priceGapPct") or 0.0)
    round_no = int(state.get("counter_round") or state.get("counterRound") or 0)
    deadlock = 0.6 if (price_gap > 15.0 or round_no >= 2) else 0.15
    quality = 0.7 if state.get("demand_fit") else 0.5
    return {
        "quality": quality,
        "deadlock_risk": deadlock,
    }


# Brief M19 — broker lead scoring & deadlock prediction
register(
    QuestionSet(
        id="broker.lead_score.v1",
        version="v1",
        schema={"quality": 0.5, "deadlock_risk": 0.0},
        confidence_threshold=0.75,
        automation_level="suggest",
        fallback_fn=_broker_lead_score_fallback,
    )
)


def _equipment_booking_rec_fallback(state: dict) -> dict:
    """Deterministic fallback for equipment.booking_rec.v1 (M24)."""
    dist = float(state.get("distance_km") or 0.0)
    has_conflict = bool(state.get("slot_conflict"))
    score = 0.4 if (has_conflict or dist > 40.0) else 0.85
    return {
        "score": score,
        "recommend_approve": score >= 0.6,
        "conflict_risk": 0.8 if has_conflict else 0.05,
    }


# Brief M24 — equipment booking recommendations
register(
    QuestionSet(
        id="equipment.booking_rec.v1",
        version="v1",
        schema={"score": 0.8, "recommend_approve": True, "conflict_risk": 0.05},
        confidence_threshold=0.75,
        automation_level="suggest",
        fallback_fn=_equipment_booking_rec_fallback,
    )
)


def _land_listing_quality_fallback(state: dict) -> dict:
    """Deterministic fallback for land.listing_quality.v1 (M25)."""
    has_photos = bool(state.get("photo_count") or state.get("photos") or state.get("photoUrls"))
    has_water = bool(state.get("water_source") or state.get("has_water") or state.get("waterSource"))
    has_soil = bool(state.get("soil_type") or state.get("soilType"))

    score = 0.45
    tips = []
    if not has_photos:
        tips.append({
            "id": "photo",
            "tip_en": "Add plot photos to help farmers evaluate your land",
            "tip_hi": "किसानों को अपनी ज़मीन दिखाने के लिए तस्वीरें जोड़ें",
        })
    else:
        score += 0.25

    if not has_water:
        tips.append({
            "id": "water",
            "tip_en": "Specify water source availability (borewell / canal)",
            "tip_hi": "पानी का स्रोत (बोरवेल / नहर) विवरण जोड़ें",
        })
    else:
        score += 0.15

    if not has_soil:
        tips.append({
            "id": "soil",
            "tip_en": "Mention soil type (e.g. black cotton, loam)",
            "tip_hi": "मिट्टी का प्रकार (काली, दोमट आदि) दर्ज करें",
        })
    else:
        score += 0.15

    rent = float(state.get("rent_per_acre_year") or state.get("rentRupees") or 0.0)
    band_min = float(state.get("band_min") or 10000)
    band_max = float(state.get("band_max") or 50000)
    rent_band_ok = (band_min <= rent <= band_max) if rent > 0 else True
    band_source = state.get("band_source") or ("village_lease_data" if state.get("village_data_available") else "district_benchmark_default")

    return {
        "completeness": round(min(1.0, score), 2),
        "rent_band_ok": rent_band_ok,
        "tips": tips,
        "band_source": band_source,
    }


# Brief M25 — land listing quality
register(
    QuestionSet(
        id="land.listing_quality.v1",
        version="v1",
        schema={
            "completeness": 0.85,
            "rent_band_ok": True,
            "tips": [],
            "band_source": "district_benchmark_default",
        },
        confidence_threshold=0.75,
        automation_level="suggest",
        fallback_fn=_land_listing_quality_fallback,
    )
)





