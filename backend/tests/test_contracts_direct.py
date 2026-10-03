from app.services.tasks import DEEP_LINKS  # noqa: F401
from app.core.security import hash_mpin
from tests.test_diary import auth, seed_user

MANDI_TOMATO = {
    "id": "m1", "commodity": "Tomato (टमाटर)", "modalPrice": 2000, "mandiName": "Pimpalgaon Baswant APMC",
}

SCHEDULE = {"startDate": "2026-10-05", "endDate": "2026-12-28", "frequency": "weekly", "qtyPerDelivery": 10}

FIXED_BODY = {
    "farmerId": "uid-f1",
    "crop": "Tomato",
    "quantityTotal": 100,
    "priceType": "fixed",
    "baseRate": 2200,
    "premiumPerQuintal": 0,
    "mandiName": "",
    "schedule": SCHEDULE,
    "deliveryLocation": "Plant 1, MIDC Ambad",
    "paymentTermsDays": 30,
    "termsText": "Grade A only. Net 30 via NEFT.",
}

MANDI_LINKED_BODY = {
    **FIXED_BODY,
    "priceType": "mandiLinked",
    "baseRate": None,
    "premiumPerQuintal": 100,
    "mandiName": "Pimpalgaon",
}

ACCEPT_BODY = {
    "signatureData": "aGVsbG8td29ybGQ=",
    "consentTimestamp": "2026-10-01T10:00:00Z",
    "mpin": "1234",
}


def _seed_buyer(user_store):
    return seed_user(user_store, uid="uid-b1", active_profile="directBuyer")


def _seed_farmer(user_store, uid="uid-f1", with_mpin=True):
    token = seed_user(user_store, uid=uid, active_profile="farmer", name="Ram Patil")
    if with_mpin:
        user_store[f"users/{uid}"]["mpinHash"] = hash_mpin("1234")
    return token


def _notifications_for(user_store, uid):
    return [
        doc
        for key, doc in user_store.items()
        if key.startswith("notifications/") and doc.get("userId") == uid
    ]


async def _create_contract(client, token, body=FIXED_BODY):
    return await client.post("/v1/contracts", json=body, headers=auth(token))


# ---- creation + validation ----


async def test_buyer_creates_targeted_contract(client, user_store):
    buyer = _seed_buyer(user_store)
    farmer = _seed_farmer(user_store)
    user_store["users/uid-b1/role_profiles/directBuyer"] = {"companyName": "Shree Foods Pvt Ltd"}
    resp = await _create_contract(client, buyer)
    assert resp.status_code == 201
    doc = resp.json()
    assert doc["id"].startswith("con_")
    assert doc["status"] == "offered"
    assert doc["buyerId"] == "uid-b1"
    assert doc["buyerCompany"] == "Shree Foods Pvt Ltd"
    assert doc["farmerId"] == "uid-f1"
    assert doc["crop"] == "Tomato"
    assert doc["quantityTotal"] == 100
    assert doc["priceType"] == "fixed"
    assert doc["baseRate"] == 2200
    assert doc["deliveriesGenerated"] == 0
    assert doc["deliveries"] == []
    # legacy mirror fields keep the old ContractOut shape valid
    assert doc["lockedRateQuintal"] == 2200
    assert doc["minQuantityQuintals"] == 100
    assert doc["paymentTerms"] == "Net 30 days"

    notes = _notifications_for(user_store, "uid-f1")
    assert len(notes) == 1
    assert notes[0]["type"] == "contract_offer_received"
    assert "Shree Foods Pvt Ltd" in notes[0]["body"]
    assert "Tomato" in notes[0]["body"]
    assert "876543210" not in notes[0]["body"]  # no phone numbers
    assert notes[0]["data"]["path"] == f"/dashboard/p/myContracts/{doc['id']}"
    # create does not mutate the farmer token's doc
    assert user_store["users/uid-f1"]["id"] == "uid-f1"


async def test_create_price_type_validation(client, user_store):
    buyer = _seed_buyer(user_store)
    _seed_farmer(user_store)
    resp = await _create_contract(client, buyer, {**FIXED_BODY, "baseRate": None})
    assert resp.status_code == 422
    assert "baseRate" in resp.json()["error"]["fieldErrors"]

    resp = await _create_contract(client, buyer, MANDI_LINKED_BODY)
    assert resp.status_code == 201
    contract_id = resp.json()["id"]

    resp = await _create_contract(client, buyer, {**MANDI_LINKED_BODY, "mandiName": ""})
    assert resp.status_code == 422
    assert "mandiName" in resp.json()["error"]["fieldErrors"]

    # unknown farmer
    resp = await _create_contract(client, buyer, {**FIXED_BODY, "farmerId": "uid-nope"})
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "FARMER_NOT_FOUND"
    assert contract_id


async def test_farmer_cannot_create_contract(client, user_store):
    farmer = _seed_farmer(user_store)
    resp = await _create_contract(client, farmer)
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"


# ---- /mine with currentPrice ----


async def test_mine_enriches_current_price(client, user_store):
    buyer = _seed_buyer(user_store)
    farmer = _seed_farmer(user_store)
    user_store["mandi_prices/m1"] = MANDI_TOMATO
    fixed_id = (await _create_contract(client, buyer)).json()["id"]
    linked_id = (await _create_contract(client, buyer, MANDI_LINKED_BODY)).json()["id"]

    resp = await client.get("/v1/contracts/mine?role=buyer", headers=auth(buyer))
    assert resp.status_code == 200
    data = {d["id"]: d for d in resp.json()["data"]}
    assert data[fixed_id]["currentPrice"] == 2200  # fixed → baseRate
    assert data[linked_id]["currentPrice"] == 2100  # modal 2000 + premium 100

    resp = await client.get("/v1/contracts/mine?role=farmer", headers=auth(farmer))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    assert all(d["farmerId"] == "uid-f1" for d in body["data"])

    resp = await client.get(
        f"/v1/contracts/mine?role=farmer&status=offered", headers=auth(farmer)
    )
    assert {d["id"] for d in resp.json()["data"]} == {fixed_id, linked_id}

    # buyer persona cannot use role=farmer and vice versa
    resp = await client.get("/v1/contracts/mine?role=farmer", headers=auth(buyer))
    assert resp.status_code == 403
    resp = await client.get("/v1/contracts/mine?role=buyer", headers=auth(farmer))
    assert resp.status_code == 403


async def test_mandi_linked_without_data_has_null_current_price(client, user_store):
    buyer = _seed_buyer(user_store)
    _seed_farmer(user_store)
    contract_id = (await _create_contract(client, buyer, MANDI_LINKED_BODY)).json()["id"]
    resp = await client.get(f"/v1/contracts/{contract_id}", headers=auth(buyer))
    assert resp.status_code == 200
    assert resp.json()["currentPrice"] is None


# ---- targeted accept / decline ----


async def test_stranger_cannot_accept_targeted_contract(client, user_store):
    buyer = _seed_buyer(user_store)
    _seed_farmer(user_store)
    stranger = _seed_farmer(user_store, uid="uid-f2")
    contract_id = (await _create_contract(client, buyer)).json()["id"]
    resp = await client.post(
        f"/v1/contracts/{contract_id}/accept", json=ACCEPT_BODY, headers=auth(stranger)
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"
    assert user_store[f"contracts/{contract_id}"]["status"] == "offered"


async def test_targeted_accept_with_mpin(client, user_store):
    buyer = _seed_buyer(user_store)
    farmer = _seed_farmer(user_store)
    user_store["mandi_prices/m1"] = MANDI_TOMATO
    contract_id = (await _create_contract(client, buyer, MANDI_LINKED_BODY)).json()["id"]

    resp = await client.post(
        f"/v1/contracts/{contract_id}/accept",
        json={**ACCEPT_BODY, "mpin": "9999"},
        headers=auth(farmer),
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "WRONG_MPIN"

    resp = await client.post(
        f"/v1/contracts/{contract_id}/accept", json=ACCEPT_BODY, headers=auth(farmer)
    )
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "status": "active", "contractId": contract_id}
    stored = user_store[f"contracts/{contract_id}"]
    assert stored["status"] == "active"
    assert stored["acceptedBy"] == "uid-f1"
    assert user_store[f"contracts/{contract_id}/acceptances/uid-f1"]["signatureData"] == ACCEPT_BODY["signatureData"]

    notes = _notifications_for(user_store, "uid-b1")
    assert any(n["type"] == "contract_accepted" for n in notes)

    resp = await client.post(
        f"/v1/contracts/{contract_id}/accept", json=ACCEPT_BODY, headers=auth(farmer)
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "CONTRACT_NOT_OPEN"


async def test_farmer_decline(client, user_store):
    buyer = _seed_buyer(user_store)
    farmer = _seed_farmer(user_store)
    contract_id = (await _create_contract(client, buyer)).json()["id"]
    resp = await client.post(
        f"/v1/contracts/{contract_id}/decline",
        json={"reason": "Rate too low"},
        headers=auth(farmer),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "declined"
    stored = user_store[f"contracts/{contract_id}"]
    assert stored["status"] == "declined"
    assert stored["declineReason"] == "Rate too low"
    notes = _notifications_for(user_store, "uid-b1")
    assert any(n["type"] == "contract_declined" for n in notes)

    # already declined — not open any more
    resp = await client.post(
        f"/v1/contracts/{contract_id}/decline", json={}, headers=auth(farmer)
    )
    assert resp.status_code == 409
    # wrong farmer cannot decline
    other = seed_user(user_store, uid="uid-f2", active_profile="farmer", name="Sham")
    contract_id2 = (await _create_contract(client, buyer)).json()["id"]
    resp = await client.post(
        f"/v1/contracts/{contract_id2}/decline", json={}, headers=auth(other)
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


# ---- buyer edit + cancel ----


async def test_buyer_edit_only_while_offered(client, user_store):
    buyer = _seed_buyer(user_store)
    farmer = _seed_farmer(user_store)
    contract_id = (await _create_contract(client, buyer)).json()["id"]

    resp = await client.put(
        f"/v1/contracts/{contract_id}",
        json={"quantityTotal": 120, "baseRate": 2300},
        headers=auth(buyer),
    )
    assert resp.status_code == 200
    doc = resp.json()
    assert doc["quantityTotal"] == 120
    assert doc["baseRate"] == 2300
    assert doc["lockedRateQuintal"] == 2300  # legacy mirror re-synced

    # re-validate price rule on edit
    resp = await client.put(
        f"/v1/contracts/{contract_id}",
        json={"priceType": "mandiLinked", "mandiName": ""},
        headers=auth(buyer),
    )
    assert resp.status_code == 422
    assert "mandiName" in resp.json()["error"]["fieldErrors"]

    # non-owner cannot edit
    resp = await client.put(
        f"/v1/contracts/{contract_id}", json={"baseRate": 1}, headers=auth(farmer)
    )
    assert resp.status_code == 403

    await client.post(f"/v1/contracts/{contract_id}/accept", json=ACCEPT_BODY, headers=auth(farmer))
    resp = await client.put(
        f"/v1/contracts/{contract_id}", json={"baseRate": 2400}, headers=auth(buyer)
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "CONTRACT_NOT_OPEN"


async def test_buyer_cancel_notifies_farmer(client, user_store):
    buyer = _seed_buyer(user_store)
    farmer = _seed_farmer(user_store)
    contract_id = (await _create_contract(client, buyer)).json()["id"]
    resp = await client.post(
        f"/v1/contracts/{contract_id}/cancel",
        json={"reason": "Season plan changed"},
        headers=auth(buyer),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"
    stored = user_store[f"contracts/{contract_id}"]
    assert stored["status"] == "cancelled"
    assert stored["cancelReason"] == "Season plan changed"
    notes = _notifications_for(user_store, "uid-f1")
    assert any(n["type"] == "contract_cancelled" for n in notes)

    resp = await client.post(
        f"/v1/contracts/{contract_id}/cancel", json={}, headers=auth(buyer)
    )
    assert resp.status_code == 409


# ---- deliveries ----


async def _active_contract(client, user_store, buyer, farmer, body=FIXED_BODY):
    contract_id = (await _create_contract(client, buyer, body)).json()["id"]
    resp = await client.post(
        f"/v1/contracts/{contract_id}/accept", json=ACCEPT_BODY, headers=auth(farmer)
    )
    assert resp.status_code == 200
    return contract_id


async def test_deliveries_idempotent_and_purchase_shape(client, user_store):
    buyer = _seed_buyer(user_store)
    farmer = _seed_farmer(user_store)
    user_store["mandi_prices/m1"] = MANDI_TOMATO
    user_store["users/uid-b1/role_profiles/directBuyer"] = {"companyName": "Shree Foods Pvt Ltd"}
    contract_id = await _active_contract(client, user_store, buyer, farmer)

    resp = await client.post(
        f"/v1/contracts/{contract_id}/deliveries",
        json={"slotDate": "2026-10-07"},
        headers=auth(buyer),
    )
    assert resp.status_code == 201
    purchase = resp.json()
    purchase_id = purchase["id"]
    assert purchase_id.startswith("pur_")
    assert purchase["status"] == "confirmed"
    assert purchase["buyerId"] == "uid-b1"
    assert purchase["buyerName"] == "Shree Foods Pvt Ltd"
    assert purchase["farmerId"] == "uid-f1"
    assert purchase["farmerName"] == "Ram Patil"
    assert purchase["source"] == {"type": "contract", "refId": contract_id}
    assert purchase["crop"] == "Tomato"
    assert purchase["quantity"] == 10
    assert purchase["unit"] == "quintal"
    assert purchase["agreedPricePerUnit"] == 2200  # fixed → baseRate
    assert purchase["totalAmount"] == 22000
    assert purchase["events"][0]["note"] == "contract delivery"
    assert purchase["escrow"]["status"] == "unfunded"
    assert purchase["contractId"] == contract_id
    assert purchase["deliverySlot"] == "2026-10-07"
    assert user_store[f"purchases/{purchase_id}"]["status"] == "confirmed"

    stored = user_store[f"contracts/{contract_id}"]
    assert stored["deliveries"] == [{"slotDate": "2026-10-07", "purchaseId": purchase_id}]
    assert stored["deliveriesGenerated"] == 1
    notes = _notifications_for(user_store, "uid-f1")
    assert any(n["type"] == "booking_confirmed" and n["data"]["path"] == f"/dashboard/p/purchases/{purchase_id}" for n in notes)

    # second call with same slot is idempotent → 200 with the same purchase
    resp = await client.post(
        f"/v1/contracts/{contract_id}/deliveries",
        json={"slotDate": "2026-10-07"},
        headers=auth(buyer),
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == purchase_id
    assert user_store[f"contracts/{contract_id}"]["deliveriesGenerated"] == 1


async def test_mandi_linked_delivery_rate(client, user_store):
    buyer = _seed_buyer(user_store)
    farmer = _seed_farmer(user_store)
    user_store["mandi_prices/m1"] = MANDI_TOMATO
    contract_id = await _active_contract(client, user_store, buyer, farmer, MANDI_LINKED_BODY)
    resp = await client.post(
        f"/v1/contracts/{contract_id}/deliveries",
        json={"slotDate": "2026-10-08"},
        headers=auth(buyer),
    )
    purchase = resp.json()
    assert purchase["agreedPricePerUnit"] == 2100  # modal 2000 + premium 100
    assert purchase["totalAmount"] == 21000


async def test_deliveries_require_active_and_buyer(client, user_store):
    buyer = _seed_buyer(user_store)
    farmer = _seed_farmer(user_store)
    contract_id = (await _create_contract(client, buyer)).json()["id"]

    resp = await client.post(
        f"/v1/contracts/{contract_id}/deliveries",
        json={"slotDate": "2026-10-07"},
        headers=auth(buyer),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "CONTRACT_NOT_OPEN"

    resp = await client.post(
        f"/v1/contracts/{contract_id}/deliveries",
        json={"slotDate": "2026-10-07"},
        headers=auth(farmer),
    )
    assert resp.status_code == 403


async def test_delivery_list_and_fulfilment(client, user_store):
    buyer = _seed_buyer(user_store)
    farmer = _seed_farmer(user_store)
    contract_id = await _active_contract(client, user_store, buyer, farmer)
    await client.post(
        f"/v1/contracts/{contract_id}/deliveries",
        json={"slotDate": "2026-10-07"},
        headers=auth(buyer),
    )
    purchase_id = user_store[f"contracts/{contract_id}"]["deliveries"][0]["purchaseId"]

    for token in (buyer, farmer):
        resp = await client.get(f"/v1/contracts/{contract_id}/deliveries", headers=auth(token))
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"][0]["slotDate"] == "2026-10-07"
        assert body["data"][0]["purchaseId"] == purchase_id
        assert body["data"][0]["status"] == "confirmed"
        assert body["fulfilment"] == {"total": 1, "completed": 0, "cancelled": 0, "pending": 1}

    stranger = seed_user(user_store, uid="uid-x", active_profile="farmer", name="Alien")
    resp = await client.get(f"/v1/contracts/{contract_id}/deliveries", headers=auth(stranger))
    assert resp.status_code == 403

    user_store[f"purchases/{purchase_id}"]["status"] = "completed"
    resp = await client.get(f"/v1/contracts/{contract_id}/deliveries", headers=auth(buyer))
    assert resp.json()["fulfilment"] == {"total": 1, "completed": 1, "cancelled": 0, "pending": 0}


async def test_contract_delivery_emits_task(client, user_store):
    buyer = _seed_buyer(user_store)
    farmer = _seed_farmer(user_store)
    user_store["mandi_prices/m1"] = MANDI_TOMATO
    user_store["users/uid-b1/role_profiles/directBuyer"] = {"companyName": "Shree Foods Pvt Ltd"}
    contract_id = await _active_contract(client, user_store, buyer, farmer)
    resp = await client.post(
        f"/v1/contracts/{contract_id}/deliveries",
        json={"slotDate": "2026-10-07"},
        headers=auth(buyer),
    )
    assert resp.status_code == 201
    tasks = [doc for key, doc in user_store.items() if key.startswith("tasks/")]
    assert len(tasks) == 1
    task = tasks[0]
    assert task["userId"] == "uid-f1"
    assert task["module"] == "contracts"
    assert task["kind"] == "contract_delivery_due"
    assert task["deepLink"] == f"{DEEP_LINKS['my_contracts']}/{contract_id}"
    assert task["dueAt"] == "2026-10-07"
