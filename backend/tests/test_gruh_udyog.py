from tests.test_diary import auth, seed_user


def _unit_payload():
    return {
        "name": "Sunita Gruh Udyog",
        "vernacularName": "सुनीता गृह उद्योग",
        "category": "Food processing",
        "description": "Home-made papad, masala and sweets",
        "village": "Wagholi",
        "district": "Pune",
        "state": "Maharashtra",
        "shgName": "Jai Kisan Mahila Bachat Gat",
        "establishedYear": 2023,
        "capacityPerWeek": 200,
    }


FOOD_PRODUCT = {
    "title": "Besan Ladoo",
    "vernacularTitle": "बेसन लाडू",
    "category": "Dairy & Sweets",
    "description": "Made in small batches at home",
    "ingredients": "besan, ghee, sugar",
    "mrp": 400,
    "price": 350,
    "stock": 20,
    "unit": "500g box",
    "shelfLifeDays": 15,
}

HANDICRAFT_PRODUCT = {
    "title": "Warli Painted Pot",
    "category": "Handicrafts",
    "description": "Hand-painted terracotta",
    "mrp": 600,
    "price": 500,
    "stock": 10,
    "unit": "piece",
}


async def _register_unit(client, token):
    resp = await client.post("/v1/gruh-udyog/units", json=_unit_payload(), headers=auth(token))
    assert resp.status_code == 201
    return resp.json()["id"]


async def _add_product(client, token, unit_id, payload):
    resp = await client.post(
        f"/v1/gruh-udyog/units/{unit_id}/products", json=payload, headers=auth(token)
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _publish(client, token, product_id):
    return await client.post(
        f"/v1/gruh-udyog/products/{product_id}/publish", headers=auth(token)
    )


async def _place_mall_order(client, buyer_token, mall_product_id, quantity=2, key="ord-key-1"):
    resp = await client.post(
        "/v1/orders",
        json={
            "items": [{"productId": mall_product_id, "quantity": quantity}],
            "paymentMethod": "upi",
            "deliveryAddress": "Wagholi, Pune",
            "idempotencyKey": key,
        },
        headers=auth(buyer_token),
    )
    assert resp.status_code == 200
    return resp.json()["orderId"]


async def test_register_unit_and_fetch_me(client, user_store):
    token = seed_user(user_store)
    unit_id = await _register_unit(client, token)
    me = await client.get("/v1/gruh-udyog/units/me", headers=auth(token))
    assert me.status_code == 200
    body = me.json()
    assert body["id"] == unit_id
    assert body["ownerUid"] == "uid-1"
    assert body["status"] == "active"
    assert body["shgName"] == "Jai Kisan Mahila Bachat Gat"


async def test_duplicate_unit_409(client, user_store):
    token = seed_user(user_store)
    await _register_unit(client, token)
    resp = await client.post("/v1/gruh-udyog/units", json=_unit_payload(), headers=auth(token))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "UNIT_ALREADY_EXISTS"


async def test_unit_not_registered_404(client, user_store):
    token = seed_user(user_store)
    resp = await client.get("/v1/gruh-udyog/units/me", headers=auth(token))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "UNIT_NOT_FOUND"


async def test_update_pause_resume_and_public_card(client, user_store):
    token = seed_user(user_store)
    unit_id = await _register_unit(client, token)
    updated = await client.put(
        f"/v1/gruh-udyog/units/{unit_id}",
        json={"description": "SHG-backed home enterprise", "capacityPerWeek": 300},
        headers=auth(token),
    )
    assert updated.status_code == 200
    assert updated.json()["description"] == "SHG-backed home enterprise"
    assert updated.json()["capacityPerWeek"] == 300

    product_id = await _add_product(client, token, unit_id, HANDICRAFT_PRODUCT)
    await _publish(client, token, product_id)

    card = await client.get(f"/v1/gruh-udyog/units/{unit_id}", headers=auth(token))
    assert card.status_code == 200
    assert card.json()["productsCount"] == 1
    assert card.json()["liveProductsCount"] == 1

    paused = await client.post(f"/v1/gruh-udyog/units/{unit_id}/pause", headers=auth(token))
    assert paused.status_code == 200
    assert paused.json()["status"] == "paused"
    resumed = await client.post(f"/v1/gruh-udyog/units/{unit_id}/resume", headers=auth(token))
    assert resumed.json()["status"] == "active"


async def test_add_product_publish_appears_on_krishi_mall(client, user_store):
    token = seed_user(user_store)
    unit_id = await _register_unit(client, token)
    product_id = await _add_product(client, token, unit_id, HANDICRAFT_PRODUCT)
    published = await _publish(client, token, product_id)
    assert published.status_code == 200
    mall_id = published.json()["mallProductId"]
    assert published.json()["product"]["status"] == "live"

    mall_doc = user_store[f"products/{mall_id}"]
    assert mall_doc["source"] == "gruh_udyog"
    assert mall_doc["unitId"] == unit_id
    assert mall_doc["gruhProductId"] == product_id
    assert mall_doc["sellerId"] == "uid-1"
    assert mall_doc["discountedPrice"] == 500

    catalog = await client.get("/v1/products", headers=auth(token))
    assert mall_id in {p["id"] for p in catalog.json()["data"]}


async def test_publish_food_allows_pending_fssai_with_badge(client, user_store):
    token = seed_user(user_store)
    unit_id = await _register_unit(client, token)
    product_id = await _add_product(client, token, unit_id, FOOD_PRODUCT)

    blocked = await _publish(client, token, product_id)
    assert blocked.status_code == 403
    assert blocked.json()["error"]["code"] == "FSSAI_REQUIRED"

    cert = await client.post(
        f"/v1/gruh-udyog/units/{unit_id}/certifications",
        json={"type": "fssai", "number": "FSSAI-12345678901234", "validUntil": "2027-12-31"},
        headers=auth(token),
    )
    assert cert.status_code == 201

    # Pending FSSAI no longer blocks publish — the listing goes live with a
    # visible `fssaiStatus: "pending"` badge instead.
    published = await _publish(client, token, product_id)
    assert published.status_code == 200
    mall_id = published.json()["mallProductId"]
    assert user_store[f"products/{mall_id}"]["fssaiStatus"] == "pending"

    # Once the cert verifies, re-publishing stamps the verified badge.
    unpublish = await client.post(
        f"/v1/gruh-udyog/products/{product_id}/unpublish", headers=auth(token)
    )
    assert unpublish.status_code == 200
    cert_doc = user_store[f"gruh_udyog_certifications/{cert.json()['id']}"]
    cert_doc["status"] = "verified"
    user_store[f"gruh_udyog_certifications/{cert.json()['id']}"] = cert_doc
    republished = await _publish(client, token, product_id)
    assert republished.status_code == 200
    new_mall_id = republished.json()["mallProductId"]
    assert user_store[f"products/{new_mall_id}"]["fssaiStatus"] == "verified"


async def test_publish_gates_stock_and_paused_unit(client, user_store):
    token = seed_user(user_store)
    unit_id = await _register_unit(client, token)
    no_stock = await _add_product(
        client, token, unit_id, {**HANDICRAFT_PRODUCT, "stock": 0}
    )
    resp = await _publish(client, token, no_stock)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "STOCK_REQUIRED"

    product_id = await _add_product(client, token, unit_id, HANDICRAFT_PRODUCT)
    await client.post(f"/v1/gruh-udyog/units/{unit_id}/pause", headers=auth(token))
    resp = await _publish(client, token, product_id)
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "UNIT_PAUSED"


async def test_update_product_and_stock_sync_to_mall(client, user_store):
    token = seed_user(user_store)
    unit_id = await _register_unit(client, token)
    product_id = await _add_product(client, token, unit_id, HANDICRAFT_PRODUCT)
    mall_id = (await _publish(client, token, product_id)).json()["mallProductId"]

    updated = await client.put(
        f"/v1/gruh-udyog/products/{product_id}",
        json={"price": 450, "description": "New stock"},
        headers=auth(token),
    )
    assert updated.status_code == 200
    assert user_store[f"products/{mall_id}"]["discountedPrice"] == 450
    assert user_store[f"products/{mall_id}"]["description"] == "New stock"

    stock = await client.put(
        f"/v1/gruh-udyog/products/{product_id}/stock",
        json={"stock": 42},
        headers=auth(token),
    )
    assert stock.status_code == 200
    assert user_store[f"products/{mall_id}"]["stock"] == 42
    assert user_store[f"gruh_udyog_products/{product_id}"]["stock"] == 42


async def test_price_above_mrp_422(client, user_store):
    token = seed_user(user_store)
    unit_id = await _register_unit(client, token)
    resp = await client.post(
        f"/v1/gruh-udyog/units/{unit_id}/products",
        json={**HANDICRAFT_PRODUCT, "price": 700},
        headers=auth(token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["fieldErrors"]["price"] == "must not exceed mrp"


async def test_unknown_category_422(client, user_store):
    token = seed_user(user_store)
    unit_id = await _register_unit(client, token)
    resp = await client.post(
        f"/v1/gruh-udyog/units/{unit_id}/products",
        json={**HANDICRAFT_PRODUCT, "category": "Electronics"},
        headers=auth(token),
    )
    assert resp.status_code == 422


async def test_unpublish_blocked_by_open_order(client, user_store):
    token = seed_user(user_store)
    buyer = seed_user(user_store, uid="uid-2")
    unit_id = await _register_unit(client, token)
    product_id = await _add_product(client, token, unit_id, HANDICRAFT_PRODUCT)
    mall_id = (await _publish(client, token, product_id)).json()["mallProductId"]
    await _place_mall_order(client, buyer, mall_id)

    resp = await client.post(
        f"/v1/gruh-udyog/products/{product_id}/unpublish", headers=auth(token)
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "OPEN_ORDERS_EXIST"


async def test_order_join_accept_fulfil_and_dashboard_revenue(client, user_store):
    token = seed_user(user_store)
    buyer = seed_user(user_store, uid="uid-2")
    unit_id = await _register_unit(client, token)
    product_id = await _add_product(client, token, unit_id, HANDICRAFT_PRODUCT)
    mall_id = (await _publish(client, token, product_id)).json()["mallProductId"]
    order_id = await _place_mall_order(client, buyer, mall_id, quantity=2)

    orders = await client.get(f"/v1/gruh-udyog/units/{unit_id}/orders", headers=auth(token))
    assert orders.status_code == 200
    rows = orders.json()["data"]
    assert len(rows) == 1
    assert rows[0]["orderId"] == order_id
    assert rows[0]["items"] == [{"productId": mall_id, "quantity": 2}]
    assert rows[0]["fulfillment"] is None

    accepted = await client.post(
        f"/v1/gruh-udyog/orders/{order_id}/accept", headers=auth(token)
    )
    assert accepted.status_code == 200
    assert accepted.json()["fulfillment"]["status"] == "accepted"
    assert accepted.json()["fulfillment"]["itemsTotal"] == 1000

    packed = await client.post(
        f"/v1/gruh-udyog/orders/{order_id}/status",
        json={"status": "packed"},
        headers=auth(token),
    )
    assert packed.status_code == 200

    skipped = await client.post(
        f"/v1/gruh-udyog/orders/{order_id}/status",
        json={"status": "delivered"},
        headers=auth(token),
    )
    assert skipped.status_code == 409
    assert skipped.json()["error"]["code"] == "BAD_TRANSITION"

    shipped = await client.post(
        f"/v1/gruh-udyog/orders/{order_id}/status",
        json={"status": "shipped"},
        headers=auth(token),
    )
    assert shipped.status_code == 200
    delivered = await client.post(
        f"/v1/gruh-udyog/orders/{order_id}/status",
        json={"status": "delivered"},
        headers=auth(token),
    )
    assert delivered.status_code == 200

    dashboard = await client.get(
        f"/v1/gruh-udyog/units/{unit_id}/dashboard", headers=auth(token)
    )
    assert dashboard.status_code == 200
    body = dashboard.json()
    assert body["orders"] == 1
    assert body["liveProducts"] == 1
    assert body["orderStates"] == {"delivered": 1}
    assert body["revenuePaisa"] == 100_000

    other = await client.get(f"/v1/gruh-udyog/units/{unit_id}/orders", headers=auth(buyer))
    assert other.status_code == 403


async def test_reject_order_and_block_transitions(client, user_store):
    token = seed_user(user_store)
    buyer = seed_user(user_store, uid="uid-2")
    unit_id = await _register_unit(client, token)
    product_id = await _add_product(client, token, unit_id, HANDICRAFT_PRODUCT)
    mall_id = (await _publish(client, token, product_id)).json()["mallProductId"]
    order_id = await _place_mall_order(client, buyer, mall_id, key="ord-key-2")

    rejected = await client.post(
        f"/v1/gruh-udyog/orders/{order_id}/reject",
        json={"reason": "festive rush, cannot fulfil"},
        headers=auth(token),
    )
    assert rejected.status_code == 200
    assert rejected.json()["fulfillment"]["status"] == "rejected"

    blocked = await client.post(
        f"/v1/gruh-udyog/orders/{order_id}/status",
        json={"status": "packed"},
        headers=auth(token),
    )
    assert blocked.status_code == 409


async def test_dispatched_alias_maps_to_shipped(client, user_store):
    token = seed_user(user_store)
    buyer = seed_user(user_store, uid="uid-2")
    unit_id = await _register_unit(client, token)
    product_id = await _add_product(client, token, unit_id, HANDICRAFT_PRODUCT)
    mall_id = (await _publish(client, token, product_id)).json()["mallProductId"]
    order_id = await _place_mall_order(client, buyer, mall_id, key="ord-key-dispatched")

    await client.post(f"/v1/gruh-udyog/orders/{order_id}/accept", headers=auth(token))
    await client.post(
        f"/v1/gruh-udyog/orders/{order_id}/status",
        json={"status": "packed"},
        headers=auth(token),
    )
    # The website's older "dispatched" label is an alias for `shipped`.
    resp = await client.post(
        f"/v1/gruh-udyog/orders/{order_id}/status",
        json={"status": "dispatched"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["fulfillment"]["status"] == "shipped"
    history = resp.json()["fulfillment"]["history"]
    assert history[-1]["status"] == "shipped"


async def test_cancel_before_packed_restores_stock(client, user_store):
    token = seed_user(user_store)
    buyer = seed_user(user_store, uid="uid-2")
    unit_id = await _register_unit(client, token)
    product_id = await _add_product(client, token, unit_id, HANDICRAFT_PRODUCT)
    mall_id = (await _publish(client, token, product_id)).json()["mallProductId"]
    # Placing the mall order decremented the live listing stock 10 → 8.
    order_id = await _place_mall_order(client, buyer, mall_id, quantity=2, key="ord-key-cancel")
    assert user_store[f"products/{mall_id}"]["stock"] == 8

    accepted = await client.post(
        f"/v1/gruh-udyog/orders/{order_id}/accept", headers=auth(token)
    )
    assert accepted.status_code == 200
    cancelled = await client.post(
        f"/v1/gruh-udyog/orders/{order_id}/cancel",
        json={"reason": "raw material shortage"},
        headers=auth(token),
    )
    assert cancelled.status_code == 200
    assert cancelled.json()["fulfillment"]["status"] == "cancelled"
    assert cancelled.json()["fulfillment"]["cancelReason"] == "raw material shortage"
    # Buyer-facing stock is restored on the mall listing.
    assert user_store[f"products/{mall_id}"]["stock"] == 10

    # A cancelled fulfilment can no longer be advanced.
    blocked = await client.post(
        f"/v1/gruh-udyog/orders/{order_id}/status",
        json={"status": "packed"},
        headers=auth(token),
    )
    assert blocked.status_code == 409


async def test_cancel_after_packing_rejected(client, user_store):
    token = seed_user(user_store)
    buyer = seed_user(user_store, uid="uid-2")
    unit_id = await _register_unit(client, token)
    product_id = await _add_product(client, token, unit_id, HANDICRAFT_PRODUCT)
    mall_id = (await _publish(client, token, product_id)).json()["mallProductId"]
    order_id = await _place_mall_order(client, buyer, mall_id, key="ord-key-cancel2")
    await client.post(f"/v1/gruh-udyog/orders/{order_id}/accept", headers=auth(token))
    await client.post(
        f"/v1/gruh-udyog/orders/{order_id}/status",
        json={"status": "packed"},
        headers=auth(token),
    )
    resp = await client.post(
        f"/v1/gruh-udyog/orders/{order_id}/cancel",
        json={"reason": "changed my mind"},
        headers=auth(token),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "ORDER_NOT_CANCELLABLE"


async def test_foreign_order_returns_404(client, user_store):
    token = seed_user(user_store)
    stranger = seed_user(user_store, uid="uid-2")
    unit_id = await _register_unit(client, token)
    product_id = await _add_product(client, token, unit_id, HANDICRAFT_PRODUCT)
    mall_id = (await _publish(client, token, product_id)).json()["mallProductId"]
    buyer = seed_user(user_store, uid="uid-3")
    order_id = await _place_mall_order(client, buyer, mall_id, key="ord-key-3")

    await _register_unit(client, stranger)
    resp = await client.post(
        f"/v1/gruh-udyog/orders/{order_id}/accept", headers=auth(stranger)
    )
    assert resp.status_code == 404


async def test_other_owner_cannot_mutate_products(client, user_store):
    token = seed_user(user_store)
    unit_id = await _register_unit(client, token)
    product_id = await _add_product(client, token, unit_id, HANDICRAFT_PRODUCT)
    stranger = seed_user(user_store, uid="uid-2")

    resp = await client.put(
        f"/v1/gruh-udyog/products/{product_id}",
        json={"price": 100},
        headers=auth(stranger),
    )
    assert resp.status_code == 403
    resp = await client.post(
        f"/v1/gruh-udyog/products/{product_id}/publish", headers=auth(stranger)
    )
    assert resp.status_code == 403
    resp = await client.post(f"/v1/gruh-udyog/units/{unit_id}/pause", headers=auth(stranger))
    assert resp.status_code == 403


async def test_batches_add_stock_and_close(client, user_store):
    token = seed_user(user_store)
    unit_id = await _register_unit(client, token)
    product_id = await _add_product(client, token, unit_id, HANDICRAFT_PRODUCT)
    mall_id = (await _publish(client, token, product_id)).json()["mallProductId"]

    bad = await client.post(
        f"/v1/gruh-udyog/products/{product_id}/batches",
        json={
            "quantity": 10,
            "productionDate": "2026-10-10",
            "expiryDate": "2026-10-01",
        },
        headers=auth(token),
    )
    assert bad.status_code == 422

    batch = await client.post(
        f"/v1/gruh-udyog/products/{product_id}/batches",
        json={
            "quantity": 25,
            "productionDate": "2026-10-10",
            "expiryDate": "2026-12-10",
            "addToStock": True,
        },
        headers=auth(token),
    )
    assert batch.status_code == 201
    assert user_store[f"gruh_udyog_products/{product_id}"]["stock"] == 35
    assert user_store[f"products/{mall_id}"]["stock"] == 35

    closed = await client.post(
        f"/v1/gruh-udyog/batches/{batch.json()['id']}/status",
        json={"status": "sold_out"},
        headers=auth(token),
    )
    assert closed.status_code == 200
    again = await client.post(
        f"/v1/gruh-udyog/batches/{batch.json()['id']}/status",
        json={"status": "expired"},
        headers=auth(token),
    )
    assert again.status_code == 409

    detail = await client.get(f"/v1/gruh-udyog/products/{product_id}", headers=auth(token))
    assert len(detail.json()["batches"]) == 1


async def test_certifications_duplicate_and_public_filtering(client, user_store):
    token = seed_user(user_store)
    unit_id = await _register_unit(client, token)
    payload = {"type": "shg", "number": "SHG-MH-777", "issuingAuthority": "MSRLM"}
    first = await client.post(
        f"/v1/gruh-udyog/units/{unit_id}/certifications", json=payload, headers=auth(token)
    )
    assert first.status_code == 201
    dup = await client.post(
        f"/v1/gruh-udyog/units/{unit_id}/certifications", json=payload, headers=auth(token)
    )
    assert dup.status_code == 409

    stranger = seed_user(user_store, uid="uid-2")
    public = await client.get(
        f"/v1/gruh-udyog/units/{unit_id}/certifications", headers=auth(stranger)
    )
    assert public.json()["total"] == 0
    mine = await client.get(
        f"/v1/gruh-udyog/units/{unit_id}/certifications", headers=auth(token)
    )
    assert mine.json()["total"] == 1

    cert_doc = user_store[f"gruh_udyog_certifications/{first.json()['id']}"]
    cert_doc["status"] = "verified"
    user_store[f"gruh_udyog_certifications/{first.json()['id']}"] = cert_doc
    public = await client.get(
        f"/v1/gruh-udyog/units/{unit_id}/certifications", headers=auth(stranger)
    )
    assert public.json()["total"] == 1


async def test_offer_applies_mall_price_and_delete_restores(client, user_store):
    token = seed_user(user_store)
    unit_id = await _register_unit(client, token)
    product_id = await _add_product(client, token, unit_id, HANDICRAFT_PRODUCT)
    mall_id = (await _publish(client, token, product_id)).json()["mallProductId"]

    bad_window = await client.post(
        f"/v1/gruh-udyog/products/{product_id}/offers",
        json={
            "title": "Diwali Sale",
            "discountPercent": 20,
            "validFrom": "2026-11-05",
            "validUntil": "2026-11-01",
        },
        headers=auth(token),
    )
    assert bad_window.status_code == 422

    offer = await client.post(
        f"/v1/gruh-udyog/products/{product_id}/offers",
        json={
            "title": "Diwali Sale",
            "discountPercent": 20,
            "validFrom": "2026-10-01",
            "validUntil": "2026-11-01",
        },
        headers=auth(token),
    )
    assert offer.status_code == 201
    assert offer.json()["offerPrice"] == 480
    assert user_store[f"products/{mall_id}"]["discountedPrice"] == 480

    deleted = await client.delete(
        f"/v1/gruh-udyog/offers/{offer.json()['id']}", headers=auth(token)
    )
    assert deleted.status_code == 204
    assert user_store[f"products/{mall_id}"]["discountedPrice"] == 500


async def test_offer_created_before_publish_applies_on_publish(client, user_store):
    token = seed_user(user_store)
    unit_id = await _register_unit(client, token)
    product_id = await _add_product(client, token, unit_id, HANDICRAFT_PRODUCT)
    await client.post(
        f"/v1/gruh-udyog/products/{product_id}/offers",
        json={
            "title": "Launch Offer",
            "discountPercent": 10,
            "validFrom": "2026-10-01",
            "validUntil": "2026-12-31",
        },
        headers=auth(token),
    )
    published = await _publish(client, token, product_id)
    mall_id = published.json()["mallProductId"]
    assert user_store[f"products/{mall_id}"]["discountedPrice"] == 540


async def test_delete_product_rules(client, user_store):
    token = seed_user(user_store)
    unit_id = await _register_unit(client, token)
    live_id = await _add_product(client, token, unit_id, HANDICRAFT_PRODUCT)
    await _publish(client, token, live_id)
    resp = await client.delete(f"/v1/gruh-udyog/products/{live_id}", headers=auth(token))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "PRODUCT_LIVE"

    draft_id = await _add_product(client, token, unit_id, FOOD_PRODUCT)
    resp = await client.delete(f"/v1/gruh-udyog/products/{draft_id}", headers=auth(token))
    assert resp.status_code == 204
    assert f"gruh_udyog_products/{draft_id}" not in user_store


async def test_categories_endpoint_flags_food(client, user_store):
    token = seed_user(user_store)
    resp = await client.get("/v1/gruh-udyog/categories", headers=auth(token))
    assert resp.status_code == 200
    data = {row["category"]: row for row in resp.json()["data"]}
    assert data["Pickles & Chutneys"]["isFood"] is True
    assert data["Handicrafts"]["isFood"] is False


async def test_routes_require_auth(client):
    assert (await client.get("/v1/gruh-udyog/units/me")).status_code == 401
    assert (await client.get("/v1/gruh-udyog/categories")).status_code == 401
    assert (await client.post("/v1/gruh-udyog/units", json=_unit_payload())).status_code == 401
    assert (
        await client.get("/v1/gruh-udyog/units/gu_x/products")
    ).status_code == 401
