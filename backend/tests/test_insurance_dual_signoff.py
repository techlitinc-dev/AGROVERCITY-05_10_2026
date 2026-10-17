"""P0-14 / SOP-15 §6.3 — dual sign-off on large claim payouts.

Provider desk controls: approving a payout above ₹50,000 must NOT finalize —
it creates an admin_approvals request, leaves the claim
`pending_second_signoff`, and blocks disbursement (409 PAYOUT_APPROVAL_REQUIRED)
until a second admin approves. Under-threshold flows are unchanged.
"""
from app.data.insurance_seed import RATES
from app.services.tokens import create_access_token
from tests.test_admin import admin_headers
from tests.test_diary import auth, seed_user

APPLY_DATA = {
    "cropName": "Wheat",
    "season": "Kharif",
    "landAreaAcres": 3.0,
    "category": "crop",
    "schemeName": "PMFBY",
    "khasraNumber": "142/2A",
}


def _seed_rates(user_store):
    for rate in RATES:
        user_store[f"insurance_rates/{rate['id']}"] = dict(rate)


def _fake_storage(monkeypatch):
    monkeypatch.setattr(
        "app.services.storage.upload_user_file",
        lambda uid, data, filename, content_type, prefix="claims": (f"claims/{uid}/{filename}", len(data)),
    )
    monkeypatch.setattr(
        "app.services.storage.signed_download_url",
        lambda blob_path, minutes=60: f"https://storage.example/{blob_path}",
    )


async def _drive_to_field_assessed(client, user_store, monkeypatch, uid="farmer-9"):
    """Real-API setup: policy apply → claim intimation → survey → fieldAssessed."""
    _seed_rates(user_store)
    _fake_storage(monkeypatch)
    farmer_token = seed_user(user_store, uid=uid, active_profile="farmer")
    provider_token = create_access_token("provider-9")
    seed_user(user_store, uid="provider-9", active_profile="insuranceProvider")

    policy_id = (
        await client.post("/v1/insurance/policies/apply", json=APPLY_DATA, headers=auth(farmer_token))
    ).json()["id"]

    claim_id = (
        await client.post(
            "/v1/insurance/claims",
            data={
                "policyId": policy_id,
                "cropName": "Wheat",
                "calamityType": "hailstorm",
                "dateOfDamage": "2026-09-15",
                "cropStage": "flowering",
                "estimatedLossPercent": "40.0",
                "gpsCoordinates": "20.0,73.8",
                "village": "Ozarkhed",
            },
            files={"damagePhotos": ("damage.jpg", b"fake-jpg", "image/jpeg")},
            headers=auth(farmer_token),
        )
    ).json()["id"]

    await client.post(
        f"/v1/insurance/provider/claims/{claim_id}/schedule_survey",
        json={
            "surveyorName": "सुरेश देशमुख",
            "surveyorPhone": "+919822000000",
            "surveyorVisitDate": "2026-09-22",
        },
        headers=auth(provider_token),
    )
    report = await client.post(
        f"/v1/insurance/provider/claims/{claim_id}/survey_report",
        json={"assessedLossPercent": 45.0, "cropStageVerified": "flowering"},
        headers=auth(provider_token),
    )
    assert report.status_code == 200
    assert report.json()["status"] == "fieldAssessed"
    return farmer_token, provider_token, claim_id


async def test_under_threshold_approve_and_disburse_unchanged(client, user_store, monkeypatch):
    _, provider_token, claim_id = await _drive_to_field_assessed(client, user_store, monkeypatch)

    appr_resp = await client.post(
        f"/v1/insurance/provider/claims/{claim_id}/review",
        json={"action": "approve", "approvedAmount": 40000.0, "notes": "under-threshold payout"},
        headers=auth(provider_token),
    )
    assert appr_resp.status_code == 200
    body = appr_resp.json()
    assert body["status"] == "dbtApproved"
    assert body["approvedAmount"] == 40000.0
    assert "requiresApproval" not in body

    disb_resp = await client.post(
        f"/v1/insurance/provider/claims/{claim_id}/disburse",
        json={"dbtTransactionId": "DBT-UNDER-50K"},
        headers=auth(provider_token),
    )
    assert disb_resp.status_code == 200
    assert disb_resp.json()["status"] == "disbursed"
    assert disb_resp.json()["dbtTransactionId"] == "DBT-UNDER-50K"


async def test_over_threshold_review_requires_approval_and_blocks_disburse(client, user_store, monkeypatch):
    farmer_uid = "farmer-9"
    _, provider_token, claim_id = await _drive_to_field_assessed(client, user_store, monkeypatch, uid=farmer_uid)

    appr_resp = await client.post(
        f"/v1/insurance/provider/claims/{claim_id}/review",
        json={"action": "approve", "approvedAmount": 60000.0, "notes": "large payout"},
        headers=auth(provider_token),
    )
    assert appr_resp.status_code == 200
    body = appr_resp.json()
    assert body["requiresApproval"] is True
    approval_id = body["approvalId"]
    assert approval_id

    # Claim is NOT finalized: stays fieldAssessed, flagged pending_second_signoff.
    assert body["status"] == "fieldAssessed"
    assert body["approvedAmount"] == 60000.0
    stored = user_store[f"insurance_claims/{claim_id}"]
    assert stored["status"] == "fieldAssessed"
    assert stored["payoutApprovalStatus"] == "pending_second_signoff"
    assert stored["payoutApprovalId"] == approval_id
    farmer_copy = user_store[f"users/{farmer_uid}/insurance_claims/{claim_id}"]
    assert farmer_copy["payoutApprovalStatus"] == "pending_second_signoff"

    # The maker-checker request is recorded with the payout amount in paisa.
    approval = user_store[f"admin_approvals/{approval_id}"]
    assert approval["module"] == "insurance"
    assert approval["action"] == "claim-payout"
    assert approval["status"] == "pending"
    assert approval["payload"]["amountPaise"] == 6_000_000
    assert approval["payload"]["targetId"] == claim_id

    # Disbursement is blocked while the second sign-off is pending.
    disb_resp = await client.post(
        f"/v1/insurance/provider/claims/{claim_id}/disburse",
        json={"dbtTransactionId": "DBT-BLOCKED"},
        headers=auth(provider_token),
    )
    assert disb_resp.status_code == 409
    assert disb_resp.json()["error"]["code"] == "PAYOUT_APPROVAL_REQUIRED"


async def test_payout_approval_request_is_explicit_idempotent_trigger(client, user_store, monkeypatch):
    _, provider_token, claim_id = await _drive_to_field_assessed(client, user_store, monkeypatch)

    appr_resp = await client.post(
        f"/v1/insurance/provider/claims/{claim_id}/review",
        json={"action": "approve", "approvedAmount": 60000.0},
        headers=auth(provider_token),
    )
    approval_id = appr_resp.json()["approvalId"]

    # Explicit trigger returns the same pending approval instead of duplicating it.
    trig_resp = await client.post(
        f"/v1/insurance/provider/claims/{claim_id}/payout-approval-request",
        json={"notes": "requesting second signature"},
        headers=auth(provider_token),
    )
    assert trig_resp.status_code == 200
    assert trig_resp.json()["requiresApproval"] is True
    assert trig_resp.json()["approvalId"] == approval_id
    approvals_for_claim = [
        d for d in user_store.values()
        if d.get("module") == "insurance"
        and d.get("action") == "claim-payout"
        and (d.get("payload") or {}).get("targetId") == claim_id
    ]
    assert len(approvals_for_claim) == 1


async def test_payout_approval_request_under_threshold_409(client, user_store, monkeypatch):
    _, provider_token, claim_id = await _drive_to_field_assessed(client, user_store, monkeypatch)

    await client.post(
        f"/v1/insurance/provider/claims/{claim_id}/review",
        json={"action": "approve", "approvedAmount": 40000.0},
        headers=auth(provider_token),
    )
    trig_resp = await client.post(
        f"/v1/insurance/provider/claims/{claim_id}/payout-approval-request",
        json={},
        headers=auth(provider_token),
    )
    assert trig_resp.status_code == 409
    assert trig_resp.json()["error"]["code"] == "APPROVAL_NOT_REQUIRED"


async def test_admin_second_signoff_releases_payout_then_disburse_ok(client, user_store, monkeypatch):
    farmer_uid = "farmer-9"
    _, provider_token, claim_id = await _drive_to_field_assessed(client, user_store, monkeypatch, uid=farmer_uid)

    appr_resp = await client.post(
        f"/v1/insurance/provider/claims/{claim_id}/review",
        json={"action": "approve", "approvedAmount": 60000.0},
        headers=auth(provider_token),
    )
    approval_id = appr_resp.json()["approvalId"]

    approve_resp = await client.post(
        f"/v1/admin/insurance/claim-payout-approvals/{approval_id}/approve",
        headers=admin_headers(),
    )
    assert approve_resp.status_code == 200
    assert approve_resp.json()["approval"]["status"] == "approved"

    # Approval consumed: the claim is released to dbtApproved for the provider.
    stored = user_store[f"insurance_claims/{claim_id}"]
    assert stored["status"] == "dbtApproved"
    assert stored["payoutApprovalStatus"] == "approved"
    assert stored["payoutApprovedBy"] == "uid-admin-test"
    assert user_store[f"users/{farmer_uid}/insurance_claims/{claim_id}"]["status"] == "dbtApproved"

    disb_resp = await client.post(
        f"/v1/insurance/provider/claims/{claim_id}/disburse",
        json={"dbtTransactionId": "DBT-AFTER-SIGNOFF"},
        headers=auth(provider_token),
    )
    assert disb_resp.status_code == 200
    assert disb_resp.json()["status"] == "disbursed"
    assert disb_resp.json()["dbtTransactionId"] == "DBT-AFTER-SIGNOFF"

    # The approval cannot be approved twice.
    again = await client.post(
        f"/v1/admin/insurance/claim-payout-approvals/{approval_id}/approve",
        headers=admin_headers(),
    )
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "APPROVAL_ALREADY_DECIDED"


async def test_claim_payout_approval_requires_admin(client, user_store, monkeypatch):
    farmer_token, provider_token, claim_id = await _drive_to_field_assessed(
        client, user_store, monkeypatch, uid="farmer-9"
    )
    appr_resp = await client.post(
        f"/v1/insurance/provider/claims/{claim_id}/review",
        json={"action": "approve", "approvedAmount": 60000.0},
        headers=auth(provider_token),
    )
    approval_id = appr_resp.json()["approvalId"]

    # A non-admin (the farmer, or the provider who requested it) cannot sign off.
    resp = await client.post(
        f"/v1/admin/insurance/claim-payout-approvals/{approval_id}/approve",
        headers=auth(farmer_token),
    )
    assert resp.status_code in (401, 403)
    assert user_store[f"insurance_claims/{claim_id}"]["status"] == "fieldAssessed"

    # The requesting provider cannot approve their own request either (the
    # approvals service rejects requester == approver with 403).
    own = await client.post(
        f"/v1/admin/approvals/{approval_id}/approve",
        headers={**auth(provider_token), "X-Audit-Reason": "self approve", "X-Admin-Role": "superadmin"},
    )
    assert own.status_code in (401, 403)
