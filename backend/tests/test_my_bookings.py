from tests.test_diary import auth, seed_user


def _equipment_booking(user_store, uid="uid-1", booking_id="eqb_1", **overrides):
    user_store[f"equipment_bookings/{booking_id}"] = {
        "id": booking_id,
        "userId": uid,
        "equipmentId": "eq-1",
        "slotId": "slot-1",
        "date": "2026-09-20",
        "slotName": "6:00 AM – 10:00 AM",
        "priceRupees": 800,
        "status": "booked",
        **overrides,
    }


def _transport_booking(user_store, uid="uid-1", booking_id="trb_1", **overrides):
    user_store[f"transport_bookings/{booking_id}"] = {
        "id": booking_id,
        "userId": uid,
        "vehicleType": "miniTruck",
        "pickup": "Ozarkhed",
        "drop": "Nashik APMC",
        "date": "2026-09-21",
        "fare": 850,
        "status": "requested",
        **overrides,
    }


async def test_aggregate_three_sources(client, user_store):
    token = seed_user(user_store)
    _equipment_booking(user_store)
    _transport_booking(user_store)
    resp = await client.get("/v1/users/me/bookings", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["equipment"]) == 1
    assert body["equipment"][0]["kind"] == "equipment"
    assert body["vet"] == []
    assert len(body["transport"]) == 1
    assert body["transport"][0]["fare"] == 850


async def test_missing_vet_subcollection_returns_empty_list(client, user_store):
    token = seed_user(user_store)
    resp = await client.get("/v1/users/me/bookings", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["vet"] == []
    assert body["equipment"] == []
    assert body["transport"] == []


async def test_status_filter(client, user_store):
    token = seed_user(user_store)
    _equipment_booking(user_store)
    _transport_booking(user_store)
    resp = await client.get("/v1/users/me/bookings?status=requested", headers=auth(token))
    body = resp.json()
    assert body["equipment"] == []
    assert body["vet"] == []
    assert len(body["transport"]) == 1


async def test_sorted_by_date_desc(client, user_store):
    token = seed_user(user_store)
    _transport_booking(user_store, booking_id="trb_old", date="2026-09-10")
    _transport_booking(user_store, booking_id="trb_new", date="2026-09-25")
    resp = await client.get("/v1/users/me/bookings", headers=auth(token))
    dates = [b["date"] for b in resp.json()["transport"]]
    assert dates == ["2026-09-25", "2026-09-10"]


async def test_unauthenticated_401(client):
    resp = await client.get("/v1/users/me/bookings")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "MISSING_TOKEN"


async def test_kind_field_on_every_item(client, user_store):
    token = seed_user(user_store)
    _equipment_booking(user_store)
    _transport_booking(user_store)
    user_store["users/uid-1/vet_bookings/vb_1"] = {
        "id": "vb_1",
        "vetName": "Dr. Patil",
        "visitType": "farmVisit",
        "slot": "10:00 AM",
        "animalType": "cow",
        "status": "confirmed",
    }
    resp = await client.get("/v1/users/me/bookings", headers=auth(token))
    body = resp.json()
    assert {i["kind"] for i in body["equipment"]} == {"equipment"}
    assert {i["kind"] for i in body["vet"]} == {"vet"}
    assert {i["kind"] for i in body["transport"]} == {"transport"}


async def test_transport_source_uses_fare_field(client, user_store):
    token = seed_user(user_store)
    _transport_booking(user_store, fare=850)
    resp = await client.get("/v1/users/me/bookings", headers=auth(token))
    assert resp.json()["transport"][0]["fare"] == 850
