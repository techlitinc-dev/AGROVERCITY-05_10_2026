"""WS-05 / WS-06: counter rounds cap, deadlock escalation, and M19 deadlock prediction.

Covers:
(1) counter round cap (rounds 1-2 allowed, round 3 lock, further counters rejected);
(2) deadlock escalation creating admin task;
(3) M19 deadlock prediction at round 2 of 3 suggesting mediator action.
"""
import pytest

from app.core.config import settings
from app.services.ai import config_store
from tests.test_broker_deals import (
    _deal,
    _seed_broker,
    _seed_farmer,
    auth,
)


@pytest.fixture(autouse=True)
def _shim_mode(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "shim")
    config_store.clear_cache()
    yield
    config_store.clear_cache()


async def test_counter_round_cap_locks_at_three(client, user_store):
    broker = _seed_broker(user_store)
    farmer = _seed_farmer(user_store)
    deal = await _deal(client, user_store, broker)

    # exchange counters broker -> farmer -> broker
    rounds = [
        (f"/v1/broker/deals/{deal['id']}/messages", broker, 2100),
        (f"/v1/farmer/deals/{deal['id']}/messages", farmer, 2150),
        (f"/v1/broker/deals/{deal['id']}/messages", broker, 2125),
    ]
    for i, (url, token, offer) in enumerate(rounds):
        resp = await client.post(
            url,
            json={"text": f"round {i}", "amountOffer": offer},
            headers=auth(token),
        )
        assert resp.status_code == 201, resp.json()

    # fourth counter from either side is refused (round 3 lock)
    resp = await client.post(
        f"/v1/broker/deals/{deal['id']}/messages",
        json={"text": "one more", "amountOffer": 2130},
        headers=auth(broker),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "COUNTER_LIMIT_REACHED"

    resp = await client.post(
        f"/v1/farmer/deals/{deal['id']}/messages",
        json={"text": "farmer reply", "amountOffer": 2140},
        headers=auth(farmer),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "COUNTER_LIMIT_REACHED"


async def test_deadlock_escalation_to_admin_queue(client, user_store):
    broker = _seed_broker(user_store)
    deal = await _deal(client, user_store, broker)
    resp = await client.post(
        f"/v1/broker/deals/{deal['id']}/escalate",
        params={"reason": "farmer unresponsive after 3 rounds"},
        headers=auth(broker),
    )
    assert resp.status_code == 200
    assert resp.json()["escalatedAt"]
    assert resp.json()["escalationReason"] == "farmer unresponsive after 3 rounds"

    tasks = [d for k, d in user_store.items() if k.startswith("tasks/")]
    assert any(t["kind"] == "deal_deadlock_escalation" for t in tasks)

    again = await client.post(
        f"/v1/broker/deals/{deal['id']}/escalate", headers=auth(broker)
    )
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "ALREADY_ESCALATED"


async def test_deadlock_prediction_at_round_two(client, user_store):
    """M19: at round 2 of 3 on a deal, compute deadlock_risk and suggest mediator action."""
    broker = _seed_broker(user_store)
    farmer = _seed_farmer(user_store)
    deal = await _deal(client, user_store, broker)

    # Round 1 counter: price offer 2100 (agreedRate is 2200)
    resp1 = await client.post(
        f"/v1/broker/deals/{deal['id']}/messages",
        json={"text": "round 1 offer", "amountOffer": 2100},
        headers=auth(broker),
    )
    assert resp1.status_code == 201

    deal_doc = user_store[f"broker_deals/{deal['id']}"]
    assert not deal_doc.get("suggestMediator")

    # Round 2 counter: farmer offers 1700 (large price gap vs initial 2200)
    resp2 = await client.post(
        f"/v1/farmer/deals/{deal['id']}/messages",
        json={"text": "round 2 wide gap", "amountOffer": 1700},
        headers=auth(farmer),
    )
    assert resp2.status_code == 201

    # Round 2 deadlock prediction triggered
    deal_doc = user_store[f"broker_deals/{deal['id']}"]
    assert "deadlockRisk" in deal_doc
    assert deal_doc["deadlockRisk"] >= 0.5
    assert deal_doc.get("suggestMediator") is True
    assert deal_doc.get("suggestedAction") == "mediator"
