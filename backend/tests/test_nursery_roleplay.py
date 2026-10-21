"""Nursery hub end-to-end roleplay — Ramesh's Nursery Journey.

Act 1: Nursery Profile Setup & Shop KYC
Act 2: Admin KYC Verification
Act 3: Plant Catalog Listing & Marketplace Sync
Act 4: Plant Batches & Stock Management (Mortality Write-Off)
Act 5: Seasonal Monsoon Offer Creation & Coupon Linking
Act 6: Farmer Browsing & Order Placement with Discount
Act 7: Nursery Order Lifecycle (Accept -> Pack -> Dispatch -> Deliver -> Invoice)
Act 8: Earnings, 5% Commission & Payout Request
Act 9: Farmer Two-Way Rating & Nursery Reply
Act 10: AI Analysis for Nursery & Nursery Care Diary
"""
from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.services.tokens import create_access_token
from tests.test_diary import auth, seed_user
from tests.test_users import _register

ADMIN = {"Authorization": "Bearer admin-token"}
ADMIN_MUTATION = {
    **ADMIN,
    "X-Admin-Role": "superadmin",
    "X-Audit-Reason": "nursery roleplay",
}


def _auth(user_id: str) -> dict[str, str]:
    token = create_access_token(user_id)
    return {"Authorization": f"Bearer {token}"}


async def test_nursery_end_to_end_roleplay(client, user_store, monkeypatch):
    # -----------------------------------------------------------------------
    # Act 1: Nursery Profile Setup & Shop KYC
    # -----------------------------------------------------------------------
    user_id = "user_ramesh_nursery"
    seed_user(
        user_store,
        user_id,
        name="Ramesh Patel",
        phone="9823001122",
        active_profile="nursery",
        available_profiles=["farmer", "nursery"],
    )
    nursery_headers = _auth(user_id)

    # Update Nursery Profile
    profile_payload = {
        "nurseryName": "Kisan Green Agro Nursery",
        "ownerName": "Ramesh Patel",
        "phone": "9823001122",
        "email": "ramesh.nursery@agrovercity.in",
        "address": "Gat 45, Pune-Solapur Highway, Uruli Kanchan",
        "district": "Pune",
        "state": "Maharashtra",
        "pincode": "412202",
        "registrationNo": "NHB/MH/2026/0891",
        "licenseNo": "LIC-PUN-NUR-44",
        "bankAccount": "50100234567890",
        "ifscCode": "HDFC0000123",
        "settlementUpi": "ramesh.nursery@okhdfcbank",
        "deliveryRadiusKm": 60,
        "specializations": ["fruit", "timber", "medicinal"],
        "documentUrls": ["https://storage.agrovercity.in/docs/nhb_cert.pdf"],
        "logoUrl": "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae",
    }
    r = await client.put("/v1/nursery/profile", json=profile_payload, headers=nursery_headers)
    assert r.status_code == 200, r.text
    profile = r.json()
    assert profile["nurseryName"] == "Kisan Green Agro Nursery"
    assert profile["registrationNo"] == "NHB/MH/2026/0891"
    assert profile["status"] == "pending"

    # -----------------------------------------------------------------------
    # Act 2: Admin KYC Verification
    # -----------------------------------------------------------------------
    # Admin lists nurseries
    r = await client.get("/v1/admin/nurseries", headers=ADMIN)
    assert r.status_code == 200
    admin_list = r.json()
    assert any(n.get("id") == user_id for n in admin_list)

    # Admin verifies nursery KYC
    r = await client.post(f"/v1/admin/nurseries/{user_id}/verify", headers=ADMIN_MUTATION)
    assert r.status_code == 200
    assert r.json()["success"] is True

    # Re-check profile as nursery
    r = await client.get("/v1/nursery/profile", headers=nursery_headers)
    assert r.status_code == 200
    assert r.json()["verified"] is True
    assert r.json()["status"] == "verified"

    # -----------------------------------------------------------------------
    # Act 3: Plant Catalog Listing & Marketplace Synchronization
    # -----------------------------------------------------------------------
    # Plant 1: Kesar Mango Grafted Sapling (Fruit)
    plant1_in = {
        "title": "Kesar Mango Grafted Sapling",
        "species": "Mango (आंबा)",
        "variety": "Gir Kesar",
        "category": "fruit",
        "plantAge": "2 years",
        "plantHeight": "3 ft",
        "mrp": 220.0,
        "price": 180.0,
        "stock": 200,
        "unit": "sapling",
        "minOrderQty": 5,
        "description": "High-yield genuine Gir Kesar grafted saplings with certified rootstock.",
        "imageUrl": "https://images.unsplash.com/photo-1553279768-865429fa0078",
        "status": "active",
    }
    r = await client.post("/v1/nursery/plants", json=plant1_in, headers=nursery_headers)
    assert r.status_code == 201
    plant1 = r.json()
    plant1_id = plant1["id"]
    assert plant1["price"] == 180.0

    # Plant 2: Malabar Neem (Timber)
    plant2_in = {
        "title": "Malabar Neem Agroforestry Sapling",
        "species": "Melia Dubia / महाकडुलिंब",
        "variety": "Tissue Cultured",
        "category": "timber",
        "plantAge": "1 year",
        "plantHeight": "2.5 ft",
        "mrp": 60.0,
        "price": 45.0,
        "stock": 500,
        "unit": "sapling",
        "minOrderQty": 20,
        "description": "Fast-growing commercial timber saplings ideal for farmland boundaries.",
        "imageUrl": "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09",
        "status": "active",
    }
    r = await client.post("/v1/nursery/plants", json=plant2_in, headers=nursery_headers)
    assert r.status_code == 201
    plant2 = r.json()
    plant2_id = plant2["id"]

    # Verify listing via GET /v1/nursery/plants
    r = await client.get("/v1/nursery/plants", headers=nursery_headers)
    assert r.status_code == 200
    plants = r.json()
    assert len(plants) >= 2

    # Verify mirror product exists in shared products collection
    r = await client.get(f"/v1/products/{plant1_id}", headers=nursery_headers)
    assert r.status_code == 200
    prod = r.json()
    assert prod["discountedPrice"] == 180.0
    assert prod["dealerName"] == "Kisan Green Agro Nursery"

    # -----------------------------------------------------------------------
    # Act 4: Plant Batches & Stock Management (Mortality Write-Off)
    # -----------------------------------------------------------------------
    batch_in = {
        "batchNo": "BATCH-2026-MG01",
        "plantId": plant1_id,
        "species": "Gir Kesar Mango",
        "propagationDate": "2026-01-15",
        "initialCount": 200,
        "currentStock": 200,
        "nurseryBed": "Polyhouse Bed A-3",
        "notes": "Healthy graft union check completed.",
    }
    r = await client.post("/v1/nursery/batches", json=batch_in, headers=nursery_headers)
    assert r.status_code == 201
    batch = r.json()
    batch_id = batch["id"]

    # Record mortality write-off (-5 saplings due to heat stress)
    stock_out_payload = {
        "quantity": 5,
        "reason": "mortality",
        "notes": "Unseasonal heat wave mortality in bed A-3",
    }
    r = await client.post(f"/v1/nursery/batches/{batch_id}/stock-out", json=stock_out_payload, headers=nursery_headers)
    assert r.status_code == 200
    res = r.json()
    assert res["batch"]["currentStock"] == 195
    assert res["batch"]["mortalityCount"] == 5

    # Check stock alerts
    r = await client.get("/v1/nursery/stock/alerts", headers=nursery_headers)
    assert r.status_code == 200

    # -----------------------------------------------------------------------
    # Act 5: Seasonal Monsoon Offer Creation & Coupon Linking
    # -----------------------------------------------------------------------
    valid_until = (datetime.now(timezone.utc) + timedelta(days=90)).isoformat()
    offer_in = {
        "code": "MONSOON20",
        "title": "Monsoon Plantation Drive 20% Off",
        "discountPct": 20.0,
        "minOrderAmount": 500.0,
        "maxDiscountAmount": 200.0,
        "validUntil": valid_until,
        "bannerUrl": "https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8",
    }
    r = await client.post("/v1/nursery/offers", json=offer_in, headers=nursery_headers)
    assert r.status_code == 201
    offer = r.json()
    assert offer["code"] == "MONSOON20"

    # Check offers list
    r = await client.get("/v1/nursery/offers", headers=nursery_headers)
    assert r.status_code == 200
    assert len(r.json()) >= 1

    # -----------------------------------------------------------------------
    # Act 6: Farmer Browsing & Order Placement with Coupon Discount
    # -----------------------------------------------------------------------
    farmer_id = "user_suresh_farmer"
    seed_user(
        user_store,
        farmer_id,
        name="Suresh Deshmukh",
        phone="9890112233",
        active_profile="farmer",
        available_profiles=["farmer"],
    )
    farmer_headers = _auth(farmer_id)

    # Place order for 10 Kesar Mango saplings (10 * 180 = 1800, discount 200 => final 1600)
    order_in = {
        "items": [{"productId": plant1_id, "quantity": 10}],
        "paymentMethod": "upi",
        "deliveryAddress": "Suresh Farm, Post Hadapsar, Pune - 411028",
        "idempotencyKey": "order_nursery_001",
        "couponCode": "MONSOON20",
    }
    r = await client.post("/v1/orders", json=order_in, headers=farmer_headers)
    assert r.status_code == 200, r.text
    order_resp = r.json()
    order_id = order_resp["orderId"]
    assert order_resp["discount"] == 200
    assert order_resp["finalTotal"] == 1600

    # orders.py auto-stamps nurseryId/sellerId at placement — assert the stamp
    # rather than hand-tagging it.
    order_doc = user_store.get(f"orders/{order_id}")
    assert order_doc.get("nurseryId") == user_id, "placement must stamp nurseryId"

    # -----------------------------------------------------------------------
    # Act 7: Nursery Order Lifecycle (Accept -> Pack -> Dispatch -> Deliver -> Invoice)
    # -----------------------------------------------------------------------
    # Nursery checks incoming orders
    r = await client.get("/v1/nursery/orders", headers=nursery_headers)
    assert r.status_code == 200
    orders = r.json()
    assert any(o["id"] == order_id for o in orders)

    # 1. Accept
    r = await client.post(
        f"/v1/nursery/orders/{order_id}/status",
        json={"status": "accepted", "notes": "Order accepted, preparing saplings"},
        headers=nursery_headers,
    )
    assert r.status_code == 200
    assert r.json()["order"]["status"] == "accepted"

    # 2. Pack
    r = await client.post(
        f"/v1/nursery/orders/{order_id}/status",
        json={"status": "packed", "notes": "Packed in perforated ventilated cartons with root-moisture gel"},
        headers=nursery_headers,
    )
    assert r.status_code == 200
    assert r.json()["order"]["status"] == "packed"

    # 3. Dispatch
    r = await client.post(
        f"/v1/nursery/orders/{order_id}/status",
        json={
            "status": "dispatched",
            "courierName": "Agro Logistics Van",
            "trackingNumber": "TRK-MH12-8821",
            "notes": "Vehicle left nursery dispatch dock",
        },
        headers=nursery_headers,
    )
    assert r.status_code == 200
    assert r.json()["order"]["status"] == "dispatched"
    assert r.json()["order"]["trackingNumber"] == "TRK-MH12-8821"

    # 4. Deliver
    r = await client.post(
        f"/v1/nursery/orders/{order_id}/status",
        json={"status": "delivered", "notes": "Safely delivered at Suresh Farm, accepted by farmer"},
        headers=nursery_headers,
    )
    assert r.status_code == 200
    assert r.json()["order"]["status"] == "delivered"

    # Download Tax Invoice
    r = await client.get(f"/v1/nursery/orders/{order_id}/invoice", headers=nursery_headers)
    assert r.status_code == 200
    inv = r.json()
    assert "INV-NUR-" in inv["invoiceNumber"]
    assert inv["total"] == 1600.0
    assert inv["nursery"]["name"] == "Kisan Green Agro Nursery"

    # -----------------------------------------------------------------------
    # Act 8: Earnings, 5% Commission & Payout Request
    # -----------------------------------------------------------------------
    r = await client.get("/v1/nursery/payouts", headers=nursery_headers)
    assert r.status_code == 200
    payout_data = r.json()
    assert payout_data["grossRevenue"] == 1600.0
    assert payout_data["commissionPct"] == 5.0
    assert payout_data["commissionDeducted"] == 80.0
    assert payout_data["netEarnings"] == 1520.0
    assert payout_data["availableBalance"] == 1520.0

    # Request Payout
    payout_req = {
        "amount": 1500.0,
        "settlementUpi": "ramesh.nursery@okhdfcbank",
        "notes": "Weekly earnings settlement",
    }
    r = await client.post("/v1/nursery/payouts/request", json=payout_req, headers=nursery_headers)
    assert r.status_code == 201
    assert r.json()["amount"] == 1500.0

    # Export CSV
    r = await client.get("/v1/nursery/payouts/export", headers=nursery_headers)
    assert r.status_code == 200
    assert "PayoutID,Amount" in r.text

    # -----------------------------------------------------------------------
    # Act 9: Farmer Two-Way Rating & Nursery Reply
    # -----------------------------------------------------------------------
    # Farmer rates the plant purchase
    rating_in = {
        "bookingKind": "nursery",
        "bookingId": order_id,
        "stars": 5,
        "comment": "Exceptional graft quality! Saplings arrived fresh and moist.",
        "tags": ["HEALTHY_PLANTS", "SECURE_PACKING", "ON_TIME_DELIVERY"],
    }
    r = await client.post("/v1/ratings", json=rating_in, headers=farmer_headers)
    assert r.status_code == 201
    rating_resp = r.json()
    rating_id = rating_resp["id"]

    # Nursery replies to farmer review
    reply_in = {"reply": "धन्यवाद Suresh ji! Happy farming. Water regularly for first 2 weeks."}
    r = await client.post(f"/v1/ratings/{rating_id}/reply", json=reply_in, headers=nursery_headers)
    assert r.status_code == 200
    assert r.json()["reply"] == reply_in["reply"]

    # -----------------------------------------------------------------------
    # Act 10: AI Analysis for Nursery & Nursery Care Diary
    # -----------------------------------------------------------------------
    # Nursery checks AI analysis
    r = await client.get("/v1/nursery/ai-insights", headers=nursery_headers)
    assert r.status_code == 200
    ai = r.json()
    assert "seasonalTrend" in ai
    assert "salesForecast" in ai
    assert "pricingSuggestions" in ai
    assert "stockPlanning" in ai

    # Nursery logs a plant care entry in Diary
    diary_in = {
        "title": "Neem Oil & Micronutrient Spray on Bed A-3",
        "category": "plant_care",
        "type": "farmActivity",
        "date": "2026-05-15",
        "amount": 450.0,
        "notes": "Foliar spray of micronutrients and neem oil applied to Bed A-3 grafts.",
    }
    r = await client.post("/v1/diary/entries", json=diary_in, headers=nursery_headers)
    assert r.status_code == 201

    # Verify Dashboard stats
    r = await client.get("/v1/nursery/dashboard", headers=nursery_headers)
    assert r.status_code == 200
    dash = r.json()
    assert dash["stats"]["totalPlantsListed"] >= 2
    assert dash["stats"]["totalOrders"] >= 1
    assert dash["stats"]["deliveredOrdersCount"] >= 1
    assert dash["stats"]["grossRevenue"] == 1600.0
