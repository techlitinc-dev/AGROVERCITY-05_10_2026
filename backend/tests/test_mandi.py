import pytest

from tests.test_users import REGISTER_BODY, _auth, _register

MANDI_PRICES = [
    {
        "id": "mandi-1",
        "mandiName": "Pimpalgaon Baswant APMC",
        "distanceKm": 4.2,
        "commodity": "Tomato (टमाटर)",
        "variety": "Hybrid Red",
        "minPrice": 1600,
        "maxPrice": 2250,
        "modalPrice": 1950,
        "msp": 1400,
        "trend": "up",
        "changePercent": "+8.4%",
        "arrivalsQuintals": 2400,
        "updatedAt": "10 mins ago",
    },
    {
        "id": "mandi-2",
        "mandiName": "Nashik (Dindori Road) APMC",
        "distanceKm": 18.5,
        "commodity": "Tomato (टमाटर)",
        "variety": "Abhinav Grade A",
        "minPrice": 1750,
        "maxPrice": 2400,
        "modalPrice": 2150,
        "msp": 1400,
        "trend": "up",
        "changePercent": "+12.1%",
        "arrivalsQuintals": 4800,
        "updatedAt": "25 mins ago",
    },
    {
        "id": "mandi-3",
        "mandiName": "Lasalgaon APMC",
        "distanceKm": 28.0,
        "commodity": "Onion (प्याज)",
        "variety": "Garwa Red",
        "minPrice": 1800,
        "maxPrice": 2380,
        "modalPrice": 2120,
        "msp": 1750,
        "trend": "down",
        "changePercent": "-3.2%",
        "arrivalsQuintals": 18500,
        "updatedAt": "15 mins ago",
    },
    {
        "id": "mandi-4",
        "mandiName": "Vashi (Navi Mumbai) Terminal",
        "distanceKm": 165.0,
        "commodity": "Tomato (टमाटर)",
        "variety": "Premium Crate",
        "minPrice": 2200,
        "maxPrice": 2900,
        "modalPrice": 2650,
        "msp": 1400,
        "trend": "up",
        "changePercent": "+15.0%",
        "arrivalsQuintals": 12000,
        "updatedAt": "1 hour ago",
    },
]

MANDIS = [
    {"id": "mandi-1", "name": "Pimpalgaon Baswant APMC", "district": "Nashik", "state": "Maharashtra", "lat": 20.17, "lng": 73.98},
    {"id": "mandi-2", "name": "Nashik (Dindori Road) APMC", "district": "Nashik", "state": "Maharashtra", "lat": 20.0, "lng": 73.79},
    {"id": "mandi-3", "name": "Lasalgaon APMC", "district": "Nashik", "state": "Maharashtra", "lat": 20.15, "lng": 74.23},
    {"id": "mandi-4", "name": "Vashi (Navi Mumbai) Terminal", "district": "Navi Mumbai", "state": "Maharashtra", "lat": 19.07, "lng": 72.99},
]


@pytest.fixture
def seeded(user_store):
    for doc in MANDI_PRICES:
        user_store[f"mandi_prices/{doc['id']}"] = doc
    for doc in MANDIS:
        user_store[f"mandis/{doc['id']}"] = doc
    return user_store


async def _token(client):
    resp = await client.post("/v1/auth/firebase-verify", json={"idToken": "x"})
    return resp.json()["accessToken"]


async def test_prices_returns_all(client, seeded):
    token = await _token(client)
    resp = await client.get("/v1/mandi/prices", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["data"]) == 4
    assert body["total"] == 4
    assert body["page"] == 1
    assert body["pageSize"] == 20


async def test_prices_crop_filter_tomato(client, seeded):
    token = await _token(client)
    resp = await client.get("/v1/mandi/prices", params={"crop": "tomato"}, headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 3
    assert all("Onion" not in d["commodity"] for d in data)


async def test_prices_forbidden_role(client, seeded):
    resp = await _register(client, profiles=["farmer", "transport"], primaryProfile="farmer")
    token = resp.json()["accessToken"]
    await client.post("/v1/users/me/profiles/transport/activate", headers=_auth(token))
    resp = await client.get("/v1/mandi/prices", headers=_auth(token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"


async def test_mandi_list(client, seeded):
    token = await _token(client)
    resp = await client.get("/v1/mandi/list", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 4
    assert all(d["name"] for d in data)
