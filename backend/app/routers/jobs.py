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


@router.post("/broker/offers/expire")
async def expire_stale_broker_offers(x_cron_secret: str | None = Header(None, alias="X-Cron-Secret")):
    """WS-05 step 1: auto-expire negotiating deals whose offer TTL lapsed."""
    _check_cron_secret(x_cron_secret)
    from datetime import datetime, timezone

    from app.core.db import query, set_doc
    from app.services.notify import notify_user

    now = datetime.now(timezone.utc)
    deals = await query("broker_deals", [("status", "==", "negotiating")], limit=2000)
    expired = 0
    for deal in deals:
        raw = deal.get("expiresAt")
        if not raw:
            continue
        try:
            due = datetime.fromisoformat(str(raw))
            if due.tzinfo is None:
                due = due.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
        if due > now:
            continue
        deal["status"] = "expired"
        deal["updatedAt"] = now.isoformat()
        await set_doc("broker_deals", deal["id"], deal)
        await notify_user(
            deal.get("brokerId"),
            type="deal_offer_expired",
            title="Offer expired / ऑफर समाप्त",
            body=f"{deal.get('commodity', '')} — the farmer's response window closed",
            path=f"/dashboard/p/broker/deals/{deal['id']}",
        )
        expired += 1
    return {"expired": expired}


@router.post("/dairy/adulteration/route-summary")
async def dairy_adulteration_route_summary_job(
    x_cron_secret: str | None = Header(None, alias="X-Cron-Secret"),
):
    """WS-07 M17 — weekly route-level adulteration summary (DairyOS).

    Aggregates the last 7 days of stored collection `adulteration` annotations
    per procurement route (route id, flagged count, total, top members by flag
    rate) into `dairy_route_anomaly_summaries` for the dairy console. Reads only
    stored annotations — it makes NO new gateway calls per collection.
    """
    _check_cron_secret(x_cron_secret)
    period_end = datetime.now(timezone.utc).date()
    period_start = period_end - timedelta(days=6)
    window_from = period_start.isoformat()
    window_to = period_end.isoformat()

    collections = await query("milk_collections", [], limit=5000)
    routes = await query("dairy_routes", [], limit=2000)

    route_by_farmer: dict[tuple[str, str], str] = {}
    route_docs: dict[str, dict] = {}
    for route in routes:
        route_id = route.get("id")
        if not route_id:
            continue
        route_docs[route_id] = route
        for stop in route.get("stops") or []:
            farmer_id = stop.get("farmerId")
            if farmer_id:
                route_by_farmer[(route.get("managerId"), farmer_id)] = route_id

    buckets: dict[str, dict] = {}
    for col in collections:
        day = str(col.get("date") or "")
        if not day or not (window_from <= day <= window_to):
            continue
        route_id = route_by_farmer.get((col.get("dairyId"), col.get("farmerId")))
        if not route_id:
            continue
        bucket = buckets.setdefault(
            route_id,
            {"routeId": route_id, "managerId": col.get("dairyId"), "flagged": 0, "total": 0, "members": {}},
        )
        bucket["total"] += 1
        member_key = col.get("memberId") or col.get("farmerCode") or col.get("farmerId") or "unknown"
        member = bucket["members"].setdefault(
            member_key, {"memberId": member_key, "flagged": 0, "total": 0}
        )
        member["total"] += 1
        if bool((col.get("adulteration") or {}).get("anomaly")):
            bucket["flagged"] += 1
            member["flagged"] += 1

    now_iso = datetime.now(timezone.utc).isoformat()
    written: list[dict] = []
    for route_id, bucket in buckets.items():
        top_members = sorted(
            bucket["members"].values(),
            key=lambda m: (m["flagged"] / m["total"] if m["total"] else 0.0, m["flagged"]),
            reverse=True,
        )[:5]
        summary = {
            "id": f"dairy_route_anomaly_{route_id}_{window_to}",
            "routeId": route_id,
            "routeName": (route_docs.get(route_id) or {}).get("routeName", ""),
            "managerId": bucket["managerId"],
            "periodFrom": window_from,
            "periodEnd": window_to,
            "flagged": bucket["flagged"],
            "total": bucket["total"],
            "topMembers": [
                {
                    "memberId": m["memberId"],
                    "flagged": m["flagged"],
                    "total": m["total"],
                    "flagRate": round(m["flagged"] / m["total"], 3) if m["total"] else 0.0,
                }
                for m in top_members
            ],
            "generatedAt": now_iso,
        }
        await set_doc("dairy_route_anomaly_summaries", summary["id"], summary)
        written.append(summary)

    return {
        "routes": len(written),
        "flagged": sum(s["flagged"] for s in written),
        "collections": len(collections),
        "periodStart": window_from,
        "periodEnd": window_to,
    }
