"""Customer commerce core gaps — SR 5/6/7/8/9/10/19/24.

Covers: place-order deliverySlot/coins/plantTree (coin burn + tree_adoptions
doc), coin over-balance 422, invoice.pdf owner/seller/outsider + bytes, reorder
payload + gating, order-status notifications, veggie-box subscriptions
(items/weekly/fortnightly/deliveryDay/slot/skip-a-week/nextRunAt), the
veggie_box feature flag and storefront written reviews.
"""
from datetime import datetime, timedelta, timezone

import pytest

from tests.test_diary import auth, seed_user

PRODUCTS = [
    {
        "id": "prod-c1",
        "title": "Desi Tomato (Nashik)",
        "category": "Vegetables",
        "brand": "Farm Fresh",
        "discountedPrice": 200,
        "mrp": 240,
        "sellerId": "seller-c1",
        "stock": 50,
        "nutrition": "Rich in Vitamin C, lycopene and potassium.",
        "harvestDate": "2026-10-18",
        "deliverySlots": ["7–10 AM", "4–7 PM"],
    },
    {
        "id": "prod-c2",
        "title": "Spinach Bunch",
        "category": "Vegetables",
        "brand": "Farm Fresh",
        "discountedPrice": 60,
        "mrp": 80,
        "sellerId": "seller-c1",
        "stock": 40,
    },
]


@pytest.fixture
def commerce_seed(user_store):
    for doc in PRODUCTS:
        user_store[f"products/{doc['id']}"] = doc
    return user_store


def _customer(user_store, uid="cust-cc1", coins=0):
    return seed_user(user_store, uid=uid, active_profile="customer", agriCoins=coins)


def _admin(user_store, uid="admin-root"):
    user_store[f"users/{uid}"] = {
        "id": uid,
        "name": "Super Admin",
        "linkedProfiles": ["farmer"],
        "activeProfile": "admin",
        "primaryProfile": "farmer",
        "isAdmin": True,
    }
    from app.services.tokens import create_access_token

    return create_access_token(uid)


def _place(client, token, **overrides):
    body = {
        "items": [{"productId": "prod-c1", "quantity": 1}],
        "paymentMethod": "cod",
        "deliveryAddress": "Gat 12, Pimplas",
        "idempotencyKey": f"cc-{datetime.now(timezone.utc).timestamp()}",
    }
    body.update(overrides)
    return client.post("/v1/orders", json=body, headers=auth(token))


async def _deliver(client, admin_token, order_id):
    for status in ("confirmed", "shipped", "out_for_delivery", "delivered"):
        resp = await client.patch(
            f"/v1/orders/{order_id}/status",
            json={"status": status},
            headers=auth(admin_token),
        )
        assert resp.status_code == 200, status


# --------------------------------------------------------------------------
# SR 8 + SR 19 — place order with slot / coins / plant-a-tree
# --------------------------------------------------------------------------


async def test_place_order_with_slot_coins_and_plant_tree(client, commerce_seed, user_store):
    token = _customer(user_store, coins=500)
    resp = await _place(
        client,
        token,
        deliverySlot="7–10 AM",
        coinsToRedeem=100,
        plantTree=True,
        idempotencyKey="cc-full-1",
    )
    assert resp.status_code == 200
    body = resp.json()
    order_id = body["orderId"]
    assert body["total"] == 200
    assert body["coinsRedeemed"] == 100
    assert body["finalTotal"] == 100

    order = user_store[f"orders/{order_id}"]
    assert order["deliverySlot"] == "7–10 AM"
    assert order["coinsRedeemed"] == 100
    assert order["finalTotal"] == 100

    # Coins burned from the user doc via the shared coin service.
    assert user_store["users/cust-cc1"]["agriCoins"] == 400
    ledger = [
        doc
        for key, doc in user_store.items()
        if key.startswith("users/cust-cc1/coin_ledger/") and doc.get("reason") == "order_redemption"
    ]
    assert len(ledger) == 1
    assert ledger[0]["amount"] == -100
    assert ledger[0]["refId"] == order_id

    # SR 19: tree adoption doc created with the order linkage.
    adoption_id = order["treeAdoptionId"]
    adoption = user_store[f"tree_adoptions/{adoption_id}"]
    assert adoption["orderId"] == order_id
    assert adoption["userId"] == "cust-cc1"
    assert adoption["farmerId"] == "cust-cc1"
    assert adoption["status"] == "planted"
    assert adoption["treeSpecies"] == "Native mix"


async def test_place_order_coins_capped_at_total(client, commerce_seed, user_store):
    token = _customer(user_store, coins=2000)
    # Within the wallet balance, but above the Rs 200 order total.
    resp = await _place(client, token, coinsToRedeem=500, idempotencyKey="cc-cap-1")
    assert resp.status_code == 200
    body = resp.json()
    # 1 coin = Rs 1, capped at the order total.
    assert body["coinsRedeemed"] == 200
    assert body["finalTotal"] == 0
    assert user_store["users/cust-cc1"]["agriCoins"] == 1800


async def test_place_order_coins_over_balance_422(client, commerce_seed, user_store):
    token = _customer(user_store, coins=10)
    resp = await _place(client, token, coinsToRedeem=50, idempotencyKey="cc-over-1")
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "COINS_INSUFFICIENT"
    assert user_store["users/cust-cc1"]["agriCoins"] == 10


async def test_place_order_no_coins_response_shape_unchanged(client, commerce_seed, user_store):
    token = _customer(user_store)
    resp = await _place(client, token, idempotencyKey="cc-plain-1")
    assert resp.status_code == 200
    assert set(resp.json().keys()) == {"orderId", "total"}


# --------------------------------------------------------------------------
# SR 9 — invoice.pdf + reorder
# --------------------------------------------------------------------------


async def test_invoice_pdf_owner_bytes_contain_order_id(client, commerce_seed, user_store):
    token = _customer(user_store)
    order_id = (await _place(client, token, idempotencyKey="cc-inv-1")).json()["orderId"]
    resp = await client.get(f"/v1/orders/{order_id}/invoice.pdf", headers=auth(token))
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert order_id.encode() in resp.content
    assert b"Total" in resp.content


async def test_invoice_pdf_seller_allowed_outsider_forbidden(client, commerce_seed, user_store):
    token = _customer(user_store)
    order_id = (await _place(client, token, idempotencyKey="cc-inv-2")).json()["orderId"]

    seller_token = seed_user(user_store, uid="seller-c1", active_profile="seller")
    resp = await client.get(f"/v1/orders/{order_id}/invoice.pdf", headers=auth(seller_token))
    assert resp.status_code == 200

    outsider = _customer(user_store, uid="cust-outsider")
    resp = await client.get(f"/v1/orders/{order_id}/invoice.pdf", headers=auth(outsider))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_reorder_delivered_order_returns_items(client, commerce_seed, user_store):
    token = _customer(user_store)
    admin = _admin(user_store)
    order_id = (await _place(client, token, idempotencyKey="cc-re-1")).json()["orderId"]
    resp = await client.post(f"/v1/orders/{order_id}/reorder", headers=auth(token))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "ORDER_NOT_REORDERABLE"

    await _deliver(client, admin, order_id)
    resp = await client.post(f"/v1/orders/{order_id}/reorder", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["orderId"] == order_id
    assert body["items"] == [{"productId": "prod-c1", "quantity": 1}]

    outsider = _customer(user_store, uid="cust-outsider2")
    resp = await client.post(f"/v1/orders/{order_id}/reorder", headers=auth(outsider))
    assert resp.status_code == 403


# --------------------------------------------------------------------------
# SR 24 — order-status notifications
# --------------------------------------------------------------------------


async def test_status_patch_writes_notification_docs(client, commerce_seed, user_store):
    token = _customer(user_store)
    admin = _admin(user_store)
    order_id = (await _place(client, token, idempotencyKey="cc-ntf-1")).json()["orderId"]

    for status in ("confirmed", "shipped", "out_for_delivery"):
        resp = await client.patch(
            f"/v1/orders/{order_id}/status",
            json={"status": status},
            headers=auth(admin),
        )
        assert resp.status_code == 200

    notifications = [
        doc
        for key, doc in user_store.items()
        if key.startswith("notifications/") and doc.get("userId") == "cust-cc1"
    ]
    types = {n["type"] for n in notifications}
    assert {"order_confirmed", "order_shipped", "order_out_for_delivery"} <= types
    otd = next(n for n in notifications if n["type"] == "order_out_for_delivery")
    assert otd["read"] is False
    assert "delivering today" in otd["body"].lower()
    assert order_id in otd["body"]
    assert otd["id"].startswith("ntf_")


# --------------------------------------------------------------------------
# SR 7 — veggie-box subscriptions
# --------------------------------------------------------------------------


def _sub_body(**overrides):
    body = {
        "farmerIds": ["seller-c1"],
        "crop": "Veggie box",
        "qtyKg": 3,
        "targetPriceBandPaisa": {"min": 1000, "max": 3000},
        "deliveryWindow": "Morning",
        "frequency": "weekly",
    }
    body.update(overrides)
    return body


async def test_subscription_create_with_items_day_slot(client, user_store):
    token = _customer(user_store)
    resp = await client.post(
        "/v1/customer/subscriptions",
        json=_sub_body(
            frequency="weekly",
            items=[{"name": "Tomato", "quantity": 1, "unit": "kg"}],
            deliveryDay="Monday",
            deliverySlot="7–10 AM",
        ),
        headers=auth(token),
    )
    assert resp.status_code == 201
    sub = resp.json()
    assert sub["items"] == [{"name": "Tomato", "quantity": 1, "unit": "kg"}]
    assert sub["deliveryDay"] == "Monday"
    assert sub["deliverySlot"] == "7–10 AM"
    assert sub["nextRunAt"]
    next_run = datetime.fromisoformat(sub["nextRunAt"])
    assert timedelta(days=6) < next_run - datetime.now(timezone.utc) <= timedelta(days=8)


async def test_subscription_fortnightly_next_run(client, user_store):
    token = _customer(user_store)
    resp = await client.post(
        "/v1/customer/subscriptions",
        json=_sub_body(frequency="fortnightly"),
        headers=auth(token),
    )
    assert resp.status_code == 201
    next_run = datetime.fromisoformat(resp.json()["nextRunAt"])
    assert timedelta(days=13) < next_run - datetime.now(timezone.utc) <= timedelta(days=15)


async def test_subscription_skip_next_week(client, user_store):
    token = _customer(user_store)
    created = await client.post(
        "/v1/customer/subscriptions",
        json=_sub_body(frequency="weekly"),
        headers=auth(token),
    )
    assert created.status_code == 201
    sub_id = created.json()["id"]

    resp = await client.put(
        f"/v1/customer/subscriptions/{sub_id}",
        json={"skipNext": True},
        headers=auth(token),
    )
    assert resp.status_code == 200
    sub = resp.json()
    expected_occurrence = (datetime.now(timezone.utc) + timedelta(days=7)).date().isoformat()
    assert expected_occurrence in sub["skipDates"]
    # The skipped occurrence is not scheduled: next run jumps another week.
    next_run = datetime.fromisoformat(sub["nextRunAt"])
    assert timedelta(days=12) < next_run - datetime.now(timezone.utc)


async def test_subscription_put_items_update(client, user_store):
    token = _customer(user_store)
    created = await client.post(
        "/v1/customer/subscriptions",
        json=_sub_body(items=[{"name": "Spinach", "quantity": 0.5, "unit": "kg"}]),
        headers=auth(token),
    )
    sub_id = created.json()["id"]
    resp = await client.put(
        f"/v1/customer/subscriptions/{sub_id}",
        json={"items": [{"name": "Spinach", "quantity": 1, "unit": "kg"}]},
        headers=auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["items"] == [{"name": "Spinach", "quantity": 1, "unit": "kg"}]


async def test_subscription_veggie_box_flag_disabled_then_enabled(client, user_store):
    token = _customer(user_store)
    user_store["app_config/veggie_box"] = {"id": "veggie_box", "enabled": False}
    resp = await client.post(
        "/v1/customer/subscriptions",
        json=_sub_body(),
        headers=auth(token),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "FEATURE_DISABLED"

    user_store["app_config/veggie_box"] = {"id": "veggie_box", "enabled": True}
    resp = await client.post(
        "/v1/customer/subscriptions",
        json=_sub_body(),
        headers=auth(token),
    )
    assert resp.status_code == 201

    # Absent doc => feature enabled.
    del user_store["app_config/veggie_box"]
    resp = await client.post(
        "/v1/customer/subscriptions",
        json=_sub_body(),
        headers=auth(token),
    )
    assert resp.status_code == 201


# --------------------------------------------------------------------------
# SR 5 — storefront written reviews
# --------------------------------------------------------------------------


async def test_storefront_includes_product_reviews(client, user_store):
    token = _customer(user_store)
    seed_user(user_store, uid="seller-c1", active_profile="seller")
    user_store["products/prod-r1"] = {
        "id": "prod-r1",
        "title": "Sweet Corn",
        "discountedPrice": 120,
        "sellerId": "seller-c1",
    }
    user_store["products/prod-r1/reviews/cust-cc1"] = {
        "id": "cust-cc1",
        "userId": "cust-cc1",
        "userName": "Ram Patil",
        "rating": 5,
        "comment": "Fresh and sweet!",
        "createdAt": "2026-10-15T08:00:00+00:00",
        "updatedAt": "2026-10-15T08:00:00+00:00",
    }
    user_store["market_lots/lot-r1"] = {
        "id": "lot-r1",
        "farmerId": "seller-c1",
        "status": "open",
        "crop": "Sweet Corn",
    }

    resp = await client.get("/v1/customer/storefronts/seller-c1", headers=auth(token))
    assert resp.status_code == 200
    reviews = resp.json()["reviews"]
    assert len(reviews) == 1
    assert reviews[0]["productName"] == "Sweet Corn"
    assert reviews[0]["stars"] == 5
    assert reviews[0]["comment"] == "Fresh and sweet!"
    assert reviews[0]["reviewerName"] == "Ram Patil"
