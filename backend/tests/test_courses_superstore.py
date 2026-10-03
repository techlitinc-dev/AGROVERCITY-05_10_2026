import pytest
from tests.test_admin import _seed_admin
from tests.test_diary import auth, seed_user


def _instructor_token(user_store):
    return seed_user(
        user_store,
        uid="uid-teacher-1",
        active_profile="instructor",
        linkedProfiles=["farmer", "instructor"],
        name="Dr. Radheshyam Patel",
    )


SUPERSTORE_COURSE = {
    "title": "Hi-Tech Hydroponics Masterclass",
    "subtitle": "From seed to harvest in 30 days",
    "description": "Comprehensive greenhouse and nutrient management.",
    "kind": "videoCourse",
    "level": "intermediate",
    "language": "hi",
    "category": "Greenhouse & Hydroponics",
    "priceRupees": 499.0,
    "originalPriceRupees": 1499.0,
    "coinsDiscountAllowed": 100,
    "thumbnailUrl": "https://example.com/hydro.jpg",
    "promoVideoUrl": "https://example.com/promo.mp4",
    "mediaUrl": "https://example.com/full_masterclass.mp4",
    "whatYouWillLearn": ["NFT System", "EC & pH Balancing"],
    "requirements": ["Basic enthusiasm"],
    "targetAudience": ["Modern Farmers"],
    "certificateEnabled": True,
    "certificateTitle": "Certified Commercial Hydroponics Specialist",
    "modules": [
        {
            "id": "mod-1",
            "title": "Module 1: Fundamentals",
            "order": 1,
            "lessons": [
                {
                    "id": "les-1",
                    "title": "Lesson 1: Intro to NFT",
                    "kind": "video",
                    "durationMinutes": 15,
                    "mediaUrl": "https://example.com/les1.mp4",
                    "previewUrl": "https://example.com/les1_prev.mp4",
                    "isPreviewFree": True,
                    "order": 1,
                },
                {
                    "id": "les-2",
                    "title": "Lesson 2: EC and pH",
                    "kind": "video",
                    "durationMinutes": 20,
                    "mediaUrl": "https://example.com/les2.mp4",
                    "isPreviewFree": False,
                    "order": 2,
                },
            ],
        }
    ],
    "autoPublish": True,
}


async def test_teacher_can_create_superstore_course_with_curriculum(client, user_store):
    teacher = _instructor_token(user_store)
    resp = await client.post("/v1/courses", json=SUPERSTORE_COURSE, headers=auth(teacher))
    assert resp.status_code == 201
    course = resp.json()
    assert course["title"] == SUPERSTORE_COURSE["title"]
    assert len(course["modules"]) == 1
    assert len(course["modules"][0]["lessons"]) == 2
    assert course["status"] == "published"
    assert course["priceRupees"] == 499.0


async def test_superstore_public_view_protects_non_preview_media(client, user_store):
    teacher = _instructor_token(user_store)
    farmer = seed_user(user_store, uid="uid-farmer-student", name="Kisan Ram")
    c_resp = await client.post("/v1/courses", json=SUPERSTORE_COURSE, headers=auth(teacher))
    course_id = c_resp.json()["id"]

    # Student viewing course
    resp = await client.get(f"/v1/courses/{course_id}", headers=auth(farmer))
    assert resp.status_code == 200
    doc = resp.json()
    assert "mediaUrl" not in doc  # course level media hidden
    assert doc["isPurchased"] is False
    # Check lessons: preview lesson has mediaUrl, non-preview lesson mediaUrl is hidden
    mod = doc["modules"][0]
    assert "mediaUrl" in mod["lessons"][0]  # isPreviewFree is True
    assert "mediaUrl" not in mod["lessons"][1]  # isPreviewFree is False


async def test_student_enrollment_learning_progress_and_certificate(client, user_store):
    teacher = _instructor_token(user_store)
    farmer = seed_user(user_store, uid="uid-farmer-student", name="Kisan Ram")

    # Create free course
    course_data = dict(SUPERSTORE_COURSE, priceRupees=0, autoPublish=True)
    c_resp = await client.post("/v1/courses", json=course_data, headers=auth(teacher))
    course_id = c_resp.json()["id"]

    # Student enrolls
    enroll_resp = await client.post(f"/v1/courses/{course_id}/enroll", json={"useCoins": False}, headers=auth(farmer))
    assert enroll_resp.status_code == 200
    assert enroll_resp.json()["enrolled"] is True

    # Student enters classroom
    learn_resp = await client.get(f"/v1/courses/{course_id}/learn", headers=auth(farmer))
    assert learn_resp.status_code == 200
    learn_data = learn_resp.json()
    assert learn_data["userProgress"]["progressPercent"] == 0
    assert learn_data["userProgress"]["isCompleted"] is False

    # Complete lesson 1 (50% progress)
    prog1 = await client.post(
        f"/v1/courses/{course_id}/lessons/les-1/progress",
        json={"completed": True},
        headers=auth(farmer),
    )
    assert prog1.status_code == 200
    assert prog1.json()["progressPercent"] == 50.0
    assert prog1.json()["isCompleted"] is False

    # Complete lesson 2 (100% progress -> certificate generated)
    prog2 = await client.post(
        f"/v1/courses/{course_id}/lessons/les-2/progress",
        json={"completed": True},
        headers=auth(farmer),
    )
    assert prog2.status_code == 200
    assert prog2.json()["progressPercent"] == 100.0
    assert prog2.json()["isCompleted"] is True
    assert prog2.json()["certificateId"] is not None

    # Retrieve certificate
    cert_resp = await client.get(f"/v1/courses/{course_id}/certificate", headers=auth(farmer))
    assert cert_resp.status_code == 200
    cert = cert_resp.json()
    assert cert["studentName"] == "Kisan Ram"
    assert cert["certificateId"] == prog2.json()["certificateId"]
    assert "agrovercity.com/verify/cert" in cert["verificationUrl"]

    # Verify my-learning endpoint
    my_learning = await client.get("/v1/courses/my-learning", headers=auth(farmer))
    assert my_learning.status_code == 200
    assert my_learning.json()["total"] == 1
    assert my_learning.json()["data"][0]["isCompleted"] is True


async def test_reviews_and_questions(client, user_store):
    teacher = _instructor_token(user_store)
    farmer = seed_user(user_store, uid="uid-farmer-reviewer", name="Mohan Lal")
    c_resp = await client.post(
        "/v1/courses",
        json=dict(SUPERSTORE_COURSE, priceRupees=0, autoPublish=True),
        headers=auth(teacher),
    )
    course_id = c_resp.json()["id"]

    # Submit review
    rev_resp = await client.post(
        f"/v1/courses/{course_id}/reviews",
        json={"rating": 5, "reviewText": "Excellent practical hydroponics training!"},
        headers=auth(farmer),
    )
    assert rev_resp.status_code == 201

    reviews_list = await client.get(f"/v1/courses/{course_id}/reviews", headers=auth(farmer))
    assert reviews_list.json()["total"] == 1
    assert reviews_list.json()["data"][0]["rating"] == 5

    # Ask question
    q_resp = await client.post(
        f"/v1/courses/{course_id}/questions",
        json={"question": "What is the ideal pH for strawberry hydroponics?"},
        headers=auth(farmer),
    )
    assert q_resp.status_code == 201
    q_id = q_resp.json()["id"]

    # Teacher answers
    ans_resp = await client.post(
        f"/v1/courses/{course_id}/questions/{q_id}/answers",
        json={"answer": "Keep the pH between 5.5 and 6.2 for optimal nutrient uptake."},
        headers=auth(teacher),
    )
    assert ans_resp.status_code == 201
    assert ans_resp.json()["isInstructor"] is True

    # List questions
    q_list = await client.get(f"/v1/courses/{course_id}/questions", headers=auth(farmer))
    assert q_list.json()["total"] == 1
    assert len(q_list.json()["data"][0]["answers"]) == 1


async def test_teacher_profile_and_management(client, user_store):
    teacher = _instructor_token(user_store)

    # Get own teacher profile
    prof_resp = await client.get("/v1/teachers/me", headers=auth(teacher))
    assert prof_resp.status_code == 200
    assert prof_resp.json()["isVerified"] is True

    # Update teacher profile
    upd_resp = await client.put(
        "/v1/teachers/me",
        json={
            "headline": "Lead Agronomy Scientist & Commercial Greenhouse Specialist",
            "experienceYears": 25,
            "institution": "ICAR New Delhi",
        },
        headers=auth(teacher),
    )
    assert upd_resp.status_code == 200
    assert upd_resp.json()["experienceYears"] == 25

    # Get public profile
    pub_resp = await client.get("/v1/teachers/uid-teacher-1")
    assert pub_resp.status_code == 200
    assert pub_resp.json()["name"] == "Dr. Radheshyam Patel"
    assert "bankAccountNumber" not in pub_resp.json()


async def test_teacher_student_management_and_analytics(client, user_store):
    teacher = _instructor_token(user_store)
    farmer = seed_user(user_store, uid="uid-farmer-managed", name="Suresh Patil", phone="+919811122233")

    # Create free course
    c_resp = await client.post(
        "/v1/courses",
        json=dict(SUPERSTORE_COURSE, priceRupees=0, autoPublish=True),
        headers=auth(teacher),
    )
    course_id = c_resp.json()["id"]

    # Student enrolls
    await client.post(f"/v1/courses/{course_id}/enroll", json={"useCoins": False}, headers=auth(farmer))

    # Teacher checks enrolled students
    students_resp = await client.get("/v1/teachers/students", headers=auth(teacher))
    assert students_resp.status_code == 200
    assert students_resp.json()["total"] == 1
    assert students_resp.json()["data"][0]["studentName"] == "Suresh Patil"

    # Teacher manually issues certificate
    cert_issue = await client.post(
        f"/v1/teachers/courses/{course_id}/students/uid-farmer-managed/certificate",
        json={"customNote": "Approved with distinction based on offline field evaluation."},
        headers=auth(teacher),
    )
    assert cert_issue.status_code == 200
    assert cert_issue.json()["certificateId"] is not None

    # Teacher sends course announcement
    ann_resp = await client.post(
        f"/v1/teachers/courses/{course_id}/announcements",
        json={
            "title": "Live Q&A Session Tomorrow at 6 PM",
            "message": "Join us live on the app to discuss nutrient deficiency troubleshooting.",
        },
        headers=auth(teacher),
    )
    assert ann_resp.status_code == 201
    assert ann_resp.json()["title"] == "Live Q&A Session Tomorrow at 6 PM"

    # Teacher views analytics
    analytics_resp = await client.get("/v1/teachers/analytics", headers=auth(teacher))
    assert analytics_resp.status_code == 200
    analytics = analytics_resp.json()
    assert analytics["totalCourses"] >= 1
    assert analytics["totalStudents"] >= 1
    assert analytics["completedStudents"] >= 1


async def test_platform_advertisements_lifecycle(client, user_store):
    teacher = _instructor_token(user_store)

    # 1. Create Ad Campaign
    ad_data = {
        "title": "Summer Hydroponics Special",
        "headline": "⚡ 50% OFF: Learn Modern Hydroponics",
        "description": "Practical setup guide with 100% money back guarantee.",
        "bannerUrl": "https://example.com/banner.jpg",
        "ctaText": "Enroll Now",
        "placement": "course_banner",
        "targetType": "course",
        "targetId": "gs-course-1",
        "budgetRupees": 2000.0,
        "dailyBudgetRupees": 100.0,
    }
    create_resp = await client.post("/v1/ads", json=ad_data, headers=auth(teacher))
    assert create_resp.status_code == 201
    ad = create_resp.json()
    ad_id = ad["id"]
    assert ad["headline"] == ad_data["headline"]
    assert ad["status"] == "active"

    # 2. Public Active Ads Endpoint
    active_resp = await client.get("/v1/ads/active?placement=course_banner")
    assert active_resp.status_code == 200
    assert any(a["id"] == ad_id for a in active_resp.json()["data"])

    # 3. Track Impression
    imp_resp = await client.post(f"/v1/ads/{ad_id}/impression")
    assert imp_resp.status_code == 200
    assert imp_resp.json()["impressions"] == 1

    # 4. Track Click
    clk_resp = await client.post(f"/v1/ads/{ad_id}/click")
    assert clk_resp.status_code == 200
    assert clk_resp.json()["clicks"] == 1

    # 5. Teacher lists campaigns and views analytics
    mine_resp = await client.get("/v1/ads/mine", headers=auth(teacher))
    assert mine_resp.status_code == 200
    assert mine_resp.json()["total"] >= 1
    assert mine_resp.json()["summary"]["totalImpressions"] >= 1

    # 6. Detailed Analytics
    analytics_resp = await client.get(f"/v1/ads/{ad_id}/analytics", headers=auth(teacher))
    assert analytics_resp.status_code == 200
    assert analytics_resp.json()["clicks"] == 1
    assert analytics_resp.json()["ctrPercent"] == 100.0

    # 7. Pause campaign
    pause_resp = await client.put(f"/v1/ads/{ad_id}", json={"status": "paused"}, headers=auth(teacher))
    assert pause_resp.status_code == 200
    assert pause_resp.json()["status"] == "paused"

    # 8. Delete campaign
    del_resp = await client.delete(f"/v1/ads/{ad_id}", headers=auth(teacher))
    assert del_resp.status_code == 204
