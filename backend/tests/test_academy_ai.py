"""M20 course-intelligence AI tests (phase-04 WS-06).

Covers the learner catalog recommendations (`courses.recommend.v1`):
(1) golden-fixture replay of the deterministic crop-category ordering;
(2) shim round-trip — identical response shape with a 24h Redis cache hit on
    the second call (the gateway is not re-invoked);
(3) gateway outage -> deterministic `fallback_fn` ordering with `source`;
(4) module flag off -> identical response shape, no AI ranking.
"""
import json
import os

import pytest

from app.core.config import settings
from app.services import academy_ai
from app.services.ai import config_store, gateway
from tests.test_diary import auth, seed_user
from tests.test_orders import razorpay, rzp_signature  # noqa: F401

FIXTURE_DIR = os.path.join(os.path.dirname(__file__), "fixtures", "ai", "golden")
GOLDEN_PATH = os.path.join(FIXTURE_DIR, "courses.recommend.v1.jsonl")


@pytest.fixture(autouse=True)
def _shim_mode(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "shim")
    config_store.clear_cache()
    yield
    config_store.clear_cache()


@pytest.fixture
def rec_cache(monkeypatch, fake_redis):
    """Route the repo's Redis cache helpers at the in-memory fake."""
    async def _get_redis():
        return fake_redis

    monkeypatch.setattr("app.core.cache.get_redis", _get_redis)
    return fake_redis


def _seed_course(
    user_store,
    course_id,
    *,
    category="Tomato",
    created_at="2026-03-01T00:00:00+00:00",
    sales=0,
    title=None,
):
    user_store[f"courses/{course_id}"] = {
        "id": course_id,
        "instructorId": "uid-instructor",
        "title": title or f"{category} for farmers",
        "category": category,
        "level": "beginner",
        "language": "hi",
        "status": "published",
        "priceRupees": 0,
        "coinsDiscountAllowed": 0,
        "salesCount": sales,
        "createdAt": created_at,
    }


def _ids(body):
    return [row["courseId"] for row in body["data"]]


def _golden_records():
    with open(GOLDEN_PATH, encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


# --------------------------------------------------------------------------- #
# (1) Golden fixture — deterministic crop-category ordering
# --------------------------------------------------------------------------- #


def test_golden_fixture_exists_and_schema_valid():
    assert os.path.exists(GOLDEN_PATH), f"Golden fixture missing at {GOLDEN_PATH}"
    records = _golden_records()
    assert len(records) >= 3
    for record in records:
        assert record["state"]["courses"]
        assert record["expected"]["recommendations"]
        for rec in record["expected"]["recommendations"]:
            assert set(rec.keys()) == {"courseId", "relevance", "badges"}


async def test_golden_fixture_replay_on_shim(client):
    for record in _golden_records():
        decision = await gateway.decide(
            record["state"], "courses.recommend.v1", module="courses_recommend"
        )
        assert decision.answers["recommendations"] == record["expected"]["recommendations"]

    # (a) crop match scores high relevance; (b) no match scores low relevance.
    high = next(r for r in _golden_records() if r["id"] == "crop-match-high")
    low = next(r for r in _golden_records() if r["id"] == "no-crop-match-low")
    assert high["expected"]["recommendations"][0]["relevance"] == 0.9
    assert all(r["relevance"] == 0.3 for r in low["expected"]["recommendations"])


# --------------------------------------------------------------------------- #
# (2) shim round-trip + 24h cache hit
# --------------------------------------------------------------------------- #


async def test_shim_recommendations_shape_and_24h_cache(
    client, user_store, rec_cache, monkeypatch
):
    farmer = seed_user(user_store, uid="uid-farmer", crops=["Tomato"])
    _seed_course(user_store, "crs-tomato-1", category="Tomato", sales=3)
    _seed_course(
        user_store, "crs-wheat-1", category="Wheat",
        created_at="2026-05-01T00:00:00+00:00", sales=9,
    )

    calls = {"n": 0}
    real_decide = gateway.decide

    async def counting_decide(*args, **kwargs):
        calls["n"] += 1
        return await real_decide(*args, **kwargs)

    monkeypatch.setattr("app.services.ai.gateway.decide", counting_decide)

    first = await client.get("/v1/courses/recommendations", headers=auth(farmer))
    assert first.status_code == 200
    body = first.json()
    assert set(body.keys()) == {"data", "source"}
    # shim produces no model ranking — the deterministic ordering renders instead.
    assert body["source"] == "fallback"
    assert _ids(body) == ["crs-tomato-1", "crs-wheat-1"]
    assert body["data"][0]["badges"] == ["matches_your_crops"]
    assert calls["n"] == 1

    second = await client.get("/v1/courses/recommendations", headers=auth(farmer))
    assert second.status_code == 200
    assert second.json() == body
    assert calls["n"] == 1  # 24h cache hit — gateway not re-invoked

    assert await rec_cache.get("ai:courses_recommend:uid-farmer") is not None
    ttl = await rec_cache.ttl("ai:courses_recommend:uid-farmer")
    assert 0 < ttl <= 86400


# --------------------------------------------------------------------------- #
# (3) gateway outage -> fallback_fn ordering
# --------------------------------------------------------------------------- #


async def test_recommendations_fallback_when_gateway_raises(
    client, user_store, rec_cache, monkeypatch
):
    farmer = seed_user(user_store, uid="uid-farmer", crops=["Tomato"])
    _seed_course(user_store, "crs-tomato-1", category="Tomato", sales=3)
    _seed_course(user_store, "crs-wheat-1", category="Wheat", sales=9)

    async def boom(*args, **kwargs):
        raise RuntimeError("AI gateway unavailable")

    monkeypatch.setattr("app.services.ai.gateway.decide", boom)

    resp = await client.get("/v1/courses/recommendations", headers=auth(farmer))
    assert resp.status_code == 200
    body = resp.json()
    assert body["source"] == "fallback"
    assert _ids(body) == ["crs-tomato-1", "crs-wheat-1"]  # crop match first


# --------------------------------------------------------------------------- #
# (4) module flag off -> identical shape, no AI
# --------------------------------------------------------------------------- #


async def test_recommendations_flag_off(client, user_store, rec_cache):
    farmer = seed_user(user_store, uid="uid-farmer", crops=["Tomato"])
    _seed_course(user_store, "crs-tomato-1", category="Tomato", sales=3)
    _seed_course(user_store, "crs-wheat-1", category="Wheat", sales=9)

    user_store["platform_config/ai"] = {
        "modules": {"courses_recommend": False},
        "thresholds": {"courses.recommend.v1": 0.75},
        "automation": {"courses.recommend.v1": "suggest"},
    }
    config_store.clear_cache()

    resp = await client.get("/v1/courses/recommendations", headers=auth(farmer))
    assert resp.status_code == 200
    body = resp.json()
    assert set(body.keys()) == {"data", "source"}
    assert body["source"] == "fallback"
    assert _ids(body) == ["crs-tomato-1", "crs-wheat-1"]


# --------------------------------------------------------------------------- #
# (5) Objective auto-grading rubric (SGR) — prefill only, instructor confirm
# --------------------------------------------------------------------------- #
def _seed_submitted_assignment(user_store, instructor_id, assignment_id="asg-sub-1"):
    user_store[f"course_assignments/{assignment_id}"] = {
        "id": assignment_id,
        "instructorId": instructor_id,
        "courseTitle": "Precision Drone Spraying",
        "studentName": "Kishor Mahajan",
        "studentId": "std-1",
        "title": "Field Spray Log & Nozzle Calibration Checklist",
        "notes": "Completed a 2-acre spray demo with TeeJet nozzles.",
        "evidencePhotoUrls": ["https://example.com/evidence.jpg"],
        "rubric": {"fieldTechnique": "Proficient", "safetyProtocol": "Exemplary"},
        "status": "submitted",
        "submittedAt": "2026-10-01T00:00:00+00:00",
    }
    return assignment_id


async def test_rubric_suggestion_is_stored_as_prefill(client, user_store, monkeypatch):
    """(a) well-formed model output -> suggestion stored with a decision_id."""
    instructor = seed_user(user_store, uid="teacher-ai", active_profile="instructor")
    _seed_submitted_assignment(user_store, "teacher-ai")

    well_formed = json.dumps(
        {
            "items": [
                {"questionId": "fieldTechnique", "score": 8, "maxScore": 10, "feedbackKey": "solid"},
                {"questionId": "safetyProtocol", "score": 5, "maxScore": 5, "feedbackKey": "exemplary"},
            ],
            "overallFeedbackKey": "Great practical work",
        }
    )
    calls = {"n": 0}

    async def fake_generate(prompt, opts=None):
        calls["n"] += 1
        return well_formed

    monkeypatch.setattr("app.services.ai.gateway.generate", fake_generate)

    resp = await client.get("/v1/teachers/assignments", headers=auth(instructor))
    assert resp.status_code == 200
    assert calls["n"] == 1
    row = resp.json()["data"][0]
    suggestion = row["aiSuggestion"]
    assert suggestion["decision_id"].startswith("dec_")
    assert suggestion["rubric"]["items"][0]["score"] == 8
    assert suggestion["suggestedScorePct"] == 87

    stored = user_store["course_assignments/asg-sub-1"]
    assert stored["aiSuggestion"]["decision_id"] == suggestion["decision_id"]
    assert "grade" not in stored  # prefill only — nothing auto-published

    # The explicit instructor grade endpoint still publishes the final grade.
    graded = await client.post(
        "/v1/teachers/assignments/asg-sub-1/grade",
        json={"grade": "A", "feedback": "Confirmed", "passed": True},
        headers=auth(instructor),
    )
    assert graded.status_code == 200
    assert graded.json()["grade"] == "A"


async def test_rubric_malformed_output_repairs_then_falls_back(client, user_store, monkeypatch):
    """(b) malformed output -> one repair retry -> still malformed -> no suggestion."""
    instructor = seed_user(user_store, uid="teacher-ai", active_profile="instructor")
    _seed_submitted_assignment(user_store, "teacher-ai")

    # Missing `maxScore` — fails the strict Pydantic validation every time.
    malformed = json.dumps(
        {
            "items": [{"questionId": "fieldTechnique", "score": 8, "feedbackKey": "x"}],
            "overallFeedbackKey": "x",
        }
    )
    calls = {"n": 0}

    async def fake_generate(prompt, opts=None):
        calls["n"] += 1
        return malformed

    monkeypatch.setattr("app.services.ai.gateway.generate", fake_generate)

    resp = await client.get("/v1/teachers/assignments", headers=auth(instructor))
    assert resp.status_code == 200
    assert calls["n"] == 2  # first attempt + exactly one repair retry
    row = resp.json()["data"][0]
    assert "aiSuggestion" not in row
    assert "aiSuggestion" not in user_store["course_assignments/asg-sub-1"]


async def test_rubric_flag_off_no_gateway_call_and_grade_still_works(client, user_store, monkeypatch):
    """(c) module flag off -> no gateway call, no suggestion, grading unaffected."""
    instructor = seed_user(user_store, uid="teacher-ai", active_profile="instructor")
    _seed_submitted_assignment(user_store, "teacher-ai")

    user_store["platform_config/ai"] = {"modules": {"courses_autograde": False}}
    config_store.clear_cache()

    calls = {"n": 0}

    async def fake_generate(prompt, opts=None):
        calls["n"] += 1
        return "{}"

    monkeypatch.setattr("app.services.ai.gateway.generate", fake_generate)

    resp = await client.get("/v1/teachers/assignments", headers=auth(instructor))
    assert resp.status_code == 200
    assert calls["n"] == 0
    assert "aiSuggestion" not in resp.json()["data"][0]

    graded = await client.post(
        "/v1/teachers/assignments/asg-sub-1/grade",
        json={"grade": "B", "feedback": "", "passed": True},
        headers=auth(instructor),
    )
    assert graded.status_code == 200
    assert graded.json()["grade"] == "B"


# --------------------------------------------------------------------------- #
# (6) Learning-path suggestion on certificate issue (C20)
# --------------------------------------------------------------------------- #
def _seed_paid_purchase(user_store, uid, course_id, instructor_id, title="Certified course"):
    user_store[f"course_purchases/{uid}_{course_id}"] = {
        "id": f"{uid}_{course_id}",
        "userId": uid,
        "studentName": "Ram Patil",
        "courseId": course_id,
        "courseTitle": title,
        "instructorId": instructor_id,
        "status": "paid",
        "progressPercent": 0,
        "completedLessonIds": [],
        "isCompleted": False,
        "certificateId": None,
        "createdAt": "2026-10-01T00:00:00+00:00",
        "paidAt": "2026-10-01T00:00:00+00:00",
    }


def _decisions(user_store):
    return [doc for key, doc in user_store.items() if key.startswith("ai_decisions/")]


def _seed_catalog(user_store):
    _seed_course(user_store, "crs-done", category="Pest Management", sales=1)
    _seed_course(user_store, "crs-next", category="Pest Management", sales=50)
    _seed_course(user_store, "crs-other", category="Organic Farming", sales=500)


async def test_learning_path_after_certificate_and_cache(client, user_store, rec_cache):
    instructor = seed_user(user_store, uid="teacher-ai", active_profile="instructor")
    seed_user(user_store, uid="uid-farmer", crops=["Pest Management"])
    _seed_catalog(user_store)
    _seed_paid_purchase(user_store, "uid-farmer", "crs-done", "teacher-ai")

    resp = await client.post(
        "/v1/teachers/courses/crs-done/students/uid-farmer/certificate",
        json={},
        headers=auth(instructor),
    )
    assert resp.status_code == 200
    cert_id = resp.json()["certificateId"]

    purchase = user_store["course_purchases/uid-farmer_crs-done"]
    assert purchase["learningPath"]["courseIds"] == ["crs-next"]
    assert purchase["learningPath"]["source"] == "fallback"

    decisions = [d for d in _decisions(user_store) if d.get("questionSetId") == "courses.recommend.v1"]
    assert decisions  # an ai_decisions doc was written for the learning path

    # Second call -> cached: no new ai_decisions doc.
    before = len(_decisions(user_store))
    again = await academy_ai.suggest_learning_path("uid-farmer", cert_id)
    assert again == {"courseIds": ["crs-next"], "source": "fallback"}
    assert len(_decisions(user_store)) == before


async def test_learning_path_fallback_when_gateway_raises(client, user_store, rec_cache, monkeypatch):
    instructor = seed_user(user_store, uid="teacher-ai", active_profile="instructor")
    seed_user(user_store, uid="uid-farmer", crops=["Pest Management"])
    _seed_catalog(user_store)
    _seed_paid_purchase(user_store, "uid-farmer", "crs-done", "teacher-ai")

    async def boom(*args, **kwargs):
        raise RuntimeError("AI gateway unavailable")

    monkeypatch.setattr("app.services.ai.gateway.decide", boom)

    resp = await client.post(
        "/v1/teachers/courses/crs-done/students/uid-farmer/certificate",
        json={},
        headers=auth(instructor),
    )
    assert resp.status_code == 200
    learning_path = user_store["course_purchases/uid-farmer_crs-done"]["learningPath"]
    assert learning_path["source"] == "fallback"
    # The category's most-sold course (excluding the one just certified).
    assert learning_path["courseIds"] == ["crs-next"]


# --------------------------------------------------------------------------- #
# (7) ai_decisions logging (cost + confidence) + outcome hooks — task 6.13
# --------------------------------------------------------------------------- #
def _decision_docs(user_store, question_set_id=None):
    docs = [doc for key, doc in user_store.items() if key.startswith("ai_decisions/")]
    if question_set_id:
        docs = [doc for doc in docs if doc.get("questionSetId") == question_set_id]
    return docs


def _outcome_docs(user_store, outcome=None):
    docs = [doc for key, doc in user_store.items() if key.startswith("ai_outcomes/")]
    if outcome:
        docs = [doc for doc in docs if doc.get("outcome") == outcome]
    return docs


async def test_all_features_log_ai_decisions_with_cost_and_confidence(
    client, user_store, rec_cache, monkeypatch
):
    """Recommendations, auto-grading and learning-path each write an
    `ai_decisions` doc carrying cost + confidence (global rule 11)."""
    instructor = seed_user(user_store, uid="teacher-ai", active_profile="instructor")
    farmer = seed_user(user_store, uid="uid-farmer", crops=["Pest Management"])
    _seed_course(user_store, "crs-done", category="Pest Management", sales=1)
    _seed_course(user_store, "crs-next", category="Pest Management", sales=50)
    _seed_paid_purchase(user_store, "uid-farmer", "crs-done", "teacher-ai")

    # 1. Learner catalog recommendations.
    rec = await client.get("/v1/courses/recommendations", headers=auth(farmer))
    assert rec.status_code == 200

    # 2. Objective assignment auto-grade suggestion (well-formed shim output).
    _seed_submitted_assignment(user_store, "teacher-ai")
    well_formed = json.dumps(
        {
            "items": [
                {"questionId": "fieldTechnique", "score": 8, "maxScore": 10, "feedbackKey": "solid"}
            ],
            "overallFeedbackKey": "good",
        }
    )

    async def fake_generate(prompt, opts=None):
        return well_formed

    monkeypatch.setattr("app.services.ai.gateway.generate", fake_generate)
    assignments = await client.get("/v1/teachers/assignments", headers=auth(instructor))
    assert assignments.status_code == 200
    assert assignments.json()["data"][0]["aiSuggestion"]["decision_id"].startswith("dec_")

    # 3. Learning-path suggestion on certificate issue.
    cert = await client.post(
        "/v1/teachers/courses/crs-done/students/uid-farmer/certificate",
        json={},
        headers=auth(instructor),
    )
    assert cert.status_code == 200

    for question_set_id in ("courses.recommend.v1", "courses.grade_suggest.v1"):
        docs = _decision_docs(user_store, question_set_id)
        assert docs, f"no ai_decisions doc written for {question_set_id}"
        for doc in docs:
            assert "costUsd" in doc
            assert "confidence" in doc


async def test_decisions_outcome_hooks_recorded_for_recommendation_and_grade(
    client, user_store, rec_cache, razorpay
):
    """A purchase of a recommended course and an instructor-confirmed grade each
    write their `ai_outcomes` linkage (task 6.13)."""
    instructor = seed_user(user_store, uid="teacher-ai", active_profile="instructor")
    farmer = seed_user(user_store, uid="uid-farmer", crops=["Pest Management"])
    _seed_course(user_store, "crs-next", category="Pest Management", sales=50)
    user_store["courses/crs-next"]["priceRupees"] = 1000

    # Recommendations load first so crs-next is cached as a recommended id.
    rec = await client.get("/v1/courses/recommendations", headers=auth(farmer))
    assert rec.status_code == 200
    assert "crs-next" in [row["courseId"] for row in rec.json()["data"]]

    enroll = await client.post(
        "/v1/courses/crs-next/enroll",
        json={"useCoins": False, "coinsToRedeem": 0},
        headers=auth(farmer),
    )
    assert enroll.status_code == 200
    order_id = enroll.json()["paymentOrderId"]
    assert order_id
    payment_id = "pay_rec_1"
    verify = await client.post(
        "/v1/courses/purchases/verify",
        json={
            "razorpayOrderId": order_id,
            "razorpayPaymentId": payment_id,
            "razorpaySignature": rzp_signature(order_id, payment_id),
        },
        headers=auth(farmer),
    )
    assert verify.status_code == 200
    assert _outcome_docs(user_store, "purchase_after_recommendation")

    # An instructor-confirmed grade for an assignment carrying an AI suggestion.
    _seed_submitted_assignment(user_store, "teacher-ai")
    user_store["course_assignments/asg-sub-1"]["aiSuggestion"] = {
        "suggestedScorePct": 87,
        "decision_id": "dec_test_1",
        "rubric": {"items": [], "overallFeedbackKey": "ok"},
    }
    graded = await client.post(
        "/v1/teachers/assignments/asg-sub-1/grade",
        json={"grade": "A", "feedback": "Confirmed", "passed": True},
        headers=auth(instructor),
    )
    assert graded.status_code == 200
    assert _outcome_docs(user_store, "grade_delta_vs_suggestion")
