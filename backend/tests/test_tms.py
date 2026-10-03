from tests.test_transport import (
    _activate,
    _add_vehicle,
    _book,
    _other_transporter_token,
    _token,
    _verify_vehicle,
)
from tests.test_users import _auth


async def test_transporter_profile_get_and_update(client, user_store):
    token = await _token(client, profiles=["transport", "farmer"], primary="transport")
    await _activate(client, token, "transport")

    # Get default transporter profile
    resp = await client.get("/v1/transport/profile", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert "profile" in data
    assert "stats" in data
    assert data["stats"]["rating"] == 4.8

    # Update profile with comprehensive business fields
    update_payload = {
        "businessName": "जय किसान लॉजिस्टिक्स प्रा. लि.",
        "transporterType": "fleet_owner",
        "vehicleType": "Bolero Maxi",
        "rcNumber": "MH-15-TC-9999",
        "contactPhone": "+91 98220 12345",
        "gstin": "27AAAAA0000A1Z5",
        "panNumber": "ABCDE1234F",
        "transportLicense": "RTO-MH15-TR-2026-88",
        "operatingRoutes": ["पिंपलगाव ➔ नासिक", "निफाड ➔ मुंबई वाशी", "नासिक ➔ दिल्ली"],
        "operatingStates": ["महाराष्ट्र", "गुजरात", "दिल्ली"],
        "specializations": ["ताजी सब्जियां", "अनाज व दलहन", "कोल्ड चेन फल"],
        "fleetSize": 8,
        "experienceYears": 6,
        "emergencyAvailable": True,
        "settlementUpi": "kisanlogistics@upi",
    }
    resp = await client.put("/v1/transport/profile", json=update_payload, headers=_auth(token))
    assert resp.status_code == 200
    updated = resp.json()
    assert updated["businessName"] == "जय किसान लॉजिस्टिक्स प्रा. लि."
    assert updated["fleetSize"] == 8
    assert "27AAAAA0000A1Z5" in updated["gstin"]

    # Verify updated profile on next get
    resp2 = await client.get("/v1/transport/profile", headers=_auth(token))
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["profile"]["businessName"] == "जय किसान लॉजिस्टिक्स प्रा. लि."


async def test_load_board_bidding_and_acceptance(client, user_store):
    farmer_token = await _token(client, profiles=["farmer"], primary="farmer")
    trans_token = _other_transporter_token(user_store)

    # 1. Fetch pre-seeded open loads
    resp = await client.get("/v1/transport/loads", headers=_auth(trans_token))
    assert resp.status_code == 200
    loads_data = resp.json()
    assert loads_data["total"] >= 4
    load_id = loads_data["data"][0]["id"]

    # 2. Farmer posts a new load
    post_resp = await client.post(
        "/v1/transport/loads",
        json={
            "pickupLocation": "खेड, पुणे",
            "dropLocation": "गुलटेकडी मार्केट यार्ड, पुणे",
            "crop": "फूलगोभी (Cauliflower)",
            "quantityQuintals": 18.0,
            "packaging": "Plastic Crates",
            "perishable": True,
            "preferredVehicleType": "Tata Ace",
            "pickupDate": "2026-09-30",
            "targetFare": 2500,
            "notes": "तुरंत लोडिंग आवश्यक",
        },
        headers=_auth(farmer_token),
    )
    assert post_resp.status_code == 201
    custom_load = post_resp.json()
    custom_load_id = custom_load["id"]

    # 3. Transporter registers vehicle & submits bid on the load
    veh = await _add_vehicle(client, trans_token, registrationNo="MH-12-PQ-4567")
    bid_resp = await client.post(
        f"/v1/transport/loads/{custom_load_id}/bid",
        json={
            "quotedFare": 2400,
            "vehicleId": veh["id"],
            "vehicleNo": "MH-12-PQ-4567",
            "estimatedPickupTime": "06:30 AM",
            "notes": "समय पर पिकअप और सुरक्षित डिलीवरी।",
        },
        headers=_auth(trans_token),
    )
    assert bid_resp.status_code == 201
    bid = bid_resp.json()
    assert bid["quotedFare"] == 2400

    # 4. View bids on load
    bids_resp = await client.get(f"/v1/transport/loads/{custom_load_id}/bids", headers=_auth(farmer_token))
    assert bids_resp.status_code == 200
    assert len(bids_resp.json()["data"]) == 1

    # 5. Farmer accepts the bid -> auto-creates booking in transport_bookings
    accept_resp = await client.post(
        f"/v1/transport/loads/{custom_load_id}/accept-bid?bidId={bid['id']}",
        headers=_auth(farmer_token),
    )
    assert accept_resp.status_code == 200
    result = accept_resp.json()
    assert result["load"]["status"] == "booked"
    assert result["booking"]["fare"] == 2400
    assert result["booking"]["status"] == "accepted"


async def test_live_gps_tracking_and_waypoint_logging(client, user_store):
    token = await _token(client, profiles=["farmer", "transport"], primary="farmer")
    b_resp = await _book(client, token)
    booking_id = b_resp.json()["id"]

    await _activate(client, token, "transport")
    veh = await _add_vehicle(client, token)
    _verify_vehicle(user_store, veh["id"])
    await client.post(
        f"/v1/transport/bookings/{booking_id}/accept",
        json={"vehicleId": veh["id"]},
        headers=_auth(token),
    )

    # Transporter updates GPS location with waypoint
    loc_resp = await client.post(
        f"/v1/transport/bookings/{booking_id}/location",
        json={
            "lat": 19.9975,
            "lng": 73.7898,
            "speedKmH": 52.5,
            "heading": 85.0,
            "waypoint": "in_transit",
            "waypointLabel": "हाईवे पार कर रहा है",
            "notes": "ट्रैफिक सामान्य है",
        },
        headers=_auth(token),
    )
    assert loc_resp.status_code == 200
    loc_data = loc_resp.json()["location"]
    assert loc_data["lat"] == 19.9975
    assert loc_data["speedKmH"] == 52.5

    # Viewer queries live location
    track_resp = await client.get(f"/v1/transport/bookings/{booking_id}/location", headers=_auth(token))
    assert track_resp.status_code == 200
    tracking = track_resp.json()
    assert tracking["currentLocation"]["lat"] == 19.9975
    assert len(tracking["waypoints"]) >= 2  # accepted + in_transit


async def test_digital_bilty_and_weighbridge_slip(client, user_store):
    token = await _token(client, profiles=["farmer", "transport"], primary="farmer")
    b_resp = await _book(client, token, commodity="टमाटर (Tomato)", weightQuintals=32.5)
    booking_id = b_resp.json()["id"]

    await _activate(client, token, "transport")
    veh = await _add_vehicle(client, token)
    _verify_vehicle(user_store, veh["id"])
    await client.post(
        f"/v1/transport/bookings/{booking_id}/accept",
        json={"vehicleId": veh["id"]},
        headers=_auth(token),
    )

    # Record Dharam Kanta Weighbridge slip
    wb_resp = await client.post(
        f"/v1/transport/bookings/{booking_id}/weighbridge",
        json={
            "slipNo": "DK-NASHIK-9921",
            "weighbridgeName": "जय बजरंग धर्मकांटा",
            "tareWeightKg": 1400.0,
            "grossWeightKg": 4650.0,
            "notes": "कांटा शुद्ध वजन 32.5 क्विंटल",
        },
        headers=_auth(token),
    )
    assert wb_resp.status_code == 200
    wb_data = wb_resp.json()
    assert wb_data["netWeightKg"] == 3250.0
    assert wb_data["slipNo"] == "DK-NASHIK-9921"

    # Generate Digital Bilty / LR
    bilty_resp = await client.get(f"/v1/transport/bookings/{booking_id}/bilty", headers=_auth(token))
    assert bilty_resp.status_code == 200
    bilty = bilty_resp.json()
    assert "lrNumber" in bilty
    assert bilty["weighbridgeSlip"]["netWeightKg"] == 3250.0
    assert "qrVerificationCode" in bilty


async def test_trip_expenses_and_analytics(client, user_store):
    token = await _token(client, profiles=["farmer", "transport"], primary="farmer")
    b_resp = await _book(client, token)
    booking_id = b_resp.json()["id"]

    await _activate(client, token, "transport")
    veh = await _add_vehicle(client, token)
    _verify_vehicle(user_store, veh["id"])
    await client.post(
        f"/v1/transport/bookings/{booking_id}/accept",
        json={"vehicleId": veh["id"]},
        headers=_auth(token),
    )

    # 1. Log Diesel Expense
    e1_resp = await client.post(
        f"/v1/transport/bookings/{booking_id}/expenses",
        json={"category": "diesel", "amount": 450.0, "notes": "एचपी पेट्रोल पंप, 5 लीटर"},
        headers=_auth(token),
    )
    assert e1_resp.status_code == 201

    # 2. Log Toll Expense
    e2_resp = await client.post(
        f"/v1/transport/bookings/{booking_id}/expenses",
        json={"category": "toll", "amount": 85.0, "notes": "फास्टैग टोल प्लाजा"},
        headers=_auth(token),
    )
    assert e2_resp.status_code == 201

    # 3. Query Trip Expenses & Net Profit
    exp_summary = await client.get(f"/v1/transport/bookings/{booking_id}/expenses", headers=_auth(token))
    assert exp_summary.status_code == 200
    data = exp_summary.json()
    assert data["totalExpenses"] == 535.0
    assert len(data["expenses"]) == 2
    assert data["netProfit"] < data["grossFare"]

    # 4. Check TMS Analytics
    analytics_resp = await client.get("/v1/transport/analytics", headers=_auth(token))
    assert analytics_resp.status_code == 200
    an_data = analytics_resp.json()
    assert "totalVehicles" in an_data
    assert "averageRating" in an_data
