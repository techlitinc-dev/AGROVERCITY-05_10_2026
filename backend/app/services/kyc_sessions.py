"""KYC session lifecycle (registration-integrated identity verification).

A session is a single authorization attempt. States:
    created/processing → open; verified/failed/expired/reviewRequired/denied → terminal

The session is the ONLY proof channel: query parameters, deep links and
frontend state never mark a user verified. Terminal states are reached
exclusively through ``apply_provider_result`` (mock screen approval or a
signed Sandbox callback) or the lazy expiry sweep.
"""
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from app.core.db import get_doc, query, set_doc
from app.services import kyc_providers

KYC_SESSION_COLLECTION = "kyc_sessions"
IDENTITY_COLLECTION = "identity_verifications"

OPEN_STATES = {"created", "pending", "processing"}
TERMINAL_STATES = {"verified", "failed", "expired", "reviewRequired", "denied"}

KNOWN_CONTEXTS = {"registration", "profile", "feature_gate"}


def _hash_otp(otp: str, salt: str) -> str:
    return hashlib.sha256(f"{otp}:{salt}".encode()).hexdigest()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_ts(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _is_expired(session: dict, now: datetime | None = None) -> bool:
    expires_at = _parse_ts(session.get("expiresAt"))
    return expires_at is None or (now or _now()) >= expires_at


async def get_session(session_id: str) -> dict | None:
    return await get_doc(KYC_SESSION_COLLECTION, session_id)


async def expire_if_needed(session: dict) -> dict:
    """Lazy expiry sweep — a session past expiresAt in an open state becomes
    terminal ``expired``."""
    if session.get("status") in OPEN_STATES and _is_expired(session):
        session["status"] = "expired"
        session["error"] = "session_expired"
        session["updatedAt"] = _now().isoformat()
        await set_doc(KYC_SESSION_COLLECTION, session["id"], session)
    return session


async def open_session_for(uid: str, context: str, method: str | None = None) -> dict | None:
    """Most recent open (or expired-but-not-swept) session for user+context,
    used for duplicate-session prevention. When ``method`` is given, only a
    session with the same verification method is reused — switching between
    Aadhaar-OTP and DigiLocker never hijacks the other method's session."""
    sessions = await query(KYC_SESSION_COLLECTION, [("userId", "==", uid), ("context", "==", context)])
    open_sessions = [s for s in sessions if s.get("status") in OPEN_STATES]
    if method is not None:
        open_sessions = [s for s in open_sessions if s.get("method") == method]
    if not open_sessions:
        return None
    latest = max(open_sessions, key=lambda s: s.get("createdAt") or "")
    return await expire_if_needed(latest)


async def create_session(
    uid: str,
    context: str,
    consent_accepted: bool,
    method: str = kyc_providers.METHOD_DIGILOCKER,
) -> dict:
    """Idempotent create: a still-open session for the same user+context AND
    the same verification method is returned instead of creating a duplicate."""
    existing = await open_session_for(uid, context, method)
    if existing is not None and existing.get("status") in OPEN_STATES:
        return existing
    now = _now().isoformat()
    session = {
        "id": f"kycs_{secrets.token_hex(12)}",
        "userId": uid,
        "context": context,
        "provider": kyc_providers.active_provider(),
        "method": method,
        "status": "created",
        "authorizationUrl": "",
        "returnTo": kyc_providers.registration_callback_url("", context) if context == "registration" else "",
        "consentAccepted": bool(consent_accepted),
        "consentAt": now if consent_accepted else None,
        "identity": None,
        "error": None,
        "expiresAt": kyc_providers.session_expiry(),
        "createdAt": now,
        "updatedAt": now,
    }
    if context == "registration":
        # Always land back on the registration callback, regardless of provider.
        session["returnTo"] = kyc_providers.registration_callback_url(session["id"], context)
    if method == kyc_providers.METHOD_DIGILOCKER:
        session["authorizationUrl"] = kyc_providers.build_authorization_url(session)
    await set_doc(KYC_SESSION_COLLECTION, session["id"], session)
    return session


async def refresh_session(session: dict) -> dict:
    """Retry support: rotate the authorization URL + expiry for a session that
    is still open OR was left expired. Terminal outcomes (verified/denied/
    failed/reviewRequired) cannot refresh — the caller starts a new session."""
    session = await expire_if_needed(session)
    if session.get("status") in TERMINAL_STATES and session.get("status") != "expired":
        return session
    session["status"] = "created"
    session["error"] = None
    session["expiresAt"] = kyc_providers.session_expiry()
    session["authorizationUrl"] = kyc_providers.build_authorization_url(session)
    if session.get("context") == "registration":
        session["returnTo"] = kyc_providers.registration_callback_url(session["id"], session["context"])
    session["updatedAt"] = _now().isoformat()
    await set_doc(KYC_SESSION_COLLECTION, session["id"], session)
    return session


async def apply_provider_result(session_id: str, status: str, identity: dict | None, error: str | None) -> dict:
    """The ONLY way a session reaches a terminal state (besides expiry)."""
    session = await get_session(session_id)
    if session is None:
        return None
    session = await expire_if_needed(session)
    if session.get("status") not in OPEN_STATES:
        return session  # already terminal — never resurrect
    now = _now().isoformat()
    session["status"] = status
    session["identity"] = identity
    session["error"] = error
    session["updatedAt"] = now
    if status == "verified":
        session["completedAt"] = now
        await save_identity_record(session)
    await set_doc(KYC_SESSION_COLLECTION, session_id, session)
    return session


async def save_identity_record(session: dict) -> dict:
    """Persist the required identity record separately from the session so the
    registration-completion check can verify it was really saved."""
    identity = dict(session.get("identity") or {})
    record = {
        "id": session["id"],
        "userId": session["userId"],
        "sessionId": session["id"],
        "provider": session.get("provider"),
        "verificationMode": session.get("provider"),
        "signatureVerified": session.get("provider") == kyc_providers.PROVIDER_SANDBOX,
        "status": "verified",
        "fullName": identity.get("fullName") or "",
        "maskedAadhaar": identity.get("maskedAadhaar") or "",
        "verifiedAt": _now().isoformat(),
    }
    await set_doc(IDENTITY_COLLECTION, session["id"], record)
    return record


async def identity_record_for(session_id: str) -> dict | None:
    return await get_doc(IDENTITY_COLLECTION, session_id)


async def promote_verified_user(session: dict) -> None:
    """Re-verification outside registration (context=profile / feature_gate)
    promotes the user doc directly once a session verifies."""
    if session.get("status") != "verified" or session.get("context") not in ("profile", "feature_gate"):
        return
    identity = session.get("identity") or {}
    user = await get_doc("users", session["userId"]) or {"id": session["userId"]}
    user.update(
        {
            "kycStatus": "verified",
            "kycVerifiedAt": session.get("completedAt"),
            "verifiedName": identity.get("fullName"),
            "maskedAadhaar": identity.get("maskedAadhaar"),
            "verificationMode": session.get("provider"),
            "signatureVerified": session.get("provider") == kyc_providers.PROVIDER_SANDBOX,
        }
    )
    await set_doc("users", session["userId"], user)


async def issue_aadhaar_otp(session: dict, aadhaar_number: str) -> tuple[dict, str]:
    """Aadhaar-OTP flow, mock provider: mint a 6-digit OTP bound to the
    session, store only its salted hash + the MASKED Aadhaar. The raw number
    is never written to the session document (or anywhere else)."""
    otp = f"{secrets.randbelow(1000000):06d}"
    salt = secrets.token_hex(8)
    now = _now()
    session["status"] = "processing"
    session["aadhaarLast4"] = kyc_providers.mask_aadhaar(aadhaar_number)
    session["aadhaarOtpHash"] = _hash_otp(otp, salt)
    session["aadhaarOtpSalt"] = salt
    session["aadhaarOtpExpiresAt"] = (
        now + timedelta(minutes=kyc_providers.AADHAAR_OTP_TTL_MINUTES)
    ).isoformat()
    session["aadhaarAttempts"] = 0
    session["error"] = None
    session["updatedAt"] = now.isoformat()
    await set_doc(KYC_SESSION_COLLECTION, session["id"], session)
    return session, otp


async def verify_aadhaar_otp(session: dict, user: dict, otp: str) -> tuple[dict, str | None]:
    """Validate the submitted OTP against the session-bound hash.

    Returns (session, error_code). Wrong OTPs bump the attempt counter;
    exhausting the attempts fails the session terminally (a fresh session is
    required to retry). Success routes through ``apply_provider_result`` so
    the identity record + completion checks stay single-channeled."""
    session = await expire_if_needed(session)
    if session.get("status") not in OPEN_STATES:
        return session, "SESSION_NOT_OPEN"
    expires_at = _parse_ts(session.get("aadhaarOtpExpiresAt"))
    if expires_at is None or _now() >= expires_at:
        return session, "OTP_EXPIRED"
    attempts = int(session.get("aadhaarAttempts") or 0)
    if attempts >= kyc_providers.AADHAAR_OTP_MAX_ATTEMPTS:
        session = await apply_provider_result(session["id"], "failed", None, "too_many_attempts")
        return session, "TOO_MANY_ATTEMPTS"
    expected = session.get("aadhaarOtpHash") or ""
    if not hmac.compare_digest(expected, _hash_otp(otp.strip(), session.get("aadhaarOtpSalt") or "")):
        attempts += 1
        session["aadhaarAttempts"] = attempts
        session["updatedAt"] = _now().isoformat()
        await set_doc(KYC_SESSION_COLLECTION, session["id"], session)
        if attempts >= kyc_providers.AADHAAR_OTP_MAX_ATTEMPTS:
            session = await apply_provider_result(session["id"], "failed", None, "too_many_attempts")
            return session, "TOO_MANY_ATTEMPTS"
        return session, "OTP_INVALID"
    identity = kyc_providers.aadhaar_okyc_identity(user, session)
    session = await apply_provider_result(session["id"], "verified", identity, None)
    return session, None


def public_session(session: dict) -> dict:
    """Session shape safe for the registering/authenticated user."""
    identity = session.get("identity") or {}
    return {
        "id": session["id"],
        "context": session.get("context"),
        "provider": session.get("provider"),
        "method": session.get("method") or kyc_providers.METHOD_DIGILOCKER,
        "status": session.get("status"),
        "authorizationUrl": session.get("authorizationUrl"),
        "returnTo": session.get("returnTo"),
        "expiresAt": session.get("expiresAt"),
        "createdAt": session.get("createdAt"),
        "updatedAt": session.get("updatedAt"),
        "error": session.get("error"),
        "verifiedName": identity.get("fullName") or None,
        "maskedAadhaar": identity.get("maskedAadhaar") or None,
        "aadhaarLast4": session.get("aadhaarLast4") or None,
        "consentAccepted": bool(session.get("consentAccepted")),
    }
