"""Unified dispute triage (phase-07 WS-04, brief M22).

Disputes from every surface are normalized into one canonical `disputes` doc,
triaged by `dispute.triage.v1` (suggest-level routing annotation only — never
resolves), and routed to the correct RBAC queue with an SLA clock. On any
gateway exception the documented fallback applies: `operations_lead`, medium.
"""
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.core.db import set_doc
from app.services.ai import gateway, privacy

# category -> RBAC tier that owns the queue.
CATEGORY_ROLE = {
    "fraud": "compliance_officer",
    "payment": "finance_admin",
    "purchase": "finance_admin",
    "transport": "operations_lead",
    "land": "compliance_officer",
    "equipment": "operations_lead",
    "general": "operations_lead",
}
SLA_HOURS = {"high": 24, "medium": 72, "low": 120}
FALLBACK_ROLE = "operations_lead"
FALLBACK_URGENCY = "medium"


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def triage_dispute(dispute: dict) -> dict:
    """Annotate a dispute with category/urgency/liability + routed role + SLA.
    Never resolves; on any gateway failure applies the documented fallback."""
    state = privacy.sanitize_state(
        {"source": dispute.get("source"), "summary": dispute.get("summary")}
    )
    try:
        decision = await gateway.decide(state, "dispute.triage.v1", module="dispute_triage")
        answers = decision.answers or {}
        if not answers:
            raise ValueError("empty triage")
        category = str(answers.get("category") or dispute.get("source") or "general")
        urgency = str(answers.get("urgency") or FALLBACK_URGENCY)
        liability = str(answers.get("liabilityHint") or "")
    except Exception:  # noqa: BLE001 — fallback routing, never fail
        category, urgency = "general", FALLBACK_URGENCY
        liability = "manual triage required"
        dispute["routedRole"] = FALLBACK_ROLE
    else:
        dispute["routedRole"] = CATEGORY_ROLE.get(category, FALLBACK_ROLE)
    dispute["category"] = category
    dispute["urgency"] = urgency
    dispute["liabilityHint"] = liability
    if dispute.get("routedRole") not in CATEGORY_ROLE.values():
        dispute["routedRole"] = FALLBACK_ROLE
    hours = SLA_HOURS.get(urgency, SLA_HOURS[FALLBACK_URGENCY])
    dispute["slaDueAt"] = (_now() + timedelta(hours=hours)).isoformat()
    return dispute


async def ingest_dispute(source: str, source_id: str, payload: dict) -> dict:
    """Write a canonical dispute doc, triage it, and persist the annotation."""
    dispute_id = f"dsp_{uuid4().hex[:12]}"
    doc = {
        "id": dispute_id,
        "source": source,
        "sourceId": source_id,
        "category": "general",
        "urgency": FALLBACK_URGENCY,
        "liabilityHint": "",
        "status": "open",
        "routedRole": FALLBACK_ROLE,
        "slaDueAt": None,
        "summary": (payload or {}).get("summary") or "",
        "evidence": (payload or {}).get("evidence") or {},
        "createdAt": _now().isoformat(),
    }
    await set_doc("disputes", dispute_id, doc)
    await triage_dispute(doc)
    await set_doc("disputes", dispute_id, doc)
    return doc


async def ingest_purchase_dispute(source_id: str, payload: dict | None = None) -> dict:
    return await ingest_dispute("purchase", source_id, payload or {})


async def ingest_transport_dispute(source_id: str, payload: dict | None = None) -> dict:
    return await ingest_dispute("transport", source_id, payload or {})


async def ingest_land_dispute(source_id: str, payload: dict | None = None) -> dict:
    return await ingest_dispute("land", source_id, payload or {})


async def ingest_equipment_dispute(source_id: str, payload: dict | None = None) -> dict:
    return await ingest_dispute("equipment", source_id, payload or {})
