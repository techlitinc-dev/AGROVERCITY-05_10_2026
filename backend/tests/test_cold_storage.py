import asyncio
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


async def test_receipt_endpoint_is_owner_only(client, user_store):
    """WS-05 task 5.16 — the e-NWR is visible to the depositor and the facility
    provider only; an unrelated authenticated farmer gets a 404 (no auth leak)."""
    from tests.test_cold_storage_provider import _make_coldstorage_pro, seed_provider_user

    farmer_token = seed_user(user_store)
    provider_token = seed_provider_user(user_store)
    _make_coldstorage_pro(user_store)
    other_token = seed_user(user_store, uid="uid-other-farmer")

    # Farmer applies at cs-1 (owned by dev-user-coldstorage-1).
    resp = await client.post(
        "/v1/post-harvest/cold-storage/cs-1/apply",
        json={"cropName": "Onion", "quantityQuintals": 10.0, "fromDate": FUTURE_DATE, "months": 2},
        headers=auth(farmer_token),
    )
    assert resp.status_code == 201
    booking_id = resp.json()["id"]

    resp = await client.post(
        f"/v1/post-harvest/provider/bookings/{booking_id}/review",
        json={"action": "approve", "allocatedChamberId": "ch-101"},
        headers=auth(provider_token),
    )
    assert resp.status_code == 200

    resp = await client.post(
        f"/v1/post-harvest/provider/bookings/{booking_id}/inward",
        json={
            "chamberId": "ch-101",
            "grossWeightKg": 1080.0,
            "tareWeightKg": 80.0,
            "netQuintals": 10.0,
            "actualBags": 20,
            "qcGrade": "Grade A",
        },
        headers=auth(provider_token),
    )
    assert resp.status_code == 200
    receipt_no = resp.json()["receipt"]["receiptNumber"]

    # Owning farmer can read it.
    owner = await client.get(f"/v1/post-harvest/receipts/{receipt_no}", headers=auth(farmer_token))
    assert owner.status_code == 200
    assert owner.json()["receiptNumber"] == receipt_no

    # The receipt's facility provider can read it.
    prov = await client.get(f"/v1/post-harvest/receipts/{receipt_no}", headers=auth(provider_token))
    assert prov.status_code == 200
    assert prov.json()["receiptNumber"] == receipt_no

    # An unrelated authenticated farmer gets a 404 — no existence disclosure.
    other = await client.get(f"/v1/post-harvest/receipts/{receipt_no}", headers=auth(other_token))
    assert other.status_code == 404
    assert other.json()["error"]["code"] == "RECEIPT_NOT_FOUND"


async def test_concurrent_bookings_never_oversell(client, user_store, monkeypatch):
    """F11 — capacity is reserved atomically: two bookings that together exceed
    the free space cannot both succeed. `get_doc` is made to yield so the two
    handlers interleave exactly where an unguarded read-check-write would race.
    """
    import app.routers.post_harvest as ph

    real_get = ph.get_doc

    async def yielding_get(collection, doc_id):
        await asyncio.sleep(0)
        return await real_get(collection, doc_id)

    monkeypatch.setattr(ph, "get_doc", yielding_get)
    token = seed_user(user_store)

    first, second = await asyncio.gather(
        _book(client, token, "cs-1", 300),
        _book(client, token, "cs-1", 300),
    )
    assert sorted([first.status_code, second.status_code]) == [201, 409]

    resp = await client.get("/v1/post-harvest/cold-storage", headers=auth(token))
    cs1 = next(i for i in resp.json()["data"] if i["id"] == "cs-1")
    assert cs1["bookedQuintals"] == 300
