"""Rating prompts (WS-03 X8).

Opens a pending-rating prompt for the rater when a transaction completes, and
exposes the open prompts for the dashboard's rate prompt.
"""
from datetime import datetime, timezone

from app.core.db import get_doc, query, set_doc

RATING_KINDS = (
    "lot_sale",
    "lot_purchase",
    "transport_delivery",
    "equipment_booking",
    "land_lease",
    "dairy_collection",
    "course_enrollment",
    "contract_delivery",
    "marketplace_order",
)


async def open_rating_prompt(
    rater_uid: str, ratee_uid: str, transaction_id: str, kind: str
) -> None:
    """Idempotently open a rating prompt for `rater_uid` on a completed deal."""
    if not rater_uid or not ratee_uid or not transaction_id:
        return
    existing = await get_doc(f"users/{rater_uid}/rating_prompts", transaction_id)
    if existing is not None:
        return
    await set_doc(
        f"users/{rater_uid}/rating_prompts",
        transaction_id,
        {
            "id": transaction_id,
            "rateeUid": ratee_uid,
            "kind": kind,
            "transactionId": transaction_id,
            "status": "open",
            "createdAt": datetime.now(timezone.utc).isoformat(),
        },
    )


async def pending_prompts(uid: str) -> list[dict]:
    return await query(f"users/{uid}/rating_prompts", [("status", "==", "open")], limit=200)


async def close_prompt(rater_uid: str, transaction_id: str) -> None:
    doc = await get_doc(f"users/{rater_uid}/rating_prompts", transaction_id)
    if doc is None:
        return
    doc["status"] = "done"
    await set_doc(f"users/{rater_uid}/rating_prompts", transaction_id, doc)
