import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from app.core.db import get_doc, query, set_doc
from app.core.deps import admin_user, current_user_id
from app.routers.coupons import _is_expired
from app.routers.users import require_role
from app.services.users import get_user

router = APIRouter(prefix="/analytics", tags=["analytics"])

# WS-09 — the single canonical analytics taxonomy (X13).
ANALYTICS_EVENT_NAMES = (
    "screen_view",
    "task_shown",
    "task_clicked",
    "task_completed",
    "notification_sent",
    "notification_opened",
    "deep_link_completed",
    "transaction_completed",
    "plan_upgraded",
    "support_resolved",
    "support_escalated",
)

_PROPS_PHONE_RE = re.compile(r"[6-9]\d{9}")


class AnalyticsEventIn(BaseModel):
    eventId: str
    name: str
    persona: str | None = None
    props: dict | None = None
    sessionId: str | None = None
    clientTs: str | None = None


class AnalyticsBatchIn(BaseModel):
    events: list[AnalyticsEventIn] = Field(default_factory=list, max_length=50)


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def last_12_months(now: datetime | None = None) -> list[str]:
    now = now or datetime.now(timezone.utc)
    keys = []
    for i in range(11, -1, -1):
        month = now.month - i
        year = now.year
        while month <= 0:
            month += 12
            year -= 1
        keys.append(f"{year:04d}-{month:02d}")
    return keys


def month_key(iso: str | None) -> str | None:
    if not iso or len(iso) < 7:
        return None
    return iso[:7]


def _order_amount(order: dict) -> int | float:
    return order.get("finalTotal", order.get("total", 0))


def _line_factor(order: dict) -> float:
    # prorates order-level coupon discount across line items so item/category/seller
    # revenue reconciles with the post-discount order total
    subtotal = order.get("total") or 0
    if not subtotal:
        return 1.0
    return _order_amount(order) / subtotal


async def _analytics_user(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    return uid


async def _seller_uid(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "seller")
    return uid


@router.get("/customer")
async def customer_analytics(uid: str = Depends(_analytics_user)):
    orders = await query("orders", [("userId", "==", uid)], limit=1000)
    months = last_12_months()
    monthly = {m: 0 for m in months}
    orders_by_status: dict[str, int] = {}
    category_spend: dict[str, int] = {}
    top_products: dict[str, dict] = {}
    product_cache: dict[str, dict] = {}
    total_spent = 0
    for order in orders:
        status = order.get("status", "unknown")
        orders_by_status[status] = orders_by_status.get(status, 0) + 1
        if status == "cancelled":
            continue
        amount = _order_amount(order)
        total_spent += amount
        factor = _line_factor(order)
        key = month_key(order.get("createdAt"))
        if key in monthly:
            monthly[key] += amount
        for item in order.get("items", []):
            pid = item["productId"]
            if pid not in product_cache:
                product_cache[pid] = await get_doc("products", pid) or {}
            product = product_cache[pid]
            line = round(product.get("discountedPrice", 0) * item["quantity"] * factor, 2)
            category = product.get("category", "Other")
            category_spend[category] = category_spend.get(category, 0) + line
            entry = top_products.setdefault(
                pid, {"productId": pid, "title": product.get("title", ""), "quantity": 0, "amount": 0}
            )
            entry["quantity"] += item["quantity"]
            entry["amount"] += line
    wishlist = await get_doc("wishlists", uid) or {"items": []}
    coupons = await query("coupons", [], limit=1000)
    active_coupons = sum(1 for c in coupons if c.get("active") and not _is_expired(c))
    pending_returns = sum(1 for o in orders if o.get("returnStatus") == "requested")
    return {
        "totalSpent": total_spent,
        "totalOrders": len(orders),
        "ordersByStatus": orders_by_status,
        "monthlySpend": [{"month": m, "amount": monthly[m]} for m in months],
        "categorySpend": [
            {"category": k, "amount": v}
            for k, v in sorted(category_spend.items(), key=lambda kv: -kv[1])
        ],
        "topProducts": sorted(top_products.values(), key=lambda e: -e["amount"])[:5],
        "wishlistCount": len(wishlist.get("items", [])),
        "activeCoupons": active_coupons,
        "pendingReturns": pending_returns,
    }


@router.get("/seller")
async def seller_analytics(uid: str = Depends(_seller_uid)):
    products = await query("products", [("sellerId", "==", uid)], limit=1000)
    product_map = {p["id"]: p for p in products}
    orders = await query("orders", [], limit=1000)
    months = last_12_months()
    monthly = {m: 0 for m in months}
    category_revenue: dict[str, int] = {}
    top_products: dict[str, dict] = {}
    recent_orders = []
    revenue = 0
    items_sold = 0
    orders_count = 0
    returns = 0
    for order in orders:
        lines = [i for i in order.get("items", []) if i["productId"] in product_map]
        if not lines:
            continue
        recent_orders.append(
            {
                "id": order["id"],
                "total": _order_amount(order),
                "status": order.get("status", ""),
                "createdAt": order.get("createdAt", ""),
            }
        )
        if order.get("returnStatus") == "requested":
            returns += 1
        if order.get("status") == "cancelled":
            continue
        orders_count += 1
        factor = _line_factor(order)
        order_lines_total = 0
        for item in lines:
            product = product_map[item["productId"]]
            line = round(product.get("discountedPrice", 0) * item["quantity"] * factor, 2)
            revenue += line
            order_lines_total += line
            items_sold += item["quantity"]
            category = product.get("category", "Other")
            category_revenue[category] = category_revenue.get(category, 0) + line
            entry = top_products.setdefault(
                item["productId"],
                {"productId": item["productId"], "title": product.get("title", ""), "quantity": 0, "amount": 0},
            )
            entry["quantity"] += item["quantity"]
            entry["amount"] += line
        key = month_key(order.get("createdAt"))
        if key in monthly:
            monthly[key] += order_lines_total
    recent_orders.sort(key=lambda o: o.get("createdAt", ""), reverse=True)
    low_stock = [
        {"productId": p["id"], "title": p.get("title", ""), "stock": p["stock"]}
        for p in products
        if isinstance(p.get("stock"), int) and p["stock"] < 10
    ]
    return {
        "revenue": revenue,
        "ordersCount": orders_count,
        "itemsSold": items_sold,
        "aov": round(revenue / orders_count, 2) if orders_count else 0.0,
        "monthlyRevenue": [{"month": m, "amount": monthly[m]} for m in months],
        "topProducts": sorted(top_products.values(), key=lambda e: -e["amount"])[:5],
        "categoryBreakdown": [
            {"category": k, "revenue": v}
            for k, v in sorted(category_revenue.items(), key=lambda kv: -kv[1])
        ],
        "lowStock": low_stock,
        "returnRate": round(returns / orders_count, 2) if orders_count else 0.0,
        "recentOrders": recent_orders[:10],
    }


# ---------------------------------------------------------------------------
# WS-09 — analytics event taxonomy (X13)
# ---------------------------------------------------------------------------
@router.post("/events")
async def ingest_events(
    body: AnalyticsBatchIn,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(current_user_id),
):
    now = datetime.now(timezone.utc).isoformat()
    applied = duplicates = 0
    for event in body.events:
        if event.name not in ANALYTICS_EVENT_NAMES:
            _error(422, "ANALYTICS_UNKNOWN_EVENT", f"unknown event name: {event.name}")
        props = event.props or {}
        for value in props.values():
            if isinstance(value, str) and _PROPS_PHONE_RE.search(value):
                _error(422, "ANALYTICS_PII_BLOCKED", "event props must not contain phone numbers")
        if await get_doc("analytics_events", event.eventId) is not None:
            duplicates += 1
            continue
        await set_doc(
            "analytics_events",
            event.eventId,
            {
                "eventId": event.eventId,
                "userId": uid,
                "persona": event.persona,
                "name": event.name,
                "props": props,
                "sessionId": event.sessionId,
                "clientTs": event.clientTs,
                "serverTs": now,
            },
        )
        applied += 1
    return {"applied": applied, "duplicates": duplicates}


def _within_last_7_days(server_ts: str | None) -> bool:
    if not server_ts:
        return False
    try:
        return datetime.fromisoformat(server_ts) >= datetime.now(timezone.utc) - timedelta(days=7)
    except ValueError:
        return False


@router.get("/north-star")
async def north_star(user: dict = Depends(admin_user)):
    events = await query("analytics_events", [], limit=10000)

    transactions = [e for e in events if e.get("name") == "transaction_completed"]
    weekly_farmers = {
        e.get("userId")
        for e in transactions
        if e.get("persona") == "farmer" and _within_last_7_days(e.get("serverTs"))
    }

    gmv: dict[str, int] = {}
    take_rate = 0
    for event in transactions:
        props = event.get("props") or {}
        marketplace = str(props.get("marketplace") or "unknown")
        gmv[marketplace] = gmv.get(marketplace, 0) + int(props.get("gmv_paisa") or 0)
        take_rate += int(props.get("take_rate_paisa") or 0)

    all_users = {e.get("userId") for e in events if e.get("userId")}
    upgraded_users = {e.get("userId") for e in events if e.get("name") == "plan_upgraded"}
    paid_conversion = round(len(upgraded_users) / len(all_users), 4) if all_users else 0.0

    tasks_completed = [e for e in events if e.get("name") == "task_completed" and _within_last_7_days(e.get("serverTs"))]
    shown_users = {e.get("userId") for e in events if e.get("name") == "task_shown"}
    tasks_per_user = round(len(tasks_completed) / len(shown_users), 4) if shown_users else 0.0

    sent = sum(1 for e in events if e.get("name") == "notification_sent")
    completed = sum(1 for e in events if e.get("name") == "deep_link_completed")
    deep_link_rate = round(completed / sent, 4) if sent else 0.0

    return {
        "weeklyTransactingFarmers": len(weekly_farmers),
        "gmvPerMarketplace": gmv,
        "takeRateRevenuePaisa": take_rate,
        "paidPlanConversion": paid_conversion,
        "tasksPerUserPerWeek": tasks_per_user,
        "deepLinkCompletionRate": deep_link_rate,
    }
