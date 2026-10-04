"""M25 land listing quality and tenant compatibility AI tests (WS-06 Task 6.27).

Covers:
(1) golden fixture on shim;
(2) fallback test with gateway raising;
(3) flag-off test proving listing works without AI;
(4) actionable tips render in both en and hi;
(5) tenant compatibility score on landlord requests inbox.
"""
import json
import os
import pytest

from app.core.config import settings
from app.services.ai import config_store, gateway
from tests.test_diary import auth, seed_user
from tests.test_land_market import _farmer, _landlord


@pytest.fixture(autouse=True)
def _shim_mode(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "shim")
    config_store.clear_cache()
    yield
    config_store.clear_cache()


def _decisions(user_store):
    return [doc for key, doc in user_store.items() if key.startswith("ai_decisions/")]


def test_golden_fixture_exists():
    fixture_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "fixtures", "ai", "golden", "land.listing_quality.v1.jsonl")
    )
    assert os.path.exists(fixture_path), f"Golden fixture missing at {fixture_path}"
    with open(fixture_path, encoding="utf-8") as f:
        records = [json.loads(line) for line in f if line.strip()]
    assert len(records) >= 1
    assert "completeness" in records[0]["answers"]
    assert "rent_band_ok" in records[0]["answers"]


async def test_golden_fixture_scoring_on_listing_save(client, user_store):
    """(1) Golden fixture on shim: listing quality scored on create."""
    landlord_token = _landlord(user_store)
    body = {
        "village": "Pimplas",
        "district": "Nashik",
        "lat": 20.0,
        "lng": 73.85,
        "areaAcres": 3.0,
        "expectedRentRupees": 24000,
        "soilType": "Black Cotton",
        "waterSource": "Borewell",
    }
    resp = await client.post("/v1/land/listings", json=body, headers=auth(landlord_token))
    assert resp.status_code == 201
    listing = resp.json()
    assert "qualityAssessment" in listing
    qa = listing["qualityAssessment"]
    assert qa is not None
    assert qa["completeness"] >= 0.5
    assert qa["rentBandOk"] is True
    assert "bandSource" in qa

    decisions = _decisions(user_store)
    lq_dec = next((d for d in decisions if d.get("questionSetId") == "land.listing_quality.v1"), None)
    assert lq_dec is not None
    assert lq_dec["source"] == "shim"
    assert lq_dec["fallbackUsed"] is False


async def test_fallback_when_gateway_raises(client, user_store, monkeypatch):
    """(2) Fallback test with gateway raising -> listing still saves."""
    landlord_token = _landlord(user_store)

    async def _failing_decide(*args, **kwargs):
        raise RuntimeError("AI Gateway Down")

    monkeypatch.setattr(gateway, "decide", _failing_decide)

    body = {
        "village": "Deola",
        "district": "Nashik",
        "lat": 20.2,
        "lng": 74.1,
        "areaAcres": 2.0,
        "expectedRentRupees": 16000,
    }
    resp = await client.post("/v1/land/listings", json=body, headers=auth(landlord_token))
    assert resp.status_code == 201
    listing = resp.json()
    assert listing["status"] == "open"


async def test_flag_off(client, user_store):
    """(3) Flag-off test: land_listing_quality off -> module works without AI."""
    landlord_token = _landlord(user_store)
    user_store["platform_config/ai.modules"] = {"land_listing_quality": False}
    config_store.clear_cache()

    body = {
        "village": "Niphad",
        "district": "Nashik",
        "lat": 20.1,
        "lng": 74.0,
        "areaAcres": 4.0,
        "expectedRentRupees": 30000,
    }
    resp = await client.post("/v1/land/listings", json=body, headers=auth(landlord_token))
    assert resp.status_code == 201
    listing = resp.json()
    assert listing["status"] == "open"


async def test_actionable_tips_render_en_and_hi(client, user_store):
    """(4) Assert tips render in both en and hi."""
    landlord_token = _landlord(user_store)
    # Listing with missing info to generate multiple tips
    body = {
        "village": "Sinnar",
        "district": "Nashik",
        "lat": 19.8,
        "lng": 73.9,
        "areaAcres": 1.5,
        "expectedRentRupees": 12000,
        # omitted soilType, waterSource, photos
    }
    resp = await client.post("/v1/land/listings", json=body, headers=auth(landlord_token))
    assert resp.status_code == 201
    listing = resp.json()
    qa = listing.get("qualityAssessment")
    assert qa is not None
    tips = qa.get("tips", [])
    assert len(tips) >= 1

    for tip in tips:
        assert "tip_en" in tip and len(tip["tip_en"]) > 5
        assert "tip_hi" in tip and len(tip["tip_hi"]) > 5
        # Verify Hindi tip has Devanagari characters
        assert any('\u0900' <= char <= '\u097f' for char in tip["tip_hi"]), (
            f"Hindi tip lacks Devanagari script: {tip['tip_hi']}"
        )


async def test_tenant_compatibility_score_on_inbox(client, user_store):
    """(5) Tenant-request compatibility score on landlord's request inbox."""
    landlord_token = _landlord(user_store)
    listing_body = {
        "village": "Pimplas",
        "district": "Nashik",
        "lat": 20.0,
        "lng": 73.85,
        "areaAcres": 2.0,
        "expectedRentRupees": 10000,
    }
    resp = await client.post("/v1/land/listings", json=listing_body, headers=auth(landlord_token))
    assert resp.status_code == 201
    listing_id = resp.json()["id"]

    farmer_token = _farmer(user_store)
    req_body = {
        "listingId": listing_id,
        "durationMonths": 12,
        "message": "Interested in organic farming",
    }
    req_resp = await client.post("/v1/land/lease-requests", json=req_body, headers=auth(farmer_token))
    assert req_resp.status_code == 201

    # Landlord views inbox
    inbox_resp = await client.get("/v1/land/lease-requests", headers=auth(landlord_token))
    assert inbox_resp.status_code == 200
    data = inbox_resp.json()["data"]
    assert len(data) >= 1
    req_item = next(r for r in data if r["listingId"] == listing_id)
    assert "compatibilityScore" in req_item
    assert 0.0 <= req_item["compatibilityScore"] <= 1.0
