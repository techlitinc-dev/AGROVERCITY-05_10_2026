from tests.test_diary import auth, seed_user


async def test_dairy_manager_analytics_demands_and_bids(client, user_store):
    manager_token = seed_user(user_store, uid="dairy-mgr-1", active_profile="dairyManager")

    # Analytics check
    resp = await client.get("/v1/dairy-manager/analytics", headers=auth(manager_token))
    assert resp.status_code == 200
    analytics = resp.json()
    assert "todayCollectionLiters" in analytics
    assert "sevenDayTrend" in analytics

    # List & create demand
    resp = await client.get("/v1/dairy-manager/demands", headers=auth(manager_token))
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1

    demand_payload = {
        "milkType": "Cow",
        "minFatPercent": 4.0,
        "minSnfPercent": 8.5,
        "dailyQuantityLiters": 450.0,
        "targetRatePerLiter": 41.5,
        "recurringFrequency": "Daily",
        "procurementZone": "Dindori Valley",
        "notes": "Chilled collection point at Agro Center.",
    }
    resp = await client.post("/v1/dairy-manager/demands", json=demand_payload, headers=auth(manager_token))
    assert resp.status_code == 201
    assert resp.json()["milkType"] == "Cow"

    # List bids & counter negotiation
    resp = await client.get("/v1/dairy-manager/bids", headers=auth(manager_token))
    assert resp.status_code == 200
    bids = resp.json()["data"]
    assert len(bids) >= 1
    bid_id = bids[0]["id"]

    counter_payload = {
        "counterRatePerLiter": 67.0,
        "terms": "Agreed if delivered to central chilling bulk vat by 07:00 AM.",
    }
    resp = await client.post(f"/v1/dairy-manager/bids/{bid_id}/counter", json=counter_payload, headers=auth(manager_token))
    assert resp.status_code == 200
    assert resp.json()["status"] == "countered"
    assert resp.json()["offeredRatePerLiter"] == 67.0
    assert resp.json()["negotiationRound"] == 2


async def test_dairy_manager_routes_collection_and_ratechart(client, user_store):
    manager_token = seed_user(user_store, uid="dairy-mgr-2", active_profile="dairyManager")

    # Routes listing & creation
    resp = await client.get("/v1/dairy-manager/routes", headers=auth(manager_token))
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1

    route_payload = {
        "routeName": "Evening Route Beta (Sinnar East)",
        "assignedAgentName": "Ramesh Dhangar",
        "scheduledDate": "2026-10-15",
        "stops": [
            {
                "farmerId": "f_11",
                "farmerName": "Suresh Shinde",
                "locationPin": "Sinnar Milk Cooperative Point",
                "expectedLiters": 60,
                "pickupWindow": "05:30 PM",
                "sequence": 1,
            }
        ],
    }
    resp = await client.post("/v1/dairy-manager/routes", json=route_payload, headers=auth(manager_token))
    assert resp.status_code == 201
    assert resp.json()["routeName"] == "Evening Route Beta (Sinnar East)"

    # Quality FAT/SNF farmgate collection check
    collection_payload = {
        "farmerId": "farmer_88",
        "farmerName": "Pandurang Patil",
        "milkType": "Buffalo",
        "quantityLiters": 40.0,
        "fatPercent": 6.8,
        "snfPercent": 9.2,
        "ratePerLiter": 66.5,
        "qualityStatus": "accepted",
        "farmerOtpVerified": True,
        "notes": "Lactometer & ultrasonic analyzer verified.",
    }
    resp = await client.post("/v1/dairy-manager/collection-check", json=collection_payload, headers=auth(manager_token))
    assert resp.status_code == 201
    col = resp.json()
    assert col["fatPercent"] == 6.8
    assert col["totalAmountRupees"] == round(40.0 * 66.5, 2)

    # Milk slips generation
    resp = await client.get("/v1/dairy-manager/milk-slips", headers=auth(manager_token))
    assert resp.status_code == 200
    slips = resp.json()["data"]
    assert len(slips) >= 1
    assert slips[0]["payoutStatus"] == "settled"

    # Rate chart retrieval & update
    resp = await client.get("/v1/dairy-manager/rate-chart")
    assert resp.status_code == 200
    assert "baseBuffaloRate" in resp.json()

    rate_update = {
        "baseCowRate": 39.0,
        "baseBuffaloRate": 65.5,
        "fatStepRupees": 0.45,
        "snfStepRupees": 0.35,
    }
    resp = await client.put("/v1/dairy-manager/rate-chart", json=rate_update, headers=auth(manager_token))
    assert resp.status_code == 200
    assert resp.json()["baseCowRate"] == 39.0
    assert resp.json()["baseBuffaloRate"] == 65.5
