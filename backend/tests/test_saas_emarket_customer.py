from tests.test_diary import auth, seed_user


async def test_customer_analytics_and_demands(client, user_store):
    customer_token = seed_user(user_store, uid="cust-1", active_profile="customer")

    # Analytics check
    resp = await client.get("/v1/customer/analytics", headers=auth(customer_token))
    assert resp.status_code == 200
    analytics = resp.json()
    assert "totalSpendRupees" in analytics
    assert "monthlySpendTrend" in analytics

    # Create standing demand
    demand_data = {
        "crop": "Organic Sharbati Wheat",
        "variety": "Sharbati",
        "grade": "Grade A",
        "quantityQuintals": 120.0,
        "targetMinPrice": 3100,
        "targetMaxPrice": 3350,
        "recurringFrequency": "Weekly",
        "deliveryWindow": "3 Days",
        "district": "Nashik",
        "notes": "Moisture content < 11% strictly required.",
    }
    resp = await client.post("/v1/customer/demands", json=demand_data, headers=auth(customer_token))
    assert resp.status_code == 201
    demand = resp.json()
    assert demand["crop"] == "Organic Sharbati Wheat"
    demand_id = demand["id"]

    # List demands
    resp = await client.get("/v1/customer/demands", headers=auth(customer_token))
    assert resp.status_code == 200
    demands_list = resp.json()
    assert demands_list["total"] >= 1


async def test_customer_quotes_orders_and_inspection(client, user_store):
    customer_token = seed_user(user_store, uid="cust-2", active_profile="customer")

    # Submit binding quote
    quote_data = {
        "crop": "Yellow Soybean",
        "offeredPricePerQuintal": 4500,
        "quantityQuintals": 80,
        "deliveryMode": "warehouse_delivery",
        "notes": "Payment via AgroVercity Escrow on delivery.",
    }
    resp = await client.post("/v1/customer/quotes", json=quote_data, headers=auth(customer_token))
    assert resp.status_code == 201
    quote = resp.json()
    assert quote["offeredPricePerQuintal"] == 4500
    quote_id = quote["id"]

    # Counter quote
    counter_data = {
        "counterPricePerQuintal": 4580,
        "reason": "Includes freight allowance for direct delivery.",
    }
    resp = await client.post(f"/v1/customer/quotes/{quote_id}/counter", json=counter_data, headers=auth(customer_token))
    assert resp.status_code == 200
    countered = resp.json()
    assert countered["status"] == "countered"
    assert countered["offeredPricePerQuintal"] == 4580
    assert countered["negotiationRound"] == 2

    # Get customer orders (auto-seeds initial order if none)
    resp = await client.get("/v1/customer/orders", headers=auth(customer_token))
    assert resp.status_code == 200
    orders = resp.json()["data"]
    assert len(orders) >= 1
    order_id = orders[0]["id"]

    # Perform digital delivery inspection with 5% damage deduction
    inspection_data = {
        "quantityReceivedQuintals": 50.0,
        "gradeMatch": True,
        "damagePercent": 5.0,
        "action": "accept",
        "notes": "Minor transit bag tears; 5% weight deduction applied.",
    }
    resp = await client.post(f"/v1/customer/orders/{order_id}/inspection", json=inspection_data, headers=auth(customer_token))
    assert resp.status_code == 200
    inspected_order = resp.json()
    assert inspected_order["status"] == "delivered"
    assert inspected_order["escrowStatus"] == "released"
    assert inspected_order["inspection"]["damagePercent"] == 5.0

    # Verify QR custody handover
    resp = await client.post(f"/v1/customer/orders/{order_id}/qr-handover", headers=auth(customer_token))
    assert resp.status_code == 200
    qr_res = resp.json()
    assert qr_res["status"] == "custody_transferred"

    # Verify procurement planner & favorite suppliers
    resp = await client.get("/v1/customer/planner", headers=auth(customer_token))
    assert resp.status_code == 200
    assert "recommendedCommodities" in resp.json()

    resp = await client.get("/v1/customer/suppliers/favorites", headers=auth(customer_token))
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1
