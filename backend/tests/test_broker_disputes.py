"""WS-05 step 9: deal dispute workflow — category, evidence freeze, SLA timer,
admin-queue wiring."""
from datetime import datetime, timedelta, timezone

from tests.test_broker_deals import DEAL_BODY, _seed_broker, _seed_farmer
from tests.test_diary import auth


async def _deal(client, user_store, status="accepted"):
    broker = _seed_broker(user_store)
    _seed_farmer(user_store)
    deal = (
        await client.post("/v1/broker/deals", json=DEAL_BODY, headers=auth(broker))
    ).json()
    user_store[f"broker_deals/{deal['id']}"]["status"] = status
    return broker, deal


async def test_dispute_create_freezes_evidence_and_sets_sla(client, user_store):
    broker, deal = await _deal(client, user_store)

    resp = await client.post(
        f"/v1/broker/deals/{deal['id']}/disputes",
        json={"category": "payment", "reason": "buyer short-paid by ₹4,000"},
        headers=auth(broker),
    )
    assert resp.status_code == 201
    dispute = resp.json()
    assert dispute["dealId"] == deal["id"]
    assert dispute["category"] == "payment"
    assert dispute["evidenceFreeze"] is True
    assert dispute["status"] == "open"
    assert dispute["slaHours"] == 72
    deadline = datetime.fromisoformat(dispute["slaDeadline"])
    assert datetime.now(timezone.utc) < deadline < datetime.now(timezone.utc) + timedelta(hours=73)

    # the deal itself records the freeze
    assert user_store[f"broker_deals/{deal['id']}"]["evidenceFrozenAt"]

    # admin queue task emitted
    tasks = [d for k, d in user_store.items() if k.startswith("tasks/")]
    assert any(t["kind"] == "deal_dispute_opened" for t in tasks)


async def test_only_one_open_dispute_per_deal(client, user_store):
    broker, deal = await _deal(client, user_store)
    assert (
        await client.post(
            f"/v1/broker/deals/{deal['id']}/disputes",
            json={"category": "quality"},
            headers=auth(broker),
        )
    ).status_code == 201
    resp = await client.post(
        f"/v1/broker/deals/{deal['id']}/disputes",
        json={"category": "delivery"},
        headers=auth(broker),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "DISPUTE_ALREADY_OPEN"


async def test_dispute_requires_post_negotiation_status(client, user_store):
    broker, deal = await _deal(client, user_store, status="negotiating")
    resp = await client.post(
        f"/v1/broker/deals/{deal['id']}/disputes",
        json={"category": "payment"},
        headers=auth(broker),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "INVALID_STATE"


async def test_disputes_listed_for_the_deal(client, user_store):
    broker, deal = await _deal(client, user_store)
    await client.post(
        f"/v1/broker/deals/{deal['id']}/disputes",
        json={"category": "quality", "reason": "moisture above 12%"},
        headers=auth(broker),
    )
    resp = await client.get(f"/v1/broker/deals/{deal['id']}/disputes", headers=auth(broker))
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
