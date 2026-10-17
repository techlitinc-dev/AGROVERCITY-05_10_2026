from typing import Literal

from pydantic import BaseModel, Field


class WishlistItemRequest(BaseModel):
    productId: str


class CouponValidateRequest(BaseModel):
    code: str
    cartTotal: int = Field(ge=0)


class ReturnRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class OrderStatusPatch(BaseModel):
    status: str
    note: str = ""


class UserProductCreate(BaseModel):
    title: str
    category: str
    brand: str = ""
    vernacularTitle: str = ""
    description: str = ""
    mrp: int = Field(gt=0)
    discountedPrice: int = Field(gt=0)
    stock: int = Field(default=0, ge=0)
    unit: str = ""
    imageUrl: str = ""
    batchNo: str = ""


class UserProductUpdate(BaseModel):
    title: str | None = None
    category: str | None = None
    brand: str | None = None
    vernacularTitle: str | None = None
    description: str | None = None
    mrp: int | None = Field(default=None, gt=0)
    discountedPrice: int | None = Field(default=None, gt=0)
    stock: int | None = Field(default=None, ge=0)
    unit: str | None = None
    imageUrl: str | None = None
    batchNo: str | None = None


class SubscriptionUpdateIn(BaseModel):
    status: Literal["paused", "active"] | None = None
    qtyKg: float | None = Field(default=None, gt=0)
    deliveryWindow: str | None = None
