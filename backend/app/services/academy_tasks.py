"""Learner discovery tasks for Krishi Academy (phase-04 WS-01 task 1.26).

Deterministic dashboard tasks for the farmer persona, emitted when the learner
opens their library (`GET /v1/courses/my-learning`):

- `new_courses_for_you` — the newest published course in the farmer's crop
  categories (the deterministic fallback for the WS-06 AI recommendation
  surface; identical task shape whether or not AI is live).
- `live_class_today`    — a batch of a course the farmer has paid for whose
  date window covers today.

All emissions are dedupe-safe via `sourceId` (phase-01 task engine contract).
"""
from datetime import datetime, timezone

from app.core.db import get_doc, query
from app.services.tasks import emit_task

DEEP_LINK = "/dashboard/p/courses"


def _today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _crop_categories(user: dict) -> list[str]:
    raw = user.get("crops") or user.get("activeCrops") or []
    return [str(c).strip() for c in raw if str(c).strip()]


async def _emit_new_courses(uid: str, user: dict) -> None:
    crops = _crop_categories(user)
    if not crops:
        return  # no crop categories → nothing to personalise, skip silently
    published = await query("courses", [("status", "==", "published")], limit=1000)
    crop_set = {c.lower() for c in crops}
    matches = [c for c in published if str(c.get("category", "")).strip().lower() in crop_set]
    if not matches:
        return
    matches.sort(key=lambda c: c.get("createdAt", ""), reverse=True)
    newest = matches[0]
    await emit_task(
        uid,
        persona="farmer",
        module="courses",
        kind="new_courses_for_you",
        title_en="New courses matching your crops",
        title_hi="आपकी फसलों से मेल खाते नए पाठ्यक्रम",
        subtitle=newest.get("title", ""),
        priority="upcoming",
        deep_link=DEEP_LINK,
        source_id=newest.get("id", ""),
    )


async def _emit_live_class(uid: str) -> None:
    purchases = await query(
        "course_purchases", [("userId", "==", uid), ("status", "==", "paid")], limit=500
    )
    course_ids = {p.get("courseId") for p in purchases if p.get("courseId")}
    if not course_ids:
        return
    today = _today()
    for course_id in course_ids:
        batches = await query("course_batches", [("courseId", "==", course_id)], limit=100)
        for batch in batches:
            start = str(batch.get("startDate") or "")
            end = str(batch.get("endDate") or "")
            if start and end and start <= today <= end:
                await emit_task(
                    uid,
                    persona="farmer",
                    module="courses",
                    kind="live_class_today",
                    title_en="Live class today",
                    title_hi="आज लाइव कक्षा",
                    subtitle=batch.get("scheduleDays", ""),
                    priority="today",
                    deep_link=DEEP_LINK,
                    source_id=batch.get("id", ""),
                )


async def emit_learner_discovery_tasks(uid: str) -> None:
    """Emit the learner's discovery tasks (crop-matched courses + classes today)."""
    user = await get_doc("users", uid)
    if user is None:
        return
    await _emit_new_courses(uid, user)
    await _emit_live_class(uid)
