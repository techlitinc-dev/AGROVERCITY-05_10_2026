"""Agri Market Seller — agrisellerinstructions.md (Agri_market_seller 21 nov.xlsx).

Covers Sr 1 shop profile, Sr 2 dashboard, Sr 3/24 products & pricing,
Sr 4 stock, Sr 5/25 orders & dispatch, Sr 6 coupons, Sr 22/23 enquiries &
quotations, Sr 26 reviews, Sr 27 reports, Sr 9 insights, persona access.
"""
from tests.test_diary import auth, seed_user


def _seed_seller(user_store, uid="uid-s1", **overrides):
    overrides.setdefault("active_profile", "seller")
    return seed_user(
        user_store,
        uid=uid,
        name="Amit Agro",
        village="Pune",
        district="Pune",
        **overrides,
    )


def _seed_farmer(user_store, uid="uid-f1"):
    return seed_user(user_store, uid=uid, name="Ramesh Patil")


async def _mk_product(client, token, **overrides):
    payload = {
        "title": "Organic Vermicompost 5kg",
        "category": "Organic Inputs",
        "mrp": 499.0,
        "discountedPrice": 449.0,
        "stock": 20,
    }
    payload.update(overrides)
    resp = await client.post("/v1/my-products", json=payload, headers=auth(token))
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _mk_order(user_store, seller_uid="uid-s1", buyer_uid="uid-f1", status="placed", qty=2, price=449.0):
    order_id = f"ord_{status}_1"
    user_store[f"orders/{order_id}"] = {
        "id": order_id,
        "userId": buyer_uid,
        "sellerId": seller_uid,
        "items": [{"productId": "prod_x", "title": "Vermicompost", "quantity": qty, "price": price}],
        "total": round(price * qty, 2),
        "status": status,
        "events": [],
        "createdAt": "2026-11-20T10:00:00+00:00",
    }
    return order_id


# ---------------------------------------------------------------- Sr 1 shop profile


async def test_shop_profile_roundtrip(client, user_store):
    token = _seed_seller(user_store, active_profile="agriMarketSeller")
    put = await client.put(
        "/v1/agri-market-seller/shop",
        json={
            "shopName": "Amit Agro Shop",
            "bankName": "SBI Baramati",
            "bankAccountNumber": "12345678901",
            "bankIfsc": "SBIN0001234",
            "deliveryArea": "Baramati, Pune",
            "pickupAddress": "Shop 4, Mandi Road, Baramati",
            "documentIds": ["doc_pan", "doc_gst"],
        },
        headers=auth(token),
    )
    assert put.status_code == 200
    body = put.json()
    assert body["shopName"] == "Amit Agro Shop"
    assert body["deliveryArea"] == "Baramati, Pune"
    assert body["documentIds"] == ["doc_pan", "doc_gst"]

    got = await client.get("/v1/agri-market-seller/shop", headers=auth(token))
    assert got.json()["pickupAddress"] == "Shop 4, Mandi Road, Baramati"


# ------------------------------------------------------- Sr 3/24 products & pricing


async def test_product_pricing_extensions(client, user_store):
    token = _seed_seller(user_store)
    product = await _mk_product(client, token)
    pid = product["id"]

    resp = await client.put(
        f"/v1/agri-market-seller/products/{pid}/pricing",
        json={
            "variants": [{"name": "5kg", "unit": "bag", "pricePaisa": 44900}],
            "units": "bag",
            "specifications": {"npk": "2-1-1", "organic": "yes"},
            "minOrderQty": 1,
            "maxOrderQty": 200,
            "slabs": [{"minQty": 50, "pricePaisa": 39900}],
            "lowStockThreshold": 10,
        },
        headers=auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["variants"][0]["name"] == "5kg"
    assert body["slabs"][0]["pricePaisa"] == 39900
    assert body["minOrderQty"] == 1 and body["maxOrderQty"] == 200
    assert body["lowStockThreshold"] == 10

    bad = await client.put(
        f"/v1/agri-market-seller/products/{pid}/pricing",
        json={"minOrderQty": 10, "maxOrderQty": 5},
        headers=auth(token),
    )
    assert bad.status_code == 422


# ------------------------------------------------------------------- Sr 4 stock


async def test_stock_entries_reserved_and_low_stock(client, user_store):
    token = _seed_seller(user_store)
    product = await _mk_product(client, token, stock=20)
    pid = product["id"]

    entry_in = await client.post(
        "/v1/agri-market-seller/stock/entries",
        json={"productId": pid, "kind": "in", "quantity": 10, "reason": "fresh batch"},
        headers=auth(token),
    )
    assert entry_in.status_code == 201
    assert entry_in.json()["after"] == 30

    entry_out = await client.post(
        "/v1/agri-market-seller/stock/entries",
        json={"productId": pid, "kind": "out", "quantity": 5, "reason": "damaged"},
        headers=auth(token),
    )
    assert entry_out.json()["after"] == 25

    # reserved: an open order for 2 units of this product
    user_store["orders/ord_open1"] = {
        "id": "ord_open1", "userId": "uid-f1", "sellerId": "uid-s1",
        "items": [{"productId": pid, "title": "Vermicompost", "quantity": 2, "price": 449.0}],
        "status": "confirmed", "createdAt": "2026-11-21T10:00:00+00:00",
    }

    stock = (await client.get("/v1/agri-market-seller/stock", headers=auth(token))).json()
    row = next(r for r in stock["items"] if r["productId"] == pid)
    assert row["availability"] == 25
    assert row["reserved"] == 2
    assert row["lowStock"] is False  # threshold default 5 → 25 > 5

    # adjust down to threshold → low-stock alert
    await client.post(
        "/v1/agri-market-seller/stock/entries",
        json={"productId": pid, "kind": "adjust", "quantity": 5, "reason": "physical count"},
        headers=auth(token),
    )
    stock = (await client.get("/v1/agri-market-seller/stock", headers=auth(token))).json()
    row = next(r for r in stock["items"] if r["productId"] == pid)
    assert row["availability"] == 5 and row["lowStock"] is True
    assert any(a["productId"] == pid for a in stock["lowStockAlerts"])

    moves = (await client.get("/v1/agri-market-seller/stock/movements", params={"productId": pid}, headers=auth(token))).json()
    assert len(moves["items"]) == 3
    assert [m["kind"] for m in moves["items"]] == ["adjust", "out", "in"]  # newest first


# ------------------------------------------------------------- Sr 5/25 orders & dispatch


async def test_order_action_pipeline_and_labels(client, user_store):
    token = _seed_seller(user_store)
    oid = await _mk_order(user_store, status="placed")
    resp = await client.post(
        f"/v1/agri-market-seller/orders/{oid}/action", json={"action": "accept"}, headers=auth(token)
    )
    assert resp.json()["status"] == "confirmed"

    # process is a label step on confirmed
    proc = await client.post(
        f"/v1/agri-market-seller/orders/{oid}/action", json={"action": "process"}, headers=auth(token)
    )
    assert proc.json()["status"] == "confirmed"
    assert proc.json()["sellerTimeline"][-1]["action"] == "process"

    for action, expected in (("pack", "shipped"), ("ship", "out_for_delivery"), ("deliver", "delivered")):
        resp = await client.post(
            f"/v1/agri-market-seller/orders/{oid}/action", json={"action": action}, headers=auth(token)
        )
        assert resp.json()["status"] == expected, action

    # invalid: pack after delivery
    bad = await client.post(
        f"/v1/agri-market-seller/orders/{oid}/action", json={"action": "pack"}, headers=auth(token)
    )
    assert bad.status_code == 409

    # rating prompt opened for the buyer on delivery
    prompts = [
        doc for key, doc in user_store.items()
        if key.startswith("users/uid-f1/rating_prompts/")
    ]
    assert any(p.get("kind") == "marketplace_order" for p in prompts)


async def test_order_reject_restores_stock_and_dispatch(client, user_store):
    token = _seed_seller(user_store)
    product = await _mk_product(client, token, stock=10)
    pid = product["id"]
    user_store["orders/ord_rej1"] = {
        "id": "ord_rej1", "userId": "uid-f1", "sellerId": "uid-s1",
        "items": [{"productId": pid, "title": "Vermicompost", "quantity": 3, "price": 449.0}],
        "status": "paid", "events": [], "createdAt": "2026-11-21T10:00:00+00:00",
    }
    resp = await client.post(
        "/v1/agri-market-seller/orders/ord_rej1/action",
        json={"action": "reject", "note": "out of stock"},
        headers=auth(token),
    )
    assert resp.json()["status"] == "cancelled"
    assert user_store[f"products/{pid}"]["stock"] == 13

    # dispatch fields
    user_store["orders/ord_disp1"] = {
        "id": "ord_disp1", "userId": "uid-f1", "sellerId": "uid-s1",
        "items": [{"productId": pid, "title": "Vermicompost", "quantity": 1, "price": 449.0}],
        "status": "confirmed", "events": [], "createdAt": "2026-11-21T10:00:00+00:00",
    }
    put = await client.put(
        "/v1/agri-market-seller/orders/ord_disp1/dispatch",
        json={"dispatchDate": "2026-11-24", "deliveryPartner": "DHL", "trackingRef": "DHL123"},
        headers=auth(token),
    )
    assert put.json()["deliveryPartner"] == "DHL"
    got = await client.get("/v1/agri-market-seller/orders/ord_disp1/dispatch", headers=auth(token))
    assert got.json()["trackingRef"] == "DHL123"


# ------------------------------------------------------------- Sr 22/23 enquiries & quotes


async def _mk_enquiry(client, seller_token, farmer_token):
    product = await _mk_product(client, seller_token)
    posted = await client.post(
        f"/v1/agri-market-seller/products/{product['id']}/enquiries",
        json={"quantity": "50 bags", "message": "Best rate for 50?"},
        headers=auth(farmer_token),
    )
    assert posted.status_code == 201
    return product, posted.json()


async def test_enquiry_inbox_respond_convert(client, user_store):
    stoken = _seed_seller(user_store)
    ftoken = _seed_farmer(user_store)
    product, enquiry = await _mk_enquiry(client, stoken, ftoken)

    inbox = (await client.get("/v1/agri-market-seller/enquiries", headers=auth(stoken))).json()
    assert inbox["items"][0]["productTitle"] == "Organic Vermicompost 5kg"
    assert inbox["items"][0]["status"] == "pending"
    assert inbox["items"][0]["quantity"] == "50 bags"

    responded = await client.post(
        f"/v1/agri-market-seller/enquiries/{enquiry['id']}/respond",
        json={"response": "₹399/bag for 50+"},
        headers=auth(stoken),
    )
    assert responded.json()["status"] == "responded"

    # convert to quotation
    conv = await client.post(
        f"/v1/agri-market-seller/enquiries/{enquiry['id']}/convert",
        json={"to": "quotation"},
        headers=auth(stoken),
    )
    assert conv.status_code == 201
    quotation = conv.json()["quotation"]
    assert quotation["number"].startswith("QS-")
    assert quotation["status"] == "sent"
    assert quotation["items"][0]["unitPricePaisa"] == 44900

    # duplicate convert is rejected
    again = await client.post(
        f"/v1/agri-market-seller/enquiries/{enquiry['id']}/convert",
        json={"to": "order"},
        headers=auth(stoken),
    )
    assert again.status_code == 409


async def test_enquiry_convert_to_order_and_quotation_accept(client, user_store):
    stoken = _seed_seller(user_store)
    ftoken = _seed_farmer(user_store)
    product, enquiry = await _mk_enquiry(client, stoken, ftoken)

    conv = await client.post(
        f"/v1/agri-market-seller/enquiries/{enquiry['id']}/convert",
        json={"to": "order"},
        headers=auth(stoken),
    )
    order = conv.json()["order"]
    assert order["status"] == "placed"
    assert order["source"] == "seller_enquiry"
    # "50 bags" is free text → quantity falls back to 1 → 20 - 1 = 19
    assert user_store[f"products/{product['id']}"]["stock"] == 19

    # direct quotation with taxes/discounts, accepted by the farmer → order
    created = await client.post(
        "/v1/agri-market-seller/quotations",
        json={
            "buyerUid": "uid-f1",
            "items": [{"title": "Vermicompost", "unitPricePaisa": 44900, "quantity": 10}],
            "discountPaisa": 5000,
            "taxesPaisa": 2000,
            "delivery": {"mode": "seller_delivery", "chargePaisa": 0},
            "validUntil": "2026-12-31",
        },
        headers=auth(stoken),
    )
    assert created.status_code == 201
    doc = created.json()
    assert doc["subtotalPaisa"] == 449000
    assert doc["totalPaisa"] == 446000  # 449000 - 5000 + 2000
    assert doc["delivery"]["mode"] == "seller_delivery"

    accepted = await client.post(
        f"/v1/agri-market-seller/quotations/{doc['id']}/respond",
        json={"action": "accept"},
        headers=auth(ftoken),
    )
    assert accepted.json()["status"] == "accepted"
    assert accepted.json()["orderId"]

    declined_doc = await client.post(
        "/v1/agri-market-seller/quotations",
        json={
            "buyerUid": "uid-f1",
            "items": [{"title": "Vermicompost", "unitPricePaisa": 44900, "quantity": 1}],
            "validUntil": "2026-12-31",
        },
        headers=auth(stoken),
    )
    declined = await client.post(
        f"/v1/agri-market-seller/quotations/{declined_doc.json()['id']}/respond",
        json={"action": "decline"},
        headers=auth(ftoken),
    )
    assert declined.json()["status"] == "declined"


# ------------------------------------------------------------------ Sr 26 reviews


async def test_review_response_moderated(client, user_store):
    stoken = _seed_seller(user_store)
    user_store["ratings/rat_1"] = {
        "id": "rat_1",
        "bookingKind": "marketplace_order",
        "bookingId": "ord_1",
        "stars": 5,
        "comment": "Great quality",
        "raterId": "uid-f1",
        "providerId": "uid-s1",
        "createdAt": "2026-11-20T10:00:00+00:00",
    }
    reviews = (await client.get("/v1/agri-market-seller/reviews", headers=auth(stoken))).json()
    assert len(reviews["items"]) == 1
    assert reviews["items"][0]["stars"] == 5

    ok = await client.post(
        "/v1/agri-market-seller/reviews/rat_1/respond",
        json={"response": "Thank you for shopping with us!"},
        headers=auth(stoken),
    )
    assert ok.json()["sellerResponseStatus"] == "approved"

    dup = await client.post(
        "/v1/agri-market-seller/reviews/rat_1/respond",
        json={"response": "Again!"},
        headers=auth(stoken),
    )
    assert dup.status_code == 409


# ------------------------------------------------------------- Sr 6/2/27/9 aggregate


async def test_coupons_offers_dashboard_reports_insights(client, user_store):
    stoken = _seed_seller(user_store)
    await _mk_product(client, token := stoken, stock=4)  # low stock (default threshold 5)

    coupon = await client.post(
        "/v1/agri-market-seller/coupons",
        json={"code": "AMIT10", "percentOff": 10, "validUntil": "2026-12-31"},
        headers=auth(stoken),
    )
    assert coupon.status_code == 201
    dup = await client.post(
        "/v1/agri-market-seller/coupons",
        json={"code": "amit10", "validUntil": "2026-12-31"},
        headers=auth(stoken),
    )
    assert dup.status_code == 409

    await _mk_order(user_store, status="delivered", qty=2, price=449.0)
    await _mk_order(user_store, status="cancelled")
    user_store["orders/ord_delivered_1"]["finalTotal"] = 898.0

    offers = (await client.get("/v1/agri-market-seller/offers", headers=auth(stoken))).json()
    assert offers["items"][0]["pricePaisa"] == 44900  # discounted below MRP

    dash = (await client.get("/v1/agri-market-seller/dashboard", headers=auth(stoken))).json()
    assert dash["ordersReceived"] == 2
    assert dash["kpis"]["lowStock"]["count"] == 1
    assert dash["productStats"]["lowStock"] == 1
    assert dash["revenuePaisa"] == 89800

    reports = (await client.get("/v1/agri-market-seller/reports/sales", headers=auth(stoken))).json()
    assert reports["revenuePaisa"] == 89800
    assert reports["cancellations"] == 1
    assert reports["topProducts"][0]["title"] == "Vermicompost"

    insights = (await client.get("/v1/agri-market-seller/insights", headers=auth(stoken))).json()
    assert insights["salesInsights"]["bestSeller"]["title"] == "Vermicompost"
    assert insights["salesInsights"]["fulfilledOrders"] == 1
    assert insights["demandForecast"] is not None


# ------------------------------------------------------------------ persona access


async def test_persona_access_rules(client, user_store):
    seller_token = _seed_seller(user_store, active_profile="agriMarketSeller")
    vyapari = _seed_seller(user_store, uid="uid-v1", active_profile="seller")
    farmer = _seed_farmer(user_store, uid="uid-f9")

    ok = await client.get("/v1/agri-market-seller/dashboard", headers=auth(seller_token))
    assert ok.status_code == 200
    ok2 = await client.get("/v1/agri-market-seller/dashboard", headers=auth(vyapari))
    assert ok2.status_code == 200

    forbidden = await client.get("/v1/agri-market-seller/dashboard", headers=auth(farmer))
    assert forbidden.status_code == 403

    shop = await client.get("/v1/agri-market-seller/shop", headers=auth(seller_token))
    assert shop.status_code == 200


# ------------------------------------------------------- public shops directory


async def test_public_shops_directory_lists_shops_without_bank_fields(client, user_store):
    stoken = _seed_seller(user_store, active_profile="agriMarketSeller")
    await client.put(
        "/v1/agri-market-seller/shop",
        json={
            "shopName": "Amit Agro Shop",
            "bankName": "SBI Baramati",
            "bankAccountNumber": "12345678901",
            "bankIfsc": "SBIN0001234",
            "deliveryArea": "Baramati, Pune",
            "pickupAddress": "Shop 4, Mandi Road, Baramati",
            "documentIds": ["doc_pan", "doc_gst"],
        },
        headers=auth(stoken),
    )
    ftoken = _seed_farmer(user_store)
    resp = await client.get("/v1/agri-market-seller/shops", headers=auth(ftoken))
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) == 1
    card = items[0]
    assert card["shopName"] == "Amit Agro Shop"
    assert card["sellerName"] == "Amit Agro"
    assert card["deliveryArea"] == "Baramati, Pune"
    assert card["pickupAddress"] == "Shop 4, Mandi Road, Baramati"
    assert card["createdAt"]
    # bank details and documents never leak into the public directory
    for banned in ("bankName", "bankAccountNumber", "bankIfsc", "documentIds"):
        assert banned not in card


async def test_public_shops_directory_empty_and_requires_login(client, user_store):
    ftoken = _seed_farmer(user_store)
    resp = await client.get("/v1/agri-market-seller/shops", headers=auth(ftoken))
    assert resp.status_code == 200
    assert resp.json()["items"] == []

    anon = await client.get("/v1/agri-market-seller/shops")
    assert anon.status_code in (401, 403)
