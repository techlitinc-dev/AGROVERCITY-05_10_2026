import pytest
from tests.test_users import _auth, _register


def _verify_shop_kyc(user_store, uid="uid-1"):
    """stands in for the admin KYC review: the seller shop case is verified."""
    user_store[f"kyc_cases/kyc_{uid}_seller"] = {
        "caseId": f"kyc_{uid}_seller",
        "userId": uid,
        "persona": "seller",
        "status": "verified",
        "docs": [
            {"docId": f"kyc_{uid}_seller:apmc_licence", "type": "apmc_licence", "status": "verified"},
            {"docId": f"kyc_{uid}_seller:gst", "type": "gst", "status": "verified"},
        ],
    }


async def _seller_token(client, user_store):
    resp = await _register(client, profiles=["seller"], primaryProfile="seller")
    _verify_shop_kyc(user_store)
    return resp.json()["accessToken"]

@pytest.mark.asyncio
async def test_seller_sales_and_ledgers(client, user_store):
    token = await _seller_token(client, user_store)
    headers = _auth(token)

    # 1. Create a cash sale
    resp = await client.post(
        "/v1/seller/sales",
        headers=headers,
        json={
            "buyerName": "Suresh Patil",
            "buyerPhone": "9823001122",
            "item": "Onion Garwa (कांदा गरवा)",
            "quantity": 25.0,
            "unit": "Quintal",
            "ratePerUnit": 2400.0,
            "paymentMode": "cash",
            "amountPaid": 60300.0,
            "mandiFeePct": 0.5,
            "notes": "Mandi yard delivery",
        }
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["grossAmount"] == 60000.0
    assert data["mandiFee"] == 300.0
    assert data["netAmount"] == 60300.0
    assert data["status"] == "paid"

    # 2. Create a credit sale
    resp2 = await client.post(
        "/v1/seller/sales",
        headers=headers,
        json={
            "buyerName": "M/s Krishna Agro Traders",
            "buyerPhone": "9812345678",
            "item": "Tomato 15kg Crates",
            "quantity": 100.0,
            "unit": "Bags",
            "ratePerUnit": 450.0,
            "paymentMode": "credit",
            "amountPaid": 10000.0,
            "mandiFeePct": 0.5,
            "notes": "7 days udhaar term",
        }
    )
    assert resp2.status_code == 201
    data2 = resp2.json()
    assert data2["grossAmount"] == 45000.0
    assert data2["balanceDue"] == 35225.0
    assert data2["status"] == "partial"

    # 3. List sales
    resp_list = await client.get("/v1/seller/sales", headers=headers)
    assert resp_list.status_code == 200
    sales_data = resp_list.json()
    assert len(sales_data["data"]) >= 2
    assert sales_data["stats"]["totalRevenue"] > 0

    # 4. Check buyer ledgers
    resp_ledger = await client.get("/v1/seller/ledgers", headers=headers)
    assert resp_ledger.status_code == 200
    ledger_data = resp_ledger.json()
    assert ledger_data["totalCreditOutstanding"] >= 35225.0

    # 5. Create procurement lot
    resp_proc = await client.post(
        "/v1/seller/procurement",
        headers=headers,
        json={
            "farmerName": "Eknath Shinde",
            "farmerPhone": "9922334455",
            "crop": "Pomegranate (अनार भगवा)",
            "grossWeightKg": 3200.0,
            "tareWeightKg": 200.0,
            "netWeightQuintals": 30.0,
            "ratePerQuintal": 7500.0,
            "qualityDeductionPct": 2.0,
            "paymentStatus": "unpaid",
            "weighbridgeSlipNo": "WB-2026-9081",
        }
    )
    assert resp_proc.status_code == 201
    proc_data = resp_proc.json()
    assert proc_data["grossValue"] == 225000.0
    assert proc_data["finalAmount"] == 220500.0
    lot_id = proc_data["id"]

    # 6. Mark procurement paid
    resp_pay = await client.post(
        f"/v1/seller/procurement/{lot_id}/pay",
        headers=headers,
        params={"paymentMode": "bank_transfer", "utrNo": "HDFC000123987"}
    )
    assert resp_pay.status_code == 200
    assert resp_pay.json()["paymentStatus"] == "paid"


@pytest.mark.asyncio
async def test_seller_dashboard_summary_fields(client, user_store):
    from tests.test_mandi import MANDI_PRICES

    for doc in MANDI_PRICES:
        user_store[f"mandi_prices/{doc['id']}"] = doc
    token = await _seller_token(client, user_store)
    headers = _auth(token)

    # procurement today (unpaid -> pending farmer payment)
    resp = await client.post(
        "/v1/seller/procurement",
        headers=headers,
        json={
            "farmerName": "Eknath Shinde",
            "crop": "Pomegranate (अनार भगवा)",
            "grossWeightKg": 3200.0,
            "tareWeightKg": 200.0,
            "netWeightQuintals": 30.0,
            "ratePerQuintal": 7500.0,
            "qualityDeductionPct": 2.0,
            "paymentStatus": "unpaid",
        },
    )
    assert resp.status_code == 201
    lot = resp.json()
    # in-band rate
    resp = await client.post(
        "/v1/seller/rates",
        headers=headers,
        json={"crop": "Tomato", "ratePerKg": 21, "mandiName": "Pimpalgaon Baswant APMC"},
    )
    assert resp.status_code == 200
    # udhaar entry
    resp = await client.post(
        "/v1/seller/ledgers",
        headers=headers,
        json={
            "buyerName": "Suresh Patil",
            "buyerPhone": "9823001122",
            "type": "credit_sale",
            "amount": 2000.0,
        },
    )
    assert resp.status_code == 201

    resp = await client.get("/v1/seller/dashboard", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    for key in (
        "todayProcurement",
        "pendingFarmerPayments",
        "stockPosition",
        "rateStatus",
        "openOffers",
        "udhaarOutstanding",
        "settlementEta",
    ):
        assert key in body

    assert body["todayProcurement"]["lotsCount"] == 1
    assert body["todayProcurement"]["quantityQuintals"] == 30.0
    assert body["todayProcurement"]["amountPaisa"] == int(round(lot["finalAmount"] * 100))
    assert body["pendingFarmerPayments"]["count"] == 1
    assert body["pendingFarmerPayments"]["pinned"] is True
    assert body["stockPosition"][0]["crop"].startswith("Pomegranate")
    assert body["rateStatus"] == {"pendingCount": 1, "inBand": 1, "outOfBand": 0}
    assert body["openOffers"]["count"] == 0
    assert body["udhaarOutstanding"]["netPaisa"] == 200000
    assert "nextRunDate" in body["settlementEta"]
