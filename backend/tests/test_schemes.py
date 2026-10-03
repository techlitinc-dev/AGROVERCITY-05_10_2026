from app.data.schemes_seed import SCHEMES
from app.services.eligibility import is_eligible
from tests.test_diary import auth, seed_user


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
