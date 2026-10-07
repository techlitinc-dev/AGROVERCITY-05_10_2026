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


# The documents a complete loan file carries. Used by the M14 deterministic
# fallback (required docs minus uploaded docs) — never by the credit decision.
LOAN_REQUIRED_DOC_TYPES = ("aadhaar", "land_record", "bank_passbook", "income_proof")

_DOC_KEYWORDS: dict[str, tuple[str, ...]] = {
    "aadhaar": ("aadhaar", "आधार"),
    "land_record": ("7/12", "7-12", "land record", "land_record", "खसरा", "भूमि"),
    "bank_passbook": ("passbook", "bank", "पासबुक", "बैंक"),
    "income_proof": ("income", "आय"),
}


def _doc_matches(doc: str, uploaded: str) -> bool:
    """Loose match of a required doc type against an uploaded doc token/name."""
    if not uploaded:
        return False
    if doc in uploaded or uploaded in doc:
        return True
    return any(keyword.lower() in uploaded for keyword in _DOC_KEYWORDS.get(doc, (doc,)))


def _loan_prescreen_fallback(state: dict) -> dict:
    """Deterministic rule-based prescreen fallback (M14, SDR step 5).

    riskBand from a rule over credit score + repayment history + land size;
    missingDocs from required documents minus uploaded ones. No AI involved.
    """
    repayment = state.get("repayment") or {}
    overdue = int(repayment.get("overdue") or 0)
    defaults = int(repayment.get("defaults") or 0)
    try:
        score = int(state.get("credit_score") or 0)
    except (TypeError, ValueError):
        score = 0
    try:
        land = float(state.get("land_holding_acres") or 0.0)
    except (TypeError, ValueError):
        land = 0.0

    if defaults > 0 or overdue >= 2 or score < 550:
        band = "high"
    elif overdue >= 1 or score < 650 or land < 1.0:
        band = "medium"
    else:
        band = "low"

    required = list(state.get("required_doc_types") or LOAN_REQUIRED_DOC_TYPES)
    uploaded = [str(token).lower() for token in (state.get("uploaded_doc_types") or [])]
    missing = [doc for doc in required if not any(_doc_matches(doc, token) for token in uploaded)]
    return {"riskBand": band, "missingDocs": missing, "confidence": 0.0}


# Brief M14 — CreditDesk loan prescreen. Annotates the queue (risk band +
# missing docs) and never mutates the application status; stays at `suggest`.
register(
    QuestionSet(
        id="loans.prescreen.v1",
        version="v1",
        schema={"riskBand": "medium", "missingDocs": [], "confidence": 0.0},
        confidence_threshold=0.75,
        automation_level="suggest",
        fallback_fn=_loan_prescreen_fallback,
    )
)


# Photos a strong claim file carries (wide, close-up, GPS-anchored evidence).
REQUIRED_CLAIM_PHOTOS = 4

_TRIAGE_RETAKE_GUIDANCE = {
    "en": "Please retake photos now: one wide shot of the whole field plus close-ups of the "
    "damaged crop, with GPS switched on.",
    "hi": "कृपया अभी दोबारा फोटो लें: GPS चालू रखते हुए पूरे खेत की एक चौड़ी फोटो और "
    "नुकसान वाले पौधों की नज़दीक की फोटो लें।",
}


def _claim_triage_fallback(state: dict) -> dict:
    """Deterministic claim-triage fallback (M15, SDR step 5).

    completeness from the required-photo-count ratio; guidance from the static
    en/hi checklist; fraudSignal defaults to 0.0 (never auto-rejects)."""
    required = int(state.get("required_photo_count") or REQUIRED_CLAIM_PHOTOS) or REQUIRED_CLAIM_PHOTOS
    count = int(state.get("photo_count") or 0)
    completeness = round(min(1.0, count / required), 2)
    try:
        fraud = float(state.get("fraud_signal") or 0.0)
    except (TypeError, ValueError):
        fraud = 0.0
    poor = completeness < 1.0

    reasons: list[str] = []
    if poor:
        reasons.append(f"only {count} of {required} recommended photos attached")
    if state.get("gps_present") is False:
        reasons.append("missing GPS capture coordinates")

    return {
        "photoQuality": "poor" if poor else "ok",
        "completeness": completeness,
        "retakeGuidance": dict(_TRIAGE_RETAKE_GUIDANCE) if poor else {"en": "", "hi": ""},
        "fraudSignal": fraud,
        "triageReasons": reasons,
        "suggestedSurveyor": None,
    }


# Brief M15 — ClaimsDesk triage. Gives same-day retake guidance and provider
# console badges; `fraudSignal > 0.8` flags but NEVER auto-rejects. `suggest`.
register(
    QuestionSet(
        id="insurance.triage.v1",
        version="v1",
        schema={
            "photoQuality": "ok",
            "completeness": 1.0,
            "retakeGuidance": {"en": "", "hi": ""},
            "fraudSignal": 0.0,
            "triageReasons": [],
            "suggestedSurveyor": None,
        },
        confidence_threshold=0.75,
        automation_level="suggest",
        fallback_fn=_claim_triage_fallback,
    )
)


def _as_float(value, default: float = 0.0) -> float:
    """Best-effort float coercion shared by the deterministic fallbacks."""
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _series_mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _series_stddev(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    mean = _series_mean(values)
    variance = sum((value - mean) ** 2 for value in values) / len(values)
    return variance ** 0.5


# A member's own FAT/SNF history needs at least this many prior readings before
# an anomaly can be called; fewer -> anomaly false, confidence 0.
MIN_ADULTERATION_BASELINE_READINGS = 3
ADULTERATION_WINDOW_DAYS = 30


def _adulteration_fallback(state: dict) -> dict:
    """Deterministic dairy-adulteration fallback (M17, SDR step 5).

    anomaly = |today − 30-day mean| > 2 × stddev over the member's OWN history;
    insufficient history -> anomaly false, confidence 0. No AI involved, and the
    flag never blocks a collection (that guarantee lives in the router)."""
    history = state.get("history") or {}
    fat_series = [_as_float(value) for value in (history.get("fat") or [])]
    snf_series = [_as_float(value) for value in (history.get("snf") or [])]
    today = state.get("today") or {}
    today_fat = _as_float(today.get("fat"))
    today_snf = _as_float(today.get("snf"))
    window_days = int(state.get("window_days") or ADULTERATION_WINDOW_DAYS)

    count = min(len(fat_series), len(snf_series))
    fat_avg = round(_series_mean(fat_series), 2)
    snf_avg = round(_series_mean(snf_series), 2)
    baseline = {"fatAvg": fat_avg, "snfAvg": snf_avg, "windowDays": window_days}

    if count < MIN_ADULTERATION_BASELINE_READINGS:
        return {"anomaly": False, "confidence": 0.0, "baseline": baseline}

    fat_mean = _series_mean(fat_series)
    snf_mean = _series_mean(snf_series)
    fat_sd = _series_stddev(fat_series)
    snf_sd = _series_stddev(snf_series)

    def _z(today_value: float, mean: float, sd: float) -> float:
        delta = abs(today_value - mean)
        if sd > 0:
            return delta / sd
        # A perfectly flat baseline: any deviation is a strong signal.
        return 0.0 if delta == 0 else MIN_ADULTERATION_BASELINE_READINGS + 1.0

    z = max(_z(today_fat, fat_mean, fat_sd), _z(today_snf, snf_mean, snf_sd))
    anomaly = z > 2.0
    confidence = round(min(0.95, z / 4.0), 2) if anomaly else round(min(0.4, z / 4.0), 2)
    return {"anomaly": anomaly, "confidence": confidence, "baseline": baseline}


# Brief M17 — DairyOS milk adulteration. Flags anomalous FAT/SNF readings versus a
# member's own 30-day baseline. Annotates only; collections ALWAYS save. `suggest`.
register(
    QuestionSet(
        id="dairy.adulteration.v1",
        version="v1",
        schema={
            "anomaly": False,
            "confidence": 0.0,
            "baseline": {"fatAvg": 0.0, "snfAvg": 0.0, "windowDays": ADULTERATION_WINDOW_DAYS},
        },
        confidence_threshold=0.75,
        automation_level="suggest",
        fallback_fn=_adulteration_fallback,
    )
)


def _contract_attractiveness_fallback(state: dict) -> dict:
    """Deterministic contract-attractiveness fallback (M18, SDR step 5).

    incomeVsMandi = % difference between the effective contract price (formula
    pricing: fixed base rate, or mandi-linked modal + premium) and the 12-week
    mandi average the backend already holds; explanation from a static template
    that is honest when the contract is WORSE than the mandi. No AI involved."""
    benchmark = state.get("mandi_benchmark") or {}
    mandi_avg = _as_float(benchmark.get("avg") or benchmark.get("modal"))
    price_type = str(state.get("price_type") or "fixed")
    base_rate = _as_float(state.get("base_rate"))
    premium = _as_float(state.get("premium_per_quintal"))
    if price_type == "mandiLinked" and mandi_avg > 0:
        contract_price = round(mandi_avg + premium, 2)
    else:
        contract_price = base_rate

    risk_flags: list[str] = []
    if mandi_avg <= 0:
        income = 0.0
        risk_flags.append("no mandi benchmark available for this crop")
    elif contract_price <= 0:
        income = 0.0
        risk_flags.append("contract price terms are incomplete")
    else:
        income = round((contract_price - mandi_avg) / mandi_avg * 100, 2)
        if income < 0:
            risk_flags.append(f"priced {abs(income):.0f}% below the 12-week mandi average")
        elif income < 3:
            risk_flags.append("thin premium over the mandi benchmark")
        if price_type == "fixed" and income >= 0:
            risk_flags.append("fixed price — you do not gain if the mandi price rises")

    if mandi_avg > 0 and contract_price > 0:
        if income >= 0:
            explanation = (
                f"At ₹{contract_price:,.0f}/quintal this contract is about {income:.0f}% above the "
                f"12-week mandi average of ₹{mandi_avg:,.0f}/quintal. The locked rate reduces price risk, "
                "but you give up the upside if mandi rates climb."
            )
        else:
            explanation = (
                f"At ₹{contract_price:,.0f}/quintal this contract is about {abs(income):.0f}% below the "
                f"12-week mandi average of ₹{mandi_avg:,.0f}/quintal. Selling at the mandi could fetch more, "
                "so weigh the buyer's guaranteed pickup and payment terms against the lower price."
            )
    else:
        explanation = (
            "There is not enough mandi price history for this crop to compare the contract fairly. "
            "Check the local mandi modal rate for the past 12 weeks before you sign."
        )

    return {"incomeVsMandi": income, "riskFlags": risk_flags, "explanation": explanation}


# Brief M18 — ProcurePro contract attractiveness. Scores the contract's expected
# income vs the 12-week mandi trend + agronomy risk flags; `suggest` (annotates
# the farmer grow-for-us card, never touches the e-sign flow).
register(
    QuestionSet(
        id="contracts.attractiveness.v1",
        version="v1",
        schema={"incomeVsMandi": 0.0, "riskFlags": [], "explanation": ""},
        confidence_threshold=0.75,
        automation_level="suggest",
        fallback_fn=_contract_attractiveness_fallback,
    )
)


def _course_crop_match(category, crops: set[str]) -> bool:
    """True when a course category matches one of the farmer's crops."""
    category = str(category or "").strip().lower()
    if not category:
        return False
    return any(crop and (crop == category or crop in category or category in crop) for crop in crops)


def _course_popularity(course: dict) -> int:
    try:
        return int(course.get("salesCount") or 0)
    except (TypeError, ValueError):
        return 0


def _courses_recommend_fallback(state: dict) -> dict:
    """Deterministic course ordering (M20 SDR step 5, `fallback_fn`).

    Newest published course in the farmer's crop categories first (then by
    popularity), followed by the remaining courses ordered by popularity
    (`salesCount`), ties broken by newest then id. No AI involved — the catalog
    renders identically whether or not a model answered.
    """
    courses = [c for c in (state.get("courses") or []) if isinstance(c, dict) and c.get("id")]
    crops = {str(c).strip().lower() for c in (state.get("crops") or []) if str(c).strip()}

    def _relevance(course: dict) -> float:
        return 0.9 if _course_crop_match(course.get("category"), crops) else 0.3

    def _badges(course: dict) -> list[str]:
        return ["matches_your_crops"] if _course_crop_match(course.get("category"), crops) else []

    matched = [c for c in courses if _course_crop_match(c.get("category"), crops)]
    others = [c for c in courses if not _course_crop_match(c.get("category"), crops)]
    matched.sort(
        key=lambda c: (str(c.get("createdAt") or ""), _course_popularity(c), str(c.get("id"))),
        reverse=True,
    )
    others.sort(
        key=lambda c: (_course_popularity(c), str(c.get("createdAt") or ""), str(c.get("id"))),
        reverse=True,
    )

    recommendations = [
        {"courseId": course["id"], "relevance": _relevance(course), "badges": _badges(course)}
        for course in (*matched, *others)
    ]
    return {"recommendations": recommendations, "confidence": 0.0}


# Brief M20 — Krishi Academy course recommendations (ai_implementation_plan §2
# `courses.recommend.v1`, §5 M20). Per-course `relevance` batch-scored from the
# farmer's crops/season/completed courses; `suggest` (annotates the catalog, the
# learner still chooses), with the deterministic crop-category ordering above.
register(
    QuestionSet(
        id="courses.recommend.v1",
        version="v1",
        schema={"recommendations": [], "confidence": 0.0},
        confidence_threshold=0.75,
        automation_level="suggest",
        fallback_fn=_courses_recommend_fallback,
    )
)


# Brief M12 (SDR) — smart mandi selection. Batch-scores every candidate mandi
# (`net_score`, integer paisa) and picks a vernacular `explain_key` choice. The
# deterministic fallback is plain net-after-transport arithmetic:
#     net = modal_price_paisa × qty − transport_fare_paisa − commission_paisa
# ranked descending with a name-ascending tie-break, so shim / AI-off runs match
# the hand-computed golden cases in tests/fixtures/ai/golden exactly. `suggest`.
MANDI_SMART_EXPLAIN_KEYS = ("net_after_transport", "distance", "price_only", "insufficient_data")


def _as_int(value: Any, default: int = 0) -> int:
    """Best-effort int coercion — money is integer paisa, never a float."""
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _mandi_smart_select_fallback(state: dict) -> dict:
    """Deterministic net-after-transport ranking (M12, SDR step 5)."""
    qty = _as_int(state.get("qty_quintals"))
    candidates = [
        candidate
        for candidate in (state.get("candidates") or [])
        if isinstance(candidate, dict) and candidate.get("mandi")
    ]
    net_score: dict[str, int] = {}
    ordered: list[tuple[int, str]] = []
    for candidate in candidates:
        name = str(candidate["mandi"])
        net = (
            _as_int(candidate.get("modal_price_paisa")) * qty
            - _as_int(candidate.get("transport_fare_paisa"))
            - _as_int(candidate.get("commission_paisa"))
        )
        net_score[name] = net
        ordered.append((net, name))
    ordered.sort(key=lambda item: (-item[0], item[1].lower()))
    return {
        "ranking": [name for _, name in ordered],
        "net_score": net_score,
        "explain_key": "net_after_transport" if candidates else "insufficient_data",
        "confidence": 0.0,
    }


register(
    QuestionSet(
        id="mandi.smart_select.v1",
        version="v1",
        schema={
            "ranking": [],
            "net_score": {},
            "explain_key": "net_after_transport",
            "confidence": 0.0,
        },
        confidence_threshold=0.75,
        automation_level="suggest",
        fallback_fn=_mandi_smart_select_fallback,
    )
)


# Brief M13 (SDR) — advisory market saturation. The risk class is decided by the
# RULES over district-crop sowing-intent aggregates (never by the model); the
# model only ranks the alternative crops (`alt_crops`) and picks a vernacular
# explanation key. Deterministic fallback = the rules class + expected-price
# ordering, so shim / AI-off runs are identical to the rule engine's truth.
ADVISORY_SATURATION_RISK = ("low", "medium", "high")


def _advisory_saturation_fallback(state: dict) -> dict:
    """Deterministic district-crop saturation class (M13, SDR step 5)."""
    count = _as_int(state.get("sowing_count"))
    if count < 20:
        risk = "low"
    elif count < 60:
        risk = "medium"
    else:
        risk = "high"
    alternatives = [
        alt
        for alt in (state.get("alternatives") or [])
        if isinstance(alt, dict) and alt.get("crop")
    ]
    alternatives.sort(
        key=lambda alt: (-_as_int(alt.get("expected_price_paisa")), str(alt["crop"]).lower())
    )
    return {
        "risk": risk,
        "alt_crops": [str(alt["crop"]) for alt in alternatives],
        "confidence": 0.0,
    }


register(
    QuestionSet(
        id="advisory.saturation.v1",
        version="v1",
        schema={"risk": "low", "alt_crops": [], "confidence": 0.0},
        confidence_threshold=0.75,
        automation_level="suggest",
        fallback_fn=_advisory_saturation_fallback,
    )
)


# Brief M9 (SDR) — disease-scan image gate. Runs FIRST on every scan: a non-leaf
# or poor-quality photo is answered with retake guidance instead of a diagnosis.
# Deterministic fallback passes the gate (the stub diagnosis still stands) only
# when the state explicitly says the gate could not be judged.
def _disease_gate_fallback(state: dict) -> dict:
    return {
        "is_plant_leaf": bool(state.get("is_plant_leaf", True)),
        "quality_ok": bool(state.get("quality_ok", True)),
    }


register(
    QuestionSet(
        id="disease.gate.v1",
        version="v1",
        schema={"is_plant_leaf": True, "quality_ok": True},
        confidence_threshold=0.6,
        automation_level="suggest",
        fallback_fn=_disease_gate_fallback,
    )
)


# Brief M21 (SDR) — government-scheme matching. The RULES engine
# (`services/eligibility.py`) decides `eligible` + the `missing` documents; the
# model only supplies a `fit` score so the discovery list can rank
# matched-to-profile first and explain the verdict in the farmer's language.
# Deterministic fallback = the rules verdict with a missing-doc penalty, so
# shim / AI-off runs answer identically to the rules engine's truth set.
def _schemes_match_fallback(state: dict) -> dict:
    """Deterministic scheme-fit (M21, SDR step 5) — never overrides the rules."""
    eligible = bool(state.get("eligible", False))
    missing = [str(doc) for doc in (state.get("missing") or [])]
    if not eligible:
        fit = 0.0
    else:
        fit = round(max(0.4, 1.0 - 0.15 * len(missing)), 2)
    return {"eligible": eligible, "missing": missing, "fit": fit}


register(
    QuestionSet(
        id="schemes.match.v1",
        version="v1",
        schema={"eligible": False, "missing": [], "fit": 0.0},
        confidence_threshold=0.75,
        automation_level="suggest",
        fallback_fn=_schemes_match_fallback,
    )
)


# Brief M10 (SDR + vision) — produce-grading human-review gate. Runs after the
# grading assessment: a low-confidence grade (or an explicit gate verdict) is
# routed to the human-grader ops queue instead of being published as an AI
# grade. `confidence_class` is a vernacular choice, never a raw number.
GRADING_CONFIDENCE_CLASSES = ("high", "medium", "low")


def _grading_gate_fallback(state: dict) -> dict:
    """Deterministic human-review gate (M10, SDR step 5)."""
    try:
        confidence = float(state.get("confidence"))
    except (TypeError, ValueError):
        confidence = 0.0
    if confidence >= 0.85:
        confidence_class = "high"
    elif confidence >= 0.7:
        confidence_class = "medium"
    else:
        confidence_class = "low"
    return {
        "needs_human": confidence < 0.7,
        "confidence_class": confidence_class,
    }


register(
    QuestionSet(
        id="grading.gate.v1",
        version="v1",
        schema={"needs_human": False, "confidence_class": "high"},
        confidence_threshold=0.7,
        automation_level="suggest",
        fallback_fn=_grading_gate_fallback,
    )
)






