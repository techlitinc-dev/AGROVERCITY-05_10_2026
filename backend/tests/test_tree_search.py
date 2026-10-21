from tests.test_diary import auth, seed_user
from tests.test_tree import seed_tree_store


async def test_articles_search_filters_by_title(client, user_store):
    seed_tree_store(user_store)
    token = seed_user(user_store)
    resp = await client.get("/v1/tree/articles?q=biofuel", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert "biofuel" in body["data"][0]["title"].lower()


async def test_articles_search_is_case_insensitive(client, user_store):
    seed_tree_store(user_store)
    token = seed_user(user_store)
    resp = await client.get("/v1/tree/articles?q=ORCHARD", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert "orchard" in body["data"][0]["title"].lower()


async def test_articles_without_q_returns_all(client, user_store):
    seed_tree_store(user_store)
    token = seed_user(user_store)
    resp = await client.get("/v1/tree/articles", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["total"] == 4


async def test_articles_blank_q_returns_all(client, user_store):
    seed_tree_store(user_store)
    token = seed_user(user_store)
    resp = await client.get("/v1/tree/articles?q=%20%20", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["total"] == 4


async def test_articles_no_match_returns_empty(client, user_store):
    seed_tree_store(user_store)
    token = seed_user(user_store)
    resp = await client.get("/v1/tree/articles?q=zzzznotfound", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["total"] == 0
    assert resp.json()["data"] == []


async def test_ngos_search_by_name(client, user_store):
    seed_tree_store(user_store)
    token = seed_user(user_store)
    resp = await client.get("/v1/tree/ngos?q=green", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert "green" in body["data"][0]["name"].lower()

    all_resp = await client.get("/v1/tree/ngos", headers=auth(token))
    assert all_resp.json()["total"] == 3


async def test_care_guides_search_keeps_step_order(client, user_store):
    seed_tree_store(user_store)
    token = seed_user(user_store)
    # "ing" is a substring of every seeded guide title (Digging, Planting,
    # Pruning, Watch-ing, Shaping) so the full set is matched and the
    # stepNumber ordering must survive the filter.
    resp = await client.get("/v1/tree/care-guides?q=ing", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 5
    steps = [g["stepNumber"] for g in body["data"]]
    assert steps == [1, 2, 3, 4, 5]


async def test_biofuel_search_by_name(client, user_store):
    seed_tree_store(user_store)
    token = seed_user(user_store)
    resp = await client.get("/v1/tree/biofuel?q=neem", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert "neem" in body["data"][0]["name"].lower()

    none_resp = await client.get("/v1/tree/biofuel?q=bamboo", headers=auth(token))
    assert none_resp.json()["total"] == 0
