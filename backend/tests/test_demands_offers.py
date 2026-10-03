from app.services.tokens import create_access_token
from tests.test_direct_buyer import _lot, _register_buyer, _seed_user
from tests.test_users import _auth

DEMAND_BODY = {"crop": "Tomato", "variety": "Hybrid", "quantity": 20, "maxPrice": 2200, "qualityGrade": "A"}


async def _buyer_token(client):
    return (await _register_buyer(client)).json()["accessToken"]


async def _create_demand(client, token, **overrides):
    return await client.post("/v1/demands", json={**DEMAND_BODY, **overrides}, headers=_auth(token))


# ---- demand CRUD ----


async def test_create_demand(client):
    token = await _buyer_token(client)
    resp = await _create_demand(client, token, deliveryLocation="Nashik APMC", frequency="weekly")
    assert resp.status_code == 201
    body = resp.json()
    assert body["id"].startswith("dem_")
    assert body["status"] == "open"
    assert body["offersCount"] == 0
    assert body["buyerCompany"] == "Shree Traders"
    assert body["state"] == "Maharashtra"
    assert body["frequency"] == "weekly"


async def test_list_demands_public_open_only_with_filters(client, user_store):
    token = await _buyer_token(client)
    await _create_demand(client, token, crop="Tomato")
    await _create_demand(client, token, crop="Onion")
    other = _seed_user(user_store, "uid-b2", "Other Buyer", active="directBuyer")
    await _create_demand(client, other, crop="Tomato")
    farmer_token = _seed_user(user_store, "uid-f1", "Ram Patel")
    resp = await client.get("/v1/demands", headers=_auth(farmer_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 3
    assert all(d["status"] == "open" for d in body["data"])
    resp = await client.get("/v1/demands?crop=tomato", headers=_auth(farmer_token))
    assert resp.json()["total"] == 2
    resp = await client.get("/v1/demands?state=gujarat", headers=_auth(farmer_token))
    assert resp.json()["total"] == 0
    resp = await client.get("/v1/demands?state=maharashtra&pageSize=2", headers=_auth(farmer_token))
    assert resp.json()["pageSize"] == 2
    assert len(resp.json()["data"]) == 2


async def test_list_demands_status_all_shows_own(client):
    token = await _buyer_token(client)
    demand = (await _create_demand(client, token)).json()
    await client.post(f"/v1/demands/{demand['id']}/close", headers=_auth(token))
    resp = await client.get("/v1/demands", headers=_auth(token))
    assert resp.json()["total"] == 0
    resp = await client.get("/v1/demands?status=all", headers=_auth(token))
    body = resp.json()
    assert body["total"] == 1
    assert body["data"][0]["status"] == "closed"


async def test_get_demand_public(client, user_store):
    token = await _buyer_token(client)
    demand = (await _create_demand(client, token)).json()
    farmer_token = _seed_user(user_store, "uid-f1", "Ram Patel")
    resp = await client.get(f"/v1/demands/{demand['id']}", headers=_auth(farmer_token))
    assert resp.status_code == 200
    assert resp.json()["id"] == demand["id"]


async def test_update_demand_owner_only_and_open_only(client, user_store):
    token = await _buyer_token(client)
    demand = (await _create_demand(client, token)).json()
    farmer_token = _seed_user(user_store, "uid-f1", "Ram Patel")
    resp = await client.put(
        f"/v1/demands/{demand['id']}",
        json={"maxPrice": 2500},
        headers=_auth(farmer_token),
    )
    assert resp.status_code == 403
    resp = await client.put(
        f"/v1/demands/{demand['id']}",
        json={"maxPrice": 2500, "notes": "urgent"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["maxPrice"] == 2500
    assert resp.json()["notes"] == "urgent"
    await client.post(f"/v1/demands/{demand['id']}/close", headers=_auth(token))
    resp = await client.put(f"/v1/demands/{demand['id']}", json={"maxPrice": 2600}, headers=_auth(token))
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "DEMAND_CLOSED"


async def test_close_and_reopen_demand(client):
    token = await _buyer_token(client)
    demand = (await _create_demand(client, token)).json()
    resp = await client.post(f"/v1/demands/{demand['id']}/close", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["status"] == "closed"
    resp = await client.post(f"/v1/demands/{demand['id']}/close", headers=_auth(token))
    assert resp.status_code == 200
    resp = await client.post(f"/v1/demands/{demand['id']}/reopen", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["status"] == "open"
    resp = await client.post(f"/v1/demands/{demand['id']}/reopen", headers=_auth(token))
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "DEMAND_NOT_CLOSED"


async def test_close_demand_forbidden_for_non_owner(client, user_store):
    token = await _buyer_token(client)
    demand = (await _create_demand(client, token)).json()
    farmer_token = _seed_user(user_store, "uid-f1", "Ram Patel")
    resp = await client.post(f"/v1/demands/{demand['id']}/close", headers=_auth(farmer_token))
    assert resp.status_code == 403


async def test_delete_demand_blocked_by_live_offer(client, user_store):
    token = await _buyer_token(client)
    demand = (await _create_demand(client, token)).json()
    farmer_token = _seed_user(user_store, "uid-f1", "Ram Patel")
    offer = {"targetType": "demand", "targetId": demand["id"], "pricePerUnit": 2000, "quantity": 10}
    resp = await client.post("/v1/offers", json=offer, headers=_auth(farmer_token))
    assert resp.status_code == 201
    resp = await client.delete(f"/v1/demands/{demand['id']}", headers=_auth(token))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "DEMAND_HAS_OFFERS"
    offer_id = (await client.get("/v1/offers/mine?filter=sent", headers=_auth(farmer_token))).json()["data"][0]["id"]
    await client.post(f"/v1/offers/{offer_id}/withdraw", headers=_auth(farmer_token))
    resp = await client.delete(f"/v1/demands/{demand['id']}", headers=_auth(token))
    assert resp.status_code == 204
    resp = await client.get(f"/v1/demands/{demand['id']}", headers=_auth(token))
    assert resp.status_code == 404


async def test_delete_demand_forbidden_for_non_owner(client, user_store):
    token = await _buyer_token(client)
    demand = (await _create_demand(client, token)).json()
    farmer_token = _seed_user(user_store, "uid-f1", "Ram Patel")
    resp = await client.delete(f"/v1/demands/{demand['id']}", headers=_auth(farmer_token))
    assert resp.status_code == 403


# ---- offers on demands ----


async def test_offer_on_own_demand_forbidden(client):
    token = await _buyer_token(client)
    demand = (await _create_demand(client, token)).json()
    offer = {"targetType": "demand", "targetId": demand["id"], "pricePerUnit": 2000, "quantity": 10}
    resp = await client.post("/v1/offers", json=offer, headers=_auth(token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "OWN_DEMAND"


async def test_offer_on_missing_demand_404(client):
    token = await _buyer_token(client)
    offer = {"targetType": "demand", "targetId": "dem_missing", "pricePerUnit": 2000, "quantity": 10}
    resp = await client.post("/v1/offers", json=offer, headers=_auth(token))
    assert resp.status_code == 404


async def test_offer_created_and_idempotent_replay(client, user_store):
    token = await _buyer_token(client)
    demand = (await _create_demand(client, token)).json()
    farmer_token = _seed_user(user_store, "uid-f1", "Ram Patel")
    offer = {"targetType": "demand", "targetId": demand["id"], "pricePerUnit": 2000, "quantity": 10, "message": "fresh stock"}
    resp = await client.post("/v1/offers", json=offer, headers=_auth(farmer_token))
    assert resp.status_code == 201
    first = resp.json()
    assert first["status"] == "pending"
    assert first["fromRole"] == "farmer"
    assert first["toId"] == "uid-1"
    assert first["unit"] == "quintal"
    replay = await client.post("/v1/offers", json={**offer, "pricePerUnit": 1900}, headers=_auth(farmer_token))
    assert replay.status_code == 200
    assert replay.json()["id"] == first["id"]
    resp = await client.get(f"/v1/demands/{demand['id']}", headers=_auth(token))
    assert resp.json()["offersCount"] == 1
    resp = await client.get("/v1/offers/mine?filter=sent", headers=_auth(farmer_token))
    assert resp.json()["total"] == 1
    resp = await client.get("/v1/offers/mine?filter=received", headers=_auth(token))
    assert resp.json()["total"] == 1


async def test_accept_by_non_owner_forbidden(client, user_store):
    token = await _buyer_token(client)
    demand = (await _create_demand(client, token)).json()
    farmer_token = _seed_user(user_store, "uid-f1", "Ram Patel")
    offer = {"targetType": "demand", "targetId": demand["id"], "pricePerUnit": 2000, "quantity": 10}
    offer_id = (await client.post("/v1/offers", json=offer, headers=_auth(farmer_token))).json()["id"]
    resp = await client.post(f"/v1/offers/{offer_id}/accept", headers=_auth(farmer_token))
    assert resp.status_code == 403
    outsider = create_access_token("uid-outsider")
    resp = await client.get(f"/v1/offers/{offer_id}", headers=_auth(outsider))
    assert resp.status_code == 403


async def test_full_negotiation_counter_accepted_creates_purchase(client, user_store):
    token = await _buyer_token(client)
    demand = (await _create_demand(client, token, crop="Onion", quantity=15)).json()
    farmer_token = _seed_user(user_store, "uid-f1", "Ram Patel")
    offer = {"targetType": "demand", "targetId": demand["id"], "pricePerUnit": 2000, "quantity": 15}
    offer_id = (await client.post("/v1/offers", json=offer, headers=_auth(farmer_token))).json()["id"]
    resp = await client.post(f"/v1/offers/{offer_id}/counter", json={"pricePerUnit": 1800, "note": "bulk rate"}, headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["status"] == "countered"
    assert resp.json()["counter"]["pricePerUnit"] == 1800
    second = await client.post(f"/v1/offers/{offer_id}/counter", json={"pricePerUnit": 1700}, headers=_auth(token))
    assert second.status_code == 400
    assert second.json()["error"]["code"] == "NEGOTIATION_CLOSED"
    resp = await client.post(f"/v1/offers/{offer_id}/accept", headers=_auth(token))
    assert resp.status_code == 403
    resp = await client.post(f"/v1/offers/{offer_id}/accept", headers=_auth(farmer_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["offer"]["status"] == "accepted"
    purchase = body["purchase"]
    assert purchase["status"] == "confirmed"
    assert purchase["agreedPricePerUnit"] == 1800
    assert purchase["totalAmount"] == 27000
    assert purchase["buyerId"] == "uid-1"
    assert purchase["farmerId"] == "uid-f1"
    assert purchase["farmerName"] == "Ram Patel"
    assert purchase["source"] == {"type": "offer", "refId": offer_id}
    assert purchase["crop"] == "Onion"
    resp = await client.get(f"/v1/demands/{demand['id']}", headers=_auth(token))
    assert resp.json()["status"] == "fulfilled"
    again = await client.post(f"/v1/offers/{offer_id}/accept", headers=_auth(farmer_token))
    assert again.status_code == 400


async def test_reject_and_withdraw_flows(client, user_store):
    token = await _buyer_token(client)
    demand = (await _create_demand(client, token)).json()
    farmer_token = _seed_user(user_store, "uid-f1", "Ram Patel")
    offer = {"targetType": "demand", "targetId": demand["id"], "pricePerUnit": 2000, "quantity": 10}
    offer_id = (await client.post("/v1/offers", json=offer, headers=_auth(farmer_token))).json()["id"]
    withdraw = await client.post(f"/v1/offers/{offer_id}/withdraw", headers=_auth(token))
    assert withdraw.status_code == 403
    resp = await client.post(f"/v1/offers/{offer_id}/reject", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["status"] == "rejected"
    resp = await client.post(f"/v1/offers/{offer_id}/withdraw", headers=_auth(farmer_token))
    assert resp.status_code == 400
    offer2 = (await client.post("/v1/offers", json=offer, headers=_auth(farmer_token))).json()
    assert offer2["status"] == "pending"
    resp = await client.post(f"/v1/offers/{offer2['id']}/withdraw", headers=_auth(farmer_token))
    assert resp.status_code == 200
    assert resp.json()["status"] == "withdrawn"


# ---- offers on lots ----


async def test_offer_on_lot_and_farmer_accepts(client, user_store):
    token = await _buyer_token(client)
    farmer_token = _seed_user(user_store, "uid-f1", "Ram Patel")
    user_store["market_lots/lot_1"] = _lot("lot_1", "uid-f1", "Wheat", "2026-09-10T00:00:00+00:00")
    own = await client.post("/v1/offers", json={"targetType": "lot", "targetId": "lot_1", "pricePerUnit": 2400, "quantity": 4}, headers=_auth(farmer_token))
    assert own.status_code == 403
    assert own.json()["error"]["code"] == "OWN_LOT"
    resp = await client.post(
        "/v1/offers",
        json={"targetType": "lot", "targetId": "lot_1", "pricePerUnit": 2300, "quantity": 4},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    assert resp.json()["toId"] == "uid-f1"
    offer_id = resp.json()["id"]
    resp = await client.post(f"/v1/offers/{offer_id}/accept", headers=_auth(token))
    assert resp.status_code == 403
    resp = await client.post(f"/v1/offers/{offer_id}/accept", headers=_auth(farmer_token))
    assert resp.status_code == 200
    purchase = resp.json()["purchase"]
    assert purchase["buyerId"] == "uid-1"
    assert purchase["farmerId"] == "uid-f1"
    assert purchase["agreedPricePerUnit"] == 2300
    assert purchase["totalAmount"] == 9200
    assert purchase["source"]["type"] == "offer"
    assert user_store["market_lots/lot_1"]["status"] == "sold"


async def test_offer_on_sold_lot_409(client, user_store):
    token = await _buyer_token(client)
    lot = _lot("lot_2", "uid-f1", "Wheat", "2026-09-10T00:00:00+00:00")
    lot["status"] = "sold"
    user_store["market_lots/lot_2"] = lot
    resp = await client.post(
        "/v1/offers",
        json={"targetType": "lot", "targetId": "lot_2", "pricePerUnit": 2300, "quantity": 4},
        headers=_auth(token),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "LOT_NOT_OPEN"


async def test_offer_on_closed_demand_409(client, user_store):
    token = await _buyer_token(client)
    demand = (await _create_demand(client, token)).json()
    await client.post(f"/v1/demands/{demand['id']}/close", headers=_auth(token))
    farmer_token = _seed_user(user_store, "uid-f1", "Ram Patel")
    resp = await client.post(
        "/v1/offers",
        json={"targetType": "demand", "targetId": demand["id"], "pricePerUnit": 2000, "quantity": 10},
        headers=_auth(farmer_token),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "DEMAND_CLOSED"


async def test_offer_participant_only_read(client, user_store):
    token = await _buyer_token(client)
    demand = (await _create_demand(client, token)).json()
    farmer_token = _seed_user(user_store, "uid-f1", "Ram Patel")
    offer_id = (
        await client.post(
            "/v1/offers",
            json={"targetType": "demand", "targetId": demand["id"], "pricePerUnit": 2000, "quantity": 10},
            headers=_auth(farmer_token),
        )
    ).json()["id"]
    outsider = create_access_token("uid-outsider")
    resp = await client.get(f"/v1/offers/{offer_id}", headers=_auth(outsider))
    assert resp.status_code == 403
    resp = await client.get(f"/v1/offers/{offer_id}", headers=_auth(farmer_token))
    assert resp.status_code == 200
