"""Exporter module: persona registration, RFQs, quotes, quote-accept trade flow,
export orders (status/shipment/documents/finance), suppliers, analytics,
permissions, and calls/chat integration."""

from datetime import date, timedelta

from app.services.tokens import create_access_token
from tests.test_users import _auth, _register

WINDOW = {
    "from": (date.today() + timedelta(days=5)).isoformat(),
    "to": (date.today() + timedelta(days=20)).isoformat(),
}
READY_DATE = (date.today() + timedelta(days=7)).isoformat()
PAST_DATE = (date.today() - timedelta(days=1)).isoformat()

RFQ_BODY = {
    "crop": "Onion",
    "variety": "Red",
    "quantityQuintals": 100,
    "maxRatePerQuintal": 2500,
    "deliveryWindow": WINDOW,
    "deliveryLocation": "Nhava Sheva Port, Mumbai",
    "paymentTermsDays": 30,
    "notes": "Export grade",
}

EXPORTER_PROFILE = {"companyName": "Agro Exports Pvt Ltd", "iecNumber": "IEC1234567"}


async def _exporter_token(client):
    resp = await _register(
        client,
        name="Esha Exporter",
        profiles=["exporter"],
        primaryProfile="exporter",
        roleProfiles={"exporter": EXPORTER_PROFILE},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["accessToken"]


def _seed_user(user_store, uid, name, active="seller", **extra):
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


_RFQ_SEQ = 0


async def _create_rfq(client, token, idempotency_key=None, **overrides):
    global _RFQ_SEQ
    _RFQ_SEQ += 1
    body = {**RFQ_BODY, **overrides}
    key = idempotency_key or f"rfq-auto-{_RFQ_SEQ}"
    return await client.post(
        "/v1/exporter/rfqs", json=body, headers={**_auth(token), "Idempotency-Key": key}
    )


async def _post_quote(client, token, rfq_id, rate=2000, qty=60, **overrides):
    body = {
        "ratePerQuintal": rate,
        "availableQuintals": qty,
        "pickupLocation": "Nashik",
        "readyDate": READY_DATE,
        **overrides,
    }
    return await client.post(f"/v1/exporter/rfqs/{rfq_id}/quotes", json=body, headers=_auth(token))


# ==========================================
# TASK 0 — persona plumbing
# ==========================================


async def test_exporter_registration_role_profile_and_kyc(client, user_store):
    await client.post("/v1/auth/firebase-verify", json={"idToken": "x"})
    resp = await client.post(
        "/v1/auth/register",
        json={
            "idToken": "x",
            "name": "Esha Exporter",
            "phone": "+919812345678",
            "state": "Maharashtra",
            "district": "Mumbai",
            "tehsil": "Andheri",
            "village": "Juhu",
            "landAreaAcres": 0,
            "soilType": "",
            "irrigationType": "",
            "crops": [],
            "mpin": "1234",
            "profiles": ["exporter"],
            "primaryProfile": "exporter",
            "roleProfiles": {"exporter": EXPORTER_PROFILE},
        },
    )
    assert resp.status_code == 200, resp.text
    user = resp.json()["user"]
    assert user["linkedProfiles"] == ["exporter"]
    assert user["activeProfile"] == "exporter"
    token = resp.json()["accessToken"]

    # activation endpoint works for the exporter persona
    activated = await client.post(
        "/v1/users/me/profiles/exporter/activate", headers=_auth(token)
    )
    assert activated.status_code == 200

    # role profile save via the persona-setup endpoint (validated model)
    saved = await client.put(
        "/v1/users/me/persona-setup",
        json={
            "profiles": [],
            "roleProfiles": {"exporter": {**EXPORTER_PROFILE, "gstNumber": "27ABCDE1234F1Z5"}},
        },
        headers=_auth(token),
    )
    assert saved.status_code == 200, saved.text
    role_profiles = saved.json()["roleProfiles"]
    assert role_profiles["exporter"]["companyName"] == "Agro Exports Pvt Ltd"
    assert role_profiles["exporter"]["iecNumber"] == "IEC1234567"
    assert role_profiles["exporter"]["gstNumber"] == "27ABCDE1234F1Z5"

    # exporter persona KYC matrix: IEC + APEDA + GST on top of the base docs
    case = await client.post(
        "/v1/kyc/cases",
        json={
            "persona": "exporter",
            "docs": [{"type": "iec"}, {"type": "apeda"}, {"type": "gst"}],
        },
        headers=_auth(token),
    )
    assert case.status_code == 201, case.text
    required = case.json()["requiredDocs"]
    for doc_type in ("iec", "apeda", "gst"):
        assert doc_type in required
    stored = user_store["kyc_cases/kyc_uid-1_exporter"]
    assert stored["persona"] == "exporter"
    assert {d["type"] for d in stored["docs"]} == {"iec", "apeda", "gst"}

    # documents outside the exporter matrix are rejected
    bad = await client.post(
        "/v1/kyc/cases",
        json={"persona": "exporter", "docs": [{"type": "rc"}]},
        headers=_auth(token),
    )
    assert bad.status_code == 422
    assert bad.json()["error"]["code"] == "INVALID_DOCUMENT_MATRIX"


# ==========================================
# RFQs
# ==========================================


async def test_rfq_create_validation_and_idempotent_replay(client, user_store):
    token = await _exporter_token(client)

    missing_key = await client.post("/v1/exporter/rfqs", json=RFQ_BODY, headers=_auth(token))
    assert missing_key.status_code == 400
    assert missing_key.json()["error"]["code"] == "IDEMPOTENCY_KEY_REQUIRED"

    created = await _create_rfq(client, token, idempotency_key="rfq-replay")
    assert created.status_code == 201, created.text
    rfq = created.json()
    assert rfq["id"].startswith("erq_")
    assert rfq["status"] == "open"
    assert rfq["fulfilledQuintals"] == 0.0
    assert rfq["exporterId"] == "uid-1"
    assert rfq["deliveryWindow"]["from"] == WINDOW["from"]

    # replay returns the same RFQ without creating a second doc
    replayed = await _create_rfq(client, token, idempotency_key="rfq-replay")
    assert replayed.status_code == 201
    assert replayed.json()["id"] == rfq["id"]
    all_rfqs = [k for k in user_store if k.startswith("export_rfqs/")]
    assert len(all_rfqs) == 1

    # window from > to
    bad_window = await _create_rfq(
        client,
        token,
        deliveryWindow={"from": WINDOW["to"], "to": WINDOW["from"]},
        idempotency_key="rfq-key-2",
    )
    assert bad_window.status_code == 422
    assert "deliveryWindow" in bad_window.json()["error"]["fieldErrors"]

    # non-positive quantity / bad payment terms fail pydantic validation
    for overrides in ({"quantityQuintals": 0}, {"paymentTermsDays": 121}):
        resp = await client.post(
            "/v1/exporter/rfqs",
            json={**RFQ_BODY, **overrides},
            headers={**_auth(token), "Idempotency-Key": f"rfq-key-{overrides}"},
        )
        assert resp.status_code == 422


async def test_rfq_create_notifies_stock_matched_sellers(client, user_store):
    token = await _exporter_token(client)
    seller1 = _seed_user(user_store, "uid-s1", "Suresh Seller")
    seller2 = _seed_user(user_store, "uid-s2", "Sonal Seller")
    _seed_user(user_store, "uid-f1", "Farmer F1", active="farmer")

    # seller1 holds matching Onion stock; seller2 holds a different crop
    stock = await client.post(
        "/v1/seller/stock",
        json={"crop": "Onion", "quantityQuintals": 50, "ratePerQuintal": 1800},
        headers=_auth(seller1),
    )
    assert stock.status_code == 201
    other = await client.post(
        "/v1/seller/stock",
        json={"crop": "Wheat", "quantityQuintals": 50, "ratePerQuintal": 2200},
        headers=_auth(seller2),
    )
    assert other.status_code == 201

    created = await _create_rfq(client, token)
    assert created.status_code == 201

    notes1 = _notifications_for(user_store, "uid-s1", "rfq_matched")
    assert len(notes1) == 1
    assert notes1[0]["data"]["deepLink"] == "/dashboard/p/seller/export-rfqs"
    assert "Onion" in notes1[0]["body"]
    # no Onion stock → no ping; farmers are never pinged
    assert _notifications_for(user_store, "uid-s2", "rfq_matched") == []
    assert _notifications_for(user_store, "uid-f1", "rfq_matched") == []

    # a second RFQ for the same crop pings the same seller once more (no dedupe across RFQs)
    second = await _create_rfq(client, token, idempotency_key="rfq-key-3")
    assert second.status_code == 201
    assert len(_notifications_for(user_store, "uid-s1", "rfq_matched")) == 2


async def test_rfq_list_detail_close_reopen_delete_and_permissions(client, user_store):
    token = await _exporter_token(client)
    other = _seed_user(user_store, "uid-e2", "Other Exporter", active="exporter")
    farmer_tok = _seed_user(user_store, "uid-f1", "Farmer F1", active="farmer")

    created = await _create_rfq(client, token)
    rfq_id = created.json()["id"]

    # farmer and non-exporter roles are gated off the exporter surface
    farmer_list = await client.get("/v1/exporter/rfqs", headers=_auth(farmer_tok))
    assert farmer_list.status_code == 403
    assert farmer_list.json()["error"]["code"] == "FORBIDDEN_ROLE"

    listed = await client.get("/v1/exporter/rfqs", headers=_auth(token))
    assert listed.status_code == 200
    assert listed.json()["total"] == 1
    assert listed.json()["data"][0]["quoteCount"] == 0

    # other exporter cannot read the RFQ
    denied = await client.get(f"/v1/exporter/rfqs/{rfq_id}", headers=_auth(other))
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "RFQ_FORBIDDEN"

    detail = await client.get(f"/v1/exporter/rfqs/{rfq_id}", headers=_auth(token))
    assert detail.status_code == 200
    summary = detail.json()["quotesSummary"]
    assert summary["count"] == 0
    assert summary["bestRate"] is None

    # close → reopen → close → delete
    closed = await client.post(f"/v1/exporter/rfqs/{rfq_id}/close", headers=_auth(token))
    assert closed.status_code == 200
    assert closed.json()["status"] == "closed"
    assert closed.json()["closedAt"]
    again = await client.post(f"/v1/exporter/rfqs/{rfq_id}/close", headers=_auth(token))
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "RFQ_NOT_OPEN"

    reopened = await client.post(f"/v1/exporter/rfqs/{rfq_id}/reopen", headers=_auth(token))
    assert reopened.status_code == 200
    assert reopened.json()["status"] == "open"
    assert reopened.json()["closedAt"] is None
    reopen_open = await client.post(f"/v1/exporter/rfqs/{rfq_id}/reopen", headers=_auth(token))
    assert reopen_open.status_code == 409
    assert reopen_open.json()["error"]["code"] == "RFQ_NOT_CLOSED"

    # delete is allowed only while open
    missing = await client.delete("/v1/exporter/rfqs/erq_nope", headers=_auth(token))
    assert missing.status_code == 404
    deleted = await client.delete(f"/v1/exporter/rfqs/{rfq_id}", headers=_auth(token))
    assert deleted.status_code == 204
    assert f"export_rfqs/{rfq_id}" not in user_store

    closed2 = await _create_rfq(client, token, idempotency_key="rfq-key-4")
    rfq2 = closed2.json()["id"]
    await client.post(f"/v1/exporter/rfqs/{rfq2}/close", headers=_auth(token))
    del_closed = await client.delete(f"/v1/exporter/rfqs/{rfq2}", headers=_auth(token))
    assert del_closed.status_code == 409
    assert del_closed.json()["error"]["code"] == "RFQ_NOT_OPEN"

    # status filter
    filtered = await client.get(
        "/v1/exporter/rfqs", params={"status": "open"}, headers=_auth(token)
    )
    assert filtered.json()["total"] == 0


async def test_rfq_browse_for_sellers_with_summary(client, user_store):
    token = await _exporter_token(client)
    seller_tok = _seed_user(user_store, "uid-s1", "Suresh Seller")
    farmer_tok = _seed_user(user_store, "uid-f1", "Farmer F1", active="farmer")

    created = await _create_rfq(client, token)
    rfq_id = created.json()["id"]

    # farmer cannot browse export RFQs
    farmer_view = await client.get("/v1/exporter/rfqs/browse", headers=_auth(farmer_tok))
    assert farmer_view.status_code == 403

    browsed = await client.get("/v1/exporter/rfqs/browse", headers=_auth(seller_tok))
    assert browsed.status_code == 200
    entries = browsed.json()["data"]
    assert len(entries) == 1
    entry = entries[0]
    assert entry["id"] == rfq_id
    assert entry["exporter"]["exporterId"] == "uid-1"
    assert entry["exporter"]["name"] == "Esha Exporter"
    assert entry["exporter"]["companyName"] == "Agro Exports Pvt Ltd"
    assert entry["exporter"]["verified"] is False

    # verified KYC case flips the summary flag
    user_store["kyc_cases/kyc_uid-1_ex_exporter"] = {
        "caseId": "kyc_uid-1_ex_exporter",
        "userId": "uid-1",
        "persona": "exporter",
        "status": "verified",
        "submittedAt": "2026-10-01T00:00:00+00:00",
        "docs": [],
    }
    verified_view = await client.get("/v1/exporter/rfqs/browse", headers=_auth(seller_tok))
    assert verified_view.json()["data"][0]["exporter"]["verified"] is True

    # filters
    by_crop = await client.get(
        "/v1/exporter/rfqs/browse", params={"crop": "oni"}, headers=_auth(seller_tok)
    )
    assert by_crop.json()["total"] == 1
    by_loc = await client.get(
        "/v1/exporter/rfqs/browse",
        params={"deliveryLocation": "nhava"},
        headers=_auth(seller_tok),
    )
    assert by_loc.json()["total"] == 1
    over_budget = await client.get(
        "/v1/exporter/rfqs/browse", params={"minRate": 3000}, headers=_auth(seller_tok)
    )
    assert over_budget.json()["total"] == 0
    within_budget = await client.get(
        "/v1/exporter/rfqs/browse", params={"minRate": 2000}, headers=_auth(seller_tok)
    )
    assert within_budget.json()["total"] == 1


# ==========================================
# QUOTES
# ==========================================


async def test_quote_create_repost_board_and_reject(client, user_store):
    token = await _exporter_token(client)
    seller1 = _seed_user(user_store, "uid-s1", "Suresh Seller")
    seller2 = _seed_user(user_store, "uid-s2", "Sonal Seller")
    outsider = _seed_user(user_store, "uid-s3", "Random Seller")

    rfq_id = (await _create_rfq(client, token)).json()["id"]

    # only sellers quote; farmers/exporters cannot
    farmer_tok = _seed_user(user_store, "uid-f1", "Farmer F1", active="farmer")
    farmer_quote = await _post_quote(client, farmer_tok, rfq_id)
    assert farmer_quote.status_code == 403
    exporter_quote = await _post_quote(client, token, rfq_id)
    assert exporter_quote.status_code == 403

    # readyDate in the past is rejected
    stale = await _post_quote(client, seller1, rfq_id, readyDate=PAST_DATE)
    assert stale.status_code == 422
    assert "readyDate" in stale.json()["error"]["fieldErrors"]

    created = await _post_quote(client, seller1, rfq_id, rate=2000, qty=60)
    assert created.status_code == 201, created.text
    quote1 = created.json()
    assert quote1["id"].startswith("exq_")
    assert quote1["status"] == "pending"
    assert quote1["exporterId"] == "uid-1"
    assert quote1["sellerId"] == "uid-s1"
    assert quote1["chatRoomId"].startswith("dm_")

    # exporter got pinged with the per-RFQ deep link
    notes = _notifications_for(user_store, "uid-1", "quote_received")
    assert len(notes) == 1
    assert notes[0]["data"]["deepLink"] == f"/dashboard/p/exporter/rfqs/{rfq_id}"

    # re-POST by the same seller updates the pending quote instead of duplicating
    updated = await _post_quote(client, seller1, rfq_id, rate=1900, qty=70)
    assert updated.status_code == 201
    assert updated.json()["id"] == quote1["id"]
    assert updated.json()["ratePerQuintal"] == 1900
    assert updated.json()["availableQuintals"] == 70
    assert len([k for k in user_store if k.startswith("export_quotes/")]) == 1

    quote2 = (await _post_quote(client, seller2, rfq_id, rate=1800, qty=60)).json()

    # a non-owner exporter cannot read the board
    other_exporter = _seed_user(user_store, "uid-e2", "Other Exporter", active="exporter")
    denied = await client.get(f"/v1/exporter/rfqs/{rfq_id}/quotes", headers=_auth(other_exporter))
    assert denied.status_code == 403

    board = await client.get(f"/v1/exporter/rfqs/{rfq_id}/quotes", headers=_auth(token))
    assert board.status_code == 200
    analytics = board.json()["analytics"]
    assert analytics["count"] == 2
    assert analytics["bestRate"] == 1800
    assert analytics["avgRate"] == 1850
    assert analytics["totalAvailableQty"] == 130
    assert analytics["bestQuoteId"] == quote2["id"]
    # cheapest way to cover 100 q: 60 @1800 + 40 @1900
    assert analytics["cheapestFullQtyCost"] == 60 * 1800 + 40 * 1900

    # seller quote list carries the RFQ summary
    mine = await client.get("/v1/exporter/quotes/mine", headers=_auth(seller1))
    assert mine.status_code == 200
    mine_entry = mine.json()["data"][0]
    assert mine_entry["rfq"]["crop"] == "Onion"
    assert mine_entry["rfq"]["quantityQuintals"] == 100
    assert mine_entry["rfq"]["deliveryLocation"] == RFQ_BODY["deliveryLocation"]
    assert mine_entry["rfq"]["deliveryWindow"]["from"] == WINDOW["from"]
    stranger_mine = await client.get("/v1/exporter/quotes/mine", headers=_auth(outsider))
    assert stranger_mine.json()["total"] == 0

    # reject quote2 as the exporter
    rejected = await client.post(f"/v1/exporter/quotes/{quote2['id']}/reject", headers=_auth(token))
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "rejected"
    again = await client.post(f"/v1/exporter/quotes/{quote2['id']}/reject", headers=_auth(token))
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "QUOTE_NOT_PENDING"
    seller_reject = await client.post(
        f"/v1/exporter/quotes/{quote1['id']}/reject", headers=_auth(seller1)
    )
    assert seller_reject.status_code == 403

    # quoting a closed RFQ is a 409
    rfq2_id = (await _create_rfq(client, token, idempotency_key="rfq-key-5")).json()["id"]
    await client.post(f"/v1/exporter/rfqs/{rfq2_id}/close", headers=_auth(token))
    closed_quote = await _post_quote(client, seller1, rfq2_id)
    assert closed_quote.status_code == 409
    assert closed_quote.json()["error"]["code"] == "RFQ_NOT_OPEN"


async def test_trade_flow_accept_partial_and_full_close(client, user_store):
    token = await _exporter_token(client)
    seller1 = _seed_user(user_store, "uid-s1", "Suresh Seller")
    seller2 = _seed_user(user_store, "uid-s2", "Sonal Seller")
    seller3 = _seed_user(user_store, "uid-s3", "Sandy Seller")

    rfq_id = (await _create_rfq(client, token)).json()["id"]
    quote1 = (await _post_quote(client, seller1, rfq_id, rate=1900, qty=70)).json()
    quote2 = (await _post_quote(client, seller2, rfq_id, rate=1800, qty=60)).json()
    quote3 = (await _post_quote(client, seller3, rfq_id, rate=1700, qty=10)).json()

    # validation: over-accept and wrong exporter
    over = await client.post(
        f"/v1/exporter/quotes/{quote1['id']}/accept",
        json={"quantityQuintals": 71},
        headers={**_auth(token), "Idempotency-Key": "acc-x"},
    )
    assert over.status_code == 422
    other_exporter = _seed_user(user_store, "uid-e2", "Other Exporter", active="exporter")
    wrong_exporter = await client.post(
        f"/v1/exporter/quotes/{quote1['id']}/accept",
        json={},
        headers={**_auth(other_exporter), "Idempotency-Key": "acc-y"},
    )
    assert wrong_exporter.status_code == 403
    no_key = await client.post(
        f"/v1/exporter/quotes/{quote1['id']}/accept", json={}, headers=_auth(token)
    )
    assert no_key.status_code == 400
    assert no_key.json()["error"]["code"] == "IDEMPOTENCY_KEY_REQUIRED"

    # partial accept of quote1: 40 of 70 available
    accepted = await client.post(
        f"/v1/exporter/quotes/{quote1['id']}/accept",
        json={"quantityQuintals": 40},
        headers={**_auth(token), "Idempotency-Key": "acc-1"},
    )
    assert accepted.status_code == 201, accepted.text
    payload = accepted.json()
    purchase = payload["purchase"]
    order = payload["order"]
    assert purchase["buyerId"] == "uid-1"
    assert purchase["farmerId"] == "uid-s1"
    assert purchase["farmerName"] == "Suresh Seller"
    assert purchase["crop"] == "Onion"
    assert purchase["quantity"] == 40
    assert purchase["agreedPricePerUnit"] == 1900
    assert purchase["totalAmount"] == 76000
    assert purchase["source"] == {"type": "export_quote", "refId": quote1["id"]}
    assert purchase["status"] == "confirmed"
    assert purchase["payments"] == []
    assert user_store[f"chat_rooms/{purchase['id']}"]["kind"] == "purchase"

    assert order["id"].startswith("exo_")
    assert order["exporterId"] == "uid-1"
    assert order["title"] == "Onion export order"
    assert order["status"] == "confirmed"
    assert order["totals"] == {"totalQuintals": 40.0, "totalValue": 76000}
    line = order["lines"][0]
    assert line["purchaseId"] == purchase["id"]
    assert line["sellerId"] == "uid-s1"
    assert line["crop"] == "Onion"
    assert line["quantityQuintals"] == 40
    assert line["ratePerQuintal"] == 1900
    assert line["lineValue"] == 76000
    assert line["purchaseStatus"] == "confirmed"

    assert payload["quote"]["status"] == "accepted"

    # seller notified with deep link to the purchase
    notes = _notifications_for(user_store, "uid-s1", "quote_accepted")
    assert len(notes) == 1
    assert notes[0]["data"]["deepLink"] == f"/dashboard/p/purchases/{purchase['id']}"

    # RFQ stays open with partial fulfilment
    rfq = user_store[f"export_rfqs/{rfq_id}"]
    assert rfq["status"] == "open"
    assert rfq["fulfilledQuintals"] == 40.0

    # idempotent replay: same key returns the same purchase without side effects
    replayed = await client.post(
        f"/v1/exporter/quotes/{quote1['id']}/accept",
        json={"quantityQuintals": 40},
        headers={**_auth(token), "Idempotency-Key": "acc-1"},
    )
    assert replayed.status_code == 201
    assert replayed.json()["purchase"]["id"] == purchase["id"]
    assert user_store[f"export_rfqs/{rfq_id}"]["fulfilledQuintals"] == 40.0

    # accept quote1 again with a new key → 409 (no longer pending)
    repeat = await client.post(
        f"/v1/exporter/quotes/{quote1['id']}/accept",
        json={"quantityQuintals": 10},
        headers={**_auth(token), "Idempotency-Key": "acc-1b"},
    )
    assert repeat.status_code == 409
    assert repeat.json()["error"]["code"] == "QUOTE_NOT_PENDING"

    # accept the remainder from quote2, appended to the existing order
    rest = await client.post(
        f"/v1/exporter/quotes/{quote2['id']}/accept",
        json={"orderId": order["id"]},
        headers={**_auth(token), "Idempotency-Key": "acc-2"},
    )
    assert rest.status_code == 201, rest.text
    assert rest.json()["order"]["id"] == order["id"]
    assert len(rest.json()["order"]["lines"]) == 2
    assert rest.json()["order"]["totals"] == {
        "totalQuintals": 100.0,
        "totalValue": 76000 + 60 * 1800,
    }

    # RFQ fully fulfilled → closed; the sibling pending quote is withdrawn + pinged
    rfq = user_store[f"export_rfqs/{rfq_id}"]
    assert rfq["status"] == "closed"
    assert rfq["closedAt"]
    assert user_store[f"export_quotes/{quote3['id']}"]["status"] == "withdrawn"
    withdrawn_notes = _notifications_for(user_store, "uid-s3", "quote_withdrawn")
    assert len(withdrawn_notes) == 1

    # appending to another exporter's order is forbidden
    rfq2 = (await _create_rfq(client, token, idempotency_key="rfq-key-6")).json()["id"]
    q_other = (await _post_quote(client, seller3, rfq2, rate=1500, qty=5)).json()
    # foreign order doc (belongs to uid-e2)
    user_store["export_orders/exo_foreign"] = {
        "id": "exo_foreign",
        "exporterId": "uid-e2",
        "title": "Foreign",
        "status": "confirmed",
        "lines": [],
        "totals": {"totalQuintals": 0.0, "totalValue": 0},
        "documents": [],
        "remittances": [],
        "events": [],
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    foreign_append = await client.post(
        f"/v1/exporter/quotes/{q_other['id']}/accept",
        json={"orderId": "exo_foreign"},
        headers={**_auth(token), "Idempotency-Key": "acc-3"},
    )
    assert foreign_append.status_code == 403
    assert foreign_append.json()["error"]["code"] == "ORDER_FORBIDDEN"


# ==========================================
# CHAT + CALLS integration
# ==========================================


async def test_quote_chat_room_and_direct_branch_for_both_parties(client, user_store):
    token = await _exporter_token(client)
    seller1 = _seed_user(user_store, "uid-s1", "Suresh Seller")
    outsider = _seed_user(user_store, "uid-o1", "Outsider Olga", active="farmer")

    rfq_id = (await _create_rfq(client, token)).json()["id"]
    quote = (await _post_quote(client, seller1, rfq_id, rate=2000, qty=10)).json()
    room_id = quote["chatRoomId"]

    # room opens between the exporter and the seller around the quote
    for tok in (seller1, token):
        listed = await client.get("/v1/chat/rooms", headers=_auth(tok))
        assert listed.status_code == 200
        assert any(r["id"] == room_id for r in listed.json()["data"])

    # both parties can post (alternating senders stay clear of the per-sender gap limit)
    m1 = await client.post(
        f"/v1/chat/rooms/{room_id}/messages",
        json={"text": "quote still negotiable?"},
        headers=_auth(seller1),
    )
    assert m1.status_code == 201
    m2 = await client.post(
        f"/v1/chat/rooms/{room_id}/messages",
        json={"text": "yes, locked for the RFQ"},
        headers=_auth(token),
    )
    assert m2.status_code == 201

    # the quoteId branch of POST /chat/direct resolves both directions
    as_seller = await client.post(
        "/v1/chat/direct", json={"quoteId": quote["id"]}, headers=_auth(seller1)
    )
    assert as_seller.status_code == 200
    assert as_seller.json()["id"] == room_id
    as_exporter = await client.post(
        "/v1/chat/direct", json={"quoteId": quote["id"]}, headers=_auth(token)
    )
    assert as_exporter.status_code == 200
    assert as_exporter.json()["id"] == room_id

    # strangers and missing quotes are rejected
    stranger = await client.post(
        "/v1/chat/direct", json={"quoteId": quote["id"]}, headers=_auth(outsider)
    )
    assert stranger.status_code == 403
    assert stranger.json()["error"]["code"] == "QUOTE_FORBIDDEN"
    missing = await client.post(
        "/v1/chat/direct", json={"quoteId": "exq_nope"}, headers=_auth(token)
    )
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "QUOTE_NOT_FOUND"
    no_field = await client.post("/v1/chat/direct", json={}, headers=_auth(token))
    assert no_field.status_code == 422

    # call context "quote": exporter dials the seller; outsiders cannot
    call = await client.post(
        "/v1/calls",
        json={"toUserId": "uid-s1", "contextType": "quote", "contextId": quote["id"]},
        headers=_auth(token),
    )
    assert call.status_code == 201
    assert call.json()["call"]["contextType"] == "quote"
    blocked = await client.post(
        "/v1/calls",
        json={"toUserId": "uid-s1", "contextType": "quote", "contextId": quote["id"]},
        headers=_auth(outsider),
    )
    assert blocked.status_code == 403
    assert blocked.json()["error"]["code"] == "CALL_FORBIDDEN"


# ==========================================
# EXPORT ORDERS
# ==========================================


async def _order_with_line(client, user_store):
    """Exporter + one accepted quote → (tokens, rfq_id, quote_id, order, purchase)."""
    token = await _exporter_token(client)
    seller = _seed_user(user_store, "uid-s1", "Suresh Seller")
    rfq_id = (await _create_rfq(client, token)).json()["id"]
    quote = (await _post_quote(client, seller, rfq_id, rate=2000, qty=40)).json()
    accepted = await client.post(
        f"/v1/exporter/quotes/{quote['id']}/accept",
        json={},
        headers={**_auth(token), "Idempotency-Key": "acc-setup"},
    )
    payload = accepted.json()
    return {
        "exporter": token,
        "seller": seller,
        "seller_id": "uid-s1",
        "rfq_id": rfq_id,
        "quote_id": quote["id"],
        "order": payload["order"],
        "purchase": payload["purchase"],
    }


async def test_order_status_forward_only_and_cancel_rules(client, user_store):
    ctx = await _order_with_line(client, user_store)
    token = ctx["exporter"]
    order_id = ctx["order"]["id"]

    orders = await client.get("/v1/exporter/orders", headers=_auth(token))
    assert orders.status_code == 200
    assert orders.json()["total"] == 1

    # same-status repeat is rejected
    step = await client.post(
        f"/v1/exporter/orders/{order_id}/status",
        json={"status": "sourcing"},
        headers=_auth(token),
    )
    assert step.status_code == 200
    assert step.json()["status"] == "sourcing"

    again = await client.post(
        f"/v1/exporter/orders/{order_id}/status",
        json={"status": "sourcing"},
        headers=_auth(token),
    )
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "INVALID_ORDER_STATUS"

    # backwards moves are rejected
    backwards = await client.post(
        f"/v1/exporter/orders/{order_id}/status",
        json={"status": "confirmed"},
        headers=_auth(token),
    )
    assert backwards.status_code == 409
    assert backwards.json()["error"]["code"] == "INVALID_ORDER_STATUS"

    # skipping ahead along the flow is allowed (forward-only)
    skip = await client.post(
        f"/v1/exporter/orders/{order_id}/status",
        json={"status": "inTransit"},
        headers=_auth(token),
    )
    assert skip.status_code == 200
    assert skip.json()["status"] == "inTransit"
    # once inTransit, an earlier state is a conflict
    back_again = await client.post(
        f"/v1/exporter/orders/{order_id}/status",
        json={"status": "sourcing"},
        headers=_auth(token),
    )
    assert back_again.status_code == 409

    # once past sourcing the order can no longer be cancelled
    cancel_late = await client.post(
        f"/v1/exporter/orders/{order_id}/status",
        json={"status": "cancelled", "note": "too late"},
        headers=_auth(token),
    )
    assert cancel_late.status_code == 409

    # cancel allowed from confirmed/sourcing
    ctx_cancel = await _order_with_line(client, user_store)
    cancel_id = ctx_cancel["order"]["id"]
    cancelled = await client.post(
        f"/v1/exporter/orders/{cancel_id}/status",
        json={"status": "cancelled", "note": "buyer backed out"},
        headers=_auth(token),
    )
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"
    events = cancelled.json()["events"]
    assert events[-1]["action"] == "cancelled"
    assert events[-1]["note"] == "buyer backed out"

    # a fresh order: cancel is forbidden once packed
    ctx2 = await _order_with_line(client, user_store)
    # re-registering the same firebase uid is an upsert — same user,
    # a new order through a second accept.
    order2 = ctx2["order"]
    assert order2["id"] != order_id
    await client.post(
        f"/v1/exporter/orders/{order2['id']}/status",
        json={"status": "sourcing"},
        headers=_auth(token),
    )
    await client.post(
        f"/v1/exporter/orders/{order2['id']}/status",
        json={"status": "packed"},
        headers=_auth(token),
    )
    cancel_packed = await client.post(
        f"/v1/exporter/orders/{order2['id']}/status",
        json={"status": "cancelled"},
        headers=_auth(token),
    )
    assert cancel_packed.status_code == 409

    # pickedUp / shipped ping every line seller
    notify_ctx = await _order_with_line(client, user_store)
    order3 = notify_ctx["order"]
    for status in ("sourcing", "packed", "pickedUp"):
        moved = await client.post(
            f"/v1/exporter/orders/{order3['id']}/status",
            json={"status": status},
            headers=_auth(token),
        )
        assert moved.status_code == 200, moved.text
    status_notes = _notifications_for(user_store, "uid-s1", "order_status")
    assert len(status_notes) >= 1
    assert status_notes[0]["data"]["deepLink"] == "/dashboard/p/seller/orders"


async def test_shipment_block_and_event_auto_sync(client, user_store):
    ctx = await _order_with_line(client, user_store)
    token = ctx["exporter"]
    order_id = ctx["order"]["id"]

    # events require a shipment block first
    early = await client.post(
        f"/v1/exporter/orders/{order_id}/shipment/events",
        json={"event": "departed"},
        headers=_auth(token),
    )
    assert early.status_code == 409
    assert early.json()["error"]["code"] == "SHIPMENT_NOT_SET"

    bad_containers = await client.put(
        f"/v1/exporter/orders/{order_id}/shipment",
        json={
            "shippingLine": "Maersk",
            "containerType": "reefer",
            "containerNos": ["MSCU123", " "],
            "portOfLoading": "Nhava Sheva",
            "portOfDischarge": "Jebel Ali",
            "etd": "2099-01-01T00:00:00+00:00",
            "eta": "2099-02-01T00:00:00+00:00",
            "incoterm": "FOB",
        },
        headers=_auth(token),
    )
    assert bad_containers.status_code == 422

    shipment = await client.put(
        f"/v1/exporter/orders/{order_id}/shipment",
        json={
            "shippingLine": "Maersk",
            "containerType": "reefer",
            "containerNos": ["MSCU1234567"],
            "vessel": "Maersk Sindbad",
            "portOfLoading": "Nhava Sheva",
            "portOfDischarge": "Jebel Ali",
            "etd": "2099-01-01T00:00:00+00:00",
            "eta": "2099-02-01T00:00:00+00:00",
            "incoterm": "FOB",
        },
        headers=_auth(token),
    )
    assert shipment.status_code == 200, shipment.text
    assert shipment.json()["shipment"]["containerNos"] == ["MSCU1234567"]
    assert shipment.json()["shipment"]["events"] == []

    # replacing the block keeps logged events
    await client.post(
        f"/v1/exporter/orders/{order_id}/shipment/events",
        json={"event": "gateIn", "location": "Nhava Sheva"},
        headers=_auth(token),
    )
    replaced = await client.put(
        f"/v1/exporter/orders/{order_id}/shipment",
        json={
            "shippingLine": "CMA CGM",
            "containerType": "dry",
            "containerNos": ["CMAU7654321"],
            "portOfLoading": "Nhava Sheva",
            "portOfDischarge": "Jebel Ali",
        },
        headers=_auth(token),
    )
    assert replaced.status_code == 200
    assert replaced.json()["shipment"]["shippingLine"] == "CMA CGM"
    assert len(replaced.json()["shipment"]["events"]) == 1
    assert replaced.json()["shipment"]["events"][0]["event"] == "gateIn"

    # departed auto-syncs inTransit; cleared → customsCleared; delivered → delivered
    departed = await client.post(
        f"/v1/exporter/orders/{order_id}/shipment/events",
        json={"event": "departed", "location": "Nhava Sheva", "note": "vessel sailed"},
        headers=_auth(token),
    )
    assert departed.status_code == 200
    assert departed.json()["status"] == "inTransit"

    cleared = await client.post(
        f"/v1/exporter/orders/{order_id}/shipment/events",
        json={"event": "cleared"},
        headers=_auth(token),
    )
    assert cleared.json()["status"] == "customsCleared"

    delivered = await client.post(
        f"/v1/exporter/orders/{order_id}/shipment/events",
        json={"event": "delivered"},
        headers=_auth(token),
    )
    assert delivered.json()["status"] == "delivered"

    # shipment locked after delivery
    after = await client.put(
        f"/v1/exporter/orders/{order_id}/shipment",
        json={
            "shippingLine": "X",
            "containerType": "dry",
            "containerNos": ["X1"],
            "portOfLoading": "A",
            "portOfDischarge": "B",
        },
        headers=_auth(token),
    )
    assert after.status_code == 409


async def test_order_documents_checklist_and_delete(client, user_store):
    ctx = await _order_with_line(client, user_store)
    token = ctx["exporter"]
    order_id = ctx["order"]["id"]

    required = [
        "phytosanitary",
        "fumigation",
        "commercialInvoice",
        "packingList",
        "certificateOfOrigin",
        "healthCertificate",
    ]

    listed = await client.get(f"/v1/exporter/orders/{order_id}/documents", headers=_auth(token))
    assert listed.status_code == 200
    assert listed.json()["checklist"] == {
        "required": required,
        "uploaded": [],
        "missing": required,
    }

    uploaded = await client.post(
        f"/v1/exporter/orders/{order_id}/documents",
        json={"docType": "phytosanitary", "number": "PHY-1", "url": "https://files/phy.pdf"},
        headers=_auth(token),
    )
    assert uploaded.status_code == 201
    doc = uploaded.json()
    assert doc["id"].startswith("doc_")
    assert doc["uploadedAt"]

    listed = await client.get(f"/v1/exporter/orders/{order_id}/documents", headers=_auth(token))
    checklist = listed.json()["checklist"]
    assert checklist["uploaded"] == ["phytosanitary"]
    assert checklist["missing"] == [d for d in required if d != "phytosanitary"]

    # billOfLading is a valid upload but not on the required checklist
    await client.post(
        f"/v1/exporter/orders/{order_id}/documents",
        json={"docType": "billOfLading", "url": "https://files/bl.pdf"},
        headers=_auth(token),
    )
    listed = await client.get(f"/v1/exporter/orders/{order_id}/documents", headers=_auth(token))
    assert len(listed.json()["data"]) == 2
    assert listed.json()["checklist"]["uploaded"] == ["billOfLading", "phytosanitary"]
    assert listed.json()["checklist"]["missing"] == [
        d for d in required if d != "phytosanitary"
    ]

    # line seller can read documents; random user cannot
    as_seller = await client.get(
        f"/v1/exporter/orders/{order_id}/documents", headers=_auth(ctx["seller"])
    )
    assert as_seller.status_code == 200
    outsider = _seed_user(user_store, "uid-o1", "Outsider", active="farmer")
    denied = await client.get(
        f"/v1/exporter/orders/{order_id}/documents", headers=_auth(outsider)
    )
    assert denied.status_code == 403

    missing_del = await client.delete(
        f"/v1/exporter/orders/{order_id}/documents/doc_nope", headers=_auth(token)
    )
    assert missing_del.status_code == 404
    assert missing_del.json()["error"]["code"] == "DOCUMENT_NOT_FOUND"

    deleted = await client.delete(
        f"/v1/exporter/orders/{order_id}/documents/{doc['id']}", headers=_auth(token)
    )
    assert deleted.status_code == 204
    listed = await client.get(f"/v1/exporter/orders/{order_id}/documents", headers=_auth(token))
    assert listed.json()["checklist"]["uploaded"] == ["billOfLading"]


async def test_order_finance_lc_remittances_and_seller_sanitized_view(client, user_store):
    ctx = await _order_with_line(client, user_store)
    token = ctx["exporter"]
    seller = ctx["seller"]
    order_id = ctx["order"]["id"]
    purchase_id = ctx["purchase"]["id"]

    # owner sees financeSummary on the order; seller gets a sanitized view
    owner_view = await client.get(f"/v1/exporter/orders/{order_id}", headers=_auth(token))
    assert owner_view.status_code == 200
    assert "financeSummary" in owner_view.json()
    assert owner_view.json()["documentsChecklist"]["missing"]

    seller_view = await client.get(f"/v1/exporter/orders/{order_id}", headers=_auth(seller))
    assert seller_view.status_code == 200
    assert "lc" not in seller_view.json()
    assert "remittances" not in seller_view.json()
    assert "financeSummary" not in seller_view.json()
    assert seller_view.json()["lines"][0]["sellerId"] == "uid-s1"

    outsider = _seed_user(user_store, "uid-o1", "Outsider", active="farmer")
    denied = await client.get(f"/v1/exporter/orders/{order_id}", headers=_auth(outsider))
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "ORDER_FORBIDDEN"

    # finance: advance through the purchases rail counts as supplier payment
    advance = await client.post(
        f"/v1/purchases/{purchase_id}/advance",
        json={"amount": 20000, "method": "upi", "reference": "adv-1"},
        headers=_auth(token),
    )
    assert advance.status_code == 200, advance.text
    assert advance.json()["advancePaid"] == 20000

    finance = await client.get(f"/v1/exporter/orders/{order_id}/finance", headers=_auth(token))
    assert finance.status_code == 200
    body = finance.json()
    assert body["orderValue"] == 80000
    assert body["supplierPaid"] == 20000
    assert body["supplierDue"] == 60000
    assert body["platformFees"] == 0  # no completed purchase lines yet
    assert body["lc"] is None
    assert body["remittances"] == []
    assert body["remittanceTotal"] == 0
    assert body["balanceVsRemittances"] == 80000

    # seller is locked out of finance entirely
    seller_finance = await client.get(
        f"/v1/exporter/orders/{order_id}/finance", headers=_auth(seller)
    )
    assert seller_finance.status_code == 403

    # LC (re-submittable) + remittance
    lc = await client.post(
        f"/v1/exporter/orders/{order_id}/lc",
        json={
            "lcNumber": "LC-2026-001",
            "issuingBank": "HDFC Bank",
            "amount": 90000,
            "expiryDate": "2099-12-31",
        },
        headers=_auth(token),
    )
    assert lc.status_code == 200
    assert lc.json()["status"] == "confirmed"
    assert lc.json()["currency"] == "USD"

    bad_lc = await client.post(
        f"/v1/exporter/orders/{order_id}/lc",
        json={
            "lcNumber": "LC-2",
            "issuingBank": "Bank",
            "amount": -5,
            "expiryDate": "2099-12-31",
        },
        headers=_auth(token),
    )
    assert bad_lc.status_code == 422

    remit = await client.post(
        f"/v1/exporter/orders/{order_id}/remittances",
        json={"amount": 5000, "date": "2026-10-10", "refNo": "TT-1", "mode": "tt"},
        headers=_auth(token),
    )
    assert remit.status_code == 201
    assert remit.json()["id"].startswith("rem_")

    finance = await client.get(f"/v1/exporter/orders/{order_id}/finance", headers=_auth(token))
    assert finance.json()["lc"]["lcNumber"] == "LC-2026-001"
    assert finance.json()["remittanceTotal"] == 5000
    assert finance.json()["balanceVsRemittances"] == 75000


# ==========================================
# SUPPLIERS / ANALYTICS / DASHBOARD / PROFILE
# ==========================================


async def test_suppliers_aggregation_and_saved_list(client, user_store):
    token = await _exporter_token(client)
    seller1 = _seed_user(user_store, "uid-s1", "Suresh Seller")
    seller2 = _seed_user(user_store, "uid-s2", "Sonal Seller")

    rfq_id = (await _create_rfq(client, token)).json()["id"]
    quote1 = (await _post_quote(client, seller1, rfq_id, rate=1900, qty=40)).json()
    quote2 = (await _post_quote(client, seller2, rfq_id, rate=1800, qty=60)).json()
    await client.post(
        f"/v1/exporter/quotes/{quote1['id']}/accept",
        json={},
        headers={**_auth(token), "Idempotency-Key": "sup-1"},
    )
    await client.post(
        f"/v1/exporter/quotes/{quote2['id']}/accept",
        json={},
        headers={**_auth(token), "Idempotency-Key": "sup-2"},
    )

    suppliers = await client.get("/v1/exporter/suppliers", headers=_auth(token))
    assert suppliers.status_code == 200
    rows = suppliers.json()["data"]
    assert [r["sellerId"] for r in rows] == ["uid-s2", "uid-s1"]  # value desc
    top = rows[0]
    assert top["name"] == "Sonal Seller"
    assert top["role"] == "seller"
    assert top["totalQuintals"] == 60.0
    assert top["totalValue"] == 108000
    assert top["ordersCount"] == 1
    assert top["lastDealAt"]

    # saved suppliers CRUD
    missing = await client.post(
        "/v1/exporter/suppliers/uid-nope/save", headers=_auth(token)
    )
    assert missing.status_code == 404
    saved = await client.post(
        "/v1/exporter/suppliers/uid-s2/save", headers=_auth(token)
    )
    assert saved.status_code == 201
    assert saved.json()["name"] == "Sonal Seller"

    listed = await client.get("/v1/exporter/suppliers/saved", headers=_auth(token))
    assert listed.json()["total"] == 1
    assert listed.json()["data"][0]["sellerId"] == "uid-s2"

    deleted = await client.delete(
        "/v1/exporter/suppliers/uid-s2/saved", headers=_auth(token)
    )
    assert deleted.status_code == 204
    listed = await client.get("/v1/exporter/suppliers/saved", headers=_auth(token))
    assert listed.json()["total"] == 0


async def test_analytics_dashboard_and_profile(client, user_store):
    token = await _exporter_token(client)
    seller = _seed_user(user_store, "uid-s1", "Suresh Seller")

    rfq_id = (await _create_rfq(client, token)).json()["id"]
    quote = (await _post_quote(client, seller, rfq_id, rate=2000, qty=40)).json()
    accepted = await client.post(
        f"/v1/exporter/quotes/{quote['id']}/accept",
        json={},
        headers={**_auth(token), "Idempotency-Key": "ana-1"},
    )
    order_id = accepted.json()["order"]["id"]
    purchase_id = accepted.json()["purchase"]["id"]

    analytics = await client.get("/v1/exporter/analytics", headers=_auth(token))
    assert analytics.status_code == 200
    body = analytics.json()
    kpis = body["kpis"]
    assert kpis["activeOrders"] == 1
    assert kpis["openRfqs"] == 1  # 40 of 100 fulfilled — still open
    assert kpis["quotesPending"] == 0
    assert kpis["shippedLast30d"] == 0
    assert kpis["totalSpend"] == 80000
    assert kpis["supplierCount"] == 1
    assert len(body["monthlySpend"]) == 12
    assert body["cropBreakdown"] == [{"crop": "Onion", "spend": 80000, "quintals": 40.0}]
    assert body["topSuppliers"] == [
        {"sellerId": "uid-s1", "name": "Suresh Seller", "totalValue": 80000}
    ]
    assert body["qcRejectionRate"] is None
    assert body["onTimeDeliveryRate"] is None

    # payment flows into monthly spend; qc into the rejection rate
    await client.post(
        f"/v1/purchases/{purchase_id}/advance",
        json={"amount": 10000, "method": "upi"},
        headers=_auth(token),
    )
    stored = user_store[f"purchases/{purchase_id}"]
    stored["qc"] = {"grade": "A", "acceptedQty": 36, "rejectedQty": 4, "note": ""}
    user_store[f"purchases/{purchase_id}"] = stored

    analytics = await client.get("/v1/exporter/analytics", headers=_auth(token))
    body = analytics.json()
    assert body["qcRejectionRate"] == 0.1
    current_month = next(
        m for m in body["monthlySpend"] if m["spend"] > 0
    )
    assert current_month["spend"] == 10000
    assert current_month["quintals"] == 40.0

    # on-time delivery: eta far in the future, then walk the flow to delivered
    await client.put(
        f"/v1/exporter/orders/{order_id}/shipment",
        json={
            "shippingLine": "Maersk",
            "containerType": "dry",
            "containerNos": ["MSCU1234567"],
            "portOfLoading": "Nhava Sheva",
            "portOfDischarge": "Jebel Ali",
            "eta": "2099-12-31T00:00:00+00:00",
        },
        headers=_auth(token),
    )
    for status in ("sourcing", "packed", "pickedUp", "inTransit", "customsCleared", "shipped", "delivered"):
        moved = await client.post(
            f"/v1/exporter/orders/{order_id}/status",
            json={"status": status},
            headers=_auth(token),
        )
        assert moved.status_code == 200, moved.text
    analytics = await client.get("/v1/exporter/analytics", headers=_auth(token))
    assert analytics.json()["onTimeDeliveryRate"] == 1.0
    assert analytics.json()["kpis"]["shippedLast30d"] == 1
    assert analytics.json()["kpis"]["activeOrders"] == 0

    dashboard = await client.get("/v1/exporter/dashboard", headers=_auth(token))
    assert dashboard.status_code == 200
    dash = dashboard.json()
    assert dash["kpis"]["totalSpend"] == 80000
    assert set(dash["pendingActions"].keys()) == {
        "quotesAwaiting",
        "ordersMissingDocs",
        "shipmentsEtaSoon",
    }
    assert dash["pendingActions"]["quotesAwaiting"] == 0
    assert dash["pendingActions"]["ordersMissingDocs"] == 1  # no docs uploaded
    assert len(dash["recentOrders"]) == 1
    assert len(dash["recentRfqs"]) == 1

    # an open RFQ with a pending quote raises the quotesAwaiting counter
    rfq2 = (await _create_rfq(client, token, idempotency_key="rfq-dash")).json()["id"]
    await _post_quote(client, seller, rfq2, rate=2100, qty=5)
    dashboard = await client.get("/v1/exporter/dashboard", headers=_auth(token))
    assert dashboard.json()["pendingActions"]["quotesAwaiting"] == 1
    assert len(dashboard.json()["recentRfqs"]) == 2

    profile = await client.get("/v1/exporter/profile", headers=_auth(token))
    assert profile.status_code == 200
    prof = profile.json()
    assert prof["user"]["id"] == "uid-1"
    assert prof["roleProfile"]["companyName"] == "Agro Exports Pvt Ltd"
    assert prof["kyc"]["status"] is None
    assert prof["stats"]["totalOrders"] == 1
    assert prof["stats"]["shippedLast30d"] == 1
    assert prof["stats"]["totalSpend"] == 80000
    assert prof["stats"]["supplierCount"] == 1


async def test_exporter_permissions_throughout(client, user_store):
    token = await _exporter_token(client)
    other_exporter = _seed_user(user_store, "uid-e2", "Evil Exporter", active="exporter")
    farmer_tok = _seed_user(user_store, "uid-f1", "Farmer F1", active="farmer")
    seller = _seed_user(user_store, "uid-s1", "Suresh Seller")

    # farmer and seller are locked out of exporter-only reads
    for path in ("/v1/exporter/rfqs", "/v1/exporter/orders", "/v1/exporter/analytics"):
        farmer_resp = await client.get(path, headers=_auth(farmer_tok))
        assert farmer_resp.status_code == 403, path
    seller_rfqs = await client.get("/v1/exporter/rfqs", headers=_auth(seller))
    assert seller_rfqs.status_code == 403

    # exporters cannot quote or browse-side write
    rfq_id = (await _create_rfq(client, token)).json()["id"]
    exporter_quote = await _post_quote(client, token, rfq_id)
    assert exporter_quote.status_code == 403

    # another exporter cannot close/delete/accept around the RFQ
    for method, path in (
        ("POST", f"/v1/exporter/rfqs/{rfq_id}/close"),
        ("DELETE", f"/v1/exporter/rfqs/{rfq_id}"),
    ):
        resp = await client.request(method, path, headers=_auth(other_exporter))
        assert resp.status_code == 403, path
    detail = await client.get(f"/v1/exporter/rfqs/{rfq_id}", headers=_auth(other_exporter))
    assert detail.status_code == 403

    quote = (await _post_quote(client, seller, rfq_id, rate=2000, qty=5)).json()
    accept = await client.post(
        f"/v1/exporter/quotes/{quote['id']}/accept",
        json={},
        headers={**_auth(other_exporter), "Idempotency-Key": "perm-1"},
    )
    assert accept.status_code == 403
    assert accept.json()["error"]["code"] == "QUOTE_FORBIDDEN"

    order_id = (
        await client.post(
            f"/v1/exporter/quotes/{quote['id']}/accept",
            json={},
            headers={**_auth(token), "Idempotency-Key": "perm-2"},
        )
    ).json()["order"]["id"]

    # foreign exporter blocked from order mutation + finance
    foreign_status = await client.post(
        f"/v1/exporter/orders/{order_id}/status",
        json={"status": "sourcing"},
        headers=_auth(other_exporter),
    )
    assert foreign_status.status_code == 403
    foreign_finance = await client.get(
        f"/v1/exporter/orders/{order_id}/finance", headers=_auth(other_exporter)
    )
    assert foreign_finance.status_code == 403
    foreign_shipment = await client.put(
        f"/v1/exporter/orders/{order_id}/shipment",
        json={
            "shippingLine": "X",
            "containerType": "dry",
            "containerNos": ["X1"],
            "portOfLoading": "A",
            "portOfDischarge": "B",
        },
        headers=_auth(other_exporter),
    )
    assert foreign_shipment.status_code == 403

    # call context "export_order": line seller dials the exporter; outsider blocked
    call = await client.post(
        "/v1/calls",
        json={"toUserId": "uid-1", "contextType": "export_order", "contextId": order_id},
        headers=_auth(seller),
    )
    assert call.status_code == 201
    outsider = _seed_user(user_store, "uid-o1", "Outsider", active="farmer")
    blocked = await client.post(
        "/v1/calls",
        json={"toUserId": "uid-1", "contextType": "export_order", "contextId": order_id},
        headers=_auth(outsider),
    )
    assert blocked.status_code == 403
    assert blocked.json()["error"]["code"] == "CALL_FORBIDDEN"
