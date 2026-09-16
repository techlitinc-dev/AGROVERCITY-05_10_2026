from pydantic import BaseModel


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


class AcceptContractRequest(BaseModel):
    signatureData: str
    consentTimestamp: str
    mpin: str


class AcceptContractResponse(BaseModel):
    ok: bool
    status: str
    contractId: str
