"""Aggregated home dashboard (endpoints.md §20) — one call hydrates the farmer
home: weather strip, urgent task, vyapari mandi rates, and banners.

Every section degrades independently: a failure or an empty collection yields
null/[] for that section, never a 500 on the whole payload.
"""
import asyncio
import logging
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import query
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
    """Weather strip from the farm boundary; None when no location is known."""
    points = user.get("farmBoundaryPoints") or []
    if not points:
        return None
    try:
        return await fetch_weather(float(points[0]["lat"]), float(points[0]["lng"]))
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


async def _safe(coro, fallback):
    try:
        return await coro
    except Exception:  # noqa: BLE001 — one bad section never 500s the home call
        logger.warning("dashboard/home section failed", exc_info=True)
        return fallback


@router.get("/home")
async def home_dashboard(uid: str = Depends(current_user_id)):
    """Aggregated farmer home — weather, urgent task, vyapari rates, banners."""
    user = await get_user(uid)
    weather, urgent_task, rates, banners = await asyncio.gather(
        _safe(_weather_for(user or {}), None),
        _safe(_urgent_task(uid), None),
        _safe(_mandi_rates(), []),
        _safe(_banners(), []),
    )
    return {
        "weather": weather,
        "urgentTask": urgent_task,
        "mandiRates": rates,
        "banners": banners,
    }
