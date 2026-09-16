from pydantic import BaseModel, Field


class VehicleTypeOut(BaseModel):
    type: str
    baseFare: float
    perKmRate: float
    capacityTonnes: float


class FareEstimateRequest(BaseModel):
    vehicleType: str
    distanceKm: float


class FareEstimateOut(BaseModel):
    baseFare: float
    distanceFare: float
    totalFare: float


class CreateBookingRequest(BaseModel):
    vehicleType: str
    distanceKm: float
    pickup: str
    drop: str
    date: str
    lotId: str | None = None


class UpdateBookingRequest(BaseModel):
    status: str
    vehicleId: str | None = None
    vehicleNo: str | None = None
    podPhotos: list[str] | None = None
    receiverName: str | None = None


class AcceptBookingRequest(BaseModel):
    vehicleId: str | None = None
    vehicleNo: str | None = None


class RejectBookingRequest(BaseModel):
    reason: str = Field(min_length=3)


class OwnerVehicleRequest(BaseModel):
    vehicleType: str
    registrationNo: str
    capacityTonnes: float
    rcDocUrl: str | None = None
    insuranceDocUrl: str | None = None


class AvailabilityRequest(BaseModel):
    availableDates: list[str]
