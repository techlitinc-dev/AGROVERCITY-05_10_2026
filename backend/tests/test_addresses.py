from tests.test_marketplace import seeded  # noqa: F401
from tests.test_orders import _place, _token
from tests.test_users import _auth

ADDRESS_BODY = {
    "label": "घर",
    "line1": "Ward 3, Near Temple",
    "village": "Pimplas",
    "district": "Nashik",
    "state": "Maharashtra",
    "pincode": "422209",
}


async def _create(client, token, **overrides):
    return await client.post("/v1/addresses", json={**ADDRESS_BODY, **overrides}, headers=_auth(token))


async def test_create_first_address_becomes_default(client):
    token = await _token(client)
    resp = await _create(client, token)
    assert resp.status_code == 201
    assert resp.json()["isDefault"] is True
    assert resp.json()["userId"] == "uid-1"


async def test_second_default_clears_first(client):
    token = await _token(client)
    headers = _auth(token)
    first = (await _create(client, token)).json()
    second = (await _create(client, token, label="खेत", isDefault=True)).json()
    resp = await client.get("/v1/addresses", headers=headers)
    data = resp.json()["data"]
    assert data[0]["id"] == second["id"]
    assert data[0]["isDefault"] is True
    by_id = {a["id"]: a for a in data}
    assert by_id[first["id"]]["isDefault"] is False


async def test_update_pincode(client):
    token = await _token(client)
    addr = (await _create(client, token)).json()
    resp = await client.put(
        f"/v1/addresses/{addr['id']}",
        json={**ADDRESS_BODY, "pincode": "422001"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["pincode"] == "422001"


async def test_delete_default_promotes_next(client):
    token = await _token(client)
    headers = _auth(token)
    first = (await _create(client, token)).json()
    second = (await _create(client, token, label="खेत")).json()
    resp = await client.delete(f"/v1/addresses/{first['id']}", headers=headers)
    assert resp.status_code == 204
    data = (await client.get("/v1/addresses", headers=headers)).json()["data"]
    assert len(data) == 1
    assert data[0]["id"] == second["id"]
    assert data[0]["isDefault"] is True


async def test_other_users_address_404(client, user_store):
    token = await _token(client)
    user_store["addresses/addr_other"] = {
        **ADDRESS_BODY,
        "id": "addr_other",
        "userId": "uid-other",
        "isDefault": True,
        "createdAt": "2026-09-16T00:00:00+00:00",
    }
    resp = await client.put(
        "/v1/addresses/addr_other", json=ADDRESS_BODY, headers=_auth(token)
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "ADDRESS_NOT_FOUND"


async def test_bad_pincode_422(client):
    token = await _token(client)
    resp = await _create(client, token, pincode="1234")
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_place_order_with_address_id(client, seeded):
    token = await _token(client)
    addr = (await _create(client, token)).json()
    resp = await _place(client, token, addressId=addr["id"], deliveryAddress="")
    assert resp.status_code == 200
    order_id = resp.json()["orderId"]
    order = await client.get(f"/v1/orders/{order_id}", headers=_auth(token))
    delivery = order.json()["deliveryAddress"]
    assert "Pimplas" in delivery
    assert "422209" in delivery
