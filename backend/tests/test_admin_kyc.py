"""Phase-07 WS-02 — KYC extraction + risk triage and admin KYC endpoints."""
import json
import os

from app.services.ai import gateway, kyc_schemas
from app.services.tokens import create_access_token
from tests.test_admin import admin_headers, _seed_admin
from tests.test_diary import auth, seed_user

GOLDEN_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "fixtures", "ai", "golden")
)
PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * (1024 - 8)


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
    monkeypatch.setattr("app.services.storage.delete_blob", lambda blob_path: None)


def _golden_files():
    return [f for f in sorted(os.listdir(GOLDEN_DIR)) if f.startswith("kyc_") and f.endswith(".json")]


async def test_golden_extraction_precision_on_shim(monkeypatch):
    matched = total = 0
    for name in _golden_files():
        with open(os.path.join(GOLDEN_DIR, name), encoding="utf-8") as handle:
            fixture = json.load(handle)
        doc_type = fixture["docType"]
        raw = await gateway.analyze_image(
            PNG_BYTES,
            prompt=f"KYC extraction for {doc_type}",
            schema=kyc_schemas.schema_defaults(doc_type),
            module="kyc_extract",
        )
        for key, value in fixture["expected"].items():
            total += 1
            if raw.get(key) == value:
                matched += 1
    assert total > 0
    assert matched / total >= 0.9


async def test_low_risk_auto_advances(client, user_store, monkeypatch):
    _fake_storage(monkeypatch)
    token = seed_user(user_store, uid="u-adv", name="Test User", dob="1990-01-01")
    resp = await client.post(
        "/v1/vault/documents",
        files={"file": ("aadhaar.png", PNG_BYTES, "image/png")},
        data={"docType": "aadhaar"},
        headers=auth(token),
    )
    assert resp.status_code == 201
    doc = user_store[f"users/u-adv/vault_documents/{resp.json()['id']}"]
    assert doc["status"] == "verified-pending-bank"
    assert float(doc["riskScore"]) < 0.3


async def test_higher_risk_lands_in_human_queue(client, user_store, monkeypatch):
    _fake_storage(monkeypatch)
    token = seed_user(user_store, uid="u-queue", name="Ram Patil")
    resp = await client.post(
        "/v1/vault/documents",
        files={"file": ("aadhaar.png", PNG_BYTES, "image/png")},
        data={"docType": "aadhaar"},
        headers=auth(token),
    )
    assert resp.status_code == 201
    doc = user_store[f"users/u-queue/vault_documents/{resp.json()['id']}"]
    assert doc["status"] != "verified-pending-bank"
    assert float(doc["riskScore"]) >= 0.3
    assert doc["riskReasons"]


async def test_no_unmasked_aadhaar_anywhere(client, user_store, monkeypatch):
    import re

    _fake_storage(monkeypatch)
    token = seed_user(user_store, uid="u-mask")
    await client.post(
        "/v1/vault/documents",
        files={"file": ("aadhaar.png", PNG_BYTES, "image/png")},
        data={"docType": "aadhaar"},
        headers=auth(token),
    )
    # Vault docs (all fields) + the AI *answers* (not hex decision ids/hashes,
    # which can coincidentally contain digit runs).
    for key, doc in user_store.items():
        if "vault_documents" in key:
            assert not re.search(r"\d{12}", json.dumps(doc)), doc
        if key.startswith("ai_decisions/"):
            answers = doc.get("answers") or {}
            assert not re.search(r"\d{12}", json.dumps(answers)), answers
    masked = [
        d
        for k, d in user_store.items()
        if "vault_documents" in k
    ]
    assert masked and masked[0]["extracted"]["maskedAadhaar"] == "XXXX-XXXX-1234"


async def test_verify_and_reject_endpoints_write_audit(client, user_store):
    admin_token = _seed_admin(user_store)
    user_store["kyc_cases/kyc_uid-kyc9_transport"] = {
        "caseId": "kyc_uid-kyc9_transport",
        "userId": "uid-kyc9",
        "persona": "transport",
        "docs": [
            {"docId": "kyc_uid-kyc9_transport:rc", "type": "rc", "status": "pending"},
            {"docId": "kyc_uid-kyc9_transport:dl", "type": "dl", "status": "pending"},
        ],
        "status": "pending",
        "submittedAt": "2026-10-01T00:00:00+00:00",
    }
    pending = await client.get("/v1/admin/kyc/pending", headers=admin_headers(admin_token))
    assert pending.status_code == 200
    assert pending.json()["total"] == 2

    resp = await client.post(
        "/v1/admin/kyc/kyc_uid-kyc9_transport:rc/verify", headers=admin_headers(admin_token)
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "verified"

    resp = await client.post(
        "/v1/admin/kyc/kyc_uid-kyc9_transport:dl/reject",
        json={"rejectionReason": "illegible scan"},
        headers=admin_headers(admin_token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "rejected"

    audits = [d for k, d in user_store.items() if k.startswith("audit_logs/")]
    assert any(a.get("module") == "kyc" for a in audits)


async def test_finance_admin_forbidden_on_kyc(client, user_store):
    user_store["users/uid-finance"] = {
        "id": "uid-finance",
        "isAdmin": True,
        "adminRole": "finance_admin",
        "activeProfile": "admin",
    }
    token = create_access_token("uid-finance")
    resp = await client.get("/v1/admin/kyc/pending", headers=auth(token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ADMIN_ROLE"
