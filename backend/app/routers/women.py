from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.db import get_doc, set_doc
from app.core.deps import current_user_id
from app.routers.users import require_role
from app.services.users import get_user

router = APIRouter(prefix="/women", tags=["women"])

SHG_DEFAULTS = {"memberCount": 12, "corpus": 48500, "loanFund": 30000, "monthlyDeposit": 500}

ENTERPRISE_LINES = [
    {"product": "अचार", "monthlyProfit": 3200},
    {"product": "पापड़", "monthlyProfit": 2100},
    {"product": "A2 घी", "monthlyProfit": 4500},
]

GARDEN_PLANS = [
    {
        "id": "gp_leafy",
        "category": "Leafy Greens",
        "items": [
            {"name": "Spinach", "vernacularName": "पालक", "nutrition": "Iron, Vitamin A, Folate", "companion": "Tomato, Cauliflower", "daysToHarvest": 45},
            {"name": "Fenugreek", "vernacularName": "मेथी", "nutrition": "Iron, Calcium, Fibre", "companion": "Coriander, Spinach", "daysToHarvest": 30},
            {"name": "Coriander", "vernacularName": "धनिया", "nutrition": "Vitamin K, Vitamin C", "companion": "Fenugreek, Spinach", "daysToHarvest": 40},
            {"name": "Amaranth", "vernacularName": "तांदूळ", "nutrition": "Iron, Calcium, Protein", "companion": "Tomato, Bean", "daysToHarvest": 35},
        ],
    },
    {
        "id": "gp_vegetables",
        "category": "Vegetables",
        "items": [
            {"name": "Tomato", "vernacularName": "टमाटर", "nutrition": "Lycopene, Vitamin C", "companion": "Spinach, Onion", "daysToHarvest": 90},
            {"name": "Carrot", "vernacularName": "गाजर", "nutrition": "Beta-carotene, Vitamin K", "companion": "Tomato, Pea", "daysToHarvest": 75},
            {"name": "Brinjal", "vernacularName": "वांगी", "nutrition": "Fibre, Potassium", "companion": "Bean, Spinach", "daysToHarvest": 80},
            {"name": "Okra", "vernacularName": "भेंडी", "nutrition": "Folate, Magnesium", "companion": "Tomato, Pepper", "daysToHarvest": 55},
        ],
    },
    {
        "id": "gp_trees",
        "category": "Trees/Perennials",
        "items": [
            {"name": "Drumstick", "vernacularName": "शेवगा", "nutrition": "Vitamin C, Calcium, Iron", "companion": "Turmeric, Curry leaf", "daysToHarvest": 180},
            {"name": "Papaya", "vernacularName": "पपई", "nutrition": "Vitamin A, Vitamin C", "companion": "Banana, Bean", "daysToHarvest": 270},
            {"name": "Guava", "vernacularName": "पेरू", "nutrition": "Vitamin C, Lycopene", "companion": "Papaya, Drumstick", "daysToHarvest": 365},
            {"name": "Curry leaf", "vernacularName": "कढीपत्ता", "nutrition": "Iron, Vitamin A", "companion": "Drumstick, Citrus", "daysToHarvest": 240},
        ],
    },
]

BACKYARD_LIVESTOCK = [
    {"id": "lv_cow", "animal": "Cow", "vernacularName": "गाय", "count": 2, "yieldLabel": "8–10 L milk/day", "vaccine": "HS (गळू)", "dueInDays": 12},
    {"id": "lv_buffalo", "animal": "Buffalo", "vernacularName": "म्हैस", "count": 1, "yieldLabel": "6–7 L milk/day", "vaccine": "FMD (पाय-तोंड रोग)", "dueInDays": 26},
    {"id": "lv_hen", "animal": "Hen", "vernacularName": "कोंबडी", "count": 12, "yieldLabel": "8–10 eggs/day", "vaccine": "Ranikhet (ND)", "dueInDays": 9},
    {"id": "lv_goat", "animal": "Goat", "vernacularName": "शेळी / बकरी", "count": 5, "yieldLabel": "2–3 L milk/day", "vaccine": "PPR (पीपीआर)", "dueInDays": 18},
]


class DepositIn(BaseModel):
    amount: float = Field(gt=0)
    month: str = Field(pattern=r"^\d{4}-\d{2}$")


def _error(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": {}},
    )


async def _farmer(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer")
    return uid


async def _shg_profile(uid: str) -> dict:
    doc = await get_doc(f"users/{uid}/shg", "profile")
    if doc is None:
        doc = dict(SHG_DEFAULTS)
        await set_doc(f"users/{uid}/shg", "profile", doc)
    return doc


@router.get("/shg")
async def get_shg(uid: str = Depends(_farmer)):
    return await _shg_profile(uid)


@router.post("/shg/deposit", status_code=201)
async def deposit(body: DepositIn, uid: str = Depends(_farmer)):
    profile = await _shg_profile(uid)
    if await get_doc(f"users/{uid}/shg/deposits", body.month) is not None:
        _error(409, "DUPLICATE_DEPOSIT_MONTH", "इस महीने की जमा हो चुकी है")
    await set_doc(
        f"users/{uid}/shg/deposits",
        body.month,
        {
            "id": body.month,
            "month": body.month,
            "amount": body.amount,
            "depositedAt": datetime.now(timezone.utc).isoformat(),
        },
    )
    profile["corpus"] += body.amount
    await set_doc(f"users/{uid}/shg", "profile", profile)
    return {"deposited": body.amount, "newCorpus": profile["corpus"]}


@router.get("/home-enterprise")
async def home_enterprise(uid: str = Depends(_farmer)):
    doc = await get_doc(f"users/{uid}/home_enterprise", "summary")
    if doc is None:
        doc = {"lines": ENTERPRISE_LINES}
        await set_doc(f"users/{uid}/home_enterprise", "summary", doc)
    lines = doc.get("lines", [])
    return {
        "lines": lines,
        "totalMonthlyProfit": sum(line.get("monthlyProfit", 0) for line in lines),
    }


@router.get("/garden-plans")
async def garden_plans(uid: str = Depends(current_user_id)):
    return {"data": GARDEN_PLANS}


@router.get("/backyard-livestock")
async def backyard_livestock(uid: str = Depends(current_user_id)):
    today = date.today()
    data = [
        {k: v for k, v in row.items() if k != "dueInDays"}
        | {"vaccineDue": (today + timedelta(days=row["dueInDays"])).isoformat()}
        for row in BACKYARD_LIVESTOCK
    ]
    return {"data": data}
