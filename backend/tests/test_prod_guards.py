import pytest
from fastapi import HTTPException

from app.core.security import validate_mpin_format
from app.services.payments import verify_razorpay_signature


@pytest.fixture
def prod_env(monkeypatch):
    monkeypatch.setattr("app.core.config.settings.env", "prod")
    yield
    # monkeypatch restores dev automatically


async def test_quick_login_forbidden_in_prod(client, prod_env):
    resp = await client.post("/v1/auth/quick-login", json={"persona": "farmer", "mpin": "9876"})
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "DISABLED_IN_PROD"


async def test_mpin_1234_rejected_in_prod(client, user_store, prod_env):
    from app.core.security import hash_mpin
    user_store["users/dev-x"] = {"id": "dev-x", "phone": "+919000000001", "mpinHash": hash_mpin("5555")}
    resp = await client.post("/v1/auth/login", json={"phone": "+919000000001", "mpin": "1234"})
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "WEAK_MPIN"


def test_dev_signature_never_accepted(monkeypatch):
    monkeypatch.setattr("app.core.config.settings.razorpay_key_secret", "")
    assert verify_razorpay_signature("o1", "p1", "dev") is False


def test_trivial_mpin_rejected_in_prod(prod_env):
    with pytest.raises(HTTPException) as exc:
        validate_mpin_format("1234")
    assert exc.value.status_code == 422
    assert exc.value.detail["code"] == "WEAK_MPIN"


async def test_cors_rejects_unknown_origin(client):
    resp = await client.options(
        "/v1/health",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"},
    )
    allow = resp.headers.get("access-control-allow-origin")
    assert allow != "*"
    assert allow != "https://evil.example"
