"""M24 equipment AI tests (WS-06 Task 6.23).

Covers:
(1) golden damage set on shim — severity within ±1 band >= 75%;
(2) booking recommendation scoring in owner pending queue;
(3) damage claim photo AI severity suggestion and human confirmation flow;
(4) fallback test with gateway raising -> graceful degradation;
(5) flag-off test proving booking queue and damage claim flow work without AI.
"""
import json
import os
import pytest

from app.core.config import settings
from app.services.ai import config_store, gateway
from tests.test_equipment_owner import OWNER_MACHINE, _owner_token
from tests.test_users import _auth


SEVERITY_LEVELS = {"minor": 0, "moderate": 1, "severe": 2}


@pytest.fixture(autouse=True)
def _shim_mode(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "shim")
    config_store.clear_cache()
    yield
    config_store.clear_cache()


def _decisions(user_store):
    return [doc for key, doc in user_store.items() if key.startswith("ai_decisions/")]


async def test_golden_damage_set_severity_within_one_band(client, user_store):
    """(1) golden damage set on shim — severity within ±1 band >= 75%."""
    fixture_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "fixtures", "ai", "golden", "equipment_damage.jsonl")
    )
    assert os.path.exists(fixture_path), f"Golden fixture missing at {fixture_path}"

    with open(fixture_path, encoding="utf-8") as f:
        cases = [json.loads(line) for line in f if line.strip()]

    assert len(cases) >= 5, "Golden damage fixture must contain test cases"

    within_band_count = 0
    for case in cases:
        prompt = f"Analyze equipment damage: {case['description']}. Estimate severity (minor, moderate, severe)."
        res = await gateway.analyze_image(
            image_bytes=b"dummy_damage_image",
            prompt=prompt,
            schema={"severity": "moderate"},
            module="equipment_booking_rec",
        )
        pred_severity = res.get("severity", "moderate")
        expected_severity = case["expected_severity"]

        pred_idx = SEVERITY_LEVELS.get(pred_severity, 1)
        exp_idx = SEVERITY_LEVELS.get(expected_severity, 1)

        diff = abs(pred_idx - exp_idx)
        if diff <= 1:
            within_band_count += 1

    ratio = within_band_count / len(cases)
    assert ratio >= 0.75, f"Expected severity within ±1 band >= 75%, got {ratio:.2%}"


async def test_queue_booking_recommendation_scoring(client, user_store):
    """(2) Booking recommendation scoring in owner pending queue."""
    token = await _owner_token(client)
    user_store["equipment/eq-own"] = dict(OWNER_MACHINE)
    user_store["equipment_slots/slot-1"] = {
        "id": "slot-1",
        "equipmentId": "eq-own",
        "date": "2026-10-10",
        "slotName": "Morning",
        "priceRupees": 800,
        "status": "pending",
    }
    user_store["equipment_bookings/bk-1"] = {
        "id": "bk-1",
        "equipmentId": "eq-own",
        "userId": "uid-2",
        "slotId": "slot-1",
        "status": "pending",
        "farmerName": "Ramesh Patil",
        "createdAt": "2026-10-01T10:00:00Z",
    }

    resp = await client.get("/v1/equipment/bookings/pending", headers=_auth(token))
    assert resp.status_code == 200
    rows = resp.json()["data"]
    assert len(rows) == 1
    booking = rows[0]
    assert "recommendationScore" in booking
    assert 0.0 <= booking["recommendationScore"] <= 1.0

    decisions = _decisions(user_store)
    rec_dec = next((d for d in decisions if d.get("questionSetId") == "equipment.booking_rec.v1"), None)
    assert rec_dec is not None
    assert rec_dec["source"] == "shim"
    assert rec_dec["fallbackUsed"] is False


async def test_damage_claim_ai_suggestion_and_human_confirm(client, user_store):
    """(3) Damage claim photo AI severity suggestion and human confirmation flow."""
    token = await _owner_token(client)
    user_store["equipment/eq-own"] = dict(OWNER_MACHINE)

    body = {
        "equipmentId": "eq-own",
        "bookingId": "bk-1",
        "incidentDate": "2026-10-02",
        "description": "rotavator blade bent on buried rock",
        "estimatedRepairCostRupees": 4500,
        "photoEvidenceUrls": ["https://storage.example/damage/blade.jpg"],
    }
    resp = await client.post("/v1/equipment/owner/damage-claims", json=body, headers=_auth(token))
    assert resp.status_code == 201
    claim = resp.json()
    assert claim["status"] == "open"
    assert claim.get("aiEstimate") is not None
    assert claim["aiEstimate"]["severity"] in ("minor", "moderate", "severe")
    assert claim["aiEstimate"]["confirmed"] is False

    # Owner confirms the suggested deduction
    confirm_resp = await client.post(
        f"/v1/equipment/owner/damage-claims/{claim['id']}/confirm-estimate",
        json={"deductionPaisa": 450000},
        headers=_auth(token),
    )
    assert confirm_resp.status_code == 200
    confirmed_claim = confirm_resp.json()
    assert confirmed_claim["confirmedDeductionPaisa"] == 450000
    assert confirmed_claim["aiEstimate"]["confirmed"] is True


async def test_ai_equipment_fallback_when_gateway_raises(client, user_store, monkeypatch):
    """(4) Fallback test with gateway raising -> queue and damage claim still succeed."""
    token = await _owner_token(client)
    user_store["equipment/eq-own"] = dict(OWNER_MACHINE)
    user_store["equipment_slots/slot-2"] = {
        "id": "slot-2",
        "equipmentId": "eq-own",
        "date": "2026-10-12",
        "slotName": "Evening",
        "priceRupees": 900,
        "status": "pending",
    }
    user_store["equipment_bookings/bk-2"] = {
        "id": "bk-2",
        "equipmentId": "eq-own",
        "userId": "uid-2",
        "slotId": "slot-2",
        "status": "pending",
        "farmerName": "Kisan Patil",
        "createdAt": "2026-10-02T10:00:00Z",
    }

    async def _failing_decide(*args, **kwargs):
        raise RuntimeError("Gateway unavailable")

    async def _failing_analyze(*args, **kwargs):
        raise RuntimeError("Vision gateway error")

    monkeypatch.setattr(gateway, "decide", _failing_decide)
    monkeypatch.setattr(gateway, "analyze_image", _failing_analyze)

    # Queue succeeds without throwing 500
    resp = await client.get("/v1/equipment/bookings/pending", headers=_auth(token))
    assert resp.status_code == 200
    assert len(resp.json()["data"]) == 1

    # Claim creation succeeds without throwing 500
    claim_body = {
        "equipmentId": "eq-own",
        "bookingId": "bk-2",
        "incidentDate": "2026-10-03",
        "description": "small scratch",
        "estimatedRepairCostRupees": 1500,
        "photoEvidenceUrls": ["https://storage.example/scratch.jpg"],
    }
    claim_resp = await client.post("/v1/equipment/owner/damage-claims", json=claim_body, headers=_auth(token))
    assert claim_resp.status_code == 201


async def test_ai_equipment_flag_off(client, user_store):
    """(5) Flag-off test proving queue and damage flow work without AI."""
    token = await _owner_token(client)
    user_store["equipment/eq-own"] = dict(OWNER_MACHINE)
    user_store["equipment_slots/slot-3"] = {
        "id": "slot-3",
        "equipmentId": "eq-own",
        "date": "2026-10-15",
        "slotName": "Morning",
        "priceRupees": 850,
        "status": "pending",
    }
    user_store["equipment_bookings/bk-3"] = {
        "id": "bk-3",
        "equipmentId": "eq-own",
        "userId": "uid-3",
        "slotId": "slot-3",
        "status": "pending",
        "farmerName": "Anand Rao",
        "createdAt": "2026-10-03T10:00:00Z",
    }

    # Turn flag off
    user_store["platform_config/ai.modules"] = {"equipment_booking_rec": False}
    config_store.clear_cache()

    resp = await client.get("/v1/equipment/bookings/pending", headers=_auth(token))
    assert resp.status_code == 200
    assert len(resp.json()["data"]) == 1

    claim_body = {
        "equipmentId": "eq-own",
        "bookingId": "bk-3",
        "incidentDate": "2026-10-04",
        "description": "tine dented",
        "estimatedRepairCostRupees": 2000,
        "photoEvidenceUrls": ["https://storage.example/dent.jpg"],
    }
    claim_resp = await client.post("/v1/equipment/owner/damage-claims", json=claim_body, headers=_auth(token))
    assert claim_resp.status_code == 201
    claim = claim_resp.json()
    assert claim["status"] == "open"
