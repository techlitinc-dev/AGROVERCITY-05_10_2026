from app.services.tokens import create_access_token
from tests.test_transport import _activate, _add_vehicle, _book, _token, _verify_vehicle
from tests.test_users import _auth


async def _fleet_with_trip(client, user_store):
    from app.services.billing import seed_plans

    token = await _token(client)
    booking = (await _book(client, token)).json()
    await _activate(client, token)
    # driver sub-accounts are a Pro feature (instructions.md WS-02 step 13)
    await seed_plans()
    subscribed = await client.post(
        "/v1/billing/subscribe", json={"planId": "transport_pro"}, headers=_auth(token)
    )
    assert subscribed.status_code == 201
    vehicle = await _add_vehicle(client, token)
    _verify_vehicle(user_store, vehicle["id"])
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/accept",
        json={"vehicleId": vehicle["id"], "vehicleNo": vehicle["registrationNo"]},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    return token, booking


async def test_driver_ping_allowed_on_assigned_trip(client, user_store):
    token, booking = await _fleet_with_trip(client, user_store)
    driver = (
        await client.post(
            "/v1/transport/drivers",
            json={"name": "Mohan Driver", "phone": "+919800000010"},
            headers=_auth(token),
        )
    ).json()
    assert driver["fleetOwnerId"]

    driver_token = create_access_token(driver["id"])
    ping = await client.post(
        f"/v1/transport/bookings/{booking['id']}/location",
        json={"lat": 20.05, "lng": 73.78, "waypoint": "at_pickup", "waypointLabel": "At pickup"},
        headers=_auth(driver_token),
    )
    assert ping.status_code == 200
    assert ping.json()["location"]["waypoint"] == "at_pickup"


async def test_driver_settlements_read_forbidden(client, user_store):
    token, booking = await _fleet_with_trip(client, user_store)
    driver = (
        await client.post(
            "/v1/transport/drivers",
            json={"name": "Mohan Driver"},
            headers=_auth(token),
        )
    ).json()
    driver_token = create_access_token(driver["id"])

    resp = await client.get("/v1/transport/settlements", headers=_auth(driver_token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "DRIVERS_CANNOT_VIEW_SETTLEMENTS"


async def test_driver_outside_fleet_cannot_operate_trip(client, user_store):
    token, booking = await _fleet_with_trip(client, user_store)
    # a driver scoped to a DIFFERENT fleet owner
    user_store["users/uid-stranger"] = {
        "id": "uid-stranger",
        "linkedProfiles": ["driver"],
        "primaryProfile": "driver",
        "activeProfile": "driver",
        "fleetOwnerId": "someone-else",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    stranger = create_access_token("uid-stranger")

    ping = await client.post(
        f"/v1/transport/bookings/{booking['id']}/location",
        json={"lat": 20.05, "lng": 73.78},
        headers=_auth(stranger),
    )
    assert ping.status_code == 403
    assert ping.json()["error"]["code"] == "FORBIDDEN"
