"""Global search endpoint tests (phase-05 WS-09 task 9.5).

Seeds each of the six indexes in the in-memory store and exercises the grouped
response: all six group keys, matching groups containing the seeded docs,
independent per-group cursor pagination, the empty-query envelope error, and the
empty (no-hit) response.
"""

from tests.test_diary import auth, seed_user

GROUPS = ["schemes", "products", "news", "crops", "courses", "lots"]


def seed_search_store(user_store):
    # schemes — searchable on name / category / description.
    user_store["schemes/onion-support"] = {
        "id": "onion-support",
        "name": "Onion Price Support Scheme",
        "category": "market",
        "benefitAmount": "₹10,000",
        "nextDeadline": "2026-12-01",
        "description": "Support for onion (pyaz) growers",
    }
    user_store["schemes/wheat-support"] = {
        "id": "wheat-support",
        "name": "Wheat MSP Scheme",
        "category": "market",
        "benefitAmount": "₹5,000",
        "nextDeadline": "2026-12-01",
        "description": "Wheat procurement support",
    }
    # products — title / vernacularTitle / category / brand.
    user_store["products/prod-onion-seed"] = {
        "id": "prod-onion-seed",
        "title": "Onion Seeds (Abhinav)",
        "vernacularTitle": "प्याज बीज (pyaz beej)",
        "category": "Seeds",
        "brand": "Seminis",
        "mrp": 100,
        "discountedPrice": 90,
    }
    # news — title / vernacularTitle / summary / content / category.
    user_store["news/news-onion"] = {
        "id": "news-onion",
        "title": "Onion Export Floor Price Raised",
        "vernacularTitle": "प्याज निर्यात भाव वाढ",
        "summary": "pyaz export policy update",
        "content": "pyaz buffer procurement",
        "category": "market-policy",
        "timestamp": "2026-09-17T08:30:00Z",
    }
    # crops (reference) — name / vernacularName / aliases.
    user_store["crops/onion"] = {
        "id": "onion",
        "name": "Onion",
        "vernacularName": "प्याज (Pyaz)",
        "category": "vegetable",
        "aliases": ["pyaz", "kanda"],
    }
    user_store["crops/wheat"] = {
        "id": "wheat",
        "name": "Wheat",
        "vernacularName": "गेहूं (Gehu)",
        "category": "cereal",
    }
    # courses — published only; title / subtitle / description / instructor.
    user_store["courses/course-onion"] = {
        "id": "course-onion",
        "title": "Onion Farming Masterclass",
        "subtitle": "pyaz cultivation",
        "category": "agronomy",
        "instructorName": "Dr. Patil",
        "priceRupees": 499,
        "status": "published",
    }
    user_store["courses/course-draft"] = {
        "id": "course-draft",
        "title": "Onion Draft Course",
        "category": "agronomy",
        "priceRupees": 0,
        "status": "pendingReview",
    }
    # lots — crop / grade / variety / location (open only).
    user_store["market_lots/lot-onion-1"] = {
        "id": "lot-onion-1",
        "crop": "Onion (pyaz)",
        "grade": "A",
        "quantityQuintals": 10,
        "expectedRate": 2100,
        "harvestDate": "2026-10-01",
        "status": "open",
        "location": {"village": "Pimpalgaon", "district": "Nashik", "state": "Maharashtra"},
    }


async def test_search_returns_all_six_groups(client, user_store):
    seed_search_store(user_store)
    token = seed_user(user_store)

    resp = await client.get("/v1/search", params={"q": "pyaz"}, headers=auth(token))

    assert resp.status_code == 200
    body = resp.json()
    for group in GROUPS:
        assert group in body, f"missing group {group}"
        assert isinstance(body[group], list)
    assert set(body["nextCursor"].keys()) == set(GROUPS)


async def test_search_matches_lots_news_crops(client, user_store):
    seed_search_store(user_store)
    token = seed_user(user_store)

    resp = await client.get("/v1/search", params={"q": "pyaz"}, headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()

    assert [h["id"] for h in body["lots"]] == ["lot-onion-1"]
    assert [h["id"] for h in body["news"]] == ["news-onion"]
    assert [h["id"] for h in body["crops"]] == ["onion"]
    # Non-matching crops are excluded and the draft (unpublished) course is hidden.
    assert [h["id"] for h in body["products"]] == ["prod-onion-seed"]
    assert [h["id"] for h in body["courses"]] == ["course-onion"]
    assert [h["id"] for h in body["schemes"]] == ["onion-support"]
    # Hits carry a deep link into their module page.
    assert body["lots"][0]["deepLink"] == "/dashboard/p/browseLots/lot-onion-1"


async def test_search_paginates_group_independently(client, user_store):
    seed_search_store(user_store)
    # 25 matching lots so the lots group spans three pages of 10.
    for i in range(25):
        user_store[f"market_lots/lot-{i:02d}"] = {
            "id": f"lot-{i:02d}",
            "crop": "Onion (pyaz)",
            "quantityQuintals": 5,
            "expectedRate": 2000,
            "harvestDate": f"2026-10-{i + 1:02d}",
            "status": "open",
            "location": {"village": "Pimpalgaon", "district": "Nashik"},
        }
    token = seed_user(user_store)

    page1 = await client.get(
        "/v1/search", params={"q": "pyaz", "pageSize": 10}, headers=auth(token)
    )
    assert page1.status_code == 200
    body1 = page1.json()
    assert len(body1["lots"]) == 10
    assert body1["nextCursor"]["lots"]
    # The other groups are unaffected by the lots page size.
    assert len(body1["news"]) == 1
    assert body1["nextCursor"]["news"] is None

    page2 = await client.get(
        "/v1/search",
        params={"q": "pyaz", "pageSize": 10, "cursorLots": body1["nextCursor"]["lots"]},
        headers=auth(token),
    )
    body2 = page2.json()
    assert len(body2["lots"]) == 10
    assert body2["nextCursor"]["lots"]
    assert len(body2["news"]) == 1  # news stays on its first page

    page3 = await client.get(
        "/v1/search",
        params={"q": "pyaz", "pageSize": 10, "cursorLots": body2["nextCursor"]["lots"]},
        headers=auth(token),
    )
    body3 = page3.json()
    assert len(body3["lots"]) == 6  # 1 seeded + 25 = 26 → 10 + 10 + 6
    assert body3["nextCursor"]["lots"] is None

    ids = {h["id"] for h in body1["lots"] + body2["lots"] + body3["lots"]}
    assert len(ids) == 26


async def test_search_empty_query_returns_envelope_error(client, user_store):
    seed_search_store(user_store)
    token = seed_user(user_store)

    resp = await client.get("/v1/search", params={"q": "   "}, headers=auth(token))
    assert resp.status_code == 400
    error = resp.json()["error"]
    assert error["code"] == "EMPTY_QUERY"
    assert "message" in error
    assert error["fieldErrors"] == {}


async def test_search_missing_query_returns_envelope_error(client, user_store):
    token = seed_user(user_store)
    resp = await client.get("/v1/search", headers=auth(token))
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "EMPTY_QUERY"


async def test_search_no_hits_returns_six_empty_groups(client, user_store):
    seed_search_store(user_store)
    token = seed_user(user_store)

    resp = await client.get("/v1/search", params={"q": "zzzznomatch"}, headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    for group in GROUPS:
        assert body[group] == []
        assert body["nextCursor"][group] is None


async def test_search_invalid_cursor_returns_envelope_error(client, user_store):
    seed_search_store(user_store)
    token = seed_user(user_store)

    resp = await client.get(
        "/v1/search", params={"q": "pyaz", "cursorLots": "!!!not-a-cursor"}, headers=auth(token)
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "INVALID_CURSOR"
