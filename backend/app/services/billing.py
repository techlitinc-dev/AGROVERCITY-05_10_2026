"""Subscriptions & billing (WS-05): plans, subscriptions, entitlements.

Tier matrix from robust.md §10 — prices are integer paisa/month; commissions
are always on top (configured per-persona). Rule 5: the farmer's core
grow-sell-insure loop is never paywalled (farmer plan is free with no limits).
"""
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from app.core.db import get_doc, query, set_doc

# (persona, tier, priceRupeesPerMonth, limits)
TIER_MATRIX = [
    ("farmer", "free", 0, {}),
    ("farmLandlord", "free", 0, {"plots": 1, "activeLeases": 1, "listings": 5}),
    ("farmLandlord", "pro", 299, {"listings": 100}),
    ("transport", "free", 0, {"vehicles": 1}),
    ("transport", "pro", 499, {"vehicles": 5}),
    # robust.md §6.3: unlimited fleet, API dispatch, dedicated support (price
    # set per platform convention — between Pro ₹499 and directBuyer Enterprise).
    ("transport", "enterprise", 1999, {}),
    ("seller", "free", 0, {"listings": 20}),
    ("seller", "pro", 999, {"listings": 500}),
    # WS-03 step 8: multi-shop, API, white-label rate boards.
    ("seller", "enterprise", 4999, {}),
    ("equipmentRental", "free", 0, {"machines": 1}),
    ("equipmentRental", "pro", 399, {"machines": 5}),
    # WS-04 step 10: fleet unlimited, operator management, API.
    ("equipmentRental", "enterprise", 1499, {}),
    ("broker", "free", 0, {"deals": 5}),
    # WS-05 step 11: unlimited deals + CRM bulk tools, mandi-trend analytics,
    # priority leads (commission still stacks on top of the subscription).
    ("broker", "pro", 799, {}),
    ("dairyManager", "free", 0, {"animals": 20, "members": 25, "agentSeats": 0}),
    ("dairyManager", "pro", 1499, {"animals": 200, "agentSeats": 5}),
    ("dairyManager", "enterprise", 4999, {}),
    ("instructor", "free", 0, {"courses": 1}),
    ("instructor", "pro", 499, {"courses": 20}),
    ("directBuyer", "free", 0, {"orders": 10}),
    ("directBuyer", "pro", 4999, {"orders": 1000}),
    ("directBuyer", "enterprise", 24999, {}),
    ("emarketCustomer", "free", 0, {}),
    ("bankManager", "console", 2000, {"seats": 2}),
    ("insuranceProvider", "console", 2000, {"seats": 2}),
    ("coldStorageProvider", "console", 2000, {"seats": 2}),
]

# Commission per persona (always on, deducted at source in settlements).
COMMISSIONS = {
    "transport": "10%",
    "seller": "2% min ₹50",
    "equipmentRental": "12%",
    "broker": "2%",
    "dairyManager": "3/5/2%",
    "instructor": "15-20% course GMV",
    "directBuyer": "1-2% settlement",
}

# Named SaaS capabilities per plan (robust.md §6 tier descriptions). Limits
# cap quantities; features gate capabilities — commission never varies by tier.
TIER_FEATURES = {
    "transport_pro": ["driverSubAccounts", "routeAnalytics", "priorityLoadBoard"],
    "transport_enterprise": [
        "driverSubAccounts",
        "routeAnalytics",
        "priorityLoadBoard",
        "apiDispatch",
        "dedicatedSupport",
    ],
    "equipmentRental_pro": ["analytics", "maintenanceSuite", "priorityListing"],
    "equipmentRental_enterprise": [
        "analytics",
        "maintenanceSuite",
        "priorityListing",
        "operatorManagement",
        "apiAccess",
    ],
    "broker_pro": ["crmBulkTools", "mandiTrendAnalytics", "priorityLeads"],
    "seller_pro": ["analyticsV2", "udhaarLedger", "gstInvoices", "tdsStatements", "procurementStaffSeats"],
    "seller_enterprise": [
        "analyticsV2",
        "udhaarLedger",
        "gstInvoices",
        "tdsStatements",
        "procurementStaffSeats",
        "multiShop",
        "apiAccess",
        "whiteLabelRateBoards",
    ],
    "dairyManager_pro": ["auto_sms_slips", "agentSeats", "routePlanner", "analytics"],
    "dairyManager_enterprise": [
        "auto_sms_slips",
        "agentSeats",
        "routePlanner",
        "analytics",
        "multiCenterUnions",
        "api",
        "customRateEngines",
    ],
}


def plan_doc(persona: str, tier: str, rupees: int, limits: dict) -> dict:
    return {
        "planId": f"{persona}_{tier}",
        "persona": persona,
        "tier": tier,
        "priceMonthlyPaisa": rupees * 100,
        "limits": limits,
        "commission": COMMISSIONS.get(persona),
        "features": TIER_FEATURES.get(f"{persona}_{tier}", []),
    }


PLANS = [plan_doc(*row) for row in TIER_MATRIX]


def _matrix_plan(plan_id: str) -> dict | None:
    """Fallback to the in-code tier matrix when the plans collection is empty."""
    return next((dict(plan) for plan in PLANS if plan["planId"] == plan_id), None)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _period_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


async def seed_plans() -> None:
    for plan in PLANS:
        existing = await get_doc("plans", plan["planId"])
        if existing is None:
            await set_doc("plans", plan["planId"], plan)


async def list_plans(persona: str | None = None) -> list[dict]:
    plans = await query("plans", [], limit=200)
    if not plans:
        plans = [dict(plan) for plan in PLANS]
    if persona:
        plans = [plan for plan in plans if plan.get("persona") == persona]
    return sorted(plans, key=lambda p: p.get("priceMonthlyPaisa", 0))


async def get_plan(plan_id: str) -> dict | None:
    return await get_doc("plans", plan_id)


async def get_subscription(user_id: str) -> dict | None:
    subs = await query("subscriptions", [("userId", "==", user_id)], limit=10)
    live = [s for s in subs if s.get("status") in ("active", "past_due")]
    if not live:
        return None
    live.sort(key=lambda s: s.get("createdAt", ""), reverse=True)
    return live[0]


async def effective_plan(user_id: str, persona: str | None = None) -> dict:
    subscription = await get_subscription(user_id)
    if subscription is not None:
        plan = await get_plan(subscription["planId"]) or _matrix_plan(subscription["planId"])
        if plan is not None:
            return plan
    persona = persona or "farmer"
    free = await get_plan(f"{persona}_free") or _matrix_plan(f"{persona}_free")
    return free or {"planId": f"{persona}_free", "persona": persona, "tier": "free", "priceMonthlyPaisa": 0, "limits": {}}


async def usage_count(user_id: str, feature: str) -> int:
    doc = await get_doc("usage_counters", f"{user_id}_{feature}")
    if doc is None or doc.get("period") != _period_key():
        return 0
    return int(doc.get("count", 0))


async def record_usage(user_id: str, feature: str) -> int:
    count = await usage_count(user_id, feature) + 1
    await set_doc(
        "usage_counters",
        f"{user_id}_{feature}",
        {
            "userId": user_id,
            "feature": feature,
            "count": count,
            "period": _period_key(),
            "updatedAt": _now(),
        },
    )
    return count


def _raise_over_limit(plan: dict, feature: str, limit: int, used: int):
    raise HTTPException(
        status_code=402,
        detail={
            "code": "ENTITLEMENT_EXCEEDED",
            "message": f"your {plan.get('tier')} plan allows {limit} {feature} — upgrade to add more",
            "fieldErrors": {},
            "limit": limit,
            "used": used,
            "planId": plan.get("planId"),
        },
    )


async def check_entitlement(user_id: str, persona: str, feature: str) -> dict:
    """Raise the 402 ENTITLEMENT_EXCEEDED envelope when the plan limit is hit."""
    plan = await effective_plan(user_id, persona)
    limit = (plan.get("limits") or {}).get(feature)
    used = await usage_count(user_id, feature)
    if feature == "members":
        existing_members = await query("dairy_members", [("centerId", "==", user_id)], limit=500)
        used = max(used, len(existing_members))
    if limit is not None and used >= int(limit):
        _raise_over_limit(plan, feature, int(limit), used)
    return plan


async def consume(user_id: str, persona: str, feature: str) -> None:
    """Check then record one unit of usage (call after a successful create)."""
    await check_entitlement(user_id, persona, feature)
    await record_usage(user_id, feature)


def entitlement_guard(persona: str, feature: str):
    """FastAPI dependency: blocks over-limit requests with the 402 envelope."""
    from fastapi import Depends

    from app.core.deps import current_user_id

    async def dep(uid: str = Depends(current_user_id)):
        return await check_entitlement(uid, persona, feature)

    return dep


def require_entitlement(persona_or_feature: str, feature: str | None = None):
    """FastAPI dependency: blocks over-limit requests with the 402 envelope."""
    from fastapi import Depends

    from app.core.deps import current_user_id

    async def dep(uid: str = Depends(current_user_id)):
        if feature is None:
            from app.services.users import get_user

            user = await get_user(uid)
            persona = (user.get("activeProfile") or user.get("primaryProfile") or "farmer") if user else "farmer"
            return await check_entitlement(uid, persona, persona_or_feature)
        return await check_entitlement(uid, persona_or_feature, feature)

    return dep
