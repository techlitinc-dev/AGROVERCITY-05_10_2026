from app.data.tree_seed import (
    AGROFORESTRY_SCHEMES,
    BIOFUEL_TREES,
    NGOS,
    SAMPLE_ADOPTIONS,
    TREE_ARTICLES,
    TREE_CARE_GUIDES,
)
from tests.test_diary import auth, seed_user


def seed_tree_store(user_store):
    for item in TREE_ARTICLES:
        user_store[f"tree_articles/{item['id']}"] = item
    for item in NGOS:
        user_store[f"ngos/{item['id']}"] = item
    for item in BIOFUEL_TREES:
        user_store[f"biofuel_trees/{item['id']}"] = item
    for item in TREE_CARE_GUIDES:
        user_store[f"tree_care_guides/{item['id']}"] = item
    for item in AGROFORESTRY_SCHEMES:
        user_store[f"agroforestry_schemes/{item['id']}"] = item
    for item in SAMPLE_ADOPTIONS:
        user_store[f"tree_adoptions/{item['id']}"] = item


async def test_care_guides_sorted(client, user_store):
    seed_tree_store(user_store)
    token = seed_user(user_store)
    resp = await client.get("/v1/tree/care-guides", headers=auth(token))
    assert resp.status_code == 200
    steps = [g["stepNumber"] for g in resp.json()["data"]]
    assert steps == [1, 2, 3, 4, 5]


async def test_sapling_request_201(client, user_store):
    seed_tree_store(user_store)
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/tree/ngos/ngo-1/sapling-request",
        json={"treeType": "fruit", "count": 50},
        headers=auth(token),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "requested"
    request = user_store[f"users/uid-1/sapling_requests/{body['requestId']}"]
    assert request["ngoId"] == "ngo-1"
    assert request["count"] == 50


async def test_sapling_count_over_500_422(client, user_store):
    seed_tree_store(user_store)
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/tree/ngos/ngo-1/sapling-request",
        json={"treeType": "timber", "count": 501},
        headers=auth(token),
    )
    assert resp.status_code == 422


async def test_unknown_ngo_404(client, user_store):
    seed_tree_store(user_store)
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/tree/ngos/ngo-99/sapling-request",
        json={"treeType": "bamboo", "count": 10},
        headers=auth(token),
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NGO_NOT_FOUND"


async def test_carbon_estimate_calculation(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/tree/carbon/estimate",
        json={"treeSpecies": "Teak", "treeCount": 100, "ageYears": 1},
        headers=auth(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["co2PerTreePerYearKg"] == 22.0
    assert data["annualCo2Kg"] == 2200.0
    assert data["tenYearCo2Kg"] == 22000.0
    assert data["carbonCredits10Yr"] == 22.0
    assert data["estimatedEarningsInr"] == 26400.0


async def test_plantation_registration_and_logs(client, user_store):
    token = seed_user(user_store)
    # 1. Register plantation
    reg_resp = await client.post(
        "/v1/tree/plantations",
        json={
            "parcelName": "North Farm Bund (उत्तर बांध)",
            "treeSpecies": "Bamboo",
            "vernacularSpecies": "बांबू",
            "treeCount": 150,
            "plantingDate": "2026-08-10",
            "landType": "bund",
            "latitude": 19.9975,
            "longitude": 73.7898,
            "initialHeightCm": 35.0,
            "irrigationType": "drip",
        },
        headers=auth(token),
    )
    assert reg_resp.status_code == 201
    plantation = reg_resp.json()
    pl_id = plantation["id"]
    assert plantation["farmerId"] == "uid-1"
    assert plantation["estimatedCo2KgPerYear"] == 150 * 35.0

    # 2. List farmer's plantations
    list_resp = await client.get("/v1/tree/plantations/mine", headers=auth(token))
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] >= 1

    # 3. Add growth audit log
    log_resp = await client.post(
        f"/v1/tree/plantations/{pl_id}/logs",
        json={
            "heightCm": 55.0,
            "girthCm": 8.0,
            "survivalCount": 147,
            "healthStatus": "healthy",
            "notes": "Excellent shoots after drip fertigation",
            "photoUrl": "https://example.org/photo.jpg",
        },
        headers=auth(token),
    )
    assert log_resp.status_code == 201
    log_entry = log_resp.json()
    assert log_entry["heightCm"] == 55.0

    # 4. Fetch detail
    detail_resp = await client.get(f"/v1/tree/plantations/{pl_id}", headers=auth(token))
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["currentAvgHeightCm"] == 55.0
    assert detail["survivalRate"] == 98.0
    assert len(detail["logs"]) == 1


async def test_agroforestry_schemes_and_suitability(client, user_store):
    seed_tree_store(user_store)
    token = seed_user(user_store)
    # Schemes
    schemes_resp = await client.get("/v1/tree/schemes", headers=auth(token))
    assert schemes_resp.status_code == 200
    assert schemes_resp.json()["total"] >= 4

    # Suitability
    suit_resp = await client.get(
        "/v1/tree/species-suitability?soilType=black_cotton",
        headers=auth(token),
    )
    assert suit_resp.status_code == 200
    recs = suit_resp.json()["recommendations"]
    assert len(recs) >= 2
    assert any("Teak" in r["name"] for r in recs)

    # Adoptions
    adop_resp = await client.get("/v1/tree/adoptions/mine", headers=auth(token))
    assert adop_resp.status_code == 200
    assert adop_resp.json()["total"] >= 1

