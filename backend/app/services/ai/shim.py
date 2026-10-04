"""Deterministic shim provider (AI_PROVIDER=shim) — CI/dev never calls paid APIs.

Answers come from `backend/tests/fixtures/ai/golden/*.jsonl`, keyed by
question-set id; unknown sets return schema-valid defaults.
"""
import hashlib
import json
import logging
import os
import re

from app.services.ai import question_sets, privacy
from app.services.ai.question_sets import _due_date_order

log = logging.getLogger(__name__)

_INTENT_KEYWORDS = {
    "human_needed": ("expert", "doctor", "डॉक्टर", "विशेषज्ञ", "human", "insaan"),
    "money": (
        "loan", "kcc", "credit", "emi", "insurance", "interest", "कर्ज", "ऋण", "लोन", "बीमा", "ब्याज",
    ),
    "market": ("mandi", "bhav", "price", "rate", "sell", "bech", "मंडी", "भाव", "बेच", "दाम"),
    "agronomy": (
        "crop", "fasal", "keeda", "pest", "disease", "rog", "bimari", "sow", "boyi", "khad",
        "urea", "spray", "फसल", "कीड़ा", "रोग", "खाद", "बुवाई", "छिड़काव", "मौसम",
    ),
    "app_help": ("app", "login", "mpin", "password", "kaise", "कैसे", "लॉगिन"),
}

_CONTACT_RE = re.compile(r"(?:(?:\+?91[\s-]?)?[6-9]\d{9})|(?:[\w.+-]+@[\w-]+\.[\w.-]+)|(?:https?://|www\.)")
_FINANCIAL_ADVICE_RE = re.compile(r"\b(loan|interest|emi|कर्ज|ब्याज|लोन)\b", re.IGNORECASE)
_MEDICAL_CERTAINTY_RE = re.compile(r"\b(cancer cure|guaranteed cure|100% इलाज|पक्का इलाज)\b", re.IGNORECASE)


def _intent_answers(state: dict) -> tuple[dict, float]:
    """Deterministic intent classifier for the shim (keyword routing)."""
    text = (state.get("message") or "").lower()
    for intent, keywords in _INTENT_KEYWORDS.items():
        if any(keyword in text for keyword in keywords):
            answerable = 0.75 if intent != "human_needed" else 0.2
            return {"intent": intent, "answerable": answerable}, 0.8
    if len(text.strip()) >= 12:
        return {"intent": "agronomy", "answerable": 0.65}, 0.7
    return {"intent": "human_needed", "answerable": 0.3}, 0.6


def _safety_answers(state: dict) -> tuple[dict, float]:
    """Deterministic safety classifier for the shim (regex guardrails)."""
    text = state.get("reply") or ""
    return (
        {
            "has_contact_info": bool(_CONTACT_RE.search(text)),
            "has_financial_advice": bool(_FINANCIAL_ADVICE_RE.search(text)),
            "has_medical_certainty": bool(_MEDICAL_CERTAINTY_RE.search(text)),
        },
        0.9,
    )

GOLDEN_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "tests", "fixtures", "ai", "golden")
)
EMBED_DIMENSIONS = 8

_fixture_cache: dict | None = None


def _load_fixtures() -> dict:
    global _fixture_cache
    if _fixture_cache is not None:
        return _fixture_cache
    fixtures: dict = {}
    try:
        for name in sorted(os.listdir(GOLDEN_DIR)):
            if not name.endswith(".jsonl"):
                continue
            with open(os.path.join(GOLDEN_DIR, name), encoding="utf-8") as handle:
                for line in handle:
                    line = line.strip()
                    if not line:
                        continue
                    record = json.loads(line)
                    key = record.get("questionSetId")
                    if key:
                        fixtures[key] = record
    except FileNotFoundError:
        log.warning("AI golden fixtures directory missing: %s", GOLDEN_DIR)
    _fixture_cache = fixtures
    return fixtures


def _rank_answers(state: dict) -> tuple[dict, float]:
    """Deterministic tasks.rank.v1 shim: due-date order + monotone impacts."""
    ranking = _due_date_order(state)
    total = len(ranking) or 1
    impacts = {
        task_id: round((total - index) / total, 3) for index, task_id in enumerate(ranking)
    }
    return (
        {
            "ranking": ranking,
            "headline_task": ranking[0] if ranking else None,
            "confidence": 0.9,
            "impacts": impacts,
        },
        0.9,
    )


def _seller_rate_check_answers(state: dict) -> tuple[dict, float]:
    rate = float(state.get("posted_rate") or state.get("postedRate") or 0.0)
    modal = float(state.get("mandi_modal") or state.get("mandiModal") or 0.0)
    if rate > 0 and modal > 0:
        rate_q = rate * 100 if rate < modal / 2 else rate
        within_fair_band = (modal * 0.75 <= rate_q <= modal * 1.25)
    else:
        within_fair_band = True
    manipulation = float(
        state.get("manipulation_signal")
        or state.get("seller_history", {}).get("manipulation_signal")
        or (0.9 if state.get("simulate_manipulation") else 0.0)
    )
    return {"within_fair_band": within_fair_band, "manipulation_signal": manipulation}, 0.9


def _transport_match_answers(state: dict) -> tuple[dict, float]:
    candidates = state.get("candidates") or []
    def _rank_key(c):
        vtype = str(c.get("vehicleType") or "")
        req_vtype = str(state.get("vehicleType") or "")
        match_bonus = 100.0 if (vtype and req_vtype and (vtype in req_vtype or req_vtype in vtype)) else 0.0
        dist = float(c.get("distance_km") or 0.0)
        return match_bonus - dist

    ranked = sorted(candidates, key=_rank_key, reverse=True)
    ranking = [c.get("id") for c in ranked if isinstance(c, dict) and c.get("id")]
    return {
        "fit": 0.88,
        "noshow_risk": 0.04,
        "ranking": ranking,
        "matches": ranked,
    }, 0.91


def _broker_lead_score_answers(state: dict) -> tuple[dict, float]:
    price_gap = float(state.get("price_gap_pct") or state.get("priceGapPct") or 0.0)
    round_no = int(state.get("counter_round") or state.get("counterRound") or 0)
    if round_no >= 2:
        deadlock_risk = 0.85 if price_gap > 10.0 else 0.55
    else:
        deadlock_risk = 0.15
    quality = 0.85 if state.get("demand_fit", True) else 0.55
    return {
        "quality": quality,
        "deadlock_risk": deadlock_risk,
    }, 0.92


def _equipment_booking_rec_answers(state: dict) -> tuple[dict, float]:
    dist = float(state.get("distance_km") or 0.0)
    has_conflict = bool(state.get("slot_conflict"))
    score = 0.4 if (has_conflict or dist > 40.0) else 0.88
    return {
        "score": score,
        "recommend_approve": score >= 0.6,
        "conflict_risk": 0.8 if has_conflict else 0.05,
    }, 0.91


def _land_listing_quality_answers(state: dict) -> tuple[dict, float]:
    answers = question_sets.fallback_answers("land.listing_quality.v1", state)
    return answers, 0.90


async def decide(question_set_id: str, state: dict) -> tuple[dict, float]:
    if question_set_id == "tasks.rank.v1":
        return _rank_answers(state)
    if question_set_id == "chatbot.intent.v1":
        return _intent_answers(state)
    if question_set_id == "chatbot.safety.v1":
        return _safety_answers(state)
    if question_set_id == "seller.rate_check.v1":
        return _seller_rate_check_answers(state)
    if question_set_id == "transport.match.v1":
        return _transport_match_answers(state)
    if question_set_id == "broker.lead_score.v1":
        return _broker_lead_score_answers(state)
    if question_set_id == "equipment.booking_rec.v1":
        return _equipment_booking_rec_answers(state)
    if question_set_id == "land.listing_quality.v1":
        return _land_listing_quality_answers(state)
    record = _load_fixtures().get(question_set_id)
    if record is not None:
        return dict(record.get("answers") or {}), float(record.get("confidence", 0.9))
    return question_sets.fallback_answers(question_set_id, state), 0.5



async def generate(prompt: str, opts: dict | None = None) -> str:
    return "[shim] deterministic response — live AI provider not enabled"


async def analyze_image(image_bytes: bytes, prompt: str, schema: dict | None = None) -> dict:
    p_lower = (prompt or "").lower()
    if "damage" in p_lower or "equipment" in p_lower or "deduction" in p_lower or (schema and "severity" in schema):
        content_text = p_lower
        for phrase in ("(minor, moderate, severe)", "minor, moderate, severe", "estimate severity", "severity estimate"):
            content_text = content_text.replace(phrase, "")

        if any(w in content_text for w in ("heavy", "shattered", "crack", "broken", "engine", "axle", "catastrophic", "severely", "severe")):
            severity = "severe"
            band = "₹8,000 - ₹15,000"
            paisa = 1000000
        elif any(w in content_text for w in ("minor", "scratch", "dent", "paint", "light", "scuff")):
            severity = "minor"
            band = "₹1,000 - ₹3,000"
            paisa = 200000
        else:
            severity = "moderate"
            band = "₹3,000 - ₹8,000"
            paisa = 450000

        return {
            "severity": severity,
            "suggestedDeductionBand": band,
            "suggestedDeductionPaisa": paisa,
            "confidence": 0.88,
            "notes": "Machine damage assessed by AI vision shim.",
        }

    return {
        "diseaseName": "Early Blight",
        "crop": "Tomato",
        "pathogen": "Alternaria solani",
        "confidence": 0.87,
        "symptoms": "पत्तियों पर भूरे गोल धब्बे, किनारों पर पीलापन",
        "chemicalTreatment": "Mancozeb 75% WP",
        "organicTreatment": "नीम तेल 5% घोल",
        "dosage": "2.5 g/L",
        "estimatedCost": 450.0,
    }


async def embed(texts: list[str]) -> list[list[float]]:
    vectors = []
    for text in texts:
        digest = hashlib.sha256(text.encode()).digest()
        vectors.append([digest[i] / 255.0 for i in range(EMBED_DIMENSIONS)])
    return vectors


def sanitize_for_test(text: str) -> str:
    return privacy.sanitize_text(text)
