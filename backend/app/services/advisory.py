"""Advisory services (robust.md §7.2, brief M13).

Phase-05 changes:
- Base prices are NEVER hardcoded (rule 1). The saturation read and the crop
  planner read mandi-linked modal prices from the `mandi_prices` collection;
  when a crop has no mandi data the response says so (`priceSource` =
  `unavailable`, price 0) instead of inventing a number.
- Saturation classes derive from real district-crop sowing-intent aggregates.
  The rules decide the risk class; the model (via `services/ai/gateway.py`,
  rule 10) only ranks the alternative crops.
- The crop planner produces 2-3 options with a vernacular rationale and a
  deterministic fallback, cached per (district, season, profile-class). The
  endpoint never creates anything — confirm is a separate, explicit call.
"""
import json
import logging
from datetime import date, timedelta

from pydantic import BaseModel, Field, ValidationError

from app.core.config import settings
from app.core.db import query
from app.models.advisory import (
    CropPlanIn,
    CropPlanOption,
    NpkIn,
    NpkOut,
    SaturationIn,
    SaturationOut,
)
from app.services.ai import config_store, gateway

log = logging.getLogger(__name__)

DISEASE_GATE_MODULE = "advisory_disease_gate"

# Model-side image size: phone photos arrive at 3–12 MP and vision latency +
# token cost scale with pixels. The stored scan keeps the original; only the
# bytes sent to the gate/diagnosis models are downscaled.
VISION_MAX_DIMENSION = 1024


def downscale_for_vision(image_bytes: bytes, max_dim: int = VISION_MAX_DIMENSION) -> bytes:
    """Resize the largest side to max_dim px (JPEG q85) for model calls.

    Non-destructive and fail-safe: anything unreadable or already small is
    returned unchanged so a resize bug can never break scanning.
    """
    try:
        import io

        from PIL import Image

        with Image.open(io.BytesIO(image_bytes)) as img:
            if max(img.size) <= max_dim:
                return image_bytes
            img.thumbnail((max_dim, max_dim), Image.LANCZOS)
            buf = io.BytesIO()
            img.convert("RGB").save(buf, "JPEG", quality=85)
            return buf.getvalue()
    except Exception as exc:  # noqa: BLE001 — never break the scan on resize
        log.warning("vision downscale failed, using original bytes: %s", exc)
        return image_bytes

GATE_PROMPT = (
    "Decide whether this image is a usable crop-disease scan input. Return ONLY JSON "
    '{"is_plant_leaf": true/false, "quality_ok": true/false}. is_plant_leaf is true only '
    "when the frame is dominated by a single plant leaf; quality_ok is true only when the "
    "photo is sharp and well lit."
)


async def disease_image_gate(image_bytes: bytes) -> dict:
    """Gate a disease-scan image BEFORE diagnosis (M9). Returns
    {is_plant_leaf, quality_ok}; never a model outside the gateway."""
    result = await gateway.analyze_image(
        image_bytes, GATE_PROMPT, schema={"is_plant_leaf": True, "quality_ok": True},
        module=DISEASE_GATE_MODULE,
    )
    return {
        "is_plant_leaf": bool(result.get("is_plant_leaf", True)),
        "quality_ok": bool(result.get("quality_ok", True)),
    }


class CropPlanPayload(BaseModel):
    options: list[CropPlanOption] = Field(min_length=2, max_length=5)


def _clean_json_str(raw: str) -> str:
    cleaned = (raw or "").strip()
    if "```" in cleaned:
        parts = cleaned.split("```")
        if len(parts) >= 2:
            cleaned = parts[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
            cleaned = cleaned.strip()
    return cleaned


def _crop_plan_prompt(body: CropPlanIn) -> str:
    language = "Hindi (Devanagari)" if body.lang == "hi" else "English"
    history = ", ".join(body.cropHistory) or "none"
    season = body.season or current_season()
    return (
        f"You are an Indian agronomy planner. Inputs — soil: {body.soil}; "
        f"irrigation: {body.irrigation}; plot: {body.plotSizeAcres} acres; "
        f"recent crops: {history}; district: {body.district}; season: {season}. "
        "Recommend 2-3 rotating crops suited to these inputs. For EACH crop give a "
        "plan: recommended variety, sowing window for the season, crop "
        "duration in days, water requirement (low/medium/high + irrigation count), "
        "expected yield in quintals per acre, estimated cultivation cost in INR, "
        "expected revenue in INR for the given plot, expected profit in INR, a short "
        "market outlook, exactly 2 key risks, and a 3-4 step task checklist from land "
        "preparation to harvest. Monetary values are integer paisa (1 INR = 100 paisa). "
        "Keep every text field to one short line — the answer must stay small and fast. "
        "Be realistic for Maharashtra agro-climatic conditions; never promise prices. "
        "Output ONLY valid JSON matching the requested schema, with the rationale "
        f"written in {language}."
    )


# Gemini structured-output schema for the detailed crop plan. Hand-written (no
# $defs) so it can go straight into response_schema.
CROP_PLAN_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "options": {
            "type": "array",
            "minItems": 2,
            "maxItems": 3,
            "items": {
                "type": "object",
                "properties": {
                    "crop": {"type": "string"},
                    "rationale": {"type": "string"},
                    "estimatedRevenuePaisa": {"type": "integer"},
                    "variety": {"type": "string"},
                    "sowingWindow": {"type": "string"},
                    "durationDays": {"type": "integer"},
                    "waterRequirement": {"type": "string"},
                    "expectedYieldQuintalPerAcre": {"type": "number"},
                    "estimatedCostPaisa": {"type": "integer"},
                    "expectedProfitPaisa": {"type": "integer"},
                    "marketOutlook": {"type": "string"},
                    "risks": {"type": "array", "items": {"type": "string"}},
                    "tasks": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["crop", "rationale"],
            },
        }
    },
    "required": ["options"],
}


async def generate_crop_options(body: CropPlanIn) -> tuple[list[CropPlanOption], str]:
    """One Gemini-flash call (structured JSON) + exactly one repair retry;
    deterministic fallback on any failure."""
    opts = {
        "module": CROP_PLAN_MODULE,
        # Latency-critical: the farmer watches a progress bar, so pin the
        # fastest verified flash model (gemini-3.5-flash — ~2s here vs ~20s
        # for flash-lite on this key, minutes for the full flash models).
        "model": settings.ai_gemini_model_plan,
        "json_schema": CROP_PLAN_JSON_SCHEMA,
        # On 3.x flash models max_output_tokens also caps the hidden thinking
        # budget — a cap near the visible answer size truncates the JSON and
        # triggers the repair retry (double wait). 4096 leaves ample headroom.
        "max_output_tokens": 4096,
    }
    raw = await gateway.generate(_crop_plan_prompt(body), opts)
    try:
        parsed = CropPlanPayload.model_validate(json.loads(_clean_json_str(raw)))
        return parsed.options, "ai"
    except (json.JSONDecodeError, ValidationError, ValueError) as first_error:
        repair_prompt = (
            "Rewrite the following as strictly valid JSON matching "
            '{"options":[{"crop":"","rationale":"","estimatedRevenuePaisa":0,'
            '"variety":"","sowingWindow":"","durationDays":0,"waterRequirement":"",'
            '"expectedYieldQuintalPerAcre":0,"estimatedCostPaisa":0,'
            '"expectedProfitPaisa":0,"marketOutlook":"","risks":[],"tasks":[]}]}:\n'
            f"{raw}\nValidation error: {first_error}"
        )
        repaired = await gateway.generate(repair_prompt, opts)
        try:
            parsed = CropPlanPayload.model_validate(json.loads(_clean_json_str(repaired)))
            return parsed.options, "ai"
        except (json.JSONDecodeError, ValidationError, ValueError):
            return await crop_plan_fallback(body), "fallback"

SATURATION_QUESTION_SET = "advisory.saturation.v1"
SATURATION_MODULE = "advisory_saturation"
CROP_PLAN_MODULE = "advisory_crop_plan"

RISK_PRICE_FACTOR = {"green": 1.0, "yellow": 0.92, "red": 0.80}
CLASS_TO_RISK = {"low": "green", "medium": "yellow", "high": "red"}

# Agronomy rotation knowledge (candidate crops only — never prices). A crop with
# no mandi data simply renders `expectedPrice: null` (rule 1).
ROTATION_ALTERNATIVES = {
    "onion": ("Soybean", "Gram"),
    "tomato": ("Maize", "Soybean"),
    "wheat": ("Gram", "Mustard"),
    "cotton": ("Soybean", "Maize"),
    "soybean": ("Wheat", "Gram"),
}
DEFAULT_ALTERNATIVES = ("Soybean", "Maize")

# crop targets kg/ha (N, P, K)
NPK_TARGETS = {
    "wheat": (120, 60, 40),
    "onion": (100, 50, 50),
    "tomato": (150, 80, 80),
}
DEFAULT_NPK_TARGET = (100, 50, 50)


def _as_int(value, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _rupees_to_paisa(value) -> int:
    """mandi_prices stores modal prices in rupees/quintal — convert once."""
    try:
        return int(round(float(value) * 100))
    except (TypeError, ValueError):
        return 0


def current_season(today: date | None = None) -> str:
    """Auto-detect the Indian cropping season from the calendar month.

    Kharif (south-west monsoon): Jun–Oct; Rabi (winter): Nov–Feb;
    Zaid (short summer): Mar–May.
    """
    month = (today or date.today()).month
    if 6 <= month <= 10:
        return "Kharif"
    if 3 <= month <= 5:
        return "Zaid"
    return "Rabi"


def season_for_date(iso_date: str) -> str:
    """Season auto-detection for a planned sowing date (YYYY-MM-DD)."""
    try:
        return current_season(date.fromisoformat(iso_date))
    except (TypeError, ValueError):
        return current_season()


async def crop_modal_price_paisa(crop: str, district: str | None = None) -> int | None:
    """Highest observed mandi modal price for a crop, in integer paisa.

    Reads the `mandi_prices` collection (the same source the mandi module uses);
    returns None when the crop has no observed price — never a default.
    """
    docs = await query("mandi_prices", [], limit=1000)
    prices: list[int] = []
    for doc in docs:
        commodity = str(doc.get("commodity") or "")
        if crop.lower() not in commodity.lower():
            continue
        price = _rupees_to_paisa(doc.get("modalPrice"))
        if price > 0:
            prices.append(price)
    if not prices:
        return None
    return max(prices)


async def _alternatives(crop: str) -> list[dict]:
    """Candidate alternative crops with mandi-linked indicative prices."""
    names = ROTATION_ALTERNATIVES.get(crop.lower(), DEFAULT_ALTERNATIVES)
    out: list[dict] = []
    for name in names:
        price_paisa = await crop_modal_price_paisa(name)
        out.append(
            {
                "crop": name,
                "expectedPrice": (price_paisa / 100) if price_paisa else None,
                "expectedPricePaisa": price_paisa or 0,
            }
        )
    return out


async def saturation(inp: SaturationIn) -> SaturationOut:
    # aggregate counts only — never user ids (privacy: opt-in sharing)
    cycles = await query(
        "crop_cycles",
        [("crop", "==", inp.crop), ("district", "==", inp.district)],
        limit=1000,
    )
    count = len(cycles)
    if count < 20:
        risk = "green"
    elif count < 60:
        risk = "yellow"
    else:
        risk = "red"

    base_paisa = await crop_modal_price_paisa(inp.crop, inp.district)
    price_source = "mandi_history" if base_paisa else "unavailable"
    predicted_paisa = int(round(base_paisa * RISK_PRICE_FACTOR[risk])) if base_paisa else 0

    alternatives = await _alternatives(inp.crop)
    det_names = [alt["crop"] for alt in alternatives]

    state = {
        "crop": inp.crop,
        "district": inp.district,
        "sowing_count": count,
        "alternatives": [
            {"crop": alt["crop"], "expected_price_paisa": alt["expectedPricePaisa"]}
            for alt in alternatives
        ],
    }
    result = await gateway.decide(state, SATURATION_QUESTION_SET, module=SATURATION_MODULE)
    answers = result.answers or {}
    ai_names = [str(name) for name in (answers.get("alt_crops") or [])]
    used_ai = (
        result.source in ("jev", "gemini", "shim")
        and len(ai_names) == len(det_names)
        and set(ai_names) == set(det_names)
    )
    if used_ai:
        order = {name: index for index, name in enumerate(ai_names)}
        alternatives.sort(key=lambda alt: order[alt["crop"]])

    # Strip the internal paisa helper from the public payload.
    public_alternatives = [
        {"crop": alt["crop"], "expectedPrice": alt["expectedPrice"]} for alt in alternatives
    ]

    return SaturationOut(
        sowingCount=count,
        radiusKm=inp.radiusKm,
        expectedArrivalIncrease=f"{count * 8}%",
        riskLevel=risk,
        predictedPrice=predicted_paisa / 100,
        predictedDate=(date.today() + timedelta(days=90)).isoformat(),
        alternativeCrops=public_alternatives,
        dataBasis={"count": count, "district": inp.district},
        priceSource=price_source,
        source="ai" if used_ai else "fallback",
        decisionId=result.decision_id,
        automationLevel=await config_store.automation_for(SATURATION_QUESTION_SET),
    )


def npk_recommendation(inp: NpkIn) -> NpkOut:
    target_n, target_p, target_k = NPK_TARGETS.get(inp.crop.lower(), DEFAULT_NPK_TARGET)
    deficit_n = max(0.0, target_n - inp.n)
    deficit_p = max(0.0, target_p - inp.p)
    deficit_k = max(0.0, target_k - inp.k)
    # urea 46% N, DAP 46% P2O5, MOP 60% K2O; kg/ha → kg/acre ÷ 2.5
    urea = round(deficit_n / 0.46 / 2.5, 1)
    dap = round(deficit_p / 0.46 / 2.5, 1)
    mop = round(deficit_k / 0.60 / 2.5, 1)
    recommendations = [
        f"यूरिया {urea} किग्रा प्रति एकड़ दें (नाइट्रोजन कमी)",
        f"DAP {dap} किग्रा प्रति एकड़ दें (फॉस्फोरस कमी)",
        f"MOP {mop} किग्रा प्रति एकड़ दें (पोटाश कमी)",
    ]
    return NpkOut(
        recommendations=recommendations,
        ureaKgPerAcre=urea,
        dapKgPerAcre=dap,
        mopKgPerAcre=mop,
    )


def profile_class(inp: CropPlanIn) -> str:
    """Coarse (soil, irrigation) profile bucket used as part of the cache key."""
    soil = (inp.soil or "").strip().lower().replace(" ", "_") or "unknown"
    irrigation = (inp.irrigation or "").strip().lower().replace(" ", "_") or "unknown"
    return f"{soil}:{irrigation}"


def crop_plan_cache_key(inp: CropPlanIn) -> str:
    season = (inp.season or current_season()).strip().lower()
    district = (inp.district or "").strip().lower()
    return f"advisory_crop_plan:{district}:{season}:{profile_class(inp)}:{inp.lang}"


# Indicative agronomy facts for the deterministic fallback planner — durations,
# water needs, improved varieties and per-acre cultivation cost/yield norms.
# Prices are NEVER listed here (rule 1): revenue stays mandi-linked, 0 when a
# crop has no observed modal price.
CROP_FACTS: dict[str, dict] = {
    "soybean": {
        "variety": "JS-9560 / Kalitur",
        "durationDays": 100,
        "waterRequirement": "low-medium — 2-3 irrigations",
        "yieldQPerAcre": 9.0,
        "costPerAcre": 9000,
    },
    "wheat": {
        "variety": "HD-2967 / Lokwan",
        "durationDays": 135,
        "waterRequirement": "medium — 3-4 irrigations",
        "yieldQPerAcre": 15.0,
        "costPerAcre": 12000,
    },
    "onion": {
        "variety": "Nashik Red / N-53",
        "durationDays": 120,
        "waterRequirement": "high — frequent light irrigations",
        "yieldQPerAcre": 100.0,
        "costPerAcre": 45000,
    },
    "cotton": {
        "variety": "Bt cotton (BG-II)",
        "durationDays": 180,
        "waterRequirement": "medium-high — 4-6 irrigations",
        "yieldQPerAcre": 10.0,
        "costPerAcre": 18000,
    },
    "tomato": {
        "variety": "Deshi hybrid (Karnataka/Local)",
        "durationDays": 105,
        "waterRequirement": "high — drip every 2-3 days",
        "yieldQPerAcre": 80.0,
        "costPerAcre": 40000,
    },
    "maize": {
        "variety": "DHM-117 / Ganga hybrid",
        "durationDays": 100,
        "waterRequirement": "medium — 3-5 irrigations",
        "yieldQPerAcre": 22.0,
        "costPerAcre": 10000,
    },
    "gram": {
        "variety": "Jaki-9218 / Vishal",
        "durationDays": 100,
        "waterRequirement": "low — 1-2 light irrigations",
        "yieldQPerAcre": 8.0,
        "costPerAcre": 8000,
    },
    "mustard": {
        "variety": "Pusa Bold / DRMR-1501",
        "durationDays": 110,
        "waterRequirement": "low — 1-2 irrigations",
        "yieldQPerAcre": 6.0,
        "costPerAcre": 7000,
    },
}
DEFAULT_CROP_FACTS = {
    "variety": "locally popular improved variety",
    "durationDays": 110,
    "waterRequirement": "medium — as per soil moisture",
    "yieldQPerAcre": 10.0,
    "costPerAcre": 12000,
}

SEASON_SOWING_WINDOWS = {
    "kharif": "Jun–Jul (with monsoon onset)",
    "rabi": "Oct–Nov (after monsoon withdrawal)",
    "zaid": "Mar–Apr (short summer window)",
}

GENERIC_PLAN_RISKS = ["Weather variability — insure under PMFBY", "Pest & disease pressure"]
GENERIC_PLAN_TASKS = [
    "Land preparation and levelling",
    "Sowing on the recommended window date",
    "First irrigation / germination check",
    "Weeding and top-dressing",
    "Pest scouting every week",
    "Harvest at full maturity",
]


async def deterministic_crop_options(inp: CropPlanIn) -> list[CropPlanOption]:
    """Rule-based planner fallback: rotate away from the farmer's recent crops.

    Candidates come from the agronomy rotation table; each option's indicative
    revenue is mandi-linked (0 when no mandi price exists — never invented).
    Detail fields come from the CROP_FACTS agronomy table above.
    """
    history = {crop.strip().lower() for crop in (inp.cropHistory or []) if crop.strip()}
    candidates = list(DEFAULT_ALTERNATIVES)
    for crop in inp.cropHistory or []:
        for alt in ROTATION_ALTERNATIVES.get(crop.strip().lower(), ()):
            if alt not in candidates:
                candidates.append(alt)
    fresh = [crop for crop in candidates if crop.lower() not in history] or candidates
    season = (inp.season or current_season()).strip().lower()
    window = SEASON_SOWING_WINDOWS.get(
        season, "at the start of the season, with soil moisture"
    )
    options: list[CropPlanOption] = []
    for crop in fresh[:3]:
        facts = CROP_FACTS.get(crop.lower(), DEFAULT_CROP_FACTS)
        price_paisa = await crop_modal_price_paisa(crop, inp.district)
        estimated = 0
        if price_paisa:
            # Indicative revenue for the declared plot from the mandi-linked price.
            estimated = int(price_paisa * facts["yieldQPerAcre"] * inp.plotSizeAcres)
        cost = int(facts["costPerAcre"] * inp.plotSizeAcres * 100)  # ₹/acre → paisa
        profit = max(0, estimated - cost) if estimated else 0
        rationale = (
            f"Rotates away from your recent {', '.join(sorted(history)) or 'crops'} and "
            f"suits {inp.soil} soil with {inp.irrigation} irrigation."
            if inp.lang == "en"
            else (
                f"आपकी हाल की {', '.join(sorted(history)) or 'फसलों'} से फेरबदल करता है और "
                f"{inp.soil} मिट्टी व {inp.irrigation} सिंचाई के लिए उपयुक्त है।"
            )
        )
        options.append(
            CropPlanOption(
                crop=crop,
                rationale=rationale,
                estimatedRevenuePaisa=estimated,
                variety=facts["variety"],
                sowingWindow=window,
                durationDays=facts["durationDays"],
                waterRequirement=facts["waterRequirement"],
                expectedYieldQuintalPerAcre=facts["yieldQPerAcre"],
                estimatedCostPaisa=cost,
                expectedProfitPaisa=profit,
                marketOutlook=(
                    "Check live mandi prices before sowing; indicative revenue uses "
                    "the highest observed modal price for this crop."
                ),
                risks=list(GENERIC_PLAN_RISKS),
                tasks=list(GENERIC_PLAN_TASKS),
            )
        )
    return options


async def crop_plan_fallback(inp: CropPlanIn) -> list[CropPlanOption]:
    return await deterministic_crop_options(inp)
