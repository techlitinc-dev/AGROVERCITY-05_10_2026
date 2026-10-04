"""B3: buyer requirement postings — wholesale buyers post "need 50q onion @
₹X"; brokers respond and a lead is prefilled into their pipeline."""
from tests.test_broker_deals import _seed_broker
from tests.test_diary import auth, seed_user

REQ_BODY = {
    "commodity": "Onion",
    "quantityQuintals": 50,
    "targetRate": 2100,
    "location": "Nashik APMC",
    "notes": "steady weekly supply",
}


async def test_buyer_posts_requirement_and_broker_lists(client, user_store):
    buyer = seed_user(user_store, uid="uid-buy", active_profile="directBuyer", name="Shree Traders")
    broker = _seed_broker(user_store)

    resp = await client.post("/v1/broker/buyer-requirements", json=REQ_BODY, headers=auth(buyer))
    assert resp.status_code == 201
    req = resp.json()
    assert req["status"] == "open"
    assert req["buyerName"] == "Shree Traders"

    resp = await client.get("/v1/broker/buyer-requirements", headers=auth(broker))
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    assert resp.json()["data"][0]["commodity"] == "Onion"


async def test_broker_respond_prefills_lead(client, user_store):
    buyer = seed_user(user_store, uid="uid-buy", active_profile="directBuyer", name="Shree Traders")
    broker = _seed_broker(user_store)
    req = (
        await client.post("/v1/broker/buyer-requirements", json=REQ_BODY, headers=auth(buyer))
    ).json()

    resp = await client.post(
        f"/v1/broker/buyer-requirements/{req['id']}/respond", headers=auth(broker)
    )
    assert resp.status_code == 201
    lead = resp.json()["lead"]
    assert lead["type"] == "buyer"
    assert lead["commodity"] == "Onion"
    assert lead["quantityExpected"] == 50
    assert lead["targetRate"] == 2100
    assert lead["requirementId"] == req["id"]
    assert resp.json()["requirement"]["responsesCount"] == 1

    # the prefilled lead is in the broker's pipeline
    resp = await client.get("/v1/broker/leads", headers=auth(broker))
    assert any(l["id"] == lead["id"] for l in resp.json()["data"])


async def test_closed_requirement_rejects_response(client, user_store):
    buyer = seed_user(user_store, uid="uid-buy", active_profile="directBuyer")
    broker = _seed_broker(user_store)
    req = (
        await client.post("/v1/broker/buyer-requirements", json=REQ_BODY, headers=auth(buyer))
    ).json()
    user_store[f"buyer_requirements/{req['id']}"]["status"] = "fulfilled"

    resp = await client.post(
        f"/v1/broker/buyer-requirements/{req['id']}/respond", headers=auth(broker)
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "REQUIREMENT_CLOSED"


async def test_unknown_requirement_404(client, user_store):
    broker = _seed_broker(user_store)
    resp = await client.post(
        "/v1/broker/buyer-requirements/req_missing/respond", headers=auth(broker)
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "REQUIREMENT_NOT_FOUND"
