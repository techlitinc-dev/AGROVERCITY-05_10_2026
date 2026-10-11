"""Contract attractiveness AI (WS-07 M18, suggest level).

Scores a contract's expected income vs the 12-week mandi trend plus agronomy
risk flags for the farmer grow-for-us card. The explanation is cached per
`decisionId` on the contract doc: a second read is a pure cache hit (no gateway
call, no new `ai_decisions` row). Provider failures degrade to the
deterministic fallback, logged with `fallbackUsed`. This never touches status
or the e-sign flow.
"""
import logging
from datetime import datetime, timedelta

from app.core.db import query, set_doc
from app.services.ai import config_store, decision_log, gateway, question_sets
from app.services.ai.privacy import build_contract_attractiveness_state

log = logging.getLogger(__name__)

CONTRACT_ATTRACTIVENESS_MODULE = "contracts_attractiveness"
CONTRACT_ATTRACTIVENESS_QUESTION_SET = "contracts.attractiveness.v1"
CONTRACT_ATTRACTIVENESS_WINDOW_DAYS = 84  # ≈12 weeks


async def _build_mandi_trend(crop: str | None, mandi_name: str | None) -> list[dict]:
    """`mandi_price_history` modal series (windowed to ~12 weeks, ≤12 points),
    else the `mandi_prices` modal as a single-point series so the score still computes."""
    crop_l = (crop or "").lower()
    mandi_l = (mandi_name or "").lower()

    def _matches(doc: dict) -> bool:
        if crop_l and crop_l not in (doc.get("commodity") or "").lower():
            return False
        if mandi_l and mandi_l not in (doc.get("mandiName") or doc.get("mandi") or "").lower():
            return False
        return True

    points: list[dict] = []
    for doc in await query("mandi_price_history", [], limit=10000):
        if not _matches(doc):
            continue
        modal = float(doc.get("modalPrice") or 0.0)
        if modal > 0:
            points.append({"date": str(doc.get("date") or ""), "modalPrice": modal})
    points.sort(key=lambda p: p["date"])
    if points:
        latest = points[-1]["date"]
        try:
            cutoff = (
                datetime.fromisoformat(latest) - timedelta(days=CONTRACT_ATTRACTIVENESS_WINDOW_DAYS)
            ).date().isoformat()
            points = [p for p in points if not p["date"] or p["date"] >= cutoff]
        except (TypeError, ValueError):
            pass
        return points[-12:]

    mandi_docs = [d for d in await query("mandi_prices", [], limit=1000) if _matches(d)]
    if mandi_docs:
        modal = round(
            sum(float(d.get("modalPrice") or 0.0) for d in mandi_docs) / len(mandi_docs), 2
        )
        return [{"date": "", "modalPrice": modal}]
    return []


async def _farmer_crop_history(farmer_id: str, exclude_contract_id: str | None) -> list[dict]:
    if not farmer_id:
        return []
    docs = await query("contracts", [("farmerId", "==", farmer_id)], limit=200)
    return [{"crop": d.get("crop")} for d in docs if d.get("id") != exclude_contract_id]


async def attach_contract_attractiveness(contract: dict, *, persist: bool = True) -> dict | None:
    """M18 — compute/attach the `attractiveness` annotation on a contract.

    Returns the annotation, or None when the `contracts_attractiveness` flag is
    off (the contract is unchanged).
    """
    if not await config_store.module_enabled(CONTRACT_ATTRACTIVENESS_MODULE):
        return None

    cached = contract.get("attractiveness")
    if isinstance(cached, dict) and cached.get("decisionId"):
        return cached

    mandi_trend = await _build_mandi_trend(contract.get("crop"), contract.get("mandiName"))
    crop_history = await _farmer_crop_history(contract.get("farmerId"), contract.get("id"))
    state = build_contract_attractiveness_state(contract, mandi_trend, crop_history)
    try:
        decision = await gateway.decide(
            state,
            CONTRACT_ATTRACTIVENESS_QUESTION_SET,
            ctx=contract.get("farmerId"),
            module=CONTRACT_ATTRACTIVENESS_MODULE,
        )
        answers = dict(decision.answers or {})
        confidence = float(decision.confidence or 0.0)
        decision_id = decision.decision_id
    except Exception as exc:  # noqa: BLE001 — degrade, never break the contract flow
        log.warning("contract attractiveness decide failed (%s) — degrading to fallback", exc)
        answers = question_sets.fallback_answers(CONTRACT_ATTRACTIVENESS_QUESTION_SET, state)
        confidence = 0.0
        decision_id = await decision_log.log_decision(
            module=CONTRACT_ATTRACTIVENESS_MODULE,
            question_set_id=CONTRACT_ATTRACTIVENESS_QUESTION_SET,
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

    annotation = {
        "incomeVsMandi": round(float(answers.get("incomeVsMandi") or 0.0), 2),
        "riskFlags": [str(flag) for flag in (answers.get("riskFlags") or [])],
        "explanation": str(answers.get("explanation") or ""),
        "confidence": round(confidence, 3),
        "decisionId": decision_id,
    }
    contract["attractiveness"] = annotation
    if persist and contract.get("id"):
        await set_doc("contracts", contract["id"], contract)
    return annotation
