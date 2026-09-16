from tests.test_users import _auth, _register

LOT_BODY = {
    "crop": "Tomato",
    "quantityQuintals": 10,
    "expectedRate": 2000,
    "harvestDate": "2026-09-10",
    "photos": [],
    "location": {"lat": 20.0, "lng": 73.8},
}

OTHER_LOT = {
    **LOT_BODY,
    "id": "lot_otherfarmer",
    "farmerId": "uid-other",
    "status": "open",
    "createdAt": "2026-09-10T00:00:00+00:00",
}


async def _token(client):
    resp = await _register(client)
    return resp.json()["accessToken"]


async def _create(client, token, **overrides):
    resp = await client.post("/v1/market/lots", json={**LOT_BODY, **overrides}, headers=_auth(token))
    return resp


async def test_create_lot(client):
    token = await _token(client)
    resp = await _create(client, token)
    assert resp.status_code == 201
    assert resp.json()["status"] == "open"
    assert resp.json()["farmerId"] == "uid-1"


async def test_list_own_lots_only(client, user_store):
    token = await _token(client)
    await _create(client, token)
    user_store["market_lots/lot_otherfarmer"] = OTHER_LOT
    resp = await client.get("/v1/market/lots", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["farmerId"] == "uid-1"


async def test_update_lot(client):
    token = await _token(client)
    lot = (await _create(client, token)).json()
    resp = await client.put(
        f"/v1/market/lots/{lot['id']}",
        json={**LOT_BODY, "quantityQuintals": 25},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["quantityQuintals"] == 25


async def test_withdraw_lot(client):
    token = await _token(client)
    lot = (await _create(client, token)).json()
    resp = await client.delete(f"/v1/market/lots/{lot['id']}", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["status"] == "withdrawn"
    resp = await client.get("/v1/market/lots", params={"status": "open"}, headers=_auth(token))
    assert resp.json()["data"] == []


async def test_update_other_farmers_lot_404(client, user_store):
    token = await _token(client)
    user_store["market_lots/lot_otherfarmer"] = OTHER_LOT
    resp = await client.put(
        "/v1/market/lots/lot_otherfarmer",
        json={**LOT_BODY, "quantityQuintals": 25},
        headers=_auth(token),
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "LOT_NOT_FOUND"


async def test_edit_sold_lot_409(client, user_store):
    token = await _token(client)
    lot = (await _create(client, token)).json()
    user_store[f"market_lots/{lot['id']}"]["status"] = "sold"
    resp = await client.put(
        f"/v1/market/lots/{lot['id']}",
        json={**LOT_BODY, "quantityQuintals": 25},
        headers=_auth(token),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "LOT_NOT_EDITABLE"
    resp = await client.delete(f"/v1/market/lots/{lot['id']}", headers=_auth(token))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "LOT_NOT_EDITABLE"
