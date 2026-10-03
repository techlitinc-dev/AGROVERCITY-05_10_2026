from tests.test_diary import auth, seed_user


async def test_schedule_one_entry_per_crop(client, user_store):
    token = seed_user(user_store, activeCrops=["Wheat", "Onion"], irrigationType="drip")
    resp = await client.get("/v1/water/schedule", headers=auth(token))
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 2
    assert {d["plotName"] for d in data} == {"Wheat", "Onion"}
    assert all(d["recommendedMinutes"] in (30, 90) for d in data)
    assert all(d["method"] == "drip" for d in data)
    resp2 = await client.get("/v1/water/schedule", headers=auth(token))
    assert resp.json() == resp2.json()


async def test_groundwater_requires_district(client, user_store):
    token = seed_user(user_store)
    resp = await client.get("/v1/water/groundwater", headers=auth(token))
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "MISSING_DISTRICT"


async def test_groundwater_nagpur_critical(client, user_store):
    token = seed_user(user_store)
    resp = await client.get("/v1/water/groundwater?district=Nagpur", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["zone"] == "critical"
    assert body["measuredAt"]


async def test_canal_rotation_filter(client, user_store):
    token = seed_user(user_store)
    resp = await client.get("/v1/water/canal-rotation?canal=gangapur", headers=auth(token))
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["canalName"] == "Gangapur Canal"
    assert data[0]["slotTime"] == "06:00-12:00"


async def test_pmksy_exact(client, user_store):
    token = seed_user(user_store)
    resp = await client.post("/v1/water/pmksy-calculator", json={"acres": 2}, headers=auth(token))
    assert resp.status_code == 200
    assert resp.json() == {
        "totalCost": 170000,
        "subsidyPercent": 55,
        "subsidyAmount": 93500.0,
        "farmerShare": 76500.0,
    }
