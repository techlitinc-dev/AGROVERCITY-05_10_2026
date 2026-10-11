"""ai.B17 `weather.spray_window.v1` tests (phase-08).

Covers: endpoint auth required, GO/CAUTION/NO-GO success paths under shim,
gateway failure degradation (live provider with a raising `_with_retries`,
plus the service-level guard when `gateway.decide` itself raises), module
flag off, request validation, and the golden fixture on shim.
"""
import json
import os

import pytest

from app.core.config import settings
from app.services import spray_window
from app.services.ai import config_store, gateway

from tests.test_diary import auth, seed_user

QUESTION_SET = "weather.spray_window.v1"
MODULE = "spray_window"
GOLDEN_PATH = os.path.join(
    os.path.dirname(__file__), "fixtures", "ai", "golden", f"{QUESTION_SET}.jsonl"
)

SPRAY_BODY = {
    "crop": "Tomato",
    "sprayType": "fungicide",
    "windows": [
        {"hoursFromNow": 0, "rainMm": 4.0, "windKmph": 10.0, "humidityPct": 70.0, "tempCelsius": 26.0},
        {"hoursFromNow": 3, "rainMm": 1.0, "windKmph": 12.0, "humidityPct": 80.0, "tempCelsius": 27.0},
        {"hoursFromNow": 6, "rainMm": 0.0, "windKmph": 10.0, "humidityPct": 65.0, "tempCelsius": 29.0},
    ],
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
    resp = await client.post("/v1/ai-power/advisory/spray-window", json=SPRAY_BODY)
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "MISSING_TOKEN"


async def test_validation_errors(client, user_store):
    token = seed_user(user_store)
    headers = auth(token)

    no_windows = await client.post(
        "/v1/ai-power/advisory/spray-window",
        json={"crop": "Tomato", "windows": []},
        headers=headers,
    )
    assert no_windows.status_code == 422

    bad_wind = await client.post(
        "/v1/ai-power/advisory/spray-window",
        json={
            "windows": [
                {"hoursFromNow": 0, "windKmph": -5.0, "humidityPct": 60.0, "tempCelsius": 28.0}
            ]
        },
        headers=headers,
    )
    assert bad_wind.status_code == 422
    assert any("windKmph" in field for field in bad_wind.json()["error"]["fieldErrors"])

    bad_hours = await client.post(
        "/v1/ai-power/advisory/spray-window",
        json={"windows": [{"hoursFromNow": 999, "windKmph": 5.0}]},
        headers=headers,
    )
    assert bad_hours.status_code == 422


# --------------------------------------------------------------------------- #
# success path under shim
# --------------------------------------------------------------------------- #


async def test_go_window_with_rain_now_under_shim(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/ai-power/advisory/spray-window", json=SPRAY_BODY, headers=auth(token)
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["windowClass"] == "go"
    assert body["bestWindowHours"] == 6
    assert body["crop"] == "Tomato"
    assert body["sprayType"] == "fungicide"
    assert body["source"] == "shim"
    assert body["aiSuggestion"] is True
    assert any("rain" in reason for reason in body["reasons"])
    assert any("6h" in reason for reason in body["reasons"])

    logged = _decisions(user_store)
    assert len(logged) == 1
    assert logged[0].get("fallbackUsed") is False


@pytest.mark.parametrize(
    ("windows", "expected_class", "expected_best"),
    [
        # Clean right now → GO.
        (
            [{"hoursFromNow": 0, "rainMm": 0.0, "windKmph": 8.0, "humidityPct": 60.0, "tempCelsius": 28.0}],
            "go",
            0,
        ),
        # Windy but borderline all day → CAUTION, no clean window.
        (
            [
                {"hoursFromNow": 0, "rainMm": 0.2, "windKmph": 18.0, "humidityPct": 60.0, "tempCelsius": 30.0},
                {"hoursFromNow": 6, "rainMm": 0.1, "windKmph": 17.0, "humidityPct": 58.0, "tempCelsius": 29.0},
            ],
            "caution",
            None,
        ),
        # Storm across the whole forecast → NO-GO.
        (
            [
                {"hoursFromNow": 0, "rainMm": 8.0, "windKmph": 30.0, "humidityPct": 95.0, "tempCelsius": 24.0},
                {"hoursFromNow": 12, "rainMm": 6.0, "windKmph": 28.0, "humidityPct": 93.0, "tempCelsius": 25.0},
            ],
            "no_go",
            None,
        ),
    ],
)
async def test_window_classes_under_shim(client, user_store, windows, expected_class, expected_best):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/ai-power/advisory/spray-window",
        json={"crop": "Cotton", "windows": windows},
        headers=auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["windowClass"] == expected_class
    assert body["bestWindowHours"] == expected_best
    assert body["reasons"]


# --------------------------------------------------------------------------- #
# degradation — never 500
# --------------------------------------------------------------------------- #


async def test_gateway_failure_falls_back_to_heuristic(client, user_store, monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "live")

    async def boom(*args, **kwargs):
        raise RuntimeError("jev down")

    monkeypatch.setattr("app.services.ai.gateway._with_retries", boom)

    token = seed_user(user_store)
    resp = await client.post(
        "/v1/ai-power/advisory/spray-window", json=SPRAY_BODY, headers=auth(token)
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["windowClass"] == "go"
    assert body["bestWindowHours"] == 6
    assert body["source"] == "fallback"

    logged = _decisions(user_store)
    assert len(logged) == 1
    assert logged[0].get("fallbackUsed") is True


async def test_decide_raising_is_caught_by_service(client, user_store, monkeypatch):
    async def boom(*args, **kwargs):
        raise RuntimeError("gateway unavailable")

    monkeypatch.setattr("app.services.ai.gateway.decide", boom)

    payload = await spray_window.classify_spray_window(
        [
            {"hoursFromNow": 0, "rainMm": 0.0, "windKmph": 8.0, "humidityPct": 60.0, "tempCelsius": 28.0}
        ],
        crop="Cotton",
        spray_type="insecticide",
    )
    assert payload["windowClass"] == "go"
    assert payload["source"] == "fallback"
    assert payload["decisionId"] is None


async def test_flag_off_module_still_classifies(client, user_store):
    user_store["platform_config/ai"] = {"modules": {MODULE: False}}
    config_store.clear_cache()

    token = seed_user(user_store)
    resp = await client.post(
        "/v1/ai-power/advisory/spray-window", json=SPRAY_BODY, headers=auth(token)
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["windowClass"] == "go"
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
