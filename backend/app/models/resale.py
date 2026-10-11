from typing import Literal

from pydantic import BaseModel, Field


class StockCreate(BaseModel):
    crop: str
    quantityQuintals: float = Field(gt=0)
    ratePerQuintal: float = Field(gt=0)
    grade: Literal["A", "B", "C"] | None = None
    variety: str = ""
    location: str | None = None
    storedAt: str | None = None
    purchasedAt: str | None = None


class StockAdjust(BaseModel):
    deltaQuintals: float
    reason: str = Field(min_length=1)


class ResaleListingCreate(BaseModel):
    stockId: str
    quantityQuintals: float = Field(gt=0)
    askingRatePerQuintal: float = Field(gt=0)
    minQtyPerBuyer: float | None = Field(default=None, gt=0)
    deliveryTerms: Literal["exWarehouse", "delivered"] = "exWarehouse"
    paymentTermsDays: int = Field(default=0, ge=0, le=120)
    packing: str | None = None
    availableUntil: str | None = None
    location: str | None = None


class ResaleListingBook(BaseModel):
    quantityQuintals: float | None = Field(default=None, gt=0)
    requiredDate: str | None = None
    deliveryAddress: str | None = None
