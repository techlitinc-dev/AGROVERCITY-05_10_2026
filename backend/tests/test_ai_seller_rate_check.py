"""M4 seller rate check AI tests (WS-06 Task 6.9).

Covers:
(1) golden fixture from tests/fixtures/ai/golden/ passes on AI_PROVIDER=shim;
(2) fallback test with the gateway raising -> static ±25% rule still decides and fallbackUsed is logged;
(3) flag-off test (seller_rate_check off in platform_config/ai.modules) proving rate posting works without AI.
"""
import json
import os
import pytest

from app.core.config import settings
from app.services.ai import config_store, gateway
from tests.test_mandi import MANDI_PRICES
from tests.test_users import _auth, _register

MODAL = MANDI_PRICES[0]["modalPrice"]  # 1950 ₹/q tomato at Pimpalgaon Baswant APMC
IN_BAND = round(MODAL * 1.10) / 100     # 21.45 ₹/kg, inside ±25%
OUT_OF_BAND = round(MODAL * 1.80) / 100  # 35.10 ₹/kg, outside +25%


@pytest.fixture(autouse=True)
def _shim_mode(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "shim")
    config_store.clear_cache()
    yield
    config_store.clear_cache()


def _verify_shop_kyc(user_store, uid="uid-1"):
    user_store[f"kyc_cases/kyc_{uid}_seller"] = {
        "caseId": f"kyc_{uid}_seller",
        "userId": uid,
        "persona": "seller",
        "status": "verified",
        "docs": [
            {"docId": f"kyc_{uid}_seller:apmc_licence", "type": "apmc_licence", "status": "verified"},
            {"docId": f"kyc_{uid}_seller:gst", "type": "gst", "status": "verified"},
        ],
    }


async def _token(client, user_store):
    resp = await _register(client, profiles=["farmer", "seller"], primaryProfile="seller")
    _verify_shop_kyc(user_store)
    return resp.json()["accessToken"]


def _seed_mandi(user_store):
    for doc in MANDI_PRICES:
        user_store[f"mandi_prices/{doc['id']}"] = doc


def _decisions(user_store):
    return [doc for key, doc in user_store.items() if key.startswith("ai_decisions/")]


def test_golden_fixture_exists_and_schema_valid():
    fixture_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "fixtures", "ai", "golden", "seller.rate_check.v1.jsonl")
    )
    assert os.path.exists(fixture_path), f"Golden fixture missing at {fixture_path}"
    with open(fixture_path, encoding="utf-8") as f:
        records = [json.loads(line) for line in f if line.strip()]
    assert len(records) >= 1
    rec = records[0]
    assert rec["questionSetId"] == "seller.rate_check.v1"
    assert "within_fair_band" in rec["answers"]
    assert "manipulation_signal" in rec["answers"]
    assert isinstance(rec["answers"]["within_fair_band"], bool)
    assert isinstance(rec["answers"]["manipulation_signal"], (int, float))
    assert rec["confidence"] >= 0.75


async def test_golden_shim_in_band_succeeds(client, user_store):
    _seed_mandi(user_store)
    token = await _token(client, user_store)

    resp = await client.post(
        "/v1/seller/rates",
        json={"crop": "Tomato", "ratePerKg": IN_BAND, "mandiName": "Pimpalgaon Baswant APMC"},
        headers=_auth(token),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["crop"] == "Tomato"
    assert data["ratePerKg"] == IN_BAND
    assert data["status"] == "pending"

    decisions = _decisions(user_store)
    assert len(decisions) >= 1
    rate_decision = next((d for d in decisions if d.get("questionSetId") == "seller.rate_check.v1"), None)
    assert rate_decision is not None
    assert rate_decision["source"] == "shim"
    assert rate_decision["fallbackUsed"] is False
    assert rate_decision["answers"]["within_fair_band"] is True


async def test_golden_shim_out_of_band_rejected_422(client, user_store):
    _seed_mandi(user_store)
    token = await _token(client, user_store)

    resp = await client.post(
        "/v1/seller/rates",
        json={"crop": "Tomato", "ratePerKg": OUT_OF_BAND, "mandiName": "Pimpalgaon Baswant APMC"},
        headers=_auth(token),
    )
    assert resp.status_code == 422
    data = resp.json()
    assert data["error"]["code"] == "RATE_OUT_OF_BAND"
    assert "band" in data["error"]["fieldErrors"]


async def test_fallback_when_gateway_raises(client, user_store, monkeypatch):
    _seed_mandi(user_store)
    token = await _token(client, user_store)

    async def boom(*args, **kwargs):
        raise RuntimeError("AI gateway unavailable")

    monkeypatch.setattr("app.services.ai.gateway.decide", boom)

    # In-band rate: gateway boom -> fallback to static ±25% rule -> succeeds, fallbackUsed is logged
    resp_in = await client.post(
        "/v1/seller/rates",
        json={"crop": "Tomato", "ratePerKg": IN_BAND, "mandiName": "Pimpalgaon Baswant APMC"},
        headers=_auth(token),
    )
    assert resp_in.status_code == 200
    decisions = _decisions(user_store)
    fallback_dec = next((d for d in decisions if d.get("fallbackUsed") is True), None)
    assert fallback_dec is not None
    assert fallback_dec["source"] == "fallback"

    # Out-of-band rate: gateway boom -> fallback to static ±25% rule -> rejects with 422
    resp_out = await client.post(
        "/v1/seller/rates",
        json={"crop": "Tomato", "ratePerKg": OUT_OF_BAND, "mandiName": "Pimpalgaon Baswant APMC"},
        headers=_auth(token),
    )
    assert resp_out.status_code == 422
    assert resp_out.json()["error"]["code"] == "RATE_OUT_OF_BAND"


async def test_flag_off_disables_ai_and_allows_posting(client, user_store):
    _seed_mandi(user_store)
    token = await _token(client, user_store)

    # Set seller_rate_check flag off in platform_config/ai
    user_store["platform_config/ai"] = {
        "modules": {"seller_rate_check": False},
        "thresholds": {"seller.rate_check.v1": 0.75},
        "automation": {"seller.rate_check.v1": "suggest"},
    }
    config_store.clear_cache()

    resp = await client.post(
        "/v1/seller/rates",
        json={"crop": "Tomato", "ratePerKg": IN_BAND, "mandiName": "Pimpalgaon Baswant APMC"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["ratePerKg"] == IN_BAND

    decisions = _decisions(user_store)
    rate_decision = next((d for d in decisions if d.get("questionSetId") == "seller.rate_check.v1"), None)
    assert rate_decision is not None
    assert rate_decision["source"] == "fallback"
    assert rate_decision["fallbackUsed"] is True
