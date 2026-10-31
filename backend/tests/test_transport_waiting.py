"""FT-2 detention / waiting charges."""

from tests.test_transport import (
    _activate,
    _add_vehicle,
    _book,
    _token,
    _verify_vehicle,
)
from tests.test_users import _auth

START = "2026-10-09T04:00:00+00:00"
STOP_130_MIN = "2026-10-09T06:10:00+00:00"  # 130 min → 70 billable → 3 slabs → ₹450
STOP_45_MIN = "2026-10-09T04:45:00+00:00"   # inside free grace → ₹0
STOP_3000_MIN = "2026-10-09T13:00:00+00:00"  # 540 min, far over the ₹2000 cap


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


async def _wait(client, token, booking_id, phase, action, at=None):
    body = {"phase": phase, "action": action}
    if at:
        body["at"] = at
    return await client.post(
        f"/v1/transport/bookings/{booking_id}/waiting", json=body, headers=_auth(token)
    )


async def test_waiting_billing_happy_path(client, user_store):
    token, booking = await _accepted_booking(client, user_store)

    started = await _wait(client, token, booking["id"], "pickup", "start", START)
    assert started.status_code == 200
    assert started.json()["phase"] == "pickup"

    stopped = await _wait(client, token, booking["id"], "pickup", "stop", STOP_130_MIN)
    assert stopped.status_code == 200
    event = stopped.json()["event"]
    assert event["minutes"] == 130
    assert event["billableMinutes"] == 70
    assert event["chargePaisa"] == 45000  # 3 slabs × ₹150
    detention = stopped.json()["detention"]
    assert detention["pickupChargePaisa"] == 45000
    assert detention["totalChargePaisa"] == 45000

    stored = user_store[f"transport_bookings/{booking['id']}"]
    assert stored["detention"]["totalChargePaisa"] == 45000
    waypoints = [w["waypoint"] for w in stored["waypointsLog"]]
    assert "waiting_pickup_start" in waypoints
    assert "waiting_pickup_end" in waypoints

    pnl = await client.get(
        f"/v1/transport/bookings/{booking['id']}/expenses", headers=_auth(token)
    )
    assert pnl.status_code == 200
    body = pnl.json()
    assert body["detentionChargePaisa"] == 45000
    assert body["detentionCharge"] == 450.0
    # fare 1200 + detention 450 − 0 expenses − 0 commission (direct-connect)
    assert body["netProfit"] == 1650.0
    assert body["platformCommission"] == 0

    bilty = await client.get(
        f"/v1/transport/bookings/{booking['id']}/bilty", headers=_auth(token)
    )
    assert bilty.json()["freightCharges"]["detentionChargePaisa"] == 45000


async def test_waiting_inside_free_grace_is_free(client, user_store):
    token, booking = await _accepted_booking(client, user_store)
    await _wait(client, token, booking["id"], "pickup", "start", START)
    stopped = await _wait(client, token, booking["id"], "pickup", "stop", STOP_45_MIN)
    assert stopped.status_code == 200
    assert stopped.json()["event"]["chargePaisa"] == 0


async def test_waiting_charge_capped(client, user_store):
    token, booking = await _accepted_booking(client, user_store)
    await _wait(client, token, booking["id"], "pickup", "start", START)
    stopped = await _wait(client, token, booking["id"], "pickup", "stop", STOP_3000_MIN)
    assert stopped.status_code == 200
    assert stopped.json()["event"]["chargePaisa"] == 200000  # hard cap ₹2000


async def test_waiting_state_guards(client, user_store):
    token, booking = await _accepted_booking(client, user_store)

    double = await _wait(client, token, booking["id"], "pickup", "start", START)
    assert double.status_code == 200
    again = await _wait(client, token, booking["id"], "pickup", "start")
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "WAITING_ALREADY_OPEN"

    stop = await _wait(client, token, booking["id"], "pickup", "stop", STOP_45_MIN)
    assert stop.status_code == 200
    second_stop = await _wait(client, token, booking["id"], "pickup", "stop")
    assert second_stop.status_code == 409
    assert second_stop.json()["error"]["code"] == "WAITING_NOT_OPEN"


async def test_waiting_rejected_before_acceptance_and_bad_input(client, user_store):
    token = await _token(client)
    booking = (await _book(client, token)).json()

    # nobody is assigned yet — operator check wins over the status guard
    early = await _wait(client, token, booking["id"], "pickup", "start")
    assert early.status_code == 403
    assert early.json()["error"]["code"] in ("FORBIDDEN", "FORBIDDEN_ROLE")

    token, booking = await _accepted_booking(client, user_store)
    # pickup waiting is allowed once accepted, drop waiting is not (enRoute only)
    drop_early = await _wait(client, token, booking["id"], "drop", "start")
    assert drop_early.status_code == 409
    assert drop_early.json()["error"]["code"] == "WAITING_NOT_ALLOWED"

    bad_phase = await _wait(client, token, booking["id"], "midway", "start")
    assert bad_phase.status_code == 422
    bad_action = await _wait(client, token, booking["id"], "pickup", "pause")
    assert bad_action.status_code == 422


async def test_waiting_forbidden_for_non_assigned_transporter(client, user_store):
    from tests.test_transport import _other_transporter_token

    token, booking = await _accepted_booking(client, user_store)
    other = _other_transporter_token(user_store)
    resp = await _wait(client, other, booking["id"], "pickup", "start")
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"
