"""Farmer-persona API contract tests for the mandi/advisory/water/insurance/loans
adjustments (default-mandi resolution, saturation alias + profile defaults,
PMKSY areaHa, and the upload-first JSON variants)."""

from app.services.mandi_forecast import CACHE_COLLECTION as FORECAST_COLLECTION
from app.services.mandi_forecast import forecast_doc_id
from tests.test_diary import auth, seed_user

NASHIK_MANDI = {
    "id": "mandi-nashik-1",
    "name": "Nashik Krishi Utpanna Bazar Samiti",
    "district": "Nashik",
    "state": "Maharashtra",
}

HISTORY_DOC = {
    "mandiName": "Nashik Krishi Utpanna Bazar Samiti",
    "commodity": "Tomato (टमाटर)",
    "date": "2026-09-10",
    "modalPrice": 2100,
}


def _seed_nashik_mandi(user_store):
    user_store["mandis/mandi-nashik-1"] = dict(NASHIK_MANDI)


# ---------- mandi: history / forecast default to the caller's district ----------


async def test_history_defaults_to_district_mandi(client, user_store):
    token = seed_user(user_store, district="Nashik")
    _seed_nashik_mandi(user_store)
    user_store["mandi_price_history/h1"] = dict(HISTORY_DOC)
    resp = await client.get(
        "/v1/mandi/prices/history", params={"crop": "tomato"}, headers=auth(token)
    )
    assert resp.status_code == 200
    assert len(resp.json()["data"]) == 1


async def test_history_default_mandi_no_district_422(client, user_store):
    token = seed_user(user_store, district="")
    user_store["mandi_price_history/h1"] = dict(HISTORY_DOC)
    resp = await client.get(
        "/v1/mandi/prices/history", params={"crop": "tomato"}, headers=auth(token)
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["fieldErrors"]["mandi"] == "required"


async def test_history_explicit_mandi_still_validated(client, user_store):
    token = seed_user(user_store, district="Nashik")
    _seed_nashik_mandi(user_store)
    user_store["mandi_price_history/h1"] = dict(HISTORY_DOC)
    resp = await client.get(
        "/v1/mandi/prices/history",
        params={"crop": "tomato", "mandi": "Nashik Krishi"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    assert len(resp.json()["data"]) == 1


async def test_forecast_defaults_to_district_mandi(client, user_store):
    token = seed_user(user_store, district="Nashik")
    _seed_nashik_mandi(user_store)
    doc_id = forecast_doc_id("soybean", "Nashik Krishi Utpanna Bazar Samiti")
    user_store[f"{FORECAST_COLLECTION}/{doc_id}"] = {
        "crop": "soybean",
        "mandi": "Nashik Krishi Utpanna Bazar Samiti",
        "expectedPrice": 4980,
    }
    resp = await client.get("/v1/mandi/forecast", params={"crop": "soybean"}, headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["data"]["expectedPrice"] == 4980


# ---------- advisory: saturation commodity alias + profile defaults ----------


async def test_saturation_accepts_commodity_alias(client, user_store):
    token = seed_user(user_store, district="Nashik")
    resp = await client.post(
        "/v1/advisory/saturation",
        json={"commodity": "onion", "shareSowingIntent": False},
        headers=auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["dataBasis"]["district"] == "Nashik"


async def test_saturation_defaults_location_from_profile(client, user_store):
    token = seed_user(
        user_store,
        district="Nashik",
        farmBoundaryPoints=[{"lat": 20.05, "lng": 73.76}],
    )
    resp = await client.post(
        "/v1/advisory/saturation",
        json={"crop": "onion", "shareSowingIntent": True},
        headers=auth(token),
    )
    assert resp.status_code == 200
    cycle = user_store["crop_cycles/uid-1_onion_Kharif"]
    assert cycle["district"] == "Nashik"
    assert cycle["lat"] == 20.05
    assert cycle["lng"] == 73.76


# ---------- water: PMKSY areaHa ----------


async def test_pmksy_from_area_ha_with_crop_type(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/water/pmksy-calculator",
        json={"areaHa": 1, "cropType": "horticulture"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    # 1 ha = 2.47105 acres × ₹85,000/acre benchmark
    assert body["totalCostPaisa"] == round(2.47105 * 85000 * 100)
    assert body["subsidyPercent"] == 55
    assert body["subsidyAmountPaisa"] == (body["totalCostPaisa"] * 55) // 100
    assert body["subsidyAmountPaisa"] + body["farmerSharePaisa"] == body["totalCostPaisa"]


async def test_pmksy_legacy_acres_still_works(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/water/pmksy-calculator", json={"acres": 2}, headers=auth(token)
    )
    assert resp.status_code == 200
    assert resp.json()["totalCost"] == 170000


# ---------- insurance: claims/from-uploads ----------


async def test_claim_from_uploads_json(client, user_store):
    token = seed_user(user_store, district="Nashik")
    user_store["users/uid-1/insurance_policies/pol-1"] = {
        "id": "pol-1",
        "policyNumber": "PMFBY-2026-0001",
        "cropName": "Wheat",
        "sumInsured": 80000,
        "status": "active",
    }
    resp = await client.post(
        "/v1/insurance/claims/from-uploads",
        json={
            "policyId": "pol-1",
            "cropName": "Wheat",
            "calamityType": "hailstorm",
            "dateOfDamage": "2026-09-10",
            "cropStage": "flowering",
            "estimatedLossPercent": 40,
            "gpsCoordinates": "20.0,73.8",
            "village": "Ozarkhed",
            "damagePhotoUrls": ["https://storage.example.com/p1.png", "https://storage.example.com/p2.png"],
        },
        headers=auth(token),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["policyId"] == "pol-1"
    assert body["cropName"] == "Wheat"
    assert body["requestedAmount"] == 32000.0
    assert body["status"] == "intimated"
    assert body["damagePhotos"] == [
        "https://storage.example.com/p1.png",
        "https://storage.example.com/p2.png",
    ]
    claim_id = body["id"]
    assert user_store[f"users/uid-1/insurance_claims/{claim_id}"]["claimNumber"] == body["claimNumber"]
    assert user_store[f"insurance_claims/{claim_id}"]["userId"] == "uid-1"


async def test_claim_from_uploads_enforces_photo_cap(client, user_store):
    token = seed_user(user_store)
    user_store["users/uid-1/insurance_policies/pol-1"] = {
        "id": "pol-1",
        "sumInsured": 80000,
    }
    resp = await client.post(
        "/v1/insurance/claims/from-uploads",
        json={
            "policyId": "pol-1",
            "cropName": "Wheat",
            "calamityType": "hailstorm",
            "dateOfDamage": "2026-09-10",
            "cropStage": "flowering",
            "estimatedLossPercent": 40,
            "gpsCoordinates": "20.0,73.8",
            "village": "Ozarkhed",
            "damagePhotoUrls": [f"https://example.com/p{i}.png" for i in range(6)],
        },
        headers=auth(token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "TOO_MANY_PHOTOS"


# ---------- loans: documents/from-uploads ----------


async def test_loan_document_from_uploads_json(client, user_store):
    token = seed_user(user_store)
    user_store["loan_applications/loan-1"] = {
        "id": "loan-1",
        "applicationId": "loan-1",
        "userId": "uid-1",
        "farmerName": "Ram Patil",
        "amount": 50000,
        "tenureMonths": 12,
        "status": "submitted",
        "documents": [],
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    resp = await client.post(
        "/v1/loans/loan-1/documents/from-uploads",
        json={"name": "7-12 extract.pdf", "url": "https://storage.example.com/loans/doc.pdf", "type": "application/pdf"},
        headers=auth(token),
    )
    assert resp.status_code == 201
    docs = resp.json()["documents"]
    assert len(docs) == 1
    assert docs[0]["name"] == "7-12 extract.pdf"
    assert docs[0]["storagePath"] == "https://storage.example.com/loans/doc.pdf"


async def test_loan_document_from_uploads_foreign_loan_404(client, user_store):
    token = seed_user(user_store)
    user_store["loan_applications/loan-9"] = {
        "id": "loan-9",
        "userId": "uid-2",
        "documents": [],
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    resp = await client.post(
        "/v1/loans/loan-9/documents/from-uploads",
        json={"name": "passbook.pdf", "url": "https://storage.example.com/pb.pdf", "type": "application/pdf"},
        headers=auth(token),
    )
    assert resp.status_code == 404
