"""Sandbox.co.in KYC API client — the real-provider leg of DigiLocker KYC.

DigiLocker verification runs through Sandbox (a certified TSP):
  1. ``init_session``    → Sandbox returns the DigiLocker authorization URL
                           the user is redirected to (plus a Sandbox session id
                           we store on our own kyc session doc).
  2. User consents on DigiLocker; Sandbox's session flips to ``succeeded``.
  3. ``get_session_status`` / ``get_user_profile`` / ``get_documents`` pull the
                           outcome; document files download from short-lived
                           pre-signed S3 URLs.

Auth: POST /authenticate with x-api-key/x-api-secret yields a 24h access
token (cached here). API envelope: ``{code, timestamp, data|message,
transaction_id}`` — a non-200 ``code`` is an error.

Only masked Aadhaar references ever leave this module — a raw Aadhaar number
is never persisted.
"""
import base64
import logging
import time
import xml.etree.ElementTree as ET

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class DigiLockerError(Exception):
    """Upstream Sandbox/DigiLocker call failed or returned an unusable payload."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


# --- authentication ---------------------------------------------------------

_token_cache: dict = {"token": None, "expires_at": 0.0}
TOKEN_TTL_SECONDS = 23 * 3600  # issued for 24h; refresh an hour early


def _timeout() -> httpx.Timeout:
    return httpx.Timeout(settings.sandbox_api_timeout_seconds)


def _require_config():
    if not settings.sandbox_api_key or not settings.sandbox_api_secret:
        raise DigiLockerError(
            "KYC_PROVIDER_MISCONFIGURED",
            "sandbox API key/secret are not configured",
        )


def _auth_headers() -> dict:
    return {
        "x-api-key": settings.sandbox_api_key,
        "x-api-secret": settings.sandbox_api_secret,
        "x-api-version": settings.sandbox_api_version,
        "Content-Type": "application/json",
    }


async def access_token(force_refresh: bool = False) -> str:
    """Sandbox access token, cached for TOKEN_TTL_SECONDS."""
    now = time.time()
    if not force_refresh and _token_cache["token"] and now < _token_cache["expires_at"]:
        return _token_cache["token"]
    _require_config()
    async with httpx.AsyncClient(timeout=_timeout()) as http:
        try:
            res = await http.post(f"{settings.sandbox_api_base_url}/authenticate", headers=_auth_headers())
        except httpx.HTTPError as exc:
            raise DigiLockerError("SANDBOX_UNREACHABLE", f"authenticate failed: {exc}") from exc
    payload = _envelope(res, "SANDBOX_AUTH_FAILED")
    token = (payload.get("data") or {}).get("access_token")
    if not token:
        raise DigiLockerError("SANDBOX_AUTH_FAILED", "authenticate response has no access_token")
    _token_cache["token"] = token
    _token_cache["expires_at"] = now + TOKEN_TTL_SECONDS
    return token


def _envelope(res: httpx.Response, error_code: str) -> dict:
    try:
        payload = res.json()
    except ValueError as exc:
        raise DigiLockerError(error_code, f"HTTP {res.status_code}: non-JSON response") from exc
    if res.status_code != 200 or payload.get("code") != 200:
        message = payload.get("message") or f"HTTP {res.status_code}"
        raise DigiLockerError(error_code, message)
    return payload


async def _get(path: str, error_code: str) -> dict:
    token = await access_token()
    headers = {
        "x-api-key": settings.sandbox_api_key,
        "authorization": token,
        "x-api-version": settings.sandbox_api_version,
    }
    async with httpx.AsyncClient(timeout=_timeout()) as http:
        try:
            res = await http.get(f"{settings.sandbox_api_base_url}{path}", headers=headers)
        except httpx.HTTPError as exc:
            raise DigiLockerError("SANDBOX_UNREACHABLE", f"GET {path} failed: {exc}") from exc
    if res.status_code == 401:
        # Token expired early / revoked — refresh once and retry.
        token = await access_token(force_refresh=True)
        headers["authorization"] = token
        async with httpx.AsyncClient(timeout=_timeout()) as http:
            res = await http.get(f"{settings.sandbox_api_base_url}{path}", headers=headers)
    return _envelope(res, error_code)


# --- DigiLocker session APIs -------------------------------------------------

DOC_TYPES = ("aadhaar", "pan", "driving_license")


async def init_session(redirect_url: str, doc_types: list[str], purpose: str, requestor_name: str) -> dict:
    """Create a Sandbox DigiLocker session. Returns
    {authorization_url, session_id}. The redirect_url must be a public HTTPS
    URL of THIS backend (the oauth callback carries our session id)."""
    _require_config()
    body = {
        "@entity": "in.co.sandbox.kyc.digilocker.session.request",
        "flow": "signin",
        "redirect_url": redirect_url,
        "doc_types": doc_types,
        "purpose": purpose,
        "requestor_name": requestor_name,
    }
    token = await access_token()
    headers = {
        "x-api-key": settings.sandbox_api_key,
        "authorization": token,
        "x-api-version": settings.sandbox_api_version,
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=_timeout()) as http:
        try:
            res = await http.post(
                f"{settings.sandbox_api_base_url}/kyc/digilocker/sessions/init",
                headers=headers,
                json=body,
            )
        except httpx.HTTPError as exc:
            raise DigiLockerError("SANDBOX_UNREACHABLE", f"session init failed: {exc}") from exc
    payload = _envelope(res, "SANDBOX_SESSION_INIT_FAILED")
    data = payload.get("data") or {}
    if not data.get("authorization_url") or not data.get("session_id"):
        raise DigiLockerError("SANDBOX_SESSION_INIT_FAILED", "init response is missing session fields")
    return {"authorization_url": data["authorization_url"], "session_id": data["session_id"]}


async def get_session_status(sandbox_session_id: str) -> dict:
    """Sandbox session state: created | succeeded | failed | expired, plus
    documents_consented when succeeded."""
    payload = await _get(
        f"/kyc/digilocker/sessions/{sandbox_session_id}/status",
        "SANDBOX_STATUS_FAILED",
    )
    data = payload.get("data") or {}
    if not data.get("status"):
        raise DigiLockerError("SANDBOX_STATUS_FAILED", "status response has no status")
    return data


async def get_user_profile(sandbox_session_id: str) -> dict:
    """DigiLocker user profile: name, dob (epoch ms), gender, mobile, email,
    eaadhaar flag, digilocker id."""
    payload = await _get(
        f"/kyc/digilocker/sessions/{sandbox_session_id}/user/profile",
        "SANDBOX_PROFILE_FAILED",
    )
    data = payload.get("data") or {}
    if not data.get("name") and not data.get("id"):
        raise DigiLockerError("SANDBOX_PROFILE_FAILED", "profile response is empty")
    return data


async def get_documents(sandbox_session_id: str, doc_type: str) -> list[dict]:
    """File list for one consented doc type: pre-signed S3 urls + metadata."""
    payload = await _get(
        f"/kyc/digilocker/sessions/{sandbox_session_id}/documents/{doc_type}",
        "SANDBOX_DOCUMENTS_FAILED",
    )
    files = (payload.get("data") or {}).get("files") or []
    return [f for f in files if isinstance(f, dict) and f.get("url")]


async def download_file(url: str) -> tuple[bytes, str]:
    """Download a document from its pre-signed S3 URL (no auth headers —
    the signature is in the query string)."""
    async with httpx.AsyncClient(timeout=_timeout(), follow_redirects=True) as http:
        try:
            res = await http.get(url)
        except httpx.HTTPError as exc:
            raise DigiLockerError("DIGILOCKER_UNREACHABLE", f"document download failed: {exc}") from exc
    if res.status_code != 200:
        raise DigiLockerError("DOCUMENT_DOWNLOAD_FAILED", f"download returned HTTP {res.status_code}")
    return res.content, res.headers.get("content-type", "application/octet-stream")


# --- Aadhaar offline-KYC XML parsing ----------------------------------------


def _localname(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _find(root: ET.Element, name: str) -> ET.Element | None:
    for elem in root.iter():
        if _localname(elem.tag) == name:
            return elem
    return None


def parse_aadhaar_xml(data: bytes) -> dict | None:
    """Parse an Aadhaar offline-KYC XML document.

    Returns {maskedAadhaar, fullName, dob, gender, address, photoBase64} or
    None when the content is not an Aadhaar offline-KYC document. The uid in
    the XML is normalized through the masker — even if a provider ever sends
    an unmasked value, only the masked form survives.
    """
    from app.services.kyc_providers import mask_aadhaar

    try:
        root = ET.fromstring(data)
    except ET.ParseError:
        return None
    uid_data = _find(root, "UidData")
    if uid_data is None:
        return None
    masked = mask_aadhaar(uid_data.attrib.get("uid") or "")
    poi = _find(root, "Poi")
    poa = _find(root, "Poa")
    photo = _find(root, "Photo")
    address = ""
    if poa is not None:
        parts = [
            poa.attrib.get(key)
            for key in ("house", "street", "loc", "vtc", "dist", "state", "pc", "country")
            if poa.attrib.get(key)
        ]
        address = ", ".join(parts)
    return {
        "maskedAadhaar": masked,
        "fullName": (poi.attrib.get("name") or "").strip() if poi is not None else "",
        "dob": (poi.attrib.get("dob") or "").strip() if poi is not None else "",
        "gender": (poi.attrib.get("gender") or "").strip() if poi is not None else "",
        "address": address,
        "photoBase64": (photo.text or "").strip() if photo is not None else "",
    }


def looks_like_aadhaar(name: str, doc_type: str, content_type: str, data: bytes) -> bool:
    """Heuristic: is this pulled document the Aadhaar offline-KYC file?"""
    lowered = f"{name} {doc_type}".lower()
    if "aadhaar" in lowered:
        return True
    if "xml" in content_type.lower() and data.lstrip()[:1] == b"<":
        return parse_aadhaar_xml(data) is not None
    return False


def identity_from_profile(profile: dict) -> dict:
    """Identity fields from the DigiLocker user profile (used as fallback when
    no Aadhaar XML was pulled)."""
    dob = ""
    raw_dob = profile.get("date_of_birth")
    if isinstance(raw_dob, (int, float)) and raw_dob:
        dob = time.strftime("%Y-%m-%d", time.gmtime(raw_dob / 1000))
    return {
        "maskedAadhaar": "",
        "fullName": (profile.get("name") or "").strip(),
        "dob": dob,
        "gender": (profile.get("gender") or "").strip(),
        "address": "",
        "digilockerId": profile.get("id") or "",
        "mobile": profile.get("mobile") or "",
        "email": profile.get("email") or "",
    }


def save_photo_b64(uid: str, photo_base64: str) -> str:
    """Decode + store the Aadhaar photo; returns the storage path ('' on any
    failure — a photo is nice-to-have, never a verification blocker)."""
    from app.services import storage

    if not photo_base64:
        return ""
    try:
        data = base64.b64decode(photo_base64)
    except Exception:  # noqa: BLE001 — malformed provider payload must not fail KYC
        return ""
    try:
        path, _ = storage.upload_user_file(uid, data, "aadhaar_photo.jpg", "image/jpeg", prefix="digilocker")
    except Exception:  # noqa: BLE001 — storage is best-effort for the photo
        logger.warning("aadhaar photo storage failed for uid=%s", uid, exc_info=True)
        return ""
    return path
