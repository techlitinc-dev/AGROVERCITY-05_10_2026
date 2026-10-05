"""Krishi Academy AI intelligence (phase-04 WS-06, brief M20).

Three features, all routed through `services/ai/gateway.py` (global rule 10):

1. Per-farmer course relevance (`courses.recommend.v1`) — annotates the learner
   catalog at `suggest` level and is Redis-cached 24h per farmer (never per
   page-view).
2. Objective auto-grading of practical assignments (`courses.grade_suggest.v1`)
   — a strict Pydantic rubric produced via `gateway.generate`, stored on the
   submission doc as a PREFILL only. The instructor must confirm before a grade
   is published (global rule 12 — never auto-publish).
3. Learning-path suggestion on certificate issue (C20) — the next-course
   sequence, cached per (farmer, certificate).

State is pseudonymized via `services/ai/privacy.py` and stays ≤1,500 tokens with
no phone/email/Aadhaar (global rule 11).
"""
import json
from datetime import datetime, timedelta, timezone

from pydantic import BaseModel, Field, ValidationError

from app.core.cache import cache_get, cache_set
from app.core.config import settings
from app.core.db import get_doc, query
from app.services.ai import (
    config_store,
    decision_log,
    gateway,
    outcomes,
    privacy,
    question_sets,
)
from app.services.tasks import emit_task

RECOMMEND_QUESTION_SET = "courses.recommend.v1"
RECOMMEND_MODULE = "courses_recommend"
AUT_GRADE_QUESTION_SET = "courses.grade_suggest.v1"
AUT_GRADE_MODULE = "courses_autograde"

RECOMMEND_CACHE_SECONDS = 86400  # 24h
MAX_CANDIDATE_COURSES = 60


def current_season(now: datetime | None = None) -> str:
    """Coarse Indian cropping season from the month (deterministic, no AI)."""
    month = (now or datetime.now(timezone.utc)).month
    if 6 <= month <= 10:
        return "kharif"
    if month in (11, 12, 1, 2, 3):
        return "rabi"
    return "zaid"


def _farmer_crops(user: dict) -> list[str]:
    raw = user.get("crops") or user.get("activeCrops") or user.get("primaryCrops") or []
    return [str(crop).strip() for crop in raw if str(crop).strip()][:20]


def _progress_percent(purchase: dict) -> float:
    try:
        return float(purchase.get("progressPercent") or 0.0)
    except (TypeError, ValueError):
        return 0.0


async def _candidate_courses() -> list[dict]:
    """Published catalog trimmed to the fields the recommender ranks on."""
    docs = await query("courses", [("status", "==", "published")], limit=1000)
    docs = [doc for doc in docs if doc.get("id")]
    docs.sort(
        key=lambda doc: (
            str(doc.get("createdAt") or ""),
            int(doc.get("salesCount") or 0),
            str(doc.get("id")),
        ),
        reverse=True,
    )
    candidates = []
    for doc in docs[:MAX_CANDIDATE_COURSES]:
        candidates.append(
            {
                "id": doc.get("id"),
                "title": privacy.sanitize_text(str(doc.get("title") or "")),
                "category": privacy.sanitize_text(str(doc.get("category") or "")),
                "level": str(doc.get("level") or ""),
                "createdAt": doc.get("createdAt"),
                "salesCount": int(doc.get("salesCount") or 0),
            }
        )
    return candidates


async def build_farmer_course_state(uid: str) -> dict:
    """Pseudonymized course-intelligence state for a farmer (M20, SDR step 4).

    Fields: `crops`, `district`, `currentSeason`, `completedCourseIds`,
    `inProgressCourseIds` plus the published-course candidates the deterministic
    fallback ranks. ≤1,500 tokens and redacted of phone/email/Aadhaar — the
    privacy helper's sanitizer is applied verbatim and verified below.
    """
    user = await get_doc("users", uid) or {}
    purchases = await query("course_purchases", [("userId", "==", uid)], limit=500)

    completed = sorted(
        {
            p.get("courseId")
            for p in purchases
            if p.get("courseId") and p.get("isCompleted")
        }
    )
    in_progress = sorted(
        {
            p.get("courseId")
            for p in purchases
            if p.get("courseId")
            and p.get("status") == "paid"
            and not p.get("isCompleted")
            and 0.0 < _progress_percent(p) < 100.0
        }
    )

    state = {
        "farmer_pseudo_id": privacy.hash_user_id(uid),
        "crops": _farmer_crops(user),
        "district": privacy.sanitize_text(
            str(user.get("district") or user.get("village") or user.get("tehsil") or "")
        ),
        "currentSeason": str(user.get("currentSeason") or "") or current_season(),
        "completedCourseIds": completed,
        "inProgressCourseIds": in_progress,
        "courses": await _candidate_courses(),
    }
    clean = privacy.sanitize_state(state)

    blob = json.dumps(clean, default=str)
    if privacy.estimate_tokens(blob) > privacy.MAX_STATE_TOKENS:
        raise ValueError("course state exceeds the 1500-token AI budget")
    if privacy.PHONE_RE.search(blob) or privacy.EMAIL_RE.search(blob) or privacy.AADHAAR_RE.search(blob):
        raise ValueError("PII leaked into the course-intelligence state")
    return clean


def _normalize_recommendations(items) -> list[dict]:
    """Coerce a recommender answer to `{courseId, relevance, badges}`."""
    normalized: list[dict] = []
    for item in items or []:
        if not isinstance(item, dict):
            continue
        course_id = item.get("courseId") or item.get("course_id") or item.get("id")
        if not course_id:
            continue
        badges = item.get("badges")
        try:
            relevance = float(item.get("relevance") or 0.0)
        except (TypeError, ValueError):
            relevance = 0.0
        normalized.append(
            {
                "courseId": str(course_id),
                "relevance": relevance,
                "badges": [str(badge) for badge in badges] if isinstance(badges, list) else [],
            }
        )
    return normalized


async def _fallback_recommendations(state: dict) -> list[dict]:
    answers = question_sets.fallback_answers(RECOMMEND_QUESTION_SET, state)
    return _normalize_recommendations(answers.get("recommendations"))


async def recommend_courses(uid: str) -> dict:
    """Per-farmer course relevance for the learner catalog (M20, SDR step 2/3).

    Redis-cached 24h per farmer (`ai:courses_recommend:{uid}`, `ex=86400`) —
    never per page-view. Falls back to the deterministic crop-category ordering
    on shim, a disabled module flag, an empty answer, or a gateway outage; the
    response SHAPE (`{data, source}`) is identical in every case.
    """
    cache_key = f"ai:courses_recommend:{uid}"
    cached = await cache_get(cache_key)
    if cached:
        try:
            payload = json.loads(cached)
        except (TypeError, ValueError):
            payload = None
        if isinstance(payload, dict) and isinstance(payload.get("data"), list):
            return {"data": payload["data"], "source": payload.get("source", "fallback")}

    state = await build_farmer_course_state(uid)
    fallback_data = await _fallback_recommendations(state)
    decision_id: str | None = None
    source = "fallback"
    data = fallback_data
    try:
        decision = await gateway.decide(
            state, RECOMMEND_QUESTION_SET, ctx="academy_catalog", module=RECOMMEND_MODULE
        )
        decision_id = decision.decision_id
        ranked = _normalize_recommendations((decision.answers or {}).get("recommendations"))
        # A real model ranking (`jev`/`gemini`) upgrades the ordering; shim and
        # fallback both render the deterministic ordering identically.
        if decision.source in ("jev", "gemini") and ranked:
            data = ranked
            source = "ai"
    except Exception:  # noqa: BLE001 — a gateway outage must never break the catalog
        data = fallback_data
        source = "fallback"

    payload = {
        "data": data,
        "source": source,
        "decisionId": decision_id,
        "decidedAt": datetime.now(timezone.utc).isoformat(),
        "courseIds": [item["courseId"] for item in data],
    }
    await cache_set(cache_key, json.dumps(payload), RECOMMEND_CACHE_SECONDS)
    return {"data": data, "source": source}


RECOMMENDATION_WINDOW_DAYS = 7


async def record_purchase_outcome_if_recommended(uid: str, course_id: str) -> dict | None:
    """Outcome hook (task 6.13): a purchase that followed a recommendation.

    Reads the 24h-cached ranking for the farmer; when the purchased course was
    among the recommended ids within the 7-day measurement window it records the
    `purchase_after_recommendation` outcome against the stored decision id.
    Returns the outcome doc, or `None` when the purchase was not recommendation-led.
    """
    cached = await cache_get(f"ai:courses_recommend:{uid}")
    if not cached:
        return None
    try:
        payload = json.loads(cached)
    except (TypeError, ValueError):
        return None
    if not isinstance(payload, dict):
        return None
    course_ids = payload.get("courseIds") or [
        row.get("courseId")
        for row in (payload.get("data") or [])
        if isinstance(row, dict)
    ]
    if course_id not in course_ids:
        return None
    decided_at = payload.get("decidedAt")
    if decided_at:
        try:
            when = datetime.fromisoformat(str(decided_at))
        except (TypeError, ValueError):
            return None
        if when.tzinfo is None:
            when = when.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) - when > timedelta(days=RECOMMENDATION_WINDOW_DAYS):
            return None
    return await outcomes.record_recommendation_purchase_outcome(
        uid, course_id, payload.get("decisionId")
    )


# ---------------------------------------------------------------------------
# Objective auto-grading (SGR recipe) — PREFILL ONLY, instructor confirm
# ---------------------------------------------------------------------------
class RubricGradeItem(BaseModel):
    questionId: str
    score: int
    maxScore: int
    feedbackKey: str


class RubricGrade(BaseModel):
    items: list[RubricGradeItem] = Field(default_factory=list)
    overallFeedbackKey: str


def _clean_json_str(raw: str) -> str:
    """Strip Markdown fences around a JSON model reply."""
    cleaned = (raw or "").strip()
    if "```" in cleaned:
        parts = cleaned.split("```")
        if len(parts) >= 2:
            cleaned = parts[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
            cleaned = cleaned.strip()
    return cleaned


def _parse_rubric(raw) -> RubricGrade | None:
    if not isinstance(raw, str) or not raw.strip():
        return None
    try:
        parsed = json.loads(_clean_json_str(raw))
    except (TypeError, ValueError):
        return None
    try:
        return RubricGrade.model_validate(parsed)
    except ValidationError:
        return None


def _rubric_prompt(submission: dict, raw: str | None = None) -> str:
    schema = json.dumps(RubricGrade.model_json_schema())
    if raw is not None:
        return (
            "Fix and format the following grading text into strictly valid JSON "
            f"matching this exact schema: {schema}\n{raw}"
        )
    title = privacy.sanitize_text(str(submission.get("title") or ""))
    notes = privacy.sanitize_text(str(submission.get("notes") or ""))
    criteria = submission.get("rubric") or {}
    return (
        "You are an agricultural instructor objectively grading a practical "
        "assignment submission. Score each criterion out of its maximum and "
        "return ONLY valid JSON matching this exact schema (no prose, no "
        f"Markdown): {schema}\n"
        f"Assignment: {title}\n"
        f"Learner notes: {notes}\n"
        f"Rubric criteria: {json.dumps(criteria, default=str)}"
    )


def _score_pct(grade: RubricGrade) -> int:
    total_max = sum(item.maxScore for item in grade.items)
    if total_max <= 0:
        return 0
    total = sum(item.score for item in grade.items)
    return int(round(min(1.0, total / total_max) * 100))


async def suggest_assignment_grade(submission: dict, *, user_lang: str) -> dict | None:
    """Objective assignment grading via `gateway.generate` (SGR recipe, M20).

    A strict `RubricGrade` is produced (validated), with ONE repair retry on a
    validation failure. On a second failure this returns `None` — the fallback is
    simply "no suggestion", and the instructor grades manually. The result is a
    PREFILL only (`require_confirm`, global rule 12): it never publishes a grade.
    """
    if not await config_store.module_enabled(AUT_GRADE_MODULE):
        return None

    opts = {
        "module": AUT_GRADE_MODULE,
        "model": "lite",
        "json_schema": RubricGrade.model_json_schema(),
        "language": user_lang,
    }

    raw = await gateway.generate(_rubric_prompt(submission), opts)
    grade = _parse_rubric(raw)
    if grade is None:
        repaired = await gateway.generate(_rubric_prompt(submission, raw=raw), opts)
        grade = _parse_rubric(repaired)
    if grade is None:
        return None

    shim = settings.ai_provider == "shim"
    decision_id = await decision_log.log_decision(
        module=AUT_GRADE_MODULE,
        question_set_id=AUT_GRADE_QUESTION_SET,
        version="v1",
        state={
            "submissionId": submission.get("id"),
            "courseId": submission.get("courseId"),
        },
        answers=grade.model_dump(),
        confidence=0.8,
        latency_ms=0,
        cost_usd=0.0 if shim else 0.0001,
        model="shim" if shim else "gemini",
        source="shim" if shim else "gemini",
        fallback_used=False,
    )
    return {
        "rubric": grade.model_dump(),
        "suggestedScorePct": _score_pct(grade),
        "decision_id": decision_id,
    }


# ---------------------------------------------------------------------------
# Learning-path suggestion on certificate issue (C20)
# ---------------------------------------------------------------------------
COURSES_DEEP_LINK = "/dashboard/p/courses"


def _most_popular_in_category(
    courses: list[dict], category: str, exclude_ids: set[str]
) -> str | None:
    """Deterministic fallback: the most-sold course in the certificate's category."""
    target = str(category or "").strip().lower()
    pool = [
        course
        for course in courses
        if course.get("id")
        and course.get("id") not in exclude_ids
        and str(course.get("category") or "").strip().lower() == target
    ]
    if not pool:
        pool = [course for course in courses if course.get("id") and course.get("id") not in exclude_ids]
    if not pool:
        return None
    pool.sort(
        key=lambda course: (
            int(course.get("salesCount") or 0),
            str(course.get("createdAt") or ""),
            str(course.get("id")),
        ),
        reverse=True,
    )
    return pool[0]["id"]


async def _emit_next_course_task(uid: str, course_id: str, courses: list[dict]) -> None:
    title = next(
        (str(course.get("title") or "") for course in courses if course.get("id") == course_id),
        "",
    )
    await emit_task(
        uid,
        persona="farmer",
        module="courses",
        kind="next_course_for_you",
        title_en="Next course for you",
        title_hi="आपके लिए अगला पाठ्यक्रम",
        subtitle=title,
        priority="upcoming",
        deep_link=COURSES_DEEP_LINK,
        source_id=course_id,
    )


async def suggest_learning_path(uid: str, certificate_id: str) -> dict:
    """Next-course sequence for a freshly certified farmer (C20).

    Cached per (farmer, certificate) (`ai:learning_path:{uid}:{certificate_id}`,
    `ex=86400`). Uses the `courses.recommend.v1` machinery on the farmer's
    crops/season/skill gaps; the fallback is the most popular published course in
    the certificate's category. Emits a phase-01 `next_course_for_you` task
    deep-linking to the catalog when a next course exists.
    """
    cache_key = f"ai:learning_path:{uid}:{certificate_id}"
    cached = await cache_get(cache_key)
    if cached:
        try:
            payload = json.loads(cached)
        except (TypeError, ValueError):
            payload = None
        if isinstance(payload, dict) and isinstance(payload.get("courseIds"), list):
            return payload

    purchases = await query("course_purchases", [("certificateId", "==", certificate_id)], limit=1)
    purchase = purchases[0] if purchases else {}
    course_id = purchase.get("courseId")
    course = await get_doc("courses", course_id) if course_id else None
    category = (course or {}).get("category") or ""

    state = await build_farmer_course_state(uid)
    candidates = state.get("courses") or []
    exclude = set(state.get("completedCourseIds") or [])
    if course_id:
        exclude.add(course_id)

    source = "fallback"
    course_ids: list[str] = []
    try:
        decision = await gateway.decide(
            state, RECOMMEND_QUESTION_SET, ctx="learning_path", module=RECOMMEND_MODULE
        )
        if decision.source in ("jev", "gemini"):
            ranked = _normalize_recommendations((decision.answers or {}).get("recommendations"))
            course_ids = [row["courseId"] for row in ranked if row["courseId"] not in exclude][:3]
            if course_ids:
                source = "ai"
    except Exception:  # noqa: BLE001 — an outage degrades to the category fallback
        course_ids = []

    if not course_ids:
        fallback_id = _most_popular_in_category(candidates, category, exclude)
        course_ids = [fallback_id] if fallback_id else []
        source = "fallback"

    result = {"courseIds": course_ids, "source": source}
    await cache_set(cache_key, json.dumps(result), RECOMMEND_CACHE_SECONDS)
    if course_ids:
        await _emit_next_course_task(uid, course_ids[0], candidates)
    return result


async def apply_learning_path(purchase: dict) -> dict | None:
    """Attach `learningPath` to a paid purchase that carries a certificate.

    Idempotent: returns the existing suggestion when already present, so the
    certificate-issuance paths (courses.py + teachers.py) never recompute.
    """
    if purchase.get("learningPath"):
        return purchase["learningPath"]
    certificate_id = purchase.get("certificateId")
    uid = purchase.get("userId")
    if not certificate_id or not uid:
        return None
    result = await suggest_learning_path(uid, certificate_id)
    purchase["learningPath"] = result
    return result
