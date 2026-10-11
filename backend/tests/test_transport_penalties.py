"""FT-8 farmer cancellation penalties + platform credit ledger."""

from datetime import datetime, timedelta, timezone

from tests.test_transport import _activate, _add_vehicle, _book, _token, _verify_vehicle
from tests.test_users import _auth


def _iso_in(hours: float) -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()


async def _accepted(client, user_store, pickup_time):
    token = await _token(client)
    booking = (await _book(client, token, pickupTime=pickup_time)).json()
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


async def _farmer_cancel(client, token, booking_id):
    return await client.post(
        f"/v1/transport/bookings/{booking_id}/cancel",
        json={"reason": "rain delayed harvest"},
        headers=_auth(token),
    )


async def test_cancel_inside_24h_window_accrues_10pct(client, user_store):
    token, booking = await _accepted(client, user_store, _iso_in(12))  # fare ₹1200

    resp = await _farmer_cancel(client, token, booking["id"])
    assert resp.status_code == 200
    assert resp.json()["farmerCancelPenaltyPaisa"] == 12000  # ₹120

    stored = user_store[f"transport_bookings/{booking['id']}"]
    assert stored["farmerCancelPenaltyPaisa"] == 12000
    assert user_store["users/uid-1"]["platformDuesPaisa"] == 12000

    penalty = user_store[f"platform_ledger/pen_{booking['id']}"]
    assert penalty["kind"] == "farmer_cancel_penalty"
    assert penalty["amountPaisa"] == 12000
    compensation = user_store[f"platform_ledger/comp_{booking['id']}"]
    assert compensation["kind"] == "transporter_compensation"
    assert compensation["amountPaisa"] == 6000  # 50% of the penalty


async def test_cancel_inside_2h_window_accrues_25pct(client, user_store):
    token, booking = await _accepted(client, user_store, _iso_in(1))
    resp = await _farmer_cancel(client, token, booking["id"])
    assert resp.status_code == 200
    assert resp.json()["farmerCancelPenaltyPaisa"] == 30000  # ₹300
    assert user_store[f"platform_ledger/comp_{booking['id']}"]["amountPaisa"] == 15000


async def test_cancel_outside_window_is_free(client, user_store):
    token, booking = await _accepted(client, user_store, _iso_in(48))
    resp = await _farmer_cancel(client, token, booking["id"])
    assert resp.status_code == 200
    assert "farmerCancelPenaltyPaisa" not in resp.json()
    assert not any(key.startswith("platform_ledger/") for key in user_store)
    assert user_store["users/uid-1"].get("platformDuesPaisa", 0) == 0


async def test_cancel_requested_never_penalised(client, user_store):
    token = await _token(client)
    booking = (await _book(client, token, pickupTime=_iso_in(1))).json()
    resp = await _farmer_cancel(client, token, booking["id"])
    assert resp.status_code == 200
    assert "farmerCancelPenaltyPaisa" not in resp.json()
    assert not any(key.startswith("platform_ledger/") for key in user_store)


async def test_ledger_mine_summarises_entries(client, user_store):
    token, booking = await _accepted(client, user_store, _iso_in(6))
    await _farmer_cancel(client, token, booking["id"])

    resp = await client.get("/v1/transport/ledger/mine", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2  # penalty + compensation (dual-profile user)
    assert body["platformDuesPaisa"] == 12000
    assert body["penaltiesChargedPaisa"] == 12000
    assert body["compensationEarnedPaisa"] == 6000
    kinds = {e["kind"] for e in body["data"]}
    assert kinds == {"farmer_cancel_penalty", "transporter_compensation"}
