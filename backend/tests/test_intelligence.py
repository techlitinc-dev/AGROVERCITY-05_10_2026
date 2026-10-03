from datetime import datetime, timedelta, timezone

from tests.test_diary import auth, seed_user

TOP_LEVEL_KEYS = {"persona", "generatedAt", "kpis", "series", "breakdowns", "insights"}


def _months(n):
    now = datetime.now(timezone.utc)
    keys = []
    for i in range(n - 1, -1, -1):
        month = now.month - i
        year = now.year
        while month <= 0:
            month += 12
            year -= 1
        keys.append(f"{year:04d}-{month:02d}")
    return keys


def _deal(deal_id, status, commodity, commission, agreed_rate, created, updated):
    return {
        "id": deal_id,
        "brokerId": "uid-b1",
        "commodity": commodity,
        "status": status,
        "agreedRate": agreed_rate,
        "commissionAmount": commission,
        "createdAt": created,
        "updatedAt": updated,
    }


def _purchase(pur_id, buyer, farmer, crop, qty, price, status, created, **extra):
    doc = {
        "id": pur_id,
        "buyerId": buyer,
        "farmerId": farmer,
        "crop": crop,
        "quantity": qty,
        "unit": "quintal",
        "agreedPricePerUnit": price,
        "totalAmount": round(qty * price, 2),
        "status": status,
        "payments": [],
        "createdAt": created,
    }
    doc.update(extra)
    return doc


# ---- broker ----


async def test_broker_funnel_math_and_shape(client, user_store):
    token = seed_user(user_store, uid="uid-b1", active_profile="broker")
    now = datetime.now(timezone.utc)
    sep = now.strftime("%Y-%m")
    aug = (now - timedelta(days=60)).strftime("%Y-%m")
    user_store["broker_deals/d1"] = _deal("d1", "completed", "Tomato", 2200, 2000, f"{sep}-10T00:00:00+00:00", f"{sep}-20T00:00:00+00:00")
    user_store["broker_deals/d2"] = _deal("d2", "completed", "Onion", 1000, 2100, f"{aug}-01T00:00:00+00:00", f"{aug}-11T00:00:00+00:00")
    user_store["broker_deals/d3"] = _deal("d3", "negotiating", "Tomato", 500, 2000, f"{sep}-15T00:00:00+00:00", f"{sep}-15T00:00:00+00:00")
    user_store["mandi_prices/m1"] = {
        "id": "m1", "commodity": "Tomato (टमाटर)", "modalPrice": 2200, "mandiName": "Pimpalgaon",
    }

    resp = await client.get("/v1/intelligence", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert set(body) == TOP_LEVEL_KEYS
    assert body["persona"] == "broker"
    kpis = {k["key"]: k for k in body["kpis"]}
    assert kpis["activeDeals"]["value"] == 1
    assert kpis["totalEarned"]["value"] == 3200
    assert kpis["pendingPayout"]["value"] == 500
    assert kpis["avgDaysToClose"]["value"] == 10.0
    assert all(set(k) >= {"key", "labelKey", "value"} for k in body["kpis"])

    series = body["series"][0]
    assert series["labelKey"]
    points = {p["label"]: p["value"] for p in series["points"]}
    assert list(points) == _months(6)
    assert points[sep] == 2700
    assert points[aug] == 1000
    assert all(set(p) == {"label", "value"} for p in series["points"])

    breakdown = body["breakdowns"][0]
    assert breakdown["items"][0]["label"] == "Tomato"
    assert breakdown["items"][0]["value"] == 2700

    assert body["insights"][0]["severity"] == "opportunity"
    assert body["insights"][0]["labelKey"] == "mandi_up_for_your_crop"
    assert body["insights"][0]["params"]["crop"] == "Tomato"
    assert body["insights"][0]["params"]["pct"] == 10.0


async def test_broker_empty_is_valid(client, user_store):
    token = seed_user(user_store, uid="uid-b1", active_profile="broker")
    resp = await client.get("/v1/intelligence", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert set(body) == TOP_LEVEL_KEYS
    # counts from a real (empty) query are legitimate zeros; derived
    # stats/series/breakdowns with no source rows are omitted
    kpis = {k["key"]: k["value"] for k in body["kpis"]}
    assert kpis == {"activeDeals": 0, "totalEarned": 0, "pendingPayout": 0}
    assert body["series"] == []
    assert body["breakdowns"] == []
    assert body["insights"] == []


# ---- seller / directBuyer ----


async def test_buyer_kpis_and_win_rate_guard(client, user_store):
    token = seed_user(user_store, uid="uid-1", active_profile="directBuyer")
    now = datetime.now(timezone.utc)
    sep = now.strftime("%Y-%m")
    user_store["purchases/p1"] = _purchase("p1", "uid-1", "uid-f1", "Tomato", 10, 2000, "completed", f"{sep}-05T00:00:00+00:00", finalAmount=20000)
    user_store["purchases/p2"] = _purchase("p2", "uid-1", "uid-f1", "Onion", 5, 1000, "confirmed", f"{sep}-06T00:00:00+00:00")
    user_store["purchases/p3"] = _purchase("p3", "uid-1", "uid-f2", "Tomato", 5, 2000, "cancelled", f"{sep}-07T00:00:00+00:00")

    resp = await client.get("/v1/intelligence", headers=auth(token))
    body = resp.json()
    assert body["persona"] == "directBuyer"
    kpis = {k["key"]: k for k in body["kpis"]}
    assert kpis["totalSpend"]["value"] == 25000  # cancelled excluded
    assert kpis["completedPurchases"]["value"] == 1
    assert kpis["activePurchases"]["value"] == 1
    assert "offerWinRate" not in kpis  # div-zero guard: no offers yet

    user_store["offers/o1"] = {"id": "o1", "fromId": "uid-1", "toId": "uid-f1", "status": "accepted", "createdAt": f"{sep}-01T00:00:00+00:00"}
    user_store["offers/o2"] = {"id": "o2", "fromId": "uid-1", "toId": "uid-f2", "status": "pending", "createdAt": f"{sep}-02T00:00:00+00:00"}
    user_store["offers/o3"] = {"id": "o3", "fromId": "uid-1", "toId": "uid-f3", "status": "withdrawn", "createdAt": f"{sep}-03T00:00:00+00:00"}

    resp = await client.get("/v1/intelligence", headers=auth(token))
    kpis = {k["key"]: k for k in resp.json()["kpis"]}
    assert kpis["offerWinRate"]["value"] == 50.0  # 1 accepted / 2 non-withdrawn
    assert kpis["offerWinRate"]["unit"] == "%"


async def test_buyer_below_mandi_and_balance_due(client, user_store):
    token = seed_user(user_store, uid="uid-1", active_profile="seller")
    now = datetime.now(timezone.utc)
    sep = now.strftime("%Y-%m")
    user_store["purchases/p1"] = _purchase("p1", "uid-1", "uid-f1", "Tomato", 10, 1800, "completed", f"{sep}-05T00:00:00+00:00", finalAmount=18000)
    user_store["mandi_prices/m1"] = {"id": "m1", "commodity": "Tomato (टमाटर)", "modalPrice": 2000, "mandiName": "Nashik"}
    resp = await client.get("/v1/intelligence", headers=auth(token))
    body = resp.json()
    insights = {i["labelKey"]: i for i in body["insights"]}
    assert insights["buying_below_mandi"]["params"] == {"crop": "Tomato", "pct": 10.0}
    assert insights["balance_due"]["params"]["amount"] == 18000


# ---- farmer ----


async def test_farmer_stale_lot_and_offer_counts(client, user_store):
    token = seed_user(user_store, uid="uid-f1", active_profile="farmer")
    now = datetime.now(timezone.utc)
    this_month = now.strftime("%Y-%m")
    old = (now - timedelta(days=9)).isoformat()
    user_store["market_lots/lot_old"] = {
        "id": "lot_old", "farmerId": "uid-f1", "crop": "Tomato", "status": "open", "createdAt": old,
    }
    user_store["market_lots/lot_new"] = {
        "id": "lot_new", "farmerId": "uid-f1", "crop": "Onion", "status": "open", "createdAt": now.isoformat(),
    }
    user_store["offers/of1"] = {"id": "of1", "fromId": "uid-b1", "toId": "uid-f1", "targetType": "lot", "targetId": "lot_new", "status": "pending", "createdAt": now.isoformat()}
    user_store["purchases/p1"] = _purchase("p1", "uid-b1", "uid-f1", "Tomato", 10, 1900, "completed", f"{this_month}-04T00:00:00+00:00", finalAmount=19000)

    resp = await client.get("/v1/intelligence", headers=auth(token))
    body = resp.json()
    assert body["persona"] == "farmer"
    kpis = {k["key"]: k for k in body["kpis"]}
    assert kpis["activeLots"]["value"] == 2
    assert kpis["offersReceived"]["value"] == 1
    assert kpis["completedSales"]["value"] == 1
    insights = {i["labelKey"]: i for i in body["insights"]}
    assert insights["stale_lot"]["severity"] == "warning"
    assert insights["stale_lot"]["params"] == {"crop": "Tomato"}
    assert "sold_below_mandi" not in insights  # no mandi_price_history seeded


async def test_farmer_sold_below_mandi_uses_history(client, user_store):
    token = seed_user(user_store, uid="uid-f1", active_profile="farmer")
    now = datetime.now(timezone.utc)
    this_month = now.strftime("%Y-%m")
    user_store["purchases/p1"] = _purchase("p1", "uid-b1", "uid-f1", "Tomato", 10, 1500, "completed", f"{this_month}-04T00:00:00+00:00", finalAmount=15000)
    user_store["mandi_price_history/h1"] = {
        "id": "h1", "commodity": "Tomato (टमाटर)", "mandiName": "Nashik", "date": f"{this_month}-04", "modalPrice": 2000,
    }
    resp = await client.get("/v1/intelligence", headers=auth(token))
    insights = {i["labelKey"]: i for i in resp.json()["insights"]}
    assert insights["sold_below_mandi"]["severity"] == "info"
    assert insights["sold_below_mandi"]["params"] == {"crop": "Tomato"}


# ---- transport ----


async def test_transport_settlement_insight(client, user_store):
    token = seed_user(user_store, uid="uid-t1", active_profile="transport")
    now = datetime.now(timezone.utc)
    this_month = now.strftime("%Y-%m")
    user_store["vehicles/v1"] = {"id": "v1", "ownerId": "uid-t1", "registrationNo": "MH-15-AB-1234", "active": True}
    user_store["transport_bookings/b1"] = {
        "id": "b1", "vehicleId": "v1", "vehicleNo": "MH-15-AB-1234", "status": "delivered", "fare": 3000, "date": f"{this_month}-02",
    }
    user_store["transport_bookings/b2"] = {
        "id": "b2", "vehicleId": "v1", "vehicleNo": "MH-15-AB-1234", "status": "accepted", "fare": 1000, "date": f"{this_month}-03",
    }
    user_store["transport_bookings/b3"] = {
        "id": "b3", "vehicleId": "v-other", "status": "delivered", "fare": 9999, "date": f"{this_month}-02",
    }
    user_store["settlements/s1"] = {
        "id": "s1", "role": "transport", "entityId": "uid-t1", "status": "pending", "netRupees": 2700,
    }
    resp = await client.get("/v1/intelligence", headers=auth(token))
    body = resp.json()
    assert body["persona"] == "transport"
    kpis = {k["key"]: k for k in body["kpis"]}
    assert kpis["activeTrips"]["value"] == 1
    assert kpis["monthlyRevenue"]["value"] == 3000
    assert kpis["completedTrips"]["value"] == 1
    assert kpis["completionRate"]["value"] == 50.0
    assert kpis["completionRate"]["unit"] == "%"
    insights = {i["labelKey"]: i for i in body["insights"]}
    assert insights["settlement_pending"]["params"] == {"amount": 2700}
    breakdown = body["breakdowns"][0]
    assert breakdown["items"][0]["label"] == "MH-15-AB-1234"
    assert breakdown["items"][0]["value"] == 3000
    assert all(i["label"] != "v-other" for i in breakdown["items"])


# ---- persona gate ----


async def test_unsupported_persona_404(client, user_store):
    token = seed_user(user_store, uid="uid-x", active_profile="dairyManager")
    resp = await client.get("/v1/intelligence", headers=auth(token))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "INTELLIGENCE_NOT_AVAILABLE"
