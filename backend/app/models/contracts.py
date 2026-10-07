from typing import Literal

from pydantic import BaseModel, Field


class ContractSchedule(BaseModel):
    startDate: str
    endDate: str
    frequency: Literal["weekly", "biweekly", "monthly"]
    qtyPerDelivery: float = Field(gt=0)


class ContractOut(BaseModel):
    id: str
    buyerCompany: str
    buyerRating: float
    crop: str
    lockedRateQuintal: float
    mspCurrentRate: float
    premiumAboveMSP: str
    minQuantityQuintals: float
    deliveryLocation: str
    paymentTerms: str
    status: str
    contractDuration: str
    termsText: str | None = None
    acceptedBy: str | None = None
    # targeted supply contracts (P8/P10) — all optional so legacy seed docs validate
    title: str | None = None
    buyerId: str | None = None
    farmerId: str | None = None
    quantityTotal: float | None = None
    priceType: Literal["fixed", "mandiLinked"] | None = None
    baseRate: float | None = None
    premiumPerQuintal: float | None = None
    mandiName: str | None = None
    schedule: ContractSchedule | None = None
    paymentTermsDays: int | None = None
    deliveriesGenerated: int | None = None
    deliveries: list | None = None
    cancelReason: str | None = None
    declineReason: str | None = None
    acceptedAt: str | None = None
    currentPrice: float | None = None
    specId: str | None = None
    specSnapshot: dict | None = None


class ContractCreate(BaseModel):
    farmerId: str
    crop: str
    title: str = ""
    quantityTotal: float = Field(gt=0)
    priceType: Literal["fixed", "mandiLinked"] = "fixed"
    baseRate: float | None = None
    premiumPerQuintal: float = 0
    mandiName: str = ""
    schedule: ContractSchedule
    deliveryLocation: str = ""
    paymentTermsDays: int = 0
    termsText: str = ""
    specId: str | None = None
    specSnapshot: dict | None = None


class ContractUpdate(BaseModel):
    crop: str | None = None
    title: str | None = None
    quantityTotal: float | None = Field(default=None, gt=0)
    priceType: Literal["fixed", "mandiLinked"] | None = None
    baseRate: float | None = None
    premiumPerQuintal: float | None = None
    mandiName: str | None = None
    schedule: ContractSchedule | None = None
    deliveryLocation: str | None = None
    paymentTermsDays: int | None = None
    termsText: str | None = None


class ContractDecline(BaseModel):
    reason: str = ""


class ContractCancel(BaseModel):
    reason: str = ""


class DeliveryCreate(BaseModel):
    slotDate: str


class AcceptContractRequest(BaseModel):
    signatureData: str
    consentTimestamp: str
    mpin: str


class AcceptContractResponse(BaseModel):
    ok: bool
    status: str
    contractId: str
