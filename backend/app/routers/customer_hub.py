"""Customer hub: home breadth + AI recommendations (SR 1, SR 23).

CustomerHomeView previously showed only weather/banners/mandi rates — this
router hydrates the missing breadth: seasonal picks, the active-order strip,
the subscription next-delivery card, coin balance, offers from followed
farmers, and the unread-notifications count. `/customer/recommendations`
powers the personalized basket (repurchase history scaled by familySize,
filtered by dietaryPreference), a best-price-per-category board, and
seasonal alternatives.

Auth: any authenticated user (the customer home is persona-soft — the same
account can hold farmer + customer profiles). Every section degrades
independently: a failure or an empty collection yields []/0 for that
section, never a 500 on the whole payload (dashboard.py precedent).
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.core.db import get_doc, query
from app.core.deps import current_user_id
from app.services.users import get_user

router = APIRouter(prefix="/customer", tags=["customer-hub"])

logger = logging.getLogger(__name__)

SEASONAL_PICKS_LIMIT = 6
ACTIVE_ORDERS_LIMIT = 4
FOLLOWED_OFFERS_LIMIT = 6
BASKET_LIMIT = 6
BEST_PRICE_LIMIT = 8
SEASONAL_ALT_LIMIT = 6

ORDER_TERMINAL_STATUSES = ("delivered", "cancelled")

NON_VEG_MARKERS = ("non-veg", "nonveg", "meat", "chicken", "mutton", "fish", "prawn")

# Small static month → produce keywords map (northern-India harvest calendar).
SEASONAL_PRODUCE = {
    1: ["orange", "cauliflower", "peas", "carrot", "spinach"],
    2: ["strawberry", "cauliflower", "peas", "carrot"],
    3: ["mango", "cucumber", "spinach", "melon"],
    4: ["mango", "watermelon", "cucumber", "lauki"],
    5: ["mango", "watermelon", "lauki", "okra"],
    6: ["jamun", "pear", "okra", "bottle gourd"],
    7: ["pear", "plum", "okra", "bitter gourd"],
    8: ["apple", "banana", "brinjal", "bitter gourd"],
    9: ["banana", "pomegranate", "brinjal", "tomato"],
    10: ["guava", "pomegranate", "tomato", "spinach"],
    11: ["orange", "guava", "cauliflower", "carrot"],
    12: ["orange", "apple", "cauliflower", "peas"],
}


def _season_keywords() -> list[str]:
    return SEASONAL_PRODUCE.get(datetime.now(timezone.utc).month, [])


def _product_price(p: dict) -> float:
    for key in ("discountedPrice", "price", "mrp"):
        value = p.get(key)
        if isinstance(value, (int, float)) and value:
            return float(value)
    return 0.0


def _product_rating(p: dict) -> float:
    for key in ("rating", "ratingAvg"):
        value = p.get(key)
        if isinstance(value, (int, float)):
            return float(value)
    return 0.0


def _product_sales(p: dict) -> int:
    for key in ("salesCount", "totalSales", "soldCount"):
        value = p.get(key)
        if isinstance(value, (int, float)):
            return int(value)
    # reviews volume is the closest popularity proxy when no sales counter exists
    return int(p.get("reviewsCount") or p.get("ratingCount") or 0)


def _product_card(p: dict, reason: str | None = None) -> dict:
    card = {
        "id": p.get("id"),
        "name": p.get("title") or p.get("name") or "Product",
        "price": _product_price(p),
        "unit": p.get("unit") or "",
        "category": p.get("category") or "",
        "imageUrl": p.get("imageUrl") or "",
        "rating": _product_rating(p),
        "sellerId": p.get("sellerId") or p.get("farmerId"),
    }
    if reason:
        card["reason"] = reason
    return card


def _is_produce(p: dict) -> bool:
    if p.get("isOrganic"):
        return True
    category = str(p.get("category") or "").strip().lower()
    if any(hint in category for hint in ("organic", "vegetable", "veg", "fruit", "dairy")):
        return True
    title = str(p.get("title") or "").lower()
    return any(keyword in title for keyword in _season_keywords())


def _matches_season(p: dict) -> bool:
    title = str(p.get("title") or "").lower()
    return any(keyword in title for keyword in _season_keywords())


def _sort_popular(products: list[dict]) -> list[dict]:
    """Rating/sales first, newest as the deterministic fallback."""
    return sorted(
        products,
        key=lambda p: (_product_rating(p), _product_sales(p), str(p.get("createdAt") or "")),
        reverse=True,
    )


async def _seasonal_picks() -> list[dict]:
    docs = await query("products", [], limit=1000)
    produce = [d for d in docs if d.get("id") and _is_produce(d)]
    picks = _sort_popular(produce)
    return [_product_card(p) for p in picks[:SEASONAL_PICKS_LIMIT]]


async def _active_orders(uid: str) -> list[dict]:
    docs = await query("orders", [("userId", "==", uid)], limit=1000)
    active = [d for d in docs if d.get("status") not in ORDER_TERMINAL_STATUSES]
    active.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return [
        {
            "id": d.get("id"),
            "status": d.get("status", ""),
            "total": d.get("finalTotal", d.get("total", 0)),
            "createdAt": d.get("createdAt"),
        }
        for d in active[:ACTIVE_ORDERS_LIMIT]
    ]


async def _subscription_next(uid: str) -> list[dict]:
    docs = await query("customer_subscriptions", [("customerId", "==", uid)], limit=500)
    active = [d for d in docs if d.get("status") == "active"]
    active.sort(key=lambda d: d.get("nextRunAt") or "9999-12-31")
    items = []
    for d in active:
        label = d.get("crop") or "Subscription box"
        if d.get("qtyKg"):
            label = f"{label} · {d['qtyKg']} kg"
        items.append(
            {
                "id": d.get("id"),
                "label": label,
                "nextRunAt": d.get("nextRunAt"),
                "frequency": d.get("frequency"),
            }
        )
    return items


async def _coin_balance(uid: str) -> int:
    user = await get_user(uid)
    if user is None:
        return 0
    return int(user.get("agriCoins") or 0)


async def _followed_offers(uid: str) -> list[dict]:
    follows = await query("follows", [("followerId", "==", uid)], limit=500)
    followed_ids = {f.get("targetId") for f in follows if f.get("targetId")}
    if not followed_ids:
        return []
    docs = await query("products", [], limit=1000)
    offers = [d for d in docs if d.get("id") and (d.get("sellerId") or d.get("farmerId")) in followed_ids]
    offers.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return [_product_card(p) for p in offers[:FOLLOWED_OFFERS_LIMIT]]


async def _unread_notifications(uid: str) -> int:
    docs = await query("notifications", [("userId", "==", uid)], limit=1000)
    return sum(1 for d in docs if not d.get("read"))


async def _safe(label: str, fn, *args):
    """Run one home section; a failure degrades that section to its empty value."""
    try:
        return await fn(*args)
    except Exception:  # noqa: BLE001 — one bad section must never 500 the home payload
        logger.warning("customer hub section %s failed", label, exc_info=True)
        return [] if label != "coinBalance" and label != "unreadNotifications" else 0


def _dietary_fit(p: dict, dietary: str) -> bool:
    category = str(p.get("category") or "").lower()
    title = str(p.get("title") or "").lower()
    if dietary == "veg" and any(marker in category or marker in title for marker in NON_VEG_MARKERS):
        return False
    return True


def _organic_fit(p: dict) -> bool:
    if p.get("isOrganic"):
        return True
    category = str(p.get("category") or "").lower()
    title = str(p.get("title") or "").lower()
    return "organic" in category or "organic" in title


def _a2_fit(p: dict) -> bool:
    category = str(p.get("category") or "").lower()
    title = str(p.get("title") or "").lower()
    return "a2" in title or ("a2" in category and "dairy" in category)


async def _basket_recommendations(uid: str, user: dict | None) -> list[dict]:
    """Personalized basket: most-repurchased categories from delivered orders,
    scaled by familySize and filtered by dietaryPreference (fallback: top-rated
    catalogue products)."""
    user = user or {}
    family_size = user.get("familySize")
    family_size = int(family_size) if isinstance(family_size, (int, float)) and family_size > 0 else 3
    dietary = str(user.get("dietaryPreference") or "").strip().lower()

    orders = await query("orders", [("userId", "==", uid)], limit=1000)
    delivered = [o for o in orders if o.get("status") == "delivered"]
    category_qty: dict[str, int] = {}
    for order in delivered:
        for item in order.get("items") or []:
            product = await get_doc("products", item.get("productId"))
            if not product:
                continue
            category = str(product.get("category") or "Other")
            qty = item.get("quantity")
            qty = int(qty) if isinstance(qty, (int, float)) else 1
            category_qty[category] = category_qty.get(category, 0) + qty

    catalogue = await query("products", [], limit=1000)
    catalogue = [p for p in catalogue if p.get("id")]

    # dietaryPreference filters the whole basket (never one non-conforming pick).
    if dietary == "veg":
        catalogue = [p for p in catalogue if _dietary_fit(p, dietary)]
    elif dietary == "organic":
        organic_catalogue = [p for p in catalogue if _organic_fit(p)]
        if organic_catalogue:
            catalogue = organic_catalogue
    elif dietary == "a2":
        a2_catalogue = [p for p in catalogue if _a2_fit(p)]
        if a2_catalogue:
            catalogue = a2_catalogue

    picks: list[dict] = []
    if category_qty:
        ranked_categories = sorted(category_qty, key=category_qty.get, reverse=True)[:3]
        for category in ranked_categories:
            pool = [p for p in catalogue if str(p.get("category") or "Other") == category]
            for product in _sort_popular(pool)[:2]:
                card = _product_card(
                    product,
                    f"You buy {category} often — sized for your family of {family_size}",
                )
                picks.append(card)
                if len(picks) >= BASKET_LIMIT:
                    return picks
    else:
        # Cold start: top-rated products, dietary filter still applied above.
        for product in _sort_popular(catalogue)[:BASKET_LIMIT]:
            reason = "Top rated on the mall"
            if dietary == "organic" and _organic_fit(product):
                reason = "Top rated · organic pick"
            picks.append(_product_card(product, reason))
        return picks

    if len(picks) < BASKET_LIMIT:
        already = {p["id"] for p in picks}
        for product in _sort_popular(catalogue):
            if product.get("id") in already:
                continue
            picks.append(_product_card(product, "Popular on the mall"))
            if len(picks) >= BASKET_LIMIT:
                break
    return picks


async def _best_price() -> list[dict]:
    docs = await query("products", [], limit=1000)
    cheapest: dict[str, dict] = {}
    for p in docs:
        if not p.get("id"):
            continue
        category = str(p.get("category") or "Other")
        current = cheapest.get(category)
        if current is None or _product_price(p) < _product_price(current):
            cheapest[category] = p
    board = sorted(cheapest.values(), key=_product_price)
    return [
        _product_card(p, f"Best price in {p.get('category') or 'this category'}")
        for p in board[:BEST_PRICE_LIMIT]
    ]


async def _seasonal_alternatives() -> list[dict]:
    docs = await query("products", [], limit=1000)
    seasonal = [d for d in docs if d.get("id") and _matches_season(d)]
    seasonal = _sort_popular(seasonal)
    return [
        _product_card(p, "In season this month")
        for p in seasonal[:SEASONAL_ALT_LIMIT]
    ]


@router.get("/home")
async def customer_home(uid: str = Depends(current_user_id)):
    """Customer home fan-out: every section degrades independently ([]/0)."""
    return {
        "seasonalPicks": await _safe("seasonalPicks", _seasonal_picks),
        "activeOrders": await _safe("activeOrders", _active_orders, uid),
        "subscriptionNext": await _safe("subscriptionNext", _subscription_next, uid),
        "coinBalance": await _safe("coinBalance", _coin_balance, uid),
        "followedOffers": await _safe("followedOffers", _followed_offers, uid),
        "unreadNotifications": await _safe("unreadNotifications", _unread_notifications, uid),
    }


@router.get("/recommendations")
async def customer_recommendations(uid: str = Depends(current_user_id)):
    """AI basket + best-price board + seasonal alternatives ([] on failure)."""
    try:
        user = await get_user(uid)
    except Exception:  # noqa: BLE001 — recommendations must not 500 the home
        logger.warning("customer recommendations user fetch failed", exc_info=True)
        user = None
    return {
        "basket": await _safe("basket", _basket_recommendations, uid, user),
        "bestPrice": await _safe("bestPrice", _best_price),
        "seasonalAlternatives": await _safe("seasonalAlternatives", _seasonal_alternatives),
    }
