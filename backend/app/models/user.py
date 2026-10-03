from typing import Literal

from pydantic import BaseModel, Field

VALID_PROFILES = {"farmer", "farmLandlord", "transport", "transporter", "seller", "equipmentRental", "broker", "instructor", "dairyManager", "customer", "directBuyer", "bankManager", "insuranceProvider", "coldStorageProvider"}


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
    profiles: list[str] = []
    primaryProfile: str = ""
    referralCode: str | None = None
    roleProfiles: dict[str, dict] | None = None
    language: str | None = "en"
    preferredLanguage: str | None = "en"
    email: str | None = Field(default=None, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    dateOfBirth: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    gender: Literal["male", "female", "other"] | None = None
    pincode: str | None = Field(default=None, pattern=r"^\d{6}$")
    addressLine: str | None = None
    alternatePhone: str | None = Field(default=None, pattern=r"^\d{10}$")


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
    language: str | None = None
    preferredLanguage: str | None = None
    email: str | None = Field(default=None, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    dateOfBirth: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    gender: Literal["male", "female", "other"] | None = None
    pincode: str | None = Field(default=None, pattern=r"^\d{6}$")
    addressLine: str | None = None
    alternatePhone: str | None = Field(default=None, pattern=r"^\d{10}$")


class UserSettingsUpdate(BaseModel):
    language: str | None = None
    preferredLanguage: str | None = None
    womenMode: bool | None = None
    highContrast: bool | None = None
    darkMode: bool | None = None


class PersonaSetupRequest(BaseModel):
    """Completing persona/profile selection after registration."""

    profiles: list[str] = []
    primaryProfile: str | None = None
    roleProfiles: dict[str, dict] | None = None
    village: str | None = None
    tehsil: str | None = None
    district: str | None = None
    landAreaAcres: float | None = None
    soilType: str | None = None
    irrigationType: str | None = None
    crops: list[str] | None = None


class FarmBoundaryRequest(BaseModel):
    farmBoundaryPoints: list[FarmBoundaryPoint]
    landAreaAcres: float
    khasraNumber: str | None = None


class LinkProfileRequest(BaseModel):
    profileType: str


class AccountDeleteIn(BaseModel):
    mpin: str


class DeviceRegisterIn(BaseModel):
    fcmToken: str
    platform: Literal["android", "web"]
    locale: str = "en"


class ReportIn(BaseModel):
    reason: str = Field(min_length=5, max_length=500)


class BlockIn(BaseModel):
    userId: str = Field(min_length=1)
