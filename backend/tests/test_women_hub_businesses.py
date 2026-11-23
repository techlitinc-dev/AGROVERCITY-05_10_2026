"""Women Hub xlsx features — businesses (A2/B1/B2/B5/A6/B4), garden tracker
(A3), enterprise income ledger (A4), dashboard/insights additions (A1/A7)."""
from tests.test_diary import auth, seed_user


def _seed_woman(user_store, uid="uid-w1", lat=18.5204, lng=73.8567, **overrides):
    return seed_user(
        user_store,
        uid=uid,
        name="Sunita Patil",
        village="Baramati",
        district="Pune",
        lat=lat,
        lng=lng,
        **overrides,
    )


def _seed_farmer(user_store, uid="uid-f1", lat=18.5300, lng=73.8600):
    return seed_user(user_store, uid=uid, name="Ram Patil", village="Baramati", district="Pune", lat=lat, lng=lng)


def _business_payload(**overrides):
    payload = {
        "name": "Sunita Tiffin Service",
        "category": "tiffin/dabba service",
        "description": "Home-cooked daily tiffin",
        "photo": "https://example.com/photo.jpg",
        "serviceArea": "Baramati",
        "workingDays": "Mon-Sat",
        "workingTime": "8:00-18:00",
    }
    payload.update(overrides)
    return payload


async def _create_business(client, token, **overrides):
    resp = await client.post("/v1/women/businesses", json=_business_payload(**overrides), headers=auth(token))
    assert resp.status_code == 201
    return resp.json()


# ---------------------------------------------------------------- businesses


async def test_create_business_copies_location_from_profile(client, user_store):
    token = _seed_woman(user_store)
    doc = await _create_business(client, token)
    assert doc["status"] == "active"
    assert doc["ratingAvg"] == 0.0
    assert "Baramati" in doc["location"]
    assert "Pune" in doc["location"]


async def test_woman_can_create_multiple_businesses(client, user_store):
    token = _seed_woman(user_store)
    await _create_business(client, token)
    await _create_business(client, token, name="Sunita Tailoring", category="tailoring")
    resp = await client.get("/v1/women/businesses", headers=auth(token))
    assert resp.status_code == 200
    assert len(resp.json()["items"]) == 2


async def test_search_own_businesses(client, user_store):
    token = _seed_woman(user_store)
    await _create_business(client, token)
    await _create_business(client, token, name="Sunita Tailoring", category="tailoring")
    resp = await client.get("/v1/women/businesses", params={"q": "tailor"}, headers=auth(token))
    items = resp.json()["items"]
    assert len(items) == 1
    assert items[0]["name"] == "Sunita Tailoring"


async def test_edit_pause_resume_delete_business(client, user_store):
    token = _seed_woman(user_store)
    business = await _create_business(client, token)
    bid = business["id"]

    edit = await client.put(
        f"/v1/women/businesses/{bid}",
        json=_business_payload(name="Sunita Tiffin", workingTime="7:00-19:00"),
        headers=auth(token),
    )
    assert edit.status_code == 200
    assert edit.json()["workingTime"] == "7:00-19:00"

    paused = await client.post(f"/v1/women/businesses/{bid}/pause", headers=auth(token))
    assert paused.json()["status"] == "paused"
    resumed = await client.post(f"/v1/women/businesses/{bid}/resume", headers=auth(token))
    assert resumed.json()["status"] == "active"

    deleted = await client.delete(f"/v1/women/businesses/{bid}", headers=auth(token))
    assert deleted.status_code == 204
    gone = await client.get(f"/v1/women/businesses/{bid}", headers=auth(token))
    assert gone.status_code == 404


async def test_other_user_cannot_touch_my_business(client, user_store):
    token = _seed_woman(user_store)
    other = _seed_farmer(user_store, uid="uid-f9")
    business = await _create_business(client, token)
    bid = business["id"]
    assert (await client.put(f"/v1/women/businesses/{bid}", json=_business_payload(), headers=auth(other))).status_code == 404
    assert (await client.post(f"/v1/women/businesses/{bid}/pause", headers=auth(other))).status_code == 404
    assert (await client.delete(f"/v1/women/businesses/{bid}", headers=auth(other))).status_code == 404


# ---------------------------------------------------------------- products


async def test_business_products_crud(client, user_store):
    token = _seed_woman(user_store)
    business = await _create_business(client, token)
    bid = business["id"]
    created = await client.post(
        f"/v1/women/businesses/{bid}/products",
        json={"name": "Thepla tiffin", "pricePaisa": 8000, "stock": 20},
        headers=auth(token),
    )
    assert created.status_code == 201
    pid = created.json()["id"]

    updated = await client.put(
        f"/v1/women/businesses/{bid}/products/{pid}",
        json={"name": "Thepla tiffin", "pricePaisa": 9000, "stock": 15},
        headers=auth(token),
    )
    assert updated.json()["pricePaisa"] == 9000

    detail = await client.get(f"/v1/women/businesses/{bid}", headers=auth(token))
    assert len(detail.json()["products"]) == 1

    removed = await client.delete(f"/v1/women/businesses/{bid}/products/{pid}", headers=auth(token))
    assert removed.status_code == 204
    detail = await client.get(f"/v1/women/businesses/{bid}", headers=auth(token))
    assert detail.json()["products"] == []


# ---------------------------------------------------------------- farmer discovery (B1/B2)


async def test_farmer_discovers_business_cards(client, user_store):
    wtoken = _seed_woman(user_store)
    ftoken = _seed_farmer(user_store)
    business = await _create_business(client, wtoken)
    await client.post(
        f"/v1/women/businesses/{business['id']}/products",
        json={"name": "Pickle 500g", "pricePaisa": 12000, "stock": 10},
        headers=auth(wtoken),
    )
    await client.post(f"/v1/women-hub/businesses/{business['id']}/rate", json={"rating": 5, "review": "Great"}, headers=auth(ftoken))

    resp = await client.get("/v1/women-hub/businesses", headers=auth(ftoken))
    assert resp.status_code == 200
    cards = resp.json()["items"]
    assert len(cards) == 1
    card = cards[0]
    # xlsx card = photo, name, category, rating, location
    for field in ("photo", "name", "category", "ratingAvg", "location"):
        assert field in card
    assert card["ratingAvg"] == 5.0
    assert "phone" not in card


async def test_discovery_filters_category_distance_and_search(client, user_store):
    wtoken = _seed_woman(user_store, uid="uid-w1", lat=18.5204, lng=73.8567)  # ~1.3km away
    ftoken = _seed_farmer(user_store, lat=18.5300, lng=73.8600)
    await _create_business(client, wtoken)
    await _create_business(
        client, wtoken, name="Sunita Tailoring", category="tailoring", description="Stitching and alterations"
    )

    by_cat = await client.get("/v1/women-hub/businesses", params={"category": "tailoring"}, headers=auth(ftoken))
    assert [c["category"] for c in by_cat.json()["items"]] == ["tailoring"]

    by_q = await client.get("/v1/women-hub/businesses", params={"q": "tiffin"}, headers=auth(ftoken))
    assert len(by_q.json()["items"]) == 1

    near = await client.get("/v1/women-hub/businesses", params={"distanceKm": 5}, headers=auth(ftoken))
    assert len(near.json()["items"]) == 2
    far = await client.get("/v1/women-hub/businesses", params={"distanceKm": 0.5}, headers=auth(ftoken))
    assert far.json()["items"] == []


async def test_business_profile_exposes_store_fields_no_phone(client, user_store):
    wtoken = _seed_woman(user_store)
    ftoken = _seed_farmer(user_store)
    business = await _create_business(client, wtoken)
    bid = business["id"]
    await client.post(
        f"/v1/women/businesses/{bid}/products",
        json={"name": "Papad pack", "pricePaisa": 6000, "stock": 0},
        headers=auth(wtoken),
    )
    await client.post(
        f"/v1/women/businesses/{bid}/products",
        json={"name": "Ghee 1L", "pricePaisa": 45000, "stock": 5},
        headers=auth(wtoken),
    )
    resp = await client.get(f"/v1/women-hub/businesses/{bid}", headers=auth(ftoken))
    body = resp.json()
    store = body["business"]
    assert store["workingDays"] == "Mon-Sat"
    assert store["workingTime"] == "8:00-18:00"
    assert store["description"] == "Home-cooked daily tiffin"
    serialized = str(body)
    assert "+91" not in serialized  # in-app only — no phone number
    names = [p["name"] for p in body["products"]]
    assert names == ["Ghee 1L"]  # out-of-stock hidden from the storefront


# ---------------------------------------------------------------- enquiries (B5)


async def test_enquiry_pending_responded_flow(client, user_store):
    wtoken = _seed_woman(user_store)
    ftoken = _seed_farmer(user_store)
    business = await _create_business(client, wtoken)
    bid = business["id"]

    posted = await client.post(
        f"/v1/women-hub/businesses/{bid}/enquiries",
        json={"productName": "Tiffin monthly", "quantity": "30 boxes", "message": "Monthly rate?"},
        headers=auth(ftoken),
    )
    assert posted.status_code == 201
    assert posted.json()["status"] == "pending"

    history = await client.get("/v1/women-hub/enquiries", headers=auth(ftoken))
    items = history.json()["items"]
    assert len(items) == 1
    assert items[0]["status"] == "pending"
    assert items[0]["businessName"] == "Sunita Tiffin Service"

    detail = await client.get(f"/v1/women/businesses/{bid}", headers=auth(wtoken))
    enquiry_id = detail.json()["enquiries"][0]["id"]

    responded = await client.post(
        f"/v1/women/businesses/enquiries/{enquiry_id}/respond",
        json={"response": "₹1200/month for 30 boxes"},
        headers=auth(wtoken),
    )
    assert responded.json()["status"] == "responded"

    history = await client.get("/v1/women-hub/enquiries", headers=auth(ftoken))
    assert history.json()["items"][0]["status"] == "responded"
    assert history.json()["items"][0]["response"] == "₹1200/month for 30 boxes"


# ---------------------------------------------------------------- orders (A6/B4)


async def _setup_order(client, user_store, stock=10):
    wtoken = _seed_woman(user_store)
    ftoken = _seed_farmer(user_store)
    business = await _create_business(client, wtoken)
    bid = business["id"]
    product = await client.post(
        f"/v1/women/businesses/{bid}/products",
        json={"name": "Pickle 500g", "pricePaisa": 12000, "stock": stock},
        headers=auth(wtoken),
    )
    pid = product.json()["id"]
    return wtoken, ftoken, bid, pid


async def test_order_full_pipeline_exact_xlsx_statuses(client, user_store):
    wtoken, ftoken, bid, pid = await _setup_order(client, user_store)
    placed = await client.post(
        f"/v1/women-hub/businesses/{bid}/orders",
        json={"productId": pid, "quantity": 2},
        headers=auth(ftoken),
    )
    assert placed.status_code == 201
    order = placed.json()
    assert order["status"] == "placed"
    assert order["totalPaisa"] == 24000
    # stock reserved at placement
    profile = await client.get(f"/v1/women-hub/businesses/{bid}", headers=auth(ftoken))
    assert profile.json()["products"][0]["stock"] == 8

    # buyer sees the farmer-side pipeline
    for status in ("accepted", "packed", "pickup", "in_transit", "delivered"):
        resp = await client.post(
            f"/v1/women/businesses/orders/{order['id']}/status",
            json={"status": status},
            headers=auth(wtoken),
        )
        assert resp.status_code == 200, status
        assert resp.json()["status"] == status

    orders = await client.get("/v1/women-hub/orders", headers=auth(ftoken))
    assert orders.json()["items"][0]["status"] == "delivered"
    timeline = [t["status"] for t in orders.json()["items"][0]["timeline"]]
    assert timeline == ["placed", "accepted", "packed", "pickup", "in_transit", "delivered"]


async def test_order_invalid_transition_and_cancel_rules(client, user_store):
    wtoken, ftoken, bid, pid = await _setup_order(client, user_store)
    order = (
        await client.post(
            f"/v1/women-hub/businesses/{bid}/orders",
            json={"productId": pid, "quantity": 1},
            headers=auth(ftoken),
        )
    ).json()
    oid = order["id"]

    # skip accepted → packed is invalid
    bad = await client.post(
        f"/v1/women/businesses/orders/{oid}/status", json={"status": "packed"}, headers=auth(wtoken)
    )
    assert bad.status_code == 409
    assert bad.json()["error"]["code"] == "INVALID_ORDER_STATUS"

    # farmer cancels before acceptance → stock restored
    cancelled = await client.post(f"/v1/women-hub/orders/{oid}/cancel", headers=auth(ftoken))
    assert cancelled.json()["status"] == "cancelled"
    profile = await client.get(f"/v1/women-hub/businesses/{bid}", headers=auth(ftoken))
    assert profile.json()["products"][0]["stock"] == 10

    # cancel after acceptance is rejected
    order2 = (
        await client.post(
            f"/v1/women-hub/businesses/{bid}/orders",
            json={"productId": pid, "quantity": 1},
            headers=auth(ftoken),
        )
    ).json()
    await client.post(
        f"/v1/women/businesses/orders/{order2['id']}/status",
        json={"status": "accepted"},
        headers=auth(wtoken),
    )
    late = await client.post(f"/v1/women-hub/orders/{order2['id']}/cancel", headers=auth(ftoken))
    assert late.status_code == 409


async def test_cannot_order_own_business_or_out_of_stock(client, user_store):
    wtoken, ftoken, bid, pid = await _setup_order(client, user_store, stock=1)
    own = await client.post(
        f"/v1/women-hub/businesses/{bid}/orders", json={"productId": pid, "quantity": 1}, headers=auth(wtoken)
    )
    assert own.status_code == 409
    oos = await client.post(
        f"/v1/women-hub/businesses/{bid}/orders", json={"productId": pid, "quantity": 5}, headers=auth(ftoken)
    )
    assert oos.status_code == 409
    assert oos.json()["error"]["code"] == "INSUFFICIENT_STOCK"


async def test_paused_business_hidden_and_cannot_take_orders(client, user_store):
    wtoken, ftoken, bid, pid = await _setup_order(client, user_store)
    await client.post(f"/v1/women/businesses/{bid}/pause", headers=auth(wtoken))
    resp = await client.get("/v1/women-hub/businesses", headers=auth(ftoken))
    assert resp.json()["items"] == []
    blocked = await client.post(
        f"/v1/women-hub/businesses/{bid}/orders", json={"productId": pid, "quantity": 1}, headers=auth(ftoken)
    )
    assert blocked.status_code == 404


async def test_business_orders_merge_emarket_orders(client, user_store):
    """xlsx A2/A6: the business order list is "from farmers/e-market" — the
    woman's Krishi Mall orders sit alongside her Women Hub orders."""
    wtoken, ftoken, bid, pid = await _setup_order(client, user_store)
    hub = (
        await client.post(
            f"/v1/women-hub/businesses/{bid}/orders",
            json={"productId": pid, "quantity": 1},
            headers=auth(ftoken),
        )
    ).json()

    # a mall (e-market) order where the woman is the seller
    user_store["products/prod_1"] = {
        "id": "prod_1",
        "sellerId": "uid-w1",
        "title": "Methi Papad 200g",
        "discountedPrice": 70,
        "imageUrl": "https://example.com/papad.jpg",
        "stock": 18,
    }
    user_store["orders/ord_em1"] = {
        "id": "ord_em1",
        "userId": "uid-f1",
        "sellerId": "uid-w1",
        "items": [{"productId": "prod_1", "quantity": 2}],
        "total": 140,
        "status": "confirmed",
        "events": [{"status": "placed", "at": "2026-11-22T10:00:00+00:00", "note": ""}],
        "createdAt": "2026-11-22T10:00:00+00:00",
    }

    detail = await client.get(f"/v1/women/businesses/{bid}", headers=auth(wtoken))
    assert detail.status_code == 200
    orders = detail.json()["orders"]
    assert len(orders) == 2
    by_source = {o["source"]: o for o in orders}
    assert by_source["women_hub"]["id"] == hub["id"]
    em = by_source["e_market"]
    assert em["id"] == "ord_em1"
    assert em["status"] == "confirmed"  # mall pipeline kept as-is
    assert em["totalPaisa"] == 14000
    assert em["productName"] == "Methi Papad 200g"
    assert em["photo"] == "https://example.com/papad.jpg"
    assert em["buyerName"] == "Ram Patil"
    assert em["quantity"] == 2
    # merged newest-first across both sources (hub order was placed today)
    assert orders[0]["source"] == "women_hub"

    # the dedicated orders endpoint merges the same way
    items = (
        await client.get(f"/v1/women/businesses/{bid}/orders", headers=auth(wtoken))
    ).json()["items"]
    assert {o["source"] for o in items} == {"women_hub", "e_market"}

    # the hub status endpoint must not touch mall orders
    blocked = await client.post(
        f"/v1/women/businesses/orders/ord_em1/status",
        json={"status": "packed"},
        headers=auth(wtoken),
    )
    assert blocked.status_code == 404


# ---------------------------------------------------------------- ratings


async def test_rate_business_updates_card_rating(client, user_store):
    wtoken = _seed_woman(user_store)
    f1 = _seed_farmer(user_store, uid="uid-f1")
    f2 = _seed_farmer(user_store, uid="uid-f2")
    business = await _create_business(client, wtoken)
    bid = business["id"]
    await client.post(f"/v1/women-hub/businesses/{bid}/rate", json={"rating": 4, "review": "Good"}, headers=auth(f1))
    rated = await client.post(f"/v1/women-hub/businesses/{bid}/rate", json={"rating": 5}, headers=auth(f2))
    assert rated.json()["ratingAvg"] == 4.5
    assert rated.json()["ratingCount"] == 2
    own = await client.post(f"/v1/women-hub/businesses/{bid}/rate", json={"rating": 5}, headers=auth(wtoken))
    assert own.status_code == 409


# ---------------------------------------------------------------- garden tracker (A3)


async def test_garden_crop_lifecycle(client, user_store):
    token = _seed_woman(user_store)
    crop = (
        await client.post(
            "/v1/women/garden-crops",
            json={"name": "Spinach", "nutrition": "iron", "season": "winter"},
            headers=auth(token),
        )
    ).json()
    assert crop["stage"] == "sowing"

    for stage in ("sprout", "vegetative", "flowering", "harvest"):
        resp = await client.post(
            f"/v1/women/garden-crops/{crop['id']}/stage", json={"stage": stage}, headers=auth(token)
        )
        assert resp.json()["stage"] == stage

    # invalid: harvest → sowing
    bad = await client.post(
        f"/v1/women/garden-crops/{crop['id']}/stage", json={"stage": "sowing"}, headers=auth(token)
    )
    assert bad.status_code == 409
    # invalid: skip vegetative
    crop2 = (
        await client.post("/v1/women/garden-crops", json={"name": "Tomato"}, headers=auth(token))
    ).json()
    skip = await client.post(
        f"/v1/women/garden-crops/{crop2['id']}/stage", json={"stage": "flowering"}, headers=auth(token)
    )
    assert skip.status_code == 409


async def test_garden_reminders_and_yield_log(client, user_store):
    token = _seed_woman(user_store)
    today = __import__("datetime").date.today()
    soon = (today + __import__("datetime").timedelta(days=2)).isoformat()
    crop = (
        await client.post("/v1/women/garden-crops", json={"name": "Methi"}, headers=auth(token))
    ).json()
    reminder = await client.post(
        f"/v1/women/garden-crops/{crop['id']}/reminders",
        json={"type": "water", "dueDate": soon},
        headers=auth(token),
    )
    assert reminder.status_code == 201
    bad_type = await client.post(
        f"/v1/women/garden-crops/{crop['id']}/reminders",
        json={"type": "spray", "dueDate": soon},
        headers=auth(token),
    )
    assert bad_type.status_code == 422

    listing = await client.get("/v1/women/garden-crops", headers=auth(token))
    assert len(listing.json()["dueReminders"]) == 1
    assert listing.json()["calendar"]["sakaYear"] > 1900

    rid = reminder.json()["id"]
    done = await client.post(f"/v1/women/garden-crops/{crop['id']}/reminders/{rid}/done", headers=auth(token))
    assert done.json()["doneAt"]
    listing = await client.get("/v1/women/garden-crops", headers=auth(token))
    assert listing.json()["dueReminders"] == []

    yield_entry = await client.post(
        f"/v1/women/garden-crops/{crop['id']}/yield",
        json={"date": today.isoformat(), "quantity": 2.5, "unit": "kg"},
        headers=auth(token),
    )
    assert yield_entry.status_code == 201

    removed = await client.delete(f"/v1/women/garden-crops/{crop['id']}", headers=auth(token))
    assert removed.status_code == 204


# ---------------------------------------------------------------- enterprise ledger (A4)


async def _enterprise_line(client, token):
    resp = await client.post(
        "/v1/women/home-enterprise",
        json={"product": "Pickle", "monthlyProfitPaisa": 50000, "quantity": "20 jars", "pricePaisa": 15000},
        headers=auth(token),
    )
    assert resp.status_code == 201
    return resp.json()


async def test_enterprise_month_profit_is_revenue_minus_cost(client, user_store):
    token = _seed_woman(user_store)
    line = await _enterprise_line(client, token)
    entry = await client.post(
        f"/v1/women/home-enterprise/{line['id']}/entries",
        json={"month": "2026-11", "revenuePaisa": 300000, "costPaisa": 180000},
        headers=auth(token),
    )
    assert entry.json()["profitPaisa"] == 120000

    ledger = await client.get("/v1/women/home-enterprise/ledger", params={"month": "2026-11"}, headers=auth(token))
    body = ledger.json()
    assert body["revenueTotalPaisa"] == 300000
    assert body["costTotalPaisa"] == 180000
    assert body["totalProfitPaisa"] == 120000
    assert body["lines"][0]["quantity"] == "20 jars"
    assert body["lines"][0]["pricePaisa"] == 15000


async def test_enterprise_expenses_reduce_auto_total(client, user_store):
    token = _seed_woman(user_store)
    line = await _enterprise_line(client, token)
    await client.post(
        f"/v1/women/home-enterprise/{line['id']}/entries",
        json={"month": "2026-11", "revenuePaisa": 300000, "costPaisa": 180000},
        headers=auth(token),
    )
    expense = await client.post(
        f"/v1/women/home-enterprise/{line['id']}/expenses",
        json={"month": "2026-11", "note": "jars & labels", "amountPaisa": 15000},
        headers=auth(token),
    )
    assert expense.status_code == 201
    ledger = await client.get("/v1/women/home-enterprise/ledger", params={"month": "2026-11"}, headers=auth(token))
    assert ledger.json()["expenseTotalPaisa"] == 15000
    assert ledger.json()["totalProfitPaisa"] == 105000

    removed = await client.delete(
        f"/v1/women/home-enterprise/expenses/{expense.json()['id']}", headers=auth(token)
    )
    assert removed.status_code == 204
    ledger = await client.get("/v1/women/home-enterprise/ledger", params={"month": "2026-11"}, headers=auth(token))
    assert ledger.json()["totalProfitPaisa"] == 120000


async def test_enterprise_graph_and_export(client, user_store):
    token = _seed_woman(user_store)
    line = await _enterprise_line(client, token)
    await client.post(
        f"/v1/women/home-enterprise/{line['id']}/entries",
        json={"month": "2026-11", "revenuePaisa": 200000, "costPaisa": 100000},
        headers=auth(token),
    )
    graph = await client.get("/v1/women/home-enterprise/graph", headers=auth(token))
    series = graph.json()["series"]
    assert len(series) == 6
    assert series[-1]["month"] == "2026-11"
    assert series[-1]["totalProfitPaisa"] == 100000

    exported = await client.get("/v1/women/home-enterprise/export", params={"month": "2026-11"}, headers=auth(token))
    assert exported.status_code == 200
    assert "text/csv" in exported.headers["content-type"]
    assert "Pickle" in exported.text
    assert "100000" in exported.text


# ---------------------------------------------------------------- dashboard / insights


async def test_dashboard_includes_businesses_and_indian_calendar(client, user_store):
    token = _seed_woman(user_store)
    await _create_business(client, token)
    await _create_business(client, token, name="Tailoring", category="tailoring")
    resp = await client.get("/v1/women/dashboard", headers=auth(token))
    body = resp.json()
    assert body["businesses"]["count"] == 2
    assert body["businesses"]["activeCount"] == 2
    assert "month" in body["calendar"] and "sakaYear" in body["calendar"]


async def test_insights_yield_prediction_from_yield_log(client, user_store):
    token = _seed_woman(user_store)
    crop = (
        await client.post("/v1/women/garden-crops", json={"name": "Spinach"}, headers=auth(token))
    ).json()
    await client.post(
        f"/v1/women/garden-crops/{crop['id']}/yield",
        json={"date": "2026-11-01", "quantity": 4.0, "unit": "kg"},
        headers=auth(token),
    )
    crop2 = (
        await client.post("/v1/women/garden-crops", json={"name": "Spinach"}, headers=auth(token))
    ).json()
    assert crop2["stage"] == "sowing"
    insights = await client.get("/v1/women/insights", headers=auth(token))
    prediction = insights.json()["garden"]["yieldPrediction"]
    assert prediction["perCropKg"]["Spinach"] == 8.0  # avg 4kg × 2 active crops
    assert prediction["totalKg"] == 8.0
