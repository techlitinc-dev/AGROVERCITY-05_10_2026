from typing import Literal

from pydantic import BaseModel, Field, model_validator


class PlotIn(BaseModel):
    name: str
    village: str
    district: str
    areaAcres: float = Field(gt=0)
    gatNumber: str | None = None
    soilType: str | None = None


class PlotOut(PlotIn):
    id: str
    status: Literal["vacant", "leased"]


class PlotUpdate(BaseModel):
    name: str | None = None
    village: str | None = None
    district: str | None = None
    areaAcres: float | None = Field(None, gt=0)
    gatNumber: str | None = None
    soilType: str | None = None


class LeaseIn(BaseModel):
    plotId: str
    tenantName: str
    tenantPhone: str
    monthlyRentRupees: float = Field(gt=0)
    startDate: str
    endDate: str
    # extension-2026-10-11: profit-share lease support. "fixed" is the legacy
    # monthly-rent model; "cropShare" settles a percentage of declared harvest
    # sale via /land/leases/{id}/harvest-declarations; "hybrid" charges monthly
    # advance rent plus a (smaller) crop share.
    rentModel: Literal["fixed", "cropShare", "hybrid"] = "fixed"
    cropSharePercent: int | None = Field(None, ge=1, le=99)
    advanceRentRupees: float | None = Field(None, ge=0)

    @model_validator(mode="after")
    def _share_model_needs_percent(self):
        if self.rentModel in ("cropShare", "hybrid") and self.cropSharePercent is None:
            raise ValueError("cropSharePercent is required for cropShare/hybrid leases")
        return self


class LeaseOut(LeaseIn):
    id: str
    status: Literal["active", "ended", "terminated"]
    verified: bool = False
    # set when the lease originates from a marketplace lease-request accept
    listingId: str | None = None
    tenantFarmerId: str | None = None


class LeaseUpdate(BaseModel):
    monthlyRentRupees: float | None = Field(None, gt=0)
    endDate: str | None = None
    status: Literal["active", "ended", "terminated"] | None = None
    verified: bool | None = None


class RentPaymentIn(BaseModel):
    amountRupees: float = Field(gt=0)
    month: str = Field(pattern=r"^\d{4}-\d{2}$")
    method: Literal["cash", "upi", "bank"]
    paidAt: str


class RentPaymentOut(RentPaymentIn):
    id: str
    leaseId: str


class LandListingIn(BaseModel):
    village: str
    district: str
    lat: float
    lng: float
    areaAcres: float = Field(gt=0)
    expectedRentRupees: float = Field(gt=0)
    soilType: str | None = None
    waterSource: str | None = None
    plotId: str | None = None


class LandListingOut(LandListingIn):
    id: str
    landlordId: str
    landlordName: str
    status: Literal["open", "leased", "closed"]
    createdAt: str
    qualityAssessment: dict | None = None


class LandListingUpdate(BaseModel):
    village: str | None = None
    district: str | None = None
    lat: float | None = None
    lng: float | None = None
    areaAcres: float | None = Field(None, gt=0)
    expectedRentRupees: float | None = Field(None, gt=0)
    soilType: str | None = None
    waterSource: str | None = None
    status: Literal["open", "closed"] | None = None


class LeaseRequestIn(BaseModel):
    listingId: str
    message: str = ""
    durationMonths: int = Field(ge=1, le=120)


class LeaseRequestOut(LeaseRequestIn):
    id: str
    farmerId: str
    farmerName: str
    farmerPhone: str
    landlordId: str
    status: Literal["pending", "accepted", "rejected", "countered"]
    createdAt: str
    proposedRentRupees: float | None = None
    counterRentRupees: float | None = None
    negotiationRounds: int = 1
    landlordNotes: str | None = None
    compatibilityScore: float | None = None


class RejectRequestIn(BaseModel):
    reason: str = ""


class CounterRequestIn(BaseModel):
    counterRentRupees: float = Field(gt=0)
    note: str = ""
    durationMonths: int | None = Field(None, ge=1, le=120)


class MilestoneUpdateIn(BaseModel):
    milestoneIndex: int = Field(ge=0, le=2)
    status: Literal["pending", "released", "disputed"]
    notes: str = ""


class LeaseEsignIn(BaseModel):
    signatureData: str = Field(..., min_length=1)
    consentTimestamp: str = Field(..., min_length=10)
    mpin: str = Field(..., min_length=4, max_length=4)


class EscrowFundIn(BaseModel):
    razorpayOrderId: str | None = None
    razorpayPaymentId: str | None = None
    razorpaySignature: str | None = None


class MilestoneReleaseIn(BaseModel):
    notes: str | None = Field(None, max_length=500)


# ---- extension-2026-10-11: landlord ops (listing enrichment, leads, lease
# lifecycle, profit management). All shapes are plain JSON over Firestore docs.


class ListingPhotoIn(BaseModel):
    url: str = Field(min_length=1)
    caption: str | None = Field(None, max_length=200)


class AvailabilityWindow(BaseModel):
    fromDate: str = Field(min_length=10)
    toDate: str = Field(min_length=10)
    status: Literal["available", "blocked"] = "available"


class AvailabilityIn(BaseModel):
    windows: list[AvailabilityWindow] = Field(default_factory=list)


class BoostIn(BaseModel):
    days: int = Field(default=7, ge=1, le=30)


class LeadStatusIn(BaseModel):
    status: Literal["new", "contacted", "negotiating", "converted", "dropped"]


class LeadNoteIn(BaseModel):
    note: str = Field(min_length=1, max_length=1000)


class LeaseRenewIn(BaseModel):
    extensionMonths: int = Field(ge=1, le=120)
    newRentRupees: float | None = Field(None, gt=0)
    note: str | None = Field(None, max_length=500)


class LeaseRenewRespondIn(BaseModel):
    action: Literal["accept", "decline"]
    reason: str | None = Field(None, max_length=500)


class LeaseTerminateIn(BaseModel):
    reason: str = Field(min_length=2, max_length=500)
    terminationDate: str | None = Field(None, min_length=10)


class HandoverItem(BaseModel):
    label: str = Field(min_length=1, max_length=200)
    condition: Literal["good", "fair", "damaged"] = "good"


class HandoverIn(BaseModel):
    type: Literal["move_in", "move_out"]
    checklist: list[HandoverItem] = Field(default_factory=list)
    notes: str | None = Field(None, max_length=1000)
    photos: list[str] = Field(default_factory=list, max_length=10)


class PlotExpenseIn(BaseModel):
    category: Literal[
        "boundary_maintenance",
        "soil_health",
        "irrigation",
        "fencing",
        "land_preparation",
        "other",
    ]
    amountRupees: float = Field(gt=0)
    note: str | None = Field(None, max_length=500)
    expenseDate: str | None = Field(None, min_length=10)


class HarvestDeclarationIn(BaseModel):
    crop: str = Field(min_length=2)
    season: Literal["kharif", "rabi", "zaid", "annual"]
    areaAcres: float = Field(gt=0)
    yieldQuintals: float = Field(gt=0)
    saleRatePerQuintal: float = Field(gt=0)


class LandReviewIn(BaseModel):
    stars: int = Field(ge=1, le=5)
    aspects: dict[str, int] = Field(default_factory=dict)
    comment: str | None = Field(None, max_length=1000)
