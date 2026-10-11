"""Seller stock, resale listings, booking, chat-direct branch, supplier-role
settlement access for seller suppliers, and unified cashflow."""

from app.services.tokens import create_access_token
from tests.test_users import _auth, _register


async def _seller_token(client):
    resp = await _register(client, profiles=["farmer", "seller"], primaryProfile="seller")
    return resp.json()["accessToken"]


def _seed_user(user_store, uid, name, active="farmer", **extra):
    user_store[f"users/{uid}"] = {
        "id": uid,
        "name": name,
        "phone": "+919876543210",
        "linkedProfiles": [active],
        "primaryProfile": active,
        "activeProfile": active,
        **extra,
    }
    return create_access_token(uid)


def _notifications_for(user_store, uid, ntype):
    return [
        doc
        for key, doc in user_store.items()
        if key.startswith("notifications/")
        and doc.get("userId") == uid
        and doc.get("type") == ntype
    ]


def _seed_purchase(user_store, pid, buyer_id, farmer_id, status="delivered", **extra):
    doc = {
        "id": pid,
        "buyerId": buyer_id,
        "buyerName": "Buyer",
        "farmerId": farmer_id,
        "farmerName": "Supplier",
        "source": {"type": "lot", "refId": "lot_x"},
        "crop": "Tomato",
        "variety": "",
        "quantity": 5.0,
        "unit": "quintal",
        "agreedPricePerUnit": 2000,
        "totalAmount": 10000,
        "advancePaid": 0,
        "status": status,
        "pickup": None,
        "payments": [],
        "qc": None,
        "finalAmount": None,
        "invoice": None,
        "events": [],
        "rating": {"buyerToFarmer": None, "farmerToBuyer": None},
        "escrow": {
            "status": "unfunded",
            "amount": 0,
            "method": "",
            "reference": "",
            "fundedAt": None,
            "releasedAt": None,
            "refundedAt": None,
            "commission": None,
            "netRelease": None,
        },
        "handover": {
            "otp": None,
            "generatedAt": None,
            "expiresAt": None,
            "verifiedAt": None,
            "attempts": 0,
        },
        "createdAt": "2026-10-01T00:00:00+00:00",
        "updatedAt": "2026-10-01T00:00:00+00:00",
    }
    doc.update(extra)
    user_store[f"purchases/{pid}"] = doc
    return doc


async def _add_manual_stock(client, token, **overrides):
    body = {
        "crop": "Onion",
        "quantityQuintals": 10,
        "ratePerQuintal": 1500,
        "grade": "A",
        "variety": "Red",
        "location": "Nashik",
    }
    body.update(overrides)
    return await client.post("/v1/seller/stock", json=body, headers=_auth(token))


# ==========================================
# STOCK
# ==========================================


async def test_manual_stock_add_list_and_adjust(client, user_store):
    token = await _seller_token(client)
    resp = await _add_manual_stock(client, token)
    assert resp.status_code == 201
    stock = resp.json()
    assert stock["id"].startswith("stk_")
    assert stock["sourceType"] == "manual"
    assert stock["reservedQuintals"] == 0
    assert stock["availableQuintals"] == 10
    assert stock["status"] == "active"
    assert stock["events"][0]["action"] == "added"

    resp = await client.get("/v1/seller/stock", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["data"]) == 1
    row = body["summary"]["byCrop"][0]
    assert row["crop"] == "Onion"
    assert row["grade"] == "A"
    assert row["quantityQuintals"] == 10
    assert row["availableQuintals"] == 10
    assert row["value"] == 15000
    assert row["avgRate"] == 1500
    assert body["summary"]["totals"] == {
        "quantityQuintals": 10,
        "availableQuintals": 10,
        "value": 15000,
    }

    # Adjust beyond the available portion is a 422.
    resp = await client.post(
        f"/v1/seller/stock/{stock['id']}/adjust",
        json={"deltaQuintals": -20, "reason": "loss"},
        headers=_auth(token),
    )
    assert resp.status_code == 422
    assert "deltaQuintals" in resp.json()["error"]["fieldErrors"]

    resp = await client.post(
        f"/v1/seller/stock/{stock['id']}/adjust",
        json={"deltaQuintals": -4, "reason": "spoiled bags"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["availableQuintals"] == 6
    assert resp.json()["events"][-1]["action"] == "adjust"
    assert resp.json()["events"][-1]["reason"] == "spoiled bags"

    # Draining to zero marks the stock exhausted.
    resp = await client.post(
        f"/v1/seller/stock/{stock['id']}/adjust",
        json={"deltaQuintals": -6, "reason": "cleared"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "exhausted"
    assert resp.json()["quantityQuintals"] == 0

    # Another user's stock is not addressable.
    outsider = _seed_user(user_store, "uid-x", "Outsider", active="seller")
    resp = await client.post(
        f"/v1/seller/stock/{stock['id']}/adjust",
        json={"deltaQuintals": 1, "reason": "sneaky"},
        headers=_auth(outsider),
    )
    assert resp.status_code == 404


async def test_stock_from_purchase(client, user_store):
    token = await _seller_token(client)
    _seed_purchase(
        user_store, "pur_del", "uid-1", "uid-f9", status="delivered",
        qc={"acceptedQty": 4, "grade": "B"},
    )
    _seed_purchase(user_store, "pur_conf", "uid-1", "uid-f9", status="confirmed")
    _seed_purchase(user_store, "pur_other", "uid-x", "uid-f9", status="delivered")

    url = "/v1/seller/stock/from-purchase/pur_del"
    # Idempotency-Key is required.
    resp = await client.post(url, headers=_auth(token))
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "IDEMPOTENCY_KEY_REQUIRED"

    resp = await client.post(
        "/v1/seller/stock/from-purchase/pur_conf",
        headers={**_auth(token), "Idempotency-Key": "k-conf"},
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "PURCHASE_NOT_DELIVERED"

    resp = await client.post(
        "/v1/seller/stock/from-purchase/pur_other",
        headers={**_auth(token), "Idempotency-Key": "k-other"},
    )
    assert resp.status_code == 403

    resp = await client.post(url, headers={**_auth(token), "Idempotency-Key": "k-1"})
    assert resp.status_code == 201
    stock = resp.json()
    assert stock["id"].startswith("stk_")
    assert stock["sourceType"] == "purchase"
    assert stock["sourceId"] == "pur_del"
    # QC was done: acceptedQty and grade drive the stock.
    assert stock["quantityQuintals"] == 4
    assert stock["ratePerQuintal"] == 2000
    assert stock["grade"] == "B"
    assert stock["availableQuintals"] == 4
    assert user_store["purchases/pur_del"]["stockConverted"] is True
    assert user_store["purchases/pur_del"]["stockId"] == stock["id"]

    # Same key replays the stored response.
    replay = await client.post(url, headers={**_auth(token), "Idempotency-Key": "k-1"})
    assert replay.status_code == 201
    assert replay.json()["id"] == stock["id"]

    # A new key hits the already-converted guard.
    resp = await client.post(url, headers={**_auth(token), "Idempotency-Key": "k-2"})
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "STOCK_ALREADY_CONVERTED"

    resp = await client.post(
        "/v1/seller/stock/from-purchase/pur_missing",
        headers={**_auth(token), "Idempotency-Key": "k-3"},
    )
    assert resp.status_code == 404


# ==========================================
# RESALE LISTINGS
# ==========================================


async def _create_listing(client, token, key, **overrides):
    body = {
        "stockId": "",
        "quantityQuintals": 5,
        "askingRatePerQuintal": 2200,
        "deliveryTerms": "exWarehouse",
        "paymentTermsDays": 30,
        "minQtyPerBuyer": 2,
        "packing": "bags",
        "location": "Nashik",
    }
    body.update(overrides)
    return await client.post(
        "/v1/resale-listings", json=body, headers={**_auth(token), "Idempotency-Key": key}
    )


async def test_listing_create_reserves_stock_and_browse_filters(client, user_store):
    token = await _seller_token(client)
    stock1 = (await _add_manual_stock(client, token)).json()  # Onion 10q
    stock2 = (
        await _add_manual_stock(client, token, crop="Wheat", variety="", grade=None)
    ).json()
    farmer = _seed_user(user_store, "uid-f5", "Farmer Om")

    # Idempotency-Key required; quantity capped by available stock.
    resp = await client.post(
        "/v1/resale-listings",
        json={"stockId": stock1["id"], "quantityQuintals": 1, "askingRatePerQuintal": 1},
        headers=_auth(token),
    )
    assert resp.status_code == 400
    resp = await _create_listing(client, token, "k-over", stockId=stock1["id"], quantityQuintals=100)
    assert resp.status_code == 422
    assert "quantityQuintals" in resp.json()["error"]["fieldErrors"]

    resp = await _create_listing(client, token, "k-l1", stockId=stock1["id"])
    assert resp.status_code == 201
    listing1 = resp.json()
    assert listing1["id"].startswith("rel_")
    assert listing1["sellerId"] == "uid-1"
    assert listing1["status"] == "open"
    assert listing1["remainingQuintals"] == 5
    assert listing1["crop"] == "Onion"
    assert listing1["grade"] == "A"
    assert listing1["paymentTermsDays"] == 30
    # Stock reservation is reflected immediately.
    stock_after = user_store[f"seller_stock/{stock1['id']}"]
    assert stock_after["reservedQuintals"] == 5
    assert stock_after["events"][-1]["action"] == "reserved"

    # A second listing on the wheat stock.
    resp = await _create_listing(
        client, token, "k-l2", stockId=stock2["id"], quantityQuintals=3,
        askingRatePerQuintal=2000, minQtyPerBuyer=None, location=None,
    )
    assert resp.status_code == 201
    listing2 = resp.json()
    assert listing2["crop"] == "Wheat"
    assert user_store[f"seller_stock/{stock2['id']}"]["reservedQuintals"] == 3

    # Farmers may not browse; direct buyers can.
    resp = await client.get("/v1/resale-listings", headers=_auth(farmer))
    assert resp.status_code == 403
    buyer = _seed_user(user_store, "uid-b1", "Exporter Joe", active="directBuyer")
    resp = await client.get("/v1/resale-listings", headers=_auth(buyer))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    assert body["data"][0]["seller"]["sellerId"] == "uid-1"
    assert body["data"][0]["seller"]["name"] == "Ram Patil"
    assert body["data"][0]["seller"]["verified"] is False
    onion_entry = next(d for d in body["data"] if d["id"] == listing1["id"])
    assert onion_entry["grade"] == "A"

    # Filters and sort.
    resp = await client.get("/v1/resale-listings?crop=onion", headers=_auth(buyer))
    assert resp.json()["total"] == 1
    assert resp.json()["data"][0]["id"] == listing1["id"]
    resp = await client.get("/v1/resale-listings?location=nashik", headers=_auth(buyer))
    assert resp.json()["total"] == 1  # only listing1 carries a location
    resp = await client.get("/v1/resale-listings?maxRate=2100", headers=_auth(buyer))
    assert resp.json()["total"] == 1
    assert resp.json()["data"][0]["id"] == listing2["id"]
    resp = await client.get("/v1/resale-listings?minQty=4", headers=_auth(buyer))
    assert resp.json()["total"] == 1
    assert resp.json()["data"][0]["id"] == listing1["id"]
    resp = await client.get("/v1/resale-listings?sort=rate", headers=_auth(buyer))
    assert resp.json()["data"][0]["id"] == listing2["id"]

    # Detail.
    resp = await client.get(f"/v1/resale-listings/{listing1['id']}", headers=_auth(buyer))
    assert resp.status_code == 200
    assert resp.json()["id"] == listing1["id"]
    resp = await client.get("/v1/resale-listings/rel_missing", headers=_auth(buyer))
    assert resp.status_code == 404

    # A buyer lacks the seller role; another seller is not the owner.
    resp = await client.delete(f"/v1/resale-listings/{listing1['id']}", headers=_auth(buyer))
    assert resp.status_code == 403
    other_seller = _seed_user(user_store, "uid-s2", "Rival Seller", active="seller")
    resp = await client.delete(f"/v1/resale-listings/{listing1['id']}", headers=_auth(other_seller))
    assert resp.status_code == 404
    resp = await client.delete(f"/v1/resale-listings/{listing1['id']}", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["status"] == "closed"
    stock_after = user_store[f"seller_stock/{stock1['id']}"]
    assert stock_after["reservedQuintals"] == 0
    assert stock_after["events"][-1]["action"] == "released"
    assert user_store[f"seller_stock/{stock2['id']}"]["reservedQuintals"] == 3
    # Closing twice is a business conflict.
    resp = await client.delete(f"/v1/resale-listings/{listing1['id']}", headers=_auth(token))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "LISTING_NOT_OPEN"


async def test_book_listing_partial_then_full(client, user_store):
    token = await _seller_token(client)
    stock = (await _add_manual_stock(client, token)).json()
    listing = (
        await _create_listing(
            client, token, "k-l1", stockId=stock["id"], minQtyPerBuyer=None
        )
    ).json()
    buyer = _seed_user(user_store, "uid-b1", "Exporter Joe", active="directBuyer")
    url = f"/v1/resale-listings/{listing['id']}/book"

    # Idempotency-Key required; overbooking is a 422.
    resp = await client.post(url, json={}, headers=_auth(buyer))
    assert resp.status_code == 400
    resp = await client.post(
        url, json={"quantityQuintals": 100}, headers={**_auth(buyer), "Idempotency-Key": "k-big"}
    )
    assert resp.status_code == 422

    # Partial book: 2 of 5 @ ₹2200.
    resp = await client.post(
        url,
        json={"quantityQuintals": 2, "requiredDate": "2026-10-20", "deliveryAddress": "Pune"},
        headers={**_auth(buyer), "Idempotency-Key": "k-p1"},
    )
    assert resp.status_code == 201
    body = resp.json()
    purchase = body["purchase"]
    assert purchase["id"].startswith("pur_")
    assert purchase["buyerId"] == "uid-b1"
    assert purchase["farmerId"] == "uid-1"  # supplier slot = listing seller
    assert purchase["crop"] == "Onion"
    assert purchase["quantity"] == 2
    assert purchase["agreedPricePerUnit"] == 2200
    assert purchase["totalAmount"] == 4400
    assert purchase["source"] == {"type": "resale_listing", "refId": listing["id"]}
    assert purchase["status"] == "confirmed"
    # Chat room created and the seller notified.
    room = user_store[f"chat_rooms/{purchase['id']}"]
    assert room["kind"] == "purchase"
    assert room["buyerId"] == "uid-b1"
    assert room["farmerId"] == "uid-1"
    assert _notifications_for(user_store, "uid-1", "booking_confirmed")

    listing_after = body["listing"]
    assert listing_after["remainingQuintals"] == 3
    assert listing_after["status"] == "open"
    stock_after = user_store[f"seller_stock/{stock['id']}"]
    assert stock_after["quantityQuintals"] == 8
    assert stock_after["reservedQuintals"] == 3
    assert stock_after["events"][-1]["action"] == "sold"

    # Self-booking is blocked.
    resp = await client.post(
        url, json={}, headers={**_auth(token), "Idempotency-Key": "k-self"}
    )
    assert resp.status_code == 403

    # Full book of the remainder closes the listing and drains the reservation.
    resp = await client.post(
        url,
        json={"quantityQuintals": 3},
        headers={**_auth(buyer), "Idempotency-Key": "k-p2"},
    )
    assert resp.status_code == 201
    assert resp.json()["listing"]["remainingQuintals"] == 0
    assert resp.json()["listing"]["status"] == "sold"
    stock_after = user_store[f"seller_stock/{stock['id']}"]
    assert stock_after["quantityQuintals"] == 5
    assert stock_after["reservedQuintals"] == 0

    # The listing is no longer bookable.
    resp = await client.post(
        url, json={}, headers={**_auth(buyer), "Idempotency-Key": "k-p3"}
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "LISTING_NOT_OPEN"

    # My listings carry the purchase count.
    resp = await client.get("/v1/resale-listings/mine", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    assert resp.json()["data"][0]["purchaseCount"] == 2

    # Chat direct branch on the listing.
    resp = await client.post("/v1/chat/direct", json={"listingId": listing["id"]}, headers=_auth(buyer))
    assert resp.status_code == 200
    assert resp.json()["kind"] == "direct"
    assert resp.json()["farmerId"] == "uid-1"
    resp = await client.post("/v1/chat/direct", json={"listingId": listing["id"]}, headers=_auth(token))
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "OWN_LISTING"
    resp = await client.post(
        "/v1/chat/direct", json={"listingId": "rel_missing"}, headers=_auth(buyer)
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "LISTING_NOT_FOUND"


async def test_full_book_exhausts_stock(client, user_store):
    token = await _seller_token(client)
    stock = (
        await _add_manual_stock(client, token, quantityQuintals=3, ratePerQuintal=1800)
    ).json()
    listing = (
        await _create_listing(
            client, token, "k-l1", stockId=stock["id"], quantityQuintals=3,
            askingRatePerQuintal=2100, minQtyPerBuyer=None,
        )
    ).json()
    buyer = _seed_user(user_store, "uid-b1", "Exporter Joe", active="directBuyer")
    resp = await client.post(
        f"/v1/resale-listings/{listing['id']}/book",
        json={"quantityQuintals": 3},
        headers={**_auth(buyer), "Idempotency-Key": "k-full"},
    )
    assert resp.status_code == 201
    assert resp.json()["listing"]["status"] == "sold"
    stock_after = user_store[f"seller_stock/{stock['id']}"]
    assert stock_after["quantityQuintals"] == 0
    assert stock_after["reservedQuintals"] == 0
    assert stock_after["status"] == "exhausted"


async def test_min_qty_per_buyer_enforced(client, user_store):
    token = await _seller_token(client)
    stock = (await _add_manual_stock(client, token)).json()
    listing = (
        await _create_listing(
            client, token, "k-l1", stockId=stock["id"], quantityQuintals=4,
            minQtyPerBuyer=3,
        )
    ).json()
    buyer = _seed_user(user_store, "uid-b1", "Exporter Joe", active="directBuyer")
    resp = await client.post(
        f"/v1/resale-listings/{listing['id']}/book",
        json={"quantityQuintals": 1},
        headers={**_auth(buyer), "Idempotency-Key": "k-small"},
    )
    assert resp.status_code == 422
    assert "quantityQuintals" in resp.json()["error"]["fieldErrors"]


# ==========================================
# SUPPLIER-ROLE SETTLEMENT (seller as supplier)
# ==========================================


async def test_seller_supplier_settlement_access(client, user_store):
    token = await _seller_token(client)  # uid-1, activeProfile "seller"
    buyer = _seed_user(user_store, "uid-b1", "Exporter Joe", active="directBuyer")
    _seed_purchase(
        user_store, "pur_res", "uid-b1", "uid-1", status="advancePaid",
        source={"type": "resale_listing", "refId": "rel_x"},
        escrow={"status": "held", "amount": 10000, "fundedAt": "2026-10-01T00:00:00+00:00"},
    )

    # Detail, pickup, dispatch, deliver: supplier-side flows work for a seller profile.
    resp = await client.get("/v1/purchases/pur_res", headers=_auth(token))
    assert resp.status_code == 200
    resp = await client.post(
        "/v1/purchases/pur_res/pickup",
        json={"date": "2026-10-12", "mode": "buyerPicksup"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "pickupScheduled"
    resp = await client.post("/v1/purchases/pur_res/dispatch", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["status"] == "inTransit"
    resp = await client.post("/v1/purchases/pur_res/deliver", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["status"] == "delivered"

    # Handover OTP reveal (supplier side) works with a seller profile.
    resp = await client.get("/v1/purchases/pur_res/handover-otp", headers=_auth(token))
    assert resp.status_code == 200
    otp = resp.json()["otp"]
    assert len(otp) == 6

    # Buyer verifies the OTP at physical handover → QC unlocks.
    resp = await client.post(
        "/v1/purchases/pur_res/handover/verify", json={"otp": otp}, headers=_auth(buyer)
    )
    assert resp.status_code == 200

    # Buyer files QC (no rejection) → purchase completes.
    resp = await client.post(
        "/v1/purchases/pur_res/qc",
        json={"grade": "A", "acceptedQty": 5, "rejectedQty": 0},
        headers=_auth(buyer),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "completed"

    # The seller supplier can rate the buyer and read the invoice.
    resp = await client.post(
        "/v1/purchases/pur_res/rate",
        json={"target": "buyer", "rating": 5, "review": "prompt payment"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["rating"]["farmerToBuyer"]["rating"] == 5
    resp = await client.get("/v1/purchases/pur_res/invoice", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["purchaseId"] == "pur_res"


# ==========================================
# UNIFIED CASHFLOW
# ==========================================


async def test_cashflow_aggregates_real_collections(client, user_store):
    token = await _seller_token(client)
    user_store["users/uid-1/seller_procurement/proc_1"] = {
        "id": "proc_1",
        "sellerId": "uid-1",
        "finalAmount": 10000,
        "paymentStatus": "paid",
        "paidAt": "2026-10-05T10:00:00+00:00",
        "createdAt": "2026-10-05T09:00:00+00:00",
    }
    # Udhaar procurement must NOT count as outflow.
    user_store["users/uid-1/seller_procurement/proc_2"] = {
        "id": "proc_2",
        "sellerId": "uid-1",
        "finalAmount": 5000,
        "paymentStatus": "udhaar",
        "createdAt": "2026-10-05T09:00:00+00:00",
    }
    user_store["users/uid-1/seller_sales/sale_1"] = {
        "id": "sale_1",
        "sellerId": "uid-1",
        "amountPaid": 4000,
        "netAmount": 4000,
        "status": "paid",
        "createdAt": "2026-10-06T09:00:00+00:00",
    }
    # Money out: the seller bought produce from a farmer and paid an advance.
    _seed_purchase(
        user_store, "pur_out", "uid-1", "uid-f9", status="advancePaid",
        payments=[{"id": "pay_1", "kind": "advance", "amount": 3000,
                   "method": "upi", "reference": "", "at": "2026-10-07T10:00:00+00:00"}],
    )
    # Money in: the seller supplied a resale booking and got paid.
    _seed_purchase(
        user_store, "pur_in", "uid-b1", "uid-1", status="completed",
        payments=[{"id": "pay_2", "kind": "balance", "amount": 8000,
                   "method": "upi", "reference": "", "at": "2026-10-08T10:00:00+00:00"}],
    )

    resp = await client.get("/v1/seller/cashflow", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["totals"] == {"inflow": 12000, "outflow": 13000, "net": -1000}
    assert body["breakdowns"] == {
        "procurementOut": 10000,
        "purchasePaymentsOut": 3000,
        "salesIn": 4000,
        "purchaseCollectionsIn": 8000,
    }
    oct_row = next(r for r in body["byMonth"] if r["month"] == "2026-10")
    assert oct_row == {"month": "2026-10", "inflow": 12000, "outflow": 13000, "net": -1000}
    assert len(body["byMonth"]) == 12

    # Range filters.
    resp = await client.get(
        "/v1/seller/cashflow?from=2026-10-01&to=2026-10-31", headers=_auth(token)
    )
    assert resp.json()["totals"]["net"] == -1000
    assert resp.json()["from"] == "2026-10-01"
    resp = await client.get("/v1/seller/cashflow?from=2026-11-01", headers=_auth(token))
    assert resp.json()["totals"] == {"inflow": 0, "outflow": 0, "net": 0}
    resp = await client.get("/v1/seller/cashflow?from=not-a-date", headers=_auth(token))
    assert resp.status_code == 422
