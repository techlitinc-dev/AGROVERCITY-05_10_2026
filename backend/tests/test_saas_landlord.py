from tests.test_diary import auth, seed_user

PLOT_1 = {
    "name": "Ganga Edge Farmland",
    "village": "Pimplas",
    "district": "Nashik",
    "areaAcres": 5.0,
    "gatNumber": "88/1A",
    "soilType": "Black Cotton",
}


async def test_landlord_analytics(client, user_store):
    token = seed_user(user_store, uid="landlord-1", active_profile="farm_landlord")
    # Add a plot
    resp = await client.post("/v1/land/plots", json=PLOT_1, headers=auth(token))
    assert resp.status_code == 201

    # Fetch analytics
    resp = await client.get("/v1/land/analytics", headers=auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert "totalPlots" in data
    assert data["totalPlots"] >= 1
    assert "totalAcreage" in data
    assert data["totalAcreage"] >= 5.0
    assert "occupancyRatePercent" in data


async def test_landlord_lease_request_counter_and_milestones(client, user_store):
    token = seed_user(user_store, uid="landlord-2", active_profile="farm_landlord")
    tenant_token = seed_user(user_store, uid="tenant-1", active_profile="farmer")

    # Landlord creates plot and publishes listing
    resp = await client.post("/v1/land/plots", json=PLOT_1, headers=auth(token))
    assert resp.status_code == 201
    plot_id = resp.json()["id"]

    listing_payload = {
        "plotId": plot_id,
        "village": PLOT_1["village"],
        "district": PLOT_1["district"],
        "lat": 20.0,
        "lng": 73.8,
        "areaAcres": PLOT_1["areaAcres"],
        "expectedRentRupees": 70000,
        "soilType": PLOT_1["soilType"],
        "waterSource": "Borewell",
    }
    resp = await client.post("/v1/land/listings", json=listing_payload, headers=auth(token))
    assert resp.status_code == 201
    listing_id = resp.json()["id"]

    # Tenant submits a lease request
    req_payload = {
        "listingId": listing_id,
        "proposedRentRupees": 65000,
        "durationMonths": 12,
        "intendedCrop": "Soybean",
        "startDate": "2026-11-01",
        "message": "Looking forward to leasing your fertile plot.",
    }
    resp = await client.post("/v1/land/lease-requests", json=req_payload, headers=auth(tenant_token))
    assert resp.status_code == 201
    request_id = resp.json()["id"]

    # Landlord counters the request
    counter_payload = {
        "counterRentRupees": 72000,
        "note": "Can do 72,000 including drip irrigation infrastructure access.",
    }
    resp = await client.post(f"/v1/land/lease-requests/{request_id}/counter", json=counter_payload, headers=auth(token))
    assert resp.status_code == 200
    updated_req = resp.json()
    assert updated_req["status"] == "countered"
    assert updated_req["counterRentRupees"] == 72000
    assert updated_req["negotiationRounds"] == 2

    # Landlord creates lease to verify milestones
    lease_payload = {
        "plotId": plot_id,
        "tenantName": "Ramesh Tenant",
        "tenantPhone": "+919811122233",
        "monthlyRentRupees": 6000,
        "startDate": "2026-11-01",
        "endDate": "2027-10-31",
    }
    resp = await client.post("/v1/land/leases", json=lease_payload, headers=auth(token))
    assert resp.status_code == 201
    lease_id = resp.json()["id"]

    # Milestone listing (initial 3-stage escrow milestones initialized)
    resp = await client.get(f"/v1/land/leases/{lease_id}/milestones", headers=auth(token))
    assert resp.status_code == 200
    milestones = resp.json().get("milestones", [])
    assert len(milestones) == 3
    assert milestones[0]["percentage"] == 30

    # Milestone completion update
    update_payload = {"milestoneIndex": 0, "status": "released", "notes": "Handover physical inspection verified."}
    resp = await client.post(f"/v1/land/leases/{lease_id}/milestones", json=update_payload, headers=auth(token))
    assert resp.status_code == 200
    updated_milestones = resp.json().get("milestones", [])
    assert updated_milestones[0]["status"] == "released"

