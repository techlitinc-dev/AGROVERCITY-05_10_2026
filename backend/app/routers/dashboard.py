"""Aggregated home dashboard (endpoints.md §20) — one call hydrates the farmer
home: weather strip, urgent task, vyapari mandi rates, and banners.

Every section degrades independently: a failure or an empty collection yields
null/[] for that section, never a 500 on the whole payload.
"""
import asyncio
import logging
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import get_doc, query
from app.core.deps import current_user_id
from app.services import task_ranking
from app.services import tasks as tasks_service
from app.services.users import get_user
from app.services.weather import fetch_weather

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

logger = logging.getLogger(__name__)

MANDI_RATES_LIMIT = 10
BANNERS_LIMIT = 5
HOME_BANNER_PLACEMENT = "home_hero"
BUYER_OFFERS_LIMIT = 5
LEARNING_RECS_LIMIT = 3
PENDING_ITEMS_LIMIT = 3
TASKS_LIMIT = 5
NOTIFICATIONS_LIMIT = 5

# Terminal statuses per source module (purchases.py / transport.py /
# equipment.py+equipment_rental.py) — everything else counts as still active.
PURCHASE_TERMINAL_STATUSES = ("completed", "cancelled")
TRANSPORT_TERMINAL_STATUSES = ("delivered", "cancelled")
EQUIPMENT_TERMINAL_STATUSES = ("completed", "cancelled", "rejected")

EMPTY_PENDING_ORDERS = {
    "purchases": {"count": 0, "items": []},
    "transport": {"count": 0, "items": []},
    "equipment": {"count": 0, "items": []},
}


def _error(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": {}},
    )


def _task_sort_key(task: dict):
    """Same deterministic ordering the /tasks/today endpoint uses."""
    return (
        0 if task.get("priority") == "urgent" else 1,
        task.get("dueAt") or "9999-12-31",
        task.get("taskId") or "",
    )


async def _weather_for(user: dict) -> dict | None:
    """Weather strip from farm boundary, district center, or state hub."""
    points = user.get("farmBoundaryPoints") or []
    if points and isinstance(points[0], dict) and "lat" in points[0]:
        lat, lng = float(points[0]["lat"]), float(points[0]["lng"])
    else:
        # Fallback to Maharashtra agri capital (Nashik: 20.011, 73.790)
        lat, lng = 20.011, 73.790
    try:
        return await fetch_weather(lat, lng)
    except Exception:  # noqa: BLE001 — weather must never break the home payload
        logger.warning("weather fetch failed for home dashboard", exc_info=True)
        return None


async def _urgent_task(uid: str) -> dict | None:
    """Headline open task: urgent/today/due-now items ranked exactly as the
    /tasks/today endpoint ranks them (tasks.rank.v1 with due-date fallback)."""
    rows = await query(
        tasks_service.COLLECTION, [("userId", "==", uid), ("status", "==", "open")], limit=1000
    )
    today = date.today().isoformat()
    items = [
        task
        for task in rows
        if task.get("priority") in ("urgent", "today")
        or (task.get("dueAt") or "")[:10] <= today
    ]
    items.sort(key=_task_sort_key)
    ranked, _headline = await task_ranking.rank_tasks(uid, "all", items)
    return ranked[0] if ranked else None


async def _tasks_list(uid: str) -> list[dict]:
    """Top open tasks for the home "Today's Action" list, same ranking as
    /tasks/today (which also folds in not-yet-due open tasks below the fold)."""
    rows = await query(
        tasks_service.COLLECTION, [("userId", "==", uid), ("status", "==", "open")], limit=1000
    )
    rows.sort(key=_task_sort_key)
    ranked, _headline = await task_ranking.rank_tasks(uid, "all", rows)
    return ranked[:TASKS_LIMIT]


_NOTIFICATION_FIELDS = ("id", "title", "body", "type", "read", "createdAt", "data")


async def _notifications(uid: str) -> list[dict]:
    """Newest notifications for the home banner strip (unread first)."""
    docs = await query("notifications", [("userId", "==", uid)], limit=1000)
    docs.sort(
        key=lambda d: (bool(d.get("read")), d.get("createdAt") or ""),
    )
    items = []
    for d in docs[:NOTIFICATIONS_LIMIT]:
        item = {f: d.get(f) for f in _NOTIFICATION_FIELDS}
        item["read"] = bool(d.get("read"))
        item["type"] = d.get("type") or "general"
        item["data"] = d.get("data") or {}
        items.append(item)
    return items


async def _mandi_rates() -> list[dict]:
    """"Aaj ke Bhav" rows from the same vyapari_rates collection /mandi/vyapari-rates serves."""
    docs = await query("vyapari_rates", [], limit=1000)
    docs.sort(
        key=lambda d: d.get("lastUpdated") or d.get("updatedAt") or d.get("createdAt") or "",
        reverse=True,
    )
    return docs[:MANDI_RATES_LIMIT]


async def _banners() -> list[dict]:
    """Active home-hero banners from the ad_campaigns collection the ads router serves."""
    docs = await query("ad_campaigns", [("status", "==", "active")], limit=100)
    docs = [d for d in docs if d.get("placement") == HOME_BANNER_PLACEMENT]
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return [
        {
            "id": d.get("id"),
            "title": d.get("title", ""),
            "headline": d.get("headline", ""),
            "description": d.get("description", ""),
            "bannerUrl": d.get("bannerUrl", ""),
            "ctaText": d.get("ctaText", ""),
            "targetType": d.get("targetType"),
            "targetId": d.get("targetId"),
            "placement": d.get("placement"),
        }
        for d in docs[:BANNERS_LIMIT]
    ]


async def _buyer_offers(user: dict) -> list[dict]:
    """Top open buyer demands (collection `demands`), the farmer's active crops
    first — same status value the demands router lists ("open")."""
    docs = await query("demands", [("status", "==", "open")], limit=1000)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    crops = {
        str(crop).strip().lower()
        for crop in (user.get("activeCrops") or user.get("crops") or user.get("primaryCrops") or [])
        if str(crop).strip()
    }
    matched = [d for d in docs if str(d.get("crop") or "").strip().lower() in crops]
    others = [d for d in docs if str(d.get("crop") or "").strip().lower() not in crops]
    return [
        {
            "id": d.get("id"),
            "crop": d.get("crop", ""),
            "quantity": d.get("quantity"),
            "unit": d.get("unit"),
            "budgetPerQuintal": d.get("maxPrice"),
            "location": d.get("deliveryLocation") or d.get("state"),
            "offersCount": d.get("offersCount", 0),
            "createdAt": d.get("createdAt"),
        }
        for d in (matched + others)[:BUYER_OFFERS_LIMIT]
    ]


async def _learning_recommendations(uid: str) -> list[dict]:
    """Three published courses not created by this user, mirroring the catalog
    ordering in courses.py (featured → bestseller → sales → newest). Re-queries
    the collection directly so this router never imports the courses router."""
    docs = await query("courses", [("status", "==", "published")], limit=1000)
    docs = [d for d in docs if d.get("id") and d.get("instructorId") != uid]
    docs.sort(
        key=lambda d: (
            1 if d.get("isFeatured") else 0,
            1 if d.get("isBestseller") else 0,
            int(d.get("salesCount") or 0),
            str(d.get("createdAt") or ""),
        ),
        reverse=True,
    )
    return [
        {
            "id": d.get("id"),
            "title": d.get("title", ""),
            "instructorName": d.get("instructorName", ""),
            "category": d.get("category", ""),
            "priceRupees": d.get("priceRupees", 0),
            "thumbnailUrl": d.get("thumbnailUrl", ""),
            "ratingAverage": d.get("ratingAverage"),
            "ratingCount": d.get("ratingCount", 0),
            "isFeatured": bool(d.get("isFeatured")),
            "createdAt": d.get("createdAt"),
        }
        for d in docs[:LEARNING_RECS_LIMIT]
    ]


def _pending_group(docs: list[dict], terminal: tuple[str, ...], label_of, link_hint: str) -> dict:
    active = [d for d in docs if d.get("status") not in terminal]
    active.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return {
        "count": len(active),
        "items": [
            {
                "id": d.get("id"),
                "label": label_of(d),
                "status": d.get("status", ""),
                "createdAt": d.get("createdAt"),
                "linkHint": link_hint,
            }
            for d in active[:PENDING_ITEMS_LIMIT]
        ],
    }


def _purchase_label(d: dict) -> str:
    parts = [str(d.get("crop") or "Produce")]
    if d.get("quantity"):
        parts.append(f"{d['quantity']} {d.get('unit') or 'quintal'}")
    if d.get("buyerName"):
        parts.append(f"→ {d['buyerName']}")
    return " · ".join(parts)


def _transport_label(d: dict) -> str:
    parts = []
    if d.get("commodity"):
        parts.append(str(d["commodity"]))
    if d.get("pickup") or d.get("drop"):
        parts.append(f"{d.get('pickup') or '?'} → {d.get('drop') or '?'}")
    if d.get("date"):
        parts.append(str(d["date"]))
    if not parts and d.get("vehicleType"):
        parts.append(str(d["vehicleType"]))
    return " · ".join(parts) or "Transport booking"


async def _equipment_label(d: dict) -> str:
    name = ""
    try:
        equipment = await get_doc("equipment", d.get("equipmentId") or "")
        if equipment:
            name = str(equipment.get("name") or "")
    except Exception:  # noqa: BLE001 — label degrades to slot + date
        name = ""
    parts = [p for p in (name, d.get("slotName"), d.get("date")) if p]
    return " · ".join(str(p) for p in parts) or "Equipment booking"


async def _pending_orders(uid: str) -> dict:
    """Active purchases + transport/equipment bookings for this farmer. Counts
    use each module's own terminal-status convention; items are the newest 3."""
    purchases, transport, equipment = await asyncio.gather(
        query("purchases", [("farmerId", "==", uid)], limit=1000),
        query("transport_bookings", [("userId", "==", uid)], limit=1000),
        query("equipment_bookings", [("userId", "==", uid)], limit=1000),
    )
    equipment_items = [d for d in equipment if d.get("status") not in EQUIPMENT_TERMINAL_STATUSES]
    equipment_items.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return {
        "purchases": _pending_group(purchases, PURCHASE_TERMINAL_STATUSES, _purchase_label, "/farmer/purchases"),
        "transport": _pending_group(transport, TRANSPORT_TERMINAL_STATUSES, _transport_label, "/farmer/transport"),
        "equipment": {
            "count": len(equipment_items),
            "items": [
                {
                    "id": d.get("id"),
                    "label": await _equipment_label(d),
                    "status": d.get("status", ""),
                    "createdAt": d.get("createdAt"),
                    "linkHint": "/farmer/equipment",
                }
                for d in equipment_items[:PENDING_ITEMS_LIMIT]
            ],
        },
    }


async def _safe(coro, fallback):
    try:
        return await coro
    except Exception:  # noqa: BLE001 — one bad section never 500s the home call
        logger.warning("dashboard/home section failed", exc_info=True)
        return fallback


@router.get("/home")
async def home_dashboard(uid: str = Depends(current_user_id)):
    """Aggregated farmer home — weather, urgent task, vyapari rates, banners,
    buyer offers, learning recommendations and pending orders/bookings."""
    user = await get_user(uid)
    (
        weather,
        urgent_task,
        tasks,
        notifications,
        rates,
        banners,
        buyer_offers,
        learning_recommendations,
        pending_orders,
    ) = await asyncio.gather(
        _safe(_weather_for(user or {}), None),
        _safe(_urgent_task(uid), None),
        _safe(_tasks_list(uid), []),
        _safe(_notifications(uid), []),
        _safe(_mandi_rates(), []),
        _safe(_banners(), []),
        _safe(_buyer_offers(user or {}), []),
        _safe(_learning_recommendations(uid), []),
        _safe(_pending_orders(uid), dict(EMPTY_PENDING_ORDERS)),
    )
    return {
        "weather": weather,
        "urgentTask": urgent_task,
        "tasks": tasks,
        "notifications": notifications,
        "mandiRates": rates,
        "banners": banners,
        "buyerOffers": buyer_offers,
        "learningRecommendations": learning_recommendations,
        "pendingOrders": pending_orders,
    }
