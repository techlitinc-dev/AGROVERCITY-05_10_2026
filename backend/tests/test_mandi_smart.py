"""Smart mandi selection (phase-05 WS-01, brief M12) — golden net math + endpoint.

(1) every hand-computed golden case must match `net_after_transport_paisa`
    exactly (integer paisa, no floats);
(2) with AI_PROVIDER=shim the endpoint's ranking must equal the deterministic
    net-math ranking (the AI only annotates ordering, never the money);
(3) the endpoint still answers with the deterministic ranking when the AI flag
    is off.
"""
import json
from pathlib import Path

import pytest

from app.services.ai import config_store
from app.services.ai.question_sets import MANDI_SMART_EXPLAIN_KEYS
from app.services.mandi_smart import (
    build_smart_select_state,
    net_after_transport_paisa,
    transport_fare_estimate_paisa,
)
from tests.test_diary import auth, seed_user
from tests.test_mandi import MANDI_PRICES

GOLDEN_PATH = Path(__file__).parent / "fixtures" / "ai" / "golden" / "mandi.smart_select.v1.jsonl"
GOLDEN_CASES = [
    json.loads(line)
    for line in GOLDEN_PATH.read_text(encoding="utf-8").splitlines()
    if line.strip()
]


def _seed_mandi_prices(user_store):
    for doc in MANDI_PRICES:
        user_store[f"mandi_prices/{doc['id']}"] = doc


def _deterministic_ranking(crop: str, qty: int) -> list[str]:
    """Reference ordering built from the same integer-paisa arithmetic the API uses."""
    candidates = []
    for doc in MANDI_PRICES:
        if crop.lower() not in doc["commodity"].lower():
            continue
        fare = transport_fare_estimate_paisa(doc["distanceKm"], qty)
        net = net_after_transport_paisa(doc["modalPrice"] * 100, qty, fare, 0)
        candidates.append((net, doc["mandiName"]))
    candidates.sort(key=lambda item: (-item[0], item[1].lower()))
    return [name for _, name in candidates]


@pytest.mark.parametrize("case", GOLDEN_CASES, ids=[case["id"] for case in GOLDEN_CASES])
def test_net_math_matches_golden(case):
    nets = {
        candidate["mandi"]: net_after_transport_paisa(
            candidate["modal_price_paisa"],
            case["qty_quintals"],
            candidate["transport_fare_paisa"],
            candidate["commission_paisa"],
        )
        for candidate in case["candidates"]
    }
    assert nets == case["expected_net_paisa"]
    order = sorted(nets.items(), key=lambda item: (-item[1], item[0].lower()))
    assert [name for name, _ in order] == case["expected_ranking"]


async def test_smart_select_ranking_matches_net_math(client, user_store):
    _seed_mandi_prices(user_store)
    token = seed_user(user_store, uid="uid-1", active_profile="farmer", district="Nashik")

    resp = await client.post(
        "/v1/mandi/smart-select",
        json={"crop": "Tomato", "quantityQuintals": 10},
        headers=auth(token),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]

    expected = _deterministic_ranking("Tomato", 10)
    assert [candidate["mandi"] for candidate in data["candidates"]] == expected
    assert [candidate["rank"] for candidate in data["candidates"]] == [1, 2, 3]
    for candidate in data["candidates"]:
        assert (
            candidate["netPaisa"]
            == candidate["modalPricePaisa"] * 10
            - candidate["transportFarePaisa"]
            - candidate["commissionPaisa"]
        )
    assert data["best"]["mandi"] == expected[0]
    assert data["automationLevel"] == "suggest"
    assert data["explainKey"] in MANDI_SMART_EXPLAIN_KEYS
    # The shim golden fixture carries no ranking, so the deterministic fallback
    # is what answers — never an invented ordering.
    assert data["source"] == "fallback"
    assert data["decisionId"]


async def test_smart_select_answers_with_ai_flag_off(client, user_store):
    _seed_mandi_prices(user_store)
    user_store["platform_config/ai"] = {
        "modules": {"mandi_smart_select": False},
        "thresholds": {},
        "automation": {},
    }
    config_store.clear_cache()
    token = seed_user(user_store, uid="uid-1", active_profile="farmer", district="Nashik")

    resp = await client.post(
        "/v1/mandi/smart-select",
        json={"crop": "Tomato", "quantityQuintals": 10},
        headers=auth(token),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["source"] == "fallback"
    assert [candidate["mandi"] for candidate in data["candidates"]] == _deterministic_ranking(
        "Tomato", 10
    )
    config_store.clear_cache()


async def test_smart_select_rejects_crop_without_mandi_data(client, user_store):
    _seed_mandi_prices(user_store)
    token = seed_user(user_store, uid="uid-1", active_profile="farmer")
    resp = await client.post(
        "/v1/mandi/smart-select",
        json={"crop": "Dragonfruit", "quantityQuintals": 5},
        headers=auth(token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "NO_MANDI_DATA"


def test_state_builder_scrubs_pii():
    state = build_smart_select_state(
        {"crop": "Tomato", "quantity_quintals": 10, "district": "Nashik"},
        {"district": "Nashik", "name": "Ram", "phone": "+919812345678", "email": "a@b.com"},
        [{"mandi": "Pimpalgaon Baswant APMC", "modalPrice": 1950, "distanceKm": 4.2}],
    )
    blob = json.dumps(state)
    assert "9876543210" not in blob
    assert "a@b.com" not in blob
    assert state["candidates"][0]["modal_price_paisa"] == 195000
