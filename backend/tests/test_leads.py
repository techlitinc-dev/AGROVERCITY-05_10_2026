"""Produce-lot leads — the direct-connect flow (TC-FRM-38…49 replacement model).

Buyer accepts the terms (+ MPIN step-up when the account has one) and gets the
farmer's contact; the farmer gets a lead with the buyer's contact; the deal
itself closes off-platform and the farmer marks the lot sold.
"""
from app.core.security import hash_mpin
from tests.test_lots import LOT_BODY
from tests.test_users import _auth, _register


async def _farmer(client):
    resp = await _register(client)
    return resp.json()["accessToken"]


async def _buyer(client, user_store, name="Kishor Traders", mpin=None):
    resp = await client.post("/v1/auth/firebase-verify", json={"idToken": "plain-token"})
    token = resp.json()["accessToken"]
    await client.put("/v1/users/me", json={"name": name}, headers=_auth(token))
    if mpin:
        user_store["users/uid-plain"]["mpinHash"] = hash_mpin(mpin)
    return token


async def _create_lot(client, token, **overrides):
    resp = await client.post("/v1/market/lots", json={**LOT_BODY, **overrides}, headers=_auth(token))
    assert resp.status_code == 201
    return resp.json()


async def test_create_lead_reveals_contacts_both_ways(client, user_store):
    farmer_token = await _farmer(client)
    buyer_token = await _buyer(client, user_store, name="Kishor Traders")
    lot = await _create_lot(client, farmer_token, variety="Nashik Red")

    resp = await client.post(
        "/v1/leads",
        json={"lotId": lot["id"], "termsAccepted": True},
        headers=_auth(buyer_token),
    )
    assert resp.status_code == 201
    body = resp.json()
    lead = body["lead"]
    assert lead["status"] == "new"
    assert lead["lotId"] == lot["id"]
    assert lead["lotCrop"] == "Tomato"
    assert lead["farmerId"] == "uid-1"
    assert lead["buyerId"] == "uid-plain"
    # Farmer contact: first name only for privacy, phone + whatsapp digits.
    fc = lead["farmerContact"]
    assert fc["name"] == "Ram"
    assert fc["phone"] == "+919812345678"
    assert fc["whatsappDigits"] == "919812345678"
    # Buyer contact snapshot.
    assert lead["buyerContact"]["name"] == "Kishor"
    assert lead["buyerContact"]["fullName"] == "Kishor Traders"
    assert lead["buyerContact"]["phoneDigits"] == "919800000001"
    # Direct chat room opened, seeded with the lead context line.
    assert body["chatRoomId"].startswith("dm_")
    room = user_store[f"chat_rooms/{body['chatRoomId']}"]
    assert room["kind"] == "direct"
    assert room["crop"] == "Tomato"
    msgs = [v for k, v in user_store.items() if k.startswith(f"chat_rooms/{body['chatRoomId']}/messages/")]
    assert len(msgs) == 1
    assert "Kishor" in msgs[0]["text"] and "Tomato" in msgs[0]["text"]
    # Farmer notified.
    notifs = [v for k, v in user_store.items() if k.startswith("notifications/")]
    assert any(n.get("type") == "lead_received" for n in notifs)


async def test_terms_required(client, user_store):
    farmer_token = await _farmer(client)
    buyer_token = await _buyer(client, user_store)
    lot = await _create_lot(client, farmer_token)
    resp = await client.post(
        "/v1/leads", json={"lotId": lot["id"], "termsAccepted": False}, headers=_auth(buyer_token)
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "TERMS_REQUIRED"


async def test_mpin_gate_when_buyer_has_mpin(client, user_store):
    farmer_token = await _farmer(client)
    buyer_token = await _buyer(client, user_store, mpin="4321")
    lot = await _create_lot(client, farmer_token)

    missing = await client.post(
        "/v1/leads", json={"lotId": lot["id"], "termsAccepted": True}, headers=_auth(buyer_token)
    )
    assert missing.status_code == 401
    assert missing.json()["error"]["code"] == "WRONG_MPIN"

    wrong = await client.post(
        "/v1/leads",
        json={"lotId": lot["id"], "termsAccepted": True, "mpin": "0000"},
        headers=_auth(buyer_token),
    )
    assert wrong.status_code == 401
    assert wrong.json()["error"]["code"] == "WRONG_MPIN"

    ok = await client.post(
        "/v1/leads",
        json={"lotId": lot["id"], "termsAccepted": True, "mpin": "4321"},
        headers=_auth(buyer_token),
    )
    assert ok.status_code == 201


async def test_no_mpin_gate_when_buyer_has_none(client, user_store):
    farmer_token = await _farmer(client)
    buyer_token = await _buyer(client, user_store)  # no mpinHash on file
    lot = await _create_lot(client, farmer_token)
    resp = await client.post(
        "/v1/leads", json={"lotId": lot["id"], "termsAccepted": True}, headers=_auth(buyer_token)
    )
    assert resp.status_code == 201


async def test_own_lot_forbidden(client, user_store):
    farmer_token = await _farmer(client)
    lot = await _create_lot(client, farmer_token)
    resp = await client.post(
        "/v1/leads", json={"lotId": lot["id"], "termsAccepted": True}, headers=_auth(farmer_token)
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "OWN_LOT"


async def test_closed_lot_rejected(client, user_store):
    farmer_token = await _farmer(client)
    buyer_token = await _buyer(client, user_store)
    lot = await _create_lot(client, farmer_token)
    await client.delete(f"/v1/market/lots/{lot['id']}", headers=_auth(farmer_token))
    resp = await client.post(
        "/v1/leads", json={"lotId": lot["id"], "termsAccepted": True}, headers=_auth(buyer_token)
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "LOT_NOT_OPEN"


async def test_repeat_contact_is_idempotent(client, user_store):
    farmer_token = await _farmer(client)
    buyer_token = await _buyer(client, user_store)
    lot = await _create_lot(client, farmer_token)
    first = await client.post(
        "/v1/leads", json={"lotId": lot["id"], "termsAccepted": True}, headers=_auth(buyer_token)
    )
    second = await client.post(
        "/v1/leads", json={"lotId": lot["id"], "termsAccepted": True}, headers=_auth(buyer_token)
    )
    assert first.status_code == 201
    assert second.status_code == 200
    assert second.json()["lead"]["id"] == first.json()["lead"]["id"]


async def test_leads_inbox_received_and_sent(client, user_store):
    farmer_token = await _farmer(client)
    buyer_token = await _buyer(client, user_store, name="Mahesh Agro")
    lot = await _create_lot(client, farmer_token, variety="Thompson")
    await client.post(
        "/v1/leads", json={"lotId": lot["id"], "termsAccepted": True}, headers=_auth(buyer_token)
    )

    received = await client.get("/v1/leads/mine", headers=_auth(farmer_token))
    assert received.status_code == 200
    rows = received.json()["data"]
    assert len(rows) == 1
    assert rows[0]["buyerContact"]["name"] == "Mahesh"
    assert rows[0]["farmerContact"]["name"] == "Ram"

    sent = await client.get("/v1/leads/mine?filter=sent", headers=_auth(buyer_token))
    srows = sent.json()["data"]
    assert len(srows) == 1
    assert srows[0]["farmerContact"]["phone"] == "+919812345678"


async def test_farmer_marks_lead_sold_and_lot_closes(client, user_store):
    farmer_token = await _farmer(client)
    buyer_token = await _buyer(client, user_store)
    lot = await _create_lot(client, farmer_token)
    lead = (
        await client.post(
            "/v1/leads", json={"lotId": lot["id"], "termsAccepted": True}, headers=_auth(buyer_token)
        )
    ).json()["lead"]

    contacted = await client.patch(
        f"/v1/leads/{lead['id']}", json={"status": "contacted"}, headers=_auth(farmer_token)
    )
    assert contacted.status_code == 200
    assert contacted.json()["status"] == "contacted"

    sold = await client.patch(
        f"/v1/leads/{lead['id']}", json={"status": "sold", "finalRate": 1950}, headers=_auth(farmer_token)
    )
    assert sold.status_code == 200
    assert sold.json()["finalRate"] == 1950
    closed = await client.get(f"/v1/market/lots/{lot['id']}", headers=_auth(farmer_token))
    assert closed.json()["status"] == "sold"
    assert closed.json()["finalRate"] == 1950
    # Buyer is told the lot is gone.
    notifs = [v for k, v in user_store.items() if k.startswith("notifications/")]
    assert any(n.get("type") == "lead_marked_sold" for n in notifs)


async def test_only_farmer_can_update_lead(client, user_store):
    farmer_token = await _farmer(client)
    buyer_token = await _buyer(client, user_store)
    lot = await _create_lot(client, farmer_token)
    lead = (
        await client.post(
            "/v1/leads", json={"lotId": lot["id"], "termsAccepted": True}, headers=_auth(buyer_token)
        )
    ).json()["lead"]
    resp = await client.patch(
        f"/v1/leads/{lead['id']}", json={"status": "sold"}, headers=_auth(buyer_token)
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "LEAD_NOT_FOUND"


async def test_mark_sold_endpoint_and_idempotency(client, user_store):
    farmer_token = await _farmer(client)
    lot = await _create_lot(client, farmer_token, variety="SoldViaButton")
    resp = await client.post(
        f"/v1/market/lots/{lot['id']}/mark-sold", json={"finalRate": 2100}, headers=_auth(farmer_token)
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "sold"
    assert resp.json()["finalRate"] == 2100
    again = await client.post(
        f"/v1/market/lots/{lot['id']}/mark-sold", json={"finalRate": 2100}, headers=_auth(farmer_token)
    )
    assert again.status_code == 200  # idempotent
    blocked = await client.delete(f"/v1/market/lots/{lot['id']}", headers=_auth(farmer_token))
    assert blocked.status_code == 409  # sold lots can't be withdrawn


async def test_browse_never_exposes_contact(client, user_store):
    farmer_token = await _farmer(client)
    buyer_token = await _buyer(client, user_store)
    lot = await _create_lot(client, farmer_token, village="Pimplas")
    resp = await client.get("/v1/market/lots/browse", params={"crop": "Tomato"}, headers=_auth(buyer_token))
    row = next(l for l in resp.json()["data"] if l["id"] == lot["id"])
    assert row["farmerName"] == "Ram"
    assert row["farmerVillage"] == "Pimplas"
    assert row.get("farmerContact") is None
    assert row.get("phone") is None


async def test_farmer_whatsapp_field_on_profile(client):
    token = await _farmer(client)
    resp = await client.put("/v1/users/me", json={"whatsapp": "9876543210"}, headers=_auth(token))
    assert resp.status_code == 200
    me = await client.get("/v1/users/me", headers=_auth(token))
    assert me.json()["whatsapp"] == "9876543210"
    # The registered farmer set an MPIN at onboarding — /users/me must say so
    # (the buyer-side lead popup reads this to require the MPIN step-up).
    assert me.json()["hasMpin"] is True
    bad = await client.put("/v1/users/me", json={"whatsapp": "123"}, headers=_auth(token))
    assert bad.status_code == 422


# ---- demand-sourced leads: farmer applies on an industrial buyer's demand ----

from tests.test_demands_offers import _create_demand  # noqa: E402
from tests.test_direct_buyer import _register_buyer, _seed_user  # noqa: E402

APPLY_BODY = {
    "pricePerUnit": 4600,
    "quantity": 25,
    "message": "Grade A cleaned, 50kg gunny bags",
    "termsAccepted": True,
    "mpin": "1234",
}


async def _buyer_with_demand(client, **demand_overrides):
    buyer_token = (await _register_buyer(client)).json()["accessToken"]
    demand = (await _create_demand(client, buyer_token, **demand_overrides)).json()
    return buyer_token, demand


def _applicant(user_store, uid="uid-f1", name="Ram Patel", mpin="1234"):
    """A distinct farmer applicant (seeded — the registered buyer already owns uid-1)."""
    extra = {"mpinHash": hash_mpin(mpin)} if mpin else {}
    return _seed_user(user_store, uid, name, **extra)


async def test_farmer_applies_on_demand_creates_lead(client, user_store):
    buyer_token, demand = await _buyer_with_demand(client, crop="Soybean")
    farmer_token = _applicant(user_store)

    resp = await client.post(
        "/v1/leads",
        json={**APPLY_BODY, "demandId": demand["id"]},
        headers=_auth(farmer_token),
    )
    assert resp.status_code == 201
    body = resp.json()
    lead = body["lead"]
    assert lead["source"] == "demand"
    assert lead["demandId"] == demand["id"]
    assert lead["demandCrop"] == "Soybean"
    assert lead["pricePerUnit"] == 4600
    assert lead["quantity"] == 25
    assert lead["message"] == "Grade A cleaned, 50kg gunny bags"
    assert lead["farmerId"] == "uid-f1"
    assert lead["buyerId"] == "uid-1"
    # Farmer's contact snapshot is revealed to the buyer, buyer's to the farmer.
    assert lead["farmerContact"]["name"] == "Ram"
    assert lead["farmerContact"]["phone"] == "+919876543210"
    assert lead["buyerContact"]["fullName"]
    # Direct chat room opened with the lead context line.
    assert body["chatRoomId"].startswith("dm_")
    msgs = [v for k, v in user_store.items() if k.startswith(f"chat_rooms/{body['chatRoomId']}/messages/")]
    assert len(msgs) == 1
    assert "Farmer Lead" in msgs[0]["text"] and "Soybean" in msgs[0]["text"]
    # Buyer notified.
    notifs = [v for k, v in user_store.items() if k.startswith("notifications/")]
    assert any(n.get("type") == "farmer_lead_received" for n in notifs)

    # Buyer desk: the application shows as a farmer lead; lot-source filter hides it.
    sent = await client.get("/v1/leads/mine?filter=sent&source=demand", headers=_auth(buyer_token))
    assert sent.status_code == 200
    rows = sent.json()["data"]
    assert len(rows) == 1
    assert rows[0]["id"] == lead["id"]
    lot_view = await client.get("/v1/leads/mine?filter=sent&source=lot", headers=_auth(buyer_token))
    assert lot_view.json()["data"] == []


async def test_demand_apply_requires_terms_and_mpin(client, user_store):
    buyer_token, demand = await _buyer_with_demand(client)
    farmer_token = _applicant(user_store)

    no_terms = await client.post(
        "/v1/leads",
        json={**APPLY_BODY, "demandId": demand["id"], "termsAccepted": False},
        headers=_auth(farmer_token),
    )
    assert no_terms.status_code == 422
    assert no_terms.json()["error"]["code"] == "TERMS_REQUIRED"

    no_mpin = await client.post(
        "/v1/leads",
        json={**APPLY_BODY, "demandId": demand["id"], "mpin": None},
        headers=_auth(farmer_token),
    )
    assert no_mpin.status_code == 401
    assert no_mpin.json()["error"]["code"] == "WRONG_MPIN"

    wrong_mpin = await client.post(
        "/v1/leads",
        json={**APPLY_BODY, "demandId": demand["id"], "mpin": "0000"},
        headers=_auth(farmer_token),
    )
    assert wrong_mpin.status_code == 401
    assert wrong_mpin.json()["error"]["code"] == "WRONG_MPIN"

    ok = await client.post(
        "/v1/leads",
        json={**APPLY_BODY, "demandId": demand["id"]},
        headers=_auth(farmer_token),
    )
    assert ok.status_code == 201


async def test_demand_apply_missing_quote_fields(client, user_store):
    buyer_token, demand = await _buyer_with_demand(client)
    farmer_token = _applicant(user_store)
    resp = await client.post(
        "/v1/leads",
        json={"demandId": demand["id"], "termsAccepted": True, "mpin": "1234"},
        headers=_auth(farmer_token),
    )
    assert resp.status_code == 422


async def test_demand_apply_guards_and_idempotency(client, user_store):
    buyer_token, demand = await _buyer_with_demand(client)
    farmer_token = _applicant(user_store)

    neither = await client.post("/v1/leads", json={**APPLY_BODY}, headers=_auth(farmer_token))
    assert neither.status_code == 422

    first = await client.post(
        "/v1/leads", json={**APPLY_BODY, "demandId": demand["id"]}, headers=_auth(farmer_token)
    )
    assert first.status_code == 201
    second = await client.post(
        "/v1/leads", json={**APPLY_BODY, "demandId": demand["id"]}, headers=_auth(farmer_token)
    )
    assert second.status_code == 200
    assert second.json()["lead"]["id"] == first.json()["lead"]["id"]

    # A seller can post demands too — applying on your own demand is forbidden.
    seller_token = _seed_user(user_store, "uid-s1", "Vijay Vyapari", active="seller")
    own_demand = (await _create_demand(client, seller_token, crop="Wheat")).json()
    own = await client.post(
        "/v1/leads",
        json={**APPLY_BODY, "demandId": own_demand["id"]},
        headers=_auth(seller_token),
    )
    assert own.status_code == 403
    assert own.json()["error"]["code"] == "OWN_DEMAND"

    # Closed demands reject new applications (same contract as closed lots).
    await client.post(f"/v1/demands/{demand['id']}/close", headers=_auth(buyer_token))
    rejected = await client.post(
        "/v1/leads",
        json={**APPLY_BODY, "demandId": demand["id"]},
        headers=_auth(_applicant(user_store, uid="uid-f9", name="Sham Rao", mpin=None)),
    )
    assert rejected.status_code == 409
    assert rejected.json()["error"]["code"] == "DEMAND_CLOSED"
