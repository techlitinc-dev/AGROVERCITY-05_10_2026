from typing import Literal

from pydantic import BaseModel, Field


class DemandCreate(BaseModel):
    crop: str
    variety: str = ""
    quantity: float = Field(gt=0)
    unit: str = "quintal"
    qualityGrade: Literal["A", "B", "C"] = "A"
    maxPrice: int = Field(ge=0)
    packaging: str = ""
    deliveryLocation: str = ""
    neededBy: str = ""
    frequency: Literal["oneTime", "weekly", "monthly"] = "oneTime"
    notes: str = ""


class DemandUpdate(BaseModel):
    crop: str | None = None
    variety: str | None = None
    quantity: float | None = Field(default=None, gt=0)
    unit: str | None = None
    qualityGrade: Literal["A", "B", "C"] | None = None
    maxPrice: int | None = Field(default=None, ge=0)
    packaging: str | None = None
    deliveryLocation: str | None = None
    neededBy: str | None = None
    frequency: Literal["oneTime", "weekly", "monthly"] | None = None
    notes: str | None = None


class OfferCreate(BaseModel):
    targetType: Literal["demand", "lot"]
    targetId: str
    pricePerUnit: int = Field(gt=0)
    quantity: float = Field(gt=0)
    message: str = ""
    # Richer bid terms (optional, backward compatible).
    pickupDate: str = ""  # YYYY-MM-DD
    paymentTermsDays: int = Field(default=0, ge=0, le=120)
    transportMode: Literal["buyerArranges", "farmerDelivers", "buyerPickup"] = "buyerArranges"


class OfferAccept(BaseModel):
    """Optional accept body: accept a partial quantity of the offered lot."""

    quantity: float | None = Field(default=None, gt=0)


class OfferCounter(BaseModel):
    pricePerUnit: int = Field(gt=0)
    note: str = ""


class PurchaseCreate(BaseModel):
    lotId: str
    quantity: float | None = Field(default=None, gt=0)


class AdvanceIn(BaseModel):
    amount: int = Field(gt=0)
    method: str = ""
    reference: str = ""


class PickupIn(BaseModel):
    date: str
    vehicleType: str = ""
    address: str = ""
    notes: str = ""
    mode: Literal["farmerDelivers", "buyerPicksup"] = "buyerPicksup"
    slot: str = ""


class QcMeasurement(BaseModel):
    name: str
    value: float


class QcIn(BaseModel):
    grade: Literal["A", "B", "C"]
    acceptedQty: float = Field(ge=0)
    rejectedQty: float = Field(ge=0)
    note: str = ""
    measurements: list[QcMeasurement] = Field(default_factory=list)
    photos: list[str] = Field(default_factory=list)


class ResolveIn(BaseModel):
    resolution: str = Field(min_length=1)


class PayIn(BaseModel):
    amount: int = Field(gt=0)
    method: str = ""
    reference: str = ""
    kind: Literal["balance", "full"]


class CancelIn(BaseModel):
    reason: str = ""


class RateIn(BaseModel):
    target: Literal["farmer", "buyer"]
    rating: int = Field(ge=1, le=5)
    review: str = ""


class SavedFarmerIn(BaseModel):
    farmerId: str


class StandingOrderCreate(BaseModel):
    """Standing (recurring) demand order with a price band and calendar window."""

    crop: str
    variety: str = ""
    minPrice: int = Field(ge=0)
    maxPrice: int = Field(gt=0)
    quantityPerSlot: float = Field(gt=0)
    unit: str = "quintal"
    frequency: Literal["daily", "weekly", "monthly"] = "weekly"
    startDate: str  # YYYY-MM-DD
    endDate: str  # YYYY-MM-DD
    serviceArea: dict = Field(default_factory=dict)  # {address, lat?, lng?, radiusKm?}
    deliveryLocation: str = ""
    qualityGrade: Literal["A", "B", "C"] = "A"
    notes: str = ""


class StandingOrderUpdate(BaseModel):
    crop: str | None = None
    variety: str | None = None
    minPrice: int | None = Field(default=None, ge=0)
    maxPrice: int | None = Field(default=None, gt=0)
    quantityPerSlot: float | None = Field(default=None, gt=0)
    unit: str | None = None
    frequency: Literal["daily", "weekly", "monthly"] | None = None
    startDate: str | None = None
    endDate: str | None = None
    serviceArea: dict | None = None
    deliveryLocation: str | None = None
    qualityGrade: Literal["A", "B", "C"] | None = None
    notes: str | None = None
