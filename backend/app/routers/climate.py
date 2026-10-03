from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import current_user_id
from app.routers.users import require_role
from app.services.users import get_user

router = APIRouter(prefix="/climate", tags=["climate"])

CO2E_PER_ACRE = 0.92
INCOME_PER_TONNE = 2000

RESILIENT_VARIETIES = [
    {"variety": "Swarna Sub-1", "crop": "rice", "trait": "flood-tolerant (14 days submergence)", "source": "IRRI"},
    {"variety": "HHB-67", "crop": "bajra", "trait": "heat-tolerant, early maturing", "source": "ICRISAT"},
    {"variety": "HD-2967", "crop": "wheat", "trait": "heat-tolerant, rust-resistant", "source": "ICAR-IARI"},
    {"variety": "Pusa Basmati 1509", "crop": "rice", "trait": "short duration, water-saving", "source": "ICAR-IARI"},
    {"variety": "Phule Gadgil", "crop": "tomato", "trait": "drought-tolerant", "source": "MPKV Rahuri"},
    {"variety": "JG-11", "crop": "gram", "trait": "wilt-resistant, drought-tolerant", "source": "JNKVV"},
]


def _error(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": {}},
    )


async def _farmer(uid: str = Depends(current_user_id)) -> dict:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer")
    return user


@router.get("/carbon-potential")
async def carbon_potential(
    lat: float | None = None,
    lng: float | None = None,
    user: dict = Depends(_farmer),
):
    acres = user.get("landAreaAcres", 0) or 0
    co2e = round(acres * CO2E_PER_ACRE, 1)
    return {
        "co2eTonnes": co2e,
        "annualIncomePotential": round(co2e * INCOME_PER_TONNE),
        "practices": ["biochar", "zero-till", "green-manure"],
    }


@router.get("/resilient-varieties")
async def resilient_varieties(
    crop: str | None = None,
    district: str | None = None,
    user: dict = Depends(_farmer),
):
    items = RESILIENT_VARIETIES
    if crop:
        items = [v for v in items if crop.lower() in v["crop"].lower()]
    return {"data": items, "page": 1, "pageSize": 20, "total": len(items)}
