from datetime import date, timedelta

from app.core.db import query
from app.models.advisory import NpkIn, NpkOut, SaturationIn, SaturationOut

BASE_PRICES = {"onion": 1450, "wheat": 2275, "tomato": 1100}
DEFAULT_BASE_PRICE = 1500

ALTERNATIVES = {
    "onion": [
        {"crop": "Soybean", "expectedPrice": round(4800 * 1.05)},
        {"crop": "Gram", "expectedPrice": round(5400 * 1.05)},
    ],
}
DEFAULT_ALTERNATIVES = [
    {"crop": "Soybean", "expectedPrice": 5040},
    {"crop": "Maize", "expectedPrice": 2250},
]

RISK_PRICE_FACTOR = {"green": 1.0, "yellow": 0.92, "red": 0.80}

# crop targets kg/ha (N, P, K)
NPK_TARGETS = {
    "wheat": (120, 60, 40),
    "onion": (100, 50, 50),
    "tomato": (150, 80, 80),
}
DEFAULT_NPK_TARGET = (100, 50, 50)


def current_season(today: date | None = None) -> str:
    month = (today or date.today()).month
    return "Kharif" if 6 <= month <= 10 else "Rabi"


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
    base = BASE_PRICES.get(inp.crop.lower(), DEFAULT_BASE_PRICE)
    return SaturationOut(
        sowingCount=count,
        radiusKm=inp.radiusKm,
        expectedArrivalIncrease=f"{count * 8}%",
        riskLevel=risk,
        predictedPrice=round(base * RISK_PRICE_FACTOR[risk]),
        predictedDate=(date.today() + timedelta(days=90)).isoformat(),
        alternativeCrops=ALTERNATIVES.get(inp.crop.lower(), DEFAULT_ALTERNATIVES),
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
