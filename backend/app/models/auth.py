from pydantic import BaseModel


class FirebaseVerifyRequest(BaseModel):
    idToken: str


class OtpSendRequest(BaseModel):
    phone: str


class OtpVerifyRequest(BaseModel):
    phone: str
    otp: str
    otpSessionId: str | None = None


class PhoneMpinLoginRequest(BaseModel):
    phone: str
    mpin: str


class PhoneCheckRequest(BaseModel):
    phone: str


class PhoneCheckResponse(BaseModel):
    exists: bool
    hasMpin: bool
    name: str | None = None
    preferredLanguage: str | None = None
    activeProfile: str | None = None


class OnboardingRequest(BaseModel):
    phone: str
    name: str
    mpin: str
    persona: str = "farmer"
    state: str = "Maharashtra"
    district: str = "Nashik"
    village: str = ""
    language: str = "en"
    farmSizeAcres: float | None = None


class TokenPair(BaseModel):
    accessToken: str
    refreshToken: str
    tokenType: str = "bearer"


class AuthResponse(BaseModel):
    accessToken: str
    refreshToken: str
    isNewUser: bool
    user: dict
    referral: dict | None = None


class RefreshRequest(BaseModel):
    refreshToken: str


class MpinSetRequest(BaseModel):
    mpin: str


class MpinVerifyRequest(BaseModel):
    mpin: str
    refreshToken: str | None = None


class MpinResetRequest(BaseModel):
    idToken: str
    newMpin: str


class QuickLoginRequest(BaseModel):
    persona: str | None = None
    phone: str | None = None
    mpin: str | None = None


class BiometricRegisterRequest(BaseModel):
    phone: str
    deviceKey: str
    publicKey: str | None = None


class BiometricLoginRequest(BaseModel):
    phone: str
    deviceKey: str
    signature: str


class RegistrationProfileRequest(BaseModel):
    """Step 2 of the registration journey (basic profile). Accepted only with
    the restricted onboarding token. ``personas`` (multi-select, first entry =
    primary) supersedes the single ``persona`` field when provided."""

    name: str
    persona: str = "farmer"
    personas: list[str] | None = None
    state: str = "Maharashtra"
    district: str = "Nashik"
    village: str = ""
    language: str = "en"
    farmSizeAcres: float | None = None
    mpin: str | None = None


class RegistrationCompleteRequest(BaseModel):
    """Step 7 — server-controlled completion. The backend verifies every
    precondition; the frontend can never set kycStatus/registrationStatus
    directly."""

    sessionId: str

