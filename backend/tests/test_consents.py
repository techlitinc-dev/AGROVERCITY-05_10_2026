import pytest

from app.services.consents import ConsentRequiredError, require_data_sharing
from tests.test_diary import auth, seed_user


def _consent_docs(user_store, uid="uid-1"):
    return [
        doc
        for key, doc in user_store.items()
        if key.startswith("consent_log/") and doc.get("userId") == uid
    ]


async def test_defaults_all_false(client, user_store):
    token = seed_user(user_store)
    resp = await client.get("/v1/users/me/consents", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["dataSharing"] is False
    assert body["location"] is False
    assert body["marketing"] is False


async def test_put_round_trip(client, user_store):
    token = seed_user(user_store)
    payload = {"dataSharing": True, "location": True, "marketing": False}
    resp = await client.put("/v1/users/me/consents", json=payload, headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["dataSharing"] is True
    assert body["updatedAt"]
    resp = await client.get("/v1/users/me/consents", headers=auth(token))
    assert resp.json() == body


async def test_consent_log_appended_per_change(client, user_store):
    token = seed_user(user_store)
    await client.put(
        "/v1/users/me/consents",
        json={"dataSharing": True, "location": False, "marketing": False},
        headers=auth(token),
    )
    await client.put(
        "/v1/users/me/consents",
        json={"dataSharing": True, "location": True, "marketing": True},
        headers=auth(token),
    )
    docs = _consent_docs(user_store)
    assert len(docs) == 3
    for doc in docs:
        assert doc["flag"] in ("dataSharing", "location", "marketing")
        assert isinstance(doc["newValue"], bool)
        assert doc["at"]
        assert doc["source"] == "app"


async def test_put_missing_flag_422(client, user_store):
    token = seed_user(user_store)
    resp = await client.put(
        "/v1/users/me/consents",
        json={"dataSharing": True, "location": True},
        headers=auth(token),
    )
    assert resp.status_code == 422


async def test_require_data_sharing_raises_when_off(client, user_store):
    token = seed_user(user_store)
    with pytest.raises(ConsentRequiredError):
        await require_data_sharing("uid-1")
    await client.put(
        "/v1/users/me/consents",
        json={"dataSharing": True, "location": False, "marketing": False},
        headers=auth(token),
    )
    await require_data_sharing("uid-1")
