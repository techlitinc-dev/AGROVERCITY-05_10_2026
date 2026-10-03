from datetime import datetime, timedelta, timezone

from tests.test_diary import auth, seed_user


def _at(days_ago=0, seconds=0):
    return (datetime.now(timezone.utc) - timedelta(days=days_ago, seconds=seconds)).isoformat()


def _seed_ledger(user_store, uid, entries):
    """entries: list of (doc_id, amount, reason, days_ago) — sets balanceAfter cumulatively."""
    balance = 0
    for doc_id, amount, reason, days_ago in entries:
        balance += amount
        user_store[f"users/{uid}/coin_ledger/{doc_id}"] = {
            "id": doc_id,
            "amount": amount,
            "reason": reason,
            "refId": None,
            "balanceAfter": balance,
            "at": _at(days_ago=days_ago),
        }


def _coin_ledger(user_store, uid):
    return {
        key: doc
        for key, doc in user_store.items()
        if key.startswith(f"users/{uid}/coin_ledger/")
    }


def _notifications_for(user_store, uid):
    return [
        doc
        for key, doc in user_store.items()
        if key.startswith("notifications/") and doc.get("userId") == uid
    ]


async def test_status_bronze_with_streak_and_badges(client, user_store):
    token = seed_user(user_store, uid="uid-gm-1", agriCoins=50)
    _seed_ledger(
        user_store,
        "uid-gm-1",
        [("e1", 15, "diary_entry", 2), ("e2", 25, "diary_entry", 1), ("e3", 10, "referral", 0)],
    )
    resp = await client.get("/v1/gamification/status", headers=auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["userId"] == "uid-gm-1"
    assert data["agriCoins"] == 50
    assert data["level"] == {
        "tier": "bronze",
        "title": "शुरुआत",
        "minCoins": 0,
        "nextTier": "silver",
        "coinsToNextTier": 150,
        "progressPct": 25.0,
    }
    assert data["dailyStreak"] == {"current": 3, "longest": 3}
    assert data["stats"] == {
        "coinsEarnedTotal": 50,
        "diaryEntries": 0,
        "referrals": 0,
        "redeems": 0,
    }
    assert len(data["badges"]) == 8
    by_id = {b["id"]: b for b in data["badges"]}
    assert by_id["coin_collector"]["progress"] == 50
    assert by_id["coin_collector"]["earned"] is False
    assert by_id["consistent"]["earned"] is False
    assert by_id["first_entry"]["earned"] is False
    rewards = data["availableRewards"]
    assert len(rewards) == 4
    assert {r["type"] for r in rewards} == {"voucher", "soil_test", "expert_call", "workshop"}
    assert all(r["available"] is False for r in rewards)


async def test_status_gold_reflects_referral_and_diary(client, user_store):
    token = seed_user(user_store, uid="uid-gm-2", agriCoins=750)
    _seed_ledger(user_store, "uid-gm-2", [("e1", 700, "referral", 0)])
    user_store["users/uid-gm-2/diary_entries/d1"] = {"id": "d1", "date": "2026-09-20"}
    user_store["referrals/uid-gm-2"] = {
        "userId": "uid-gm-2",
        "referralCode": "ref_uid-gm-2",
        "invitedCount": 2,
        "joinedCount": 1,
        "totalEarnedCoins": 100,
        "milestones": [{"count": 1, "rewardCoins": 50, "achieved": True}],
    }
    resp = await client.get("/v1/gamification/status", headers=auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["level"]["tier"] == "gold"
    assert data["level"]["title"] == "खुशहाल"
    assert data["level"]["minCoins"] == 500
    assert data["level"]["nextTier"] == "diamond"
    assert data["level"]["coinsToNextTier"] == 250
    assert data["level"]["progressPct"] == 50.0
    assert data["stats"]["diaryEntries"] == 1
    assert data["stats"]["referrals"] == 1
    by_id = {b["id"]: b for b in data["badges"]}
    assert by_id["first_entry"]["earned"] is True
    assert by_id["first_entry"]["earnedAt"] == "2026-09-20"
    assert by_id["sharer"]["earned"] is True
    assert by_id["coin_collector"]["earned"] is True
    voucher = next(r for r in data["availableRewards"] if r["type"] == "voucher")
    assert voucher["available"] is True
    assert next(r for r in data["availableRewards"] if r["type"] == "expert_call")["available"] is False


async def test_status_fresh_user_defaults(client, user_store):
    token = seed_user(user_store, uid="uid-gm-3")
    resp = await client.get("/v1/gamification/status", headers=auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["agriCoins"] == 0
    assert data["dailyStreak"] == {"current": 0, "longest": 0}
    assert data["stats"]["coinsEarnedTotal"] == 0
    assert data["stats"]["referrals"] == 0


async def test_status_badges_for_redeemer_and_consistent(client, user_store):
    token = seed_user(user_store, uid="uid-gm-3b", agriCoins=2000)
    _seed_ledger(user_store, "uid-gm-3b", [("e%d" % i, 10, "diary_entry", 6 - i) for i in range(7)])
    user_store["users/uid-gm-3b/redeemed_rewards/rw_x"] = {"id": "rw_x"}
    resp = await client.get("/v1/gamification/status", headers=auth(token))
    data = resp.json()
    assert data["dailyStreak"]["current"] == 7
    assert data["dailyStreak"]["longest"] == 7
    by_id = {b["id"]: b for b in data["badges"]}
    assert by_id["consistent"]["earned"] is True
    assert by_id["redeemer"]["earned"] is True
    assert data["stats"]["redeems"] == 1


async def test_ledger_pagination_envelope(client, user_store):
    token = seed_user(user_store, uid="uid-gm-4", agriCoins=60)
    _seed_ledger(
        user_store,
        "uid-gm-4",
        [("old", 10, "diary_entry", 0), ("mid", 20, "referral", 0), ("new", 30, "diary_entry", 0)],
    )
    # make ordering deterministic: re-stamp at timestamps
    base = datetime.now(timezone.utc)
    for i, doc_id in enumerate(["old", "mid", "new"]):
        user_store[f"users/uid-gm-4/coin_ledger/{doc_id}"]["at"] = (
            base - timedelta(seconds=2 - i)
        ).isoformat()
    resp = await client.get("/v1/gamification/ledger", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["page"] == 1
    assert body["pageSize"] == 20
    assert body["total"] == 3
    assert [e["id"] for e in body["data"]] == ["new", "mid", "old"]
    assert body["data"][0]["amount"] == 30
    assert body["data"][0]["balanceAfter"] == 60
    assert body["data"][0]["reason"] == "diary_entry"

    resp = await client.get("/v1/gamification/ledger?page=2&pageSize=2", headers=auth(token))
    body = resp.json()
    assert body["total"] == 3
    assert [e["id"] for e in body["data"]] == ["old"]


async def test_rewards_catalog(client, user_store):
    token = seed_user(user_store, uid="uid-gm-5", agriCoins=600)
    resp = await client.get("/v1/gamification/rewards", headers=auth(token))
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 4
    by_type = {r["type"]: r for r in data}
    assert by_type["voucher"]["coinsCost"] == 300
    assert by_type["soil_test"]["coinsCost"] == 500
    assert by_type["expert_call"]["coinsCost"] == 800
    assert by_type["workshop"]["coinsCost"] == 1000
    assert all("description" in r for r in data)
    assert by_type["voucher"]["available"] is True
    assert by_type["workshop"]["available"] is False


async def test_redeem_success_writes_ledger_and_reward(client, user_store):
    token = seed_user(user_store, uid="uid-gm-6", agriCoins=500)
    resp = await client.post(
        "/v1/gamification/redeem",
        json={"rewardType": "voucher", "coins": 300},
        headers=auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["voucherCode"].startswith("AGRI-VOUC")
    assert body["coins"] == 300
    assert body["balance"] == 200
    assert body["reward"]["type"] == "voucher"
    assert body["reward"]["coinsCost"] == 300
    assert body["redeemedAt"] is not None

    assert user_store["users/uid-gm-6"]["agriCoins"] == 200
    ledger = _coin_ledger(user_store, "uid-gm-6")
    assert len(ledger) == 1
    spend = next(iter(ledger.values()))
    assert spend["amount"] == -300
    assert spend["reason"] == "redeem"
    assert spend["balanceAfter"] == 200
    shadow = {
        key: doc
        for key, doc in user_store.items()
        if key.startswith("gamification_ledger/uid-gm-6_")
    }
    assert len(shadow) == 1
    assert next(iter(shadow.values()))["amount"] == -300

    rewards = {
        key: doc
        for key, doc in user_store.items()
        if key.startswith("users/uid-gm-6/redeemed_rewards/")
    }
    assert len(rewards) == 1
    reward_doc = next(iter(rewards.values()))
    assert reward_doc["rewardType"] == "voucher"
    assert reward_doc["coins"] == 300
    assert reward_doc["voucherCode"] == body["voucherCode"]

    notifications = _notifications_for(user_store, "uid-gm-6")
    assert len(notifications) == 1
    assert notifications[0]["data"]["type"] == "reward_redeemed"
    assert notifications[0]["data"]["voucherCode"] == body["voucherCode"]


async def test_redeem_wrong_coin_amount_rejected(client, user_store):
    token = seed_user(user_store, uid="uid-gm-7", agriCoins=500)
    resp = await client.post(
        "/v1/gamification/redeem",
        json={"rewardType": "voucher", "coins": 250},
        headers=auth(token),
    )
    assert resp.status_code == 400
    error = resp.json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert "coins" in error["fieldErrors"]
    assert user_store["users/uid-gm-7"]["agriCoins"] == 500


async def test_redeem_unknown_reward_type_rejected(client, user_store):
    token = seed_user(user_store, uid="uid-gm-8", agriCoins=500)
    resp = await client.post(
        "/v1/gamification/redeem",
        json={"rewardType": "discount", "coins": 50},
        headers=auth(token),
    )
    assert resp.status_code == 400
    error = resp.json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert "rewardType" in error["fieldErrors"]


async def test_redeem_insufficient_coins(client, user_store):
    token = seed_user(user_store, uid="uid-gm-9", agriCoins=30)
    resp = await client.post(
        "/v1/gamification/redeem",
        json={"rewardType": "voucher", "coins": 300},
        headers=auth(token),
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "INSUFFICIENT_COINS"
    assert user_store["users/uid-gm-9"]["agriCoins"] == 30
    assert _coin_ledger(user_store, "uid-gm-9") == {}


async def test_leaderboard_all_and_month_periods(client, user_store):
    seed_user(user_store, uid="uid-gm-10", name="Top Earner", village="Rampur")
    seed_user(user_store, uid="uid-gm-11", name="Steady Earner", village="Ozark")
    last_month = (datetime.now(timezone.utc).date().replace(day=1) - timedelta(days=5)).isoformat()
    user_store["gamification_ledger/uid-gm-10_a"] = {
        "userId": "uid-gm-10",
        "amount": 100,
        "reason": "referral",
        "refId": None,
        "balanceAfter": 100,
        "at": _at(),
    }
    user_store["gamification_ledger/uid-gm-10_b"] = {
        "userId": "uid-gm-10",
        "amount": 800,
        "reason": "referral",
        "refId": None,
        "balanceAfter": 900,
        "at": f"{last_month}T00:00:00+00:00",
    }
    user_store["gamification_ledger/uid-gm-11_a"] = {
        "userId": "uid-gm-11",
        "amount": 100,
        "reason": "diary_entry",
        "refId": None,
        "balanceAfter": 100,
        "at": _at(),
    }

    token = seed_user(user_store, uid="uid-gm-11", name="Steady Earner", village="Ozark")
    resp = await client.get("/v1/gamification/leaderboard", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["period"] == "all"
    assert [(row["rank"], row["userId"], row["coinsEarned"]) for row in body["data"]] == [
        (1, "uid-gm-10", 900),
        (2, "uid-gm-11", 100),
    ]
    assert body["data"][0]["name"] == "Top Earner"
    assert body["data"][0]["village"] == "Rampur"
    assert body["data"][0]["isMe"] is False
    assert body["data"][1]["isMe"] is True
    assert body["myRank"] == {"rank": 2, "coinsEarned": 100}

    resp = await client.get("/v1/gamification/leaderboard?period=month", headers=auth(token))
    body = resp.json()
    assert body["period"] == "month"
    assert [(row["rank"], row["userId"], row["coinsEarned"]) for row in body["data"]] == [
        (1, "uid-gm-10", 100),
        (2, "uid-gm-11", 100),
    ]
    assert body["myRank"] == {"rank": 2, "coinsEarned": 100}

    resp = await client.get("/v1/gamification/leaderboard?period=week", headers=auth(token))
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"
