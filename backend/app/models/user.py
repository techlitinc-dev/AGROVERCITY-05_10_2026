from typing import Literal

from pydantic import BaseModel, Field

VALID_PROFILES = {
    "farmer",
    "farmLandlord",
    "landlord",
    "farm landlord",
    "farm_landlord",
    "transport",
    "transporter",
    "seller",
    "equipmentRental",
    "equipmentOwner",
    "equipment_owner",
    "broker",
    "instructor",
    "dairyManager",
    "milkSeller",
    "customer",
    "directBuyer",
    "exporter",
    "bankManager",
    "insuranceProvider",
    "coldStorageProvider",
    "vet",
    "fpoManager",
    "womenShg",
    "gaushalaManager",
    "superadmin",
}

PROFILE_ALIASES: dict[str, str] = {
    "landlord": "farmLandlord",
    "farm landlord": "farmLandlord",
    "farm_landlord": "farmLandlord",
    "farmlandlord": "farmLandlord",
    "farmlandlord": "farmLandlord",
    "transport": "transporter",
    "transporter": "transporter",
    "equipmentowner": "equipmentRental",
    "equipment_owner": "equipmentRental",
    "equipment owner": "equipmentRental",
    "equipmentOwner": "equipmentRental",
    "equipmentrental": "equipmentRental",
    "equipment_rental": "equipmentRental",
    "equipment rental": "equipmentRental",
    "equipmentRental": "equipmentRental",
    "dairymanager": "dairyManager",
    "dairy_manager": "dairyManager",
    "dairy manager": "dairyManager",
    "dairyManager": "dairyManager",
    "milkseller": "milkSeller",
    "milk_seller": "milkSeller",
    "milk seller": "milkSeller",
    "milkSeller": "milkSeller",
    "directbuyer": "directBuyer",
    "direct_buyer": "directBuyer",
    "direct buyer": "directBuyer",
    "directBuyer": "directBuyer",
    "bankmanager": "bankManager",
    "bank_manager": "bankManager",
    "bank manager": "bankManager",
    "bankManager": "bankManager",
    "insuranceprovider": "insuranceProvider",
    "insurance_provider": "insuranceProvider",
    "insurance provider": "insuranceProvider",
    "insuranceProvider": "insuranceProvider",
    "coldstorageprovider": "coldStorageProvider",
    "cold_storage_provider": "coldStorageProvider",
    "cold storage provider": "coldStorageProvider",
    "coldstorage": "coldStorageProvider",
    "cold_storage": "coldStorageProvider",
    "coldStorage": "coldStorageProvider",
    "coldStorageProvider": "coldStorageProvider",
    "fpomanager": "fpoManager",
    "fpo_manager": "fpoManager",
    "fpo manager": "fpoManager",
    "fpo": "fpoManager",
    "fpoManager": "fpoManager",
    "womenshg": "womenShg",
    "women_shg": "womenShg",
    "women shg": "womenShg",
    "womenShg": "womenShg",
    "gaushalamanager": "gaushalaManager",
    "gaushala_manager": "gaushalaManager",
    "gaushala manager": "gaushalaManager",
    "gaushala": "gaushalaManager",
    "gaushalaManager": "gaushalaManager",
    "superadmin": "superadmin",
    "admin": "superadmin",
    "teacher": "instructor",
    "nursery": "nursery",
    "plant_nursery": "nursery",
    "plant nursery": "nursery",
    "plantnursery": "nursery",
}


def normalize_profile(ptype: str | None) -> str:
    if not ptype:
        return ""
    p = str(ptype).strip()
    if p in PROFILE_ALIASES:
        return PROFILE_ALIASES[p]
    lower_p = p.lower()
    if lower_p in PROFILE_ALIASES:
        return PROFILE_ALIASES[lower_p]
    compact = lower_p.replace(" ", "").replace("_", "").replace("-", "")
    if compact in PROFILE_ALIASES:
        return PROFILE_ALIASES[compact]
    return p


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
    whatsapp: str | None = Field(default=None, pattern=r"^\d{10}$")
    photoUrl: str | None = Field(default=None, min_length=1, max_length=500)
    dietaryPreference: Literal["veg", "organic", "a2"] | None = None
    familySize: int | None = Field(default=None, ge=1, le=20)


class UserSettingsUpdate(BaseModel):
    language: str | None = None
    preferredLanguage: str | None = None
    womenMode: bool | None = None
    highContrast: bool | None = None
    darkMode: bool | None = None
    discoverable: bool | None = None
    householdBudgetMonthly: float | None = Field(default=None, ge=0)


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
