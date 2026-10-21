from typing import Literal
from pydantic import BaseModel, Field


class NurseryProfileUpdate(BaseModel):
    nurseryName: str
    ownerName: str
    phone: str = ""
    email: str | None = None
    address: str = ""
    district: str = ""
    state: str = ""
    pincode: str = ""
    registrationNo: str = ""
    licenseNo: str = ""
    bankAccount: str = ""
    ifscCode: str = ""
    settlementUpi: str = ""
    deliveryRadiusKm: int = 50
    specializations: list[str] = []
    documentUrls: list[str] = []
    logoUrl: str | None = None
    bannerUrl: str | None = None


class NurseryPlantCreate(BaseModel):
    title: str
    species: str
    variety: str = ""
    category: Literal["fruit", "timber", "ornamental", "medicinal", "vegetables", "flowering"] = "fruit"
    plantAge: str = "1 year"
    plantHeight: str = "2 ft"
    mrp: float = Field(gt=0)
    price: float = Field(gt=0)
    stock: int = Field(default=0, ge=0)
    unit: str = "sapling"
    minOrderQty: int = 1
    description: str = ""
    imageUrl: str = ""
    status: Literal["active", "draft", "out_of_stock"] = "active"


class NurseryPlantUpdate(BaseModel):
    title: str | None = None
    species: str | None = None
    variety: str | None = None
    category: Literal["fruit", "timber", "ornamental", "medicinal", "vegetables", "flowering"] | None = None
    plantAge: str | None = None
    plantHeight: str | None = None
    mrp: float | None = Field(default=None, gt=0)
    price: float | None = Field(default=None, gt=0)
    stock: int | None = Field(default=None, ge=0)
    unit: str | None = None
    minOrderQty: int | None = None
    description: str | None = None
    imageUrl: str | None = None
    status: Literal["active", "draft", "out_of_stock"] | None = None


class NurseryBatchCreate(BaseModel):
    batchNo: str
    plantId: str
    species: str
    propagationDate: str
    initialCount: int = Field(gt=0)
    currentStock: int | None = None
    nurseryBed: str = ""
    notes: str = ""


class NurseryStockOutRequest(BaseModel):
    quantity: int = Field(gt=0)
    reason: Literal["dispatch", "mortality", "damaged", "sample", "internal_use"] = "mortality"
    notes: str = ""


class NurseryOrderStatusUpdate(BaseModel):
    status: Literal["accepted", "packed", "dispatched", "delivered", "cancelled"]
    trackingNumber: str = ""
    courierName: str = ""
    notes: str = ""


class NurseryOfferCreate(BaseModel):
    code: str
    title: str
    discountPct: float = Field(gt=0, le=90)
    minOrderAmount: float = 0.0
    maxDiscountAmount: float = 500.0
    validUntil: str
    bannerUrl: str = ""


class NurseryPayoutRequest(BaseModel):
    amount: float = Field(gt=0)
    settlementUpi: str = ""
    notes: str = ""
