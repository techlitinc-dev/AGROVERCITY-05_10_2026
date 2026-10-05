"""M18 `contracts.attractiveness.v1` AI tests (WS-07 task 7.26).

Covers:
(1) golden contract fixtures rank sensibly on the shim — a better-than-mandi
    contract scores higher than a worse-than-mandi one;
(2) reading the same contract twice yields exactly ONE `ai_decisions` row for its
    `decisionId` (the explanation is cached per decision_id);
(3) gateway raising -> deterministic fallback stored with `fallbackUsed`;
(4) flag off -> the contract carries no `attractiveness` field and the
    accept / e-sign flow is byte-identical.
"""
import pytest

from app.core.config import settings
from app.services.ai import config_store, gateway, privacy
from tests.test_contracts_direct import (
    ACCEPT_BODY,
    FIXED_BODY,
    MANDI_TOMATO,
    _create_contract,
    _seed_buyer,
    _seed_farmer,
)
from tests.test_diary import auth

QUESTION_SET = "contracts.attractiveness.v1"

# Inline golden set: each defines the contract terms + the 12-week mandi series.
# `inline` states are built by the privacy builder exactly as the router does.
GOLDEN = [
    {
        "id": "con-better",
        "expectedSign": 1,
        "contract": {
            "id": "con-better",
            "farmerId": "f1",
            "crop": "Tomato",
            "priceType": "fixed",
            "baseRate": 2400,
            "premiumPerQuintal": 0,
            "quantityTotal": 100,
        },
        "mandi": [{"date": "2026-08-01", "modalPrice": 2000}, {"date": "2026-08-08", "modalPrice": 2000}],
    },
    {
        "id": "con-linked",
        "expectedSign": 1,
        "contract": {
            "id": "con-linked",
            "farmerId": "f2",
            "crop": "Tomato",
            "priceType": "mandiLinked",
            "premiumPerQuintal": 100,
            "quantityTotal": 100,
        },
        "mandi": [{"date": "2026-08-01", "modalPrice": 2000}],
    },
    {
        "id": "con-worse",
        "expectedSign": -1,
        "contract": {
            "id": "con-worse",
            "farmerId": "f3",
            "crop": "Tomato",
            "priceType": "fixed",
            "baseRate": 1500,
            "premiumPerQuintal": 0,
            "quantityTotal": 100,
        },
        "mandi": [{"date": "2026-08-01", "modalPrice": 2000}],
    },
]


@pytest.fixture(autouse=True)
def _shim_mode(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "shim")
    config_store.clear_cache()
    yield
    config_store.clear_cache()


def _decisions(user_store):
    return [doc for key, doc in user_store.items() if key.startswith("ai_decisions/")]


def _attractiveness_decisions(user_store):
    return [d for d in _decisions(user_store) if d.get("questionSetId") == QUESTION_SET]


def _contract(user_store, contract_id):
    return user_store[f"contracts/{contract_id}"]


# --------------------------------------------------------------------------- #
# (1) golden ranking — better-than-mandi scores higher than worse-than-mandi
# --------------------------------------------------------------------------- #


async def test_golden_contracts_rank_sensibly(client, user_store):
    scores: dict[str, float] = {}
    for record in GOLDEN:
        state = privacy.build_contract_attractiveness_state(record["contract"], record["mandi"], [])
        decision = await gateway.decide(state, QUESTION_SET, module="contracts_attractiveness")
        assert decision.source == "shim"
        answers = decision.answers
        income = float(answers["incomeVsMandi"])
        scores[record["id"]] = income
        if record["expectedSign"] > 0:
            assert income > 0, f"{record['id']} should beat mandi, got {income}"
        else:
            assert income < 0, f"{record['id']} should trail mandi, got {income}"
        assert isinstance(answers["riskFlags"], list)
        assert answers["explanation"]

    assert scores["con-better"] > scores["con-worse"]
    assert scores["con-linked"] > scores["con-worse"]
    assert scores["con-better"] == pytest.approx(20.0, abs=1.0)

    logged = _attractiveness_decisions(user_store)
    assert logged
    assert all("costUsd" in row and "confidence" in row and "fallbackUsed" in row for row in logged)


# --------------------------------------------------------------------------- #
# (2) cached explanation — a second read makes no new gateway call
# --------------------------------------------------------------------------- #


async def test_cached_explanation_second_read_no_new_decision(client, user_store):
    buyer = _seed_buyer(user_store)
    farmer = _seed_farmer(user_store)
    user_store["mandi_prices/m1"] = MANDI_TOMATO

    contract_id = (await _create_contract(client, buyer)).json()["id"]
    created = _attractiveness_decisions(user_store)
    assert len(created) == 1
    decision_id = created[0]["id"]
    assert _contract(user_store, contract_id)["attractiveness"]["decisionId"] == decision_id

    first = (await client.get("/v1/contracts/mine?role=farmer", headers=auth(farmer))).json()
    row = next(d for d in first["data"] if d["id"] == contract_id)
    assert row["attractiveness"]["decisionId"] == decision_id
    assert row["attractiveness"]["explanation"]

    second = (await client.get("/v1/contracts/mine?role=farmer", headers=auth(farmer))).json()
    row2 = next(d for d in second["data"] if d["id"] == contract_id)
    assert row2["attractiveness"]["decisionId"] == decision_id

    # Exactly one ai_decisions row for this decision — the second read is a cache hit.
    assert len(_attractiveness_decisions(user_store)) == 1


# --------------------------------------------------------------------------- #
# (3) gateway raising -> fallback stored with fallbackUsed
# --------------------------------------------------------------------------- #


async def test_fallback_when_gateway_raises(client, user_store, monkeypatch):
    buyer = _seed_buyer(user_store)
    _seed_farmer(user_store)
    user_store["mandi_prices/m1"] = MANDI_TOMATO

    async def boom(*args, **kwargs):
        raise RuntimeError("AI gateway unavailable")

    monkeypatch.setattr("app.services.ai.gateway.decide", boom)

    contract_id = (await _create_contract(client, buyer)).json()["id"]
    stored = _contract(user_store, contract_id)
    assert "attractiveness" in stored
    assert isinstance(stored["attractiveness"]["incomeVsMandi"], (int, float))
    assert stored["attractiveness"]["explanation"]

    fallback_dec = next(
        (d for d in _attractiveness_decisions(user_store) if d.get("fallbackUsed") is True), None
    )
    assert fallback_dec is not None
    assert fallback_dec["source"] == "fallback"
    assert fallback_dec["costUsd"] == 0.0


# --------------------------------------------------------------------------- #
# (4) flag off -> no attractiveness field, e-sign flow byte-identical
# --------------------------------------------------------------------------- #


async def test_flag_off_no_annotation_and_sign_unchanged(client, user_store):
    buyer = _seed_buyer(user_store)
    farmer = _seed_farmer(user_store)
    user_store["mandi_prices/m1"] = MANDI_TOMATO

    user_store["platform_config/ai"] = {
        "modules": {"contracts_attractiveness": False},
        "thresholds": {QUESTION_SET: 0.75},
        "automation": {QUESTION_SET: "suggest"},
    }
    config_store.clear_cache()

    before = len(_decisions(user_store))
    contract_id = (await _create_contract(client, buyer)).json()["id"]
    assert "attractiveness" not in _contract(user_store, contract_id)

    mine = (await client.get("/v1/contracts/mine?role=farmer", headers=auth(farmer))).json()
    row = next(d for d in mine["data"] if d["id"] == contract_id)
    assert "attractiveness" not in row

    # The e-sign flow is byte-identical: same response, same signature/consent.
    resp = await client.post(
        f"/v1/contracts/{contract_id}/accept", json=ACCEPT_BODY, headers=auth(farmer)
    )
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "status": "active", "contractId": contract_id}
    acceptance = user_store[f"contracts/{contract_id}/acceptances/uid-f1"]
    assert acceptance["signatureData"] == ACCEPT_BODY["signatureData"]
    assert acceptance["consentTimestamp"] == ACCEPT_BODY["consentTimestamp"]

    assert len(_decisions(user_store)) == before  # no ai_decisions rows written
    # FIXED_BODY fixture unchanged (guards against accidental mutation)
    assert FIXED_BODY["priceType"] == "fixed"
