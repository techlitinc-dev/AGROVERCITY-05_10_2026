from tests.test_users import _auth, _register


async def test_register_transport_variant(client):
    resp = await _register(
        client,
        profiles=["farmer", "transport"],
        roleProfiles={"transport": {"vehicleType": "Tata Ace", "rcNumber": "MH15AB1234"}},
    )
    assert resp.status_code == 200
    token = resp.json()["accessToken"]
    me = await client.get("/v1/users/me", headers=_auth(token))
    assert me.json()["roleProfiles"]["transport"]["rcNumber"] == "MH15AB1234"
    assert me.json()["roleProfiles"]["transport"]["vehicleType"] == "Tata Ace"


async def test_register_seller_variant_optionals(client):
    resp = await _register(
        client,
        profiles=["farmer", "seller"],
        roleProfiles={"seller": {"shopName": "Ram Kirana"}},
    )
    assert resp.status_code == 200
    token = resp.json()["accessToken"]
    me = await client.get("/v1/users/me", headers=_auth(token))
    assert me.json()["roleProfiles"]["seller"]["shopName"] == "Ram Kirana"


async def test_register_variant_missing_required(client):
    resp = await _register(
        client,
        profiles=["farmer", "transport"],
        roleProfiles={"transport": {"vehicleType": "Tata Ace"}},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "INVALID_ROLE_PROFILE"
    assert "transport" in resp.json()["error"]["fieldErrors"]


async def test_register_roleprofile_not_in_profiles(client):
    resp = await _register(
        client,
        profiles=["farmer"],
        primaryProfile="farmer",
        roleProfiles={"broker": {"marketsServed": ["Nashik"]}},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "INVALID_ROLE_PROFILE"


async def test_register_landlord_and_broker_variants(client):
    resp = await _register(
        client,
        profiles=["farmer", "farmLandlord", "broker"],
        roleProfiles={
            "farmLandlord": {"totalLandAcres": 12.5},
            "broker": {"marketsServed": ["Nashik", "Lasalgaon"]},
        },
    )
    assert resp.status_code == 200
    token = resp.json()["accessToken"]
    me = await client.get("/v1/users/me", headers=_auth(token))
    role_profiles = me.json()["roleProfiles"]
    assert role_profiles["farmLandlord"]["totalLandAcres"] == 12.5
    assert role_profiles["broker"]["marketsServed"] == ["Nashik", "Lasalgaon"]
