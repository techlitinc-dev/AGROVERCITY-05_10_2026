"""Smoke tests for the SOP superadmin console routers (docs/superadmin-instructions).

Covers one representative read + mutation + error path per new router module
(admin_sop_users/trade/logistics/farm/finance/org/economy/platform/chatbot)
plus the system-only POST /threads. All data is seeded into the fake store —
no endpoint may return hardcoded demo values.
"""
from tests.test_diary import auth, seed_user

ADMIN_HEADERS = {"Authorization": "Bearer admin-token"}
ADMIN_MUTATION_HEADERS = {
    **ADMIN_HEADERS,
    "X-Admin-Role": "superadmin",
    "X-Audit-Reason": "sop smoke test",
}


def _audit_actions(user_store):
    return [
        doc
        for key, doc in user_store.items()
        if key.startswith("audit_logs/")
    ]


# ---------------------------------------------------------------------------
# admin_sop_users (SOP-01/02)
# ---------------------------------------------------------------------------
async def test_sop_user_status_put_and_audit(client, user_store):
    seed_user(user_store, uid="u-sop-1")
    resp = await client.put(
        "/v1/admin/users/u-sop-1/status",
        json={"status": "suspended"},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "suspended"
    assert user_store["users/u-sop-1"]["status"] == "suspended"
    assert any(a["action"] == "UPDATE_USER_STATUS" for a in _audit_actions(user_store))

    # doc-01 path variant shares the same writer
    resp = await client.put(
        "/v1/admin/auth/users/u-sop-1/status",
        json={"status": "active"},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 200
    assert resp.json()["previousStatus"] == "suspended"


async def test_sop_user_status_requires_audit_reason(client, user_store):
    seed_user(user_store, uid="u-sop-2")
    resp = await client.put(
        "/v1/admin/users/u-sop-2/status",
        json={"status": "suspended"},
        headers=ADMIN_HEADERS,
    )
    assert resp.status_code == 422


async def test_sop_user_detail_and_farm_map_404(client, user_store):
    seed_user(user_store, uid="u-sop-3", linkedProfiles=["farmer", "seller"])
    resp = await client.get("/v1/admin/users/u-sop-3", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    body = resp.json()
    assert body["linkedProfiles"] == ["farmer", "seller"]
    assert "roleProfiles" in body

    resp = await client.get("/v1/admin/users/nope/farm-map", headers=ADMIN_HEADERS)
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# admin_sop_trade (SOP-04..07)
# ---------------------------------------------------------------------------
async def test_sop_marketplace_products_envelope(client, user_store):
    seed_user(user_store, uid="u-sop-seller")
    user_store["products/p-1"] = {
        "id": "p-1",
        "title": "Urea 45kg",
        "category": "fertilizer",
        "mrp": 500,
        "discountedPrice": 450,
        "stock": 20,
        "sellerId": "u-sop-seller",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    resp = await client.get("/v1/admin/marketplace/products", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["data"][0]["title"] == "Urea 45kg"


async def test_sop_rates_approve_missing_404(client, user_store):
    resp = await client.post(
        "/v1/admin/rates/nope/approve",
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 404


async def test_sop_contracts_list_envelope(client, user_store):
    seed_user(user_store, uid="u-sop-buyer")
    user_store["contracts/c-1"] = {
        "id": "c-1",
        "buyerId": "u-sop-buyer",
        "crop": "Wheat",
        "status": "active",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    resp = await client.get("/v1/admin/contracts", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["data"][0]["crop"] == "Wheat"


# ---------------------------------------------------------------------------
# admin_sop_logistics (SOP-08/09)
# ---------------------------------------------------------------------------
async def test_sop_transport_bookings_envelope(client, user_store):
    user_store["transport_bookings/tb-1"] = {
        "id": "tb-1",
        "status": "delivered",
        "farePaise": 42000,
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    resp = await client.get("/v1/admin/transport/bookings", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    assert resp.json()["total"] == 1


async def test_sop_equipment_verify_missing_404(client, user_store):
    resp = await client.put(
        "/v1/admin/equipment/nope/verify",
        json={"verified": True},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# admin_sop_farm (SOP-10/11/13)
# ---------------------------------------------------------------------------
async def test_sop_land_listings_and_pnl_benchmarks(client, user_store):
    seed_user(user_store, uid="u-sop-landlord")
    user_store["land_listings/ll-1"] = {
        "id": "ll-1",
        "landlordId": "u-sop-landlord",
        "village": "Pimpri",
        "status": "open",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    resp = await client.get("/v1/admin/land/listings", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    assert resp.json()["total"] == 1

    resp = await client.put(
        "/v1/admin/pnl/benchmarks/Wheat",
        json={"costPerAcreRupees": 24000},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 200
    stored = await client.get("/v1/admin/pnl/benchmarks", headers=ADMIN_HEADERS)
    assert stored.json()["benchmarks"]["Wheat"]["costPerAcreRupees"] == 24000


# ---------------------------------------------------------------------------
# admin_sop_finance (SOP-14..17)
# ---------------------------------------------------------------------------
async def test_sop_finance_accounts_masked(client, user_store):
    user_store["bank_accounts/ba-1"] = {
        "id": "ba-1",
        "userId": "u-sop-1",
        "accountHolder": "Ram Patil",
        "accountNumber": "123456789012",
        "ifsc": "SBIN0001234",
        "bankName": "SBI",
        "verifyStatus": "pending",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    resp = await client.get("/v1/admin/finance/accounts", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    row = resp.json()["data"][0]
    assert row["accountNumberMasked"] == "XXXX9012"
    assert "accountNumber" not in row


async def test_sop_claim_update_missing_404(client, user_store):
    resp = await client.put(
        "/v1/admin/claims/u-nope/cl-nope",
        json={"status": "approved"},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 404


async def test_sop_water_subsidy_rules(client, user_store):
    resp = await client.put(
        "/v1/admin/water/subsidy-rules",
        json={"subsidyPercent": 55, "benchmarkCostPerAcreInr": 85000},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 200
    assert user_store["platform_config/pmksy"]["subsidyPercent"] == 55


# ---------------------------------------------------------------------------
# admin_sop_org (SOP-18..20)
# ---------------------------------------------------------------------------
async def test_sop_content_whitelist(client, user_store):
    user_store["expert_talks/et-1"] = {
        "id": "et-1",
        "expertName": "Dr. Shinde",
        "topic": "Soil health",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    resp = await client.get("/v1/admin/content/expert_talks", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    assert resp.json()["total"] == 1

    resp = await client.get("/v1/admin/content/not_a_collection", headers=ADMIN_HEADERS)
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "UNKNOWN_COLLECTION"


async def test_sop_fpo_list_envelope(client, user_store):
    user_store["fpos/fpo-1"] = {
        "id": "fpo-1",
        "name": "Shree Farmers FPC",
        "status": "pending",
        "memberCount": 120,
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    resp = await client.get("/v1/admin/fpo", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    assert resp.json()["total"] == 1


# ---------------------------------------------------------------------------
# admin_sop_economy (SOP-21..24)
# ---------------------------------------------------------------------------
async def test_sop_gamification_ledger_and_ratings_404(client, user_store):
    user_store["gamification_ledger/gl-1"] = {
        "id": "gl-1",
        "userId": "u-sop-1",
        "amount": 15,
        "reason": "diary_entry",
        "at": "2026-10-01T00:00:00+00:00",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    resp = await client.get("/v1/admin/gamification/ledger", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    assert resp.json()["total"] == 1

    resp = await client.delete(
        "/v1/admin/ratings/nope",
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 404


async def test_sop_women_shg_paths(client, user_store):
    user_store["shg_groups/shg-1"] = {
        "id": "shg-1",
        "name": "Durga SHG",
        "status": "pending",
        "corpusRupees": 40000,
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    # doc-24a queue path
    resp = await client.get("/v1/admin/women/shgs/queue", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    # doc-24b list path
    resp = await client.get("/v1/admin/women/shg", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    assert resp.json()["total"] == 1


# ---------------------------------------------------------------------------
# admin_sop_platform (SOP-25/26 + POST /threads)
# ---------------------------------------------------------------------------
async def test_sop_analytics_summary_real_counts(client, user_store):
    seed_user(user_store, uid="u-sop-a", active_profile="farmer")
    seed_user(user_store, uid="u-sop-b", active_profile="seller")
    user_store["orders/o-1"] = {
        "id": "o-1",
        "userId": "u-sop-a",
        "status": "delivered",
        "total": 700,
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    resp = await client.get("/v1/admin/analytics/summary", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    body = resp.json()
    assert body["activeUsersTotal"] == 2
    assert body["totalOrders"] == 1
    assert body["marketplaceGMV"] == 700
    # real lease count — no hardcoded 42
    assert body["activeFarmlandLeases"] == 0


async def test_sop_threads_order_bound(client, user_store):
    seed_user(user_store, uid="u-sop-farmer")
    seed_user(user_store, uid="u-sop-customer")
    user_store["customer_orders/co-1"] = {
        "id": "co-1",
        "farmerId": "u-sop-farmer",
        "customerId": "u-sop-customer",
        "status": "confirmed",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    resp = await client.post(
        "/v1/threads",
        json={"orderId": "co-1"},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 201
    assert user_store["chat_rooms/co-1"]["farmerId"] == "u-sop-farmer"

    # second create for the same order is a 409
    resp = await client.post(
        "/v1/threads",
        json={"orderId": "co-1"},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "THREAD_EXISTS"

    # unknown order → 404
    resp = await client.post(
        "/v1/threads",
        json={"orderId": "nope"},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# admin_sop_chatbot (SOP-12)
# ---------------------------------------------------------------------------
async def test_sop_chatbot_transcripts_and_handoff_assign(client, user_store):
    seed_user(user_store, uid="u-sop-chatter")
    user_store["chatbot_sessions/cs-1"] = {
        "id": "cs-1",
        "userId": "u-sop-chatter",
        "language": "hi",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    resp = await client.get("/v1/admin/chatbot/transcripts", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["data"][0]["userName"] == "Ram Patil"

    resp = await client.post(
        "/v1/admin/chatbot/handoffs/nope/assign",
        json={"expertName": "Dr. Agrawal"},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# RBAC — non-admin cannot reach any SOP endpoint
# ---------------------------------------------------------------------------
async def test_sop_non_admin_forbidden(client, user_store):
    seed_user(user_store, uid="u-sop-plain")
    resp = await client.get(
        "/v1/admin/analytics/summary",
        headers=auth("plain-token"),
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "ADMIN_REQUIRED"
