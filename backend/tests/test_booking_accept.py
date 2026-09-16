from tests.test_transport import BOOKING_BODY, VEHICLE_BODY, _activate, _token, _verify_vehicle
from tests.test_users import _auth


async def _setup(client, user_store):
    token = await _token(client)
    booking = (
        await client.post("/v1/transport/bookings", json=BOOKING_BODY, headers=_auth(token))
    ).json()
    await _activate(client, token)
    vehicle = (
        await client.post("/v1/transport/vehicles", json=VEHICLE_BODY, headers=_auth(token))
    ).json()
    _verify_vehicle(user_store, vehicle["id"])
    return token, booking, vehicle


def _notifications_for(user_store, uid, ntype):
    return [
        doc
        for key, doc in user_store.items()
        if key.startswith("notifications/")
        and doc["userId"] == uid
        and doc["data"].get("type") == ntype
    ]


async def test_accept_requested_booking(client, user_store):
    token, booking, vehicle = await _setup(client, user_store)
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/accept",
        json={"vehicleId": vehicle["id"], "vehicleNo": vehicle["registrationNo"]},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "accepted"
    stored = user_store[f"transport_bookings/{booking['id']}"]
    assert stored["vehicleId"] == vehicle["id"]
    assert stored["vehicleNo"] == vehicle["registrationNo"]
    notes = _notifications_for(user_store, "uid-1", "booking_accepted")
    assert len(notes) == 1
    assert notes[0]["data"]["bookingId"] == booking["id"]
    assert notes[0]["read"] is False


async def test_accept_non_requested_409(client, user_store):
    token, booking, vehicle = await _setup(client, user_store)
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/accept",
        json={"vehicleId": vehicle["id"]},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/accept",
        json={"vehicleId": vehicle["id"]},
        headers=_auth(token),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "ILLEGAL_TRANSITION"


async def test_reject_with_reason(client, user_store):
    token, booking, _ = await _setup(client, user_store)
    reason = "वाहन उपलब्ध नहीं"
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/reject",
        json={"reason": reason},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"
    stored = user_store[f"transport_bookings/{booking['id']}"]
    assert stored["cancellationReason"] == reason
    assert stored["cancelledBy"] == "transporter"
    notes = _notifications_for(user_store, "uid-1", "booking_rejected")
    assert len(notes) == 1
    assert reason in notes[0]["body"]


async def test_reject_without_reason_422(client, user_store):
    token, booking, _ = await _setup(client, user_store)
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/reject", json={}, headers=_auth(token)
    )
    assert resp.status_code == 422
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/reject", json={"reason": "no"}, headers=_auth(token)
    )
    assert resp.status_code == 422


async def test_farmer_cannot_accept_403(client, user_store):
    token = await _token(client, profiles=("farmer", "seller"), primary="farmer")
    booking = (
        await client.post("/v1/transport/bookings", json=BOOKING_BODY, headers=_auth(token))
    ).json()
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/accept", json={}, headers=_auth(token)
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"
