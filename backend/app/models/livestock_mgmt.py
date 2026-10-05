from typing import Any, Literal
from pydantic import BaseModel, Field


# --- Dairy management ---

class DairyMemberIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str = ""
    village: str = ""
    farmerUid: str = ""
    memberCode: str = ""
    bankDetails: dict[str, Any] = Field(default_factory=dict)
    defaultSpecies: Literal["cow", "buffalo"] = "cow"
    deduction: float = Field(default=0.0, ge=0.0)
    status: Literal["active", "inactive"] = "active"


class DairyAgentIn(BaseModel):
    uid: str = Field(min_length=1)
    name: str = Field(min_length=1, max_length=120)
    phone: str = ""
    routeIds: list[str] = Field(default_factory=list)


class RateChartIn(BaseModel):
    species: Literal["cow", "buffalo"] = "cow"
    effectiveFrom: str
    baseRate: float = Field(gt=0)
    fatBase: float = Field(gt=0)
    snfBase: float = Field(gt=0)
    fatStep: float = Field(default=1.0, ge=0)
    snfStep: float = Field(default=1.0, ge=0)
    minRate: float = Field(default=0.0, ge=0)
    minFat: float = Field(default=0.0, ge=0)
    minSnf: float = Field(default=0.0, ge=0)
    active: bool = False


class PaymentBatchGenerateIn(BaseModel):
    periodFrom: str
    periodTo: str


class PaymentBatchMarkPaidIn(BaseModel):
    payoutRef: str = ""


class MilkSaleCustomerIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str = ""
    type: Literal["household", "shop", "hotel"] = "household"
    address: str = ""
    route: str = ""
    dailyLitersAM: float = Field(default=0.0, ge=0.0)
    dailyLitersPM: float = Field(default=0.0, ge=0.0)
    ratePerLiter: float = Field(gt=0)
    status: Literal["active", "inactive"] = "active"


class MilkSaleOrderItemIn(BaseModel):
    productId: str = ""
    name: str = Field(min_length=1, max_length=120)
    qty: float = Field(gt=0)
    unitPrice: float = Field(ge=0)


class MilkSaleOrderIn(BaseModel):
    customerId: str
    orderDate: str
    shift: Literal["am", "pm"] = "am"
    liters: float = Field(default=0.0, ge=0.0)
    items: list[MilkSaleOrderItemIn] = Field(default_factory=list)
    amount: float | None = Field(default=None, ge=0.0)


class MilkSaleOrderStatusIn(BaseModel):
    status: Literal["delivered", "billed", "paid"]


class StockItemIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    category: Literal["milk", "curd", "ghee", "paneer", "other"] = "milk"
    unit: str = "liter"
    stockQty: float = Field(default=0.0, ge=0.0)
    unitPrice: float = Field(default=0.0, ge=0.0)
    expiryDate: str = ""


class StockAdjustIn(BaseModel):
    delta: float
    reason: str = Field(min_length=1, max_length=200)


# --- Gaushala management ---

class GaushalaProfileIn(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    trustName: str = ""
    address: str = ""
    district: str = ""
    phone: str = ""
    capacity: int = Field(default=0, ge=0)
    certifications: dict[str, Any] = Field(default_factory=dict)
    bankDetails: dict[str, Any] = Field(default_factory=dict)


class CattleEventIn(BaseModel):
    type: Literal["intake", "adopted-out", "deceased", "transferred"]
    note: str = ""
    date: str = ""


class AdoptionStatusIn(BaseModel):
    status: Literal["approved", "rejected", "completed"]


class DonationStatusIn(BaseModel):
    status: Literal["acknowledged", "rejected"]


class GaushalaExpenseIn(BaseModel):
    category: Literal["fodder", "medical", "staff", "utilities", "transport", "other"] = "fodder"
    amount: float = Field(gt=0)
    note: str = ""
    expenseDate: str


# --- Doctor management ---

class VetManagedIn(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    phone: str = Field(min_length=8, max_length=20)
    qualification: str = ""
    specializations: list[str] = Field(default_factory=list)
    clinicAddress: str = ""
    experienceYears: int = Field(default=0, ge=0)
    feeClinic: int = Field(default=0, ge=0)
    feeFarm: int = Field(default=0, ge=0)
    feeTele: int = Field(default=0, ge=0)
    visitTypes: list[str] = Field(default_factory=list)
    serviceDistricts: list[str] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=list)
    vetCouncilRegNo: str = ""
    emergencyAvailable: bool = False
    availableForFarmVisit: bool = True
    # WS-06: credential verification. Records created before this field exists
    # behave as "pending" (the router defaults them on read).
    credentialStatus: Literal["pending", "verified", "rejected"] = "pending"
    credentialDocs: list[str] = Field(default_factory=list)


class VetCredentialIn(BaseModel):
    """Admin credential-verification decision (WS-06); reason is audit-logged."""

    status: Literal["pending", "verified", "rejected"]
    reason: str = Field(min_length=1, max_length=300)


class AppointmentIn(BaseModel):
    vetId: str
    animalId: str = ""
    visitType: Literal["clinic", "farm", "tele"] = "clinic"
    slotDate: str
    slotTime: str
    symptoms: str = ""
    address: str = ""
    fee: float = Field(default=0.0, ge=0.0)


class MedicineIn(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    dosage: str = ""
    frequency: str = ""
    durationDays: int = Field(default=0, ge=0)
    notes: str = ""


class InlinePrescriptionIn(BaseModel):
    diagnosis: str = Field(min_length=1, max_length=300)
    medicines: list[MedicineIn] = Field(default_factory=list)
    advice: str = ""
    milkWithdrawalDays: int = Field(default=0, ge=0)
    followUpDate: str = ""


class AppointmentStatusIn(BaseModel):
    status: Literal["confirmed", "in-progress", "completed", "cancelled"]
    vetNotes: str = ""
    prescription: InlinePrescriptionIn | None = None
    cancelReason: str = ""


class PrescriptionIn(BaseModel):
    animalId: str
    appointmentId: str = ""
    diagnosis: str = Field(min_length=1, max_length=300)
    medicines: list[MedicineIn] = Field(default_factory=list)
    advice: str = ""
    milkWithdrawalDays: int = Field(default=0, ge=0)
    followUpDate: str = ""


class ScheduleSlotIn(BaseModel):
    start: str
    end: str


class ScheduleDayIn(BaseModel):
    day: int = Field(ge=0, le=6)
    slots: list[ScheduleSlotIn] = Field(default_factory=list)


class VetSchedulePutIn(BaseModel):
    weeklySlots: list[ScheduleDayIn] | None = None
    leaves: list[str] | None = None
    emergencyAvailable: bool | None = None
    teleAvailable: bool | None = None


class CampaignIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    vaccine: str = Field(min_length=1, max_length=160)
    disease: str = ""
    fromDate: str
    toDate: str
    targetDistricts: list[str] = Field(default_factory=list)
    status: Literal["upcoming", "active", "closed"] = "upcoming"


class CampaignEnrollIn(BaseModel):
    animalId: str


class CampaignVaccinatedIn(BaseModel):
    animalId: str
