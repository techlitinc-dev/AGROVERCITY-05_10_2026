from tests.test_transport import _activate, _add_vehicle, _book, _token, _verify_vehicle
from tests.test_users import _auth


async def _accepted_trip(client, user_store, fare_overrides=None):
    token = await _token(client)
    booking = (await _book(client, token, **(fare_overrides or {}))).json()
    # pin the fare so the math is exact
    user_store[f"transport_bookings/{booking['id']}"]["fare"] = 1000
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


async def test_trip_pnl_commission_matches_default_config(client, user_store):
    token, booking = await _accepted_trip(client, user_store)
    await client.post(
        f"/v1/transport/bookings/{booking['id']}/expenses",
        json={"category": "diesel", "amount": 200, "notes": "fuel"},
        headers=_auth(token),
    )

    resp = await client.get(
        f"/v1/transport/bookings/{booking['id']}/expenses", headers=_auth(token)
    )
    assert resp.status_code == 200
    pnl = resp.json()
    assert pnl["grossFare"] == 1000
    assert pnl["totalExpenses"] == 200
    # default platform_config/settlements.transportPct = 10
    assert pnl["platformCommission"] == 100
    assert pnl["netProfit"] == 700


async def test_trip_pnl_commission_tracks_config_change(client, user_store):
    user_store["platform_config/settlements"] = {
        "transportPct": 12,
        "equipmentRentalPct": 12,
        "brokerPct": 2,
    }
    token, booking = await _accepted_trip(client, user_store)

    resp = await client.get(
        f"/v1/transport/bookings/{booking['id']}/expenses", headers=_auth(token)
    )
    assert resp.status_code == 200
    pnl = resp.json()
    assert pnl["platformCommission"] == 120
    assert pnl["netProfit"] == 880


async def test_commission_invoice_returns_pdf(client, user_store):
    token, booking = await _accepted_trip(client, user_store)

    resp = await client.get(
        f"/v1/transport/bookings/{booking['id']}/commission-invoice", headers=_auth(token)
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.content.startswith(b"%PDF")
