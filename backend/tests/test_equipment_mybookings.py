"""SR 27 — renter-side equipment bookings + search/filter on the fleet list."""
from tests.test_diary import auth, seed_user
from tests.test_equipment import EQ_1, EQ_2


def seed_fleet(user_store):
    user_store["equipment/eq-1"] = dict(EQ_1)
    user_store["equipment/eq-2"] = dict(EQ_2)


def seed_booking(user_store, booking_id, uid="uid-1", equipment_id="eq-1", status="booked", created_at="2026-10-10T10:00:00+00:00"):
    user_store[f"equipment_bookings/{booking_id}"] = {
        "id": booking_id,
        "userId": uid,
        "farmerName": "Ram Patil",
        "slotId": f"{equipment_id}_2026-10-12_0",
        "equipmentId": equipment_id,
        "date": "2026-10-12",
        "slotName": "6:00 AM – 10:00 AM",
        "priceRupees": 800,
        "ownerType": "fpo",
        "status": status,
        "createdAt": created_at,
    }


async def test_my_bookings_sorted_desc_with_machine_snapshot(client, user_store):
    token = seed_user(user_store)
    seed_fleet(user_store)
    user_store["users/owner-demo"] = {"id": "owner-demo", "name": "Kadam Sahib", "activeProfile": "equipmentRental"}
    seed_booking(user_store, "eqb-old", created_at="2026-10-01T09:00:00+00:00")
    seed_booking(user_store, "eqb-new", equipment_id="eq-2", status="completed", created_at="2026-10-15T09:00:00+00:00")
    # someone else's booking must not leak in
    seed_booking(user_store, "eqb-other", uid="uid-2", created_at="2026-10-16T09:00:00+00:00")

    resp = await client.get("/v1/equipment/my-bookings", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["page"] == 1
    assert body["total"] == 2
    rows = body["data"]
    assert [r["id"] for r in rows] == ["eqb-new", "eqb-old"]
    assert rows[0]["machineName"] == EQ_2["name"]
    assert rows[0]["machineType"] == EQ_2["type"]
    assert rows[0]["ownerId"] == "owner-demo"
    assert rows[0]["ownerName"] == "Kadam Sahib"
    assert rows[0]["status"] == "completed"
    assert rows[0]["priceRupees"] == 800
    assert rows[0]["date"] == "2026-10-12"


async def test_my_bookings_empty(client, user_store):
    token = seed_user(user_store)
    resp = await client.get("/v1/equipment/my-bookings", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json() == {"data": [], "page": 1, "pageSize": 0, "total": 0}


async def test_my_bookings_requires_farmer_role(client, user_store):
    token = seed_user(user_store, active_profile="instructor")
    resp = await client.get("/v1/equipment/my-bookings", headers=auth(token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"


async def test_list_q_filter_matches_name_and_type_case_insensitive(client, user_store):
    token = seed_user(user_store)
    seed_fleet(user_store)
    resp = await client.get("/v1/equipment", params={"q": "mahindra"}, headers=auth(token))
    assert resp.status_code == 200
    ids = [d["id"] for d in resp.json()["data"]]
    assert ids == ["eq-1"]

    resp = await client.get("/v1/equipment", params={"q": "ROTA"}, headers=auth(token))
    assert [d["id"] for d in resp.json()["data"]] == ["eq-2"]


async def test_list_q_and_type_compose(client, user_store):
    token = seed_user(user_store)
    seed_fleet(user_store)
    # name matches but type filter excludes it
    resp = await client.get("/v1/equipment", params={"q": "mahindra", "type": "rotavator"}, headers=auth(token))
    assert resp.json()["data"] == []
    resp = await client.get("/v1/equipment", params={"q": "mahindra", "type": "tractor"}, headers=auth(token))
    assert [d["id"] for d in resp.json()["data"]] == ["eq-1"]
    # type filter alone still works
    resp = await client.get("/v1/equipment", params={"type": "rotavator"}, headers=auth(token))
    assert [d["id"] for d in resp.json()["data"]] == ["eq-2"]


async def test_completed_equipment_booking_rateable(client, user_store):
    """SR 5: a completed equipment booking (owner-logged) can be rated."""
    token = seed_user(user_store)
    seed_fleet(user_store)
    seed_booking(user_store, "eqb-done", status="completed")
    resp = await client.post(
        "/v1/ratings",
        json={"bookingKind": "equipment", "bookingId": "eqb-done", "stars": 5},
        headers=auth(token),
    )
    assert resp.status_code == 201
    assert resp.json()["providerId"] == "eq-1"


async def test_pending_equipment_booking_not_rateable(client, user_store):
    token = seed_user(user_store)
    seed_fleet(user_store)
    seed_booking(user_store, "eqb-pend", status="pending")
    resp = await client.post(
        "/v1/ratings",
        json={"bookingKind": "equipment", "bookingId": "eqb-pend", "stars": 5},
        headers=auth(token),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "NOT_COMPLETED"
