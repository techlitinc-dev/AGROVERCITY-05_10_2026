from datetime import date, timedelta

import pytest

from tests.test_cold_storage_provider import _make_coldstorage_pro, seed_provider_user
from tests.test_diary import auth, seed_user

FUTURE_DATE = (date.today() + timedelta(days=6)).isoformat()


def _facility_body(name="StoreHouse Test Godown"):
    return {
        "name": name,
        "facilityType": "cold_storage",
        "capacityMT": 100.0,
        "ratePerQuintalMonth": 11.0,
        "district": "Nashik",
        "state": "Maharashtra",
        "wdraRegistered": True,
        "chambers": [
            {"name": "Chamber Alpha", "chamberType": "cold_storage", "capacityMT": 50.0, "tempRange": "2-4°C"},
            {"name": "Chamber Beta", "chamberType": "cold_storage", "capacityMT": 50.0, "tempRange": "8-12°C"},
        ],
    }


@pytest.mark.asyncio
async def test_storehouse_provider_and_farmer_flow(client, user_store):
    """WS-05 task 5.17: facility + 2 chambers → booking (capacity decrement) →
    approve → inward (lot/grade/photo) → request-release → release → stats
    update, fee ledgered, audit rows written."""
    farmer_token = seed_user(user_store)
    provider_token = seed_provider_user(user_store)
    _make_coldstorage_pro(user_store)

    # 1. Provider onboards a facility with 2 chambers.
    created = await client.post(
        "/v1/post-harvest/provider/facilities", json=_facility_body(), headers=auth(provider_token)
    )
    assert created.status_code == 201
    facility = created.json()
    facility_id = facility["id"]
    assert len(facility["chambers"]) == 2
    assert facility["totalCapacityMT"] == 100.0

    # 2. Farmer books storage — remaining capacity decrements server-side.
    booking = await client.post(
        f"/v1/post-harvest/cold-storage/{facility_id}/book",
        json={"quantityQuintals": 40.0, "fromDate": FUTURE_DATE, "months": 3},
        headers=auth(farmer_token),
    )
    assert booking.status_code == 201
    booking_id = booking.json()["id"]

    detail = await client.get(f"/v1/post-harvest/cold-storage/{facility_id}", headers=auth(farmer_token))
    assert detail.status_code == 200
    assert detail.json()["availableMT"] == 96.0

    # 3. Provider approves.
    approved = await client.post(
        f"/v1/post-harvest/provider/bookings/{booking_id}/review",
        json={"action": "approve", "allocatedChamberId": facility["chambers"][0]["id"]},
        headers=auth(provider_token),
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"

    # 4. Gate inward with lot, grade and a photo — e-NWR issued.
    photo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    inward = await client.post(
        f"/v1/post-harvest/provider/bookings/{booking_id}/inward",
        json={
            "chamberId": facility["chambers"][0]["id"],
            "lotNumber": "LOT-TEST-001",
            "grossWeightKg": 4120.0,
            "tareWeightKg": 120.0,
            "netQuintals": 40.0,
            "actualBags": 80,
            "moisturePercent": 11.5,
            "qcGrade": "Grade A Premium",
            "valuationRupees": 180000.0,
            "photo": photo,
        },
        headers=auth(provider_token),
    )
    assert inward.status_code == 200
    inward_body = inward.json()
    assert inward_body["booking"]["status"] == "inwarded"
    assert inward_body["booking"]["lotNumber"] == "LOT-TEST-001"
    assert inward_body["booking"]["qcGrade"] == "Grade A Premium"
    assert inward_body["booking"]["inwardPhoto"] == photo
    receipt_no = inward_body["receipt"]["receiptNumber"]
    assert receipt_no.startswith("NWR-")

    # Owner can fetch the receipt.
    receipt = await client.get(f"/v1/post-harvest/receipts/{receipt_no}", headers=auth(farmer_token))
    assert receipt.status_code == 200
    assert receipt.json()["netQuintals"] == 40.0

    # 5. Stats reflect occupancy + revenue while the lot is stored.
    stats_before = await client.get("/v1/post-harvest/provider/stats", headers=auth(provider_token))
    assert stats_before.status_code == 200
    before = stats_before.json()
    assert before["totalCapacityMT"] > 0
    assert before["occupancyPercent"] > 0
    assert before["totalAccruedRent"] > 0

    # 6. Farmer requests release, provider releases (partial).
    requested = await client.post(
        f"/v1/post-harvest/bookings/{booking_id}/request-release",
        json={"requestedQuintals": 15.0, "pickupDate": FUTURE_DATE, "vehicleNumber": "MH-15-EG-0001"},
        headers=auth(farmer_token),
    )
    assert requested.status_code == 200
    assert requested.json()["status"] == "release_requested"

    released = await client.post(
        f"/v1/post-harvest/provider/bookings/{booking_id}/release",
        json={"releaseQuintals": 15.0, "vehicleNumber": "MH-15-EG-0001", "gatePassRemarks": "Loaded cleanly"},
        headers=auth(provider_token),
    )
    assert released.status_code == 200
    release_body = released.json()
    assert release_body["remainingQuintals"] == 25.0
    assert release_body["booking"]["status"] == "partially_released"

    # 7. Utilization updates after the release frees capacity.
    stats_after = await client.get("/v1/post-harvest/provider/stats", headers=auth(provider_token))
    assert stats_after.status_code == 200
    assert stats_after.json()["occupancyPercent"] < before["occupancyPercent"]

    # 8. Per-booking platform fee ledgered on release (integer paisa).
    fee = user_store.get(f"platform_fees/csfee_{booking_id}")
    assert fee is not None
    assert fee["kind"] == "coldStorageBookingFee"
    assert fee["bookingId"] == booking_id
    assert fee["feePaisa"] == 5000
    assert isinstance(fee["feePaisa"], int)

    # 9. audit_logs rows with actor + reason for review and release.
    review_audits = [
        doc
        for key, doc in user_store.items()
        if key.startswith("audit_logs/aud_coldstorage_review_")
    ]
    release_audits = [
        doc
        for key, doc in user_store.items()
        if key.startswith("audit_logs/aud_coldstorage_release_")
    ]
    assert len(review_audits) == 1
    assert review_audits[0]["actor"] == "dev-user-coldstorage-1"
    assert review_audits[0]["action"] == "COLD_STORAGE_BOOKING_REVIEW"
    assert len(release_audits) == 1
    assert release_audits[0]["actor"] == "dev-user-coldstorage-1"
    assert release_audits[0]["reason"] == "Loaded cleanly"
    assert release_audits[0]["feePaisa"] == 5000


@pytest.mark.asyncio
async def test_free_tier_provider_blocked_from_console_writes(client, user_store):
    """WS-05 task 5.17: a Free (unsubscribed) provider is read-only — every
    console write returns the 402 entitlement envelope with the upgrade payload,
    while the farmer booking/receipt path carries no entitlement check."""
    provider_token = seed_provider_user(user_store)
    farmer_token = seed_user(user_store)

    # Reads work on Free.
    assert (
        await client.get("/v1/post-harvest/provider/facilities", headers=auth(provider_token))
    ).status_code == 200

    blocked = await client.post(
        "/v1/post-harvest/provider/facilities", json=_facility_body(), headers=auth(provider_token)
    )
    assert blocked.status_code == 402
    assert blocked.json()["error"]["code"] == "ENTITLEMENT_EXCEEDED"
    assert blocked.json()["error"]["planId"] == "coldStorageProvider_free"

    # Farmer booking on the seeded facility is never blocked by entitlement.
    booking = await client.post(
        "/v1/post-harvest/cold-storage/cs-1/book",
        json={"quantityQuintals": 5.0, "fromDate": FUTURE_DATE, "months": 1},
        headers=auth(farmer_token),
    )
    assert booking.status_code == 201
