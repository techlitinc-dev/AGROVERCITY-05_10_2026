"""M29 farmer standing-agent rules router (phase-08 WS-01).

Vernacular rule text is parsed to a structured rule by `gateway.generate()`
(one repair retry, deterministic regex fallback), reviewed by the user, then
persisted. A fire only ever emits a confirm task — no auto-execution path.
"""
import json
import re

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.deps import current_user_id
from app.core.pagination import InvalidCursor, fetch_page
from app.services import agent_rules as rules_service, idempotency
from app.services.ai import gateway

router = APIRouter(prefix="/agent", tags=["agent"])


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


class RuleParseIn(BaseModel):
    text: str = Field(min_length=1, max_length=400)
    module: str = "offers"


class ParsedRule(BaseModel):
    condition: dict = Field(default_factory=dict)
    action: str = ""
    max_value_paisa: int = 0
    summary: dict = Field(default_factory=dict)


class RuleCreateIn(BaseModel):
    condition: dict
    action: str
    max_value_paisa: int = Field(default=0, ge=0)
    module: str = "offers"
    summary: dict = Field(default_factory=dict)
    text: str | None = None


_ACCEPT_RE = re.compile(r"accept|स्वीकार|मंज़ूर|मंजूर", re.IGNORECASE)
_REJECT_RE = re.compile(r"reject|decline|मना|अस्वीकार", re.IGNORECASE)
_NUM_RE = re.compile(r"(\d[\d,]*(?:\.\d+)?)")


def _fallback_parse(text: str, module: str) -> ParsedRule:
    """Deterministic vernacular-rule parse (no AI): threshold + action."""
    match = _NUM_RE.search(text or "")
    rupees = float(match.group(1).replace(",", "")) if match else 0.0
    threshold_paisa = int(round(rupees * 100))
    if _REJECT_RE.search(text or ""):
        action = "reject"
    else:
        action = "accept" if _ACCEPT_RE.search(text or "") else "accept"
    condition = {"field": "price_per_unit_paisa", "op": ">=", "value": threshold_paisa}
    summary = {
        "en": f"If an offer price is at or above ₹{rupees:,.0f}, {action} it",
        "hi": f"अगर ऑफर ₹{rupees:,.0f} या अधिक हो तो {action} करें",
    }
    return ParsedRule(condition=condition, action=action, max_value_paisa=0, summary=summary)


def _coerce_parsed(raw, fallback: ParsedRule, module: str) -> ParsedRule:
    if not isinstance(raw, dict):
        return fallback
    try:
        parsed = ParsedRule(
            condition=raw.get("condition") or fallback.condition,
            action=str(raw.get("action") or fallback.action),
            max_value_paisa=int(raw.get("max_value_paisa") or 0),
            summary=raw.get("summary") or fallback.summary,
        )
    except Exception:  # noqa: BLE001 — invalid parse falls back to the deterministic rule
        return fallback
    if not parsed.condition:
        parsed.condition = fallback.condition
    return parsed


@router.post("/rules/parse")
async def parse_rule(body: RuleParseIn, uid: str = Depends(current_user_id)):
    """Parse vernacular rule text into a structured rule for user review."""
    fallback = _fallback_parse(body.text, body.module)
    schema = {
        "type": "object",
        "properties": {
            "condition": {"type": "object"},
            "action": {"type": "string"},
            "max_value_paisa": {"type": "integer"},
            "summary": {"type": "object"},
        },
    }
    prompt = (
        f"Parse this standing-agriculture-rule sentence into JSON "
        f'{{"condition": {{"field": str, "op": ">=|>|<=|<|==|!=", "value": number}}, '
        f'"action": str, "max_value_paisa": int, "summary": {{"en": str, "hi": str}}}}. '
        f"Module: {body.module}. Sentence: {body.text}"
    )
    text = await gateway.generate(prompt, {"module": rules_service.MODULE, "json_schema": schema})
    parsed = fallback
    try:
        parsed = _coerce_parsed(json.loads(text), fallback, body.module)
    except (TypeError, ValueError):
        parsed = fallback
    return {
        "module": body.module,
        "condition": parsed.condition,
        "action": parsed.action,
        "max_value_paisa": parsed.max_value_paisa,
        "summary": parsed.summary,
    }


@router.post("/rules", status_code=201)
async def create_rule(
    body: RuleCreateIn,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(current_user_id),
):
    if not idempotency_key:
        _error(400, "IDEMPOTENCY_KEY_REQUIRED", "an Idempotency-Key header is required")
    stored = await idempotency.replay("agent.rules.create", idempotency_key)
    if stored is not None:
        return stored
    if body.module not in rules_service.VALID_MODULES:
        _error(422, "INVALID_MODULE", f"module must be one of {', '.join(rules_service.VALID_MODULES)}")
    if not body.condition:
        _error(422, "INVALID_CONDITION", "condition is required")
    doc = await rules_service.create_rule(
        uid,
        module=body.module,
        condition=body.condition,
        action=body.action,
        max_value_paisa=body.max_value_paisa,
        summary=body.summary,
        text=body.text,
    )
    await idempotency.store("agent.rules.create", idempotency_key, doc)
    return doc


@router.get("/rules")
async def list_rules(
    cursor: str | None = Query(None),
    pageSize: int = Query(20, ge=1, le=100),
    uid: str = Depends(current_user_id),
):
    try:
        return await fetch_page(
            rules_service.COLLECTION,
            [("userId", "==", uid)],
            order_field="createdAt",
            descending=True,
            cursor=cursor,
            page_size=pageSize,
        )
    except InvalidCursor:
        _error(400, "INVALID_CURSOR", "the pagination cursor is malformed")


@router.post("/rules/{rule_id}/pause")
async def pause_rule(rule_id: str, uid: str = Depends(current_user_id)):
    try:
        return await rules_service.pause_rule(uid, rule_id)
    except ValueError:
        _error(404, "RULE_NOT_FOUND", "rule not found")


@router.delete("/rules/{rule_id}", status_code=204)
async def delete_rule(
    rule_id: str,
    x_audit_reason: str | None = Header(None, alias="X-Audit-Reason"),
    uid: str = Depends(current_user_id),
):
    try:
        await rules_service.delete_rule(uid, rule_id)
    except ValueError:
        _error(404, "RULE_NOT_FOUND", "rule not found")
