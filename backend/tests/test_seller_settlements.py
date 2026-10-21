"""VYAPARI V11: seller weekly settlements (buy-side purchases + POS sales +
resale supply), the GST sales register over users/{uid}/seller_sales, and
GET /seller/orders ownership scoping."""
from app.services.tokens import create_access_token

PERIOD = {"periodStart": "2026-10-05", "periodEnd": "2026-10-11"}
COMPLETED_AT = "2026-10-07T10:00:00+00:00"


def _seed_user(user_store, uid, name, profiles, active=None, **extra):
    user_store[f"users/{uid}"] = {
        "id": uid,
        "name": name,
        "phone": "+919876543210",
        "state": "Maharashtra",
        "linkedProfiles": profiles,
        "primaryProfile": active or profiles[-1],
        "activeProfile": active or profiles[-1],
        **extra,
    }
    return create_access_token(uid)


def _completed_purchase(pid, buyer_id, farmer_id, source, total=20000, **extra):
    doc = {
        "id": pid,
        "buyerId": buyer_id,
        "buyerName": "Buyer",
        "farmerId": farmer_id,
        "farmerName": "Supplier",
        "source": source,
        "crop": "Tomato",
        "variety": "",
        "quantity": 10.0,
        "unit": "quintal",
        "agreedPricePerUnit": 2000,
        "totalAmount": total,
        "finalAmount": total,
        "status": "completed",
        "events": [
            {"status": "confirmed", "at": "2026-10-06T09:00:00+00:00", "note": ""},
            {"status": "completed", "at": COMPLETED_AT, "note": ""},
        ],
        "payments": [],
        "createdAt": "2026-10-06T09:00:00+00:00",
        "updatedAt": COMPLETED_AT,
    }
    doc.update(extra)
    return doc


# ---- GET /seller/settlements ----


async def test_seller_settlements_empty_and_role_gate(client, user_store):
    seller = _seed_user(user_store, "uid-s1", "Vijay Vyapari", ["farmer", "seller"])
    farmer = _seed_user(user_store, "uid-f1", "Ram Patel", ["farmer"])

    resp = await client.get("/v1/seller/settlements", headers={"Authorization": f"Bearer {seller}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"] == []
    assert body["total"] == 0

    denied = await client.get("/v1/seller/settlements", headers={"Authorization": f"Bearer {farmer}"})
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "FORBIDDEN_ROLE"


async def test_seller_settlements_run_aggregates_three_streams(client, user_store):
    seller = _seed_user(user_store, "uid-s1", "Vijay Vyapari", ["farmer", "seller"])
    _seed_user(user_store, "uid-f1", "Ram Patel", ["farmer"])
    buyer = _seed_user(user_store, "uid-b1", "Hotel Buyer", ["directBuyer"])

    # 1. completed purchase bought by the seller (buy-side gross)
    user_store["purchases/pur_buy"] = _completed_purchase(
        "pur_buy", "uid-s1", "uid-f1", {"type": "lot", "refId": "lot_x"}, total=20000
    )
    # 2. completed resale purchase supplied by the seller (resale gross)
    user_store["purchases/pur_resale"] = _completed_purchase(
        "pur_resale",
        "uid-b1",
        "uid-s1",
        {"type": "resale_listing", "refId": "rel_1"},
        total=15000,
    )
    # 3. POS sale in the seller's subcollection
    user_store["users/uid-s1/seller_sales/sale_1"] = {
        "id": "sale_1",
        "sellerId": "uid-s1",
        "buyerName": "Walk-in Customer",
        "item": "Onion",
        "quantity": 5.0,
        "unit": "Quintal",
        "netAmount": 5000.0,
        "amountPaid": 5000.0,
        "balanceDue": 0.0,
        "createdAt": "2026-10-08T06:30:00+00:00",
    }
    # noise: a completed purchase that involves no seller at all
    user_store["purchases/pur_noise"] = _completed_purchase(
        "pur_noise", "uid-b1", "uid-f1", {"type": "lot", "refId": "lot_y"}, total=9000
    )
    # noise: a completed purchase outside the period
    user_store["purchases/pur_old"] = _completed_purchase(
        "pur_old",
        "uid-s1",
        "uid-f1",
        {"type": "lot", "refId": "lot_z"},
        total=7000,
        events=[
            {"status": "confirmed", "at": "2026-09-20T09:00:00+00:00", "note": ""},
            {"status": "completed", "at": "2026-09-22T10:00:00+00:00", "note": ""},
        ],
    )

    run = await client.post("/v1/jobs/settlements/run", json=PERIOD)
    assert run.status_code == 200

    doc = user_store["settlements/st_seller_uid-s1_2026-10-05"]
    assert doc["role"] == "seller"
    assert doc["entityId"] == "uid-s1"
    # 20000 buy-side + 15000 resale supply + 5000 POS = 40000 gross
    assert doc["grossRupees"] == 40000
    assert doc["commissionRupees"] == 800  # sellerPct 2
    assert doc["netRupees"] == 39200
    assert doc["status"] == "pending"
    assert sorted(doc["sourceIds"]) == ["pur_buy", "pur_resale", "sale_1"]

    # no seller line for non-seller parties
    assert not any(k.startswith("settlements/st_seller_uid-f1") for k in user_store)
    assert not any(k.startswith("settlements/st_seller_uid-b1") for k in user_store)

    # TDS 194-O + commission invoice ride the same accrual
    tds = user_store["tds_ledger/tds_st_seller_uid-s1_2026-10-05"]
    assert tds["persona"] == "seller"
    assert tds["grossPaisa"] == 4000000
    assert tds["tdsPaisa"] == 40000

    resp = await client.get("/v1/seller/settlements", headers={"Authorization": f"Bearer {seller}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["data"][0]["id"] == "st_seller_uid-s1_2026-10-05"
    assert body["data"][0]["netRupees"] == 39200

    # another persona cannot read the seller's lines
    denied = await client.get(
        "/v1/seller/settlements", headers={"Authorization": f"Bearer {buyer}"}
    )
    assert denied.status_code == 403


# ---- GET /seller/gst-reports ----


async def test_gst_reports_read_subcollection_sales_with_fallback_gstin(client, user_store):
    seller = _seed_user(user_store, "uid-s1", "Vijay Vyapari", ["farmer", "seller"])
    headers = {"Authorization": f"Bearer {seller}"}

    user_store["users/uid-s1/seller_sales/sale_a"] = {
        "id": "sale_a",
        "sellerId": "uid-s1",
        "buyerName": "Direct Foods",
        "item": "Soybean",
        "quantity": 12.0,
        "unit": "Quintal",
        "netAmount": 60000.0,
        "createdAt": "2026-10-06T08:00:00+00:00",
    }
    user_store["users/uid-s1/seller_sales/sale_b"] = {
        "id": "sale_b",
        "sellerId": "uid-s1",
        "buyerName": "Old Buyer",
        "item": "Wheat",
        "quantity": 4.0,
        "unit": "Quintal",
        "netAmount": 8000.0,
        "createdAt": "2026-09-30T08:00:00+00:00",  # outside the filter window
    }
    # no role profile → GSTIN falls back to "—"
    resp = await client.get("/v1/seller/gst-reports?from=2026-10-01&to=2026-10-31", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["sellerGstin"] == "—"
    assert len(data["records"]) == 1
    record = data["records"][0]
    assert record["id"] == "sale_a"
    assert record["crop"] == "Soybean"
    assert record["quantity"] == 12.0
    assert record["unit"] == "Quintal"
    assert record["invoiceValue"] == 60000.0
    assert data["summary"]["recordCount"] == 1

    # with a profile GSTIN it is used instead of the fallback
    user_store["users/uid-s1/role_profiles/seller"] = {
        "shopName": "Vijay Traders",
        "gstNumber": "27AAACV1234A1Z5",
    }
    resp = await client.get("/v1/seller/gst-reports", headers=headers)
    assert resp.json()["sellerGstin"] == "27AAACV1234A1Z5"


# ---- GET /seller/orders ----


async def test_seller_orders_scoping_and_enrichment(client, user_store):
    seller = _seed_user(user_store, "uid-s1", "Vijay Vyapari", ["farmer", "seller"])
    other_seller = _seed_user(user_store, "uid-s2", "Suresh Seller", ["seller"])
    customer = _seed_user(user_store, "uid-c1", "Kiran Customer", ["emarketCustomer"])
    farmer = _seed_user(user_store, "uid-f1", "Ram Patel", ["farmer"])
    headers = {"Authorization": f"Bearer {seller}"}

    user_store["products/prod_1"] = {
        "id": "prod_1",
        "sellerId": "uid-s1",
        "title": "Premium Tomato Seeds",
        "discountedPrice": 450,
        "stock": 100,
    }
    user_store["products/prod_2"] = {
        "id": "prod_2",
        "sellerId": "uid-s2",
        "title": "Other Seller Seeds",
        "discountedPrice": 300,
        "stock": 50,
    }

    # top-level sellerId ownership
    user_store["orders/ord_1"] = {
        "id": "ord_1",
        "sellerId": "uid-s1",
        "userId": "uid-c1",
        "status": "confirmed",
        "total": 900,
        "items": [{"productId": "prod_1", "quantity": 2}],
        "events": [{"status": "placed", "at": "2026-10-10T09:00:00+00:00", "note": ""}],
        "createdAt": "2026-10-10T09:00:00+00:00",
    }
    # item-level sellerId ownership (resolved via the products catalog)
    user_store["orders/ord_2"] = {
        "id": "ord_2",
        "userId": "uid-c1",
        "status": "placed",
        "total": 450,
        "items": [{"productId": "prod_1", "quantity": 1}],
        "events": [{"status": "placed", "at": "2026-10-12T09:00:00+00:00", "note": ""}],
        "createdAt": "2026-10-12T09:00:00+00:00",
    }
    # noise: another seller's order and another customer's order
    user_store["orders/ord_3"] = {
        "id": "ord_3",
        "sellerId": "uid-s2",
        "userId": "uid-c1",
        "status": "placed",
        "total": 300,
        "items": [{"productId": "prod_2", "quantity": 1}],
        "createdAt": "2026-10-11T09:00:00+00:00",
    }
    user_store["orders/ord_4"] = {
        "id": "ord_4",
        "userId": "uid-f1",
        "status": "placed",
        "total": 100,
        "items": [],
        "createdAt": "2026-10-13T09:00:00+00:00",
    }

    resp = await client.get("/v1/seller/orders", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    # newest first
    assert [o["id"] for o in body["data"]] == ["ord_2", "ord_1"]
    first = body["data"][0]
    assert first["status"] == "placed"
    assert first["total"] == 450
    assert first["items"][0]["title"] == "Premium Tomato Seeds"
    assert first["items"][0]["price"] == 450
    assert first["items"][0]["sellerId"] == "uid-s1"
    assert first["buyer"]["id"] == "uid-c1"
    assert first["buyer"]["name"] == "Kiran Customer"

    # role-gated to sellers
    denied = await client.get("/v1/seller/orders", headers={"Authorization": f"Bearer {customer}"})
    assert denied.status_code == 403
    _ = other_seller  # seeded for completeness; ord_3 must stay out of the list
