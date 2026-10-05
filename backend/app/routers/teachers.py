import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.teachers import (
    AssignmentGradeIn,
    AssignmentSubmitIn,
    AttendanceMarkIn,
    BatchCreateIn,
    CourseCreateIn,
    EnquiryAnswerIn,
    EnquiryCreateIn,
    FeeQuoteIn,
    TeacherAnnouncementIn,
    TeacherCertificateIssueIn,
    TeacherProfileUpdateIn,
)
from app.services.users import get_user

router = APIRouter(prefix="/teachers", tags=["teachers"])


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


def _is_instructor(user: dict) -> bool:
    profiles = user.get("linkedProfiles") or [user.get("activeProfile") or "farmer"]
    return "instructor" in profiles or user.get("isAdmin", False) or user.get("activeProfile") == "instructor"


# ---------------------------------------------------------------------------
# Teacher Profile Management
# ---------------------------------------------------------------------------
@router.get("/me")
async def get_my_teacher_profile(user: dict = Depends(_user)):
    doc = await get_doc("teacher_profiles", user["id"])
    if doc is None:
        role_profile = (user.get("roleProfiles") or {}).get("instructor", {})
        doc = {
            "id": user["id"],
            "userId": user["id"],
            "name": user.get("name") or "GyanSetu Instructor",
            "headline": "Agricultural Science & Practical Farming Specialist",
            "bio": "Experienced educator and agronomist dedicated to high-yield sustainable cultivation techniques, crop protection, and modern farm tech.",
            "institution": "Agrovercity Gurukul / ICAR Affiliate",
            "qualification": role_profile.get("qualification") or "M.Sc. / Ph.D. Agriculture",
            "expertise": role_profile.get("expertise") or ["Agronomy", "Crop Protection", "Organic Farming"],
            "experienceYears": 8,
            "avatarUrl": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300",
            "websiteUrl": "https://agrovercity.com",
            "email": user.get("phone", "") + "@agrovercity.org",
            "phone": user.get("phone") or "",
            "isVerified": True,
            "bankAccountName": user.get("name") or "",
            "bankAccountNumber": "987654321012",
            "bankIfsc": "SBIN0001234",
            "createdAt": _now(),
            "updatedAt": _now(),
        }
        await set_doc("teacher_profiles", user["id"], doc)
    return doc


@router.put("/me")
async def update_my_teacher_profile(body: TeacherProfileUpdateIn, user: dict = Depends(_user)):
    profile = await get_doc("teacher_profiles", user["id"])
    if profile is None:
        profile = {
            "id": user["id"],
            "userId": user["id"],
            "name": user.get("name") or "Instructor",
            "isVerified": True,
            "createdAt": _now(),
        }

    fields = body.model_dump(exclude_none=True)
    profile.update(fields)
    profile["updatedAt"] = _now()
    await set_doc("teacher_profiles", user["id"], profile)
    return profile


# ---------------------------------------------------------------------------
# Teacher Student Management & Announcements (Static routes before /{teacher_id})
# ---------------------------------------------------------------------------
@router.get("/students")
async def list_all_teacher_students(
    courseId: str | None = None,
    search: str | None = None,
    user: dict = Depends(_user),
):
    if not _is_instructor(user):
        _error(403, "NOT_INSTRUCTOR", "only instructors can manage students")

    purchases = await query("course_purchases", [("instructorId", "==", user["id"])], limit=1000)
    purchases = [p for p in purchases if p.get("status") == "paid"]

    if courseId:
        purchases = [p for p in purchases if p.get("courseId") == courseId]

    if search:
        needle = search.lower()
        purchases = [
            p for p in purchases
            if needle in p.get("studentName", "").lower()
            or needle in p.get("studentPhone", "").lower()
            or needle in p.get("courseTitle", "").lower()
        ]

    purchases.sort(key=lambda p: p.get("paidAt", "") or p.get("createdAt", ""), reverse=True)

    students = []
    for p in purchases:
        students.append({
            "enrollmentId": p.get("id"),
            "studentId": p.get("userId"),
            "studentName": p.get("studentName") or "Enrolled Farmer",
            "studentPhone": p.get("studentPhone") or "",
            "courseId": p.get("courseId"),
            "courseTitle": p.get("courseTitle") or "Course",
            "enrolledAt": p.get("paidAt") or p.get("createdAt"),
            "progressPercent": p.get("progressPercent", 0),
            "isCompleted": p.get("isCompleted", False),
            "certificateId": p.get("certificateId"),
            "amountPaidRupees": p.get("amountRupees", 0),
            "coinsRedeemed": p.get("coinsRedeemed", 0),
        })

    return {"data": students, "total": len(students)}


@router.get("/courses/{course_id}/students")
async def list_course_students(course_id: str, user: dict = Depends(_user)):
    return await list_all_teacher_students(courseId=course_id, user=user)


@router.post("/courses/{course_id}/students/{student_id}/certificate")
async def issue_student_certificate(
    course_id: str,
    student_id: str,
    body: TeacherCertificateIssueIn,
    user: dict = Depends(_user),
):
    pid = f"{student_id}_{course_id}"
    purchase = await get_doc("course_purchases", pid)
    if purchase is None or purchase.get("status") != "paid":
        _error(404, "ENROLLMENT_NOT_FOUND", "student enrollment not found")

    if purchase.get("instructorId") != user["id"] and not user.get("isAdmin"):
        _error(403, "FORBIDDEN", "not your course")

    cert_id = purchase.get("certificateId") or f"CERT-GS-{course_id[:4].upper()}-{uuid.uuid4().hex[:6].upper()}"
    purchase["isCompleted"] = True
    purchase["progressPercent"] = 100.0
    purchase["certificateId"] = cert_id
    purchase["certificateIssuedAt"] = _now()
    if body.customNote:
        purchase["certificateNote"] = body.customNote

    # WS-06 task 6.10 — learning-path suggestion on certificate issue (C20).
    from app.services import academy_ai

    if not purchase.get("learningPath"):
        await academy_ai.apply_learning_path(purchase)

    await set_doc("course_purchases", pid, purchase)
    return {
        "success": True,
        "certificateId": cert_id,
        "studentId": student_id,
        "courseId": course_id,
        "issuedAt": purchase["certificateIssuedAt"],
        "learningPath": purchase.get("learningPath"),
    }


@router.post("/courses/{course_id}/announcements", status_code=201)
async def post_course_announcement(
    course_id: str,
    body: TeacherAnnouncementIn,
    user: dict = Depends(_user),
):
    course = await get_doc("courses", course_id)
    if course is None:
        _error(404, "COURSE_NOT_FOUND", "course not found")
    if course["instructorId"] != user["id"]:
        _error(403, "FORBIDDEN", "not your course")

    announcement_id = uuid.uuid4().hex[:12]
    now = _now()
    doc = {
        "id": announcement_id,
        "courseId": course_id,
        "courseTitle": course.get("title", ""),
        "instructorId": user["id"],
        "instructorName": user.get("name") or "Course Instructor",
        "title": body.title,
        "message": body.message,
        "createdAt": now,
    }
    await set_doc(f"courses/{course_id}/announcements", announcement_id, doc)
    return doc


@router.get("/courses/{course_id}/announcements")
async def list_course_announcements(course_id: str):
    announcements = await query(f"courses/{course_id}/announcements", [], limit=50)
    announcements.sort(key=lambda a: a.get("createdAt", ""), reverse=True)
    return {"data": announcements, "total": len(announcements)}


# ---------------------------------------------------------------------------
# Teacher Analytics Dashboard
# ---------------------------------------------------------------------------
@router.get("/analytics")
async def get_teacher_analytics(user: dict = Depends(_user)):
    # WS-02 task 2.23: the full analytics view is a Pro capability. Instructors
    # without the `analytics_full` entitlement receive only the basic subset.
    from app.services.billing import has_feature

    if not await has_feature(user["id"], "instructor", "analytics_full"):
        courses = await query("courses", [("instructorId", "==", user["id"])], limit=500)
        purchases = await query("course_purchases", [("instructorId", "==", user["id"])], limit=1000)
        return {
            "coursesCount": len(courses),
            "studentsCount": sum(1 for p in purchases if p.get("status") == "paid"),
        }

    courses = await query("courses", [("instructorId", "==", user["id"])], limit=500)
    purchases = await query("course_purchases", [("instructorId", "==", user["id"])], limit=1000)
    paid_purchases = [p for p in purchases if p.get("status") == "paid"]

    total_revenue = sum(float(c.get("instructorEarningsRupees", 0)) for c in courses)
    total_sales = len(paid_purchases)
    completed_students = sum(1 for p in paid_purchases if p.get("isCompleted"))
    completion_rate = round((completed_students / max(1, total_sales)) * 100, 1) if total_sales else 0

    ratings = [c.get("ratingAverage", 5.0) for c in courses if c.get("ratingCount", 0) > 0]
    avg_rating = round(sum(ratings) / len(ratings), 1) if ratings else 4.9

    return {
        "totalCourses": len(courses),
        "publishedCourses": sum(1 for c in courses if c.get("status") == "published"),
        "pendingReviewCourses": sum(1 for c in courses if c.get("status") == "pendingReview"),
        "totalStudents": total_sales,
        "completedStudents": completed_students,
        "completionRatePercent": completion_rate,
        "totalEarningsRupees": round(total_revenue, 2),
        "averageRating": avg_rating,
    }


# ---------------------------------------------------------------------------
# Teacher Course Studio, Batches, Enquiries & Academy Operations
# ---------------------------------------------------------------------------
@router.get("/courses/mine")
async def list_my_courses(user: dict = Depends(_user)):
    courses = await query("courses", [("instructorId", "==", user["id"])], limit=500)
    courses.sort(key=lambda c: c.get("createdAt", ""), reverse=True)
    return {"data": courses, "total": len(courses)}


@router.post("/courses/create", status_code=201)
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
    cid = f"crs_{uuid.uuid4().hex[:8]}"
    doc = {
        "id": cid,
        "title": body.title,
        "category": body.category,
        "instructorId": user["id"],
        "instructorName": user.get("name") or "Agrovercity Certified Trainer",
        "syllabus": body.syllabus,
        "sessionCount": body.sessionCount,
        "practicalHours": body.practicalHours,
        "mode": body.mode,
        "feeRupees": body.feeRupees,
        "batchCapacity": body.batchCapacity,
        "prerequisites": body.prerequisites,
        "materialsList": body.materialsList,
        "enrolledCount": 0,
        "ratingAverage": 5.0,
        "ratingCount": 0,
        "status": "published",
        # WS-02 task 2.24: phase-07 module 27 admin course-moderation queue
        # consumes this. `status` lifecycle is unchanged for the learner flow.
        "moderationStatus": "pending_review",
        "createdAt": _now(),
    }
    await set_doc("courses", cid, doc)
    return doc


@router.get("/batches")
async def list_teacher_batches(user: dict = Depends(_user)):
    batches = await query("course_batches", [("instructorId", "==", user["id"])], limit=200)
    return {"data": batches, "total": len(batches)}


@router.post("/batches", status_code=201)
async def create_teacher_batch(body: BatchCreateIn, user: dict = Depends(_user)):
    # WS-02 task 2.27: taking bookings (batches) also requires approved KYC.
    from app.services.kyc import instructor_publish_blocked_reason

    if not user.get("isAdmin"):
        blocked = await instructor_publish_blocked_reason(user["id"])
        if blocked:
            _error(403, "KYC_NOT_APPROVED", blocked)
    bid = f"btc_{uuid.uuid4().hex[:8]}"
    doc = {
        "id": bid,
        "instructorId": user["id"],
        "courseId": body.courseId,
        "batchName": body.batchName,
        "startDate": body.startDate,
        "endDate": body.endDate,
        "locationPin": body.locationPin,
        "maxSeats": body.maxSeats,
        "enrolledSeats": 0,
        "scheduleDays": body.scheduleDays,
        "status": "upcoming",
        "createdAt": _now(),
    }
    await set_doc("course_batches", bid, doc)
    return doc


@router.get("/enquiries")
async def list_teacher_enquiries(user: dict = Depends(_user)):
    enquiries = await query("course_enquiries", [("instructorId", "==", user["id"])], limit=200)
    return {"data": enquiries, "total": len(enquiries)}


@router.post("/enquiries/{enquiry_id}/quote")
async def quote_enquiry_fee(enquiry_id: str, body: FeeQuoteIn, user: dict = Depends(_user)):
    enquiry = await get_doc("course_enquiries", enquiry_id)
    if enquiry is None:
        _error(404, "ENQUIRY_NOT_FOUND", "enquiry not found")

    enquiry["quotedFeeRupees"] = body.proposedFeeRupees
    enquiry["terms"] = body.terms
    enquiry["status"] = "quoted"
    enquiry["quotedAt"] = _now()
    await set_doc("course_enquiries", enquiry_id, enquiry)
    return enquiry


@router.get("/sessions/{session_id}/attendance")
async def get_session_attendance(session_id: str, user: dict = Depends(_user)):
    doc = await get_doc("session_attendance", session_id)
    if doc is None:
        doc = {
            "sessionId": session_id,
            "sessionDate": _now()[:10],
            "records": [
                {"studentId": "std_1", "studentName": "Kishor Mahajan", "status": "present", "verifiedAt": _now()},
                {"studentId": "std_2", "studentName": "Vilas Patil", "status": "present", "verifiedAt": _now()},
                {"studentId": "std_3", "studentName": "Nilesh Borse", "status": "present", "verifiedAt": _now()},
            ],
            "totalPresent": 3,
            "totalEnrolled": 3,
        }
        await set_doc("session_attendance", session_id, doc)
    return doc


@router.post("/sessions/{session_id}/attendance")
async def mark_session_attendance(session_id: str, body: AttendanceMarkIn, user: dict = Depends(_user)):
    doc = await get_session_attendance(session_id, user)
    records = doc.get("records", [])
    updated = False
    for r in records:
        if r.get("studentId") == body.studentId:
            r["status"] = body.status
            r["verifiedAt"] = _now()
            updated = True
            break
    if not updated:
        records.append({
            "studentId": body.studentId,
            "studentName": "Trainee Farmer",
            "status": body.status,
            "verifiedAt": _now(),
        })

    doc["records"] = records
    doc["totalPresent"] = sum(1 for r in records if r.get("status") == "present")
    await set_doc("session_attendance", session_id, doc)
    return doc


@router.get("/assignments")
async def list_practical_assignments(user: dict = Depends(_user)):
    assignments = await query("course_assignments", [("instructorId", "==", user["id"])], limit=200)
    # WS-06 task 6.7: when the instructor views a submitted assignment, generate
    # (once) the objective AI grade suggestion and store it as a PREFILL on the
    # submission doc. `require_confirm` — the grade is never published here; the
    # instructor still calls POST /assignments/{id}/grade explicitly.
    from app.services import academy_ai

    user_lang = str(user.get("preferredLanguage") or user.get("language") or "hi")
    for assignment in assignments:
        if assignment.get("status") != "submitted" or assignment.get("aiSuggestion"):
            continue
        suggestion = await academy_ai.suggest_assignment_grade(assignment, user_lang=user_lang)
        if suggestion is not None:
            assignment["aiSuggestion"] = suggestion
            await set_doc("course_assignments", assignment["id"], assignment)
    return {"data": assignments, "total": len(assignments)}


@router.post("/assignments/{assignment_id}/grade")
async def grade_assignment(assignment_id: str, body: AssignmentGradeIn, user: dict = Depends(_user)):
    assignment = await get_doc("course_assignments", assignment_id)
    if assignment is None:
        _error(404, "ASSIGNMENT_NOT_FOUND", "assignment not found")

    assignment["grade"] = body.grade
    assignment["feedback"] = body.feedback
    assignment["passed"] = body.passed
    assignment["status"] = "graded"
    assignment["gradedAt"] = _now()
    await set_doc("course_assignments", assignment_id, assignment)

    # WS-06 task 6.13: outcome hook — published grade vs the AI rubric suggestion.
    from app.services.ai import outcomes

    suggestion = assignment.get("aiSuggestion") or {}
    if suggestion:
        await outcomes.record_grade_delta_outcome(
            assignment_id,
            body.grade,
            suggestion.get("suggestedScorePct"),
            suggestion.get("decision_id"),
        )
    return assignment


@router.get("/certificates/verify/{certificate_id}")
async def verify_certificate_public(certificate_id: str):
    """Public certificate verification for employers / third parties.

    Intentionally unauthenticated, but returns only the certificate's real
    public fields (no demo fallback, no PII beyond the learner's name)."""
    purchases = await query("course_purchases", [("certificateId", "==", certificate_id)], limit=1)
    if not purchases:
        _error(404, "CERTIFICATE_NOT_FOUND", "certificate not found")
    p = purchases[0]
    return {
        "isValid": True,
        "certificateId": certificate_id,
        "recipientName": p.get("studentName"),
        "courseTitle": p.get("courseTitle"),
        "issuedAt": p.get("certificateIssuedAt"),
        "credential": p.get("credential"),
    }


@router.get("/earnings")
async def get_instructor_earnings(user: dict = Depends(_user)):
    """Instructor earnings ledger (WS-02 step 3 / task 2.19).

    Rebuilt on the real config-driven commission: gross − commission = payout,
    all integer paisa. `onHold` mirrors the phase-00 bank-verification rule used
    by the settlement payout rails; `nextPayoutDate` is the next weekly run.
    """
    from app.services.settlements import _config, _has_verified_bank_account, course_gmv_pct

    config = await _config()
    purchases = await query("course_purchases", [("instructorId", "==", user["id"])], limit=1000)
    paid_purchases = [p for p in purchases if p.get("status") == "paid"]

    by_course: dict[str, dict] = {}
    for purchase in paid_purchases:
        amount_paisa = int(round(float(purchase.get("amountRupees") or 0) * 100))
        course = await get_doc("courses", purchase.get("courseId") or "")
        pct = course_gmv_pct(config, (course or {}).get("category"))
        course_id = purchase.get("courseId") or ""
        bucket = by_course.setdefault(
            course_id,
            {
                "courseId": course_id,
                "courseTitle": purchase.get("courseTitle") or "",
                "grossPaisa": 0,
                "commissionPaisa": 0,
                "netPaisa": 0,
            },
        )
        bucket["grossPaisa"] += amount_paisa
        bucket["commissionPaisa"] += amount_paisa * pct // 100
        bucket["netPaisa"] = bucket["grossPaisa"] - bucket["commissionPaisa"]

    by_course_list = list(by_course.values())
    gross_paisa = sum(bucket["grossPaisa"] for bucket in by_course_list)
    commission_paisa = sum(bucket["commissionPaisa"] for bucket in by_course_list)

    today = datetime.now(timezone.utc).date()
    days_ahead = (7 - today.weekday()) % 7 or 7  # next Monday, always in the future
    next_payout = today + timedelta(days=days_ahead)

    return {
        "grossPaisa": gross_paisa,
        "commissionPaisa": commission_paisa,
        "netPaisa": gross_paisa - commission_paisa,
        "currency": "INR",
        "commissionPct": course_gmv_pct(config),
        "byCourse": by_course_list,
        "nextPayoutDate": next_payout.isoformat(),
        "onHold": not await _has_verified_bank_account(user["id"]),
    }


# ---------------------------------------------------------------------------
# Public Teachers Directory & Teacher Profile by ID
# ---------------------------------------------------------------------------
@router.get("")
async def list_teachers(page: int = 1, pageSize: int = 20):
    teachers = await query("teacher_profiles", [], limit=100)
    if not teachers:
        return {"data": [], "total": 0, "page": page, "pageSize": pageSize}
    teachers.sort(key=lambda t: t.get("experienceYears", 0), reverse=True)
    start = (page - 1) * pageSize
    return {"data": teachers[start : start + pageSize], "total": len(teachers), "page": page, "pageSize": pageSize}


@router.get("/{teacher_id}")
async def get_teacher_public_profile(teacher_id: str):
    teacher = await get_doc("teacher_profiles", teacher_id)
    if teacher is None:
        u = await get_user(teacher_id)
        if u is None:
            _error(404, "TEACHER_NOT_FOUND", "teacher profile not found")
        teacher = {
            "id": teacher_id,
            "userId": teacher_id,
            "name": u.get("name") or "Expert Instructor",
            "headline": "Agronomy Specialist",
            "bio": "Certified agricultural instructor and farm advisor.",
            "institution": "GyanSetu Gurukul",
            "qualification": "Certified Agronomist",
            "expertise": ["Agronomy", "Crop Protection"],
            "experienceYears": 5,
            "avatarUrl": "",
            "isVerified": True,
        }

    courses = await query("courses", [("instructorId", "==", teacher_id), ("status", "==", "published")], limit=100)
    for c in courses:
        c.pop("rejectedReason", None)
        c.pop("mediaUrl", None)

    total_students = sum(c.get("salesCount", 0) for c in courses)
    ratings = [c.get("ratingAverage", 5.0) for c in courses if c.get("ratingCount", 0) > 0]
    avg_rating = round(sum(ratings) / len(ratings), 1) if ratings else 4.9

    teacher_public = dict(teacher)
    teacher_public.pop("bankAccountNumber", None)
    teacher_public.pop("bankIfsc", None)
    teacher_public.pop("bankAccountName", None)
    teacher_public["courses"] = courses
    teacher_public["totalCourses"] = len(courses)
    teacher_public["totalStudents"] = total_students
    teacher_public["ratingAverage"] = avg_rating

    return teacher_public
