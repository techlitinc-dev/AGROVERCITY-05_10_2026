"""P1-11 read side: GET /v1/farmer/deals/{id}/disputes — the farmer's dispute
list on a phone-matched deal, same shape as the broker-side list."""
from tests.test_broker_deals import DEAL_BODY, _seed_broker, _seed_farmer
from tests.test_diary import auth, seed_user


async def _own_deal(client, user_store):
    broker = _seed_broker(user_store)
    farmer_token = _seed_farmer(user_store)
    deal = (
        await client.post("/v1/broker/deals", json=DEAL_BODY, headers=auth(broker))
    ).json()
    return farmer_token, deal


async def test_farmer_lists_own_disputes_newest_first(client, user_store):
    farmer_token, deal = await _own_deal(client, user_store)
    user_store[f"broker_deals/{deal['id']}"]["status"] = "accepted"

    opened = await client.post(
        f"/v1/farmer/deals/{deal['id']}/disputes",
        json={"category": "payment", "reason": "buyer short-paid by ₹4,000"},
        headers=auth(farmer_token),
    )
    assert opened.status_code == 201
    user_store["deal_disputes/dsp_old"] = {
        "id": "dsp_old",
        "dealId": deal["id"],
        "category": "quality",
        "status": "resolved",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }

    resp = await client.get(
        f"/v1/farmer/deals/{deal['id']}/disputes", headers=auth(farmer_token)
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    assert [d["id"] for d in body["data"]] == [opened.json()["id"], "dsp_old"]
    assert body["data"][0]["dealId"] == deal["id"]


async def test_farmer_disputes_404_when_phone_does_not_match(client, user_store):
    broker = _seed_broker(user_store)
    _seed_farmer(user_store)
    deal = (
        await client.post("/v1/broker/deals", json=DEAL_BODY, headers=auth(broker))
    ).json()
    other = seed_user(
        user_store, uid="uid-x", active_profile="farmer", phone="+917777777777"
    )
    resp = await client.get(
        f"/v1/farmer/deals/{deal['id']}/disputes", headers=auth(other)
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "DEAL_NOT_FOUND"


async def test_farmer_disputes_404_for_missing_deal(client, user_store):
    farmer_token = _seed_farmer(user_store)
    resp = await client.get("/v1/farmer/deals/deal_nope/disputes", headers=auth(farmer_token))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "DEAL_NOT_FOUND"
