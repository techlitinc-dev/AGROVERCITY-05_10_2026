"""M29 farmer standing-agent tests (phase-08 WS-01).

Covers: `>=` boundary firing (exactly ₹1,800 = 180000 paisa fires, 179999 does
not); a paused rule never fires; a fire alone changes no domain state; the full
audit trail is written; and the `max_value_paisa` ceiling blocks an over-ceiling
fire.
"""
import pytest

from app.core.config import settings
from app.services import agent_rules as rules_service
from app.services.ai import config_store
from tests.test_diary import auth, seed_user

FARMER = "uid-farmer-agent"
BUYER = "uid-buyer-agent"


@pytest.fixture(autouse=True)
def _shim_mode(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "shim")
    config_store.clear_cache()
    yield
    config_store.clear_cache()


def _audits(user_store, action):
    return [d for k, d in user_store.items() if k.startswith("audit_logs/") and d.get("action") == action]


async def _rule(farmer=FARMER, value=180000, max_value_paisa=0):
    return await rules_service.create_rule(
        farmer,
        module="offers",
        condition={"field": "price_per_unit_paisa", "op": ">=", "value": value},
        action="accept",
        max_value_paisa=max_value_paisa,
        summary={"en": "Accept offers at or above the price", "hi": "तय भाव या ऊपर स्वीकार करें"},
    )


async def test_boundary_firing(client, user_store):
    seed_user(user_store, uid=FARMER)
    await _rule(value=180000)

    fired = await rules_service.evaluate_rules_for_event(
        FARMER, "offers", {"price_per_unit_paisa": 180000, "entity_id": "o1", "total_value_paisa": 180000}
    )
    assert len(fired) == 1

    # Refresh rules list (new rule instance, separate event below the boundary).
    for key in [k for k in user_store if k.startswith("agent_rules/")]:
        user_store.pop(key)
    await _rule(value=180000)
    below = await rules_service.evaluate_rules_for_event(
        FARMER, "offers", {"price_per_unit_paisa": 179999, "entity_id": "o2", "total_value_paisa": 179999}
    )
    assert below == []


async def test_paused_rule_never_fires(client, user_store):
    seed_user(user_store, uid=FARMER)
    rule = await _rule()
    await rules_service.pause_rule(FARMER, rule["ruleId"])
    fired = await rules_service.evaluate_rules_for_event(
        FARMER, "offers", {"price_per_unit_paisa": 500000, "entity_id": "o3", "total_value_paisa": 500000}
    )
    assert fired == []


async def test_fire_does_not_change_offer_state(client, user_store):
    farmer_token = seed_user(user_store, uid=FARMER)
    buyer_token = seed_user(user_store, uid=BUYER, active_profile="vyapari")
    user_store["market_lots/lot_1"] = {
        "id": "lot_1", "farmerId": FARMER, "status": "open", "crop": "Wheat",
        "unit": "quintal", "quantity": 100,
    }
    await _rule(value=180000)

    resp = await client.post(
        "/v1/offers",
        json={"targetType": "lot", "targetId": "lot_1", "pricePerUnit": 1800, "quantity": 10},
        headers=auth(buyer_token),
    )
    assert resp.status_code == 201

    # A confirm task was emitted for the farmer...
    tasks = [d for k, d in user_store.items() if k.startswith("tasks/") and d.get("kind") == "rule_fire_confirm"]
    assert len(tasks) == 1
    assert tasks[0]["actionEndpoint"].endswith("/accept")
    # ...but the offer is untouched (fire alone changes nothing).
    offer = next(d for k, d in user_store.items() if k.startswith("offers/"))
    assert offer["status"] == "pending"


async def test_audit_trail_written(client, user_store):
    seed_user(user_store, uid=FARMER)
    await _rule()
    await rules_service.evaluate_rules_for_event(
        FARMER, "offers", {"price_per_unit_paisa": 180000, "entity_id": "o4", "total_value_paisa": 180000}
    )
    assert _audits(user_store, "AGENT_RULE_FIRED")
    assert _audits(user_store, "AGENT_RULE_CREATED")
    decisions = [d for k, d in user_store.items() if k.startswith("ai_decisions/")
                 and d.get("questionSetId") == "agent.rule_match.v1"]
    assert decisions


async def test_max_value_ceiling_blocks(client, user_store):
    seed_user(user_store, uid=FARMER)
    await _rule(value=180000, max_value_paisa=100000)
    fired = await rules_service.evaluate_rules_for_event(
        FARMER, "offers", {"price_per_unit_paisa": 180000, "entity_id": "o5", "total_value_paisa": 200000}
    )
    assert fired == []
    assert _audits(user_store, "AGENT_RULE_BLOCKED_CEILING")


async def test_parse_endpoint_returns_structured_rule(client, user_store):
    token = seed_user(user_store, uid=FARMER)
    resp = await client.post(
        "/v1/agent/rules/parse",
        json={"text": "₹1,800 se upar offer aaye toh accept kar do", "module": "offers"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["action"] == "accept"
    assert body["condition"]["value"] == 180000
