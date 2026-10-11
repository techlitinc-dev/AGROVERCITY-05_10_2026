import logging
import zlib
from datetime import datetime, timedelta, timezone

from app.core.db import get_doc, set_doc
from app.services.ai import config_store, decision_log, gateway, question_sets
from app.services.ai.privacy import build_claim_triage_state

log = logging.getLogger(__name__)

# --- WS-07 M15 — ClaimsDesk triage -----------------------------------------
# Annotates the intimation response (same-day retake guidance) and the provider
# console. `fraudSignal > 0.8` flags only — it NEVER auto-rejects; filing and the
# human decision path are byte-identical with the AI flag on or off.
CLAIM_TRIAGE_MODULE = "insurance_triage"
CLAIM_TRIAGE_QUESTION_SET = "insurance.triage.v1"


async def compute_claim_triage(claim: dict) -> dict | None:
    """M15 triage for a freshly intimated claim. Returns None when the
    `insurance_triage` flag is off (filing is unchanged). Provider failures
    degrade to the deterministic fallback, logged with `fallbackUsed`."""
    if not await config_store.module_enabled(CLAIM_TRIAGE_MODULE):
        return None

    state = build_claim_triage_state(claim)
    try:
        decision = await gateway.decide(
            state,
            CLAIM_TRIAGE_QUESTION_SET,
            ctx=claim.get("userId"),
            module=CLAIM_TRIAGE_MODULE,
        )
        answers = dict(decision.answers or {})
        confidence = float(decision.confidence or 0.0)
        decision_id = decision.decision_id
    except Exception as exc:  # noqa: BLE001 — degrade, never block filing
        log.warning("claim triage failed (%s) — degrading to fallback", exc)
        answers = question_sets.fallback_answers(CLAIM_TRIAGE_QUESTION_SET, state)
        confidence = 0.0
        decision_id = await decision_log.log_decision(
            module=CLAIM_TRIAGE_MODULE,
            question_set_id=CLAIM_TRIAGE_QUESTION_SET,
            version="v1",
            state=state,
            answers=answers,
            confidence=0.0,
            latency_ms=0,
            cost_usd=0.0,
            model="none",
            source="fallback",
            fallback_used=True,
        )

    guidance = answers.get("retakeGuidance") or {}
    completeness = answers.get("completeness")
    try:
        completeness = float(completeness) if completeness is not None else 1.0
    except (TypeError, ValueError):
        completeness = 1.0
    try:
        fraud_signal = float(answers.get("fraudSignal") or 0.0)
    except (TypeError, ValueError):
        fraud_signal = 0.0

    return {
        "photoQuality": answers.get("photoQuality") or "ok",
        "completeness": completeness,
        "retakeGuidance": {"en": str(guidance.get("en") or ""), "hi": str(guidance.get("hi") or "")},
        "fraudSignal": fraud_signal,
        "triageReasons": [str(reason) for reason in (answers.get("triageReasons") or [])],
        "suggestedSurveyor": answers.get("suggestedSurveyor"),
        "confidence": round(confidence, 3),
        "decisionId": decision_id,
    }


CLAIM_TRANSITIONS = {
    # Provider "fast-track" review may skip the surveyor step directly from an
    # intimation (see insurance.py provider_review_claim); the standard flow is
    # still intimated → surveyorAssigned → fieldAssessed → dbtApproved → disbursed.
    "intimated": ["surveyorAssigned", "fieldAssessed"],
    "surveyorAssigned": ["fieldAssessed"],
    "fieldAssessed": ["dbtApproved", "rejected"],
    "dbtApproved": ["disbursed"],
    "disbursed": [],
    "rejected": [],
}

STATUS_TEXT = {
    "intimated": "दावा दर्ज — सर्वेयर नियुक्ति लंबित",
    "surveyorAssigned": "सर्वेयर नियुक्त",
    "fieldAssessed": "क्षेत्र मूल्यांकन पूर्ण",
    "dbtApproved": "DBT स्वीकृत",
    "disbursed": "राशि वितरित",
    "rejected": "दावा अस्वीकृत",
}

STATE_CODES = {
    "Maharashtra": "MH",
    "Madhya Pradesh": "MP",
    "Gujarat": "GJ",
    "Uttar Pradesh": "UP",
    "Punjab": "PB",
    "Rajasthan": "RJ",
}

SURVEYORS = [
    ("संदीप कुलकर्णी", "+919811000001"),
    ("मीना जाधव", "+919811000002"),
    ("अजय भोसले", "+919811000003"),
]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def advance_status(claim: dict, new_status: str, note: str = "") -> dict:
    if new_status not in CLAIM_TRANSITIONS.get(claim["status"], []):
        raise ValueError(f"illegal transition {claim['status']} -> {new_status}")
    claim["status"] = new_status
    claim["statusText"] = STATUS_TEXT[new_status]
    claim.setdefault("timeline", []).append({"status": new_status, "at": _now_iso(), "note": note})
    return claim


def appeal(claim: dict, reason: str) -> dict:
    # rejected -> intimated is allowed only through here; CLAIM_TRANSITIONS keeps "rejected": []
    if claim["status"] != "rejected":
        raise ValueError("only rejected claims can be appealed")
    claim["status"] = "intimated"
    claim["statusText"] = STATUS_TEXT["intimated"]
    claim["appealCount"] = claim.get("appealCount", 0) + 1
    claim.setdefault("timeline", []).append(
        {"status": "intimated", "at": _now_iso(), "note": f"Appeal submitted: {reason[:100]}"}
    )
    return claim


async def next_claim_number(state: str) -> str:
    # read-modify-write via db helpers so the tests' in-memory store works;
    # not transactional — fine at current write volume, revisit if collisions appear
    year = datetime.now(timezone.utc).year
    doc_id = f"claims_{year}"
    counter = await get_doc("counters", doc_id) or {"id": doc_id, "value": 0}
    counter["value"] += 1
    await set_doc("counters", doc_id, counter)
    return f"CLM-{year}-{STATE_CODES.get(state, 'XX')}-{counter['value']:04d}"


def auto_assign_surveyor(district: str) -> dict:
    name, phone = SURVEYORS[zlib.crc32((district or "").encode()) % 3]
    visit = (datetime.now(timezone.utc) + timedelta(days=3)).date().isoformat()
    return {"surveyorName": name, "surveyorPhone": phone, "surveyorVisitDate": visit}
