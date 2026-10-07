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
        "totalCostPaisa": 17000000,
        "subsidyAmountPaisa": 9350000,
        "farmerSharePaisa": 7650000,
    }


async def test_pmksy_from_cost_paisa(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/water/pmksy-calculator", json={"costPaisa": 1000000}, headers=auth(token)
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["totalCostPaisa"] == 1000000
    assert body["subsidyAmountPaisa"] == 550000
    assert body["farmerSharePaisa"] == 450000


async def test_pmksy_requires_input(client, user_store):
    token = seed_user(user_store)
    resp = await client.post("/v1/water/pmksy-calculator", json={}, headers=auth(token))
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


def _weather_with_rain(rain_today: int):
    async def _fake_fetch(lat, lng):
        return {
            "tempC": 31,
            "rainProbability": rain_today,
            "condition": "Partly Cloudy",
            "radarAvailable": True,
            "forecast": [
                {"day": "Today", "tempC": 31, "rainProbability": rain_today},
                {"day": "Tomorrow", "tempC": 30, "rainProbability": rain_today},
            ],
        }

    return _fake_fetch


async def test_schedule_emits_irrigation_task_when_clear(client, user_store, monkeypatch):
    monkeypatch.setattr("app.routers.water.fetch_weather", _weather_with_rain(10))
    token = seed_user(user_store, activeCrops=["Wheat"], irrigationType="drip")
    resp = await client.get("/v1/water/schedule?lat=20&lng=74", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"][0]["skipToday"] is False
    tasks = [d for key, d in user_store.items() if key.startswith("tasks/")]
    assert len(tasks) == 1
    assert tasks[0]["kind"] == "irrigation"
    assert tasks[0]["module"] == "water"
    assert tasks[0]["deepLink"] == "/dashboard/p/water"


async def test_schedule_rain_forecast_suppresses_task(client, user_store, monkeypatch):
    monkeypatch.setattr("app.routers.water.fetch_weather", _weather_with_rain(80))
    token = seed_user(user_store, activeCrops=["Wheat", "Onion"], irrigationType="drip")
    resp = await client.get("/v1/water/schedule?lat=20&lng=74", headers=auth(token))
    assert resp.status_code == 200
    assert all(item["skipToday"] for item in resp.json()["data"])
    tasks = [d for key, d in user_store.items() if key.startswith("tasks/")]
    assert len(tasks) == 2
    assert all(t["kind"] == "irrigation_skip" for t in tasks)
    assert all("rain" in t["subtitle"].lower() for t in tasks)
