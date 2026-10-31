"""Aggregated home dashboard (endpoints.md §20) — one call hydrates the farmer
home: weather strip, urgent task, vyapari mandi rates, and banners.

Every section degrades independently: a failure or an empty collection yields
null/[] for that section, never a 500 on the whole payload.

Firestore economy: sections backed by shared/global collections (mandi rates,
banners, open demands, published courses) are served through Redis-cached
queries (`db.cached_query`) — one read burst per TTL window instead of a full
collection scan per home load. Per-user sections (notifications, pending
orders/bookings) are cached under per-user keys with short TTLs. The open-task
query runs once per home call and is shared by the urgent-task and task-list
sections.
"""
import asyncio
import logging
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import cached_query, get_doc
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

# Cache TTLs (seconds). Global sections change rarely and are shared by every
# user; per-user sections can change on user action, so they get short TTLs —
# the home screen is a digest, not a real-time feed.
MANDI_RATES_TTL = 300
BANNERS_TTL = 300
DEMANDS_TTL = 120
COURSES_TTL = 600
NOTIFICATIONS_TTL = 20
PENDING_TTL = 30

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


async def _open_tasks(uid: str) -> list[dict]:
    """Single open-task fetch shared by the urgent-task and task-list sections.
    Ranking needs the full open set, so this one cannot be limit-pushed —
    fetching it twice per home call (the old behavior) doubled the read cost."""
    rows = await cached_query(
        f"dash:open_tasks:{uid}",
        tasks_service.COLLECTION,
        [("userId", "==", uid), ("status", "==", "open")],
        ttl_seconds=20,
    )
    return rows


async def _urgent_task(uid: str, rows: list[dict]) -> dict | None:
    """Headline open task: urgent/today/due-now items ranked exactly as the
    /tasks/today endpoint ranks them (tasks.rank.v1 with due-date fallback)."""
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


async def _ranked_tasks(uid: str, rows: list[dict]) -> list[dict]:
    """Top open tasks for the home "Today's Action" list, same ranking as
    /tasks/today (which also folds in not-yet-due open tasks below the fold)."""
    rows = list(rows)
    rows.sort(key=_task_sort_key)
    ranked, _headline = await task_ranking.rank_tasks(uid, "all", rows)
    return ranked


_NOTIFICATION_FIELDS = ("id", "title", "body", "type", "read", "createdAt", "data")


async def _notifications(uid: str) -> list[dict]:
    """Newest notifications for the home banner strip (unread first)."""
    docs = await cached_query(
        f"dash:notifs:{uid}",
        "notifications",
        [("userId", "==", uid)],
        ttl_seconds=NOTIFICATIONS_TTL,
    )
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
    docs = await cached_query("dash:vyapari_rates", "vyapari_rates", [], ttl_seconds=MANDI_RATES_TTL)
    docs.sort(
        key=lambda d: d.get("lastUpdated") or d.get("updatedAt") or d.get("createdAt") or "",
        reverse=True,
    )
    return docs[:MANDI_RATES_LIMIT]


async def _banners() -> list[dict]:
    """Active home-hero banners from the ad_campaigns collection the ads router serves."""
    docs = await cached_query(
        "dash:banners",
        "ad_campaigns",
        [("status", "==", "active")],
        ttl_seconds=BANNERS_TTL,
    )
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
    docs = await cached_query("dash:demands:open", "demands", [("status", "==", "open")], ttl_seconds=DEMANDS_TTL)
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
    docs = await cached_query(
        "dash:courses:published",
        "courses",
        [("status", "==", "published")],
        ttl_seconds=COURSES_TTL,
    )
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


def _equipment_label(d: dict, equipment: dict | None) -> str:
    name = str((equipment or {}).get("name") or "")
    parts = [p for p in (name, d.get("slotName"), d.get("date")) if p]
    return " · ".join(str(p) for p in parts) or "Equipment booking"


async def _pending_orders(uid: str) -> dict:
    """Active purchases + transport/equipment bookings for this farmer. Counts
    use each module's own terminal-status convention; items are the newest 3.
    Each source list is cached under a per-user key so repeat home loads within
    the TTL cost zero Firestore reads."""
    purchases, transport, equipment = await asyncio.gather(
        cached_query(
            f"dash:purchases:{uid}",
            "purchases",
            [("farmerId", "==", uid)],
            ttl_seconds=PENDING_TTL,
        ),
        cached_query(
            f"dash:transport:{uid}",
            "transport_bookings",
            [("userId", "==", uid)],
            ttl_seconds=PENDING_TTL,
        ),
        cached_query(
            f"dash:equipment_bk:{uid}",
            "equipment_bookings",
            [("userId", "==", uid)],
            ttl_seconds=PENDING_TTL,
        ),
    )
    equipment_items = [d for d in equipment if d.get("status") not in EQUIPMENT_TERMINAL_STATUSES]
    equipment_items.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    # One concurrent batch of doc fetches replaces the per-item get_doc loop.
    equipment_ids = [d.get("equipmentId") for d in equipment_items[:PENDING_ITEMS_LIMIT] if d.get("equipmentId")]
    equipment_docs = await asyncio.gather(
        *(get_doc("equipment", eid) for eid in equipment_ids), return_exceptions=True
    )
    equipment_by_id = {
        eid: doc
        for eid, doc in zip(equipment_ids, equipment_docs)
        if isinstance(doc, dict)
    }
    return {
        "purchases": _pending_group(purchases, PURCHASE_TERMINAL_STATUSES, _purchase_label, "/farmer/purchases"),
        "transport": _pending_group(transport, TRANSPORT_TERMINAL_STATUSES, _transport_label, "/farmer/transport"),
        "equipment": {
            "count": len(equipment_items),
            "items": [
                {
                    "id": d.get("id"),
                    "label": _equipment_label(d, equipment_by_id.get(d.get("equipmentId") or "")),
                    "status": d.get("status", ""),
                    "createdAt": d.get("createdAt"),
                    "linkHint": "/farmer/equipment",
                }
                for d in equipment_items[:PENDING_ITEMS_LIMIT]
            ],
        },
    }


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
    open_rows = await _safe(_open_tasks(uid), [])
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
        _safe(_urgent_task(uid, open_rows), None),
        _safe(_ranked_tasks(uid, open_rows), []),
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
