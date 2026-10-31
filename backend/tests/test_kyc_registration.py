"""Registration-integrated KYC (DigiLocker-style sessions) — acceptance tests.

Covers: OTP→onboarding token issuance, restricted-token enforcement, profile
submit, session create/dedup/consent/context rules, mock provider approve/deny,
sandbox signature enforcement, callback polling truth, expiry + refresh,
server-controlled completion, resume without duplication, and legacy login
remaining unaffected.
"""
import json

import pytest

from app.core.config import settings
from app.services.tokens import decode_token
from tests.test_diary import auth, seed_user

NEW_PHONE = "+919987650001"
OTHER_PHONE = "+919987650002"


async def _otp_login(client, phone):
    sent = await client.post("/v1/auth/otp/send", json={"phone": phone})
    assert sent.status_code == 200
    otp = sent.json()["devOtp"]
    verified = await client.post(
        "/v1/auth/otp/verify", json={"phone": phone, "otp": otp}
    )
    assert verified.status_code == 200
    body = verified.json()
    return body["accessToken"], body["refreshToken"], body["user"]


def _session_key(user_store, session_id):
    return user_store.get(f"kyc_sessions/{session_id}")


# ---------------------------------------------------------------- OTP step 1


async def test_new_mobile_otp_issues_restricted_onboarding_session(client, user_store):
    access, _refresh, user = await _otp_login(client, NEW_PHONE)

    assert user["registrationStatus"] == "pendingProfile"
    assert user["kycStatus"] == "unverified"
    # Restricted token: accepted by the KYC surface…
    me = await client.get("/v1/kyc/me", headers=auth(access))
    assert me.status_code == 200
    assert me.json()["registrationStatus"] == "pendingProfile"
    # …rejected by every protected endpoint.
    protected = await client.post(
        "/v1/kyc/cases", json={"persona": "farmer", "docs": []}, headers=auth(access)
    )
    assert protected.status_code == 401


async def test_profile_step_accepts_multiple_personas_first_is_primary(client, user_store):
    access, _, _ = await _otp_login(client, NEW_PHONE)
    res = await client.post(
        "/v1/auth/registration/profile",
        json={
            "name": "Multi Role Kisan",
            "personas": ["farmer", "seller", "transporter"],
            "state": "Maharashtra",
            "district": "Nashik",
            "village": "Pimpalgaon",
            "mpin": "4321",
        },
        headers=auth(access),
    )
    assert res.status_code == 200
    stored = user_store[f"users/user_{NEW_PHONE.replace('+', '')[-10:]}"]
    assert stored["primaryProfile"] == "farmer"
    assert stored["activeProfile"] == "farmer"
    assert stored["linkedProfiles"] == ["farmer", "seller", "transporter"]

    # Duplicates collapse; an unknown entry in the list is rejected wholesale.
    dupes = await client.post(
        "/v1/auth/registration/profile",
        json={"name": "Multi Role Kisan", "personas": ["farmer", "farmer"], "state": "Maharashtra", "district": "Nashik"},
        headers=auth(access),
    )
    assert dupes.status_code == 200
    assert user_store[f"users/user_{NEW_PHONE.replace('+', '')[-10:]}"]["linkedProfiles"] == ["farmer", "seller", "transporter"]

    bad = await client.post(
        "/v1/auth/registration/profile",
        json={"name": "X Kisan", "personas": ["farmer", "not_a_persona"], "state": "Maharashtra", "district": "Nashik"},
        headers=auth(access),
    )
    assert bad.status_code == 422
    assert bad.json()["error"]["code"] == "INVALID_PROFILE_TYPE"


async def test_profile_step_requires_mpin_for_new_accounts(client, user_store):
    access, _, _ = await _otp_login(client, NEW_PHONE)

    # A brand-new account cannot skip MPIN — OTP is only for unregistered
    # numbers, so without an MPIN the user would have no login credential.
    no_mpin = await client.post(
        "/v1/auth/registration/profile",
        json={"name": "No Mpin Kisan", "persona": "farmer", "state": "Maharashtra", "district": "Nashik"},
        headers=auth(access),
    )
    assert no_mpin.status_code == 422
    assert no_mpin.json()["error"]["code"] == "MPIN_REQUIRED"
    stored = user_store[f"users/user_{NEW_PHONE.replace('+', '')[-10:]}"]
    assert stored["registrationStatus"] == "pendingProfile"
    assert not stored.get("mpinHash")

    with_mpin = await client.post(
        "/v1/auth/registration/profile",
        json={"name": "No Mpin Kisan", "persona": "farmer", "state": "Maharashtra", "district": "Nashik", "mpin": "4321"},
        headers=auth(access),
    )
    assert with_mpin.status_code == 200

    # Resuming: omitting mpin on a later resubmit keeps the stored MPIN.
    resume = await client.post(
        "/v1/auth/registration/profile",
        json={"name": "No Mpin Kisan", "personas": ["farmer", "seller"], "state": "Maharashtra", "district": "Nashik"},
        headers=auth(access),
    )
    assert resume.status_code == 200
    stored = user_store[f"users/user_{NEW_PHONE.replace('+', '')[-10:]}"]
    assert stored["registrationStatus"] == "pendingKyc"
    assert stored["mpinHash"]


async def test_profile_step_sets_pending_kyc_and_validates_fields(client, user_store):
    access, _, _ = await _otp_login(client, NEW_PHONE)

    bad_persona = await client.post(
        "/v1/auth/registration/profile",
        json={"name": "Ram Patil", "persona": "not_a_persona", "state": "MH", "district": "Nashik"},
        headers=auth(access),
    )
    assert bad_persona.status_code == 422

    no_name = await client.post(
        "/v1/auth/registration/profile",
        json={"name": " ", "persona": "farmer", "state": "MH", "district": "Nashik"},
        headers=auth(access),
    )
    assert no_name.status_code == 422

    ok = await client.post(
        "/v1/auth/registration/profile",
        json={
            "name": "Ram Patil",
            "persona": "farmer",
            "state": "Maharashtra",
            "district": "Nashik",
            "village": "Pimpalgaon",
            "mpin": "4321",
        },
        headers=auth(access),
    )
    assert ok.status_code == 200
    assert ok.json()["registrationStatus"] == "pendingKyc"
    stored = user_store[f"users/user_{NEW_PHONE.replace('+', '')[-10:]}"]
    assert stored["registrationStatus"] == "pendingKyc"
    assert stored["mpinHash"]

    # Full access token cannot drive the onboarding endpoints.
    full = seed_user(user_store, uid="uid-outsider")
    forbidden = await client.post(
        "/v1/auth/registration/profile",
        json={"name": "X", "persona": "farmer"},
        headers=auth(full),
    )
    assert forbidden.status_code == 401


# ------------------------------------------------------------- sessions step


async def _start_registration(client, user_store, phone=NEW_PHONE):
    access, refresh, _user = await _otp_login(client, phone)
    await client.post(
        "/v1/auth/registration/profile",
        json={
            "name": "Ram Patil",
            "persona": "farmer",
            "state": "Maharashtra",
            "district": "Nashik",
            "village": "Pimpalgaon",
            "mpin": "4321",
        },
        headers=auth(access),
    )
    return access, refresh


async def test_session_requires_consent_and_known_context(client, user_store):
    access, _ = await _start_registration(client, user_store)

    no_consent = await client.post(
        "/v1/kyc/sessions",
        json={"context": "registration", "consentAccepted": False},
        headers=auth(access),
    )
    assert no_consent.status_code == 422
    assert no_consent.json()["error"]["code"] == "CONSENT_REQUIRED"

    bad_context = await client.post(
        "/v1/kyc/sessions",
        json={"context": "something_else", "consentAccepted": True},
        headers=auth(access),
    )
    assert bad_context.status_code == 422


async def test_registration_session_forced_callback_and_dedup(client, user_store):
    access, _ = await _start_registration(client, user_store)

    created = await client.post(
        "/v1/kyc/sessions",
        json={"context": "registration", "consentAccepted": True, "returnTo": "/farmer"},
        headers=auth(access),
    )
    assert created.status_code == 201
    session = created.json()["session"]
    # Registration ALWAYS returns to the registration callback, never a
    # marketplace page, regardless of what the client asked for.
    assert f"/kyc/callback?session={session['id']}&context=registration" in session["returnTo"]
    assert session["returnTo"].startswith(settings.web_app_base_url)
    assert session["provider"] == "mock"
    assert f"/mock-digilocker?session={session['id']}" in session["authorizationUrl"]

    # Duplicate-session prevention: the open session is reused, not recreated.
    again = await client.post(
        "/v1/kyc/sessions",
        json={"context": "registration", "consentAccepted": True},
        headers=auth(access),
    )
    assert again.status_code == 201
    assert again.json()["session"]["id"] == session["id"]
    keys = [k for k in user_store if k.startswith("kyc_sessions/")]
    assert len(keys) == 1


async def test_mock_provider_approve_completes_identity(client, user_store):
    access, _ = await _start_registration(client, user_store)
    created = await client.post(
        "/v1/kyc/sessions",
        json={"context": "registration", "consentAccepted": True},
        headers=auth(access),
    )
    session = created.json()["session"]

    # Polling never changes state by itself.
    poll = await client.get(f"/v1/kyc/sessions/{session['id']}", headers=auth(access))
    assert poll.json()["session"]["status"] == "created"

    approved = await client.post(
        f"/v1/kyc/sessions/{session['id']}/provider-callback",
        json={"decision": "approve"},
    )
    assert approved.status_code == 200
    done = approved.json()["session"]
    assert done["status"] == "verified"
    assert done["verifiedName"] == "Ram Patil"
    assert done["maskedAadhaar"].startswith("XXXXXXXX")
    assert len(done["maskedAadhaar"]) == 12
    # No raw Aadhaar anywhere in the stored session.
    stored = _session_key(user_store, session["id"])
    assert "aadhaar" not in json.dumps(stored["identity"])
    assert stored["identity"]["maskedAadhaar"] == done["maskedAadhaar"]
    # The required identity record was saved for the completion check.
    assert user_store[f"identity_verifications/{session['id']}"]["status"] == "verified"


async def test_mock_provider_deny_and_retry_with_new_session(client, user_store):
    access, _ = await _start_registration(client, user_store)
    created = await client.post(
        "/v1/kyc/sessions",
        json={"context": "registration", "consentAccepted": True},
        headers=auth(access),
    )
    session_id = created.json()["session"]["id"]

    denied = await client.post(
        f"/v1/kyc/sessions/{session_id}/provider-callback", json={"decision": "deny"}
    )
    assert denied.json()["session"]["status"] == "denied"
    assert denied.json()["session"]["error"] == "consent_denied"

    # Denied session cannot be resurrected by a late provider result…
    late = await client.post(
        f"/v1/kyc/sessions/{session_id}/provider-callback", json={"decision": "approve"}
    )
    assert late.json()["session"]["status"] == "denied"

    # …and completion is refused — registration stays incomplete with retry.
    incomplete = await client.post(
        "/v1/auth/registration/complete",
        json={"sessionId": session_id},
        headers=auth(access),
    )
    assert incomplete.status_code == 409

    # Retry with a NEW session works.
    retry = await client.post(
        "/v1/kyc/sessions",
        json={"context": "registration", "consentAccepted": True},
        headers=auth(access),
    )
    new_id = retry.json()["session"]["id"]
    assert new_id != session_id
    approved = await client.post(
        f"/v1/kyc/sessions/{new_id}/provider-callback", json={"decision": "approve"}
    )
    assert approved.json()["session"]["status"] == "verified"


async def test_expired_session_and_refresh(client, user_store):
    access, _ = await _start_registration(client, user_store)
    created = await client.post(
        "/v1/kyc/sessions",
        json={"context": "registration", "consentAccepted": True},
        headers=auth(access),
    )
    session = created.json()["session"]

    # Force expiry, then poll: the backend (and only the backend) marks it.
    stored = _session_key(user_store, session["id"])
    stored["expiresAt"] = "2020-01-01T00:00:00+00:00"
    user_store[f"kyc_sessions/{session['id']}"] = stored
    poll = await client.get(f"/v1/kyc/sessions/{session['id']}", headers=auth(access))
    assert poll.json()["session"]["status"] == "expired"

    # A late provider result cannot verify an expired session.
    late = await client.post(
        f"/v1/kyc/sessions/{session['id']}/provider-callback", json={"decision": "approve"}
    )
    assert late.json()["session"]["status"] == "expired"

    # Refresh rotates the URL for a fresh attempt.
    refreshed = await client.post(
        f"/v1/kyc/sessions/{session['id']}/refresh", headers=auth(access)
    )
    fresh = refreshed.json()["session"]
    assert fresh["status"] == "created"
    assert fresh["authorizationUrl"]

    # Another user's token cannot read or refresh the session.
    other, _ = await _start_registration(client, user_store, phone=OTHER_PHONE)
    foreign = await client.get(f"/v1/kyc/sessions/{session['id']}", headers=auth(other))
    assert foreign.status_code == 403


# ---------------------------------------------------------------- completion


async def test_complete_registration_is_server_controlled(client, user_store):
    access, _ = await _start_registration(client, user_store)

    # Cannot complete before any session exists.
    early = await client.post(
        "/v1/auth/registration/complete",
        json={"sessionId": "kycs_missing"},
        headers=auth(access),
    )
    assert early.status_code == 403

    created = await client.post(
        "/v1/kyc/sessions",
        json={"context": "registration", "consentAccepted": True},
        headers=auth(access),
    )
    session_id = created.json()["session"]["id"]

    # Cannot complete while the session is still open.
    pending = await client.post(
        "/v1/auth/registration/complete",
        json={"sessionId": session_id},
        headers=auth(access),
    )
    assert pending.status_code == 409
    assert pending.json()["error"]["code"] == "KYC_NOT_VERIFIED"
    stored = user_store[f"users/user_{NEW_PHONE.replace('+', '')[-10:]}"]
    assert stored["registrationStatus"] == "pendingKyc"

    await client.post(
        f"/v1/kyc/sessions/{session_id}/provider-callback", json={"decision": "approve"}
    )
    done = await client.post(
        "/v1/auth/registration/complete",
        json={"sessionId": session_id},
        headers=auth(access),
    )
    assert done.status_code == 200
    body = done.json()
    user = body["user"]
    assert user["registrationStatus"] == "completed"
    assert user["kycStatus"] == "verified"
    assert user["kycVerifiedAt"]
    assert user["verificationMode"] == "mock"
    assert user["maskedAadhaar"].startswith("XXXXXXXX")
    assert "mpinHash" not in user

    # The issued token is now a FULL session: protected endpoints accept it.
    full_check = await client.get("/v1/kyc/me", headers=auth(body["accessToken"]))
    assert full_check.status_code == 200
    assert full_check.json()["registrationStatus"] == "completed"

    # Completion is idempotently locked afterwards.
    replay = await client.post(
        "/v1/auth/registration/complete",
        json={"sessionId": session_id},
        headers=auth(access),
    )
    assert replay.status_code == 409


async def test_cannot_complete_with_another_users_session(client, user_store):
    access, _ = await _start_registration(client, user_store, phone=NEW_PHONE)
    other, _ = await _start_registration(client, user_store, phone=OTHER_PHONE)
    created = await client.post(
        "/v1/kyc/sessions",
        json={"context": "registration", "consentAccepted": True},
        headers=auth(other),
    )
    foreign_id = created.json()["session"]["id"]
    await client.post(
        f"/v1/kyc/sessions/{foreign_id}/provider-callback", json={"decision": "approve"}
    )
    steal = await client.post(
        "/v1/auth/registration/complete",
        json={"sessionId": foreign_id},
        headers=auth(access),
    )
    assert steal.status_code == 403


async def test_onboarding_refresh_rotates_within_restricted_scope(client, user_store):
    access, refresh, _ = await _otp_login(client, NEW_PHONE)
    rotated = await client.post("/v1/auth/refresh", json={"refreshToken": refresh})
    assert rotated.status_code == 200
    new_access = rotated.json()["accessToken"]
    # Still restricted after rotation.
    me = await client.get("/v1/kyc/me", headers=auth(new_access))
    assert me.status_code == 200
    blocked = await client.get("/v1/users/me", headers=auth(new_access))
    assert blocked.status_code == 401


# ------------------------------------------------------------------- resume


async def test_resume_after_close_reuses_account_without_new_otp_pressure(client, user_store):
    access1, _, user1 = await _otp_login(client, NEW_PHONE)
    await client.post(
        "/v1/auth/registration/profile",
        json={
            "name": "Ram Patil",
            "persona": "transporter",
            "state": "Maharashtra",
            "district": "Nashik",
            "mpin": "4321",
        },
        headers=auth(access1),
    )

    # Browser closed; user returns and verifies OTP again: SAME account, still
    # pendingKyc, still a restricted session — no duplicate, no reset.
    access2, _, user2 = await _otp_login(client, NEW_PHONE)
    assert user2["id"] == user1["id"]
    assert user2["registrationStatus"] == "pendingKyc"
    assert user2["primaryProfile"] == "transporter"
    user_docs = [k for k in user_store if k.startswith("users/user_99876")]
    assert len(user_docs) == 1

    # MPIN login also resumes with a restricted session (no OTP re-demand).
    mpin_login = await client.post(
        "/v1/auth/login", json={"phone": NEW_PHONE, "mpin": "4321"}
    )
    assert mpin_login.status_code == 200
    resumed_user = mpin_login.json()["user"]
    assert resumed_user["registrationStatus"] == "pendingKyc"
    blocked = await client.get("/v1/users/me", headers=auth(mpin_login.json()["accessToken"]))
    assert blocked.status_code == 401


async def test_legacy_users_login_with_full_sessions(client, user_store):
    from app.core.security import hash_mpin

    user_store["users/user_9987650099"] = {
        "id": "user_9987650099",
        "name": "Legacy Kisan",
        "phone": "+919987650099",
        "mpinHash": hash_mpin("1234"),
        "linkedProfiles": ["farmer"],
        "primaryProfile": "farmer",
        "activeProfile": "farmer",
        "createdAt": "2025-01-01T00:00:00+00:00",
    }
    login = await client.post(
        "/v1/auth/login", json={"phone": "+919987650099", "mpin": "1234"}
    )
    assert login.status_code == 200
    token = login.json()["accessToken"]
    # No registrationStatus field → grandfathered, full access preserved.
    me = await client.get("/v1/kyc/me", headers=auth(token))
    assert me.status_code == 200
    assert me.json()["registrationStatus"] == "completed"


# ------------------------------------------------------------------ sandbox


@pytest.fixture
def sandbox_mode(monkeypatch):
    monkeypatch.setattr(settings, "kyc_provider", "sandbox")
    monkeypatch.setattr(settings, "sandbox_api_key", "test-key")
    monkeypatch.setattr(settings, "sandbox_api_secret", "test-secret")
    monkeypatch.setattr(settings, "sandbox_api_redirect_base", "https://api.example.com")

    async def fake_init(redirect_url, doc_types, purpose, requestor_name):
        assert redirect_url.startswith("https://api.example.com/v1/kyc/sessions/oauth/callback?s=kycs_")
        assert "aadhaar" in doc_types
        return {
            "authorization_url": "https://digilocker.meripehchaan.gov.in/public/oauth2/1/authorize?state=fake",
            "session_id": "sb-fake-session",
        }

    monkeypatch.setattr("app.services.digilocker.init_session", fake_init)
    return settings


async def test_sandbox_provider_creates_real_digilocker_session(client, user_store, sandbox_mode):
    access, _ = await _start_registration(client, user_store)
    created = await client.post(
        "/v1/kyc/sessions",
        json={"context": "registration", "consentAccepted": True},
        headers=auth(access),
    )
    session = created.json()["session"]
    # Same screens/flow: only the authorization destination changes.
    assert session["provider"] == "sandbox"
    assert "digilocker.meripehchaan.gov.in" in session["authorizationUrl"]
    assert session["returnTo"].endswith(f"/kyc/callback?session={session['id']}&context=registration")
    # The Sandbox session id is bound to our kyc session doc for later syncs.
    stored = _session_key(user_store, session["id"])
    assert stored["sandboxSessionId"] == "sb-fake-session"


async def test_sandbox_provider_callback_endpoint_rejected(client, user_store, sandbox_mode):
    access, _ = await _start_registration(client, user_store)
    created = await client.post(
        "/v1/kyc/sessions",
        json={"context": "registration", "consentAccepted": True},
        headers=auth(access),
    )
    session_id = created.json()["session"]["id"]

    # Sandbox sessions reconcile via polling / oauth-callback, never via the
    # mock provider-callback endpoint.
    res = await client.post(
        f"/v1/kyc/sessions/{session_id}/provider-callback",
        json={"decision": "approve"},
    )
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "KYC_PROVIDER_NOT_MOCK"


async def test_profile_context_verification_updates_existing_user(client, user_store):
    full = seed_user(user_store, uid="uid-existing", active_profile="farmer")
    created = await client.post(
        "/v1/kyc/sessions",
        json={"context": "profile", "consentAccepted": True},
        headers=auth(full),
    )
    assert created.status_code == 201
    session_id = created.json()["session"]["id"]
    await client.post(
        f"/v1/kyc/sessions/{session_id}/provider-callback", json={"decision": "approve"}
    )
    stored = user_store["users/uid-existing"]
    assert stored["kycStatus"] == "verified"
    assert stored["maskedAadhaar"].startswith("XXXXXXXX")


# ------------------------------------------------------- aadhaar_okyc method

AADHAAR = "123456789012"


async def _start_aadhaar_session(client, access):
    created = await client.post(
        "/v1/kyc/sessions",
        json={"context": "registration", "consentAccepted": True, "method": "aadhaar_okyc"},
        headers=auth(access),
    )
    assert created.status_code == 201
    return created.json()["session"]


async def test_aadhaar_otp_issue_and_verify_completes_registration(client, user_store):
    access, _ = await _start_registration(client, user_store)
    session = await _start_aadhaar_session(client, access)
    assert session["method"] == "aadhaar_okyc"
    assert session["authorizationUrl"] == ""
    assert session["provider"] == "mock"

    bad_format = await client.post(
        f"/v1/kyc/sessions/{session['id']}/aadhaar-otp",
        json={"aadhaarNumber": "12345", "consentAccepted": True},
        headers=auth(access),
    )
    assert bad_format.status_code == 422

    no_consent = await client.post(
        f"/v1/kyc/sessions/{session['id']}/aadhaar-otp",
        json={"aadhaarNumber": AADHAAR, "consentAccepted": False},
        headers=auth(access),
    )
    assert no_consent.status_code == 422
    assert no_consent.json()["error"]["code"] == "CONSENT_REQUIRED"

    issued = await client.post(
        f"/v1/kyc/sessions/{session['id']}/aadhaar-otp",
        json={"aadhaarNumber": AADHAAR, "consentAccepted": True},
        headers=auth(access),
    )
    assert issued.status_code == 200
    dev_otp = issued.json()["devOtp"]
    assert dev_otp and len(dev_otp) == 6
    assert issued.json()["session"]["status"] == "processing"
    assert issued.json()["session"]["aadhaarLast4"] == "XXXXXXXX9012"

    # Only the masked Aadhaar is persisted — the raw number appears nowhere.
    stored = _session_key(user_store, session["id"])
    assert AADHAAR not in json.dumps(stored)
    assert stored["aadhaarLast4"] == "XXXXXXXX9012"

    # OTP issue is idempotent-resendable on the same session (new OTP).
    resent = await client.post(
        f"/v1/kyc/sessions/{session['id']}/aadhaar-otp",
        json={"aadhaarNumber": AADHAAR, "consentAccepted": True},
        headers=auth(access),
    )
    assert resent.status_code == 200
    assert resent.json()["devOtp"] != dev_otp

    wrong = await client.post(
        f"/v1/kyc/sessions/{session['id']}/aadhaar-verify",
        json={"otp": "000000" if dev_otp != "000000" else "111111"},
        headers=auth(access),
    )
    assert wrong.status_code == 400
    assert wrong.json()["error"]["code"] == "OTP_INVALID"

    verified = await client.post(
        f"/v1/kyc/sessions/{session['id']}/aadhaar-verify",
        json={"otp": resent.json()["devOtp"]},
        headers=auth(access),
    )
    assert verified.status_code == 200
    done = verified.json()["session"]
    assert done["status"] == "verified"
    assert done["verifiedName"] == "Ram Patil"
    assert done["maskedAadhaar"] == "XXXXXXXX9012"

    # No raw Aadhaar in the stored session/identity after verification either.
    stored = _session_key(user_store, session["id"])
    assert AADHAAR not in json.dumps(stored)
    assert user_store[f"identity_verifications/{session['id']}"]["status"] == "verified"

    completed = await client.post(
        "/v1/auth/registration/complete",
        json={"sessionId": session["id"]},
        headers=auth(access),
    )
    assert completed.status_code == 200
    user = completed.json()["user"]
    assert user["registrationStatus"] == "completed"
    assert user["kycStatus"] == "verified"
    assert user["maskedAadhaar"] == "XXXXXXXX9012"


async def test_aadhaar_otp_too_many_attempts_fails_session(client, user_store):
    access, _ = await _start_registration(client, user_store)
    session = await _start_aadhaar_session(client, access)
    await client.post(
        f"/v1/kyc/sessions/{session['id']}/aadhaar-otp",
        json={"aadhaarNumber": AADHAAR, "consentAccepted": True},
        headers=auth(access),
    )
    wrong_otp = "999999"
    for _ in range(5):
        res = await client.post(
            f"/v1/kyc/sessions/{session['id']}/aadhaar-verify",
            json={"otp": wrong_otp},
            headers=auth(access),
        )
    assert res.status_code == 429
    assert res.json()["error"]["code"] == "OTP_TOO_MANY_ATTEMPTS"
    poll = await client.get(f"/v1/kyc/sessions/{session['id']}", headers=auth(access))
    assert poll.json()["session"]["status"] == "failed"

    # A failed session cannot complete — the user retries with a NEW session.
    incomplete = await client.post(
        "/v1/auth/registration/complete",
        json={"sessionId": session["id"]},
        headers=auth(access),
    )
    assert incomplete.status_code == 409


async def test_aadhaar_wrong_method_and_foreign_sessions_rejected(client, user_store):
    access, _ = await _start_registration(client, user_store)
    aadhaar_session = await _start_aadhaar_session(client, access)

    # DigiLocker session refuses the Aadhaar endpoints.
    digilocker = await client.post(
        "/v1/kyc/sessions",
        json={"context": "registration", "consentAccepted": True, "method": "digilocker"},
        headers=auth(access),
    )
    assert digilocker.status_code == 201
    dl_id = digilocker.json()["session"]["id"]
    assert dl_id != aadhaar_session["id"]
    assert digilocker.json()["session"]["authorizationUrl"]

    wrong_method = await client.post(
        f"/v1/kyc/sessions/{dl_id}/aadhaar-otp",
        json={"aadhaarNumber": AADHAAR, "consentAccepted": True},
        headers=auth(access),
    )
    assert wrong_method.status_code == 409
    assert wrong_method.json()["error"]["code"] == "WRONG_METHOD"

    # Same-method create reuses the open session; the digilocker one stays separate.
    again = await client.post(
        "/v1/kyc/sessions",
        json={"context": "registration", "consentAccepted": True, "method": "aadhaar_okyc"},
        headers=auth(access),
    )
    assert again.json()["session"]["id"] == aadhaar_session["id"]

    # Another user cannot drive the session.
    other, _ = await _start_registration(client, user_store, phone=OTHER_PHONE)
    foreign = await client.post(
        f"/v1/kyc/sessions/{aadhaar_session['id']}/aadhaar-otp",
        json={"aadhaarNumber": AADHAAR, "consentAccepted": True},
        headers=auth(other),
    )
    assert foreign.status_code == 403


async def test_aadhaar_method_rejected_on_sandbox_provider(client, user_store, sandbox_mode):
    access, _ = await _start_registration(client, user_store)
    res = await client.post(
        "/v1/kyc/sessions",
        json={"context": "registration", "consentAccepted": True, "method": "aadhaar_okyc"},
        headers=auth(access),
    )
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "AADHAAR_OKYC_DISCONTINUED"

    # DigiLocker sessions keep working unchanged on the sandbox provider.
    ok = await client.post(
        "/v1/kyc/sessions",
        json={"context": "registration", "consentAccepted": True},
        headers=auth(access),
    )
    assert ok.status_code == 201
