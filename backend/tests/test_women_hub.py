"""WomenHub extension tests (phase-05 WS-08 additions).

Covers: womenShg role gate, village/district on SHG create, the SHG directory,
join requests, the in-group loan lifecycle, dashboard + insights aggregates,
the women reminders cron job, womenShg billing tier + subscription kill-switch,
ratings self-service, ad geo targeting and the admin oversight endpoints.
"""
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.core.config import settings
from app.services.billing import seed_plans
from tests.test_diary import auth, seed_user

ADMIN = {"Authorization": "Bearer admin-token"}


def _ist_month() -> str:
    return datetime.now(timezone.utc).astimezone(ZoneInfo("Asia/Kolkata")).strftime("%Y-%m")


def _notifications(user_store, ntype=None):
    docs = [
        doc
        for key, doc in user_store.items()
        if key.startswith("notifications/") and (ntype is None or doc.get("type") == ntype)
    ]
    return docs


async def _create_group(client, token, **overrides):
    payload = {
        "name": "Prerna Bachat Gat",
        "memberCount": 1,
        "monthlyDepositPaisa": 50_000,
        "village": "Hivare",
        "district": "Pune",
    }
    payload.update(overrides)
    resp = await client.post("/v1/women/shg", json=payload, headers=auth(token))
    assert resp.status_code == 201
    return resp.json()


# ---------------------------------------------------------------------------
# Task 1 — role gate: farmer AND womenShg both work, other roles are 403
# ---------------------------------------------------------------------------


async def test_womenShg_persona_allowed_on_hub(client, user_store):
    token = seed_user(user_store, uid="uid-shg", active_profile="womenShg", name="Sunita")
    resp = await client.get("/v1/women/shg", headers=auth(token))
    assert resp.status_code == 200
    resp = await client.post(
        "/v1/women/home-enterprise",
        json={"product": "Papad", "monthlyProfitPaisa": 12_000},
        headers=auth(token),
    )
    assert resp.status_code == 201


async def test_farmer_persona_still_allowed(client, user_store):
    token = seed_user(user_store)  # default farmer
    resp = await client.get("/v1/women/shg", headers=auth(token))
    assert resp.status_code == 200


async def test_seller_forbidden_on_new_hub_endpoints(client, user_store):
    token = seed_user(user_store, active_profile="seller")
    for method, path in (
        ("GET", "/v1/women/dashboard"),
        ("GET", "/v1/women/insights"),
        ("GET", "/v1/women/shg/join-requests"),
        ("GET", "/v1/women/shg/loans"),
        ("POST", "/v1/women/shg/loans"),
    ):
        if method == "GET":
            resp = await client.get(path, headers=auth(token))
        else:
            resp = await client.post(
                path, json={"amountPaisa": 100, "purpose": "x", "months": 2}, headers=auth(token)
            )
        assert resp.status_code == 403, path
        assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"


# ---------------------------------------------------------------------------
# Task 2 — village/district on create + Task 3 — directory
# ---------------------------------------------------------------------------


async def test_create_group_persists_village_and_district(client, user_store):
    token = seed_user(user_store, uid="uid-shg", active_profile="womenShg")
    group = await _create_group(client, token)
    assert group["village"] == "Hivare"
    assert group["district"] == "Pune"
    resp = await client.get("/v1/women/shg", headers=auth(token))
    assert resp.json()["group"]["village"] == "Hivare"
    assert resp.json()["group"]["district"] == "Pune"


async def test_create_group_village_optional(client, user_store):
    token = seed_user(user_store, uid="uid-shg", active_profile="womenShg")
    resp = await client.post(
        "/v1/women/shg",
        json={"name": "No Village Gat"},
        headers=auth(token),
    )
    assert resp.status_code == 201
    assert resp.json()["village"] is None


async def test_directory_filters_and_shape(client, user_store):
    sunita = seed_user(user_store, uid="uid-shg", active_profile="womenShg")
    group = await _create_group(client, sunita)
    other = seed_user(user_store, uid="uid-other", active_profile="womenShg")
    await _create_group(
        client, other, name="Hivare Second Gat", village="hivare", district="pune"
    )
    # verified marker = admin verify flow sets status "verified"
    user_store[f"shg_groups/{group['id']}"]["status"] = "verified"

    # any authenticated role may browse the directory (read-only discovery)
    seller = seed_user(user_store, uid="uid-seller", active_profile="seller")
    resp = await client.get("/v1/women/directory", headers=auth(seller))
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) == 2
    by_id = {item["id"]: item for item in items}
    assert by_id[group["id"]]["verified"] is True
    assert by_id[group["id"]]["village"] == "Hivare"
    assert by_id[group["id"]]["myRequestStatus"] == "none"
    assert by_id[group["id"]]["monthlyDepositPaisa"] == 50_000

    resp = await client.get("/v1/women/directory", params={"q": "prerna"}, headers=auth(seller))
    assert [i["name"] for i in resp.json()["items"]] == ["Prerna Bachat Gat"]

    resp = await client.get(
        "/v1/women/directory", params={"district": "PUNE"}, headers=auth(seller)
    )
    assert len(resp.json()["items"]) == 2
    resp = await client.get(
        "/v1/women/directory", params={"village": "Hivare", "q": "second"}, headers=auth(seller)
    )
    assert [i["name"] for i in resp.json()["items"]] == ["Hivare Second Gat"]
    resp = await client.get(
        "/v1/women/directory", params={"district": "Nashik"}, headers=auth(seller)
    )
    assert resp.json()["items"] == []


# ---------------------------------------------------------------------------
# Task 4 — join requests
# ---------------------------------------------------------------------------


async def _join(client, token, shg_id, message=None):
    payload = {"shgId": shg_id}
    if message is not None:
        payload["message"] = message
    return await client.post("/v1/women/shg/join-requests", json=payload, headers=auth(token))


async def test_join_request_happy_path(client, user_store):
    sunita = seed_user(user_store, uid="uid-shg", active_profile="womenShg", name="Sunita")
    group = await _create_group(client, sunita)
    meena = seed_user(user_store, uid="uid-meena", active_profile="womenShg", name="Meena")

    resp = await _join(client, meena, group["id"], message="मला सामील व्हायचे आहे")
    assert resp.status_code == 201
    request = resp.json()
    assert request["id"] == f"{group['id']}_uid-meena"
    assert request["status"] == "pending"
    assert request["name"] == "Meena"

    # group admin sees it in the pending list
    resp = await client.get("/v1/women/shg/join-requests", headers=auth(sunita))
    assert [r["uid"] for r in resp.json()["items"]] == ["uid-meena"]

    # directory now reports the pending status for Meena
    resp = await client.get("/v1/women/directory", headers=auth(meena))
    item = next(i for i in resp.json()["items"] if i["id"] == group["id"])
    assert item["myRequestStatus"] == "pending"

    # duplicate pending request -> 409
    resp = await _join(client, meena, group["id"])
    assert resp.status_code == 409

    # approve -> member appended, memberCount bumped, requester notified
    resp = await client.post(
        f"/v1/women/shg/join-requests/uid-meena/approve", headers=auth(sunita)
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "approved"
    group_doc = user_store[f"shg_groups/{group['id']}"]
    assert [m["memberUid"] for m in group_doc["members"]] == ["uid-shg", "uid-meena"]
    assert group_doc["memberCount"] == 2
    approved = _notifications(user_store, "shg_join_approved")
    assert any(n["userId"] == "uid-meena" for n in approved)

    # approving again is idempotent — no duplicate member
    resp = await client.post(
        f"/v1/women/shg/join-requests/uid-meena/approve", headers=auth(sunita)
    )
    assert resp.status_code == 200
    group_doc = user_store[f"shg_groups/{group['id']}"]
    assert [m["memberUid"] for m in group_doc["members"]] == ["uid-shg", "uid-meena"]
    assert group_doc["memberCount"] == 2

    # one-group-per-user: Meena can no longer request/create elsewhere
    other = seed_user(user_store, uid="uid-other", active_profile="womenShg")
    other_group = await _create_group(client, other)
    resp = await _join(client, meena, other_group["id"])
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "ALREADY_HAS_GROUP"
    resp = await client.post(
        "/v1/women/shg", json={"name": "Meena Gat"}, headers=auth(meena)
    )
    assert resp.status_code == 409


async def test_join_request_unknown_group_404(client, user_store):
    meena = seed_user(user_store, uid="uid-meena", active_profile="womenShg")
    resp = await _join(client, meena, "shg_nope")
    assert resp.status_code == 404


async def test_join_request_decline_and_reapply(client, user_store):
    sunita = seed_user(user_store, uid="uid-shg", active_profile="womenShg")
    group = await _create_group(client, sunita)
    meena = seed_user(user_store, uid="uid-meena", active_profile="womenShg")
    await _join(client, meena, group["id"])

    resp = await client.post(
        f"/v1/women/shg/join-requests/uid-meena/decline", headers=auth(sunita)
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "declined"
    declined = _notifications(user_store, "shg_join_declined")
    assert any(n["userId"] == "uid-meena" for n in declined)

    # pending list is empty again; a declined requester may re-apply
    resp = await client.get("/v1/women/shg/join-requests", headers=auth(sunita))
    assert resp.json()["items"] == []
    resp = await _join(client, meena, group["id"])
    assert resp.status_code == 201
    assert resp.json()["status"] == "pending"

    # non-admin cannot approve
    ramesh = seed_user(user_store, uid="uid-ramesh")
    resp = await client.post(
        f"/v1/women/shg/join-requests/uid-meena/approve", headers=auth(ramesh)
    )
    assert resp.status_code == 403


async def test_join_request_notifies_group_admin(client, user_store):
    sunita = seed_user(user_store, uid="uid-shg", active_profile="womenShg", name="Sunita")
    group = await _create_group(client, sunita)
    meena = seed_user(user_store, uid="uid-meena", active_profile="womenShg", name="Meena")
    await _join(client, meena, group["id"])
    requests = _notifications(user_store, "shg_join_request")
    assert any(n["userId"] == "uid-shg" for n in requests)


async def test_join_request_idempotency_key(client, user_store):
    sunita = seed_user(user_store, uid="uid-shg", active_profile="womenShg")
    group = await _create_group(client, sunita)
    meena = seed_user(user_store, uid="uid-meena", active_profile="womenShg")
    headers = {**auth(meena), "Idempotency-Key": "join-123"}
    first = await client.post(
        "/v1/women/shg/join-requests", json={"shgId": group["id"]}, headers=headers
    )
    assert first.status_code == 201
    second = await client.post(
        "/v1/women/shg/join-requests", json={"shgId": group["id"]}, headers=headers
    )
    assert second.status_code == 201
    assert second.json()["id"] == first.json()["id"]
    all_requests = [
        d for d in user_store.values() if isinstance(d, dict) and d.get("shgId") == group["id"]
    ]
    assert len(all_requests) == 1


# ---------------------------------------------------------------------------
# Task 5 — in-group loan lifecycle
# ---------------------------------------------------------------------------


def _seed_group_with_fund(user_store, fund=1_000_000):
    group_id = "shg_loan_hub"
    user_store[f"shg_groups/{group_id}"] = {
        "id": group_id,
        "name": "Loan Test Gat",
        "memberUid": "uid-shg",
        "memberCount": 2,
        "corpusPaisa": 0,
        "loanFundPaisa": fund,
        "monthlyDepositPaisa": 50_000,
        "members": [
            {"memberUid": "uid-shg", "name": "Sunita", "role": "president"},
            {"memberUid": "uid-meena", "name": "Meena", "role": "member"},
        ],
    }
    return group_id


async def test_loan_request_requires_group(client, user_store):
    token = seed_user(user_store, uid="uid-loner", active_profile="womenShg")
    resp = await client.post(
        "/v1/women/shg/loans",
        json={"amountPaisa": 10_000, "purpose": "seeds", "months": 3},
        headers=auth(token),
    )
    assert resp.status_code == 409


async def test_loan_request_validation(client, user_store):
    token = seed_user(user_store, uid="uid-shg", active_profile="womenShg")
    _seed_group_with_fund(user_store)
    base = {"purpose": "seeds", "months": 3}
    for bad in (
        {**base, "amountPaisa": 0},
        {**base, "amountPaisa": -5},
        {"amountPaisa": 100, "purpose": "", "months": 3},
        {**base, "amountPaisa": 100, "months": 0},
        {**base, "amountPaisa": 100, "months": 25},
    ):
        resp = await client.post("/v1/women/shg/loans", json=bad, headers=auth(token))
        assert resp.status_code == 422, bad


async def test_loan_insufficient_fund_and_active_loan(client, user_store):
    token = seed_user(user_store, uid="uid-meena", active_profile="womenShg")
    _seed_group_with_fund(user_store, fund=5_000)
    resp = await client.post(
        "/v1/women/shg/loans",
        json={"amountPaisa": 10_000, "purpose": "seeds", "months": 3},
        headers=auth(token),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "INSUFFICIENT_LOAN_FUND"

    resp = await client.post(
        "/v1/women/shg/loans",
        json={"amountPaisa": 5_000, "purpose": "seeds", "months": 3},
        headers=auth(token),
    )
    assert resp.status_code == 201
    loan_id = resp.json()["id"]
    assert resp.json()["status"] == "requested"
    assert resp.json()["audit"][0]["action"] == "requested"
    assert resp.json()["repaidPaisa"] == 0

    resp = await client.post(
        "/v1/women/shg/loans",
        json={"amountPaisa": 1_000, "purpose": "more", "months": 2},
        headers=auth(token),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "ACTIVE_LOAN_EXISTS"

    # borrower can cancel while requested; fund untouched
    resp = await client.post(f"/v1/women/shg/loans/{loan_id}/cancel", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"
    assert user_store["shg_groups/shg_loan_hub"]["loanFundPaisa"] == 5_000

    # after cancelling, a new request is allowed
    resp = await client.post(
        "/v1/women/shg/loans",
        json={"amountPaisa": 4_000, "purpose": "again", "months": 2},
        headers=auth(token),
    )
    assert resp.status_code == 201


async def test_loan_approve_schedule_math_and_fund(client, user_store):
    sunita = seed_user(user_store, uid="uid-shg", active_profile="womenShg", name="Sunita")
    meena = seed_user(user_store, uid="uid-meena", active_profile="womenShg", name="Meena")
    _seed_group_with_fund(user_store)

    created = await client.post(
        "/v1/women/shg/loans",
        json={"amountPaisa": 100_000, "purpose": "papad raw material", "months": 3},
        headers=auth(meena),
    )
    assert created.status_code == 201
    loan_id = created.json()["id"]

    # non-admin cannot approve
    resp = await client.post(f"/v1/women/shg/loans/{loan_id}/approve", headers=auth(meena))
    assert resp.status_code == 403

    resp = await client.post(f"/v1/women/shg/loans/{loan_id}/approve", headers=auth(sunita))
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "approved"
    assert body["approvedAt"] is not None
    # 100000 / 3 = 33333 + 33333 + 33334 (remainder rides on the last installment)
    assert [s["amountPaisa"] for s in body["schedule"]] == [33_333, 33_333, 33_334]
    assert [s["no"] for s in body["schedule"]] == [1, 2, 3]
    assert all(s["status"] == "pending" and s["paidOn"] is None for s in body["schedule"])
    # first due one month from today, each subsequent entry one month apart
    today = date.today()
    due_dates = [date.fromisoformat(s["dueDate"]) for s in body["schedule"]]
    assert due_dates[0] == _add_months(today, 1)
    assert due_dates[1] == _add_months(today, 2)
    assert due_dates[2] == _add_months(today, 3)
    assert body["audit"][-1]["action"] == "approved"
    assert body["audit"][-1]["by"] == "uid-shg"
    # group loan fund decreased by the principal
    assert user_store["shg_groups/shg_loan_hub"]["loanFundPaisa"] == 900_000
    # borrower notified with a deep link to the loan
    approved_notes = _notifications(user_store, "shg_loan_approved")
    assert any(
        n["userId"] == "uid-meena" and loan_id in (n.get("data") or {}).get("deepLink", "")
        for n in approved_notes
    )

    # second approval returns current state (idempotent)
    resp = await client.post(f"/v1/women/shg/loans/{loan_id}/approve", headers=auth(sunita))
    assert resp.status_code == 200
    assert resp.json()["status"] == "approved"
    assert user_store["shg_groups/shg_loan_hub"]["loanFundPaisa"] == 900_000


async def test_loan_approve_even_installments(client, user_store):
    sunita = seed_user(user_store, uid="uid-shg", active_profile="womenShg")
    meena = seed_user(user_store, uid="uid-meena", active_profile="womenShg")
    _seed_group_with_fund(user_store, fund=1_000_000)
    created = await client.post(
        "/v1/women/shg/loans",
        json={"amountPaisa": 200_000, "purpose": "papad", "months": 10},
        headers=auth(meena),
    )
    loan_id = created.json()["id"]
    resp = await client.post(f"/v1/women/shg/loans/{loan_id}/approve", headers=auth(sunita))
    schedule = resp.json()["schedule"]
    assert len(schedule) == 10
    assert all(s["amountPaisa"] == 20_000 for s in schedule)


async def test_loan_repay_partial_to_full(client, user_store):
    sunita = seed_user(user_store, uid="uid-shg", active_profile="womenShg")
    meena = seed_user(user_store, uid="uid-meena", active_profile="womenShg")
    _seed_group_with_fund(user_store, fund=900_000)
    created = await client.post(
        "/v1/women/shg/loans",
        json={"amountPaisa": 100_000, "purpose": "stock", "months": 3},
        headers=auth(meena),
    )
    loan_id = created.json()["id"]
    await client.post(f"/v1/women/shg/loans/{loan_id}/approve", headers=auth(sunita))

    # overpayment rejected
    resp = await client.post(
        f"/v1/women/shg/loans/{loan_id}/repay",
        json={"amountPaisa": 100_001},
        headers=auth(meena),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "OVERPAYMENT"

    # repay the first installment
    resp = await client.post(
        f"/v1/women/shg/loans/{loan_id}/repay",
        json={"amountPaisa": 33_333},
        headers=auth(meena),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["repaidPaisa"] == 33_333
    assert body["status"] == "approved"
    assert body["schedule"][0]["status"] == "paid"
    assert body["schedule"][0]["paidOn"] == date.today().isoformat()
    assert body["schedule"][1]["status"] == "pending"
    assert body["audit"][-1]["action"] == "repayment"
    # repayment replenishes the group loan fund
    assert user_store["shg_groups/shg_loan_hub"]["loanFundPaisa"] == 833_333

    # only the borrower can repay
    ramesh = seed_user(user_store, uid="uid-ramesh")
    resp = await client.post(
        f"/v1/women/shg/loans/{loan_id}/repay",
        json={"amountPaisa": 100},
        headers=auth(ramesh),
    )
    assert resp.status_code == 404

    # finish the loan: 33333 then 33334
    await client.post(
        f"/v1/women/shg/loans/{loan_id}/repay",
        json={"amountPaisa": 33_333},
        headers=auth(meena),
    )
    resp = await client.post(
        f"/v1/women/shg/loans/{loan_id}/repay",
        json={"amountPaisa": 33_334},
        headers=auth(meena),
    )
    body = resp.json()
    assert body["status"] == "repaid"
    assert all(s["status"] == "paid" for s in body["schedule"])
    assert user_store["shg_groups/shg_loan_hub"]["loanFundPaisa"] == 900_000
    repaid_notes = _notifications(user_store, "shg_loan_repaid")
    assert any(n["userId"] == "uid-meena" for n in repaid_notes)

    # repaying a repaid loan -> 409
    resp = await client.post(
        f"/v1/women/shg/loans/{loan_id}/repay",
        json={"amountPaisa": 100},
        headers=auth(meena),
    )
    assert resp.status_code == 409


async def test_loans_list_for_group(client, user_store):
    sunita = seed_user(user_store, uid="uid-shg", active_profile="womenShg")
    meena = seed_user(user_store, uid="uid-meena", active_profile="womenShg")
    _seed_group_with_fund(user_store)
    first = await client.post(
        "/v1/women/shg/loans",
        json={"amountPaisa": 10_000, "purpose": "one", "months": 2},
        headers=auth(meena),
    )
    second = await client.post(
        "/v1/women/shg/loans",
        json={"amountPaisa": 20_000, "purpose": "two", "months": 4},
        headers=auth(sunita),
    )
    resp = await client.get("/v1/women/shg/loans", headers=auth(sunita))
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert [i["id"] for i in items] == [second.json()["id"], first.json()["id"]]  # newest first
    assert all(set(i.keys()) >= {"schedule", "audit", "borrowerName"} for i in items)

    # member with no group gets an empty list, not an error
    loner = seed_user(user_store, uid="uid-loner", active_profile="womenShg")
    resp = await client.get("/v1/women/shg/loans", headers=auth(loner))
    assert resp.json() == {"items": []}


# ---------------------------------------------------------------------------
# Task 6 — dashboard
# ---------------------------------------------------------------------------


async def test_dashboard_with_group(client, user_store):
    sunita = seed_user(user_store, uid="uid-shg", active_profile="womenShg", name="Sunita")
    group = await _create_group(client, sunita)  # monthly ₹500
    meena = seed_user(user_store, uid="uid-meena", active_profile="womenShg")
    await _join(client, meena, group["id"])
    await client.post(
        f"/v1/women/shg/join-requests/uid-meena/approve", headers=auth(sunita)
    )
    month = _ist_month()
    await client.post(
        "/v1/women/shg/deposit",
        json={"amountPaisa": 50_000, "month": month},
        headers=auth(sunita),
    )
    await client.post(
        "/v1/women/garden-plans",
        json={"category": "My Garden", "items": [{"name": "Spinach", "daysToHarvest": 40}]},
        headers=auth(sunita),
    )
    await client.post(
        "/v1/women/home-enterprise",
        json={"product": "Papad", "monthlyProfitPaisa": 12_000},
        headers=auth(sunita),
    )

    resp = await client.get("/v1/women/dashboard", headers=auth(sunita))
    assert resp.status_code == 200
    body = resp.json()
    assert body["group"]["id"] == group["id"]
    assert body["group"]["isAdmin"] is True
    assert body["group"]["village"] == "Hivare"
    assert body["depositMonth"] == month
    assert body["deposits"] == {
        "memberCount": 2,
        "paidCount": 1,
        "paidTotalPaisa": 50_000,
        "expectedTotalPaisa": 100_000,
        "myPaid": True,
    }
    assert body["garden"]["activePlans"] == 1
    assert body["garden"]["recent"][0]["cropName"] == "Spinach"
    assert body["enterprise"] == {"totalMonthlyProfitPaisa": 12_000, "lineCount": 1}
    assert body["loans"] == {"pendingCount": 0, "activeCount": 0, "myActive": None}
    assert body["joinRequests"] == {"pendingCount": 0}

    # Meena is a member but not the admin
    resp = await client.get("/v1/women/dashboard", headers=auth(meena))
    body = resp.json()
    assert body["group"]["isAdmin"] is False
    assert body["deposits"]["myPaid"] is False
    assert body["joinRequests"] == {"pendingCount": 0}


async def test_dashboard_due_vaccinations(client, user_store):
    token = seed_user(user_store, uid="uid-shg", active_profile="womenShg")
    await _create_group(client, token)
    user_store["livestock_animals/c1"] = {
        "id": "c1",
        "tagId": "TAG-1",
        "name": "Ganga",
        "species": "Cow",
        "ownerId": "uid-shg",
    }
    due = (date.today() + timedelta(days=10)).isoformat()
    user_store["livestock_animals/c2"] = {
        "id": "c2",
        "tagId": "TAG-2",
        "name": "Jamuna",
        "species": "Buffalo",
        "ownerId": "uid-shg",
    }
    far = (date.today() + timedelta(days=60)).isoformat()
    user_store["vaccination_schedules/v1"] = {
        "id": "v1", "animalTagId": "TAG-1", "disease": "FMD", "nextDueDate": due,
    }
    user_store["vaccination_schedules/v2"] = {
        "id": "v2", "animalTagId": "TAG-2", "disease": "HS", "nextDueDate": far,
    }
    resp = await client.get("/v1/women/dashboard", headers=auth(token))
    section = resp.json()["livestock"]
    assert section["animalCount"] == 2
    assert section["dueVaccinations"] == [
        {
            "animalId": "c1",
            "label": "Ganga",
            "vaccine": "FMD",
            "dueDate": due,
            "daysLeft": 10,
        }
    ]


async def test_dashboard_without_group_still_shows_personal_sections(client, user_store):
    token = seed_user(user_store, uid="uid-shg", active_profile="womenShg")
    await client.post(
        "/v1/women/garden-plans",
        json={"category": "Roof Garden", "items": [{"name": "Tomato", "daysToHarvest": 90}]},
        headers=auth(token),
    )
    await client.post(
        "/v1/women/home-enterprise",
        json={"product": "Pickle", "monthlyProfitPaisa": 8_000},
        headers=auth(token),
    )
    resp = await client.get("/v1/women/dashboard", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["group"] is None
    assert body["deposits"] == {
        "memberCount": 0,
        "paidCount": 0,
        "paidTotalPaisa": 0,
        "expectedTotalPaisa": 0,
        "myPaid": False,
    }
    assert body["garden"]["activePlans"] == 1
    assert body["enterprise"]["totalMonthlyProfitPaisa"] == 8_000
    assert body["loans"] == {"pendingCount": 0, "activeCount": 0, "myActive": None}
    assert body["joinRequests"] == {"pendingCount": 0}


# ---------------------------------------------------------------------------
# Task 7 — insights
# ---------------------------------------------------------------------------


async def test_insights_with_data(client, user_store):
    sunita = seed_user(user_store, uid="uid-shg", active_profile="womenShg", name="Sunita")
    group = await _create_group(client, sunita)
    meena = seed_user(user_store, uid="uid-meena", active_profile="womenShg")
    await _join(client, meena, group["id"])
    await client.post(
        f"/v1/women/shg/join-requests/uid-meena/approve", headers=auth(sunita)
    )
    month = _ist_month()
    await client.post(
        "/v1/women/shg/deposit",
        json={"amountPaisa": 50_000, "month": month},
        headers=auth(sunita),
    )
    # loan: approved with one overdue pending installment
    user_store[f"shg_groups/{group['id']}"]["loanFundPaisa"] = 1_000_000
    created = await client.post(
        "/v1/women/shg/loans",
        json={"amountPaisa": 100_000, "purpose": "stock", "months": 3},
        headers=auth(meena),
    )
    loan_id = created.json()["id"]
    approved = await client.post(
        f"/v1/women/shg/loans/{loan_id}/approve", headers=auth(sunita)
    )
    schedule = approved.json()["schedule"]
    schedule[0]["dueDate"] = (date.today() - timedelta(days=2)).isoformat()
    user_store[f"shg_loans/{loan_id}"]["schedule"] = schedule
    # one repaid loan
    user_store["shg_loans/loan_old"] = {
        "id": "loan_old",
        "shgId": group["id"],
        "borrowerUid": "uid-shg",
        "amountPaisa": 5_000,
        "months": 1,
        "status": "repaid",
        "requestedAt": "2026-08-01T00:00:00+00:00",
        "schedule": [],
        "audit": [],
    }
    await client.post(
        "/v1/women/home-enterprise",
        json={"product": "Papad", "monthlyProfitPaisa": 1_000, "revenuePaisa": 10_000},
        headers=auth(sunita),
    )

    resp = await client.get("/v1/women/insights", headers=auth(sunita))
    assert resp.status_code == 200
    body = resp.json()
    trend = body["savingsTrend"]
    assert len(trend) == 6
    assert trend[-1] == {"month": month, "depositsPaisa": 50_000, "count": 1}
    assert all(trend[i]["month"] < trend[i + 1]["month"] for i in range(5))  # oldest first
    assert body["loanHealth"] == {
        "requested": 0,
        "active": 1,
        "repaid": 1,
        "overdue": 1,
        "fundPaisa": 900_000,
    }
    assert body["garden"] == {"activePlans": 0, "byStatus": {}, "harvested": 0}
    assert body["livestock"] == {"animalCount": 0, "dueVaccinations": 0}
    assert body["enterprise"]["totalMonthlyProfitPaisa"] == 1_000
    assert body["enterprise"]["bestSeller"] == {
        "name": "Papad",
        "revenuePaisa": 10_000,
        "profitPaisa": 1_000,
    }
    # 10% margin < 20% -> suggests a ~10% price hike with a concrete rupee amount
    assert "~10% price increase" in body["enterprise"]["suggestion"]
    assert "₹1" in body["enterprise"]["suggestion"]


async def test_insights_high_margin_suggests_scaling(client, user_store):
    token = seed_user(user_store, uid="uid-shg", active_profile="womenShg")
    await client.post(
        "/v1/women/home-enterprise",
        json={"product": "Ghee", "monthlyProfitPaisa": 6_000, "revenuePaisa": 10_000},
        headers=auth(token),
    )
    resp = await client.get("/v1/women/insights", headers=auth(token))
    suggestion = resp.json()["enterprise"]["suggestion"]
    assert "scale" in suggestion.lower()
    assert "Ghee" in suggestion


async def test_insights_empty_state_never_500(client, user_store):
    token = seed_user(user_store, uid="uid-shg", active_profile="womenShg")
    resp = await client.get("/v1/women/insights", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["savingsTrend"]) == 6
    assert all(t["depositsPaisa"] == 0 and t["count"] == 0 for t in body["savingsTrend"])
    assert body["loanHealth"] == {
        "requested": 0, "active": 0, "repaid": 0, "overdue": 0, "fundPaisa": 0,
    }
    assert body["garden"] == {"activePlans": 0, "byStatus": {}, "harvested": 0}
    assert body["livestock"] == {"animalCount": 0, "dueVaccinations": 0}
    assert body["enterprise"]["bestSeller"] is None
    assert body["enterprise"]["totalMonthlyProfitPaisa"] == 0


# ---------------------------------------------------------------------------
# Task 8 — reminders job
# ---------------------------------------------------------------------------


async def _setup_reminder_group(client, user_store):
    sunita = seed_user(user_store, uid="uid-shg", active_profile="womenShg", name="Sunita")
    group = await _create_group(client, sunita)
    meena = seed_user(user_store, uid="uid-meena", active_profile="womenShg", name="Meena")
    await _join(client, meena, group["id"])
    await client.post(
        f"/v1/women/shg/join-requests/uid-meena/approve", headers=auth(sunita)
    )
    # Sunita paid this month; Meena has not
    await client.post(
        "/v1/women/shg/deposit",
        json={"amountPaisa": 50_000, "month": _ist_month()},
        headers=auth(sunita),
    )
    return group


async def test_women_reminders_job(client, user_store, monkeypatch):
    group = await _setup_reminder_group(client, user_store)
    due = (date.today() + timedelta(days=3)).isoformat()
    user_store["livestock_animals/c1"] = {
        "id": "c1", "tagId": "TAG-9", "name": "Gauri", "species": "Cow",
        "ownerId": "uid-meena",
    }
    user_store["vaccination_schedules/v1"] = {
        "id": "v1", "animalTagId": "TAG-9", "disease": "FMD", "nextDueDate": due,
    }
    monkeypatch.setattr(settings, "cron_secret", "s3cret")

    # wrong secret -> 401
    resp = await client.post(
        "/v1/jobs/women/reminders", headers={"X-Cron-Secret": "wrong"}
    )
    assert resp.status_code == 401

    resp = await client.post(
        "/v1/jobs/women/reminders", headers={"X-Cron-Secret": "s3cret"}
    )
    assert resp.status_code == 200
    assert resp.json() == {"depositReminders": 1, "vaccinationReminders": 1}

    month = _ist_month()
    deposit_doc = user_store[f"notifications/deposit_due_{group['id']}_uid-meena_{month}"]
    assert deposit_doc["type"] == "deposit_due"
    assert deposit_doc["userId"] == "uid-meena"
    assert (deposit_doc["data"] or {}).get("deepLink") == "/womenShg/savings"
    vac_doc = user_store[f"notifications/vaccination_due_TAG-9_FMD_{due}"]
    assert vac_doc["type"] == "vaccination_due"
    assert vac_doc["userId"] == "uid-meena"

    # second run is idempotent (deterministic doc ids, skip-if-exists)
    resp = await client.post(
        "/v1/jobs/women/reminders", headers={"X-Cron-Secret": "s3cret"}
    )
    assert resp.json() == {"depositReminders": 0, "vaccinationReminders": 0}
    deposit_notes = [
        d for d in user_store.values()
        if isinstance(d, dict) and d.get("type") == "deposit_due"
    ]
    assert len(deposit_notes) == 1


async def test_women_reminders_uses_ist_month(client, user_store, monkeypatch):
    # the deterministic id must use the IST month key (deposit doc id format)
    group = await _setup_reminder_group(client, user_store)
    monkeypatch.setattr(settings, "cron_secret", "s3cret")
    await client.post("/v1/jobs/women/reminders", headers={"X-Cron-Secret": "s3cret"})
    month = datetime.now(timezone.utc).astimezone(ZoneInfo("Asia/Kolkata")).strftime("%Y-%m")
    assert f"notifications/deposit_due_{group['id']}_uid-meena_{month}" in user_store


# ---------------------------------------------------------------------------
# Task 9 — billing: womenShg tier + kill-switch + admin config
# ---------------------------------------------------------------------------


async def test_billing_plans_include_womenShg_tier(client, user_store):
    await seed_plans()
    resp = await client.get("/v1/billing/plans", params={"persona": "womenShg"})
    assert resp.status_code == 200
    plans = {p["planId"]: p for p in resp.json()["data"]}
    assert set(plans) == {
        "womenShg_free",
        "womenShg_first_month",
        "womenShg_monthly",
        "womenShg_yearly",
    }
    assert plans["womenShg_free"]["priceMonthlyPaisa"] == 0
    assert plans["womenShg_first_month"]["priceMonthlyPaisa"] == 900
    assert plans["womenShg_first_month"]["promo"] is True
    assert plans["womenShg_monthly"]["priceMonthlyPaisa"] == 9900
    assert plans["womenShg_monthly"]["interval"] == "month"
    assert plans["womenShg_yearly"]["priceMonthlyPaisa"] == 99900
    assert plans["womenShg_yearly"]["interval"] == "year"
    assert plans["womenShg_yearly"]["priceRupeesPerYear"] == 99900


async def test_subscribe_first_month_plan_then_kill_switch(client, user_store):
    await seed_plans()
    token = seed_user(user_store, uid="uid-shg", active_profile="womenShg")
    resp = await client.post(
        "/v1/billing/subscribe",
        json={"planId": "womenShg_first_month"},
        headers=auth(token),
    )
    assert resp.status_code == 201
    assert resp.json()["planId"] == "womenShg_first_month"
    assert resp.json()["status"] == "active"

    # admin disables new subscriptions
    resp = await client.put(
        "/v1/admin/billing/config",
        json={"subscriptionsEnabled": False},
        headers=ADMIN,
    )
    assert resp.status_code == 200
    assert resp.json() == {"subscriptionsEnabled": False}

    resp = await client.get("/v1/admin/billing/config", headers=ADMIN)
    assert resp.json() == {"subscriptionsEnabled": False}

    blocked = await client.post(
        "/v1/billing/subscribe",
        json={"planId": "womenShg_monthly"},
        headers=auth(token),
    )
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "subscriptions_disabled"

    # re-enable and subscribing works again
    await client.put(
        "/v1/admin/billing/config", json={"subscriptionsEnabled": True}, headers=ADMIN
    )
    resp = await client.post(
        "/v1/billing/subscribe",
        json={"planId": "womenShg_monthly"},
        headers=auth(token),
    )
    assert resp.status_code == 201


async def test_admin_billing_config_requires_admin(client, user_store):
    token = seed_user(user_store)
    resp = await client.get("/v1/admin/billing/config", headers=auth(token))
    assert resp.status_code == 403
    resp = await client.put(
        "/v1/admin/billing/config", json={"subscriptionsEnabled": False}, headers=auth(token)
    )
    assert resp.status_code == 403


async def test_subscribe_defaults_to_enabled_when_config_missing(client, user_store):
    await seed_plans()
    token = seed_user(user_store, uid="uid-shg", active_profile="womenShg")
    resp = await client.post(
        "/v1/billing/subscribe",
        json={"planId": "womenShg_monthly"},
        headers=auth(token),
    )
    assert resp.status_code == 201


# ---------------------------------------------------------------------------
# Task 10 — ratings self-service
# ---------------------------------------------------------------------------


def _seed_rating(user_store, rating_id, rater_id, provider_id, stars=4, created="2026-10-10T00:00:00+00:00"):
    user_store[f"ratings/{rating_id}"] = {
        "id": rating_id,
        "bookingKind": "deal",
        "bookingId": "deal_1",
        "stars": stars,
        "comment": "Great trade",
        "raterId": rater_id,
        "providerId": provider_id,
        "createdAt": created,
    }


def _add_months(day, months):
    month = day.month - 1 + months
    year = day.year + month // 12
    month = month % 12 + 1
    leap = year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)
    return day.replace(
        year=year, month=month,
        day=min(day.day, [31, 29 if leap else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]),
    )


async def test_ratings_mine_aggregate_and_recent(client, user_store):
    sunita = seed_user(user_store, uid="uid-shg", active_profile="womenShg", name="Sunita")
    ramesh = seed_user(user_store, uid="uid-ramesh", name="Ramesh")
    seed_user(user_store, uid="uid-meena", name="Meena")
    _seed_rating(user_store, "rat_1", "uid-ramesh", "uid-shg", stars=4)
    _seed_rating(user_store, "rat_2", "uid-meena", "uid-shg", stars=5, created="2026-10-15T00:00:00+00:00")
    user_store["provider_ratings/uid-shg"] = {
        "id": "uid-shg", "ratingAvg": 4.5, "ratingCount": 2,
    }
    user_store["users/uid-shg"]["trustTier"] = "trusted"

    resp = await client.get("/v1/ratings/mine", headers=auth(sunita))
    assert resp.status_code == 200
    body = resp.json()
    assert body["average"] == 4.5
    assert body["count"] == 2
    assert body["trustTier"] == "trusted"
    assert [r["id"] for r in body["recent"]] == ["rat_2", "rat_1"]
    row = body["recent"][0]
    assert row["raterName"] == "Meena"
    assert row["rating"] == 5
    assert row["kind"] == "deal"
    assert row["reply"] is None


async def test_ratings_mine_empty(client, user_store):
    token = seed_user(user_store, uid="uid-new", active_profile="womenShg")
    resp = await client.get("/v1/ratings/mine", headers=auth(token))
    body = resp.json()
    assert body["average"] is None
    assert body["count"] == 0
    assert body["trustTier"] is None
    assert body["recent"] == []


async def test_ratings_given_and_reply_flow(client, user_store):
    sunita = seed_user(user_store, uid="uid-shg", active_profile="womenShg", name="Sunita")
    ramesh = seed_user(user_store, uid="uid-ramesh", name="Ramesh")
    _seed_rating(user_store, "rat_1", "uid-ramesh", "uid-shg", stars=4)
    _seed_rating(user_store, "rat_2", "uid-ramesh", "uid-other", stars=3, created="2026-10-11T00:00:00+00:00")

    resp = await client.get("/v1/ratings/given", headers=auth(ramesh))
    assert resp.status_code == 200
    assert [r["id"] for r in resp.json()["items"]] == ["rat_2", "rat_1"]
    assert resp.json()["total"] == 2

    # only the rated party can reply
    resp = await client.post(
        "/v1/ratings/rat_1/reply",
        json={"reply": "Thank you!"},
        headers=auth(ramesh),
    )
    assert resp.status_code == 403

    resp = await client.post(
        "/v1/ratings/rat_1/reply",
        json={"reply": "Thank you for the kind words!"},
        headers=auth(sunita),
    )
    assert resp.status_code == 200
    assert resp.json()["reply"] == "Thank you for the kind words!"

    # one reply per rating
    resp = await client.post(
        "/v1/ratings/rat_1/reply",
        json={"reply": "Again"},
        headers=auth(sunita),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "ALREADY_REPLIED"

    # unknown rating
    resp = await client.post(
        "/v1/ratings/rat_nope/reply", json={"reply": "hi"}, headers=auth(sunita)
    )
    assert resp.status_code == 404

    # validation: empty / too long
    resp = await client.post(
        "/v1/ratings/rat_2/reply", json={"reply": ""}, headers=auth(sunita)
    )
    assert resp.status_code == 422
    resp = await client.post(
        "/v1/ratings/rat_2/reply", json={"reply": "x" * 501}, headers=auth(sunita)
    )
    assert resp.status_code == 422

    # reply shows up in /ratings/mine recent
    resp = await client.get("/v1/ratings/mine", headers=auth(sunita))
    recent = resp.json()["recent"]
    assert recent[0]["reply"] == "Thank you for the kind words!"


# ---------------------------------------------------------------------------
# Task 11 — ads geo targeting
# ---------------------------------------------------------------------------


async def test_ad_campaign_geo_targeting(client, user_store):
    token = seed_user(user_store, uid="uid-t", active_profile="instructor")
    payload = {
        "title": "SHG Workshop Ad",
        "headline": "Join the papad collective",
        "bannerUrl": "https://example.com/banner.png",
        "targetVillage": "Hivare",
        "targetDistrict": "Pune",
    }
    resp = await client.post("/v1/ads", json=payload, headers=auth(token))
    assert resp.status_code == 201
    ad_id = resp.json()["id"]
    assert resp.json()["targetVillage"] == "Hivare"
    assert resp.json()["targetDistrict"] == "Pune"

    resp = await client.get(f"/v1/ads/{ad_id}", headers=auth(token))
    assert resp.json()["targetVillage"] == "Hivare"

    resp = await client.put(
        f"/v1/ads/{ad_id}",
        json={"targetVillage": "Khed"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["targetVillage"] == "Khed"
    assert resp.json()["targetDistrict"] == "Pune"

    # optional fields default to None
    resp = await client.post(
        "/v1/ads",
        json={
            "title": "Plain Ad",
            "headline": "No geo targeting here",
            "bannerUrl": "https://example.com/b.png",
        },
        headers=auth(token),
    )
    assert resp.status_code == 201
    assert resp.json()["targetVillage"] is None
    assert resp.json()["targetDistrict"] is None


# ---------------------------------------------------------------------------
# Task 12 — admin oversight
# ---------------------------------------------------------------------------


async def test_admin_women_loans(client, user_store):
    user_store["shg_groups/shg_a"] = {
        "id": "shg_a", "name": "Prerna Bachat Gat", "memberUid": "uid-shg",
    }
    user_store["shg_loans/loan_1"] = {
        "id": "loan_1",
        "shgId": "shg_a",
        "borrowerUid": "uid-meena",
        "borrowerName": "Meena",
        "amountPaisa": 200_000,
        "status": "approved",
        "requestedAt": "2026-10-12T00:00:00+00:00",
        "audit": [
            {"at": "2026-10-12T00:00:00+00:00", "by": "uid-meena", "byName": "Meena", "action": "requested", "amountPaisa": 200_000},
            {"at": "2026-10-13T00:00:00+00:00", "by": "uid-shg", "byName": "Sunita", "action": "approved", "amountPaisa": 200_000},
        ],
    }
    resp = await client.get("/v1/admin/women/loans", headers=ADMIN)
    assert resp.status_code == 200
    rows = resp.json()["data"]
    assert len(rows) == 1
    assert rows[0]["groupName"] == "Prerna Bachat Gat"
    assert [a["action"] for a in rows[0]["audit"]] == ["requested", "approved"]

    # non-admin rejected
    token = seed_user(user_store)
    resp = await client.get("/v1/admin/women/loans", headers=auth(token))
    assert resp.status_code == 403


async def test_admin_women_deposit_compliance(client, user_store):
    token = seed_user(user_store, uid="uid-shg", active_profile="womenShg")
    group = await _create_group(client, token)  # monthly 50000, memberCount 1
    meena = seed_user(user_store, uid="uid-meena", active_profile="womenShg")
    await _join(client, meena, group["id"])
    await client.post(
        f"/v1/women/shg/join-requests/uid-meena/approve", headers=auth(token)
    )
    month = _ist_month()
    await client.post(
        "/v1/women/shg/deposit",
        json={"amountPaisa": 50_000, "month": month},
        headers=auth(token),
    )

    resp = await client.get(
        "/v1/admin/women/deposit-compliance",
        params={"month": month},
        headers=ADMIN,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["month"] == month
    row = next(r for r in body["items"] if r["groupId"] == group["id"])
    assert row["name"] == "Prerna Bachat Gat"
    assert row["memberCount"] == 2
    assert row["paidCount"] == 1
    assert row["paidTotalPaisa"] == 50_000
    assert row["expectedTotalPaisa"] == 100_000

    # default month = current
    resp = await client.get("/v1/admin/women/deposit-compliance", headers=ADMIN)
    assert resp.json()["month"] == month

    # bad month format -> 422
    resp = await client.get(
        "/v1/admin/women/deposit-compliance",
        params={"month": "Oct 2026"},
        headers=ADMIN,
    )
    assert resp.status_code == 422
