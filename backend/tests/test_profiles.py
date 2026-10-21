from tests.test_users import REGISTER_BODY, _auth, _register


async def test_link_profile(client):
    resp = await _register(client)
    token = resp.json()["accessToken"]
    resp = await client.post(
        "/v1/users/me/profiles", json={"profileType": "transport"}, headers=_auth(token)
    )
    assert resp.status_code == 200
    assert "transport" in resp.json()["linkedProfiles"] or "transporter" in resp.json()["linkedProfiles"]


async def test_link_duplicate(client):
    resp = await _register(client)
    token = resp.json()["accessToken"]
    resp = await client.post(
        "/v1/users/me/profiles", json={"profileType": "seller"}, headers=_auth(token)
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "PROFILE_ALREADY_LINKED"


async def test_link_landlord_profile(client):
    resp = await _register(client)
    token = resp.json()["accessToken"]
    resp = await client.post(
        "/v1/users/me/profiles", json={"profileType": "landlord"}, headers=_auth(token)
    )
    assert resp.status_code == 200
    linked = resp.json()["linkedProfiles"]
    assert "landlord" in linked or "farmLandlord" in linked

    # Linking again should return 409 PROFILE_ALREADY_LINKED
    dup_resp = await client.post(
        "/v1/users/me/profiles", json={"profileType": "landlord"}, headers=_auth(token)
    )
    assert dup_resp.status_code == 409
    assert dup_resp.json()["error"]["code"] == "PROFILE_ALREADY_LINKED"


async def test_unlink_last_profile_blocked(client):
    resp = await _register(client, profiles=["farmer"], primaryProfile="farmer")
    token = resp.json()["accessToken"]
    resp = await client.delete("/v1/users/me/profiles/farmer", headers=_auth(token))
    assert resp.status_code == 409
    error = resp.json()["error"]
    assert error["code"] == "LAST_PROFILE"
    assert "कम से कम एक प्रोफाइल" in error["message"]


async def test_activate_returns_default_home(client):
    resp = await _register(client)
    token = resp.json()["accessToken"]
    await client.post("/v1/users/me/profiles", json={"profileType": "transport"}, headers=_auth(token))
    resp = await client.post("/v1/users/me/profiles/transport/activate", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["defaultHomeRoute"] == "transportHome"
    assert resp.json()["activeProfile"] in ("transport", "transporter")


async def test_activate_landlord(client):
    resp = await _register(client)
    token = resp.json()["accessToken"]
    await client.post("/v1/users/me/profiles", json={"profileType": "landlord"}, headers=_auth(token))
    resp = await client.post("/v1/users/me/profiles/landlord/activate", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["defaultHomeRoute"] == "landlordHome"
    assert resp.json()["activeProfile"] in ("landlord", "farmLandlord")


async def test_unlink_active_promotes_primary(client):
    resp = await _register(client)
    token = resp.json()["accessToken"]
    await client.post("/v1/users/me/profiles/seller/activate", headers=_auth(token))
    resp = await client.delete("/v1/users/me/profiles/seller", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["activeProfile"] == "farmer"


async def test_primary_star(client):
    resp = await _register(client)
    token = resp.json()["accessToken"]
    resp = await client.put("/v1/users/me/profiles/seller/primary", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["primaryProfile"] == "seller"
