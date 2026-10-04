from datetime import datetime, timedelta, timezone

from tests.test_transport import (
    _activate,
    _add_vehicle,
    _book,
    _token,
    _verify_vehicle,
)
from tests.test_users import _auth


def _kyc_case(user_store):
    return user_store.get("kyc_cases/kyc_uid-1_transport") or {}


async def _setup(client, user_store, **vehicle_overrides):
    token = await _token(client)
    booking = (await _book(client, token)).json()
    await _activate(client, token)
    vehicle = await _add_vehicle(client, token, **vehicle_overrides)
    return token, booking, vehicle


async def _attempt_accept(client, token, booking, vehicle):
    return await client.post(
        f"/v1/transport/bookings/{booking['id']}/accept",
        json={"vehicleId": vehicle["id"], "vehicleNo": vehicle["registrationNo"]},
        headers=_auth(token),
    )


async def test_expired_fitness_doc_blocks_accept_422(client, user_store):
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).date().isoformat()
    token, booking, vehicle = await _setup(client, user_store, fitnessExpiry=yesterday)
    _verify_vehicle(user_store, vehicle["id"])

    resp = await _attempt_accept(client, token, booking, vehicle)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VEHICLE_NOT_VERIFIED"


async def test_unverified_owner_blocks_accept_422(client, user_store):
    token, booking, vehicle = await _setup(client, user_store)
    # no kyc case, docStatus left pending — the old shim would have allowed a
    # bare docStatus flip; the real pipeline must not.

    resp = await _attempt_accept(client, token, booking, vehicle)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VEHICLE_NOT_VERIFIED"


async def test_verified_case_with_valid_docs_accepts(client, user_store):
    next_year = (datetime.now(timezone.utc) + timedelta(days=365)).date().isoformat()
    token, booking, vehicle = await _setup(
        client, user_store, fitnessExpiry=next_year, pucExpiry=next_year, insuranceExpiry=next_year
    )
    _verify_vehicle(user_store, vehicle["id"])

    resp = await _attempt_accept(client, token, booking, vehicle)
    assert resp.status_code == 200
    assert resp.json()["status"] == "accepted"
    assert _kyc_case(user_store)["docs"][0]["status"] == "verified"


async def test_doc_expiring_in_7_days_emits_reminder_task(client, user_store):
    token = await _token(client)
    await _activate(client, token)
    in_7_days = (datetime.now(timezone.utc) + timedelta(days=7)).date().isoformat()
    vehicle = await _add_vehicle(client, token, fitnessExpiry=in_7_days)

    reminder = [
        doc
        for key, doc in user_store.items()
        if key.startswith("tasks/")
        and doc.get("kind") == "vehicle_doc_expiry_fitnessExpiry"
        and doc.get("userId") == "uid-1"
    ]
    assert len(reminder) == 1
    assert reminder[0]["status"] == "open"
    assert vehicle["id"] in reminder[0]["dedupeKey"]


async def test_doc_expiring_outside_reminder_days_no_task(client, user_store):
    token = await _token(client)
    await _activate(client, token)
    in_20_days = (datetime.now(timezone.utc) + timedelta(days=20)).date().isoformat()
    await _add_vehicle(client, token, insuranceExpiry=in_20_days)

    reminders = [key for key, doc in user_store.items() if key.startswith("tasks/")]
    assert reminders == []
