import zlib
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.deps import current_user_id
from app.routers.users import require_role
from app.services.users import get_user

router = APIRouter(prefix="/water", tags=["water"])

_GROUNDWATER = {
    "Nashik": {"depthMeters": 18.5, "zone": "semiCritical"},
    "Pune": {"depthMeters": 12.0, "zone": "safe"},
    "Nagpur": {"depthMeters": 25.2, "zone": "critical"},
    "Aurangabad": {"depthMeters": 21.0, "zone": "semiCritical"},
}

_CANALS = [
    {"canalName": "Gangapur Canal", "weekday": 0, "slotTime": "06:00-12:00"},
    {"canalName": "Palkhed Canal", "weekday": 3, "slotTime": "12:00-18:00"},
]


class PmksyCalcIn(BaseModel):
    acres: float = Field(gt=0)


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


def _next_weekday(weekday: int) -> str:
    today = date.today()
    days_ahead = (weekday - today.weekday()) % 7 or 7
    return (today + timedelta(days=days_ahead)).isoformat()


@router.get("/schedule")
async def get_schedule(user: dict = Depends(_farmer)):
    method = user.get("irrigationType") or "drip"
    items = []
    for crop in user.get("activeCrops", []):
        moisture = 35 + (zlib.crc32(f"{user['id']}{crop}".encode()) % 40)
        items.append(
            {
                "plotName": crop,
                "moisturePercent": moisture,
                "recommendedMinutes": 90 if moisture < 60 else 30,
                "method": method,
            }
        )
    return {"data": items, "page": 1, "pageSize": 20, "total": len(items)}


@router.get("/groundwater")
async def get_groundwater(district: str | None = None, user: dict = Depends(_farmer)):
    if not district:
        _error(400, "MISSING_DISTRICT", "district query param is required")
    info = _GROUNDWATER.get(district, {"depthMeters": 15.0, "zone": "safe"})
    return {
        **info,
        "district": district,
        "measuredAt": datetime.now(timezone.utc).date().isoformat(),
    }


@router.get("/canal-rotation")
async def get_canal_rotation(canal: str | None = None, user: dict = Depends(_farmer)):
    items = [
        {
            "canalName": c["canalName"],
            "nextDate": _next_weekday(c["weekday"]),
            "slotTime": c["slotTime"],
        }
        for c in _CANALS
    ]
    if canal:
        needle = canal.lower()
        items = [c for c in items if needle in c["canalName"].lower()]
    return {"data": items, "page": 1, "pageSize": 20, "total": len(items)}


@router.post("/pmksy-calculator")
async def pmksy_calculator(body: PmksyCalcIn, user: dict = Depends(_farmer)):
    total_cost = body.acres * 85000
    subsidy_amount = round(total_cost * 0.55, 2)
    return {
        "totalCost": total_cost,
        "subsidyPercent": 55,
        "subsidyAmount": subsidy_amount,
        "farmerShare": round(total_cost - subsidy_amount, 2),
    }
