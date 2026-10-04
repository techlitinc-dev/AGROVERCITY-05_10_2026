from pydantic import BaseModel, Field


class VehicleTypeOut(BaseModel):
    type: str
    baseFare: float
    perKmRate: float
    capacityTonnes: float


class FareEstimateRequest(BaseModel):
    vehicleType: str
    distanceKm: float
    # Transporter-side earning lever only; server-clamped to SURGE_CAP.
    surgeMultiplier: float | None = None


class FareEstimateOut(BaseModel):
    baseFare: float
    distanceFare: float
    totalFare: float
    loadingLabor: float = 0.0
    perishableSurcharge: float = 0.0
    tollEstimate: float = 0.0
    returnDiscount: float = 0.0
    surgeMultiplier: float = 1.0
    breakdown: dict | None = None


class CreateBookingRequest(BaseModel):
    vehicleType: str
    distanceKm: float
    pickup: str
    drop: str
    date: str
    lotId: str | None = None
    commodity: str | None = None
    weightQuintals: float | None = None
    packaging: str | None = None
    notes: str | None = None


class UpdateBookingRequest(BaseModel):
    status: str
    vehicleId: str | None = None
    vehicleNo: str | None = None
    podPhotos: list[str] | None = None
    receiverName: str | None = None
    receiverPhone: str | None = None
    damageNotes: str | None = None


class AcceptBookingRequest(BaseModel):
    vehicleId: str | None = None
    vehicleNo: str | None = None
    driverName: str | None = None
    driverPhone: str | None = None


class RejectBookingRequest(BaseModel):
    reason: str = Field(min_length=3)


class OwnerVehicleRequest(BaseModel):
    vehicleType: str
    registrationNo: str
    capacityTonnes: float
    rcDocUrl: str | None = None
    insuranceDocUrl: str | None = None
    pucExpiry: str | None = None
    fitnessExpiry: str | None = None
    insuranceExpiry: str | None = None
    permitType: str | None = "State Permit"  # "State Permit" or "National Permit"
    driverName: str | None = None
    driverPhone: str | None = None
    driverLicense: str | None = None


class AvailabilityRequest(BaseModel):
    availableDates: list[str]


class TransportProfileUpdate(BaseModel):
    businessName: str = ""
    transporterType: str = "owner_driver"
    vehicleType: str = "Tata Ace"
    rcNumber: str = ""
    contactPhone: str = ""
    gstin: str | None = None
    panNumber: str | None = None
    transportLicense: str | None = None
    operatingRoutes: list[str] = []
    operatingStates: list[str] = []
    specializations: list[str] = []
    fleetSize: int = 1
    experienceYears: int = 1
    emergencyAvailable: bool = True
    settlementUpi: str | None = None


class OpenLoadCreateRequest(BaseModel):
    pickupLocation: str
    dropLocation: str
    crop: str
    quantityQuintals: float
    packaging: str = "Gunny Bags"  # "Gunny Bags", "Plastic Crates", "Wooden Boxes", "Bulk"
    perishable: bool = False
    preferredVehicleType: str = "Tata Ace"
    pickupDate: str
    targetFare: float
    notes: str | None = None


class LoadBidRequest(BaseModel):
    quotedFare: float
    vehicleId: str | None = None
    vehicleNo: str | None = None
    estimatedPickupTime: str | None = None
    notes: str | None = None


class TripLocationUpdate(BaseModel):
    lat: float
    lng: float
    speedKmH: float = 0.0
    heading: float = 0.0
    waypoint: str | None = None  # "at_pickup", "loaded", "weighbridge", "in_transit", "mandi_gate", "unloading", "delivered"
    waypointLabel: str | None = None
    notes: str | None = None


class WeighbridgeSlipRequest(BaseModel):
    slipNo: str
    weighbridgeName: str = "धर्मकांटा"
    tareWeightKg: float
    grossWeightKg: float
    netWeightKg: float | None = None
    slipPhotoUrl: str | None = None
    notes: str | None = None


class TripExpenseRequest(BaseModel):
    category: str  # "diesel", "toll", "driver_bata", "loading_labor", "mandi_cess", "maintenance", "other"
    amount: float
    notes: str | None = None
    receiptPhotoUrl: str | None = None
