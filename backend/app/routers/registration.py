"""Registration journey endpoints (steps 2 and 7).

Both endpoints accept ONLY the restricted onboarding token — the surface a
registering user gets before identity verification completes. Completion is
fully server-controlled: the backend re-verifies every precondition (mobile
verification, profile fields, KYC session ownership + verified state, saved
identity record, still-pending registration status) and promotes the account
itself. The frontend can never set kycStatus, registrationStatus,
kycVerifiedAt, verificationMode or signatureVerified directly.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException

from app.core.db import get_doc, set_doc
from app.core.deps import onboarding_user_id
from app.core.security import hash_mpin, validate_mpin_format
from app.models.auth import (
    AuthResponse,
    RegistrationCompleteRequest,
    RegistrationProfileRequest,
)
from app.models.user import PROFILE_ALIASES, VALID_PROFILES
from app.services import kyc_providers, kyc_sessions

router = APIRouter(prefix="/auth/registration", tags=["auth-registration"])


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _public_user(user: dict) -> dict:
    return {k: v for k, v in user.items() if k != "mpinHash"}


def _canonical_persona(raw: str) -> str | None:
    persona = (raw or "").strip()
    if persona in PROFILE_ALIASES:
        return PROFILE_ALIASES[persona]
    return persona if persona in VALID_PROFILES else None


@router.post("/profile")
async def submit_registration_profile(
    body: RegistrationProfileRequest,
    uid: str = Depends(onboarding_user_id),
):
    """Step 2 — basic profile. Idempotent: re-submitting safe fields while
    resuming updates the same account; no duplicate user is ever created."""
    user = await get_doc("users", uid)
    if user is None:
        _error(404, "USER_NOT_FOUND", "no account found for this onboarding session")
    if user.get("registrationStatus") == "completed":
        _error(409, "REGISTRATION_ALREADY_COMPLETED", "registration is already complete")

    name = (body.name or "").strip()
    if not name:
        _error(422, "VALIDATION_ERROR", "name is required", {"name": "required"})
    # Personas: multi-select when provided (first entry = primary), else the
    # legacy single persona field. Every entry must be a valid profile type.
    raw_personas = body.personas if body.personas else [body.persona]
    personas: list[str] = []
    for raw in raw_personas:
        canonical = _canonical_persona(raw)
        if canonical is None:
            _error(422, "INVALID_PROFILE_TYPE", "persona must be a valid profile type", {"persona": "unknown persona"})
        if canonical not in personas:
            personas.append(canonical)
    persona = personas[0]
    if not (body.state or "").strip() or not (body.district or "").strip():
        _error(422, "VALIDATION_ERROR", "state and district are required", {"state": "required", "district": "required"})
    if body.mpin:
        validate_mpin_format(body.mpin)
    if not body.mpin and not user.get("mpinHash"):
        # A brand-new account must set an MPIN at this step — OTP is only for
        # unregistered numbers, so without an MPIN the user would have no
        # login credential ("MPIN is not set for this account" at next login).
        # Accounts that already have an MPIN keep it when the field is
        # omitted (resume idempotency). Checked before any mutation.
        _error(422, "MPIN_REQUIRED", "a 4-digit MPIN is required to secure your new account", {"mpin": "required"})

    linked = list(user.get("linkedProfiles") or [])
    for p in personas:
        if p not in linked:
            linked.append(p)
    user.update(
        {
            "name": name,
            "state": body.state.strip(),
            "district": body.district.strip(),
            "village": (body.village or "").strip(),
            "primaryProfile": persona,
            "activeProfile": persona,
            "linkedProfiles": linked,
            "language": body.language or user.get("language") or "en",
            "preferredLanguage": body.language or user.get("preferredLanguage") or "en",
            "registrationStatus": "pendingKyc",
        }
    )
    if body.farmSizeAcres is not None:
        user["landAreaAcres"] = body.farmSizeAcres
    if body.mpin:
        user["mpinHash"] = hash_mpin(body.mpin)
    await set_doc("users", uid, user)
    return {"user": _public_user(user), "registrationStatus": "pendingKyc"}


@router.post("/complete", response_model=AuthResponse, response_model_exclude_none=True)
async def complete_registration(
    body: RegistrationCompleteRequest,
    user_agent: str | None = Header(None),
    uid: str = Depends(onboarding_user_id),
):
    """Step 7 — server-controlled registration completion. Runs every check
    again server-side; only then sets registrationStatus=completed,
    kycStatus=verified, kycVerifiedAt, and issues the full session."""
    user = await get_doc("users", uid)
    if user is None:
        _error(404, "USER_NOT_FOUND", "no account found for this onboarding session")
    if user.get("registrationStatus") != "pendingKyc":
        _error(
            409,
            "REGISTRATION_NOT_PENDING_KYC",
            "registration cannot be completed from its current state",
        )
    if not user.get("registrationMobileVerifiedAt"):
        _error(403, "REGISTRATION_MOBILE_UNVERIFIED", "mobile number has not been verified")
    missing = [
        field
        for field, ok in (
            ("name", bool((user.get("name") or "").strip())),
            ("persona", bool(user.get("primaryProfile"))),
            ("state", bool((user.get("state") or "").strip())),
            ("district", bool((user.get("district") or "").strip())),
        )
        if not ok
    ]
    if missing:
        _error(422, "REGISTRATION_PROFILE_INCOMPLETE", "required profile fields are incomplete", {f: "required" for f in missing})

    session = await kyc_sessions.get_session((body.sessionId or "").strip())
    if session is None or session.get("userId") != uid:
        _error(403, "FORBIDDEN", "kyc session does not belong to this user")
    session = await kyc_sessions.expire_if_needed(session)
    if session.get("status") != "verified":
        _error(409, "KYC_NOT_VERIFIED", "identity verification has not completed successfully")
    identity_record = await kyc_sessions.identity_record_for(session["id"])
    if identity_record is None or identity_record.get("status") != "verified":
        _error(409, "KYC_IDENTITY_MISSING", "verified identity record was not saved")

    now = datetime.now(timezone.utc).isoformat()
    user.update(
        {
            "registrationStatus": "completed",
            "kycStatus": "verified",
            "kycVerifiedAt": now,
            "verifiedName": identity_record.get("fullName"),
            "maskedAadhaar": identity_record.get("maskedAadhaar"),
            "verificationMode": identity_record.get("verificationMode") or kyc_providers.active_provider(),
            "signatureVerified": bool(identity_record.get("signatureVerified")),
        }
    )
    await set_doc("users", uid, user)

    # Post-completion seeding mirrors /auth/register — must never fail completion.
    try:
        from app.services import onboarding_seed

        personas = user.get("linkedProfiles") or [user.get("primaryProfile") or "farmer"]
        await onboarding_seed.seed_dashboard(uid, personas)
    except Exception:  # noqa: BLE001 — seeding must never fail registration
        pass

    from app.routers.auth import _issue_session

    pair = await _issue_session(uid, user_agent, user)
    return AuthResponse(
        accessToken=pair["accessToken"],
        refreshToken=pair["refreshToken"],
        isNewUser=False,
        user=_public_user(user),
    )
