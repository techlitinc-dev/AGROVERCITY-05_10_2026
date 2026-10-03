from datetime import date
from unittest.mock import AsyncMock

from app.core.config import settings
from app.services.rent_reminders import run_rent_reminders
from tests.test_diary import seed_user

TODAY = date(2026, 9, 17)
DUE_MONTH = "2026-09"

LEASE = {
    "id": "lease-1",
    "plotId": "plot-1",
    "tenantName": "राम पाटील",
    "tenantPhone": "+919812345670",
    "monthlyRentRupees": 5000,
    "startDate": "2026-01-01",
    "endDate": "2026-12-31",
    "status": "active",
}


def _seed_lease(user_store):
    seed_user(user_store, active_profile="farmLandlord")
    user_store["users/uid-1/land_leases/lease-1"] = dict(LEASE)


async def test_due_lease_notifies_landlord(client, user_store, monkeypatch):
    notify = AsyncMock()
    monkeypatch.setattr("app.services.fcm.notify", notify)
    _seed_lease(user_store)
    result = await run_rent_reminders(today=TODAY)
    assert result == {"reminded": 1}
    notify.assert_called_once()
    assert notify.call_args.args[0] == "uid-1"
    assert notify.call_args.args[3]["type"] == "rent_reminder"
    assert notify.call_args.args[3]["leaseId"] == "lease-1"


async def test_paid_month_skips(client, user_store, monkeypatch):
    notify = AsyncMock()
    monkeypatch.setattr("app.services.fcm.notify", notify)
    _seed_lease(user_store)
    user_store["users/uid-1/land_leases/lease-1/payments/p1"] = {
        "id": "p1",
        "month": DUE_MONTH,
        "amountRupees": 5000,
    }
    result = await run_rent_reminders(today=TODAY)
    assert result == {"reminded": 0}
    notify.assert_not_called()


async def test_grace_window(client, user_store, monkeypatch):
    notify = AsyncMock()
    monkeypatch.setattr("app.services.fcm.notify", notify)
    _seed_lease(user_store)
    result = await run_rent_reminders(today=date(2026, 9, 3))
    assert result == {"reminded": 0}
    notify.assert_not_called()


async def test_dedup_same_month(client, user_store, monkeypatch):
    notify = AsyncMock()
    monkeypatch.setattr("app.services.fcm.notify", notify)
    _seed_lease(user_store)
    user_store["notifications/ntf_old"] = {
        "userId": "uid-1",
        "title": "किराया लंबित",
        "body": "...",
        "data": {"type": "rent_reminder", "leaseId": "lease-1", "dueMonth": DUE_MONTH},
    }
    result = await run_rent_reminders(today=TODAY)
    assert result == {"reminded": 0}
    notify.assert_not_called()


async def test_cron_secret_required(client, user_store, monkeypatch):
    notify = AsyncMock()
    monkeypatch.setattr("app.services.fcm.notify", notify)
    monkeypatch.setattr(settings, "cron_secret", "s3cret")
    _seed_lease(user_store)
    resp = await client.post("/v1/jobs/rent-reminders/run")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "CRON_UNAUTHORIZED"
    resp = await client.post(
        "/v1/jobs/rent-reminders/run", headers={"X-Cron-Secret": "wrong"}
    )
    assert resp.status_code == 401
    resp = await client.post(
        "/v1/jobs/rent-reminders/run", headers={"X-Cron-Secret": "s3cret"}
    )
    assert resp.status_code == 200
    assert "reminded" in resp.json()
