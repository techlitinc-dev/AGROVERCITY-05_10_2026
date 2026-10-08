import logging

from firebase_admin import auth as firebase_auth

from app.core.config import settings
from app.core.db import delete_doc, get_doc, query, set_doc

logger = logging.getLogger(__name__)

_SUBCOLLECTIONS = [
    "diary_entries",
    "crop_pnl",
    "vault_documents",
    "land_plots",
    "scheme_applications",
    "devices",
    "coin_ledger",
    "soil_tests",
    # WS-04 task 4.9 — per-user subcollections added by later phases.
    "chat_strikes",
    "strikes",
    "rating_prompts",
    "expert_tickets",
    "blocks",
]


async def _delete_subcollection(path: str) -> int:
    docs = await query(path, [], limit=1000)
    for doc in docs:
        if "id" in doc:
            await delete_doc(path, doc["id"])
    return len(docs)


def _delete_storage_prefixes(uid: str):
    if settings.env == "dev":
        return
    import firebase_admin.storage

    bucket = firebase_admin.storage.bucket()
    for prefix in (f"vault/{uid}/", f"reports/{uid}/"):
        for blob in bucket.list_blobs(prefix=prefix):
            blob.delete()


async def purge_user(uid: str) -> dict:
    deleted = 0
    for name in _SUBCOLLECTIONS:
        deleted += await _delete_subcollection(f"users/{uid}/{name}")
    # notification prefs is a single doc with a fixed id (no `id` field to key on).
    if await get_doc(f"users/{uid}/notification_prefs", "current") is not None:
        await delete_doc(f"users/{uid}/notification_prefs", "current")
        deleted += 1
    leases = await query(f"users/{uid}/land_leases", [], limit=1000)
    for lease in leases:
        if "id" in lease:
            deleted += await _delete_subcollection(f"users/{uid}/land_leases/{lease['id']}/payments")
            await delete_doc(f"users/{uid}/land_leases", lease["id"])
            deleted += 1
    _delete_storage_prefixes(uid)
    await delete_doc("users", uid)

    auth_deleted = False
    try:
        firebase_auth.delete_user(uid)
        auth_deleted = True
    except Exception:
        logger.warning("auth delete failed for uid=%s", uid)

    anonymized = 0
    marker = f"deleted:{uid[:8]}"
    for collection in ("transport_bookings", "orders"):
        for doc in await query(collection, [("userId", "==", uid)], limit=1000):
            if "id" not in doc:
                continue
            doc["userId"] = marker
            await set_doc(collection, doc["id"], doc)
            anonymized += 1
    logger.info("purged user uid=%s subcollections=%d anonymized=%d", uid, deleted, anonymized)
    return {
        "subcollectionsDeleted": deleted,
        "authDeleted": auth_deleted,
        "financialAnonymized": anonymized,
    }
