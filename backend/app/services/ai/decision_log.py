"""ai_decisions logging (ai.md §7): every AI call is persisted with cost +
confidence so outcomes can be linked back for calibration."""
import hashlib
import json
import uuid
from datetime import datetime, timezone

from app.core.db import set_doc


def state_hash(state: dict) -> str:
    payload = json.dumps(state, sort_keys=True, default=str)
    return hashlib.sha256(payload.encode()).hexdigest()[:32]


async def log_decision(
    *,
    module: str,
    question_set_id: str,
    version: str,
    state: dict,
    answers: dict,
    confidence: float,
    latency_ms: int,
    cost_usd: float,
    model: str,
    source: str,
    fallback_used: bool = False,
) -> str:
    decision_id = f"dec_{uuid.uuid4().hex[:12]}"
    await set_doc(
        "ai_decisions",
        decision_id,
        {
            "id": decision_id,
            "module": module,
            "questionSetId": question_set_id,
            "questionSetVersion": version,
            "stateHash": state_hash(state),
            "answers": answers,
            "confidence": confidence,
            "latencyMs": latency_ms,
            "costUsd": cost_usd,
            "model": model,
            "source": source,
            "fallbackUsed": fallback_used,
            "at": datetime.now(timezone.utc).isoformat(),
        },
    )
    return decision_id
