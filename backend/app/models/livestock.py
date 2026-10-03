from typing import Any, Literal
from pydantic import BaseModel, Field


# --- Legacy / Baseline Compatibility Models ---

class GaushalaItem(BaseModel):
    id: str
    name: str
    trustName: str
    address: str
    district: str
    distanceKm: float
    cowCount: int
    breeds: list[str]
    phone: str
    providesOrganicManure: bool
    offersCowAdoption: bool
    rating: float
    facilities: str


class ManureOrderIn(BaseModel):
    product: str = Field(min_length=1, max_length=100)
    quantity: str = Field(min_length=1, max_length=50)


class PlantNursery(BaseModel):
    id: str
    name: str
    ownerName: str
    location: str
    distanceKm: float
    phone: str
    rating: float
    isGovtCertified: bool
    availableSaplings: list[str]
    priceRange: str


class VetDoctor(BaseModel):
    id: str
    name: str
    qualification: str
    specialization: str
    clinicAddress: str
    distanceKm: float
    phone: str
    experienceYears: int
    consultationFeeRupees: int
    rating: float
    availableForFarmVisit: bool
    nextAvailableSlot: str
    emergencyAvailable: bool = False


class VetBookIn(BaseModel):
    visitType: Literal["farm", "clinic"]
    slot: str = Field(min_length=1, max_length=100)
    animalType: str = Field(min_length=1, max_length=50)


class DairyProductItem(BaseModel):
    id: str
    title: str
    farmName: str
    category: str
    price: int
    rating: float
    unit: str
    reviewsCount: int
    purityCertification: str
    inStock: bool
    description: str


class DairyOrderIn(BaseModel):
    quantity: int = Field(ge=1)


# --- Full-Fledged Cattle, Dairy, Gaushala & Doctor System Models ---

class AnimalIn(BaseModel):
    tagId: str = Field(min_length=3, max_length=20)
    name: str = Field(min_length=1, max_length=100)
    species: Literal["cow", "buffalo", "goat"] = "cow"
    breed: str = Field(min_length=1, max_length=80)
    gender: Literal["female", "male"] = "female"
    ageMonths: int = Field(ge=0, le=360)
    lactationStatus: Literal["lactating", "dry", "pregnant", "heifer", "calf"] = "lactating"
    lactationCycle: int = Field(default=1, ge=0, le=20)
    dailyYieldLiters: float = Field(default=0.0, ge=0.0)
    sire: str = ""
    dam: str = ""
    healthStatus: Literal["healthy", "under_treatment", "quarantined"] = "healthy"
    ownerType: Literal["farmer", "gaushala", "dairy"] = "farmer"
    photoUrl: str = ""
    gaushalaId: str | None = None


class Animal(BaseModel):
    id: str
    tagId: str
    name: str
    species: str
    breed: str
    gender: str
    ageMonths: int
    lactationStatus: str
    lactationCycle: int
    dailyYieldLiters: float
    sire: str = ""
    dam: str = ""
    healthStatus: str
    ownerType: str
    ownerId: str
    ownerName: str
    photoUrl: str = ""
    gaushalaId: str = ""
    cattleStatus: str = ""
    events: list = Field(default_factory=list)
    createdAt: str


class AnimalYieldLogIn(BaseModel):
    date: str
    shift: Literal["morning", "evening"]
    yieldLiters: float = Field(gt=0)
    fatPercent: float = Field(default=4.0, ge=1.0, le=15.0)
    snfPercent: float = Field(default=8.5, ge=4.0, le=15.0)
    notes: str = ""


class AnimalYieldLog(BaseModel):
    id: str
    animalId: str
    tagId: str
    date: str
    shift: str
    yieldLiters: float
    fatPercent: float
    snfPercent: float
    notes: str
    loggedAt: str


class MilkCollectionIn(BaseModel):
    farmerId: str = ""
    farmerName: str = Field(min_length=1, max_length=100)
    farmerCode: str = Field(min_length=1, max_length=20)
    farmerPhone: str = ""
    date: str
    shift: Literal["morning", "evening"]
    milkType: Literal["cow", "buffalo"] = "cow"
    liters: float = Field(gt=0, le=2000)
    fatPercent: float = Field(ge=2.0, le=14.0)
    snfPercent: float = Field(ge=6.0, le=14.0)
    clr: float = Field(default=28.0, ge=15.0, le=40.0)
    memberId: str | None = None
    quality: dict | None = None


class MilkCollection(BaseModel):
    id: str
    dairyId: str
    dairyName: str
    farmerId: str
    farmerName: str
    farmerCode: str
    farmerPhone: str
    date: str
    shift: str
    milkType: str
    liters: float
    fatPercent: float
    snfPercent: float
    clr: float
    ratePerLiter: float
    totalAmount: float
    slipNumber: str
    status: str
    recordedAt: str
    rateChartId: str = ""


class RateChartCalcIn(BaseModel):
    milkType: Literal["cow", "buffalo"] = "cow"
    fatPercent: float = Field(ge=2.0, le=14.0)
    snfPercent: float = Field(ge=6.0, le=14.0)
    liters: float = Field(default=1.0, gt=0)


class RateChartCalcOut(BaseModel):
    milkType: str
    fatPercent: float
    snfPercent: float
    liters: float
    ratePerLiter: float
    totalAmount: float
    baseRate: float
    fatPremium: float
    snfPremium: float
    formula: str


class MilkProcurementSummary(BaseModel):
    date: str
    totalMorningLiters: float
    totalEveningLiters: float
    totalLiters: float
    avgFat: float
    avgSnf: float
    totalPayoutAmount: float
    collectionsCount: int


class BreedingCycleIn(BaseModel):
    animalId: str
    animalTagId: str
    animalName: str
    heatDate: str
    aiDate: str
    semenStrawId: str
    bullBreed: str
    technicianName: str
    species: Literal["cow", "buffalo"] = "cow"
    notes: str = ""


class BreedingCycle(BaseModel):
    id: str
    animalId: str
    animalTagId: str
    animalName: str
    heatDate: str
    aiDate: str
    semenStrawId: str
    bullBreed: str
    technicianName: str
    species: str
    pregnancyCheckDueDate: str
    pregnancyStatus: str
    expectedCalvingDate: str
    actualCalvingDate: str = ""
    calfGender: str = ""
    status: str
    notes: str
    createdAt: str


class VetRecordIn(BaseModel):
    farmerId: str = ""
    farmerName: str = Field(min_length=1, max_length=100)
    animalTagId: str
    animalName: str
    species: str = "cow"
    visitDate: str
    visitType: Literal["clinic", "farm", "teleconsultation"] = "clinic"
    temperatureF: float = Field(default=101.5, ge=95.0, le=110.0)
    symptoms: list[str] = Field(default_factory=list)
    diagnosis: str = Field(min_length=1, max_length=200)
    clinicalNotes: str = ""
    prescriptions: list[dict[str, Any]] = Field(default_factory=list)
    withdrawalPeriodDays: int = Field(default=0, ge=0)
    feeCharged: int = Field(default=0, ge=0)


class VetRecord(BaseModel):
    id: str
    vetId: str
    vetName: str
    farmerId: str
    farmerName: str
    animalTagId: str
    animalName: str
    species: str
    visitDate: str
    visitType: str
    temperatureF: float
    symptoms: list[str]
    diagnosis: str
    clinicalNotes: str
    prescriptions: list[dict[str, Any]]
    withdrawalPeriodDays: int
    feeCharged: int
    createdAt: str


class VaccinationScheduleIn(BaseModel):
    animalTagId: str
    animalName: str
    disease: Literal["FMD", "HS", "BQ", "Brucellosis", "Lumpy_Skin", "Deworming"]
    vaccineName: str
    batchNumber: str = ""
    administeredDate: str
    administeredBy: str = ""


class VaccinationSchedule(BaseModel):
    id: str
    animalTagId: str
    animalName: str
    disease: str
    vaccineName: str
    batchNumber: str
    administeredDate: str
    nextDueDate: str
    administeredBy: str
    status: str
    createdAt: str


class CowAdoptionIn(BaseModel):
    gaushalaId: str
    gaushalaName: str = ""
    cowTagId: str
    cowName: str
    donorName: str = Field(min_length=1, max_length=100)
    donorPhone: str = Field(min_length=8, max_length=20)
    donorCity: str = ""
    tier: Literal["gau_gras", "gau_seva", "purna_dattak", "lifetime"] = "gau_gras"
    amountInr: int = Field(ge=500)
    billingCycle: Literal["monthly", "annual", "one_time"] = "monthly"


class CowAdoption(BaseModel):
    id: str
    gaushalaId: str
    gaushalaName: str
    cowTagId: str
    cowName: str
    donorId: str
    donorName: str
    donorPhone: str
    donorCity: str
    tier: str
    amountInr: int
    billingCycle: str
    startDate: str
    endDate: str
    status: str
    certificateNumber: str
    createdAt: str


class FodderDonationIn(BaseModel):
    gaushalaId: str
    donorName: str = Field(min_length=1, max_length=100)
    donorPhone: str = ""
    donationType: Literal["green_fodder", "dry_fodder", "mineral_mixture", "cash_seva"] = "green_fodder"
    quantityDescription: str = "१ ट्रॉली हिरवा चारा"
    amountInr: int = Field(ge=100)


class FodderDonation(BaseModel):
    id: str
    gaushalaId: str
    donorId: str
    donorName: str
    donorPhone: str
    donationType: str
    quantityDescription: str
    amountInr: int
    receiptNumber: str
    createdAt: str


class PanchagavyaProductIn(BaseModel):
    gaushalaId: str = ""
    title: str = Field(min_length=1, max_length=120)
    vernacularTitle: str = ""
    category: Literal["compost", "dung_cakes", "gomutra_ark", "panchagavya_tonic", "ghee", "dhoop"] = "compost"
    price: int = Field(ge=10)
    unit: str = "kg"
    stockQuantity: int = Field(default=50, ge=0)
    description: str = ""
    imageUrl: str = ""


class PanchagavyaProduct(BaseModel):
    id: str
    gaushalaId: str
    title: str
    vernacularTitle: str
    category: str
    price: int
    unit: str
    inStock: bool
    stockQuantity: int
    description: str
    imageUrl: str
    createdAt: str
