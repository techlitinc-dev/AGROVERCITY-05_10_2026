from app.services.tokens import create_access_token


def _seed_user(user_store, uid, name, phone="+919876543210", active="directBuyer", **extra):
    user_store[f"users/{uid}"] = {
        "id": uid,
        "name": name,
        "phone": phone,
        "state": "Maharashtra",
        "district": "Nashik",
        "village": "Pimplas",
        "linkedProfiles": ["directBuyer", "farmer"],
        "primaryProfile": "directBuyer",
        "activeProfile": active,
        **extra,
    }
    # WS-02 step 7: corporate-buyer KYC gate — grant an approved GST doc so the
    # org tests can create contracts (fixture only).
    user_store[f"kyc_cases/kyc_{uid}_directBuyer"] = {
        "caseId": f"kyc_{uid}_directBuyer",
        "userId": uid,
        "persona": "directBuyer",
        "docs": [
            {"docId": f"kyc_{uid}_directBuyer:gst", "type": "gst", "status": "verified"},
        ],
        "status": "verified",
    }
    # WS-02 step 10: team RBAC (org invites) is Enterprise-only and QC is Pro+ —
    # grant Enterprise so the org flows run post-entitlement (fixture only).
    user_store[f"subscriptions/sub_ent_{uid}"] = {
        "userId": uid,
        "planId": "directBuyer_enterprise",
        "status": "active",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    return create_access_token(uid)


def _seed_purchase(user_store, pid, buyer_id, farmer_id, **extra):
    doc = {
        "id": pid,
        "buyerId": buyer_id,
        "buyerName": "Agro Corp",
        "farmerId": farmer_id,
        "farmerName": "Kisan Ram",
        "source": {"type": "contract", "refId": "con_123"},
        "crop": "Tomato",
        "variety": "",
        "quantity": 10.0,
        "unit": "quintal",
        "agreedPricePerUnit": 2000,
        "totalAmount": 20000,
        "advancePaid": 0,
        "status": "confirmed",
        "pickup": None,
        "payments": [],
        "qc": None,
        "finalAmount": None,
        "invoice": None,
        "events": [],
        "rating": {"buyerToFarmer": None, "farmerToBuyer": None},
        "escrow": {
            "status": "unfunded",
            "amount": 0,
        },
        "handover": {
            "verifiedAt": None,
        },
        "createdAt": "2026-10-01T00:00:00+00:00",
        "updatedAt": "2026-10-01T00:00:00+00:00",
    }
    doc.update(extra)
    user_store[f"purchases/{pid}"] = doc
    return doc


async def test_invite_registered_user_and_get_org(client, user_store):
    admin_token = _seed_user(user_store, "uid-admin", "Buyer Admin", phone="+919876500001", active="directBuyer")
    _seed_user(user_store, "uid-qa-user", "QA Inspector", phone="+919876500002", active="directBuyer")

    # Invite registered user with phone
    resp = await client.post(
        "/v1/buyer-org/invite",
        json={"phone": "+919876500002", "role": "qa"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert data["member"]["uid"] == "uid-qa-user"
    assert data["member"]["role"] == "qa"

    # Verify user appears in GET /buyer-org
    get_resp = await client.get(
        "/v1/buyer-org",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert get_resp.status_code == 200
    org_data = get_resp.json()
    assert org_data["adminUid"] == "uid-admin"
    qa_m = next((m for m in org_data["members"] if m["uid"] == "uid-qa-user"), None)
    assert qa_m is not None
    assert qa_m["role"] == "qa"


async def test_invite_unregistered_phone(client, user_store):
    admin_token = _seed_user(user_store, "uid-admin2", "Buyer Admin 2", phone="+919876500003")

    resp = await client.post(
        "/v1/buyer-org/invite",
        json={"phone": "+919999900000", "role": "finance"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "USER_NOT_FOUND"


async def test_remove_member(client, user_store):
    admin_token = _seed_user(user_store, "uid-admin3", "Buyer Admin 3", phone="+919876500004")
    _seed_user(user_store, "uid-to-remove", "Remove Me", phone="+919876500005")

    await client.post(
        "/v1/buyer-org/invite",
        json={"phone": "+919876500005", "role": "procurement"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    del_resp = await client.delete(
        "/v1/buyer-org/members/uid-to-remove",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert del_resp.status_code == 200
    assert not any(m["uid"] == "uid-to-remove" for m in del_resp.json()["members"])


async def test_escrow_fund_role_gating(client, user_store):
    admin_token = _seed_user(user_store, "uid-admin4", "Buyer Admin 4", phone="+919876500006")
    fin_token = _seed_user(user_store, "uid-fin", "Finance Member", phone="+919876500007")
    proc_token = _seed_user(user_store, "uid-proc", "Procurement Member", phone="+919876500008")
    _seed_user(user_store, "uid-farmer4", "Farmer 4", phone="+919876500009", active="farmer")

    # Invite finance and procurement members
    await client.post(
        "/v1/buyer-org/invite",
        json={"phone": "+919876500007", "role": "finance"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    await client.post(
        "/v1/buyer-org/invite",
        json={"phone": "+919876500008", "role": "procurement"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    # Seed purchase belonging to uid-admin4
    _seed_purchase(user_store, "pur_escrow_gate", "uid-admin4", "uid-farmer4")

    # Procurement member funding escrow -> 403 ORG_ROLE_REQUIRED
    resp_proc = await client.post(
        "/v1/purchases/pur_escrow_gate/escrow/fund",
        json={"amount": 20000, "method": "upi", "reference": "UTR123"},
        headers={"Authorization": f"Bearer {proc_token}"},
    )
    assert resp_proc.status_code == 403
    assert resp_proc.json()["error"]["code"] == "ORG_ROLE_REQUIRED"

    # Finance member funding escrow -> 200 OK
    resp_fin = await client.post(
        "/v1/purchases/pur_escrow_gate/escrow/fund",
        json={"amount": 20000, "method": "upi", "reference": "UTR123"},
        headers={"Authorization": f"Bearer {fin_token}"},
    )
    assert resp_fin.status_code == 200
    assert resp_fin.json()["escrow"]["status"] == "held"


async def test_qc_role_gating(client, user_store):
    admin_token = _seed_user(user_store, "uid-admin5", "Buyer Admin 5", phone="+919876500010")
    qa_token = _seed_user(user_store, "uid-qa", "QA Member", phone="+919876500011")
    fin_token = _seed_user(user_store, "uid-fin2", "Finance Member 2", phone="+919876500012")
    _seed_user(user_store, "uid-farmer5", "Farmer 5", phone="+919876500013", active="farmer")

    await client.post(
        "/v1/buyer-org/invite",
        json={"phone": "+919876500011", "role": "qa"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    await client.post(
        "/v1/buyer-org/invite",
        json={"phone": "+919876500012", "role": "finance"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    # Seed delivered purchase with verified handover
    _seed_purchase(
        user_store,
        "pur_qc_gate",
        "uid-admin5",
        "uid-farmer5",
        status="delivered",
        escrow={"status": "held", "amount": 20000},
        handover={"verifiedAt": "2026-10-01T00:00:00+00:00"},
    )

    # Finance member submits QC -> 403 ORG_ROLE_REQUIRED
    resp_fin = await client.post(
        "/v1/purchases/pur_qc_gate/qc",
        json={"grade": "A", "acceptedQty": 10.0, "rejectedQty": 0.0},
        headers={"Authorization": f"Bearer {fin_token}"},
    )
    assert resp_fin.status_code == 403
    assert resp_fin.json()["error"]["code"] == "ORG_ROLE_REQUIRED"

    # QA member submits QC -> 200 OK
    resp_qa = await client.post(
        "/v1/purchases/pur_qc_gate/qc",
        json={"grade": "A", "acceptedQty": 10.0, "rejectedQty": 0.0},
        headers={"Authorization": f"Bearer {qa_token}"},
    )
    assert resp_qa.status_code == 200
    assert resp_qa.json()["status"] == "completed"


async def test_contract_create_role_gating(client, user_store):
    admin_token = _seed_user(user_store, "uid-admin6", "Buyer Admin 6", phone="+919876500014")
    proc_token = _seed_user(user_store, "uid-proc2", "Proc Member 2", phone="+919876500015")
    qa_token = _seed_user(user_store, "uid-qa2", "QA Member 2", phone="+919876500016")
    _seed_user(user_store, "uid-farmer6", "Farmer 6", phone="+919876500017", active="farmer")

    await client.post(
        "/v1/buyer-org/invite",
        json={"phone": "+919876500015", "role": "procurement"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    await client.post(
        "/v1/buyer-org/invite",
        json={"phone": "+919876500016", "role": "qa"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    contract_body = {
        "farmerId": "uid-farmer6",
        "crop": "Wheat",
        "quantityTotal": 50.0,
        "priceType": "fixed",
        "baseRate": 2200,
        "schedule": {
            "startDate": "2026-11-01",
            "endDate": "2026-11-30",
            "frequency": "weekly",
            "qtyPerDelivery": 12.5,
        },
    }

    # QA member creates contract -> 403 ORG_ROLE_REQUIRED
    resp_qa = await client.post(
        "/v1/contracts",
        json=contract_body,
        headers={"Authorization": f"Bearer {qa_token}"},
    )
    assert resp_qa.status_code == 403
    assert resp_qa.json()["error"]["code"] == "ORG_ROLE_REQUIRED"

    # Procurement member creates contract -> 201 Created
    resp_proc = await client.post(
        "/v1/contracts",
        json=contract_body,
        headers={"Authorization": f"Bearer {proc_token}"},
    )
    assert resp_proc.status_code == 201
    assert resp_proc.json()["crop"] == "Wheat"
