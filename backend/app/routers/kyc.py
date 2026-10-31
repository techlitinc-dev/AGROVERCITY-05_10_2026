"""KYC router (WS-04): case submission, status, and signed-URL document upload.

Never stores unmasked Aadhaar — callers submit storage paths/masked references.

Registration-integrated identity verification (DigiLocker-style sessions):
  GET  /kyc/me                       — registration/KYC state (onboarding or full token)
  POST /kyc/sessions                 — create (idempotent) verification session
                                       (sandbox provider: also opens the Sandbox
                                       DigiLocker session and stores its auth URL)
  GET  /kyc/sessions/oauth/callback  — Sandbox DigiLocker browser redirect target;
                                       reconciles the session with Sandbox, then
                                       back to returnTo
  GET  /kyc/sessions/{id}            — poll session status (backend is the only
                                       truth; sandbox sessions sync lazily here)
  POST /kyc/sessions/{id}/refresh    — rotate the authorization URL for retry
  GET  /kyc/sessions/{id}/documents  — documents pulled for a sandbox session (owner)
  POST /kyc/sessions/{id}/provider-callback — mock screen approve/deny
"""
import logging
import uuid

from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.db import get_doc, set_doc
from app.core.deps import current_user_id, onboarding_user_id
from app.core.ratelimit import hit
from app.services import digilocker, kyc as kyc_service
from app.services import kyc_documents, kyc_providers, kyc_sessions, storage
from app.services.tokens import decode_token

router = APIRouter(prefix="/kyc", tags=["kyc"])

logger = logging.getLogger(__name__)

KYC_CONTENT_TYPES = {"image/jpeg", "image/png", "application/pdf"}

SANDBOX_DOC_TYPES = ["aadhaar", "pan", "driving_license"]
SANDBOX_PURPOSE = "Know Your Customer"
SANDBOX_REQUESTOR_NAME = "Agrovercity"


async def _init_sandbox_session(session: dict) -> dict:
    """Ask Sandbox for the real DigiLocker authorization URL and bind the
    Sandbox session id to our kyc session doc."""
    redirect_base = (settings.sandbox_api_redirect_base or "").rstrip("/")
    if not redirect_base:
        _error(500, "KYC_PROVIDER_MISCONFIGURED", "sandbox_api_redirect_base is not configured")
    redirect_url = f"{redirect_base}/v1/kyc/sessions/oauth/callback?s={session['id']}"
    try:
        result = await digilocker.init_session(
            redirect_url=redirect_url,
            doc_types=SANDBOX_DOC_TYPES,
            purpose=SANDBOX_PURPOSE,
            requestor_name=SANDBOX_REQUESTOR_NAME,
        )
    except digilocker.DigiLockerError as exc:
        _error(502, exc.code, exc.message)
    session["sandboxSessionId"] = result["session_id"]
    session["authorizationUrl"] = result["authorization_url"]
    session["lastSandboxSyncAt"] = None
    await set_doc(kyc_sessions.KYC_SESSION_COLLECTION, session["id"], session)
    return session

KYC_CONTENT_TYPES = {"image/jpeg", "image/png", "application/pdf"}


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


class KycDocIn(BaseModel):
    type: str
    storagePath: str | None = None
    expiresAt: str | None = None
    extractedRef: str | None = None


class KycCaseIn(BaseModel):
    persona: str = Field(..., min_length=1)
    docs: list[KycDocIn] = Field(default_factory=list)


@router.post("/cases", status_code=201)
async def submit_kyc_case(body: KycCaseIn, uid: str = Depends(current_user_id)):
    try:
        case = await kyc_service.submit_case(
            uid, body.persona, [doc.model_dump() for doc in body.docs]
        )
    except ValueError as exc:
        _error(422, "INVALID_DOCUMENT_MATRIX", str(exc))
    return {"case": case, "requiredDocs": kyc_service.doc_matrix_for(body.persona)}


@router.get("/status")
async def kyc_status(uid: str = Depends(current_user_id)):
    cases = await kyc_service.cases_for_user(uid)
    return {"data": cases, "total": len(cases)}


@router.post("/cases/{case_id}/docs/{doc_id}/upload", status_code=201)
async def upload_kyc_document(
    case_id: str,
    doc_id: str,
    file: UploadFile = File(...),
    uid: str = Depends(current_user_id),
):
    case = await kyc_service.get_case(case_id)
    if case is None:
        _error(404, "KYC_CASE_NOT_FOUND", "kyc case not found")
    if case.get("userId") != uid:
        _error(403, "FORBIDDEN", "not your kyc case")
    if file.content_type not in KYC_CONTENT_TYPES:
        _error(400, "VALIDATION_ERROR", "unsupported content type", {"file": file.content_type})
    data = await file.read()
    if len(data) > storage.MAX_UPLOAD_BYTES:
        _error(400, "VALIDATION_ERROR", "file exceeds 5 MB", {"file": "too large"})
    blob_path, _ = storage.upload_user_file(
        uid,
        data,
        file.filename or f"{uuid.uuid4().hex}.bin",
        file.content_type,
        prefix="kyc",
    )
    try:
        updated = await kyc_service.reupload_doc(case_id, doc_id, blob_path)
    except ValueError:
        _error(404, "KYC_DOC_NOT_FOUND", "document not found in case")
    return {"case": updated, "fileUrl": storage.signed_download_url(blob_path)}


# ==========================================
# Registration-integrated identity verification (KYC sessions)
# ==========================================


class KycSessionCreateIn(BaseModel):
    returnTo: str | None = None
    context: str = "registration"
    consentAccepted: bool = False
    # Verification method: digilocker (consent redirect) or aadhaar_okyc
    # (Aadhaar number + OTP — mock/test provider only; UIDAI discontinued
    # offline e-KYC, so live providers must use DigiLocker).
    method: str = "digilocker"


class KycAadhaarOtpIn(BaseModel):
    aadhaarNumber: str
    consentAccepted: bool = False


class KycAadhaarVerifyIn(BaseModel):
    otp: str


class KycProviderCallbackIn(BaseModel):
    # Mock provider: "approve" | "deny"
    decision: str | None = None


async def _kyc_user_id(authorization: str | None = Header(None)) -> str:
    """Accepts the restricted onboarding token OR a full access token."""
    if not authorization or not authorization.startswith("Bearer "):
        _error(401, "MISSING_TOKEN", "missing or malformed Authorization header")
    raw = authorization[len("Bearer "):]
    try:
        return decode_token(raw, "onboarding")
    except HTTPException:
        return decode_token(raw, "access")


def _require_session_owner(session: dict | None, uid: str):
    if session is None:
        _error(404, "KYC_SESSION_NOT_FOUND", "no such kyc session")
    if session.get("userId") != uid:
        _error(403, "FORBIDDEN", "not your kyc session")


@router.get("/me")
async def kyc_me(uid: str = Depends(_kyc_user_id)):
    """Registration/KYC state for the onboarding journey (step polling, resume)."""
    user = await get_doc("users", uid) or {}
    latest = await kyc_sessions.open_session_for(uid, "registration")
    identity = None
    if latest and latest.get("status") == "verified":
        identity = latest.get("identity") or {}
    return {
        "registrationStatus": user.get("registrationStatus") or "completed",
        "kycStatus": user.get("kycStatus") or "unverified",
        "kycVerifiedAt": user.get("kycVerifiedAt"),
        "verifiedName": (identity or {}).get("fullName") or user.get("verifiedName"),
        "maskedAadhaar": (identity or {}).get("maskedAadhaar") or user.get("maskedAadhaar"),
        "verificationMode": user.get("verificationMode"),
        "provider": latest.get("provider") if latest else kyc_providers.active_provider(),
        "session": kyc_sessions.public_session(latest) if latest else None,
        "testMode": kyc_providers.active_provider() == kyc_providers.PROVIDER_MOCK,
    }


@router.post("/sessions", status_code=201)
async def create_kyc_session(body: KycSessionCreateIn, uid: str = Depends(_kyc_user_id)):
    """Create (or reuse) a verification session. For context=registration the
    post-authorization returnTo is ALWAYS the registration callback — provider
    switching must not change that. Duplicate open sessions for the same
    method are never created; switching method starts a parallel session."""
    context = (body.context or "").strip()
    if context not in kyc_sessions.KNOWN_CONTEXTS:
        _error(422, "VALIDATION_ERROR", "context must be one of registration, profile, feature_gate", {"context": "unsupported context"})
    if not body.consentAccepted:
        _error(422, "CONSENT_REQUIRED", "explicit consent is required before identity verification", {"consentAccepted": "consent is required"})
    method = (body.method or kyc_providers.METHOD_DIGILOCKER).strip().lower()
    if method not in kyc_providers.KNOWN_METHODS:
        _error(422, "VALIDATION_ERROR", "method must be one of digilocker, aadhaar_okyc", {"method": "unsupported method"})
    if method == kyc_providers.METHOD_AADHAAR_OKYC and kyc_providers.active_provider() != kyc_providers.PROVIDER_MOCK:
        # UIDAI discontinued Aadhaar offline e-KYC; Sandbox's Aadhaar-OTP
        # endpoints are dead upstream. The compliant live route is DigiLocker.
        _error(
            409,
            "AADHAAR_OKYC_DISCONTINUED",
            "Aadhaar-number OTP verification is unavailable on this server — continue with DigiLocker",
        )
    if context == "registration":
        user = await get_doc("users", uid) or {}
        if user.get("registrationStatus") == "completed":
            _error(409, "REGISTRATION_ALREADY_COMPLETED", "registration is already complete")
    session = await kyc_sessions.create_session(uid, context, body.consentAccepted, method)
    if context == "registration":
        # Hard override: registration always returns to the registration callback.
        session["returnTo"] = kyc_providers.registration_callback_url(session["id"], context)
        if method == kyc_providers.METHOD_DIGILOCKER:
            session["authorizationUrl"] = kyc_providers.build_authorization_url(session)
        await set_doc(kyc_sessions.KYC_SESSION_COLLECTION, session["id"], session)
    if session.get("provider") == kyc_providers.PROVIDER_SANDBOX and method == kyc_providers.METHOD_DIGILOCKER:
        session = await _init_sandbox_session(session)
    return {"session": kyc_sessions.public_session(session)}


@router.get("/sessions/oauth/callback")
async def digilocker_oauth_callback(
    s: str | None = None,
    code: str | None = None,
    state: str | None = None,
    action: str | None = None,
):
    """Sandbox DigiLocker browser redirect target — this URL (including the
    ``?s=<kyc session id>`` we embed) is handed to Sandbox as the session's
    redirect_url; DigiLocker appends ``code`` & ``state`` after consent.

    The redirect parameters are never trusted as proof: the backend
    re-pulls the session outcome from Sandbox's API, marks our session
    accordingly, then 303s to the session's ``returnTo`` — the registration
    callback page picks up the terminal state as usual.
    """
    await hit("kyc_oauth_callback", (s or state or code or "unknown"), 20, 300)
    session = await kyc_sessions.get_session((s or "").strip())
    if session is None:
        _error(404, "KYC_SESSION_NOT_FOUND", "no such kyc session")
    provider = session.get("provider") or kyc_providers.active_provider()
    if provider != kyc_providers.PROVIDER_SANDBOX:
        _error(409, "KYC_PROVIDER_NOT_SANDBOX", "the oauth callback only serves sandbox sessions")
    session = await kyc_sessions.expire_if_needed(session)
    if session.get("status") in kyc_sessions.OPEN_STATES:
        if (action or "").strip().lower() == "cancel":
            session = await kyc_sessions.apply_provider_result(session["id"], "denied", None, "consent_denied")
        else:
            # The consent screen just closed — reconcile with Sandbox now so
            # the redirect lands on an already-resolved session.
            session = await kyc_documents.sync_sandbox_session(session, force=True)
    return RedirectResponse(session["returnTo"], status_code=303)


@router.get("/sessions/{session_id}")
async def get_kyc_session(session_id: str, uid: str = Depends(_kyc_user_id)):
    """Poll endpoint — the ONLY source of truth the registration callback uses.
    Sandbox sessions reconcile lazily here (throttled), so the poll that runs
    after the browser returns from DigiLocker converges without extra calls."""
    session = await kyc_sessions.get_session(session_id)
    _require_session_owner(session, uid)
    session = await kyc_sessions.expire_if_needed(session)
    if session.get("provider") == kyc_providers.PROVIDER_SANDBOX:
        session = await kyc_documents.sync_sandbox_session(session)
    return {"session": kyc_sessions.public_session(session)}


@router.post("/sessions/{session_id}/refresh")
async def refresh_kyc_session(session_id: str, uid: str = Depends(_kyc_user_id)):
    """Retry support after failure/expiry: rotate the authorization URL (a
    sandbox session also gets a fresh Sandbox DigiLocker session)."""
    session = await kyc_sessions.get_session(session_id)
    _require_session_owner(session, uid)
    session = await kyc_sessions.refresh_session(session)
    if (
        session.get("provider") == kyc_providers.PROVIDER_SANDBOX
        and (session.get("method") or kyc_providers.METHOD_DIGILOCKER) == kyc_providers.METHOD_DIGILOCKER
        and session.get("status") in kyc_sessions.OPEN_STATES
    ):
        session = await _init_sandbox_session(session)
    return {"session": kyc_sessions.public_session(session)}


@router.get("/sessions/{session_id}/documents")
async def list_session_documents(session_id: str, uid: str = Depends(_kyc_user_id)):
    """Documents pulled from DigiLocker for a sandbox session (owner only).
    Extracted Aadhaar fields are masked — the raw files stay in object storage."""
    session = await kyc_sessions.get_session(session_id)
    _require_session_owner(session, uid)
    docs = await kyc_documents.documents_for_session(session_id)
    return {
        "documents": [
            {
                "id": d.get("id"),
                "docType": d.get("docType"),
                "name": d.get("name"),
                "issuer": d.get("issuer"),
                "contentType": d.get("contentType"),
                "sizeBytes": d.get("sizeBytes"),
                "isAadhaar": bool(d.get("isAadhaar")),
                "extracted": d.get("extracted"),
                "fileUrl": storage.signed_download_url(d["storagePath"]),
                "pulledAt": d.get("pulledAt"),
            }
            for d in docs
        ]
    }


@router.post("/sessions/{session_id}/aadhaar-otp")
async def send_aadhaar_otp(session_id: str, body: KycAadhaarOtpIn, uid: str = Depends(_kyc_user_id)):
    """Aadhaar-OTP (mock provider): bind a 12-digit Aadhaar number to the
    session and issue an OTP. In mock mode no SMS is sent — the dev OTP is
    returned in the response (same dev-mode contract as /auth/otp/send).
    Only the masked Aadhaar (last 4) is ever stored."""
    session = await kyc_sessions.get_session(session_id)
    _require_session_owner(session, uid)
    session = await kyc_sessions.expire_if_needed(session)
    if session.get("method") != kyc_providers.METHOD_AADHAAR_OKYC:
        _error(409, "WRONG_METHOD", "this session is not an Aadhaar-OTP session")
    if session.get("status") not in kyc_sessions.OPEN_STATES:
        _error(409, "SESSION_NOT_OPEN", "this verification session is already concluded")
    aadhaar = (body.aadhaarNumber or "").strip()
    if len(aadhaar) != 12 or not aadhaar.isdigit():
        _error(422, "VALIDATION_ERROR", "Aadhaar number must be exactly 12 digits", {"aadhaarNumber": "12 digits required"})
    if not body.consentAccepted:
        _error(422, "CONSENT_REQUIRED", "explicit consent is required before identity verification", {"consentAccepted": "consent is required"})
    session, dev_otp = await kyc_sessions.issue_aadhaar_otp(session, aadhaar)
    return {"session": kyc_sessions.public_session(session), "referenceId": session["id"], "devOtp": dev_otp}


@router.post("/sessions/{session_id}/aadhaar-verify")
async def verify_aadhaar_otp(session_id: str, body: KycAadhaarVerifyIn, uid: str = Depends(_kyc_user_id)):
    """Validate the OTP entered by the user. On success the session becomes
    verified through the single result channel — the registration callback
    then completes the journey exactly like the DigiLocker flow."""
    session = await kyc_sessions.get_session(session_id)
    _require_session_owner(session, uid)
    otp = (body.otp or "").strip()
    if len(otp) != 6 or not otp.isdigit():
        _error(422, "VALIDATION_ERROR", "OTP must be exactly 6 digits", {"otp": "6 digits required"})
    user = await get_doc("users", uid) or {}
    session, err = await kyc_sessions.verify_aadhaar_otp(session, user, otp)
    if err == "SESSION_NOT_OPEN":
        _error(409, "SESSION_NOT_OPEN", "this verification session is already concluded")
    if err == "OTP_EXPIRED":
        _error(400, "OTP_EXPIRED", "OTP expired — request a fresh one")
    if err == "OTP_INVALID":
        _error(400, "OTP_INVALID", "incorrect OTP")
    if err == "TOO_MANY_ATTEMPTS":
        _error(429, "OTP_TOO_MANY_ATTEMPTS", "too many attempts — start a fresh verification")
    return {"session": kyc_sessions.public_session(session)}


@router.post("/sessions/{session_id}/provider-callback")
async def kyc_provider_callback(
    session_id: str,
    body: KycProviderCallbackIn,
):
    """Mock-provider result endpoint: the internal mock DigiLocker screen posts
    its approve/deny decision. No passwords, OTPs or real Aadhaar are ever
    requested; approval mints a synthetic masked identity. Sandbox sessions do
    NOT use this endpoint — they reconcile through polling /
    /sessions/oauth/callback against Sandbox's API, where the backend is the
    only party that talks to the provider.
    """
    await hit("kyc_provider_callback", session_id, 20, 300)
    session = await kyc_sessions.get_session(session_id)
    if session is None:
        _error(404, "KYC_SESSION_NOT_FOUND", "no such kyc session")
    provider = session.get("provider") or kyc_providers.active_provider()
    if provider != kyc_providers.PROVIDER_MOCK:
        _error(
            409,
            "KYC_PROVIDER_NOT_MOCK",
            "sandbox sessions reconcile via /sessions/oauth-callback and polling, not provider-callback",
        )

    decision = (body.decision or "").strip().lower()
    if decision == "approve":
        user = await get_doc("users", session["userId"]) or {}
        identity = kyc_providers.mock_identity(user, session_id)
        session = await kyc_sessions.apply_provider_result(session_id, "verified", identity, None)
    elif decision == "deny":
        session = await kyc_sessions.apply_provider_result(
            session_id, "denied", None, "consent_denied"
        )
    else:
        _error(422, "VALIDATION_ERROR", "decision must be approve or deny", {"decision": "approve|deny"})

    await kyc_sessions.promote_verified_user(session)
    return {"session": kyc_sessions.public_session(session)}
