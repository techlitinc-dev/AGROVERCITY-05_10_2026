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
    is_suspended: bool | None = None
    suspension_reason: str | None = None


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


# ===========================================================================
# Superadmin User 360 & Governance Schemas (Phase 1 & 2)
# ===========================================================================
from datetime import datetime
from typing import Any, Dict, List, Optional


class PersonaData(BaseModel):
    role: str
    is_active: bool = True
    verified_at: Optional[datetime] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class UserActivityEvent(BaseModel):
    id: str
    timestamp: datetime
    event_type: str
    resource: str
    ip_address: Optional[str] = None
    device: Optional[str] = None
    status_code: int = 200
    payload_summary: Optional[Dict[str, Any]] = None


class UserContentSummary(BaseModel):
    lots_count: int = 0
    active_bids_count: int = 0
    trips_completed: int = 0
    total_spend_inr: float = 0.0
    total_earned_inr: float = 0.0
    disputes_count: int = 0
    reviews_count: int = 0


class User360DetailResponse(BaseModel):
    id: str
    phone: str
    email: Optional[str] = None
    full_name: str = ""
    profile_photo: Optional[str] = None
    created_at: datetime
    last_login: Optional[datetime] = None
    status: str = "ACTIVE"
    is_blocked: bool = False
    kyc_status: str = "UNVERIFIED"
    trust_score: float = 50.0
    personas: List[PersonaData] = Field(default_factory=list)
    content_summary: UserContentSummary = Field(default_factory=UserContentSummary)
    recent_activities: List[UserActivityEvent] = Field(default_factory=list)


class UserCreateAdminSchema(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15)
    name: str = Field(..., min_length=1, max_length=100)
    email: Optional[str] = None
    primary_role: str = Field(default="farmer")
    roles: List[str] = Field(default_factory=lambda: ["farmer"])
    state: Optional[str] = ""
    district: Optional[str] = ""
    status: str = Field(default="ACTIVE")
    kyc_status: str = Field(default="PENDING")
    mpin: Optional[str] = "1234"


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    address: Optional[str] = None
    language: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_ifsc: Optional[str] = None
    bank_name: Optional[str] = None


class UserStatusGovIn(BaseModel):
    status: str = Field(..., description="SUSPENDED | ACTIVE | BANNED | LOCKED")
    reason: Optional[str] = Field(default="Administrative status change")


class UserSessionRevokeIn(BaseModel):
    session_id: str = Field(default="all", description="all or specific session_id")


class UserPersonasAssignIn(BaseModel):
    roles: List[str] = Field(default_factory=list)


class UserWalletAdjustIn(BaseModel):
    amount: float = Field(..., gt=0)
    type: Literal["CREDIT", "DEBIT"] = Field(default="CREDIT")
    reason: str = Field(..., min_length=3)


class KycDocOverrideIn(BaseModel):
    status: Literal["VERIFIED", "REJECTED", "RESUBMISSION_REQUESTED", "verified", "rejected", "pending"]
    remarks: Optional[str] = "Admin manual KYC review"
    document_id: Optional[str] = None


# ===========================================================================
# Superadmin Farmer Management Module Schemas (Phase 1)
# ===========================================================================

class LandRecord(BaseModel):
    id: str
    state: str = ""
    district: str = ""
    acreage: float = 0.0
    verification_status: str = "PENDING"
    document_urls: List[str] = Field(default_factory=list)
    gat_number: Optional[str] = None
    village: Optional[str] = None
    remarks: Optional[str] = None


class FarmContentSummary(BaseModel):
    active_lots_count: int = 0
    total_produce_sold_inr: float = 0.0
    total_supplies_bought_inr: float = 0.0
    diary_entries_count: int = 0
    crop_scans_count: int = 0
    active_loans_count: int = 0


class FarmerActivityEvent(BaseModel):
    id: str
    timestamp: datetime
    event_type: str
    resource: str
    device: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class Farmer360DetailResponse(BaseModel):
    id: str
    phone: str
    full_name: str = ""
    profile_photo: Optional[str] = None
    created_at: datetime
    status: str = "ACTIVE"
    kyc_status: str = "PENDING"
    trust_score: float = 50.0
    wallet_balance: float = 0.0
    land_records: List[LandRecord] = Field(default_factory=list)
    content_summary: FarmContentSummary = Field(default_factory=FarmContentSummary)
    recent_activities: List[FarmerActivityEvent] = Field(default_factory=list)
    email: Optional[str] = None
    state: Optional[str] = ""
    district: Optional[str] = ""
    village: Optional[str] = ""
    crops: List[str] = Field(default_factory=list)
    soil_type: Optional[str] = None
    irrigation_type: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    is_blocked: bool = False


class FarmerProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    village: Optional[str] = None
    address: Optional[str] = None
    language: Optional[str] = None
    land_area_acres: Optional[float] = None
    crops: Optional[List[str]] = None
    soil_type: Optional[str] = None
    irrigation_type: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    bank_ifsc: Optional[str] = None


class FarmerStatusGovIn(BaseModel):
    status: str = Field(..., description="ACTIVE | SUSPENDED | BANNED | LOCKED")
    reason: Optional[str] = Field(default="Administrative status change")


class LandRecordVerifyIn(BaseModel):
    status: Literal["VERIFIED", "REJECTED", "RESUBMISSION_REQUESTED", "verified", "rejected", "pending"]
    remarks: Optional[str] = "Admin manual land KYC review"


class FeatureMetricSummary(BaseModel):
    mall_orders_count: int = 0
    mall_total_spent_inr: float = 0.0
    courses_enrolled: int = 0
    courses_completed: int = 0
    certificates_earned: int = 0
    news_audio_consumed_count: int = 0
    total_transactions_count: int = 0
    wallet_balance_inr: float = 0.0
    avg_rating_received: float = 0.0
    reviews_given_count: int = 0
    following_count: int = 0
    saved_items_count: int = 0
    trees_planted_count: int = 0
    trees_verified_count: int = 0
    kisan_coins_balance: int = 0
    referrals_converted_count: int = 0
    vault_documents_count: int = 0
    eligible_schemes_count: int = 0
    applied_schemes_count: int = 0
    land_records_verified_acreage: float = 0.0
    pnl_net_profit_inr: float = 0.0
    diary_entries_count: int = 0
    mandi_alerts_active: int = 0
    ad_clicks_count: int = 0
    ai_decisions_count: int = 0
    ai_churn_risk_score: float = 0.0
    ai_scans_total: int = 0


class FarmerCommonFeatures360Response(BaseModel):
    user_id: str
    full_name: str = ""
    phone: str = ""
    district: Optional[str] = None
    state: Optional[str] = None
    kyc_status: str = "PENDING"
    account_status: str = "ACTIVE"
    trust_score: float = 50.0
    created_at: datetime
    metrics: FeatureMetricSummary = Field(default_factory=FeatureMetricSummary)
    recent_cross_feature_activities: List[Dict[str, Any]] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Farmer Common Five Features 360 Specification
# ---------------------------------------------------------------------------

class PaymentTransactionsSummary(BaseModel):
    wallet_balance_inr: float = 0.0
    escrow_locked_inr: float = 0.0
    lifetime_credit_inr: float = 0.0
    lifetime_debit_inr: float = 0.0
    pending_settlements_count: int = 0
    failed_transactions_count: int = 0
    udhaar_net_balance_inr: float = 0.0
    verified_bank_accounts_count: int = 0


class RatingsReviewsSummary(BaseModel):
    avg_rating_received: float = 0.0
    total_reviews_received: int = 0
    total_reviews_given: int = 0
    trust_score: float = 0.0
    flagged_reviews_count: int = 0
    pending_rating_prompts_count: int = 0


class SavedFollowingSummary(BaseModel):
    following_count: int = 0
    followers_count: int = 0
    favorite_transporters_count: int = 0
    wishlist_items_count: int = 0
    saved_searches_count: int = 0
    active_price_alerts_count: int = 0
    active_product_alerts_count: int = 0


class ReferEarnSummary(BaseModel):
    referral_code: str = ""
    referred_by_user_id: Optional[str] = None
    total_invites_sent: int = 0
    converted_referrals_count: int = 0
    pending_referrals_count: int = 0
    total_coins_earned: int = 0
    fraud_flagged_count: int = 0


class DocumentVaultSummary(BaseModel):
    total_documents: int = 0
    total_storage_bytes: int = 0
    verified_docs_count: int = 0
    pending_verification_count: int = 0
    rejected_docs_count: int = 0
    high_risk_tamper_flags: int = 0


class FarmerCommonFiveFeatures360(BaseModel):
    user_id: str
    full_name: str
    phone: str
    district: Optional[str] = None
    state: Optional[str] = None
    kyc_status: str = "PENDING"
    account_status: str = "ACTIVE"
    payments: PaymentTransactionsSummary = Field(default_factory=PaymentTransactionsSummary)
    ratings: RatingsReviewsSummary = Field(default_factory=RatingsReviewsSummary)
    saved_following: SavedFollowingSummary = Field(default_factory=SavedFollowingSummary)
    referrals: ReferEarnSummary = Field(default_factory=ReferEarnSummary)
    document_vault: DocumentVaultSummary = Field(default_factory=DocumentVaultSummary)
    recent_activities: List[Dict[str, Any]] = Field(default_factory=list)




