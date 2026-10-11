from datetime import datetime, timezone

from tests.test_diary import auth, seed_user

SELLER = {"active_profile": "milkSeller"}


def client_payload(**over):
    payload = {
        "name": "Suresh Yadav",
        "phone": "+919812340001",
        "address": "Nashik Road, Nashik",
        "deliverySlot": "Morning",
        "milkType": "Cow",
        "defaultQuantityLiters": 1.0,
        "ratePerLiter": 60.0,
        "startDate": "2026-09-01",
    }
    payload.update(over)
    return payload


async def make_client(client, token, **over):
    resp = await client.post("/v1/milk-seller/clients", json=client_payload(**over), headers=auth(token))
    assert resp.status_code == 201, resp.text
    return resp.json()


async def mark(client, token, client_id, day, status="delivered", **over):
    payload = {"clientId": client_id, "date": day, "status": status, **over}
    resp = await client.post("/v1/milk-seller/deliveries", json=payload, headers=auth(token))
    assert resp.status_code == 201, resp.text
    return resp.json()


# ------------------------------------------------------------------ clients --


async def test_client_crud_and_listing(client, user_store):
    token = seed_user(user_store, uid="ms-1", **SELLER)

    created = await make_client(client, token)
    assert created["id"].startswith("mcl_")
    assert created["status"] == "active"
    assert created["ratePerLiter"] == 60.0
    assert created["clientUserId"] is None  # phone matches no app user

    resp = await client.get("/v1/milk-seller/clients", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    entry = body["data"][0]
    assert entry["currentMonth"] == {
        "deliveredDays": 0,
        "missedDays": 0,
        "liters": 0.0,
        "amountRupees": 0.0,
        "month": body["month"],
    }
    assert entry["outstandingRupees"] == 0.0

    resp = await client.put(
        "/v1/milk-seller/clients/" + created["id"],
        json={"ratePerLiter": 62.0, "deliverySlot": "Evening"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    updated = resp.json()
    assert updated["ratePerLiter"] == 62.0
    assert updated["deliverySlot"] == "Evening"
    assert updated["name"] == "Suresh Yadav"

    resp = await client.get("/v1/milk-seller/clients/" + created["id"], headers=auth(token))
    assert resp.status_code == 200
    detail = resp.json()
    assert detail["recentDeliveries"] == []
    assert detail["outstandingRupees"] == 0.0

    # search filter hits and misses
    resp = await client.get("/v1/milk-seller/clients?q=suresh", headers=auth(token))
    assert resp.json()["total"] == 1
    resp = await client.get("/v1/milk-seller/clients?q=raghav", headers=auth(token))
    assert resp.json()["total"] == 0

    resp = await client.delete("/v1/milk-seller/clients/" + created["id"], headers=auth(token))
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "status": "archived"}

    resp = await client.get("/v1/milk-seller/clients", headers=auth(token))
    assert resp.json()["total"] == 0
    resp = await client.get("/v1/milk-seller/clients?status=all", headers=auth(token))
    assert resp.json()["total"] == 1
    assert resp.json()["data"][0]["status"] == "archived"

    # reactivating an archived client works through the normal update path
    resp = await client.put(
        "/v1/milk-seller/clients/" + created["id"], json={"status": "active"}, headers=auth(token)
    )
    assert resp.json()["status"] == "active"


async def test_client_validation_errors(client, user_store):
    token = seed_user(user_store, uid="ms-1", **SELLER)
    resp = await client.post(
        "/v1/milk-seller/clients",
        json=client_payload(name="", ratePerLiter=-5),
        headers=auth(token),
    )
    assert resp.status_code == 422
    resp = await client.post(
        "/v1/milk-seller/clients", json=client_payload(startDate="11-09-2026"), headers=auth(token)
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "INVALID_DATE"


async def test_role_enforcement_and_ownership(client, user_store):
    farmer = seed_user(user_store, uid="farmer-1", active_profile="farmer")
    resp = await client.get("/v1/milk-seller/clients", headers=auth(farmer))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"

    resp = await client.get("/v1/milk-seller/clients")
    assert resp.status_code == 401

    token = seed_user(user_store, uid="ms-1", **SELLER)
    other = seed_user(user_store, uid="ms-2", **SELLER)
    mine = await make_client(client, token)
    theirs = await make_client(client, other, name="Ramesh Jadhav", phone="+919812340099")

    resp = await client.get(f"/v1/milk-seller/clients/{theirs['id']}", headers=auth(token))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "CLIENT_NOT_FOUND"

    resp = await client.get(f"/v1/milk-seller/clients/{mine['id']}", headers=auth(other))
    assert resp.status_code == 404

    resp = await client.get("/v1/milk-seller/clients/nope", headers=auth(token))
    assert resp.status_code == 404


# -------------------------------------------------------------- deliveries --


async def test_delivery_upsert_defaults_and_archive_gate(client, user_store):
    token = seed_user(user_store, uid="ms-1", **SELLER)
    c = await make_client(client, token)

    entry = await mark(client, token, c["id"], "2026-09-05")
    assert entry["id"] == f"mdlv_{c['id']}_2026-09-05"
    assert entry["quantityLiters"] == 1.0  # client default applied
    assert entry["ratePerLiter"] == 60.0  # client rate snapshotted
    assert entry["amountRupees"] == 60.0

    # same client+date re-post = update (the whole point vs the paper book)
    entry = await mark(client, token, c["id"], "2026-09-05", quantityLiters=2.0)
    assert entry["quantityLiters"] == 2.0
    assert entry["amountRupees"] == 120.0

    custom = await mark(client, token, c["id"], "2026-09-06", ratePerLiter=64.0)
    assert custom["ratePerLiter"] == 64.0
    assert custom["quantityLiters"] == 1.0  # client default applies, custom rate snapshot
    assert custom["amountRupees"] == 64.0

    missed = await mark(client, token, c["id"], "2026-09-07", status="missed", note="Out of station")
    assert missed["amountRupees"] == 0.0
    assert missed["quantityLiters"] == 0.0

    resp = await client.delete(f"/v1/milk-seller/clients/{c['id']}", headers=auth(token))
    assert resp.status_code == 200
    resp = await client.post(
        "/v1/milk-seller/deliveries",
        json={"clientId": c["id"], "date": "2026-09-08"},
        headers=auth(token),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "CLIENT_ARCHIVED"


async def test_bulk_marking_idempotency_filters_and_calendar(client, user_store):
    token = seed_user(user_store, uid="ms-1", **SELLER)
    a = await make_client(client, token, name="Asha Bhosle", phone="+919812340002")
    b = await make_client(client, token, name="Babu Rao", phone="+919812340003", defaultQuantityLiters=0.5, ratePerLiter=70.0)

    await mark(client, token, b["id"], "2026-09-05", status="missed")

    headers = {**auth(token), "Idempotency-Key": "day-2026-09-06"}
    payload = {
        "date": "2026-09-06",
        "entries": [{"clientId": b["id"], "status": "delivered"}],
        "markUnlistedMissed": True,
    }
    resp = await client.post("/v1/milk-seller/deliveries/bulk", json=payload, headers=headers)
    assert resp.status_code == 200
    first = resp.json()
    assert first["created"] == 2
    assert first["updated"] == 0
    by_client = {d["clientId"]: d for d in first["data"]}
    assert by_client[b["id"]]["status"] == "delivered"
    assert by_client[b["id"]]["quantityLiters"] == 0.5
    assert by_client[b["id"]]["ratePerLiter"] == 70.0
    assert by_client[a["id"]]["status"] == "missed"

    # replaying the same key returns the stored response without rewriting
    resp = await client.post("/v1/milk-seller/deliveries/bulk", json=payload, headers=headers)
    assert resp.status_code == 200
    assert resp.json() == first

    # bulk with an unknown client fails atomically
    resp = await client.post(
        "/v1/milk-seller/deliveries/bulk",
        json={"date": "2026-09-07", "entries": [{"clientId": "mcl_missing"}]},
        headers=auth(token),
    )
    assert resp.status_code == 404

    resp = await client.get("/v1/milk-seller/deliveries?status=missed", headers=auth(token))
    assert resp.json()["total"] == 2
    resp = await client.get("/v1/milk-seller/deliveries?clientId=" + a["id"], headers=auth(token))
    assert resp.json()["total"] == 1
    resp = await client.get(
        "/v1/milk-seller/deliveries?fromDate=2026-09-06&toDate=2026-09-06", headers=auth(token)
    )
    assert resp.json()["total"] == 2
    resp = await client.get("/v1/milk-seller/deliveries", headers=auth(token))
    assert resp.json()["total"] == 3

    resp = await client.get(f"/v1/milk-seller/clients/{a['id']}/calendar?month=2026-09", headers=auth(token))
    assert resp.status_code == 200
    cal = resp.json()
    assert cal["month"] == "2026-09"
    assert len(cal["days"]) == 30
    by_day = {d["date"]: d for d in cal["days"]}
    assert by_day["2026-09-05"]["status"] == "unmarked"
    assert by_day["2026-09-06"]["status"] == "missed"
    assert by_day["2026-09-07"]["status"] == "unmarked"
    assert cal["summary"]["missedDays"] == 1
    assert cal["summary"]["deliveredDays"] == 0
    assert cal["summary"]["unmarkedDays"] == 29

    resp = await client.get(f"/v1/milk-seller/clients/{a['id']}/calendar?month=09-2026", headers=auth(token))
    assert resp.status_code == 422


async def test_delivery_update_and_delete(client, user_store):
    token = seed_user(user_store, uid="ms-1", **SELLER)
    c = await make_client(client, token)
    entry = await mark(client, token, c["id"], "2026-09-10", quantityLiters=1.5)

    resp = await client.put(
        f"/v1/milk-seller/deliveries/{entry['id']}",
        json={"clientId": c["id"], "date": "2026-09-10", "status": "missed", "note": "festival"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    corrected = resp.json()
    assert corrected["status"] == "missed"
    assert corrected["amountRupees"] == 0.0

    resp = await client.put(
        f"/v1/milk-seller/deliveries/{entry['id']}",
        json={"clientId": c["id"], "date": "2026-09-11", "status": "delivered"},
        headers=auth(token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "ENTRY_IDENTITY_IMMUTABLE"

    other = seed_user(user_store, uid="ms-2", **SELLER)
    resp = await client.get(f"/v1/milk-seller/deliveries/{entry['id']}", headers=auth(other))
    assert resp.status_code == 404

    resp = await client.delete(f"/v1/milk-seller/deliveries/{entry['id']}", headers=auth(token))
    assert resp.json() == {"ok": True}
    resp = await client.delete(f"/v1/milk-seller/deliveries/{entry['id']}", headers=auth(token))
    assert resp.status_code == 404


# -------------------------------------------------------------------- bills --


async def _month_of_deliveries(client, token, c, delivered_days, missed_days, holiday_days=()):
    for d in delivered_days:
        await mark(client, token, c["id"], f"2026-09-{d:02d}")
    for d in missed_days:
        await mark(client, token, c["id"], f"2026-09-{d:02d}", status="missed", note=f"absent on {d}")
    for d in holiday_days:
        await mark(client, token, c["id"], f"2026-09-{d:02d}", status="holiday")


async def test_monthly_bill_includes_missed_days_and_locks(client, user_store):
    token = seed_user(user_store, uid="ms-1", **SELLER)
    c = await make_client(client, token)
    await _month_of_deliveries(client, token, c, delivered_days=range(1, 11), missed_days=(11, 12, 13), holiday_days=(14,))

    resp = await client.post(
        "/v1/milk-seller/bills/generate",
        json={"clientId": c["id"], "month": "2026-09"},
        headers=auth(token),
    )
    assert resp.status_code == 201
    bill = resp.json()
    assert bill["id"] == f"mbill_{c['id']}_2026-09"
    assert bill["status"] == "draft"
    assert bill["billNumber"].startswith("MB-202609-")
    assert bill["summary"]["billedDays"] == 10
    assert bill["summary"]["missedDays"] == 3
    assert bill["summary"]["holidayDays"] == 1
    assert bill["summary"]["totalLiters"] == 10.0
    assert bill["summary"]["subtotalRupees"] == 600.0
    assert bill["summary"]["previousBalanceRupees"] == 0.0
    assert bill["summary"]["totalRupees"] == 600.0
    assert [m["date"] for m in bill["missedDays"]] == ["2026-09-11", "2026-09-12", "2026-09-13"]
    assert len(bill["lineItems"]) == 14  # 10 delivered + 3 missed + 1 holiday
    delivered_line = next(i for i in bill["lineItems"] if i["date"] == "2026-09-01")
    assert delivered_line["amountRupees"] == 60.0
    missed_line = next(i for i in bill["lineItems"] if i["date"] == "2026-09-11")
    assert missed_line["amountRupees"] == 0.0

    # regenerating while draft recomputes; later entries are picked up
    await mark(client, token, c["id"], "2026-09-15")
    resp = await client.post(
        "/v1/milk-seller/bills/generate",
        json={"clientId": c["id"], "month": "2026-09"},
        headers=auth(token),
    )
    assert resp.status_code == 201
    bill = resp.json()
    assert bill["summary"]["billedDays"] == 11
    assert bill["summary"]["totalRupees"] == 660.0

    resp = await client.post(
        "/v1/milk-seller/bills/generate",
        json={"clientId": c["id"], "month": "2027-01"},
        headers=auth(token),
    )
    assert resp.status_code == 422  # future month

    resp = await client.post(f"/v1/milk-seller/bills/{bill['id']}/send", headers=auth(token))
    assert resp.status_code == 200
    sent = resp.json()
    assert sent["status"] == "sent"
    assert sent["sentAt"] is not None

    # re-send is an idempotent no-op
    resp = await client.post(f"/v1/milk-seller/bills/{bill['id']}/send", headers=auth(token))
    assert resp.json()["sentAt"] == sent["sentAt"]

    resp = await client.post(
        "/v1/milk-seller/bills/generate",
        json={"clientId": c["id"], "month": "2026-09"},
        headers=auth(token),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "BILL_LOCKED"

    resp = await client.get("/v1/milk-seller/bills?month=2026-09", headers=auth(token))
    assert resp.json()["total"] == 1
    resp = await client.get("/v1/milk-seller/bills?status=draft", headers=auth(token))
    assert resp.json()["total"] == 0

    other = seed_user(user_store, uid="ms-2", **SELLER)
    resp = await client.get(f"/v1/milk-seller/bills/{bill['id']}", headers=auth(other))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "BILL_NOT_FOUND"


async def test_bill_payments_previous_balance_and_due_cap(client, user_store):
    token = seed_user(user_store, uid="ms-1", **SELLER)
    c = await make_client(client, token, startDate="2026-09-01")

    for d in range(1, 6):
        await mark(client, token, c["id"], f"2026-09-{d:02d}")  # 5 x 60 = 300
    sep = await client.post(
        "/v1/milk-seller/bills/generate",
        json={"clientId": c["id"], "month": "2026-09"},
        headers=auth(token),
    )
    sep_bill = sep.json()
    await client.post(f"/v1/milk-seller/bills/{sep_bill['id']}/send", headers=auth(token))

    resp = await client.post(
        f"/v1/milk-seller/bills/{sep_bill['id']}/payments",
        json={"amount": 100.0, "method": "upi"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    part = resp.json()
    assert part["status"] == "partial"
    assert part["paidAmountRupees"] == 100.0
    assert part["payments"][0]["method"] == "upi"

    resp = await client.post(
        f"/v1/milk-seller/bills/{sep_bill['id']}/payments",
        json={"amount": 250.0},
        headers=auth(token),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "PAYMENT_EXCEEDS_DUE"

    resp = await client.post(
        f"/v1/milk-seller/bills/{sep_bill['id']}/payments",
        json={"amount": 200.0, "method": "cash", "paidAt": "2026-10-02"},
        headers=auth(token),
    )
    paid = resp.json()
    assert paid["status"] == "paid"
    assert paid["paidAmountRupees"] == 300.0

    # October: 3 delivery days -> 180; previous balance carries the unpaid 0? Sep is fully
    # paid here, so previousBalance is 0. Skip a payment above to keep the balance assert
    # deterministic: regenerate a second client where Sep stays unpaid.
    c2 = await make_client(client, token, name="Kanta Devi", phone="+919812340010", startDate="2026-09-01")
    for d in range(1, 6):
        await mark(client, token, c2["id"], f"2026-09-{d:02d}")
    sep2 = await client.post(
        "/v1/milk-seller/bills/generate",
        json={"clientId": c2["id"], "month": "2026-09"},
        headers=auth(token),
    )
    sep2_bill = sep2.json()
    await client.post(f"/v1/milk-seller/bills/{sep2_bill['id']}/send", headers=auth(token))
    await client.post(
        f"/v1/milk-seller/bills/{sep2_bill['id']}/payments",
        json={"amount": 100.0},
        headers=auth(token),
    )  # 200 still due on Sep

    for d in (1, 2, 3):
        await mark(client, token, c2["id"], f"2026-10-{d:02d}")  # 3 x 60 = 180
    oct_resp = await client.post(
        "/v1/milk-seller/bills/generate",
        json={"clientId": c2["id"], "month": "2026-10", "adjustmentsRupees": 20.0, "note": "canopy charge"},
        headers=auth(token),
    )
    oct_bill = oct_resp.json()
    assert oct_bill["summary"]["subtotalRupees"] == 180.0
    assert oct_bill["summary"]["previousBalanceRupees"] == 200.0
    assert oct_bill["summary"]["adjustmentsRupees"] == 20.0
    assert oct_bill["summary"]["totalRupees"] == 400.0

    resp = await client.get(f"/v1/milk-seller/clients/{c2['id']}", headers=auth(token))
    # only sent/partial bills count: Sep has 200 unpaid, Oct is still draft
    assert resp.json()["outstandingRupees"] == 200.0

    resp = await client.get("/v1/milk-seller/bills?clientId=" + c2["id"], headers=auth(token))
    assert resp.json()["total"] == 2


async def test_bill_send_and_payment_notify_app_user_client(client, user_store):
    token = seed_user(user_store, uid="ms-1", **SELLER)
    client_uid = "client-u-1"
    user_store[f"users/{client_uid}"] = {
        "id": client_uid,
        "name": "Meena Kulkarni",
        "phone": "+919876543210",
        "linkedProfiles": ["customer"],
        "activeProfile": "customer",
        "language": "en",
    }
    c = await make_client(client, token, name="Meena Kulkarni", phone="+919876543210")
    assert c["clientUserId"] == client_uid

    await mark(client, token, c["id"], "2026-10-01")
    await mark(client, token, c["id"], "2026-10-02", status="missed")
    bill = (
        await client.post(
            "/v1/milk-seller/bills/generate",
            json={"clientId": c["id"], "month": "2026-10"},
            headers=auth(token),
        )
    ).json()
    await client.post(f"/v1/milk-seller/bills/{bill['id']}/send", headers=auth(token))
    await client.post(
        f"/v1/milk-seller/bills/{bill['id']}/payments", json={"amount": 30.0}, headers=auth(token)
    )

    notices = [d for k, d in user_store.items() if k.startswith("notifications/") and d.get("userId") == client_uid]
    types = {n["type"] for n in notices}
    assert "milk_bill_sent" in types
    assert "milk_bill_payment_recorded" in types
    bill_notice = next(n for n in notices if n["type"] == "milk_bill_sent")
    assert bill["billNumber"] in bill_notice["body"]


# --------------------------------------------------------------- analytics --


async def test_analytics(client, user_store):
    token = seed_user(user_store, uid="ms-1", **SELLER)
    a = await make_client(client, token, name="Asha Bhosle", phone="+919812340002", startDate="2026-09-01")
    b = await make_client(client, token, name="Babu Rao", phone="+919812340003", startDate="2026-10-01")
    await make_client(client, token, name="Champak Jain", phone="+919812340004", startDate="2026-09-01")

    # September activity for client a: 10 delivered + 3 missed + 1 holiday
    await _month_of_deliveries(client, token, a, delivered_days=range(1, 11), missed_days=(11, 12, 13), holiday_days=(14,))
    sep_bill = (
        await client.post(
            "/v1/milk-seller/bills/generate",
            json={"clientId": a["id"], "month": "2026-09"},
            headers=auth(token),
        )
    ).json()
    await client.post(f"/v1/milk-seller/bills/{sep_bill['id']}/send", headers=auth(token))
    await client.post(
        f"/v1/milk-seller/bills/{sep_bill['id']}/payments",
        json={"amount": 200.0, "paidAt": "2026-09-28"},
        headers=auth(token),
    )  # 400 left outstanding

    # October activity: a = 2 delivered, b = 4 delivered + 1 missed
    await mark(client, token, a["id"], "2026-10-01")
    await mark(client, token, a["id"], "2026-10-02")
    for d in range(1, 5):
        await mark(client, token, b["id"], f"2026-10-{d:02d}")
    await mark(client, token, b["id"], "2026-10-05", status="missed")
    tmp = await make_client(client, token, name="Tmp Client", phone="9090900000")
    await client.delete(f"/v1/milk-seller/clients/{tmp['id']}", headers=auth(token))

    # ---- month-specific analytics: current month (October) ----
    resp = await client.get("/v1/milk-seller/analytics?month=2026-10", headers=auth(token))
    assert resp.status_code == 200
    an = resp.json()
    assert an["month"] == "2026-10"
    assert an["clients"]["total"] == 4
    assert an["clients"]["active"] == 3
    assert an["clients"]["archived"] == 1

    mtd = an["monthToDate"]
    assert mtd["deliveredDays"] == 6
    assert mtd["missedDays"] == 1
    # a, b and champak are all active with October start dates; tmp is archived
    days_to_date = int(datetime.now(timezone.utc).strftime("%d"))
    assert mtd["unmarkedDays"] == (days_to_date * 3) - 7  # 7 recorded client-days
    assert mtd["totalLiters"] == 6.0
    assert mtd["expectedLiters"] == 3.0 * days_to_date
    assert mtd["deliveryRatePercent"] == round(6 / 7 * 100, 1)

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    assert an["today"]["date"] == today
    assert an["today"]["expectedDeliveries"] == 3

    assert an["money"]["outstandingRupees"] == 400.0  # only the sent Sep bill has a balance
    assert an["topClients"][0]["name"] in {"Asha Bhosle", "Babu Rao"}
    trend = {t["month"]: t for t in an["monthlyTrend"]}
    assert len(an["monthlyTrend"]) == 6
    assert trend["2026-09"]["deliveredDays"] == 10
    assert trend["2026-09"]["liters"] == 10.0
    assert trend["2026-09"]["billedRupees"] == 600.0
    assert trend["2026-09"]["collectedRupees"] == 200.0
    assert trend["2026-10"]["missedDays"] == 1

    # ---- historical month analytics: September (full month) ----
    resp = await client.get("/v1/milk-seller/analytics?month=2026-09", headers=auth(token))
    an = resp.json()
    # full month of September: champak (start 09-01) recorded nothing, client a recorded 14 days
    assert an["monthToDate"]["unmarkedDays"] == 30 + (30 - 14)
    assert an["monthToDate"]["deliveredDays"] == 10
    assert an["money"]["billedRupees"] == 600.0
    assert an["money"]["collectedRupees"] == 200.0

    resp = await client.get("/v1/milk-seller/analytics?month=09-2026", headers=auth(token))
    assert resp.status_code == 422

    farmer = seed_user(user_store, uid="farmer-1", active_profile="farmer")
    resp = await client.get("/v1/milk-seller/analytics", headers=auth(farmer))
    assert resp.status_code == 403
