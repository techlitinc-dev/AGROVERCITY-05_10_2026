from pydantic import BaseModel, Field


class GeoPoint(BaseModel):
    lat: float
    lng: float
    address: str | None = None


class VehicleTypeOut(BaseModel):
    type: str
    baseFare: float
    perKmRate: float
    capacityTonnes: float


class FareEstimateRequest(BaseModel):
    vehicleType: str
    distanceKm: float
    # Server-computed road distance wins over distanceKm when both coords are
    # present and a Google key is configured.
    pickup: GeoPoint | None = None
    drop: GeoPoint | None = None
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
    distanceKm: float | None = None
    distanceSource: str | None = None


class CreateBookingRequest(BaseModel):
    vehicleType: str
    distanceKm: float
    pickup: str
    drop: str
    date: str
    # Optional coordinates: when both are present and a Google key is
    # configured, the server-computed road distance drives the fare and is
    # stored as pickupGeo/dropGeo on the booking.
    pickupCoords: GeoPoint | None = None
    dropCoords: GeoPoint | None = None
    # Book Now / Book Later (FT-1): ISO datetime of the pickup slot plus an
    # optional loading window. Drives reminders and the cancel-penalty window.
    pickupTime: str | None = None
    timeWindowMinutes: int | None = Field(default=None, ge=15, le=720)
    # FT-6 transit insurance: opt-in cover on the declared goods value.
    declaredValuePaisa: int | None = Field(default=None, gt=0)
    insuranceOptIn: bool = False
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
    # Geo + custom fare overrides + live availability (nearby/instant booking):
    # baseFare/perKmRate, when set, replace the catalog rates at fare time.
    homeLocation: GeoPoint | None = None
    perKmRate: float | None = Field(default=None, gt=0)
    baseFare: int | None = Field(default=None, gt=0)
    availableNow: bool = False


class VehicleLocationRequest(BaseModel):
    lat: float
    lng: float
    availableNow: bool | None = None


class OwnerVehicleUpdateRequest(BaseModel):
    """Partial PUT: every field optional; absent fields stay unchanged."""

    vehicleType: str | None = None
    registrationNo: str | None = None
    capacityTonnes: float | None = None
    rcDocUrl: str | None = None
    insuranceDocUrl: str | None = None
    pucExpiry: str | None = None
    fitnessExpiry: str | None = None
    insuranceExpiry: str | None = None
    permitType: str | None = None
    driverName: str | None = None
    driverPhone: str | None = None
    driverLicense: str | None = None
    homeLocation: GeoPoint | None = None
    perKmRate: float | None = Field(default=None, gt=0)
    baseFare: int | None = Field(default=None, gt=0)
    availableNow: bool | None = None


class InstantBookingPlace(BaseModel):
    address: str
    lat: float
    lng: float


class InstantBookingRequest(BaseModel):
    vehicleId: str
    pickup: InstantBookingPlace
    drop: InstantBookingPlace
    pickupDate: str
    pickupTime: str | None = None
    commodity: str | None = None
    weightKg: float | None = None
    # Client-routed road distance; drives the fare alongside the vehicle's rates.
    distanceKm: float = Field(gt=0)
    notes: str | None = None


class AssignDriverRequest(BaseModel):
    driverName: str
    driverPhone: str


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
    pickupTime: str | None = None  # FT-1: ISO datetime slot for the pickup
    # FT-6 transit insurance on the load's declared goods value.
    declaredValuePaisa: int | None = Field(default=None, gt=0)
    insuranceOptIn: bool = False
    targetFare: float
    notes: str | None = None
    # Urgent load: pinned first on the load board and pushed to verified
    # vehicles near the pickup point when geo coordinates are present.
    urgent: bool = False
    pickupLat: float | None = None
    pickupLng: float | None = None


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


class WaitingEventRequest(BaseModel):
    """FT-2 detention: transporter taps start/stop while the vehicle waits."""

    phase: str  # "pickup" | "drop"
    action: str  # "start" | "stop"
    at: str | None = None  # ISO timestamp override (offline-tolerant sync)


class FarmerRatingRequest(BaseModel):
    """FT-3: transporter rates the farmer/shipper after a completed trip."""

    rating: int = Field(ge=1, le=5)
    review: str | None = Field(default=None, max_length=500)
    tags: list[str] = []  # subset of FARMER_RATING_TAGS


class FavoriteToggleRequest(BaseModel):
    """FT-4: farmer pins/unpins a transporter for one-tap rebooking."""

    favorited: bool = True


class RebookRequest(BaseModel):
    """FT-4: clone a finished trip into a new booking (rates re-evaluated)."""

    date: str
    pickupTime: str | None = None
    timeWindowMinutes: int | None = Field(default=None, ge=15, le=720)
    notes: str | None = None


class LoadTemplateRequest(BaseModel):
    """FT-5: farmer-saved load template (e.g. the weekly mandi run, F12)."""

    name: str = Field(min_length=2, max_length=80)
    pickupLocation: str
    dropLocation: str
    crop: str
    quantityQuintals: float
    packaging: str = "Gunny Bags"
    perishable: bool = False
    preferredVehicleType: str = "Tata Ace"
    targetFare: float
    notes: str | None = None
    # FT-6: cover carried into each repeated load.
    declaredValuePaisa: int | None = Field(default=None, gt=0)
    insuranceOptIn: bool = False
    repeatWeekday: int | None = Field(default=None, ge=0, le=6)  # 0 = Monday


class LoadTemplateRepeatRequest(BaseModel):
    """FT-5: instantiate the template as a fresh open load this season."""

    pickupDate: str
    pickupTime: str | None = None
    targetFare: float | None = None  # seasonal override


class BookingPaymentRequest(BaseModel):
    """P0-1 fare payment. An empty body (or only amountPaisa) creates a
    Razorpay order for the fare; supplying the razorpay* fields verifies the
    captured payment, which funds the trip escrow."""

    amountPaisa: int | None = Field(default=None, gt=0)
    razorpayOrderId: str | None = None
    razorpayPaymentId: str | None = None
    razorpaySignature: str | None = None


class StopIn(BaseModel):
    """P2-36 multi-drop stop (F15 milk-run)."""

    label: str = Field(min_length=1, max_length=120)
    address: str | None = None
    eta: str | None = None


class BookingStopsRequest(BaseModel):
    stops: list[StopIn] = Field(min_length=1, max_length=25)


class StopPodRequest(BaseModel):
    """P2-36 per-stop proof of delivery (E16). OTP is optional — when the
    booking has a generated POD OTP it is validated against it."""

    photos: list[str] = Field(min_length=1)
    note: str | None = None
    otp: str | None = None
    receiverName: str | None = None


class BreakdownRequest(BaseModel):
    """P2-37 mid-trip breakdown (spec E11)."""

    note: str = Field(min_length=3, max_length=500)
    location: str | None = None
    # Distance covered before the breakdown; drives the pro-rata adjustment.
    completedDistanceKm: float | None = Field(default=None, ge=0)


class TransportPayoutRequest(BaseModel):
    """P0-1 wallet payout to the verified bank account. MPIN-gated like the
    other high-risk money movements (contract accept, equipment payout)."""

    mpin: str = Field(min_length=4, max_length=4)
    amountPaisa: int | None = Field(default=None, gt=0)  # default: full balance
