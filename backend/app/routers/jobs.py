# Cron-triggered job endpoints live here. Cloud Scheduler hits this nightly
# (0 22 * * * IST) with the X-Cron-Secret header — scheduler setup belongs to
# docs/deployment/backend-deploy.md.
import logging
import uuid
from datetime import date, datetime, timezone, timedelta

from fastapi import APIRouter, Header, HTTPException

from app.core.config import settings
from app.core.db import query, set_doc
from app.models.settlements import SettlementRunIn
from app.services.escrow import release_due_escrows
from app.services.fraud_scan import run_fraud_scan
from app.services.notify import run_notifications_digest
from app.services.payments import list_razorpay_payments
from app.services.rent_reminders import run_rent_reminders
from app.services.search_index import reindex as reindex_search
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


@router.post("/notifications_digest/run")
async def run_notifications_digest_job(x_cron_secret: str | None = Header(None, alias="X-Cron-Secret")):
    """WS-02 — drain queued digest notifications into one push per user."""
    _check_cron_secret(x_cron_secret)
    return await run_notifications_digest()


@router.post("/fraud_scan")
async def run_fraud_scan_job(x_cron_secret: str | None = Header(None, alias="X-Cron-Secret")):
    """WS-03 (M8) — nightly fraud batch: soft-hold + queue high-risk accounts."""
    _check_cron_secret(x_cron_secret)
    return await run_fraud_scan()


@router.post("/search_reindex")
async def run_search_reindex_job(x_cron_secret: str | None = Header(None, alias="X-Cron-Secret")):
    """WS-08 (M23) — re-embed changed search documents (idempotent + resumable)."""
    _check_cron_secret(x_cron_secret)
    return await reindex_search()


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


@router.post("/customer-escrow/release-due")
async def release_due_customer_escrow_job(x_cron_secret: str | None = Header(None, alias="X-Cron-Secret")):
    """FarmGate deposit auto-release: held customer_order escrows whose 72h
    inspection window closed without a dispute (same shape as escrow/release-due)."""
    _check_cron_secret(x_cron_secret)
    from app.routers.emarket_customer import release_due_customer_escrows

    return await release_due_customer_escrows()


async def run_subscription_planner() -> dict:
    """WS-03 task 3.31 — standing-demand planner: every active
    customer_subscriptions doc whose nextRunAt has passed gets one quote
    (status quote_pending, subscriptionId set) through the normal quote →
    escrow → inspection pipeline — escrow is never bypassed. nextRunAt then
    advances by the frequency (daily +1d, weekly +7d, seasonal +90d), so an
    immediate second run generates 0."""
    from app.routers.emarket_customer import (
        FREQUENCY_DELTAS,
        create_subscription_quote,
    )

    now = datetime.now(timezone.utc)
    subs = await query("customer_subscriptions", [("status", "==", "active")], limit=1000)
    generated = 0
    for sub in subs:
        next_run_at = sub.get("nextRunAt") or ""
        try:
            due = datetime.fromisoformat(next_run_at)
            if due.tzinfo is None:
                due = due.replace(tzinfo=timezone.utc)
        except ValueError:
            due = None
        if due is None or due > now:
            continue
        await create_subscription_quote(sub)
        frequency = sub.get("frequency") or "weekly"
        sub["nextRunAt"] = (now + FREQUENCY_DELTAS.get(frequency, FREQUENCY_DELTAS["weekly"])).isoformat()
        sub["updatedAt"] = now.isoformat()
        await set_doc("customer_subscriptions", sub["id"], sub)
        generated += 1
    return {"generated": generated}


@router.post("/subscriptions/planner/run")
async def run_subscription_planner_job(x_cron_secret: str | None = Header(None, alias="X-Cron-Secret")):
    """WS-03 task 3.31: recurring quote generation for due customer subscriptions."""
    _check_cron_secret(x_cron_secret)
    return await run_subscription_planner()


async def run_standing_demands_planner() -> dict:
    """P1-22 (spec B2): Recurring direct-buyer standing-demands planner:
    every open standing_orders doc whose nextRunAt has passed generates
    one demand doc (status open, source standing_order, standingOrderId set).
    Advances nextRunAt by 7 days (or intervalDays)."""
    now = datetime.now(timezone.utc)
    standing_orders = await query("standing_orders", [("status", "==", "open")], limit=1000)
    generated = 0
    for so in standing_orders:
        next_run_at = so.get("nextRunAt") or so.get("startDate") or ""
        try:
            due = datetime.fromisoformat(next_run_at)
            if due.tzinfo is None:
                due = due.replace(tzinfo=timezone.utc)
        except ValueError:
            due = None
        if due is not None and due > now:
            continue
        demand_id = f"dmd_standing_{uuid.uuid4().hex[:10]}"
        interval_days = int(so.get("intervalDays") or 7)
        demand = {
            "id": demand_id,
            "standingOrderId": so.get("id"),
            "buyerId": so.get("buyerId"),
            "crop": so.get("crop"),
            "variety": so.get("variety", ""),
            "grade": so.get("grade", "A"),
            "quantity": so.get("quantityPerSlot") or so.get("quantity") or 10.0,
            "expectedPrice": (float(so.get("minPrice") or 0) + float(so.get("maxPrice") or 0)) / 2 or 4500.0,
            "minPrice": so.get("minPrice"),
            "maxPrice": so.get("maxPrice"),
            "location": so.get("location") or so.get("district") or "",
            "state": so.get("state") or "",
            "deliveryWindow": so.get("deliveryWindow") or "within_7_days",
            "source": "standing_order",
            "status": "open",
            "createdAt": now.isoformat(),
            "updatedAt": now.isoformat(),
        }
        await set_doc("demands", demand_id, demand)
        so["nextRunAt"] = (now + timedelta(days=interval_days)).isoformat()
        so["lastGeneratedAt"] = now.isoformat()
        so["updatedAt"] = now.isoformat()
        await set_doc("standing_orders", so["id"], so)
        generated += 1
    return {"scanned": len(standing_orders), "generated": generated}


@router.post("/demands/standing/run")
async def run_standing_demands_job(x_cron_secret: str | None = Header(None, alias="X-Cron-Secret")):
    """P1-22: Recurring demand generation for due standing orders (direct buyer B2)."""
    _check_cron_secret(x_cron_secret)
    return await run_standing_demands_planner()


@router.post("/kyc/expiry-reminders")
async def kyc_expiry_reminders_job(x_cron_secret: str | None = Header(None, alias="X-Cron-Secret")):
    """Notify holders 30 days before a KYC document expires (WS-04)."""
    _check_cron_secret(x_cron_secret)
    from app.services.kyc import expiry_reminders

    return await expiry_reminders()


async def reverify_expired_instructor_licences() -> dict:
    """WS-02 task 2.29 — flip approved instructor KYC cases back to
    needs-re-verification when a credential licence has passed its expiry.

    Scans instructor cases whose status is approved; any credential doc (DGCA /
    degree / NABARD empanelment) whose `licenceExpiry` date is before today marks
    the case for re-verification and writes an `audit_logs` entry per case."""
    from app.services.kyc import (
        CASE_STATUS_APPROVED,
        CASE_STATUS_NEEDS_REVERIFY,
        CREDENTIAL_EXPIRY_FIELD,
    )

    today = datetime.now(timezone.utc).date()
    now = datetime.now(timezone.utc).isoformat()
    cases = await query("kyc_cases", [], limit=2000)
    reverted = 0
    for case in cases:
        if case.get("persona") != "instructor" or case.get("status") != CASE_STATUS_APPROVED:
            continue
        expired_types: list[str] = []
        for doc in case.get("docs") or []:
            expiry_field = CREDENTIAL_EXPIRY_FIELD.get(doc.get("type"))
            if not expiry_field:
                continue
            raw = doc.get(expiry_field)
            if not raw:
                continue
            try:
                expiry = datetime.fromisoformat(str(raw)).date()
            except ValueError:
                continue
            if expiry < today:
                doc["reverifyRequired"] = True
                expired_types.append(doc.get("type"))
        if not expired_types:
            continue
        case["status"] = CASE_STATUS_NEEDS_REVERIFY
        case["reverifyReason"] = "licence_expired"
        case["updatedAt"] = now
        await set_doc("kyc_cases", case["caseId"], case)
        await set_doc(
            "audit_logs",
            f"aud_kyc_reverify_{case['caseId']}_{today.isoformat()}",
            {
                "action": "KYC_LICENCE_REVERIFY",
                "caseId": case["caseId"],
                "userId": case.get("userId"),
                "persona": "instructor",
                "expiredDocs": expired_types,
                "reason": "licence_expired",
                "at": now,
            },
        )
        reverted += 1
    return {"reverted": reverted}


@router.post("/kyc/reverify-expired-instructor-licences")
async def reverify_expired_instructor_licences_job(
    x_cron_secret: str | None = Header(None, alias="X-Cron-Secret"),
):
    """WS-02 task 2.29: recurring licence-expiry re-verification for instructors."""
    _check_cron_secret(x_cron_secret)
    return await reverify_expired_instructor_licences()


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
            deepLink=f"/dashboard/p/broker/deals/{deal['id']}",
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


@router.post("/gateway-health/run")
async def run_gateway_health_job(x_cron_secret: str | None = Header(None, alias="X-Cron-Secret")):
    """WS-04 — probe the 7/12 (Mahabhulekh) gateway and record a health row."""
    _check_cron_secret(x_cron_secret)
    from app.services.gateway_health import probe_land_records

    return await probe_land_records()


@router.post("/admin-briefing/run")
async def run_admin_briefing_job(x_cron_secret: str | None = Header(None, alias="X-Cron-Secret")):
    """WS-07 (M31) — nightly admin copilot briefing."""
    _check_cron_secret(x_cron_secret)
    from app.services.copilot import generate_briefing

    return await generate_briefing()


@router.post("/ai-calibration/run")
async def run_ai_calibration_job(x_cron_secret: str | None = Header(None, alias="X-Cron-Secret")):
    """WS-08 — weekly AI calibration aggregation."""
    _check_cron_secret(x_cron_secret)
    from app.services.ai.calibration import run_weekly_calibration

    return await run_weekly_calibration()


@router.post("/churn/score")
async def run_churn_scoring_job(x_cron_secret: str | None = Header(None, alias="X-Cron-Secret")):
    """Phase-08 WS-01 (M28) — nightly churn re-engagement scoring."""
    _check_cron_secret(x_cron_secret)
    from app.services.churn import score_dormant_users

    return await score_dormant_users()


@router.post("/district-crops/propose")
async def propose_district_crops_job(x_cron_secret: str | None = Header(None, alias="X-Cron-Secret")):
    """Phase-08 WS-01 (M33) — propose crops for districts beyond the spec mapping
    (AI proposes as `pending`; an admin approves to `active`)."""
    _check_cron_secret(x_cron_secret)
    from app.services.district_crops import propose_district_crops

    return await propose_district_crops()


@router.post("/ai-golden/run")
async def run_ai_golden_job(x_cron_secret: str | None = Header(None, alias="X-Cron-Secret")):
    """Phase-08 WS-02 — nightly golden-set run (live models in prod); baselines +
    >5pt regression alerts."""
    _check_cron_secret(x_cron_secret)
    from app.services.ai.golden_alerts import run_golden_suite

    return await run_golden_suite()


@router.post("/ai-calibration/backfill")
async def backfill_ai_calibration_job(x_cron_secret: str | None = Header(None, alias="X-Cron-Secret")):
    """Phase-08 WS-02 — backfill missing weekly calibration reports."""
    _check_cron_secret(x_cron_secret)
    from app.services.ai.calibration import backfill

    return await backfill()


@router.post("/ai-decisions/export")
async def export_ai_decisions_job(x_cron_secret: str | None = Header(None, alias="X-Cron-Secret")):
    """Phase-08 WS-04 — export-then-expire ai_decisions older than 90 days."""
    _check_cron_secret(x_cron_secret)
    from app.services.ai.decision_export import export_expired_decisions

    return await export_expired_decisions()


@router.post("/women/reminders")
async def run_women_reminders_job(x_cron_secret: str | None = Header(None, alias="X-Cron-Secret")):
    """WomenHub reminders (phase-05 WS-08):
    (a) SHG members without a deposit doc for the current IST month get one
        `deposit_due` inbox notification per (group, member, month) — the
        deterministic doc id makes reruns idempotent.
    (b) Animal owners with a vaccination due within the next 7 days get one
        `vaccination_due` notification per (animal, vaccine, due date).
    """
    from zoneinfo import ZoneInfo

    from app.core.db import get_doc
    from app.services.notify import DEEP_LINKS

    _check_cron_secret(x_cron_secret)
    month = datetime.now(timezone.utc).astimezone(ZoneInfo("Asia/Kolkata")).strftime("%Y-%m")
    today = date.today()
    horizon = (today + timedelta(days=7)).isoformat()

    deposit_reminders = 0
    groups = await query("shg_groups", [], limit=1000)
    for group in groups:
        for member in group.get("members") or []:
            member_uid = member.get("memberUid")
            if not member_uid:
                continue
            if await get_doc(f"shg_groups/{group['id']}/deposits", f"{month}_{member_uid}"):
                continue
            notif_id = f"deposit_due_{group['id']}_{member_uid}_{month}"
            if await get_doc("notifications", notif_id) is not None:
                continue
            await set_doc(
                "notifications",
                notif_id,
                {
                    "id": notif_id,
                    "userId": member_uid,
                    "title": "SHG deposit due / बचत गट जमा बाकी",
                    "body": (
                        f"Your ₹{int(group.get('monthlyDepositPaisa', 0) or 0) // 100} "
                        f"deposit for {group.get('name', '')} ({month}) is pending"
                    ),
                    "type": "deposit_due",
                    "data": {"type": "deposit_due", "deepLink": DEEP_LINKS["deposit_due"]},
                    "read": False,
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                },
            )
            deposit_reminders += 1

    vaccination_reminders = 0
    animals = await query("livestock_animals", [], limit=2000)
    owner_by_tag = {a.get("tagId"): a.get("ownerId") for a in animals if a.get("tagId")}
    schedules = await query("vaccination_schedules", [], limit=2000)
    for schedule in schedules:
        due = schedule.get("nextDueDate")
        if not due or not (today.isoformat() <= due <= horizon):
            continue
        owner = owner_by_tag.get(schedule.get("animalTagId"))
        if not owner:
            continue
        notif_id = (
            f"vaccination_due_{schedule.get('animalTagId')}_{schedule.get('disease')}_{due}"
        )
        if await get_doc("notifications", notif_id) is not None:
            continue
        await set_doc(
            "notifications",
            notif_id,
            {
                "id": notif_id,
                "userId": owner,
                "title": "Vaccination due / लस बाकी",
                "body": f"{schedule.get('disease', '')} vaccination due {due}",
                "type": "vaccination_due",
                "data": {"type": "vaccination_due", "deepLink": DEEP_LINKS["vaccination_due"]},
                "read": False,
                "createdAt": datetime.now(timezone.utc).isoformat(),
            },
        )
        vaccination_reminders += 1

    return {"depositReminders": deposit_reminders, "vaccinationReminders": vaccination_reminders}


@router.post("/pickup/reminders")
async def run_pickup_reminders_job(x_cron_secret: str | None = Header(None, alias="X-Cron-Secret")):
    """24h / 2h pickup reminders for scheduled purchase pickups.

    A purchase whose pickup.date falls in [now+23h, now+25h] gets one
    `pickup_reminder_24h` inbox doc per trade party; [now+1h, now+3h] gets
    `pickup_reminder_2h`. Doc ids are deterministic per (purchase, window,
    recipient) so cron reruns never duplicate a reminder.
    """
    from app.core.db import get_doc
    from app.services.notify import DEEP_LINKS

    _check_cron_secret(x_cron_secret)
    now = datetime.now(timezone.utc)
    purchases = await query("purchases", [("status", "==", "pickupScheduled")], limit=2000)

    windows = (
        ("pickup24", "pickup_reminder_24h", now + timedelta(hours=23), now + timedelta(hours=25),
         "Pickup tomorrow / कल पिकअप"),
        ("pickup2", "pickup_reminder_2h", now + timedelta(hours=1), now + timedelta(hours=3),
         "Pickup in ~2 hours / २ तासांत पिकअप"),
    )

    sent = {"pickup_reminder_24h": 0, "pickup_reminder_2h": 0}
    scanned = 0
    for purchase in purchases:
        raw_date = (purchase.get("pickup") or {}).get("date")
        if not raw_date:
            continue
        try:
            pickup_at = datetime.fromisoformat(str(raw_date))
            if pickup_at.tzinfo is None:
                pickup_at = pickup_at.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
        scanned += 1
        parties = [p for p in (purchase.get("buyerId"), purchase.get("farmerId")) if p]
        for prefix, notif_type, window_start, window_end, title in windows:
            if not (window_start <= pickup_at <= window_end):
                continue
            for party_uid in parties:
                notif_id = f"{prefix}_{purchase['id']}_{party_uid}"
                if await get_doc("notifications", notif_id) is not None:
                    continue
                await set_doc(
                    "notifications",
                    notif_id,
                    {
                        "id": notif_id,
                        "userId": party_uid,
                        "title": title,
                        "body": (
                            f"{purchase.get('crop', '')} — {purchase.get('quantity', '')} "
                            f"{purchase.get('unit', '')} pickup at "
                            f"{(purchase.get('pickup') or {}).get('date', '')}"
                        ),
                        "type": notif_type,
                        "data": {
                            "type": notif_type,
                            "deepLink": DEEP_LINKS.get(notif_type, "/dashboard/p/purchases"),
                            "purchaseId": purchase["id"],
                        },
                        "read": False,
                        "createdAt": now.isoformat(),
                    },
                )
                sent[notif_type] += 1

    return {
        "scanned": scanned,
        "reminders24h": sent["pickup_reminder_24h"],
        "reminders2h": sent["pickup_reminder_2h"],
    }


@router.post("/saved-search-alerts")
async def run_saved_search_alerts_job(x_cron_secret: str | None = Header(None, alias="X-Cron-Secret")):
    """Saved-search alert delivery (features/Vyapari.md V12): for every saved
    search with alerts enabled, match lots created in the last 24h against its
    filters and drop one `saved_search_alert` inbox doc per (search, lot) —
    deterministic ids keep cron reruns idempotent. Returns {"alerts": n}."""
    from app.core.db import get_doc
    from app.services.notify import DEEP_LINKS

    _check_cron_secret(x_cron_secret)
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(hours=24)).isoformat()

    searches = await query("saved_searches", [], limit=1000)
    lots = await query("market_lots", [], limit=2000)
    recent_lots = [l for l in lots if str(l.get("createdAt") or "") >= cutoff]

    def _matches(search: dict, lot: dict) -> bool:
        crop = (search.get("crop") or "").strip().lower()
        if crop and crop not in (lot.get("crop") or "").lower():
            return False
        variety = (search.get("variety") or "").strip().lower()
        if variety and variety not in (lot.get("variety") or "").lower():
            return False
        state = (search.get("state") or "").strip().lower()
        if state:
            lot_state = (lot.get("state") or (lot.get("location") or {}).get("state") or "").lower()
            if lot_state != state:
                return False
        min_price = search.get("minPrice")
        if min_price is not None and float(lot.get("expectedRate") or 0) < float(min_price):
            return False
        max_price = search.get("maxPrice")
        if max_price is not None and float(lot.get("expectedRate") or 0) > float(max_price):
            return False
        min_qty = search.get("minQuantityQuintals")
        if min_qty is not None and float(lot.get("quantityQuintals") or 0) < float(min_qty):
            return False
        return True

    alerts = 0
    for search in searches:
        if not search.get("alertsEnabled"):
            continue
        alert_config = search.get("alertConfig") or {}
        if alert_config and not alert_config.get("enabled", True):
            continue
        owner = search.get("userId") or ""
        if not owner:
            continue
        for lot in recent_lots:
            if lot.get("farmerId") == owner:
                continue  # never alert a farmer about their own lot
            if lot.get("status") != "open":
                continue  # only live listings are worth an alert
            if not _matches(search, lot):
                continue
            notif_id = f"savedalert_{search['id']}_{lot['id']}"
            if await get_doc("notifications", notif_id) is not None:
                continue
            rate = lot.get("expectedRate") or 0
            await set_doc(
                "notifications",
                notif_id,
                {
                    "id": notif_id,
                    "userId": owner,
                    "title": "New lot matches your saved search / नवीन लॉट",
                    "body": (
                        f"{lot.get('crop', '')} — {lot.get('quantityQuintals', '')} qtl "
                        f"@ ₹{rate}/qtl near {lot.get('village') or 'your mandi'}"
                    ),
                    "type": "saved_search_alert",
                    "data": {
                        "type": "saved_search_alert",
                        "deepLink": DEEP_LINKS.get("saved_search_alert", "/dashboard/p/browseLots"),
                        "lotId": lot["id"],
                        "savedSearchId": search["id"],
                    },
                    "read": False,
                    "createdAt": now.isoformat(),
                },
            )
            alerts += 1

    return {"alerts": alerts, "searches": len(searches), "recentLots": len(recent_lots)}
