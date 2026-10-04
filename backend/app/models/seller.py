from typing import Literal
from pydantic import BaseModel, Field

PaymentMode = Literal["cash", "upi", "credit", "bank_transfer"]
LedgerType = Literal["credit_sale", "payment_received", "adjustment"]
ProcurementPaymentStatus = Literal["unpaid", "partial", "paid", "udhaar"]

class SaleEntryCreate(BaseModel):
    buyerName: str
    buyerPhone: str = ""
    item: str
    quantity: float = Field(gt=0)
    unit: str = "Quintal"
    ratePerUnit: float = Field(gt=0)
    paymentMode: PaymentMode = "cash"
    amountPaid: float = Field(default=0.0, ge=0)
    mandiFeePct: float = Field(default=0.5, ge=0, le=5)
    notes: str = ""

class BuyerLedgerEntryCreate(BaseModel):
    buyerName: str
    buyerPhone: str = ""
    companyName: str = ""
    type: LedgerType = "payment_received"
    amount: float = Field(gt=0)
    amountPaisa: int | None = Field(default=None, ge=0)
    paymentMode: str = "upi"
    reference: str = ""
    notes: str = ""

class ProcurementLotCreate(BaseModel):
    farmerName: str
    farmerPhone: str = ""
    crop: str
    variety: str = ""
    grossWeightKg: float = Field(gt=0)
    tareWeightKg: float = Field(default=0.0, ge=0)
    netWeightQuintals: float = Field(gt=0)
    ratePerQuintal: float = Field(gt=0)
    qualityDeductionPct: float = Field(default=0.0, ge=0, le=50)
    paymentStatus: ProcurementPaymentStatus = "unpaid"
    paymentMode: str = "bank_transfer"
    weighbridgeSlipNo: str = ""
    weighbridgeSlipUrl: str = ""
    notes: str = ""


class SellerProductCreate(BaseModel):
    title: str
    category: str
    brand: str = ""
    mrp: int = Field(gt=0)
    discountedPrice: int = Field(gt=0)
    stock: int = Field(default=0, ge=0)
    unit: str = ""
    description: str | None = None
    imageUrl: str | None = None


class SellerProductUpdate(BaseModel):
    title: str | None = None
    category: str | None = None
    brand: str | None = None
    mrp: int | None = Field(default=None, gt=0)
    discountedPrice: int | None = Field(default=None, gt=0)
    stock: int | None = Field(default=None, ge=0)
    unit: str | None = None
    description: str | None = None
    imageUrl: str | None = None
