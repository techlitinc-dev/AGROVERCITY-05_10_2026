import uuid
from datetime import datetime, timezone

from app.core.db import get_doc, query, set_doc


class InsufficientCoins(Exception):
    pass


async def award_coins(uid: str, amount: int, reason: str, ref_id: str | None = None) -> int:
    return await _apply_delta(uid, amount, reason, ref_id)


async def spend_coins(uid: str, amount: int, reason: str, ref_id: str | None = None) -> int:
    if amount < 0:
        raise ValueError("amount must be non-negative")
    return await _apply_delta(uid, -amount, reason, ref_id)


async def _apply_delta(uid: str, delta: int, reason: str, ref_id: str | None) -> int:
    user = await get_doc("users", uid) or {"id": uid}
    balance = user.get("agriCoins", 0) + delta
    if balance < 0:
        raise InsufficientCoins(f"uid {uid} balance below zero")
    user["agriCoins"] = balance
    await set_doc("users", uid, user)
    now = datetime.now(timezone.utc).isoformat()
    ledger_id = uuid.uuid4().hex
    entry = {
        "id": ledger_id,
        "amount": delta,
        "reason": reason,
        "refId": ref_id,
        "balanceAfter": balance,
        "at": now,
    }
    await set_doc(f"users/{uid}/coin_ledger", ledger_id, entry)
    # Shadow doc in the top-level ledger powers global leaderboards and the
    # nightly reconcile job (docs/schema/firestore-collections.md).
    await set_doc(
        "gamification_ledger",
        f"{uid}_{ref_id or uuid.uuid4().hex[:12]}",
        {
            "userId": uid,
            "amount": delta,
            "reason": reason,
            "refId": ref_id,
            "balanceAfter": balance,
            "at": now,
        },
    )
    return balance


async def get_ledger_page(uid: str, page: int = 1, pageSize: int = 20) -> tuple[list[dict], int]:
    entries = await query(f"users/{uid}/coin_ledger", [], limit=1000)
    entries = sorted(entries, key=lambda e: e.get("at", ""), reverse=True)
    total = len(entries)
    start = (page - 1) * pageSize
    return entries[start : start + pageSize], total


async def coins_earned_total(uid: str) -> int:
    entries = await query(f"users/{uid}/coin_ledger", [], limit=1000)
    return sum(e.get("amount", 0) for e in entries if e.get("amount", 0) > 0)
