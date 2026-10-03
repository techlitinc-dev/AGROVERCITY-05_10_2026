from datetime import datetime, timedelta, timezone

from tests.test_admin import ADMIN_HEADERS, ADMIN_MUTATION_HEADERS
from tests.test_diary import auth, seed_user

KYC_ADMIN = ADMIN_HEADERS
KYC_ADMIN_MUTATION = ADMIN_MUTATION_HEADERS

FAKE_PDF = b"%PDF-1.4 fake kyc document"


def _case_key(user_store):
    keys = [k for k in user_store if k.startswith("kyc_cases/")]
    assert keys, "no kyc case stored"
    return keys[0]


async def test_submit_case_builds_document_matrix(client, user_store):
    token = seed_user(user_store, uid="uid-kyc1", active_profile="transport")
    resp = await client.post(
        "/v1/kyc/cases",
        json={
            "persona": "transport",
            "docs": [
                {"type": "aadhaar", "storagePath": "kyc/aadhaar.pdf"},
                {"type": "pan", "storagePath": "kyc/pan.pdf"},
                {"type": "bank", "storagePath": "kyc/bank.pdf"},
                {"type": "rc", "storagePath": "kyc/rc.pdf"},
                {"type": "dl", "storagePath": "kyc/dl.pdf"},
            ],
        },
        headers=auth(token),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["requiredDocs"] == ["aadhaar", "pan", "bank", "rc", "dl"]
    case = body["case"]
    assert case["status"] == "pending"
    assert all(doc["status"] == "pending" for doc in case["docs"])

    status = await client.get("/v1/kyc/status", headers=auth(token))
    assert status.status_code == 200
    assert status.json()["total"] == 1


async def test_submit_rejects_docs_outside_matrix(client, user_store):
    token = seed_user(user_store, uid="uid-kyc2", active_profile="transport")
    resp = await client.post(
        "/v1/kyc/cases",
        json={"persona": "transport", "docs": [{"type": "gst", "storagePath": "x.pdf"}]},
        headers=auth(token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "INVALID_DOCUMENT_MATRIX"


async def test_reject_requires_reason_and_reupload_resets_case(client, user_store):
    token = seed_user(user_store, uid="uid-kyc3", active_profile="transport")
    await client.post(
        "/v1/kyc/cases",
        json={
            "persona": "transport",
            "docs": [
                {"type": "rc", "storagePath": "kyc/rc.pdf"},
                {"type": "dl", "storagePath": "kyc/dl.pdf"},
            ],
        },
        headers=auth(token),
    )
    case = user_store[_case_key(user_store)]

    # reject without reason → 422
    no_reason = await client.post(
        f"/v1/admin/kyc/{case['caseId']}:rc/review",
        json={"status": "rejected"},
        headers=KYC_ADMIN_MUTATION,
    )
    assert no_reason.status_code == 422
    assert no_reason.json()["error"]["code"] == "VALIDATION_ERROR"

    rejected = await client.post(
        f"/v1/admin/kyc/{case['caseId']}:rc/review",
        json={"status": "rejected", "rejectionReason": "RC scan unreadable"},
        headers=KYC_ADMIN_MUTATION,
    )
    assert rejected.status_code == 200
    assert rejected.json()["caseStatus"] == "rejected"
    stored = user_store[_case_key(user_store)]
    assert stored["status"] == "rejected"
    assert stored["docs"][0]["reason"] == "RC scan unreadable"

    # re-upload moves the case back to pending
    upload = await client.post(
        f"/v1/kyc/cases/{case['caseId']}/docs/{case['caseId']}:rc/upload",
        files={"file": ("rc.pdf", FAKE_PDF, "application/pdf")},
        headers=auth(token),
    )
    assert upload.status_code == 201
    assert upload.json()["case"]["status"] == "pending"
    assert upload.json()["case"]["docs"][0]["status"] == "pending"


async def test_full_verify_flips_case_and_overview_count(client, user_store):
    token = seed_user(user_store, uid="uid-kyc4", active_profile="transport")
    await client.post(
        "/v1/kyc/cases",
        json={
            "persona": "transport",
            "docs": [
                {"type": "rc", "storagePath": "kyc/rc.pdf"},
                {"type": "dl", "storagePath": "kyc/dl.pdf"},
            ],
        },
        headers=auth(token),
    )
    case = user_store[_case_key(user_store)]
    assert case["status"] == "pending"

    overview = await client.get("/v1/admin/overview", headers=KYC_ADMIN)
    assert overview.json()["pendingKycCount"] == 2

    for doc_type in ("rc", "dl"):
        reviewed = await client.post(
            f"/v1/admin/kyc/{case['caseId']}:{doc_type}/review",
            json={"status": "verified"},
            headers=KYC_ADMIN_MUTATION,
        )
        assert reviewed.status_code == 200
    stored = user_store[_case_key(user_store)]
    assert stored["status"] == "verified"
    assert all(doc["status"] == "verified" for doc in stored["docs"])

    overview = await client.get("/v1/admin/overview", headers=KYC_ADMIN)
    assert overview.json()["pendingKycCount"] == 0


async def test_expiry_reminder_job_notifies_30_days_before(client, user_store):
    expiring = (datetime.now(timezone.utc) + timedelta(days=10)).isoformat()
    far_away = (datetime.now(timezone.utc) + timedelta(days=120)).isoformat()
    user_store["kyc_cases/kyc_uid-kyc5_transport"] = {
        "caseId": "kyc_uid-kyc5_transport",
        "userId": "uid-kyc5",
        "persona": "transport",
        "docs": [
            {"docId": "kyc_uid-kyc5_transport:dl", "type": "dl", "status": "verified", "expiresAt": expiring, "reverifyRequired": True},
            {"docId": "kyc_uid-kyc5_transport:rc", "type": "rc", "status": "verified", "expiresAt": far_away},
        ],
        "status": "verified",
        "submittedAt": "2026-10-01T00:00:00+00:00",
    }
    resp = await client.post("/v1/jobs/kyc/expiry-reminders")
    assert resp.status_code == 200
    assert resp.json()["reminded"] == 1
    notifications = [k for k in user_store if k.startswith("notifications/")]
    assert notifications
