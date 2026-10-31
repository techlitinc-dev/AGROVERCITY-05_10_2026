"""ai_decisions logging (ai.md §7): every AI call is persisted with cost +
confidence so outcomes can be linked back for calibration.

Volume control: `decide()` results are linked downstream by decision_id, so
those are always logged. `generate()`/`analyze_image()` discard their
decision_id — their docs are observability-only — so those paths use
`log_decision_sampled`: every degraded/fallback call is kept, successful calls
are kept at ~1 in 10 (deterministic per payload, so reruns stay stable;
`AI_LOG_SUCCESS_SAMPLE_RATE` overrides the rate, tests pin it to 1).
Firestore bills one write per document regardless of size, so fewer docs is
the only way to cut write cost.
"""
import hashlib
import json
import os
import uuid
from datetime import datetime, timezone

from app.core.db import set_doc

_SUCCESS_SAMPLE_RATE = int(os.environ.get("AI_LOG_SUCCESS_SAMPLE_RATE", "10"))


def state_hash(state: dict) -> str:
    payload = json.dumps(state, sort_keys=True, default=str)
    return hashlib.sha256(payload.encode()).hexdigest()[:32]


def should_sample_log(module: str, question_set_id: str, payload: str) -> bool:
    """Deterministic ~1-in-_SUCCESS_SAMPLE_RATE keep for successful write-only
    logs. Degraded (fallback) calls are never sampled out."""
    key = f"{module}:{question_set_id}:{payload[:200]}".encode()
    return int(hashlib.sha256(key).hexdigest(), 16) % _SUCCESS_SAMPLE_RATE == 0


async def log_decision_sampled(*, fallback_used: bool, **kwargs) -> str | None:
    """log_decision for write-only paths: keep all fallbacks, sample successes.
    Returns the decision_id when logged, else None."""
    if fallback_used or should_sample_log(
        kwargs.get("module", ""),
        kwargs.get("question_set_id", ""),
        str(kwargs.get("state", "")),
    ):
        return await log_decision(fallback_used=fallback_used, **kwargs)
    return None


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
