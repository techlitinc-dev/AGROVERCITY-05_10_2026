from typing import Literal

from pydantic import BaseModel, Field


class SaturationIn(BaseModel):
    crop: str
    district: str
    lat: float
    lng: float
    radiusKm: int = 10
    shareSowingIntent: bool = True


class SaturationOut(BaseModel):
    sowingCount: int
    radiusKm: int
    expectedArrivalIncrease: str
    riskLevel: Literal["green", "yellow", "red"]
    predictedPrice: float
    predictedDate: str
    alternativeCrops: list[dict]
    # Phase-05 M13 additions — the UI renders the data-basis citation and the
    # honest price source next to every saturation result (rule 1).
    dataBasis: dict
    priceSource: Literal["mandi_history", "unavailable"]
    source: Literal["ai", "fallback"]
    decisionId: str | None = None
    automationLevel: str = "suggest"


class CropPlanIn(BaseModel):
    soil: str
    irrigation: str
    plotSizeAcres: float = Field(gt=0)
    cropHistory: list[str] = []
    district: str
    season: str | None = None
    lang: Literal["en", "hi"] = "en"


class CropPlanOption(BaseModel):
    crop: str
    rationale: str
    # Indicative revenue estimate in integer paisa; 0 when no mandi data exists.
    estimatedRevenuePaisa: int = 0


class CropPlanOut(BaseModel):
    options: list[CropPlanOption]
    source: Literal["ai", "fallback"]
    cached: bool = False
    decisionId: str | None = None
    automationLevel: str = "suggest"


class CropPlanConfirmIn(BaseModel):
    crop: str
    district: str
    season: str | None = None
    plotId: str | None = None
    plannedDate: str | None = None
    rationale: str | None = None


class CropPlanConfirmOut(BaseModel):
    cropCycleId: str
    created: bool
    taskIds: list[str]


class PestDisease(BaseModel):
    diseaseName: str
    crop: str
    pathogen: str
    confidence: float
    symptoms: str
    chemicalTreatment: str
    organicTreatment: str
    dosage: str
    estimatedCost: float


class NpkIn(BaseModel):
    n: float
    p: float
    k: float
    crop: str
    soilType: str


class NpkOut(BaseModel):
    recommendations: list[str]
    ureaKgPerAcre: float
    dapKgPerAcre: float
    mopKgPerAcre: float


class SowingIntentIn(BaseModel):
    crop: str
    plotId: str | None = None
    plannedDate: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
