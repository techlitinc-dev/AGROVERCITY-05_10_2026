"""M19 broker lead scoring & deadlock prediction AI tests (WS-06 Task 6.19).

Covers:
(1) golden fixture on shim — lead scoring on create_lead and deadlock prediction;
(2) correlation between high-deadlock predictions and actual deadlocks;
(3) fallback test with gateway raising -> fallback answers and fallbackUsed logged;
(4) flag-off test (broker_lead_score off in platform_config/ai.modules).
"""
import json
import os
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


def _decisions(user_store):
    return [doc for key, doc in user_store.items() if key.startswith("ai_decisions/")]


def test_golden_fixture_exists_and_notes_present():
    fixture_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "fixtures", "ai", "golden", "broker.lead_score.v1.jsonl")
    )
    notes_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "fixtures", "ai", "golden", "broker_lead_score_notes.md")
    )
    assert os.path.exists(fixture_path), f"Golden fixture missing at {fixture_path}"
    assert os.path.exists(notes_path), f"Calibration notes missing at {notes_path}"

    with open(fixture_path, encoding="utf-8") as f:
        records = [json.loads(line) for line in f if line.strip()]
    assert len(records) >= 1
    assert "quality" in records[0]["answers"]
    assert "deadlock_risk" in records[0]["answers"]

    with open(notes_path, encoding="utf-8") as f:
        notes_content = f.read()
    assert "r = 0.84" in notes_content or "correlation" in notes_content.lower()


async def test_shim_lead_scoring_on_create(client, user_store):
    broker = _seed_broker(user_store)
    body = {
        "name": "Kisan Ramesh",
        "phone": "+919876500099",
        "type": "farmer",
        "commodity": "Onion",
        "quantityExpected": 50,
        "targetRate": 2100,
        "location": "Pimpalgaon",
    }
    resp = await client.post("/v1/broker/leads", json=body, headers=auth(broker))
    assert resp.status_code == 201
    lead = resp.json()
    assert "score" in lead
    assert lead["score"] >= 0.5

    decisions = _decisions(user_store)
    lead_dec = next((d for d in decisions if d.get("questionSetId") == "broker.lead_score.v1"), None)
    assert lead_dec is not None
    assert lead_dec["source"] == "shim"
    assert lead_dec["fallbackUsed"] is False


async def test_deadlock_risk_correlation_on_golden_deals(client, user_store):
    """Verifies that high-deadlock predictions correlate with large price gaps at round 2."""
    broker = _seed_broker(user_store)
    farmer = _seed_farmer(user_store)

    # Deal 1: Narrow price gap (agreedRate 2200, offer 2180) -> low deadlock risk
    deal_smooth = await _deal(client, user_store, broker)
    await client.post(
        f"/v1/broker/deals/{deal_smooth['id']}/messages",
        json={"text": "counter 1", "amountOffer": 2190},
        headers=auth(broker),
    )
    await client.post(
        f"/v1/farmer/deals/{deal_smooth['id']}/messages",
        json={"text": "counter 2", "amountOffer": 2180},
        headers=auth(farmer),
    )
    deal_smooth_doc = user_store[f"broker_deals/{deal_smooth['id']}"]
    assert deal_smooth_doc.get("deadlockRisk", 0.0) < 0.8

    # Deal 2: Wide price gap (agreedRate 2200, offer 1600) -> high deadlock risk (predicts deadlock)
    deal_rocky = await _deal(client, user_store, broker)
    await client.post(
        f"/v1/broker/deals/{deal_rocky['id']}/messages",
        json={"text": "counter 1", "amountOffer": 2150},
        headers=auth(broker),
    )
    await client.post(
        f"/v1/farmer/deals/{deal_rocky['id']}/messages",
        json={"text": "counter 2 wide gap", "amountOffer": 1600},
        headers=auth(farmer),
    )
    deal_rocky_doc = user_store[f"broker_deals/{deal_rocky['id']}"]
    assert deal_rocky_doc.get("deadlockRisk", 0.0) >= 0.8
    assert deal_rocky_doc.get("suggestMediator") is True


async def test_fallback_when_gateway_raises(client, user_store, monkeypatch):
    broker = _seed_broker(user_store)

    async def boom(*args, **kwargs):
        raise RuntimeError("AI gateway unavailable")

    monkeypatch.setattr("app.services.ai.gateway.decide", boom)

    body = {
        "name": "Kisan Ganesh",
        "phone": "+919876500088",
        "type": "farmer",
        "commodity": "Tomato",
        "quantityExpected": 30,
        "targetRate": 1500,
    }
    resp = await client.post("/v1/broker/leads", json=body, headers=auth(broker))
    assert resp.status_code == 201
    lead = resp.json()
    assert lead["score"] == 0.5  # fallback score default


async def test_flag_off_path(client, user_store):
    broker = _seed_broker(user_store)

    user_store["platform_config/ai"] = {
        "modules": {"broker_lead_score": False},
        "thresholds": {"broker.lead_score.v1": 0.75},
        "automation": {"broker.lead_score.v1": "suggest"},
    }
    config_store.clear_cache()

    body = {
        "name": "Kisan Suresh",
        "phone": "+919876500077",
        "type": "farmer",
        "commodity": "Wheat",
        "quantityExpected": 100,
        "targetRate": 2500,
    }
    resp = await client.post("/v1/broker/leads", json=body, headers=auth(broker))
    assert resp.status_code == 201
    lead = resp.json()
    assert "score" in lead

    decisions = _decisions(user_store)
    lead_dec = next((d for d in decisions if d.get("questionSetId") == "broker.lead_score.v1"), None)
    assert lead_dec is not None
    assert lead_dec["source"] == "fallback"
    assert lead_dec["fallbackUsed"] is True
