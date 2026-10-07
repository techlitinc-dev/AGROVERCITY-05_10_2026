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
from datetime import date, timedelta

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
    month = (today or date.today()).month
    return "Kharif" if 6 <= month <= 10 else "Rabi"


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


async def deterministic_crop_options(inp: CropPlanIn) -> list[CropPlanOption]:
    """Rule-based planner fallback: rotate away from the farmer's recent crops.

    Candidates come from the agronomy rotation table; each option's indicative
    revenue is mandi-linked (0 when no mandi price exists — never invented).
    """
    history = {crop.strip().lower() for crop in (inp.cropHistory or []) if crop.strip()}
    candidates = list(DEFAULT_ALTERNATIVES)
    for crop in inp.cropHistory or []:
        for alt in ROTATION_ALTERNATIVES.get(crop.strip().lower(), ()):
            if alt not in candidates:
                candidates.append(alt)
    fresh = [crop for crop in candidates if crop.lower() not in history] or candidates
    options: list[CropPlanOption] = []
    for crop in fresh[:3]:
        price_paisa = await crop_modal_price_paisa(crop, inp.district)
        estimated = 0
        if price_paisa:
            # Indicative revenue for the declared plot (≈ 20 quintals/acre).
            estimated = int(price_paisa * 20 * inp.plotSizeAcres)
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
            CropPlanOption(crop=crop, rationale=rationale, estimatedRevenuePaisa=estimated)
        )
    return options


async def crop_plan_fallback(inp: CropPlanIn) -> list[CropPlanOption]:
    return await deterministic_crop_options(inp)
