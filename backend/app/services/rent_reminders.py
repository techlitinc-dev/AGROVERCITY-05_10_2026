from datetime import date, datetime, timezone

from app.core.db import get_doc, query, set_doc
from app.services import fcm
from app.services.tasks import DEEP_LINKS, emit_task

GRACE_DAY = 5

# Escalation ladder (phase-02 WS-01 step 3): reminder → late-fee notice →
# dispute-lane offer. All money is integer paisa (rule 3).
RENT_LATE_FEE_DAYS = 15
RENT_DISPUTE_OFFER_DAYS = 25
RENT_LATE_FEE_RATE = 0.02
LEASE_EXPIRY_HORIZON_DAYS = 30


async def find_due_leases(today: date) -> list[dict]:
    due_month = today.strftime("%Y-%m")
    if today.day < GRACE_DAY:
        return []
    rows = []
    users = await query("users", [], limit=1000)
    for user in users:
        uid = user.get("id")
        if not uid:
            continue
        leases = await query(f"users/{uid}/land_leases", [], limit=1000)
        for lease in leases:
            if lease.get("status") != "active":
                continue
            ledger = await get_doc(
                f"users/{uid}/land_leases/{lease['id']}/rent_ledger", due_month
            )
            if ledger is not None and int(ledger.get("amountPaidPaisa", 0)) >= int(
                ledger.get("amountDuePaisa", 0)
            ):
                continue
            if ledger is None:
                payments = await query(
                    f"users/{uid}/land_leases/{lease['id']}/payments", [], limit=1000
                )
                if any(p.get("month") == due_month for p in payments):
                    continue
            rows.append({"lease": lease, "landlordUid": uid, "dueMonth": due_month})
    return rows


async def find_expiring_leases(today: date) -> list[dict]:
    horizon = date.fromordinal(today.toordinal() + LEASE_EXPIRY_HORIZON_DAYS).isoformat()
    rows = []
    users = await query("users", [], limit=1000)
    for user in users:
        uid = user.get("id")
        if not uid:
            continue
        leases = await query(f"users/{uid}/land_leases", [], limit=1000)
        for lease in leases:
            end_date = lease.get("endDate")
            if lease.get("status") != "active" or not end_date:
                continue
            if today.isoformat() <= end_date <= horizon:
                rows.append({"lease": lease, "landlordUid": uid})
    return rows


async def _already_reminded(uid: str, lease_id: str, due_month: str) -> bool:
    notifications = await query("notifications", [("userId", "==", uid)], limit=1000)
    return any(
        (n.get("data") or {}).get("type") == "rent_reminder"
        and (n.get("data") or {}).get("leaseId") == lease_id
        and (n.get("data") or {}).get("dueMonth") == due_month
        for n in notifications
    )


async def run_rent_reminders(today: date | None = None) -> dict:
    today = today or date.today()
    reminded = late_fees = dispute_offers = 0
    for row in await find_due_leases(today):
        lease = row["lease"]
        uid = row["landlordUid"]
        due_month = row["dueMonth"]
        if not await _already_reminded(uid, lease["id"], due_month):
            # tenant phone is not a uid (tenants may not be app users) — landlord
            # notification only in v1. TODO(day-13): tenant SMS path per X4.
            await fcm.notify(
                uid,
                "किराया लंबित",
                f"{lease.get('tenantName', '')} का {due_month} का किराया "
                f"₹{lease.get('monthlyRentRupees', 0)} लंबित है",
                {
                    "type": "rent_reminder",
                    "leaseId": lease["id"],
                    "dueMonth": due_month,
                    "deepLink": DEEP_LINKS["land"],
                },
            )
            await emit_task(
                uid,
                persona="farmLandlord",
                module="land",
                kind="rent_due",
                title_en="Rent due from tenant",
                title_hi="किराया लंबित है",
                subtitle=f"{lease.get('tenantName', '')} · ₹{lease.get('monthlyRentRupees', 0)} for {due_month}",
                priority="today",
                deep_link=DEEP_LINKS["land"],
                source_id=f"{lease['id']}:{due_month}",
                due_at=f"{due_month}-05",
            )
            reminded += 1

        overdue_days = today.day - GRACE_DAY
        escalations_path = f"users/{uid}/land_leases/{lease['id']}/escalations"
        state = await get_doc(escalations_path, due_month) or {"stage": 1}
        stage = int(state.get("stage", 1))
        monthly_paisa = int(round(float(lease.get("monthlyRentRupees", 0) or 0) * 100))

        if overdue_days >= RENT_LATE_FEE_DAYS and stage < 2:
            late_fee_paisa = int(round(monthly_paisa * RENT_LATE_FEE_RATE))
            await set_doc(
                f"users/{uid}/land_leases/{lease['id']}/late_fees",
                due_month,
                {
                    "month": due_month,
                    "amountPaisa": late_fee_paisa,
                    "reason": "rent overdue",
                    "at": datetime.now(timezone.utc).isoformat(),
                },
            )
            await set_doc(
                "audit_logs",
                f"aud_rent_late_fee_{uid}_{due_month}",
                {
                    "action": "RENT_LATE_FEE_NOTICE",
                    "adminId": uid,
                    "leaseId": lease["id"],
                    "month": due_month,
                    "lateFeePaisa": late_fee_paisa,
                    "at": datetime.now(timezone.utc).isoformat(),
                },
            )
            await fcm.notify(
                uid,
                "विलंब शुल्क सूचना",
                f"{due_month} का किराया अभी तक लंबित — ₹{late_fee_paisa / 100:.0f} विलंब शुल्क लागू",
                {
                    "type": "rent_late_fee",
                    "leaseId": lease["id"],
                    "dueMonth": due_month,
                    "deepLink": DEEP_LINKS["land"],
                },
            )
            await emit_task(
                uid,
                persona="farmLandlord",
                module="land",
                kind="rent_overdue",
                title_en="Rent overdue — late fee applied",
                title_hi="किराया बकाया — विलंब शुल्क लगा",
                subtitle=f"{lease.get('tenantName', '')} · ₹{late_fee_paisa / 100:.0f} late fee",
                priority="urgent",
                deep_link=DEEP_LINKS["land"],
                source_id=f"{lease['id']}:{due_month}:late_fee",
            )
            stage = 2
            late_fees += 1

        if overdue_days >= RENT_DISPUTE_OFFER_DAYS and stage < 3:
            dispute_id = f"dsp_auto_{lease['id']}_{due_month}"
            await set_doc(
                "land_disputes",
                dispute_id,
                {
                    "id": dispute_id,
                    "leaseId": lease["id"],
                    "createdBy": uid,
                    "category": "rent_overdue",
                    "note": f"{due_month} rent still unpaid after {overdue_days} days",
                    "status": "offered",
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                },
            )
            await fcm.notify(
                uid,
                "विवाद विकल्प उपलब्ध",
                f"{due_month} का किराया बहुत विलंबित — आप विवाद दर्ज कर सकते हैं",
                {
                    "type": "rent_dispute_offer",
                    "leaseId": lease["id"],
                    "dueMonth": due_month,
                    "deepLink": DEEP_LINKS["land"],
                },
            )
            stage = 3
            dispute_offers += 1

        if stage != int(state.get("stage", 1)):
            await set_doc(
                escalations_path,
                due_month,
                {"stage": stage, "updatedAt": datetime.now(timezone.utc).isoformat()},
            )

    expiring = 0
    for row in await find_expiring_leases(today):
        lease = row["lease"]
        uid = row["landlordUid"]
        await emit_task(
            uid,
            persona="farmLandlord",
            module="land",
            kind="lease_expiring",
            title_en="Lease expiring soon",
            title_hi="पट्टा जल्द समाप्त होगा",
            subtitle=f"{lease.get('tenantName', '')} · ends {lease.get('endDate', '')}",
            priority="upcoming",
            deep_link=DEEP_LINKS["land"],
            source_id=f"{lease['id']}:{lease.get('endDate', '')}",
            due_at=lease.get("endDate"),
        )
        expiring += 1

    return {
        "reminded": reminded,
        "lateFeeNotices": late_fees,
        "disputeOffers": dispute_offers,
        "expiringLeases": expiring,
    }
