from app.services.tasks import DEEP_LINKS  # noqa: F401
from tests.test_diary import auth, seed_user

FAKE_PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32

DEAL_BODY = {
    "buyerName": "Shree Traders",
    "buyerPhone": "+919812345678",
    "buyerCompany": "Shree Traders",
    "sellerName": "Ram Patil",
    "sellerPhone": "+91 98765 00006",
    "commodity": "Onion",
    "variety": "Nashik Red",
    "quantityQuintals": 50,
    "agreedRate": 2200,
    "brokerCommissionPct": 2,
}

FARMER_PHONE = "+919876500006"
BROKER_PHONE = "+919111111111"


def _seed_farmer(user_store, uid="uid-f1", phone=FARMER_PHONE):
    return seed_user(user_store, uid=uid, active_profile="farmer", name="Ram Patil", phone=phone)


def _seed_broker(user_store, uid="uid-b1"):
    return seed_user(user_store, uid=uid, active_profile="broker", name="Vikram Deshmukh", phone=BROKER_PHONE)


def _notifications_for(user_store, uid):
    return [
        doc
        for key, doc in user_store.items()
        if key.startswith("notifications/") and doc.get("userId") == uid
    ]


def _patch_storage(monkeypatch):
    def fake_upload(uid, data, filename, content_type, prefix="vault"):
        return f"{prefix}/{uid}/{filename}", len(data)

    monkeypatch.setattr("app.services.storage.upload_user_file", fake_upload)


# ---- broker deal CRUD + math ----


async def test_create_deal_computes_gross_and_commission(client, user_store):
    broker = _seed_broker(user_store)
    _seed_farmer(user_store)  # phone matches sellerPhone (last-10)
    seed_user(user_store, uid="uid-buyer", active_profile="directBuyer", phone="+919812345678")
    resp = await client.post("/v1/broker/deals", json=DEAL_BODY, headers=auth(broker))
    assert resp.status_code == 201
    deal = resp.json()
    assert deal["status"] == "negotiating"
    assert deal["grossAmount"] == 110000  # 50q × ₹2200
    assert deal["commissionAmount"] == 2200  # 2%
    assert deal["brokerId"] == "uid-b1"
    assert deal["sellerUid"] == "uid-f1"  # resolved by phone (last-10 match)
    assert deal["buyerUid"] == "uid-buyer"  # resolved by exact phone match
    # seller notified about the new offer — no phone numbers in the payload
    notes = _notifications_for(user_store, "uid-f1")
    assert len(notes) == 1
    assert notes[0]["type"] == "deal_offer_received"
    assert "9876500006" not in notes[0]["body"]


async def test_update_deal_recomputes_math(client, user_store):
    broker = _seed_broker(user_store)
    deal_id = (await client.post("/v1/broker/deals", json=DEAL_BODY, headers=auth(broker))).json()["id"]
    resp = await client.put(
        f"/v1/broker/deals/{deal_id}",
        json={"agreedRate": 2150},
        headers=auth(broker),
    )
    assert resp.status_code == 200
    deal = resp.json()
    assert deal["grossAmount"] == 107500
    assert deal["commissionAmount"] == 2150
    listed = await client.get("/v1/broker/deals", headers=auth(broker))
    assert listed.json()["total"] == 1


async def test_delete_deal_cancels(client, user_store):
    broker = _seed_broker(user_store)
    deal_id = (await client.post("/v1/broker/deals", json=DEAL_BODY, headers=auth(broker))).json()["id"]
    resp = await client.delete(f"/v1/broker/deals/{deal_id}", headers=auth(broker))
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "status": "cancelled"}
    assert user_store[f"broker_deals/{deal_id}"]["status"] == "cancelled"


# ---- ownership (P3) ----


async def test_other_broker_gets_404_on_foreign_deal(client, user_store):
    broker1 = _seed_broker(user_store)
    _seed_farmer(user_store)
    deal_id = (
        await client.post("/v1/broker/deals", json=DEAL_BODY, headers=auth(broker1))
    ).json()["id"]
    broker2 = _seed_broker(user_store, uid="uid-b2")

    resp = await client.get(f"/v1/broker/deals/{deal_id}", headers=auth(broker2))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "DEAL_NOT_FOUND"

    resp = await client.put(f"/v1/broker/deals/{deal_id}", json={"notes": "hijack"}, headers=auth(broker2))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "DEAL_NOT_FOUND"

    resp = await client.delete(f"/v1/broker/deals/{deal_id}", headers=auth(broker2))
    assert resp.status_code == 404

    resp = await client.get(f"/v1/broker/deals/{deal_id}/messages", headers=auth(broker2))
    assert resp.status_code == 404

    resp = await client.post(
        f"/v1/broker/deals/{deal_id}/messages",
        json={"senderRole": "broker", "text": "hi"},
        headers=auth(broker2),
    )
    assert resp.status_code == 404
    # nothing leaked or changed
    assert user_store[f"broker_deals/{deal_id}"]["status"] == "negotiating"
    assert user_store[f"broker_deals/{deal_id}"]["notes"] == ""


async def test_missing_deal_also_404_same_code(client, user_store):
    broker = _seed_broker(user_store)
    resp = await client.get("/v1/broker/deals/deal_missing", headers=auth(broker))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "DEAL_NOT_FOUND"


async def test_lead_ownership(client, user_store):
    broker1 = _seed_broker(user_store)
    lead_id = (
        await client.post(
            "/v1/broker/leads",
            json={"name": "Somnath", "phone": "9822000001", "commodity": "Wheat"},
            headers=auth(broker1),
        )
    ).json()["id"]
    broker2 = _seed_broker(user_store, uid="uid-b2")
    resp = await client.put(f"/v1/broker/leads/{lead_id}", json={"notes": "x"}, headers=auth(broker2))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "LEAD_NOT_FOUND"
    resp = await client.delete(f"/v1/broker/leads/{lead_id}", headers=auth(broker2))
    assert resp.status_code == 404
    # owner still works
    resp = await client.put(f"/v1/broker/leads/{lead_id}", json={"status": "contacted"}, headers=auth(broker1))
    assert resp.status_code == 200
    assert resp.json()["status"] == "contacted"


# ---- no demo fallback (P3) ----


async def test_no_demo_fallback_for_deals_and_leads(client, user_store):
    broker = _seed_broker(user_store)
    user_store["broker_deals/deal_omni"] = {
        "id": "deal_omni",
        "brokerId": "omni-user-777",
        "status": "negotiating",
        "createdAt": "2026-09-20T00:00:00+00:00",
    }
    user_store["broker_leads/lead_omni"] = {
        "id": "lead_omni",
        "brokerId": "dev-user-1",
        "createdAt": "2026-09-20T00:00:00+00:00",
    }
    resp = await client.get("/v1/broker/deals", headers=auth(broker))
    assert resp.status_code == 200
    assert resp.json() == {"data": [], "page": 1, "pageSize": 20, "total": 0}
    resp = await client.get("/v1/broker/leads", headers=auth(broker))
    assert resp.status_code == 200
    assert resp.json() == {"data": [], "total": 0}


# ---- farmer flow (P2) ----


async def _create_deal(client, broker, **overrides):
    resp = await client.post("/v1/broker/deals", json={**DEAL_BODY, **overrides}, headers=auth(broker))
    assert resp.status_code == 201
    return resp.json()["id"]


async def test_farmer_sees_deal_by_phone_last10(client, user_store):
    broker = _seed_broker(user_store)
    deal_id = await _create_deal(client, broker)
    farmer = _seed_farmer(user_store)

    resp = await client.get("/v1/farmer/deals", headers=auth(farmer))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["data"][0]["id"] == deal_id
    assert body["page"] == 1

    resp = await client.get(f"/v1/farmer/deals/{deal_id}", headers=auth(farmer))
    assert resp.status_code == 200
    assert resp.json()["id"] == deal_id

    resp = await client.get(f"/v1/farmer/deals/{deal_id}/messages", headers=auth(farmer))
    assert resp.status_code == 200
    assert resp.json() == {"data": []}

    resp = await client.get("/v1/farmer/deals?status=completed", headers=auth(farmer))
    assert resp.json()["total"] == 0


async def test_stranger_farmer_sees_nothing(client, user_store):
    broker = _seed_broker(user_store)
    deal_id = await _create_deal(client, broker)
    stranger = _seed_farmer(user_store, uid="uid-f9", phone="+917777777777")
    resp = await client.get("/v1/farmer/deals", headers=auth(stranger))
    assert resp.status_code == 200
    assert resp.json()["total"] == 0
    for method, url in (
        ("GET", f"/v1/farmer/deals/{deal_id}"),
        ("GET", f"/v1/farmer/deals/{deal_id}/messages"),
    ):
        resp = await client.request(method, url, headers=auth(stranger))
        assert resp.status_code == 404
        assert resp.json()["error"]["code"] == "DEAL_NOT_FOUND"
    resp = await client.post(
        f"/v1/farmer/deals/{deal_id}/messages",
        json={"text": "hello"},
        headers=auth(stranger),
    )
    assert resp.status_code == 404
    resp = await client.post(
        f"/v1/farmer/deals/{deal_id}/respond",
        json={"action": "accept"},
        headers=auth(stranger),
    )
    assert resp.status_code == 404


async def test_farmer_without_phone_matches_nothing(client, user_store):
    broker = _seed_broker(user_store)
    await _create_deal(client, broker, sellerPhone="")
    phoneless = _seed_farmer(user_store, uid="uid-f0", phone="")

    resp = await client.get("/v1/farmer/deals", headers=auth(phoneless))
    assert resp.status_code == 200
    assert resp.json()["total"] == 0


async def test_farmer_message_forces_seller_role(client, user_store):
    broker = _seed_broker(user_store)
    deal_id = await _create_deal(client, broker)
    farmer = _seed_farmer(user_store)

    resp = await client.post(
        f"/v1/farmer/deals/{deal_id}/messages",
        json={"senderRole": "broker", "senderName": "Mallory", "text": "counter", "amountOffer": 2150},
        headers=auth(farmer),
    )
    assert resp.status_code == 201
    msg = resp.json()
    assert msg["senderRole"] == "seller"
    assert msg["senderId"] == "uid-f1"
    assert msg["senderName"] == "Ram Patil"
    assert msg["amountOffer"] == 2150
    # broker got the counter-offer notification (with the amount)
    notes = _notifications_for(user_store, "uid-b1")
    assert [n["type"] for n in notes] == ["deal_counter_offer"]
    assert "2150" in notes[0]["body"]


async def test_farmer_respond_state_machine(client, user_store):
    broker = _seed_broker(user_store)
    farmer = _seed_farmer(user_store)  # seeded before create → sellerUid resolved
    deal_id = await _create_deal(client, broker)

    # accept from negotiating → 409
    resp = await client.post(
        f"/v1/farmer/deals/{deal_id}/respond", json={"action": "accept"}, headers=auth(farmer)
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "INVALID_STATE"

    # broker issues the contract; farmer accepts
    await client.put(f"/v1/broker/deals/{deal_id}", json={"status": "contract_issued"}, headers=auth(broker))
    resp = await client.post(
        f"/v1/farmer/deals/{deal_id}/respond", json={"action": "accept"}, headers=auth(farmer)
    )
    assert resp.status_code == 200
    deal = resp.json()
    assert deal["status"] == "accepted"
    assert deal["sellerUid"] == "uid-f1"
    # broker notified
    notes = _notifications_for(user_store, "uid-b1")
    assert "deal_accepted" in [n["type"] for n in notes]
    # accepting again → 409
    resp = await client.post(
        f"/v1/farmer/deals/{deal_id}/respond", json={"action": "accept"}, headers=auth(farmer)
    )
    assert resp.status_code == 409

    # drive to completed, then respond → 409
    await client.put(f"/v1/broker/deals/{deal_id}", json={"status": "in_transit"}, headers=auth(broker))
    await client.put(f"/v1/broker/deals/{deal_id}", json={"status": "completed"}, headers=auth(broker))
    resp = await client.post(
        f"/v1/farmer/deals/{deal_id}/respond", json={"action": "decline", "reason": "late"}, headers=auth(farmer)
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "INVALID_STATE"

    # status-transition notifications reached the seller
    types = [n["type"] for n in _notifications_for(user_store, "uid-f1")]
    assert types == ["deal_offer_received", "deal_contract_issued", "deal_in_transit", "deal_completed"]
    completed = _notifications_for(user_store, "uid-f1")[-1]
    assert "110000" in completed["body"] and "2200" in completed["body"]


async def test_farmer_accept_sets_seller_uid_when_absent(client, user_store):
    broker = _seed_broker(user_store)
    deal_id = await _create_deal(client, broker, sellerPhone="+919998877665")
    assert "sellerUid" not in user_store[f"broker_deals/{deal_id}"]
    farmer = _seed_farmer(user_store, uid="uid-f2", phone="+919998877665")

    await client.put(f"/v1/broker/deals/{deal_id}", json={"status": "contract_issued"}, headers=auth(broker))
    resp = await client.post(
        f"/v1/farmer/deals/{deal_id}/respond", json={"action": "accept"}, headers=auth(farmer)
    )
    assert resp.status_code == 200
    assert resp.json()["sellerUid"] == "uid-f2"


async def test_farmer_decline_cancels_with_reason(client, user_store):
    broker = _seed_broker(user_store)
    deal_id = await _create_deal(client, broker)
    farmer = _seed_farmer(user_store)

    resp = await client.post(
        f"/v1/farmer/deals/{deal_id}/respond",
        json={"action": "decline", "reason": "rate too low"},
        headers=auth(farmer),
    )
    assert resp.status_code == 200
    deal = resp.json()
    assert deal["status"] == "cancelled"
    assert deal["cancelReason"] == "rate too low"

    # decline from cancelled → 409
    resp = await client.post(
        f"/v1/farmer/deals/{deal_id}/respond", json={"action": "decline"}, headers=auth(farmer)
    )
    assert resp.status_code == 409


async def test_farmer_routes_require_farmer_role(client, user_store):
    broker = _seed_broker(user_store)
    resp = await client.get("/v1/farmer/deals", headers=auth(broker))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"


# ---- evidence upload (P4) ----


async def test_broker_uploads_evidence(client, user_store, monkeypatch):
    _patch_storage(monkeypatch)
    broker = _seed_broker(user_store)
    deal_id = await _create_deal(client, broker)

    resp = await client.post(
        f"/v1/broker/deals/{deal_id}/evidence",
        files={"file": ("slip.png", FAKE_PNG, "image/png")},
        data={"kind": "weighbridge"},
        headers=auth(broker),
    )
    assert resp.status_code == 201
    entry = resp.json()
    assert entry["id"].startswith("evi_")
    assert entry["kind"] == "weighbridge"
    assert entry["blobPath"].startswith("deals/uid-b1/")
    assert entry["uploadedBy"] == "uid-b1"
    assert entry["createdAt"]

    # default kind is photo
    resp = await client.post(
        f"/v1/broker/deals/{deal_id}/evidence",
        files={"file": ("load.png", FAKE_PNG, "image/png")},
        headers=auth(broker),
    )
    assert resp.status_code == 201
    assert resp.json()["kind"] == "photo"

    deal = user_store[f"broker_deals/{deal_id}"]
    assert len(deal["evidence"]) == 2
    # evidence travels with GET responses
    resp = await client.get(f"/v1/broker/deals/{deal_id}", headers=auth(broker))
    assert [e["id"] for e in resp.json()["evidence"]] == [e["id"] for e in deal["evidence"]]


async def test_farmer_uploads_evidence_on_own_deal(client, user_store, monkeypatch):
    _patch_storage(monkeypatch)
    broker = _seed_broker(user_store)
    deal_id = await _create_deal(client, broker)
    farmer = _seed_farmer(user_store)

    resp = await client.post(
        f"/v1/farmer/deals/{deal_id}/evidence",
        files={"file": ("delivery.png", FAKE_PNG, "image/png")},
        data={"kind": "delivery"},
        headers=auth(farmer),
    )
    assert resp.status_code == 201
    assert resp.json()["kind"] == "delivery"
    assert resp.json()["uploadedBy"] == "uid-f1"

    resp = await client.get(f"/v1/farmer/deals/{deal_id}", headers=auth(farmer))
    assert len(resp.json()["evidence"]) == 1


async def test_evidence_wrong_owner_404(client, user_store, monkeypatch):
    _patch_storage(monkeypatch)
    broker1 = _seed_broker(user_store)
    deal_id = await _create_deal(client, broker1)
    broker2 = _seed_broker(user_store, uid="uid-b2")
    stranger = _seed_farmer(user_store, uid="uid-f9", phone="+917777777777")

    resp = await client.post(
        f"/v1/broker/deals/{deal_id}/evidence",
        files={"file": ("x.png", FAKE_PNG, "image/png")},
        headers=auth(broker2),
    )
    assert resp.status_code == 404
    resp = await client.post(
        f"/v1/farmer/deals/{deal_id}/evidence",
        files={"file": ("x.png", FAKE_PNG, "image/png")},
        headers=auth(stranger),
    )
    assert resp.status_code == 404
    assert user_store[f"broker_deals/{deal_id}"].get("evidence") in (None, [])


async def test_evidence_validation_errors(client, user_store, monkeypatch):
    _patch_storage(monkeypatch)
    broker = _seed_broker(user_store)
    deal_id = await _create_deal(client, broker)

    resp = await client.post(
        f"/v1/broker/deals/{deal_id}/evidence",
        files={"file": ("doc.pdf", b"%PDF-1.4", "application/pdf")},
        headers=auth(broker),
    )
    assert resp.status_code == 415
    assert resp.json()["error"]["code"] == "UNSUPPORTED_FILE_TYPE"

    resp = await client.post(
        f"/v1/broker/deals/{deal_id}/evidence",
        files={"file": ("x.png", FAKE_PNG, "image/png")},
        data={"kind": "bogus"},
        headers=auth(broker),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"

    resp = await client.post(
        f"/v1/broker/deals/deal_missing/evidence",
        files={"file": ("x.png", FAKE_PNG, "image/png")},
        headers=auth(broker),
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "DEAL_NOT_FOUND"


async def test_evidence_capped_at_20(client, user_store, monkeypatch):
    _patch_storage(monkeypatch)
    broker = _seed_broker(user_store)
    deal_id = await _create_deal(client, broker)
    for _ in range(20):
        resp = await client.post(
            f"/v1/broker/deals/{deal_id}/evidence",
            files={"file": ("p.png", FAKE_PNG, "image/png")},
            headers=auth(broker),
        )
        assert resp.status_code == 201
    resp = await client.post(
        f"/v1/broker/deals/{deal_id}/evidence",
        files={"file": ("p.png", FAKE_PNG, "image/png")},
        headers=auth(broker),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "EVIDENCE_LIMIT_REACHED"
    assert len(user_store[f"broker_deals/{deal_id}"]["evidence"]) == 20


# ---- end-to-end lifecycle (broker → farmer → settlement) ----


async def test_full_deal_lifecycle_broker_to_settlement(client, user_store):
    from datetime import datetime, timezone

    from app.services.settlements import run_settlements

    broker = _seed_broker(user_store)
    farmer = _seed_farmer(user_store)

    # broker records the deal
    deal_id = await _create_deal(client, broker)
    deal = user_store[f"broker_deals/{deal_id}"]
    assert deal["sellerUid"] == "uid-f1"

    # farmer sees it and counters with a structured offer card
    resp = await client.get("/v1/farmer/deals", headers=auth(farmer))
    assert resp.json()["total"] == 1
    resp = await client.post(
        f"/v1/farmer/deals/{deal_id}/messages",
        json={"text": "Offer updated to ₹2150/q", "amountOffer": 2150},
        headers=auth(farmer),
    )
    assert resp.status_code == 201
    assert resp.json()["senderRole"] == "seller"  # forced server-side

    # broker matches the counter, then issues the contract
    resp = await client.put(
        f"/v1/broker/deals/{deal_id}",
        json={"agreedRate": 2150, "status": "contract_issued"},
        headers=auth(broker),
    )
    assert resp.json()["grossAmount"] == 107500
    assert resp.json()["commissionAmount"] == 2150

    # farmer accepts the contract
    resp = await client.post(
        f"/v1/farmer/deals/{deal_id}/respond", json={"action": "accept"}, headers=auth(farmer)
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "accepted"

    # broker drives pickup → delivery
    await client.put(f"/v1/broker/deals/{deal_id}", json={"status": "in_transit"}, headers=auth(broker))
    resp = await client.put(
        f"/v1/broker/deals/{deal_id}",
        json={"status": "completed", "notes": "Weighed 50q at kanta"},
        headers=auth(broker),
    )
    assert resp.json()["status"] == "completed"

    # commissions reflect the completed deal
    resp = await client.get("/v1/broker/commissions", headers=auth(broker))
    body = resp.json()
    assert body["totalEarned"] == 2150
    assert body["pendingPayout"] == 0
    assert body["completedDealsCount"] == 1

    # weekly settlement aggregates the real grossAmount (P1)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    result = await run_settlements(today, today)
    assert result["created"] >= 1
    resp = await client.get("/v1/broker/settlements", headers=auth(broker))
    settlements = resp.json()["data"]
    mine = [s for s in settlements if s["entityId"] == "uid-b1"]
    assert mine and mine[0]["grossRupees"] == 107500
    assert mine[0]["commissionRupees"] == 2150
    assert mine[0]["status"] == "pending"

    # farmer-side notifications fired across the lifecycle, none carrying phone numbers
    notes = _notifications_for(user_store, "uid-f1")
    types = {n["type"] for n in notes}
    assert {"deal_offer_received", "deal_contract_issued", "deal_in_transit", "deal_completed"} <= types
    for n in notes:
        assert "9876500006" not in n.get("body", "")


async def test_broker_cancel_stores_reason(client, user_store):
    broker = _seed_broker(user_store)
    deal_id = await _create_deal(client, broker)
    resp = await client.request(
        "DELETE",
        f"/v1/broker/deals/{deal_id}",
        json={"reason": "Mandi rate collapsed"},
        headers=auth(broker),
    )
    assert resp.status_code == 200
    assert user_store[f"broker_deals/{deal_id}"]["cancelReason"] == "Mandi rate collapsed"

    # cancel without a body still works (backward compatible)
    deal_id = await _create_deal(client, broker)
    resp = await client.delete(f"/v1/broker/deals/{deal_id}", headers=auth(broker))
    assert resp.status_code == 200
    assert "cancelReason" not in user_store[f"broker_deals/{deal_id}"]


async def test_deal_creation_emits_task(client, user_store):
    farmer = _seed_farmer(user_store)
    broker = _seed_broker(user_store)
    deal_id = await _create_deal(client, broker)
    tasks = [doc for key, doc in user_store.items() if key.startswith("tasks/")]
    assert len(tasks) == 1
    task = tasks[0]
    assert task["module"] == "broker"
    assert task["kind"] == "deal_confirmation_pending"
    assert task["deepLink"] == f"{DEEP_LINKS['farmer_deals']}/{deal_id}"
    assert task["userId"] == "uid-f1"
