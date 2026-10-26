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


# ---- Detailed plan options, season auto-detection, typeahead ----


async def test_crop_plan_ai_success_path_parses_details(client, user_store, monkeypatch):
    """When the model returns the structured JSON, the endpoint reports
    source=ai and every detail field flows through to the response."""
    ai_json = (
        '{"options":[{"crop":"Chickpea (Gram)","rationale":"Fixes nitrogen after onion.",'
        '"estimatedRevenuePaisa":45000000,"variety":"Jaki-9218","sowingWindow":"Oct-Nov",'
        '"durationDays":100,"waterRequirement":"low - 1-2 irrigations",'
        '"expectedYieldQuintalPerAcre":8.0,"estimatedCostPaisa":2000000,'
        '"expectedProfitPaisa":8000000,"marketOutlook":"Stable mandi demand.",'
        '"risks":["Rust"],"tasks":["Sow","Irrigate"]},'
        '{"crop":"Wheat","rationale":"Reliable rabi staple.","estimatedRevenuePaisa":52000000}]}'
    )

    async def fake_generate(prompt, opts=None):
        return ai_json

    monkeypatch.setattr("app.services.advisory.gateway.generate", fake_generate)
    token = seed_user(user_store)
    # Unique (soil, irrigation) profile so the 6h plan cache from other tests
    # (same district/season) doesn't shadow this request.
    body = {**CROP_PLAN_BODY, "soil": "red", "irrigation": "sprinkler"}
    resp = await client.post("/v1/advisory/crop-plan", json=body, headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["source"] == "ai"
    gram = next(o for o in body["options"] if o["crop"] == "Chickpea (Gram)")
    assert gram["variety"] == "Jaki-9218"
    assert gram["durationDays"] == 100
    assert gram["expectedProfitPaisa"] == 8000000
    assert gram["risks"] == ["Rust"]
    assert gram["tasks"] == ["Sow", "Irrigate"]


async def test_crop_plan_options_carry_detail_fields(client, user_store):
    """Fallback options still expose the detailed agronomy plan fields."""
    token = seed_user(user_store)
    resp = await client.post("/v1/advisory/crop-plan", json=CROP_PLAN_BODY, headers=auth(token))
    assert resp.status_code == 200
    for option in resp.json()["options"]:
        assert option["variety"]
        assert option["sowingWindow"]
        assert option["durationDays"] > 0
        assert option["waterRequirement"]
        assert option["expectedYieldQuintalPerAcre"] > 0
        assert option["estimatedCostPaisa"] > 0
        assert len(option["risks"]) >= 1
        assert len(option["tasks"]) >= 1


async def test_crop_plan_echoes_resolved_season(client, user_store):
    """The response always names the season the plan was generated for."""
    token = seed_user(user_store)
    explicit = await client.post(
        "/v1/advisory/crop-plan",
        json={**CROP_PLAN_BODY, "season": "Rabi"},
        headers=auth(token),
    )
    assert explicit.status_code == 200
    assert explicit.json()["season"] == "Rabi"
    auto = await client.post("/v1/advisory/crop-plan", json=CROP_PLAN_BODY, headers=auth(token))
    assert auto.status_code == 200
    assert auto.json()["season"] in ("Kharif", "Rabi", "Zaid")


def test_season_autodetect_mapping():
    from datetime import date

    from app.services.advisory import current_season, season_for_date

    assert current_season(date(2026, 7, 1)) == "Kharif"
    assert current_season(date(2026, 10, 31)) == "Kharif"
    assert current_season(date(2026, 3, 15)) == "Zaid"
    assert current_season(date(2026, 5, 31)) == "Zaid"
    assert current_season(date(2026, 1, 20)) == "Rabi"
    assert current_season(date(2026, 11, 20)) == "Rabi"
    # Planned-date detection drives the sowing-intent season.
    assert season_for_date("2027-03-10") == "Zaid"
    assert season_for_date("2027-06-20") == "Kharif"
    assert season_for_date("2026-12-05") == "Rabi"
    assert season_for_date("not-a-date") in ("Kharif", "Rabi", "Zaid")


async def test_sowing_intent_autodetects_season_from_planned_date(client, user_store):
    token = seed_user(user_store)
    await client.put(
        "/v1/users/me/consents",
        json={"dataSharing": True, "location": False, "marketing": False},
        headers=auth(token),
    )
    resp = await client.post(
        "/v1/advisory/sowing-intent",
        json={"crop": "Watermelon", "plannedDate": "2027-03-10"},
        headers=auth(token),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["season"] == "Zaid"
    cycle = user_store[f"crop_cycles/uid-1_Watermelon_Zaid"]
    assert cycle["season"] == "Zaid"
    assert cycle["isIntent"] is True


async def test_crop_plan_confirm_stores_plan_details(client, user_store):
    token = seed_user(user_store)
    plan_details = {
        "crop": "Soybean",
        "rationale": "Rotates away from onion.",
        "variety": "JS-9560",
        "durationDays": 100,
        "estimatedCostPaisa": 1800000,
        "expectedProfitPaisa": 4200000,
    }
    resp = await client.post(
        "/v1/advisory/crop-plan/confirm",
        json={"crop": "Soybean", "district": "Nashik", "planDetails": plan_details},
        headers=auth(token),
    )
    assert resp.status_code == 200
    cycle = user_store[f"crop_cycles/{resp.json()['cropCycleId']}"]
    assert cycle["planDetails"]["variety"] == "JS-9560"


async def test_crops_suggest_endpoint(client, user_store):
    user_store["crops/onion"] = {
        "id": "onion",
        "name": "Onion",
        "vernacularName": "प्याज (Pyaz)",
        "category": "vegetable",
        "aliases": ["pyaz", "kanda"],
    }
    token = seed_user(user_store)
    resp = await client.get("/v1/reference/crops-suggest?q=oni", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert "items" in body
    names = [item["name"] for item in body["items"]]
    assert any("oni" in (name or "").lower() for name in names)
    # Empty query returns suggestions for the focused-dropdown state.
    empty = await client.get("/v1/reference/crops-suggest", headers=auth(token))
    assert empty.status_code == 200
    assert len(empty.json()["items"]) > 0
