from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import pytest

from app.routers.jobs import run_subscription_planner
from app.services.geo import freshness_days, haversine_km
from app.services.gstin import GSTIN_RE, verify_gstin
from app.services.kyc import doc_matrix_for, emarket_business_requires_manual_review
from app.services.settlements import run_settlements
from app.services.worm import read_evidence
from app.services import worm as worm_service
from tests.test_diary import auth, seed_user

NOW = datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _seed_delivered_order(user_store, order_id, uid, *, value_paisa=1_000_000, hours_ago=1.0,
                          farmer_id="farmer_9", escrow_held=True, crop="tomato", district="nashik",
                          status="delivered", qty=10.0):
    unit_price = value_paisa // 100 // qty
    order = {
        "id": order_id,
        "customerId": uid,
        "farmerId": farmer_id,
        "farmerName": "Test Farmer",
        "crop": crop,
        "district": district,
        "quantityQuintals": qty,
        "pricePerQuintal": float(unit_price),
        "totalAmountRupees": value_paisa / 100,
        "orderValuePaisa": value_paisa,
        "unitPricePaisa": unit_price * 100,
        "status": status,
        "escrowStatus": "funded" if escrow_held else "unfunded",
        "escrow": {
            "status": "held" if escrow_held else "unfunded",
            "amount": value_paisa * 20 // 100 if escrow_held else 0,
            "reference": order_id,
            "fundedAt": _iso(NOW - timedelta(hours=hours_ago + 2)),
            "releasedAt": None,
            "refundedAt": None,
        },
        "inspection": None,
        "createdAt": _iso(NOW - timedelta(hours=hours_ago + 24)),
        "deliveredAt": _iso(NOW - timedelta(hours=hours_ago)),
    }
    user_store[f"customer_orders/{order_id}"] = order
    return order


# --------------------------------------------------------------------------
# 3.11 — geo helpers
# --------------------------------------------------------------------------


async def test_geo_haversine_and_freshness():
    assert haversine_km(20.0, 73.8, 20.0, 73.8) == 0.0
    # ~111.19 km per degree of latitude (haversine, R=6371).
    assert abs(haversine_km(20.0, 73.8, 21.0, 73.8) - 111.19) < 0.5
    two_days_ago = (date.today() - timedelta(days=2)).isoformat()
    assert freshness_days(two_days_ago) == 2
    assert freshness_days("not-a-date") is None
    assert freshness_days(None) is None


# --------------------------------------------------------------------------
# Existing coverage (updated to the task 3.22 contract + demo-seed removal)
# --------------------------------------------------------------------------


async def test_customer_analytics_and_demands(client, user_store):
    customer_token = seed_user(user_store, uid="cust-1", active_profile="customer")

    resp = await client.get("/v1/customer/analytics", headers=auth(customer_token))
    assert resp.status_code == 200
    analytics = resp.json()
    assert "totalSpendRupees" in analytics
    assert "monthlySpendTrend" in analytics
    assert analytics["mandiSavingsPercent"] == 0
    assert analytics["categorySpend"] == []

    demand_data = {
        "crop": "Organic Sharbati Wheat",
        "variety": "Sharbati",
        "grade": "Grade A",
        "quantityQuintals": 120.0,
        "targetMinPrice": 3100,
        "targetMaxPrice": 3350,
        "recurringFrequency": "Weekly",
        "deliveryWindow": "3 Days",
        "district": "Nashik",
        "notes": "Moisture content < 11% strictly required.",
    }
    resp = await client.post("/v1/customer/demands", json=demand_data, headers=auth(customer_token))
    assert resp.status_code == 201
    demand = resp.json()
    assert demand["crop"] == "Organic Sharbati Wheat"
    demand_id = demand["id"]

    resp = await client.get("/v1/customer/demands", headers=auth(customer_token))
    assert resp.status_code == 200
    demands_list = resp.json()
    assert demands_list["total"] >= 1

    # Real analytics: the demand we just created is reflected; the monthly
    # trend comes from real orders only (none yet).
    resp = await client.get("/v1/customer/analytics", headers=auth(customer_token))
    analytics = resp.json()
    assert analytics["standingDemandsCount"] == 1
    assert analytics["monthlySpendTrend"] == []


async def test_customer_quotes_orders_and_inspection(client, user_store):
    customer_token = seed_user(user_store, uid="cust-2", active_profile="customer")

    quote_data = {
        "crop": "Yellow Soybean",
        "offeredPricePerQuintal": 4500,
        "quantityQuintals": 80,
        "deliveryMode": "warehouse_delivery",
        "notes": "Payment via AgroVercity Escrow on delivery.",
    }
    resp = await client.post("/v1/customer/quotes", json=quote_data, headers=auth(customer_token))
    assert resp.status_code == 201
    quote = resp.json()
    assert quote["offeredPricePerQuintal"] == 4500
    assert quote["counterRounds"] == 0
    assert quote["expiresAt"]
    assert quote["priceLockUntil"]
    quote_id = quote["id"]

    counter_data = {
        "counterPricePerQuintal": 4580,
        "reason": "Includes freight allowance for direct delivery.",
    }
    resp = await client.post(f"/v1/customer/quotes/{quote_id}/counter", json=counter_data, headers=auth(customer_token))
    assert resp.status_code == 200
    countered = resp.json()
    assert countered["status"] == "countered"
    assert countered["offeredPricePerQuintal"] == 4580
    assert countered["negotiationRound"] == 2
    assert countered["counterRounds"] == 1
    assert "fairPriceBand" in countered

    # Accept the binding quote: high value => deposit escrow held.
    resp = await client.post(
        f"/v1/customer/quotes/{quote_id}/accept",
        json={"logisticsMode": "farmer_delivery"},
        headers={**auth(customer_token), "Idempotency-Key": "cust2-accept-1"},
    )
    assert resp.status_code == 201
    order = resp.json()
    assert order["status"] == "deposit_pending"
    assert order["escrowStatus"] == "funded"
    # Counter moved the price to 4580 => 36,640,000 paisa, 20% deposit.
    assert order["depositPaisa"] == 7_328_000
    assert order["logisticsMode"] == "farmer_delivery"
    assert order["escrow"]["status"] == "held"
    assert order["escrow"]["amount"] == order["depositPaisa"]
    order_id = order["id"]

    # GET /orders returns real data only (no demo seed).
    resp = await client.get("/v1/customer/orders", headers=auth(customer_token))
    assert resp.status_code == 200
    orders = resp.json()["data"]
    assert [o["id"] for o in orders] == [order_id]

    # Inspection uses the new contract (task 3.22): a delivered order with a
    # 5% damage report settles normally and releases the escrow.
    delivered = _seed_delivered_order(
        user_store, "ord_cust2_delivered", "cust-2", value_paisa=5_000_000, hours_ago=1.0
    )
    inspection_data = {
        "damagePct": 5,
        "gradeMatch": True,
        "photoUrls": ["s3://agrovercity-evidence/ord_cust2_delivered/photo1.jpg"],
        "notes": "Minor transit bag tears; within the normal tolerance.",
    }
    resp = await client.post(
        f"/v1/customer/orders/{delivered['id']}/inspection",
        json=inspection_data,
        headers=auth(customer_token),
    )
    assert resp.status_code == 200
    inspected_order = resp.json()
    assert inspected_order["status"] == "delivered"
    assert inspected_order["escrowStatus"] == "released"
    assert inspected_order["inspection"]["damagePct"] == 5
    assert inspected_order["inspection"]["inspectionOutcome"] == "normal"
    assert inspected_order["inspection"]["deductionPaisa"] == 0
    assert Path(inspected_order["inspection"]["wormEvidencePath"]).exists()

    # Verify QR custody handover on the accepted order (escrow already held).
    resp = await client.post(f"/v1/customer/orders/{order_id}/qr-handover", headers=auth(customer_token))
    assert resp.status_code == 200
    qr_res = resp.json()
    assert qr_res["status"] == "custody_transferred"

    resp = await client.get("/v1/customer/planner", headers=auth(customer_token))
    assert resp.status_code == 200
    assert "recommendedCommodities" in resp.json()

    # Favorites return real data only (no demo seed).
    resp = await client.get("/v1/customer/suppliers/favorites", headers=auth(customer_token))
    assert resp.status_code == 200
    assert resp.json()["total"] == 0
    resp = await client.post(
        "/v1/customer/suppliers/favorites",
        json={"farmerId": "farmer_9", "farmerName": "Test Farmer", "primaryCrops": ["tomato"]},
        headers=auth(customer_token),
    )
    assert resp.status_code == 201
    resp = await client.get("/v1/customer/suppliers/favorites", headers=auth(customer_token))
    assert resp.json()["total"] == 1


# --------------------------------------------------------------------------
# 3.15 — deposit escrow math
# --------------------------------------------------------------------------


async def test_escrow_deposit_math_and_idempotent_accept(client, user_store):
    customer_token = seed_user(user_store, uid="cust-e1", active_profile="customer")

    # ₹20,000 quote (2,000,000 paisa) with default config => 20% deposit.
    resp = await client.post(
        "/v1/customer/quotes",
        json={"crop": "wheat", "offeredPricePerQuintal": 20000, "quantityQuintals": 1},
        headers=auth(customer_token),
    )
    assert resp.status_code == 201
    quote_id = resp.json()["id"]

    headers = {**auth(customer_token), "Idempotency-Key": "escrow-key-1"}
    resp = await client.post(f"/v1/customer/quotes/{quote_id}/accept", json={}, headers=headers)
    assert resp.status_code == 201
    order = resp.json()
    assert order["depositPaisa"] == 400_000
    assert order["escrow"]["amount"] == 400_000
    assert order["escrow"]["status"] == "held"
    assert order["escrowStatus"] == "funded"
    assert order["status"] == "deposit_pending"

    # Replay with the same Idempotency-Key => the same order, no duplicate.
    resp = await client.post(f"/v1/customer/quotes/{quote_id}/accept", json={}, headers=headers)
    assert resp.status_code == 201
    assert resp.json()["id"] == order["id"]
    user_orders = [k for k in user_store if k.startswith("customer_orders/")]
    assert len(user_orders) == 1

    # ₹5,000 quote => below the high-value threshold, confirms directly.
    resp = await client.post(
        "/v1/customer/quotes",
        json={"crop": "wheat", "offeredPricePerQuintal": 5000, "quantityQuintals": 1},
        headers=auth(customer_token),
    )
    small_quote_id = resp.json()["id"]
    resp = await client.post(f"/v1/customer/quotes/{small_quote_id}/accept", json={}, headers=auth(customer_token))
    assert resp.status_code == 201
    small_order = resp.json()
    assert small_order["status"] == "confirmed"
    assert small_order["escrowStatus"] == "unfunded"
    assert "depositPaisa" not in small_order

    # The deposit write produced an audit trail.
    audits = [v for k, v in user_store.items() if k.startswith("audit_logs/")]
    assert any(a.get("action") == "EMARKET_DEPOSIT_HELD" and a.get("amountPaisa") == 400_000 for a in audits)


# --------------------------------------------------------------------------
# 3.17 — fair-price band on quotes
# --------------------------------------------------------------------------


async def test_fair_price_band_on_quotes(client, user_store):
    customer_token = seed_user(user_store, uid="cust-b1", active_profile="customer", district="nashik")
    for idx, unit_paisa in enumerate((2000, 3000)):
        _seed_delivered_order(
            user_store,
            f"ord_band_{idx}",
            "cust-b1",
            value_paisa=unit_paisa * 10,
            crop="tomato",
            district="nashik",
            qty=1.0,
        )
        user_store[f"customer_orders/ord_band_{idx}"]["unitPricePaisa"] = unit_paisa

    resp = await client.post(
        "/v1/customer/quotes",
        json={"crop": "tomato", "offeredPricePerQuintal": 2500, "quantityQuintals": 5},
        headers=auth(customer_token),
    )
    assert resp.status_code == 201

    resp = await client.get("/v1/customer/quotes", headers=auth(customer_token))
    assert resp.status_code == 200
    quotes = resp.json()["data"]
    tomato_quote = next(q for q in quotes if q["crop"] == "tomato")
    band = tomato_quote["fairPriceBand"]
    assert band["minUnitPaisa"] == 2000
    assert band["maxUnitPaisa"] == 3000
    assert band["sampleSize"] == 2

    # A crop with no history yields sampleSize 0 and a null band.
    resp = await client.post(
        "/v1/customer/quotes",
        json={"crop": "dragonfruit", "offeredPricePerQuintal": 9000, "quantityQuintals": 2},
        headers=auth(customer_token),
    )
    assert resp.status_code == 201
    resp = await client.get("/v1/customer/quotes", headers=auth(customer_token))
    dragon_quote = next(q for q in resp.json()["data"] if q["crop"] == "dragonfruit")
    assert dragon_quote["fairPriceBand"]["sampleSize"] == 0
    assert dragon_quote["fairPriceBand"]["minUnitPaisa"] is None


# --------------------------------------------------------------------------
# 3.19 — 3-round counter cap
# --------------------------------------------------------------------------


async def test_counter_round_cap(client, user_store):
    customer_token = seed_user(user_store, uid="cust-c1", active_profile="customer")
    resp = await client.post(
        "/v1/customer/quotes",
        json={"crop": "onion", "offeredPricePerQuintal": 2000, "quantityQuintals": 10},
        headers=auth(customer_token),
    )
    quote_id = resp.json()["id"]

    for round_no in range(1, 4):
        resp = await client.post(
            f"/v1/customer/quotes/{quote_id}/counter",
            json={"counterPricePerQuintal": 2000 - round_no * 50, "reason": f"round {round_no}"},
            headers=auth(customer_token),
        )
        assert resp.status_code == 200
        assert resp.json()["counterRounds"] == round_no

    resp = await client.post(
        f"/v1/customer/quotes/{quote_id}/counter",
        json={"counterPricePerQuintal": 1800, "reason": "fourth attempt"},
        headers=auth(customer_token),
    )
    assert resp.status_code == 422
    detail = resp.json()["error"]
    assert detail["code"] == "COUNTER_ROUND_CAP"
    assert detail["bandNudge"] is True
    assert detail["fairPriceBand"]["sampleSize"] == 0


# --------------------------------------------------------------------------
# 3.21 — anti-hoarding cap
# --------------------------------------------------------------------------


async def test_hoarding_cap_rejects_over_cap_qty(client, user_store):
    user_store["platform_config/settlements"] = {"emarketMaxQtyPerCrop": {"onion": 100}}
    customer_token = seed_user(user_store, uid="cust-h1", active_profile="customer")

    resp = await client.post(
        "/v1/customer/quotes",
        json={"crop": "onion", "offeredPricePerQuintal": 1000, "quantityQuintals": 150},
        headers=auth(customer_token),
    )
    assert resp.status_code == 201
    big_quote_id = resp.json()["id"]
    resp = await client.post(
        f"/v1/customer/quotes/{big_quote_id}/accept", json={}, headers=auth(customer_token)
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "HOARDING_CAP"

    resp = await client.post(
        "/v1/customer/quotes",
        json={"crop": "onion", "offeredPricePerQuintal": 1000, "quantityQuintals": 100},
        headers=auth(customer_token),
    )
    assert resp.status_code == 201
    boundary_quote_id = resp.json()["id"]
    resp = await client.post(
        f"/v1/customer/quotes/{boundary_quote_id}/accept", json={}, headers=auth(customer_token)
    )
    assert resp.status_code == 201


# --------------------------------------------------------------------------
# 3.23 — E5 inspection damage matrix + E7 window
# --------------------------------------------------------------------------


async def test_inspection_damage_matrix(client, user_store):
    customer_token = seed_user(user_store, uid="cust-i1", active_profile="customer")

    # (a) damagePct 5 => normal, no deduction, escrow released.
    order_a = _seed_delivered_order(user_store, "ord_insp_a", "cust-i1")
    resp = await client.post(
        f"/v1/customer/orders/{order_a['id']}/inspection",
        json={"damagePct": 5, "gradeMatch": True, "photoUrls": [], "notes": ""},
        headers=auth(customer_token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["inspectionOutcome"] == "normal"
    assert body["inspection"]["deductionPaisa"] == 0
    assert body["escrowStatus"] == "released"

    # (b) damagePct 10 => pro-rata deduction of 100,000 paisa on 1,000,000.
    order_b = _seed_delivered_order(user_store, "ord_insp_b", "cust-i1")
    resp = await client.post(
        f"/v1/customer/orders/{order_b['id']}/inspection",
        json={"damagePct": 10, "gradeMatch": True, "photoUrls": [], "notes": "wet bags"},
        headers=auth(customer_token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["inspectionOutcome"] == "pro_rata"
    assert body["deductionPaisa"] == 100_000

    # (c) damagePct 21 => dispute, order disputed, escrow frozen.
    order_c = _seed_delivered_order(user_store, "ord_insp_c", "cust-i1")
    resp = await client.post(
        f"/v1/customer/orders/{order_c['id']}/inspection",
        json={"damagePct": 21, "gradeMatch": True, "photoUrls": ["s3://photos/c1.jpg"], "notes": ""},
        headers=auth(customer_token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["inspectionOutcome"] == "dispute"
    assert body["status"] == "disputed"
    assert body["escrowStatus"] == "frozen"
    assert body["escrow"]["status"] == "held"
    assert body["escrow"]["disputeOpenedAt"]

    # (d) gradeMatch false => dispute even at 3% damage.
    order_d = _seed_delivered_order(user_store, "ord_insp_d", "cust-i1")
    resp = await client.post(
        f"/v1/customer/orders/{order_d['id']}/inspection",
        json={"damagePct": 3, "gradeMatch": False, "photoUrls": [], "notes": "grade B delivered"},
        headers=auth(customer_token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["inspectionOutcome"] == "dispute"
    assert body["status"] == "disputed"

    # (e) 73h after delivery => outside the 72h window.
    order_e = _seed_delivered_order(user_store, "ord_insp_e", "cust-i1", hours_ago=73.0)
    resp = await client.post(
        f"/v1/customer/orders/{order_e['id']}/inspection",
        json={"damagePct": 2, "gradeMatch": True, "photoUrls": [], "notes": ""},
        headers=auth(customer_token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "INSPECTION_WINDOW_EXPIRED"


# --------------------------------------------------------------------------
# 3.25 — E1/E2/E3 cancellation penalty matrix
# --------------------------------------------------------------------------


async def test_cancellation_penalty_matrix(client, user_store):
    farmer_token = seed_user(
        user_store, uid="farmer-f1", active_profile="farmer", linkedProfiles=["farmer", "customer"]
    )
    customer_token = seed_user(user_store, uid="cust-p1", active_profile="customer")
    user_store[f"users/farmer-f1"] = {**user_store["users/farmer-f1"], "name": "Penal Farmer"}
    user_store["market_lots/lot_p1"] = {
        "id": "lot_p1",
        "farmerId": "farmer-f1",
        "crop": "onion",
        "quantityQuintals": 100.0,
        "expectedRate": 1000,
        "status": "sold",
    }

    # E1: farmer cancel 3h after creation => 2% penalty + relist.
    user_store["customer_orders/ord_pen1"] = {
        "id": "ord_pen1",
        "customerId": "cust-p1",
        "farmerId": "farmer-f1",
        "crop": "onion",
        "quantityQuintals": 10.0,
        "pricePerQuintal": 1000.0,
        "orderValuePaisa": 1_000_000,
        "lotId": "lot_p1",
        "status": "confirmed",
        "escrowStatus": "unfunded",
        "escrow": {"status": "unfunded", "amount": 0},
        "createdAt": _iso(NOW - timedelta(hours=3)),
    }
    resp = await client.post(
        "/v1/customer/orders/ord_pen1/cancel",
        headers={**auth(farmer_token), "Idempotency-Key": "cancel-1"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"
    penalties = [v for k, v in user_store.items() if k.startswith("emarket_penalties/")]
    assert any(
        p.get("role") == "farmer"
        and p.get("pct") == 2
        and p.get("amountPaisa") == 20_000
        and p.get("appliedTo") == "future_payout"
        for p in penalties
    )
    assert user_store["market_lots/lot_p1"]["status"] == "open"

    # E2: customer cancel 5h after creation => 5% farmer compensation.
    user_store["customer_orders/ord_pen2"] = {
        "id": "ord_pen2",
        "customerId": "cust-p1",
        "farmerId": "farmer-f1",
        "crop": "onion",
        "quantityQuintals": 10.0,
        "pricePerQuintal": 1000.0,
        "orderValuePaisa": 1_000_000,
        "status": "confirmed",
        "escrowStatus": "unfunded",
        "escrow": {"status": "unfunded", "amount": 0},
        "createdAt": _iso(NOW - timedelta(hours=5)),
    }
    resp = await client.post(
        "/v1/customer/orders/ord_pen2/cancel", headers=auth(customer_token)
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "cancelled"
    assert body["farmerCompensationPaisa"] == 50_000
    penalties = [v for k, v in user_store.items() if k.startswith("emarket_penalties/")]
    assert any(
        p.get("role") == "customer" and p.get("pct") == 5 and p.get("amountPaisa") == 50_000
        for p in penalties
    )

    # E3: farmer no-show => auto-cancel + strike + 10% customer credit.
    user_store["customer_orders/ord_pen3"] = {
        "id": "ord_pen3",
        "customerId": "cust-p1",
        "farmerId": "farmer-f1",
        "crop": "onion",
        "quantityQuintals": 10.0,
        "pricePerQuintal": 1000.0,
        "orderValuePaisa": 1_000_000,
        "status": "confirmed",
        "escrowStatus": "unfunded",
        "escrow": {"status": "unfunded", "amount": 0},
        "createdAt": _iso(NOW - timedelta(hours=30)),
    }
    resp = await client.post(
        "/v1/customer/orders/ord_pen3/no-show", headers=auth(customer_token)
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "cancelled"
    assert body["customerCreditPaisa"] == 100_000
    assert user_store["users/farmer-f1"]["chatStrikes"] == 1
    penalties = [v for k, v in user_store.items() if k.startswith("emarket_penalties/")]
    assert any(
        p.get("pct") == 10 and p.get("appliedTo") == "customer_credit" for p in penalties
    )

    # Unknown caller role => 403.
    other_token = seed_user(user_store, uid="cust-outsider", active_profile="customer")
    user_store["customer_orders/ord_pen4"] = {
        "id": "ord_pen4",
        "customerId": "cust-p1",
        "farmerId": "farmer-f1",
        "orderValuePaisa": 1_000_000,
        "status": "confirmed",
        "escrowStatus": "unfunded",
        "escrow": {"status": "unfunded", "amount": 0},
        "createdAt": _iso(NOW - timedelta(hours=1)),
    }
    resp = await client.post("/v1/customer/orders/ord_pen4/cancel", headers=auth(other_token))
    assert resp.status_code == 403

    # Penalty writes are audited.
    audits = [v for k, v in user_store.items() if k.startswith("audit_logs/")]
    assert any(a.get("action") == "EMARKET_PENALTY" for a in audits)


# --------------------------------------------------------------------------
# 3.27 — WORM evidence write + access logging
# --------------------------------------------------------------------------


async def test_worm_write_and_access_logging(client, user_store, monkeypatch):
    payload = {"orderId": "ord_w1", "damagePct": 4, "photoUrls": ["s3://x/p.jpg"]}
    path = await worm_service.put_evidence("inspection", "ord_w1", payload)
    assert ".local_uploads/worm/inspection/ord_w1/" in path
    assert Path(path).exists()

    # Read without an approval => PermissionError.
    with pytest.raises(PermissionError):
        await read_evidence(path, "appr-missing", "auditor-1")

    # Single approver is not dual control.
    user_store["worm_access_approvals/appr-single"] = {
        "id": "appr-single",
        "status": "approved",
        "approvers": ["admin-1"],
    }
    with pytest.raises(PermissionError):
        await read_evidence(path, "appr-single", "auditor-1")

    # Dual-approved read returns the payload and logs the access.
    user_store["worm_access_approvals/appr-1"] = {
        "id": "appr-1",
        "status": "approved",
        "approvers": ["admin-1", "admin-2"],
    }
    recovered = await read_evidence(path, "appr-1", "auditor-1")
    assert recovered == payload
    access_logs = [v for k, v in user_store.items() if k.startswith("worm_access_log/")]
    assert any(
        log.get("path") == path
        and log.get("approvalId") == "appr-1"
        and log.get("accessorId") == "auditor-1"
        for log in access_logs
    )

    # Overwriting an existing evidence file is refused.
    import uuid as _uuid

    frozen_id = f"ord_w2_{_uuid.uuid4().hex[:8]}"
    monkeypatch.setattr(worm_service, "_utc_stamp", lambda: "FROZEN")
    await worm_service.put_evidence("inspection", frozen_id, payload)
    with pytest.raises(FileExistsError):
        await worm_service.put_evidence("inspection", frozen_id, payload)


# --------------------------------------------------------------------------
# 3.29 — multi-farmer cart checkout
# --------------------------------------------------------------------------


def _seed_lot(user_store, lot_id, farmer_id, crop, rate, qty, **extra):
    user_store[f"market_lots/{lot_id}"] = {
        "id": lot_id,
        "farmerId": farmer_id,
        "crop": crop,
        "quantityQuintals": qty,
        "expectedRate": rate,
        "status": "open",
        "harvestDate": "2026-10-05",
        **extra,
    }


async def test_cart_checkout_split_shipments(client, user_store):
    customer_token = seed_user(user_store, uid="cust-cart1", active_profile="customer")
    for farmer_id, name in (("farmer-ca", "Farmer A"), ("farmer-cb", "Farmer B")):
        seed_user(user_store, uid=farmer_id, active_profile="farmer")
        user_store[f"users/{farmer_id}"] = {**user_store[f"users/{farmer_id}"], "name": name}
    _seed_lot(user_store, "lot_ca", "farmer-ca", "onion", 2000, 100.0)
    _seed_lot(user_store, "lot_cb", "farmer-cb", "tomato", 3000, 50.0)

    checkout = {
        "lines": [
            {"farmerId": "farmer-ca", "lotId": "lot_ca", "qty": 10, "logisticsMode": "customer_pickup"},
            {"farmerId": "farmer-cb", "lotId": "lot_cb", "qty": 5, "logisticsMode": "farmer_delivery"},
        ]
    }
    headers = {**auth(customer_token), "Idempotency-Key": "cart-key-1"}
    resp = await client.post("/v1/customer/cart/checkout", json=checkout, headers=headers)
    assert resp.status_code == 201
    result = resp.json()
    parent_id = result["parentOrderId"]
    children = result["orders"]
    assert len(children) == 2
    assert all(c["parentOrderId"] == parent_id for c in children)
    assert all(c["statusTimeline"][0]["status"] == "created" for c in children)
    by_farmer = {c["farmerId"]: c for c in children}
    assert by_farmer["farmer-ca"]["logisticsMode"] == "customer_pickup"
    assert by_farmer["farmer-cb"]["logisticsMode"] == "farmer_delivery"
    assert by_farmer["farmer-ca"]["orderValuePaisa"] == 10 * 2000 * 100
    assert by_farmer["farmer-cb"]["orderValuePaisa"] == 5 * 3000 * 100

    # QR handover on one child leaves the other untouched.
    child_a = by_farmer["farmer-ca"]["id"]
    child_b = by_farmer["farmer-cb"]["id"]
    resp = await client.post(f"/v1/customer/orders/{child_a}/qr-handover", headers=auth(customer_token))
    assert resp.status_code == 200
    assert user_store[f"customer_orders/{child_b}"].get("custodyTransferred") is not True

    # Replay with the same Idempotency-Key => no duplicates.
    resp = await client.post("/v1/customer/cart/checkout", json=checkout, headers=headers)
    assert resp.status_code == 201
    assert resp.json()["parentOrderId"] == parent_id
    user_orders = [k for k in user_store if k.startswith("customer_orders/")]
    assert len(user_orders) == 3  # 1 parent + 2 children


# --------------------------------------------------------------------------
# 3.30 + 3.32 — subscriptions + planner job
# --------------------------------------------------------------------------


async def test_subscriptions_crud(client, user_store):
    customer_token = seed_user(user_store, uid="cust-s1", active_profile="customer")
    body = {
        "farmerIds": ["farmer-sa", "farmer-sb", "farmer-sc"],
        "crop": "tomato",
        "grade": "A",
        "qtyKg": 5,
        "targetPriceBandPaisa": {"min": 2000, "max": 3500},
        "deliveryWindow": "Morning",
        "frequency": "weekly",
    }
    resp = await client.post(
        "/v1/customer/subscriptions",
        json=body,
        headers={**auth(customer_token), "Idempotency-Key": "sub-key-1"},
    )
    assert resp.status_code == 201
    sub = resp.json()
    assert sub["status"] == "active"
    assert sub["nextRunAt"]
    sub_id = sub["id"]

    resp = await client.get("/v1/customer/subscriptions", headers=auth(customer_token))
    assert resp.status_code == 200
    assert resp.json()["total"] == 1

    resp = await client.delete(f"/v1/customer/subscriptions/{sub_id}", headers=auth(customer_token))
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"

    resp = await client.get("/v1/customer/subscriptions", headers=auth(customer_token))
    assert resp.json()["total"] == 1  # soft-cancelled, still listed


async def test_subscription_planner_generates_quote_and_advances(client, user_store):
    seed_user(user_store, uid="cust-s2", active_profile="customer")
    past = _iso(NOW - timedelta(hours=2))
    user_store["customer_subscriptions/sub_p1"] = {
        "id": "sub_p1",
        "customerId": "cust-s2",
        "farmerIds": ["farmer-sa", "farmer-sb", "farmer-sc"],
        "crop": "tomato",
        "grade": "A",
        "qtyKg": 5,
        "targetPriceBandPaisa": {"min": 2000, "max": 3500},
        "deliveryWindow": "Morning",
        "frequency": "weekly",
        "nextRunAt": past,
        "status": "active",
        "createdAt": _iso(NOW - timedelta(days=10)),
    }

    result = await run_subscription_planner()
    assert result == {"generated": 1}

    generated = [
        v for k, v in user_store.items()
        if k.startswith("customer_quotes/") and v.get("subscriptionId") == "sub_p1"
    ]
    assert len(generated) == 1
    assert generated[0]["status"] == "quote_pending"
    assert generated[0]["farmerIds"] == ["farmer-sa", "farmer-sb", "farmer-sc"]

    advanced = datetime.fromisoformat(user_store["customer_subscriptions/sub_p1"]["nextRunAt"])
    assert (advanced - NOW).days == 7
    assert advanced > datetime.fromisoformat(past)

    # Immediate second run is a no-op (idempotent).
    result = await run_subscription_planner()
    assert result == {"generated": 0}


# --------------------------------------------------------------------------
# 3.34 — 5% seller-side commission in settlements
# --------------------------------------------------------------------------


async def test_emarket_seller_commission(client, user_store):
    today = NOW.date().isoformat()
    _seed_delivered_order(
        user_store, "ord_set1", "cust-x", value_paisa=2_000_000, farmer_id="farmer-f9", qty=20.0
    )
    result = await run_settlements(today, today)
    assert result["created"] >= 1
    settlement = user_store[f"settlements/st_emarket_seller_{'farmer-f9'[:8]}_{today}"]
    assert settlement["role"] == "emarket_seller"
    assert settlement["entityId"] == "farmer-f9"
    assert settlement["grossRupees"] == 20_000
    assert settlement["commissionRupees"] == 1_000  # exactly 5%
    assert settlement["netRupees"] == 19_000
    audits = [v for k, v in user_store.items() if k.startswith("audit_logs/")]
    assert any(
        a.get("action") == "SETTLEMENT_ACCRUAL" and a.get("role") == "emarket_seller"
        for a in audits
    )


# --------------------------------------------------------------------------
# 3.36 — Business tier consolidated invoice + credit ledger
# --------------------------------------------------------------------------


async def test_business_invoice_and_credit_ledger(client, user_store):
    user_store["subscriptions/sub_biz1"] = {
        "subId": "sub_biz1",
        "userId": "cust-biz1",
        "planId": "emarket_business",
        "status": "active",
        "createdAt": _iso(NOW - timedelta(days=3)),
    }
    business_token = seed_user(user_store, uid="cust-biz1", active_profile="customer")
    period = NOW.strftime("%Y-%m")

    order_ids = []
    for idx in range(2):
        resp = await client.post(
            "/v1/customer/quotes",
            json={"crop": "wheat", "offeredPricePerQuintal": 5000, "quantityQuintals": 1},
            headers=auth(business_token),
        )
        assert resp.status_code == 201
        quote_id = resp.json()["id"]
        resp = await client.post(
            f"/v1/customer/quotes/{quote_id}/accept", json={}, headers=auth(business_token)
        )
        assert resp.status_code == 201
        order_ids.append(resp.json()["id"])

    # credit_terms: one ledger entry per new order, unsettled.
    for oid in order_ids:
        entry = user_store[f"customer_credit_ledger/credit_{oid}"]
        assert entry["creditTermsDays"] == 30
        assert entry["settledAt"] is None
        assert entry["amountPaisa"] == 500_000

    # Consolidated GST invoice over the period's orders.
    for oid in order_ids:
        user_store[f"customer_orders/{oid}"]["status"] = "delivered"
        user_store[f"customer_orders/{oid}"]["deliveredAt"] = _iso(NOW - timedelta(hours=2))
    resp = await client.get(
        f"/v1/customer/invoices/consolidated?period={period}", headers=auth(business_token)
    )
    assert resp.status_code == 200
    invoice = resp.json()
    assert invoice["lineItemCount"] == 2
    assert invoice["totalPaisa"] == 1_000_000
    assert invoice["gstPaisa"] == 180_000

    # Non-entitled household buyer => 402 standard envelope.
    household_token = seed_user(user_store, uid="cust-hh1", active_profile="customer")
    resp = await client.get(
        f"/v1/customer/invoices/consolidated?period={period}", headers=auth(household_token)
    )
    assert resp.status_code == 402
    assert resp.json()["error"]["code"] == "ENTITLEMENT_REQUIRED"


# --------------------------------------------------------------------------
# 3.37 — KYC matrix + GSTIN helper
# --------------------------------------------------------------------------


async def test_emarket_business_kyc_matrix_and_gstin():
    matrix = doc_matrix_for("emarket_business")
    for doc_type in ("gstin", "pan", "udyam", "trade_licence", "apmc_mandi_licence", "fssai"):
        assert doc_type in matrix
    case = {"docs": [{"type": "partnership_deed", "status": "pending"}]}
    assert emarket_business_requires_manual_review(case) is True
    assert emarket_business_requires_manual_review({"docs": []}) is False

    assert GSTIN_RE.match("27ABCDE1234F1Z5")
    assert await verify_gstin("27ABCDE1234F1Z5") is True
    assert await verify_gstin("invalid-gstin") is False


# --------------------------------------------------------------------------
# 3.39 — business-buyer quoting gate
# --------------------------------------------------------------------------


async def test_business_quote_kyc_and_attestation_gate(client, user_store):
    # Business buyer without verified GSTIN/PAN => 403 KYC_REQUIRED.
    business_token = seed_user(
        user_store, uid="cust-bz1", active_profile="customer", accountType="business"
    )
    resp = await client.post(
        "/v1/customer/quotes",
        json={"crop": "wheat", "offeredPricePerQuintal": 5000, "quantityQuintals": 1},
        headers=auth(business_token),
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "KYC_REQUIRED"

    # Verified GST + PAN but no attestations => 422 ATTESTATION_REQUIRED.
    case_id = "kyc_cust-bz1_emarket_business"
    user_store[f"kyc_cases/{case_id}"] = {
        "caseId": case_id,
        "userId": "cust-bz1",
        "persona": "emarket_business",
        "status": "verified",
        "submittedAt": _iso(NOW - timedelta(days=1)),
        "docs": [
            {"docId": f"{case_id}:gstin", "type": "gstin", "status": "verified"},
            {"docId": f"{case_id}:pan", "type": "pan", "status": "verified"},
        ],
    }
    resp = await client.post(
        "/v1/customer/quotes",
        json={"crop": "wheat", "offeredPricePerQuintal": 5000, "quantityQuintals": 1},
        headers=auth(business_token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "ATTESTATION_REQUIRED"

    # With both declarations => 201, and the flags persist on the user doc.
    resp = await client.post(
        "/v1/customer/quotes",
        json={
            "crop": "wheat",
            "offeredPricePerQuintal": 5000,
            "quantityQuintals": 1,
            "antiHoardingAccepted": True,
            "noOffPlatformAccepted": True,
        },
        headers=auth(business_token),
    )
    assert resp.status_code == 201
    assert user_store["users/cust-bz1"]["antiHoardingAcceptedAt"]
    assert user_store["users/cust-bz1"]["noOffPlatformAcceptedAt"]

    # Household buyer without any KYC => 201 (exempt).
    household_token = seed_user(user_store, uid="cust-hh2", active_profile="customer")
    resp = await client.post(
        "/v1/customer/quotes",
        json={"crop": "wheat", "offeredPricePerQuintal": 5000, "quantityQuintals": 1},
        headers=auth(household_token),
    )
    assert resp.status_code == 201


# --------------------------------------------------------------------------
# 3.12 / 3.13 — produce near me + farmer storefront
# --------------------------------------------------------------------------


async def test_browse_near_me_and_storefront(client, user_store):
    customer_token = seed_user(user_store, uid="cust-n1", active_profile="customer")
    seed_user(user_store, uid="farmer-n1", active_profile="farmer")
    user_store["users/farmer-n1"] = {
        **user_store["users/farmer-n1"],
        "name": "Nearby Farmer",
        "rating": 4.6,
    }
    _seed_lot(
        user_store, "lot_n1", "farmer-n1", "Tomato", 2000, 50.0,
        latitude=20.0, longitude=73.8, grade="A",
    )
    _seed_lot(user_store, "lot_n2", "farmer-n1", "Onion", 1500, 30.0)  # no coordinates
    _seed_lot(
        user_store, "lot_n3", "farmer-n1", "Tomato", 2500, 20.0,
        latitude=30.0, longitude=75.0, grade="B",
    )

    resp = await client.get(
        "/v1/customer/browse/near-me?lat=20.0&lng=73.8", headers=auth(customer_token)
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1  # lot without coordinates excluded, distant lot outside radius
    assert all(item["farmerId"] == "farmer-n1" for item in body["data"])
    first = body["data"][0]
    assert first["distanceKm"] == 0.0
    assert first["pricePaisa"] == 200_000
    assert first["freshnessDays"] is not None
    assert first["farmerRating"] == 4.6

    resp = await client.get(
        "/v1/customer/browse/near-me?lat=20.0&lng=73.8&crop=tomato&sort=price&radiusKm=2000",
        headers=auth(customer_token),
    )
    items = resp.json()["data"]
    assert len(items) == 2
    assert items[0]["pricePaisa"] <= items[1]["pricePaisa"]

    # Farmer storefront: lots + credentials from the KYC case.
    case_id = "kyc_farmer-n1_farmer"
    user_store[f"kyc_cases/{case_id}"] = {
        "caseId": case_id,
        "userId": "farmer-n1",
        "persona": "farmer",
        "docs": [
            {"type": "organic_certificate", "status": "verified", "reviewedAt": _iso(NOW)},
            {"type": "soil_health_card", "status": "pending"},
        ],
    }
    resp = await client.get("/v1/customer/storefronts/farmer-n1", headers=auth(customer_token))
    assert resp.status_code == 200
    storefront = resp.json()
    assert storefront["farmerId"] == "farmer-n1"
    assert storefront["farmerName"] == "Nearby Farmer"
    assert storefront["farmerRating"] == 4.6
    assert storefront["credentials"] == [
        {"type": "organic_certificate", "verifiedAt": _iso(NOW)}
    ]
    assert len(storefront["lots"]) == 3

    resp = await client.get("/v1/customer/storefronts/farmer-missing", headers=auth(customer_token))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "FARMER_NOT_FOUND"


# --------------------------------------------------------------------------
# 3.40 — customer dashboard summary items
# --------------------------------------------------------------------------


async def test_customer_tasks_summary_items(client, user_store):
    customer_token = seed_user(user_store, uid="cust-t1", active_profile="customer")
    user_store["customer_demands/dem_t1"] = {
        "id": "dem_t1",
        "customerId": "cust-t1",
        "status": "open",
        "createdAt": _iso(NOW),
    }
    user_store["customer_quotes/quot_t1"] = {
        "id": "quot_t1",
        "customerId": "cust-t1",
        "status": "pending",
        "createdAt": _iso(NOW),
    }
    user_store["customer_orders/ord_t1"] = {
        "id": "ord_t1",
        "customerId": "cust-t1",
        "status": "confirmed",
        "orderValuePaisa": 700_000,
        "createdAt": _iso(NOW),
    }
    _seed_delivered_order(user_store, "ord_t2", "cust-t1", hours_ago=5.0)
    user_store["customer_orders/ord_t2"]["createdAt"] = _iso(NOW - timedelta(hours=2))
    user_store["customer_favorite_suppliers/fav_t1"] = {
        "id": "fav_t1",
        "customerId": "cust-t1",
        "farmerId": "farmer-t1",
        "createdAt": _iso(NOW - timedelta(days=30)),
    }
    _seed_lot(user_store, "lot_t1", "farmer-t1", "Tomato", 2200, 40.0)
    user_store["market_lots/lot_t1"]["createdAt"] = _iso(NOW - timedelta(days=2))

    resp = await client.get("/v1/tasks/summary?persona=customer", headers=auth(customer_token))
    assert resp.status_code == 200
    items = resp.json()["personas"]["customer"]["summaryItems"]
    assert items["openDemands"]["count"] == 1
    assert items["quotesAwaiting"]["count"] == 1
    assert items["ordersInTransit"]["count"] == 1
    assert items["inspectionsPending"]["count"] == 1
    assert items["spendThisMonthPaisa"]["paisa"] == 1_700_000
    assert items["favoriteFarmersNewLots"]["count"] == 1

    # Actionable tasks were emitted with customer deep links.
    tasks = [v for k, v in user_store.items() if k.startswith("tasks/")]
    assert any(t.get("kind") == "quotes_awaiting" for t in tasks)
    inspection_tasks = [t for t in tasks if t.get("kind") == "inspection_pending"]
    assert inspection_tasks
    assert inspection_tasks[0]["deepLink"].startswith("/dashboard/p/orders/")
