"""DPDP data export + privacy endpoints (WS-04 F23)."""
import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.services.consents import get_consents
from app.services.notify import notify_user
from app.services.storage import signed_download_url, upload_user_file

router = APIRouter(prefix="/users/me", tags=["privacy"])

EXPORT_COLLECTION = "data_exports"

# Per-user subcollections included in the archive (mirrors purge.py).
_SUBCOLLECTIONS = [
    "diary_entries",
    "crop_pnl",
    "vault_documents",
    "land_plots",
    "scheme_applications",
    "devices",
    "coin_ledger",
    "soil_tests",
    "rating_prompts",
    "notification_prefs",
    "expert_tickets",
    "blocks",
    "chat_strikes",
]

_OWNED_COLLECTIONS: list[tuple[str, str]] = [
    ("notifications", "userId"),
    ("transport_bookings", "userId"),
    ("orders", "userId"),
]


def _error(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": {}},
    )


async def assemble_export(uid: str) -> dict:
    """Assemble the user's data into one JSON-serializable archive."""
    archive: dict = {
        "userId": uid,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "profile": await get_doc("users", uid),
        "consents": await get_consents(uid),
        "collections": {},
    }
    for name in _SUBCOLLECTIONS:
        archive["collections"][name] = await query(f"users/{uid}/{name}", [], limit=1000)
    for collection, field in _OWNED_COLLECTIONS:
        archive["collections"][collection] = await query(collection, [(field, "==", uid)], limit=1000)
    archive["collections"]["ratings"] = await query("ratings", [("raterId", "==", uid)], limit=1000)
    return archive


@router.post("/data-export", status_code=201)
async def request_data_export(uid: str = Depends(current_user_id)):
    """DPDP export: build the archive, store it, notify the user. 1 per day."""
    existing = await get_doc(EXPORT_COLLECTION, uid)
    if existing is not None:
        created = existing.get("createdAt") or ""
        try:
            created_at = datetime.fromisoformat(created)
            if datetime.now(timezone.utc) - created_at < timedelta(hours=24):
                _error(429, "EXPORT_RATE_LIMITED", "one export per day")
        except ValueError:
            pass

    archive = await assemble_export(uid)
    payload = json.dumps(archive, ensure_ascii=False).encode()
    blob_path, _ = upload_user_file(uid, payload, "data-export.json", "application/json", prefix="exports")
    url = signed_download_url(blob_path, minutes=60 * 24)
    now = datetime.now(timezone.utc).isoformat()
    doc = {"uid": uid, "status": "ready", "url": url, "createdAt": now}
    await set_doc(EXPORT_COLLECTION, uid, doc)
    await notify_user(
        uid,
        type="data_export",
        title="Your data export is ready / आपका डेटा निर्यात तैयार है",
        body="Tap to download your AGROVERCITY data archive",
        deepLink=url,
    )
    await set_doc(
        "audit_logs",
        f"aud_export_{uid}_{now[:19]}",
        {"action": "data_export", "actor": uid, "createdAt": now},
    )
    return {"status": "ready", "url": url, "createdAt": now}


@router.get("/data-export/latest")
async def latest_data_export(uid: str = Depends(current_user_id)):
    doc = await get_doc(EXPORT_COLLECTION, uid)
    if doc is None:
        _error(404, "EXPORT_NOT_FOUND", "no data export found")
    return {"status": doc.get("status"), "url": doc.get("url"), "createdAt": doc.get("createdAt")}
