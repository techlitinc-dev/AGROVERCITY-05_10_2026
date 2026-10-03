from datetime import date, timedelta
import pytest
from tests.test_diary import auth, seed_user

FUTURE_DATE = (date.today() + timedelta(days=5)).isoformat()


def seed_provider_user(user_store):
    return seed_user(
        user_store,
        uid="dev-user-coldstorage-1",
        active_profile="coldStorageProvider",
    )


@pytest.mark.asyncio
async def test_apply_cold_storage_enriched(client, user_store):
    farmer_token = seed_user(user_store)
    resp = await client.post(
        "/v1/post-harvest/cold-storage/cs-1/apply",
        json={
            "cropName": "Nashik Red Onion",
            "variety": "Garwa Onion",
            "quantityQuintals": 30.0,
            "fromDate": FUTURE_DATE,
            "months": 3,
            "packagingType": "Mesh Bags",
            "bagsCount": 60,
            "notes": "Grade 1 quality onion from Pimpalgaon farm",
            "estimatedValueRupees": 75000.0,
        },
        headers=auth(farmer_token),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "pending"
    assert data["cropName"] == "Nashik Red Onion"
    assert data["quantityQuintals"] == 30.0
    assert data["totalEstimatedRent"] == 30.0 * 3 * 12.0
    assert len(data["timeline"]) == 1


@pytest.mark.asyncio
async def test_provider_role_guard(client, user_store):
    farmer_token = seed_user(user_store)
    resp = await client.get("/v1/post-harvest/provider/stats", headers=auth(farmer_token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_COLD_STORAGE"


@pytest.mark.asyncio
async def test_provider_review_approve_and_reject(client, user_store):
    farmer_token = seed_user(user_store)
    provider_token = seed_provider_user(user_store)

    # 1. Farmer applies
    resp = await client.post(
        "/v1/post-harvest/cold-storage/cs-1/apply",
        json={
            "cropName": "Potato (Kufri Pukhraj)",
            "quantityQuintals": 25.0,
            "fromDate": FUTURE_DATE,
            "months": 4,
        },
        headers=auth(farmer_token),
    )
    assert resp.status_code == 201
    booking_id = resp.json()["id"]

    # 2. Provider lists bookings
    resp = await client.get("/v1/post-harvest/provider/bookings?status=pending", headers=auth(provider_token))
    assert resp.status_code == 200
    assert any(b["id"] == booking_id for b in resp.json()["data"])

    # 3. Provider approves booking
    resp = await client.post(
        f"/v1/post-harvest/provider/bookings/{booking_id}/review",
        json={
            "action": "approve",
            "allocatedChamberId": "ch-101",
            "notes": "Chamber A reserved. Suitable temperature 2-4°C.",
        },
        headers=auth(provider_token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "approved"
    assert resp.json()["allocatedChamberId"] == "ch-101"

    # 4. Another application to test rejection & capacity restore
    resp = await client.post(
        "/v1/post-harvest/cold-storage/cs-1/apply",
        json={
            "cropName": "Garlic",
            "quantityQuintals": 10.0,
            "fromDate": FUTURE_DATE,
            "months": 2,
        },
        headers=auth(farmer_token),
    )
    rej_booking_id = resp.json()["id"]

    resp = await client.post(
        f"/v1/post-harvest/provider/bookings/{rej_booking_id}/review",
        json={
            "action": "reject",
            "rejectionReason": "Chamber undergoing scheduled maintenance.",
        },
        headers=auth(provider_token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "rejected"
    assert resp.json()["rejectionReason"] == "Chamber undergoing scheduled maintenance."


@pytest.mark.asyncio
async def test_full_inward_enwr_and_outward_release_flow(client, user_store):
    farmer_token = seed_user(user_store)
    provider_token = seed_provider_user(user_store)

    # 1. Farmer applies
    resp = await client.post(
        "/v1/post-harvest/cold-storage/cs-1/apply",
        json={
            "cropName": "Pomegranate (Bhagwa)",
            "quantityQuintals": 40.0,
            "fromDate": FUTURE_DATE,
            "months": 2,
        },
        headers=auth(farmer_token),
    )
    assert resp.status_code == 201
    booking_id = resp.json()["id"]

    # 2. Provider approves
    await client.post(
        f"/v1/post-harvest/provider/bookings/{booking_id}/review",
        json={"action": "approve", "allocatedChamberId": "ch-102"},
        headers=auth(provider_token),
    )

    # 3. Produce arrives at gate: Provider records Gate Inward & issues e-NWR
    resp = await client.post(
        f"/v1/post-harvest/provider/bookings/{booking_id}/inward",
        json={
            "chamberId": "ch-102",
            "grossWeightKg": 4120.0,
            "tareWeightKg": 120.0,
            "netQuintals": 40.0,
            "actualBags": 80,
            "moisturePercent": 11.5,
            "qcGrade": "Grade A Premium",
            "valuationRupees": 180000.0,
        },
        headers=auth(provider_token),
    )
    assert resp.status_code == 200
    inward_data = resp.json()
    assert inward_data["booking"]["status"] == "inwarded"
    assert inward_data["booking"]["qcGrade"] == "Grade A Premium"
    receipt_no = inward_data["booking"]["receiptNumber"]
    assert receipt_no.startswith("NWR-")

    # 4. Fetch the generated e-NWR warehouse receipt
    resp = await client.get(f"/v1/post-harvest/receipts/{receipt_no}", headers=auth(farmer_token))
    assert resp.status_code == 200
    receipt = resp.json()
    assert receipt["receiptNumber"] == receipt_no
    assert receipt["netQuintals"] == 40.0
    assert receipt["cropName"] == "Pomegranate (Bhagwa)"
    assert receipt["pledgeFinancingEligible"] is True

    # 5. Farmer requests partial release of 15 quintals
    resp = await client.post(
        f"/v1/post-harvest/bookings/{booking_id}/request-release",
        json={
            "requestedQuintals": 15.0,
            "pickupDate": FUTURE_DATE,
            "vehicleNumber": "MH-15-EG-4488",
            "notes": "Dispatching to Vashi APMC market",
        },
        headers=auth(farmer_token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "release_requested"

    # 6. Provider processes outward dispatch and issues Gate Pass
    resp = await client.post(
        f"/v1/post-harvest/provider/bookings/{booking_id}/release",
        json={
            "releaseQuintals": 15.0,
            "vehicleNumber": "MH-15-EG-4488",
            "driverName": "Datta Shinde",
            "gatePassRemarks": "Produce inspected and loaded cleanly",
            "amountPaid": 360.0,
        },
        headers=auth(provider_token),
    )
    assert resp.status_code == 200
    rel_data = resp.json()
    assert rel_data["remainingQuintals"] == 25.0
    assert rel_data["gatePassNumber"].startswith("GP-")
    assert rel_data["booking"]["status"] == "partially_released"


@pytest.mark.asyncio
async def test_provider_stats_and_facilities(client, user_store):
    provider_token = seed_provider_user(user_store)

    resp = await client.get("/v1/post-harvest/provider/stats", headers=auth(provider_token))
    assert resp.status_code == 200
    stats = resp.json()
    assert stats["totalCapacityMT"] > 0
    assert "occupancyPercent" in stats
    assert "totalValuationStored" in stats

    resp = await client.get("/v1/post-harvest/provider/facilities", headers=auth(provider_token))
    assert resp.status_code == 200
    facilities = resp.json()["data"]
    assert len(facilities) >= 4
    assert any(f["id"] == "cs-1" for f in facilities)


@pytest.mark.asyncio
async def test_provider_create_multiple_facilities_and_chambers(client, user_store):
    provider_token = seed_provider_user(user_store)
    farmer_token = seed_user(user_store)

    # 1. Provider creates a new Godown with capacity
    create_resp = await client.post(
        "/v1/post-harvest/provider/facilities",
        json={
            "name": "Niphad Grain & Agro Mega Godown",
            "facilityType": "dry_godown",
            "capacityMT": 120.0,
            "ratePerQuintalMonth": 14.0,
            "district": "Nashik",
            "address": "Gat No 45, Niphad APMC Road",
            "wdraRegistered": True,
            "supportedCrops": ["Wheat", "Paddy", "Maize", "Soybean"],
            "chambers": [
                {
                    "name": "Silo Block 1",
                    "chamberType": "dry_godown",
                    "capacityMT": 60.0,
                    "tempRange": "Ambient",
                },
                {
                    "name": "Silo Block 2",
                    "chamberType": "dry_godown",
                    "capacityMT": 60.0,
                    "tempRange": "Ambient",
                },
            ],
        },
        headers=auth(provider_token),
    )
    assert create_resp.status_code == 201
    new_facility = create_resp.json()
    new_fac_id = new_facility["id"]
    assert new_fac_id.startswith("cs-")
    assert new_facility["name"] == "Niphad Grain & Agro Mega Godown"
    assert new_facility["facilityType"] == "dry_godown"
    assert new_facility["totalCapacityMT"] == 120.0
    assert len(new_facility["chambers"]) == 2

    # 2. Provider adds a new chamber to this godown
    chamber_resp = await client.post(
        f"/v1/post-harvest/provider/facilities/{new_fac_id}/chambers",
        json={
            "name": "Air-Cooled Chamber 3 (Pulses & Seeds)",
            "chamberType": "cold_storage",
            "capacityMT": 40.0,
            "tempRange": "12-15°C",
        },
        headers=auth(provider_token),
    )
    assert chamber_resp.status_code == 201
    ch_data = chamber_resp.json()
    assert ch_data["chamber"]["name"] == "Air-Cooled Chamber 3 (Pulses & Seeds)"
    assert ch_data["facility"]["totalCapacityMT"] == 160.0
    assert len(ch_data["facility"]["chambers"]) == 3

    # 3. Farmer can see the newly added godown in marketplace
    farmer_fac_resp = await client.get("/v1/post-harvest/cold-storage", headers=auth(farmer_token))
    assert farmer_fac_resp.status_code == 200
    all_facs = farmer_fac_resp.json()["data"]
    matched = [f for f in all_facs if f["id"] == new_fac_id]
    assert len(matched) == 1
    assert matched[0]["name"] == "Niphad Grain & Agro Mega Godown"
    assert matched[0]["availableMT"] == 160.0

    # 4. Provider lists facilities and sees the new facility
    provider_fac_resp = await client.get("/v1/post-harvest/provider/facilities", headers=auth(provider_token))
    assert provider_fac_resp.status_code == 200
    prov_facs = provider_fac_resp.json()["data"]
    assert any(f["id"] == new_fac_id for f in prov_facs)
