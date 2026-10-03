from tests.test_diary import auth, seed_user


async def test_summary_empty_user_zeros(client, user_store):
    token = seed_user(user_store)
    resp = await client.get("/v1/pnl/summary", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json() == {"grossIncome": 0, "productionCost": 0, "netProfit": 0}


async def test_crops_seeds_demo_on_first_read(client, user_store):
    token = seed_user(user_store)
    resp = await client.get("/v1/pnl/crops", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    names = {c["name"] for c in body["data"]}
    assert any("Wheat" in n for n in names)
    assert any("Onion" in n for n in names)


async def test_add_expense_recomputes(client, user_store):
    token = seed_user(user_store)
    resp = await client.get("/v1/pnl/crops", headers=auth(token))
    wheat = next(c for c in resp.json()["data"] if "Wheat" in c["name"])
    resp = await client.post(
        f"/v1/pnl/crops/{wheat['id']}/expenses",
        json={"category": "Pesticide", "amount": 5000},
        headers=auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["totalExpenses"] == wheat["totalExpenses"] + 5000
    assert body["netProfit"] == body["grossRevenue"] - body["totalExpenses"]


async def test_break_even_exact(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/pnl/break-even",
        json={"totalCost": 50000, "expectedYieldQuintals": 20},
        headers=auth(token),
    )
    assert resp.status_code == 200
    assert resp.json() == {"minSafePricePerQuintal": 2500}


async def test_break_even_zero_yield_422(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/pnl/break-even",
        json={"totalCost": 50000, "expectedYieldQuintals": 0},
        headers=auth(token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"
