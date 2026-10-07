"""Crop planner (phase-05 WS-02, brief M13, SGR).

Covers: validation, shim output shape (deterministic fallback since the shim
cannot emit JSON), the per-(district, season, profile) cache, confirm creating a
real `crop_cycles` doc + emitted task schedule, and Idempotency-Key replay not
duplicating.
"""
from tests.test_diary import auth, seed_user

CROP_PLAN_BODY = {
    "soil": "black",
    "irrigation": "drip",
    "plotSizeAcres": 2.5,
    "cropHistory": ["onion", "tomato"],
    "district": "Nashik",
    "lang": "en",
}


async def test_crop_plan_shim_returns_options_and_logs_decision(client, user_store):
    token = seed_user(user_store)
    resp = await client.post("/v1/advisory/crop-plan", json=CROP_PLAN_BODY, headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert 2 <= len(body["options"]) <= 5
    for option in body["options"]:
        assert option["crop"]
        assert option["rationale"]
    assert body["source"] == "fallback"
    assert body["automationLevel"] == "suggest"
    assert any(key.startswith("ai_decisions/") for key in user_store)


async def test_crop_plan_fallback_when_ai_off(client, user_store):
    """With the model off/failed the planner returns the deterministic options."""
    token = seed_user(user_store)
    resp = await client.post("/v1/advisory/crop-plan", json=CROP_PLAN_BODY, headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["source"] == "fallback"
    assert body["cached"] is False
    assert 2 <= len(body["options"]) <= 5


async def test_crop_plan_is_cached(client, user_store):
    token = seed_user(user_store)
    first = await client.post("/v1/advisory/crop-plan", json=CROP_PLAN_BODY, headers=auth(token))
    assert first.status_code == 200
    assert first.json()["cached"] is False
    second = await client.post("/v1/advisory/crop-plan", json=CROP_PLAN_BODY, headers=auth(token))
    assert second.status_code == 200
    assert second.json()["cached"] is True


async def test_crop_plan_validates_inputs(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/advisory/crop-plan",
        json={**CROP_PLAN_BODY, "plotSizeAcres": 0},
        headers=auth(token),
    )
    assert resp.status_code == 422


async def test_crop_plan_confirm_creates_cycle_and_tasks(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/advisory/crop-plan/confirm",
        json={"crop": "soybean", "district": "Nashik"},
        headers={**auth(token), "Idempotency-Key": "plan-1"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["created"] is True
    assert body["cropCycleId"].startswith("uid-1_soybean_")
    assert body["taskIds"]
    assert f"crop_cycles/{body['cropCycleId']}" in user_store
    cycle = user_store[f"crop_cycles/{body['cropCycleId']}"]
    assert cycle["fromPlanner"] is True
    assert any(key.startswith("tasks/") for key in user_store)


async def test_crop_plan_confirm_is_idempotent(client, user_store):
    token = seed_user(user_store)
    headers = {**auth(token), "Idempotency-Key": "plan-2"}
    payload = {"crop": "maize", "district": "Nashik"}
    first = await client.post("/v1/advisory/crop-plan/confirm", json=payload, headers=headers)
    second = await client.post("/v1/advisory/crop-plan/confirm", json=payload, headers=headers)
    assert first.status_code == 200 and second.status_code == 200
    assert first.json()["created"] is True
    assert second.json()["created"] is False
    assert first.json()["cropCycleId"] == second.json()["cropCycleId"]
    assert first.json()["taskIds"] == second.json()["taskIds"]
    cycle_docs = [key for key in user_store if key.startswith("crop_cycles/uid-1_maize_")]
    assert len(cycle_docs) == 1
