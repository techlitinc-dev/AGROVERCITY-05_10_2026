"""Sandbox.co.in DigiLocker integration — sync, document pull + storage.

Covers: Aadhaar offline-KYC XML parsing (masked-only), profile identity
fallback, the poll-driven sync (open → succeeded/failed/expired), the
oauth-callback redirect (force sync, cancel, replay protection), document
storage in the kyc_documents collection, the owner-only documents listing,
foreign-session denial, and the mock/sandbox endpoint separation.
"""
import json

import pytest

from app.core.config import settings
from app.services import digilocker, kyc_documents, kyc_sessions
from tests.test_diary import auth

NEW_PHONE = "+919876540001"

AADHAAR_XML = b"""<?xml version="1.0" encoding="UTF-8"?>
<OfflineKyc xmlns="http://www.uidai.gov.in/offlinekyc" referenceId="20261030" createdOn="2026-10-30T00:00:00" status="1" code="provider-code">
  <UidData uid="XXXXXXXX7890">
    <Poi name="Ram Patil" dob="1990-04-12" gender="M" phone="" email=""/>
    <Poa country="India" dist="Nashik" house="312" pc="422209" state="Maharashtra" street="MG Road" vtc="Pimpalgaon Baswant" loc=""/>
    <Photo>QUJDREVGRw==</Photo>
  </UidData>
</OfflineKyc>
"""

PAN_PDF = b"%PDF-1.4 fake pan content"
AADHAAR_FILE_URL = "https://s3.example.com/aadhaar.xml?signature=abc"
PAN_FILE_URL = "https://s3.example.com/pan.pdf?signature=def"


class FakeSandbox:
    """Scripted Sandbox.co.in client double."""

    def __init__(self, monkeypatch):
        self.status = {"status": "created"}
        self.profile = {}
        self.doc_lists = {}
        self.files = {}
        self.status_calls = 0
        self.profile_calls = 0
        self.doc_calls = []
        self.init_calls = 0

        async def fake_init(redirect_url, doc_types, purpose, requestor_name):
            self.init_calls += 1
            return {
                "authorization_url": "https://digilocker.meripehchaan.gov.in/public/oauth2/1/authorize?state=fake",
                "session_id": f"sb-{self.init_calls}",
            }

        async def fake_status(sandbox_session_id):
            self.status_calls += 1
            if isinstance(self.status, digilocker.DigiLockerError):
                raise self.status
            return self.status

        async def fake_profile(sandbox_session_id):
            self.profile_calls += 1
            if isinstance(self.profile, digilocker.DigiLockerError):
                raise self.profile
            return self.profile

        async def fake_docs(sandbox_session_id, doc_type):
            self.doc_calls.append(doc_type)
            if isinstance(self.doc_lists.get(doc_type), digilocker.DigiLockerError):
                raise self.doc_lists[doc_type]
            return self.doc_lists.get(doc_type, [])

        async def fake_download(url):
            if isinstance(self.files.get(url), digilocker.DigiLockerError):
                raise self.files[url]
            return self.files[url]

        monkeypatch.setattr(digilocker, "init_session", fake_init)
        monkeypatch.setattr(digilocker, "get_session_status", fake_status)
        monkeypatch.setattr(digilocker, "get_user_profile", fake_profile)
        monkeypatch.setattr(digilocker, "get_documents", fake_docs)
        monkeypatch.setattr(digilocker, "download_file", fake_download)

        def fake_upload(uid, data, filename, content_type, prefix="vault"):
            return f"{prefix}/{uid}/{filename}", len(data)

        from app.services import storage

        monkeypatch.setattr(storage, "upload_user_file", fake_upload)


@pytest.fixture
def sandbox_env(monkeypatch):
    monkeypatch.setattr(settings, "kyc_provider", "sandbox")
    monkeypatch.setattr(settings, "sandbox_api_key", "test-key")
    monkeypatch.setattr(settings, "sandbox_api_secret", "test-secret")
    monkeypatch.setattr(settings, "sandbox_api_redirect_base", "https://api.example.com")
    return FakeSandbox(monkeypatch)


async def _otp_login(client, phone):
    sent = await client.post("/v1/auth/otp/send", json={"phone": phone})
    assert sent.status_code == 200
    verified = await client.post(
        "/v1/auth/otp/verify", json={"phone": phone, "otp": sent.json()["devOtp"]}
    )
    assert verified.status_code == 200
    return verified.json()["accessToken"]


async def _start_registration(client, phone=NEW_PHONE):
    access = await _otp_login(client, phone)
    profile = await client.post(
        "/v1/auth/registration/profile",
        json={
            "name": "Ram Patil",
            "persona": "farmer",
            "state": "Maharashtra",
            "district": "Nashik",
            "village": "Pimpalgaon Baswant",
            "mpin": "4321",
        },
        headers=auth(access),
    )
    assert profile.status_code == 200
    return access


async def _create_session(client, access):
    created = await client.post(
        "/v1/kyc/sessions",
        json={"context": "registration", "consentAccepted": True},
        headers=auth(access),
    )
    assert created.status_code == 201
    return created.json()["session"]


def _consent_succeeded(fake: FakeSandbox):
    fake.status = {"status": "succeeded", "documents_consented": ["aadhaar", "pan"]}
    fake.profile = {
        "id": "dl-123",
        "name": "Ram Patil",
        "date_of_birth": 639878400000,
        "gender": "male",
        "mobile": "9987654001",
        "email": "ram@example.com",
        "eaadhaar": True,
    }
    fake.doc_lists = {
        "aadhaar": [
            {
                "url": AADHAAR_FILE_URL,
                "size": len(AADHAAR_XML),
                "metadata": {
                    "ContentType": "application/xml",
                    "issuer_id": "in.gov.uidai",
                    "issuer": "Unique Identification Authority of India (UIDAI)",
                    "description": "Aadhaar",
                },
            }
        ],
        "pan": [
            {
                "url": PAN_FILE_URL,
                "size": len(PAN_PDF),
                "metadata": {
                    "ContentType": "application/pdf",
                    "issuer_id": "in.gov.incometax",
                    "issuer": "Income Tax Department",
                    "description": "PAN Card",
                },
            }
        ],
    }
    fake.files = {
        AADHAAR_FILE_URL: (AADHAAR_XML, "application/xml"),
        PAN_FILE_URL: (PAN_PDF, "application/pdf"),
    }


def _age_last_sync(user_store, session_id):
    stored = user_store[f"kyc_sessions/{session_id}"]
    stored["lastSandboxSyncAt"] = "2020-01-01T00:00:00+00:00"
    user_store[f"kyc_sessions/{session_id}"] = stored


# ------------------------------------------------------------------ xml unit


def test_parse_aadhaar_xml_extracts_masked_identity():
    parsed = digilocker.parse_aadhaar_xml(AADHAAR_XML)
    assert parsed is not None
    assert parsed["maskedAadhaar"] == "XXXXXXXX7890"
    assert parsed["fullName"] == "Ram Patil"
    assert parsed["dob"] == "1990-04-12"
    assert parsed["gender"] == "M"
    assert "Nashik" in parsed["address"]
    assert parsed["photoBase64"] == "QUJDREVGRw=="


def test_parse_aadhaar_xml_masks_unmasked_uid_and_rejects_non_aadhaar():
    raw = AADHAAR_XML.replace(b'uid="XXXXXXXX7890"', b'uid="123456789012"')
    parsed = digilocker.parse_aadhaar_xml(raw)
    assert parsed["maskedAadhaar"] == "XXXXXXXX9012"
    assert digilocker.parse_aadhaar_xml(b"%PDF-1.4 not xml") is None
    assert digilocker.parse_aadhaar_xml(b"<Root><Other/></Root>") is None


def test_identity_from_profile_normalizes_dob_epoch_ms():
    identity = digilocker.identity_from_profile(
        {"id": "dl-1", "name": "Profile Name", "date_of_birth": 639878400000, "gender": "male", "mobile": "9987654001"}
    )
    assert identity["fullName"] == "Profile Name"
    assert identity["dob"] == "1990-04-12"
    assert identity["gender"] == "male"
    assert identity["digilockerId"] == "dl-1"
    assert identity["maskedAadhaar"] == ""


# ------------------------------------------------------------------- syncing


async def test_poll_syncs_and_pulls_documents_then_completes_registration(
    client, user_store, sandbox_env
):
    access = await _start_registration(client)
    session = await _create_session(client, access)
    assert session["provider"] == "sandbox"
    assert "meripehchaan.gov.in" in session["authorizationUrl"]
    assert sandbox_env.init_calls == 1

    # First poll while the user is still on the DigiLocker page: stays open.
    poll = await client.get(f"/v1/kyc/sessions/{session['id']}", headers=auth(access))
    assert poll.json()["session"]["status"] == "created"

    # Consent completes upstream; the next poll (throttle aged) reconciles.
    _consent_succeeded(sandbox_env)
    _age_last_sync(user_store, session["id"])
    poll = await client.get(f"/v1/kyc/sessions/{session['id']}", headers=auth(access))
    done = poll.json()["session"]
    assert done["status"] == "verified"
    assert done["verifiedName"] == "Ram Patil"
    assert done["maskedAadhaar"] == "XXXXXXXX7890"

    # Both pulled documents were stored; Aadhaar carries masked extractions
    # and the photo was stored; no raw Aadhaar anywhere.
    records = [v for k, v in user_store.items() if k.startswith("kyc_documents/")]
    assert len(records) == 2
    aadhaar = next(r for r in records if r["isAadhaar"])
    assert aadhaar["extracted"]["maskedAadhaar"] == "XXXXXXXX7890"
    assert aadhaar["extracted"]["fullName"] == "Ram Patil"
    assert aadhaar["storagePath"].startswith("digilocker/")
    assert aadhaar["issuerId"] == "in.gov.uidai"
    pan = next(r for r in records if not r["isAadhaar"])
    assert pan["docType"] == "pan"
    assert not pan["isAadhaar"]
    for stored in (done, *records):
        assert "123456789012" not in json.dumps(stored)
    # The Aadhaar photo from the XML was stored and referenced on the identity.
    stored_session = user_store[f"kyc_sessions/{session['id']}"]
    assert stored_session["identity"]["photoPath"].endswith("aadhaar_photo.jpg")

    # Owner listing exposes signed file urls + masked extraction.
    listing = await client.get(
        f"/v1/kyc/sessions/{session['id']}/documents", headers=auth(access)
    )
    assert listing.status_code == 200
    docs = listing.json()["documents"]
    assert len(docs) == 2
    assert any(d["isAadhaar"] and d["extracted"]["maskedAadhaar"] == "XXXXXXXX7890" for d in docs)

    # Registration completion is unchanged: sandbox + signature verified.
    complete = await client.post(
        "/v1/auth/registration/complete",
        json={"sessionId": session["id"]},
        headers=auth(access),
    )
    assert complete.status_code == 200
    user = complete.json()["user"]
    assert user["registrationStatus"] == "completed"
    assert user["kycStatus"] == "verified"
    assert user["verificationMode"] == "sandbox"
    assert user["maskedAadhaar"] == "XXXXXXXX7890"


async def test_poll_throttles_upstream_status_calls(client, user_store, sandbox_env):
    access = await _start_registration(client)
    session = await _create_session(client, access)
    calls_before = sandbox_env.status_calls
    for _ in range(3):
        await client.get(f"/v1/kyc/sessions/{session['id']}", headers=auth(access))
    # Sync ran once (first poll); the next two were throttled in-process.
    assert sandbox_env.status_calls == calls_before + 1


async def test_upstream_failed_and_expired_states_fail_session(
    client, user_store, sandbox_env
):
    access = await _start_registration(client)
    session = await _create_session(client, access)

    sandbox_env.status = {"status": "failed"}
    res = await client.get(
        f"/v1/kyc/sessions/oauth/callback?s={session['id']}", follow_redirects=False
    )
    assert res.status_code == 303
    poll = await client.get(f"/v1/kyc/sessions/{session['id']}", headers=auth(access))
    assert poll.json()["session"]["status"] == "failed"

    # Expired upstream (access token no longer valid) also fails the session.
    access2 = await _start_registration(client, phone="+919876540099")
    retry = await _create_session(client, access2)
    sandbox_env.status = {"status": "expired"}
    await client.get(
        f"/v1/kyc/sessions/oauth/callback?s={retry['id']}", follow_redirects=False
    )
    poll = await client.get(f"/v1/kyc/sessions/{retry['id']}", headers=auth(access2))
    assert poll.json()["session"]["status"] == "failed"
    assert poll.json()["session"]["error"] == "session_expired_upstream"

    # A failed session cannot complete.
    complete = await client.post(
        "/v1/auth/registration/complete",
        json={"sessionId": retry["id"]},
        headers=auth(access2),
    )
    assert complete.status_code == 409


async def test_status_poll_error_keeps_session_open(client, user_store, sandbox_env):
    access = await _start_registration(client)
    session = await _create_session(client, access)
    sandbox_env.status = digilocker.DigiLockerError("SANDBOX_STATUS_FAILED", "boom")

    res = await client.get(
        f"/v1/kyc/sessions/oauth/callback?s={session['id']}", follow_redirects=False
    )
    assert res.status_code == 303
    poll = await client.get(f"/v1/kyc/sessions/{session['id']}", headers=auth(access))
    assert poll.json()["session"]["status"] == "created"


async def test_no_aadhaar_anywhere_fails_session(client, user_store, sandbox_env):
    access = await _start_registration(client)
    session = await _create_session(client, access)
    _consent_succeeded(sandbox_env)
    # Profile without any Aadhaar reference and the Aadhaar XML absent.
    sandbox_env.profile = {"id": "dl-9", "name": "No Aadhaar User"}
    sandbox_env.doc_lists["aadhaar"] = []
    sandbox_env.files.pop(AADHAAR_FILE_URL)

    await client.get(
        f"/v1/kyc/sessions/oauth/callback?s={session['id']}", follow_redirects=False
    )
    poll = await client.get(f"/v1/kyc/sessions/{session['id']}", headers=auth(access))
    failed = poll.json()["session"]
    assert failed["status"] == "failed"
    assert failed["error"] == "AADHAAR_NOT_AVAILABLE"


async def test_profile_identity_fallback_when_aadhaar_xml_missing(
    client, user_store, sandbox_env
):
    access = await _start_registration(client)
    session = await _create_session(client, access)
    # Succeeded with only PAN consented. The profile has no Aadhaar reference
    # (Sandbox's `eaadhaar` is a boolean flag), so registration KYC must fail:
    # a verified identity requires an Aadhaar source.
    sandbox_env.status = {"status": "succeeded", "documents_consented": ["pan"]}
    sandbox_env.profile = {
        "id": "dl-7",
        "name": "Token Fallback",
        "date_of_birth": 639878400000,
        "gender": "female",
        "eaadhaar": True,
    }
    sandbox_env.doc_lists = {
        "pan": [
            {
                "url": PAN_FILE_URL,
                "size": len(PAN_PDF),
                "metadata": {
                    "ContentType": "application/pdf",
                    "issuer_id": "in.gov.incometax",
                    "issuer": "Income Tax Department",
                    "description": "PAN Card",
                },
            }
        ]
    }
    sandbox_env.files = {PAN_FILE_URL: (PAN_PDF, "application/pdf")}

    await client.get(
        f"/v1/kyc/sessions/oauth/callback?s={session['id']}", follow_redirects=False
    )
    poll = await client.get(f"/v1/kyc/sessions/{session['id']}", headers=auth(access))
    assert poll.json()["session"]["status"] == "failed"
    assert poll.json()["session"]["error"] == "AADHAAR_NOT_AVAILABLE"
    # The PAN document was still stored for the record.
    records = [v for k, v in user_store.items() if k.startswith("kyc_documents/")]
    assert len(records) == 1
    assert records[0]["docType"] == "pan"
    assert records[0]["issuer"] == "Income Tax Department"


async def test_oauth_callback_cancel_marks_denied(client, user_store, sandbox_env):
    access = await _start_registration(client)
    session = await _create_session(client, access)

    res = await client.get(
        f"/v1/kyc/sessions/oauth/callback?s={session['id']}&action=cancel",
        follow_redirects=False,
    )
    assert res.status_code == 303
    assert res.headers["location"] == session["returnTo"]
    poll = await client.get(f"/v1/kyc/sessions/{session['id']}", headers=auth(access))
    assert poll.json()["session"]["status"] == "denied"
    assert poll.json()["session"]["error"] == "consent_denied"


async def test_oauth_callback_replayed_redirect_does_not_resync(
    client, user_store, sandbox_env
):
    access = await _start_registration(client)
    session = await _create_session(client, access)
    _consent_succeeded(sandbox_env)

    first = await client.get(
        f"/v1/kyc/sessions/oauth/callback?s={session['id']}", follow_redirects=False
    )
    assert first.status_code == 303
    status_calls = sandbox_env.status_calls
    replay = await client.get(
        f"/v1/kyc/sessions/oauth/callback?s={session['id']}", follow_redirects=False
    )
    assert replay.status_code == 303
    assert sandbox_env.status_calls == status_calls  # terminal sessions never re-sync
    poll = await client.get(f"/v1/kyc/sessions/{session['id']}", headers=auth(access))
    assert poll.json()["session"]["status"] == "verified"


async def test_oauth_callback_rejects_unknown_session(client, user_store, sandbox_env):
    res = await client.get(
        "/v1/kyc/sessions/oauth/callback?s=kycs_missing", follow_redirects=False
    )
    assert res.status_code == 404


async def test_oauth_callback_rejects_mock_sessions(client, user_store, monkeypatch):
    # Default provider is mock — no sandbox_env fixture here.
    access = await _start_registration(client)
    session = await _create_session(client, access)
    assert session["provider"] == "mock"

    res = await client.get(
        f"/v1/kyc/sessions/oauth/callback?s={session['id']}", follow_redirects=False
    )
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "KYC_PROVIDER_NOT_SANDBOX"


async def test_refresh_rotates_to_a_fresh_sandbox_session(
    client, user_store, sandbox_env
):
    access = await _start_registration(client)
    session = await _create_session(client, access)
    assert sandbox_env.init_calls == 1

    refreshed = await client.post(
        f"/v1/kyc/sessions/{session['id']}/refresh", headers=auth(access)
    )
    fresh = refreshed.json()["session"]
    assert fresh["status"] == "created"
    assert sandbox_env.init_calls == 2
    stored = user_store[f"kyc_sessions/{session['id']}"]
    assert stored["sandboxSessionId"] == "sb-2"


async def test_documents_listing_rejects_foreign_sessions(client, user_store, sandbox_env):
    access = await _start_registration(client)
    session = await _create_session(client, access)
    other = await _start_registration(client, phone="+919876540097")
    _consent_succeeded(sandbox_env)
    await client.get(
        f"/v1/kyc/sessions/oauth/callback?s={session['id']}", follow_redirects=False
    )

    foreign = await client.get(
        f"/v1/kyc/sessions/{session['id']}/documents", headers=auth(other)
    )
    assert foreign.status_code == 403


async def test_create_session_fails_when_redirect_base_unconfigured(
    client, user_store, monkeypatch
):
    monkeypatch.setattr(settings, "kyc_provider", "sandbox")
    monkeypatch.setattr(settings, "sandbox_api_key", "test-key")
    monkeypatch.setattr(settings, "sandbox_api_secret", "test-secret")
    monkeypatch.setattr(settings, "sandbox_api_redirect_base", "")
    access = await _start_registration(client)
    res = await client.post(
        "/v1/kyc/sessions",
        json={"context": "registration", "consentAccepted": True},
        headers=auth(access),
    )
    assert res.status_code == 500
    assert res.json()["error"]["code"] == "KYC_PROVIDER_MISCONFIGURED"
