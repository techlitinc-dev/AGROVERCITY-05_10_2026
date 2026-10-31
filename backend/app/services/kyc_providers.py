"""KYC verification providers.

Two interchangeable providers serve the SAME registration screens and
endpoints:

- ``mock``    → internal mock DigiLocker screen (dev / no-SSL testing
                servers, the default). Never asks for a DigiLocker password,
                an Aadhaar OTP, or real Aadhaar details; approval mints a
                synthetic, deterministically-masked identity.
- ``sandbox`` → the real DigiLocker consent flow through the Sandbox.co.in
                KYC API (services.digilocker). The authorization URL is
                issued by Sandbox at session-create time and the outcome is
                polled (``services.kyc_documents.sync_sandbox_session``) —
                the backend re-verifies everything before marking a session
                terminal, so a query parameter is never proof of verification.

Provider selection lives in ``settings.kyc_provider`` and never changes the
registration flow: for ``context=registration`` the user always returns to
the registration callback, for every provider.
"""
from datetime import datetime, timedelta, timezone
import hashlib

from fastapi import HTTPException

from app.core.config import settings

PROVIDER_MOCK = "mock"
PROVIDER_SANDBOX = "sandbox"

# Verification methods inside a session. DigiLocker is the compliant
# production route; aadhaar_okyc is the Aadhaar-number + OTP flow.
METHOD_DIGILOCKER = "digilocker"
METHOD_AADHAAR_OKYC = "aadhaar_okyc"
KNOWN_METHODS = {METHOD_DIGILOCKER, METHOD_AADHAAR_OKYC}

SESSION_TTL_MINUTES = 15
AADHAAR_OTP_TTL_MINUTES = 10
AADHAAR_OTP_MAX_ATTEMPTS = 5
AADHAAR_REASON = "Identity verification for Agrovercity KYC compliance"


def _error(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": {}},
    )


def active_provider() -> str:
    provider = (settings.kyc_provider or PROVIDER_MOCK).strip().lower()
    if provider not in (PROVIDER_MOCK, PROVIDER_SANDBOX):
        _error(500, "KYC_PROVIDER_MISCONFIGURED", "kyc_provider must be 'mock' or 'sandbox'")
    return provider


def session_expiry() -> str:
    return (datetime.now(timezone.utc) + timedelta(minutes=SESSION_TTL_MINUTES)).isoformat()


def build_authorization_url(session: dict) -> str:
    """Where the user is sent to authorize. Mock → internal screen. Sandbox →
    '' here: the real DigiLocker authorization URL is issued by Sandbox at
    session-create time (see routers/kyc.create_kyc_session) and stored on
    the session doc as ``authorizationUrl``."""
    provider = session.get("provider") or active_provider()
    if provider == PROVIDER_MOCK:
        return f"{settings.web_app_base_url.rstrip('/')}/mock-digilocker?session={session['id']}"
    return ""


def registration_callback_url(session_id: str, context: str) -> str:
    """The post-authorization landing page. For registration this is ALWAYS
    the registration callback — provider switching must not change it."""
    return f"{settings.web_app_base_url.rstrip('/')}/kyc/callback?session={session_id}&context={context}"


def mock_identity(user: dict, session_id: str) -> dict:
    """Synthetic identity for the mock provider — deterministic per session so
    tests and the mock screen stay stable. Only masked Aadhaar is produced."""
    seed = int(hashlib.sha256(session_id.encode()).hexdigest()[:8], 16)
    last4 = f"{seed % 10000:04d}"
    name = (user.get("name") or "").strip() or "Verified User"
    return {
        "fullName": name,
        "maskedAadhaar": f"XXXXXXXX{last4}",
        "dob": "",
        "gender": "",
        "address": "",
        "photoUrl": "",
    }


def mask_aadhaar(aadhaar_number: str) -> str:
    """Only a masked Aadhaar (last 4) may ever be persisted."""
    digits = "".join(ch for ch in str(aadhaar_number or "") if ch.isdigit())
    return f"XXXXXXXX{digits[-4:]}" if len(digits) >= 4 else ""


def aadhaar_okyc_identity(user: dict, session: dict) -> dict:
    """Identity for a successful Aadhaar-OTP verification. Mirrors
    ``mock_identity``: name from the profile, masked Aadhaar only."""
    return {
        "fullName": (user.get("name") or "").strip() or "Verified User",
        "maskedAadhaar": session.get("aadhaarLast4") or "",
        "dob": "",
        "gender": "",
        "address": "",
        "photoUrl": "",
    }
