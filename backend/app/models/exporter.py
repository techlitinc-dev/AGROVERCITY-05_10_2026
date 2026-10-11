from typing import Literal

from pydantic import BaseModel, Field


class DeliveryWindow(BaseModel):
    from_: str = Field(alias="from")
    to: str

    model_config = {"populate_by_name": True}


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
