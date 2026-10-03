from tests.test_diary import auth, seed_user

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


async def test_carbon_potential_math(client, user_store):
    token = seed_user(user_store, landAreaAcres=5)
    resp = await client.get("/v1/climate/carbon-potential?lat=20&lng=74", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["co2eTonnes"] == 4.6
    assert body["annualIncomePotential"] == 9200
    assert body["practices"] == ["biochar", "zero-till", "green-manure"]


async def test_resilient_varieties_filter(client, user_store):
    token = seed_user(user_store)
    resp = await client.get("/v1/climate/resilient-varieties?crop=rice", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] >= 1
    assert any("Swarna" in v["variety"] for v in body["data"])


async def test_cold_storage_list(client, user_store):
    token = seed_user(user_store)
    resp = await client.get("/v1/post-harvest/cold-storage?lat=20&lng=74", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 4
    for item in body["data"]:
        for key in ("id", "name", "distanceKm", "tempRange", "availableMT", "ratePerQuintalMonth"):
            assert key in item


async def test_grade_stub(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/post-harvest/grade",
        files=[("images", ("lot.png", PNG_BYTES, "image/png"))],
        headers=auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["grade"] == "AGMARK A"
    resp = await client.post(
        "/v1/post-harvest/grade",
        files=[("images", ("notes.txt", b"hello", "text/plain"))],
        headers=auth(token),
    )
    assert resp.status_code == 415


async def test_grade_max_3_images_422(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/post-harvest/grade",
        files=[("images", (f"lot{i}.png", PNG_BYTES, "image/png")) for i in range(4)],
        headers=auth(token),
    )
    assert resp.status_code == 422


async def test_carbon_forbidden_for_transport(client, user_store):
    token = seed_user(user_store, active_profile="transport")
    resp = await client.get("/v1/climate/carbon-potential?lat=20&lng=74", headers=auth(token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"
