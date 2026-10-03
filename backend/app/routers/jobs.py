# Cron-triggered job endpoints live here. Cloud Scheduler hits this nightly
# (0 22 * * * IST) with the X-Cron-Secret header — scheduler setup belongs to
# docs/deployment/backend-deploy.md.
import logging
from datetime import date, datetime, timezone, timedelta

from fastapi import APIRouter, Header, HTTPException

from app.core.config import settings
from app.core.db import query, set_doc
from app.models.settlements import SettlementRunIn
from app.services.escrow import release_due_escrows
from app.services.payments import list_razorpay_payments
from app.services.rent_reminders import run_rent_reminders
from app.services.settlements import process_payouts, run_settlements

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


@router.post("/settlements/payouts")
async def run_settlement_payouts_job(
    body: SettlementRunIn,
    x_cron_secret: str | None = Header(None, alias="X-Cron-Secret"),
):
    """Weekly payout pass (WS-03): RazorpayX payouts to verified bank accounts;
    beneficiaries without one are put onHold with a reason."""
    _check_cron_secret(x_cron_secret)
    if body.periodStart is None or body.periodEnd is None:
        monday = date.today() - timedelta(days=date.today().weekday())
        period_start = monday - timedelta(days=7)
        period_end = monday - timedelta(days=1)
    else:
        period_start = date.fromisoformat(body.periodStart)
        period_end = date.fromisoformat(body.periodEnd)
    return await process_payouts(period_start.isoformat(), period_end.isoformat())


@router.post("/payments/reconcile")
async def reconcile_payments_job(x_cron_secret: str | None = Header(None, alias="X-Cron-Secret")):
    """Nightly reconciliation: Razorpay payments vs local payment docs.
    Discrepancies are written to audit_logs (admin alert surface)."""
    _check_cron_secret(x_cron_secret)
    remote = await list_razorpay_payments()
    remote_by_order = {p.get("order_id"): p for p in remote if p.get("order_id")}
    local = await query("payments", [], limit=2000)
    local_by_order = {p.get("razorpayOrderId"): p for p in local if p.get("razorpayOrderId")}

    discrepancies = []
    for order_id, remote_payment in remote_by_order.items():
        payment = local_by_order.get(order_id)
        if payment is None:
            discrepancies.append(
                {
                    "type": "remote_only",
                    "orderId": order_id,
                    "razorpayPaymentId": remote_payment.get("id"),
                    "status": remote_payment.get("status"),
                }
            )
        elif remote_payment.get("status") == "captured" and payment.get("status") != "paid":
            discrepancies.append(
                {
                    "type": "status_mismatch",
                    "orderId": order_id,
                    "local": payment.get("status"),
                    "remote": remote_payment.get("status"),
                }
            )
    for order_id, payment in local_by_order.items():
        if order_id not in remote_by_order:
            discrepancies.append(
                {"type": "local_only", "orderId": order_id, "paymentId": payment.get("id")}
            )

    if discrepancies:
        now = datetime.now(timezone.utc)
        await set_doc(
            "audit_logs",
            f"aud_recon_{now.strftime('%Y%m%d%H%M%S')}",
            {
                "action": "PAYMENT_RECONCILIATION",
                "count": len(discrepancies),
                "discrepancies": discrepancies[:50],
                "at": now.isoformat(),
            },
        )
    return {
        "remoteChecked": len(remote_by_order),
        "localChecked": len(local_by_order),
        "discrepancies": len(discrepancies),
    }


@router.post("/escrow/release-due")
async def release_due_escrow_job(x_cron_secret: str | None = Header(None, alias="X-Cron-Secret")):
    """Release held escrows whose dispute window closed silently (WS-03)."""
    _check_cron_secret(x_cron_secret)
    return await release_due_escrows()


@router.post("/kyc/expiry-reminders")
async def kyc_expiry_reminders_job(x_cron_secret: str | None = Header(None, alias="X-Cron-Secret")):
    """Notify holders 30 days before a KYC document expires (WS-04)."""
    _check_cron_secret(x_cron_secret)
    from app.services.kyc import expiry_reminders

    return await expiry_reminders()
