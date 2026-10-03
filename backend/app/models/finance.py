from typing import Literal

from pydantic import BaseModel, Field


class CreditScoreOut(BaseModel):
    kisanCreditScore: int
    creditTier: str
    creditLimit: float
    factors: list[str]


class LoanCalcIn(BaseModel):
    amount: float = Field(ge=5000, le=50000)
    tenureMonths: int = Field(ge=3, le=12)
    interestRate: float = 7


class LoanCalcOut(BaseModel):
    emi: float
    totalInterest: float
    totalPayable: float


class KccOut(BaseModel):
    bankName: str
    cardNumberMasked: str
    kccLimit: float
    availableLimit: float


class LoanApplyIn(BaseModel):
    amount: float = Field(gt=0)
    tenureMonths: int = Field(ge=3, le=12)
    purpose: str
    bankAccountId: str | None = None


class LoanApplyOut(BaseModel):
    applicationId: str
    status: str


class LoanApplicationOut(BaseModel):
    applicationId: str
    amount: float
    tenureMonths: int
    purpose: str
    status: Literal["submitted", "underReview", "approved", "disbursed", "rejected"]
    createdAt: str
