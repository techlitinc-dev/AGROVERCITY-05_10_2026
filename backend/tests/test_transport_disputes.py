from tests.test_transport import _activate, _add_vehicle, _book, _token, _verify_vehicle
from tests.test_users import _auth

ADMIN_HEADERS = {
    "Authorization": "Bearer admin-token",
    "X-Admin-Role": "superadmin",
    "X-Audit-Reason": "test reason",
}

DISPUTE_BODY = {
    "photos": ["https://storage.example/damage/1.jpg"],
    "claimPaisa": 12500,
    "notes": "crate damage at drop",
}


async def _accepted_booking(client, user_store):
    token = await _token(client)
    booking = (await _book(client, token)).json()
    await _activate(client, token)
    vehicle = await _add_vehicle(client, token)
    _verify_vehicle(user_store, vehicle["id"])
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/accept",
        json={"vehicleId": vehicle["id"], "vehicleNo": vehicle["registrationNo"]},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    return token, booking


async def test_damage_dispute_create_and_list(client, user_store):
    token, booking = await _accepted_booking(client, user_store)

    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/damage-disputes",
        json=DISPUTE_BODY,
        headers=_auth(token),
    )
    assert resp.status_code == 201
    dispute = resp.json()
    assert dispute["status"] == "open"
    assert dispute["bookingId"] == booking["id"]
    assert dispute["claimPaisa"] == DISPUTE_BODY["claimPaisa"]
    assert dispute["createdBy"]

    listed = await client.get(
        f"/v1/transport/bookings/{booking['id']}/damage-disputes", headers=_auth(token)
    )
    assert listed.status_code == 200
    assert listed.json()["total"] == 1
    assert listed.json()["data"][0]["id"] == dispute["id"]


async def test_damage_dispute_resolve_transition(client, user_store):
    token, booking = await _accepted_booking(client, user_store)
    dispute = (
        await client.post(
            f"/v1/transport/bookings/{booking['id']}/damage-disputes",
            json=DISPUTE_BODY,
            headers=_auth(token),
        )
    ).json()

    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/damage-disputes/{dispute['id']}/resolve",
        json={"resolution": "claim approved, settled via payout adjustment"},
        headers=ADMIN_HEADERS,
    )
    assert resp.status_code == 200
    resolved = resp.json()
    assert resolved["status"] == "resolved"
    assert resolved["resolvedBy"]

    again = await client.post(
        f"/v1/transport/bookings/{booking['id']}/damage-disputes/{dispute['id']}/resolve",
        json={"resolution": "try again"},
        headers=ADMIN_HEADERS,
    )
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "DISPUTE_NOT_OPEN"


async def test_damage_dispute_resolve_requires_admin_headers(client, user_store):
    token, booking = await _accepted_booking(client, user_store)
    dispute = (
        await client.post(
            f"/v1/transport/bookings/{booking['id']}/damage-disputes",
            json=DISPUTE_BODY,
            headers=_auth(token),
        )
    ).json()

    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/damage-disputes/{dispute['id']}/resolve",
        json={"resolution": "no reason given"},
        headers={"Authorization": "Bearer admin-token"},
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "AUDIT_REASON_REQUIRED"


async def test_transport_penalties_config_loads_with_defaults(client, user_store):
    from app.routers.transport import TRANSPORT_PENALTIES_DEFAULTS, _transport_penalties

    config = await _transport_penalties()
    for key in ("cancelWindowHours", "strikesToSuspend", "version", "effectiveFrom"):
        assert key in config
        assert config[key] == TRANSPORT_PENALTIES_DEFAULTS[key]
    # loader seeds the admin-editable config doc
    assert "transport_penalties" in [
        doc_id.split("/")[-1] for doc_id in user_store if doc_id.startswith("platform_config/")
    ]

    future = dict(TRANSPORT_PENALTIES_DEFAULTS)
    future.update({"strikesToSuspend": 1, "version": 2, "effectiveFrom": "2999-01-01T00:00:00+00:00"})
    user_store["platform_config/transport_penalties"] = future
    not_yet = await _transport_penalties()
    assert not_yet["strikesToSuspend"] == TRANSPORT_PENALTIES_DEFAULTS["strikesToSuspend"]
