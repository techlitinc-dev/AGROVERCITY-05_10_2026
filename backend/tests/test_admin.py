from tests.test_diary import auth, seed_user

ADMIN_HEADERS = {"Authorization": "Bearer admin-token"}
ADMIN_MUTATION_HEADERS = {
    **ADMIN_HEADERS,
    "X-Admin-Role": "superadmin",
    "X-Audit-Reason": "test reason",
}


async def test_admin_overview_metrics(client, user_store):
    # seed normal farmers
    seed_user(user_store, uid="u-f1", active_profile="farmer")
    seed_user(user_store, uid="u-t1", active_profile="transporter")

    resp = await client.get("/v1/admin/overview", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    body = resp.json()
    assert body["activeUsersTotal"] >= 2
    assert "farmer" in body["personaBreakdown"]
    assert body["platformHealth"] == "100% Operational"


async def test_non_admin_forbidden(client, user_store):
    seed_user(user_store, uid="u-farmer-norm")
    resp = await client.get("/v1/admin/overview", headers=auth("plain-token"))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "ADMIN_REQUIRED"


async def test_admin_list_users_with_filter(client, user_store):
    seed_user(user_store, uid="u-f2", active_profile="farmer", name="Arun Shinde")

    resp = await client.get("/v1/admin/users?search=Arun", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] >= 1
    assert body["data"][0]["name"] == "Arun Shinde"


async def test_admin_update_user_status(client, user_store):
    seed_user(user_store, uid="u-suspect")

    resp = await client.post(
        "/v1/admin/users/u-suspect/status",
        json={"status": "suspended", "reason": "Suspected fraudulent mandi rate posting"},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "suspended"
    assert user_store["users/u-suspect"]["status"] == "suspended"
    # check audit log written with the required reason
    audit_keys = [k for k in user_store if k.startswith("audit_logs/")]
    assert len(audit_keys) >= 1
    audit_docs = [user_store[k] for k in audit_keys]
    assert any(d.get("reason") == "test reason" for d in audit_docs)


async def test_admin_mutation_requires_audit_reason(client, user_store):
    seed_user(user_store, uid="u-suspect-2")

    resp = await client.post(
        "/v1/admin/users/u-suspect-2/status",
        json={"status": "suspended", "reason": "fraud check"},
        headers=auth("admin-token"),
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "AUDIT_REASON_REQUIRED"


async def test_admin_kyc_and_expert_ticket_flow(client, user_store):
    # review kyc
    resp = await client.post(
        "/v1/admin/kyc/doc-101/review",
        json={"status": "verified", "auditNotes": "7/12 matches land revenue registry"},
        headers=ADMIN_MUTATION_HEADERS,
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
    resp = await client.get("/v1/admin/expert-handoffs", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1

    # resolve ticket
    resp = await client.post(
        "/v1/admin/expert-handoffs/tkt-demo-1/resolve",
        json={
            "prescriptionNotes": "Apply Mancozeb 75% WP @ 2.5g/L immediately",
            "recommendedProducts": ["Mancozeb 75% WP"],
        },
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "resolved"
    assert user_store["expert_tickets/tkt-demo-1"]["status"] == "resolved"
