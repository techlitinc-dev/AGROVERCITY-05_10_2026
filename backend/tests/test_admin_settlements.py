"""Phase-07 WS-03 — settlements/payout console, mandi band, refund idempotency."""
from app.services.tokens import create_access_token
from tests.test_admin import _seed_admin, admin_headers
from tests.test_diary import auth, seed_user


def _second_admin(user_store, uid="uid-admin2", role="finance_admin"):
    user_store[f"users/{uid}"] = {
        "id": uid,
        "isAdmin": True,
        "adminRole": role,
        "activeProfile": "admin",
    }
    return create_access_token(uid)


def _seed_transport(user_store):
    user_store["transport_bookings/b1"] = {
        "id": "b1",
        "status": "delivered",
        "date": "2026-10-01",
        "vehicleId": "v1",
        "fare": 1000,
    }
    user_store["vehicles/v1"] = {"id": "v1", "ownerId": "owner-1", "status": "verified"}


async def test_settlement_batch_and_mark_paid(client, user_store):
    admin_token = _seed_admin(user_store)
    _seed_transport(user_store)
    resp = await client.post(
        "/v1/admin/jobs/settlements/run",
        json={"periodStart": "2026-10-01", "periodEnd": "2026-10-07"},
        headers=admin_headers(admin_token),
    )
    assert resp.status_code == 200
    assert resp.json()["summary"]["created"] >= 1

    settlement_id = next(k.split("/", 1)[1] for k in user_store if k.startswith("settlements/st_transport"))
    resp = await client.post(
        f"/v1/admin/settlements/{settlement_id}/mark-paid",
        json={"paymentRef": "RZPX-12345"},
        headers=admin_headers(admin_token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "paid"
    settled = user_store[f"settlements/{settlement_id}"]
    assert settled["status"] == "paid"
    assert settled["paymentRef"] == "RZPX-12345"
    audits = [d for k, d in user_store.items() if k.startswith("audit_logs/")]
    assert any(a.get("module") == "settlements" and a.get("action") == "mark-paid" for a in audits)


async def test_refund_over_threshold_requires_approval(client, user_store):
    admin_token = _seed_admin(user_store)
    resp = await client.post(
        "/v1/admin/orders/o1/refund",
        json={"amountPaise": 2_000_000},
        headers={**admin_headers(admin_token), "Idempotency-Key": "refund-big-1"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body.get("requiresApproval") is True
    assert body["approval"]["status"] == "pending"


async def test_mark_paid_above_50k_needs_second_admin(client, user_store):
    admin_token = _seed_admin(user_store)
    user_store["settlements/st_big"] = {
        "id": "st_big",
        "role": "transport",
        "entityId": "owner-1",
        "netRupees": 60000,
        "status": "pending",
    }
    resp = await client.post(
        "/v1/admin/settlements/st_big/mark-paid",
        json={"paymentRef": "RZPX-BIG"},
        headers=admin_headers(admin_token),
    )
    assert resp.status_code == 200
    assert resp.json().get("requiresApproval") is True
    approval_id = resp.json()["approval"]["id"]
    assert user_store["settlements/st_big"]["status"] == "pending"

    second = _second_admin(user_store)
    resp = await client.post(
        f"/v1/admin/approvals/{approval_id}/approve",
        headers={**auth(second), "X-Audit-Reason": "dual sign-off", "X-Admin-Role": "finance_admin"},
    )
    assert resp.status_code == 200
    assert user_store["settlements/st_big"]["status"] == "paid"


async def test_commission_edit_versioned_and_maker_checkered(client, user_store):
    admin_token = _seed_admin(user_store)
    resp = await client.put(
        "/v1/admin/platform-config/commissions",
        json={"rates": {"transporterPct": 9, "equipmentPct": 12, "brokerPct": 2}, "effectiveFrom": "2026-11-01"},
        headers=admin_headers(admin_token),
    )
    assert resp.status_code == 200
    assert resp.json().get("requiresApproval") is True
    approval_id = resp.json()["approval"]["id"]

    second = _second_admin(user_store)
    resp = await client.post(
        f"/v1/admin/approvals/{approval_id}/approve",
        headers={**auth(second), "X-Audit-Reason": "approve commission", "X-Admin-Role": "finance_admin"},
    )
    assert resp.status_code == 200
    doc = user_store["platform_config/settlements"]
    assert doc["versions"][-1]["effectiveFrom"] == "2026-11-01"
    assert doc["transportPct"] == 9
    audits = [d for k, d in user_store.items() if k.startswith("audit_logs/")]
    assert any(a.get("action") == "approval.requested" for a in audits)
    assert any(a.get("action") == "approval.approved" for a in audits)


async def test_mandi_band_flag(client, user_store):
    admin_token = _seed_admin(user_store)
    user_store["vyapari_rates/r1"] = {
        "id": "r1", "commodity": "Onion", "market": "Nashik", "rate": 120, "modalPrice": 100, "status": "pending",
    }
    user_store["vyapari_rates/r2"] = {
        "id": "r2", "commodity": "Onion", "market": "Nashik", "rate": 105, "modalPrice": 100, "status": "pending",
    }
    resp = await client.get("/v1/admin/mandi/rates?status=pending", headers=admin_headers(admin_token))
    assert resp.status_code == 200
    rows = {r["id"]: r for r in resp.json()["data"]}
    assert rows["r1"]["outOfBand"] is True
    assert rows["r2"]["outOfBand"] is False


async def test_refund_idempotency(client, user_store):
    admin_token = _seed_admin(user_store)
    headers = {**admin_headers(admin_token), "Idempotency-Key": "refund-key-1"}
    first = await client.post("/v1/admin/orders/o9/refund", json={"amountPaise": 500000}, headers=headers)
    second = await client.post("/v1/admin/orders/o9/refund", json={"amountPaise": 500000}, headers=headers)
    assert first.status_code == 200
    assert first.json() == second.json()
    idem = [k for k in user_store if k.startswith("idempotency_keys/")]
    assert len(idem) == 1

    missing = await client.post(
        "/v1/admin/orders/o9/refund", json={"amountPaise": 500000}, headers=admin_headers(admin_token)
    )
    assert missing.status_code == 422
