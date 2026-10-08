from tests.test_diary import auth, seed_user

ADMIN_HEADERS = {"Authorization": "Bearer admin-token"}
ADMIN_MUTATION_HEADERS = {
    **ADMIN_HEADERS,
    "X-Admin-Role": "superadmin",
    "X-Audit-Reason": "test reason",
}


def _seed_admin(user_store, uid="admin-root"):
    """Seed the legacy admin user doc and return the Firebase admin token used
    by the unified admin_user mechanism (WS-02)."""
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
    return "admin-token"


def admin_headers(token: str | None = None) -> dict:
    """Admin request headers for the unified admin_user mechanism; mutating
    endpoints also require X-Admin-Role + X-Audit-Reason (harmless on GETs)."""
    return {
        "Authorization": f"Bearer {token or 'admin-token'}",
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
    # Phase-07 WS-01: X-Audit-Reason is enforced by FastAPI (min_length=3) → 422.
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_admin_kyc_and_expert_ticket_flow(client, user_store):
    # seed a real kyc case (WS-04: the queue reads kyc_cases, not samples)
    user_store["kyc_cases/kyc_uid-kyc1_transport"] = {
        "caseId": "kyc_uid-kyc1_transport",
        "userId": "uid-kyc1",
        "persona": "transport",
        "docs": [
            {"docId": "kyc_uid-kyc1_transport:rc", "type": "rc", "storagePath": "kyc/rc.pdf", "status": "pending", "reason": None},
            {"docId": "kyc_uid-kyc1_transport:dl", "type": "dl", "storagePath": "kyc/dl.pdf", "status": "pending", "reason": None},
        ],
        "status": "pending",
        "submittedAt": "2026-10-01T00:00:00+00:00",
    }
    queue = await client.get("/v1/admin/kyc/queue", headers=ADMIN_HEADERS)
    assert queue.status_code == 200
    assert queue.json()["total"] == 2
    assert queue.json()["data"][0]["caseId"] == "kyc_uid-kyc1_transport"

    resp = await client.post(
        "/v1/admin/kyc/kyc_uid-kyc1_transport:rc/review",
        json={"status": "verified"},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "verified"
    assert resp.json()["caseStatus"] == "pending"  # dl still pending
    stored = user_store["kyc_cases/kyc_uid-kyc1_transport"]
    assert stored["docs"][0]["status"] == "verified"

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
