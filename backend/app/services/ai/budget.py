"""Per-day AI cost budget (ai_implementation_plan §1.1).

Redis counters `ai:cost:<model>:<yyyymmdd>`; 80 % of AI_DAILY_BUDGET_USD logs an
admin alert, 100 % raises BudgetExhausted so the gateway degrades to the
deterministic fallback instead of erroring. Fails open when Redis is down.
"""
import logging
from datetime import datetime, timezone

from app.core.cache import REDIS_ERRORS, get_redis
from app.core.config import settings

log = logging.getLogger(__name__)


class BudgetExhausted(Exception):
    """Raised when the daily AI spend has reached the configured cap."""


def _day() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d")


def _key(model: str) -> str:
    return f"ai:cost:{model}:{_day()}"


async def current_spend(model: str) -> float:
    try:
        value = await (await get_redis()).get(_key(model))
    except REDIS_ERRORS as exc:
        log.warning("budget unavailable (read %s): %s", model, exc)
        return 0.0
    return float(value or 0.0)


async def over_budget(model: str) -> bool:
    return await current_spend(model) >= settings.ai_daily_budget_usd


async def record_cost(model: str, usd: float) -> None:
    try:
        r = await get_redis()
        total = float(await r.incrbyfloat(_key(model), usd))
        await r.expire(_key(model), 2 * 86400)
    except REDIS_ERRORS as exc:
        log.warning("budget unavailable (record %s): %s", model, exc)
        return
    limit = settings.ai_daily_budget_usd
    if total >= limit:
        log.error("AI daily budget exhausted for %s: %.4f/%.2f USD", model, total, limit)
        raise BudgetExhausted(model)
    if total >= 0.8 * limit:
        log.warning("AI daily budget at %.0f%% for %s: %.4f/%.2f USD", total / limit * 100, model, total, limit)
