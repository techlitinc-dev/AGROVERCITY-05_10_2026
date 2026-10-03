from typing import Literal

from pydantic import BaseModel, Field

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
