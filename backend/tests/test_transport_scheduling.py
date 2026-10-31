"""FT-1 Book Now / Book Later — pickup time windows + pickup reminders."""

from tests.test_transport import _activate, _add_vehicle, _book, _token, _verify_vehicle
from tests.test_users import _auth

PICKUP_TIME = "2026-10-09T04:30:00+00:00"


def _tasks_for(user_store, uid, kind):
    return [
        doc
        for doc in user_store.values()
        if isinstance(doc, dict)
        and doc.get("kind") == kind
        and doc.get("userId") == uid
    ]


async def test_booking_with_pickup_time_persists_and_reminds_farmer(client, user_store):
    token = await _token(client)
    resp = await _book(client, token, pickupTime=PICKUP_TIME, timeWindowMinutes=120)
    assert resp.status_code == 200
    booking = resp.json()
    assert booking["pickupTime"] == PICKUP_TIME
    assert booking["timeWindowMinutes"] == 120

    stored = user_store[f"transport_bookings/{booking['id']}"]
    assert stored["pickupTime"] == PICKUP_TIME

    reminders = _tasks_for(user_store, "uid-1", "trip_pickup_reminder")
    assert len(reminders) == 1
    assert reminders[0]["dueAt"] == PICKUP_TIME
    assert "120 min window" in reminders[0]["subtitle"]


async def test_booking_without_pickup_time_has_no_reminder(client, user_store):
    token = await _token(client)
    booking = (await _book(client, token)).json()
    assert booking["pickupTime"] is None
    assert _tasks_for(user_store, "uid-1", "trip_pickup_reminder") == []


async def test_time_window_validation(client, user_store):
    token = await _token(client)
    resp = await _book(client, token, pickupTime=PICKUP_TIME, timeWindowMinutes=5)
    assert resp.status_code == 422
    resp = await _book(client, token, timeWindowMinutes=9999)
    assert resp.status_code == 422


async def test_accept_emits_transporter_reminder(client, user_store):
    token = await _token(client)
    booking = (await _book(client, token, pickupTime=PICKUP_TIME)).json()
    await _activate(client, token)
    vehicle = await _add_vehicle(client, token)
    _verify_vehicle(user_store, vehicle["id"])
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/accept",
        json={"vehicleId": vehicle["id"], "vehicleNo": vehicle["registrationNo"]},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    reminders = _tasks_for(user_store, "uid-1", "trip_pickup_reminder")
    assert len(reminders) == 1  # same dual-profile user refreshes the same dedupe key
    assert reminders[0]["dueAt"] == PICKUP_TIME
    assert reminders[0]["priority"] == "high"  # refreshed to the transporter urgency


async def test_open_load_carries_pickup_time_into_booking(client, user_store):
    token = await _token(client)
    load = (
        await client.post(
            "/v1/transport/loads",
            json={
                "pickupLocation": "Pimplas, Nashik",
                "dropLocation": "Vashi APMC",
                "crop": "Onion",
                "quantityQuintals": 12,
                "preferredVehicleType": "Bolero Maxi",
                "pickupDate": "2026-11-09",
                "pickupTime": PICKUP_TIME,
                "targetFare": 9000,
                "termsAccepted": True,
            },
            headers=_auth(token),
        )
    ).json()
    assert load["pickupTime"] == PICKUP_TIME

    await _activate(client, token)
    bid = (
        await client.post(
            f"/v1/transport/loads/{load['id']}/bid",
            json={"quotedFare": 8800, "termsAccepted": True, "mpin": "1234"},
            headers=_auth(token),
        )
    ).json()
    accepted = await client.post(
        f"/v1/transport/loads/{load['id']}/accept-bid",
        json={"bidId": bid["id"], "termsAccepted": True, "mpin": "1234"},
        headers=_auth(token),
    )
    assert accepted.status_code == 200
    booking = accepted.json()["booking"]
    assert booking["pickupTime"] == PICKUP_TIME
    reminders = _tasks_for(user_store, booking["transporterId"], "trip_pickup_reminder")
    assert len(reminders) == 1
    assert reminders[0]["dueAt"] == PICKUP_TIME
