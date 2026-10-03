from datetime import datetime, timezone

from tests.test_diary import auth, seed_user

MGR = {"uid": "mgr-1", "active_profile": "dairyManager"}
FARMER = {"uid": "farmer-1", "active_profile": "farmer"}
FARMER_2 = {"uid": "farmer-2", "active_profile": "farmer"}

MONTH = datetime.now(timezone.utc).strftime("%Y-%m")
DAY_1, DAY_2 = f"{MONTH}-02", f"{MONTH}-15"

MEMBER_A = {
    "name": "रामसिंग पाटील",
    "phone": "+919999999999",
    "village": "पिंपळगाव",
    "farmerUid": "farmer-1",
    "memberCode": "F-042",
    "deduction": 50.0,
}
MEMBER_B = {**MEMBER_A, "name": "तुकाराम जाधव", "farmerUid": "", "memberCode": "F-018", "deduction": 0.0}

CHART = {
    "species": "cow",
    "effectiveFrom": "2026-09-01",
    "baseRate": 35.0,
    "fatBase": 3.5,
    "snfBase": 8.5,
    "fatStep": 4.0,
    "snfStep": 2.5,
    "minRate": 28.0,
    "active": True,
}

GAUSHALA = {"name": "Shrimant Panchvati Desi Gaushala", "trustName": "Panchvati Trust", "capacity": 100}


def _collection(member_id, date, liters, code="F-042", name="रामसिंग पाटील", shift="morning"):
    return {
        "farmerName": name,
        "farmerCode": code,
        "farmerId": "farmer-1",
        "date": date,
        "shift": shift,
        "milkType": "cow",
        "liters": liters,
        "fatPercent": 4.0,
        "snfPercent": 9.0,
        "memberId": member_id,
    }


async def _post(client, url, token, payload, expected=201):
    resp = await client.post(url, json=payload, headers=auth(token))
    assert resp.status_code == expected, resp.text
    return resp.json()


async def _seed_center(client, user_store):
    token = seed_user(user_store, **MGR)
    await _post(client, "/v1/livestock/dairy/rate-chart", token, CHART)
    member_a = await _post(client, "/v1/livestock/dairy/members", token, MEMBER_A)
    member_b = await _post(client, "/v1/livestock/dairy/members", token, MEMBER_B)
    return token, member_a, member_b


async def test_dairy_analytics_full_picture(client, user_store):
    token, member_a, member_b = await _seed_center(client, user_store)
    await _post(client, "/v1/livestock/procurement/collections", token, _collection(member_a["id"], DAY_1, 10.0))
    await _post(client, "/v1/livestock/procurement/collections", token, _collection(member_b["id"], DAY_2, 6.0, code="F-018", name="तुकाराम जाधव"))
    await _post(client, "/v1/livestock/procurement/collections", token, _collection(member_a["id"], DAY_2, 4.0, shift="evening"))

    customer = await _post(client, "/v1/livestock/dairy/sales/customers", token, {
        "name": "Hotel A", "phone": "+919822334455", "type": "hotel", "ratePerLiter": 70.0,
    })
    await _post(client, "/v1/livestock/dairy/sales/orders", token, {
        "customerId": customer["id"], "orderDate": DAY_1, "shift": "am", "liters": 5.0,
    })

    # pending dues via an un-paid batch
    await _post(client, "/v1/livestock/dairy/payments/batches", token, {
        "periodFrom": f"{MONTH}-01", "periodTo": f"{MONTH}-28",
    })

    resp = await client.get(f"/v1/livestock/dairy/analytics?month={MONTH}", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["month"] == MONTH
    cols = body["collections"]
    assert cols["liters"] == 20.0
    assert cols["count"] == 3
    assert len(cols["daily"]) == 2
    assert cols["bySpecies"]["cow"]["liters"] == 20.0
    assert cols["byShift"]["morning"]["liters"] == 16.0
    assert cols["byShift"]["evening"]["liters"] == 4.0
    assert [m["memberId"] for m in cols["topMembers"]] == [member_a["id"], member_b["id"]]
    assert cols["topMembers"][0]["liters"] == 14.0
    assert cols["topMembers"][0]["name"] == "रामसिंग पाटील"

    assert body["sales"]["liters"] == 5.0
    assert body["sales"]["byStatus"]["scheduled"] == 1
    # 20L @38.25 = 765 gross − 50 deduction (member A only) = 715 pending
    assert body["dues"]["pendingNet"] == 715.0
    assert body["dues"]["pendingEntries"] == 2
    assert body["previousMonth"]["collections"]["liters"] == 0.0


async def test_dairy_analytics_forbidden_for_farmer(client, user_store):
    token = seed_user(user_store, **FARMER)
    resp = await client.get("/v1/livestock/dairy/analytics", headers=auth(token))
    assert resp.status_code == 403


async def test_farmer_analytics_with_and_without_membership(client, user_store):
    token, member_a, _ = await _seed_center(client, user_store)
    farmer_token = seed_user(user_store, **FARMER)
    await _post(client, "/v1/livestock/procurement/collections", token, _collection(member_a["id"], DAY_1, 10.0))
    batch = await _post(client, "/v1/livestock/dairy/payments/batches", token, {
        "periodFrom": f"{MONTH}-01", "periodTo": f"{MONTH}-28",
    })
    await client.post(
        f"/v1/livestock/dairy/payments/batches/{batch['id']}/mark-paid",
        json={"payoutRef": "UTR-1"}, headers=auth(token),
    )

    resp = await client.get("/v1/livestock/dairy/farmer/analytics", headers=auth(farmer_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["member"]["memberCode"] == "F-042"
    assert len(body["monthly"]) == 6
    current = body["monthly"][-1]
    assert current["month"] == MONTH
    assert current["liters"] == 10.0
    assert current["paid"] == 332.5  # 10L @38.25 = 382.5 − 50 deduction
    assert body["totals"]["pending"] == 0.0

    lone_token = seed_user(user_store, **FARMER_2)
    resp = await client.get("/v1/livestock/dairy/farmer/analytics", headers=auth(lone_token))
    body = resp.json()
    assert body["member"] is None
    assert body["monthly"] == []
    assert body["totals"]["liters"] == 0.0


async def test_gaushala_analytics_receipts_and_cattle_intake(client, user_store):
    token = seed_user(user_store, **MGR)
    gaushala = await _post(client, "/v1/livestock/gaushala/profile", token, GAUSHALA)

    animal = await _post(client, "/v1/livestock/animals", token, {
        "tagId": "G-001", "name": "Ganga", "species": "cow", "breed": "Gir",
        "gender": "female", "ageMonths": 48, "gaushalaId": gaushala["id"],
    })
    assert animal["cattleStatus"] == "in-shelter"
    assert animal["events"][0]["type"] == "intake"

    await _post(client, "/v1/livestock/gaushala/expenses", token, {
        "category": "fodder", "amount": 1000.0, "expenseDate": DAY_1,
    })
    await _post(client, "/v1/livestock/gaushala/expenses", token, {
        "category": "medical", "amount": 500.0, "expenseDate": DAY_2, "note": "deworming",
    })
    await _post(client, "/v1/livestock/gaushala/donations", token, {
        "gaushalaId": gaushala["id"], "donorName": "Suresh Donor", "donorPhone": "+919811122233",
        "donationType": "cash_seva", "amountInr": 2500,
    })
    adoption = await _post(client, "/v1/livestock/gaushala/adoptions", token, {
        "gaushalaId": gaushala["id"], "cowTagId": "G-001", "cowName": "Ganga",
        "donorName": "Meena Donor", "donorPhone": "+919811122233",
        "tier": "gau_gras", "amountInr": 2100, "billingCycle": "monthly",
    })
    resp = await client.put(
        f"/v1/livestock/gaushala/adoptions/{adoption['id']}/status",
        json={"status": "approved"}, headers=auth(token),
    )
    assert resp.status_code == 200
    receipt = resp.json()["receipt"]
    assert receipt["eightyGEligible"] is True

    resp = await client.get(f"/v1/livestock/gaushala/analytics?month={MONTH}", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    current = body["monthly"][-1]
    assert current["month"] == MONTH
    assert current["expenses"] == 1500.0
    assert current["donations"] == 2500.0
    assert current["adoptions"] == 1
    assert current["intakes"] == 1
    assert body["expenseByCategory"] == {"fodder": 1000.0, "medical": 500.0}
    assert body["cattleByStatus"]["in-shelter"] == 1

    resp = await client.get("/v1/livestock/gaushala/receipts", headers=auth(token))
    receipts = resp.json()
    assert receipts["total"] == 1
    assert receipts["data"][0]["certificateNumber"].startswith("GOSH-")
    assert receipts["data"][0]["kind"] == "adoption"

    resp = await client.get("/v1/livestock/gaushala/cattle", headers=auth(token))
    assert resp.json()["total"] == 1


async def test_gaushala_cattle_intake_rejects_foreign_gaushala(client, user_store):
    token = seed_user(user_store, **MGR)
    resp = await client.post("/v1/livestock/animals", json={
        "tagId": "G-002", "name": "Yamuna", "species": "cow", "breed": "Sahiwal",
        "gender": "female", "ageMonths": 30, "gaushalaId": "gau-someone-else",
    }, headers=auth(token))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "GAUSHALA_NOT_FOUND"


async def test_gaushala_analytics_requires_profile(client, user_store):
    token = seed_user(user_store, **MGR)
    resp = await client.get("/v1/livestock/gaushala/analytics", headers=auth(token))
    assert resp.status_code == 404
    resp = await client.get("/v1/livestock/gaushala/receipts", headers=auth(token))
    assert resp.status_code == 404
