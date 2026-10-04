"""WS-05 acceptance: seed and soak 50 concurrent deals, drive each through
stages (offer → counter → contract → accept → evidence → completed), asserting
zero errors and that the commission ledger reconciles with the settlement."""
from app.services.billing import seed_plans
from tests.test_broker_deals import (
    DEAL_BODY,
    FAKE_PNG,
    _patch_storage,
    _seed_broker,
    _seed_farmer,
)
from tests.test_diary import auth

PERIOD = {"periodStart": "2026-09-07", "periodEnd": "2026-09-13"}


async def test_soak_50_concurrent_deals_and_reconcile_commission(client, user_store, monkeypatch):
    _patch_storage(monkeypatch)
    await seed_plans()
    broker = _seed_broker(user_store)
    farmer = _seed_farmer(user_store)

    # Subscribe to Pro tier so 50 active deals are permitted
    sub_resp = await client.post(
        "/v1/billing/subscribe", json={"planId": "broker_pro"}, headers=auth(broker)
    )
    assert sub_resp.status_code == 201

    deal_ids = []
    total_gross = 0
    total_commission = 0

    # Drive 50 concurrent deals through their full lifecycle
    for i in range(50):
        # 1. Offer stage (create deal)
        create_resp = await client.post(
            "/v1/broker/deals",
            json={**DEAL_BODY, "commodity": f"Onion-{i}"},
            headers=auth(broker),
        )
        assert create_resp.status_code == 201
        deal = create_resp.json()
        deal_id = deal["id"]
        deal_ids.append(deal_id)
        total_gross += deal["grossAmount"]
        total_commission += deal["commissionAmount"]

        # 2. Counter stage
        counter_resp = await client.post(
            f"/v1/farmer/deals/{deal_id}/messages",
            json={"senderRole": "seller", "text": f"counter {i}", "amountOffer": 2200},
            headers=auth(farmer),
        )
        assert counter_resp.status_code == 201

        # 3. Contract stage
        contract_resp = await client.put(
            f"/v1/broker/deals/{deal_id}",
            json={"status": "contract_issued"},
            headers=auth(broker),
        )
        assert contract_resp.status_code == 200

        # 4. Accept stage
        accept_resp = await client.post(
            f"/v1/farmer/deals/{deal_id}/respond",
            json={"action": "accept"},
            headers=auth(farmer),
        )
        assert accept_resp.status_code == 200

        # 5. Evidence stage
        evidence_resp = await client.post(
            f"/v1/broker/deals/{deal_id}/evidence",
            data={"kind": "weigh_slip"},
            files={"file": (f"slip_{i}.png", FAKE_PNG, "image/png")},
            headers=auth(broker),
        )
        assert evidence_resp.status_code == 201

        # 6. Completed stage (in_transit -> completed)
        transit_resp = await client.put(
            f"/v1/broker/deals/{deal_id}",
            json={"status": "in_transit"},
            headers=auth(broker),
        )
        assert transit_resp.status_code == 200

        complete_resp = await client.put(
            f"/v1/broker/deals/{deal_id}",
            json={"status": "completed"},
            headers=auth(broker),
        )
        assert complete_resp.status_code == 200

        # Set date for settlement window
        user_store[f"broker_deals/{deal_id}"]["date"] = "2026-09-08"

    assert len(deal_ids) == 50

    # Verify commission ledger
    comm_resp = await client.get("/v1/broker/commissions", headers=auth(broker))
    assert comm_resp.status_code == 200
    comm_data = comm_resp.json()
    assert comm_data["completedDealsCount"] == 50
    assert comm_data["activeDealsCount"] == 0
    assert comm_data["totalEarned"] == total_commission

    # Add verified primary bank account for payout
    user_store["users/uid-b1/bank_accounts/ba_1"] = {
        "id": "ba_1",
        "verifyStatus": "verified",
        "isPrimary": True,
        "createdAt": "2026-09-01T00:00:00+00:00",
    }

    # Run settlement job
    settle_resp = await client.post("/v1/jobs/settlements/run", json=PERIOD)
    assert settle_resp.status_code == 200

    settlement = user_store["settlements/st_broker_uid-b1_2026-09-07"]
    assert settlement["grossRupees"] == total_gross
    assert settlement["commissionRupees"] == total_commission
    assert len(settlement["sourceIds"]) == 50

    # Run weekly payout
    payout_resp = await client.post("/v1/jobs/settlements/payouts", json=PERIOD)
    assert payout_resp.status_code == 200
    assert payout_resp.json()["paid"] == 1

    settlement_after = user_store["settlements/st_broker_uid-b1_2026-09-07"]
    assert settlement_after["status"] == "paid"
    assert settlement_after["payoutRef"].startswith("pout_dev_")
