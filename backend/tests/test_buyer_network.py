"""S5: buyer network — wholesale buyers post bulk requirements to the vyapari;
the vyapari sees a buyer directory built from the khata + bulk orders."""
from tests.test_users import _auth, _register

ORDER_BODY = {
    "crop": "Onion",
    "quantityQuintals": 200,
    "targetPricePerQuintal": 1750,
    "neededBy": "2026-10-15",
    "notes": "steady weekly supply",
}


async def _buyer_token(client):
    resp = await _register(client, profiles=["directBuyer"], primaryProfile="directBuyer")
    return resp.json()["accessToken"]


async def _seller_token(client):
    resp = await _register(
        client,
        profiles=["farmer", "seller"],
        primaryProfile="seller",
        roleProfiles={"seller": {"shopName": "New Kirana Mandi"}},
    )
    return resp.json()["accessToken"]


async def _post_order(client, token, key="bulk-1", **overrides):
    return await client.post(
        "/v1/seller/bulk-orders",
        json={**ORDER_BODY, **overrides},
        headers={**_auth(token), "Idempotency-Key": key},
    )


async def test_buyer_posts_requirement_and_seller_lists(client, user_store):
    buyer = await _buyer_token(client)
    seller = await _seller_token(client)

    resp = await _post_order(client, buyer)
    assert resp.status_code == 201
    order = resp.json()
    assert order["status"] == "open"
    assert order["buyerId"] == "uid-1"
    assert order["buyerPhone"]

    resp = await client.get("/v1/seller/bulk-orders", headers=_auth(seller))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["openCount"] == 1
    assert body["data"][0]["crop"] == "Onion"


async def test_missing_idempotency_key_400(client, user_store):
    buyer = await _buyer_token(client)
    resp = await client.post(
        "/v1/seller/bulk-orders", json=ORDER_BODY, headers=_auth(buyer)
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "IDEMPOTENCY_KEY_REQUIRED"


async def test_invalid_quantity_422(client, user_store):
    buyer = await _buyer_token(client)
    resp = await _post_order(client, buyer, key="bulk-bad", quantityQuintals=0)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_replay_is_idempotent(client, user_store):
    buyer = await _buyer_token(client)
    first = await _post_order(client, buyer, key="replay")
    assert first.status_code == 201
    replayed = await _post_order(client, buyer, key="replay", crop="Changed")
    assert replayed.status_code == 201
    assert replayed.json()["crop"] == "Onion"  # stored response, not the new body
    orders = [k for k in user_store if k.startswith("seller_bulk_orders/")]
    assert len(orders) == 1


async def test_directory_unions_ledger_and_bulk_orders(client, user_store):
    buyer = await _buyer_token(client)
    seller = await _seller_token(client)

    # ledger buyer (khata entry)
    resp = await client.post(
        "/v1/seller/ledgers",
        json={
            "buyerName": "M/s Ledger Traders",
            "buyerPhone": "9999900001",
            "type": "credit_sale",
            "amount": 1000.0,
        },
        headers=_auth(seller),
    )
    assert resp.status_code == 201
    await _post_order(client, buyer)

    resp = await client.get("/v1/seller/buyer-directory", headers=_auth(seller))
    assert resp.status_code == 200
    rows = {r["buyerName"]: r for r in resp.json()["data"]}
    assert rows["M/s Ledger Traders"]["ledgerEntries"] == 1
    assert rows["Ram Patil"]["bulkOrders"] == 1  # registered buyer name
