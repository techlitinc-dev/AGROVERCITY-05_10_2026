"""ai.C4 `demand.forecast.v1` tests (phase-08).

Covers: endpoint auth required, success path under shim (band + stock
suggestion), a rising-trend history through the service, gateway failure
degradation (live provider with a raising `_with_retries`, plus the
service-level guard when `gateway.decide` itself raises), module flag off,
request validation, and the golden fixture on shim.
"""
import json
import os

import pytest

from app.core.config import settings
from app.services import demand_forecast
from app.services.ai import config_store, gateway

from tests.test_diary import auth, seed_user

QUESTION_SET = "demand.forecast.v1"
MODULE = "demand_forecast"
GOLDEN_PATH = os.path.join(
    os.path.dirname(__file__), "fixtures", "ai", "golden", f"{QUESTION_SET}.jsonl"
)

DEMAND_BODY = {
    "product": "Onion",
    "category": "crop",
    "historyUnits": [10.0] * 14,
    "horizonDays": 7,
    "month": 10,
    "festivalDays": 5,
    "currentStockUnits": 20.0,
}


@pytest.fixture(autouse=True)
def _shim_mode(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "shim")
    config_store.clear_cache()
    yield
    config_store.clear_cache()


def _golden_records():
    with open(GOLDEN_PATH, encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def _decisions(user_store):
    return [
        doc
        for key, doc in user_store.items()
        if key.startswith("ai_decisions/") and doc.get("questionSetId") == QUESTION_SET
    ]


# --------------------------------------------------------------------------- #
# auth + validation
# --------------------------------------------------------------------------- #


async def test_auth_required(client):
    resp = await client.post("/v1/ai-power/demand/forecast", json=DEMAND_BODY)
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "MISSING_TOKEN"


async def test_validation_errors(client, user_store):
    token = seed_user(user_store)
    headers = auth(token)

    no_history = await client.post(
        "/v1/ai-power/demand/forecast",
        json={"product": "Onion", "historyUnits": []},
        headers=headers,
    )
    assert no_history.status_code == 422

    bad_month = await client.post(
        "/v1/ai-power/demand/forecast",
        json={**DEMAND_BODY, "month": 13},
        headers=headers,
    )
    assert bad_month.status_code == 422
    assert "month" in bad_month.json()["error"]["fieldErrors"]

    bad_horizon = await client.post(
        "/v1/ai-power/demand/forecast",
        json={**DEMAND_BODY, "horizonDays": 0},
        headers=headers,
    )
    assert bad_horizon.status_code == 422


# --------------------------------------------------------------------------- #
# success path under shim
# --------------------------------------------------------------------------- #


async def test_forecast_band_under_shim(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/ai-power/demand/forecast", json=DEMAND_BODY, headers=auth(token)
    )
    assert resp.status_code == 200
    body = resp.json()

    assert body["product"] == "Onion"
    assert body["horizonDays"] == 7
    assert body["expectedUnits"] == 88.5
    assert body["lowUnits"] == 75.2
    assert body["highUnits"] == 101.8
    assert body["band"] == ["low", "expected", "high"]
    assert body["recommendation"] == "stock_up"
    assert body["estimate"] is True
    assert body["aiSuggestion"] is True
    assert body["source"] == "shim"
    assert body["explanation"]

    logged = _decisions(user_store)
    assert len(logged) == 1
    assert logged[0].get("fallbackUsed") is False


async def test_rising_trend_forecast_via_service(client, user_store):
    payload = await demand_forecast.forecast_demand(
        {
            "product": "Tomato",
            "category": "crop",
            "historyUnits": [10.0] * 7 + [12.0] * 7,
            "horizonDays": 7,
            "month": 4,
            "festivalDays": 0,
            "currentStockUnits": 60.0,
        }
    )
    assert payload["expectedUnits"] == 84.0
    assert payload["trendPct"] == 20.0
    assert payload["recommendation"] == "hold"
    assert payload["source"] == "shim"
    assert "20%" in payload["explanation"]


# --------------------------------------------------------------------------- #
# degradation — never 500
# --------------------------------------------------------------------------- #


async def test_gateway_failure_falls_back_to_heuristic(client, user_store, monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "live")

    async def boom(*args, **kwargs):
        raise RuntimeError("gemini down")

    monkeypatch.setattr("app.services.ai.gateway._with_retries", boom)

    token = seed_user(user_store)
    resp = await client.post(
        "/v1/ai-power/demand/forecast", json=DEMAND_BODY, headers=auth(token)
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["expectedUnits"] == 88.5
    assert body["recommendation"] == "stock_up"
    assert body["source"] == "fallback"

    logged = _decisions(user_store)
    assert len(logged) == 1
    assert logged[0].get("fallbackUsed") is True
    assert logged[0].get("costUsd") == 0.0


async def test_decide_raising_is_caught_by_service(client, user_store, monkeypatch):
    async def boom(*args, **kwargs):
        raise RuntimeError("gateway unavailable")

    monkeypatch.setattr("app.services.ai.gateway.decide", boom)

    payload = await demand_forecast.forecast_demand(DEMAND_BODY)
    assert payload["expectedUnits"] == 88.5
    assert payload["source"] == "fallback"
    assert payload["decisionId"] is None


async def test_flag_off_module_still_forecasts(client, user_store):
    user_store["platform_config/ai"] = {"modules": {MODULE: False}}
    config_store.clear_cache()

    token = seed_user(user_store)
    resp = await client.post(
        "/v1/ai-power/demand/forecast", json=DEMAND_BODY, headers=auth(token)
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["expectedUnits"] == 88.5
    assert body["source"] == "fallback"


# --------------------------------------------------------------------------- #
# golden fixture on shim
# --------------------------------------------------------------------------- #


async def test_golden_fixture_on_shim(client, user_store):
    records = _golden_records()
    assert len(records) >= 5
    for case in records:
        answers, confidence = await gateway.shim.decide(QUESTION_SET, case["input"])
        assert answers == case["output"], case["id"]
        assert confidence == 0.9

    decision = await gateway.decide(records[0]["input"], QUESTION_SET, module=MODULE)
    assert decision.source == "shim"
    assert decision.answers == records[0]["output"]
