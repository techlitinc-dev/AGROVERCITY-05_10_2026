"""Persona visibility: hide/show personas without unlinking them.

Covers GET /users/me/profiles, PUT /users/me/profiles/{p}/visibility
(disable/enable, active-persona auto-switch, last-enabled guard, alias
normalisation) and the PERSONA_DISABLED guard on activate.
"""

from tests.test_diary import auth, seed_user


def _seed_multi(user_store):
    """Farmer + seller linked, farmer active & primary."""
    return seed_user(
        user_store,
        uid="uid-1",
        active_profile="farmer",
        linkedProfiles=["farmer", "seller"],
        primaryProfile="farmer",
    )


async def test_get_profiles_surface(client, user_store):
    token = _seed_multi(user_store)
    resp = await client.get("/v1/users/me/profiles", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["linkedProfiles"] == ["farmer", "seller"]
    assert body["activeProfile"] == "farmer"
    personas = {p["persona"]: p for p in body["personas"]}
    assert len(personas) >= 21
    assert personas["farmer"] == {
        "persona": "farmer", "linked": True, "active": True, "primary": True, "disabled": False,
    }
    assert personas["seller"]["linked"] is True
    assert personas["customer"]["linked"] is False
    # GET /users/me echoes the stored list too
    me = await client.get("/v1/users/me", headers=auth(token))
    assert me.json()["disabledProfiles"] == []


async def test_disable_and_enable_roundtrip(client, user_store):
    token = _seed_multi(user_store)
    off = await client.put(
        "/v1/users/me/profiles/seller/visibility", json={"enabled": False}, headers=auth(token)
    )
    assert off.status_code == 200
    assert off.json()["disabledProfiles"] == ["seller"]
    assert off.json()["activeProfile"] == "farmer"

    me = await client.get("/v1/users/me", headers=auth(token))
    assert me.json()["disabledProfiles"] == ["seller"]
    # hidden ≠ unlinked
    assert "seller" in me.json()["linkedProfiles"]

    on = await client.put(
        "/v1/users/me/profiles/seller/visibility", json={"enabled": True}, headers=auth(token)
    )
    assert on.json()["disabledProfiles"] == []


async def test_disable_active_persona_auto_switches(client, user_store):
    token = _seed_multi(user_store)
    resp = await client.put(
        "/v1/users/me/profiles/farmer/visibility", json={"enabled": False}, headers=auth(token)
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "farmer" in body["disabledProfiles"]
    assert body["activeProfile"] == "seller", "falls back to the other enabled persona"

    me = await client.get("/v1/users/me", headers=auth(token))
    assert me.json()["activeProfile"] == "seller"


async def test_disable_active_falls_back_to_enabled_persona(client, user_store):
    """Primary already hidden → fall back to the first other enabled persona."""
    token = seed_user(
        user_store,
        uid="uid-1",
        active_profile="seller",
        linkedProfiles=["farmer", "seller", "customer"],
        primaryProfile="farmer",
    )
    await client.put(
        "/v1/users/me/profiles/farmer/visibility", json={"enabled": False}, headers=auth(token)
    )
    resp = await client.put(
        "/v1/users/me/profiles/seller/visibility", json={"enabled": False}, headers=auth(token)
    )
    assert resp.status_code == 200
    assert resp.json()["activeProfile"] == "customer"


async def test_last_enabled_persona_guard(client, user_store):
    token = seed_user(user_store, uid="uid-1", active_profile="farmer",
                      linkedProfiles=["farmer"], primaryProfile="farmer")
    resp = await client.put(
        "/v1/users/me/profiles/farmer/visibility", json={"enabled": False}, headers=auth(token)
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "LAST_ENABLED_PERSONA"
    me = await client.get("/v1/users/me", headers=auth(token))
    assert me.json()["activeProfile"] == "farmer"
    assert me.json()["disabledProfiles"] == []


async def test_activate_disabled_persona_rejected(client, user_store):
    token = _seed_multi(user_store)
    await client.put(
        "/v1/users/me/profiles/seller/visibility", json={"enabled": False}, headers=auth(token)
    )
    resp = await client.post("/v1/users/me/profiles/seller/activate", headers=auth(token))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "PERSONA_DISABLED"
    me = await client.get("/v1/users/me", headers=auth(token))
    assert me.json()["activeProfile"] == "farmer"


async def test_alias_spellings_normalise(client, user_store):
    """Backend aliases (farmLandlord, transport) map to canonical personas."""
    token = _seed_multi(user_store)
    resp = await client.put(
        "/v1/users/me/profiles/transport/visibility", json={"enabled": False}, headers=auth(token)
    )
    assert resp.status_code == 200
    assert resp.json()["persona"] == "transporter"
    assert resp.json()["disabledProfiles"] == ["transporter"]

    surface = await client.get("/v1/users/me/profiles", headers=auth(token))
    personas = {p["persona"]: p for p in surface.json()["personas"]}
    assert personas["transporter"]["disabled"] is True


async def test_unknown_persona_rejected(client, user_store):
    token = _seed_multi(user_store)
    resp = await client.put(
        "/v1/users/me/profiles/alien/visibility", json={"enabled": False}, headers=auth(token)
    )
    assert resp.status_code == 422
