"""Missing dairy endpoints: farm-gate farmer OTP (P0-7), QR-anchored
collection (P1-13), booking contract MPIN e-sign (P1-14), procurement route
lifecycle (P2-9), pickup-team reassignment (P2-10), pickup slot calendar
(P2-11), commission payout statement (P2-12) and farmer reliability (P2-13).

All assertions run against docs created through the API or real collection
docs seeded into the store — the real API drives every flow.
"""

from datetime import datetime, timedelta, timezone

from app.core.security import hash_mpin
from app.services.tokens import create_access_token
from tests.test_diary import auth, seed_user

MANAGER = {"uid": "mgr-1", "active_profile": "dairyManager"}
OTHER_MANAGER = {"uid": "mgr-2", "active_profile": "dairyManager"}
FARMER = {"uid": "farmer-1", "active_profile": "farmer"}
OTHER_FARMER = {"uid": "farmer-2", "active_profile": "farmer"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _collection_payload(**overrides):
    payload = {
        "farmerId": "farmer-1",
        "farmerName": "Ramesh Patil",
        "milkType": "Buffalo",
        "quantityLiters": 40.0,
        "fatPercent": 6.8,
        "snfPercent": 9.2,
        "ratePerLiter": 66.5,
        "qualityStatus": "accepted",
    }
    payload.update(overrides)
    return payload


async def _create_collection(client, token, **overrides):
    resp = await client.post(
        "/v1/dairy-manager/collection-check",
        json=_collection_payload(**overrides),
        headers=auth(token),
    )
    assert resp.status_code == 201
    return resp.json()


async def _make_dairy_pro(user_store, uid="mgr-1"):
    from app.services.billing import seed_plans

    await seed_plans()
    user_store[f"subscriptions/sub_pro_{uid}"] = {
        "subId": f"sub_pro_{uid}",
        "userId": uid,
        "planId": "dairyManager_pro",
        "status": "active",
        "provider": "razorpay_sub",
        "providerRef": f"sub_test_{uid}",
        "currentPeriodEnd": "2027-01-01T00:00:00+00:00",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }


async def _accept_dairy_bid(client, manager_token, farmer_uid="farmer-1"):
    """demand -> bid -> accept, returns the created dairy purchase."""
    demand_resp = await client.post(
        "/v1/dairy-manager/demands",
        json={
            "milkType": "Buffalo",
            "minFatPercent": 6.0,
            "minSnfPercent": 9.0,
            "dailyQuantityLiters": 500.0,
            "targetRatePerLiter": 62.0,
        },
        headers=auth(manager_token),
    )
    assert demand_resp.status_code == 201
    bid_resp = await client.post(
        "/v1/dairy-manager/bids",
        json={
            "rfqId": demand_resp.json()["id"],
            "farmerId": farmer_uid,
            "farmerName": "Ramesh Patil",
            "offeredRatePerLiter": 63.5,
            "dailyLiters": 200.0,
        },
        headers=auth(manager_token),
    )
    assert bid_resp.status_code == 201
    accept_resp = await client.post(
        f"/v1/dairy-manager/bids/{bid_resp.json()['id']}/accept",
        headers={**auth(manager_token), "Idempotency-Key": f"accept-{farmer_uid}-1"},
    )
    assert accept_resp.status_code in (200, 201)
    return accept_resp.json()["purchase"]


# --- P0-7: farm-gate collection farmer OTP ---


async def test_collection_otp_send_reveal_verify_flow(client, user_store):
    manager = seed_user(user_store, **MANAGER)
    farmer = seed_user(user_store, **FARMER)
    collection = await _create_collection(client, manager)
    cid = collection["id"]

    # manager triggers the OTP — expiresAt returned, OTP itself never returned
    resp = await client.post(
        "/v1/dairy-manager/collections/otp/send",
        json={"collectionId": cid},
        headers=auth(manager),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["collectionId"] == cid
    assert "otp" not in body
    assert body["expiresAt"] > _now()
    assert body["validMinutes"] == 10

    # farmer reveals it in-app
    resp = await client.get(f"/v1/dairy/collections/{cid}/otp", headers=auth(farmer))
    assert resp.status_code == 200
    otp = resp.json()["otp"]
    assert len(otp) == 6 and otp.isdigit()

    # wrong OTP -> 400, right OTP -> server-set flag
    wrong = "000000" if otp != "000000" else "999999"
    resp = await client.post(
        "/v1/dairy-manager/collections/otp/verify",
        json={"collectionId": cid, "otp": wrong},
        headers=auth(manager),
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "INVALID_OTP"

    resp = await client.post(
        "/v1/dairy-manager/collections/otp/verify",
        json={"collectionId": cid, "otp": otp},
        headers=auth(manager),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["farmerOtpVerified"] is True
    assert body["farmerOtpVerifiedAt"]
    assert body["verification"]["method"] == "otp"
    stored = user_store[f"dairy_collections/{cid}"]
    assert stored["farmerOtpVerified"] is True
    assert stored["farmerOtpVerifiedAt"]

    # re-verify -> 409
    resp = await client.post(
        "/v1/dairy-manager/collections/otp/verify",
        json={"collectionId": cid, "otp": otp},
        headers=auth(manager),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "ALREADY_VERIFIED"


async def test_collection_otp_reveal_and_send_guards(client, user_store):
    manager = seed_user(user_store, **MANAGER)
    farmer = seed_user(user_store, **FARMER)
    other_farmer = seed_user(user_store, **OTHER_FARMER)
    collection = await _create_collection(client, manager)
    cid = collection["id"]

    # nothing sent yet -> farmer cannot reveal
    resp = await client.get(f"/v1/dairy/collections/{cid}/otp", headers=auth(farmer))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "OTP_NOT_FOUND"

    await client.post(
        "/v1/dairy-manager/collections/otp/send",
        json={"collectionId": cid},
        headers=auth(manager),
    )

    # only the farmer of the collection may reveal
    resp = await client.get(f"/v1/dairy/collections/{cid}/otp", headers=auth(other_farmer))
    assert resp.status_code == 403
    resp = await client.get(f"/v1/dairy/collections/{cid}/otp", headers=auth(manager))
    assert resp.status_code == 403

    # expired OTP -> farmer sees 409, verify sees 400
    user_store[f"dairy_collections/{cid}"]["farmerOtpExpiresAt"] = (
        datetime.now(timezone.utc) - timedelta(minutes=1)
    ).isoformat()
    resp = await client.get(f"/v1/dairy/collections/{cid}/otp", headers=auth(farmer))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "OTP_EXPIRED"
    resp = await client.post(
        "/v1/dairy-manager/collections/otp/verify",
        json={"collectionId": cid, "otp": "123456"},
        headers=auth(manager),
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "OTP_EXPIRED"

    # unknown collection / other manager's collection
    resp = await client.post(
        "/v1/dairy-manager/collections/otp/send",
        json={"collectionId": "col_missing"},
        headers=auth(manager),
    )
    assert resp.status_code == 404
    other_manager = seed_user(user_store, **OTHER_MANAGER)
    resp = await client.post(
        "/v1/dairy-manager/collections/otp/send",
        json={"collectionId": cid},
        headers=auth(other_manager),
    )
    assert resp.status_code == 404
    resp = await client.post(
        "/v1/dairy-manager/collections/otp/verify",
        json={"collectionId": cid, "otp": "123456"},
        headers=auth(other_manager),
    )
    assert resp.status_code == 404


async def test_collection_otp_verify_requires_generated_otp(client, user_store):
    manager = seed_user(user_store, **MANAGER)
    collection = await _create_collection(client, manager)
    resp = await client.post(
        "/v1/dairy-manager/collections/otp/verify",
        json={"collectionId": collection["id"], "otp": "123456"},
        headers=auth(manager),
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "OTP_NOT_GENERATED"


# --- P1-13: QR-anchored collection ---


async def test_collection_qr_issue_and_scan_anchors_payment(client, user_store):
    manager = seed_user(user_store, **MANAGER)
    collection = await _create_collection(client, manager)
    cid = collection["id"]

    resp = await client.post(
        "/v1/dairy-manager/collections/qr",
        json={"collectionId": cid},
        headers=auth(manager),
    )
    assert resp.status_code == 200
    issued = resp.json()
    token = issued["token"]
    assert len(token) == 32
    int(token, 16)  # uuid hex
    assert issued["status"] == "active"
    assert issued["expiresAt"] > _now()

    # manager scans at pickup -> anchors both ledgers like OTP would
    resp = await client.post(
        "/v1/dairy-manager/collections/qr/scan",
        json={"token": token},
        headers=auth(manager),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["qrStatus"] == "scanned"
    assert body["qrVerified"] is True
    assert body["qrVerifiedAt"]
    assert body["farmerOtpVerified"] is True  # same anchor flag the OTP path sets
    assert body["farmerOtpVerifiedAt"]
    assert body["verification"]["method"] == "qr"

    # second scan -> 409
    resp = await client.post(
        "/v1/dairy-manager/collections/qr/scan",
        json={"token": token},
        headers=auth(manager),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "QR_ALREADY_SCANNED"


async def test_collection_qr_guards(client, user_store):
    manager = seed_user(user_store, **MANAGER)
    other_manager = seed_user(user_store, **OTHER_MANAGER)
    collection = await _create_collection(client, manager)

    # unknown token
    resp = await client.post(
        "/v1/dairy-manager/collections/qr/scan",
        json={"token": "f" * 32},
        headers=auth(manager),
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "QR_TOKEN_NOT_FOUND"

    # other manager cannot issue a QR for this collection
    resp = await client.post(
        "/v1/dairy-manager/collections/qr",
        json={"collectionId": collection["id"]},
        headers=auth(other_manager),
    )
    assert resp.status_code == 404

    # other manager scanning the real token also gets 404 (not found for them)
    issued = (
        await client.post(
            "/v1/dairy-manager/collections/qr",
            json={"collectionId": collection["id"]},
            headers=auth(manager),
        )
    ).json()
    resp = await client.post(
        "/v1/dairy-manager/collections/qr/scan",
        json={"token": issued["token"]},
        headers=auth(other_manager),
    )
    assert resp.status_code == 404

    # expired token
    cid = collection["id"]
    user_store[f"dairy_collections/{cid}"]["qrExpiresAt"] = (
        datetime.now(timezone.utc) - timedelta(minutes=1)
    ).isoformat()
    resp = await client.post(
        "/v1/dairy-manager/collections/qr/scan",
        json={"token": issued["token"]},
        headers=auth(manager),
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "QR_EXPIRED"


# --- P1-14: booking contract MPIN e-sign ---


async def test_contract_esign_multi_party_flow(client, user_store):
    manager = seed_user(user_store, **MANAGER)
    farmer = seed_user(user_store, **FARMER)
    bystander = seed_user(user_store, uid="farmer-9", active_profile="farmer")
    purchase = await _accept_dairy_bid(client, manager)
    pid = purchase["id"]

    # only the two parties may sign
    user_store["users/farmer-9"]["mpinHash"] = hash_mpin("9999")
    resp = await client.post(
        f"/v1/dairy/purchases/{pid}/contract/esign",
        json={"mpin": "9999"},
        headers=auth(bystander),
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"

    # MPIN not set yet -> 409
    resp = await client.post(
        f"/v1/dairy/purchases/{pid}/contract/esign",
        json={"mpin": "1111"},
        headers=auth(farmer),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "MPIN_NOT_SET"

    user_store["users/farmer-1"]["mpinHash"] = hash_mpin("1111")
    user_store["users/mgr-1"]["mpinHash"] = hash_mpin("2222")

    # wrong MPIN -> 401
    resp = await client.post(
        f"/v1/dairy/purchases/{pid}/contract/esign",
        json={"mpin": "0000"},
        headers=auth(farmer),
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "WRONG_MPIN"

    # farmer signs first — contract still pending
    resp = await client.post(
        f"/v1/dairy/purchases/{pid}/contract/esign",
        json={"mpin": "1111", "signatureData": "sig-farmer", "consentTimestamp": "2026-10-17T10:00:00+00:00"},
        headers=auth(farmer),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["contractStatus"] == "pending"
    assert body["signedBy"] == ["farmer-1"]
    assert body["termSheet"]["ratePaisaPerUnit"] == 6350
    assert body["termSheet"]["totalAmountPaisa"] == purchase["totalAmount"]
    stored = user_store[f"purchases/{pid}/acceptances/farmer-1"]
    assert stored["userId"] == "farmer-1"
    assert stored["signatureData"] == "sig-farmer"
    assert stored["consentTimestamp"] == "2026-10-17T10:00:00+00:00"
    assert stored["acceptedAt"]

    # manager signs -> contract signed
    resp = await client.post(
        f"/v1/dairy/purchases/{pid}/contract/esign",
        json={"mpin": "2222", "signatureData": "sig-manager"},
        headers=auth(manager),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["contractStatus"] == "signed"
    assert sorted(body["signedBy"]) == ["farmer-1", "mgr-1"]
    assert user_store[f"purchases/{pid}/acceptances/mgr-1"]["userId"] == "mgr-1"
    assert user_store[f"purchases/{pid}"]["contractStatus"] == "signed"
    assert user_store[f"purchases/{pid}"]["contractSignedAt"]


async def test_contract_esign_not_found_for_non_dairy_purchase(client, user_store):
    manager = seed_user(user_store, **MANAGER)
    user_store["purchases/pur_x"] = {
        "id": "pur_x",
        "buyerId": "mgr-1",
        "farmerId": "farmer-1",
        "source": {"type": "lot", "refId": "lot1"},
        "status": "confirmed",
        "createdAt": _now(),
    }
    resp = await client.post(
        "/v1/dairy/purchases/pur_x/contract/esign",
        json={"mpin": "1111"},
        headers=auth(manager),
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "PURCHASE_NOT_FOUND"


# --- P2-9: procurement route lifecycle ---


async def test_route_status_lifecycle(client, user_store):
    manager = seed_user(user_store, **MANAGER)
    other_manager = seed_user(user_store, **OTHER_MANAGER)

    async def _create_route(name):
        resp = await client.post(
            "/v1/dairy-manager/routes",
            json={
                "routeName": name,
                "assignedAgentName": "Ramesh Dhangar",
                "scheduledDate": "2026-10-18",
                "stops": [],
            },
            headers=auth(manager),
        )
        assert resp.status_code == 201
        return resp.json()

    route = await _create_route("Morning Route Gamma")
    rid = route["id"]
    assert route["status"] == "planned"

    # planned -> dispatched (with note)
    resp = await client.post(
        f"/v1/dairy-manager/routes/{rid}/status",
        json={"status": "dispatched", "note": "agent left the center"},
        headers=auth(manager),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "dispatched"
    assert body["dispatchedAt"]
    assert body["statusHistory"][-1]["note"] == "agent left the center"

    # dispatched -> dispatched is invalid
    resp = await client.post(
        f"/v1/dairy-manager/routes/{rid}/status",
        json={"status": "dispatched"},
        headers=auth(manager),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "INVALID_TRANSITION"

    # dispatched -> completed, terminal afterwards
    resp = await client.post(
        f"/v1/dairy-manager/routes/{rid}/status",
        json={"status": "completed"},
        headers=auth(manager),
    )
    assert resp.status_code == 200
    assert resp.json()["completedAt"]
    resp = await client.post(
        f"/v1/dairy-manager/routes/{rid}/status",
        json={"status": "cancelled"},
        headers=auth(manager),
    )
    assert resp.status_code == 409

    # planned -> cancelled on a second route
    route2 = await _create_route("Evening Route Delta")
    resp = await client.post(
        f"/v1/dairy-manager/routes/{route2['id']}/status",
        json={"status": "cancelled", "note": "rain"},
        headers=auth(manager),
    )
    assert resp.status_code == 200
    assert resp.json()["cancelledAt"]

    # other manager cannot touch the route
    resp = await client.post(
        f"/v1/dairy-manager/routes/{route2['id']}/status",
        json={"status": "dispatched"},
        headers=auth(other_manager),
    )
    assert resp.status_code == 404
    resp = await client.post(
        "/v1/dairy-manager/routes/rt_missing/status",
        json={"status": "dispatched"},
        headers=auth(manager),
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "ROUTE_NOT_FOUND"


# --- P2-10: pickup-team reassignment ---


async def test_agent_reassignment_by_managing_manager(client, user_store):
    manager = seed_user(user_store, **MANAGER)
    seed_user(user_store, uid="agent-1", active_profile="farmer")
    await _make_dairy_pro(user_store)

    created = await client.post(
        "/v1/livestock/dairy/agents",
        json={"uid": "agent-1", "name": "Ganesh Chavan", "routeIds": ["rt-1"]},
        headers={**auth(manager), "Idempotency-Key": "agent-create-1"},
    )
    assert created.status_code == 201
    agent_id = created.json()["id"]

    # reassign: new name + new routes
    resp = await client.put(
        "/v1/livestock/dairy/agents/agent-1",
        json={"name": "Ganesh Dhangar", "routeIds": ["rt-2", "rt-3"]},
        headers=auth(manager),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == agent_id
    assert body["name"] == "Ganesh Dhangar"
    assert body["routeIds"] == ["rt-2", "rt-3"]
    assert user_store[f"dairy_agents/{agent_id}"]["routeIds"] == ["rt-2", "rt-3"]

    # deactivate via PUT as well
    resp = await client.put(
        "/v1/livestock/dairy/agents/agent-1",
        json={"active": False},
        headers=auth(manager),
    )
    assert resp.status_code == 200
    assert resp.json()["active"] is False


async def test_agent_reassignment_scoped_to_managing_manager(client, user_store):
    manager = seed_user(user_store, **MANAGER)
    other_manager = seed_user(user_store, **OTHER_MANAGER)
    agent_login = seed_user(user_store, uid="agent-1", active_profile="farmer")
    await _make_dairy_pro(user_store)

    created = await client.post(
        "/v1/livestock/dairy/agents",
        json={"uid": "agent-1", "name": "Ganesh Chavan"},
        headers={**auth(manager), "Idempotency-Key": "agent-create-2"},
    )
    assert created.status_code == 201

    # another manager cannot reassign this agent
    resp = await client.put(
        "/v1/livestock/dairy/agents/agent-1",
        json={"name": "Hijacked"},
        headers=auth(other_manager),
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "AGENT_NOT_FOUND"

    # the agent (farmer profile) cannot use the manager surface
    resp = await client.put(
        "/v1/livestock/dairy/agents/agent-1",
        json={"name": "Self"},
        headers=auth(agent_login),
    )
    assert resp.status_code == 403


# --- P2-11: pickup slot calendar ---


async def test_pickup_slots_list_and_book(client, user_store):
    manager = seed_user(user_store, **MANAGER)
    collection = await _create_collection(client, manager)
    cid = collection["id"]

    # first listing provisions the default calendar for the date
    resp = await client.get("/v1/dairy-manager/pickup-slots?date=2026-10-20", headers=auth(manager))
    assert resp.status_code == 200
    body = resp.json()
    assert body["date"] == "2026-10-20"
    assert body["total"] == 2
    windows = {s["window"] for s in body["data"]}
    assert windows == {"Morning (06:00 - 08:30)", "Evening (17:00 - 19:30)"}
    assert all(s["capacity"] == 10 for s in body["data"])
    assert all(s["bookedCount"] == 0 for s in body["data"])

    # listing again returns the same persisted slots
    again = await client.get("/v1/dairy-manager/pickup-slots?date=2026-10-20", headers=auth(manager))
    assert again.status_code == 200
    assert again.json()["total"] == 2

    # book the morning slot with a collection
    morning = next(s for s in body["data"] if s["window"].startswith("Morning"))
    resp = await client.post(
        f"/v1/dairy-manager/pickup-slots/{morning['id']}/book",
        json={"collectionId": cid},
        headers=auth(manager),
    )
    assert resp.status_code == 200
    assert resp.json()["bookedCount"] == 1
    assert resp.json()["bookedCollectionIds"] == [cid]

    # re-booking the same collection is idempotent
    resp = await client.post(
        f"/v1/dairy-manager/pickup-slots/{morning['id']}/book",
        json={"collectionId": cid},
        headers=auth(manager),
    )
    assert resp.status_code == 200
    assert resp.json()["bookedCount"] == 1

    # invalid date
    resp = await client.get("/v1/dairy-manager/pickup-slots?date=20-10-2026", headers=auth(manager))
    assert resp.status_code == 422


async def test_pickup_slot_capacity_and_ownership(client, user_store):
    manager = seed_user(user_store, **MANAGER)
    other_manager = seed_user(user_store, **OTHER_MANAGER)

    # full slot rejects new bookings
    user_store["dairy_pickup_slots/slot_full"] = {
        "id": "slot_full",
        "managerId": "mgr-1",
        "date": "2026-10-21",
        "window": "Morning (06:00 - 08:30)",
        "capacity": 1,
        "bookedCount": 1,
        "bookedCollectionIds": ["col_existing"],
        "createdAt": _now(),
    }
    resp = await client.post(
        "/v1/dairy-manager/pickup-slots/slot_full/book",
        json={},
        headers=auth(manager),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "SLOT_FULL"

    # booking against an unknown or foreign collection fails
    resp = await client.post(
        "/v1/dairy-manager/pickup-slots/slot_full/book",
        json={"collectionId": "col_missing"},
        headers=auth(manager),
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "COLLECTION_NOT_FOUND"
    foreign = await _create_collection(client, other_manager)
    resp = await client.post(
        "/v1/dairy-manager/pickup-slots/slot_full/book",
        json={"collectionId": foreign["id"]},
        headers=auth(manager),
    )
    assert resp.status_code == 404

    # other manager cannot see or book the slot
    resp = await client.get("/v1/dairy-manager/pickup-slots?date=2026-10-21", headers=auth(other_manager))
    assert resp.status_code == 200
    assert resp.json()["total"] == 2  # their own freshly provisioned calendar
    assert all(s["managerId"] == "mgr-2" for s in resp.json()["data"])
    resp = await client.post(
        "/v1/dairy-manager/pickup-slots/slot_full/book",
        json={},
        headers=auth(other_manager),
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "PICKUP_SLOT_NOT_FOUND"


# --- P2-12: commission payout statement ---


async def test_commission_statements_json_and_csv(client, user_store):
    manager = seed_user(user_store, **MANAGER)
    farmer = seed_user(user_store, **FARMER)
    purchase = await _accept_dairy_bid(client, manager)
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    trade = purchase["totalAmount"]
    expected_commission = int(round(trade * 0.03))

    # manager-side statement
    resp = await client.get(
        f"/v1/dairy/commission-statements?month={month}",
        headers=auth(manager),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["month"] == month
    assert len(body["rows"]) == 1
    row = body["rows"][0]
    assert row["purchaseId"] == purchase["id"]
    assert row["tradeAmountPaisa"] == trade
    assert row["commissionPercent"] == 3.0
    assert row["commissionPaisa"] == expected_commission
    assert row["farmerPayoutPaisa"] == trade - expected_commission
    assert body["totals"]["tradeAmountPaisa"] == trade
    assert body["totals"]["commissionPaisa"] == expected_commission
    assert body["totals"]["farmerPayoutPaisa"] == trade - expected_commission
    assert body["totals"]["count"] == 1

    # farmer sees their own sales statement
    resp = await client.get(
        f"/v1/dairy/commission-statements?month={month}",
        headers=auth(farmer),
    )
    assert resp.status_code == 200
    assert [r["purchaseId"] for r in resp.json()["rows"]] == [purchase["id"]]

    # CSV export
    resp = await client.get(
        f"/v1/dairy/commission-statements?month={month}&format=csv",
        headers=auth(manager),
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    text = resp.text
    assert "purchaseId,date,buyerName,farmerName" in text
    assert purchase["id"] in text
    assert str(expected_commission) in text

    # invalid month
    resp = await client.get("/v1/dairy/commission-statements?month=2026-13", headers=auth(manager))
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"

    # unrelated roles are locked out
    transporter = seed_user(user_store, uid="tr-1", active_profile="transporter")
    resp = await client.get(
        f"/v1/dairy/commission-statements?month={month}",
        headers=auth(transporter),
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"


# --- P2-13: farmer reliability ---


async def test_farmer_reliability_deterministic_score(client, user_store):
    manager = seed_user(user_store, **MANAGER)
    farmer = seed_user(user_store, **FARMER)
    other_farmer = seed_user(user_store, **OTHER_FARMER)

    # 3 completed collections with slight FAT/SNF variance + 1 missed pickup
    await _create_collection(client, manager, fatPercent=6.8, snfPercent=9.2)
    await _create_collection(client, manager, fatPercent=6.6, snfPercent=9.0)
    await _create_collection(client, manager, fatPercent=7.0, snfPercent=9.4)
    user_store["dairy_collections/col_no_show"] = {
        "id": "col_no_show",
        "managerId": "mgr-1",
        "farmerId": "farmer-1",
        "milkType": "Buffalo",
        "qualityStatus": "accepted",
        "noShow": True,
        "collectedAt": _now(),
    }

    resp = await client.get("/v1/dairy/farmers/farmer-1/reliability", headers=auth(manager))
    assert resp.status_code == 200
    body = resp.json()
    components = body["components"]
    # pstdev([6.8, 6.6, 7.0]) = pstdev([9.2, 9.0, 9.4]) ≈ 0.16
    assert components["completedCollections"] == 3
    assert components["noShows"] == 1
    assert components["scheduledCollections"] == 4
    assert components["showUpRatePercent"] == 75.0
    assert components["fatStdDev"] == 0.16
    assert components["snfStdDev"] == 0.16
    assert components["gradeConsistencyPercent"] == 92.0
    assert components["disputeCount"] == 0
    assert body["reliabilityScore"] == 85.1  # 0.5*75 + 0.3*92 + 0.2*100
    assert "showUpRate" in body["formula"]

    # deterministic: same call, same score
    repeat = await client.get("/v1/dairy/farmers/farmer-1/reliability", headers=auth(manager))
    assert repeat.json()["reliabilityScore"] == body["reliabilityScore"]

    # a dispute on a dairy purchase lowers the score by the documented formula
    user_store["purchases/pur_dsp"] = {
        "id": "pur_dsp",
        "buyerId": "mgr-1",
        "farmerId": "farmer-1",
        "source": {"type": "dairy", "refId": "dm_x"},
        "status": "completed",
        "createdAt": _now(),
    }
    user_store["disputes/dsp_1"] = {
        "id": "dsp_1",
        "source": "purchase",
        "sourceId": "pur_dsp",
        "status": "open",
        "createdAt": _now(),
    }
    resp = await client.get("/v1/dairy/farmers/farmer-1/reliability", headers=auth(manager))
    assert resp.status_code == 200
    body = resp.json()
    assert body["components"]["disputeCount"] == 1
    assert body["components"]["disputeScorePercent"] == 75
    assert body["reliabilityScore"] == 80.1  # 0.5*75 + 0.3*92 + 0.2*75

    # the farmer may view their own score; other farmers may not
    resp = await client.get("/v1/dairy/farmers/farmer-1/reliability", headers=auth(farmer))
    assert resp.status_code == 200
    resp = await client.get("/v1/dairy/farmers/farmer-1/reliability", headers=auth(other_farmer))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"

    # unknown farmer
    resp = await client.get("/v1/dairy/farmers/nobody/reliability", headers=auth(manager))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "FARMER_NOT_FOUND"


async def test_farmer_reliability_no_history_is_neutral(client, user_store):
    manager = seed_user(user_store, **MANAGER)
    farmer = seed_user(user_store, **FARMER)
    resp = await client.get("/v1/dairy/farmers/farmer-1/reliability", headers=auth(manager))
    assert resp.status_code == 200
    body = resp.json()
    assert body["reliabilityScore"] == 100.0
    assert body["components"]["showUpRatePercent"] == 100.0
    assert body["components"]["gradeConsistencyPercent"] == 100.0
