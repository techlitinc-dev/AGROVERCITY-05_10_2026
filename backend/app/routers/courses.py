import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Query

from app.core.db import delete_doc, get_doc, query, set_doc
from app.core.deps import current_user_id
from app.core.security import verify_mpin
from app.models.courses import (
    AssignmentCreateIn,
    AssignmentSubmissionIn,
    BatchSessionCreateIn,
    CourseContactRequestIn,
    CourseCreateIn,
    CourseEnquiryCreateIn,
    CourseEnrollIn,
    CourseModule,
    CoursePurchaseVerifyIn,
    CourseQuestionIn,
    CourseAnswerIn,
    CourseReviewIn,
    CourseUpdateIn,
    GrantCourseAccessIn,
    LessonProgressIn,
    PurchaseCancelIn,
    PurchaseDisputeIn,
    RevokeCourseAccessIn,
    SessionCheckInIn,
)
from app.services import course_access, idempotency
# Legacy course bookings (old checkout records) still support cancellation with
# gateway refunds; new off-platform access records never reach that code path.
from app.services.payments import refund_razorpay_payment
from app.services.academy_tasks import emit_learner_discovery_tasks
from app.services.rating_prompts import open_rating_prompt
from app.services.tasks import emit_task
from app.services.users import get_user

router = APIRouter(tags=["courses"])

# Retained for legacy records only: the platform commission that was recorded
# on old checkout purchases so the settlements module could clear instructor
# payouts. The online checkout itself was removed from the course journey —
# paid courses now settle directly between learner and instructor, outside
# Agrovercity. The settlements module keeps reading legacy `status == "paid"`
# records; no new record carries these fields.
DEFAULT_COMMISSION_PERCENT = 10.0

# Direct-payment / contact-sharing terms (single source of truth for the
# backend; the frontend renders the same wording).
TERMS_VERSION = course_access.TERMS_VERSION
TERMS_TEXT = course_access.TERMS_TEXT


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def _user(uid: str = Depends(current_user_id)) -> dict:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    return user


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _envelope(docs: list[dict], page: int, page_size: int) -> dict:
    total = len(docs)
    start = (page - 1) * page_size
    return {"data": docs[start:start + page_size], "page": page, "pageSize": page_size, "total": total}


def _is_instructor(user: dict) -> bool:
    profiles = user.get("linkedProfiles") or [user.get("activeProfile") or "farmer"]
    return "instructor" in profiles or user.get("isAdmin", False) or user.get("activeProfile") == "instructor"


async def _require_course(course_id: str) -> dict:
    course = await get_doc("courses", course_id)
    if course is None:
        _error(404, "COURSE_NOT_FOUND", "course not found")
    return course


def _sanitize_modules_for_public(modules: list[dict], is_entitled: bool) -> list[dict]:
    """Hide mediaUrls on non-preview lessons for unentitled users."""
    if is_entitled:
        return modules
    sanitized = []
    for mod in modules:
        mod_copy = dict(mod)
        lessons = []
        for les in mod.get("lessons", []):
            les_copy = dict(les)
            if not les_copy.get("isPreviewFree", False):
                les_copy.pop("mediaUrl", None)
                les_copy.pop("resources", None)
            lessons.append(les_copy)
        mod_copy["lessons"] = lessons
        sanitized.append(mod_copy)
    return sanitized


def _public(course: dict, is_entitled: bool = False) -> dict:
    """Strip instructor-internal fields and media URLs unless entitled."""
    doc = dict(course)
    doc.pop("rejectedReason", None)
    if not is_entitled:
        doc.pop("mediaUrl", None)
    if "modules" in doc and isinstance(doc["modules"], list):
        doc["modules"] = _sanitize_modules_for_public(doc["modules"], is_entitled)
    return doc


def _purchase_id(user_id: str, course_id: str) -> str:
    return f"{user_id}_{course_id}"


def _request_id(user_id: str, course_id: str) -> str:
    return f"{user_id}_{course_id}"


async def _access_record(user_id: str, course_id: str) -> dict | None:
    """The learner's course access + progress record (new model), or a legacy
    checkout record. None when the learner has no record at all."""
    return await get_doc("course_purchases", _purchase_id(user_id, course_id))


async def _paid_purchase(user_id: str, course_id: str) -> dict | None:
    """Backward-compatible alias: a record that currently grants access."""
    record = await _access_record(user_id, course_id)
    if record is not None and course_access.is_granted(record):
        return record
    return None


async def _require_access(course: dict, user: dict) -> dict:
    """The learner must hold granted (non-revoked) access to the course."""
    is_owner = course["instructorId"] == user["id"]
    record = await _access_record(user["id"], course["id"])
    if is_owner:
        return record or {}
    if record is not None and course_access.is_revoked(record):
        _error(403, "ACCESS_REVOKED", "your access to this course was revoked by the instructor")
    if record is None or not course_access.is_granted(record):
        _error(403, "NOT_ENROLLED", "enrol in the course to access the classroom")
    return record


def _course_is_free(course: dict) -> bool:
    return float(course.get("priceRupees") or 0) == 0


def _validate_access_pricing(access_type: str | None, price: float) -> str:
    """Resolve and validate free/paid pricing. Returns the resolved accessType."""
    if access_type is None:
        return "free" if price == 0 else "paid"
    if access_type == "free" and price != 0:
        _error(422, "INVALID_PRICING", "free courses must have a price of 0", {"priceRupees": "must be 0 for free courses"})
    if access_type == "paid" and price <= 0:
        _error(422, "INVALID_PRICING", "paid courses must have a price greater than 0", {"priceRupees": "must be greater than 0 for paid courses"})
    return access_type


# ---------------------------------------------------------------------------
# Instructor studio
# ---------------------------------------------------------------------------
@router.post("/courses", status_code=201)
async def create_course(body: CourseCreateIn, user: dict = Depends(_user)):
    if not _is_instructor(user):
        _error(403, "NOT_INSTRUCTOR", "only instructors can publish courses")
    # WS-02 task 2.27: KYC must be approved before publishing (browse stays open).
    from app.services.kyc import instructor_publish_blocked_reason

    if not user.get("isAdmin"):
        blocked = await instructor_publish_blocked_reason(user["id"])
        if blocked:
            _error(403, "KYC_NOT_APPROVED", blocked)
    # WS-02 step 5: Free tier = 1 course; further courses need `instructor_pro`.
    existing = await query("courses", [("instructorId", "==", user["id"])], limit=500)
    owned = [c for c in existing if c.get("status") in ("published", "pending_review", "pendingReview")]
    from app.services.billing import require_unlimited_courses

    await require_unlimited_courses(user["id"], len(owned))
    course_id = uuid.uuid4().hex[:16]
    now = _now()
    initial_status = "published" if body.autoPublish else "pendingReview"

    access_type = _validate_access_pricing(body.accessType, float(body.priceRupees))
    price = float(body.priceRupees)

    modules_data = [m.model_dump() for m in body.modules]

    doc = {
        "id": course_id,
        "instructorId": user["id"],
        "instructorName": user.get("name") or "Expert Instructor",
        "instructorHeadline": user.get("headline") or "Agricultural Specialist & Educator",
        "instructorAvatarUrl": user.get("avatarUrl") or "",
        "title": body.title,
        "subtitle": body.subtitle,
        "description": body.description,
        "kind": body.kind.value,
        "level": body.level.value if hasattr(body.level, "value") else str(body.level),
        "language": body.language,
        "category": body.category,
        "accessType": access_type,
        "priceRupees": price,
        "currency": body.currency or "INR",
        "priceNotes": body.priceNotes or "",
        "originalPriceRupees": float(body.originalPriceRupees or (price * 2 if price > 0 else 0)),
        "coinsDiscountAllowed": int(body.coinsDiscountAllowed),
        "thumbnailUrl": body.thumbnailUrl,
        "mediaUrl": body.mediaUrl,
        "previewUrl": body.previewUrl,
        "promoVideoUrl": body.promoVideoUrl,
        "whatYouWillLearn": body.whatYouWillLearn,
        "requirements": body.requirements,
        "targetAudience": body.targetAudience,
        "mode": body.mode,
        "materialsList": body.materialsList,
        "certificateEnabled": body.certificateEnabled,
        "certificateTitle": body.certificateTitle or f"Certificate of Completion in {body.title}",
        "modules": modules_data,
        "tags": body.tags or [body.category],
        "status": initial_status,
        # WS-02 task 2.24: phase-07 module 27 admin moderation queue consumes
        # this; the learner `status` lifecycle is unchanged.
        "moderationStatus": "pending_review",
        "rejectedReason": None,
        "isFeatured": False,
        "isBestseller": False,
        "salesCount": 0,
        "ratingSum": 0,
        "ratingCount": 0,
        "instructorEarningsRupees": 0.0,
        "commissionRupees": 0.0,
        "createdAt": now,
        "updatedAt": now,
        "lastUpdatedAt": now,
    }
    await set_doc("courses", course_id, doc)
    return doc


@router.get("/courses/mine")
async def my_courses(user: dict = Depends(_user)):
    docs = await query("courses", [("instructorId", "==", user["id"])], limit=500)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return {"data": docs, "total": len(docs)}


@router.put("/courses/{course_id}")
async def update_course(course_id: str, body: CourseUpdateIn, user: dict = Depends(_user)):
    course = await _require_course(course_id)
    if course["instructorId"] != user["id"]:
        _error(403, "FORBIDDEN", "not your course")
    if course["status"] == "published" and body.status is None:
        _error(409, "ALREADY_PUBLISHED", "published courses cannot be edited; unpublish first")

    # Free/paid pricing stays consistent on edits.
    next_access_type = body.accessType or course.get("accessType") or ("free" if float(course.get("priceRupees") or 0) == 0 else "paid")
    next_price = float(body.priceRupees) if body.priceRupees is not None else float(course.get("priceRupees") or 0)
    resolved_type = _validate_access_pricing(next_access_type, next_price)

    modules_changed = body.modules is not None
    fields = body.model_dump(exclude_none=True)
    for key, value in fields.items():
        if hasattr(value, "value"):
            course[key] = value.value
        else:
            course[key] = value
    course["accessType"] = resolved_type

    # Any edit after a rejection or draft sends the course back through review if status not explicitly given
    if body.status is None:
        course["status"] = "pendingReview"
        course["rejectedReason"] = None

    now = _now()
    course["updatedAt"] = now
    course["lastUpdatedAt"] = now
    await set_doc("courses", course_id, course)

    # Meaningful content update on a published course: notify enrolled learners
    # (curriculum changes only — never on cosmetic edits, never duplicate).
    if modules_changed and course.get("status") == "published":
        from app.services.notify import notify_user

        learners = await query("course_purchases", [("courseId", "==", course_id)], limit=500)
        for record in learners:
            if not course_access.is_granted(record):
                continue
            await notify_user(
                record.get("userId"),
                type="course_content_updated",
                title="Course content updated / पाठ्यक्रम अपडेट",
                body=f"New material was added to {course.get('title') or 'a course you are learning'}.",
                deepLink=f"/dashboard/p/courses/{course_id}/learn",
            )
    return course


@router.post("/courses/{course_id}/duplicate", status_code=201)
async def duplicate_course(course_id: str, user: dict = Depends(_user)):
    """Copy one of the instructor's own courses into a new draft (lessons keep
    their ids inside the new course doc; the course itself gets a fresh id)."""
    course = await _require_course(course_id)
    if course["instructorId"] != user["id"]:
        _error(403, "FORBIDDEN", "not your course")
    new_id = uuid.uuid4().hex[:16]
    now = _now()
    doc = dict(course)
    doc.update(
        {
            "id": new_id,
            "title": f"{course.get('title') or 'Course'} (Copy)",
            "status": "draft",
            "moderationStatus": "pending_review",
            "rejectedReason": None,
            "isFeatured": False,
            "isBestseller": False,
            "salesCount": 0,
            "ratingSum": 0,
            "ratingCount": 0,
            "instructorEarningsRupees": 0.0,
            "commissionRupees": 0.0,
            "createdAt": now,
            "updatedAt": now,
            "lastUpdatedAt": now,
        }
    )
    await set_doc("courses", new_id, doc)
    return doc


@router.delete("/courses/{course_id}", status_code=204)
async def delete_course(course_id: str, user: dict = Depends(_user)):
    course = await _require_course(course_id)
    if course["instructorId"] != user["id"]:
        _error(403, "FORBIDDEN", "not your course")
    if course["status"] == "published":
        _error(409, "ALREADY_PUBLISHED", "unpublish before deleting a published course")
    await delete_doc("courses", course_id)


# ---------------------------------------------------------------------------
# Farmer / Student Superstore storefront
# ---------------------------------------------------------------------------
@router.get("/courses")
async def list_courses(
    kind: str | None = None,
    category: str | None = None,
    language: str | None = None,
    level: str | None = None,
    search: str | None = None,
    isFree: bool | None = None,
    priceMax: float | None = None,
    page: int = 1,
    pageSize: int = 20,
    user: dict = Depends(_user),
):
    docs = await query("courses", [("status", "==", "published")], limit=1000)
    if kind:
        docs = [d for d in docs if d.get("kind") == kind]
    if category and category != "All":
        docs = [d for d in docs if d.get("category") == category]
    if language:
        docs = [d for d in docs if d.get("language") == language]
    if level and level != "all_levels":
        docs = [d for d in docs if d.get("level") == level]
    if isFree is True:
        docs = [d for d in docs if float(d.get("priceRupees", 0)) == 0]
    elif isFree is False:
        docs = [d for d in docs if float(d.get("priceRupees", 0)) > 0]
    if priceMax is not None:
        docs = [d for d in docs if float(d.get("priceRupees", 0)) <= priceMax]
    if search:
        needle = search.lower()
        docs = [
            d for d in docs
            if needle in d.get("title", "").lower()
            or needle in d.get("subtitle", "").lower()
            or needle in d.get("description", "").lower()
            or needle in d.get("instructorName", "").lower()
            or any(needle in tag.lower() for tag in d.get("tags", []))
        ]

    # Sort featured first, then bestseller, then newest
    docs.sort(
        key=lambda d: (
            1 if d.get("isFeatured") else 0,
            1 if d.get("isBestseller") else 0,
            d.get("salesCount", 0),
            d.get("createdAt", ""),
        ),
        reverse=True,
    )

    my_records = await query("course_purchases", [("userId", "==", user["id"])], limit=1000)
    access_ids = {r["courseId"] for r in my_records if course_access.is_granted(r)}
    saved_ids = {s["courseId"] for s in await query("saved_courses", [("userId", "==", user["id"])], limit=500)}
    badges = await course_access.badge_map([d["instructorId"] for d in docs])

    for doc in docs:
        is_entitled = doc["id"] in access_ids
        doc["hasAccess"] = is_entitled
        # Legacy flag name kept for older clients; it now means "access granted".
        doc["isPurchased"] = is_entitled
        doc["isSaved"] = doc["id"] in saved_ids
        badge = badges.get(doc["instructorId"]) or {}
        doc["instructorIdentityVerified"] = bool(badge.get("identity"))
        # Expertise badge only after an actual qualification/experience review.
        doc["instructorExpertiseVerified"] = bool(badge.get("expertise"))
        doc["lessonCount"] = _lesson_count(doc.get("modules") or [])
        doc["durationMinutes"] = _duration_minutes(doc.get("modules") or [])
        public = course_access.strip_internal_fields(doc)
        public["modules"] = _sanitize_modules_for_public(doc.get("modules") or [], is_entitled)
        doc.clear()
        doc.update(public)

    return _envelope(docs, page, pageSize)


@router.get("/courses/purchased/list")
async def my_library(user: dict = Depends(_user)):
    """Every course the learner can currently access (free enrolments and
    instructor-granted paid access), newest first. Kept for backward
    compatibility — the richer grouping lives in /courses/my-learning."""
    records = await query(
        "course_purchases", [("userId", "==", user["id"])], limit=500
    )
    records = [r for r in records if course_access.is_granted(r)]
    records.sort(key=lambda r: r.get("grantedAt") or r.get("paidAt") or r.get("createdAt", ""), reverse=True)
    courses = []
    for record in records:
        course = await get_doc("courses", record["courseId"])
        if course is None:
            continue
        doc = _public(course, is_entitled=True)
        doc["isPurchased"] = True
        doc["hasAccess"] = True
        doc["accessType"] = record.get("accessType")
        doc["accessStatus"] = record.get("accessStatus") or "granted"
        doc["learningStatus"] = course_access.learning_status(record)
        doc["purchasedAt"] = record.get("paidAt")
        doc["enrolledAt"] = record.get("grantedAt") or record.get("paidAt")
        doc["progressPercent"] = record.get("progressPercent", 0)
        doc["isCompleted"] = record.get("isCompleted", False)
        doc["certificateId"] = record.get("certificateId")
        courses.append(doc)
    return {"data": courses, "total": len(courses)}


def _learning_entry(course: dict, record: dict) -> dict:
    return {
        "id": course["id"],
        "courseId": course["id"],
        "title": course.get("title") or "",
        "instructorId": course.get("instructorId"),
        "instructorName": course.get("instructorName") or "",
        "thumbnailUrl": course.get("thumbnailUrl") or "",
        "accessType": record.get("accessType"),
        "accessStatus": record.get("accessStatus") or "granted",
        "learningStatus": course_access.learning_status(record),
        "progressPercent": record.get("progressPercent", 0),
        "isCompleted": bool(record.get("isCompleted")),
        "certificateId": record.get("certificateId"),
        "priceRupees": course.get("priceRupees", 0),
        "currency": course.get("currency") or "INR",
        "enrolledAt": record.get("grantedAt") or record.get("paidAt"),
        "lastAccessedAt": record.get("lastAccessedAt"),
    }


async def _my_sessions(user_id: str) -> list[dict]:
    """Upcoming batch sessions for the learner's active courses (best effort —
    sessions stay visible even when the batch doc is gone)."""
    records = await query("course_purchases", [("userId", "==", user_id)], limit=500)
    course_ids = {r["courseId"] for r in records if course_access.is_granted(r)}
    sessions = await query("batch_sessions", [], limit=1000)
    upcoming = [
        s for s in sessions
        if s.get("courseId") in course_ids and s.get("status") == "scheduled"
    ]
    upcoming.sort(key=lambda s: s.get("startsAt") or "")
    return upcoming[:20]


@router.get("/courses/my-learning")
async def my_learning(user: dict = Depends(_user)):
    """Grouped learner surface:

    continueLearning / freeCourses / paidCourses (access granted) /
    awaitingAccess (contact unlocked, instructor has not granted yet) /
    completedCourses / savedCourses. Access states are described with
    instructor-granted language only — never payment-verification language.
    """
    records = await query("course_purchases", [("userId", "==", user["id"])], limit=500)
    granted = [r for r in records if course_access.is_granted(r)]
    granted.sort(key=lambda r: r.get("lastAccessedAt") or r.get("grantedAt") or r.get("createdAt", ""), reverse=True)

    entries: list[dict] = []
    for record in granted:
        course = await get_doc("courses", record["courseId"])
        if course is None:
            continue
        entries.append(_learning_entry(course, record))

    requests = await query("course_contact_requests", [("learnerId", "==", user["id"])], limit=500)
    awaiting: list[dict] = []
    for req in requests:
        if req.get("status") != course_access.REQUEST_STATUS_CONTACTED:
            continue
        access = await _access_record(user["id"], req["courseId"])
        if access is not None and course_access.is_granted(access):
            continue  # already granted — lives in the paidCourses section
        course = await get_doc("courses", req["courseId"])
        if course is None or course.get("status") != "published":
            continue
        awaiting.append(
            {
                **_learning_entry(course, access or {"courseId": req["courseId"]}),
                "accessStatus": "awaitingGrant",
                "requestId": req["id"],
                "priceRupees": req.get("priceRupees"),
                "currency": req.get("currency") or "INR",
                "requestedAt": req.get("createdAt"),
                "instructorName": course.get("instructorName") or "",
            }
        )
    awaiting.sort(key=lambda r: r.get("requestedAt") or "", reverse=True)

    saved = await query("saved_courses", [("userId", "==", user["id"])], limit=200)
    saved_entries: list[dict] = []
    for row in saved:
        course = await get_doc("courses", row["courseId"])
        if course is None or course.get("status") != "published":
            continue
        saved_entries.append(
            {
                "id": course["id"],
                "courseId": course["id"],
                "title": course.get("title") or "",
                "instructorName": course.get("instructorName") or "",
                "thumbnailUrl": course.get("thumbnailUrl") or "",
                "priceRupees": course.get("priceRupees", 0),
                "currency": course.get("currency") or "INR",
                "savedAt": row.get("createdAt"),
            }
        )

    completed = [e for e in entries if e["isCompleted"]]
    in_progress = [e for e in entries if not e["isCompleted"]]
    free_entries = [e for e in entries if (e.get("accessType") or "free") == "free"]
    paid_entries = [e for e in entries if e.get("accessType") == "manualOffPlatform"]

    # WS-01 task 1.26: emit deterministic learner discovery tasks.
    await emit_learner_discovery_tasks(user["id"])

    return {
        # Flat list kept for older clients (was "my library").
        "data": entries,
        "total": len(entries),
        "continueLearning": in_progress,
        "freeCourses": free_entries,
        "paidCourses": paid_entries,
        "awaitingAccess": awaiting,
        "completedCourses": completed,
        "savedCourses": saved_entries,
        "sessions": await _my_sessions(user["id"]),
    }


@router.get("/courses/my-questions")
async def my_questions(user: dict = Depends(_user)):
    """Every question the learner asked, across courses, with the
    answered/unanswered state and the instructor's answers."""
    my_courses = await query("course_purchases", [("userId", "==", user["id"])], limit=500)
    course_ids = {r["courseId"] for r in my_courses}
    questions: list[dict] = []
    for course_id in course_ids:
        for q in await query(f"courses/{course_id}/questions", [], limit=100):
            if q.get("userId") != user["id"]:
                continue
            course = await get_doc("courses", course_id) or {}
            questions.append(
                {
                    "id": q.get("id"),
                    "courseId": course_id,
                    "courseTitle": course.get("title") or "",
                    "lessonId": q.get("lessonId"),
                    "question": q.get("question"),
                    "answers": q.get("answers") or [],
                    "isAnswered": any(a.get("isInstructor") for a in (q.get("answers") or [])),
                    "createdAt": q.get("createdAt"),
                }
            )
    questions.sort(key=lambda q: q.get("createdAt") or "", reverse=True)
    return {"data": questions, "total": len(questions)}


# ---------------------------------------------------------------------------
# Saved courses (learner bookmarking)
# ---------------------------------------------------------------------------
@router.post("/courses/{course_id}/save", status_code=201)
async def save_course(course_id: str, user: dict = Depends(_user)):
    course = await _require_course(course_id)
    if course.get("status") != "published":
        _error(404, "COURSE_NOT_FOUND", "course not found")
    doc_id = f"{user['id']}_{course_id}"
    existing = await get_doc("saved_courses", doc_id)
    if existing is not None:
        return {**existing, "alreadySaved": True}
    doc = {
        "id": doc_id,
        "userId": user["id"],
        "courseId": course_id,
        "createdAt": _now(),
    }
    await set_doc("saved_courses", doc_id, doc)
    return doc


@router.delete("/courses/{course_id}/save", status_code=204)
async def unsave_course(course_id: str, user: dict = Depends(_user)):
    await delete_doc("saved_courses", f"{user['id']}_{course_id}")


# WS-06 task 6.4 — per-farmer course relevance (M20 `courses.recommend.v1`).
# Declared BEFORE `/courses/{course_id}` so the static path is not captured by
# the path param. All model calls go through the AI gateway; the ranked result
# is Redis-cached 24h per farmer (never per page-view) and degrades to the
# deterministic crop-category ordering with the identical response shape.
@router.get("/courses/recommendations")
async def course_recommendations(user: dict = Depends(_user)):
    from app.services import academy_ai

    return await academy_ai.recommend_courses(user["id"])


@router.get("/courses/{course_id}")
async def get_course(course_id: str, user: dict = Depends(_user)):
    course = await _require_course(course_id)
    is_owner = course["instructorId"] == user["id"]
    if course["status"] != "published" and not is_owner:
        _error(404, "COURSE_NOT_FOUND", "course not found")

    record = await _access_record(user["id"], course_id)
    has_access = is_owner or (record is not None and course_access.is_granted(record))
    is_revoked = not is_owner and record is not None and course_access.is_revoked(record)

    if is_owner:
        doc = dict(course)
    else:
        doc = course_access.strip_internal_fields(course)
        doc = _public(doc, is_entitled=has_access and not is_revoked)
    doc["hasAccess"] = has_access and not is_revoked
    # Legacy flag name kept for older clients.
    doc["isPurchased"] = has_access and not is_revoked
    doc["isOwner"] = is_owner
    doc["access"] = {
        **course_access.access_summary(record),
        "isRevoked": is_revoked,
    }
    if has_access and not is_revoked:
        doc["mediaUrl"] = course.get("mediaUrl")
    else:
        doc.pop("mediaUrl", None)

    # Server-derived verification badges: identity = unified KYC approved;
    # expertise = qualification/experience documents actually reviewed.
    badges = await course_access.badge_map([course["instructorId"]])
    badge = badges.get(course["instructorId"]) or {}
    doc["instructorIdentityVerified"] = bool(badge.get("identity"))
    doc["instructorExpertiseVerified"] = bool(badge.get("expertise"))

    # Verified instructor credentials for the course-detail badge slots
    # (type + verifiedAt only — no PII, no private documents).
    from app.services.kyc import latest_instructor_case, verified_credential_types

    doc["instructorCredentials"] = verified_credential_types(
        await latest_instructor_case(course["instructorId"])
    )

    return doc


# ---------------------------------------------------------------------------
# Enrolment & paid-course contact (online checkout was removed from the course
# journey — paid courses settle directly between learner and instructor)
# ---------------------------------------------------------------------------
_REMOVED_CHECKOUT_MESSAGE = (
    "Online checkout for courses has been removed. Free courses enrol instantly; "
    "for paid courses, contact the instructor directly — payment happens outside "
    "Agrovercity and the instructor grants access manually."
)


@router.post("/courses/{course_id}/purchase")
async def purchase_course_removed(course_id: str, user: dict = Depends(_user)):
    _error(410, "ONLINE_CHECKOUT_REMOVED", _REMOVED_CHECKOUT_MESSAGE)


@router.post("/courses/purchases/verify")
async def verify_purchase_removed(body: CoursePurchaseVerifyIn, user: dict = Depends(_user)):
    _error(410, "ONLINE_CHECKOUT_REMOVED", _REMOVED_CHECKOUT_MESSAGE)


@router.post("/courses/{course_id}/enroll")
async def enroll_course(
    course_id: str,
    body: CourseEnrollIn,
    user: dict = Depends(_user),
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
):
    """Instant free-course enrolment.

    No MPIN, no contact unlock, no payment, no instructor approval. Idempotent:
    repeated calls return the same enrolment and never touch existing progress.
    Paid courses cannot be enrolled through this endpoint — the learner must
    contact the instructor (see /courses/{id}/contact-requests).
    """
    scope = f"courses.enroll.{user['id']}.{course_id}"
    stored = await idempotency.replay(scope, idempotency_key)
    if stored is not None:
        return stored

    course = await _require_course(course_id)
    if course["status"] != "published":
        _error(404, "COURSE_NOT_FOUND", "course not found")
    if course["instructorId"] == user["id"]:
        _error(409, "OWN_COURSE", "instructors cannot enrol in their own course")

    if not _course_is_free(course):
        _error(
            409,
            "PAID_COURSE_CONTACT_REQUIRED",
            "this is a paid course — contact the instructor to enrol. Payment happens "
            "outside Agrovercity and the instructor grants access after receiving it.",
        )

    pid = _purchase_id(user["id"], course_id)
    existing = await get_doc("course_purchases", pid)
    already = existing is not None and course_access.is_granted(existing)
    if already:
        response = {
            "enrolled": True,
            "alreadyEnrolled": True,
            "courseId": course_id,
            "accessType": existing.get("accessType") or "free",
            "accessStatus": existing.get("accessStatus") or "granted",
            "learningStatus": course_access.learning_status(existing),
        }
    else:
        record = course_access.new_access_doc(
            user=user, course=course, access_type=course_access.ACCESS_TYPE_FREE
        )
        # enrolment timestamp doubles as the progress anchor
        await set_doc("course_purchases", pid, record)
        course["salesCount"] = course.get("salesCount", 0) + 1
        course["lastUpdatedAt"] = _now()
        await set_doc("courses", course_id, course)
        response = {
            "enrolled": True,
            "alreadyEnrolled": False,
            "courseId": course_id,
            "accessType": course_access.ACCESS_TYPE_FREE,
            "accessStatus": course_access.ACCESS_STATUS_GRANTED,
            "learningStatus": course_access.LEARNING_NOT_STARTED,
        }

    if idempotency_key:
        await idempotency.store(scope, idempotency_key, response)
    return response


# ---------------------------------------------------------------------------
# Paid-course contact requests ("Contact Instructor to Enroll")
# ---------------------------------------------------------------------------
def _contact_snapshot(user: dict) -> dict:
    return {
        "name": user.get("name") or "Instructor",
        "phone": user.get("phone") or "",
        "whatsapp": user.get("whatsapp") or user.get("whatsappNumber") or user.get("phone") or "",
    }


async def _active_contact_request(user_id: str, course_id: str) -> dict | None:
    req = await get_doc("course_contact_requests", _request_id(user_id, course_id))
    if req is not None and req.get("status") == course_access.REQUEST_STATUS_CONTACTED:
        return req
    return None


@router.post("/courses/{course_id}/contact-requests", status_code=201)
async def create_contact_request(
    course_id: str,
    body: CourseContactRequestIn,
    user: dict = Depends(_user),
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
):
    """Learner → instructor contact unlock for a PAID course.

    Gates, in order: authenticated learner → published paid course (not own) →
    verified learner KYC → verified instructor KYC → terms acceptance → MPIN.
    Creates (or returns) exactly one request per learner+course, snapshots the
    listed price/currency, unlocks both parties' contact details, opens the one
    chat room for the connection and notifies the instructor. Never creates a
    payment, order, invoice, escrow, subscription — or course access.
    """
    scope = f"courses.contact.{user['id']}.{course_id}"
    stored = await idempotency.replay(scope, idempotency_key)
    if stored is not None:
        return stored

    course = await _require_course(course_id)
    if course["status"] != "published":
        _error(404, "COURSE_NOT_FOUND", "course not found")
    if course["instructorId"] == user["id"]:
        _error(409, "OWN_COURSE", "instructors cannot contact themselves")
    if _course_is_free(course):
        _error(409, "FREE_COURSE_INSTANT_ENROL", "free courses enrol instantly — no contact request needed")

    from app.services.verification import is_identity_verified

    if not await is_identity_verified(user):
        _error(403, "KYC_REQUIRED", "complete identity KYC before contacting an instructor")
    instructor = await get_user(course["instructorId"]) or {}
    if not await is_identity_verified(instructor):
        _error(403, "INSTRUCTOR_KYC_REQUIRED", "the instructor has not completed identity KYC")

    if not body.termsAccepted:
        _error(422, "TERMS_NOT_ACCEPTED", "accept the direct-payment terms to continue", {"termsAccepted": "required"})
    if not user.get("mpinHash"):
        _error(409, "MPIN_NOT_SET", "set your MPIN before sharing contact details")
    if not verify_mpin(body.mpin, user["mpinHash"]):
        _error(401, "WRONG_MPIN", "incorrect MPIN")

    req_id = _request_id(user["id"], course_id)
    existing = await get_doc("course_contact_requests", req_id)
    now = _now()
    if existing is not None and existing.get("status") == course_access.REQUEST_STATUS_CONTACTED:
        response = {
            "request": existing,
            "alreadyExists": True,
            "instructorContact": _contact_snapshot(instructor),
            "chatRoomId": existing.get("chatRoomId"),
        }
        if idempotency_key:
            await idempotency.store(scope, idempotency_key, response)
        return response

    from app.services.chat import ensure_direct_room
    from app.services.notify import notify_user

    room = await ensure_direct_room(
        course["instructorId"],
        instructor.get("name", ""),
        user["id"],
        user.get("name", ""),
        crop=course.get("title", ""),
    )
    price = float(course.get("priceRupees") or 0)
    doc = {
        "id": req_id,
        "courseId": course_id,
        "courseTitle": course.get("title") or "",
        "instructorId": course["instructorId"],
        "learnerId": user["id"],
        "learnerName": user.get("name") or "Learner",
        "status": course_access.REQUEST_STATUS_CONTACTED,
        "priceRupees": price,
        "currency": course.get("currency") or "INR",
        "termsVersion": body.termsVersion or TERMS_VERSION,
        "termsAcceptedAt": now,
        "termsText": TERMS_TEXT,
        # MPIN metadata only — the MPIN itself is never logged or stored.
        "mpinVerified": True,
        "mpinVerifiedAt": now,
        "contactRevealedAt": now,
        "chatRoomId": room["id"],
        "createdAt": now,
        "updatedAt": now,
    }
    await set_doc("course_contact_requests", req_id, doc)

    # The learner's contact is shared with the instructor through this
    # notification payload context — the instructor sees it in the request row.
    await notify_user(
        course["instructorId"],
        type="course_contact_request",
        title="New paid-course contact request / नया संपर्क अनुरोध",
        body=f"{doc['learnerName']} wants to enrol in {doc['courseTitle']} "
        f"(listed ₹{price:g}). Contact details are now unlocked both ways.",
        deepLink="/instructor/enrollment-requests",
    )
    response = {
        "request": doc,
        "alreadyExists": False,
        "instructorContact": _contact_snapshot(instructor),
        "chatRoomId": room["id"],
    }
    if idempotency_key:
        await idempotency.store(scope, idempotency_key, response)
    return response


@router.get("/courses/{course_id}/contact-requests/mine")
async def my_contact_request(course_id: str, user: dict = Depends(_user)):
    """The learner's own request state for a course, plus the unlocked
    instructor contact when the connection is active. Private contact details
    are never part of public course payloads — only this participant-only
    endpoint returns them."""
    course = await _require_course(course_id)
    req = await get_doc("course_contact_requests", _request_id(user["id"], course_id))
    if req is None:
        return {"request": None, "status": "notRequested"}
    out = {"request": req, "status": req.get("status")}
    if req.get("status") == course_access.REQUEST_STATUS_CONTACTED:
        instructor = await get_user(course["instructorId"]) or {}
        out["instructorContact"] = _contact_snapshot(instructor)
        out["chatRoomId"] = req.get("chatRoomId")
    return out


# ---------------------------------------------------------------------------
# Student Classroom & Learning Portal
# ---------------------------------------------------------------------------
@router.get("/courses/{course_id}/learn")
async def get_course_learning(course_id: str, user: dict = Depends(_user)):
    course = await _require_course(course_id)
    record = await _require_access(course, user)

    # All mediaUrls are unlocked in learn mode — _require_access guarantees the
    # learner holds granted (non-revoked) access, so protected media can never
    # be fetched before grant or after revocation.
    doc = dict(course)
    doc["access"] = {
        **course_access.access_summary(record),
        "isRevoked": course_access.is_revoked(record),
    }
    doc["userProgress"] = {
        "completedLessonIds": record.get("completedLessonIds", []),
        "progressPercent": record.get("progressPercent", 0),
        "isCompleted": record.get("isCompleted", False),
        "learningStatus": course_access.learning_status(record),
        "certificateId": record.get("certificateId"),
        "lastAccessedAt": _now(),
    }
    return doc


@router.post("/courses/{course_id}/lessons/{lesson_id}/progress")
async def update_lesson_progress(
    course_id: str,
    lesson_id: str,
    body: LessonProgressIn,
    user: dict = Depends(_user),
):
    course = await _require_course(course_id)
    is_owner = course["instructorId"] == user["id"]
    pid = _purchase_id(user["id"], course_id)
    purchase = await get_doc("course_purchases", pid)

    if not is_owner:
        if purchase is None or not course_access.is_granted(purchase):
            _error(403, "NOT_ENROLLED", "not enrolled in this course")
        if course_access.is_revoked(purchase):
            _error(403, "ACCESS_REVOKED", "your access to this course was revoked by the instructor")

    if purchase is None and is_owner:
        # Create virtual enrollment record for instructor preview
        purchase = {
            "id": pid,
            "userId": user["id"],
            "studentName": user.get("name") or "Instructor Preview",
            "courseId": course_id,
            "instructorId": course["instructorId"],
            "status": "paid",
            "completedLessonIds": [],
            "progressPercent": 0,
            "isCompleted": False,
        }

    completed_ids = set(purchase.get("completedLessonIds", []))
    if body.completed:
        completed_ids.add(lesson_id)
    else:
        completed_ids.discard(lesson_id)

    # Count total lessons across all modules
    total_lessons = 0
    for mod in course.get("modules", []):
        total_lessons += len(mod.get("lessons", []))

    if total_lessons == 0:
        total_lessons = 1

    pct = min(100.0, round((len(completed_ids) / total_lessons) * 100, 1))
    is_completed = pct >= 100.0

    certificate_id = purchase.get("certificateId")
    if is_completed and not certificate_id:
        certificate_id = f"CERT-GS-{course_id[:4].upper()}-{uuid.uuid4().hex[:6].upper()}"
        purchase["certificateIssuedAt"] = _now()

    # WS-06 task 6.10 — learning-path suggestion the moment a learner certificate
    # is issued (C20). Stored on the purchase doc; prefill/annotate only.
    if is_completed and certificate_id and not is_owner and not purchase.get("learningPath"):
        from app.services import academy_ai

        await academy_ai.apply_learning_path(purchase)

    purchase["completedLessonIds"] = list(completed_ids)
    purchase["progressPercent"] = pct
    purchase["isCompleted"] = is_completed
    purchase["certificateId"] = certificate_id
    purchase["learningStatus"] = course_access.LEARNING_COMPLETED if is_completed else (
        course_access.LEARNING_IN_PROGRESS if pct > 0 else course_access.LEARNING_NOT_STARTED
    )
    purchase["lastAccessedAt"] = _now()
    if is_completed and not purchase.get("completedAt"):
        purchase["completedAt"] = _now()
        # WS-03: learner rates the instructor on course completion.
        course_doc = await get_doc("courses", course_id) or {}
        await open_rating_prompt(
            user["id"],
            course_doc.get("instructorId") or purchase.get("instructorId"),
            course_id,
            "course_enrollment",
        )

    await set_doc("course_purchases", pid, purchase)
    persona = user.get("activeProfile") or "farmer"
    # WS-01 task engine: a progress nudge while the course is unfinished…
    if pct < 100.0:
        await emit_task(
            user["id"],
            persona=persona,
            module="courses",
            kind="course_progress",
            title_en="Continue your course",
            title_hi="अपना पाठ्यक्रम जारी रखें",
            subtitle=course.get("title", ""),
            priority="upcoming",
            deep_link=f"/dashboard/p/courses/{course_id}/learn",
            source_id=pid,
        )
    # …and a certificate task the moment the course is completed. Dedupe-safe
    # on sourceId so re-completing the last lesson never doubles the task.
    if is_completed and certificate_id and not is_owner:
        await emit_task(
            user["id"],
            persona=persona,
            module="courses",
            kind="certificate_earned",
            title_en="Certificate earned",
            title_hi="प्रमाणपत्र प्राप्त हुआ",
            subtitle=course.get("title", ""),
            priority="today",
            deep_link=f"/dashboard/p/courses/{course_id}/certificate",
            source_id=pid,
        )

    return {
        "success": True,
        "completedLessonIds": list(completed_ids),
        "progressPercent": pct,
        "isCompleted": is_completed,
        "certificateId": certificate_id,
    }


@router.get("/courses/{course_id}/certificate")
async def get_course_certificate(course_id: str, user: dict = Depends(_user)):
    course = await _require_course(course_id)
    pid = _purchase_id(user["id"], course_id)
    purchase = await get_doc("course_purchases", pid)
    is_owner = course["instructorId"] == user["id"]

    if not is_owner and (purchase is None or not purchase.get("isCompleted")):
        _error(400, "CERTIFICATE_NOT_AVAILABLE", "complete all lessons to unlock certificate")

    cert_id = purchase.get("certificateId") if purchase else f"CERT-GS-{course_id[:4].upper()}-DEMO"
    issued_at = (purchase.get("certificateIssuedAt") or _now()) if purchase else _now()

    return {
        "certificateId": cert_id,
        "courseId": course["id"],
        "courseTitle": course.get("title"),
        "certificateTitle": course.get("certificateTitle") or f"Certificate of Completion in {course.get('title')}",
        "studentId": user["id"],
        "studentName": user.get("name") or "Certified Agronomist",
        "instructorName": course.get("instructorName") or "GyanSetu Certified Faculty",
        "instructorHeadline": course.get("instructorHeadline") or "ICAR Certified Agronomist",
        "issuedAt": issued_at,
        "institution": "GyanSetu Digital Krishi Gurukul",
        "verificationUrl": f"https://agrovercity.com/verify/cert/{cert_id}",
        # WS-06 task 6.10/6.12 — the next-course suggestion attached at issue.
        "learningPath": purchase.get("learningPath") if purchase else None,
    }


# ---------------------------------------------------------------------------
# Reviews & Ratings
# ---------------------------------------------------------------------------
@router.post("/courses/{course_id}/reviews", status_code=201)
async def submit_review(course_id: str, body: CourseReviewIn, user: dict = Depends(_user)):
    course = await _require_course(course_id)
    review_id = f"{user['id']}_{course_id}"
    now = _now()

    review_doc = {
        "id": review_id,
        "courseId": course_id,
        "userId": user["id"],
        "userName": user.get("name") or "Farmer Student",
        "rating": body.rating,
        "reviewText": body.reviewText,
        "createdAt": now,
    }
    await set_doc(f"courses/{course_id}/reviews", review_id, review_doc)

    # Recalculate average rating
    all_reviews = await query(f"courses/{course_id}/reviews", [], limit=500)
    course["ratingCount"] = len(all_reviews)
    course["ratingSum"] = sum(r.get("rating", 5) for r in all_reviews)
    course["ratingAverage"] = round(course["ratingSum"] / max(1, course["ratingCount"]), 1)
    await set_doc("courses", course_id, course)

    return review_doc


@router.get("/courses/{course_id}/reviews")
async def list_course_reviews(course_id: str, user: dict = Depends(_user)):
    reviews = await query(f"courses/{course_id}/reviews", [], limit=100)
    reviews.sort(key=lambda r: r.get("createdAt", ""), reverse=True)
    return {"data": reviews, "total": len(reviews)}


# ---------------------------------------------------------------------------
# Course Discussion & Q&A
# ---------------------------------------------------------------------------
@router.post("/courses/{course_id}/questions", status_code=201)
async def ask_course_question(course_id: str, body: CourseQuestionIn, user: dict = Depends(_user)):
    course = await _require_course(course_id)
    # Only authorized learners ask course questions: the instructor, learners
    # with granted access, or a learner with an active paid-course contact.
    is_owner = course["instructorId"] == user["id"]
    if not is_owner:
        record = await _access_record(user["id"], course_id)
        request = await get_doc("course_contact_requests", _request_id(user["id"], course_id))
        authorized = (record is not None and course_access.is_granted(record)) or (
            request is not None and request.get("status") == course_access.REQUEST_STATUS_CONTACTED
        )
        if not authorized:
            _error(403, "NOT_AUTHORIZED", "enrol in the course or contact the instructor to ask questions")
    q_id = uuid.uuid4().hex[:12]
    now = _now()
    doc = {
        "id": q_id,
        "courseId": course_id,
        "userId": user["id"],
        "userName": user.get("name") or "Student",
        "question": body.question,
        "lessonId": body.lessonId,
        "answers": [],
        "createdAt": now,
    }
    await set_doc(f"courses/{course_id}/questions", q_id, doc)

    from app.services.notify import notify_user

    await notify_user(
        course["instructorId"],
        type="course_question",
        title="New course question / नया प्रश्न",
        body=f"{doc['userName']} asked in {course.get('title') or 'your course'}",
        deepLink=f"/instructor/courses/{course_id}/edit",
    )
    return doc


@router.get("/courses/{course_id}/questions")
async def list_course_questions(course_id: str, user: dict = Depends(_user)):
    questions = await query(f"courses/{course_id}/questions", [], limit=100)
    questions.sort(key=lambda q: q.get("createdAt", ""), reverse=True)
    return {"data": questions, "total": len(questions)}


@router.post("/courses/{course_id}/questions/{question_id}/answers", status_code=201)
async def answer_course_question(
    course_id: str,
    question_id: str,
    body: CourseAnswerIn,
    user: dict = Depends(_user),
):
    course = await _require_course(course_id)
    question = await get_doc(f"courses/{course_id}/questions", question_id)
    if question is None:
        _error(404, "QUESTION_NOT_FOUND", "question thread not found")

    is_instructor = course["instructorId"] == user["id"]
    ans_id = uuid.uuid4().hex[:12]
    ans_doc = {
        "id": ans_id,
        "userId": user["id"],
        "userName": user.get("name") or ("Instructor" if is_instructor else "Student"),
        "isInstructor": is_instructor,
        "answer": body.answer,
        "createdAt": _now(),
    }
    question.setdefault("answers", []).append(ans_doc)
    await set_doc(f"courses/{course_id}/questions", question_id, question)

    if is_instructor:
        from app.services.notify import notify_user

        await notify_user(
            question.get("userId"),
            type="course_question_answered",
            title="Your question was answered / प्रश्न का उत्तर",
            body=f"The instructor answered your question in {course.get('title') or 'the course'}.",
            deepLink=f"/dashboard/p/courses/{course_id}/learn",
        )
    return ans_doc


# ---------------------------------------------------------------------------
# Curriculum Builder: Modules & Lessons
# ---------------------------------------------------------------------------
@router.post("/courses/{course_id}/modules", status_code=201)
async def add_module(course_id: str, module: CourseModule, user: dict = Depends(_user)):
    course = await _require_course(course_id)
    if course["instructorId"] != user["id"]:
        _error(403, "FORBIDDEN", "not your course")

    modules = course.get("modules", [])
    modules.append(module.model_dump())
    course["modules"] = modules
    course["updatedAt"] = _now()
    await set_doc("courses", course_id, course)
    return module


@router.put("/courses/{course_id}/modules/{module_id}")
async def update_module(
    course_id: str,
    module_id: str,
    body: CourseModule,
    user: dict = Depends(_user),
):
    course = await _require_course(course_id)
    if course["instructorId"] != user["id"]:
        _error(403, "FORBIDDEN", "not your course")

    modules = course.get("modules", [])
    idx = next((i for i, m in enumerate(modules) if m["id"] == module_id), None)
    if idx is None:
        _error(404, "MODULE_NOT_FOUND", "module not found")

    modules[idx] = body.model_dump()
    course["modules"] = modules
    course["updatedAt"] = _now()
    await set_doc("courses", course_id, course)
    return modules[idx]


@router.delete("/courses/{course_id}/modules/{module_id}", status_code=204)
async def delete_module(course_id: str, module_id: str, user: dict = Depends(_user)):
    course = await _require_course(course_id)
    if course["instructorId"] != user["id"]:
        _error(403, "FORBIDDEN", "not your course")

    modules = [m for m in course.get("modules", []) if m["id"] != module_id]
    course["modules"] = modules
    course["updatedAt"] = _now()
    await set_doc("courses", course_id, course)


# ---------------------------------------------------------------------------
# Curriculum, learner progress, instructor chat & e-contracts
# (extension-2026-10-12 — instructor persona gap closure)
# ---------------------------------------------------------------------------


def _lesson_count(modules: list[dict]) -> int:
    return sum(len(m.get("lessons") or []) for m in modules or [])


def _duration_minutes(modules: list[dict]) -> int:
    return sum(
        int(l.get("durationMinutes") or 0)
        for m in modules or []
        for l in (m.get("lessons") or [])
    )


def _materials_from_course(course: dict) -> list[str]:
    materials = list(course.get("materialsList") or [])
    for m in course.get("modules") or []:
        for lesson in m.get("lessons") or []:
            for res in lesson.get("resources") or []:
                title = res.get("title")
                if title and title not in materials:
                    materials.append(title)
    return materials


@router.get("/courses/{course_id}/curriculum")
async def course_curriculum(course_id: str, user: dict = Depends(_user)):
    """Full public curriculum: language, session plan (modules + lessons),
    duration, session count, mode, prerequisites, required materials, fee and
    verified instructor credentials — all from the real course + KYC docs."""
    course = await _require_course(course_id)
    is_owner = course["instructorId"] == user["id"]
    if course["status"] != "published" and not is_owner:
        _error(404, "COURSE_NOT_FOUND", "course not found")
    modules = course.get("modules") or []
    from app.services.kyc import latest_instructor_case, verified_credential_types

    case = await latest_instructor_case(course["instructorId"])
    return {
        "courseId": course_id,
        "title": course.get("title", ""),
        "language": course.get("language", ""),
        "level": course.get("level", ""),
        "mode": course.get("mode") or "hybrid",
        "category": course.get("category", ""),
        "feeRupees": course.get("priceRupees", 0),
        "currency": "INR",
        "durationMinutes": _duration_minutes(modules),
        "sessionCount": _lesson_count(modules),
        "syllabus": [m.get("title", "") for m in modules],
        "sessionPlan": [
            {
                "moduleId": m.get("id"),
                "title": m.get("title", ""),
                "order": m.get("order", 1),
                "lessons": [
                    {
                        "lessonId": l.get("id"),
                        "title": l.get("title", ""),
                        "kind": l.get("kind", ""),
                        "durationMinutes": l.get("durationMinutes", 0),
                        "order": l.get("order", 1),
                        "isPreviewFree": l.get("isPreviewFree", False),
                    }
                    for l in (m.get("lessons") or [])
                ],
            }
            for m in modules
        ],
        "prerequisites": course.get("requirements") or [],
        "materialsList": _materials_from_course(course),
        "whatYouWillLearn": course.get("whatYouWillLearn") or [],
        "instructor": {
            "instructorId": course["instructorId"],
            "name": course.get("instructorName", ""),
            "headline": course.get("instructorHeadline", ""),
            "credentials": verified_credential_types(case),
        },
        "reviews": {
            "count": course.get("ratingCount", 0),
            "average": course.get("ratingAverage") if course.get("ratingCount", 0) > 0 else None,
        },
    }


@router.get("/courses/{course_id}/progress")
async def course_progress(course_id: str, user: dict = Depends(_user)):
    """The enrolled farmer's per-course status: completed vs total lessons,
    modules done/remaining (e.g. \"2 modules remaining\"), percent and the
    certificate id once issued."""
    course = await _require_course(course_id)
    purchase = await _paid_purchase(user["id"], course_id)
    if course["instructorId"] != user["id"] and purchase is None:
        _error(403, "NOT_ENROLLED", "enroll in the course to view progress")
    modules = course.get("modules") or []
    total_lessons = _lesson_count(modules)
    completed = list((purchase or {}).get("completedLessonIds") or [])
    modules_done = 0
    for m in modules:
        lesson_ids = {l.get("id") for l in (m.get("lessons") or [])}
        if lesson_ids and lesson_ids.issubset(set(completed)):
            modules_done += 1
    total_modules = len(modules)
    return {
        "courseId": course_id,
        "completedLessons": len(completed),
        "totalLessons": total_lessons,
        "modulesDone": modules_done,
        "modulesRemaining": max(0, total_modules - modules_done),
        "progressPercent": (purchase or {}).get("progressPercent", 0),
        "isCompleted": (purchase or {}).get("isCompleted", False),
        "certificateId": (purchase or {}).get("certificateId"),
        "lastAccessedAt": _now(),
    }


@router.post("/courses/{course_id}/chat")
async def open_course_instructor_chat(course_id: str, user: dict = Depends(_user)):
    """1:1 doubt-solving chat with the course instructor. Unlocks for learners
    with granted course access (free or instructor-granted) and for paid-course
    learners with an active contact connection — including after a revocation,
    since contact history and chats are never deleted."""
    course = await _require_course(course_id)
    if course["instructorId"] == user["id"]:
        _error(400, "OWN_COURSE", "this is your own course")
    record = await _access_record(user["id"], course_id)
    has_connection = record is not None and course_access.is_granted(record)
    request = await get_doc("course_contact_requests", _request_id(user["id"], course_id))
    if request is not None and request.get("status") == course_access.REQUEST_STATUS_CONTACTED:
        has_connection = True
    if not has_connection:
        _error(403, "NOT_ENROLLED", "chat with the instructor unlocks after you enrol or contact them")
    from app.services.chat import ensure_direct_room

    instructor = await get_user(course["instructorId"]) or {}
    room = await ensure_direct_room(
        course["instructorId"],
        instructor.get("name", ""),
        user["id"],
        user.get("name", ""),
        crop=course.get("title", ""),
    )
    return {
        "roomId": room["id"],
        "courseId": course_id,
        "instructorId": course["instructorId"],
        "unlockedByPurchaseId": record["id"] if record is not None else None,
        "unlockedByRequestId": (request or {}).get("id"),
    }


async def _contract_for_purchase(purchase: dict) -> dict:
    """Lazy e-contract generation (idempotent): the booking confirmation
    contract carrying fee, curriculum scope and the refund policy."""
    existing = await get_doc("course_contracts", purchase["id"])
    if existing is not None:
        return existing
    course = await get_doc("courses", purchase.get("courseId") or "") or {}
    modules = course.get("modules") or []
    refund_cfg = await get_doc("platform_config", "course_refund") or {}
    instructor = await get_user(purchase.get("instructorId") or "") or {}
    student = await get_user(purchase.get("userId") or "") or {}
    now = _now()
    doc = {
        "contractNo": f"CTC-{purchase['id'][-12:].upper()}",
        "purchaseId": purchase["id"],
        "status": "active",
        "course": {
            "courseId": purchase.get("courseId"),
            "title": purchase.get("courseTitle") or course.get("title", ""),
        },
        "student": {
            "userId": purchase.get("userId"),
            "name": purchase.get("studentName") or student.get("name", ""),
            "phone": purchase.get("studentPhone") or student.get("phone", ""),
        },
        "instructor": {
            "instructorId": purchase.get("instructorId"),
            "name": instructor.get("name", ""),
        },
        "feeRupees": purchase.get("amountRupees", 0),
        "currency": "INR",
        "commissionPercent": purchase.get("commissionPercent", 0),
        "curriculumScope": {
            "modules": [m.get("title", "") for m in modules],
            "moduleCount": len(modules),
            "sessionCount": _lesson_count(modules),
            "durationMinutes": _duration_minutes(modules),
            "mode": course.get("mode") or "hybrid",
        },
        "refundPolicy": refund_cfg.get("policy") or None,
        "signedAt": purchase.get("paidAt") or now,
        "generatedAt": now,
    }
    await set_doc("course_contracts", purchase["id"], doc)
    return doc


@router.get("/courses/purchases/{purchase_id}/contract")
async def get_purchase_contract(purchase_id: str, user: dict = Depends(_user)):
    """The e-contract for a confirmed course booking (fee, curriculum scope,
    refund policy). Student or the course instructor only."""
    purchase = await get_doc("course_purchases", purchase_id)
    if purchase is None:
        _error(404, "PURCHASE_NOT_FOUND", "purchase not found")
    if user["id"] not in (purchase.get("userId"), purchase.get("instructorId")) and not user.get("isAdmin"):
        _error(403, "FORBIDDEN", "not your booking")
    if purchase.get("status") != "paid":
        _error(409, "BOOKING_NOT_CONFIRMED", "e-contract is issued on booking confirmation")
    return await _contract_for_purchase(purchase)


# ---------------------------------------------------------------------------
# Booking cancellation with tiered refunds (spec E1/E2)
# ---------------------------------------------------------------------------
def _parse_dt(value) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


async def _booking_start(purchase: dict) -> datetime | None:
    """When the first live session starts: explicit purchase fields first,
    else the earliest scheduled session for the booked course."""
    for key in ("firstSessionAt", "sessionStartAt", "scheduledStartAt", "startsAt"):
        parsed = _parse_dt(purchase.get(key))
        if parsed is not None:
            return parsed
    sessions = await query(
        "batch_sessions", [("courseId", "==", purchase.get("courseId"))], limit=200
    )
    starts = [parsed for s in sessions if (parsed := _parse_dt(s.get("startsAt"))) is not None]
    return min(starts) if starts else None


def _refund_percent(delta_hours: float | None) -> int:
    """Published policy: free ≥48h before the first session, 50% at 24–48h,
    0% inside 24h. With no session on record the conservative default is the
    full-refund bucket."""
    if delta_hours is None or delta_hours >= 48:
        return 100
    if delta_hours >= 24:
        return 50
    return 0


@router.post("/courses/purchases/{purchase_id}/cancel")
async def cancel_purchase(purchase_id: str, body: PurchaseCancelIn, user: dict = Depends(_user)):
    purchase = await get_doc("course_purchases", purchase_id)
    if purchase is None:
        _error(404, "PURCHASE_NOT_FOUND", "purchase not found")
    is_student = purchase.get("userId") == user["id"]
    is_instructor = purchase.get("instructorId") == user["id"]
    if not is_student and not is_instructor:
        _error(403, "FORBIDDEN", "not your booking")
    if purchase.get("status") == "cancelled":
        _error(409, "BOOKING_ALREADY_CANCELLED", "this booking is already cancelled")
    if purchase.get("status") != "paid":
        _error(409, "BOOKING_NOT_CONFIRMED", "only confirmed bookings can be cancelled")
    if purchase.get("disputeId"):
        _error(409, "DISPUTE_OPEN", "this booking has an open dispute")

    if is_instructor:
        # E2: instructor cancellation is always a full refund + a strike.
        percent = 100
    else:
        start = await _booking_start(purchase)
        delta = (start - datetime.now(timezone.utc)).total_seconds() / 3600 if start else None
        percent = _refund_percent(delta)

    amount_paisa = int(round(float(purchase.get("amountRupees") or 0) * 100))
    refund_paisa = amount_paisa * percent // 100
    refund_result = None
    if refund_paisa > 0 and purchase.get("razorpayPaymentId"):
        refund_result = await refund_razorpay_payment(purchase["razorpayPaymentId"], refund_paisa)

    now = _now()
    purchase["status"] = "cancelled"
    purchase["cancelledBy"] = user["id"]
    purchase["cancelledAt"] = now
    purchase["cancelReason"] = body.reason or None
    purchase["refund"] = {
        "amountPaisa": refund_paisa,
        "percent": percent,
        "at": now,
        "gatewayRefundId": (refund_result or {}).get("id"),
    }
    await set_doc("course_purchases", purchase_id, purchase)

    if is_instructor:
        from app.services.chat import record_strike

        await record_strike(
            purchase["instructorId"], "course_cancellation", body.reason or "instructor_cancel"
        )

    from app.services.notify import notify_user

    counterparty = purchase.get("instructorId") if is_student else purchase.get("userId")
    await notify_user(
        counterparty,
        type="booking_cancelled",
        title="Course booking cancelled / बुकिंग रद्द",
        body=f"Booking for {purchase.get('courseTitle') or 'course'} was cancelled"
        + (f" by the instructor (₹{refund_paisa / 100:.0f} refunded)" if is_instructor else ""),
        deepLink="/dashboard/p/courses",
    )
    return purchase


# ---------------------------------------------------------------------------
# Disputes on a course booking (spec C9/C3)
# ---------------------------------------------------------------------------
@router.post("/courses/purchases/{purchase_id}/disputes", status_code=201)
async def dispute_purchase(purchase_id: str, body: PurchaseDisputeIn, user: dict = Depends(_user)):
    purchase = await get_doc("course_purchases", purchase_id)
    if purchase is None:
        _error(404, "PURCHASE_NOT_FOUND", "purchase not found")
    is_student = purchase.get("userId") == user["id"]
    is_instructor = purchase.get("instructorId") == user["id"]
    if not is_student and not is_instructor:
        _error(403, "FORBIDDEN", "only the student or instructor of this booking can dispute it")
    if purchase.get("disputeId"):
        _error(409, "DISPUTE_ALREADY_OPEN", "this booking already has an open dispute")

    from app.services.disputes import ingest_dispute

    summary = f"[{body.category}] {body.reason}"
    dispute = await ingest_dispute(
        "course",
        purchase_id,
        {
            "summary": summary,
            "evidence": {"openedBy": user["id"], "category": body.category, **(body.evidence or {})},
        },
    )

    purchase["disputeId"] = dispute["id"]
    purchase["payoutFrozen"] = True
    await set_doc("course_purchases", purchase_id, purchase)

    from app.services.notify import notify_user

    counterparty = purchase.get("instructorId") if is_student else purchase.get("userId")
    await notify_user(
        counterparty,
        type="dispute_opened",
        title="Dispute opened on a booking / विवाद खोला गया",
        body=f"A dispute was opened on {purchase.get('courseTitle') or 'a course booking'} ({body.category}). Payout is frozen pending review.",
        deepLink="/dashboard/p/disputes",
    )
    return {
        "disputeId": dispute["id"],
        "purchaseId": purchase_id,
        "status": dispute.get("status"),
        "category": dispute.get("category"),
        "payoutFrozen": True,
    }


# ---------------------------------------------------------------------------
# Structured pre-booking enquiries (spec F4/T5)
# ---------------------------------------------------------------------------
@router.post("/courses/{course_id}/enquiries", status_code=201)
async def create_course_enquiry(course_id: str, body: CourseEnquiryCreateIn, user: dict = Depends(_user)):
    course = await _require_course(course_id)
    if course["instructorId"] == user["id"]:
        _error(400, "OWN_COURSE", "instructors cannot enquire on their own course")
    enquiry_id = f"enq_{uuid.uuid4().hex[:12]}"
    doc = {
        "id": enquiry_id,
        "courseId": course_id,
        "courseTitle": course.get("title") or "",
        "instructorId": course["instructorId"],
        "farmerId": user["id"],
        "farmerName": user.get("name") or "Farmer",
        "questionTemplate": body.questionTemplate,
        "details": body.details,
        "status": "open",
        "createdAt": _now(),
    }
    await set_doc("course_enquiries", enquiry_id, doc)

    from app.services.notify import notify_user

    await notify_user(
        course["instructorId"],
        type="course_enquiry",
        title="New course enquiry / नया पूछताछ",
        body=f"{doc['farmerName']}: {body.questionTemplate}",
        deepLink=f"/dashboard/p/instructor/enquiries",
    )
    return doc


# ---------------------------------------------------------------------------
# Practical assignments & photo submissions (spec F9/T11)
# ---------------------------------------------------------------------------
@router.post("/courses/{course_id}/assignments", status_code=201)
async def create_assignment(course_id: str, body: AssignmentCreateIn, user: dict = Depends(_user)):
    course = await _require_course(course_id)
    if course["instructorId"] != user["id"]:
        _error(403, "FORBIDDEN", "only the course instructor can create assignments")
    due_at = None
    if body.dueAt:
        if _parse_dt(body.dueAt) is None:
            _error(422, "VALIDATION_ERROR", "dueAt must be an ISO-8601 timestamp", {"dueAt": "invalid"})
        due_at = body.dueAt
    assignment_id = f"asg_{uuid.uuid4().hex[:12]}"
    doc = {
        "id": assignment_id,
        "courseId": course_id,
        "courseTitle": course.get("title") or "",
        "instructorId": user["id"],
        "title": body.title,
        "instructions": body.instructions,
        "dueAt": due_at,
        "maxPhotos": body.maxPhotos,
        "status": "open",
        "createdAt": _now(),
    }
    await set_doc("course_assignments", assignment_id, doc)
    return doc


@router.post("/assignments/{assignment_id}/submissions", status_code=201)
async def submit_assignment(assignment_id: str, body: AssignmentSubmissionIn, user: dict = Depends(_user)):
    assignment = await get_doc("course_assignments", assignment_id)
    if assignment is None:
        _error(404, "ASSIGNMENT_NOT_FOUND", "assignment not found")
    purchase = await get_doc("course_purchases", _purchase_id(user["id"], assignment["courseId"]))
    if purchase is None or not course_access.is_granted(purchase):
        _error(403, "NOT_ENROLLED", "only enrolled students can submit assignments")

    max_photos = int(assignment.get("maxPhotos") or 3)
    if len(body.photoUrls) > max_photos:
        _error(
            422,
            "TOO_MANY_PHOTOS",
            f"this assignment accepts at most {max_photos} photos",
            {"photoUrls": f"at most {max_photos}"},
        )

    due_at = _parse_dt(assignment.get("dueAt"))
    existing = await get_doc("assignment_submissions", f"{assignment_id}_{user['id']}")
    now = _now()
    if existing is None and due_at is not None and datetime.now(timezone.utc) > due_at:
        _error(409, "ASSIGNMENT_DUE_PASSED", "the submission deadline has passed")

    doc = {
        "id": f"{assignment_id}_{user['id']}",
        "assignmentId": assignment_id,
        "courseId": assignment["courseId"],
        "studentId": user["id"],
        "studentName": user.get("name") or "Student",
        "photoUrls": body.photoUrls,
        "status": "submitted",
        "submittedAt": now,
    }
    if existing is not None:
        # Resubmit is allowed until the deadline.
        if due_at is not None and datetime.now(timezone.utc) > due_at:
            _error(409, "ASSIGNMENT_DUE_PASSED", "the submission deadline has passed")
        doc["submittedAt"] = existing.get("submittedAt") or now
        doc["resubmittedAt"] = now
    await set_doc("assignment_submissions", doc["id"], doc)
    return doc


# ---------------------------------------------------------------------------
# Batch sessions & QR check-in (spec F8/T10)
# ---------------------------------------------------------------------------
@router.post("/sessions/{session_id}/check-in")
async def check_in_session(session_id: str, body: SessionCheckInIn, user: dict = Depends(_user)):
    session = await get_doc("batch_sessions", session_id)
    if session is None:
        _error(404, "SESSION_NOT_FOUND", "session not found")
    if body.qrToken != session.get("qrToken"):
        _error(403, "INVALID_QR_TOKEN", "QR token does not match this session")

    batch = await get_doc("course_batches", session.get("batchId") or "")
    member_ids = (batch or {}).get("memberIds") or []
    purchase = await get_doc("course_purchases", _purchase_id(user["id"], session["courseId"]))
    enrolled = purchase is not None and course_access.is_granted(purchase)
    if user["id"] not in member_ids and not enrolled:
        _error(403, "NOT_BATCH_MEMBER", "you are not enrolled in this batch")

    attendance = await get_doc("session_attendance", session_id) or {
        "sessionId": session_id,
        "sessionDate": (session.get("startsAt") or _now())[:10],
        "records": [],
    }
    records = attendance.get("records", [])
    if any(r.get("studentId") == user["id"] for r in records):
        _error(409, "ALREADY_CHECKED_IN", "check-in already recorded for this session")
    records.append(
        {
            "studentId": user["id"],
            "studentName": user.get("name") or "Student",
            "status": "present",
            "verifiedAt": _now(),
            "method": "qr_scan",
        }
    )
    attendance["records"] = records
    attendance["totalPresent"] = sum(1 for r in records if r.get("status") == "present")
    await set_doc("session_attendance", session_id, attendance)

    session["checkedInIds"] = [r["studentId"] for r in records]
    await set_doc("batch_sessions", session_id, session)
    return {"sessionId": session_id, "checkedIn": True, "checkedInCount": len(records)}


# ---------------------------------------------------------------------------
# Instructor settlement view (spec T14) — reads the weekly payout cron output.
# LEGACY: only old checkout purchases feed settlements. Off-platform paid
# courses settle directly between learner and instructor; this view is kept
# solely for compatibility with those legacy records.
# ---------------------------------------------------------------------------
@router.get("/instructor/settlements")
async def instructor_settlements(user: dict = Depends(_user)):
    if not _is_instructor(user):
        _error(403, "NOT_INSTRUCTOR", "only instructors can view settlements")
    settlements = await query("settlements", [("entityId", "==", user["id"])], limit=500)
    rows = []
    for s in settlements:
        if s.get("role") != "instructor":
            continue
        rows.append(
            {
                "settlementId": s.get("id"),
                "periodStart": s.get("periodStart"),
                "periodEnd": s.get("periodEnd"),
                "grossRupees": s.get("grossRupees", 0),
                "commissionRupees": s.get("commissionRupees", 0),
                "netRupees": s.get("netRupees", 0),
                "status": s.get("status"),
                "payoutStatus": s.get("payoutStatus"),
                "payoutRef": s.get("payoutRef"),
                "utr": s.get("payoutRef"),
                "paidAt": s.get("paidAt"),
                "onHold": bool(s.get("onHold")),
                "held": bool(s.get("held")),
                "holdReason": s.get("holdReason"),
                "sourceCount": len(s.get("sourceIds") or []),
            }
        )
    rows.sort(key=lambda r: (r.get("periodStart") or "", r.get("settlementId") or ""), reverse=True)
    return {
        "data": rows,
        "total": len(rows),
        "currency": "INR",
        "totals": {
            "grossRupees": sum(r["grossRupees"] for r in rows),
            "commissionRupees": sum(r["commissionRupees"] for r in rows),
            "netRupees": sum(r["netRupees"] for r in rows),
        },
    }


# ---------------------------------------------------------------------------
# Instructor Enrollment Requests & manual course access
# (paid courses settle off-platform; the instructor grants access by hand)
# ---------------------------------------------------------------------------
def _require_instructor(user: dict) -> None:
    if not _is_instructor(user):
        _error(403, "NOT_INSTRUCTOR", "only instructors can manage course access")


@router.get("/instructor/enrollment-requests")
async def instructor_enrollment_requests(
    status: str | None = Query(default=None),
    user: dict = Depends(_user),
):
    """Paid-course contact requests across all of the instructor's courses:
    learner + identity badge, course, price/currency at contact time, request
    date, unlocked learner contact (Call/WhatsApp/Chat), current access status.
    Instructor-only — private contact details never appear elsewhere."""
    _require_instructor(user)
    requests = await query("course_contact_requests", [("instructorId", "==", user["id"])], limit=500)
    requests.sort(key=lambda r: r.get("createdAt", ""), reverse=True)
    badges = await course_access.badge_map([r["learnerId"] for r in requests])
    rows = []
    for req in requests:
        if status and req.get("status") != status:
            continue
        course = await get_doc("courses", req["courseId"]) or {}
        record = await _access_record(req["learnerId"], req["courseId"])
        learner = await get_user(req["learnerId"]) or {}
        access_status = "none"
        if record is not None:
            if course_access.is_revoked(record):
                access_status = "accessRevoked"
            elif course_access.is_granted(record):
                access_status = "accessGranted"
        rows.append(
            {
                "requestId": req["id"],
                "courseId": req["courseId"],
                "courseTitle": req.get("courseTitle") or course.get("title") or "",
                "courseStatus": course.get("status"),
                "learnerId": req["learnerId"],
                "learnerName": req.get("learnerName") or learner.get("name") or "Learner",
                "learnerIdentityVerified": bool((badges.get(req["learnerId"]) or {}).get("identity")),
                "learnerContact": _contact_snapshot(learner),
                "priceRupees": req.get("priceRupees"),
                "currency": req.get("currency") or "INR",
                "requestStatus": req.get("status"),
                "accessStatus": access_status,
                "accessType": (record or {}).get("accessType"),
                "requestedAt": req.get("createdAt"),
                "contactRevealedAt": req.get("contactRevealedAt"),
                "chatRoomId": req.get("chatRoomId"),
            }
        )
    pending = sum(1 for r in rows if r["requestStatus"] == "contacted" and r["accessStatus"] == "none")
    return {"data": rows, "total": len(rows), "pendingCount": pending}


@router.post("/instructor/enrollment-requests/{request_id}/grant")
async def grant_course_access(
    request_id: str,
    body: GrantCourseAccessIn,
    user: dict = Depends(_user),
):
    """Manual, off-platform access grant from an existing learner request.

    Idempotent: re-granting an already-granted learner returns the same record;
    re-granting after a revocation restores the SAME learning record (progress,
    completion and certificate history preserved). Records the instructor's
    acknowledgement that external payment was received — this is never platform
    payment verification. Private ref/note fields stay instructor-only.
    """
    _require_instructor(user)
    req = await get_doc("course_contact_requests", request_id)
    if req is None:
        _error(404, "REQUEST_NOT_FOUND", "contact request not found")
    if req.get("instructorId") != user["id"]:
        _error(403, "FORBIDDEN", "not your course request")
    course = await _require_course(req["courseId"])
    if course["instructorId"] != user["id"]:
        _error(403, "FORBIDDEN", "not your course")
    if course.get("status") != "published" or _course_is_free(course):
        _error(409, "NOT_PUBLISHED_PAID", "access can only be granted on a published paid course")
    if req.get("status") != course_access.REQUEST_STATUS_CONTACTED:
        _error(409, "REQUEST_NOT_ELIGIBLE", f"request status is {req.get('status')}")

    learner = await get_user(req["learnerId"])
    if learner is None:
        _error(404, "LEARNER_NOT_FOUND", "learner not found")

    if not body.paymentReceivedAck:
        _error(
            422,
            "ACK_REQUIRED",
            "confirm that you received the course payment directly from the learner",
            {"paymentReceivedAck": "required"},
        )

    pid = _purchase_id(req["learnerId"], req["courseId"])
    record = await get_doc("course_purchases", pid)
    if record is not None and course_access.is_granted(record) and not course_access.is_revoked(record):
        return {
            "granted": True,
            "alreadyGranted": True,
            "access": course_access.access_summary(record),
            "studentId": req["learnerId"],
            "courseId": req["courseId"],
        }

    now = _now()
    was_revoked = record is not None and course_access.is_revoked(record)
    if record is None:
        record = course_access.new_access_doc(
            user=learner,
            course=course,
            access_type=course_access.ACCESS_TYPE_MANUAL,
            request_id=req["id"],
            price_at_contact=float(req.get("priceRupees") or course.get("priceRupees") or 0),
            currency=req.get("currency") or "INR",
        )
    else:
        # Restore the SAME record — progress/completion/certificate survive.
        record["accessType"] = course_access.ACCESS_TYPE_MANUAL
        record["accessStatus"] = course_access.ACCESS_STATUS_GRANTED
        record["requestId"] = req["id"]
        record["priceAtContactRupees"] = float(req.get("priceRupees") or course.get("priceRupees") or 0)
        record["currency"] = req.get("currency") or "INR"
        record["grantedBy"] = user["id"]
        record["grantedAt"] = now
        if was_revoked:
            record["reGrantedAt"] = now
            record.setdefault("accessHistory", []).append(
                {"action": "reGranted", "by": user["id"], "at": now}
            )
    # Instructor-private fields — never platform-verified payment evidence.
    record["paymentReceivedAck"] = True
    record["paymentReceivedAckAt"] = now
    if body.externalPaymentRef:
        record["externalPaymentRef"] = body.externalPaymentRef
    if body.instructorNote:
        record["instructorNote"] = body.instructorNote
    record.setdefault("accessHistory", []).append(
        {"action": "granted", "by": user["id"], "at": now}
    )
    record["updatedAt"] = now
    await set_doc("course_purchases", pid, record)

    from app.services import academy_ai

    # Outcome hook — was this grant led by a recommendation?
    await academy_ai.record_purchase_outcome_if_recommended(req["learnerId"], req["courseId"])

    from app.services.notify import notify_user

    await notify_user(
        req["learnerId"],
        type="course_access_granted",
        title="Course access granted / पहुँच प्रदान की गई",
        body=f"{user.get('name') or 'Your instructor'} granted you access to {course.get('title') or 'the course'}. Start learning!",
        deepLink=f"/dashboard/p/courses/{req['courseId']}/learn",
    )
    return {
        "granted": True,
        "alreadyGranted": False,
        "restoredAfterRevoke": was_revoked,
        "access": course_access.access_summary(record),
        "studentId": req["learnerId"],
        "courseId": req["courseId"],
    }


@router.post("/instructor/enrollment-requests/{request_id}/dismiss")
async def dismiss_contact_request(request_id: str, user: dict = Depends(_user)):
    """Dismiss an eligible (contacted, not yet granted) request the instructor
    does not want to pursue. Does not delete contact history or the chat."""
    _require_instructor(user)
    req = await get_doc("course_contact_requests", request_id)
    if req is None:
        _error(404, "REQUEST_NOT_FOUND", "contact request not found")
    if req.get("instructorId") != user["id"]:
        _error(403, "FORBIDDEN", "not your course request")
    if req.get("status") != course_access.REQUEST_STATUS_CONTACTED:
        _error(409, "REQUEST_NOT_ELIGIBLE", f"request status is {req.get('status')}")
    record = await _access_record(req["learnerId"], req["courseId"])
    if record is not None and course_access.is_granted(record):
        _error(409, "ACCESS_ALREADY_GRANTED", "revoke the granted access instead of dismissing")
    req["status"] = course_access.REQUEST_STATUS_DISMISSED
    req["dismissedBy"] = user["id"]
    req["dismissedAt"] = _now()
    req["updatedAt"] = req["dismissedAt"]
    await set_doc("course_contact_requests", request_id, req)
    return {"requestId": request_id, "status": req["status"]}


@router.get("/instructor/courses/{course_id}/learners")
async def instructor_course_learners(course_id: str, user: dict = Depends(_user)):
    """Course Learners view: active and revoked learners with learning progress
    summaries, access type/status and the connection's chat room."""
    _require_instructor(user)
    course = await _require_course(course_id)
    if course["instructorId"] != user["id"]:
        _error(403, "FORBIDDEN", "not your course")
    records = await query("course_purchases", [("courseId", "==", course_id)], limit=500)
    badges = await course_access.badge_map([r["userId"] for r in records])
    active: list[dict] = []
    revoked: list[dict] = []
    for record in records:
        req = await get_doc("course_contact_requests", record["userId"] + "_" + course_id)
        row = {
            "studentId": record["userId"],
            "studentName": record.get("studentName") or "Learner",
            "identityVerified": bool((badges.get(record["userId"]) or {}).get("identity")),
            "accessType": record.get("accessType"),
            "accessStatus": record.get("accessStatus") or "granted",
            "learningStatus": course_access.learning_status(record),
            "progressPercent": record.get("progressPercent", 0),
            "isCompleted": bool(record.get("isCompleted")),
            "certificateId": record.get("certificateId"),
            "grantedAt": record.get("grantedAt") or record.get("paidAt"),
            "lastAccessedAt": record.get("lastAccessedAt"),
            "revokedAt": record.get("revokedAt"),
            "revokeReason": record.get("revokeReason"),
            "chatRoomId": (req or {}).get("chatRoomId"),
            "priceAtContactRupees": record.get("priceAtContactRupees"),
            "currency": record.get("currency") or "INR",
        }
        if course_access.is_revoked(record):
            revoked.append(row)
        elif course_access.is_granted(record):
            active.append(row)
    active.sort(key=lambda r: r.get("grantedAt") or "", reverse=True)
    revoked.sort(key=lambda r: r.get("revokedAt") or "", reverse=True)
    return {
        "courseId": course_id,
        "active": active,
        "revoked": revoked,
        "totalActive": len(active),
        "totalRevoked": len(revoked),
    }


@router.post("/instructor/courses/{course_id}/learners/{student_id}/revoke")
async def revoke_course_access(
    course_id: str,
    student_id: str,
    body: RevokeCourseAccessIn,
    user: dict = Depends(_user),
):
    """Revoke a learner's paid-course access with a recorded reason. Blocks
    content immediately but preserves the learner's progress and history;
    chats and contact history stay intact; no refund is issued or promised.
    Free-course access cannot be revoked here (exceptional cases go through
    moderation), and the same record can be re-granted later."""
    _require_instructor(user)
    course = await _require_course(course_id)
    if course["instructorId"] != user["id"]:
        _error(403, "FORBIDDEN", "not your course")
    record = await _access_record(student_id, course_id)
    if record is None:
        _error(404, "LEARNER_NOT_FOUND", "no access record for this learner")
    if record.get("accessType") == course_access.ACCESS_TYPE_FREE:
        _error(409, "FREE_ACCESS_NOT_REVOCABLE", "free-course access cannot be revoked from here")
    if not course_access.is_granted(record) or course_access.is_revoked(record):
        _error(409, "NOT_GRANTED", "access is not currently granted for this learner")

    now = _now()
    record["accessStatus"] = course_access.ACCESS_STATUS_REVOKED
    record["revokedBy"] = user["id"]
    record["revokedAt"] = now
    record["revokeReason"] = body.reason
    record.setdefault("accessHistory", []).append(
        {"action": "revoked", "by": user["id"], "at": now, "reason": body.reason}
    )
    record["updatedAt"] = now
    await set_doc("course_purchases", record["id"], record)

    from app.services.notify import notify_user

    await notify_user(
        student_id,
        type="course_access_revoked",
        title="Course access revoked / पहुँच रद्द",
        body=f"Your access to {course.get('title') or 'the course'} was revoked by the instructor. Your progress is preserved — contact your instructor for details.",
        deepLink="/academy/my-learning",
    )
    return {
        "revoked": True,
        "studentId": student_id,
        "courseId": course_id,
        "accessStatus": course_access.ACCESS_STATUS_REVOKED,
        "revokedAt": now,
        "revokeReason": body.reason,
    }


@router.post("/instructor/courses/{course_id}/learners/{student_id}/regrant")
async def regrant_course_access(course_id: str, student_id: str, user: dict = Depends(_user)):
    """Re-grant a previously revoked learner — restores the SAME learning
    record (progress, completion and certificate history preserved)."""
    _require_instructor(user)
    course = await _require_course(course_id)
    if course["instructorId"] != user["id"]:
        _error(403, "FORBIDDEN", "not your course")
    record = await _access_record(student_id, course_id)
    if record is None:
        _error(404, "LEARNER_NOT_FOUND", "no access record for this learner")
    if not course_access.is_revoked(record):
        _error(409, "NOT_REVOKED", "this learner's access is not revoked")

    now = _now()
    record["accessStatus"] = course_access.ACCESS_STATUS_GRANTED
    record["grantedBy"] = user["id"]
    record["grantedAt"] = now
    record["reGrantedAt"] = now
    record.setdefault("accessHistory", []).append(
        {"action": "reGranted", "by": user["id"], "at": now}
    )
    record["updatedAt"] = now
    await set_doc("course_purchases", record["id"], record)

    from app.services.notify import notify_user

    await notify_user(
        student_id,
        type="course_access_granted",
        title="Course access re-granted / पहुँच पुनः प्रदान",
        body=f"Your access to {course.get('title') or 'the course'} was re-granted by the instructor. Continue learning!",
        deepLink=f"/dashboard/p/courses/{course_id}/learn",
    )
    return {
        "granted": True,
        "restored": True,
        "studentId": student_id,
        "courseId": course_id,
        "access": course_access.access_summary(record),
    }
