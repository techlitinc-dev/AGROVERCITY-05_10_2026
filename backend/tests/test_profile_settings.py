"""Profile & privacy gaps (SR 2 / SR 34): photoUrl on PUT /users/me and the
discoverable account-visibility setting on GET/PUT /users/me/settings."""
from tests.test_diary import auth, seed_user

PHOTO_URL = "https://storage.example.com/uploads/uid-1/abc123.jpg"


async def test_put_me_persists_photo_url(client, user_store):
    token = seed_user(user_store)
    resp = await client.put(
        "/v1/users/me",
        json={"photoUrl": PHOTO_URL},
        headers=auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["photoUrl"] == PHOTO_URL
    # Stored on the user doc and echoed by GET /users/me
    assert user_store["users/uid-1"]["photoUrl"] == PHOTO_URL
    resp = await client.get("/v1/users/me", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["photoUrl"] == PHOTO_URL


async def test_put_me_photo_url_validation(client, user_store):
    token = seed_user(user_store)
    # Empty string is not a usable photo reference
    resp = await client.put("/v1/users/me", json={"photoUrl": ""}, headers=auth(token))
    assert resp.status_code == 422
    # Over the 500-char budget
    resp = await client.put(
        "/v1/users/me",
        json={"photoUrl": "https://example.com/" + "a" * 500},
        headers=auth(token),
    )
    assert resp.status_code == 422
    # A relative upload path is accepted
    resp = await client.put(
        "/v1/users/me",
        json={"photoUrl": "/uploads/uid-1/abc123.png"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["photoUrl"] == "/uploads/uid-1/abc123.png"


async def test_put_me_ignores_absent_photo_url(client, user_store):
    token = seed_user(user_store, photoUrl=PHOTO_URL)
    resp = await client.put("/v1/users/me", json={"name": "Sham Patil"}, headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["photoUrl"] == PHOTO_URL
    assert resp.json()["name"] == "Sham Patil"


async def test_settings_discoverable_defaults_true(client, user_store):
    token = seed_user(user_store)
    resp = await client.get("/v1/users/me/settings", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["discoverable"] is True


async def test_settings_discoverable_roundtrip(client, user_store):
    token = seed_user(user_store)
    resp = await client.put(
        "/v1/users/me/settings",
        json={"discoverable": False},
        headers=auth(token),
    )
    assert resp.status_code == 200
    assert user_store["users/uid-1"]["discoverable"] is False

    resp = await client.get("/v1/users/me/settings", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["discoverable"] is False

    # Re-enabling works and other toggles are untouched
    resp = await client.put(
        "/v1/users/me/settings",
        json={"discoverable": True, "womenMode": True},
        headers=auth(token),
    )
    assert resp.status_code == 200
    resp = await client.get("/v1/users/me/settings", headers=auth(token))
    body = resp.json()
    assert body["discoverable"] is True
    assert body["womenMode"] is True
    assert body["highContrast"] is False
