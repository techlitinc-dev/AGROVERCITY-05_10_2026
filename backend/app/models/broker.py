from typing import Literal
from pydantic import BaseModel, Field

DealStatus = Literal["negotiating", "contract_issued", "accepted", "in_transit", "completed", "cancelled"]
LeadType = Literal["farmer", "buyer", "trader"]
LeadStatus = Literal["active", "contacted", "negotiating", "converted", "dropped"]
EvidenceKind = Literal["photo", "weighbridge", "loading", "delivery", "damage"]

class DealCreate(BaseModel):
    buyerName: str
    buyerPhone: str = ""
    buyerCompany: str = ""
    sellerName: str
    sellerPhone: str = ""
    commodity: str
    variety: str = ""
    grade: str = "Grade A"
    quantityQuintals: float = Field(gt=0)
    agreedRate: float = Field(gt=0)
    deliveryLocation: str = ""
    brokerCommissionPct: float = Field(default=2.0, ge=0, le=10)
    paymentTerms: str = "100% Bank Transfer on Delivery"
    notes: str = ""

class DealUpdate(BaseModel):
    status: DealStatus | None = None
    agreedRate: float | None = None
    quantityQuintals: float | None = None
    deliveryLocation: str | None = None
    paymentTerms: str | None = None
    notes: str | None = None

class DealMessageCreate(BaseModel):
    senderRole: Literal["broker", "buyer", "seller"] = "broker"
    senderName: str = ""
    text: str
    amountOffer: float | None = None

class LeadCreate(BaseModel):
    name: str
    phone: str
    type: LeadType = "farmer"
    commodity: str
    quantityExpected: float = 0.0
    targetRate: float = 0.0
    location: str = ""
    notes: str = ""

class LeadUpdate(BaseModel):
    status: LeadStatus | None = None
    targetRate: float | None = None
    quantityExpected: float | None = None
    notes: str | None = None

class RespondRequest(BaseModel):
    action: Literal["accept", "decline"]
    reason: str = ""

class DealCancelRequest(BaseModel):
    reason: str = ""

class EvidenceEntry(BaseModel):
    id: str
    blobPath: str
    kind: EvidenceKind
    uploadedBy: str
    createdAt: str
