"""Owner activation is the go-live trigger for farmer discovery (spec §5/§6).

An owner-added machine is active by default and therefore listed for farmers
immediately; deactivation removes it from the farmer surface and reactivation
restores it. The admin document review no longer gates anything at request
time — it only drives the Equipment Verified badge, and booking requests are
accepted regardless of the owner's document-verification or insurance state.
"""
from datetime import datetime, timedelta, timezone

from tests.test_equipment import second_farmer_token
from tests.test_equipment_owner import MACHINE_BODY, _owner_token
from tests.test_users import _auth

IST = timezone(timedelta(hours=5, minutes=30))

REQUEST_BODY = {
    "farmerName": "Suresh Jadhav",
    "workLocation": "Pimplas, Niphad",
    "workType": "Ploughing",
    "workQuantity": 2,
    "workUnit": "acres",
    "termsAccepted": True,
}


def _tomorrow():
    return (datetime.now(IST).date() + timedelta(days=1)).isoformat()


async def _add_machine(client, owner_token):
    resp = await client.post("/v1/equipment", json=MACHINE_BODY, headers=_auth(owner_token))
    assert resp.status_code == 201
    return resp.json()


async def _farmer_rows(client, farmer_token):
    resp = await client.get("/v1/equipment", headers=_auth(farmer_token))
    assert resp.status_code == 200
    return resp.json()["data"]


async def test_owner_added_machine_visible_to_farmer_while_docs_pending(client, user_store):
    owner_token = await _owner_token(client)
    machine = await _add_machine(client, owner_token)
    assert machine["docStatus"] == "pending"

    farmer_token = second_farmer_token(user_store)
    row = next(d for d in await _farmer_rows(client, farmer_token) if d["id"] == machine["id"])
    assert row["equipmentVerified"] is False

    slots = await client.get(
        f"/v1/equipment/{machine['id']}/slots",
        params={"date": _tomorrow()},
        headers=_auth(farmer_token),
    )
    assert slots.status_code == 200
    assert len(slots.json()["data"]) == 4


async def test_deactivate_hides_and_reactivate_shows(client, user_store):
    owner_token = await _owner_token(client)
    machine = await _add_machine(client, owner_token)
    farmer_token = second_farmer_token(user_store)

    resp = await client.put(
        f"/v1/equipment/{machine['id']}",
        json={**MACHINE_BODY, "active": False},
        headers=_auth(owner_token),
    )
    assert resp.status_code == 200
    assert all(d["id"] != machine["id"] for d in await _farmer_rows(client, farmer_token))
    slots = await client.get(f"/v1/equipment/{machine['id']}/slots", headers=_auth(farmer_token))
    assert slots.status_code == 404
    assert slots.json()["error"]["code"] == "EQUIPMENT_NOT_FOUND"

    resp = await client.put(
        f"/v1/equipment/{machine['id']}",
        json={**MACHINE_BODY, "active": True},
        headers=_auth(owner_token),
    )
    assert resp.status_code == 200
    assert any(d["id"] == machine["id"] for d in await _farmer_rows(client, farmer_token))


async def test_admin_document_review_unlocks_equipment_badge(client, user_store):
    owner_token = await _owner_token(client)
    machine = await _add_machine(client, owner_token)
    farmer_token = second_farmer_token(user_store)

    # stands in for the admin document review
    user_store[f"equipment/{machine['id']}"]["docStatus"] = "verified"
    row = next(d for d in await _farmer_rows(client, farmer_token) if d["id"] == machine["id"])
    assert row["equipmentVerified"] is True


async def test_booking_succeeds_without_verified_owner_documents(client, user_store):
    owner_token = await _owner_token(client)
    machine = await _add_machine(client, owner_token)
    farmer_token = second_farmer_token(user_store)

    slots_resp = await client.get(
        f"/v1/equipment/{machine['id']}/slots",
        params={"date": _tomorrow()},
        headers=_auth(farmer_token),
    )
    slot = slots_resp.json()["data"][0]
    resp = await client.post(
        f"/v1/equipment/slots/{slot['id']}/book",
        json=REQUEST_BODY,
        headers=_auth(farmer_token),
    )
    assert resp.status_code == 200
    assert resp.json()["booking"]["status"] == "pending"


async def test_waitlist_promotion_without_verified_owner_documents(client, user_store):
    owner_token = await _owner_token(client)
    machine = await _add_machine(client, owner_token)
    farmer_a = second_farmer_token(user_store, uid="uid-2", name="Suresh Jadhav")
    farmer_b = second_farmer_token(user_store, uid="uid-3", name="Dinkar Pawar")

    slots_resp = await client.get(
        f"/v1/equipment/{machine['id']}/slots",
        params={"date": _tomorrow()},
        headers=_auth(farmer_a),
    )
    slot = slots_resp.json()["data"][0]

    booked = await client.post(
        f"/v1/equipment/slots/{slot['id']}/book",
        json={**REQUEST_BODY, "farmerName": "Suresh Jadhav"},
        headers=_auth(farmer_a),
    )
    assert booked.status_code == 200

    waitlisted = await client.post(
        f"/v1/equipment/slots/{slot['id']}/waitlist",
        headers=_auth(farmer_b),
    )
    assert waitlisted.status_code == 200

    cancelled = await client.delete(
        f"/v1/equipment/bookings/{booked.json()['booking']['id']}",
        headers=_auth(farmer_a),
    )
    assert cancelled.status_code == 200
    # the waitlist head is promoted without any document-verification gate
    assert cancelled.json()["promotedUserId"] == "uid-3"
    assert f"equipment_waitlists/{slot['id']}_uid-3" not in user_store

    pending = await client.get("/v1/equipment/bookings/pending", headers=_auth(owner_token))
    row = next(r for r in pending.json()["data"] if r["farmerName"] == "Dinkar Pawar")
    assert row["date"] == slot["date"]
    assert user_store[f"equipment_slots/{slot['id']}"]["status"] == "pending"
    assert user_store[f"equipment_slots/{slot['id']}"]["bookedByName"] == "Dinkar Pawar"
