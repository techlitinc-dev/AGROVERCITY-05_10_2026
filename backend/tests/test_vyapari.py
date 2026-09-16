import pytest

from tests.test_mandi import MANDI_PRICES
from tests.test_users import _auth, _register

VYAPARI_RATES = [
    {"id": "vyapari-1", "crop": "Tomato (टमाटर)", "rateDisplay": "₹24/kg", "priceChange": "₹2", "changeDir": "up", "mandiName": "Nashik Mandi", "vyapariCount": 3, "lastUpdated": "10 mins ago"},
    {"id": "vyapari-2", "crop": "Onion (प्याज)", "rateDisplay": "₹18/kg", "priceChange": "₹1", "changeDir": "down", "mandiName": "Pimpalgaon Mandi", "vyapariCount": 5, "lastUpdated": "15 mins ago"},
    {"id": "vyapari-3", "crop": "Wheat (गेहूं)", "rateDisplay": "₹2,100/qtl", "priceChange": "0", "changeDir": "flat", "mandiName": "Lasalgaon Mandi", "vyapariCount": 4, "lastUpdated": "1 hour ago"},
]


@pytest.fixture
def seeded(user_store):
    for doc in VYAPARI_RATES:
        user_store[f"vyapari_rates/{doc['id']}"] = doc
    for doc in MANDI_PRICES:
        user_store[f"mandi_prices/{doc['id']}"] = doc
    return user_store


@pytest.fixture
def cache_mock(monkeypatch):
    store = {}

    async def fake_get(key):
        return store.get(key)

    async def fake_set(key, value, ttl_seconds):
        store[key] = value

    monkeypatch.setattr("app.routers.mandi.cache_get", fake_get)
    monkeypatch.setattr("app.routers.mandi.cache_set", fake_set)
    return store


async def _token(client, primary="farmer"):
    profiles = ["farmer", "seller"] if primary == "seller" else ["farmer"]
    resp = await _register(client, profiles=profiles, primaryProfile=primary)
    return resp.json()["accessToken"]


async def test_vyapari_rates_shape(client, seeded, cache_mock):
    token = await _token(client)
    resp = await client.get("/v1/mandi/vyapari-rates", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 3
    assert all(d["changeDir"] in {"up", "down", "flat"} for d in data)


async def test_vyapari_rates_cached(client, seeded, cache_mock, monkeypatch):
    import app.routers.mandi as mandi_router

    real_query = mandi_router.query
    calls = {"n": 0}

    async def counting_query(*args, **kwargs):
        calls["n"] += 1
        return await real_query(*args, **kwargs)

    monkeypatch.setattr(mandi_router, "query", counting_query)
    token = await _token(client)
    headers = _auth(token)
    await client.get("/v1/mandi/vyapari-rates", headers=headers)
    await client.get("/v1/mandi/vyapari-rates", headers=headers)
    assert calls["n"] == 1


async def test_compare_ranks_by_net_profit(client, seeded):
    token = await _token(client)
    resp = await client.get(
        "/v1/mandi/compare",
        params={"crop": "tomato", "quantityQuintals": 10, "lat": 20.0, "lng": 73.8},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 3
    assert data[0]["netProfit"] == max(d["netProfit"] for d in data)
    profits = [d["netProfit"] for d in data]
    assert profits == sorted(profits, reverse=True)
    by_name = {d["mandiName"]: d for d in MANDI_PRICES}
    for item in data:
        assert item["transportCost"] == by_name[item["mandiName"]]["distanceKm"] * 12


async def test_compare_invalid_quantity(client, seeded):
    token = await _token(client)
    resp = await client.get(
        "/v1/mandi/compare",
        params={"crop": "tomato", "quantityQuintals": 0},
        headers=_auth(token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "INVALID_QUANTITY"


async def test_seller_post_rate_pending(client, seeded):
    token = await _token(client, primary="seller")
    resp = await client.post(
        "/v1/seller/rates",
        json={"crop": "Tomato", "ratePerKg": 25, "mandiName": "Nashik Mandi"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "pending"
    resp = await client.get("/v1/seller/rates/my", headers=_auth(token))
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["crop"] == "Tomato"


async def test_seller_rate_forbidden_for_farmer(client, seeded):
    token = await _token(client)
    resp = await client.post(
        "/v1/seller/rates",
        json={"crop": "Tomato", "ratePerKg": 25, "mandiName": "Nashik Mandi"},
        headers=_auth(token),
    )
    assert resp.status_code == 403


async def test_rate_within_band_accepted(client, seeded):
    token = await _token(client, primary="seller")
    resp = await client.post(
        "/v1/seller/rates",
        json={"crop": "Tomato", "ratePerKg": 24, "mandiName": "Pimpalgaon Baswant APMC"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "pending"


async def test_rate_above_band_rejected(client, seeded):
    token = await _token(client, primary="seller")
    resp = await client.post(
        "/v1/seller/rates",
        json={"crop": "Tomato", "ratePerKg": 40, "mandiName": "Pimpalgaon Baswant APMC"},
        headers=_auth(token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "RATE_OUT_OF_BAND"


async def test_rate_below_band_rejected(client, seeded):
    token = await _token(client, primary="seller")
    resp = await client.post(
        "/v1/seller/rates",
        json={"crop": "Tomato", "ratePerKg": 10, "mandiName": "Pimpalgaon Baswant APMC"},
        headers=_auth(token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "RATE_OUT_OF_BAND"


async def test_rate_unknown_crop_accepted(client, seeded):
    token = await _token(client, primary="seller")
    resp = await client.post(
        "/v1/seller/rates",
        json={"crop": "Dragonfruit", "ratePerKg": 300, "mandiName": "Nashik Mandi"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "pending"
