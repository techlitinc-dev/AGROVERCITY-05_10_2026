"""ClaimsDesk web flows (WS-04, tasks 4.18 + 4.19).

Full claim lifecycle (farmer intimates with photos → provider schedules a
survey → survey report → approve → DBT disburse), each stage timestamped on
the farmer read, cycle time derivable from /provider/stats, the appeal
re-entry path, the surveyor roster, audit_logs on review + disburse and the
per-claim processing fee in the settlements ledger. Also the SLA-clock data
path (a >48 h-old intimation stays present + sortable + counted as pending).
"""

import re

from tests.test_diary import auth, seed_user

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 512

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
    "userId": "farmer-e2e",
}

CLAIM_FIELDS = {
    "policyId": "pol-1",
    "cropName": "Wheat",
    "calamityType": "hailstorm",
    "dateOfDamage": "2026-09-10",
    "cropStage": "flowering",
    "estimatedLossPercent": "40",
    "gpsCoordinates": "20.0,73.8",
    "village": "Ozarkhed",
}

APPEAL_REASON = "सर्वेयर ने गलत फसल स्टेज दर्ज की थी, नई फोटो संलग्न हैं"


def _fake_storage(monkeypatch):
    monkeypatch.setattr(
        "app.services.storage.upload_user_file",
        lambda uid, data, filename, content_type, prefix="vault": (
            f"{prefix}/{uid}/fake_{filename}",
            len(data),
        ),
    )
    monkeypatch.setattr(
        "app.services.storage.signed_download_url",
        lambda blob_path, minutes=60: f"https://storage.example.com/{blob_path}?sig=x",
    )


def _farmer(user_store, uid="farmer-e2e", **overrides):
    return seed_user(user_store, uid=uid, state="Maharashtra", district="Nashik", **overrides)


def _seed_policy(user_store, uid="farmer-e2e"):
    user_store[f"users/{uid}/insurance_policies/pol-1"] = dict(POLICY)


def _photos(n=2):
    return [("damagePhotos", (f"p{i}.png", PNG_BYTES, "image/png")) for i in range(n)]


async def _submit(client, token, fields=None):
    return await client.post(
        "/v1/insurance/claims",
        data=fields or CLAIM_FIELDS,
        files=_photos(),
        headers=auth(token),
    )


def _claim_audits(user_store, action):
    return [
        doc
        for key, doc in user_store.items()
        if key.startswith("audit_logs/") and doc.get("action") == action
    ]


async def test_claim_lifecycle_end_to_end(client, user_store, monkeypatch):
    _fake_storage(monkeypatch)
    farmer = _farmer(user_store)
    provider = seed_user(user_store, uid="provider-e2e", active_profile="insuranceProvider")
    _seed_policy(user_store)

    # 1. Farmer intimates with geo-tagged photos inside the 72-h window.
    submit = await _submit(client, farmer)
    assert submit.status_code == 201
    claim_id = submit.json()["id"]

    # Surveyor roster (A2) then assignment.
    roster = await client.post(
        "/v1/insurance/provider/surveyors",
        json={"name": "सुरेश देशमुख", "phone": "+919822000000", "districts": ["Nashik"]},
        headers=auth(provider),
    )
    assert roster.status_code == 201
    assert roster.json()["providerId"] == "provider-e2e"

    # Provider queue shows the intimation.
    queue = await client.get("/v1/insurance/provider/claims?status=intimated", headers=auth(provider))
    assert queue.status_code == 200
    assert any(c["id"] == claim_id for c in queue.json()["data"])

    sched = await client.post(
        f"/v1/insurance/provider/claims/{claim_id}/schedule_survey",
        json={
            "surveyorName": "सुरेश देशमुख",
            "surveyorPhone": "+919822000000",
            "surveyorVisitDate": "2026-09-22",
        },
        headers=auth(provider),
    )
    assert sched.status_code == 200
    assert sched.json()["status"] == "surveyorAssigned"

    report = await client.post(
        f"/v1/insurance/provider/claims/{claim_id}/survey_report",
        json={"assessedLossPercent": 45.0, "surveyorNotes": "ओलावृष्टि से 45% बाली क्षतिग्रस्त"},
        headers=auth(provider),
    )
    assert report.status_code == 200
    assert report.json()["status"] == "fieldAssessed"

    approve = await client.post(
        f"/v1/insurance/provider/claims/{claim_id}/review",
        json={"action": "approve", "approvedAmount": 36000.0, "notes": "Approved at 45% loss"},
        headers=auth(provider),
    )
    assert approve.status_code == 200
    assert approve.json()["status"] == "dbtApproved"

    disburse = await client.post(
        f"/v1/insurance/provider/claims/{claim_id}/disburse",
        json={"dbtTransactionId": "DBT-E2E-1", "notes": "Paid via DBT"},
        headers=auth(provider),
    )
    assert disburse.status_code == 200
    assert disburse.json()["status"] == "disbursed"
    assert disburse.json()["dbtTransactionId"] == "DBT-E2E-1"

    # 2. Farmer GET shows every stage with timestamps (courier-style tracker).
    detail = await client.get(f"/v1/insurance/claims/{claim_id}", headers=auth(farmer))
    assert detail.status_code == 200
    body = detail.json()
    assert body["status"] == "disbursed"
    stages = {entry["status"] for entry in body["timeline"]}
    assert {"intimated", "surveyorAssigned", "fieldAssessed", "dbtApproved", "disbursed"} <= stages
    assert all(entry["at"] for entry in body["timeline"])
    assert body["submittedAt"]
    assert body["dbtTransactionId"] == "DBT-E2E-1"

    # 3. Cycle time derivable from provider stats.
    stats = await client.get("/v1/insurance/provider/stats", headers=auth(provider))
    assert stats.status_code == 200
    stats_body = stats.json()
    assert stats_body["disbursedClaims"] == 1
    assert stats_body["totalClaimDisbursed"] == 36000.0
    assert "avgCycleTimeHours" in stats_body
    assert stats_body["avgCycleTimeHours"] >= 0

    # 4. audit_logs rows exist for review + disburse.
    assert _claim_audits(user_store, "CLAIM_REVIEW"), "missing CLAIM_REVIEW audit row"
    disburse_audits = _claim_audits(user_store, "CLAIM_DISBURSE")
    assert disburse_audits, "missing CLAIM_DISBURSE audit row"
    assert disburse_audits[0]["actor"] == "provider-e2e"
    assert disburse_audits[0]["amountPaisa"] == 36000 * 100

    # 5. Per-claim processing fee in the settlements ledger (integer paisa).
    fee_key = f"settlements/fee_claim_{claim_id}"
    assert fee_key in user_store
    fee = user_store[fee_key]
    assert fee["kind"] == "CLAIM_PROCESSING_FEE"
    assert fee["grossPaisa"] == 36000 * 100
    assert fee["feePaisa"] == 36000 * 100 * 1 // 100
    assert isinstance(fee["feePaisa"], int)


async def test_rejected_claim_appeal_reenters_queue(client, user_store, monkeypatch):
    _fake_storage(monkeypatch)
    farmer = _farmer(user_store, uid="farmer-rej")
    provider = seed_user(user_store, uid="provider-rej", active_profile="insuranceProvider")
    _seed_policy(user_store, uid="farmer-rej")

    submit = await _submit(client, farmer)
    claim_id = submit.json()["id"]

    reject = await client.post(
        f"/v1/insurance/provider/claims/{claim_id}/review",
        json={"action": "reject", "rejectionReason": "अपर्याप्त फोटो साक्ष्य"},
        headers=auth(provider),
    )
    assert reject.status_code == 200
    assert reject.json()["status"] == "rejected"
    assert _claim_audits(user_store, "CLAIM_REVIEW")[-1]["decision"] == "reject"

    # Farmer appeal → claim re-enters the queue as intimated.
    appeal = await client.post(
        f"/v1/insurance/claims/{claim_id}/appeal",
        json={"reason": APPEAL_REASON},
        headers=auth(farmer),
    )
    assert appeal.status_code == 200
    assert appeal.json()["status"] == "intimated"
    assert appeal.json()["appealCount"] == 1

    queue = await client.get("/v1/insurance/provider/claims?status=intimated", headers=auth(provider))
    assert any(c["id"] == claim_id for c in queue.json()["data"])


async def test_surveyor_roster_scoped_to_provider(client, user_store):
    provider_a = seed_user(user_store, uid="prov-a", active_profile="insuranceProvider")
    provider_b = seed_user(user_store, uid="prov-b", active_profile="insuranceProvider")

    created = await client.post(
        "/v1/insurance/provider/surveyors",
        json={"name": "Meena", "phone": "+919800000001", "districts": ["Pune"]},
        headers=auth(provider_a),
    )
    assert created.status_code == 201
    surveyor_id = created.json()["id"]

    listing = await client.get("/v1/insurance/provider/surveyors", headers=auth(provider_a))
    assert listing.status_code == 200
    assert [s["id"] for s in listing.json()["data"]] == [surveyor_id]

    other = await client.get("/v1/insurance/provider/surveyors", headers=auth(provider_b))
    assert other.json()["total"] == 0

    # Another provider cannot delete it.
    denied = await client.delete(
        f"/v1/insurance/provider/surveyors/{surveyor_id}", headers=auth(provider_b)
    )
    assert denied.status_code == 404

    removed = await client.delete(
        f"/v1/insurance/provider/surveyors/{surveyor_id}", headers=auth(provider_a)
    )
    assert removed.status_code == 204


async def test_sla_clock_data_for_stale_claims(client, user_store, monkeypatch):
    """Task 4.19 — a >48 h-old intimation keeps its (sortable) timestamp and
    stays counted in the provider's pending bucket."""
    _fake_storage(monkeypatch)
    farmer = _farmer(user_store, uid="farmer-sla")
    provider = seed_user(user_store, uid="provider-sla", active_profile="insuranceProvider")
    _seed_policy(user_store, uid="farmer-sla")

    stale = (await _submit(client, farmer)).json()
    fresh = (await _submit(client, farmer)).json()

    # Backdate the first claim's intimation >48 h (SLA clock must still find it).
    stale_doc = user_store[f"insurance_claims/{stale['id']}"]
    stale_doc["submittedAt"] = "2020-01-15T02:00:00+00:00"
    user_store[f"insurance_claims/{stale['id']}"] = stale_doc

    listing = await client.get("/v1/insurance/provider/claims", headers=auth(provider))
    assert listing.status_code == 200
    data = listing.json()["data"]
    rows = {c["id"]: c for c in data}
    assert rows[stale["id"]]["submittedAt"] == "2020-01-15T02:00:00+00:00"
    # Sortable: newest intimation first.
    assert data[0]["id"] == fresh["id"]
    assert data[-1]["id"] == stale["id"]
    assert re.match(r"\d{4}-\d{2}-\d{2}T", rows[stale["id"]]["submittedAt"])

    stats = await client.get("/v1/insurance/provider/stats", headers=auth(provider))
    assert stats.status_code == 200
    assert stats.json()["pendingClaims"] >= 2
