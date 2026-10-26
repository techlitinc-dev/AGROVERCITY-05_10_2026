from typing import Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class SaturationIn(BaseModel):
    # `commodity` is accepted as a client-side alias for `crop` (the mandi
    # price views send the commodity they already have selected).
    model_config = ConfigDict(populate_by_name=True)

    crop: str = Field(validation_alias=AliasChoices("crop", "commodity"))
    # All location fields fall back to the farmer's profile when omitted:
    # district from the user doc, lat/lng from farmBoundaryPoints[0].
    district: str | None = None
    lat: float | None = None
    lng: float | None = None
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
    # Detailed agronomy plan (AI-generated; sensible agronomy defaults in the
    # deterministic fallback). Everything is indicative advisory, not a quote.
    variety: str = ""
    sowingWindow: str = ""
    durationDays: int = 0
    waterRequirement: str = ""
    expectedYieldQuintalPerAcre: float = 0
    estimatedCostPaisa: int = 0
    expectedProfitPaisa: int = 0
    marketOutlook: str = ""
    risks: list[str] = []
    tasks: list[str] = []


class CropPlanOut(BaseModel):
    options: list[CropPlanOption]
    source: Literal["ai", "fallback"]
    # The season the plan was generated for — the explicitly requested one, or
    # the auto-detected current season when the client omitted it.
    season: str = ""
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
    # Full planner option (crop plan details as shown to the farmer) — stored
    # on the created crop_cycle so the AI-plan dashboard can re-render it.
    planDetails: dict | None = None


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
    # Richer clinical readout (optional so scans stored before this change
    # still validate).
    severity: str = "moderate"  # low | moderate | high
    preventiveCare: str = ""  # cultural / field-hygiene practices
    biologicalControl: str = ""  # biocontrol agents & IPM tactics
    safetyPrecautions: str = ""  # PPE, re-entry & pre-harvest intervals


SCAN_MODES = ("disease", "pest", "nutrient", "weed", "general")


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
