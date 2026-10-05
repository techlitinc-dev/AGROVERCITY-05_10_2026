from tests.test_diary import auth, seed_user


def _grant_instructor_pro(user_store, uid):
    """WS-02 task 2.23: the full analytics payload is a Pro capability."""
    user_store[f"subscriptions/sub-{uid}"] = {
        "id": f"sub-{uid}",
        "userId": uid,
        "planId": "instructor_pro",
        "status": "active",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }


def _seed_enquiry(user_store, instructor_id, enquiry_id="enq-1"):
    user_store[f"course_enquiries/{enquiry_id}"] = {
        "id": enquiry_id,
        "instructorId": instructor_id,
        "farmerId": "farmer-102",
        "farmerName": "Suresh Gawande",
        "courseId": "crs-sample",
        "courseTitle": "Precision Drone Spraying",
        "questionTemplate": "Is this course eligible for a State Agriculture Dept subsidy?",
        "details": "I farm 12 acres of vineyards and want to run custom-hire spraying for my FPO.",
        "status": "pending",
        "quotedFeeRupees": None,
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    return enquiry_id


def _seed_assignment(user_store, instructor_id, assignment_id="asg-1"):
    user_store[f"course_assignments/{assignment_id}"] = {
        "id": assignment_id,
        "instructorId": instructor_id,
        "courseTitle": "Precision Drone Spraying",
        "studentName": "Kishor Mahajan",
        "studentId": "std-1",
        "title": "Field Spray Log & Nozzle Calibration Checklist",
        "notes": "Completed a 2-acre spray demo with TeeJet nozzles.",
        "evidencePhotoUrls": ["https://example.com/evidence.jpg"],
        "rubric": {
            "fieldTechnique": "Proficient",
            "safetyProtocol": "Exemplary",
            "documentation": "Verified",
        },
        "grade": "A",
        "status": "graded",
        "submittedAt": "2026-10-01T00:00:00+00:00",
    }
    return assignment_id


async def test_teacher_academy_courses_and_batches(client, user_store):
    inst_token = seed_user(user_store, uid="teacher-1", active_profile="instructor")
    _grant_instructor_pro(user_store, "teacher-1")

    # Get teacher profile & analytics
    resp = await client.get("/v1/teachers/me", headers=auth(inst_token))
    assert resp.status_code == 200
    assert resp.json()["id"] == "teacher-1"

    resp = await client.get("/v1/teachers/analytics", headers=auth(inst_token))
    assert resp.status_code == 200
    analytics = resp.json()
    assert "totalCourses" in analytics

    # List mine — the demo-course seeding is gone, so a fresh instructor owns none.
    resp = await client.get("/v1/teachers/courses/mine", headers=auth(inst_token))
    assert resp.status_code == 200
    assert resp.json()["total"] == 0

    # Create new practical course
    course_payload = {
        "title": "Bio-Fertilizer & Jeevamrut Mass Production Studio",
        "category": "Organic Inputs",
        "syllabus": [
            "Module 1: Beneficial Microorganism Isolation",
            "Module 2: 200L Fermenter Aeration & Temperature Control",
            "Module 3: Quality QC Testing (pH, Microbial Colony Count)",
        ],
        "sessionCount": 4,
        "practicalHours": 12.0,
        "mode": "hybrid",
        "feeRupees": 4500.0,
        "batchCapacity": 20,
        "prerequisites": "Basic organic farming knowledge",
        "materialsList": ["Jaggery", "Besan", "Fresh Cow Dung", "Local Soil"],
    }
    resp = await client.post("/v1/teachers/courses/create", json=course_payload, headers=auth(inst_token))
    assert resp.status_code == 201
    created_course = resp.json()
    assert created_course["feeRupees"] == 4500.0
    cid = created_course["id"]

    # The created course now shows up in the instructor's own list.
    resp = await client.get("/v1/teachers/courses/mine", headers=auth(inst_token))
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1

    # Create batch
    batch_payload = {
        "courseId": cid,
        "batchName": "November Organic Inputs Batch #1",
        "startDate": "2026-11-05",
        "endDate": "2026-11-20",
        "locationPin": "Agro Research Demo Center, Nashik",
        "maxSeats": 20,
        "scheduleDays": "Mon & Wed 10:00 AM",
    }
    resp = await client.post("/v1/teachers/batches", json=batch_payload, headers=auth(inst_token))
    assert resp.status_code == 201
    assert resp.json()["maxSeats"] == 20

    # List batches
    resp = await client.get("/v1/teachers/batches", headers=auth(inst_token))
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


async def test_teacher_enquiries_attendance_grading_and_certificates(client, user_store):
    inst_token = seed_user(user_store, uid="teacher-2", active_profile="instructor")
    eid = _seed_enquiry(user_store, "teacher-2")

    # Enquiries & quoting (the instructor seeds its own enquiry — no demo data)
    resp = await client.get("/v1/teachers/enquiries", headers=auth(inst_token))
    assert resp.status_code == 200
    enquiries = resp.json()["data"]
    assert len(enquiries) >= 1
    assert enquiries[0]["id"] == eid

    quote_payload = {
        "enquiryId": eid,
        "proposedFeeRupees": 5500.0,
        "terms": "Includes printed field manual, starter culture, and certification.",
    }
    resp = await client.post(f"/v1/teachers/enquiries/{eid}/quote", json=quote_payload, headers=auth(inst_token))
    assert resp.status_code == 200
    assert resp.json()["quotedFeeRupees"] == 5500.0
    assert resp.json()["status"] == "quoted"

    # Live QR Attendance
    resp = await client.get("/v1/teachers/sessions/sess_101/attendance", headers=auth(inst_token))
    assert resp.status_code == 200
    att_doc = resp.json()
    assert "records" in att_doc

    mark_payload = {"sessionId": "sess_101", "studentId": "std_105", "status": "present"}
    resp = await client.post("/v1/teachers/sessions/sess_101/attendance", json=mark_payload, headers=auth(inst_token))
    assert resp.status_code == 200
    assert resp.json()["totalPresent"] >= 1

    # Assignments and Rubric Grading (instructor-owned fixture)
    asg_id = _seed_assignment(user_store, "teacher-2")
    resp = await client.get("/v1/teachers/assignments", headers=auth(inst_token))
    assert resp.status_code == 200
    assignments = resp.json()["data"]
    assert len(assignments) >= 1
    assert assignments[0]["id"] == asg_id

    grade_payload = {
        "grade": "A+",
        "feedback": "Outstanding nozzle calibration and zero droplet drift recorded.",
        "passed": True,
    }
    resp = await client.post(f"/v1/teachers/assignments/{asg_id}/grade", json=grade_payload, headers=auth(inst_token))
    assert resp.status_code == 200
    assert resp.json()["grade"] == "A+"
    assert resp.json()["passed"] is True

    # Verifiable Certificate Public Check — unknown ids are honestly not found
    # (the endpoint no longer fabricates a valid payload for arbitrary ids).
    resp = await client.get("/v1/teachers/certificates/verify/AGRO-CERT-2026-9912")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "CERTIFICATE_NOT_FOUND"

    # Instructor Earnings ledger — config-driven commission, integer paisa
    # (task 2.19 shape), T+n payout date and the bank-verification hold.
    resp = await client.get("/v1/teachers/earnings", headers=auth(inst_token))
    assert resp.status_code == 200
    earnings = resp.json()
    assert earnings["grossPaisa"] == 0
    assert earnings["commissionPaisa"] == 0
    assert earnings["netPaisa"] == 0
    assert earnings["currency"] == "INR"
    assert earnings["commissionPct"] == 15
    assert earnings["byCourse"] == []
    assert earnings["nextPayoutDate"]
    assert earnings["onHold"] is True

