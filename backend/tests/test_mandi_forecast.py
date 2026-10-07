"""Mandi forecast (phase-05 WS-01, brief M12 / SGR).

Covers: the read endpoint's cache-miss envelope, the cache-hit shape, and that
the nightly job under `AI_PROVIDER=shim` still writes a Pydantic-valid band
(the deterministic history band) without ever touching the request path.
"""
from datetime import date, timedelta

from app.services.mandi_forecast import (
    CACHE_COLLECTION,
    MandiForecastBand,
    forecast_doc_id,
    run_nightly_forecast,
)
from tests.test_diary import auth, seed_user
from tests.test_mandi import MANDI_PRICES

CROP = "Tomato (टमाटर)"
MANDI = "Pimpalgaon Baswant APMC"

HISTORY = [
    {
        "mandiId": "mandi-1",
        "mandiName": MANDI,
        "commodity": CROP,
        "date": (date.today() - timedelta(days=29 - i)).isoformat(),
        "modalPrice": 1900 + i,
    }
    for i in range(30)
]


def _seed(user_store):
    for doc in MANDI_PRICES:
        user_store[f"mandi_prices/{doc['id']}"] = doc
    for doc in HISTORY:
        user_store[f"mandi_price_history/mandi-1-{doc['date']}"] = doc


async def test_forecast_cache_miss_envelope(client, user_store):
    token = seed_user(user_store, uid="uid-1", active_profile="farmer")
    resp = await client.get(
        "/v1/mandi/forecast",
        params={"crop": CROP, "mandi": MANDI},
        headers=auth(token),
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "FORECAST_NOT_FOUND"


async def test_forecast_requires_crop_and_mandi(client, user_store):
    token = seed_user(user_store, uid="uid-1", active_profile="farmer")
    resp = await client.get("/v1/mandi/forecast", headers=auth(token))
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_forecast_falls_back_to_history_band_when_ai_off(client, user_store):
    """With the model off/failed the band degrades to observed history prices."""
    _seed(user_store)
    await run_nightly_forecast()

    doc = user_store[f"{CACHE_COLLECTION}/{forecast_doc_id(CROP, MANDI)}"]
    assert doc["source"] == "fallback"
    assert doc["fallbackUsed"] is True
    band7 = next(band for band in doc["bands"] if band["horizon_days"] == 7)
    assert band7["band_low_paisa"] == 192300
    assert band7["band_high_paisa"] == 192900


async def test_nightly_run_caches_valid_band_and_endpoint_reads_it(client, user_store):
    _seed(user_store)
    count = await run_nightly_forecast()
    assert count >= 1

    doc = user_store[f"{CACHE_COLLECTION}/{forecast_doc_id(CROP, MANDI)}"]
    assert doc["crop"] == CROP
    assert doc["mandi"] == MANDI
    assert doc["bands"]
    for band in doc["bands"]:
        validated = MandiForecastBand.model_validate(band)
        assert validated.band_low_paisa <= validated.band_high_paisa
        assert validated.confidence_class in ("low", "medium", "high")
    # Observed 1900..1929 ₹/quintal history → the deterministic band edges.
    band7 = next(band for band in doc["bands"] if band["horizon_days"] == 7)
    assert band7["band_low_paisa"] == 192300
    assert band7["band_high_paisa"] == 192900
    assert doc["source"] == "fallback"

    token = seed_user(user_store, uid="uid-1", active_profile="farmer")
    resp = await client.get(
        "/v1/mandi/forecast",
        params={"crop": CROP, "mandi": MANDI},
        headers=auth(token),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["crop"] == CROP
    assert len(data["bands"]) == 2
