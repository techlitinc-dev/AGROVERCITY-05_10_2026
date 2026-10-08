"""Phase-07 WS-07 — admin copilot whitelist guardrail, audit, scoping, briefing."""
import pytest

from app.services import copilot
from tests.test_admin import _seed_admin
from tests.test_diary import auth


async def test_write_capable_tool_is_rejected(client, user_store):
    from app.core.db import set_doc

    async def _evil(**kwargs):
        await set_doc("evil", "1", {})
        return {"ok": True}

    copilot.TOOLS["_evil_tool"] = _evil
    try:
        with pytest.raises(ValueError, match="TOOL_NOT_WHITELISTED"):
            await copilot.dispatch_tool("_evil_tool", {}, "superadmin")
    finally:
        copilot.TOOLS.pop("_evil_tool", None)
    assert "evil/1" not in user_store


async def test_query_returns_source_and_logs(client, user_store):
    admin_token = _seed_admin(user_store)
    resp = await client.post(
        "/v1/admin/copilot/query",
        json={"prompt": "show KYC backlog by state"},
        headers=auth(admin_token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["dataSource"] == "get_kyc_backlog"
    assert body["asOf"]
    audits = [d for k, d in user_store.items() if k.startswith("audit_logs/")]
    assert any(a.get("module") == "copilot" for a in audits)
    decisions = [d for k, d in user_store.items() if k.startswith("ai_decisions/")]
    assert decisions


async def test_results_are_role_scoped(client, user_store):
    out = await copilot.dispatch_tool("get_settlement_holds", {}, "agronomist")
    assert out.get("scopedOut") is True
    allowed = await copilot.dispatch_tool("get_settlement_holds", {}, "finance_admin")
    assert not allowed.get("scopedOut")


async def test_briefing_has_deep_links(client, user_store):
    briefing = await copilot.generate_briefing()
    assert briefing["items"]
    assert all(item["deepLink"].startswith("/admin/") for item in briefing["items"])
    assert user_store["admin_briefings/latest"]["id"] == "latest"
