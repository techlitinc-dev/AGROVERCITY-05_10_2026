import pytest

from app.data.insurance_seed import RATES, SCHEMES
from tests.test_diary import auth, seed_user


def _seed_rates(user_store):
    for rate in RATES:
        user_store[f"insurance_rates/{rate['id']}"] = dict(rate)


def _seed_schemes(user_store):
    for scheme in SCHEMES:
        user_store[f"insurance_schemes/{scheme['id']}"] = dict(scheme)


APPLY_DATA = {
    "cropName": "Wheat",
    "season": "Kharif",
    "landAreaAcres": 3.0,
    "category": "crop",
    "schemeName": "PMFBY",
    "khasraNumber": "142/2A",
}


@pytest.mark.asyncio
async def test_farmer_apply_sets_pending_approval_and_risk(client, user_store):
    _seed_rates(user_store)
    farmer_token = seed_user(user_store, uid="farmer-1", active_profile="farmer")

    resp = await client.post("/v1/insurance/policies/apply", json=APPLY_DATA, headers=auth(farmer_token))
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "pending_approval"
    assert data["sumInsured"] == 120000.0  # 40000 * 3
    assert data["farmerPremium"] == 2400.0  # 2% of 120000
    assert data["govtSubsidy"] == 12600.0  # (12.5 - 2)% of 120000
    assert data["riskScore"] is not None
    assert data["riskCategory"] in ("Low", "Medium", "High")
    assert data["userId"] == "farmer-1"


@pytest.mark.asyncio
async def test_provider_role_enforcement(client, user_store):
    _seed_rates(user_store)
    seller_token = seed_user(user_store, uid="seller-1", active_profile="seller")
    resp = await client.get("/v1/insurance/provider/policies", headers=auth(seller_token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"

    provider_token = seed_user(user_store, uid="provider-1", active_profile="insuranceProvider")
    resp_ok = await client.get("/v1/insurance/provider/policies", headers=auth(provider_token))
    assert resp_ok.status_code == 200


@pytest.mark.asyncio
async def test_provider_review_and_approve_policy(client, user_store, monkeypatch):
    _seed_rates(user_store)
    monkeypatch.setattr(
        "app.services.reports.upload_to_storage",
        lambda local_path, dest_path: "https://storage.example/approved_cert.pdf",
    )
    farmer_token = seed_user(user_store, uid="farmer-2", active_profile="farmer")
    provider_token = seed_user(user_store, uid="provider-2", active_profile="insuranceProvider")

    # Farmer applies
    apply_resp = await client.post("/v1/insurance/policies/apply", json=APPLY_DATA, headers=auth(farmer_token))
    assert apply_resp.status_code == 201
    policy_id = apply_resp.json()["id"]
    assert apply_resp.json()["status"] == "pending_approval"

    # Provider sees policy in queue
    q_resp = await client.get("/v1/insurance/provider/policies?status=pending_approval", headers=auth(provider_token))
    assert q_resp.status_code == 200
    assert any(p["id"] == policy_id for p in q_resp.json()["data"])

    # Provider gets details
    detail_resp = await client.get(f"/v1/insurance/provider/policies/{policy_id}", headers=auth(provider_token))
    assert detail_resp.status_code == 200
    assert detail_resp.json()["id"] == policy_id

    # Provider approves policy
    review_resp = await client.post(
        f"/v1/insurance/provider/policies/{policy_id}/review",
        json={"action": "approve", "underwriterNotes": "All cadastral survey criteria verified."},
        headers=auth(provider_token),
    )
    assert review_resp.status_code == 200
    approved_data = review_resp.json()
    assert approved_data["status"] == "active"
    assert approved_data["reviewedBy"] == "provider-2"
    assert approved_data["certificateUrl"] == "https://storage.example/approved_cert.pdf"

    # Farmer sees policy active
    farmer_policies = await client.get("/v1/insurance/policies", headers=auth(farmer_token))
    assert farmer_policies.status_code == 200
    my_pol = next(p for p in farmer_policies.json()["data"] if p["id"] == policy_id)
    assert my_pol["status"] == "active"


@pytest.mark.asyncio
async def test_provider_review_and_reject_policy(client, user_store):
    _seed_rates(user_store)
    farmer_token = seed_user(user_store, uid="farmer-3", active_profile="farmer")
    provider_token = seed_user(user_store, uid="provider-3", active_profile="insuranceProvider")

    apply_resp = await client.post("/v1/insurance/policies/apply", json=APPLY_DATA, headers=auth(farmer_token))
    policy_id = apply_resp.json()["id"]

    review_resp = await client.post(
        f"/v1/insurance/provider/policies/{policy_id}/review",
        json={"action": "reject", "rejectionReason": "खसरा संख्या राजस्व अभिलेख से मेल नहीं खाती (Land mismatch)"},
        headers=auth(provider_token),
    )
    assert review_resp.status_code == 200
    rejected_data = review_resp.json()
    assert rejected_data["status"] == "rejected"
    assert "राजस्व अभिलेख" in rejected_data["rejectionReason"]


@pytest.mark.asyncio
async def test_claims_lifecycle_by_provider(client, user_store, monkeypatch):
    _seed_rates(user_store)
    monkeypatch.setattr(
        "app.services.storage.upload_user_file",
        lambda uid, data, filename, content_type, prefix="claims": (f"claims/{uid}/{filename}", len(data)),
    )
    monkeypatch.setattr(
        "app.services.storage.signed_download_url",
        lambda blob_path, minutes=60: f"https://storage.example/{blob_path}",
    )

    farmer_token = seed_user(user_store, uid="farmer-4", active_profile="farmer")
    provider_token = seed_user(user_store, uid="provider-4", active_profile="insuranceProvider")

    # Apply & seed policy
    policy_resp = await client.post("/v1/insurance/policies/apply", json=APPLY_DATA, headers=auth(farmer_token))
    policy_id = policy_resp.json()["id"]

    # Farmer files claim
    claim_resp = await client.post(
        "/v1/insurance/claims",
        data={
            "policyId": policy_id,
            "cropName": "Wheat",
            "calamityType": "hailstorm",
            "dateOfDamage": "2026-09-15",
            "cropStage": "flowering",
            "estimatedLossPercent": 40.0,
            "gpsCoordinates": "20.0,73.8",
            "village": "Ozarkhed",
        },
        files={"damagePhotos": ("damage.jpg", b"fake-jpg", "image/jpeg")},
        headers=auth(farmer_token),
    )
    assert claim_resp.status_code == 201
    claim_id = claim_resp.json()["id"]

    # Provider lists claims
    c_list = await client.get("/v1/insurance/provider/claims", headers=auth(provider_token))
    assert c_list.status_code == 200
    assert any(c["id"] == claim_id for c in c_list.json()["data"])

    # Provider schedules survey
    sched_resp = await client.post(
        f"/v1/insurance/provider/claims/{claim_id}/schedule_survey",
        json={
            "surveyorName": "सुरेश देशमुख",
            "surveyorPhone": "+919822000000",
            "surveyorVisitDate": "2026-09-22",
            "notes": "खेत पर सर्वे हेतु अग्रिम सूचना",
        },
        headers=auth(provider_token),
    )
    assert sched_resp.status_code == 200
    assert sched_resp.json()["status"] == "surveyorAssigned"
    assert sched_resp.json()["surveyorName"] == "सुरेश देशमुख"

    # Surveyor report submitted
    report_resp = await client.post(
        f"/v1/insurance/provider/claims/{claim_id}/survey_report",
        json={"assessedLossPercent": 45.0, "cropStageVerified": "flowering", "surveyorNotes": "ओलावृष्टि से 45% बाली क्षतिग्रस्त"},
        headers=auth(provider_token),
    )
    assert report_resp.status_code == 200
    assert report_resp.json()["status"] == "fieldAssessed"

    # Provider approves claim
    appr_resp = await client.post(
        f"/v1/insurance/provider/claims/{claim_id}/review",
        json={"action": "approve", "approvedAmount": 54000.0, "notes": "Sanctioned 45% of 120000 sum insured"},
        headers=auth(provider_token),
    )
    assert appr_resp.status_code == 200
    assert appr_resp.json()["status"] == "dbtApproved"
    assert appr_resp.json()["approvedAmount"] == 54000.0

    # Provider disburses claim via DBT
    disb_resp = await client.post(
        f"/v1/insurance/provider/claims/{claim_id}/disburse",
        json={"dbtTransactionId": "DBT-TEST-20260901"},
        headers=auth(provider_token),
    )
    assert disb_resp.status_code == 200
    assert disb_resp.json()["status"] == "disbursed"
    assert disb_resp.json()["dbtTransactionId"] == "DBT-TEST-20260901"


@pytest.mark.asyncio
async def test_provider_stats_and_schemes(client, user_store):
    _seed_rates(user_store)
    _seed_schemes(user_store)
    provider_token = seed_user(user_store, uid="provider-5", active_profile="insuranceProvider")

    # Get schemes
    schemes_resp = await client.get("/v1/insurance/schemes", headers=auth(provider_token))
    assert schemes_resp.status_code == 200
    assert len(schemes_resp.json()["data"]) >= 4
    assert any(s["code"] == "PMFBY" for s in schemes_resp.json()["data"])
    assert any(s["code"] == "RWBCIS" for s in schemes_resp.json()["data"])
    assert any(s["code"] == "PASHU-BIMA" for s in schemes_resp.json()["data"])

    # Get stats
    stats_resp = await client.get("/v1/insurance/provider/stats", headers=auth(provider_token))
    assert stats_resp.status_code == 200
    stats = stats_resp.json()
    assert "totalPolicies" in stats
    assert "totalSumInsured" in stats
    assert "lossRatioPercent" in stats
    assert "totalClaims" in stats

    # Provider creates custom rate
    rate_resp = await client.post(
        "/v1/insurance/provider/rates",
        json={
            "cropName": "Cotton",
            "category": "commercial",
            "season": "Kharif",
            "sumInsuredPerAcre": 50000.0,
            "farmerSharePercent": 5.0,
            "totalActuarialRatePercent": 14.5,
            "cutoffDate": "2026-08-15",
        },
        headers=auth(provider_token),
    )
    assert rate_resp.status_code == 201
    assert rate_resp.json()["cropName"] == "Cotton"
