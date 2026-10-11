"""FT-5 load templates & repeat bookings (spec F12)."""

from tests.test_transport import _token
from tests.test_users import _auth

TEMPLATE_BODY = {
    "name": "Weekly Nashik→Vashi onion run",
    "pickupLocation": "Pimpalgaon, Nashik",
    "dropLocation": "Vashi APMC, Navi Mumbai",
    "crop": "Red Onion",
    "quantityQuintals": 40,
    "preferredVehicleType": "Tractor Trolley",
    "targetFare": 2500,
    "repeatWeekday": 1,
}


async def _create_template(client, token, **overrides):
    return await client.post(
        "/v1/transport/load-templates",
        json={**TEMPLATE_BODY, **overrides},
        headers=_auth(token),
    )


async def test_template_crud_roundtrip(client, user_store):
    token = await _token(client)
    resp = await _create_template(client, token)
    assert resp.status_code == 201
    template = resp.json()
    assert template["useCount"] == 0
    assert template["repeatWeekday"] == 1

    listed = await client.get("/v1/transport/load-templates", headers=_auth(token))
    assert listed.json()["total"] == 1

    deleted = await client.delete(
        f"/v1/transport/load-templates/{template['id']}", headers=_auth(token)
    )
    assert deleted.status_code == 200
    listed = await client.get("/v1/transport/load-templates", headers=_auth(token))
    assert listed.json()["total"] == 0

    missing = await client.delete(
        f"/v1/transport/load-templates/{template['id']}", headers=_auth(token)
    )
    assert missing.status_code == 404


async def test_template_rejects_unknown_vehicle_type(client, user_store):
    token = await _token(client)
    resp = await _create_template(client, token, preferredVehicleType="Spaceship")
    assert resp.status_code == 422


async def test_repeat_creates_open_load_and_counts_uses(client, user_store):
    token = await _token(client)
    template = (await _create_template(client, token)).json()

    repeated = await client.post(
        f"/v1/transport/load-templates/{template['id']}/repeat",
        json={"pickupDate": "2026-10-13", "targetFare": 2700},
        headers=_auth(token),
    )
    assert repeated.status_code == 201
    load = repeated.json()
    assert load["status"] == "open"
    assert load["pickupDate"] == "2026-10-13"
    assert load["targetFare"] == 2700  # seasonal override
    assert load["templateId"] == template["id"]
    assert load["crop"] == "Red Onion"
    assert load["bidsCount"] == 0

    stored = user_store[f"transport_load_templates/{template['id']}"]
    assert stored["useCount"] == 1

    # default fare comes back when not overridden
    again = await client.post(
        f"/v1/transport/load-templates/{template['id']}/repeat",
        json={"pickupDate": "2026-10-20"},
        headers=_auth(token),
    )
    assert again.status_code == 201
    assert again.json()["targetFare"] == 2500
    assert user_store[f"transport_load_templates/{template['id']}"]["useCount"] == 2

    # the repeated load is live on the board
    board = await client.get("/v1/transport/loads", headers=_auth(token))
    crops = [ld["crop"] for ld in board.json()["data"]]
    assert "Red Onion" in crops


async def test_repeat_guards(client, user_store):
    token = await _token(client)
    template = (await _create_template(client, token)).json()

    from tests.test_transport import _other_transporter_token

    other = _other_transporter_token(user_store)
    resp = await client.post(
        f"/v1/transport/load-templates/{template['id']}/repeat",
        json={"pickupDate": "2026-10-13"},
        headers=_auth(other),
    )
    assert resp.status_code == 404  # template belongs to uid-1, hidden from uid-2
