from tests.test_diary import auth, seed_user


async def test_shg_seeds_defaults_on_first_read(client, user_store):
    token = seed_user(user_store)
    resp = await client.get("/v1/women/shg", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["memberCount"] == 12
    assert body["corpus"] == 48500
    assert body["loanFund"] == 30000
    assert body["monthlyDeposit"] == 500


async def test_deposit_updates_corpus(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/women/shg/deposit",
        json={"amount": 500, "month": "2026-09"},
        headers=auth(token),
    )
    assert resp.status_code == 201
    assert resp.json()["newCorpus"] == 49000


async def test_duplicate_deposit_month_409(client, user_store):
    token = seed_user(user_store)
    payload = {"amount": 500, "month": "2026-09"}
    resp = await client.post("/v1/women/shg/deposit", json=payload, headers=auth(token))
    assert resp.status_code == 201
    resp = await client.post("/v1/women/shg/deposit", json=payload, headers=auth(token))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "DUPLICATE_DEPOSIT_MONTH"


async def test_home_enterprise_total(client, user_store):
    token = seed_user(user_store)
    resp = await client.get("/v1/women/home-enterprise", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["totalMonthlyProfit"] == 9800
    assert body["totalMonthlyProfit"] == sum(
        line["monthlyProfit"] for line in body["lines"]
    )


async def test_deposit_bad_month_format_422(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/women/shg/deposit",
        json={"amount": 500, "month": "Sep 2026"},
        headers=auth(token),
    )
    assert resp.status_code == 422


async def test_women_forbidden_for_seller(client, user_store):
    token = seed_user(user_store, active_profile="seller")
    resp = await client.get("/v1/women/shg", headers=auth(token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"


async def test_garden_plans_shape_for_any_user(client, user_store):
    token = seed_user(user_store)
    resp = await client.get("/v1/women/garden-plans", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body["data"], list)
    assert len(body["data"]) == 3
    categories = [plan["category"] for plan in body["data"]]
    assert categories == ["Leafy Greens", "Vegetables", "Trees/Perennials"]
    for plan in body["data"]:
        assert plan["id"]
        assert 3 <= len(plan["items"]) <= 4
        for item in plan["items"]:
            assert set(item.keys()) == {
                "name", "vernacularName", "nutrition", "companion", "daysToHarvest",
            }
            assert isinstance(item["daysToHarvest"], int)
    names = [i["name"] for p in body["data"] for i in p["items"]]
    assert "Spinach" in names and "Tomato" in names and "Drumstick" in names


async def test_backyard_livestock_shape_for_any_user(client, user_store):
    token = seed_user(user_store, active_profile="seller")
    resp = await client.get("/v1/women/backyard-livestock", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body["data"], list)
    assert len(body["data"]) >= 3
    animals = [row["animal"] for row in body["data"]]
    assert "Cow" in animals and "Hen" in animals and "Goat" in animals
    for row in body["data"]:
        assert set(row.keys()) == {
            "id", "animal", "vernacularName", "count", "yieldLabel", "vaccine", "vaccineDue",
        }
        assert isinstance(row["count"], int)
        assert "dueInDays" not in row
        date_part = row["vaccineDue"]
        assert len(date_part) == 10 and date_part[4] == "-" and date_part[7] == "-"


async def test_garden_plans_requires_auth(client):
    resp = await client.get("/v1/women/garden-plans")
    assert resp.status_code == 401
    resp = await client.get("/v1/women/backyard-livestock")
    assert resp.status_code == 401
