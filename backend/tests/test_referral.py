from tests.test_users import _register


def _notifications_for(user_store, uid):
    return [
        doc
        for key, doc in user_store.items()
        if key.startswith("notifications/") and doc.get("userId") == uid
    ]


async def test_register_with_valid_referral_attributes_no_credit(client, user_store):
    """F1 capture + X11 timing: registration attributes but never credits."""
    user_store["users/referrer-9"] = {
        "id": "referrer-9",
        "phone": "+919800000000",
        "referralCode": "ref_referr",
    }
    resp = await _register(client, referralCode="ref_referr")
    assert resp.status_code == 200
    assert resp.json()["referral"]["applied"] is True
    attribution = user_store["referral_attributions/uid-1"]
    assert attribution["status"] == "joined"
    assert attribution["credited"] is False
    assert attribution["referrerUid"] == "referrer-9"
    assert attribution["referredUid"] == "uid-1"
    # The referrer is NOT paid at registration.
    assert "users/referrer-9" in user_store
    assert user_store["users/referrer-9"].get("agriCoins") in (None, 0)
    assert _notifications_for(user_store, "referrer-9") == []
    # the referred user gets no coins
    assert user_store["users/uid-1"]["agriCoins"] == 0
    assert user_store["users/uid-1"]["referralCodeUsed"] == "ref_referr"

    # The invitee's first completed transaction releases the credit.
    from app.services.pnl_engine import record_auto_entry

    await record_auto_entry("uid-1", "income", 100000, "crop_sale", "lot_sale", "lot-1")
    # referrer earns 100 join coins + 50 first-milestone bonus
    assert user_store["users/referrer-9"]["agriCoins"] == 150
    profile = user_store["referrals/referrer-9"]
    assert profile["joinedCount"] == 1
    assert profile["totalEarnedCoins"] == 150
    assert profile["milestones"][0]["achieved"] is True
    assert user_store["referral_attributions/uid-1"]["credited"] is True
    assert {n["data"]["type"] for n in _notifications_for(user_store, "referrer-9")} == {
        "referral_joined",
        "referral_milestone",
    }


async def test_register_invalid_referral_code(client):
    resp = await _register(client, referralCode="ref_nope")
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "INVALID_REFERRAL_CODE"


async def test_register_without_referral(client, user_store):
    resp = await _register(client)
    assert resp.status_code == 200
    assert resp.json()["referral"]["applied"] is False
    assert "referral_attributions/uid-1" not in user_store
    assert "referralCodeUsed" not in user_store["users/uid-1"]


async def test_register_self_referral(client):
    resp = await _register(client, referralCode="ref_uid-1")
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "INVALID_REFERRAL_CODE"
