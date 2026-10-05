"""Outcome linkage (ai.md §7): connects a logged ai_decision to its real-world
resolution so the weekly calibration dataset can measure accuracy."""
from datetime import datetime, timezone

from app.core.db import get_doc, set_doc


async def record_outcome(decision_id: str, outcome) -> dict:
    """Link a logged decision to its real-world outcome (string label or dict)."""
    decision = await get_doc("ai_decisions", decision_id)
    if decision is None:
        raise ValueError(f"unknown decision: {decision_id}")
    record = {
        "decisionId": decision_id,
        "module": decision.get("module"),
        "questionSetId": decision.get("questionSetId"),
        "outcome": outcome,
        "recordedAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("ai_outcomes", decision_id, record)
    return record


async def record_module_outcome(
    module: str,
    question_set_id: str,
    entity_id: str,
    outcome,
    details: dict | None = None,
) -> dict:
    """Outcome hook (SDR step 6): link a domain entity's real-world resolution
    back to the question set that annotated it.

    Keyed by (module, entity, outcome) so re-recording the same resolution is
    idempotent. The console briefs (M14/M15/…) call their typed wrapper below.
    """
    record_id = f"outcome_{module}_{entity_id}_{outcome}"
    record = {
        "id": record_id,
        "decisionId": (details or {}).get("decisionId"),
        "module": module,
        "questionSetId": question_set_id,
        "entityId": entity_id,
        "outcome": outcome,
        "details": details or {},
        "recordedAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("ai_outcomes", record_id, record)
    return record


async def record_prescreen_outcome(
    application_id: str,
    outcome: str,
    decision_id: str | None = None,
    details: dict | None = None,
) -> dict:
    """M14 hook — loan prescreen resolution: `approved` | `rejected` | `defaulted`.

    The loan status machine (WS-03) has no `defaulted` transition, so that label
    is reserved for a future repayment-default source; only `approved`/`rejected`
    are emitted today (WS-07 task 7.6).
    """
    payload = {"decisionId": decision_id, **(details or {})}
    return await record_module_outcome(
        "loans_prescreen", "loans.prescreen.v1", application_id, outcome, payload
    )


async def record_triage_outcome(
    claim_id: str,
    outcome: str,
    claim: dict | None = None,
    decision_id: str | None = None,
    details: dict | None = None,
) -> dict:
    """M15 hook — claim resolution: the final human decision plus whether the
    retake guidance was followed (proxied by the claim ending up with the
    recommended photo count). `outcome` is `approved` | `rejected`."""
    from app.services.ai.question_sets import REQUIRED_CLAIM_PHOTOS

    claim = claim or {}
    triage = claim.get("triage") or {}
    followed = len(claim.get("damagePhotos") or []) >= REQUIRED_CLAIM_PHOTOS
    payload = {
        "decisionId": decision_id or triage.get("decisionId"),
        "retakeGuidanceFollowed": followed,
        "photoQuality": triage.get("photoQuality"),
        **(details or {}),
    }
    return await record_module_outcome(
        "insurance_triage", "insurance.triage.v1", claim_id, outcome, payload
    )


async def record_adulteration_outcome(
    collection_id: str,
    outcome: str,
    decision_id: str | None = None,
    details: dict | None = None,
) -> dict:
    """M17 hook — dairy adulteration flag resolution: the manager `confirmed` or
    `dismissed` the per-collection anomaly flag on the collections ledger."""
    payload = {"decisionId": decision_id, **(details or {})}
    return await record_module_outcome(
        "dairy_adulteration", "dairy.adulteration.v1", collection_id, outcome, payload
    )


async def record_attractiveness_outcome(
    contract_id: str,
    outcome: str,
    decision_id: str | None = None,
    details: dict | None = None,
) -> dict:
    """M18 hook — contract attractiveness resolution: the farmer `accepted` or
    `declined` the contract the score annotated."""
    payload = {"decisionId": decision_id, **(details or {})}
    return await record_module_outcome(
        "contracts_attractiveness", "contracts.attractiveness.v1", contract_id, outcome, payload
    )


async def record_recommendation_purchase_outcome(
    uid: str,
    course_id: str,
    decision_id: str | None = None,
    details: dict | None = None,
) -> dict:
    """M20 hook — a `courses.recommend.v1` recommendation was acted on: the
    farmer purchased a course that was among the ranked recommendations (within
    the 7-day measurement window). Keyed by (farmer, course) so re-recording the
    same resolution is idempotent."""
    payload = {"decisionId": decision_id, "courseId": course_id, **(details or {})}
    return await record_module_outcome(
        "courses_recommend",
        "courses.recommend.v1",
        f"{uid}:{course_id}",
        "purchase_after_recommendation",
        payload,
    )


async def record_grade_delta_outcome(
    assignment_id: str,
    published_grade: str,
    suggested_score_pct: int | None = None,
    decision_id: str | None = None,
    details: dict | None = None,
) -> dict:
    """M20 hook — the instructor's published grade vs the AI rubric suggestion
    (the delta feeds calibration; the AI never publishes — global rule 12)."""
    payload = {
        "decisionId": decision_id,
        "publishedGrade": published_grade,
        "suggestedScorePct": suggested_score_pct,
        **(details or {}),
    }
    return await record_module_outcome(
        "courses_autograde",
        "courses.grade_suggest.v1",
        assignment_id,
        "grade_delta_vs_suggestion",
        payload,
    )
