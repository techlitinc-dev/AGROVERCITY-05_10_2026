"""Roleplay: Sunita's day as an Agrovercity Customer.

Exercises the Customer-page gaps (SR 1-25 doc) closed in this change, end to end,
through the same APIs the website calls:

  ACT 1 — Morning discovery: dashboard breadth, AI basket recommendations,
          farm-fresh produce browse, seasonal & nutrition calendar.
  ACT 2 — Shopping: veggie-box subscription (+ admin kill switch), order with
          delivery slot + Krushi Ratna coins + plant-a-tree, invoice, reorder,
          order notifications, seller rating with review tags + two-way reply,
          price-drop / restock / new-listing alerts, payment receipt.
  ACT 3 — Household & access: household diary + budget, tree hub, 7/12 land
          records, schemes (browse yes / apply no), premium plan pricing,
          chatbot order-help intent.

Firestore + firebase-auth + redis are faked by conftest; the AI gateway is
monkeypatched — nothing here touches the network.
"""

from app.core.config import settings
from app.services.tokens import create_access_token
from tests.test_diary import auth, seed_user
from tests.test_diary_garden_chatbot import _clean_decision

ADMIN = {"Authorization": "Bearer admin-token"}
NOW = "2026-10-20T07:00:00+05:30"


def _admin_jwt(uid="uid-admin-test"):
    """order_tracking's _ops_admin goes through the app JWT layer (not the
    firebase-verify monkeypatch), so mint a real token for the admin uid."""
    return {"Authorization": f"Bearer {create_access_token(uid)}"}


def _seed_admin(user_store):
    user_store["users/uid-admin-test"] = {
        "id": "uid-admin-test",
        "name": "Ops Admin",
        "isAdmin": True,
        "linkedProfiles": ["superadmin"],
        "activeProfile": "superadmin",
    }


def _seed_seller(user_store, uid="uid-seller", name="Sunil Vyapari"):
    return seed_user(user_store, uid=uid, active_profile="seller", name=name)


def _seed_product(user_store, pid, seller="uid-seller", title="Nashik Onions",
                  price=300, stock=10, category="Organic Produce", organic=True):
    user_store[f"products/{pid}"] = {
        "id": pid, "sellerId": seller, "title": title, "category": category,
        "mrp": price + 40, "discountedPrice": price, "stock": stock, "unit": "kg",
        "isOrganic": organic, "rating": 4.5, "createdAt": NOW,
    }


def _notifs_for(user_store, uid):
    return [
        d for k, d in user_store.items()
        if k.startswith("notifications/") and d.get("userId") == uid
    ]


# --------------------------------------------------------------------------- ACT 1


async def test_act1_dashboard_breadth(client, user_store):
    """Sunita opens the Customer Cockpit: orders, veggie box, coins, followed
    farmers, seasonal picks and unread notifications in one view."""
    token = seed_user(user_store, uid="uid-cust", active_profile="customer", agriCoins=250)
    _seed_seller(user_store)
    _seed_product(user_store, "p1")
    _seed_product(user_store, "p2", title="Desi A2 Ghee", price=900)
    user_store["orders/o1"] = {
        "id": "o1", "userId": "uid-cust", "status": "shipped", "total": 600, "createdAt": NOW,
    }
    user_store["orders/o2"] = {
        "id": "o2", "userId": "uid-cust", "status": "delivered", "total": 300, "createdAt": NOW,
    }
    user_store["customer_subscriptions/s1"] = {
        "id": "s1", "customerId": "uid-cust", "status": "active", "crop": "Veggie Basket",
        "qtyKg": 5, "frequency": "weekly", "nextRunAt": "2026-10-24", "createdAt": NOW,
    }
    user_store["follows/uid-cust_uid-seller"] = {
        "followerId": "uid-cust", "targetId": "uid-seller", "createdAt": NOW,
    }
    user_store["notifications/n1"] = {
        "id": "n1", "userId": "uid-cust", "title": "Order shipped",
        "body": "o1 shipped", "type": "order_shipped", "read": False, "createdAt": NOW,
    }

    resp = await client.get("/v1/customer/home", headers=auth(token))
    assert resp.status_code == 200
    home = resp.json()
    assert [o["id"] for o in home["activeOrders"]] == ["o1"]
    assert home["subscriptionNext"][0]["nextRunAt"] == "2026-10-24"
    assert home["coinBalance"] == 250
    assert home["followedOffers"], "followed farmer's products should surface"
    assert home["followedOffers"][0]["sellerId"] == "uid-seller"
    assert home["seasonalPicks"]
    assert home["unreadNotifications"] == 1


async def test_act1_ai_basket_respects_diet_and_family(client, user_store):
    """Recommendations filter by dietary preference and scale to family size."""
    token = seed_user(
        user_store, uid="uid-cust", active_profile="customer",
        dietaryPreference="organic", familySize=5,
    )
    _seed_product(user_store, "p1", title="Organic Spinach", price=40)
    _seed_product(user_store, "p2", title="Regular Spinach", price=30,
                  category="Vegetables", organic=False)
    user_store["orders/o1"] = {
        "id": "o1", "userId": "uid-cust", "status": "delivered",
        "items": [{"productId": "p1", "quantity": 2}], "total": 80, "createdAt": NOW,
    }

    resp = await client.get("/v1/customer/recommendations", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    basket = body["basket"]
    assert basket, "cold-start + history should produce a basket"
    titles = str([b.get("name") for b in basket])
    assert "Regular Spinach" not in titles, "organic preference filters non-organic picks"
    assert any("family of 5" in (b.get("reason") or "") for b in basket), (
        "family-size reason chip expected"
    )
    assert body["bestPrice"]


async def test_act1_produce_browse_and_seasonal(client, user_store):
    """Farm-fresh produce filters and the seasonal calendar."""
    token = seed_user(user_store, uid="uid-cust", active_profile="customer")
    _seed_seller(user_store, uid="uid-farmer2", name="Ramesh Patil")
    user_store["market_lots/l1"] = {
        "id": "l1", "farmerId": "uid-farmer2", "crop": "Tomato", "status": "open",
        "grade": "A", "quantityQuintals": 10, "expectedRate": 2400, "organic": True,
        "harvestDate": "2026-10-18", "createdAt": NOW,
    }
    user_store["market_lots/l2"] = {
        "id": "l2", "farmerId": "uid-farmer2", "crop": "Banana", "status": "open",
        "grade": "B", "quantityQuintals": 20, "expectedRate": 3200, "organic": False,
        "createdAt": NOW,
    }

    veg = await client.get(
        "/v1/customer/produce?category=vegetable&organic=true", headers=auth(token)
    )
    assert veg.status_code == 200
    rows = veg.json()["data"]
    assert [r["id"] for r in rows] == ["l1"]
    assert rows[0]["organic"] is True and rows[0]["crop"] == "Tomato"

    seasonal = await client.get("/v1/customer/seasonal", headers=auth(token))
    assert seasonal.status_code == 200
    body = seasonal.json()
    assert len(body["months"]) == 12
    assert any("Iron" in g["title"] for g in body["guides"])
    assert body["recipes"]


# --------------------------------------------------------------------------- ACT 2


async def test_act2_veggie_box_subscription_and_admin_switch(client, user_store):
    """Sunita subscribes to a weekly veggie basket and skips next week; the admin
    can temporarily disable new subscriptions."""
    _seed_admin(user_store)
    token = seed_user(user_store, uid="uid-cust", active_profile="customer")

    created = await client.post(
        "/v1/customer/subscriptions",
        json={
            "farmerIds": ["uid-farmer2"], "crop": "Veggie Basket", "qtyKg": 4,
            "frequency": "weekly",
            "items": [{"name": "Spinach", "quantity": 1, "unit": "kg"},
                      {"name": "Tomato", "quantity": 2, "unit": "kg"}],
            "deliveryDay": "Saturday", "deliverySlot": "7–10 AM",
        },
        headers=auth(token),
    )
    assert created.status_code == 201, created.text
    sub_id = created.json()["id"]

    skipped = await client.put(
        f"/v1/customer/subscriptions/{sub_id}", json={"skipNext": True}, headers=auth(token)
    )
    assert skipped.status_code == 200, skipped.text
    assert skipped.json()["skipDates"], "skip-a-week should record the skipped date"

    # admin turns the feature off → new subscriptions blocked, existing unaffected
    off = await client.put(
        "/v1/admin/app-config/veggie-box",
        json={"enabled": False},
        headers={**ADMIN, "X-Audit-Reason": "stock outage"},
    )
    assert off.status_code == 200, off.text
    blocked = await client.post(
        "/v1/customer/subscriptions",
        json={"farmerIds": ["uid-farmer2"], "crop": "Veggie Basket", "qtyKg": 2,
              "frequency": "weekly"},
        headers=auth(token),
    )
    assert blocked.status_code == 409

    await client.put(
        "/v1/admin/app-config/veggie-box",
        json={"enabled": True},
        headers={**ADMIN, "X-Audit-Reason": "restored"},
    )
    reopened = await client.post(
        "/v1/customer/subscriptions",
        json={"farmerIds": ["uid-farmer2"], "crop": "Veggie Basket", "qtyKg": 2,
              "frequency": "fortnightly"},
        headers=auth(token),
    )
    assert reopened.status_code == 201, reopened.text


async def test_act2_order_with_slot_coins_and_tree(client, user_store):
    """Checkout with a delivery slot, Krushi Ratna coin redemption and the
    plant-a-tree opt-in."""
    token = seed_user(user_store, uid="uid-cust", active_profile="customer", agriCoins=500)
    _seed_seller(user_store)
    _seed_product(user_store, "p1", price=300, stock=10)

    resp = await client.post(
        "/v1/orders",
        json={
            "items": [{"productId": "p1", "quantity": 2}],
            "paymentMethod": "upi",
            "deliveryAddress": "Flat 4B, Hill Road, Pune 411004",
            "idempotencyKey": "sunita-order-1",
            "deliverySlot": "7–10 AM",
            "coinsToRedeem": 100,
            "plantTree": True,
        },
        headers=auth(token),
    )
    assert resp.status_code in (200, 201), resp.text
    body = resp.json()
    assert body["coinsRedeemed"] == 100
    assert body["finalTotal"] == 500, "600 − 100 coin discount"

    order = user_store[f"orders/{body['orderId']}"]
    assert order["deliverySlot"] == "7–10 AM"
    assert order["coinsRedeemed"] == 100

    assert user_store["users/uid-cust"]["agriCoins"] == 400
    adoption = [d for k, d in user_store.items() if k.startswith("tree_adoptions/")]
    assert adoption and adoption[0]["orderId"] == body["orderId"]
    assert order["treeAdoptionId"]


async def test_act2_order_journey_invoice_reorder_notifications_rating(client, user_store):
    """The full order journey: admin transitions notify Sunita, delivery opens a
    rating prompt with review tags, the seller replies, invoice + reorder work."""
    _seed_admin(user_store)
    token = seed_user(user_store, uid="uid-cust", active_profile="customer")
    seller = _seed_seller(user_store)
    _seed_product(user_store, "p1", price=300, stock=10)

    placed = await client.post(
        "/v1/orders",
        json={"items": [{"productId": "p1", "quantity": 1}],
              "paymentMethod": "upi",
              "deliveryAddress": "Flat 4B, Hill Road, Pune",
              "idempotencyKey": "journey-1"},
        headers=auth(token),
    )
    assert placed.status_code in (200, 201)
    order_id = placed.json()["orderId"]

    for status in ("confirmed", "shipped", "out_for_delivery", "delivered"):
        patch = await client.patch(
            f"/v1/orders/{order_id}/status",
            json={"status": status},
            headers=_admin_jwt(),
        )
        assert patch.status_code == 200, (status, patch.text)

    notifs = _notifs_for(user_store, "uid-cust")
    types = {n["type"] for n in notifs}
    assert "order_delivered" in types and "order_shipped" in types
    assert any("delivering today" in n["body"].lower() for n in notifs)

    # delivered opened a rating prompt → rate with review tags
    pending = await client.get("/v1/ratings/pending", headers=auth(token))
    items = pending.json().get("items") or pending.json().get("data") or []
    assert any(p.get("transactionId") == order_id for p in items)

    rated = await client.post(
        "/v1/ratings",
        json={"bookingKind": "marketplace_order", "bookingId": order_id, "stars": 5,
              "comment": "Fresh and on time", "tags": ["freshness", "packing", "on-time"]},
        headers=auth(token),
    )
    assert rated.status_code in (200, 201), rated.text
    rating_id = rated.json()["id"]

    # two-way: seller replies and Sunita sees it on her given rating
    reply = await client.post(
        f"/v1/ratings/{rating_id}/reply",
        json={"reply": "Thank you Sunita, glad you liked it!"},
        headers=auth(seller),
    )
    assert reply.status_code == 200, reply.text

    given = await client.get("/v1/ratings/given", headers=auth(token))
    given_rows = given.json().get("items") or given.json().get("data") or []
    mine = [g for g in given_rows if g.get("id") == rating_id]
    assert mine and "Thank you Sunita" in str(mine[0].get("reply"))

    # invoice + reorder
    invoice = await client.get(f"/v1/orders/{order_id}/invoice.pdf", headers=auth(token))
    assert invoice.status_code == 200
    assert invoice.content[:4] == b"%PDF"

    reorder = await client.post(f"/v1/orders/{order_id}/reorder", headers=auth(token))
    assert reorder.status_code == 200
    assert reorder.json()["items"] == [{"productId": "p1", "quantity": 1}]


async def test_act2_price_drop_restock_and_new_listing_alerts(client, user_store):
    """Sunita follows a product; a seller price cut, a restock and a new listing
    from her followed farmer each land as notifications."""
    token = seed_user(user_store, uid="uid-cust", active_profile="customer")
    seller = _seed_seller(user_store)
    _seed_product(user_store, "p1", price=300, stock=0)
    user_store["follows/uid-cust_uid-seller"] = {
        "followerId": "uid-cust", "targetId": "uid-seller", "createdAt": NOW,
    }

    sub = await client.post(
        "/v1/customer/product-alerts",
        json={"productId": "p1", "kinds": ["price_drop", "restock"]},
        headers=auth(token),
    )
    assert sub.status_code in (200, 201)

    cut = await client.put(
        "/v1/seller/products/p1", json={"discountedPrice": 250}, headers=auth(seller)
    )
    assert cut.status_code == 200, cut.text
    restock = await client.put(
        "/v1/seller/products/p1", json={"stock": 6}, headers=auth(seller)
    )
    assert restock.status_code == 200

    listed = await client.post(
        "/v1/seller/products",
        json={"title": "Seasonal Guava", "category": "Fruits", "mrp": 120,
              "discountedPrice": 100, "stock": 15, "unit": "kg"},
        headers=auth(seller),
    )
    assert listed.status_code == 201, listed.text

    types = {n["type"] for n in _notifs_for(user_store, "uid-cust")}
    assert "price_drop" in types
    assert "restock" in types
    assert "farmer_new_listing" in types


async def test_act2_payment_receipt(client, user_store):
    """Sunita downloads a receipt for a payment she received."""
    token = seed_user(user_store, uid="uid-cust", active_profile="customer")
    _seed_seller(user_store)
    user_store["payments/pay9"] = {
        "id": "pay9", "payerId": "uid-seller", "payeeId": "uid-cust",
        "amount": 25000, "status": "paid", "purpose": "refund",
        "createdAt": "2026-10-19T10:00:00+05:30",
    }
    resp = await client.get("/v1/payments/pay9/receipt.pdf", headers=auth(token))
    assert resp.status_code == 200
    assert resp.content[:4] == b"%PDF"


# --------------------------------------------------------------------------- ACT 3


async def test_act3_household_diary_and_budget(client, user_store):
    """Sunita logs a household Buy entry and sets her monthly budget."""
    token = seed_user(user_store, uid="uid-cust", active_profile="customer")

    entry = await client.post(
        "/v1/diary/entries",
        json={"title": "Weekly veggies", "category": "Vegetables", "type": "household",
              "tradeType": "buy", "amount": 420, "date": "2026-10-20",
              "quantity": 3, "unit": "kg", "party": "Ramesh Patil"},
        headers=auth(token),
    )
    assert entry.status_code in (200, 201), entry.text

    listed = await client.get("/v1/diary/entries?type=household", headers=auth(token))
    assert len(listed.json()["data"]) == 1

    put = await client.put(
        "/v1/users/me/settings", json={"householdBudgetMonthly": 9000}, headers=auth(token)
    )
    assert put.status_code == 200
    got = await client.get("/v1/users/me/settings", headers=auth(token))
    assert got.json()["householdBudgetMonthly"] == 9000


async def test_act3_access_tree_land_schemes_plans(client, user_store):
    """Customer access widened: tree hub, 7/12 records, schemes browse (apply
    still farmer-only), and the premium plan pricing."""
    token = seed_user(user_store, uid="uid-cust", active_profile="customer")
    user_store["schemes/sch1"] = {
        "id": "sch1", "name": "PM-KISAN", "category": "Income Support",
        "benefitAmount": "₹6000/year", "status": "active",
        "nextDeadline": "2026-12-31", "description": "Income support for farmers",
        "isActive": True, "createdAt": NOW,
    }

    trees = await client.get("/v1/tree/articles", headers=auth(token))
    assert trees.status_code == 200

    records = await client.get("/v1/land-records/search?village=Ozar", headers=auth(token))
    assert records.status_code == 200

    schemes = await client.get("/v1/schemes", headers=auth(token))
    assert schemes.status_code == 200

    apply = await client.post("/v1/schemes/sch1/apply", headers=auth(token))
    assert apply.status_code == 403

    plans = await client.get("/v1/billing/plans?persona=emarketCustomer", headers=auth(token))
    assert plans.status_code == 200
    prices = {p.get("priceMonthlyPaisa") for p in plans.json()["data"]}
    assert {900, 9900, 99900} <= prices, f"premium tier pricing missing: {prices}"


async def test_act3_chatbot_order_help(client, user_store, monkeypatch):
    """Sunita asks Kisan Mitra about her order; the bot sees her recent orders."""
    token = seed_user(user_store, uid="uid-cust", active_profile="customer")
    user_store["orders/o1"] = {
        "id": "o1", "userId": "uid-cust", "status": "shipped", "total": 600, "createdAt": NOW,
    }
    captured = {}

    async def fake_decide(state, question_set_id, ctx=None, module="ai"):
        if question_set_id == "chatbot.intent.v1":
            return _clean_decision(intent="app_help", answerable=0.9)
        if question_set_id == "chatbot.safety.v1":
            return _clean_decision(has_contact_info=False, has_financial_advice=False,
                                   has_medical_certainty=False)
        raise AssertionError(question_set_id)

    async def fake_generate(prompt, opts=None):
        captured["prompt"] = prompt
        return "Your order is on the way."

    monkeypatch.setattr(settings, "ai_provider", "live")
    monkeypatch.setattr("app.services.ai.gateway.decide", fake_decide)
    monkeypatch.setattr("app.services.ai.gateway.generate", fake_generate)

    resp = await client.post(
        "/v1/chatbot/messages",
        json={"text": "Mera order kahan hai?"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    assert "Your recent orders" in captured["prompt"]
    assert "o1" in captured["prompt"]
