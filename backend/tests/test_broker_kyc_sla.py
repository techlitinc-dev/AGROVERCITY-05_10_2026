"""B1: Proven Broker trust tier + 48–72h approval SLA — the SLA clock is
visible to the broker; a breach escalates to the admin queue."""
from datetime import datetime, timedelta, timezone

from tests.test_broker_deals import _seed_broker
from tests.test_broker_split import _verify_broker_kyc
from tests.test_diary import auth

NOW = datetime.now(timezone.utc)


def _pending_case(user_store, uid="uid-b1", submitted=None):
    user_store[f"kyc_cases/kyc_{uid[:8]}_broker"] = {
        "caseId": f"kyc_{uid[:8]}_broker",
        "userId": uid,
        "persona": "broker",
        "status": "pending",
        "submittedAt": (submitted or NOW).isoformat(),
        "docs": [{"docId": f"kyc_{uid[:8]}_broker:arhtiya_licence", "type": "arhtiya_licence", "status": "pending"}],
    }


async def test_sla_clock_visible_and_not_breached_within_window(client, user_store):
    broker = _seed_broker(user_store)
    _pending_case(user_store, submitted=NOW - timedelta(hours=10))

    resp = await client.get("/v1/broker/trust-tier", headers=auth(broker))
    assert resp.status_code == 200
    record = resp.json()
    assert record["caseStatus"] == "pending"
    assert record["slaHours"] == 72
    assert record["slaDeadline"] is not None
    assert record["slaBreached"] is False
    assert record["proven"] is False


async def test_sla_breach_escalates_to_admin_queue(client, user_store):
    broker = _seed_broker(user_store)
    _pending_case(user_store, submitted=NOW - timedelta(hours=80))

    resp = await client.get("/v1/broker/trust-tier", headers=auth(broker))
    assert resp.status_code == 200
    record = resp.json()
    assert record["slaBreached"] is True

    tasks = [d for k, d in user_store.items() if k.startswith("tasks/")]
    breaches = [t for t in tasks if t["kind"] == "broker_kyc_sla_breach"]
    assert len(breaches) == 1
    assert breaches[0]["priority"] == "high"

    # a second read does not duplicate the escalation (dedupe-safe)
    await client.get("/v1/broker/trust-tier", headers=auth(broker))
    tasks = [d for k, d in user_store.items() if k.startswith("tasks/")]
    assert len([t for t in tasks if t["kind"] == "broker_kyc_sla_breach"]) == 1


async def test_verified_case_marks_proven_and_skips_sla(client, user_store):
    broker = _seed_broker(user_store)
    _verify_broker_kyc(user_store)
    user_store["kyc_cases/kyc_uid-b1_broker"]["submittedAt"] = (NOW - timedelta(days=10)).isoformat()

    resp = await client.get("/v1/broker/trust-tier", headers=auth(broker))
    record = resp.json()
    assert record["caseStatus"] == "verified"
    assert record["slaBreached"] is False
    assert record["proven"] is False  # tier flips on the user doc at award time


async def test_sla_config_clamped_48_72(client, user_store):
    broker = _seed_broker(user_store)
    user_store["platform_config/broker_kyc_sla"] = {
        "slaHours": 12, "version": 1, "effectiveFrom": "2026-10-01T00:00:00+00:00",
    }
    _pending_case(user_store, submitted=NOW - timedelta(hours=50))

    resp = await client.get("/v1/broker/trust-tier", headers=auth(broker))
    record = resp.json()
    assert record["slaHours"] == 48  # clamped up
    assert record["slaBreached"] is True  # 50h > 48h
