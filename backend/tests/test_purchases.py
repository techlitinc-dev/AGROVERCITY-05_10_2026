from app.services.tokens import create_access_token
from tests.test_direct_buyer import _lot, _register_buyer, _seed_user
from tests.test_users import _auth

LOT_ID = "lot_buy1"


async def _setup(client, user_store):
    buyer = (await _register_buyer(client)).json()["accessToken"]
    farmer = _seed_user(user_store, "uid-f1", "Ram Patel")
    user_store[f"market_lots/{LOT_ID}"] = _lot(LOT_ID, "uid-f1", "Tomato", "2026-09-15T00:00:00+00:00")
    return buyer, farmer


async def _buy(client, token, lot_id=LOT_ID, **overrides):
    return await client.post("/v1/purchases", json={"lotId": lot_id, **overrides}, headers=_auth(token))


async def _to_delivered(client, buyer, farmer, purchase_id):
    await client.post(f"/v1/purchases/{purchase_id}/advance", json={"amount": 5000, "method": "upi"}, headers=_auth(buyer))
    await client.post(
        f"/v1/purchases/{purchase_id}/pickup",
        json={"date": "2026-09-28", "vehicleType": "Truck", "address": "Nashik", "notes": ""},
        headers=_auth(farmer),
    )
    await client.post(f"/v1/purchases/{purchase_id}/dispatch", headers=_auth(farmer))
    return await client.post(f"/v1/purchases/{purchase_id}/deliver", headers=_auth(buyer))


# ---- buy now ----


async def test_buy_now_creates_purchase_and_marks_lot_sold(client, user_store):
    buyer, farmer = await _setup(client, user_store)
    resp = await _buy(client, buyer)
    assert resp.status_code == 201
    purchase = resp.json()
    assert purchase["id"].startswith("pur_")
    assert purchase["status"] == "confirmed"
    assert purchase["buyerId"] == "uid-1"
    assert purchase["farmerId"] == "uid-f1"
    assert purchase["farmerName"] == "Ram Patel"
    assert purchase["agreedPricePerUnit"] == 2000
    assert purchase["totalAmount"] == 20000
    assert purchase["source"] == {"type": "lot", "refId": LOT_ID}
    assert [e["status"] for e in purchase["events"]] == ["confirmed"]
    assert user_store[f"market_lots/{LOT_ID}"]["status"] == "sold"
    again = await _buy(client, buyer)
    assert again.status_code == 409


async def test_buy_now_partial_quantity_caps_and_keeps_lot_open(client, user_store):
    buyer, farmer = await _setup(client, user_store)
    resp = await _buy(client, buyer, quantity=4)
    assert resp.status_code == 201
    assert resp.json()["quantity"] == 4
    assert resp.json()["totalAmount"] == 8000
    assert user_store[f"market_lots/{LOT_ID}"]["quantityQuintals"] == 6
    assert user_store[f"market_lots/{LOT_ID}"]["status"] == "open"


async def test_buy_now_own_lot_forbidden(client, user_store):
    buyer, farmer = await _setup(client, user_store)
    resp = await _buy(client, farmer)
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "OWN_LOT"


async def test_buy_now_missing_lot_404(client, user_store):
    buyer, farmer = await _setup(client, user_store)
    resp = await _buy(client, buyer, lot_id="lot_missing")
    assert resp.status_code == 404


# ---- list & get ----


async def test_list_purchases_buyer_and_farmer_views(client, user_store):
    buyer, farmer = await _setup(client, user_store)
    purchase_id = (await _buy(client, buyer)).json()["id"]
    resp = await client.get("/v1/purchases", headers=_auth(buyer))
    assert resp.json()["total"] == 1
    resp = await client.get("/v1/purchases", headers=_auth(farmer))
    assert resp.json()["total"] == 1
    assert resp.json()["data"][0]["id"] == purchase_id
    resp = await client.get("/v1/purchases?role=buyer", headers=_auth(farmer))
    assert resp.json()["total"] == 0


async def test_get_purchase_participant_only(client, user_store):
    buyer, farmer = await _setup(client, user_store)
    purchase_id = (await _buy(client, buyer)).json()["id"]
    outsider = create_access_token("uid-outsider")
    resp = await client.get(f"/v1/purchases/{purchase_id}", headers=_auth(outsider))
    assert resp.status_code == 403
    resp = await client.get(f"/v1/purchases/{purchase_id}", headers=_auth(farmer))
    assert resp.status_code == 200
    resp = await client.get("/v1/purchases/pur_missing", headers=_auth(buyer))
    assert resp.status_code == 404


# ---- happy path lifecycle ----


async def test_full_lifecycle_to_invoice(client, user_store):
    buyer, farmer = await _setup(client, user_store)
    purchase_id = (await _buy(client, buyer)).json()["id"]
    resp = await client.post(
        f"/v1/purchases/{purchase_id}/advance",
        json={"amount": 5000, "method": "upi", "reference": "upi123"},
        headers=_auth(buyer),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "advancePaid"
    assert resp.json()["advancePaid"] == 5000
    assert resp.json()["payments"][0]["kind"] == "advance"
    resp = await client.post(
        f"/v1/purchases/{purchase_id}/pickup",
        json={"date": "2026-09-28", "vehicleType": "Truck", "address": "Nashik", "notes": "morning"},
        headers=_auth(farmer),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "pickupScheduled"
    assert resp.json()["pickup"]["vehicleType"] == "Truck"
    resp = await client.post(f"/v1/purchases/{purchase_id}/dispatch", headers=_auth(farmer))
    assert resp.json()["status"] == "inTransit"
    resp = await client.post(f"/v1/purchases/{purchase_id}/deliver", headers=_auth(buyer))
    assert resp.json()["status"] == "delivered"
    resp = await client.post(
        f"/v1/purchases/{purchase_id}/qc",
        json={"grade": "A", "acceptedQty": 10, "rejectedQty": 0, "note": ""},
        headers=_auth(buyer),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "completed"
    assert resp.json()["finalAmount"] == 20000
    assert resp.json()["invoice"]["number"].startswith("INV-")
    resp = await client.get(f"/v1/purchases/{purchase_id}/invoice", headers=_auth(farmer))
    assert resp.status_code == 200
    assert resp.json()["purchaseId"] == purchase_id
    assert resp.json()["number"].startswith("INV-")
    events = [e["status"] for e in (await client.get(f"/v1/purchases/{purchase_id}", headers=_auth(buyer))).json()["events"]]
    assert events == ["confirmed", "advancePaid", "pickupScheduled", "inTransit", "delivered", "qc", "completed"]


async def test_advance_exceeding_total_422(client, user_store):
    buyer, farmer = await _setup(client, user_store)
    purchase_id = (await _buy(client, buyer)).json()["id"]
    resp = await client.post(
        f"/v1/purchases/{purchase_id}/advance",
        json={"amount": 25000},
        headers=_auth(buyer),
    )
    assert resp.status_code == 422
    still = await client.get(f"/v1/purchases/{purchase_id}", headers=_auth(buyer))
    assert still.json()["status"] == "confirmed"


async def test_invalid_transition_dispatch_from_confirmed_400(client, user_store):
    buyer, farmer = await _setup(client, user_store)
    purchase_id = (await _buy(client, buyer)).json()["id"]
    resp = await client.post(f"/v1/purchases/{purchase_id}/dispatch", headers=_auth(farmer))
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "INVALID_STATUS_TRANSITION"


async def test_invoice_not_found_before_completion(client, user_store):
    buyer, farmer = await _setup(client, user_store)
    purchase_id = (await _buy(client, buyer)).json()["id"]
    resp = await client.get(f"/v1/purchases/{purchase_id}/invoice", headers=_auth(buyer))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "INVOICE_NOT_FOUND"


# ---- partial QC, dispute, resolve ----


async def test_partial_qc_dispute_resolve_adjusted_invoice(client, user_store):
    buyer, farmer = await _setup(client, user_store)
    purchase_id = (await _buy(client, buyer)).json()["id"]
    await _to_delivered(client, buyer, farmer, purchase_id)
    resp = await client.post(
        f"/v1/purchases/{purchase_id}/qc",
        json={"grade": "B", "acceptedQty": 8, "rejectedQty": 2, "note": "2q rot"},
        headers=_auth(buyer),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "qcDisputed"
    assert resp.json()["finalAmount"] == 16000
    resp = await client.post(
        f"/v1/purchases/{purchase_id}/pay",
        json={"amount": 20000, "method": "upi", "reference": "", "kind": "balance"},
        headers=_auth(buyer),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "PAYMENT_EXCEEDS_DUE"
    resp = await client.post(
        f"/v1/purchases/{purchase_id}/resolve",
        json={"resolution": "farmer agreed to 8q billing"},
        headers=_auth(farmer),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "completed"
    invoice = await client.get(f"/v1/purchases/{purchase_id}/invoice", headers=_auth(buyer))
    assert invoice.status_code == 200
    events = [e["status"] for e in (await client.get(f"/v1/purchases/{purchase_id}", headers=_auth(buyer))).json()["events"]]
    assert "resolved" in events and events[-1] == "completed"


async def test_qc_quantity_mismatch_422(client, user_store):
    buyer, farmer = await _setup(client, user_store)
    purchase_id = (await _buy(client, buyer)).json()["id"]
    await _to_delivered(client, buyer, farmer, purchase_id)
    resp = await client.post(
        f"/v1/purchases/{purchase_id}/qc",
        json={"grade": "A", "acceptedQty": 8, "rejectedQty": 1, "note": ""},
        headers=_auth(buyer),
    )
    assert resp.status_code == 422


async def test_qc_before_delivery_400(client, user_store):
    buyer, farmer = await _setup(client, user_store)
    purchase_id = (await _buy(client, buyer)).json()["id"]
    resp = await client.post(
        f"/v1/purchases/{purchase_id}/qc",
        json={"grade": "A", "acceptedQty": 10, "rejectedQty": 0, "note": ""},
        headers=_auth(buyer),
    )
    assert resp.status_code == 400


# ---- payments ----


async def test_balance_payment_cap_and_success(client, user_store):
    buyer, farmer = await _setup(client, user_store)
    purchase_id = (await _buy(client, buyer)).json()["id"]
    await client.post(f"/v1/purchases/{purchase_id}/advance", json={"amount": 5000, "method": "upi"}, headers=_auth(buyer))
    over = await client.post(
        f"/v1/purchases/{purchase_id}/pay",
        json={"amount": 16000, "kind": "balance", "method": "upi"},
        headers=_auth(buyer),
    )
    assert over.status_code == 409
    ok = await client.post(
        f"/v1/purchases/{purchase_id}/pay",
        json={"amount": 15000, "kind": "balance", "method": "upi", "reference": "upi999"},
        headers=_auth(buyer),
    )
    assert ok.status_code == 200
    assert ok.json()["payments"][-1]["kind"] == "balance"
    assert [e["status"] for e in ok.json()["events"]][-1] == "payment"
    zero_due = await client.post(
        f"/v1/purchases/{purchase_id}/pay",
        json={"amount": 1, "kind": "balance", "method": "upi"},
        headers=_auth(buyer),
    )
    assert zero_due.status_code == 409


# ---- cancel ----


async def test_cancel_from_pickup_scheduled(client, user_store):
    buyer, farmer = await _setup(client, user_store)
    purchase_id = (await _buy(client, buyer)).json()["id"]
    await client.post(f"/v1/purchases/{purchase_id}/advance", json={"amount": 5000, "method": "upi"}, headers=_auth(buyer))
    await client.post(
        f"/v1/purchases/{purchase_id}/pickup",
        json={"date": "2026-09-28", "vehicleType": "Truck", "address": "", "notes": ""},
        headers=_auth(farmer),
    )
    resp = await client.post(f"/v1/purchases/{purchase_id}/cancel", json={"reason": "changed plans"}, headers=_auth(buyer))
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"
    again = await client.post(f"/v1/purchases/{purchase_id}/cancel", json={"reason": "x"}, headers=_auth(buyer))
    assert again.status_code == 400


async def test_cancel_from_in_transit_forbidden(client, user_store):
    buyer, farmer = await _setup(client, user_store)
    purchase_id = (await _buy(client, buyer)).json()["id"]
    await client.post(f"/v1/purchases/{purchase_id}/advance", json={"amount": 5000, "method": "upi"}, headers=_auth(buyer))
    await client.post(
        f"/v1/purchases/{purchase_id}/pickup",
        json={"date": "2026-09-28", "vehicleType": "Truck", "address": "", "notes": ""},
        headers=_auth(farmer),
    )
    await client.post(f"/v1/purchases/{purchase_id}/dispatch", headers=_auth(farmer))
    resp = await client.post(f"/v1/purchases/{purchase_id}/cancel", json={"reason": "late"}, headers=_auth(buyer))
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "INVALID_STATUS_TRANSITION"


async def test_payment_on_completed_purchase_forbidden(client, user_store):
    buyer, farmer = await _setup(client, user_store)
    purchase_id = (await _buy(client, buyer)).json()["id"]
    await _to_delivered(client, buyer, farmer, purchase_id)
    await client.post(
        f"/v1/purchases/{purchase_id}/qc",
        json={"grade": "A", "acceptedQty": 10, "rejectedQty": 0, "note": ""},
        headers=_auth(buyer),
    )
    resp = await client.post(
        f"/v1/purchases/{purchase_id}/pay",
        json={"amount": 100, "kind": "full", "method": "cash"},
        headers=_auth(buyer),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "PAYMENT_NOT_ALLOWED"


# ---- ratings ----


async def _completed_purchase(client, user_store):
    buyer, farmer = await _setup(client, user_store)
    purchase_id = (await _buy(client, buyer)).json()["id"]
    await _to_delivered(client, buyer, farmer, purchase_id)
    await client.post(
        f"/v1/purchases/{purchase_id}/qc",
        json={"grade": "A", "acceptedQty": 10, "rejectedQty": 0, "note": ""},
        headers=_auth(buyer),
    )
    return buyer, farmer, purchase_id


async def test_rate_both_directions(client, user_store):
    buyer, farmer, purchase_id = await _completed_purchase(client, user_store)
    resp = await client.post(
        f"/v1/purchases/{purchase_id}/rate",
        json={"target": "farmer", "rating": 5, "review": "great produce"},
        headers=_auth(buyer),
    )
    assert resp.status_code == 200
    rating = resp.json()["rating"]["buyerToFarmer"]
    assert rating["rating"] == 5
    assert rating["review"] == "great produce"
    again = await client.post(
        f"/v1/purchases/{purchase_id}/rate",
        json={"target": "farmer", "rating": 4, "review": ""},
        headers=_auth(buyer),
    )
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "ALREADY_RATED"
    resp = await client.post(
        f"/v1/purchases/{purchase_id}/rate",
        json={"target": "buyer", "rating": 4, "review": "prompt payment"},
        headers=_auth(farmer),
    )
    assert resp.status_code == 200
    assert resp.json()["rating"]["farmerToBuyer"]["rating"] == 4


async def test_rate_wrong_party_forbidden(client, user_store):
    buyer, farmer, purchase_id = await _completed_purchase(client, user_store)
    resp = await client.post(
        f"/v1/purchases/{purchase_id}/rate",
        json={"target": "farmer", "rating": 5, "review": ""},
        headers=_auth(farmer),
    )
    assert resp.status_code == 403
    resp = await client.post(
        f"/v1/purchases/{purchase_id}/rate",
        json={"target": "buyer", "rating": 5, "review": ""},
        headers=_auth(buyer),
    )
    assert resp.status_code == 403


async def test_rate_before_completion_forbidden(client, user_store):
    buyer, farmer = await _setup(client, user_store)
    purchase_id = (await _buy(client, buyer)).json()["id"]
    resp = await client.post(
        f"/v1/purchases/{purchase_id}/rate",
        json={"target": "farmer", "rating": 5, "review": ""},
        headers=_auth(buyer),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "NOT_COMPLETED"
