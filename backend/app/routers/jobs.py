# Cron-triggered job endpoints live here. Cloud Scheduler hits this nightly
# (0 22 * * * IST) with the X-Cron-Secret header — scheduler setup belongs to
# docs/deployment/backend-deploy.md.
import logging
from datetime import date, timedelta

from fastapi import APIRouter, Header, HTTPException

from app.core.config import settings
from app.models.settlements import SettlementRunIn
from app.services.rent_reminders import run_rent_reminders
from app.services.settlements import run_settlements

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _check_cron_secret(x_cron_secret: str | None):
    if not settings.cron_secret:
        logger.warning("CRON_SECRET unset — allowing job run without auth (dev mode)")
    elif x_cron_secret != settings.cron_secret:
        raise HTTPException(
            status_code=401,
            detail={"code": "CRON_UNAUTHORIZED", "message": "invalid cron secret", "fieldErrors": {}},
        )


@router.post("/rent-reminders/run")
async def run_rent_reminders_job(x_cron_secret: str | None = Header(None, alias="X-Cron-Secret")):
    _check_cron_secret(x_cron_secret)
    return await run_rent_reminders()


@router.post("/settlements/run")
async def run_settlements_job(
    body: SettlementRunIn,
    x_cron_secret: str | None = Header(None, alias="X-Cron-Secret"),
):
    _check_cron_secret(x_cron_secret)
    if body.periodStart is None or body.periodEnd is None:
        monday = date.today() - timedelta(days=date.today().weekday())
        period_start = monday - timedelta(days=7)
        period_end = monday - timedelta(days=1)
    else:
        period_start = date.fromisoformat(body.periodStart)
        period_end = date.fromisoformat(body.periodEnd)
    summary = await run_settlements(period_start.isoformat(), period_end.isoformat())
    return {
        **summary,
        "periodStart": period_start.isoformat(),
        "periodEnd": period_end.isoformat(),
    }
