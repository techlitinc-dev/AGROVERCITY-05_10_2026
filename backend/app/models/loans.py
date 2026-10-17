from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.models.finance import LoanApplyIn as LoanApplyInBase

LoanStatus = Literal[
    "submitted",
    "underReview",
    "infoRequested",
    "approved",
    "rejected",
    "disbursed",
    "cancelled",
]


class LoanTimelineEntry(BaseModel):
    status: str
    statusText: str
    note: str | None = None
    at: str
    by: str | None = None


class LoanDocument(BaseModel):
    documentId: str
    name: str
    storagePath: str
    uploadedAt: str
    # phase-03 task 5.13 — collateral reference (e.g. warehouse receipt number)
    # attached by a bank officer; absent on applicant file uploads.
    referenceNo: str | None = None


class LoanApplicationOut(BaseModel):
    applicationId: str
    amount: float
    tenureMonths: int
    purpose: str
    status: LoanStatus
    createdAt: str
    applicationNumber: str | None = None
    userId: str | None = None
    farmerName: str | None = None
    farmerPhone: str | None = None
    farmerCreditScore: int | None = None
    farmerCreditTier: str | None = None
    bankAccountId: str | None = None
    bankAccountLast4: str | None = None
    bankIfsc: str | None = None
    sanctionedAmount: int | None = None
    interestRate: float | None = None
    disbursementRef: str | None = None
    disbursedAt: str | None = None
    rejectionReason: str | None = None
    assignedOfficerId: str | None = None
    assignedOfficerName: str | None = None
    documents: list[LoanDocument] = []
    timeline: list[LoanTimelineEntry] = []
    note: str | None = None
    updatedAt: str | None = None
    # WS-03 task 3.9 — optional partner-bank scope for the referral/origination fee.
    partnerBankId: str | None = None
    # WS-03 task 3.4 — district filter field carried on the application.
    district: str | None = None
    # WS-03 task 3.17 — optional AI prescreen annotation (WS-07 M14).
    ai: dict | None = None


class LoanApplyIn(LoanApplyInBase):
    """Apply payload (`POST /finance/loans/apply`) extended with the WS-03
    optional fields. The base model lives in models/finance.py and is imported
    unchanged; `model_dump()` therefore carries these onto the loan doc."""

    district: str | None = None
    partnerBankId: str | None = None


class ApproveIn(BaseModel):
    sanctionedAmount: int = Field(ge=1)
    interestRate: float = Field(gt=0)
    tenureMonths: int = Field(ge=1)
    note: str | None = None


class RejectIn(BaseModel):
    reason: str = Field(min_length=1)


class InfoRequestIn(BaseModel):
    message: str = Field(min_length=1)


class RespondIn(BaseModel):
    message: str = Field(min_length=1)


class DisburseIn(BaseModel):
    disbursementRef: str = Field(min_length=1)
    disbursedAmount: int | None = None


class LoanScheduleEntry(BaseModel):
    installmentNo: int
    dueDate: str
    emi: int
    principal: int
    interest: int
    outstanding: int


class RepaymentIn(BaseModel):
    """P1-24 — EMI repayment ledger entry (bank-manager scoped). Money is
    integer paise; `mode` is the collection channel; `emiIndex` (1-based
    installment number) gives per-installment idempotency — recording the same
    index twice returns 409 DUPLICATE_EMI."""

    amountPaise: int = Field(ge=1)
    mode: Literal["upi", "nach", "cash", "other"]
    emiIndex: int | None = Field(default=None, ge=1)
    paidAt: str | None = None
    note: str | None = None

    @field_validator("paidAt")
    @classmethod
    def _paid_at_must_be_iso(cls, value: str | None) -> str | None:
        if value is None:
            return value
        try:
            datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            raise ValueError("paidAt must be an ISO-8601 timestamp")
        return value


class LoanRepaymentOut(BaseModel):
    repaymentId: str
    applicationId: str
    amountPaise: int
    mode: str
    emiIndex: int | None = None
    paidAt: str
    note: str | None = None
    recordedAt: str
    # cumulative amount repaid across the ledger up to and including this entry
    runningPaidPaisa: int
