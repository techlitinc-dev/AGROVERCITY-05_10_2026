from tests.test_diary import ENTRY, auth, seed_user

DIARY_PATH = "/v1/diary/entries"


def op(key, path, body, method="POST"):
    return {
        "idempotencyKey": key,
        "method": method,
        "path": path,
        "body": body,
        "queuedAt": "2026-09-17T08:00:00Z",
    }


def seed_equipment_with_two_bookings(user_store, date="2026-09-20"):
    user_store["equipment/eq-1"] = {
        "id": "eq-1",
        "name": "Tractor",
        "ownerType": "fpo",
        "active": True,
        "docStatus": "verified",
    }
    for i in range(3):
        user_store[f"equipment_slots/eq-1_{date}_{i}"] = {
            "id": f"eq-1_{date}_{i}",
            "equipmentId": "eq-1",
            "date": date,
            "slotIndex": i,
            "slotName": "6:00 AM – 10:00 AM",
            "duration": "4 hours",
            "status": "available",
            "bookedByName": None,
            "priceRupees": 800,
            "recommendedTask": "Ploughing",
        }
    for i in range(2):
        user_store[f"equipment_bookings/eqb_{i}"] = {
            "id": f"eqb_{i}",
            "userId": "uid-1",
            "farmerName": "Ram Patil",
            "slotId": f"eq-1_{date}_{i}",
            "equipmentId": "eq-1",
            "date": date,
            "slotName": "6:00 AM – 10:00 AM",
            "priceRupees": 800,
            "ownerType": "fpo",
            "status": "booked",
        }


async def test_replay_two_diary_ops(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/sync",
        json={
            "operations": [
                op("k1", DIARY_PATH, ENTRY),
                op("k2", DIARY_PATH, {**ENTRY, "title": "Sold wheat", "type": "income", "amount": 5000}),
            ]
        },
        headers=auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["applied"] == 2
    assert all(r["status"] == "applied" for r in body["results"])
    resp = await client.get("/v1/diary/entries", headers=auth(token))
    assert resp.json()["total"] == 2


async def test_replay_is_idempotent(client, user_store):
    token = seed_user(user_store)
    batch = {"operations": [op("k1", DIARY_PATH, ENTRY), op("k2", DIARY_PATH, ENTRY)]}
    resp = await client.post("/v1/sync", json=batch, headers=auth(token))
    assert resp.status_code == 200
    resp = await client.post("/v1/sync", json=batch, headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["duplicates"] == 2
    assert all(r["status"] == "duplicate" for r in body["results"])
    resp = await client.get("/v1/diary/entries", headers=auth(token))
    assert resp.json()["total"] == 2


async def test_unknown_path_per_op_error(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/sync",
        json={"operations": [op("k1", "/v1/whatever", {}), op("k2", DIARY_PATH, ENTRY)]},
        headers=auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["errors"] == 1
    assert body["applied"] == 1
    assert body["results"][0]["status"] == "error"
    assert body["results"][0]["error"]["code"] == "UNSUPPORTED_PATH"


async def test_over_50_ops_422(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/sync",
        json={"operations": [op(f"k{i}", DIARY_PATH, ENTRY) for i in range(51)]},
        headers=auth(token),
    )
    assert resp.status_code == 422


async def test_conflicting_booking_op_409_in_batch(client, user_store):
    token = seed_user(user_store)
    seed_equipment_with_two_bookings(user_store)
    resp = await client.post(
        "/v1/sync",
        json={
            "operations": [
                op("k1", "/v1/equipment/slots/eq-1_2026-09-20_2/book", {"farmerName": "Ram Patil"}),
                op("k2", DIARY_PATH, ENTRY),
            ]
        },
        headers=auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["errors"] == 1
    assert body["applied"] == 1
    booking_result = body["results"][0]
    assert booking_result["status"] == "error"
    assert booking_result["httpStatus"] == 409
    assert booking_result["error"]["code"] == "MAX_SLOTS_PER_DAY"
    assert body["results"][1]["status"] == "applied"


POLICY = {
    "id": "pol-1",
    "policyNumber": "PMFBY-2026-0001",
    "schemeName": "PMFBY",
    "cropName": "Wheat",
    "season": "Kharif",
    "year": 2026,
    "landAreaAcres": 2.0,
    "sumInsured": 80000,
    "farmerPremium": 1600.0,
    "govtSubsidy": 8400.0,
    "status": "active",
    "insuranceCompany": "AIC of India",
    "coverageStartDate": "2026-07-01",
    "coverageEndDate": "2026-12-31",
    "bankName": "SBI",
    "kccAccountNo": "XXXX4521",
    "certificateUrl": None,
}

CLAIM_BODY = {
    "policyId": "pol-1",
    "cropName": "Wheat",
    "calamityType": "hailstorm",
    "dateOfDamage": "2026-09-10",
    "cropStage": "flowering",
    "estimatedLossPercent": 40,
    "gpsCoordinates": "20.0,73.8",
    "village": "Ozarkhed",
    "damagePhotos": ["https://storage.example.com/scans/p1.png"],
}


async def test_replay_strips_server_owned_fields(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/sync",
        json={"operations": [op("k1", DIARY_PATH, {**ENTRY, "agriCoinsEarned": 9999})]},
        headers=auth(token),
    )
    assert resp.status_code == 200
    result = resp.json()["results"][0]
    assert result["status"] == "applied"
    assert result["result"]["agriCoinsEarned"] == 15
    assert user_store["users/uid-1"]["agriCoins"] == 15


async def test_claim_replay_ignores_status_field(client, user_store):
    token = seed_user(user_store, state="Maharashtra", district="Nashik")
    user_store["users/uid-1/insurance_policies/pol-1"] = dict(POLICY)
    resp = await client.post(
        "/v1/sync",
        json={
            "operations": [
                op("k1", "/v1/insurance/claims", {**CLAIM_BODY, "status": "disbursed"})
            ]
        },
        headers=auth(token),
    )
    assert resp.status_code == 200
    result = resp.json()["results"][0]
    assert result["status"] == "applied"
    assert result["result"]["status"] == "intimated"
