from typing import Literal

from pydantic import BaseModel, Field


class DeliveryWindow(BaseModel):
    from_: str = Field(alias="from")
    to: str

    model_config = {"populate_by_name": True}


class RequirementDocumentIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    url: str = Field(min_length=1, max_length=2000)


class RfqCreate(BaseModel):
    crop: str = Field(min_length=1)
    variety: str | None = None
    gradeSpec: str | None = None
    quantityQuintals: float = Field(gt=0)
    maxRatePerQuintal: float | None = Field(default=None, gt=0)
    packing: str | None = None
    deliveryWindow: DeliveryWindow
    deliveryLocation: str = Field(min_length=1)
    paymentTermsDays: int = Field(ge=0, le=120)
    notes: str | None = None
    # ---- Farmer–exporter direct-connect sourcing extensions (all optional so
    # legacy clients keep working). Canonical quantity stays quintals; the unit
    # label is carried for display (quintal / MT / kg / tonne).
    quantityUnit: str | None = Field(default=None, max_length=20)
    partialQuantityAllowed: bool = True
    multiFarmerAllowed: bool = True
    publish: bool = True  # False → saved as draft, opened via /rfqs/{id}/publish
    # Quality & compliance
    moistureRequirement: str | None = Field(default=None, max_length=200)
    sizeSpec: str | None = Field(default=None, max_length=200)
    qualityParams: str | None = Field(default=None, max_length=500)
    residueRequirements: str | None = Field(default=None, max_length=500)
    requiredCertifications: list[str] = Field(default_factory=list, max_length=20)
    inspectionRequirements: str | None = Field(default=None, max_length=500)
    sampleRequirements: str | None = Field(default=None, max_length=500)
    rejectionConditions: str | None = Field(default=None, max_length=1000)
    requirementDocuments: list[RequirementDocumentIn] = Field(default_factory=list, max_length=10)
    # Supply
    packagingRequirements: str | None = Field(default=None, max_length=500)
    labellingRequirements: str | None = Field(default=None, max_length=500)
    shipmentWindow: str | None = Field(default=None, max_length=200)
    targetPrice: float | None = Field(default=None, gt=0)
    currency: str | None = Field(default=None, min_length=3, max_length=8)
    priceBasis: str | None = Field(default=None, max_length=200)
    # Export context
    destinationCountry: str | None = Field(default=None, max_length=100)
    requiredExportDocuments: list[str] = Field(default_factory=list, max_length=20)
    buyerNotes: str | None = Field(default=None, max_length=1000)


class RfqUpdate(BaseModel):
    """Editable fields for draft/open/paused RFQs (owner only)."""

    crop: str | None = Field(default=None, min_length=1)
    variety: str | None = None
    gradeSpec: str | None = None
    quantityQuintals: float | None = Field(default=None, gt=0)
    maxRatePerQuintal: float | None = Field(default=None, gt=0)
    packing: str | None = None
    deliveryWindow: DeliveryWindow | None = None
    deliveryLocation: str | None = Field(default=None, min_length=1)
    paymentTermsDays: int | None = Field(default=None, ge=0, le=120)
    notes: str | None = None
    quantityUnit: str | None = Field(default=None, max_length=20)
    partialQuantityAllowed: bool | None = None
    multiFarmerAllowed: bool | None = None
    moistureRequirement: str | None = None
    sizeSpec: str | None = None
    qualityParams: str | None = None
    residueRequirements: str | None = None
    requiredCertifications: list[str] | None = None
    inspectionRequirements: str | None = None
    sampleRequirements: str | None = None
    rejectionConditions: str | None = None
    requirementDocuments: list[RequirementDocumentIn] | None = None
    packagingRequirements: str | None = None
    labellingRequirements: str | None = None
    shipmentWindow: str | None = None
    targetPrice: float | None = Field(default=None, gt=0)
    currency: str | None = Field(default=None, min_length=3, max_length=8)
    priceBasis: str | None = None
    destinationCountry: str | None = None
    requiredExportDocuments: list[str] | None = None
    buyerNotes: str | None = None


class FarmerApplicationCreate(BaseModel):
    """Farmer application (direct-connect quote) on an export RFQ."""

    quantityOffered: float = Field(gt=0)
    quantityUnit: str = Field(min_length=1, max_length=20)
    price: float = Field(gt=0)
    priceUnit: str = Field(min_length=1, max_length=20)
    currency: str = Field(min_length=3, max_length=8)
    supplyBasis: Literal["farmGate", "collectionCentre", "mandi", "other"] = "farmGate"
    availableDate: str = Field(min_length=1)
    supplyLocation: str = Field(min_length=1, max_length=300)
    termsAccepted: bool = False
    sourceLotId: str | None = None
    qualityDetails: str | None = Field(default=None, max_length=1000)
    documentIds: list[str] = Field(default_factory=list, max_length=10)
    certificationNames: list[str] = Field(default_factory=list, max_length=10)
    residueTestRefs: list[str] = Field(default_factory=list, max_length=10)
    photos: list[str] = Field(default_factory=list, max_length=10)
    packagingCapability: str | None = Field(default=None, max_length=300)
    previousExperience: str | None = Field(default=None, max_length=500)
    message: str | None = Field(default=None, max_length=500)


class ContactUnlockIn(BaseModel):
    termsAccepted: bool = False
    mpin: str | None = Field(default=None, min_length=4, max_length=12)


class OutcomeIn(BaseModel):
    outcome: Literal["stillInContact", "dealDoneOffline", "didNotHappen", "withdrawn"]
    finalQuantity: float | None = Field(default=None, gt=0)
    finalQuantityUnit: str | None = Field(default=None, max_length=20)
    finalPrice: float | None = Field(default=None, gt=0)
    finalPriceUnit: str | None = Field(default=None, max_length=20)
    finalCurrency: str | None = Field(default=None, min_length=3, max_length=8)
    supplyDate: str | None = None
    collectionLocation: str | None = Field(default=None, max_length=300)


class IssueReportIn(BaseModel):
    category: Literal[
        "false_rfq",
        "misrepresented_quantity_quality",
        "certificate_document_concern",
        "payment_contract_dispute",
        "conduct",
        "other",
    ]
    summary: str = Field(min_length=10, max_length=2000)
    evidence: dict | None = None


class ExportReadinessCrop(BaseModel):
    crop: str = Field(min_length=1, max_length=100)
    normalQuantity: float | None = Field(default=None, gt=0)
    unit: str | None = Field(default=None, max_length=20)
    availableFrom: str | None = None
    availableTo: str | None = None


class ExportReadinessIn(BaseModel):
    """Farmer export-readiness profile (spec §3.4) — farmer-supplied
    information only; nothing here is platform-verified."""

    crops: list[ExportReadinessCrop] = Field(default_factory=list, max_length=50)
    farmLocation: str | None = Field(default=None, max_length=300)
    village: str | None = Field(default=None, max_length=100)
    district: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    certifications: list[str] = Field(default_factory=list, max_length=20)
    residueTestRefs: list[str] = Field(default_factory=list, max_length=20)
    packagingCapability: str | None = Field(default=None, max_length=300)
    previousExportExperience: str | None = Field(default=None, max_length=500)


class QuoteCreate(BaseModel):
    ratePerQuintal: float = Field(gt=0)
    availableQuintals: float = Field(gt=0)
    grade: str | None = None
    pickupLocation: str = Field(min_length=1)
    readyDate: str = Field(min_length=1)
    paymentTermsDays: int | None = Field(default=None, ge=0, le=120)
    notes: str | None = None


class QuoteAccept(BaseModel):
    quantityQuintals: float | None = Field(default=None, gt=0)
    orderId: str | None = None


class OrderStatusIn(BaseModel):
    status: Literal[
        "confirmed",
        "sourcing",
        "packed",
        "pickedUp",
        "inTransit",
        "customsCleared",
        "shipped",
        "delivered",
        "cancelled",
    ]
    note: str | None = None


class ShipmentIn(BaseModel):
    shippingLine: str = Field(min_length=1)
    containerType: Literal["dry", "reefer", "openTop"]
    containerNos: list[str] = Field(min_length=1, max_length=50)
    vessel: str | None = None
    portOfLoading: str = Field(min_length=1)
    portOfDischarge: str = Field(min_length=1)
    etd: str | None = None
    eta: str | None = None
    incoterm: str | None = None


class ShipmentEventIn(BaseModel):
    event: Literal[
        "gateIn", "loaded", "departed", "arrived", "customsHold", "cleared", "delivered"
    ]
    location: str | None = None
    at: str | None = None
    note: str | None = None


class OrderDocumentIn(BaseModel):
    docType: Literal[
        "commercialInvoice",
        "packingList",
        "phytosanitary",
        "fumigation",
        "certificateOfOrigin",
        "billOfLading",
        "healthCertificate",
    ]
    number: str | None = None
    url: str = Field(min_length=1)
    issuedAt: str | None = None


class LcIn(BaseModel):
    lcNumber: str = Field(min_length=1)
    issuingBank: str = Field(min_length=1)
    amount: float = Field(gt=0)
    currency: str = "USD"
    expiryDate: str = Field(min_length=1)


class RemittanceIn(BaseModel):
    amount: float = Field(gt=0)
    currency: str = "USD"
    date: str = Field(min_length=1)
    refNo: str = Field(min_length=1)
    mode: Literal["tt", "lc", "advance", "other"]
