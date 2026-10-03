from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import get_doc, query
from app.core.deps import current_user_id
from app.routers.coupons import _is_expired
from app.routers.users import require_role
from app.services.users import get_user

router = APIRouter(prefix="/analytics", tags=["analytics"])


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
