"""Farmer bid board with analytics + professional (partial/full) offer accept."""

from app.services.tokens import create_access_token
from tests.test_users import _auth, _register

LOT_BODY = {
    "crop": "Tomato",
    "quantityQuintals": 20,
    "expectedRate": 2000,
    "harvestDate": "2026-12-01",
    "photos": [],
    "location": {"lat": 20.0, "lng": 73.8},
}


async def _farmer_token(client):
    resp = await _register(client, profiles=["farmer"], primaryProfile="farmer")
    return resp.json()["accessToken"]


def _seed_seller(user_store, uid, name, **extra):
    user_store[f"users/{uid}"] = {
        "id": uid,
        "name": name,
        "phone": "+919876543210",
        "district": "Nashik",
        "village": "Pimplas",
        "linkedProfiles": ["seller"],
        "primaryProfile": "seller",
        "activeProfile": "seller",
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


async def _post_lot(client, token):
    resp = await client.post("/v1/market/lots", json=LOT_BODY, headers=_auth(token))
    assert resp.status_code == 201
    return resp.json()


async def _bid(client, token, lot_id, price, qty, **extra):
    return await client.post(
        "/v1/offers",
        json={
            "targetType": "lot",
            "targetId": lot_id,
            "pricePerUnit": price,
            "quantity": qty,
            **extra,
        },
        headers=_auth(token),
    )


async def test_offer_board_with_analytics_and_buyer_summary(client, user_store):
    farmer_token = await _farmer_token(client)
    lot = await _post_lot(client, farmer_token)
    t2 = _seed_seller(user_store, "uid-2", "Sham Traders", vyapariVerified=True,
                      ratingStats={"count": 4, "sum": 18, "average": 4.5})
    t3 = _seed_seller(user_store, "uid-3", "Ravi Vyapar")

    resp = await _bid(client, t2, lot["id"], 2100, 8, pickupDate="2026-12-01",
                      paymentTermsDays=15, transportMode="farmerDelivers")
    assert resp.status_code == 201
    # New richer-bid fields are persisted on the offer doc and returned.
    assert resp.json()["pickupDate"] == "2026-12-01"
    assert resp.json()["paymentTermsDays"] == 15
    assert resp.json()["transportMode"] == "farmerDelivers"
    resp = await _bid(client, t3, lot["id"], 2200, 10, pickupDate="2026-12-05")
    assert resp.status_code == 201
    assert resp.json()["paymentTermsDays"] == 0
    assert resp.json()["transportMode"] == "buyerArranges"

    # Non-owner is forbidden; missing lot 404s.
    resp = await client.get(f"/v1/market/lots/{lot['id']}/offers", headers=_auth(t2))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "LOT_FORBIDDEN"
    resp = await client.get("/v1/market/lots/lot_missing/offers", headers=_auth(farmer_token))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "LOT_NOT_FOUND"

    resp = await client.get(f"/v1/market/lots/{lot['id']}/offers", headers=_auth(farmer_token))
    assert resp.status_code == 200
    body = resp.json()
    data = body["data"]
    assert len(data) == 2
    # Sorted by best rate first.
    assert data[0]["pricePerUnit"] == 2200
    assert data[0]["fromId"] == "uid-3"
    assert data[0]["pickupDate"] == "2026-12-05"
    assert data[1]["pickupDate"] == "2026-12-01"
    assert data[1]["paymentTermsDays"] == 15
    # Buyer summary.
    assert data[0]["buyer"]["buyerId"] == "uid-3"
    assert data[0]["buyer"]["name"] == "Ravi Vyapar"
    assert data[0]["buyer"]["district"] == "Nashik"
    assert data[0]["buyer"]["village"] == "Pimplas"
    assert data[0]["buyer"]["verified"] is False
    assert data[0]["buyer"]["avgRating"] is None
    assert data[0]["buyer"]["completedPurchases"] == 0
    assert data[0]["buyer"]["offersOnThisLotCount"] == 1
    assert data[1]["buyer"]["verified"] is True
    assert data[1]["buyer"]["avgRating"] == 4.5

    analytics = body["analytics"]
    assert analytics["totalOffers"] == 2
    assert analytics["bestRate"] == 2200
    assert analytics["avgRate"] == 2150
    assert analytics["avgQuantity"] == 9
    assert analytics["totalOfferedQty"] == 18
    assert analytics["verifiedOffers"] == 1
    assert analytics["bestOfferId"] == data[0]["id"]
    assert analytics["rateVsExpected"] == {"expected": 2000, "bestDeltaPct": 10.0}


async def test_offer_past_pickup_date_422(client, user_store):
    farmer_token = await _farmer_token(client)
    lot = await _post_lot(client, farmer_token)
    t2 = _seed_seller(user_store, "uid-2", "Sham Traders")
    resp = await _bid(client, t2, lot["id"], 2100, 8, pickupDate="2020-01-01")
    assert resp.status_code == 422
    assert "pickupDate" in resp.json()["error"]["fieldErrors"]
    # Invalid format is rejected too.
    resp = await _bid(client, t2, lot["id"], 2100, 8, pickupDate="01/12/2026")
    assert resp.status_code == 422


async def _setup_three_offers(client, user_store):
    farmer_token = await _farmer_token(client)
    lot = await _post_lot(client, farmer_token)
    t2 = _seed_seller(user_store, "uid-2", "Sham Traders")
    t3 = _seed_seller(user_store, "uid-3", "Ravi Vyapar")
    t4 = _seed_seller(user_store, "uid-4", "Kisan Buyer")
    offer_a = (await _bid(client, t2, lot["id"], 2100, 8)).json()
    offer_b = (await _bid(client, t3, lot["id"], 2200, 10)).json()
    offer_c = (await _bid(client, t4, lot["id"], 2150, 5)).json()
    sellers = {"uid-2": t2, "uid-3": t3, "uid-4": t4}
    return farmer_token, lot, offer_a, offer_b, offer_c, sellers


def _seller_token(sellers, offer):
    return sellers[offer["fromId"]]


async def _confirm_deal(client, farmer_token, offer, seller_token, body=None):
    """Mutual agreement: farmer's accept records the first agreement, the
    buyer's accept locks the deal and creates the purchase."""
    resp = await client.post(
        f"/v1/offers/{offer['id']}/accept", json=body, headers=_auth(farmer_token)
    )
    assert resp.status_code == 200
    assert resp.json()["offer"]["status"] == "agreement_pending"
    assert resp.json()["purchase"] is None
    resp = await client.post(
        f"/v1/offers/{offer['id']}/accept", json=body, headers=_auth(seller_token)
    )
    assert resp.status_code == 200
    return resp.json()


async def test_partial_accept_keeps_lot_open_and_siblings_pending(client, user_store):
    farmer_token, lot, offer_a, offer_b, _offer_c, sellers = await _setup_three_offers(client, user_store)

    # Out-of-bounds quantities are semantic validation errors — enforced when
    # the deal locks (second confirmation), the lot stays untouched meanwhile.
    body = {"quantity": 21}
    resp = await client.post(
        f"/v1/offers/{offer_b['id']}/accept", json=body, headers=_auth(farmer_token)
    )
    assert resp.status_code == 200  # first agreement recorded
    assert resp.json()["offer"]["status"] == "agreement_pending"
    resp = await client.post(
        f"/v1/offers/{offer_b['id']}/accept", json=body, headers=_auth(_seller_token(sellers, offer_b))
    )
    assert resp.status_code == 422
    assert "quantity" in resp.json()["error"]["fieldErrors"]

    # 9 > offered 8 fails at lock time too; the agreement is then cancelled.
    resp = await client.post(
        f"/v1/offers/{offer_a['id']}/accept", json={"quantity": 9}, headers=_auth(farmer_token)
    )
    assert resp.status_code == 200
    resp = await client.post(
        f"/v1/offers/{offer_a['id']}/accept",
        json={"quantity": 9},
        headers=_auth(_seller_token(sellers, offer_a)),
    )
    assert resp.status_code == 422  # 9 > offered 8
    resp = await client.post(
        f"/v1/offers/{offer_a['id']}/agreement/cancel",
        headers=_auth(_seller_token(sellers, offer_a)),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "pending"

    # Partial deal on B: farmer already agreed above; buyer confirms with a
    # valid quantity → the deal locks.
    body = {"quantity": 6}
    resp = await client.post(
        f"/v1/offers/{offer_b['id']}/accept", json=body, headers=_auth(_seller_token(sellers, offer_b))
    )
    assert resp.status_code == 200
    locked = resp.json()
    assert locked["offer"]["status"] == "accepted"
    assert locked["offer"]["acceptedQuantity"] == 6
    purchase = locked["purchase"]
    assert purchase["quantity"] == 6
    assert purchase["agreedPricePerUnit"] == 2200
    assert purchase["totalAmount"] == 13200
    assert purchase["source"] == {"type": "offer", "refId": offer_b["id"]}
    assert purchase["status"] == "confirmed"

    stored_lot = user_store[f"market_lots/{lot['id']}"]
    assert stored_lot["status"] == "open"
    assert stored_lot["quantityQuintals"] == 14
    # Sibling offers untouched.
    assert user_store[f"offers/{offer_a['id']}"]["status"] == "pending"

    # An accepted offer cannot be re-accepted.
    resp = await client.post(
        f"/v1/offers/{offer_b['id']}/accept", json={"quantity": 2}, headers=_auth(farmer_token)
    )
    assert resp.status_code == 400


async def test_full_accept_sells_lot_and_auto_rejects_siblings(client, user_store):
    farmer_token, lot, offer_a, offer_b, offer_c, sellers = await _setup_three_offers(client, user_store)

    # Partially confirm B first so A's full deal closes the lot.
    await _confirm_deal(
        client, farmer_token, offer_b, _seller_token(sellers, offer_b), body={"quantity": 6}
    )
    # Full deal on A (no body): farmer agrees, buyer confirms → lot closes,
    # remaining live offer C is rejected.
    body = await _confirm_deal(client, farmer_token, offer_a, _seller_token(sellers, offer_a))
    purchase = body["purchase"]
    assert purchase["quantity"] == 8
    assert purchase["agreedPricePerUnit"] == 2100
    assert user_store[f"market_lots/{lot['id']}"]["status"] == "sold"

    stored_c = user_store[f"offers/{offer_c['id']}"]
    assert stored_c["status"] == "rejected"
    assert stored_c["rejectReason"] == "lot_fulfilled"
    # The losing buyer is notified (offer_rejected type already exists).
    notes = _notifications_for(user_store, "uid-4", "offer_rejected")
    assert len(notes) == 1
    assert "lot fulfilled" in notes[0]["body"]
    # Both parties of the winning deal still get booking_confirmed.
    assert _notifications_for(user_store, "uid-1", "booking_confirmed")
    assert _notifications_for(user_store, "uid-2", "booking_confirmed")

    # Accepting any further offer on the sold lot is a 409.
    user_store["offers/off_seed"] = {
        "id": "off_seed",
        "targetType": "lot",
        "targetId": lot["id"],
        "fromId": "uid-9",
        "fromName": "Late Bidder",
        "toId": "uid-1",
        "pricePerUnit": 2300,
        "quantity": 1,
        "unit": "quintal",
        "status": "pending",
        "rounds": 0,
        "negotiationLog": [],
        "createdAt": "2026-10-10T00:00:00+00:00",
        "updatedAt": "2026-10-10T00:00:00+00:00",
    }
    resp = await client.post("/v1/offers/off_seed/accept", headers=_auth(farmer_token))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "LOT_NOT_OPEN"


async def test_accept_quantity_equal_to_remaining_closes_lot(client, user_store):
    farmer_token = await _farmer_token(client)
    lot = await _post_lot(client, farmer_token)
    t2 = _seed_seller(user_store, "uid-2", "Sham Traders")
    offer = (await _bid(client, t2, lot["id"], 2300, 20)).json()
    # Agreeing on exactly the remaining quantity is a full deal: lot closes.
    body = await _confirm_deal(client, farmer_token, offer, t2, body={"quantity": 20})
    assert body["purchase"]["quantity"] == 20
    assert user_store[f"market_lots/{lot['id']}"]["status"] == "sold"
    assert user_store[f"offers/{offer['id']}"]["status"] == "accepted"
