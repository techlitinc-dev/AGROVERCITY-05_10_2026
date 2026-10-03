from datetime import date

from app.core.db import query
from app.services import fcm
from app.services.tasks import DEEP_LINKS, emit_task

GRACE_DAY = 5


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
            payments = await query(
                f"users/{uid}/land_leases/{lease['id']}/payments", [], limit=1000
            )
            if any(p.get("month") == due_month for p in payments):
                continue
            rows.append({"lease": lease, "landlordUid": uid, "dueMonth": due_month})
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
    reminded = 0
    for row in await find_due_leases(today):
        lease = row["lease"]
        uid = row["landlordUid"]
        due_month = row["dueMonth"]
        if await _already_reminded(uid, lease["id"], due_month):
            continue
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
    return {"reminded": reminded}
