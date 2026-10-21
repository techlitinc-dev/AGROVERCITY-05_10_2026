"""Customer persona access widening + account/payments gaps.

Covers the role-gate widening (customer may keep a household diary, browse
tree/land-records/schemes content) while writes that stay farmer-gated
(scheme applications) remain 403. Also covers the new profile/settings
fields, the payments receipt PDF, and the admin veggie-box toggle.
"""
import base64
import re
import zlib

from app.data.schemes_seed import SCHEMES
from app.services.tokens import create_access_token
from tests.test_diary import auth, seed_user

ADMIN_HEADERS = {"Authorization": "Bearer admin-token"}
ADMIN_MUTATION_HEADERS = {
    **ADMIN_HEADERS,
    "X-Admin-Role": "superadmin",
    "X-Audit-Reason": "veggie-box toggle test",
}

ENTRY = {
    "title": "Weekly vegetables",
    "category": "grocery",
    "type": "expense",
    "amount": 320,
    "date": "2026-10-15",
}


def _seed_schemes(user_store):
    for scheme in SCHEMES:
        user_store[f"schemes/{scheme['id']}"] = scheme


def _pdf_text(raw: bytes) -> bytes:
    """Pull literal text out of a reportlab PDF (ASCII85+Flate streams)."""
    text = b""
    for m in re.finditer(rb"stream\r?\n(.*?)endstream", raw, re.S):
        try:
            text += zlib.decompress(base64.a85decode(m.group(1).strip(), adobe=True))
        except Exception:
            continue
    return text


# ---------------------------------------------------------------------------
# Role gates
# ---------------------------------------------------------------------------

async def test_customer_diary_entries_crud(client, user_store):
    token = seed_user(user_store, active_profile="customer")
    resp = await client.post("/v1/diary/entries", json=ENTRY, headers=auth(token))
    assert resp.status_code == 201
    entry_id = resp.json()["entry"]["id"]

    resp = await client.get("/v1/diary/entries", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["total"] == 1

    resp = await client.put(
        f"/v1/diary/entries/{entry_id}", json={**ENTRY, "amount": 340}, headers=auth(token)
    )
    assert resp.status_code == 200
    assert resp.json()["entry"]["amount"] == 340

    resp = await client.delete(f"/v1/diary/entries/{entry_id}", headers=auth(token))
    assert resp.status_code == 204
    resp = await client.get("/v1/diary/entries", headers=auth(token))
    assert resp.json()["total"] == 0


async def test_customer_tree_articles(client, user_store):
    token = seed_user(user_store, active_profile="customer")
    resp = await client.get("/v1/tree/articles", headers=auth(token))
    assert resp.status_code == 200
    assert "data" in resp.json()


async def test_customer_land_records_search(client, user_store):
    token = seed_user(user_store, active_profile="customer")
    resp = await client.get("/v1/land-records/search?village=Ozar", headers=auth(token))
    assert resp.status_code == 200
    villages = [r["village"] for r in resp.json()["data"]]
    assert "Ozarkhed" in villages


async def test_customer_schemes_list_and_portals(client, user_store):
    _seed_schemes(user_store)
    token = seed_user(user_store, active_profile="customer")
    resp = await client.get("/v1/schemes", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["total"] > 0

    resp = await client.get("/v1/schemes/portals", headers=auth(token))
    assert resp.status_code == 200
    assert len(resp.json()["data"]) > 0


async def test_customer_scheme_apply_still_forbidden(client, user_store):
    _seed_schemes(user_store)
    token = seed_user(user_store, active_profile="customer")
    resp = await client.post("/v1/schemes/pm-kisan/apply", json={}, headers=auth(token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"


# ---------------------------------------------------------------------------
# Profile + settings fields
# ---------------------------------------------------------------------------

async def test_customer_dietary_preference_and_family_size_roundtrip(client, user_store):
    token = seed_user(user_store, active_profile="customer")
    resp = await client.put(
        "/v1/users/me",
        json={"dietaryPreference": "organic", "familySize": 4},
        headers=auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["dietaryPreference"] == "organic"
    assert resp.json()["familySize"] == 4

    resp = await client.get("/v1/users/me", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["dietaryPreference"] == "organic"
    assert resp.json()["familySize"] == 4


async def test_customer_dietary_preference_validation(client, user_store):
    token = seed_user(user_store, active_profile="customer")
    resp = await client.put(
        "/v1/users/me", json={"dietaryPreference": "vegan"}, headers=auth(token)
    )
    assert resp.status_code == 422
    resp = await client.put("/v1/users/me", json={"familySize": 0}, headers=auth(token))
    assert resp.status_code == 422
    resp = await client.put("/v1/users/me", json={"familySize": 21}, headers=auth(token))
    assert resp.status_code == 422


async def test_household_budget_monthly_settings_roundtrip(client, user_store):
    token = seed_user(user_store, active_profile="customer")

    resp = await client.get("/v1/users/me/settings", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["householdBudgetMonthly"] == 0

    resp = await client.put(
        "/v1/users/me/settings",
        json={"householdBudgetMonthly": 8500},
        headers=auth(token),
    )
    assert resp.status_code == 200

    resp = await client.get("/v1/users/me/settings", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["householdBudgetMonthly"] == 8500

    resp = await client.put(
        "/v1/users/me/settings", json={"householdBudgetMonthly": -1}, headers=auth(token)
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Payments receipt PDF
# ---------------------------------------------------------------------------

def _seed_payment(user_store):
    user_store["payments/pay_rc1"] = {
        "id": "pay_rc1",
        "userId": "uid-1",
        "payeeId": "uid-2",
        "amountPaisa": 25000,
        "purpose": "veggie-box order",
        "status": "paid",
        "createdAt": "2026-10-18T10:00:00+00:00",
        "paidAt": "2026-10-18T10:05:00+00:00",
    }


async def test_receipt_pdf_for_payer(client, user_store):
    _seed_payment(user_store)
    seed_user(user_store, uid="uid-2", active_profile="seller")
    token = seed_user(user_store, active_profile="customer")
    resp = await client.get("/v1/payments/pay_rc1/receipt.pdf", headers=auth(token))
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.content[:5] == b"%PDF-"
    text = _pdf_text(resp.content)
    assert b"AGROVERCITY" in text
    assert b"pay_rc1" in text
    assert b"Rs 250.00" in text
    assert b"computer generated receipt" in text


async def test_receipt_pdf_for_payee(client, user_store):
    _seed_payment(user_store)
    seed_user(user_store, uid="uid-1", active_profile="customer")
    token = seed_user(user_store, uid="uid-2", active_profile="seller")
    resp = await client.get("/v1/payments/pay_rc1/receipt.pdf", headers=auth(token))
    assert resp.status_code == 200


async def test_receipt_pdf_forbidden_for_outsider(client, user_store):
    _seed_payment(user_store)
    token = seed_user(user_store, uid="uid-3", active_profile="farmer")
    resp = await client.get("/v1/payments/pay_rc1/receipt.pdf", headers=auth(token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_receipt_pdf_not_found(client, user_store):
    token = seed_user(user_store, active_profile="customer")
    resp = await client.get("/v1/payments/pay_missing/receipt.pdf", headers=auth(token))
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Admin veggie-box toggle
# ---------------------------------------------------------------------------

async def test_veggie_box_toggle_admin_get_put(client, user_store):
    resp = await client.get("/v1/admin/app-config/veggie-box", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    assert resp.json()["enabled"] is True

    resp = await client.put(
        "/v1/admin/app-config/veggie-box",
        json={"enabled": False},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 200
    assert resp.json()["enabled"] is False
    assert user_store["app_config/veggie_box"]["enabled"] is False

    resp = await client.get("/v1/admin/app-config/veggie-box", headers=ADMIN_HEADERS)
    assert resp.json()["enabled"] is False

    audits = [d for k, d in user_store.items() if k.startswith("audit_logs/")]
    assert any(a.get("action") == "veggie_box.config.update" for a in audits)


async def test_veggie_box_toggle_forbidden_for_non_admin(client, user_store):
    token = seed_user(user_store, active_profile="customer")
    resp = await client.get("/v1/admin/app-config/veggie-box", headers=auth(token))
    assert resp.status_code == 403
    resp = await client.put(
        "/v1/admin/app-config/veggie-box",
        json={"enabled": True},
        headers={**auth(token), "X-Audit-Reason": "not an admin"},
    )
    assert resp.status_code == 403


async def test_veggie_box_toggle_put_requires_audit_reason(client, user_store):
    resp = await client.put(
        "/v1/admin/app-config/veggie-box",
        json={"enabled": False},
        headers=ADMIN_HEADERS,
    )
    assert resp.status_code == 422
