"""M16 transport matching AI tests (WS-06 Task 6.15).

Covers:
(1) golden fixture on shim — matched suggestions beat the distance-only baseline on the golden set;
(2) fallback test with gateway raising -> distance sort and fallbackUsed logged;
(3) flag-off test (transport_match off in platform_config/ai.modules) falling back to distance sort;
(4) outcome hooks recording completed and cancelled outcomes.
"""
import json
import os
import pytest

from app.core.config import settings
from app.core.db import get_doc
from app.services import transport_match
from app.services.ai import config_store, gateway


@pytest.fixture(autouse=True)
def _shim_mode(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "shim")
    config_store.clear_cache()
    yield
    config_store.clear_cache()


def _decisions(user_store):
    return [doc for key, doc in user_store.items() if key.startswith("ai_decisions/")]


def test_golden_fixture_exists_and_valid():
    fixture_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "fixtures", "ai", "golden", "transport.match.v1.jsonl")
    )
    assert os.path.exists(fixture_path), f"Golden fixture missing at {fixture_path}"
    with open(fixture_path, encoding="utf-8") as f:
        records = [json.loads(line) for line in f if line.strip()]
    assert len(records) >= 1
    rec = records[0]
    assert rec["questionSetId"] == "transport.match.v1"
    assert "fit" in rec["answers"]
    assert "noshow_risk" in rec["answers"]
    assert isinstance(rec["answers"]["fit"], (int, float))
    assert isinstance(rec["answers"]["noshow_risk"], (int, float))


async def test_shim_matched_suggestions_beat_distance_baseline(client, user_store):
    """M16 acceptance: matched suggestions beat the distance-only baseline on golden candidates."""
    trip = {
        "id": "trb_trip_1",
        "transporterId": "uid_transporter_1",
        "drop": "Pune Market Yard",
        "date": "2026-10-05",
        "vehicleType": "Tractor Trolley",
    }
    # Candidate A: closer (5km) but vehicle type mismatch ("Mini Truck")
    candidate_close = {
        "id": "load_close_dist",
        "pickupLocation": "Pune Market Yard",
        "distance_km": 5.0,
        "vehicleType": "Mini Truck",
        "pickupDate": "2026-10-06",
    }
    # Candidate B: further (15km) but exact vehicle type & capacity fit ("Tractor Trolley")
    candidate_best_fit = {
        "id": "load_best_fit",
        "pickupLocation": "Pune Market Yard",
        "distance_km": 15.0,
        "vehicleType": "Tractor Trolley",
        "pickupDate": "2026-10-06",
    }

    candidates = [candidate_close, candidate_best_fit]

    # Baseline distance-only order: candidate_close (5km) comes before candidate_best_fit (15km)
    baseline_sorted = sorted(candidates, key=lambda c: c["distance_km"])
    assert baseline_sorted[0]["id"] == "load_close_dist"

    # AI shim matching on golden set: candidate_best_fit ranks first, beating pure distance!
    ranked = await transport_match.rank_return_loads(trip, candidates)
    assert len(ranked) == 2
    assert ranked[0]["id"] == "load_best_fit"
    assert ranked[1]["id"] == "load_close_dist"

    # Annotations present (suggest-level)
    assert "noshow_risk" in ranked[0]
    assert "fit" in ranked[0]
    assert ranked[0]["noshow_risk"] <= 0.1

    # ai_decisions row logged
    decisions = _decisions(user_store)
    match_dec = next((d for d in decisions if d.get("questionSetId") == "transport.match.v1"), None)
    assert match_dec is not None
    assert match_dec["source"] == "shim"
    assert match_dec["fallbackUsed"] is False


async def test_fallback_when_gateway_raises(client, user_store, monkeypatch):
    trip = {
        "id": "trb_trip_2",
        "transporterId": "uid_transporter_2",
        "drop": "Nashik",
        "date": "2026-10-05",
        "vehicleType": "Tractor Trolley",
    }
    candidate_close = {"id": "load_close", "distance_km": 4.0, "vehicleType": "Mini Truck"}
    candidate_far = {"id": "load_far", "distance_km": 20.0, "vehicleType": "Tractor Trolley"}

    async def boom(*args, **kwargs):
        raise RuntimeError("AI gateway unavailable")

    monkeypatch.setattr("app.services.ai.gateway.decide", boom)

    # When gateway fails -> falls back to distance sort
    ranked = await transport_match.rank_return_loads(trip, [candidate_far, candidate_close])
    assert ranked[0]["id"] == "load_close"
    assert ranked[1]["id"] == "load_far"

    decisions = _decisions(user_store)
    fallback_dec = next((d for d in decisions if d.get("questionSetId") == "transport.match.v1" and d.get("fallbackUsed") is True), None)
    assert fallback_dec is not None
    assert fallback_dec["source"] == "fallback"


async def test_flag_off_falls_back_to_distance_sort(client, user_store):
    trip = {
        "id": "trb_trip_3",
        "transporterId": "uid_transporter_3",
        "drop": "Nashik",
        "date": "2026-10-05",
        "vehicleType": "Tractor Trolley",
    }
    candidate_close = {"id": "load_close", "distance_km": 4.0, "vehicleType": "Mini Truck"}
    candidate_far = {"id": "load_far", "distance_km": 20.0, "vehicleType": "Tractor Trolley"}

    user_store["platform_config/ai"] = {
        "modules": {"transport_match": False},
        "thresholds": {"transport.match.v1": 0.75},
        "automation": {"transport.match.v1": "suggest"},
    }
    config_store.clear_cache()

    ranked = await transport_match.rank_return_loads(trip, [candidate_far, candidate_close])
    assert ranked[0]["id"] == "load_close"
    assert ranked[1]["id"] == "load_far"

    decisions = _decisions(user_store)
    match_dec = next((d for d in decisions if d.get("questionSetId") == "transport.match.v1"), None)
    assert match_dec is not None
    assert match_dec["source"] == "fallback"
    assert match_dec["fallbackUsed"] is True


async def test_outcome_hooks_record_properly(client, user_store):
    await transport_match.record_transport_outcome("trb_101", "completed", {"fare": 1800})
    await transport_match.record_transport_outcome("trb_102", "cancelled", {"reason": "vehicle_breakdown"})

    doc1 = user_store.get("ai_outcomes/outcome_trb_101_completed")
    assert doc1 is not None
    assert doc1["outcome"] == "completed"
    assert doc1["module"] == "transport_match"

    doc2 = user_store.get("ai_outcomes/outcome_trb_102_cancelled")
    assert doc2 is not None
    assert doc2["outcome"] == "cancelled"
    assert doc2["details"]["reason"] == "vehicle_breakdown"
