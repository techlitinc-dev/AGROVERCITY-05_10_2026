from tests.test_diary import auth, seed_user


def _cycle(uid, crop, season, created_at, **overrides):
    doc = {
        "id": f"{uid}_{crop}_{season}",
        "userId": uid,
        "crop": crop,
        "season": season,
        "createdAt": created_at,
    }
    doc.update(overrides)
    return doc


async def test_list_cycles_empty(client, user_store):
    token = seed_user(user_store)
    resp = await client.get("/v1/farmer/crops", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"] == []
    assert body["total"] == 0


async def test_list_cycles_own_only_newest_first(client, user_store):
    token = seed_user(user_store)
    user_store["crop_cycles/uid-1_onion_Kharif"] = _cycle(
        "uid-1", "onion", "Kharif", "2026-09-01T00:00:00+00:00"
    )
    user_store["crop_cycles/uid-1_wheat_Rabi"] = _cycle(
        "uid-1", "wheat", "Rabi", "2026-10-01T00:00:00+00:00"
    )
    user_store["crop_cycles/uid-2_soybean_Kharif"] = _cycle(
        "uid-2", "soybean", "Kharif", "2026-10-05T00:00:00+00:00"
    )
    resp = await client.get("/v1/farmer/crops", headers=auth(token))
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 2
    assert [d["crop"] for d in data] == ["wheat", "onion"]


async def test_patch_own_cycle(client, user_store):
    token = seed_user(user_store)
    user_store["crop_cycles/uid-1_onion_Kharif"] = _cycle(
        "uid-1", "onion", "Kharif", "2026-09-01T00:00:00+00:00", stage="sowing"
    )
    resp = await client.patch(
        "/v1/farmer/crops/uid-1_onion_Kharif",
        json={"stage": "flowering", "status": "growing", "notes": "Lodging observed after rain"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    doc = user_store["crop_cycles/uid-1_onion_Kharif"]
    assert doc["stage"] == "flowering"
    assert doc["status"] == "growing"
    assert doc["notes"] == "Lodging observed after rain"
    assert doc["updatedAt"]


async def test_patch_leaves_other_fields(client, user_store):
    token = seed_user(user_store)
    user_store["crop_cycles/uid-1_onion_Kharif"] = _cycle(
        "uid-1", "onion", "Kharif", "2026-09-01T00:00:00+00:00", plannedDate="2026-09-05"
    )
    resp = await client.patch(
        "/v1/farmer/crops/uid-1_onion_Kharif",
        json={"stage": "harvest"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    doc = user_store["crop_cycles/uid-1_onion_Kharif"]
    assert doc["crop"] == "onion"
    assert doc["plannedDate"] == "2026-09-05"


async def test_patch_foreign_cycle_404(client, user_store):
    token = seed_user(user_store)
    user_store["crop_cycles/uid-2_onion_Kharif"] = _cycle(
        "uid-2", "onion", "Kharif", "2026-09-01T00:00:00+00:00"
    )
    resp = await client.patch(
        "/v1/farmer/crops/uid-2_onion_Kharif",
        json={"stage": "harvest"},
        headers=auth(token),
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "CROP_CYCLE_NOT_FOUND"
    assert user_store["crop_cycles/uid-2_onion_Kharif"].get("stage") is None


async def test_patch_missing_cycle_404(client, user_store):
    token = seed_user(user_store)
    resp = await client.patch(
        "/v1/farmer/crops/nope",
        json={"stage": "sowing"},
        headers=auth(token),
    )
    assert resp.status_code == 404


async def test_unauthenticated_rejected(client, user_store):
    resp = await client.get("/v1/farmer/crops")
    assert resp.status_code in (401, 403)
    resp = await client.patch("/v1/farmer/crops/uid-1_onion_Kharif", json={"stage": "sowing"})
    assert resp.status_code in (401, 403)
