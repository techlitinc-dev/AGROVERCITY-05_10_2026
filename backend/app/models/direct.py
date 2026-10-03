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


class QcIn(BaseModel):
    grade: Literal["A", "B", "C"]
    acceptedQty: float = Field(ge=0)
    rejectedQty: float = Field(ge=0)
    note: str = ""


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
