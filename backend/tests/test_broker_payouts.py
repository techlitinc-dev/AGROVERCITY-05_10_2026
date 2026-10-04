"""B6/B7: broker commission payout rail (weekly settlement → RazorpayX payout
at brokerPct 2) + payment split at capture (farmer leg + commission leg)."""
from tests.test_broker_deals import DEAL_BODY, _seed_broker, _seed_farmer
from tests.test_diary import auth

PERIOD = {"periodStart": "2026-09-07", "periodEnd": "2026-09-13"}


async def _completed_deal(client, user_store, broker):
    _seed_farmer(user_store)
    resp = await client.post("/v1/broker/deals", json=DEAL_BODY, headers=auth(broker))
    assert resp.status_code == 201
    deal = resp.json()
    user_store[f"broker_deals/{deal['id']}"]["status"] = "completed"
    user_store[f"broker_deals/{deal['id']}"]["date"] = "2026-09-08"
    return deal


async def test_broker_settlement_2pct_and_payout(client, user_store):
    broker = _seed_broker(user_store)
    deal = await _completed_deal(client, user_store, broker)
    # gross = 50q × ₹2200 = ₹110,000 → 2% commission = ₹2,200 → net ₹107,800
    user_store["users/uid-b1/bank_accounts/ba_1"] = {
        "id": "ba_1",
        "verifyStatus": "verified",
        "isPrimary": True,
        "createdAt": "2026-09-01T00:00:00+00:00",
    }

    resp = await client.post("/v1/jobs/settlements/run", json=PERIOD)
    assert resp.status_code == 200
    settlement = user_store[f"settlements/st_broker_uid-b1_2026-09-07"]
    assert settlement["grossRupees"] == 110000
    assert settlement["commissionRupees"] == 2200  # brokerPct 2
    assert settlement["netRupees"] == 107800

    resp = await client.post("/v1/jobs/settlements/payouts", json=PERIOD)
    assert resp.status_code == 200
    assert resp.json()["paid"] == 1
    settlement = user_store[f"settlements/st_broker_uid-b1_2026-09-07"]
    assert settlement["status"] == "paid"
    assert settlement["payoutRef"].startswith("pout_dev_")

    audits = [
        d for k, d in user_store.items()
        if k.startswith("audit_logs/") and d.get("action") == "SETTLEMENT_PAYOUT"
    ]
    assert len(audits) == 1
    assert audits[0]["role"] == "broker"
    assert audits[0]["amountPaisa"] == 10780000  # integer paisa
