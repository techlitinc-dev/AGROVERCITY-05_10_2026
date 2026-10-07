"""Krishi Ratna coin ledger (phase-05 WS-08).

X11 abuse guards live here, all config-driven:

- **daily earn cap** — `platform_config/coins.dailyEarnCap` (default 200). A
  positive award over the remaining budget is truncated to the remaining
  allowance; once the day's budget is exhausted further awards are dropped (the
  award is not deferred to tomorrow).
- **redemption cap** — `platform_config/coins.redemptionMaxPctOfOrder` (default
  50): a coin redemption against an order may never exceed that share of the
  order value. Enforced by `redemption_cap_paisa()` / the gamification route.
- **tier thresholds** — `platform_config/coins.tiers`.
- **nightly reconcile** — `run_nightly_reconcile()` compares the mint/burn
  ledger against every user's balance and writes a drift report to
  `platform_config/coins_reconcile_latest`.

Every cap is admin-editable (maker-checker) via `platform_config/coins`; none is
a code constant used in the enforce path — the values below are only the seed
written on first read. Coins are NEVER redeemable for cash.

Every mint/burn writes an `audit_logs` row (rule 3) with integer units.
"""
import uuid
from datetime import datetime, timezone

from app.core.db import get_doc, query, set_doc

# Canonical config doc for every coin cap/value (task 8.7).
COINS_CONFIG_DOC = "coins"
RECONCILE_DOC = "coins_reconcile_latest"

# Seed written to `platform_config/coins` on first read — the SAME defaults the
# module shipped with as code constants. Not used as a runtime fallback: the
# enforce path always reads the config doc.
# Deferred(2026-10-03, phase-07): admin coin mint/burn console edits
# platform_config/coins with maker-checker.
DEFAULT_COIN_CONFIG = {
    "dailyEarnCap": 200,
    "redemptionMaxPctOfOrder": 50,
    "tiers": [
        {"tier": "bronze", "title": "शुरुआत", "minCoins": 0},
        {"tier": "silver", "title": "तरक्की", "minCoins": 200},
        {"tier": "gold", "title": "खुशहाल", "minCoins": 500},
        {"tier": "diamond", "title": "कृषि रत्न", "minCoins": 1000},
    ],
}


class InsufficientCoins(Exception):
    pass


async def get_coin_config() -> dict:
    """Read `platform_config/coins`, seeding it on first use.

    The seed write is idempotent and only happens when the doc is absent, so a
    fresh dev environment gets the defaults while production (where phase-07
    writes the doc) is never overwritten.
    """
    doc = await get_doc("platform_config", COINS_CONFIG_DOC)
    if doc is None:
        doc = {"id": COINS_CONFIG_DOC, **DEFAULT_COIN_CONFIG}
        await set_doc("platform_config", COINS_CONFIG_DOC, doc)
        return doc
    merged = {**DEFAULT_COIN_CONFIG, **doc}
    if merged != doc:
        merged["id"] = COINS_CONFIG_DOC
        await set_doc("platform_config", COINS_CONFIG_DOC, merged)
    return merged


async def coin_tiers() -> list[dict]:
    config = await get_coin_config()
    return config["tiers"]


async def redemption_cap_coins(order_value_paisa: int) -> int:
    """Max coins redeemable against an order.

    X11: at most the configured share of the order value. Coins are 1:1 with
    rupees platform-wide, so the order value (integer paisa) is converted to
    rupees before applying the percentage.
    """
    config = await get_coin_config()
    order_rupees = int(order_value_paisa) // 100
    return order_rupees * int(config["redemptionMaxPctOfOrder"]) // 100


async def award_coins(uid: str, amount: int, reason: str, ref_id: str | None = None) -> int:
    return await _apply_delta(uid, amount, reason, ref_id)


async def spend_coins(uid: str, amount: int, reason: str, ref_id: str | None = None) -> int:
    if amount < 0:
        raise ValueError("amount must be non-negative")
    return await _apply_delta(uid, -amount, reason, ref_id)


def _is_mint(delta: int) -> bool:
    return delta > 0


async def _audit_coin_mutation(
    uid: str, delta: int, reason: str, ref_id: str | None, balance: int
) -> None:
    """Rule 3: every coin mint/burn writes an audit_logs row (integer units)."""
    audit_id = f"aud_coin_{uuid.uuid4().hex[:12]}"
    await set_doc(
        "audit_logs",
        audit_id,
        {
            "id": audit_id,
            "action": "COIN_MINT" if _is_mint(delta) else "COIN_BURN",
            "userId": uid,
            "units": int(delta),
            "reason": reason,
            "refId": ref_id,
            "balanceAfter": balance,
            "at": datetime.now(timezone.utc).isoformat(),
        },
    )


async def _apply_delta(uid: str, delta: int, reason: str, ref_id: str | None) -> int:
    user = await get_doc("users", uid) or {"id": uid}
    if delta > 0:
        # X11 daily earn cap — read from platform_config/coins. Coins can never
        # be converted to currency; this only throttles positive awards.
        # Negative deltas (spends) are untouched.
        config = await get_coin_config()
        cap = int(config["dailyEarnCap"])
        today = datetime.now(timezone.utc).date().isoformat()
        entries = await query(f"users/{uid}/coin_ledger", [], limit=1000)
        earned_today = sum(
            e.get("amount", 0)
            for e in entries
            if e.get("amount", 0) > 0 and str(e.get("at", ""))[:10] == today
        )
        allowed = max(0, cap - earned_today)
        delta = min(delta, allowed)
        if delta == 0:
            # Cap already reached today — return the balance unchanged and write
            # no ledger docs (the award is dropped, not deferred).
            return user.get("agriCoins", 0)
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
    await _audit_coin_mutation(uid, delta, reason, ref_id, balance)
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


async def run_nightly_reconcile() -> dict:
    """X11 nightly reconcile — mint/burn ledger vs per-user balances.

    `issued` = positive ledger total, `redeemed` = magnitude of negative ledger
    total, `drift` = issued − redeemed − outstanding (the sum of every user's
    balance from the per-user ledger). A consistent ledger reconciles to 0.
    Writes the report to `platform_config/coins_reconcile_latest`.
    """
    entries = await query("gamification_ledger", [], limit=5000)
    issued = sum(e.get("amount", 0) for e in entries if e.get("amount", 0) > 0)
    redeemed = -sum(e.get("amount", 0) for e in entries if e.get("amount", 0) < 0)
    outstanding = 0
    user_ids = {e.get("userId") for e in entries if e.get("userId")}
    for user_id in sorted(user_ids):
        ledger = await query(f"users/{user_id}/coin_ledger", [], limit=5000)
        outstanding += sum(e.get("amount", 0) for e in ledger)
    report = {
        "issued": int(issued),
        "redeemed": int(redeemed),
        "drift": int(issued - redeemed - outstanding),
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("platform_config", RECONCILE_DOC, report)
    return report
