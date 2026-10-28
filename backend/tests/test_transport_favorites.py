"""FT-4 favorite transporters + one-tap rebook."""

from tests.test_transport import POD, _activate, _add_vehicle, _book, _token, _verify_vehicle
from tests.test_users import _auth


async def _delivered(client, user_store, **book_overrides):
    token = await _token(client)
    booking = (await _book(client, token, **book_overrides)).json()
    await _activate(client, token)
    vehicle = await _add_vehicle(client, token)
    _verify_vehicle(user_store, vehicle["id"])
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/accept",
        json={"vehicleId": vehicle["id"], "vehicleNo": vehicle["registrationNo"]},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    resp = await client.patch(
        f"/v1/transport/bookings/{booking['id']}", json={"status": "enRoute"}, headers=_auth(token)
    )
    assert resp.status_code == 200
    resp = await client.patch(
        f"/v1/transport/bookings/{booking['id']}",
        json={"status": "delivered", **POD},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    return token, booking


async def test_favorite_toggle_and_list(client, user_store):
    token = await _token(client)
    # uid-1 is its own transporter in this dual-profile harness
    resp = await client.post(
        "/v1/transport/favorites/uid-1", json={"favorited": True}, headers=_auth(token)
    )
    assert resp.status_code == 200
    assert resp.json()["favorited"] is True

    listed = await client.get("/v1/transport/favorites", headers=_auth(token))
    assert listed.json()["total"] == 1
    assert listed.json()["data"][0]["transporterId"] == "uid-1"

    off = await client.post(
        "/v1/transport/favorites/uid-1", json={"favorited": False}, headers=_auth(token)
    )
    assert off.json()["favorited"] is False
    listed = await client.get("/v1/transport/favorites", headers=_auth(token))
    assert listed.json()["total"] == 0


async def test_favorite_unknown_transporter_404(client, user_store):
    token = await _token(client)
    resp = await client.post(
        "/v1/transport/favorites/uid-nope", json={"favorited": True}, headers=_auth(token)
    )
    assert resp.status_code == 404


async def test_rebook_clones_terminal_trip_with_fresh_fare(client, user_store):
    token, booking = await _delivered(client, user_store, pickupTime="2026-10-09T04:30:00+00:00")

    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/rebook",
        json={"date": "2026-10-16", "notes": "weekly mandi run"},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    clone = resp.json()
    assert clone["rebookOf"] == booking["id"]
    assert clone["status"] == "requested"
    assert clone["date"] == "2026-10-16"
    assert clone["pickup"] == booking["pickup"]
    assert clone["drop"] == booking["drop"]
    assert clone["vehicleType"] == booking["vehicleType"]
    assert clone["pickupTime"] == "2026-10-09T04:30:00+00:00"  # inherited slot
    assert clone["fare"] == booking["fare"]  # same catalog rate
    assert clone["notes"] == "weekly mandi run"

    # FT-1 reminder fires for the rebooked slot
    reminders = [
        d for d in user_store.values()
        if isinstance(d, dict) and d.get("kind") == "trip_pickup_reminder"
    ]
    assert any(r["sourceId"] == clone["id"] for r in reminders)


async def test_rebook_recomputes_when_rates_changed(client, user_store):
    token, booking = await _delivered(client, user_store)
    # admin updates the Tata Ace rate-card doc mid-season (Firestore-backed catalog)
    user_store["vehicle_catalog/vcat_tata_ace"]["perKmRate"] = 40
    try:
        resp = await client.post(
            f"/v1/transport/bookings/{booking['id']}/rebook",
            json={"date": "2026-10-16"},
            headers=_auth(token),
        )
        assert resp.status_code == 201
        assert resp.json()["fare"] == 500 + 40 * 20  # 1300, not the old 1200
    finally:
        user_store["vehicle_catalog/vcat_tata_ace"]["perKmRate"] = 35


async def test_rebook_guards(client, user_store):
    token, booking = await _delivered(client, user_store)

    # live trip cannot rebook
    live = (await _book(client, token)).json()
    resp = await client.post(
        f"/v1/transport/bookings/{live['id']}/rebook",
        json={"date": "2026-10-16"},
        headers=_auth(token),
    )
    assert resp.status_code == 409

    # someone else's trip cannot rebook
    from tests.test_transport import _other_transporter_token

    other = _other_transporter_token(user_store)
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/rebook",
        json={"date": "2026-10-16"},
        headers=_auth(other),
    )
    assert resp.status_code == 403
