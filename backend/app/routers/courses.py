import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Query

from app.core.db import delete_doc, get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.courses import (
    CourseCreateIn,
    CourseEnrollIn,
    CourseLesson,
    CourseModule,
    CoursePurchaseVerifyIn,
    CourseQuestionIn,
    CourseAnswerIn,
    CourseReviewIn,
    CourseUpdateIn,
    LessonProgressIn,
)
from app.services import idempotency
from app.services.coins import InsufficientCoins, spend_coins
from app.services.payments import create_razorpay_order, verify_razorpay_signature
from app.services.academy_tasks import emit_learner_discovery_tasks
from app.services.tasks import emit_task
from app.services.users import get_user

router = APIRouter(tags=["courses"])

# Platform commission on paid course sales, in percent. Recorded on every
# purchase so the settlements module can clear instructor payouts.
DEFAULT_COMMISSION_PERCENT = 10.0


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


async def _paid_purchase(user_id: str, course_id: str) -> dict | None:
    purchase = await get_doc("course_purchases", _purchase_id(user_id, course_id))
    if purchase is not None and purchase.get("status") == "paid":
        return purchase
    return None


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
        "priceRupees": float(body.priceRupees),
        "originalPriceRupees": float(body.originalPriceRupees or (body.priceRupees * 2 if body.priceRupees > 0 else 0)),
        "coinsDiscountAllowed": int(body.coinsDiscountAllowed),
        "thumbnailUrl": body.thumbnailUrl,
        "mediaUrl": body.mediaUrl,
        "previewUrl": body.previewUrl,
        "promoVideoUrl": body.promoVideoUrl,
        "whatYouWillLearn": body.whatYouWillLearn,
        "requirements": body.requirements,
        "targetAudience": body.targetAudience,
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

    fields = body.model_dump(exclude_none=True)
    for key, value in fields.items():
        if hasattr(value, "value"):
            course[key] = value.value
        else:
            course[key] = value

    # Any edit after a rejection or draft sends the course back through review if status not explicitly given
    if body.status is None:
        course["status"] = "pendingReview"
        course["rejectedReason"] = None

    course["updatedAt"] = _now()
    await set_doc("courses", course_id, course)
    return course


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

    purchased_ids = {
        p["courseId"] for p in await query("course_purchases", [("userId", "==", user["id"])], limit=1000)
        if p.get("status") == "paid"
    }
    for doc in docs:
        doc["isPurchased"] = doc["id"] in purchased_ids
        doc.pop("rejectedReason", None)

    return _envelope(docs, page, pageSize)


@router.get("/courses/purchased/list")
async def my_library(user: dict = Depends(_user)):
    purchases = await query(
        "course_purchases", [("userId", "==", user["id"])], limit=500
    )
    purchases = [p for p in purchases if p.get("status") == "paid"]
    purchases.sort(key=lambda p: p.get("paidAt", ""), reverse=True)
    courses = []
    for purchase in purchases:
        course = await get_doc("courses", purchase["courseId"])
        if course is None:
            continue
        doc = _public(course, is_entitled=True)
        doc["isPurchased"] = True
        doc["purchasedAt"] = purchase.get("paidAt")
        doc["progressPercent"] = purchase.get("progressPercent", 0)
        doc["isCompleted"] = purchase.get("isCompleted", False)
        doc["certificateId"] = purchase.get("certificateId")
        courses.append(doc)
    return {"data": courses, "total": len(courses)}


@router.get("/courses/my-learning")
async def my_learning(user: dict = Depends(_user)):
    result = await my_library(user)
    # WS-01 task 1.26: emit deterministic learner discovery tasks.
    await emit_learner_discovery_tasks(user["id"])
    return result


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

    is_purchased = await _paid_purchase(user["id"], course_id) is not None
    is_entitled = is_owner or is_purchased

    doc = dict(course) if is_owner else _public(course, is_entitled=is_entitled)
    doc["isPurchased"] = is_purchased
    doc["isOwner"] = is_owner
    if is_entitled:
        doc["mediaUrl"] = course.get("mediaUrl")
    else:
        doc.pop("mediaUrl", None)

    # WS-02 task 2.31: verified instructor credentials for the course-detail
    # badge slots (WS-01 tasks 1.10/1.11). type + verifiedAt only — no PII.
    from app.services.kyc import latest_instructor_case, verified_credential_types

    doc["instructorCredentials"] = verified_credential_types(
        await latest_instructor_case(course["instructorId"])
    )

    return doc


@router.post("/courses/{course_id}/purchase")
async def purchase_course(
    course_id: str,
    user: dict = Depends(_user),
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
):
    scope = f"courses.purchase.{user['id']}.{course_id}"
    stored = await idempotency.replay(scope, idempotency_key)
    if stored is not None:
        return stored

    course = await _require_course(course_id)
    if course["status"] != "published":
        _error(404, "COURSE_NOT_FOUND", "course not found")
    if course["instructorId"] == user["id"]:
        _error(409, "OWN_COURSE", "instructors cannot buy their own course")

    pid = _purchase_id(user["id"], course_id)
    existing = await get_doc("course_purchases", pid)
    if existing is not None and existing.get("status") == "paid":
        response = {"purchased": True, "courseId": course_id}
    else:
        price = float(course.get("priceRupees") or 0)
        if price == 0:
            purchase = {
                "id": pid,
                "userId": user["id"],
                "studentName": user.get("name") or "Student",
                "studentPhone": user.get("phone") or "",
                "courseId": course_id,
                "courseTitle": course.get("title") or "",
                "instructorId": course["instructorId"],
                "amountRupees": 0,
                "commissionPercent": 0.0,
                "status": "paid",
                "progressPercent": 0,
                "completedLessonIds": [],
                "isCompleted": False,
                "certificateId": None,
                "createdAt": _now(),
                "paidAt": _now(),
            }
            await set_doc("course_purchases", pid, purchase)
            course["salesCount"] = course.get("salesCount", 0) + 1
            await set_doc("courses", course_id, course)
            response = {"purchased": True, "courseId": course_id}
        else:
            order = create_razorpay_order(int(price * 100), f"course-{course_id}-{user['id'][:8]}")
            purchase = {
                "id": pid,
                "userId": user["id"],
                "studentName": user.get("name") or "Student",
                "studentPhone": user.get("phone") or "",
                "courseId": course_id,
                "courseTitle": course.get("title") or "",
                "instructorId": course["instructorId"],
                "amountRupees": price,
                "commissionPercent": DEFAULT_COMMISSION_PERCENT,
                "status": "awaiting_payment",
                "razorpayOrderId": order["id"],
                "progressPercent": 0,
                "completedLessonIds": [],
                "isCompleted": False,
                "certificateId": None,
                "createdAt": _now(),
            }
            await set_doc("course_purchases", pid, purchase)
            response = {
                "purchased": False,
                "paymentOrderId": order["id"],
                "amountDue": price,
                "courseId": course_id,
            }

    if idempotency_key:
        await idempotency.store(scope, idempotency_key, response)
    return response


@router.post("/courses/{course_id}/enroll")
async def enroll_course(
    course_id: str,
    body: CourseEnrollIn,
    user: dict = Depends(_user),
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
):
    scope = f"courses.enroll.{user['id']}.{course_id}"
    stored = await idempotency.replay(scope, idempotency_key)
    if stored is not None:
        return stored

    course = await _require_course(course_id)
    if course["status"] != "published":
        _error(404, "COURSE_NOT_FOUND", "course not found")
    if course["instructorId"] == user["id"]:
        _error(409, "OWN_COURSE", "instructors cannot buy their own course")

    pid = _purchase_id(user["id"], course_id)
    existing = await get_doc("course_purchases", pid)
    if existing is not None and existing.get("status") == "paid":
        response = {"enrolled": True, "courseId": course_id, "alreadyEnrolled": True}
    else:
        fee = float(course.get("priceRupees") or 0)
        coins_allowed = int(course.get("coinsDiscountAllowed") or 0)
        coins_to_redeem = body.coinsToRedeem if body.useCoins else 0

        if body.useCoins and coins_to_redeem > 0:
            # X11: redemption is capped at min(instructor allowance, fee, % of order).
            # The %-of-order ceiling (default 50) is config-driven.
            cfg = await get_doc("platform_config", "gamification") or {}
            pct = int(cfg.get("redemptionMaxPctOfOrder", 50))
            pct_cap = int(fee) * pct // 100
            max_redeemable = min(coins_allowed, int(fee), pct_cap)
            if coins_to_redeem > max_redeemable:
                _error(422, "INVALID_COIN_AMOUNT", f"maximum coin redemption is {max_redeemable}")
            try:
                await spend_coins(user["id"], coins_to_redeem, "course_enroll", course_id)
            except InsufficientCoins:
                _error(409, "INSUFFICIENT_COINS", "not enough AgriCoins")

        remaining_due = max(0.0, fee - coins_to_redeem)

        if remaining_due == 0:
            purchase = {
                "id": pid,
                "userId": user["id"],
                "studentName": user.get("name") or "Student",
                "studentPhone": user.get("phone") or "",
                "courseId": course_id,
                "courseTitle": course.get("title") or "",
                "instructorId": course["instructorId"],
                "amountRupees": 0,
                "coinsRedeemed": coins_to_redeem,
                "commissionPercent": 0.0,
                "status": "paid",
                "progressPercent": 0,
                "completedLessonIds": [],
                "isCompleted": False,
                "certificateId": None,
                "createdAt": _now(),
                "paidAt": _now(),
            }
            await set_doc("course_purchases", pid, purchase)
            course["salesCount"] = course.get("salesCount", 0) + 1
            await set_doc("courses", course_id, course)
            response = {"enrolled": True, "courseId": course_id, "amountPaid": 0}
        else:
            order = create_razorpay_order(int(remaining_due * 100), f"course-{course_id}-{user['id'][:8]}")
            purchase = {
                "id": pid,
                "userId": user["id"],
                "studentName": user.get("name") or "Student",
                "studentPhone": user.get("phone") or "",
                "courseId": course_id,
                "courseTitle": course.get("title") or "",
                "instructorId": course["instructorId"],
                "amountRupees": remaining_due,
                "coinsRedeemed": coins_to_redeem,
                "commissionPercent": DEFAULT_COMMISSION_PERCENT,
                "status": "awaiting_payment",
                "razorpayOrderId": order["id"],
                "progressPercent": 0,
                "completedLessonIds": [],
                "isCompleted": False,
                "certificateId": None,
                "createdAt": _now(),
            }
            await set_doc("course_purchases", pid, purchase)
            response = {
                "enrolled": False,
                "paymentOrderId": order["id"],
                "amountDue": remaining_due,
                "courseId": course_id,
            }

    if idempotency_key:
        await idempotency.store(scope, idempotency_key, response)
    return response


@router.post("/courses/purchases/verify")
async def verify_purchase(body: CoursePurchaseVerifyIn, user: dict = Depends(_user)):
    matches = await query(
        "course_purchases", [("razorpayOrderId", "==", body.razorpayOrderId)], limit=1
    )
    purchase = matches[0] if matches else None
    if purchase is None:
        _error(404, "PURCHASE_NOT_FOUND", "no purchase awaiting payment for this order")
    if purchase["userId"] != user["id"]:
        _error(403, "FORBIDDEN", "not your purchase")
    if purchase.get("status") == "paid":
        return {"purchased": True, "courseId": purchase["courseId"]}
    if not verify_razorpay_signature(
        body.razorpayOrderId, body.razorpayPaymentId, body.razorpaySignature
    ):
        _error(400, "PAYMENT_VERIFICATION_FAILED", "razorpay signature mismatch")

    purchase["status"] = "paid"
    purchase["razorpayPaymentId"] = body.razorpayPaymentId
    purchase["paidAt"] = _now()
    await set_doc("course_purchases", purchase["id"], purchase)

    course = await _require_course(purchase["courseId"])
    course["salesCount"] = course.get("salesCount", 0) + 1
    commission_pct = float(purchase.get("commissionPercent") or 0)
    commission = round(purchase["amountRupees"] * commission_pct / 100, 2)
    course["commissionRupees"] = round(course.get("commissionRupees", 0) + commission, 2)
    course["instructorEarningsRupees"] = round(
        course.get("instructorEarningsRupees", 0) + purchase["amountRupees"] - commission, 2
    )
    await set_doc("courses", course["id"], course)

    # WS-06 task 6.13: outcome hook — was this purchase led by a recommendation?
    from app.services import academy_ai

    await academy_ai.record_purchase_outcome_if_recommended(user["id"], course["id"])
    return {"purchased": True, "courseId": course["id"]}


# ---------------------------------------------------------------------------
# Student Classroom & Learning Portal
# ---------------------------------------------------------------------------
@router.get("/courses/{course_id}/learn")
async def get_course_learning(course_id: str, user: dict = Depends(_user)):
    course = await _require_course(course_id)
    is_owner = course["instructorId"] == user["id"]
    purchase = await _paid_purchase(user["id"], course_id)

    if not is_owner and purchase is None:
        _error(403, "NOT_ENROLLED", "please enroll in the course to access the classroom")

    progress_data = purchase or {
        "completedLessonIds": [],
        "progressPercent": 0,
        "isCompleted": False,
        "certificateId": None,
    }

    # All mediaUrls are unlocked in learn mode
    doc = dict(course)
    doc["userProgress"] = {
        "completedLessonIds": progress_data.get("completedLessonIds", []),
        "progressPercent": progress_data.get("progressPercent", 0),
        "isCompleted": progress_data.get("isCompleted", False),
        "certificateId": progress_data.get("certificateId"),
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
    pid = _purchase_id(user["id"], course_id)
    purchase = await get_doc("course_purchases", pid)
    is_owner = course["instructorId"] == user["id"]

    if not is_owner and (purchase is None or purchase.get("status") != "paid"):
        _error(403, "NOT_ENROLLED", "not enrolled in this course")

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
    purchase["lastAccessedAt"] = _now()
    if is_completed and not purchase.get("completedAt"):
        purchase["completedAt"] = _now()

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
    await _require_course(course_id)
    q_id = uuid.uuid4().hex[:12]
    now = _now()
    doc = {
        "id": q_id,
        "courseId": course_id,
        "userId": user["id"],
        "userName": user.get("name") or "Student",
        "question": body.question,
        "answers": [],
        "createdAt": now,
    }
    await set_doc(f"courses/{course_id}/questions", q_id, doc)
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
