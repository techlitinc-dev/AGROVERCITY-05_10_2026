from datetime import datetime, timedelta, timezone

from tests.test_transport import _activate, _add_vehicle, _book, _token, _verify_vehicle
from tests.test_users import _auth

PENALTIES = {
    "cancelWindowHours": 24,
    "strikesToSuspend": 2,
    "version": 1,
    "effectiveFrom": "2026-01-01T00:00:00+00:00",
}


async def _accept_booking(client, user_store, token):
    from app.services.billing import seed_plans

    booking = (await _book(client, token)).json()
    await _activate(client, token)
    # multiple accepts in one test need the Pro fleet allowance (Free = 1)
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
    return booking, vehicle


async def _cancel(client, token, booking_id):
    return await client.patch(
        f"/v1/transport/bookings/{booking_id}", json={"status": "cancelled"}, headers=_auth(token)
    )


async def test_cancel_in_window_records_strike(client, user_store):
    user_store["platform_config/transport_penalties"] = dict(PENALTIES)
    token = await _token(client)
    booking, _ = await _accept_booking(client, user_store, token)

    resp = await _cancel(client, token, booking["id"])
    assert resp.status_code == 200
    assert user_store["users/uid-1"]["noShowStrikes"] == 1
    assert not user_store["users/uid-1"].get("loadBoardSuspended")


async def test_strikes_suspend_at_threshold_and_accept_403(client, user_store):
    user_store["platform_config/transport_penalties"] = dict(PENALTIES)
    token = await _token(client)

    first, _ = await _accept_booking(client, user_store, token)
    assert (await _cancel(client, token, first["id"])).status_code == 200
    assert user_store["users/uid-1"]["noShowStrikes"] == 1

    second, _ = await _accept_booking(client, user_store, token)
    assert (await _cancel(client, token, second["id"])).status_code == 200
    assert user_store["users/uid-1"]["noShowStrikes"] == 2
    assert user_store["users/uid-1"]["loadBoardSuspended"] is True

    third = (await _book(client, token)).json()
    vehicle = await _add_vehicle(client, token)
    _verify_vehicle(user_store, vehicle["id"])
    blocked = await client.post(
        f"/v1/transport/bookings/{third['id']}/accept",
        json={"vehicleId": vehicle["id"], "vehicleNo": vehicle["registrationNo"]},
        headers=_auth(token),
    )
    assert blocked.status_code == 403
    assert blocked.json()["error"]["code"] == "SUSPENDED_FROM_LOAD_BOARD"


async def test_cancel_outside_window_no_strike(client, user_store):
    user_store["platform_config/transport_penalties"] = dict(PENALTIES)
    token = await _token(client)
    booking, _ = await _accept_booking(client, user_store, token)

    # pickup 2 days out — today's cancel is outside the 24 h window
    future = (datetime.now(timezone.utc) + timedelta(days=2)).date().isoformat()
    user_store[f"transport_bookings/{booking['id']}"]["date"] = future

    resp = await _cancel(client, token, booking["id"])
    assert resp.status_code == 200
    assert user_store["users/uid-1"].get("noShowStrikes", 0) == 0
