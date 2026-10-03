from tests.test_diary import auth, seed_user

ACCOUNT = {
    "accountHolder": "Ram Singh",
    "accountNumber": "12345678901",
    "ifsc": "SBIN0001234",
    "bankName": "SBI",
}


async def test_first_account_becomes_primary(client, user_store):
    token = seed_user(user_store)
    resp = await client.post("/v1/bank-accounts", json=ACCOUNT, headers=auth(token))
    assert resp.status_code == 201
    body = resp.json()
    assert body["isPrimary"] is True
    assert body["verifyStatus"] == "unverified"
    assert body["accountNumberMasked"] == "XXXX8901"
    assert "12345678901" not in str(body)


async def test_bad_ifsc_422(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/bank-accounts", json={**ACCOUNT, "ifsc": "SBIN1234"}, headers=auth(token)
    )
    assert resp.status_code == 422


async def test_short_account_number_422(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/bank-accounts", json={**ACCOUNT, "accountNumber": "12345"}, headers=auth(token)
    )
    assert resp.status_code == 422


async def test_verify_stub_success(client, user_store):
    token = seed_user(user_store)
    resp = await client.post("/v1/bank-accounts", json=ACCOUNT, headers=auth(token))
    account_id = resp.json()["id"]
    resp = await client.post(f"/v1/bank-accounts/{account_id}/verify", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["verifyStatus"] == "verified"


async def test_set_primary_flips_flags(client, user_store):
    token = seed_user(user_store)
    resp = await client.post("/v1/bank-accounts", json=ACCOUNT, headers=auth(token))
    first_id = resp.json()["id"]
    resp = await client.post("/v1/bank-accounts", json=ACCOUNT, headers=auth(token))
    second_id = resp.json()["id"]
    resp = await client.post(
        f"/v1/bank-accounts/{second_id}/set-primary", headers=auth(token)
    )
    assert resp.status_code == 200
    assert resp.json()["primaryId"] == second_id
    resp = await client.get("/v1/bank-accounts", headers=auth(token))
    by_id = {a["id"]: a for a in resp.json()["data"]}
    assert by_id[second_id]["isPrimary"] is True
    assert by_id[first_id]["isPrimary"] is False


async def test_delete_primary_promotes_oldest(client, user_store):
    token = seed_user(user_store)
    ids = []
    for _ in range(2):
        resp = await client.post("/v1/bank-accounts", json=ACCOUNT, headers=auth(token))
        ids.append(resp.json()["id"])
    resp = await client.delete(f"/v1/bank-accounts/{ids[0]}", headers=auth(token))
    assert resp.status_code == 204
    resp = await client.get("/v1/bank-accounts", headers=auth(token))
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["id"] == ids[1]
    assert data[0]["isPrimary"] is True


async def test_foreign_account_404(client, user_store):
    token_a = seed_user(user_store, uid="uid-a")
    resp = await client.post("/v1/bank-accounts", json=ACCOUNT, headers=auth(token_a))
    account_id = resp.json()["id"]
    token_b = seed_user(user_store, uid="uid-b", name="Suresh Jadhav", phone="+919812345679")
    resp = await client.post(f"/v1/bank-accounts/{account_id}/verify", headers=auth(token_b))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "BANK_ACCOUNT_NOT_FOUND"
    resp = await client.delete(f"/v1/bank-accounts/{account_id}", headers=auth(token_b))
    assert resp.status_code == 404
