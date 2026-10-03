from tests.test_diary import auth, seed_user

MGR_1 = {"uid": "mgr-1", "active_profile": "dairyManager"}
MGR_2 = {"uid": "mgr-2", "active_profile": "dairyManager"}
FARMER_1 = {"uid": "farmer-1", "active_profile": "farmer"}
FARMER_2 = {"uid": "farmer-2", "active_profile": "farmer"}

COW_CHART = {
    "species": "cow",
    "effectiveFrom": "2026-09-01",
    "baseRate": 35.0,
    "fatBase": 3.5,
    "snfBase": 8.5,
    "fatStep": 4.0,
    "snfStep": 2.5,
    "minRate": 28.0,
    "minFat": 3.0,
    "minSnf": 8.0,
    "active": True,
}

MEMBER_A = {
    "name": "रामसिंग पाटील",
    "phone": "+919999999999",
    "village": "पिंपळगाव",
    "farmerUid": "farmer-1",
    "memberCode": "F-042",
    "deduction": 50.0,
}


def _collection_payload(**overrides):
    payload = {
        "farmerName": MEMBER_A["name"],
        "farmerCode": MEMBER_A["memberCode"],
        "farmerId": "farmer-1",
        "date": "2026-10-02",
        "shift": "morning",
        "milkType": "cow",
        "liters": 10.0,
        "fatPercent": 4.0,
        "snfPercent": 9.0,
    }
    payload.update(overrides)
    return payload


async def _create_chart(client, token, payload=COW_CHART):
    resp = await client.post("/v1/livestock/dairy/rate-chart", json=payload, headers=auth(token))
    assert resp.status_code == 201
    return resp.json()


async def _record(client, token, payload):
    resp = await client.post("/v1/livestock/procurement/collections", json=payload, headers=auth(token))
    assert resp.status_code == 201
    return resp.json()


async def test_collection_rate_comes_from_active_chart(client, user_store):
    token = seed_user(user_store, **MGR_1)
    chart = await _create_chart(client, token)
    slip = await _record(client, token, _collection_payload(memberId="mem_x"))
    # 35 + (4.0-3.5)*4.0 + (9.0-8.5)*2.5 = 38.25
    assert slip["ratePerLiter"] == 38.25
    assert slip["totalAmount"] == 382.5
    assert slip["rateChartId"] == chart["id"]
    assert slip["dairyId"] == "mgr-1"


async def test_collection_below_min_grade_floors_to_min_rate(client, user_store):
    token = seed_user(user_store, **MGR_1)
    await _create_chart(client, token)
    slip = await _record(client, token, _collection_payload(fatPercent=2.5))
    assert slip["ratePerLiter"] == 28.0


async def test_collection_falls_back_to_platform_formula_without_chart(client, user_store):
    token = seed_user(user_store, **MGR_1)
    # platform formula for buffalo 7.0/9.5: 55 + (7.0-6.0)*4 + (9.5-8.5)*2.5 = 61.5
    slip = await _record(
        client, token, _collection_payload(milkType="buffalo", fatPercent=7.0, snfPercent=9.5)
    )
    assert slip["ratePerLiter"] == 61.5
    assert slip["rateChartId"] == ""


async def test_collection_list_and_summary_scoped_per_center(client, user_store):
    token_1 = seed_user(user_store, **MGR_1)
    token_2 = seed_user(user_store, **MGR_2)
    farmer_token = seed_user(user_store, **FARMER_1)
    await _record(client, token_1, _collection_payload(liters=10.0))
    await _record(client, token_2, _collection_payload(liters=99.0, farmerCode="X-1", farmerId=""))

    resp = await client.get("/v1/livestock/procurement/collections", headers=auth(token_1))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["data"][0]["liters"] == 10.0

    resp = await client.get("/v1/livestock/procurement/summary?date=2026-10-02", headers=auth(token_1))
    assert resp.json()["totalLiters"] == 10.0

    resp = await client.get("/v1/livestock/procurement/summary?date=2026-10-02", headers=auth(token_2))
    assert resp.json()["totalLiters"] == 99.0

    # farmer sees only own slips (farmerId == uid)
    resp = await client.get("/v1/livestock/procurement/collections", headers=auth(farmer_token))
    body = resp.json()
    assert body["total"] == 1
    assert body["data"][0]["farmerCode"] == "F-042"


async def test_farmer_rate_chart_prefers_own_center(client, user_store):
    token_1 = seed_user(user_store, **MGR_1)
    token_2 = seed_user(user_store, **MGR_2)
    farmer_token = seed_user(user_store, **FARMER_1)
    other_farmer_token = seed_user(user_store, **FARMER_2)
    await _create_chart(client, token_1)
    await _create_chart(client, token_2, {**COW_CHART, "baseRate": 40.0, "effectiveFrom": "2026-09-02"})

    resp = await client.post(
        "/v1/livestock/dairy/members", json=MEMBER_A, headers=auth(token_1)
    )
    assert resp.status_code == 201

    resp = await client.get("/v1/livestock/dairy/rate-chart?species=cow", headers=auth(farmer_token))
    assert resp.status_code == 200
    assert resp.json()["baseRate"] == 35.0
    assert resp.json()["centerId"] == "mgr-1"

    # farmer without membership gets the newest active chart (fallback, documented v1 behavior)
    resp = await client.get("/v1/livestock/dairy/rate-chart?species=cow", headers=auth(other_farmer_token))
    assert resp.status_code == 200
    assert resp.json()["baseRate"] == 40.0


async def test_full_center_day_payment_cycle(client, user_store):
    token = seed_user(user_store, **MGR_1)
    farmer_token = seed_user(user_store, **FARMER_1)
    await _create_chart(client, token)
    member = (
        await client.post("/v1/livestock/dairy/members", json=MEMBER_A, headers=auth(token))
    ).json()
    await _record(client, token, _collection_payload(memberId=member["id"], liters=10.0))
    await _record(
        client,
        token,
        _collection_payload(memberId=member["id"], liters=6.0, shift="evening", fatPercent=3.6, snfPercent=8.6),
    )

    resp = await client.post(
        "/v1/livestock/dairy/payments/batches",
        json={"periodFrom": "2026-10-01", "periodTo": "2026-10-31"},
        headers=auth(token),
    )
    assert resp.status_code == 201
    batch = resp.json()
    entry = batch["entries"][0]
    # 10L @38.25 + 6L @ (35+0.4+0.25=35.65 → 213.9) = 596.4 gross − 50 deduction
    assert entry["liters"] == 16.0
    assert entry["amount"] == 596.4
    assert entry["netAmount"] == 546.4

    resp = await client.post(
        f"/v1/livestock/dairy/payments/batches/{batch['id']}/mark-paid",
        json={"payoutRef": "UTR-TEST-1"},
        headers=auth(token),
    )
    assert resp.status_code == 200

    resp = await client.get("/v1/livestock/dairy/farmer/payments", headers=auth(farmer_token))
    payments = resp.json()
    assert payments["total"] == 1
    assert payments["data"][0]["netAmount"] == 546.4
    assert payments["data"][0]["status"] == "paid"
    assert payments["data"][0]["payoutRef"] == "UTR-TEST-1"

    resp = await client.get("/v1/livestock/dairy/farmer/slips", headers=auth(farmer_token))
    slips = resp.json()
    assert slips["total"] == 2
    assert slips["memberCode"] == "F-042"


async def test_accept_bid_creates_purchase(client, user_store):
    token = seed_user(user_store, **MGR_1)
    demand_resp = await client.post(
        "/v1/dairy-manager/demands",
        json={
            "milkType": "Buffalo",
            "minFatPercent": 6.0,
            "minSnfPercent": 9.0,
            "dailyQuantityLiters": 500.0,
            "targetRatePerLiter": 62.0,
        },
        headers=auth(token),
    )
    assert demand_resp.status_code == 201
    demand = demand_resp.json()

    bid_ids = []
    for farmer, name, rate in (("farmer-1", "Ramesh", 63.5), ("farmer-2", "Suresh", 64.25)):
        resp = await client.post(
            "/v1/dairy-manager/bids",
            json={
                "rfqId": demand["id"],
                "farmerId": farmer,
                "farmerName": name,
                "offeredRatePerLiter": rate,
                "dailyLiters": 200.0,
            },
            headers=auth(token),
        )
        assert resp.status_code == 201
        bid_ids.append(resp.json()["id"])

    accept = await client.post(
        f"/v1/dairy-manager/bids/{bid_ids[0]}/accept",
        headers={**auth(token), "Idempotency-Key": "dairy-accept-1"},
    )
    assert accept.status_code in (200, 201)
    body = accept.json()
    purchase = body["purchase"]
    assert purchase["source"]["type"] == "dairy"
    assert purchase["source"]["refId"] == demand["id"]
    assert purchase["farmerId"] == "farmer-1"
    assert purchase["agreedPricePerUnit"] == 6350
    assert isinstance(purchase["totalAmount"], int)
    assert purchase["totalAmount"] == 6350 * 200
    assert body["bid"]["status"] == "accepted"
    assert body["demand"]["status"] == "fulfilled"

    replay = await client.post(
        f"/v1/dairy-manager/bids/{bid_ids[0]}/accept",
        headers={**auth(token), "Idempotency-Key": "dairy-accept-1"},
    )
    assert replay.status_code == 200
    assert replay.json()["purchase"]["id"] == purchase["id"]


async def _make_dairy_pro(user_store, uid="mgr-1"):
    from app.services.billing import seed_plans

    await seed_plans()
    user_store["subscriptions/sub_pro_dairy"] = {
        "subId": "sub_pro_dairy",
        "userId": uid,
        "planId": "dairyManager_pro",
        "status": "active",
        "provider": "razorpay_sub",
        "providerRef": "sub_test_dairy",
        "currentPeriodEnd": "2027-01-01T00:00:00+00:00",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }


async def test_agent_records_collection_but_forbidden_writes(client, user_store):
    manager_token = seed_user(user_store, **MGR_1)
    agent_token = seed_user(user_store, uid="agent-1", active_profile="farmer")
    await _make_dairy_pro(user_store)

    created = await client.post(
        "/v1/livestock/dairy/agents",
        json={"uid": "agent-1", "name": "Ganesh Chavan", "routeIds": ["rt-1"]},
        headers={**auth(manager_token), "Idempotency-Key": "agent-create-1"},
    )
    assert created.status_code == 201
    assert created.json()["active"] is True

    listed = await client.get("/v1/livestock/dairy/agents", headers=auth(manager_token))
    assert listed.json()["total"] == 1

    collection = await client.post(
        "/v1/livestock/procurement/collections",
        json=_collection_payload(),
        headers=auth(agent_token),
    )
    assert collection.status_code == 201

    check = await client.post(
        "/v1/dairy-manager/collection-check",
        json={
            "farmerId": "farmer-1",
            "farmerName": "Ramesh",
            "milkType": "cow",
            "quantityLiters": 12.0,
            "fatPercent": 4.1,
            "snfPercent": 9.0,
            "ratePerLiter": 34.0,
        },
        headers=auth(agent_token),
    )
    assert check.status_code == 201

    chart = await client.post(
        "/v1/livestock/dairy/rate-chart", json=COW_CHART, headers=auth(agent_token)
    )
    assert chart.status_code == 403
    assert chart.json()["error"]["code"] == "AGENT_ROLE_FORBIDDEN"

    batch = await client.post(
        "/v1/livestock/dairy/payments/batches",
        json={"periodFrom": "2026-10-01", "periodTo": "2026-10-31"},
        headers=auth(agent_token),
    )
    assert batch.status_code == 403
    assert batch.json()["error"]["code"] == "AGENT_ROLE_FORBIDDEN"

    members = await client.get("/v1/livestock/dairy/members", headers=auth(agent_token))
    assert members.status_code in (200, 403)
    if members.status_code == 200:
        assert members.json()["total"] == 0

    deactivated = await client.delete("/v1/livestock/dairy/agents/agent-1", headers=auth(manager_token))
    assert deactivated.status_code == 200
    assert deactivated.json()["active"] is False


async def test_agent_seats_free_tier_blocked(client, user_store):
    manager_token = seed_user(user_store, **MGR_1)
    seed_user(user_store, uid="agent-1", active_profile="farmer")
    resp = await client.post(
        "/v1/livestock/dairy/agents",
        json={"uid": "agent-1", "name": "Ganesh Chavan"},
        headers=auth(manager_token),
    )
    assert resp.status_code == 402
    assert resp.json()["error"]["code"] == "ENTITLEMENT_EXCEEDED"
