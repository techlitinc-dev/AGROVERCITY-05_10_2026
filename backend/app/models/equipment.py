from pydantic import BaseModel, Field


class EquipmentOut(BaseModel):
    id: str
    name: str
    type: str
    ownerType: str
    hourlyRate: float
    perAcreRate: float | None = None
    distanceKm: float
    ratingAvg: float | None = None
    ratingCount: int = 0


class SlotOut(BaseModel):
    id: str
    equipmentId: str
    date: str
    slotName: str
    duration: str
    status: str
    bookedByName: str | None = None
    priceRupees: float
    recommendedTask: str


class EquipmentUpsertRequest(BaseModel):
    name: str
    type: str
    ownerType: str = "private"
    hourlyRate: float
    perAcreRate: float | None = None
    slotTemplate: list[dict] | None = None
    rcDocUrl: str | None = None
    insuranceDocUrl: str | None = None
    # E3: hours-based or date-based service schedule, e.g.
    # {"everyHours": 250, "nextServiceDate": "2026-12-01"}
    serviceSchedule: dict | None = None
    # E1: document expiry dates drive the mid-season booking gate + reminders
    insuranceExpiry: str | None = None
    rcExpiry: str | None = None
    # WS-04 step 6: pricing engine — {"hourly": 850, "perAcre": 1400,
    # "package": {"fullDay": 6000, "sowingSeason": 25000}}
    pricing: dict | None = None


class EquipmentQuoteIn(BaseModel):
    mode: str  # "hourly" | "perAcre" | "package"
    hours: float = 0
    acres: float = 0
    packageName: str | None = None


class MaintenanceLogIn(BaseModel):
    date: str
    hoursAtService: float = 0
    costRupees: float = 0
    partsReplaced: str = ""
    notes: str = ""


class BookSlotRequest(BaseModel):
    farmerName: str


class RejectEquipmentBookingRequest(BaseModel):
    reason: str = Field(min_length=3)


class EquipmentCounterQuoteIn(BaseModel):
    revisedRateRupees: float = Field(gt=0)
    rateType: str = "hourly"
    reason: str = ""
    validityHours: int = 48


class JobExecutionUpdateIn(BaseModel):
    jobStatus: str
    notes: str = ""
    evidencePhotoUrl: str | None = None
    hoursLogged: float | None = None
    acresCovered: float | None = None


class CheckInPinIn(BaseModel):
    lat: float
    lng: float
    label: str = ""
    event: str = "dispatch"  # "dispatch" | "return" | free-form event name


class DamageClaimIn(BaseModel):
    bookingId: str
    equipmentId: str
    incidentDate: str
    description: str
    estimatedRepairCostRupees: float = Field(gt=0)
    photoEvidenceUrls: list[str] = []
    # E5: damage-deposit claim in integer paisa with before/after photos.
    claimPaisa: int | None = Field(default=None, gt=0)
    beforePhotoUrls: list[str] = []
    afterPhotoUrls: list[str] = []
