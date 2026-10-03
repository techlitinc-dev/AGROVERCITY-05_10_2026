from typing import Literal
from pydantic import BaseModel, Field


class ColdStorageChamber(BaseModel):
    id: str
    name: str
    chamberType: str = "cold_storage"  # cold_storage, dry_godown, silo
    capacityMT: float
    currentOccupancyMT: float = 0.0
    tempRange: str = "2-8°C"
    status: str = "active"


class ColdStorageFacility(BaseModel):
    id: str
    name: str
    ownerUid: str | None = None
    managerName: str | None = None
    contactPhone: str | None = None
    address: str | None = None
    district: str = "Nashik"
    state: str = "Maharashtra"
    facilityType: str = "cold_storage"
    distanceKm: float = 0.0
    tempRange: str = "2-8°C"
    availableMT: float
    bookedQuintals: float = 0.0
    ratePerQuintalMonth: float
    wdraRegistered: bool = True
    wdraRegNo: str | None = None
    supportedCrops: list[str] = Field(
        default_factory=lambda: [
            "Onion",
            "Potato",
            "Apple",
            "Grapes",
            "Pomegranate",
            "Wheat",
            "Paddy",
            "Garlic",
            "Spices",
        ]
    )
    chambers: list[ColdStorageChamber] = Field(default_factory=list)


class CreateChamberIn(BaseModel):
    name: str = Field(min_length=1)
    chamberType: str = "cold_storage"  # cold_storage, dry_godown, godown, silo
    capacityMT: float = Field(gt=0)
    tempRange: str = "2-8°C"
    status: str = "active"


class CreateFacilityIn(BaseModel):
    name: str = Field(min_length=2)
    facilityType: str = "cold_storage"  # cold_storage, dry_godown, godown, silo, warehouse
    capacityMT: float = Field(gt=0)
    ratePerQuintalMonth: float = Field(gt=0, default=50.0)
    address: str | None = None
    district: str = "Nashik"
    state: str = "Maharashtra"
    managerName: str | None = None
    contactPhone: str | None = None
    tempRange: str = "2-8°C"
    wdraRegistered: bool = True
    wdraRegNo: str | None = None
    distanceKm: float = 0.0
    supportedCrops: list[str] = Field(
        default_factory=lambda: [
            "Onion",
            "Potato",
            "Apple",
            "Grapes",
            "Pomegranate",
            "Wheat",
            "Paddy",
            "Garlic",
            "Spices",
            "Pulses",
            "Maize",
        ]
    )
    chambers: list[CreateChamberIn] = Field(default_factory=list)


class ColdStorageBookIn(BaseModel):
    quantityQuintals: float = Field(gt=0)
    fromDate: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    months: int = Field(ge=1, le=12)


class ColdStorageApplyIn(BaseModel):
    cropName: str = "Produce"
    variety: str | None = None
    quantityQuintals: float = Field(gt=0)
    fromDate: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    months: int = Field(ge=1, le=12, default=1)
    packagingType: str = "Jute Bags"
    bagsCount: int | None = None
    notes: str | None = None
    estimatedValueRupees: float | None = None
    requestedChamberType: str = "cold_storage"


class BookingReviewIn(BaseModel):
    action: Literal["approve", "reject"]
    notes: str | None = None
    rejectionReason: str | None = None
    allocatedChamberId: str | None = None


class GateInwardIn(BaseModel):
    chamberId: str | None = None
    lotNumber: str | None = None
    grossWeightKg: float = Field(gt=0)
    tareWeightKg: float = Field(ge=0, default=0.0)
    netQuintals: float = Field(gt=0)
    actualBags: int = Field(gt=0)
    moisturePercent: float | None = None
    qcGrade: str = "Grade A"
    valuationRupees: float | None = None


class ReleaseRequestIn(BaseModel):
    requestedQuintals: float = Field(gt=0)
    pickupDate: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    vehicleNumber: str | None = None
    notes: str | None = None


class GateReleaseIn(BaseModel):
    releaseQuintals: float = Field(gt=0)
    vehicleNumber: str | None = None
    driverName: str | None = None
    gatePassRemarks: str | None = None
    amountPaid: float = 0.0


class WarehouseReceipt(BaseModel):
    receiptNumber: str
    bookingId: str
    facilityId: str
    facilityName: str
    wdraRegNo: str | None = None
    depositorName: str
    depositorPhone: str
    cropName: str
    variety: str | None = None
    netQuintals: float
    bagsCount: int
    qcGrade: str
    moisturePercent: float | None = None
    chamberName: str
    lotNumber: str
    valuationRupees: float
    issueDate: str
    pledgeFinancingEligible: bool = True
    status: str = "active"


class ColdStorageProviderStats(BaseModel):
    totalCapacityMT: float
    occupiedMT: float
    availableMT: float
    occupancyPercent: float
    pendingBookingsCount: int
    activeStoredLotsCount: int
    totalFarmersCount: int
    totalAccruedRent: float
    totalValuationStored: float
