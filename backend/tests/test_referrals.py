from datetime import datetime, timedelta, timezone

from tests.test_diary import auth, seed_user
from tests.test_users import _register


def _ledger_entries(user_store, uid):
    return {
        key: doc
        for key, doc in user_store.items()
        if key.startswith(f"users/{uid}/coin_ledger/")
    }


def _shadow_entries(user_store, uid):
    return {
        key: doc
        for key, doc in user_store.items()
        if key.startswith(f"gamification_ledger/{uid}_")
    }


def _notifications_for(user_store, uid):
    return [
        doc
        for key, doc in user_store.items()
        if key.startswith("notifications/") and doc.get("userId") == uid
    ]


async def test_get_referrals_fresh_user(client, user_store):
    token = seed_user(user_store, uid="uid-r1")
    resp = await client.get("/v1/referrals", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["referralCode"] == "ref_uid-r1"
    assert body["shareLink"] == "https://agrovercity.in/r/ref_uid-r1"
    assert "ref_uid-r1" in body["shareMessage"]
    assert body["stats"] == {"invited": 0, "joined": 0, "totalEarnedCoins": 0}
    assert body["referred"] == []
    assert body["leaderboard"] == []
    assert body["myRank"] is None
    assert [(m["count"], m["rewardCoins"], m["achieved"]) for m in body["milestones"]] == [
        (1, 50, False),
        (5, 150, False),
        (10, 500, False),
    ]


async def test_invite_success_awards_coins(client, user_store):
    token = seed_user(user_store, uid="uid-r2")
    resp = await client.post(
        "/v1/referrals/invite",
        json={"name": "Shyam Kumar", "phone": "+919812345679"},
        headers=auth(token),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["invite"]["status"] == "invited"
    assert body["invite"]["name"] == "Shyam Kumar"
    assert body["invite"]["phone"] == "+919812345679"
    assert body["invite"]["invitedAt"] is not None
    assert body["agriCoinsEarned"] == 100
    assert body["stats"]["invited"] == 1
    assert body["stats"]["joined"] == 0
    assert body["stats"]["totalEarnedCoins"] == 100
    assert body["referralCode"] == "ref_uid-r2"

    assert user_store["users/uid-r2"]["agriCoins"] == 100
    invited = user_store["referrals/uid-r2/invited/+919812345679"]
    assert invited["status"] == "invited"

    ledger = _ledger_entries(user_store, "uid-r2")
    assert len(ledger) == 1
    entry = next(iter(ledger.values()))
    assert entry["amount"] == 100
    assert entry["reason"] == "referral"
    assert entry["refId"] == "+919812345679"
    assert entry["balanceAfter"] == 100

    shadow = _shadow_entries(user_store, "uid-r2")
    assert len(shadow) == 1
    shadow_entry = next(iter(shadow.values()))
    assert shadow_entry["userId"] == "uid-r2"
    assert shadow_entry["amount"] == 100
    assert shadow_entry["balanceAfter"] == 100
    assert shadow_entry["reason"] == "referral"


async def test_invite_duplicate_phone_conflict(client, user_store):
    token = seed_user(user_store, uid="uid-r3")
    payload = {"name": "Shyam Kumar", "phone": "+919812345679"}
    resp = await client.post("/v1/referrals/invite", json=payload, headers=auth(token))
    assert resp.status_code == 201
    resp = await client.post(
        "/v1/referrals/invite", json={**payload, "name": "Other Name"}, headers=auth(token)
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "ALREADY_INVITED"
    assert user_store["users/uid-r3"]["agriCoins"] == 100


async def test_invite_bad_phone_rejected(client, user_store):
    token = seed_user(user_store, uid="uid-r4")
    for bad_phone in ("9812345678", "+1", "+0123456789", "+9198765432109999"):
        resp = await client.post(
            "/v1/referrals/invite",
            json={"name": "Shyam", "phone": bad_phone},
            headers=auth(token),
        )
        assert resp.status_code == 400, bad_phone
        error = resp.json()["error"]
        assert error["code"] == "VALIDATION_ERROR"
        assert "phone" in error["fieldErrors"]
    assert user_store["users/uid-r4"]["agriCoins"] == 0


async def test_leaderboard_ranks_after_referrals(client, user_store):
    seed_user(user_store, uid="uid-r5", name="Asha Patil", village="Pimplas")
    seed_user(user_store, uid="uid-r6", name="Babu Rao", village="Ozark")
    for i in range(3):
        user_store[f"referral_attributions/uid-j{i}"] = {
            "referrerUid": "uid-r5",
            "referredUid": f"uid-j{i}",
            "code": "ref_uid-r5",
            "status": "joined",
            "createdAt": f"2026-09-2{i}T00:00:00+00:00",
        }
    user_store["referral_attributions/uid-j9"] = {
        "referrerUid": "uid-r6",
        "referredUid": "uid-j9",
        "code": "ref_uid-r6",
        "status": "joined",
        "createdAt": "2026-09-20T00:00:00+00:00",
    }
    token = seed_user(user_store, uid="uid-r5", name="Asha Patil", village="Pimplas")
    resp = await client.get("/v1/referrals", headers=auth(token))
    assert resp.status_code == 200
    board = resp.json()["leaderboard"]
    assert [(row["rank"], row["userId"], row["referralCount"]) for row in board] == [
        (1, "uid-r5", 3),
        (2, "uid-r6", 1),
    ]
    assert board[0]["name"] == "Asha Patil"
    assert board[0]["village"] == "Pimplas"
    assert board[0]["isMe"] is True
    assert board[1]["isMe"] is False
    assert resp.json()["myRank"] == {"rank": 1, "referralCount": 3}


async def test_my_rank_computed_outside_top_ten(client, user_store):
    seed_user(user_store, uid="uid-r7", name="Me", village="V1")
    for i in range(10):
        uid = f"uid-lb-{i}"
        seed_user(user_store, uid=uid, name=f"Farmer {i}")
        for j in range(2):
            user_store[f"referral_attributions/{uid}-{j}"] = {
                "referrerUid": uid,
                "referredUid": f"{uid}-referred-{j}",
                "status": "joined",
                "createdAt": "2026-09-20T00:00:00+00:00",
            }
    user_store["referral_attributions/uid-r7-x"] = {
        "referrerUid": "uid-r7",
        "referredUid": "uid-r7-referred",
        "status": "joined",
        "createdAt": "2026-09-20T00:00:00+00:00",
    }
    token = seed_user(user_store, uid="uid-r7", name="Me", village="V1")
    resp = await client.get("/v1/referrals", headers=auth(token))
    body = resp.json()
    assert len(body["leaderboard"]) == 10
    assert all(row["isMe"] is False for row in body["leaderboard"])
    assert body["myRank"] == {"rank": 11, "referralCount": 1}


async def test_registration_attributes_but_does_not_credit(client, user_store):
    """X11 task 8.13 — registering with a code stores attribution, NO credit."""
    # X11 daily earn cap: this flow later legitimately awards >200 coins/day,
    # so grant a higher daily budget for the test.
    user_store["platform_config/coins"] = {"dailyEarnCap": 100000}
    token = seed_user(user_store, uid="ref-1", name="Referrer One", village="Pimplas")
    resp = await client.post(
        "/v1/referrals/invite",
        json={"name": "Ram Patil", "phone": "+919812345678"},
        headers=auth(token),
    )
    assert resp.status_code == 201
    assert user_store["users/ref-1"]["agriCoins"] == 100

    resp = await _register(client, referralCode="ref_ref-1")
    assert resp.status_code == 200
    assert resp.json()["referral"]["applied"] is True

    # Registration wrote the attribution but moved no coins.
    assert user_store["users/ref-1"]["agriCoins"] == 100
    attribution = user_store["referral_attributions/uid-1"]
    assert attribution["status"] == "joined"
    assert attribution["credited"] is False
    assert attribution["referrerUid"] == "ref-1"
    assert user_store["users/uid-1"]["referralCodeUsed"] == "ref_ref-1"
    # No join credit yet → the invited doc is untouched and no FCM fired.
    assert user_store["referrals/ref-1/invited/+919812345678"]["status"] == "invited"
    assert _notifications_for(user_store, "ref-1") == []


async def test_first_transaction_credits_referrer_once(client, user_store):
    """X11 task 8.13 — the invitee's FIRST completed transaction credits once."""
    user_store["platform_config/coins"] = {"dailyEarnCap": 100000}
    token = seed_user(user_store, uid="ref-1", name="Referrer One", village="Pimplas")
    await client.post(
        "/v1/referrals/invite",
        json={"name": "Ram Patil", "phone": "+919812345678"},
        headers=auth(token),
    )
    resp = await _register(client, referralCode="ref_ref-1")
    assert resp.status_code == 200

    from app.services.pnl_engine import record_auto_entry

    # Invitee completes their first transaction → referrer credited.
    await record_auto_entry("uid-1", "income", 100000, "crop_sale", "lot_sale", "lot-1")
    # 100 (invite) + 100 (join) + 50 (first milestone)
    assert user_store["users/ref-1"]["agriCoins"] == 250
    profile = user_store["referrals/ref-1"]
    assert profile["joinedCount"] == 1
    assert profile["invitedCount"] == 1
    assert profile["totalEarnedCoins"] == 250
    assert profile["milestones"][0] == {"count": 1, "rewardCoins": 50, "achieved": True}
    assert profile["milestones"][1]["achieved"] is False

    invited = user_store["referrals/ref-1/invited/+919812345678"]
    assert invited["status"] == "joined"
    assert invited["joinedAt"] is not None
    assert invited["referredUid"] == "uid-1"

    attribution = user_store["referral_attributions/uid-1"]
    assert attribution["credited"] is True
    assert attribution["creditedAt"]

    notifications = _notifications_for(user_store, "ref-1")
    types = {n["data"]["type"] for n in notifications}
    assert types == {"referral_joined", "referral_milestone"}

    # Rule 3 (task 8.11): the referral credit wrote an audit_logs row.
    audits = [d for k, d in user_store.items() if k.startswith("audit_logs/")]
    assert any(a["action"] == "REFERRAL_CREDIT" for a in audits)

    # Replaying the same transaction event must NOT double-credit.
    await record_auto_entry("uid-1", "income", 100000, "crop_sale", "lot_sale", "lot-1")
    await record_auto_entry("uid-1", "income", 50000, "crop_sale", "lot_sale", "lot-2")
    assert user_store["users/ref-1"]["agriCoins"] == 250
    assert user_store["referrals/ref-1"]["joinedCount"] == 1

    # referred list shows exactly one joined entry, no duplicate from attribution
    resp = await client.get("/v1/referrals", headers=auth(token))
    referred = resp.json()["referred"]
    assert len(referred) == 1
    assert referred[0]["status"] == "joined"
    assert referred[0]["name"] == "Ram Patil"
    assert referred[0]["phone"] == "+919812345678"
    assert referred[0]["rewardCoins"] == 100
    assert referred[0]["joinedAt"] is not None
    assert resp.json()["stats"]["joined"] == 1
    assert resp.json()["leaderboard"][0]["referralCount"] == 1


async def test_code_join_without_invite_synthesizes_referred_entry(client, user_store):
    user_store["platform_config/coins"] = {"dailyEarnCap": 100000}
    seed_user(user_store, uid="ref-2", name="Direct Referrer", referralCode="ref_ref-2")
    resp = await _register(client, referralCode="ref_ref-2")
    assert resp.status_code == 200

    token = seed_user(user_store, uid="ref-2", name="Direct Referrer")
    resp = await client.get("/v1/referrals", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    # No credit until the invitee transacts → joinedCount is still 0.
    assert body["stats"]["joined"] == 0
    assert body["stats"]["invited"] == 0
    assert body["myRank"] == {"rank": 1, "referralCount": 1}
    assert len(body["referred"]) == 1
    entry = body["referred"][0]
    assert entry["status"] == "joined"
    assert entry["name"] == "Ram Patil"  # resolved from the joined user's doc
    assert entry["phone"] == "+919812345678"
    assert entry["rewardCoins"] == 100

    from app.services.pnl_engine import record_auto_entry

    await record_auto_entry("uid-1", "income", 100000, "crop_sale", "lot_sale", "lot-1")
    resp = await client.get("/v1/referrals", headers=auth(token))
    assert resp.json()["stats"]["joined"] == 1


async def test_milestones_flip_at_five_and_ten_joins(client, user_store):
    # X11 daily earn cap (WS-01 task 1.20): this flow legitimately awards
    # >200 coins/day, so grant a higher daily budget for the test.
    user_store["platform_config/coins"] = {"dailyEarnCap": 100000}
    seed_user(user_store, uid="ref-3", name="Power Referrer")
    profile = {
        "userId": "ref-3",
        "referralCode": "ref_ref-3",
        "invitedCount": 10,
        "joinedCount": 4,
        "totalEarnedCoins": 400,
        "milestones": [
            {"count": 1, "rewardCoins": 50, "achieved": True},
            {"count": 5, "rewardCoins": 150, "achieved": False},
            {"count": 10, "rewardCoins": 500, "achieved": False},
        ],
        "createdAt": "2026-09-01T00:00:00+00:00",
        "updatedAt": "2026-09-01T00:00:00+00:00",
    }
    user_store["referrals/ref-3"] = profile
    user_store["users/ref-3"] = {
        "id": "ref-3",
        "name": "Power Referrer",
        "phone": "+919800000003",
        "referralCode": "ref_ref-3",
        "agriCoins": 400,
    }

    from app.services.referrals import record_join

    result = await record_join("ref-3", "uid-new-5", "ref_ref-3")
    assert result["newMilestones"] == [{"count": 5, "rewardCoins": 150}]
    assert user_store["referrals/ref-3"]["joinedCount"] == 5
    # 400 + 100 join + 150 milestone
    assert user_store["users/ref-3"]["agriCoins"] == 650

    for i in range(5):
        await record_join("ref-3", f"uid-new-{10 + i}", "ref_ref-3")
    assert user_store["referrals/ref-3"]["joinedCount"] == 10
    assert user_store["referrals/ref-3"]["milestones"][2]["achieved"] is True
    # 650 + 5*100 join + 500 milestone
    assert user_store["users/ref-3"]["agriCoins"] == 1650

    ledger = _ledger_entries(user_store, "ref-3")
    earned = sum(e["amount"] for e in ledger.values())
    assert earned == 1650 - 400
    shadow = _shadow_entries(user_store, "ref-3")
    assert len(shadow) == len(ledger)
