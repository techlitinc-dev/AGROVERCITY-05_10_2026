"""E1 legacy gate removed: document verification and insurance expiry no
longer block NEW booking requests (owner activation is the only gate).
Expiry reminders are still emitted 30/7/1 days out."""
from datetime import datetime, timedelta, timezone

from app.services.billing import seed_plans
from tests.test_equipment import seed_equipment, second_farmer_token
from tests.test_equipment_owner import OWNER_MACHINE, _owner_token
from tests.test_users import _auth, _register


async def _pro_token(client, user_store):
    await seed_plans()
    token = await _owner_token(client)
    subscribed = await client.post(
        "/v1/billing/subscribe",
        json={"planId": "equipmentRental_pro"},
        headers=_auth(token),
    )
    assert subscribed.status_code == 201
    return token

NOW = datetime.now(timezone.utc)


def _kyc_case(user_store, uid="owner-demo"):
    user_store[f"kyc_cases/kyc_{uid[:8]}_equipmentRental"] = {
        "caseId": f"kyc_{uid[:8]}_equipmentRental",
        "userId": uid,
        "persona": "equipmentRental",
        "status": "verified",
        "docs": [
            {"docId": f"kyc_{uid[:8]}_equipmentRental:equipment_rc", "type": "equipment_rc", "status": "verified"},
            {"docId": f"kyc_{uid[:8]}_equipmentRental:equipment_insurance", "type": "equipment_insurance", "status": "verified"},
        ],
    }


def _owned_machine(user_store, uid):
    """eq-2 owned by the given uid, with a verified KYC case for that owner."""
    user_store["equipment/eq-2"]["ownerId"] = uid
    _kyc_case(user_store, uid)


async def _token(client):
    resp = await _register(client, profiles=["farmer"], primaryProfile="farmer")
    return resp.json()["accessToken"]


async def _slots(client, token, equipment_id, date=None):
    params = {"date": date} if date else None
    resp = await client.get(f"/v1/equipment/{equipment_id}/slots", params=params, headers=_auth(token))
    assert resp.status_code == 200
    return resp.json()["data"]


async def test_expired_insurance_does_not_block_new_booking(client, user_store):
    seed_equipment(user_store)
    token = await _token(client)
    farmer_token = second_farmer_token(user_store)
    _owned_machine(user_store, "uid-1")
    user_store["equipment/eq-2"]["insuranceExpiry"] = (NOW - timedelta(days=1)).isoformat()
    slot = (await _slots(client, token, "eq-2"))[0]

    resp = await client.post(
        f"/v1/equipment/slots/{slot['id']}/book",
        json={"farmerName": "Suresh Jadhav", "termsAccepted": True},
        headers=_auth(farmer_token),
    )
    assert resp.status_code == 200
    assert resp.json()["booking"]["status"] == "pending"
    assert user_store[f"equipment_slots/{slot['id']}"]["status"] == "pending"


async def test_in_flight_booking_unaffected_by_expiry(client, user_store):
    """A booking made while insurance was live keeps flowing after expiry."""
    from app.services.tokens import create_access_token

    seed_equipment(user_store)
    token = await _token(client)
    user_store["users/uid-2"] = {
        "id": "uid-2",
        "linkedProfiles": ["equipmentRental"],
        "activeProfile": "equipmentRental",
        "kycStatus": "verified",
        "primaryProfile": "equipmentRental",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    owner_token = create_access_token("uid-2")
    _owned_machine(user_store, "uid-2")
    tomorrow = (NOW.date() + timedelta(days=1)).isoformat()
    slot = (await _slots(client, token, "eq-2", date=tomorrow))[0]
    booking = (
        await client.post(
            f"/v1/equipment/slots/{slot['id']}/book",
            json={"farmerName": "Ram Patil", "termsAccepted": True},
            headers=_auth(token),
        )
    ).json()["booking"]
    assert booking["status"] == "pending"

    # insurance lapses mid-season
    user_store["equipment/eq-2"]["insuranceExpiry"] = (NOW - timedelta(days=2)).isoformat()

    # the owner can still approve / the job stays in flight
    resp = await client.post(
        f"/v1/equipment/bookings/{booking['id']}/approve", json={"termsAccepted": True, "mpin": "1234"}, headers=_auth(owner_token)
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "booked"
    # cancelling (an in-flight mutation) also stays open
    resp = await client.delete(f"/v1/equipment/bookings/{booking['id']}", headers=_auth(token))
    assert resp.status_code == 200


async def test_unverified_kyc_case_does_not_block_booking(client, user_store):
    seed_equipment(user_store)
    token = await _token(client)
    farmer_token = second_farmer_token(user_store)
    _owned_machine(user_store, "uid-1")
    # the insurance doc falls back to pending — the request is still accepted
    user_store["kyc_cases/kyc_uid-1_equipmentRental"]["docs"][1]["status"] = "pending"
    user_store["kyc_cases/kyc_uid-1_equipmentRental"]["status"] = "pending"
    slot = (await _slots(client, token, "eq-2"))[0]
    resp = await client.post(
        f"/v1/equipment/slots/{slot['id']}/book",
        json={"farmerName": "Suresh Jadhav", "termsAccepted": True},
        headers=_auth(farmer_token),
    )
    assert resp.status_code == 200
    assert resp.json()["booking"]["status"] == "pending"


async def test_expiry_reminders_30_7_1(client, user_store):
    owner = await _pro_token(client, user_store)  # 4 machines need the Pro fleet
    for days, eq_id in ((30, "eq-a"), (7, "eq-b"), (1, "eq-c"), (45, "eq-d")):
        user_store[f"equipment/{eq_id}"] = {
            **OWNER_MACHINE,
            "id": eq_id,
            "insuranceExpiry": (NOW + timedelta(days=days)).isoformat(),
        }
    resp = await client.get("/v1/equipment/owner/fleet", headers=_auth(owner))
    assert resp.status_code == 200

    tasks = [d for k, d in user_store.items() if k.startswith("tasks/")]
    kinds = [t["kind"] for t in tasks]
    assert kinds.count("insurance_expiry") == 3  # 30/7/1 fire, 45 does not
    priorities = {t["subtitle"].split(" ")[0]: t["priority"] for t in tasks}
    assert priorities["7"] == "high"
    assert priorities["30"] == "medium"
    assert priorities["1"] == "high"


async def test_owner_sets_expiry_via_machine_upsert(client, user_store):
    owner = await _owner_token(client)
    expiry = (NOW + timedelta(days=90)).date().isoformat()
    resp = await client.post(
        "/v1/equipment",
        json={
            "name": "Swaraj 744",
            "type": "tractor",
            "hourlyRate": 800,
            "insuranceExpiry": expiry,
        },
        headers=_auth(owner),
    )
    assert resp.status_code == 201
    assert resp.json()["insuranceExpiry"] == expiry
