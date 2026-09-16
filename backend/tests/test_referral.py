from tests.test_users import _register


async def test_register_with_valid_referral(client, user_store):
    user_store["users/referrer-9"] = {
        "id": "referrer-9",
        "phone": "+919800000000",
        "referralCode": "ref_referr",
    }
    resp = await _register(client, referralCode="ref_referr")
    assert resp.status_code == 200
    assert resp.json()["referral"]["applied"] is True
    attribution = user_store["referral_attributions/uid-1"]
    assert attribution["status"] == "pending"
    assert attribution["referrerUid"] == "referrer-9"
    assert attribution["referredUid"] == "uid-1"


async def test_register_invalid_referral_code(client):
    resp = await _register(client, referralCode="ref_nope")
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "INVALID_REFERRAL_CODE"


async def test_register_without_referral(client, user_store):
    resp = await _register(client)
    assert resp.status_code == 200
    assert resp.json()["referral"]["applied"] is False
    assert "referral_attributions/uid-1" not in user_store


async def test_register_self_referral(client):
    resp = await _register(client, referralCode="ref_uid-1")
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "INVALID_REFERRAL_CODE"
