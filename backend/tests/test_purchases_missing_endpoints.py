"""P0-10 + P1-21 — user-side purchase disputes (S9/G4, Vyapari V15-C8) and the
GST tax-invoice PDF (direct-buyer spec B9).

Disputes drive the canonical admin triage pipeline end to end: raise on the
purchase → admin queue → evidence locker. The invoice PDF is generated for a
purchase completed through the real lifecycle.
"""
from datetime import datetime, timedelta, timezone

from app.routers.purchases import _gst_breakdown, _seller_gstin
from app.services.escrow import is_paused, release_due_escrows
from app.services.tokens import create_access_token
from tests.test_admin import _seed_admin, admin_headers
from tests.test_direct_buyer import _lot, _register_buyer, _seed_user
from tests.test_purchases import _buy, _setup, _to_delivered
from tests.test_users import _auth

SELLER_GSTIN = "27AAACS1234A1Z5"  # format-valid per app.services.gstin


def _give_farmer_seller_profile(user_store, farmer_id="uid-f1", gst_number=SELLER_GSTIN, state="Maharashtra"):
    user_store[f"users/{farmer_id}"]["state"] = state
    user_store[f"users/{farmer_id}/role_profiles/seller"] = {
        "shopName": "Ram Mandi Shop",
        "gstNumber": gst_number,
    }


async def _open_dispute(client, purchase_id, token, **overrides):
    body = {"category": "payment", "reason": "not settled", **overrides}
    return await client.post(
        f"/v1/purchases/{purchase_id}/disputes", json=body, headers=_auth(token)
    )


async def _complete_purchase(client, buyer, farmer, lot_id="lot_buy1"):
    purchase_id = (await _buy(client, buyer, lot_id=lot_id)).json()["id"]
    await _to_delivered(client, buyer, farmer, purchase_id)
    qc = await client.post(
        f"/v1/purchases/{purchase_id}/qc",
        json={"grade": "A", "acceptedQty": 10, "rejectedQty": 0, "note": ""},
        headers=_auth(buyer),
    )
    assert qc.status_code == 200
    assert qc.json()["invoice"] is not None
    return purchase_id


# ---- P0-10: raise / list / evidence ----


async def test_buyer_raises_dispute_pauses_escrow_and_reaches_admin_queue(client, user_store):
    buyer, farmer = await _setup(client, user_store)
    purchase_id = (await _buy(client, buyer)).json()["id"]
    fund = await client.post(
        f"/v1/purchases/{purchase_id}/escrow/fund",
        json={"amount": 20000, "method": "upi", "reference": "UTR9"},
        headers=_auth(buyer),
    )
    assert fund.status_code == 200

    resp = await _open_dispute(
        client,
        purchase_id,
        buyer,
        category="payment",
        reason="farmer says not paid",
        evidence={"note": "bank statement", "photoUrls": ["https://img/1.jpg"]},
    )
    assert resp.status_code == 201
    dispute = resp.json()
    assert dispute["id"].startswith("dsp_")
    assert dispute["source"] == "purchase"
    assert dispute["sourceId"] == purchase_id
    assert dispute["status"] == "open"
    assert dispute["raisedBy"] == "uid-1"
    assert dispute["parties"] == ["uid-1", "uid-f1"]
    assert len(dispute["evidence"]) == 1
    assert dispute["evidence"][0]["by"] == "uid-1"
    assert dispute["evidence"][0]["photoUrls"] == ["https://img/1.jpg"]

    stored = user_store[f"purchases/{purchase_id}"]
    assert stored["escrow"]["disputeOpenedAt"]
    assert is_paused(stored["escrow"])
    assert "disputeOpened" in [e["status"] for e in stored["events"]]

    # Nightly release must skip the paused hold even after the window closes.
    stored["escrow"]["releaseAt"] = (
        datetime.now(timezone.utc) - timedelta(hours=1)
    ).isoformat()
    result = await release_due_escrows()
    assert result["paused"] == 1
    assert result["released"] == 0
    assert user_store[f"purchases/{purchase_id}"]["escrow"]["status"] == "held"

    admin_token = _seed_admin(user_store)
    queue = await client.get("/v1/admin/disputes", headers=admin_headers(admin_token))
    assert queue.status_code == 200
    assert any(d["id"] == dispute["id"] for d in queue.json()["data"])


async def test_farmer_raises_dispute_and_list_is_party_scoped(client, user_store):
    buyer, farmer = await _setup(client, user_store)
    purchase_id = (await _buy(client, buyer)).json()["id"]
    resp = await _open_dispute(client, purchase_id, farmer, category="quality", reason="below grade")
    assert resp.status_code == 201
    dispute_id = resp.json()["id"]
    assert resp.json()["raisedBy"] == "uid-f1"

    for token in (farmer, buyer):
        listing = await client.get(f"/v1/purchases/{purchase_id}/disputes", headers=_auth(token))
        assert listing.status_code == 200
        assert listing.json()["total"] == 1
        assert listing.json()["data"][0]["id"] == dispute_id

    outsider = create_access_token("uid-outsider")
    denied = await client.get(f"/v1/purchases/{purchase_id}/disputes", headers=_auth(outsider))
    assert denied.status_code == 403
    denied = await _open_dispute(client, purchase_id, outsider)
    assert denied.status_code == 403

    missing = await client.get("/v1/purchases/pur_nope/disputes", headers=_auth(buyer))
    assert missing.status_code == 404


async def test_second_open_dispute_conflict_and_cancelled_not_disputable(client, user_store):
    buyer, farmer = await _setup(client, user_store)
    purchase_id = (await _buy(client, buyer)).json()["id"]
    first = await _open_dispute(client, purchase_id, buyer)
    assert first.status_code == 201
    again = await _open_dispute(client, purchase_id, farmer, category="delivery")
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "DISPUTE_ALREADY_OPEN"

    user_store["market_lots/lot_cancel"] = _lot("lot_cancel", "uid-f1", "Onion", "2026-09-15T00:00:00+00:00")
    other_id = (await _buy(client, buyer, lot_id="lot_cancel")).json()["id"]
    await client.post(
        f"/v1/purchases/{other_id}/cancel", json={"reason": "changed plans"}, headers=_auth(buyer)
    )
    cancelled = await _open_dispute(client, other_id, buyer)
    assert cancelled.status_code == 409
    assert cancelled.json()["error"]["code"] == "PURCHASE_NOT_DISPUTABLE"


async def test_evidence_appends_for_both_parties_and_rejects_others(client, user_store):
    buyer, farmer = await _setup(client, user_store)
    purchase_id = (await _buy(client, buyer)).json()["id"]
    dispute_id = (await _open_dispute(client, purchase_id, buyer)).json()["id"]
    assert (await client.get(f"/v1/purchases/{purchase_id}/disputes", headers=_auth(buyer))).json()["data"][0]["evidence"] == []

    resp = await client.post(
        f"/v1/purchases/{purchase_id}/disputes/{dispute_id}/evidence",
        json={"note": "payment receipt", "photoUrls": ["https://img/a.jpg", "https://img/b.jpg"]},
        headers=_auth(buyer),
    )
    assert resp.status_code == 201
    assert resp.json()["total"] == 1
    resp = await client.post(
        f"/v1/purchases/{purchase_id}/disputes/{dispute_id}/evidence",
        json={"note": "counter claim"},
        headers=_auth(farmer),
    )
    assert resp.status_code == 201
    assert resp.json()["total"] == 2

    stored = user_store[f"disputes/{dispute_id}"]
    assert [e["by"] for e in stored["evidence"]] == ["uid-1", "uid-f1"]
    assert stored["evidence"][0]["photoUrls"] == ["https://img/a.jpg", "https://img/b.jpg"]

    outsider = create_access_token("uid-outsider")
    denied = await client.post(
        f"/v1/purchases/{purchase_id}/disputes/{dispute_id}/evidence",
        json={"note": "intruder"},
        headers=_auth(outsider),
    )
    assert denied.status_code == 403
    mismatched = await client.post(
        f"/v1/purchases/pur_other/disputes/{dispute_id}/evidence",
        json={"note": "x"},
        headers=_auth(buyer),
    )
    assert mismatched.status_code == 404
    assert mismatched.json()["error"]["code"] == "PURCHASE_NOT_FOUND"
    # A real second purchase that does not own the dispute → DISPUTE_NOT_FOUND.
    user_store["market_lots/lot_ev2"] = _lot("lot_ev2", "uid-f1", "Grapes", "2026-09-17T00:00:00+00:00")
    other_id = (await _buy(client, buyer, lot_id="lot_ev2")).json()["id"]
    mismatched = await client.post(
        f"/v1/purchases/{other_id}/disputes/{dispute_id}/evidence",
        json={"note": "x"},
        headers=_auth(buyer),
    )
    assert mismatched.status_code == 404
    assert mismatched.json()["error"]["code"] == "DISPUTE_NOT_FOUND"

    # Resolution closes the evidence locker (admin-side resolve flow).
    admin_token = _seed_admin(user_store)
    resolved = await client.post(
        f"/v1/admin/disputes/{dispute_id}/resolve",
        json={"resolution": "settled via escrow ledger"},
        headers=admin_headers(admin_token),
    )
    assert resolved.status_code == 200
    closed = await client.post(
        f"/v1/purchases/{purchase_id}/disputes/{dispute_id}/evidence",
        json={"note": "too late"},
        headers=_auth(buyer),
    )
    assert closed.status_code == 409
    assert closed.json()["error"]["code"] == "DISPUTE_CLOSED"


# ---- P1-21: GST tax-invoice PDF ----


async def test_invoice_pdf_intr_state_both_parties(client, user_store):
    buyer, farmer = await _setup(client, user_store)
    _give_farmer_seller_profile(user_store)
    purchase_id = await _complete_purchase(client, buyer, farmer)

    for token in (buyer, farmer):
        resp = await client.get(f"/v1/purchases/{purchase_id}/invoice.pdf", headers=_auth(token))
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/pdf"
        assert "gst-invoice-" in resp.headers["content-disposition"]
        assert resp.content.startswith(b"%PDF")

    outsider = create_access_token("uid-outsider")
    denied = await client.get(f"/v1/purchases/{purchase_id}/invoice.pdf", headers=_auth(outsider))
    assert denied.status_code == 403


async def test_invoice_pdf_inter_state_and_not_before_completion(client, user_store):
    buyer, farmer = await _setup(client, user_store)
    _give_farmer_seller_profile(user_store, state="Maharashtra")
    purchase_id = (await _buy(client, buyer)).json()["id"]

    early = await client.get(f"/v1/purchases/{purchase_id}/invoice.pdf", headers=_auth(buyer))
    assert early.status_code == 404
    assert early.json()["error"]["code"] == "INVOICE_NOT_FOUND"

    # Inter-state trade: buyer registered in Karnataka, farmer in Maharashtra.
    await _register_buyer(client, state="Karnataka")
    user_store["market_lots/lot_inter"] = _lot("lot_inter", "uid-f1", "Onion", "2026-09-16T00:00:00+00:00")
    done_id = await _complete_purchase(client, buyer, farmer, lot_id="lot_inter")
    resp = await client.get(f"/v1/purchases/{done_id}/invoice.pdf", headers=_auth(buyer))
    assert resp.status_code == 200
    assert resp.content.startswith(b"%PDF")


async def test_seller_gstin_comes_from_seller_role_profile(client, user_store):
    buyer, farmer = await _setup(client, user_store)
    _give_farmer_seller_profile(user_store, gst_number=SELLER_GSTIN)
    assert await _seller_gstin("uid-f1", user_store["users/uid-f1"]) == SELLER_GSTIN
    # No seller profile → falls back to user-doc fields, else empty.
    assert await _seller_gstin("uid-nope", {}) == ""
    user_store["users/uid-f1"]["gstin"] = "27GSTINUSERDOC1Z5"
    del user_store["users/uid-f1/role_profiles/seller"]
    assert await _seller_gstin("uid-f1", user_store["users/uid-f1"]) == "27GSTINUSERDOC1Z5"


def test_gst_breakdown_intra_state_halves():
    gst = _gst_breakdown(
        {"totalAmount": 20000, "finalAmount": 20000},
        {"state": "Maharashtra"},
        {"state": "Maharashtra"},
    )
    assert gst["intraState"] is True
    assert gst["ratePercent"] == 5  # default agri-commodity slab
    assert gst["taxablePaisa"] == 2000000
    assert gst["taxPaisa"] == 100000  # 5% of ₹20,000 in paisa
    assert gst["lines"]["CGST"] == {"paisa": 50000, "ratePercent": 2.5}
    assert gst["lines"]["SGST"] == {"paisa": 50000, "ratePercent": 2.5}
    assert "IGST" not in gst["lines"]
    assert gst["totalPaisa"] == 2100000


def test_gst_breakdown_inter_state_igst():
    gst = _gst_breakdown(
        {"totalAmount": 20000, "finalAmount": 20000},
        {"state": "Karnataka"},
        {"state": "Maharashtra"},
    )
    assert gst["intraState"] is False
    assert gst["lines"]["IGST"] == {"paisa": 100000, "ratePercent": 5}
    assert "CGST" not in gst["lines"] and "SGST" not in gst["lines"]
    assert gst["totalPaisa"] == 2100000


def test_gst_breakdown_purchase_rate_overrides_default():
    gst = _gst_breakdown(
        {"totalAmount": 20000, "finalAmount": 20000, "gstRate": 12},
        {"state": "Maharashtra"},
        {"state": "Maharashtra"},
    )
    assert gst["ratePercent"] == 12
    assert gst["taxPaisa"] == 240000
    assert gst["lines"]["CGST"]["paisa"] == 120000
    assert gst["lines"]["SGST"]["paisa"] == 120000
