"""Granular trip status steps (Flipkart-style step tracker)."""

from tests.test_transport import (
    POD,
    _activate,
    _add_vehicle,
    _book,
    _token,
    _verify_vehicle,
)
from tests.test_users import _auth


async def _accepted_booking(client, user_store, token=None, vehicle=None):
    if token is None:
        token = await _token(client)
    booking = (await _book(client, token)).json()
    await _activate(client, token)
    if vehicle is None:
        vehicle = await _add_vehicle(client, token)
        _verify_vehicle(user_store, vehicle["id"])
    resp = await client.patch(
        f"/v1/transport/bookings/{booking['id']}",
        json={"status": "accepted", "vehicleId": vehicle["id"], "vehicleNo": vehicle["registrationNo"]},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    return token, booking, vehicle


async def _transition(client, token, booking_id, status, **extra):
    return await client.patch(
        f"/v1/transport/bookings/{booking_id}",
        json={"status": status, **extra},
        headers=_auth(token),
    )


async def test_full_granular_path_with_waypoint_labels(client, user_store):
    token, booking, _vehicle = await _accepted_booking(client, user_store)
    steps = ["arrivedPickup", "loading", "enRoute", "reachedDestination", "unloading"]
    for status in steps:
        resp = await _transition(client, token, booking["id"], status)
        assert resp.status_code == 200, status
        assert resp.json()["status"] == status
    resp = await _transition(client, token, booking["id"], "delivered", **POD)
    assert resp.status_code == 200

    detail = (
        await client.get(f"/v1/transport/bookings/{booking['id']}", headers=_auth(token))
    ).json()
    by_waypoint = {w["waypoint"]: w["label"] for w in detail["waypointsLog"]}
    assert by_waypoint["arrivedPickup"] == "पिकअप स्थान पर पहुंचे"
    assert by_waypoint["loading"] == "लोडिंग चालू"
    assert by_waypoint["enRoute"] == "रास्ते में"
    assert by_waypoint["reachedDestination"] == "गंतव्य पर पहुंचे"
    assert by_waypoint["unloading"] == "अनलोडिंग चालू"
    assert by_waypoint["delivered"] == "डिलीवर पूर्ण"


async def test_skip_paths_still_work(client, user_store):
    # accepted → enRoute skips the pickup/loading steps
    token, booking, vehicle = await _accepted_booking(client, user_store)
    resp = await _transition(client, token, booking["id"], "enRoute")
    assert resp.status_code == 200
    # reachedDestination → delivered skips unloading
    resp = await _transition(client, token, booking["id"], "reachedDestination")
    assert resp.status_code == 200
    resp = await _transition(client, token, booking["id"], "delivered", **POD)
    assert resp.status_code == 200

    # legacy enRoute → delivered stays legal for old clients
    # (reuses the same fleet — the free tier allows only one vehicle)
    token, booking, _vehicle = await _accepted_booking(
        client, user_store, token=token, vehicle=vehicle
    )
    resp = await _transition(client, token, booking["id"], "enRoute")
    assert resp.status_code == 200
    resp = await _transition(client, token, booking["id"], "delivered", **POD)
    assert resp.status_code == 200


async def test_illegal_granular_transitions_409(client, user_store):
    token, booking, _vehicle = await _accepted_booking(client, user_store)

    # cannot jump straight to loading from accepted (must pass arrivedPickup)
    resp = await _transition(client, token, booking["id"], "loading")
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "ILLEGAL_TRANSITION"

    # arrivedPickup cannot skip to reachedDestination
    resp = await _transition(client, token, booking["id"], "arrivedPickup")
    assert resp.status_code == 200
    resp = await _transition(client, token, booking["id"], "reachedDestination")
    assert resp.status_code == 409

    # enRoute cannot go backwards to loading
    resp = await _transition(client, token, booking["id"], "loading")
    assert resp.status_code == 200
    resp = await _transition(client, token, booking["id"], "enRoute")
    assert resp.status_code == 200
    resp = await _transition(client, token, booking["id"], "loading")
    assert resp.status_code == 409

    # a delivered trip accepts no further steps
    resp = await _transition(client, token, booking["id"], "reachedDestination")
    assert resp.status_code == 200
    resp = await _transition(client, token, booking["id"], "delivered", **POD)
    assert resp.status_code == 200
    resp = await _transition(client, token, booking["id"], "unloading")
    assert resp.status_code == 409


async def test_delivered_from_unloading_requires_pod(client, user_store):
    token, booking, _vehicle = await _accepted_booking(client, user_store)
    for status in ("arrivedPickup", "loading", "enRoute", "reachedDestination", "unloading"):
        resp = await _transition(client, token, booking["id"], status)
        assert resp.status_code == 200
    resp = await _transition(client, token, booking["id"], "delivered")
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "POD_REQUIRED"
