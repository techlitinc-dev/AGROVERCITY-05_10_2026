"""B2B partner API tests (phase-08 WS-03).

Covers: scoped reads of mandi prices + saturation aggregates; the negative test
(a partner key on a user endpoint → 403); revoked-key rejection; k-anonymity
suppression; usage metering; and missing-scope 403.
"""
import pytest

from app.services import partner_keys
from tests.test_diary import auth, seed_user


def _seed_mandi(user_store, count=5, crop="Wheat"):
    for i in range(count):
        user_store[f"mandi_prices/m{i}"] = {
            "id": f"m{i}", "commodity": crop, "mandiName": f"Mandi {i}",
            "modalPrice": 2000, "distanceKm": 10, "date": "2026-10-01",
        }


def _seed_cycles(user_store, count, crop="Wheat", district="meerut"):
    for i in range(count):
        user_store[f"crop_cycles/c{i}"] = {
            "id": f"c{i}", "crop": crop, "district": district,
        }


async def test_valid_key_reads_both_scopes(client, user_store):
    client_key = await partner_keys.issue_key("partner-1", ["mandi:read", "saturation:read"], 1000)
    _seed_mandi(user_store, 5)
    _seed_cycles(user_store, 30)

    resp = await client.get(
        "/v1/partner/mandi/prices",
        params={"crop": "wheat", "district": "meerut"},
        headers={"X-API-Key": client_key["key"]},
    )
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert items and items[0]["sampleCount"] == 5
    assert items[0]["avgModalPricePaisa"] == 200000

    resp = await client.get(
        "/v1/partner/advisory/saturation",
        params={"district": "meerut", "crop": "Wheat"},
        headers={"X-API-Key": client_key["key"]},
    )
    assert resp.status_code == 200
    assert resp.json()["items"][0]["sowingCount"] == 30


async def test_partner_key_on_user_endpoint_403(client, user_store):
    client_key = await partner_keys.issue_key("partner-1", ["mandi:read"], 1000)
    resp = await client.get("/v1/users/me", headers={"X-API-Key": client_key["key"]})
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "PARTNER_KEY_NOT_ALLOWED"


async def test_revoked_key_fails(client, user_store):
    client_key = await partner_keys.issue_key("partner-1", ["mandi:read"], 1000)
    await partner_keys.revoke_key(client_key["keyId"])
    resp = await client.get(
        "/v1/partner/mandi/prices",
        params={"crop": "wheat", "district": "meerut"},
        headers={"X-API-Key": client_key["key"]},
    )
    assert resp.status_code == 401


async def test_small_cohort_suppressed(client, user_store):
    client_key = await partner_keys.issue_key("partner-1", ["mandi:read"], 1000)
    _seed_mandi(user_store, 2)  # below k=5
    resp = await client.get(
        "/v1/partner/mandi/prices",
        params={"crop": "wheat", "district": "meerut"},
        headers={"X-API-Key": client_key["key"]},
    )
    assert resp.status_code == 200
    assert resp.json()["items"] == []


async def test_usage_metered(client, user_store):
    client_key = await partner_keys.issue_key("partner-1", ["mandi:read"], 1000)
    _seed_mandi(user_store, 5)
    await client.get(
        "/v1/partner/mandi/prices",
        params={"crop": "wheat", "district": "meerut"},
        headers={"X-API-Key": client_key["key"]},
    )
    assert [k for k in user_store if k.startswith("billing_usage_records/")]
    assert [k for k in user_store if k.startswith("partner_usage/")]


async def test_missing_scope_403(client, user_store):
    client_key = await partner_keys.issue_key("partner-1", ["mandi:read"], 1000)
    resp = await client.get(
        "/v1/partner/advisory/saturation",
        params={"district": "meerut", "crop": "Wheat"},
        headers={"X-API-Key": client_key["key"]},
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "SCOPE_REQUIRED"


async def test_admin_can_issue_and_revoke(client, user_store):
    from tests.test_admin import _seed_admin, admin_headers

    token = _seed_admin(user_store)
    resp = await client.post(
        "/v1/admin/partner-keys",
        json={"partnerId": "partner-x", "scopes": ["mandi:read"], "rateLimit": 100},
        headers=admin_headers(token),
    )
    assert resp.status_code == 201
    key_id = resp.json()["keyId"]

    resp = await client.post(f"/v1/admin/partner-keys/{key_id}/revoke", headers=admin_headers(token))
    assert resp.status_code == 200
    audits = [d for k, d in user_store.items() if k.startswith("audit_logs/")]
    assert any(a.get("module") == "partner-keys" for a in audits)
