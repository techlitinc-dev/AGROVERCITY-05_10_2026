from datetime import datetime, timedelta, timezone

from tests.test_transport import (
    _activate,
    _add_vehicle,
    _book,
    _token,
    _verify_vehicle,
)
from tests.test_users import _auth


def _load_body(pickup, date):
    return {
        "pickupLocation": pickup,
        "dropLocation": "Pune Market Yard",
        "crop": "Onion",
        "quantityQuintals": 20,
        "packaging": "Gunny Bags",
        "perishable": False,
        "preferredVehicleType": "Tractor Trolley",
        "pickupDate": date,
        "targetFare": 1800,
    }


async def _enroute_trip(client, user_store):
    token = await _token(client)
    today = datetime.now(timezone.utc).date().isoformat()
    booking = (await _book(client, token, date=today)).json()
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
    return token, booking


async def test_return_loads_matches_nearby_pickup_in_window(client, user_store):
    token, trip = await _enroute_trip(client, user_store)
    today = datetime.now(timezone.utc).date()
    nearby = today.isoformat()
    outside = (today + timedelta(days=10)).isoformat()

    # matching: pickup shares the drop district token ("Nashik"), in window
    m = (
        await client.post(
            "/v1/transport/loads",
            json=_load_body("Nashik City", nearby),
            headers=_auth(token),
        )
    ).json()
    # non-matching: different district
    n = (
        await client.post(
            "/v1/transport/loads",
            json=_load_body("Pune", nearby),
            headers=_auth(token),
        )
    ).json()
    # non-matching: nearby district but outside the return window
    w = (
        await client.post(
            "/v1/transport/loads",
            json=_load_body("Nashik Rural", outside),
            headers=_auth(token),
        )
    ).json()

    resp = await client.get(
        f"/v1/transport/trips/{trip['id']}/return-loads", headers=_auth(token)
    )
    assert resp.status_code == 200
    ids = [load["id"] for load in resp.json()["data"]]
    assert resp.json()["total"] == 1
    assert ids == [m["id"]]
    assert n["id"] not in ids
    assert w["id"] not in ids


async def test_return_loads_requires_underway_trip(client, user_store):
    token = await _token(client)
    today = datetime.now(timezone.utc).date().isoformat()
    booking = (await _book(client, token, date=today)).json()
    await _activate(client, token)
    vehicle = await _add_vehicle(client, token)
    _verify_vehicle(user_store, vehicle["id"])
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/accept",
        json={"vehicleId": vehicle["id"], "vehicleNo": vehicle["registrationNo"]},
        headers=_auth(token),
    )
    assert resp.status_code == 200

    resp = await client.get(
        f"/v1/transport/trips/{booking['id']}/return-loads", headers=_auth(token)
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "TRIP_NOT_ACTIVE"
