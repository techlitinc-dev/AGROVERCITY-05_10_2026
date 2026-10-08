"""`ai_decisions` export-then-expire (phase-08 WS-04, ai.md §7.1).

Documents older than 90 days are exported to cold storage and ONLY then deleted
— the calibration dataset is the moat, so we export-then-expire, never just
delete. A failed export leaves the source document in place.
"""
import json
import logging
from datetime import datetime, timedelta, timezone

from app.core.db import delete_doc, query, set_doc
from app.services import storage

log = logging.getLogger(__name__)

COLLECTION = "ai_decisions"
EXPORT_COLLECTION = "ai_decisions_exports"
TTL_DAYS = 90


def _parse_at(value) -> datetime | None:
    if not value:
        return None
    try:
        stamp = datetime.fromisoformat(str(value))
    except ValueError:
        return None
    if stamp.tzinfo is None:
        stamp = stamp.replace(tzinfo=timezone.utc)
    return stamp


async def export_expired_decisions(now: datetime | None = None) -> dict:
    """Export ai_decisions older than 90 days, verify, then delete."""
    now = now or datetime.now(timezone.utc)
    cutoff = now - timedelta(days=TTL_DAYS)
    docs = await query(COLLECTION, [], limit=20000)
    exported = skipped = 0
    for doc in docs:
        at = _parse_at(doc.get("at"))
        if at is None or at >= cutoff:
            continue
        decision_id = doc.get("id")
        if not decision_id:
            continue
        try:
            payload = json.dumps(doc, default=str).encode()
            blob_path, _ = storage.upload_user_file(
                "cold", payload, f"{decision_id}.json", "application/json",
                prefix="ai_decisions_cold",
            )
        except Exception as exc:  # noqa: BLE001 — never delete without a verified export
            log.error("ai_decisions export failed for %s: %s", decision_id, exc)
            skipped += 1
            continue
        await set_doc(
            EXPORT_COLLECTION,
            decision_id,
            {
                "id": decision_id,
                "decisionId": decision_id,
                "coldPath": blob_path,
                "questionSetId": doc.get("questionSetId"),
                "exportedAt": now.isoformat(),
            },
        )
        await delete_doc(COLLECTION, decision_id)
        exported += 1
    return {"exported": exported, "skipped": skipped, "cutoff": cutoff.isoformat()}
