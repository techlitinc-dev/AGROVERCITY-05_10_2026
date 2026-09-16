from datetime import datetime, timedelta, timezone

from app.services.tokens import create_access_token
from tests.test_users import _auth, _register

IST = timezone(timedelta(hours=5, minutes=30))

DEFAULT_SLOT_NAMES = [
    "6:00 AM – 10:00 AM",
    "10:00 AM – 2:00 PM",
    "2:00 PM – 6:00 PM",
    "6:00 PM – 10:00 PM",
]

EQ_1 = {
    "id": "eq-1",
    "name": "Mahindra 575 DI Tractor",
    "type": "tractor",
    "ownerType": "fpo",
    "hourlyRate": 650,
    "perAcreRate": None,
    "distanceKm": 2.5,
    "slotTemplate": None,
    "active": True,
    "docStatus": "verified",
    "rejectionReason": None,
    "createdAt": "2026-09-16T00:00:00+00:00",
}

EQ_2 = {
    "id": "eq-2",
    "name": "Shaktiman Rotavator",
    "type": "rotavator",
    "ownerType": "private",
    "ownerId": "owner-demo",
    "hourlyRate": 500,
    "perAcreRate": None,
    "distanceKm": 4.0,
    "slotTemplate": None,
    "active": True,
    "docStatus": "verified",
    "rejectionReason": None,
    "createdAt": "2026-09-16T00:00:00+00:00",
}


def seed_equipment(user_store):
    user_store["equipment/eq-1"] = dict(EQ_1)
    user_store["equipment/eq-2"] = dict(EQ_2)


def second_farmer_token(user_store, uid="uid-2", name="Suresh Jadhav"):
    user_store[f"users/{uid}"] = {
        "id": uid,
        "name": name,
        "linkedProfiles": ["farmer"],
        "activeProfile": "farmer",
        "primaryProfile": "farmer",
        "agriCoins": 0,
        "mpinHash": None,
        "createdAt": "2026-09-16T00:00:00+00:00",
    }
    return create_access_token(uid)


async def _token(client):
    resp = await _register(client)
    return resp.json()["accessToken"]


def _today():
    return datetime.now(IST).date().isoformat()


def _tomorrow():
    return (datetime.now(IST).date() + timedelta(days=1)).isoformat()


async def _slots(client, token, equipment_id, date=None):
    params = {"date": date} if date else {}
    resp = await client.get(
        f"/v1/equipment/{equipment_id}/slots", params=params, headers=_auth(token)
    )
    assert resp.status_code == 200
    return resp.json()["data"]


async def _book(client, token, slot_id, farmer_name="Ram Patil"):
    return await client.post(
        f"/v1/equipment/slots/{slot_id}/book",
        json={"farmerName": farmer_name},
        headers=_auth(token),
    )


async def test_slots_generated_on_first_read(client, user_store):
    seed_equipment(user_store)
    token = await _token(client)
    slots = await _slots(client, token, "eq-1")
    assert len(slots) == 4
    assert [s["slotName"] for s in slots] == DEFAULT_SLOT_NAMES
    assert all(s["status"] == "available" for s in slots)
    assert all(s["date"] == _today() for s in slots)


async def test_book_fpo_auto_confirms(client, user_store):
    seed_equipment(user_store)
    token = await _token(client)
    slot = (await _slots(client, token, "eq-1"))[0]
    resp = await _book(client, token, slot["id"])
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "booked"
    assert body["booking"]["status"] == "booked"
    assert body["agriCoinsEarned"] == 50
    assert user_store["users/uid-1"]["agriCoins"] == 50
    assert user_store[f"equipment_slots/{slot['id']}"]["status"] == "booked"


async def test_book_private_pending(client, user_store):
    seed_equipment(user_store)
    token = await _token(client)
    slot = (await _slots(client, token, "eq-2"))[0]
    resp = await _book(client, token, slot["id"])
    assert resp.status_code == 200
    assert resp.json()["status"] == "pending"
    assert user_store[f"equipment_slots/{slot['id']}"]["status"] == "pending"


async def test_max_two_slots_per_day(client, user_store):
    seed_equipment(user_store)
    token = await _token(client)
    slots = await _slots(client, token, "eq-1")
    for slot in slots[:2]:
        resp = await _book(client, token, slot["id"])
        assert resp.status_code == 200
    resp = await _book(client, token, slots[2]["id"])
    assert resp.status_code == 409
    error = resp.json()["error"]
    assert error["code"] == "MAX_SLOTS_PER_DAY"
    assert "अधिकतम 2 स्लॉट" in error["message"]


async def test_double_book_same_slot_409(client, user_store):
    seed_equipment(user_store)
    token = await _token(client)
    slot = (await _slots(client, token, "eq-1"))[0]
    resp = await _book(client, token, slot["id"])
    assert resp.status_code == 200
    resp = await _book(client, token, slot["id"])
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "SLOT_UNAVAILABLE"


async def test_cancel_within_2h_blocked(client, user_store):
    seed_equipment(user_store)
    token = await _token(client)
    start = datetime.now(IST) + timedelta(hours=1)
    slot_name = f"{start.strftime('%I:%M %p').lstrip('0')} – 11:00 PM"
    today = _today()
    slot_id = f"eq-1_{today}_0"
    user_store[f"equipment_slots/{slot_id}"] = {
        "id": slot_id,
        "equipmentId": "eq-1",
        "date": today,
        "slotIndex": 0,
        "slotName": slot_name,
        "duration": "4 hours",
        "status": "booked",
        "bookedByName": "Ram Patil",
        "priceRupees": 800,
        "recommendedTask": "Ploughing, tilling (जुताई)",
        "createdAt": "2026-09-16T00:00:00+00:00",
    }
    user_store["equipment_bookings/eqb_near"] = {
        "id": "eqb_near",
        "userId": "uid-1",
        "farmerName": "Ram Patil",
        "slotId": slot_id,
        "equipmentId": "eq-1",
        "date": today,
        "slotName": slot_name,
        "priceRupees": 800,
        "ownerType": "fpo",
        "status": "booked",
        "createdAt": "2026-09-16T00:00:00+00:00",
    }
    resp = await client.delete("/v1/equipment/bookings/eqb_near", headers=_auth(token))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "CANCEL_WINDOW_CLOSED"


async def test_cancel_promotes_waitlist(client, user_store):
    seed_equipment(user_store)
    token = await _token(client)
    token2 = second_farmer_token(user_store)
    slot = (await _slots(client, token, "eq-2", date=_tomorrow()))[0]
    booking = (await _book(client, token, slot["id"])).json()["booking"]
    assert booking["status"] == "pending"
    resp = await client.post(f"/v1/equipment/slots/{slot['id']}/waitlist", headers=_auth(token2))
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
    resp = await client.delete(f"/v1/equipment/bookings/{booking['id']}", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "promotedUserId": "uid-2"}
    assert f"equipment_waitlists/{slot['id']}_uid-2" not in user_store
    promoted = [
        b for key, b in user_store.items()
        if key.startswith("equipment_bookings/") and b["userId"] == "uid-2"
    ]
    assert len(promoted) == 1
    assert promoted[0]["status"] == "pending"
    slot_doc = user_store[f"equipment_slots/{slot['id']}"]
    assert slot_doc["status"] == "pending"
    assert slot_doc["bookedByName"] == "Suresh Jadhav"
