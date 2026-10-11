"""WS-01 tasks 1.44 + 1.45 — post-registration dashboard seeding.

Registers a user (Firebase-token mocking pattern from tests.test_users) and
asserts, under AI_PROVIDER=shim: the user doc carries the seeded M21 scheme
matches + M20 starter course, and one `kyc_document_checklist` task per
required document of the chosen personas (none for vault-uploaded docs).
"""
from app.services import onboarding_seed
from tests.test_users import REGISTER_BODY


def _seed_catalog(user_store):
    user_store["schemes/scheme-pmkisan"] = {
        "id": "scheme-pmkisan",
        "name": "PM-KISAN",
        "category": "income_support",
        "eligibilityRules": {},
        "documentsRequired": ["Aadhaar", "Bank Passbook"],
        "status": "active",
        "nextDeadline": "2026-12-31",
        "benefitAmount": "₹6,000/year",
        "description": "Income support for landholding farmers.",
    }
    user_store["schemes/scheme-soilhealth"] = {
        "id": "scheme-soilhealth",
        "name": "Soil Health Card Scheme",
        "category": "soil_health",
        "eligibilityRules": {},
        "documentsRequired": ["Aadhaar"],
        "status": "active",
        "nextDeadline": "2027-03-31",
        "benefitAmount": "Free soil testing",
        "description": "Free soil testing and health cards.",
    }
    user_store["courses/course-1"] = {
        "id": "course-1",
        "title": "Scientific Onion Cultivation",
        "category": "onion",
        "level": "beginner",
        "status": "published",
        "salesCount": 10,
        "createdAt": "2026-09-01T00:00:00+00:00",
    }


async def _register(client, **overrides):
    body = {**REGISTER_BODY, **overrides}
    return await client.post("/v1/auth/register", json=body)


def _kyc_tasks(user_store, uid="uid-1"):
    return [
        doc
        for key, doc in user_store.items()
        if key.startswith("tasks/") and doc.get("kind") == "kyc_document_checklist"
    ]


async def test_register_seeds_scheme_matches_and_starter_course(client, user_store):
    _seed_catalog(user_store)
    resp = await _register(client)
    assert resp.status_code == 200

    user = user_store["users/uid-1"]
    matches = user["onboarding"]["schemesMatches"]
    assert 0 < len(matches) <= onboarding_seed.MAX_SEEDED_SCHEME_MATCHES
    assert {row["schemeId"] for row in matches} == {"scheme-pmkisan", "scheme-soilhealth"}
    for row in matches:
        assert row["name"]
        assert row["eligible"] is True
        assert isinstance(row["fit"], float)
    # Eligible schemes with fewer missing docs sort first (PM-KISAN has 2
    # required docs vs 1 for Soil Health Card).
    assert matches[0]["schemeId"] == "scheme-soilhealth"

    starter = user["onboarding"]["starterCourse"]
    assert starter["courseId"] == "course-1"
    assert starter["source"] in ("shim", "fallback")


async def test_register_emits_kyc_checklist_task_per_required_doc(client, user_store):
    resp = await _register(client, profiles=["farmer", "seller"], primaryProfile="farmer")
    assert resp.status_code == 200

    tasks = _kyc_tasks(user_store)
    # farmer: aadhaar+pan+bank; seller: aadhaar+pan+bank+apmc_licence+gst —
    # the base docs dedupe across personas (one task per document).
    assert {task["sourceId"] for task in tasks} == {
        "aadhaar",
        "pan",
        "bank",
        "apmc_licence",
        "gst",
    }
    for task in tasks:
        assert task["userId"] == "uid-1"
        assert task["module"] == "kyc"
        assert task["kind"] == "kyc_document_checklist"
        assert task["priority"] == "upcoming"
        assert task["status"] == "open"
        assert task["deepLink"] == f"/dashboard/profile?section=kyc&docType={task['sourceId']}"
        assert task["title"]["en"]
        assert task["title"]["hi"]
        assert task["dedupeKey"] == f"uid-1:kyc:kyc_document_checklist:{task['sourceId']}"


async def test_register_kyc_tasks_skip_vault_uploaded_docs(client, user_store):
    user_store["users/uid-1/vault_documents/vd-1"] = {
        "id": "vd-1",
        "docType": "aadhaar",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    resp = await _register(client, profiles=["farmer"], primaryProfile="farmer")
    assert resp.status_code == 200

    source_ids = {task["sourceId"] for task in _kyc_tasks(user_store)}
    assert "aadhaar" not in source_ids
    assert source_ids == {"pan", "bank"}


async def test_register_seeding_is_idempotent(client, user_store):
    assert (await _register(client)).status_code == 200
    first_count = len(_kyc_tasks(user_store))
    assert first_count > 0

    assert (await _register(client)).status_code == 200
    assert len(_kyc_tasks(user_store)) == first_count


async def test_register_seeding_never_fails_registration(client, user_store, monkeypatch):
    async def _boom(*args, **kwargs):
        raise RuntimeError("ai provider down")

    monkeypatch.setattr(onboarding_seed, "match_schemes", _boom)
    monkeypatch.setattr(onboarding_seed.academy_ai, "recommend_courses", _boom)

    resp = await _register(client, profiles=["farmer"], primaryProfile="farmer")
    assert resp.status_code == 200
    # The KYC checklist section still ran despite both AI sections failing.
    assert {task["sourceId"] for task in _kyc_tasks(user_store)} == {
        "aadhaar",
        "pan",
        "bank",
    }


async def test_persona_setup_seeds_dashboard_for_new_personas(client, user_store):
    _seed_catalog(user_store)
    resp = await _register(client, profiles=[], primaryProfile="")
    assert resp.status_code == 200
    token = resp.json()["accessToken"]
    assert "onboarding" not in user_store["users/uid-1"]

    resp = await client.put(
        "/v1/users/me/persona-setup",
        json={"profiles": ["farmer"], "primaryProfile": "farmer"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200

    user = user_store["users/uid-1"]
    assert user["onboarding"]["starterCourse"]["courseId"] == "course-1"
    assert {row["schemeId"] for row in user["onboarding"]["schemesMatches"]} == {
        "scheme-pmkisan",
        "scheme-soilhealth",
    }
    assert {task["sourceId"] for task in _kyc_tasks(user_store)} == {
        "aadhaar",
        "pan",
        "bank",
    }
