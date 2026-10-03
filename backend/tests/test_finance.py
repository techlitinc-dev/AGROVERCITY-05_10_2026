from tests.test_diary import auth, seed_user


async def test_credit_score_defaults(client, user_store):
    token = seed_user(user_store)
    resp = await client.get("/v1/finance/credit-score", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["kisanCreditScore"] == 650
    assert body["creditTier"] == "Silver"
    assert body["creditLimit"] == 50000


async def test_emi_exact(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/finance/loan-calculator",
        json={"amount": 25000, "tenureMonths": 6, "interestRate": 7},
        headers=auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert abs(body["emi"] - 4252.15) < 0.5
    assert body["totalInterest"] == round(body["totalPayable"] - 25000, 2)


async def test_amount_below_min_422(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/finance/loan-calculator",
        json={"amount": 4000, "tenureMonths": 6},
        headers=auth(token),
    )
    assert resp.status_code == 422
    resp = await client.post(
        "/v1/finance/loan-calculator",
        json={"amount": 25000, "tenureMonths": 13},
        headers=auth(token),
    )
    assert resp.status_code == 422


async def test_kcc_not_found(client, user_store):
    token = seed_user(user_store)
    resp = await client.get("/v1/finance/kcc", headers=auth(token))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "KCC_NOT_FOUND"


async def test_loan_apply(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/finance/loans/apply",
        json={"amount": 30000, "tenureMonths": 6, "purpose": "Seed purchase"},
        headers=auth(token),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["applicationId"]
    assert body["status"] == "submitted"


async def test_loans_list_after_apply(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/finance/loans/apply",
        json={"amount": 30000, "tenureMonths": 6, "purpose": "Seed purchase"},
        headers=auth(token),
    )
    assert resp.status_code == 201
    resp = await client.get("/v1/finance/loans", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["data"][0]["status"] == "submitted"
    assert body["data"][0]["amount"] == 30000


async def test_loans_empty_list_200(client, user_store):
    token = seed_user(user_store)
    resp = await client.get("/v1/finance/loans", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["data"] == []
