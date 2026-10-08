"""Admin copilot (phase-07 WS-07, brief M31) — read-only natural-language ops.

A fixed whitelist of read-only query tools (no write path exists) is dispatched
via strict tool-calling (`gemini-2.5-pro`) through the AI gateway, with a
deterministic shim path and a static en/hi fallback. Every query is audit-logged
by the router and every model call logs an `ai_decisions` record.
"""
from datetime import datetime, timezone

from pydantic import BaseModel

from app.core.config import settings
from app.core.db import query
from app.services.ai import gateway

# Tools the copilot may ever call — read-only by construction.
READ_ONLY_TOOLS = frozenset(
    {"get_kyc_backlog", "get_settlement_holds", "get_fraud_queue", "get_scan_clusters"}
)


async def get_kyc_backlog(by_state: bool = False) -> dict:
    cases = await query("kyc_cases", None, limit=2000)
    pending = [
        doc
        for case in cases
        for doc in (case.get("docs") or [])
        if doc.get("status") == "pending"
    ]
    by_state_counts: dict[str, int] = {}
    if by_state:
        for case in cases:
            for doc in case.get("docs") or []:
                if doc.get("status") != "pending":
                    continue
                key = str(case.get("state") or case.get("district") or "unknown")
                by_state_counts[key] = by_state_counts.get(key, 0) + 1
    return {"total": len(pending), "byState": by_state_counts}


async def get_settlement_holds() -> dict:
    rows = await query("settlements", None, limit=2000)
    holds = [r for r in rows if r.get("held") or r.get("payoutStatus") == "onHold"]
    return {"total": len(holds), "items": holds}


async def get_fraud_queue() -> dict:
    rows = await query("fraud_queue", [("status", "==", "open")], limit=2000)
    return {"total": len(rows), "items": rows}


async def get_scan_clusters(district: str | None = None, crop: str | None = None) -> dict:
    scans = await query("advisory_scans", None, limit=2000)
    clusters: dict[str, int] = {}
    for scan in scans:
        if district and scan.get("district") != district:
            continue
        if crop and scan.get("crop") != crop:
            continue
        key = f"{scan.get('district', 'unknown')}:{scan.get('disease', scan.get('diagnosis', 'unknown'))}"
        clusters[key] = clusters.get(key, 0) + 1
    return {"total": len(scans), "clusters": clusters}


TOOLS = {
    "get_kyc_backlog": get_kyc_backlog,
    "get_settlement_holds": get_settlement_holds,
    "get_fraud_queue": get_fraud_queue,
    "get_scan_clusters": get_scan_clusters,
}

# Which admin tiers may see each tool's data (least privilege).
TOOL_ROLES = {
    "get_kyc_backlog": {"superadmin", "compliance_officer"},
    "get_settlement_holds": {"superadmin", "finance_admin"},
    "get_fraud_queue": {"superadmin", "compliance_officer"},
    "get_scan_clusters": {"superadmin", "agronomist", "scientist", "operations_lead"},
}

_TOOL_PARAMS = {
    "get_kyc_backlog": {"by_state"},
    "get_settlement_holds": set(),
    "get_fraud_queue": set(),
    "get_scan_clusters": {"district", "crop"},
}


def _normalize_role(role: str | None) -> str:
    return "agronomist" if role == "scientist" else (role or "")


async def dispatch_tool(name: str, args: dict, role: str) -> dict:
    """Execute a whitelisted read-only tool, or raise for anything else.

    A tool must be both in `TOOLS` AND in `READ_ONLY_TOOLS` — registering a
    write-capable function into `TOOLS` is not enough to execute it."""
    if name not in TOOLS or name not in READ_ONLY_TOOLS:
        raise ValueError("TOOL_NOT_WHITELISTED")
    normalized = _normalize_role(role)
    if normalized not in TOOL_ROLES[name]:
        return {"scopedOut": True, "total": 0, "items": []}
    safe_args = {k: v for k, v in (args or {}).items() if k in _TOOL_PARAMS[name]}
    return await TOOLS[name](**safe_args)


class CopilotToolCall(BaseModel):
    tool: str
    args: dict = {}


TOOL_CALL_SCHEMA = {
    "tool": "one of get_kyc_backlog | get_settlement_holds | get_fraud_queue | get_scan_clusters",
    "args": "object of tool arguments",
}

_FALLBACK_TEXT = {
    "en": (
        "I can answer these read-only queries: 'show KYC backlog by state', "
        "'list settlement holds', 'show the fraud queue', 'show disease scan clusters by district'."
    ),
    "hi": (
        "मैं इन रीड-ओनली प्रश्नों का उत्तर दे सकता हूँ: 'राज्य अनुसार KYC बैकलॉग', "
        "'निपटान होल्ड', 'धोखाधड़ी क्यू', 'जिला अनुसार रोग स्कैन क्लस्टर'।"
    ),
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _shim_tool_call(prompt: str) -> CopilotToolCall:
    text = (prompt or "").lower()
    if any(w in text for w in ("settlement", "payout", "निपटान", "भुगतान")):
        return CopilotToolCall(tool="get_settlement_holds", args={})
    if any(w in text for w in ("fraud", "धोखाधड़ी", "collusion")):
        return CopilotToolCall(tool="get_fraud_queue", args={})
    if any(w in text for w in ("scan", "cluster", "disease", "रोग")):
        return CopilotToolCall(tool="get_scan_clusters", args={})
    if "kyc" in text:
        return CopilotToolCall(tool="get_kyc_backlog", args={"by_state": "state" in text})
    return CopilotToolCall(tool="get_kyc_backlog", args={})


def _parse_tool_call(raw: str) -> CopilotToolCall | None:
    import json

    try:
        payload = json.loads(raw)
        return CopilotToolCall(**payload)
    except Exception:  # noqa: BLE001 — invalid output → repair/fallback
        return None


def _compose(tool: str, data: dict) -> str:
    if tool == "get_kyc_backlog":
        extra = ""
        if data.get("byState"):
            extra = " (" + ", ".join(f"{k} {v}" for k, v in data["byState"].items()) + ")"
        return f"KYC backlog {data.get('total', 0)}{extra}"
    if tool == "get_settlement_holds":
        return f"{data.get('total', 0)} payout holds pending"
    if tool == "get_fraud_queue":
        return f"{data.get('total', 0)} open fraud holds"
    return f"{data.get('total', 0)} scans; clusters: {data.get('clusters', {})}"


def _fallback_result() -> dict:
    return {
        "answer": _FALLBACK_TEXT,
        "tool": None,
        "args": {},
        "dataSource": None,
        "fallback": True,
        "asOf": _now(),
        "cannedQueries": list(READ_ONLY_TOOLS),
    }


async def answer_query(prompt: str, role: str) -> dict:
    # Always go through the gateway so the call is logged to ai_decisions with
    # cost + confidence (deterministic shim text on shim/AI-off).
    raw = await gateway.generate(
        prompt,
        opts={
            "module": "copilot",
            "model": settings.ai_gemini_model_pro,
            "json_schema": TOOL_CALL_SCHEMA,
            "fallback_text": "",
        },
    )
    tool_call: CopilotToolCall | None
    if settings.ai_provider == "shim":
        tool_call = _shim_tool_call(prompt)
    else:
        tool_call = _parse_tool_call(raw)
        if tool_call is None:
            repaired = await gateway.generate(
                prompt + "\nReturn ONLY the JSON tool call.",
                opts={"module": "copilot", "model": settings.ai_gemini_model_pro, "fallback_text": ""},
            )
            tool_call = _parse_tool_call(repaired)

    if tool_call is None or tool_call.tool not in READ_ONLY_TOOLS:
        return _fallback_result()

    try:
        data = await dispatch_tool(tool_call.tool, tool_call.args, role)
    except ValueError:
        return _fallback_result()

    return {
        "answer": _compose(tool_call.tool, data),
        "tool": tool_call.tool,
        "args": tool_call.args,
        "dataSource": tool_call.tool,
        "asOf": _now(),
        "data": data,
    }


BRIEFING_DEEP_LINKS = {
    "get_kyc_backlog": "/admin/kyc",
    "get_settlement_holds": "/admin/settlements",
    "get_fraud_queue": "/admin/moderation",
    "get_scan_clusters": "/admin/advisory",
}


async def generate_briefing() -> dict:
    items = []
    for name in ("get_kyc_backlog", "get_settlement_holds", "get_fraud_queue", "get_scan_clusters"):
        data = await TOOLS[name]()
        data["scopedOut"] = False
        items.append(
            {
                "text": _compose(name, data),
                "deepLink": BRIEFING_DEEP_LINKS[name],
                "preTriage": data,
            }
        )
    briefing = {"id": "latest", "generatedAt": _now(), "items": items}
    from app.core.db import set_doc

    await set_doc("admin_briefings", "latest", briefing)
    return briefing
