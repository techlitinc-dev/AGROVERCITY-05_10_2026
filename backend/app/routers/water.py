import zlib
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.deps import current_user_id
from app.routers.users import require_role
from app.services.tasks import emit_task
from app.services.users import get_user
from app.services.weather import fetch_weather, rain_expected

router = APIRouter(prefix="/water", tags=["water"])

# Tool deep link — the water module's registered `WATER_PAGES` tool id
# (phase-05 WS-07 task 7.7).
WATER_DEEP_LINK = "/dashboard/p/water"

# PMKSY benchmark: indicative micro-irrigation input cost per acre (₹85,000).
# This is a *rate* used only when the farmer supplies acres instead of a total
# cost; the subsidy split itself is plain integer-paisa arithmetic below.
PMKSY_BENCHMARK_COST_PER_ACRE_INR = 85000
PMKSY_SUBSIDY_PERCENT = 55

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
    """Either `acres` (benchmark per-acre cost) or an explicit total `costPaisa`."""

    acres: float | None = Field(default=None, gt=0)
    costPaisa: int | None = Field(default=None, gt=0)


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
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


def _location(user: dict, lat: float | None, lng: float | None) -> tuple[float, float] | None:
    """Resolve a coordinate pair from the query first, then the farmer profile."""
    resolved_lat = lat if lat is not None else user.get("lat")
    resolved_lng = lng if lng is not None else user.get("lng")
    if resolved_lat is None or resolved_lng is None:
        return None
    return float(resolved_lat), float(resolved_lng)


@router.get("/schedule")
async def get_schedule(
    lat: float | None = None,
    lng: float | None = None,
    user: dict = Depends(_farmer),
):
    """Plot-wise irrigation schedule + a weather-aware irrigation task per plot.

    When the rain forecast for today meets the threshold the emitted task carries
    a skip-today suggestion instead of the normal schedule (phase-05 WS-07
    task 7.7). Without a location the task is emitted with the normal schedule —
    rain is never invented.
    """
    method = user.get("irrigationType") or "drip"
    coordinates = _location(user, lat, lng)
    weather = await fetch_weather(*coordinates) if coordinates else None
    rain_today = rain_expected(weather, "Today")
    today = date.today().isoformat()

    items = []
    for crop in user.get("activeCrops", []):
        moisture = 35 + (zlib.crc32(f"{user['id']}{crop}".encode()) % 40)
        recommended = 90 if moisture < 60 else 30
        items.append(
            {
                "plotName": crop,
                "moisturePercent": moisture,
                "recommendedMinutes": recommended,
                "method": method,
                "rainExpected": rain_today,
                "skipToday": rain_today,
            }
        )
        await _emit_irrigation_task(user["id"], crop, recommended, rain_today, today)

    return {"data": items, "page": 1, "pageSize": 20, "total": len(items)}


async def _emit_irrigation_task(
    user_id: str, plot: str, minutes: int, rain_today: bool, today: str
) -> None:
    """Emit one irrigation task per plot per day (dedupe-safe on the day+plot)."""
    if rain_today:
        await emit_task(
            user_id,
            persona="farmer",
            module="water",
            kind="irrigation_skip",
            title_en=f"Skip irrigation today — {plot}",
            title_hi=f"आज सिंचन टाळा — {plot}",
            subtitle=f"Rain is forecast today; skip the scheduled {minutes}-minute irrigation.",
            priority="today",
            deep_link=WATER_DEEP_LINK,
            source_id=f"{today}:{plot}",
            due_at=today,
        )
        return
    await emit_task(
        user_id,
        persona="farmer",
        module="water",
        kind="irrigation",
        title_en=f"Irrigate today — {plot}",
        title_hi=f"आज सिंचन करा — {plot}",
        subtitle=f"Run the scheduled {minutes}-minute irrigation for {plot}.",
        priority="today",
        deep_link=WATER_DEEP_LINK,
        source_id=f"{today}:{plot}",
        due_at=today,
    )


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
    """PMKSY 55% micro-irrigation subsidy — integer-paisa arithmetic.

    `costPaisa` is the farmer's estimated total input cost; `acres` falls back to
    the PMKSY benchmark cost. Both the legacy rupee fields and the authoritative
    integer-paisa fields are returned so older clients keep working.
    """
    if body.costPaisa is None and body.acres is None:
        _error(422, "VALIDATION_ERROR", "provide acres or costPaisa", {"acres": "required"})
    if body.costPaisa is not None:
        total_paisa = int(body.costPaisa)
    else:
        total_paisa = round(body.acres * PMKSY_BENCHMARK_COST_PER_ACRE_INR * 100)
    subsidy_paisa = (total_paisa * PMKSY_SUBSIDY_PERCENT) // 100
    farmer_share_paisa = total_paisa - subsidy_paisa
    return {
        "totalCost": total_paisa // 100,
        "subsidyPercent": PMKSY_SUBSIDY_PERCENT,
        "subsidyAmount": subsidy_paisa / 100,
        "farmerShare": farmer_share_paisa / 100,
        "totalCostPaisa": total_paisa,
        "subsidyAmountPaisa": subsidy_paisa,
        "farmerSharePaisa": farmer_share_paisa,
    }
