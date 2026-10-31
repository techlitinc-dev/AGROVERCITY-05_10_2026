"""DigiLocker document pull + storage for sandbox KYC sessions.

For a sandbox session the user's consent completes on DigiLocker itself;
``sync_sandbox_session`` asks Sandbox for the outcome and, on success, pulls
the user's profile and consented documents. Each document file is stored in
object storage and a metadata record lands in the ``kyc_documents`` collection
so the fetched data is available to the platform later.

The verification identity itself stays masked-only (name + masked Aadhaar +
demographics from the Aadhaar offline-KYC XML, falling back to the DigiLocker
user profile).
"""
import logging
import secrets
from datetime import datetime, timezone

from app.core.db import query, set_doc
from app.services import digilocker, storage

logger = logging.getLogger(__name__)

KYC_DOCUMENTS_COLLECTION = "kyc_documents"
MAX_DOCS_PER_SESSION = 10
# Poll throttle: how often an open session may hit Sandbox's status endpoint.
SYNC_INTERVAL_SECONDS = 20


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_ts(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def sync_due(session: dict, force: bool = False) -> bool:
    if force:
        return True
    last = _parse_ts(session.get("lastSandboxSyncAt"))
    if last is None:
        return True
    return (datetime.now(timezone.utc) - last).total_seconds() >= SYNC_INTERVAL_SECONDS


async def sync_sandbox_session(session: dict, force: bool = False) -> dict:
    """Reconcile an open sandbox session with Sandbox's status.

    - created  → leave open (throttled by ``sync_due``)
    - failed   → terminal ``failed``
    - expired  → terminal ``failed`` (upstream access token no longer valid)
    - succeeded → pull profile + consented documents, store them, and mark
      the session verified through the single result channel

    Returns the (possibly updated) session doc. Never raises for upstream
    failures — the session is marked failed instead.
    """
    from app.services import kyc_sessions

    sandbox_id = (session.get("sandboxSessionId") or "").strip()
    if not sandbox_id:
        return session
    if session.get("status") not in kyc_sessions.OPEN_STATES or not sync_due(session, force):
        return session

    session["lastSandboxSyncAt"] = _now()
    await set_doc(kyc_sessions.KYC_SESSION_COLLECTION, session["id"], session)

    try:
        status = await digilocker.get_session_status(sandbox_id)
    except digilocker.DigiLockerError as exc:
        # Upstream hiccup: keep the session open, retry on the next poll.
        logger.warning("sandbox status poll failed session=%s: %s", session["id"], exc.message)
        return session

    state = status.get("status")
    if state == "created":
        return session
    if state in ("failed", "expired"):
        error = "session_expired_upstream" if state == "expired" else "provider_failed"
        return await kyc_sessions.apply_provider_result(session["id"], "failed", None, error)

    # succeeded — pull the documents + profile.
    try:
        identity, _records = await pull_and_store_documents(session, status)
    except digilocker.DigiLockerError as exc:
        logger.warning("sandbox document pull failed session=%s: %s", session["id"], exc.message)
        return await kyc_sessions.apply_provider_result(session["id"], "failed", None, exc.code)
    session = await kyc_sessions.apply_provider_result(session["id"], "verified", identity, None)
    await kyc_sessions.promote_verified_user(session)
    return session


async def pull_and_store_documents(session: dict, sandbox_status: dict) -> tuple[dict, list[dict]]:
    """Fetch the consented documents + profile for a succeeded sandbox session
    and store everything. Returns (identity, document_records). Raises
    DigiLockerError(AADHAAR_NOT_AVAILABLE) when no Aadhaar reference exists
    in any pulled source."""
    uid = session["userId"]
    sandbox_id = session["sandboxSessionId"]
    doc_types = sandbox_status.get("documents_consented") or ["aadhaar"]
    if "aadhaar" not in doc_types:
        doc_types = ["aadhaar", *[d for d in doc_types if d]]

    profile: dict = {}
    try:
        profile = await digilocker.get_user_profile(sandbox_id)
    except digilocker.DigiLockerError as exc:
        logger.warning("sandbox profile fetch failed session=%s: %s", session["id"], exc.message)
    identity = digilocker.identity_from_profile(profile)
    photo_path = ""
    records = []

    for doc_type in doc_types:
        try:
            files = await digilocker.get_documents(sandbox_id, doc_type)
        except digilocker.DigiLockerError as exc:
            logger.warning("sandbox document list failed session=%s type=%s: %s", session["id"], doc_type, exc.message)
            continue
        for item in files[: max(0, MAX_DOCS_PER_SESSION - len(records))]:
            url = item.get("url")
            metadata = item.get("metadata") or {}
            name = (metadata.get("description") or doc_type).strip() or doc_type
            try:
                data, content_type = await digilocker.download_file(url)
            except digilocker.DigiLockerError as exc:
                logger.warning("document download failed session=%s: %s", session["id"], exc.message)
                continue
            filename = f"{doc_type}_{secrets.token_hex(4)}"
            ext = ".xml" if "xml" in content_type else ".jpg" if "jpeg" in content_type or "jpg" in content_type else ".pdf" if "pdf" in content_type else ".bin"
            try:
                storage_path, size = storage.upload_user_file(uid, data, filename + ext, content_type, prefix="digilocker")
            except Exception:  # noqa: BLE001 — storage failure must not fail verification
                logger.warning("document storage failed session=%s", session["id"], exc_info=True)
                continue

            parsed = None
            if digilocker.looks_like_aadhaar(name, doc_type, content_type, data):
                parsed = digilocker.parse_aadhaar_xml(data)
            if parsed:
                for key in ("maskedAadhaar", "fullName", "dob", "gender", "address"):
                    if parsed.get(key):
                        identity[key] = parsed[key]
                if parsed.get("photoBase64") and not photo_path:
                    photo_path = digilocker.save_photo_b64(uid, parsed["photoBase64"])

            record = {
                "id": f"kycd_{secrets.token_hex(8)}",
                "userId": uid,
                "sessionId": session["id"],
                "docType": doc_type,
                "name": name,
                "issuer": metadata.get("issuer") or "",
                "issuerId": metadata.get("issuer_id") or "",
                "contentType": content_type,
                "sizeBytes": size,
                "storagePath": storage_path,
                "isAadhaar": bool(parsed),
                "extracted": (
                    {
                        "maskedAadhaar": parsed.get("maskedAadhaar") or "",
                        "fullName": parsed.get("fullName") or "",
                        "dob": parsed.get("dob") or "",
                        "gender": parsed.get("gender") or "",
                        "address": parsed.get("address") or "",
                    }
                    if parsed
                    else None
                ),
                "pulledAt": _now(),
            }
            await set_doc(KYC_DOCUMENTS_COLLECTION, record["id"], record)
            records.append(record)

    if not identity.get("maskedAadhaar"):
        # Verified-without-Aadhaar is not acceptable for registration KYC.
        raise digilocker.DigiLockerError(
            "AADHAAR_NOT_AVAILABLE",
            "no Aadhaar document was available in the user's DigiLocker",
        )
    if photo_path:
        identity["photoPath"] = photo_path
    return identity, records


async def documents_for_session(session_id: str) -> list[dict]:
    docs = await query(KYC_DOCUMENTS_COLLECTION, [("sessionId", "==", session_id)])
    return sorted(docs, key=lambda d: d.get("pulledAt") or "")
