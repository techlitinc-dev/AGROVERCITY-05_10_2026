from pydantic import BaseModel


class FirebaseVerifyRequest(BaseModel):
    idToken: str


class PhoneMpinLoginRequest(BaseModel):
    phone: str
    mpin: str


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

