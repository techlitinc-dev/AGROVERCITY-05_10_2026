"""B7: buyer payment splits at capture — farmer leg + platform commission leg
via the phase-00 Razorpay route/split integration; integer paisa; legs sum to
the gross; audit_logs on every capture (rule 3)."""
from tests.test_broker_payouts import _completed_deal
from tests.test_broker_deals import _seed_broker
from tests.test_diary import auth


def _verify_broker_kyc(user_store, uid="uid-b1"):
    """stands in for the admin KYC review: arhtiya licence + GST verified."""
    user_store[f"kyc_cases/kyc_{uid[:8]}_broker"] = {
        "caseId": f"kyc_{uid[:8]}_broker",
        "userId": uid,
        "persona": "broker",
        "status": "verified",
        "docs": [
            {"docId": f"kyc_{uid[:8]}_broker:arhtiya_licence", "type": "arhtiya_licence", "status": "verified"},
            {"docId": f"kyc_{uid[:8]}_broker:gst", "type": "gst", "status": "verified"},
        ],
    }


async def test_payment_capture_splits_farmer_and_commission_legs(client, user_store):
    broker = _seed_broker(user_store)
    _verify_broker_kyc(user_store)
    deal = await _completed_deal(client, user_store, broker)
    user_store[f"broker_deals/{deal['id']}"]["status"] = "accepted"

    resp = await client.post(
        f"/v1/broker/deals/{deal['id']}/payment-capture", headers=auth(broker)
    )
    assert resp.status_code == 200
    capture = resp.json()
    # legs sum to the gross (B7 invariant), integer paisa
    assert capture["grossPaisa"] == 11000000
    assert capture["commissionLegPaisa"] == 220000  # 2%
    assert capture["farmerLegPaisa"] + capture["commissionLegPaisa"] == capture["grossPaisa"]
    assert capture["razorpayRef"].startswith("pay_split_dev_")

    # rule 3: the capture writes audit_logs
    audits = [
        d for k, d in user_store.items()
        if k.startswith("audit_logs/") and d.get("action") == "DEAL_PAYMENT_CAPTURE"
    ]
    assert len(audits) == 1
    assert audits[0]["farmerLegPaisa"] == 10780000

    # double capture is refused
    resp = await client.post(
        f"/v1/broker/deals/{deal['id']}/payment-capture", headers=auth(broker)
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "ALREADY_CAPTURED"


async def test_capture_requires_accepted_deal(client, user_store):
    broker = _seed_broker(user_store)
    _verify_broker_kyc(user_store)
    deal = await _completed_deal(client, user_store, broker)
    user_store[f"broker_deals/{deal['id']}"]["status"] = "negotiating"
    resp = await client.post(
        f"/v1/broker/deals/{deal['id']}/payment-capture", headers=auth(broker)
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "INVALID_STATE"
