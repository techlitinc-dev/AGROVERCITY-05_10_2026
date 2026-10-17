from typing import Literal

from pydantic import BaseModel, Field

ClaimStatus = Literal[
    "intimated", "surveyorAssigned", "fieldAssessed", "dbtApproved", "disbursed", "rejected"
]

# SOP-15 §6.3 — payouts above ₹50,000 stay in `fieldAssessed` with
# `pending_second_signoff` until a second admin signs the payout approval.
PayoutApprovalStatus = Literal["pending_second_signoff", "approved", "rejected"]


class ClaimTimelineEntry(BaseModel):
    status: str
    at: str
    note: str


class InsuranceClaimRecord(BaseModel):
    id: str
    claimNumber: str
    policyId: str
    cropName: str
    calamityType: str
    dateOfDamage: str
    cropStage: str
    estimatedLossPercent: float
    requestedAmount: float
    approvedAmount: float | None = None
    status: ClaimStatus
    statusText: str
    surveyorName: str | None = None
    surveyorPhone: str | None = None
    surveyorVisitDate: str | None = None
    gpsCoordinates: str
    village: str
    damagePhotos: list[str]
    submittedAt: str
    dbtTransactionId: str | None = None
    bankAccountLast4: str | None = None
    appealCount: int = 0
    rejectionReason: str | None = None
    payoutApprovalStatus: PayoutApprovalStatus | None = None
    payoutApprovalId: str | None = None
    payoutApprovedBy: str | None = None
    timeline: list[ClaimTimelineEntry] = []


class AppealIn(BaseModel):
    reason: str = Field(min_length=10, max_length=1000)
    photos: list[str] = []


class PayoutApprovalRequestIn(BaseModel):
    notes: str | None = None
