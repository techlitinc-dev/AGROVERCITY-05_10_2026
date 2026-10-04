"""WS-05 step 11: broker entitlements — Free = 5 active deals; Pro = unlimited
+ CRM bulk tools / mandi-trend analytics / priority leads; the commission
stacks with the subscription (brokerPct configurable 0–10)."""
from app.services.billing import seed_plans
from tests.test_broker_deals import DEAL_BODY, _seed_broker
from tests.test_diary import auth

PERIOD = {"periodStart": "2026-09-07", "periodEnd": "2026-09-13"}


async def _free_broker(client, user_store):
    await seed_plans()
    return _seed_broker(user_store)


async def _subscribe(client, token, plan_id="broker_pro"):
    resp = await client.post(
        "/v1/billing/subscribe", json={"planId": plan_id}, headers=auth(token)
    )
    assert resp.status_code == 201


async def test_free_tier_five_deal_cap(client, user_store):
    broker = await _free_broker(client, user_store)
    for i in range(5):
        resp = await client.post(
            "/v1/broker/deals", json={**DEAL_BODY, "commodity": f"Crop-{i}"}, headers=auth(broker)
        )
        assert resp.status_code == 201

    blocked = await client.post("/v1/broker/deals", json=DEAL_BODY, headers=auth(broker))
    assert blocked.status_code == 402
    error = blocked.json()["error"]
    assert error["code"] == "ENTITLEMENT_EXCEEDED"
    assert error["limit"] == 5
    assert error["planId"] == "broker_free"


async def test_pro_tier_unlimited_deals(client, user_store):
    broker = await _free_broker(client, user_store)
    await _subscribe(client, broker)
    for i in range(8):
        resp = await client.post(
            "/v1/broker/deals", json={**DEAL_BODY, "commodity": f"Crop-{i}"}, headers=auth(broker)
        )
        assert resp.status_code == 201


async def test_commission_still_applies_on_pro(client, user_store):
    """The subscription never replaces the commission — they stack."""
    broker = await _free_broker(client, user_store)
    await _subscribe(client, broker)
    for i in range(2):
        resp = await client.post(
            "/v1/broker/deals", json={**DEAL_BODY, "commodity": f"Onion-{i}"}, headers=auth(broker)
        )
        deal = resp.json()
        user_store[f"broker_deals/{deal['id']}"]["status"] = "completed"
        user_store[f"broker_deals/{deal['id']}"]["date"] = "2026-09-08"

    resp = await client.post("/v1/jobs/settlements/run", json=PERIOD)
    assert resp.status_code == 200
    settlement = user_store["settlements/st_broker_uid-b1_2026-09-07"]
    # 2 deals × ₹110,000 gross = ₹220,000 → 2% = ₹4,400 commission on Pro
    assert settlement["grossRupees"] == 220000
    assert settlement["commissionRupees"] == 4400
    assert settlement["netRupees"] == 215600


async def test_broker_pct_clamped_0_10(client, user_store):
    broker = await _free_broker(client, user_store)
    resp = await client.post("/v1/broker/deals", json=DEAL_BODY, headers=auth(broker))
    deal = resp.json()
    user_store[f"broker_deals/{deal['id']}"]["status"] = "completed"
    user_store[f"broker_deals/{deal['id']}"]["date"] = "2026-09-08"
    user_store["platform_config/settlements"] = {
        "transportPct": 10, "equipmentRentalPct": 12, "brokerPct": 25,
        "sellerPct": 2, "sellerMinRupees": 50,
        "version": 2, "effectiveFrom": "2026-10-01T00:00:00+00:00",
    }
    resp = await client.post("/v1/jobs/settlements/run", json=PERIOD)
    assert resp.status_code == 200
    settlement = user_store["settlements/st_broker_uid-b1_2026-09-07"]
    assert settlement["commissionRupees"] == 11000  # clamped to 10% of 110,000
