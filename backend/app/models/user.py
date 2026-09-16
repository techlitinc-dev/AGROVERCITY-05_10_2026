from pydantic import BaseModel

VALID_PROFILES = {"farmer", "farmLandlord", "transport", "seller", "equipmentRental", "broker"}


class FarmBoundaryPoint(BaseModel):
    lat: float
    lng: float


class RegisterRequest(BaseModel):
    idToken: str
    name: str
    phone: str
    state: str
    district: str
    tehsil: str
    village: str
    landAreaAcres: float
    soilType: str
    irrigationType: str
    crops: list[str]
    mpin: str
    profiles: list[str]
    primaryProfile: str
    referralCode: str | None = None
    roleProfiles: dict[str, dict] | None = None


class UserUpdateRequest(BaseModel):
    name: str | None = None
    vernacularName: str | None = None
    village: str | None = None
    tehsil: str | None = None
    district: str | None = None
    state: str | None = None
    landAreaAcres: float | None = None
    soilType: str | None = None
    irrigationType: str | None = None
    activeCrops: list[str] | None = None
    bankName: str | None = None
    kccLimit: int | None = None


class FarmBoundaryRequest(BaseModel):
    farmBoundaryPoints: list[FarmBoundaryPoint]
    landAreaAcres: float
    khasraNumber: str | None = None


class LinkProfileRequest(BaseModel):
    profileType: str
