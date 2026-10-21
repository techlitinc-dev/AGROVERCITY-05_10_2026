"""Nursery order safety workstream v2.

Covers the N1/N2/N4 hardening:
- order get/status/invoice ownership checks (403 for another nursery)
- the placed -> accepted -> packed -> dispatched -> delivered state machine
  ("shipped" accepted as dispatched alias; arbitrary jumps -> 422)
- cancel restores stock on the mirrored products doc AND nursery_plants doc
- buyer notifications in mall vocabulary on every transition
- GET /nursery/ratings received-reviews endpoint (+ reply round-trip)
- payout overdraw validation and the no-Razorpay-keys dev shim
- GET /v1/nurseries directory enrichment (ratings, distance, stock, price
  range, govt certification)
"""
from app.services.tokens import create_access_token
from tests.test_diary import seed_user

ADMIN_MUTATION = {
    "Authorization": "Bearer admin-token",
    "X-Admin-Role": "superadmin",
    "X-Audit-Reason": "nursery orders v2",
}


def _auth(user_id: str) -> dict[str, str]:
    token = create_access_token(user_id)
    return {"Authorization": f"Bearer {token}"}


def _buyer_notifications(user_store, buyer_id) -> list[dict]:
    return [
        doc
        for key, doc in user_store.items()
        if key.startswith("notifications/") and doc.get("userId") == buyer_id
    ]


async def _setup_nursery_with_plant(client, user_store, nursery_id="user_nursery_a"):
    seed_user(
        user_store,
        nursery_id,
        name="Ramesh Patel",
        phone="9823001122",
        active_profile="nursery",
        available_profiles=["farmer", "nursery"],
    )
    headers = _auth(nursery_id)
    r = await client.get("/v1/nursery/profile", headers=headers)
    assert r.status_code == 200

    plant_in = {
        "title": "Kesar Mango Grafted Sapling",
        "species": "Mango (आंबा)",
        "variety": "Gir Kesar",
        "category": "fruit",
        "mrp": 60.0,
        "price": 50.0,
        "stock": 100,
        "unit": "sapling",
        "minOrderQty": 1,
        "description": "Certified grafted saplings.",
        "imageUrl": "",
        "status": "active",
    }
    r = await client.post("/v1/nursery/plants", json=plant_in, headers=headers)
    assert r.status_code == 201
    return headers, r.json()["id"]


async def _place_order_for_plant(client, user_store, plant_id, buyer_id="user_farmer_buyer", key="ord_v2_001"):
    seed_user(
        user_store,
        buyer_id,
        name="Suresh Deshmukh",
        phone="9890112233",
        active_profile="farmer",
        available_profiles=["farmer"],
    )
    buyer_headers = _auth(buyer_id)
    order_in = {
        "items": [{"productId": plant_id, "quantity": 10}],
        "paymentMethod": "upi",
        "deliveryAddress": "Suresh Farm, Post Hadapsar, Pune - 411028",
        "idempotencyKey": key,
    }
    r = await client.post("/v1/orders", json=order_in, headers=buyer_headers)
    assert r.status_code == 200, r.text
    order_id = r.json()["orderId"]
    # TODO(orders-owner): remove this hand-tag once orders.py stamps
    # nurseryId/sellerId at placement (parallel workstream). Assert the field
    # exists right after placement instead.
    order_doc = user_store.get(f"orders/{order_id}")
    assert order_doc is not None, "placed order must exist"
    if order_doc.get("nurseryId") != "user_nursery_a":
        order_doc["nurseryId"] = "user_nursery_a"
        user_store[f"orders/{order_id}"] = order_doc
    return buyer_headers, order_id


async def test_order_ownership_state_machine_cancel_and_notifications(client, user_store):
    nursery_headers, plant_id = await _setup_nursery_with_plant(client, user_store)
    buyer_headers, order_id = await _place_order_for_plant(client, user_store, plant_id)

    # A second, unrelated nursery must not see or drive the order.
    seed_user(
        user_store,
        "user_nursery_b",
        name="Other Nursery",
        phone="9823009900",
        active_profile="nursery",
        available_profiles=["nursery"],
    )
    other_headers = _auth("user_nursery_b")
    r = await client.get(f"/v1/nursery/orders/{order_id}", headers=other_headers)
    assert r.status_code == 403
    r = await client.post(
        f"/v1/nursery/orders/{order_id}/status",
        json={"status": "accepted"},
        headers=other_headers,
    )
    assert r.status_code == 403
    r = await client.get(f"/v1/nursery/orders/{order_id}/invoice", headers=other_headers)
    assert r.status_code == 403

    # Owner reads it fine.
    r = await client.get(f"/v1/nursery/orders/{order_id}", headers=nursery_headers)
    assert r.status_code == 200
    assert r.json()["id"] == order_id

    # Arbitrary jumps are rejected (placed -> delivered, placed -> packed).
    r = await client.post(
        f"/v1/nursery/orders/{order_id}/status",
        json={"status": "delivered"},
        headers=nursery_headers,
    )
    assert r.status_code == 422
    r = await client.post(
        f"/v1/nursery/orders/{order_id}/status",
        json={"status": "packed"},
        headers=nursery_headers,
    )
    assert r.status_code == 422

    # Cancel from placed works and restores stock on BOTH docs.
    # Placement decremented the mirrored products doc (90 left); keep the
    # nursery_plants doc in sync as the orders workstream will once it
    # decrements both, so the restore lands both docs back at 100.
    assert user_store[f"products/{plant_id}"]["stock"] == 90
    user_store[f"nursery_plants/{plant_id}"]["stock"] = 90
    r = await client.post(
        f"/v1/nursery/orders/{order_id}/status",
        json={"status": "cancelled", "notes": "Rain damage at dispatch dock"},
        headers=nursery_headers,
    )
    assert r.status_code == 200
    assert r.json()["order"]["status"] == "cancelled"
    assert user_store[f"products/{plant_id}"]["stock"] == 100
    assert user_store[f"products/{plant_id}"]["inStock"] is True
    assert user_store[f"nursery_plants/{plant_id}"]["stock"] == 100

    # Full happy-path chain on a second order, using the "shipped" alias.
    _, order2 = await _place_order_for_plant(
        client, user_store, plant_id, key="ord_v2_002", buyer_id="user_farmer_buyer"
    )
    for payload in (
        {"status": "accepted"},
        {"status": "packed"},
        {"status": "shipped", "courierName": "Agro Van", "trackingNumber": "TRK-1"},
        {"status": "delivered"},
    ):
        r = await client.post(
            f"/v1/nursery/orders/{order2}/status", json=payload, headers=nursery_headers
        )
        assert r.status_code == 200, r.text
    stored = user_store[f"orders/{order2}"]
    assert stored["status"] == "delivered"
    # The alias must normalise to "dispatched".
    assert stored["events"][-2]["status"] == "dispatched"
    assert stored["trackingNumber"] == "TRK-1"

    # Buyer was notified in mall vocabulary across the chain.
    types = {n.get("type") for n in _buyer_notifications(user_store, "user_farmer_buyer")}
    assert {"confirmed", "shipped", "out_for_delivery", "delivered"} <= types

    # Invoice belongs to the owner too.
    r = await client.get(f"/v1/nursery/orders/{order2}/invoice", headers=nursery_headers)
    assert r.status_code == 200
    assert r.json()["total"] == 500.0

    # Cancel rules on a third order: allowed from accepted, banned once packed.
    _, order3 = await _place_order_for_plant(
        client, user_store, plant_id, key="ord_v2_003", buyer_id="user_farmer_buyer2"
    )
    r = await client.post(
        f"/v1/nursery/orders/{order3}/status",
        json={"status": "accepted"},
        headers=nursery_headers,
    )
    assert r.status_code == 200
    r = await client.post(
        f"/v1/nursery/orders/{order3}/status",
        json={"status": "cancelled"},
        headers=nursery_headers,
    )
    assert r.status_code == 200

    _, order4 = await _place_order_for_plant(
        client, user_store, plant_id, key="ord_v2_004", buyer_id="user_farmer_buyer3"
    )
    await client.post(
        f"/v1/nursery/orders/{order4}/status", json={"status": "accepted"}, headers=nursery_headers
    )
    await client.post(
        f"/v1/nursery/orders/{order4}/status", json={"status": "packed"}, headers=nursery_headers
    )
    r = await client.post(
        f"/v1/nursery/orders/{order4}/status", json={"status": "cancelled"}, headers=nursery_headers
    )
    assert r.status_code == 422
    # packed -> dispatched is the legal next step.
    r = await client.post(
        f"/v1/nursery/orders/{order4}/status", json={"status": "dispatched"}, headers=nursery_headers
    )
    assert r.status_code == 200


async def test_nursery_ratings_list_endpoint(client, user_store):
    nursery_headers, plant_id = await _setup_nursery_with_plant(client, user_store)
    buyer_headers, order_id = await _place_order_for_plant(
        client, user_store, plant_id, key="ord_v2_rat", buyer_id="user_farmer_buyer"
    )
    # Drive the order to delivered so the lifecycle is realistic.
    for payload in (
        {"status": "accepted"},
        {"status": "packed"},
        {"status": "dispatched"},
        {"status": "delivered"},
    ):
        r = await client.post(
            f"/v1/nursery/orders/{order_id}/status", json=payload, headers=nursery_headers
        )
        assert r.status_code == 200

    rating_in = {
        "bookingKind": "nursery",
        "bookingId": order_id,
        "stars": 5,
        "comment": "Excellent graft quality!",
        "tags": ["HEALTHY_PLANTS"],
    }
    r = await client.post("/v1/ratings", json=rating_in, headers=buyer_headers)
    assert r.status_code == 201
    rating_id = r.json()["id"]

    r = await client.get("/v1/nursery/ratings", headers=nursery_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["count"] == 1
    assert data["average"] == 5.0
    item = data["items"][0]
    assert item["id"] == rating_id
    assert item["rating"] == 5
    assert item["comment"] == "Excellent graft quality!"
    assert item["raterName"] == "Suresh Deshmukh"
    assert item["orderId"] == order_id
    assert item["orderStatus"] == "delivered"
    assert item["productTitles"] == ["Kesar Mango Grafted Sapling"]
    assert item["reply"] is None
    assert item["createdAt"]

    # Reply round-trip shows up on the reviews page payload.
    r = await client.post(
        f"/v1/ratings/{rating_id}/reply",
        json={"reply": "धन्यवाद! Happy farming."},
        headers=nursery_headers,
    )
    assert r.status_code == 200
    r = await client.get("/v1/nursery/ratings", headers=nursery_headers)
    assert r.json()["items"][0]["reply"] == "धन्यवाद! Happy farming."


async def test_payout_overdraw_validation_and_dev_shim(client, user_store):
    nursery_headers, plant_id = await _setup_nursery_with_plant(client, user_store)
    await _place_order_for_plant(client, user_store, plant_id, key="ord_v2_pay")
    order_id = next(k.split("/", 1)[1] for k in user_store if k.startswith("orders/"))
    for payload in (
        {"status": "accepted"},
        {"status": "packed"},
        {"status": "dispatched"},
        {"status": "delivered"},
    ):
        r = await client.post(
            f"/v1/nursery/orders/{order_id}/status", json=payload, headers=nursery_headers
        )
        assert r.status_code == 200

    r = await client.get("/v1/nursery/payouts", headers=nursery_headers)
    assert r.status_code == 200
    ledger = r.json()
    assert ledger["commissionPct"] == 5.0
    assert ledger["grossRevenue"] == 500.0
    assert ledger["commissionDeducted"] == 25.0
    assert ledger["netEarnings"] == 475.0
    assert ledger["availableBalance"] == 475.0

    # Overdraw beyond available balance -> 422.
    r = await client.post(
        "/v1/nursery/payouts/request",
        json={"amount": 600.0, "settlementUpi": "nursery@upi"},
        headers=nursery_headers,
    )
    assert r.status_code == 422

    # In-dev (no Razorpay keys) the payout auto-processes.
    r = await client.post(
        "/v1/nursery/payouts/request",
        json={"amount": 400.0, "settlementUpi": "nursery@upi"},
        headers=nursery_headers,
    )
    assert r.status_code == 201
    assert r.json()["status"] == "processed"

    r = await client.get("/v1/nursery/payouts", headers=nursery_headers)
    ledger = r.json()
    assert ledger["withdrawnAmount"] == 400.0
    assert ledger["availableBalance"] == 75.0


async def test_public_nursery_directory_enrichment(client, user_store):
    nursery_id = "user_nursery_a"
    await _setup_nursery_with_plant(client, user_store, nursery_id)
    buyer_headers, order_id = await _place_order_for_plant(
        client, user_store, next(k.split("/", 1)[1] for k in user_store if k.startswith("nursery_plants/")),
        key="ord_v2_dir",
    )
    nursery_headers = _auth(nursery_id)
    for payload in ({"status": "accepted"}, {"status": "packed"}, {"status": "dispatched"}, {"status": "delivered"}):
        await client.post(
            f"/v1/nursery/orders/{order_id}/status", json=payload, headers=nursery_headers
        )
    rating_in = {
        "bookingKind": "nursery",
        "bookingId": order_id,
        "stars": 4,
        "comment": "Good saplings",
        "tags": [],
    }
    r = await client.post("/v1/ratings", json=rating_in, headers=buyer_headers)
    assert r.status_code == 201

    # Give the nursery coordinates, then read the directory as a farmer.
    user_store[f"nurseries/{nursery_id}"]["lat"] = 18.52
    user_store[f"nurseries/{nursery_id}"]["lng"] = 73.86

    r = await client.get("/v1/nurseries?lat=18.60&lng=73.90", headers=buyer_headers)
    assert r.status_code == 200
    entries = r.json()["data"]
    entry = next(e for e in entries if e["id"] == nursery_id)
    assert entry["ratingAvg"] == 4.0
    assert entry["ratingCount"] == 1
    assert entry["availableSaplings"] == 90  # 100 - 10 sold via the order
    assert entry["priceRange"] == {"min": 50.0, "max": 50.0}
    assert entry["isGovtCertified"] is False
    assert entry["distanceKm"] > 0

    # Certification flips on after admin KYC verification.
    r = await client.post(f"/v1/admin/nurseries/{nursery_id}/verify", headers=ADMIN_MUTATION)
    assert r.status_code == 200
    r = await client.get("/v1/nurseries", headers=buyer_headers)
    entry = next(e for e in r.json()["data"] if e["id"] == nursery_id)
    assert entry["isGovtCertified"] is True
