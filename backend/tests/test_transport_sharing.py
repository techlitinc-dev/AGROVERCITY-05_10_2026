"""FT-7 trip sharing — view-only tracking link."""

from datetime import datetime, timedelta, timezone

from tests.test_transport import _activate, _add_vehicle, _book, _token, _verify_vehicle
from tests.test_users import _auth


async def _accepted(client, user_store):
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


async def _ping(client, token, booking_id, waypoint, label):
    resp = await client.post(
        f"/v1/transport/bookings/{booking_id}/location",
        json={"lat": 19.99, "lng": 73.79, "waypoint": waypoint, "waypointLabel": label},
        headers=_auth(token),
    )
    assert resp.status_code == 200


async def test_share_happy_path_public_view(client, user_store):
    token, booking = await _accepted(client, user_store)
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/share", headers=_auth(token)
    )
    assert resp.status_code == 200
    share = resp.json()
    assert share["token"] and share["expiresAt"]

    await _ping(client, token, booking["id"], "at_pickup", "Reached pickup")
    resp = await client.patch(
        f"/v1/transport/bookings/{booking['id']}", json={"status": "enRoute"}, headers=_auth(token)
    )
    assert resp.status_code == 200
    await _ping(client, token, booking["id"], "loaded", "Loaded")

    # public view — no auth header at all
    view = await client.get(f"/v1/transport/shared/{share['token']}")
    assert view.status_code == 200
    body = view.json()
    assert body["status"] == "enRoute"
    assert body["route"] == {"pickup": "Pimplas", "drop": "Nashik APMC"}
    assert body["vehicleNo"] == "MH15 AB 1234"
    assert body["driverName"]
    assert body["currentLocation"]["waypoint"] == "loaded"
    assert body["estimatedMinutesLeft"] >= 15
    waypoints = [w["waypoint"] for w in body["waypoints"]]
    assert "at_pickup" in waypoints and "loaded" in waypoints
    # sanitized: no fares, no phones, no user ids
    assert "fare" not in body
    assert "userId" not in body and "transporterId" not in body
    assert "driverPhone" not in body


async def test_share_rotates_and_revokes(client, user_store):
    token, booking = await _accepted(client, user_store)
    first = (
        await client.post(f"/v1/transport/bookings/{booking['id']}/share", headers=_auth(token))
    ).json()

    second = (
        await client.post(f"/v1/transport/bookings/{booking['id']}/share", headers=_auth(token))
    ).json()
    assert second["token"] != first["token"]

    old = await client.get(f"/v1/transport/shared/{first['token']}")
    assert old.status_code == 404
    new = await client.get(f"/v1/transport/shared/{second['token']}")
    assert new.status_code == 200

    revoked = await client.delete(
        f"/v1/transport/bookings/{booking['id']}/share", headers=_auth(token)
    )
    assert revoked.json()["revoked"] == 1
    gone = await client.get(f"/v1/transport/shared/{second['token']}")
    assert gone.status_code == 404


async def test_share_expiry(client, user_store):
    token, booking = await _accepted(client, user_store)
    share = (
        await client.post(f"/v1/transport/bookings/{booking['id']}/share", headers=_auth(token))
    ).json()
    # force expiry in the store
    for key, doc in user_store.items():
        if key.startswith("trip_shares/"):
            doc["expiresAt"] = (
                datetime.now(timezone.utc) - timedelta(hours=1)
            ).isoformat()
    expired = await client.get(f"/v1/transport/shared/{share['token']}")
    assert expired.status_code == 410
    assert expired.json()["error"]["code"] == "SHARE_EXPIRED"


async def test_share_guards(client, user_store):
    token, booking = await _accepted(client, user_store)

    from tests.test_transport import _other_transporter_token

    other = _other_transporter_token(user_store)
    forbidden = await client.post(
        f"/v1/transport/bookings/{booking['id']}/share", headers=_auth(other)
    )
    assert forbidden.status_code == 403

    # cancelled trips cannot be shared
    cancelled = await _book(client, token)
    await client.post(
        f"/v1/transport/bookings/{cancelled.json()['id']}/cancel",
        json={"reason": "plan changed"},
        headers=_auth(token),
    )
    resp = await client.post(
        f"/v1/transport/bookings/{cancelled.json()['id']}/share", headers=_auth(token)
    )
    assert resp.status_code == 409

    bogus = await client.get("/v1/transport/shared/does-not-exist")
    assert bogus.status_code == 404
