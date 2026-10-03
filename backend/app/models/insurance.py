from typing import Literal

from pydantic import BaseModel, Field


class CropInsurancePolicy(BaseModel):
    id: str
    policyNumber: str
    schemeName: str
    cropName: str
    season: str
    year: int
    landAreaAcres: float
    sumInsured: float
    farmerPremium: float
    govtSubsidy: float
    status: str
    insuranceCompany: str
    coverageStartDate: str
    coverageEndDate: str
    bankName: str
    kccAccountNo: str
    certificateUrl: str | None = None
    userId: str | None = None
    farmerName: str | None = None
    farmerPhone: str | None = None
    village: str | None = None
    district: str | None = None
    state: str | None = None
    category: str | None = "crop"
    khasraNumber: str | None = None
    sowingDate: str | None = None
    riskScore: int | None = None
    riskCategory: str | None = None
    appliedAt: str | None = None
    reviewedAt: str | None = None
    reviewedBy: str | None = None
    rejectionReason: str | None = None
    underwriterNotes: str | None = None


class PolicyApplyIn(BaseModel):
    cropName: str
    season: Literal["Kharif", "Rabi", "Annual"]
    landAreaAcres: float = Field(gt=0)
    category: Literal["crop", "livestock", "weather", "equipment"] = "crop"
    schemeName: str | None = "PMFBY"
    khasraNumber: str | None = None
    sowingDate: str | None = None
    animalTagId: str | None = None
    equipmentModel: str | None = None


class CropPremiumRate(BaseModel):
    id: str
    cropName: str
    category: str
    season: str
    sumInsuredPerAcre: float
    farmerSharePercent: float
    totalActuarialRatePercent: float
    cutoffDate: str


class PolicyReviewIn(BaseModel):
    action: Literal["approve", "reject"]
    rejectionReason: str | None = None
    underwriterNotes: str | None = None
    insuranceCompany: str | None = None


class ClaimScheduleSurveyIn(BaseModel):
    surveyorName: str
    surveyorPhone: str
    surveyorVisitDate: str
    notes: str | None = None


class ClaimSurveyReportIn(BaseModel):
    assessedLossPercent: float = Field(ge=0, le=100)
    cropStageVerified: str | None = None
    surveyorNotes: str | None = None


class ClaimReviewIn(BaseModel):
    action: Literal["approve", "reject"]
    approvedAmount: float | None = None
    rejectionReason: str | None = None
    notes: str | None = None


class ClaimDisburseIn(BaseModel):
    dbtTransactionId: str | None = None
    amount: float | None = None
    notes: str | None = None


class RateCreateIn(BaseModel):
    cropName: str
    category: str
    season: Literal["Kharif", "Rabi", "Annual"]
    sumInsuredPerAcre: float = Field(gt=0)
    farmerSharePercent: float = Field(ge=0, le=100)
    totalActuarialRatePercent: float = Field(gt=0, le=100)
    cutoffDate: str


class InsuranceScheme(BaseModel):
    id: str
    code: str
    titleEn: str
    titleHi: str
    descriptionEn: str
    descriptionHi: str
    category: str
    premiumShareRules: str
    applicableCrops: list[str]
    cutoffNotice: str
    claimWindowHours: int = 72
