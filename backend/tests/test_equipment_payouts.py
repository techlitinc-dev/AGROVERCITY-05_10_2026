"""WS-04 step 8: weekly equipment settlement payout moves real money via the
phase-00 RazorpayX client at the config-driven 12% commission; every payout
writes audit_logs (rule 3); integer paisa."""
from app.core.config import settings

PERIOD = {"periodStart": "2026-09-07", "periodEnd": "2026-09-13"}


async def _seed_completed_job(user_store, owner_uid="uid-e1", gross=10000):
    user_store[f"equipment/eq-{owner_uid}"] = {
        "id": f"eq-{owner_uid}",
        "ownerId": owner_uid,
        "name": "John Deere 5050",
        "active": True,
    }
    user_store[f"equipment_bookings/eqb-{owner_uid}-1"] = {
        "id": f"eqb-{owner_uid}-1",
        "equipmentId": f"eq-{owner_uid}",
        "status": "completed",
        "priceRupees": gross,
        "date": "2026-09-08",
    }
    user_store[f"users/{owner_uid}/bank_accounts/ba_1"] = {
        "id": "ba_1",
        "verifyStatus": "verified",
        "isPrimary": True,
        "createdAt": "2026-09-01T00:00:00+00:00",
    }


async def test_equipment_settlement_12_pct_and_payout(client, user_store, monkeypatch):
    """Gross ₹10,000 at equipmentRentalPct 12 → commission ₹1,200, net ₹8,800
    → RazorpayX payout for 880000 paisa with a payout row + audit entry."""
    await _seed_completed_job(user_store)

    resp = await client.post("/v1/jobs/settlements/run", json=PERIOD)
    assert resp.status_code == 200
    settlement = user_store["settlements/st_equipmentRental_uid-e1_2026-09-07"]
    assert settlement["grossRupees"] == 10000
    assert settlement["commissionRupees"] == 1200  # 12%
    assert settlement["netRupees"] == 8800
    assert settlement["status"] == "pending"

    resp = await client.post("/v1/jobs/settlements/payouts", json=PERIOD)
    assert resp.status_code == 200
    assert resp.json()["paid"] == 1

    settlement = user_store["settlements/st_equipmentRental_uid-e1_2026-09-07"]
    assert settlement["status"] == "paid"
    assert settlement["payoutStatus"] == "paid"
    assert settlement["payoutRef"].startswith("pout_dev_")

    audits = [d for k, d in user_store.items() if k.startswith("audit_logs/")]
    payout_audits = [a for a in audits if a.get("action") == "SETTLEMENT_PAYOUT"]
    assert len(payout_audits) == 1
    assert payout_audits[0]["role"] == "equipmentRental"
    assert payout_audits[0]["amountPaisa"] == 880000  # integer paisa


async def test_equipment_payout_holds_without_bank(client, user_store):
    await _seed_completed_job(user_store)
    user_store["users/uid-e1/bank_accounts/ba_1"]["verifyStatus"] = "pending"
    resp = await client.post("/v1/jobs/settlements/run", json=PERIOD)
    assert resp.status_code == 200
    resp = await client.post("/v1/jobs/settlements/payouts", json=PERIOD)
    assert resp.status_code == 200
    assert resp.json()["onHold"] == 1
    settlement = user_store["settlements/st_equipmentRental_uid-e1_2026-09-07"]
    assert settlement["payoutStatus"] == "onHold"
    assert settlement["payoutHoldReason"] == "no verified bank account"


async def test_equipment_commission_config_override(client, user_store, monkeypatch):
    """platform_config/settlements.equipmentRentalPct is consumed live."""
    await _seed_completed_job(user_store, gross=5000)
    user_store["platform_config/settlements"] = {
        "transportPct": 10,
        "equipmentRentalPct": 15,
        "brokerPct": 2,
        "sellerPct": 2,
        "sellerMinRupees": 50,
        "version": 2,
        "effectiveFrom": "2026-10-01T00:00:00+00:00",
    }
    resp = await client.post("/v1/jobs/settlements/run", json=PERIOD)
    assert resp.status_code == 200
    settlement = user_store["settlements/st_equipmentRental_uid-e1_2026-09-07"]
    assert settlement["commissionRupees"] == 750  # 15% of 5000
    assert settlement["netRupees"] == 4250
