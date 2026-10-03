from tests.test_diary import auth, seed_user

PRODUCT = {
    "id": "prod-1",
    "title": "Certified Onion Seeds (1kg)",
    "vernacularTitle": "प्रमाणित कांदा बियाणे",
    "category": "seeds",
    "discountedPrice": 450,
    "mrp": 550,
    "batchNo": "BATCH-1",
}


def seed_product(user_store):
    user_store["products/prod-1"] = dict(PRODUCT)


async def test_post_review_updates_aggregate(client, user_store):
    seed_product(user_store)
    token1 = seed_user(user_store)
    token2 = seed_user(user_store, uid="uid-2")
    resp = await client.post(
        "/v1/products/prod-1/reviews",
        json={"rating": 4, "comment": "चांगले बियाणे"},
        headers=auth(token1),
    )
    assert resp.status_code == 200
    assert resp.json()["userName"] == "Ram Patil"
    resp = await client.post(
        "/v1/products/prod-1/reviews",
        json={"rating": 5, "comment": "उत्कृष्ट"},
        headers=auth(token2),
    )
    assert resp.status_code == 200
    assert user_store["products/prod-1"]["ratingCount"] == 2
    assert user_store["products/prod-1"]["ratingAvg"] == 4.5


async def test_upsert_same_user(client, user_store):
    seed_product(user_store)
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/products/prod-1/reviews", json={"rating": 3}, headers=auth(token)
    )
    assert resp.status_code == 200
    created_at = resp.json()["createdAt"]
    resp = await client.post(
        "/v1/products/prod-1/reviews", json={"rating": 5}, headers=auth(token)
    )
    assert resp.status_code == 200
    assert resp.json()["rating"] == 5
    assert resp.json()["createdAt"] == created_at
    review_ids = [k for k in user_store if k.startswith("products/prod-1/reviews/")]
    assert len(review_ids) == 1
    assert user_store["products/prod-1"]["ratingCount"] == 1
    assert user_store["products/prod-1"]["ratingAvg"] == 5.0


async def test_unknown_product_404(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/products/prod-99/reviews", json={"rating": 4}, headers=auth(token)
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "PRODUCT_NOT_FOUND"
    resp = await client.get("/v1/products/prod-99/reviews", headers=auth(token))
    assert resp.status_code == 404


async def test_rating_bounds_422(client, user_store):
    seed_product(user_store)
    token = seed_user(user_store)
    for bad in (0, 6):
        resp = await client.post(
            "/v1/products/prod-1/reviews", json={"rating": bad}, headers=auth(token)
        )
        assert resp.status_code == 422


async def test_list_reviews_sorted(client, user_store):
    seed_product(user_store)
    token1 = seed_user(user_store)
    token2 = seed_user(user_store, uid="uid-2")
    await client.post(
        "/v1/products/prod-1/reviews",
        json={"rating": 4, "comment": "पहिली समीक्षा"},
        headers=auth(token1),
    )
    await client.post(
        "/v1/products/prod-1/reviews",
        json={"rating": 5, "comment": "दुसरी समीक्षा"},
        headers=auth(token2),
    )
    resp = await client.get("/v1/products/prod-1/reviews", headers=auth(token1))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    assert body["data"][0]["comment"] == "दुसरी समीक्षा"
    assert all("userName" in r for r in body["data"])
