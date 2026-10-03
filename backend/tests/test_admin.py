from tests.test_diary import auth, seed_user


def _seed_admin(user_store, uid="admin-root"):
    user_store[f"users/{uid}"] = {
        "id": uid,
        "name": "Super Admin Root",
        "phone": "+919999999999",
        "linkedProfiles": ["farmer", "seller"],
        "activeProfile": "admin",
        "primaryProfile": "farmer",
        "isAdmin": True,
        "agriCoins": 1000,
    }
    from app.services.tokens import create_access_token
    return create_access_token(uid)


async def test_admin_overview_metrics(client, user_store):
    admin_token = _seed_admin(user_store)
    # seed normal farmers
    seed_user(user_store, uid="u-f1", active_profile="farmer")
    seed_user(user_store, uid="u-t1", active_profile="transporter")

    resp = await client.get("/v1/admin/overview", headers=auth(admin_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["activeUsersTotal"] >= 3
    assert "farmer" in body["personaBreakdown"]
    assert body["platformHealth"] == "100% Operational"


async def test_non_admin_forbidden(client, user_store):
    farmer_token = seed_user(user_store, uid="u-farmer-norm")
    resp = await client.get("/v1/admin/overview", headers=auth(farmer_token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ADMIN"


async def test_admin_list_users_with_filter(client, user_store):
    admin_token = _seed_admin(user_store)
    seed_user(user_store, uid="u-f2", active_profile="farmer", name="Arun Shinde")
    
    resp = await client.get("/v1/admin/users?search=Arun", headers=auth(admin_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] >= 1
    assert body["data"][0]["name"] == "Arun Shinde"


async def test_admin_update_user_status(client, user_store):
    admin_token = _seed_admin(user_store)
    target_token = seed_user(user_store, uid="u-suspect")

    resp = await client.post(
        "/v1/admin/users/u-suspect/status",
        json={"status": "suspended", "reason": "Suspected fraudulent mandi rate posting"},
        headers=auth(admin_token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "suspended"
    assert user_store["users/u-suspect"]["status"] == "suspended"
    # check audit log
    audit_keys = [k for k in user_store if k.startswith("audit_logs/")]
    assert len(audit_keys) >= 1


async def test_admin_kyc_and_expert_ticket_flow(client, user_store):
    admin_token = _seed_admin(user_store)
    # review kyc
    resp = await client.post(
        "/v1/admin/kyc/doc-101/review",
        json={"status": "verified", "auditNotes": "7/12 matches land revenue registry"},
        headers=auth(admin_token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "verified"

    # seed expert ticket
    user_store["expert_tickets/tkt-demo-1"] = {
        "id": "tkt-demo-1",
        "userId": "u-f1",
        "query": "Leaf spots",
        "category": "crop_health",
        "status": "queued",
    }
    resp = await client.get("/v1/admin/expert-handoffs", headers=auth(admin_token))
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1

    # resolve ticket
    resp = await client.post(
        "/v1/admin/expert-handoffs/tkt-demo-1/resolve",
        json={
            "prescriptionNotes": "Apply Mancozeb 75% WP @ 2.5g/L immediately",
            "recommendedProducts": ["Mancozeb 75% WP"],
        },
        headers=auth(admin_token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "resolved"
    assert user_store["expert_tickets/tkt-demo-1"]["status"] == "resolved"
