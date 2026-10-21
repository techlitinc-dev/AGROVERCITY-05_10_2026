"""Gruh-udyog settlements + payouts, womenShg persona access, and the women-program
admin endpoints (cert verification queue, subsidy fund routing)."""
from app.core.security import hash_mpin

from tests.test_diary import auth, seed_user
from tests.test_gruh_udyog import (
    HANDICRAFT_PRODUCT,
    _add_product,
    _place_mall_order,
    _publish,
    _register_unit,
)

ADMIN_HEADERS = {"Authorization": "Bearer admin-token"}
ADMIN_MUTATION_HEADERS = {
    **ADMIN_HEADERS,
    "X-Admin-Role": "superadmin",
    "X-Audit-Reason": "women sop test",
}


async def _deliver_order(client, token, order_id):
    await client.post(f"/v1/gruh-udyog/orders/{order_id}/accept", headers=auth(token))
    for status in ("packed", "shipped", "delivered"):
        resp = await client.post(
            f"/v1/gruh-udyog/orders/{order_id}/status",
            json={"status": status},
            headers=auth(token),
        )
        assert resp.status_code == 200, resp.text


async def _payout_setup(client, user_store, uid="uid-1", qty=2, key="payout-order"):
    token = seed_user(user_store, uid=uid, mpinHash=hash_mpin("1234"))
    unit_id = await _register_unit(client, token)
    product_id = await _add_product(client, token, unit_id, HANDICRAFT_PRODUCT)
    mall_id = (await _publish(client, token, product_id)).json()["mallProductId"]
    buyer = seed_user(user_store, uid="uid-buyer")
    order_id = await _place_mall_order(client, buyer, mall_id, quantity=qty, key=key)
    await _deliver_order(client, token, order_id)
    return token, unit_id, order_id


# ---------------------------------------------------------------------------
# Settlements accrual + balance math
# ---------------------------------------------------------------------------


async def test_settlement_accrues_on_delivered_with_default_commission(client, user_store):
    token, unit_id, order_id = await _payout_setup(client, user_store)

    resp = await client.get(f"/v1/gruh-udyog/units/{unit_id}/settlements", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["lines"]) == 1
    line = body["lines"][0]
    assert line["orderId"] == order_id
    assert line["revenuePaisa"] == 100_000  # 2 x ₹500
    assert line["commissionPct"] == 5  # platform_config default
    assert line["commissionPaisa"] == 5_000
    assert line["netPaisa"] == 95_000
    assert body["balance"] == {
        "revenuePaisa": 100_000,
        "commissionPaisa": 5_000,
        "paidOutPaisa": 0,
        "availablePaisa": 95_000,
    }

    # The buyer got the mall-vocabulary delivered notification (G1c).
    notes = [
        doc
        for key, doc in user_store.items()
        if key.startswith("notifications/") and doc.get("userId") == "uid-buyer"
    ]
    assert any(n.get("type") == "order_delivered" for n in notes)


async def test_settlement_respects_configured_commission(client, user_store):
    user_store["platform_config/settlements"] = {"id": "settlements", "gruhCommissionPct": 10}
    token, unit_id, _ = await _payout_setup(client, user_store, key="payout-order-10")

    resp = await client.get(f"/v1/gruh-udyog/units/{unit_id}/settlements", headers=auth(token))
    body = resp.json()
    assert body["lines"][0]["commissionPct"] == 10
    assert body["lines"][0]["commissionPaisa"] == 10_000
    assert body["balance"]["availablePaisa"] == 90_000


async def test_stranger_cannot_read_settlements(client, user_store):
    token, unit_id, _ = await _payout_setup(client, user_store, key="payout-order-sec")
    stranger = seed_user(user_store, uid="uid-2")
    resp = await client.get(f"/v1/gruh-udyog/units/{unit_id}/settlements", headers=auth(stranger))
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Payouts — MPIN gate, overdraw, dev auto-process
# ---------------------------------------------------------------------------


async def test_payout_happy_path_dev_auto_processed(client, user_store):
    token, unit_id, _ = await _payout_setup(client, user_store, key="payout-order-happy")
    resp = await client.post(
        "/v1/gruh-udyog/payouts",
        json={"unitId": unit_id, "amountPaisa": 50_000, "mpin": "1234"},
        headers=auth(token),
    )
    assert resp.status_code == 201
    body = resp.json()
    # Razorpay keys are unset in the test env → dev shim auto-processes.
    assert body["status"] == "processed"
    assert body["amountPaisa"] == 50_000
    assert body["razorpayPayoutId"].startswith("pout_dev_")

    settlements = await client.get(
        f"/v1/gruh-udyog/units/{unit_id}/settlements", headers=auth(token)
    )
    balance = settlements.json()["balance"]
    assert balance["paidOutPaisa"] == 50_000
    assert balance["availablePaisa"] == 45_000
    assert len(settlements.json()["payouts"]) == 1


async def test_payout_overdraw_422(client, user_store):
    token, unit_id, _ = await _payout_setup(client, user_store, key="payout-order-over")
    resp = await client.post(
        "/v1/gruh-udyog/payouts",
        json={"unitId": unit_id, "amountPaisa": 95_001, "mpin": "1234"},
        headers=auth(token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "INSUFFICIENT_BALANCE"
    # no payout doc was written
    settlements = await client.get(
        f"/v1/gruh-udyog/units/{unit_id}/settlements", headers=auth(token)
    )
    assert settlements.json()["payouts"] == []


async def test_payout_wrong_mpin_401_and_missing_mpin_409(client, user_store):
    token, unit_id, _ = await _payout_setup(client, user_store, key="payout-order-mpin")

    wrong = await client.post(
        "/v1/gruh-udyog/payouts",
        json={"unitId": unit_id, "amountPaisa": 10_000, "mpin": "9999"},
        headers=auth(token),
    )
    assert wrong.status_code == 401
    assert wrong.json()["error"]["code"] == "WRONG_MPIN"

    no_mpin_user = seed_user(user_store, uid="uid-nompin")
    unit2 = await _register_unit(client, no_mpin_user)
    blocked = await client.post(
        "/v1/gruh-udyog/payouts",
        json={"unitId": unit2, "amountPaisa": 10_000, "mpin": "1234"},
        headers=auth(no_mpin_user),
    )
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "MPIN_NOT_SET"


# ---------------------------------------------------------------------------
# womenShg persona — mall access + persona-setup role profile
# ---------------------------------------------------------------------------


async def test_womenShg_can_browse_mall_catalog(client, user_store):
    token = seed_user(user_store, active_profile="womenShg")
    user_store["products/wp-1"] = {
        "id": "wp-1",
        "title": "Handmade Warli Pot",
        "category": "Handicrafts",
        "sellerId": "uid-seller-1",
        "source": "gruh_udyog",
        "discountedPrice": 400,
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    resp = await client.get("/v1/products", headers=auth(token))
    assert resp.status_code == 200
    assert "wp-1" in {p["id"] for p in resp.json()["data"]}


async def test_products_source_filter(client, user_store):
    token = seed_user(user_store)
    for pid, source in (("s-1", "gruh_udyog"), ("s-2", "women_enterprise"), ("s-3", None)):
        user_store[f"products/{pid}"] = {
            "id": pid,
            "title": f"Product {pid}",
            "category": "Handicrafts",
            "sellerId": "uid-x",
            "source": source,
            "createdAt": "2026-10-01T00:00:00+00:00",
        }
    resp = await client.get(
        "/v1/products", params={"source": "gruh_udyog,women_enterprise"}, headers=auth(token)
    )
    assert resp.status_code == 200
    assert {p["id"] for p in resp.json()["data"]} == {"s-1", "s-2"}


async def test_persona_setup_accepts_womenShg_role_profile(client, user_store):
    token = seed_user(user_store)
    resp = await client.put(
        "/v1/users/me/persona-setup",
        json={
            "profiles": ["womenShg"],
            "primaryProfile": "womenShg",
            "roleProfiles": {
                "womenShg": {
                    "shgName": "Prerna Bachat Gat",
                    "groupRole": "president",
                    "enterpriseType": "papad",
                    "skills": ["food processing", "book keeping"],
                }
            },
        },
        headers=auth(token),
    )
    assert resp.status_code == 200
    role_profiles = resp.json()["roleProfiles"]
    assert role_profiles["womenShg"]["shgName"] == "Prerna Bachat Gat"
    assert role_profiles["womenShg"]["groupRole"] == "president"
    assert "womenShg" in user_store["users/uid-1"]["linkedProfiles"]


async def test_home_enterprise_listing_tagged_women_enterprise(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/women/home-enterprise/listings",
        json={
            "title": "A2 Ghee (500ml)",
            "category": "Dairy",
            "mrp": 900,
            "discountedPrice": 799,
            "stock": 10,
        },
        headers=auth(token),
    )
    assert resp.status_code == 201
    product = user_store[f"products/{resp.json()['id']}"]
    assert product["source"] == "women_enterprise"


# ---------------------------------------------------------------------------
# Admin SOP — gruh certification queue / verify / reject + subsidy fund routing
# ---------------------------------------------------------------------------


async def _unit_with_pending_cert(client, user_store):
    token = seed_user(user_store)
    unit_id = await _register_unit(client, token)
    cert = await client.post(
        f"/v1/gruh-udyog/units/{unit_id}/certifications",
        json={
            "type": "fssai",
            "number": "FSSAI-99887766554433",
            "issuingAuthority": "FSSAI Pune",
            "validUntil": "2028-12-31",
        },
        headers=auth(token),
    )
    assert cert.status_code == 201
    return token, unit_id, cert.json()["id"]


async def test_admin_gruh_cert_queue_verify_and_notify(client, user_store):
    token, unit_id, cert_id = await _unit_with_pending_cert(client, user_store)

    queue = await client.get("/v1/admin/gruh/certifications/queue", headers=ADMIN_HEADERS)
    assert queue.status_code == 200
    rows = queue.json()["data"]
    assert len(rows) == 1
    assert rows[0]["id"] == cert_id
    assert rows[0]["unitName"] == "Sunita Gruh Udyog"
    assert rows[0]["ownerName"] == "Ram Patil"

    verified = await client.post(
        f"/v1/admin/gruh/certifications/{cert_id}/verify",
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert verified.status_code == 200
    assert verified.json()["status"] == "verified"
    assert user_store[f"gruh_udyog_certifications/{cert_id}"]["status"] == "verified"

    audit = [
        doc for key, doc in user_store.items()
        if key.startswith("audit_logs/") and doc.get("action") == "gruh.cert.verify"
    ]
    assert len(audit) == 1
    assert audit[0]["targetId"] == cert_id

    notes = [
        doc for key, doc in user_store.items()
        if key.startswith("notifications/") and doc.get("userId") == "uid-1"
    ]
    assert any(n.get("type") == "gruh_cert_verified" for n in notes)

    # Queue is empty once nothing is pending; re-verify is a 409.
    queue = await client.get("/v1/admin/gruh/certifications/queue", headers=ADMIN_HEADERS)
    assert queue.json()["data"] == []
    again = await client.post(
        f"/v1/admin/gruh/certifications/{cert_id}/verify",
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert again.status_code == 409


async def test_admin_gruh_cert_reject_requires_reason(client, user_store):
    token, unit_id, cert_id = await _unit_with_pending_cert(client, user_store)

    missing = await client.post(
        f"/v1/admin/gruh/certifications/{cert_id}/reject",
        json={},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert missing.status_code == 422

    rejected = await client.post(
        f"/v1/admin/gruh/certifications/{cert_id}/reject",
        json={"reason": "document unreadable"},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "rejected"
    cert = user_store[f"gruh_udyog_certifications/{cert_id}"]
    assert cert["status"] == "rejected"
    assert cert["reviewReason"] == "document unreadable"
    notes = [
        doc for key, doc in user_store.items()
        if key.startswith("notifications/") and doc.get("userId") == "uid-1"
    ]
    assert any(n.get("type") == "gruh_cert_rejected" for n in notes)


async def test_subsidy_disburse_fund_routing(client, user_store):
    user_store["shg_groups/shg_fund"] = {
        "id": "shg_fund",
        "name": "Fund Routing Gat",
        "memberUid": "uid-1",
        "corpusPaisa": 100_000,
        "loanFundPaisa": 50_000,
    }
    # default: corpus
    resp = await client.post(
        "/v1/admin/women/subsidies/disburse",
        json={"shgId": "shg_fund", "amount": 20_000, "reference": "SUB-1"},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 200
    assert resp.json()["fund"] == "corpus"
    assert resp.json()["newCorpusPaisa"] == 120_000
    group = user_store["shg_groups/shg_fund"]
    assert group["corpusPaisa"] == 120_000
    assert group["loanFundPaisa"] == 50_000

    # explicit loanFund
    resp = await client.post(
        "/v1/admin/women/subsidies/disburse",
        json={"shgId": "shg_fund", "amount": 30_000, "fund": "loanFund"},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 200
    assert resp.json()["fund"] == "loanFund"
    group = user_store["shg_groups/shg_fund"]
    assert group["corpusPaisa"] == 120_000
    assert group["loanFundPaisa"] == 80_000

    bad = await client.post(
        "/v1/admin/women/subsidies/disburse",
        json={"shgId": "shg_fund", "amount": 10_000, "fund": "savings"},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert bad.status_code == 422
