"""Farmer ↔ Agri-Vyapari direct-connect workflow (spec §13 backend tests).

Two connection paths, no transaction intermediation:
- Journey A: farmer posts a lot → vyapari finds it → vyapari contacts the farmer.
- Journey B: vyapari posts a requirement → farmer applies → vyapari contacts
  the applicant.

Everything after connection (price, payment, pickup, quality) is off-platform;
these tests assert no purchase/escrow/procurement object is ever created.

Fixture note: the fake Firebase token always decodes to uid-1, so only ONE
user per test can go through the real registration endpoint. Every second
party is a seeded user doc (with an explicit kycStatus) plus a signed token.
"""
from app.core.security import hash_mpin
from app.services.tokens import create_access_token
from tests.test_demands_offers import _create_demand
from tests.test_direct_buyer import _register_buyer
from tests.test_lots import LOT_BODY
from tests.test_users import _auth, _register


async def _registered_farmer_token(client):
    """The one real-registration user of the test — a verified farmer (uid-1)."""
    resp = await _register(client)
    return resp.json()["accessToken"]


def _seeded_user(user_store, uid, name, active="farmer", verified=True, **extra):
    doc = {
        "id": uid,
        "name": name,
        "phone": "+919876543210",
        "state": "Maharashtra",
        "district": "Nashik",
        "village": "Pimplas",
        "linkedProfiles": [active],
        "activeProfile": active,
        "primaryProfile": active,
        "mpinHash": None,
        "createdAt": "2026-10-01T00:00:00+00:00",
        "kycStatus": "verified" if verified else "pending",
        **extra,
    }
    user_store[f"users/{uid}"] = doc
    return create_access_token(uid)


def _unverified_user(user_store, uid, name="Unverified Ram", active="farmer"):
    return _seeded_user(user_store, uid, name, active=active, verified=False)


async def _create_lot(client, token, **overrides):
    resp = await client.post("/v1/market/lots", json={**LOT_BODY, **overrides}, headers=_auth(token))
    assert resp.status_code == 201, resp.text
    return resp.json()


# ---------------------------------------------------------------- Journey A


async def test_farmer_creates_valid_lot(client):
    token = await _registered_farmer_token(client)
    lot = await _create_lot(client, token, crop="Onion", variety="Nashik Red")
    assert lot["status"] == "open"
    assert lot["crop"] == "Onion"
    assert lot["quantityQuintals"] == LOT_BODY["quantityQuintals"]


async def test_unverified_user_cannot_post_lot(client, user_store):
    token = _unverified_user(user_store, "uid-unv")
    resp = await client.post("/v1/market/lots", json=dict(LOT_BODY), headers=_auth(token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "KYC_REQUIRED"


async def test_unverified_user_cannot_post_requirement(client, user_store):
    token = _unverified_user(user_store, "uid-unv2", active="directBuyer")
    resp = await client.post(
        "/v1/demands",
        json={"crop": "Soybean", "quantity": 10, "unit": "quintal", "maxPrice": 4000},
        headers=_auth(token),
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "KYC_REQUIRED"


async def test_browse_lots_hides_contacts_and_shows_verified_badge(client, user_store):
    farmer_token = await _registered_farmer_token(client)
    await _create_lot(client, farmer_token)
    # Browse as a vyapari — a farmer's own lot is excluded from their browse.
    seller_token = _seeded_user(user_store, "uid-seller", "Kishor Traders", active="seller")
    resp = await client.get("/v1/market/lots/browse", headers=_auth(seller_token))
    assert resp.status_code == 200
    rows = resp.json()["data"]
    assert len(rows) == 1
    row = rows[0]
    # Server-derived verification badge present; contact fields never leaked.
    assert row["farmerVerified"] is True
    for contact_field in ("phone", "whatsapp", "farmerContact", "phoneDigits", "whatsappDigits"):
        assert row.get(contact_field) is None


async def test_vyapari_contact_requires_terms_kyc_mpin(client, user_store):
    farmer_token = await _registered_farmer_token(client)
    lot = await _create_lot(client, farmer_token)
    seller_token = _seeded_user(
        user_store, "uid-seller", "Kishor Traders", active="seller", mpinHash=hash_mpin("4321")
    )

    # Terms not accepted → 422.
    resp = await client.post("/v1/leads", json={"lotId": lot["id"]}, headers=_auth(seller_token))
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "TERMS_REQUIRED"

    # Wrong MPIN → 401.
    resp = await client.post(
        "/v1/leads",
        json={"lotId": lot["id"], "termsAccepted": True, "mpin": "9999"},
        headers=_auth(seller_token),
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "WRONG_MPIN"

    # Correct terms + MPIN → contact revealed both ways + terms audit trail.
    resp = await client.post(
        "/v1/leads",
        json={"lotId": lot["id"], "termsAccepted": True, "mpin": "4321"},
        headers=_auth(seller_token),
    )
    assert resp.status_code == 201
    lead = resp.json()["lead"]
    assert lead["termsAccepted"] is True
    assert lead["termsVersion"] == "dc-1.0"
    assert lead["termsAcceptedBy"] == "uid-seller"
    assert lead["contactRevealedAt"]
    assert lead["farmerContact"]["phone"]
    assert lead["buyerContact"]["phone"]


async def test_contact_unlock_is_idempotent_and_chat_created_once(client, user_store):
    farmer_token = await _registered_farmer_token(client)
    lot = await _create_lot(client, farmer_token)
    seller_token = _seeded_user(user_store, "uid-seller", "Kishor Traders", active="seller")

    first = await client.post(
        "/v1/leads", json={"lotId": lot["id"], "termsAccepted": True}, headers=_auth(seller_token)
    )
    assert first.status_code == 201
    second = await client.post(
        "/v1/leads", json={"lotId": lot["id"], "termsAccepted": True}, headers=_auth(seller_token)
    )
    assert second.status_code == 200  # existing connection returned
    assert second.json()["lead"]["id"] == first.json()["lead"]["id"]
    assert second.json()["chatRoomId"] == first.json()["chatRoomId"]
    leads = [k for k in user_store if k.startswith("leads/")]
    assert len(leads) == 1
    rooms = [k for k in user_store if k.startswith("chat_rooms/") and "/messages" not in k]
    assert len(rooms) == 1


async def test_unverified_buyer_cannot_contact_farmer(client, user_store):
    farmer_token = await _registered_farmer_token(client)
    lot = await _create_lot(client, farmer_token)
    token = _unverified_user(user_store, "uid-unv3", active="seller")
    resp = await client.post(
        "/v1/leads", json={"lotId": lot["id"], "termsAccepted": True}, headers=_auth(token)
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "KYC_REQUIRED"


# ---------------------------------------------------------------- Journey B


async def test_vyapari_posts_requirement(client):
    buyer_token = (await _register_buyer(client)).json()["accessToken"]
    demand = (await _create_demand(client, buyer_token, crop="Cotton")).json()
    assert demand["status"] == "open"
    assert demand["crop"] == "Cotton"


async def test_farmer_applies_with_valid_quantity_and_price(client, user_store):
    buyer_token = (await _register_buyer(client)).json()["accessToken"]
    demand = (await _create_demand(client, buyer_token, crop="Soybean")).json()
    farmer_token = _seeded_user(user_store, "uid-f1", "Ram Patel")

    resp = await client.post(
        "/v1/leads",
        json={
            "demandId": demand["id"],
            "pricePerUnit": 4500,
            "quantity": 20,
            "message": "Grade A",
            "termsAccepted": True,
        },
        headers=_auth(farmer_token),
    )
    assert resp.status_code == 201
    lead = resp.json()["lead"]
    assert lead["source"] == "demand"
    assert lead["status"] == "new"
    assert lead["pricePerUnit"] == 4500


async def test_duplicate_application_prevented(client, user_store):
    buyer_token = (await _register_buyer(client)).json()["accessToken"]
    demand = (await _create_demand(client, buyer_token, crop="Soybean")).json()
    farmer_token = _seeded_user(user_store, "uid-f1", "Ram Patel")
    body = {"demandId": demand["id"], "pricePerUnit": 4500, "quantity": 20, "termsAccepted": True}

    first = await client.post("/v1/leads", json=body, headers=_auth(farmer_token))
    assert first.status_code == 201
    dup = await client.post("/v1/leads", json=body, headers=_auth(farmer_token))
    assert dup.status_code == 200
    assert dup.json()["lead"]["id"] == first.json()["lead"]["id"]


async def test_vyapari_reviews_only_own_applications(client, user_store):
    buyer_token = (await _register_buyer(client)).json()["accessToken"]
    demand = (await _create_demand(client, buyer_token, crop="Soybean")).json()
    other_buyer = _seeded_user(user_store, "uid-other-buyer", "Other Buyer", active="directBuyer")

    farmer_token = _seeded_user(user_store, "uid-f1", "Ram Patel")
    await client.post(
        "/v1/leads",
        json={"demandId": demand["id"], "pricePerUnit": 4500, "quantity": 20, "termsAccepted": True},
        headers=_auth(farmer_token),
    )
    mine = await client.get(
        "/v1/leads/mine", params={"filter": "sent", "source": "demand"}, headers=_auth(buyer_token)
    )
    assert mine.status_code == 200
    assert len(mine.json()["data"]) == 1
    # The farmer sees the same connection from their side.
    farmer_view = await client.get(
        "/v1/leads/mine", params={"filter": "received", "source": "demand"}, headers=_auth(farmer_token)
    )
    assert [r["id"] for r in farmer_view.json()["data"]] == [mine.json()["data"][0]["id"]]
    # The other buyer sees none of it.
    theirs = await client.get(
        "/v1/leads/mine", params={"filter": "sent", "source": "demand"}, headers=_auth(other_buyer)
    )
    assert theirs.json()["data"] == []


async def test_vyapari_contact_unlock_on_application_requires_terms_and_mpin(client, user_store):
    buyer_token = (await _register_buyer(client)).json()["accessToken"]
    demand = (await _create_demand(client, buyer_token, crop="Soybean")).json()
    # The buyer verifies MPIN at unlock time.
    user_store["users/uid-1"]["mpinHash"] = hash_mpin("9876")
    farmer_token = _seeded_user(user_store, "uid-f1", "Ram Patel")
    applied = await client.post(
        "/v1/leads",
        json={"demandId": demand["id"], "pricePerUnit": 4500, "quantity": 20, "termsAccepted": True},
        headers=_auth(farmer_token),
    )
    lead_id = applied.json()["lead"]["id"]

    # Missing terms → 422; wrong MPIN → 401.
    resp = await client.post(f"/v1/leads/{lead_id}/unlock", json={}, headers=_auth(buyer_token))
    assert resp.status_code == 422
    resp = await client.post(
        f"/v1/leads/{lead_id}/unlock",
        json={"termsAccepted": True, "mpin": "1111"},
        headers=_auth(buyer_token),
    )
    assert resp.status_code == 401

    # Correct → contact unlocked, application marked contacted, idempotent.
    ok = await client.post(
        f"/v1/leads/{lead_id}/unlock",
        json={"termsAccepted": True, "mpin": "9876"},
        headers=_auth(buyer_token),
    )
    assert ok.status_code == 200
    assert ok.json()["status"] == "contacted"
    assert ok.json()["farmerContact"]["phone"]
    again = await client.post(
        f"/v1/leads/{lead_id}/unlock",
        json={"termsAccepted": True, "mpin": "9876"},
        headers=_auth(buyer_token),
    )
    assert again.status_code == 200
    assert again.json()["farmerContact"]["phone"] == ok.json()["farmerContact"]["phone"]

    # The farmer hears about the unlock.
    notifs = [v for k, v in user_store.items() if k.startswith("notifications/")]
    assert any(n.get("type") == "contact_unlocked" for n in notifs)


async def test_non_participant_cannot_unlock_or_view_contact(client, user_store):
    buyer_token = (await _register_buyer(client)).json()["accessToken"]
    demand = (await _create_demand(client, buyer_token, crop="Soybean")).json()
    farmer_token = _seeded_user(user_store, "uid-f1", "Ram Patel")
    applied = await client.post(
        "/v1/leads",
        json={"demandId": demand["id"], "pricePerUnit": 4500, "quantity": 20, "termsAccepted": True},
        headers=_auth(farmer_token),
    )
    lead_id = applied.json()["lead"]["id"]
    stranger = _unverified_user(user_store, "uid-stranger")
    resp = await client.post(
        f"/v1/leads/{lead_id}/unlock",
        json={"termsAccepted": True},
        headers=_auth(stranger),
    )
    assert resp.status_code == 404


# ------------------------------------------------------ closure & outcomes


async def test_closed_requirement_blocks_new_applications(client, user_store):
    buyer_token = (await _register_buyer(client)).json()["accessToken"]
    demand = (await _create_demand(client, buyer_token, crop="Soybean")).json()
    farmer_token = _seeded_user(user_store, "uid-f1", "Ram Patel")
    apply_body = {"demandId": demand["id"], "pricePerUnit": 4500, "quantity": 20, "termsAccepted": True}
    applied = await client.post("/v1/leads", json=apply_body, headers=_auth(farmer_token))
    assert applied.status_code == 201

    await client.post(f"/v1/demands/{demand['id']}/close", headers=_auth(buyer_token))

    resp = await client.post("/v1/leads", json=apply_body, headers=_auth(farmer_token))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "DEMAND_CLOSED"
    # The applicant is notified with a valid website route.
    notifs = [v for k, v in user_store.items() if k.startswith("notifications/")]
    assert any(n.get("type") == "demand_closed" for n in notifs)


async def test_sold_or_withdrawn_lot_blocks_new_leads(client, user_store):
    farmer_token = await _registered_farmer_token(client)
    lot = await _create_lot(client, farmer_token)
    await client.post(f"/v1/market/lots/{lot['id']}/mark-sold", headers=_auth(farmer_token))
    seller_token = _seeded_user(user_store, "uid-seller", "Kishor Traders", active="seller")
    resp = await client.post(
        "/v1/leads", json={"lotId": lot["id"], "termsAccepted": True}, headers=_auth(seller_token)
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "LOT_NOT_OPEN"


async def test_deal_outcome_recorded_without_any_payment_objects(client, user_store):
    farmer_token = await _registered_farmer_token(client)
    lot = await _create_lot(client, farmer_token)
    seller_token = _seeded_user(user_store, "uid-seller", "Kishor Traders", active="seller")
    lead = (
        await client.post(
            "/v1/leads", json={"lotId": lot["id"], "termsAccepted": True}, headers=_auth(seller_token)
        )
    ).json()["lead"]

    # Either party records the outcome; optional final rate is free text input.
    resp = await client.patch(
        f"/v1/leads/{lead['id']}",
        json={"status": "sold", "finalRate": 2100},
        headers=_auth(farmer_token),
    )
    assert resp.status_code == 200
    assert resp.json()["finalRate"] == 2100

    # No payment/procurement/purchase/escrow/settlement object was created —
    # the outcome is a user-reported label only.
    for banned in ("purchases", "escrow", "settlements", "procurement_orders", "orders", "invoices"):
        assert not any(k.startswith(f"{banned}/") for k in user_store), banned
    # The lot closed as a marketplace status, not a transaction.
    lot_doc = await client.get(f"/v1/market/lots/{lot['id']}", headers=_auth(farmer_token))
    assert lot_doc.json()["status"] == "sold"


async def test_notifications_use_valid_website_routes(client, user_store):
    farmer_token = await _registered_farmer_token(client)
    lot = await _create_lot(client, farmer_token)
    seller_token = _seeded_user(user_store, "uid-seller", "Kishor Traders", active="seller")
    await client.post(
        "/v1/leads", json={"lotId": lot["id"], "termsAccepted": True}, headers=_auth(seller_token)
    )
    notifs = [v for k, v in user_store.items() if k.startswith("notifications/")]
    assert notifs, "expected at least the lead_received notification"
    valid_prefixes = ("/farmer/", "/seller/", "/chat", "/dashboard")
    for n in notifs:
        link = (n.get("data") or {}).get("deepLink") or n.get("deepLink") or ""
        assert any(link.startswith(p) for p in valid_prefixes), link
        # Private phone numbers never appear in notification payloads.
        assert not n.get("phone")
