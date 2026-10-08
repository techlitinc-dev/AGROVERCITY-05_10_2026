"""WS-07 locale approval endpoint tests."""
from tests.test_admin import ADMIN_HEADERS, ADMIN_MUTATION_HEADERS
from tests.test_diary import auth, seed_user


async def test_locale_approval_flow(client, user_store):
    for key in ("a", "b"):
        user_store[f"locale_approvals/ta__{key}"] = {
            "locale": "ta", "key": key, "enSource": "x",
            "draft": "[ta] x", "status": "pending",
        }

    resp = await client.get("/v1/admin/locale-drafts?locale=ta", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    assert {d["key"] for d in resp.json()["data"]} == {"a", "b"}

    resp = await client.post(
        "/v1/admin/locale-approvals",
        json={"locale": "ta", "key": "a", "action": "approve"},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 200
    doc = user_store["locale_approvals/ta__a"]
    assert doc["status"] == "approved" and doc["reviewedBy"] and doc["reviewedAt"]

    resp = await client.post(
        "/v1/admin/locale-approvals",
        json={"locale": "ta", "key": "b", "action": "reject"},
        headers=ADMIN_MUTATION_HEADERS,
    )
    assert resp.status_code == 200
    assert user_store["locale_approvals/ta__b"]["status"] == "rejected"

    # non-admin forbidden
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/admin/locale-approvals",
        json={"locale": "ta", "key": "a", "action": "approve"},
        headers=auth(token),
    )
    assert resp.status_code == 403
    resp = await client.get("/v1/admin/locale-drafts?locale=ta", headers=auth(token))
    assert resp.status_code == 403
