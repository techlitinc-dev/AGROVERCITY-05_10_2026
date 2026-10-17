from typing import Literal
from pydantic import BaseModel, Field

DealStatus = Literal["negotiating", "contract_issued", "accepted", "in_transit", "completed", "cancelled", "expired"]
LeadType = Literal["farmer", "buyer", "trader"]
LeadStatus = Literal["active", "contacted", "negotiating", "converted", "dropped"]
EvidenceKind = Literal[
    "photo", "weighbridge", "loading", "delivery", "damage",
    # B4: typed deal-document vault
    "weigh_slip", "quality_report", "payment_proof",
]
VAULT_KINDS = ("weigh_slip", "quality_report", "payment_proof")
# B4: each typed vault kind is capped separately from the general evidence pool
MAX_VAULT_PER_KIND = 5

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
    # P0-6 (C5/F6): MPIN e-sign on accept. The gate applies only when the
    # accepting farmer has an MPIN on file (mpinHash) — farmers without an MPIN
    # accept with a recorded consentTimestamp instead.
    mpin: str | None = None
    signatureData: str | None = None
    consentTimestamp: str | None = None


MilestoneType = Literal["departed", "arrived", "loading", "in_transit", "weighed", "delivered"]


class MilestoneCreate(BaseModel):
    """P1-9 (F9/B9): event-based delivery milestones — no GPS telemetry."""

    type: MilestoneType
    note: str = ""
    at: str | None = None  # ISO-8601; defaults to now
    weightKg: float | None = None  # P1-9/E6: only meaningful on "weighed"


class VehicleUpdate(BaseModel):
    """P1-12 (B8): vehicle & pickup details. The full plate is stored; every
    deal serializer masks it ("MH 12 •• 3456")."""

    vehicleType: str
    vehicleNumber: str
    driverName: str


class BuyerRequirementCreate(BaseModel):
    commodity: str
    quantityQuintals: float = Field(gt=0)
    targetRate: float = Field(gt=0)
    location: str = ""
    notes: str = ""

class DealCancelRequest(BaseModel):
    reason: str = ""


class DealDisputeCreate(BaseModel):
    """C9/WS-05 step 9: a deal dispute — category + reason (either party)."""

    category: str  # "payment" | "quality" | "delivery" | "other"
    reason: str = ""

class EvidenceEntry(BaseModel):
    id: str
    blobPath: str
    kind: EvidenceKind
    uploadedBy: str
    createdAt: str
