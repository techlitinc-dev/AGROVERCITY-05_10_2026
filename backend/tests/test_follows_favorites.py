"""SR 11 + SR 32 — follows & mandi favorites."""
import pytest

from app.main import app
from app.routers import follows as follows_module
from app.services.tokens import create_access_token
from tests.test_users import _auth

# The router is registered in app/main.py by the integration owner; mounting it
# here too keeps this suite self-contained (duplicate registration is harmless —
# FastAPI matches the first, identical routes).
@pytest.fixture(scope="session", autouse=True)
def _register_follows_router():
    app.include_router(follows_module.router, prefix="/v1")

MANDIS = [
    {"id": "mandi-1", "name": "Pimpalgaon Baswant APMC", "district": "Nashik", "state": "Maharashtra"},
    {"id": "mandi-2", "name": "Lasalgaon APMC", "district": "Nashik", "state": "Maharashtra"},
]

USERS = [
    {"id": "uid-2", "name": "Sunita Pawar", "activeProfile": "seller", "primaryProfile": "seller"},
    {"id": "uid-3", "name": "Ganesh Jadhav", "activeProfile": "transporter", "primaryProfile": "transporter", "rating": 4.5},
]


@pytest.fixture
def seeded(user_store):
    for doc in MANDIS:
        user_store[f"mandis/{doc['id']}"] = doc
    for doc in USERS:
        user_store[f"users/{doc['id']}"] = doc
    return user_store


def _token(uid: str = "uid-1") -> str:
    return create_access_token(uid)


# ---------------------------------------------------------------- follows

async def test_follow_requires_auth(client, seeded):
    resp = await client.post("/v1/users/uid-2/follow")
    assert resp.status_code == 401


async def test_cannot_follow_self(client, seeded):
    resp = await client.post("/v1/users/uid-1/follow", headers=_auth(_token()))
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "CANNOT_FOLLOW_SELF"


async def test_follow_unknown_target_404(client, seeded):
    resp = await client.post("/v1/users/uid-ghost/follow", headers=_auth(_token()))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"


async def test_follow_and_unfollow(client, seeded):
    auth = _auth(_token())
    resp = await client.post("/v1/users/uid-2/follow", headers=auth)
    assert resp.status_code == 200
    assert resp.json()["status"] == "following"
    doc = seeded["follows/uid-1_uid-2"]
    assert doc["followerId"] == "uid-1"
    assert doc["targetId"] == "uid-2"
    assert doc["createdAt"]

    resp = await client.delete("/v1/users/uid-2/follow", headers=auth)
    assert resp.status_code == 200
    assert resp.json()["status"] == "unfollowed"
    assert "follows/uid-1_uid-2" not in seeded


async def test_follows_list_joins_user_docs_and_skips_missing(client, seeded):
    auth = _auth(_token())
    await client.post("/v1/users/uid-2/follow", headers=auth)
    await client.post("/v1/users/uid-3/follow", headers=auth)
    # Stale follow pointing at a deleted account — must be skipped, not 500.
    seeded["follows/uid-1_uid-gone"] = {
        "followerId": "uid-1",
        "targetId": "uid-gone",
        "createdAt": "2026-01-01T00:00:00+00:00",
    }

    resp = await client.get("/v1/users/me/follows", headers=auth)
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) == 2
    by_id = {i["userId"]: i for i in items}
    assert by_id["uid-2"]["name"] == "Sunita Pawar"
    assert by_id["uid-2"]["persona"] == "seller"
    assert by_id["uid-3"]["rating"] == 4.5
    assert all("since" in i for i in items)


async def test_follows_are_scoped_per_user(client, seeded):
    await client.post("/v1/users/uid-3/follow", headers=_auth(_token("uid-1")))
    resp = await client.get("/v1/users/me/follows", headers=_auth(_token("uid-2")))
    assert resp.status_code == 200
    assert resp.json()["items"] == []


# ---------------------------------------------------------------- mandi favorites

async def test_favorite_unknown_mandi_404(client, seeded):
    resp = await client.post(
        "/v1/mandi/favorites",
        json={"mandiId": "mandi-nope"},
        headers=_auth(_token()),
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "MANDI_NOT_FOUND"


async def test_mandi_favorite_crud(client, seeded):
    auth = _auth(_token())
    resp = await client.post("/v1/mandi/favorites", json={"mandiId": "mandi-1"}, headers=auth)
    assert resp.status_code == 200
    assert resp.json()["status"] == "saved"
    # name/district/state resolved from the mandis doc, not the request body.
    assert resp.json()["name"] == "Pimpalgaon Baswant APMC"

    await client.post("/v1/mandi/favorites", json={"mandiId": "mandi-2"}, headers=auth)

    resp = await client.get("/v1/mandi/favorites", headers=auth)
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) == 2
    by_id = {i["mandiId"]: i for i in items}
    assert by_id["mandi-1"]["district"] == "Nashik"
    assert by_id["mandi-1"]["state"] == "Maharashtra"
    assert by_id["mandi-1"]["since"]

    resp = await client.delete("/v1/mandi/favorites/mandi-1", headers=auth)
    assert resp.status_code == 200
    assert resp.json()["status"] == "removed"
    assert "mandi_favorites/uid-1_mandi-1" not in seeded

    resp = await client.get("/v1/mandi/favorites", headers=auth)
    assert [i["mandiId"] for i in resp.json()["items"]] == ["mandi-2"]


async def test_mandi_favorites_scoped_per_user(client, seeded):
    await client.post("/v1/mandi/favorites", json={"mandiId": "mandi-1"}, headers=_auth(_token("uid-1")))
    resp = await client.get("/v1/mandi/favorites", headers=_auth(_token("uid-2")))
    assert resp.status_code == 200
    assert resp.json()["items"] == []


async def test_remove_favorite_requires_auth(client, seeded):
    resp = await client.delete("/v1/mandi/favorites/mandi-1")
    assert resp.status_code == 401
