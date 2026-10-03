from tests.test_diary import auth, seed_user

EQUIPMENT_DATA = {
    "name": "Mahindra 575 DI Harvester",
    "type": "harvester",
    "hourlyRate": 1200,
    "perAcreRate": 1800,
    "slotTemplate": [
        {
            "slotName": "Morning Slot",
            "duration": "08:00 - 12:00",
            "priceRupees": 4800,
            "recommendedTask": "Harvesting",
        }
    ],
    "rcDocUrl": "https://agrovercity.com/docs/rc1.pdf",
    "insuranceDocUrl": "https://agrovercity.com/docs/ins1.pdf",
}


async def test_equipment_owner_analytics_and_claims(client, user_store):
    owner_token = seed_user(user_store, uid="eq-owner-1", active_profile="equipmentRental")

    # Add equipment
    resp = await client.post("/v1/equipment", json=EQUIPMENT_DATA, headers=auth(owner_token))
    assert resp.status_code == 201
    eq_id = resp.json()["id"]

    # Check analytics
    resp = await client.get("/v1/equipment/owner/analytics", headers=auth(owner_token))
    assert resp.status_code == 200
    analytics = resp.json()
    assert "fleetSize" in analytics
    assert analytics["fleetSize"] >= 1
    assert "utilizationTrend" in analytics

    # File damage claim
    claim_payload = {
        "equipmentId": eq_id,
        "bookingId": "booking_sample_123",
        "incidentDate": "2026-10-01",
        "description": "Cutter blade snapped on deep root obstacle during harvest.",
        "estimatedRepairCostRupees": 6500,
        "photoEvidenceUrls": ["https://agrovercity.com/photos/damage1.jpg"],
    }
    resp = await client.post("/v1/equipment/owner/damage-claims", json=claim_payload, headers=auth(owner_token))
    assert resp.status_code == 201
    claim = resp.json()
    assert claim["status"] == "under_review"
    assert claim["estimatedRepairCostRupees"] == 6500

    # List damage claims
    resp = await client.get("/v1/equipment/owner/damage-claims", headers=auth(owner_token))
    assert resp.status_code == 200
    claims_list = resp.json()
    assert claims_list["total"] >= 1


async def test_equipment_owner_counter_and_execution_checklist(client, user_store):
    owner_token = seed_user(user_store, uid="eq-owner-2", active_profile="equipmentRental")
    farmer_token = seed_user(user_store, uid="farmer-req-1", active_profile="farmer")

    # Add equipment
    resp = await client.post("/v1/equipment", json=EQUIPMENT_DATA, headers=auth(owner_token))
    assert resp.status_code == 201
    eq_id = resp.json()["id"]

    # Pre-seed a booking directly
    booking_id = "book_test_99"
    user_store[f"equipment_bookings/{booking_id}"] = {
        "id": booking_id,
        "equipmentId": eq_id,
        "farmerId": "farmer-req-1",
        "status": "pending",
        "date": "2026-10-15",
        "slotName": "Morning Slot",
        "priceRupees": 4800,
    }

    # Owner counters the booking
    counter_body = {
        "revisedRateRupees": 5400,
        "rateType": "per_acre",
        "reason": "Rough rocky terrain surcharge and diesel escalation.",
        "validityHours": 24,
    }
    resp = await client.post(f"/v1/equipment/bookings/{booking_id}/counter", json=counter_body, headers=auth(owner_token))
    assert resp.status_code == 200
    countered_booking = resp.json()
    assert countered_booking["status"] == "countered"
    assert countered_booking["counterRateRupees"] == 5400

    # Get execution checklist
    resp = await client.get(f"/v1/equipment/bookings/{booking_id}/execution", headers=auth(owner_token))
    assert resp.status_code == 200
    exec_doc = resp.json()
    assert exec_doc["bookingId"] == booking_id
    assert "checklist" in exec_doc

    # Dispatch operator and log work
    update_exec = {
        "jobStatus": "work_started",
        "notes": "Tractor on-site, begun northern boundary plowing.",
        "hoursLogged": 3.5,
        "acresCovered": 2.0,
    }
    resp = await client.post(f"/v1/equipment/bookings/{booking_id}/execution", json=update_exec, headers=auth(owner_token))
    assert resp.status_code == 200
    updated_exec = resp.json()
    assert updated_exec["jobStatus"] == "work_started"
    assert updated_exec["hoursLogged"] == 3.5
