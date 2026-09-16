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


async def test_languages_seven_entries(client):
    resp = await client.get("/v1/languages")
    assert resp.status_code == 200
    languages = resp.json()["languages"]
    assert len(languages) == 7
    assert all(lang["audioText"] for lang in languages)
