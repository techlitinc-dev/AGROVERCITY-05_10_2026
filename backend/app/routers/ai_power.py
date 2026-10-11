"""AI Power router (phase-08) — ai.A5 offer scoring, ai.B17 spray window,
ai.C4 demand forecast.

All three endpoints are authenticated user endpoints (`current_user_id`) and
delegate every AI decision to the service layer, which calls the gateway
(rule 10: no gateway imports in routers). Every response is a `suggest`-level
annotation with a deterministic heuristic fallback — the user always decides.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.deps import current_user_id
from app.services import demand_forecast, offer_score, spray_window

router = APIRouter(prefix="/ai-power", tags=["AI Power"])


# --------------------------------------------------------------------------- #
# ai.A5 — trade.offer_score.v1
# --------------------------------------------------------------------------- #


class BuyerSignalsIn(BaseModel):
    acceptanceRate: float = Field(default=0.0, ge=0.0, le=1.0)
    dealsCompleted: int = Field(default=0, ge=0)
    verified: bool = False


class OfferScoreItemIn(BaseModel):
    offerId: str = Field(min_length=1, max_length=120)
    crop: str = Field(min_length=1, max_length=80)
    quantityQuintals: float = Field(gt=0, le=100000)
    offerPricePaisa: int = Field(gt=0, le=10**10)
    mandiModalPaisa: int = Field(default=0, ge=0, le=10**10)
    mandiTrend7dPct: float = Field(default=0.0, ge=-100.0, le=100.0)
    paymentTermsDays: int = Field(default=0, ge=0, le=90)
    pickupArranged: bool = False
    buyer: BuyerSignalsIn = Field(default_factory=BuyerSignalsIn)


class OfferScoreIn(BaseModel):
    offers: list[OfferScoreItemIn] = Field(min_length=1, max_length=50)


@router.post("/trade/offer-score")
async def score_trade_offers(body: OfferScoreIn, uid: str = Depends(current_user_id)):
    """Grade/rank procurement offers before the farmer sees them.

    ai.A5 (`trade.offer_score.v1`): each offer gets a 0-1 score, grade A-D,
    an accept/counter/wait recommendation and a short explanation. `suggest`:
    the farmer always decides."""
    return await offer_score.score_offers([item.model_dump() for item in body.offers])


# --------------------------------------------------------------------------- #
# ai.B17 — weather.spray_window.v1
# --------------------------------------------------------------------------- #


class WeatherWindowIn(BaseModel):
    hoursFromNow: int = Field(ge=0, le=168)
    rainMm: float = Field(default=0.0, ge=0.0, le=500.0)
    windKmph: float = Field(default=0.0, ge=0.0, le=200.0)
    humidityPct: float = Field(default=0.0, ge=0.0, le=100.0)
    tempCelsius: float = Field(default=0.0, ge=-10.0, le=55.0)


class SprayWindowIn(BaseModel):
    crop: str | None = Field(default=None, max_length=80)
    sprayType: str = Field(default="spray", min_length=1, max_length=40)
    windows: list[WeatherWindowIn] = Field(min_length=1, max_length=72)


@router.post("/advisory/spray-window")
async def classify_spray_window(body: SprayWindowIn, uid: str = Depends(current_user_id)):
    """Spray-window advisory: GO / CAUTION / NO-GO with the first clean window
    and reasons, from the hourly forecast (rain, wind, humidity, temperature).

    ai.B17 (`weather.spray_window.v1`): farmer advisory, `suggest` level."""
    return await spray_window.classify_spray_window(
        [window.model_dump() for window in body.windows],
        crop=body.crop,
        spray_type=body.sprayType,
    )


# --------------------------------------------------------------------------- #
# ai.C4 — demand.forecast.v1
# --------------------------------------------------------------------------- #


class DemandForecastIn(BaseModel):
    product: str = Field(min_length=1, max_length=120)
    category: str = Field(default="crop", max_length=20)
    historyUnits: list[float] = Field(min_length=1, max_length=60)
    horizonDays: int = Field(default=7, ge=1, le=30)
    month: int = Field(default=0, ge=0, le=12)
    festivalDays: int = Field(default=0, ge=0, le=30)
    currentStockUnits: float = Field(default=0.0, ge=0.0)


@router.post("/demand/forecast")
async def forecast_demand(body: DemandForecastIn, uid: str = Depends(current_user_id)):
    """Buying-signal forecast for vyapari / dairy: expected demand over the
    next N days with a low/expected/high band and a stock-up/hold/reduce hint.

    ai.C4 (`demand.forecast.v1`): labeled an estimate, `suggest` level."""
    return await demand_forecast.forecast_demand(body.model_dump())
