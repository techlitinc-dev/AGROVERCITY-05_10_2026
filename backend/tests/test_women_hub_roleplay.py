"""WomenHub end-to-end roleplay — one story across five acts.

Act 1  Sunita (womenShg persona) registers "Prerna Bachat Gat", pays her deposit.
Act 2  Meena joins via request + the in-group loan lifecycle.
Act 3  Ramesh (farmer persona) discovers the group in the directory and joins.
Act 4  The cron job reminds the member who has not paid + a vaccination due soon.
Act 5  Insights, billing (womenShg tier + kill-switch), ratings reply, admin view.

Uses the shared conftest fixtures (in-memory Firestore monkeypatch) exactly
like tests/test_women.py: `client`, `user_store`, `seed_user`, `auth`.
"""
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.core.config import settings
from app.services.billing import seed_plans
from tests.test_diary import auth, seed_user

ADMIN = {"Authorization": "Bearer admin-token"}
CRON = {"X-Cron-Secret": "s3cret"}


def _ist_month() -> str:
    return datetime.now(timezone.utc).astimezone(ZoneInfo("Asia/Kolkata")).strftime("%Y-%m")


def _notes(user_store, ntype):
    return [
        doc
        for doc in user_store.values()
        if isinstance(doc, dict) and doc.get("type") == ntype
    ]


def _notified(user_store, ntype, uid):
    """True when an inbox notification of `ntype` exists for `uid` (digest
    queue rows use `uid` too, so both keys are checked)."""
    return any(
        doc.get("userId") == uid or doc.get("uid") == uid
        for doc in _notes(user_store, ntype)
    )


async def test_womenhub_happy_village_story(client, user_store, monkeypatch):
    # ------------------------------------------------------------------
    # Act 1 — Sunita, womenShg persona, registers her SHG and pays October.
    # ------------------------------------------------------------------
    sunita = seed_user(
        user_store, uid="uid-sunita", active_profile="womenShg",
        name="Sunita Pawar", village="Hivare", district="Pune",
    )
    resp = await client.post(
        "/v1/women/shg",
        json={
            "name": "Prerna Bachat Gat",
            "village": "Hivare",
            "district": "Pune",
            "memberCount": 1,  # the creator is a member
            "monthlyDepositPaisa": 50_000,  # ₹500/month
        },
        headers=auth(sunita),
    )
    assert resp.status_code == 201
    group_id = resp.json()["id"]

    month = _ist_month()  # October 2026 in the story
    resp = await client.post(
        "/v1/women/shg/deposit",
        json={"amountPaisa": 50_000, "month": month},
        headers=auth(sunita),
    )
    assert resp.status_code == 201
    # 25% (₹125) seeds the revolving loan fund; ₹375 lands in the corpus.
    assert resp.json()["newCorpusPaisa"] == 37_500
    assert resp.json()["newLoanFundPaisa"] == 12_500

    # her dashboard: corpus ₹375, loan fund ₹125, she has paid this month, she is the admin
    resp = await client.get("/v1/women/dashboard", headers=auth(sunita))
    assert resp.status_code == 200
    dashboard = resp.json()
    assert dashboard["group"]["name"] == "Prerna Bachat Gat"
    assert dashboard["group"]["village"] == "Hivare"
    assert dashboard["group"]["district"] == "Pune"
    assert dashboard["group"]["corpusPaisa"] == 37_500
    assert dashboard["group"]["loanFundPaisa"] == 12_500
    assert dashboard["group"]["isAdmin"] is True
    assert dashboard["depositMonth"] == month
    assert dashboard["deposits"]["myPaid"] is True
    assert dashboard["deposits"]["paidTotalPaisa"] == 50_000

    # ------------------------------------------------------------------
    # Act 2 — Meena joins, then borrows ₹2,000 for papad raw material.
    # ------------------------------------------------------------------
    meena = seed_user(
        user_store, uid="uid-meena", active_profile="womenShg",
        name="Meena Jadhav", village="Hivare",
    )
    resp = await client.post(
        "/v1/women/shg/join-requests",
        json={"shgId": group_id, "message": "मला गटात सामील व्हायचे आहे"},
        headers=auth(meena),
    )
    assert resp.status_code == 201
    assert resp.json()["status"] == "pending"

    # Sunita sees the pending request and approves it
    resp = await client.get("/v1/women/shg/join-requests", headers=auth(sunita))
    assert [r["uid"] for r in resp.json()["items"]] == ["uid-meena"]
    resp = await client.post(
        f"/v1/women/shg/join-requests/uid-meena/approve", headers=auth(sunita)
    )
    assert resp.status_code == 200
    assert user_store[f"shg_groups/{group_id}"]["memberCount"] == 2
    assert _notified(user_store, "shg_join_approved", "uid-meena")

    # the group corpus is the seed of the revolving loan fund (₹10,000)
    user_store[f"shg_groups/{group_id}"]["loanFundPaisa"] = 1_000_000

    # Meena requests a ₹2,000 loan for papad raw material, 10 months
    resp = await client.post(
        "/v1/women/shg/loans",
        json={
            "amountPaisa": 200_000,
            "purpose": "papad raw material",
            "months": 10,
        },
        headers=auth(meena),
    )
    assert resp.status_code == 201
    loan_id = resp.json()["id"]
    assert resp.json()["audit"] == [
        {
            "at": resp.json()["audit"][0]["at"],
            "by": "uid-meena",
            "byName": "Meena Jadhav",
            "action": "requested",
            "amountPaisa": 200_000,
        }
    ]
    assert _notified(user_store, "shg_loan_requested", "uid-sunita")

    # Sunita approves: the fund drops by ₹2,000 and a 10 x ₹200 schedule appears
    resp = await client.post(
        f"/v1/women/shg/loans/{loan_id}/approve", headers=auth(sunita)
    )
    assert resp.status_code == 200
    loan = resp.json()
    assert loan["status"] == "approved"
    assert user_store[f"shg_groups/{group_id}"]["loanFundPaisa"] == 800_000
    assert len(loan["schedule"]) == 10
    assert all(entry["amountPaisa"] == 20_000 for entry in loan["schedule"])  # ₹200
    assert all(entry["status"] == "pending" for entry in loan["schedule"])
    first_due = date.fromisoformat(loan["schedule"][0]["dueDate"])
    assert (first_due.year, first_due.month) != (date.today().year, date.today().month)
    assert any(
        (n.get("userId") or n.get("uid")) == "uid-meena"
        and loan_id in (n.get("data") or {}).get("deepLink", "")
        for n in _notes(user_store, "shg_loan_approved")
    )

    # Meena repays the first installment: schedule[0] flips to paid, fund restored
    resp = await client.post(
        f"/v1/women/shg/loans/{loan_id}/repay",
        json={"amountPaisa": 20_000},
        headers=auth(meena),
    )
    assert resp.status_code == 200
    assert resp.json()["repaidPaisa"] == 20_000
    assert resp.json()["schedule"][0]["status"] == "paid"
    assert resp.json()["schedule"][0]["paidOn"] == date.today().isoformat()
    assert resp.json()["schedule"][1]["status"] == "pending"
    assert user_store[f"shg_groups/{group_id}"]["loanFundPaisa"] == 820_000

    # ------------------------------------------------------------------
    # Act 3 — Ramesh (farmer persona) discovers the group and joins too.
    # ------------------------------------------------------------------
    ramesh = seed_user(
        user_store, uid="uid-ramesh", name="Ramesh Bhosale",
        village="Hivare", district="Pune",
    )
    resp = await client.get(
        "/v1/women/directory", params={"district": "Pune"}, headers=auth(ramesh)
    )
    assert resp.status_code == 200
    matches = resp.json()["items"]
    assert [g["name"] for g in matches] == ["Prerna Bachat Gat"]
    assert matches[0]["village"] == "Hivare"
    assert matches[0]["myRequestStatus"] == "none"

    resp = await client.post(
        "/v1/women/shg/join-requests",
        json={"shgId": group_id, "message": "शेती साहाय्याकरिता"},
        headers=auth(ramesh),
    )
    assert resp.status_code == 201
    await client.post(
        f"/v1/women/shg/join-requests/uid-ramesh/approve", headers=auth(sunita)
    )
    assert user_store[f"shg_groups/{group_id}"]["memberCount"] == 3

    # Ramesh pays his deposit through the farmer role (same hub, both personas)
    resp = await client.post(
        "/v1/women/shg/deposit",
        json={"amountPaisa": 50_000, "month": month},
        headers=auth(ramesh),
    )
    assert resp.status_code == 201
    # each deposit splits 75/25 between corpus and the loan fund (fund was
    # topped up to ₹10,000 in Act 2, then ₹2,000 lent and ₹200 repaid)
    assert resp.json()["newCorpusPaisa"] == 75_000
    assert resp.json()["newLoanFundPaisa"] == 832_500

    # ------------------------------------------------------------------
    # Act 4 — the reminders cron: Meena skipped October, Gauri needs FMD.
    # ------------------------------------------------------------------
    user_store["livestock_animals/c1"] = {
        "id": "c1",
        "tagId": "TAG-9",
        "name": "Gauri",
        "species": "Cow",
        "ownerId": "uid-meena",
    }
    due = (date.today() + timedelta(days=3)).isoformat()
    user_store["vaccination_schedules/v1"] = {
        "id": "v1",
        "animalTagId": "TAG-9",
        "disease": "FMD",
        "nextDueDate": due,
    }
    monkeypatch.setattr(settings, "cron_secret", "s3cret")

    resp = await client.post("/v1/jobs/women/reminders", headers=CRON)
    assert resp.status_code == 200
    # only Meena is missing her October deposit
    assert resp.json() == {"depositReminders": 1, "vaccinationReminders": 1}
    deposit_note = user_store[
        f"notifications/deposit_due_{group_id}_uid-meena_{month}"
    ]
    assert deposit_note["type"] == "deposit_due"
    assert deposit_note["userId"] == "uid-meena"
    vac_note = user_store[f"notifications/vaccination_due_TAG-9_FMD_{due}"]
    assert vac_note["type"] == "vaccination_due"
    assert vac_note["userId"] == "uid-meena"

    # deterministic ids: rerunning the job creates nothing new
    resp = await client.post("/v1/jobs/women/reminders", headers=CRON)
    assert resp.json() == {"depositReminders": 0, "vaccinationReminders": 0}
    inbox_deposit_notes = [d for d in _notes(user_store, "deposit_due") if "userId" in d]
    inbox_vac_notes = [d for d in _notes(user_store, "vaccination_due") if "userId" in d]
    assert len(inbox_deposit_notes) == 1
    assert len(inbox_vac_notes) == 1

    # Meena pays after the nudge — the corpus grows again
    resp = await client.post(
        "/v1/women/shg/deposit",
        json={"amountPaisa": 50_000, "month": month},
        headers=auth(meena),
    )
    assert resp.status_code == 201
    assert resp.json()["newCorpusPaisa"] == 112_500
    assert resp.json()["newLoanFundPaisa"] == 845_000

    # ------------------------------------------------------------------
    # Act 5 — insights, billing, ratings and the admin oversight desk.
    # ------------------------------------------------------------------
    # insights: savings trend carries October, loan health is one active loan
    resp = await client.get("/v1/women/insights", headers=auth(sunita))
    assert resp.status_code == 200
    insights = resp.json()
    trend_months = [t["month"] for t in insights["savingsTrend"]]
    assert len(trend_months) == 6 and trend_months[-1] == month
    october = insights["savingsTrend"][-1]
    assert october["depositsPaisa"] == 150_000 and october["count"] == 3
    assert insights["loanHealth"]["active"] == 1
    assert insights["loanHealth"]["overdue"] == 0
    assert insights["loanHealth"]["fundPaisa"] == 845_000

    # billing: the womenShg tier exists and the ₹9 first-month promo works
    await seed_plans()
    resp = await client.get(
        "/v1/billing/plans", params={"persona": "womenShg"}, headers=auth(sunita)
    )
    plans = {p["planId"]: p for p in resp.json()["data"]}
    assert plans["womenShg_first_month"]["priceMonthlyPaisa"] == 900
    assert plans["womenShg_first_month"]["promo"] is True
    resp = await client.post(
        "/v1/billing/subscribe",
        json={"planId": "womenShg_first_month"},
        headers=auth(sunita),
    )
    assert resp.status_code == 201
    assert resp.json()["status"] == "active"

    # the platform flips the kill-switch: new subscriptions are rejected
    resp = await client.put(
        "/v1/admin/billing/config",
        json={"subscriptionsEnabled": False},
        headers=ADMIN,
    )
    assert resp.status_code == 200
    resp = await client.get("/v1/admin/billing/config", headers=ADMIN)
    assert resp.json() == {"subscriptionsEnabled": False}
    blocked = await client.post(
        "/v1/billing/subscribe",
        json={"planId": "womenShg_monthly"},
        headers=auth(meena),
    )
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "subscriptions_disabled"
    await client.put(
        "/v1/admin/billing/config",
        json={"subscriptionsEnabled": True},
        headers=ADMIN,
    )

    # Ramesh rated Sunita's deal; she checks her public ratings and replies
    user_store["ratings/rat_1"] = {
        "id": "rat_1",
        "bookingKind": "deal",
        "bookingId": "deal_1",
        "stars": 5,
        "comment": "वेळेवल पैसे भरले, विश्वासू गट",
        "raterId": "uid-ramesh",
        "providerId": "uid-sunita",
        "createdAt": "2026-10-18T00:00:00+00:00",
    }
    user_store["provider_ratings/uid-sunita"] = {
        "id": "uid-sunita", "ratingAvg": 5.0, "ratingCount": 1,
    }
    resp = await client.get("/v1/ratings/mine", headers=auth(sunita))
    assert resp.status_code == 200
    mine = resp.json()
    assert mine["average"] == 5.0 and mine["count"] == 1
    assert mine["recent"][0]["raterName"] == "Ramesh Bhosale"
    assert mine["recent"][0]["reply"] is None
    resp = await client.post(
        "/v1/ratings/rat_1/reply",
        json={"reply": "धन्यवाद, रमेश! आपण एकत्र वाढूया."},
        headers=auth(sunita),
    )
    assert resp.status_code == 200
    resp = await client.get("/v1/ratings/mine", headers=auth(sunita))
    assert resp.json()["recent"][0]["reply"] == "धन्यवाद, रमेश! आपण एकत्र वाढूया."

    # Ramesh sees what he has authored
    resp = await client.get("/v1/ratings/given", headers=auth(ramesh))
    assert [r["id"] for r in resp.json()["items"]] == ["rat_1"]

    # the admin desk sees Meena's loan with the full audit trail
    resp = await client.get("/v1/admin/women/loans", headers=ADMIN)
    assert resp.status_code == 200
    rows = resp.json()["data"]
    assert len(rows) == 1
    assert rows[0]["groupName"] == "Prerna Bachat Gat"
    assert rows[0]["borrowerName"] == "Meena Jadhav"
    assert rows[0]["amountPaisa"] == 200_000
    assert [a["action"] for a in rows[0]["audit"]] == ["requested", "approved", "repayment"]

    # and October's deposit compliance across every group
    resp = await client.get(
        "/v1/admin/women/deposit-compliance",
        params={"month": month},
        headers=ADMIN,
    )
    row = next(r for r in resp.json()["items"] if r["groupId"] == group_id)
    assert row["memberCount"] == 3
    assert row["paidCount"] == 3
    assert row["paidTotalPaisa"] == 150_000
    assert row["expectedTotalPaisa"] == 150_000
