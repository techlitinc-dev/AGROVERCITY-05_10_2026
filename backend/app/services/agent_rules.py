"""M29 farmer standing agent (phase-08 WS-01).

A standing rule watches an event stream and, when its parsed condition matches,
emits a one-tap CONFIRM task that calls an EXISTING endpoint — nothing ever
auto-executes (rule 12 at its strictest). Rules store the owner uid server-side
and an HMAC-hashed `userHash` for the AI payload (rule 11). Every fire and
outcome is written to `ai_decisions` + `audit_logs`.
"""
import logging
from datetime import datetime, timezone
from uuid import uuid4

from app.core.db import delete_doc, get_doc, query, set_doc
from app.services.ai import config_store, gateway, privacy

log = logging.getLogger(__name__)

COLLECTION = "agent_rules"
MODULE = "agent_rules"
QUESTION_SET_ID = "agent.rule_match.v1"
DEFAULT_MAX_VALUE_PAISA = 0
VALID_MODULES = ("offers", "mandi_prices", "rate_postings")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _audit(action: str, payload: dict) -> None:
    audit_id = f"aud_agent_{uuid4().hex[:12]}"
    await set_doc("audit_logs", audit_id, {"action": action, "at": _now(), **payload})


def _doc(user_id: str, module: str, condition: dict, action: str,
         max_value_paisa: int, summary: dict | None = None, text: str | None = None) -> dict:
    return {
        "ruleId": f"rule_{uuid4().hex[:10]}",
        "userId": user_id,
        "userHash": privacy.hash_user_id(user_id),
        "module": module,
        "condition": condition,
        "action": action,
        "max_value_paisa": int(max_value_paisa),
        "active": True,
        "text": text,
        "summary": summary or {},
        "createdAt": _now(),
        "lastFiredAt": None,
    }


async def create_rule(
    user_id: str,
    *,
    module: str,
    condition: dict,
    action: str,
    max_value_paisa: int = DEFAULT_MAX_VALUE_PAISA,
    summary: dict | None = None,
    text: str | None = None,
) -> dict:
    doc = _doc(user_id, module, condition, action, max_value_paisa, summary, text)
    await set_doc(COLLECTION, doc["ruleId"], doc)
    await _audit("AGENT_RULE_CREATED", {"ruleId": doc["ruleId"], "userId": user_id, "module": module})
    return doc


async def list_rules_for_user(user_id: str, limit: int = 200) -> list[dict]:
    rules = await query(COLLECTION, [("userId", "==", user_id)], limit=limit)
    rules.sort(key=lambda r: r.get("createdAt") or "", reverse=True)
    return rules


async def get_rule(user_id: str, rule_id: str) -> dict | None:
    rule = await get_doc(COLLECTION, rule_id)
    if rule is None or rule.get("userId") != user_id:
        return None
    return rule


async def pause_rule(user_id: str, rule_id: str) -> dict:
    rule = await get_rule(user_id, rule_id)
    if rule is None:
        raise ValueError("rule not found")
    rule["active"] = not rule.get("active", True)
    rule["updatedAt"] = _now()
    await set_doc(COLLECTION, rule_id, rule)
    await _audit("AGENT_RULE_PAUSED", {"ruleId": rule_id, "userId": user_id, "active": rule["active"]})
    return rule


async def delete_rule(user_id: str, rule_id: str) -> None:
    rule = await get_rule(user_id, rule_id)
    if rule is None:
        raise ValueError("rule not found")
    await delete_doc(COLLECTION, rule_id)
    await _audit("AGENT_RULE_DELETED", {"ruleId": rule_id, "userId": user_id})


async def record_fire(rule_id: str, event: dict, decision_id: str | None = None) -> None:
    rule = await get_doc(COLLECTION, rule_id)
    if rule is None:
        return
    rule["lastFiredAt"] = _now()
    await set_doc(COLLECTION, rule_id, rule)
    await _audit(
        "AGENT_RULE_FIRED",
        {"ruleId": rule_id, "userId": rule.get("userId"), "decisionId": decision_id, "event": event},
    )


def _event_value_paisa(event: dict) -> int:
    for key in ("total_value_paisa", "value_paisa", "price_per_unit_paisa"):
        if event.get(key) is not None:
            try:
                return int(event[key])
            except (TypeError, ValueError):
                continue
    return 0


async def evaluate_rules_for_event(user_id: str, module: str, event_payload: dict) -> list[dict]:
    """Evaluate the user's active rules for `module`; emit confirm tasks on fire.

    Never executes the action — only emits a confirm task carrying the existing
    endpoint. Returns the list of fired rules (empty when the flag is off, no
    rule matches, or the value ceiling blocks the fire).
    """
    if not await config_store.module_enabled(MODULE):
        return []
    rules = [
        r
        for r in await list_rules_for_user(user_id)
        if r.get("module") == module and r.get("active", True)
    ]
    if not rules:
        return []

    state = await privacy.build_agent_rule_match_state(user_id, module, event_payload, rules)
    decision = await gateway.decide(state, QUESTION_SET_ID, module=MODULE)
    answers = decision.answers or {}
    if not answers.get("rule_fires"):
        return []
    rule_id = answers.get("rule_id")
    rule = next((r for r in rules if r.get("ruleId") == rule_id), None)
    if rule is None:
        return []

    ceiling = int(rule.get("max_value_paisa") or 0)
    value = _event_value_paisa(event_payload)
    if ceiling > 0 and value > ceiling:
        await _audit(
            "AGENT_RULE_BLOCKED_CEILING",
            {"ruleId": rule_id, "userId": user_id, "valuePaisa": value, "ceilingPaisa": ceiling},
        )
        return []

    deep_link = str(event_payload.get("deepLink") or "/dashboard/p/myOffers")
    action_endpoint = str(event_payload.get("confirmEndpoint") or "")
    await emit_confirm_task(
        user_id,
        rule=rule,
        event=event_payload,
        decision_id=decision.decision_id,
        deep_link=deep_link,
        action_endpoint=action_endpoint,
    )
    await record_fire(rule_id, event_payload, decision.decision_id)
    return [{**rule, "decisionId": decision.decision_id}]


async def emit_confirm_task(
    user_id: str,
    *,
    rule: dict,
    event: dict,
    decision_id: str | None,
    deep_link: str,
    action_endpoint: str,
) -> str:
    """Emit a one-tap confirm task. The confirm calls an EXISTING endpoint —
    no privileged agent write path exists (rule 12 hard cap)."""
    from app.services.tasks import emit_task

    summary = rule.get("summary") or {}
    source_id = f"{rule.get('ruleId')}:{event.get('entity_id') or event.get('offer_id') or ''}"
    return await emit_task(
        user_id,
        persona="farmer",
        module="agent_rules",
        kind="rule_fire_confirm",
        title_en=summary.get("en") or "Your standing rule matched",
        title_hi=summary.get("hi") or "आपका नियम मेल खाया",
        subtitle=str(event.get("summary") or ""),
        priority="urgent",
        deep_link=deep_link,
        source_id=source_id,
        action_endpoint=action_endpoint or None,
    )
