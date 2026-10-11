"""Resale module: seller stock, resale listings, browse/book (incl. exporter
buyers), listing close, and idempotent booking."""

from app.services.tokens import create_access_token
from tests.test_users import _auth, _register


async def _seller_token(client):
    resp = await _register(client, profiles=["farmer", "seller"], primaryProfile="seller")
    assert resp.status_code == 200
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


async def _add_stock(client, token, **overrides):
    body = {
        "crop": "Onion",
        "quantityQuintals": 10,
        "ratePerQuintal": 1500,
        "grade": "A",
        "location": "Nashik",
    }
    body.update(overrides)
    return await client.post("/v1/seller/stock", json=body, headers=_auth(token))


async def _make_listing(client, seller, qty=6, rate=1800, key="list-1", **overrides):
    stock = (await _add_stock(client, seller, quantityQuintals=qty + 4)).json()
    body = {"stockId": stock["id"], "quantityQuintals": qty, "askingRatePerQuintal": rate}
    body.update(overrides)
    return await client.post(
        "/v1/resale-listings",
        json=body,
        headers={**_auth(seller), "Idempotency-Key": key},
    )


async def test_stock_and_listing_lifecycle(client, user_store):
    seller = await _seller_token(client)
    farmer = _seed_user(user_store, "uid-f1", "Ram Patel")

    # farmers are not sellers
    farmer_stock = await _add_stock(client, farmer)
    assert farmer_stock.status_code == 403

    stock = (await _add_stock(client, seller)).json()
    assert stock["id"].startswith("stk_")
    assert stock["status"] == "active"
    assert stock["availableQuintals"] == 10

    listed = await client.get("/v1/seller/stock", headers=_auth(seller))
    assert listed.status_code == 200
    assert listed.json()["summary"]["totals"]["availableQuintals"] == 10

    # listing reserves stock
    listing = await _make_listing(client, seller)
    assert listing.status_code == 201, listing.text
    doc = listing.json()
    assert doc["id"].startswith("rel_")
    assert doc["status"] == "open"
    assert doc["remainingQuintals"] == 6
    stock_after = (await client.get("/v1/seller/stock", headers=_auth(seller))).json()
    assert stock_after["data"][0]["reservedQuintals"] == 6
    assert stock_after["data"][0]["availableQuintals"] == 4

    # idempotent replay returns the same listing
    replayed = await _make_listing(client, seller)
    assert replayed.status_code == 201
    assert replayed.json()["id"] == doc["id"]
    assert len([k for k in user_store if k.startswith("resale_listings/")]) == 1

    # listing beyond available stock is rejected
    stock2 = (await _add_stock(client, seller, crop="Wheat", quantityQuintals=2)).json()
    too_big = await client.post(
        "/v1/resale-listings",
        json={"stockId": stock2["id"], "quantityQuintals": 5, "askingRatePerQuintal": 2000},
        headers={**_auth(seller), "Idempotency-Key": "list-2"},
    )
    assert too_big.status_code == 422

    # mine lists with purchase counts
    mine = await client.get("/v1/resale-listings/mine", headers=_auth(seller))
    assert mine.json()["total"] == 1

    # close releases the reservation
    closed = await client.delete(f"/v1/resale-listings/{doc['id']}", headers=_auth(seller))
    assert closed.status_code == 200
    assert closed.json()["status"] == "closed"
    stock_end = (await client.get("/v1/seller/stock", headers=_auth(seller))).json()
    assert stock_end["data"][0]["reservedQuintals"] == 0
    stranger_close = await client.delete(
        f"/v1/resale-listings/{doc['id']}", headers=_auth(farmer)
    )
    assert stranger_close.status_code == 403


async def test_browse_roles_include_exporter_and_exclude_farmers(client, user_store):
    seller = await _seller_token(client)
    buyer = _seed_user(user_store, "uid-b1", "Dilip Direct", active="directBuyer")
    exporter = _seed_user(user_store, "uid-e1", "Esha Exports", active="exporter")
    farmer = _seed_user(user_store, "uid-f1", "Ram Patel")

    listing = (await _make_listing(client, seller)).json()

    for tok in (buyer, exporter, seller):
        browsed = await client.get("/v1/resale-listings", headers=_auth(tok))
        assert browsed.status_code == 200, tok
        assert browsed.json()["total"] == 1
        entry = browsed.json()["data"][0]
        assert entry["id"] == listing["id"]
        assert entry["seller"]["sellerId"] == "uid-1"
    farmer_view = await client.get("/v1/resale-listings", headers=_auth(farmer))
    assert farmer_view.status_code == 403

    # filters
    by_crop = await client.get("/v1/resale-listings", params={"crop": "oni"}, headers=_auth(buyer))
    assert by_crop.json()["total"] == 1
    by_rate = await client.get(
        "/v1/resale-listings", params={"maxRate": 1500}, headers=_auth(buyer)
    )
    assert by_rate.json()["total"] == 0


async def test_book_creates_purchase_and_drains_stock(client, user_store):
    seller = await _seller_token(client)
    buyer = _seed_user(user_store, "uid-b1", "Dilip Direct", active="directBuyer")
    exporter = _seed_user(user_store, "uid-e1", "Esha Exports", active="exporter")

    listing = (await _make_listing(client, seller, qty=6, rate=1800)).json()
    stock_id = listing["stockId"]

    # booking needs an idempotency key
    no_key = await client.post(
        f"/v1/resale-listings/{listing['id']}/book",
        json={},
        headers=_auth(buyer),
    )
    assert no_key.status_code == 400
    assert no_key.json()["error"]["code"] == "IDEMPOTENCY_KEY_REQUIRED"

    # own listing cannot be booked
    own = await client.post(
        f"/v1/resale-listings/{listing['id']}/book",
        json={},
        headers={**_auth(seller), "Idempotency-Key": "book-own"},
    )
    assert own.status_code == 403
    assert own.json()["error"]["code"] == "OWN_LISTING"

    # partial booking by a direct buyer
    booked = await client.post(
        f"/v1/resale-listings/{listing['id']}/book",
        json={"quantityQuintals": 4},
        headers={**_auth(buyer), "Idempotency-Key": "book-1"},
    )
    assert booked.status_code == 201, booked.text
    payload = booked.json()
    purchase = payload["purchase"]
    assert purchase["buyerId"] == "uid-b1"
    assert purchase["farmerId"] == "uid-1"
    assert purchase["crop"] == "Onion"
    assert purchase["quantity"] == 4
    assert purchase["agreedPricePerUnit"] == 1800
    assert purchase["totalAmount"] == 7200
    assert purchase["source"] == {"type": "resale_listing", "refId": listing["id"]}
    assert purchase["status"] == "confirmed"
    assert payload["listing"]["status"] == "open"
    assert payload["listing"]["remainingQuintals"] == 2

    # replay does not double-book
    replayed = await client.post(
        f"/v1/resale-listings/{listing['id']}/book",
        json={"quantityQuintals": 4},
        headers={**_auth(buyer), "Idempotency-Key": "book-1"},
    )
    assert replayed.status_code == 201
    assert replayed.json()["purchase"]["id"] == purchase["id"]
    assert f"resale_listings/{listing['id']}" in user_store
    assert user_store[f"resale_listings/{listing['id']}"]["remainingQuintals"] == 2

    # booking beyond remaining is rejected
    too_much = await client.post(
        f"/v1/resale-listings/{listing['id']}/book",
        json={"quantityQuintals": 5},
        headers={**_auth(buyer), "Idempotency-Key": "book-2"},
    )
    assert too_much.status_code == 422

    # exporter books the remainder → listing sold, stock drained
    rest = await client.post(
        f"/v1/resale-listings/{listing['id']}/book",
        json={},
        headers={**_auth(exporter), "Idempotency-Key": "book-3"},
    )
    assert rest.status_code == 201, rest.text
    assert rest.json()["purchase"]["buyerId"] == "uid-e1"
    assert rest.json()["purchase"]["quantity"] == 2
    assert rest.json()["listing"]["status"] == "sold"
    stock = user_store[f"seller_stock/{stock_id}"]
    assert stock["quantityQuintals"] == 4  # 10 − 4 − 2
    assert stock["reservedQuintals"] == 0

    # sold listing rejects further bookings
    closed_book = await client.post(
        f"/v1/resale-listings/{listing['id']}/book",
        json={},
        headers={**_auth(buyer), "Idempotency-Key": "book-4"},
    )
    assert closed_book.status_code == 409
    assert closed_book.json()["error"]["code"] == "LISTING_NOT_OPEN"

    # the seller was notified and a chat room exists
    notes = [
        doc
        for key, doc in user_store.items()
        if key.startswith("notifications/") and doc.get("type") == "booking_confirmed"
    ]
    assert len(notes) == 2
    assert user_store[f"chat_rooms/{purchase['id']}"]["kind"] == "purchase"
