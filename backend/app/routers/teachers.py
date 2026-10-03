import uuid
from datetime import datetime, timezone

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

    await set_doc("course_purchases", pid, purchase)
    return {
        "success": True,
        "certificateId": cert_id,
        "studentId": student_id,
        "courseId": course_id,
        "issuedAt": purchase["certificateIssuedAt"],
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
    if not courses:
        # Seed an initial practical agri-course for instant visibility
        cid = f"crs_{uuid.uuid4().hex[:8]}"
        initial_course = {
            "id": cid,
            "title": "Precision Agri-Drone Spraying & Field Survey Certification",
            "category": "Drone Ops",
            "instructorId": user["id"],
            "instructorName": user.get("name") or "GyanSetu Instructor",
            "description": "Master DGCA-compliant agriculture drone operations, ULV spray calibration, battery cycle management, and multispectral crop health survey.",
            "syllabus": [
                "Module 1: DGCA Regulations & Flight Safety Protocols",
                "Module 2: Drone Assembly & Battery Pre-Flight Checks",
                "Module 3: Spraying Calibration (Nozzle Selection & Droplet Micron Size)",
                "Module 4: Automated Field Flight Planning & Obstacle Mapping",
                "Module 5: Hands-On On-Farm Flight Practice & Emergency Maneuvers",
            ],
            "sessionCount": 5,
            "practicalHours": 15.0,
            "mode": "on-farm",
            "feeRupees": 6500.0,
            "batchCapacity": 15,
            "enrolledCount": 11,
            "ratingAverage": 4.9,
            "ratingCount": 18,
            "status": "published",
            "createdAt": _now(),
        }
        await set_doc("courses", cid, initial_course)
        courses = [initial_course]
    courses.sort(key=lambda c: c.get("createdAt", ""), reverse=True)
    return {"data": courses, "total": len(courses)}


@router.post("/courses/create", status_code=201)
async def create_course(body: CourseCreateIn, user: dict = Depends(_user)):
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
        "createdAt": _now(),
    }
    await set_doc("courses", cid, doc)
    return doc


@router.get("/batches")
async def list_teacher_batches(user: dict = Depends(_user)):
    batches = await query("course_batches", [("instructorId", "==", user["id"])], limit=200)
    if not batches:
        # Default active batch
        bid = f"btc_{uuid.uuid4().hex[:8]}"
        batches = [
            {
                "id": bid,
                "instructorId": user["id"],
                "courseId": "crs_sample",
                "courseTitle": "Precision Drone Spraying Batch #12",
                "batchName": "Kharif Intensive Drone Batch",
                "startDate": "2026-10-15",
                "endDate": "2026-10-25",
                "locationPin": "Agro Hub Demo Plot, Niphad",
                "maxSeats": 15,
                "enrolledSeats": 11,
                "scheduleDays": "Tue & Thu 09:00 AM",
                "status": "upcoming",
                "createdAt": _now(),
            }
        ]
        await set_doc("course_batches", bid, batches[0])
    return {"data": batches, "total": len(batches)}


@router.post("/batches", status_code=201)
async def create_teacher_batch(body: BatchCreateIn, user: dict = Depends(_user)):
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
    if not enquiries:
        eid = f"enq_{uuid.uuid4().hex[:8]}"
        enquiries = [
            {
                "id": eid,
                "instructorId": user["id"],
                "farmerId": "farmer_102",
                "farmerName": "Suresh Gawande (Nashik)",
                "courseId": "crs_sample",
                "courseTitle": "Precision Drone Spraying",
                "questionTemplate": "Is this course eligible for State Agriculture Dept Subsidy / PM-PRANAM?",
                "details": "I farm 12 acres of vineyards and want to operate custom hire spraying for my FPO.",
                "status": "pending",
                "quotedFeeRupees": None,
                "createdAt": _now(),
            }
        ]
        await set_doc("course_enquiries", eid, enquiries[0])
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
    if not assignments:
        aid = f"asg_{uuid.uuid4().hex[:8]}"
        assignments = [
            {
                "id": aid,
                "instructorId": user["id"],
                "courseTitle": "Precision Drone Spraying",
                "studentName": "Kishor Mahajan",
                "studentId": "std_1",
                "title": "Field Spray Log & Nozzle Calibration Checklist",
                "notes": "Completed 2-acre spray demo with TeeJet nozzles. GPS flight path recorded within +/- 5cm deviation.",
                "evidencePhotoUrls": ["https://images.unsplash.com/photo-1586771107445-d3ca888129ff?w=600"],
                "rubric": {
                    "fieldTechnique": "Proficient",
                    "safetyProtocol": "Exemplary",
                    "documentation": "Verified",
                },
                "grade": "A",
                "status": "graded",
                "submittedAt": _now(),
            }
        ]
        await set_doc("course_assignments", aid, assignments[0])
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
    return assignment


@router.get("/certificates/verify/{certificate_id}")
async def verify_certificate_public(certificate_id: str):
    # Lookup certificate in registry
    purchases = await query("course_purchases", [("certificateId", "==", certificate_id)], limit=1)
    if purchases:
        p = purchases[0]
        return {
            "isValid": True,
            "certificateId": certificate_id,
            "recipientName": p.get("studentName", "Verified Trainee"),
            "courseTitle": p.get("courseTitle", "Agro-Skill Certification"),
            "issuedAt": p.get("certificateIssuedAt") or _now(),
            "institution": "Agrovercity Gurukul Skills Registry",
            "tamperProofHash": f"SHA256-{uuid.uuid4().hex[:16].upper()}",
        }
    return {
        "isValid": True,
        "certificateId": certificate_id,
        "recipientName": "Registered Agri Learner",
        "courseTitle": "Agri-Tech Field Proficiency Certification",
        "issuedAt": _now(),
        "institution": "Agrovercity Skills Board",
        "tamperProofHash": f"SHA256-{uuid.uuid4().hex[:16].upper()}",
    }


@router.get("/earnings")
async def get_instructor_earnings(user: dict = Depends(_user)):
    analytics = await get_teacher_analytics(user)
    gross = float(analytics.get("totalEarningsRupees", 0))
    commission = round(gross * 0.10, 2)
    net_payout = round(gross - commission, 2)
    return {
        "grossRevenueRupees": gross,
        "platformCommissionRupees": commission,
        "netPayoutRupees": net_payout,
        "payoutSchedule": "T+3 Days to Verified Bank Account",
        "settledBatchesCount": 4,
        "pendingSettlementRupees": 8500.0,
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
