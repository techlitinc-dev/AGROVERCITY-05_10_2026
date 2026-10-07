"""Crop-insurance farmer face (phase-05 WS-05, robust.md §7.9).

Covers the policy passbook, the published rate table, the premium calculator
(integer paisa) and the e-certificate path. The claim lifecycle lives in
`test_insurance_claims.py`.
"""
from tests.test_diary import auth, seed_user

POLICY = {
    "id": "pol-1",
    "policyNumber": "PMFBY-2026-0001",
    "schemeName": "PMFBY",
    "cropName": "Wheat",
    "season": "Kharif",
    "year": 2026,
    "landAreaAcres": 2.0,
    "sumInsured": 80000,
    "farmerPremium": 1600.0,
    "govtSubsidy": 8400.0,
    "status": "active",
    "insuranceCompany": "AIC of India",
    "coverageStartDate": "2026-07-01",
    "coverageEndDate": "2026-12-31",
    "bankName": "SBI",
    "kccAccountNo": "XXXX4521",
    "certificateUrl": None,
}

RATE = {
    "id": "wheat-kharif",
    "cropName": "Wheat",
    "category": "crop",
    "season": "Kharif",
    "sumInsuredPerAcre": 40000,
    "farmerSharePercent": 2.0,
    "totalActuarialRatePercent": 12.5,
    "cutoffDate": "2026-07-31",
}


def _farmer(user_store, **overrides):
    return seed_user(user_store, state="Maharashtra", district="Nashik", **overrides)


async def test_policies_list_seeds_dev_demo(client, user_store):
    token = _farmer(user_store)
    resp = await client.get("/v1/insurance/policies", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["data"][0]["policyNumber"].startswith("PMFBY-")


async def test_rates_list_returns_published_table(client, user_store):
    token = _farmer(user_store)
    user_store["insurance_rates/wheat-kharif"] = dict(RATE)
    resp = await client.get("/v1/insurance/rates?crop=Wheat&season=Kharif", headers=auth(token))
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["sumInsuredPerAcre"] == 40000


async def test_premium_calculator_exact_integer_paisa(client, user_store):
    token = _farmer(user_store)
    user_store["insurance_rates/wheat-kharif"] = dict(RATE)
    resp = await client.post(
        "/v1/insurance/premium-calculator",
        json={"cropName": "Wheat", "season": "Kharif", "landAreaAcres": 2},
        headers=auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["sumInsuredPaisa"] == 40000 * 2 * 100
    assert body["farmerPremiumPaisa"] == 160000
    assert body["govtSubsidyPaisa"] == 840000
    assert all(isinstance(body[key], int) for key in (
        "sumInsuredPaisa",
        "farmerPremiumPaisa",
        "govtSubsidyPaisa",
    ))


async def test_premium_calculator_missing_rate_404(client, user_store):
    token = _farmer(user_store)
    resp = await client.post(
        "/v1/insurance/premium-calculator",
        json={"cropName": "Dragonfruit", "season": "Kharif", "landAreaAcres": 1},
        headers=auth(token),
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "RATE_NOT_FOUND"


async def test_schemes_fall_back_to_seed(client, user_store):
    token = _farmer(user_store)
    resp = await client.get("/v1/insurance/schemes", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


async def test_policy_certificate_builds_and_stores_url(client, user_store, monkeypatch):
    token = _farmer(user_store)
    user_store["users/uid-1/insurance_policies/pol-1"] = dict(POLICY)
    monkeypatch.setattr(
        "app.services.reports.build_policy_certificate_pdf",
        lambda policy: "certificates/local.pdf",
    )
    monkeypatch.setattr(
        "app.services.reports.upload_to_storage",
        lambda local_path, dest_path: f"https://storage.example.com/{dest_path}",
    )
    resp = await client.get("/v1/insurance/policies/pol-1/certificate", headers=auth(token))
    assert resp.status_code == 200
    url = resp.json()["certificateUrl"]
    assert url.endswith("certificates/uid-1/pol-1.pdf")
    assert user_store["users/uid-1/insurance_policies/pol-1"]["certificateUrl"] == url


async def test_policy_certificate_unknown_policy_404(client, user_store):
    token = _farmer(user_store)
    resp = await client.get("/v1/insurance/policies/nope/certificate", headers=auth(token))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "POLICY_NOT_FOUND"
