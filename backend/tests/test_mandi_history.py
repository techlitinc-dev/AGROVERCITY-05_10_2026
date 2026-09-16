from datetime import date, timedelta

import pytest

from tests.test_users import _auth

HISTORY = [
    {
        "mandiId": "mandi-1",
        "mandiName": "Pimpalgaon Baswant APMC",
        "commodity": "Tomato (टमाटर)",
        "date": (date.today() - timedelta(days=89 - i)).isoformat(),
        "modalPrice": 1900 + i,
    }
    for i in range(90)
]


@pytest.fixture
def seeded(user_store):
    for i, doc in enumerate(HISTORY):
        user_store[f"mandi_price_history/mandi-1-{doc['date']}"] = doc
    return user_store


async def _token(client):
    resp = await client.post("/v1/auth/firebase-verify", json={"idToken": "x"})
    return resp.json()["accessToken"]


async def test_history_default_3_months(client, seeded):
    token = await _token(client)
    resp = await client.get(
        "/v1/mandi/prices/history",
        params={"crop": "tomato", "mandi": "Pimpalgaon"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 90
    dates = [d["date"] for d in data]
    assert dates == sorted(dates)


async def test_history_one_month(client, seeded):
    token = await _token(client)
    resp = await client.get(
        "/v1/mandi/prices/history",
        params={"crop": "tomato", "mandi": "Pimpalgaon", "months": 1},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert len(resp.json()["data"]) == 30


async def test_history_unknown_crop(client, seeded):
    token = await _token(client)
    resp = await client.get(
        "/v1/mandi/prices/history",
        params={"crop": "dragonfruit", "mandi": "Pimpalgaon"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["data"] == []


async def test_history_missing_params_422(client, seeded):
    token = await _token(client)
    resp = await client.get("/v1/mandi/prices/history", headers=_auth(token))
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"
