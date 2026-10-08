"""Phase-07 WS-04 — dispute triage routing, SLA, fallback and resolution."""
from app.services import disputes
from app.services.tokens import create_access_token
from tests.test_admin import _seed_admin, admin_headers
from tests.test_diary import auth


async def test_routing_matrix_and_sla(client, user_store):
    purchase = await disputes.ingest_purchase_dispute("d-p", {"summary": "buyer not paying"})
    transport = await disputes.ingest_transport_dispute("d-t", {"summary": "late delivery"})
    land = await disputes.ingest_land_dispute("d-l", {"summary": "boundary issue"})
    equipment = await disputes.ingest_equipment_dispute("d-e", {"summary": "damaged machine"})

    assert purchase["routedRole"] == "finance_admin"
    assert transport["routedRole"] == "operations_lead"
    assert land["routedRole"] == "compliance_officer"
    assert equipment["routedRole"] == "operations_lead"
    for dispute in (purchase, transport, land, equipment):
        assert dispute["slaDueAt"]
        assert dispute["status"] == "open"


async def test_fallback_routing_on_gateway_exception(client, user_store, monkeypatch):
    async def _boom(*args, **kwargs):
        raise RuntimeError("gateway down")

    monkeypatch.setattr("app.services.disputes.gateway.decide", _boom)
    dispute = await disputes.ingest_transport_dispute("d-f", {"summary": "anything"})
    assert dispute["routedRole"] == "operations_lead"
    assert dispute["urgency"] == "medium"


async def test_resolve_flow_writes_audit(client, user_store):
    admin_token = _seed_admin(user_store)
    dispute = await disputes.ingest_transport_dispute("d-r", {"summary": "resolve me"})
    resp = await client.post(
        f"/v1/admin/disputes/{dispute['id']}/resolve",
        json={"resolution": "settled amicably"},
        headers=admin_headers(admin_token),
    )
    assert resp.status_code == 200
    assert resp.json()["dispute"]["status"] == "resolved"
    audits = [d for k, d in user_store.items() if k.startswith("audit_logs/")]
    assert any(a.get("module") == "disputes" for a in audits)


async def test_agronomist_forbidden_on_disputes(client, user_store):
    user_store["users/uid-agro"] = {
        "id": "uid-agro", "isAdmin": True, "adminRole": "agronomist", "activeProfile": "admin",
    }
    token = create_access_token("uid-agro")
    resp = await client.get("/v1/admin/disputes", headers=auth(token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ADMIN_ROLE"
