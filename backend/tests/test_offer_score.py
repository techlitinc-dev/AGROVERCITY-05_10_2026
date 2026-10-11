"""ai.A5 `trade.offer_score.v1` tests (phase-08).

Covers: endpoint auth required, success path under shim (ranked scores,
accept/counter/wait recommendations), deterministic tie-break ranking, gateway
failure degradation (`_with_retries` raising with a live provider, and the
service-level guard when `gateway.decide` itself raises), module flag off,
request validation, and the golden fixture on shim.
"""
import json
import os

import pytest

from app.core.config import settings
from app.services.ai import config_store, gateway

from tests.test_diary import auth, seed_user

QUESTION_SET = "trade.offer_score.v1"
MODULE = "offer_score"
GOLDEN_PATH = os.path.join(
    os.path.dirname(__file__), "fixtures", "ai", "golden", f"{QUESTION_SET}.jsonl"
)

OFFERS_BODY = {
    "offers": [
        {
            "offerId": "off_a",
            "crop": "Onion",
            "quantityQuintals": 40,
            "offerPricePaisa": 198000,
            "mandiModalPaisa": 180000,
            "mandiTrend7dPct": 0.0,
            "paymentTermsDays": 1,
            "pickupArranged": True,
            "buyer": {"acceptanceRate": 0.9, "dealsCompleted": 20, "verified": True},
        },
        {
            "offerId": "off_b",
            "crop": "Onion",
            "quantityQuintals": 40,
            "offerPricePaisa": 144000,
            "mandiModalPaisa": 180000,
            "mandiTrend7dPct": 0.0,
            "paymentTermsDays": 7,
            "pickupArranged": False,
            "buyer": {"acceptanceRate": 0.5, "dealsCompleted": 2, "verified": False},
        },
        {
            "offerId": "off_c",
            "crop": "Onion",
            "quantityQuintals": 40,
            "offerPricePaisa": 180000,
            "mandiModalPaisa": 180000,
            "mandiTrend7dPct": 0.0,
            "paymentTermsDays": 3,
            "pickupArranged": False,
            "buyer": {"acceptanceRate": 0.8, "dealsCompleted": 5, "verified": False},
        },
    ]
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


def _decisions(user_store, question_set=QUESTION_SET):
    return [
        doc
        for key, doc in user_store.items()
        if key.startswith("ai_decisions/") and doc.get("questionSetId") == question_set
    ]


# --------------------------------------------------------------------------- #
# auth + validation
# --------------------------------------------------------------------------- #


async def test_auth_required(client):
    resp = await client.post("/v1/ai-power/trade/offer-score", json=OFFERS_BODY)
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "MISSING_TOKEN"


async def test_validation_errors(client, user_store):
    token = seed_user(user_store)
    headers = auth(token)

    empty = await client.post(
        "/v1/ai-power/trade/offer-score", json={"offers": []}, headers=headers
    )
    assert empty.status_code == 422

    bad_price = await client.post(
        "/v1/ai-power/trade/offer-score",
        json={"offers": [{**OFFERS_BODY["offers"][0], "offerPricePaisa": 0}]},
        headers=headers,
    )
    assert bad_price.status_code == 422
    assert any("offerPricePaisa" in field for field in bad_price.json()["error"]["fieldErrors"])

    missing_crop = await client.post(
        "/v1/ai-power/trade/offer-score",
        json={"offers": [{"offerId": "x", "quantityQuintals": 5, "offerPricePaisa": 1000}]},
        headers=headers,
    )
    assert missing_crop.status_code == 422


# --------------------------------------------------------------------------- #
# success path under shim
# --------------------------------------------------------------------------- #


async def test_scores_and_ranks_offers_under_shim(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/ai-power/trade/offer-score", json=OFFERS_BODY, headers=auth(token)
    )
    assert resp.status_code == 200
    body = resp.json()

    assert body["aiSuggestion"] is True
    assert body["ranking"] == ["off_a", "off_c", "off_b"]
    by_id = {item["offerId"]: item for item in body["offers"]}
    assert by_id["off_a"]["score"] == 1.0
    assert by_id["off_a"]["grade"] == "A"
    assert by_id["off_a"]["recommendedAction"] == "accept_best"
    assert by_id["off_a"]["premiumVsMandiPct"] == 10.0
    assert by_id["off_b"]["score"] == 0.06
    assert by_id["off_b"]["recommendedAction"] == "wait"
    assert by_id["off_c"]["recommendedAction"] == "counter"
    assert all(item["source"] == "shim" for item in body["offers"])
    assert all(item["decisionId"] for item in body["offers"])
    assert all(item["explanation"] for item in body["offers"])

    logged = _decisions(user_store)
    assert len(logged) == 3
    assert all(row.get("fallbackUsed") is False for row in logged)


async def test_ranking_tie_break_is_deterministic(client, user_store):
    base = dict(OFFERS_BODY["offers"][2])  # identical economics for both
    tie = {
        "offers": [
            {**base, "offerId": "z_last"},
            {**base, "offerId": "a_first"},
        ]
    }
    token = seed_user(user_store)
    resp = await client.post("/v1/ai-power/trade/offer-score", json=tie, headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["offers"][0]["score"] == body["offers"][1]["score"]
    assert body["ranking"] == ["a_first", "z_last"]


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
        "/v1/ai-power/trade/offer-score", json=OFFERS_BODY, headers=auth(token)
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ranking"] == ["off_a", "off_c", "off_b"]  # heuristic answers
    assert all(item["source"] == "fallback" for item in body["offers"])

    logged = _decisions(user_store)
    assert len(logged) == 3
    assert all(row.get("fallbackUsed") is True for row in logged)
    assert all(row.get("costUsd") == 0.0 for row in logged)


async def test_decide_raising_is_caught_by_service(client, user_store, monkeypatch):
    async def boom(*args, **kwargs):
        raise RuntimeError("gateway unavailable")

    monkeypatch.setattr("app.services.ai.gateway.decide", boom)

    token = seed_user(user_store)
    resp = await client.post(
        "/v1/ai-power/trade/offer-score", json=OFFERS_BODY, headers=auth(token)
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ranking"] == ["off_a", "off_c", "off_b"]
    assert all(item["source"] == "fallback" for item in body["offers"])
    assert all(item["decisionId"] is None for item in body["offers"])


async def test_flag_off_module_still_scores(client, user_store):
    user_store["platform_config/ai"] = {"modules": {MODULE: False}}
    config_store.clear_cache()

    token = seed_user(user_store)
    resp = await client.post(
        "/v1/ai-power/trade/offer-score", json=OFFERS_BODY, headers=auth(token)
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ranking"] == ["off_a", "off_c", "off_b"]
    assert all(item["source"] == "fallback" for item in body["offers"])


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

    # End-to-end through the gateway: shim source, deterministic answers.
    decision = await gateway.decide(
        records[0]["input"], QUESTION_SET, module=MODULE,
    )
    assert decision.source == "shim"
    assert decision.answers == records[0]["output"]
