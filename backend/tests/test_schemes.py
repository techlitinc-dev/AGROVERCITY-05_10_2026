from app.data.schemes_seed import SCHEMES
from app.services.eligibility import is_eligible
from tests.test_diary import auth, seed_user

from datetime import date, timedelta


def _seed_schemes(user_store):
    for scheme in SCHEMES:
        user_store[f"schemes/{scheme['id']}"] = scheme


def _farmer(user_store, **overrides):
    return seed_user(user_store, landAreaAcres=5, state="Maharashtra", **overrides)


async def test_eligible_only_filters(client, user_store):
    _seed_schemes(user_store)
    token = _farmer(user_store)
    resp = await client.get("/v1/schemes?eligibleOnly=true", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] > 0
    assert all(item["eligible"] is True for item in body["data"])
    ids = {item["id"] for item in body["data"]}
    assert "pm-kusum" not in ids
    assert "pmksy-drip" not in ids
    assert "eligibilityRules" not in body["data"][0]


async def test_eligibility_service_units():
    user = {"landAreaAcres": 5, "state": "Maharashtra", "kccLimit": 0}
    assert is_eligible(user, {"maxLandAcres": 4}) is False
    assert is_eligible(user, {"maxLandAcres": 10}) is True
    assert is_eligible(user, {"states": ["Gujarat"]}) is False
    assert is_eligible(user, {"states": []}) is True
    assert is_eligible(user, {"requiresKcc": True}) is False
    assert is_eligible(user, {}) is True
    assert is_eligible(user, {"unknownFutureRule": "x"}) is True


async def test_apply_creates_application(client, user_store):
    _seed_schemes(user_store)
    token = _farmer(user_store)
    resp = await client.post("/v1/schemes/pm-kisan/apply", json={}, headers=auth(token))
    assert resp.status_code == 201
    assert resp.json() == {"applicationId": "pm-kisan", "status": "submitted"}
    app_doc = user_store["users/uid-1/scheme_applications/pm-kisan"]
    assert app_doc["status"] == "submitted"


async def test_apply_twice_409(client, user_store):
    _seed_schemes(user_store)
    token = _farmer(user_store)
    await client.post("/v1/schemes/pm-kisan/apply", json={}, headers=auth(token))
    resp = await client.post("/v1/schemes/pm-kisan/apply", json={}, headers=auth(token))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "ALREADY_APPLIED"


async def test_apply_bad_document_400(client, user_store):
    _seed_schemes(user_store)
    token = _farmer(user_store)
    resp = await client.post(
        "/v1/schemes/pm-kisan/apply", json={"documentIds": ["nope"]}, headers=auth(token)
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "INVALID_DOCUMENT_ID"


async def test_portals_five_https(client, user_store):
    token = _farmer(user_store)
    resp = await client.get("/v1/schemes/portals", headers=auth(token))
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 5
    assert all(p["portalUrl"].startswith("https://") for p in data)


def _scheme(scheme_id: str, name: str, deadline: str) -> dict:
    return {
        "id": scheme_id,
        "name": name,
        "category": "x",
        "benefitAmount": "₹1",
        "documentsRequired": [],
        "status": "open",
        "nextDeadline": deadline,
        "description": "d",
        "eligibilityRules": {},
    }


async def test_deadline_reminder_emits_only_within_window(client, user_store):
    soon = (date.today() + timedelta(days=10)).isoformat()
    later = (date.today() + timedelta(days=90)).isoformat()
    user_store["schemes/soon"] = _scheme("soon", "Soon Scheme", soon)
    user_store["schemes/later"] = _scheme("later", "Later Scheme", later)
    user_store["schemes/past"] = _scheme(
        "past", "Past Scheme", (date.today() - timedelta(days=1)).isoformat()
    )
    token = _farmer(user_store)

    resp = await client.post("/v1/schemes/deadline-reminders", headers=auth(token))
    assert resp.status_code == 200
    assert len(resp.json()["data"]["emitted"]) == 1

    tasks = [doc for key, doc in user_store.items() if key.startswith("tasks/")]
    assert len(tasks) == 1
    assert tasks[0]["sourceId"] == "soon"
    assert tasks[0]["module"] == "schemes"
    assert tasks[0]["deepLink"] == "/dashboard/p/schemes/soon"

    # Replaying is idempotent (dedupe-safe emission).
    await client.post("/v1/schemes/deadline-reminders", headers=auth(token))
    tasks_again = [doc for key, doc in user_store.items() if key.startswith("tasks/")]
    assert len(tasks_again) == 1


async def test_scheme_detail_checklist_and_vault_status(client, user_store):
    _seed_schemes(user_store)
    token = _farmer(user_store)
    user_store["users/uid-1/vault_documents/v1"] = {"id": "v1", "docType": "aadhaar"}

    resp = await client.get("/v1/schemes/pm-kisan", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["eligible"] is True
    checklist = {entry["key"]: entry["met"] for entry in body["eligibility"]}
    assert checklist["maxLandAcres"] is True
    docs = {entry["name"]: entry["present"] for entry in body["documents"]}
    assert docs["Aadhaar"] is True
    assert docs["7/12"] is False
    assert body["portalUrl"] == "https://pmkisan.gov.in"
    assert "eligibilityRules" not in body


async def test_scheme_detail_unknown_is_404(client, user_store):
    token = _farmer(user_store)
    resp = await client.get("/v1/schemes/nope", headers=auth(token))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "SCHEME_NOT_FOUND"


async def test_schemes_list_cursor_pagination(client, user_store):
    _seed_schemes(user_store)
    token = _farmer(user_store)

    first = (await client.get("/v1/schemes?pageSize=2", headers=auth(token))).json()
    assert first["total"] == len(SCHEMES)
    assert len(first["data"]) == 2
    assert first["nextCursor"]

    second = (
        await client.get(f"/v1/schemes?pageSize=2&cursor={first['nextCursor']}", headers=auth(token))
    ).json()
    assert len(second["data"]) == 2
    first_ids = {item["id"] for item in first["data"]}
    assert first_ids.isdisjoint({item["id"] for item in second["data"]})

    # The server orders matched-to-profile first: the first page is all eligible.
    assert all(item["eligible"] for item in first["data"])
    assert "eligibilityRules" not in first["data"][0]

    bad = await client.get("/v1/schemes?cursor=not-a-cursor", headers=auth(token))
    assert bad.status_code == 400
    assert bad.json()["error"]["code"] == "INVALID_CURSOR"
