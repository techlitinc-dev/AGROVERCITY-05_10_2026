from tests.test_diary import auth, seed_user


async def test_teacher_academy_courses_and_batches(client, user_store):
    inst_token = seed_user(user_store, uid="teacher-1", active_profile="instructor")

    # Get teacher profile & analytics
    resp = await client.get("/v1/teachers/me", headers=auth(inst_token))
    assert resp.status_code == 200
    assert resp.json()["id"] == "teacher-1"

    resp = await client.get("/v1/teachers/analytics", headers=auth(inst_token))
    assert resp.status_code == 200
    analytics = resp.json()
    assert "totalCourses" in analytics

    # List mine (auto-seeds practical drone course if empty)
    resp = await client.get("/v1/teachers/courses/mine", headers=auth(inst_token))
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1

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

    # Enquiries & quoting
    resp = await client.get("/v1/teachers/enquiries", headers=auth(inst_token))
    assert resp.status_code == 200
    enquiries = resp.json()["data"]
    assert len(enquiries) >= 1
    eid = enquiries[0]["id"]

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

    # Assignments and Rubric Grading
    resp = await client.get("/v1/teachers/assignments", headers=auth(inst_token))
    assert resp.status_code == 200
    assignments = resp.json()["data"]
    assert len(assignments) >= 1
    asg_id = assignments[0]["id"]

    grade_payload = {
        "grade": "A+",
        "feedback": "Outstanding nozzle calibration and zero droplet drift recorded.",
        "passed": True,
    }
    resp = await client.post(f"/v1/teachers/assignments/{asg_id}/grade", json=grade_payload, headers=auth(inst_token))
    assert resp.status_code == 200
    assert resp.json()["grade"] == "A+"
    assert resp.json()["passed"] is True

    # Verifiable Certificate Public Check
    resp = await client.get("/v1/teachers/certificates/verify/AGRO-CERT-2026-9912")
    assert resp.status_code == 200
    cert = resp.json()
    assert cert["isValid"] is True
    assert "tamperProofHash" in cert

    # Instructor Earnings Ledger
    resp = await client.get("/v1/teachers/earnings", headers=auth(inst_token))
    assert resp.status_code == 200
    earnings = resp.json()
    assert "netPayoutRupees" in earnings
    assert "platformCommissionRupees" in earnings
