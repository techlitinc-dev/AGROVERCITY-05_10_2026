async def test_reverse_geocode_nashik(client):
    resp = await client.get("/v1/geo/reverse", params={"lat": 20.0, "lng": 73.8})
    assert resp.status_code == 200
    body = resp.json()
    assert body["district"] == "Nashik"
    assert body["suggestedLanguages"] == ["mr", "hi"]


async def test_reverse_geocode_fallback(client):
    resp = await client.get("/v1/geo/reverse", params={"lat": 10.0, "lng": 10.0})
    assert resp.status_code == 200
    assert resp.json()["suggestedLanguages"] == ["hi", "en"]


async def test_regions_crops_nashik(client):
    resp = await client.get("/v1/regions/crops", params={"district": "Nashik"})
    assert resp.status_code == 200
    suggested = resp.json()["suggested"]
    assert "Tomato" in suggested
    assert "Onion" in suggested


async def test_regions_crops_unknown_district(client):
    resp = await client.get("/v1/regions/crops", params={"district": "Nowhere"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["district"] == "Nowhere"
    assert body["kharif"] == []
    assert body["rabi"] == []
    assert body["suggested"] == []


async def test_languages_all_24_entries(client):
    resp = await client.get("/v1/languages")
    assert resp.status_code == 200
    languages = resp.json()["languages"]
    assert len(languages) == 24
    codes = {lang["code"] for lang in languages}
    assert {"en", "hi", "mr", "gu", "pa", "te", "ta", "bn", "ur", "kn", "ml", "or"}.issubset(codes)
    assert all(lang["audioText"] for lang in languages)


async def test_msp_reference_returns_seeded_crops(client, user_store):
    user_store["msp_reference/wheat"] = {
        "crop": "Wheat",
        "msp_paisa": 227500,
        "season": "rabi",
        "updated_at": "2026-01-01T00:00:00+00:00",
    }
    user_store["msp_reference/onion"] = {"crop": "Onion", "season": "rabi"}  # no price → omitted

    resp = await client.get("/v1/reference/msp")

    assert resp.status_code == 200
    items = resp.json()["items"]
    assert {"crop": "Wheat", "msp_paisa": 227500, "season": "rabi"} in items
    assert all(item["crop"] != "Onion" for item in items)

