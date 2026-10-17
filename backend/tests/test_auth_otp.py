"""§1 phone OTP login: /auth/otp/send + /auth/otp/verify.

No SMS provider is configured (settings.sms_provider empty → dev mode), so
send returns devOtp; the tests pin both the success path and every guard:
resend lock, expiry, attempt cap, unknown/consumed sessions.
"""
from datetime import datetime, timedelta, timezone

import pytest

from app.core.config import settings
from app.routers.auth import _hash_otp

PHONE = "+919812345678"


@pytest.fixture
def dev_sms(monkeypatch):
    monkeypatch.setattr(settings, "env", "dev")
    monkeypatch.setattr(settings, "sms_provider", "")


def _seed_session(user_store, session_id, *, phone=PHONE, otp="123456", salt="s3",
                  attempts=0, expires_in=300, consumed=False):
    now = datetime.now(timezone.utc)
    doc = {
        "id": session_id,
        "phone": phone,
        "otpHash": _hash_otp(otp, salt),
        "salt": salt,
        "expiresAt": (now + timedelta(seconds=expires_in)).isoformat(),
        "resendAfterSec": 30,
        "attempts": attempts,
        "createdAt": now.isoformat(),
    }
    if consumed:
        doc["consumedAt"] = now.isoformat()
    user_store[f"otp_sessions/{session_id}"] = doc


def _wrong(otp: str) -> str:
    return f"{(int(otp) + 1) % 1000000:06d}"


async def test_send_returns_session_shape(client, user_store, dev_sms):
    resp = await client.post("/v1/auth/otp/send", json={"phone": PHONE})
    assert resp.status_code == 200
    body = resp.json()
    assert body["otpSessionId"].startswith("ots_")
    assert body["expiresInSec"] == 300
    assert body["resendAfterSec"] == 30
    assert body["devOtp"].isdigit() and len(body["devOtp"]) == 6

    session = user_store[f"otp_sessions/{body['otpSessionId']}"]
    assert session["phone"] == PHONE
    assert session["attempts"] == 0
    assert session["resendAfterSec"] == 30
    # plaintext OTP is never stored — only the salted sha256
    assert session["otpHash"] != body["devOtp"]
    assert session["otpHash"] == _hash_otp(body["devOtp"], session["salt"])
    assert body["devOtp"] not in str(session)
    ttl = datetime.fromisoformat(session["expiresAt"]) - datetime.now(timezone.utc)
    assert timedelta(seconds=250) < ttl <= timedelta(seconds=300)


async def test_send_normalizes_phone_and_requires_it(client, dev_sms):
    resp = await client.post("/v1/auth/otp/send", json={"phone": "9812345678"})
    assert resp.status_code == 200
    assert resp.json()["devOtp"]
    resp = await client.post("/v1/auth/otp/send", json={"phone": ""})
    assert resp.status_code == 422


async def test_send_resend_lock_409(client, dev_sms):
    assert (await client.post("/v1/auth/otp/send", json={"phone": PHONE})).status_code == 200
    resp = await client.post("/v1/auth/otp/send", json={"phone": PHONE})
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "RESEND_TOO_SOON"


async def test_send_hides_dev_otp_in_prod(client, monkeypatch):
    monkeypatch.setattr(settings, "env", "prod")
    monkeypatch.setattr(settings, "sms_provider", "")
    resp = await client.post("/v1/auth/otp/send", json={"phone": PHONE})
    assert resp.status_code == 200
    assert "devOtp" not in resp.json()


async def test_verify_success_bootstraps_user_and_issues_tokens(client, user_store, dev_sms):
    sent = (await client.post("/v1/auth/otp/send", json={"phone": PHONE})).json()
    resp = await client.post(
        "/v1/auth/otp/verify",
        json={"phone": PHONE, "otp": sent["devOtp"], "otpSessionId": sent["otpSessionId"]},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["accessToken"]
    assert body["refreshToken"]
    assert body["isNewUser"] is True
    assert body["user"]["id"] == "user_9812345678"
    assert body["user"]["phone"] == PHONE
    assert "mpinHash" not in body["user"]
    # user doc bootstrapped exactly like firebase-verify
    stored = user_store["users/user_9812345678"]
    assert stored["phone"] == PHONE
    assert stored["referralCode"] == "ref_user_981"
    assert stored["linkedProfiles"] == ["farmer"]
    assert stored["primaryProfile"] == "farmer"
    # session marked consumed
    assert user_store[f"otp_sessions/{sent['otpSessionId']}"]["consumedAt"]
    # the pair is a live token pair — refresh rotates it
    refreshed = await client.post("/v1/auth/refresh", json={"refreshToken": body["refreshToken"]})
    assert refreshed.status_code == 200
    assert refreshed.json()["accessToken"]

    # a later OTP login on the same phone is not a new user
    sent2 = (await client.post("/v1/auth/otp/send", json={"phone": PHONE})).json()
    resp2 = await client.post(
        "/v1/auth/otp/verify",
        json={"phone": PHONE, "otp": sent2["devOtp"], "otpSessionId": sent2["otpSessionId"]},
    )
    assert resp2.status_code == 200
    assert resp2.json()["isNewUser"] is False


async def test_verify_wrong_otp_400_and_increments_attempts(client, user_store, dev_sms):
    sent = (await client.post("/v1/auth/otp/send", json={"phone": PHONE})).json()
    resp = await client.post(
        "/v1/auth/otp/verify",
        json={"phone": PHONE, "otp": _wrong(sent["devOtp"]), "otpSessionId": sent["otpSessionId"]},
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "OTP_INVALID"
    assert user_store[f"otp_sessions/{sent['otpSessionId']}"]["attempts"] == 1


async def test_verify_wrong_then_right_otp_succeeds(client, dev_sms):
    sent = (await client.post("/v1/auth/otp/send", json={"phone": PHONE})).json()
    payload = {"phone": PHONE, "otp": _wrong(sent["devOtp"]), "otpSessionId": sent["otpSessionId"]}
    assert (await client.post("/v1/auth/otp/verify", json=payload)).status_code == 400
    payload["otp"] = sent["devOtp"]
    resp = await client.post("/v1/auth/otp/verify", json=payload)
    assert resp.status_code == 200


async def test_verify_expired_session_400(client, user_store, dev_sms):
    _seed_session(user_store, "ots_expired", expires_in=-10)
    resp = await client.post(
        "/v1/auth/otp/verify",
        json={"phone": PHONE, "otp": "123456", "otpSessionId": "ots_expired"},
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "OTP_EXPIRED"


async def test_verify_max_attempts_429(client, user_store, dev_sms):
    _seed_session(user_store, "ots_locked", attempts=5)
    resp = await client.post(
        "/v1/auth/otp/verify",
        json={"phone": PHONE, "otp": "123456", "otpSessionId": "ots_locked"},
    )
    assert resp.status_code == 429
    assert resp.json()["error"]["code"] == "OTP_TOO_MANY_ATTEMPTS"


async def test_verify_brute_forces_locks_after_five_misses(client, user_store, dev_sms):
    sent = (await client.post("/v1/auth/otp/send", json={"phone": PHONE})).json()
    payload = {"phone": PHONE, "otp": _wrong(sent["devOtp"]), "otpSessionId": sent["otpSessionId"]}
    for i in range(5):
        resp = await client.post("/v1/auth/otp/verify", json=payload)
        assert resp.status_code == 400
        assert resp.json()["error"]["code"] == "OTP_INVALID"
        assert user_store[f"otp_sessions/{sent['otpSessionId']}"]["attempts"] == i + 1
    resp = await client.post("/v1/auth/otp/verify", json=payload)
    assert resp.status_code == 429
    assert resp.json()["error"]["code"] == "OTP_TOO_MANY_ATTEMPTS"


async def test_verify_unknown_session_404(client, dev_sms):
    resp = await client.post(
        "/v1/auth/otp/verify",
        json={"phone": PHONE, "otp": "123456", "otpSessionId": "ots_nope"},
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "OTP_SESSION_NOT_FOUND"


async def test_verify_phone_mismatch_404(client, user_store, dev_sms):
    _seed_session(user_store, "ots_mine")
    resp = await client.post(
        "/v1/auth/otp/verify",
        json={"phone": "+919999999999", "otp": "123456", "otpSessionId": "ots_mine"},
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "OTP_SESSION_NOT_FOUND"


async def test_verify_consumed_session_is_one_shot(client, user_store, dev_sms):
    sent = (await client.post("/v1/auth/otp/send", json={"phone": PHONE})).json()
    payload = {"phone": PHONE, "otp": sent["devOtp"], "otpSessionId": sent["otpSessionId"]}
    assert (await client.post("/v1/auth/otp/verify", json=payload)).status_code == 200
    resp = await client.post("/v1/auth/otp/verify", json=payload)
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "OTP_SESSION_NOT_FOUND"
