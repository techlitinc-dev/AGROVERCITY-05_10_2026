from app.data.women_seed import GARDEN_PLAN_TEMPLATES, HOME_ENTERPRISES

from tests.test_diary import auth, seed_user


def _seed_shg_group(user_store, uid="uid-1", group_id="shg_test"):
    user_store[f"shg_groups/{group_id}"] = {
        "id": group_id,
        "name": "Jai Kisan Mahila Bachat Gat",
        "memberUid": uid,
        "memberCount": 12,
        "corpusPaisa": 4_850_000,
        "loanFundPaisa": 3_000_000,
        "monthlyDepositPaisa": 50_000,
        "members": [{"memberUid": uid, "role": "member"}],
    }
    return group_id


def _seed_garden_catalog(user_store):
    for plan in GARDEN_PLAN_TEMPLATES:
        user_store[f"garden_plans/{plan['id']}"] = dict(plan)


async def test_shg_reads_real_group_collection(client, user_store):
    token = seed_user(user_store)
    _seed_shg_group(user_store)
    resp = await client.get("/v1/women/shg", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["group"]["memberCount"] == 12
    assert body["group"]["corpusPaisa"] == 4_850_000
    assert body["group"]["loanFundPaisa"] == 3_000_000
    assert body["group"]["monthlyDepositPaisa"] == 50_000
    assert body["deposits"] == []
    assert body["meetings"] == []


async def test_shg_without_group_returns_empty_state(client, user_store):
    token = seed_user(user_store)
    resp = await client.get("/v1/women/shg", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json() == {"group": None, "deposits": [], "meetings": [], "readiness": None}


async def test_deposit_updates_corpus(client, user_store):
    token = seed_user(user_store)
    _seed_shg_group(user_store)
    resp = await client.post(
        "/v1/women/shg/deposit",
        json={"amountPaisa": 50_000, "month": "2026-09"},
        headers=auth(token),
    )
    assert resp.status_code == 201
    assert resp.json()["newCorpusPaisa"] == 4_900_000
    deposit = user_store["shg_groups/shg_test/deposits/2026-09"]
    assert deposit["amountPaisa"] == 50_000


async def test_duplicate_deposit_month_409(client, user_store):
    token = seed_user(user_store)
    _seed_shg_group(user_store)
    payload = {"amountPaisa": 50_000, "month": "2026-09"}
    resp = await client.post("/v1/women/shg/deposit", json=payload, headers=auth(token))
    assert resp.status_code == 201
    resp = await client.post("/v1/women/shg/deposit", json=payload, headers=auth(token))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "DUPLICATE_DEPOSIT_MONTH"


async def test_meeting_workflow_attendance_and_collections(client, user_store):
    token = seed_user(user_store)
    _seed_shg_group(user_store)
    created = await client.post(
        "/v1/women/shg/meetings",
        json={"date": "2026-10-05", "agenda": "Monthly collection"},
        headers=auth(token),
    )
    assert created.status_code == 201
    meeting_id = created.json()["id"]

    attendance = await client.post(
        f"/v1/women/shg/meetings/{meeting_id}/attendance",
        json={"memberUid": "uid-1", "present": True},
        headers=auth(token),
    )
    assert attendance.status_code == 200
    assert attendance.json()["attendance"][0]["present"] is True

    collection = await client.post(
        f"/v1/women/shg/meetings/{meeting_id}/collections",
        json={"memberUid": "uid-1", "amountPaisa": 50_000},
        headers=auth(token),
    )
    assert collection.status_code == 201
    assert collection.json()["newCorpusPaisa"] == 4_900_000

    meetings = await client.get("/v1/women/shg/meetings", headers=auth(token))
    assert len(meetings.json()["data"]) == 1


async def test_home_enterprise_total(client, user_store):
    token = seed_user(user_store)
    for line in HOME_ENTERPRISES:
        user_store[f"home_enterprises/{line['id']}"] = {**line, "ownerUid": "uid-1"}
    resp = await client.get("/v1/women/home-enterprise", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["totalMonthlyProfitPaisa"] == 980_000
    assert body["totalMonthlyProfitPaisa"] == sum(
        line["monthlyProfitPaisa"] for line in body["lines"]
    )


async def test_home_enterprise_listing_appears_in_marketplace(client, user_store):
    token = seed_user(user_store)
    payload = {
        "title": "A2 Ghee (500ml)",
        "category": "Dairy (डेयरी)",
        "vernacularTitle": "A2 घी",
        "mrp": 900,
        "discountedPrice": 799,
        "stock": 10,
        "unit": "500ml jar",
    }
    resp = await client.post(
        "/v1/women/home-enterprise/listings", json=payload, headers=auth(token)
    )
    assert resp.status_code == 201
    product_id = resp.json()["id"]
    assert resp.json()["sellerId"] == "uid-1"

    catalog = await client.get("/v1/products", headers=auth(token))
    assert catalog.status_code == 200
    assert product_id in {p["id"] for p in catalog.json()["data"]}


async def test_deposit_bad_month_format_422(client, user_store):
    token = seed_user(user_store)
    _seed_shg_group(user_store)
    resp = await client.post(
        "/v1/women/shg/deposit",
        json={"amountPaisa": 50_000, "month": "Sep 2026"},
        headers=auth(token),
    )
    assert resp.status_code == 422


async def test_women_shg_forbidden_for_seller(client, user_store):
    token = seed_user(user_store, active_profile="seller")
    resp = await client.get("/v1/women/shg", headers=auth(token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"


async def test_garden_plans_shape_for_any_user(client, user_store):
    token = seed_user(user_store)
    _seed_garden_catalog(user_store)
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


async def test_garden_plan_create_and_edit(client, user_store):
    token = seed_user(user_store)
    _seed_garden_catalog(user_store)
    created = await client.post(
        "/v1/women/garden-plans",
        json={
            "category": "My mix",
            "items": [{"name": "Spinach", "daysToHarvest": 40}],
        },
        headers=auth(token),
    )
    assert created.status_code == 201
    plan_id = created.json()["id"]
    assert created.json()["ownerUid"] == "uid-1"

    updated = await client.put(
        f"/v1/women/garden-plans/{plan_id}",
        json={"category": "My mix v2", "items": [{"name": "Tomato", "daysToHarvest": 90}]},
        headers=auth(token),
    )
    assert updated.status_code == 200
    assert updated.json()["category"] == "My mix v2"

    other = seed_user(user_store, uid="uid-2")
    forbidden = await client.put(
        f"/v1/women/garden-plans/{plan_id}",
        json={"category": "Nope", "items": []},
        headers=auth(other),
    )
    assert forbidden.status_code == 403


async def test_backyard_livestock_joins_herd_registry(client, user_store):
    token = seed_user(user_store)
    user_store["livestock_animals/c1"] = {
        "id": "c1",
        "tagId": "TAG-1",
        "name": "Ganga",
        "species": "Cow",
        "breed": "गाय",
        "ownerId": "uid-1",
        "dailyYieldLiters": 8.5,
        "healthStatus": "healthy",
    }
    user_store["vaccination_schedules/v1"] = {
        "id": "v1",
        "animalTagId": "TAG-1",
        "disease": "FMD",
        "nextDueDate": "2026-11-01",
    }
    resp = await client.get("/v1/women/backyard-livestock", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body["data"], list)
    assert len(body["data"]) == 1
    row = body["data"][0]
    assert row["animal"] == "Cow"
    assert row["vaccine"] == "FMD"
    assert row["vaccineDue"] == "2026-11-01"


async def test_women_routes_require_auth(client):
    resp = await client.get("/v1/women/garden-plans")
    assert resp.status_code == 401
    resp = await client.get("/v1/women/backyard-livestock")
    assert resp.status_code == 401
    resp = await client.get("/v1/women/shg")
    assert resp.status_code == 401
