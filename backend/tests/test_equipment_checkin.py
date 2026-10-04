"""E4-lite: manual/event check-in pins at dispatch and return, rendered on the
dispatch timeline. No GPS tracker for v1."""
from tests.test_equipment import second_farmer_token
from tests.test_equipment_approve import _verify_equipment_kyc
from tests.test_equipment_owner import OWNER_MACHINE, _owner_token
from tests.test_users import _auth

PIN = {"lat": 20.05, "lng": 73.78, "label": "Farm gate, Pimplas"}


async def _setup_booking(client, user_store):
    owner_token = await _owner_token(client)
    user_store["equipment/eq-own"] = dict(OWNER_MACHINE)
    _verify_equipment_kyc(user_store)
    farmer_token = second_farmer_token(user_store)
    resp = await client.get(
        f"/v1/equipment/eq-own/slots",
        params={"date": _date_plus(2)},
        headers=_auth(farmer_token),
    )
    slot = resp.json()["data"][0]
    resp = await client.post(
        f"/v1/equipment/slots/{slot['id']}/book",
        json={"farmerName": "Suresh Jadhav"},
        headers=_auth(farmer_token),
    )
    assert resp.status_code == 200
    booking = resp.json()["booking"]
    resp = await client.post(
        f"/v1/equipment/bookings/{booking['id']}/approve", headers=_auth(owner_token)
    )
    assert resp.status_code == 200
    return owner_token, farmer_token, booking


from datetime import datetime, timedelta, timezone  # noqa: E402

IST = timezone(timedelta(hours=5, minutes=30))


def _date_plus(days):
    return (datetime.now(IST).date() + timedelta(days=days)).isoformat()


async def test_dispatch_and_return_pins_persist(client, user_store):
    owner_token, farmer_token, booking = await _setup_booking(client, user_store)

    resp = await client.post(
        f"/v1/equipment/bookings/{booking['id']}/check-in",
        json={**PIN, "event": "dispatch"},
        headers=_auth(owner_token),
    )
    assert resp.status_code == 201
    assert resp.json()["event"] == "dispatch"

    resp = await client.post(
        f"/v1/equipment/bookings/{booking['id']}/check-in",
        json={**PIN, "lat": 20.09, "lng": 73.82, "event": "return", "label": "Return at yard"},
        headers=_auth(owner_token),
    )
    assert resp.status_code == 201

    # both pins render on the dispatch timeline (owner + farmer can read)
    for token in (owner_token, farmer_token):
        resp = await client.get(
            f"/v1/equipment/bookings/{booking['id']}/check-in", headers=_auth(token)
        )
        assert resp.status_code == 200
        pins = resp.json()["data"]
        assert [p["event"] for p in pins] == ["dispatch", "return"]
        assert pins[1]["lat"] == 20.09


async def test_stranger_cannot_read_pins(client, user_store):
    from app.services.tokens import create_access_token

    owner_token, _, booking = await _setup_booking(client, user_store)
    await client.post(
        f"/v1/equipment/bookings/{booking['id']}/check-in",
        json={**PIN, "event": "dispatch"},
        headers=_auth(owner_token),
    )
    user_store["users/uid-9"] = {
        "id": "uid-9",
        "linkedProfiles": ["farmer"],
        "activeProfile": "farmer",
        "primaryProfile": "farmer",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    resp = await client.get(
        f"/v1/equipment/bookings/{booking['id']}/check-in",
        headers=_auth(create_access_token("uid-9")),
    )
    assert resp.status_code == 403


async def test_unknown_booking_404(client, user_store):
    owner_token = await _owner_token(client)
    resp = await client.post(
        "/v1/equipment/bookings/bk-missing/check-in",
        json={**PIN, "event": "dispatch"},
        headers=_auth(owner_token),
    )
    assert resp.status_code == 404
