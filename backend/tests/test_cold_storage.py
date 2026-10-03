from datetime import date, timedelta

from tests.test_diary import auth, seed_user

FUTURE_DATE = (date.today() + timedelta(days=7)).isoformat()
PAST_DATE = (date.today() - timedelta(days=1)).isoformat()


async def _book(client, token, facility_id, quantity, from_date=None, months=2):
    return await client.post(
        f"/v1/post-harvest/cold-storage/{facility_id}/book",
        json={
            "quantityQuintals": quantity,
            "fromDate": from_date or FUTURE_DATE,
            "months": months,
        },
        headers=auth(token),
    )


async def test_book_decrements_capacity(client, user_store):
    token = seed_user(user_store)
    resp = await _book(client, token, "cs-1", 20)
    assert resp.status_code == 201
    assert resp.json()["status"] == "booked"
    assert resp.json()["facilityName"] == "Nashik Cold Chain Pvt Ltd"
    resp = await client.get("/v1/post-harvest/cold-storage", headers=auth(token))
    cs1 = next(i for i in resp.json()["data"] if i["id"] == "cs-1")
    assert cs1["availableMT"] == 48.0


async def test_insufficient_capacity_409(client, user_store):
    token = seed_user(user_store)
    resp = await _book(client, token, "cs-1", 600)
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "INSUFFICIENT_CAPACITY"


async def test_unknown_facility_404(client, user_store):
    token = seed_user(user_store)
    resp = await _book(client, token, "cs-999", 20)
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "STORAGE_NOT_FOUND"


async def test_past_date_422(client, user_store):
    token = seed_user(user_store)
    resp = await _book(client, token, "cs-1", 20, from_date=PAST_DATE)
    assert resp.status_code == 422


async def test_booking_in_my_bookings(client, user_store):
    token = seed_user(user_store)
    resp = await _book(client, token, "cs-1", 20)
    assert resp.status_code == 201
    resp = await client.get("/v1/users/me/bookings", headers=auth(token))
    assert resp.status_code == 200
    cold_storage = resp.json()["coldStorage"]
    assert len(cold_storage) == 1
    assert cold_storage[0]["kind"] == "coldStorage"
    assert cold_storage[0]["facilityId"] == "cs-1"
    assert cold_storage[0]["quantityQuintals"] == 20
