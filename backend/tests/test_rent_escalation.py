from datetime import date
from unittest.mock import AsyncMock

from app.services.rent_reminders import run_rent_reminders
from tests.test_diary import seed_user

TODAY_REMINDER = date(2026, 9, 10)  # 5 days overdue
TODAY_LATE_FEE = date(2026, 9, 20)  # 15 days overdue
TODAY_DISPUTE = date(2026, 9, 30)  # 25 days overdue


def _seed(user_store):
    seed_user(user_store, active_profile="farmLandlord")
    user_store["users/uid-1/land_leases/lease-1"] = {
        "id": "lease-1",
        "plotId": "plot-1",
        "tenantName": "राम पाटील",
        "tenantPhone": "+919812345670",
        "monthlyRentRupees": 5000,
        "startDate": "2026-01-01",
        "endDate": "2026-12-31",
        "status": "active",
    }


async def test_first_overdue_reminds_only(client, user_store, monkeypatch):
    notify = AsyncMock()
    monkeypatch.setattr("app.services.fcm.notify", notify)
    _seed(user_store)
    result = await run_rent_reminders(today=TODAY_REMINDER)
    assert result["reminded"] == 1
    assert result["lateFeeNotices"] == 0
    assert result["disputeOffers"] == 0
    assert "users/uid-1/land_leases/lease-1/late_fees/2026-09" not in user_store
    assert [k for k in user_store if k.startswith("land_disputes/")] == []


async def test_late_fee_notice_stage(client, user_store, monkeypatch):
    notify = AsyncMock()
    monkeypatch.setattr("app.services.fcm.notify", notify)
    _seed(user_store)
    result = await run_rent_reminders(today=TODAY_LATE_FEE)
    assert result["lateFeeNotices"] == 1
    fee = user_store["users/uid-1/land_leases/lease-1/late_fees/2026-09"]
    assert fee["amountPaisa"] == 10000  # 2% of ₹5000, integer paisa
    assert isinstance(fee["amountPaisa"], int)
    audits = [doc for key, doc in user_store.items() if key.startswith("audit_logs/")]
    assert any(doc.get("action") == "RENT_LATE_FEE_NOTICE" for doc in audits)
    tasks = [doc for key, doc in user_store.items() if key.startswith("tasks/")]
    assert any(doc.get("kind") == "rent_overdue" for doc in tasks)


async def test_dispute_offer_stage(client, user_store, monkeypatch):
    notify = AsyncMock()
    monkeypatch.setattr("app.services.fcm.notify", notify)
    _seed(user_store)
    result = await run_rent_reminders(today=TODAY_DISPUTE)
    assert result["disputeOffers"] == 1
    dispute = user_store["land_disputes/dsp_auto_lease-1_2026-09"]
    assert dispute["status"] == "offered"
    assert dispute["category"] == "rent_overdue"


async def test_escalation_is_idempotent(client, user_store, monkeypatch):
    notify = AsyncMock()
    monkeypatch.setattr("app.services.fcm.notify", notify)
    _seed(user_store)
    first = await run_rent_reminders(today=TODAY_DISPUTE)
    second = await run_rent_reminders(today=TODAY_DISPUTE)
    assert first["lateFeeNotices"] == 1
    assert second["lateFeeNotices"] == 0
    assert first["disputeOffers"] == 1
    assert second["disputeOffers"] == 0
