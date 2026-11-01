"""Milk Vendor (Doodhwala) tests — clients/schedules, rates, deliveries,
bills (immutability, revision, cancellation, concurrency), secure public
links, sharing, and external payments."""

import asyncio
from datetime import date, timedelta

import pytest

from app.services import milk_vendor as mv
from app.services.milk_vendor_pdf import render_bill_pdf
from tests.test_diary import auth, seed_user

VENDOR = {"active_profile": "milkSeller"}


def seed_vendor(store, uid="mv-1", **over):
    return seed_user(store, uid=uid, **{**VENDOR, "kycStatus": "verified", **over})


async def setup_vendor(client, token, **over):
    resp = await client.put("/v1/milk-vendor/profile", json={"businessName": "Sharma Dairy", "billPrefix": "TEST", **over}, headers=auth(token))
    assert resp.status_code == 200, resp.text
    products = (await client.get("/v1/milk-vendor/products", headers=auth(token))).json()
    return products["data"][0]


def client_payload(**over):
    payload = {
        "name": "Suresh Yadav",
        "whatsappNumber": "+919812340001",
        "address": "Nashik Road",
        "defaultProductId": "pending",
        "defaultQuantityMilliLitres": 1000,
        "scheduleType": "daily",
        "scheduleStartDate": "2026-10-01",
        "ratePaisaPerUnit": 6000,
    }
    payload.update(over)
    return payload


async def make_client(client, token, product_id, **over):
    payload = client_payload(**{"defaultProductId": product_id, **over})
    resp = await client.post("/v1/milk-vendor/clients", json=payload, headers=auth(token))
    assert resp.status_code == 201, resp.text
    return resp.json()


async def deliver(client, token, client_id, day, **over):
    payload = {"clientId": client_id, "deliveryDate": day, "status": "delivered", **over}
    resp = await client.post("/v1/milk-vendor/deliveries", json=payload, headers=auth(token))
    assert resp.status_code == 201, resp.text
    return resp.json()


# ------------------------------------------------------------------ profile --


async def test_profile_defaults_and_update(client, user_store):
    token = seed_vendor(user_store, "mv-prof")
    resp = await client.get("/v1/milk-vendor/profile", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["kycVerified"] is True
    assert body["billPrefix"] == "MV"
    assert body["defaultBillingCycle"] == "monthly"

    resp = await client.put(
        "/v1/milk-vendor/profile",
        json={"businessName": "Sharma Dairy", "billPrefix": "sharma 26!", "defaultShift": "evening", "upiId": "sharma@upi"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["businessName"] == "Sharma Dairy"
    assert body["billPrefix"] == "SHARMA26"  # sanitized
    assert body["defaultShift"] == "evening"


async def test_profile_save_seeds_default_product(client, user_store):
    token = seed_vendor(user_store, "mv-seed")
    resp = await client.put("/v1/milk-vendor/profile", json={"businessName": "Seeded"}, headers=auth(token))
    assert resp.status_code == 200
    products = (await client.get("/v1/milk-vendor/products", headers=auth(token))).json()
    assert [p["name"] for p in products["data"]] == ["Milk"]
    assert products["data"][0]["unit"] == "litre"


async def test_kyc_required_for_transactions(client, user_store):
    token = seed_vendor(user_store, "mv-kyc", kycStatus="pending")
    resp = await client.get("/v1/milk-vendor/profile", headers=auth(token))
    assert resp.status_code == 200 and resp.json()["kycVerified"] is False
    resp = await client.get("/v1/milk-vendor/clients", headers=auth(token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "KYC_REQUIRED"


async def test_wrong_persona_denied(client, user_store):
    token = seed_user(user_store, uid="mv-farmer", active_profile="farmer")
    resp = await client.get("/v1/milk-vendor/clients", headers=auth(token))
    assert resp.status_code in (403, 404)


# ------------------------------------------------------------ clients/schedules --


async def test_client_create_validation_and_duplicate_warning(client, user_store):
    token = seed_vendor(user_store)
    product = await setup_vendor(client, token)

    bad = await client.post("/v1/milk-vendor/clients", json=client_payload(defaultProductId=product["id"], whatsappNumber="98123"), headers=auth(token))
    assert bad.status_code == 422  # country code required

    created = await make_client(client, token, product["id"])
    assert created["status"] == "active"
    assert created["scheduleType"] == "daily"
    assert created["duplicatePhone"] is False

    dupe = await make_client(client, token, product["id"], name="Suresh Bhai", whatsappNumber="+919812340001")
    assert dupe["duplicatePhone"] is True  # warning only, still created


async def test_client_edit_pause_resume_deactivate(client, user_store):
    token = seed_vendor(user_store)
    product = await setup_vendor(client, token)
    c = await make_client(client, token, product["id"])

    resp = await client.patch(
        f"/v1/milk-vendor/clients/{c['id']}",
        json={"ratePaisaPerUnit": 6200, "effectiveFrom": "2026-10-10"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["warnings"]["rate"]

    # rate change requires effectiveFrom
    resp = await client.patch(f"/v1/milk-vendor/clients/{c['id']}", json={"ratePaisaPerUnit": 6300}, headers=auth(token))
    assert resp.status_code == 422

    today = mv.today_in()
    resp = await client.post(
        f"/v1/milk-vendor/clients/{c['id']}/pause",
        json={"startDate": (today - timedelta(days=2)).isoformat(), "endDate": (today + timedelta(days=3)).isoformat(), "reason": "out of town"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "paused"

    resp = await client.post(f"/v1/milk-vendor/clients/{c['id']}/resume", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["status"] == "active"

    resp = await client.post(f"/v1/milk-vendor/clients/{c['id']}/deactivate", headers=auth(token))
    assert resp.status_code == 200
    # inactive clients cannot receive new deliveries
    resp = await client.post(
        "/v1/milk-vendor/deliveries",
        json={"clientId": c["id"], "deliveryDate": "2026-10-26", "status": "delivered"},
        headers=auth(token),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "CLIENT_INACTIVE"


async def test_cross_vendor_client_access_denied(client, user_store):
    token = seed_vendor(user_store, "mv-a")
    token2 = seed_vendor(user_store, "mv-b")
    product = await setup_vendor(client, token)
    c = await make_client(client, token, product["id"])

    resp = await client.get(f"/v1/milk-vendor/clients/{c['id']}", headers=auth(token2))
    assert resp.status_code == 404
    resp = await client.patch(f"/v1/milk-vendor/clients/{c['id']}", json={"name": "Hijack"}, headers=auth(token2))
    assert resp.status_code == 404
    other = (await client.get("/v1/milk-vendor/clients", headers=auth(token2))).json()
    assert other["total"] == 0


# ------------------------------------------------------------- today prefill --


async def _today_rows(client, token, day, shift="morning"):
    resp = await client.get(f"/v1/milk-vendor/today?date={day}&shift={shift}", headers=auth(token))
    assert resp.status_code == 200, resp.text
    return resp.json()


async def test_today_prefill_daily_and_pause(client, user_store):
    token = seed_vendor(user_store)
    product = await setup_vendor(client, token)
    c = await make_client(client, token, product["id"], scheduleStartDate="2026-10-01")

    data = await _today_rows(client, token, "2026-10-05")
    (row,) = [r for r in data["rows"] if r["clientId"] == c["id"]]
    assert row["required"] is True
    assert row["defaultQuantityMilliLitres"] == 1000
    assert row["resolvedRatePaisaPerUnit"] == 6000
    assert row["status"] == "pending"
    assert data["summary"]["requiredCount"] == 1
    # schedule alone never creates delivery records
    assert (await client.get("/v1/milk-vendor/deliveries", headers=auth(token))).json()["total"] == 0

    # future start date → not scheduled yet
    c2 = await make_client(client, token, product["id"], name="Future Client", whatsappNumber="+919812340002", scheduleStartDate="2026-11-01")
    data = await _today_rows(client, token, "2026-10-05")
    assert all(r["clientId"] != c2["id"] for r in data["rows"])

    # pause range excludes the client from required rows
    await client.post(f"/v1/milk-vendor/clients/{c['id']}/pause", json={"startDate": "2026-10-04", "endDate": "2026-10-06"}, headers=auth(token))
    data = await _today_rows(client, token, "2026-10-05")
    row = [r for r in data["rows"] if r["clientId"] == c["id"]][0]
    assert row["required"] is False and row["paused"] is True


async def test_today_schedule_variants(client, user_store):
    token = seed_vendor(user_store)
    product = await setup_vendor(client, token)
    alt = await make_client(client, token, product["id"], name="Alt", whatsappNumber="+919812340010", scheduleType="alternateDays", scheduleStartDate="2026-10-01")
    wk = await make_client(client, token, product["id"], name="Wk", whatsappNumber="+919812340011", scheduleType="specificWeekdays", weekdays=[0, 2], scheduleStartDate="2026-10-01")
    once = await make_client(client, token, product["id"], name="Once", whatsappNumber="+919812340012", scheduleType="oneTime", oneTimeDate="2026-10-07", scheduleStartDate="2026-10-01")

    day = date(2026, 10, 3)  # Saturday
    for i in range(0, 8):
        d = (day + timedelta(days=i)).isoformat()
        rows = (await _today_rows(client, token, d))["rows"]
        ids = {r["clientId"] for r in rows if r["required"]}
        assert (alt["id"] in ids) == (i % 2 == 0), f"alternateDays on {d}"
        assert (wk["id"] in ids) == ((day + timedelta(days=i)).weekday() in (0, 2)), f"weekdays on {d}"
        assert (once["id"] in ids) == (d == "2026-10-07"), f"oneTime on {d}"


# -------------------------------------------------------------------- rates --


async def test_rate_resolution_and_history(client, user_store):
    token = seed_vendor(user_store)
    product = await setup_vendor(client, token)
    c = await make_client(client, token, product["id"], scheduleStartDate="2026-10-01")

    # client-specific opening rate applies
    d1 = await deliver(client, token, c["id"], "2026-10-05")
    assert d1["appliedRatePaisaPerUnit"] == 6000
    assert d1["amountPaisa"] == 6000  # 1L @ Rs 60

    # new rate effective later; historical delivery keeps its rate
    await client.patch(f"/v1/milk-vendor/clients/{c['id']}", json={"ratePaisaPerUnit": 6400, "effectiveFrom": "2026-10-10"}, headers=auth(token))
    d2 = await deliver(client, token, c["id"], "2026-10-11")
    assert d2["appliedRatePaisaPerUnit"] == 6400
    d1_again = (await client.get(f"/v1/milk-vendor/deliveries?clientId={c['id']}&from=2026-10-05&to=2026-10-05", headers=auth(token))).json()["data"][0]
    assert d1_again["appliedRatePaisaPerUnit"] == 6000
    assert d1_again["amountPaisa"] == 6000

    # rounding: 333ml @ Rs 64/L = 2131.2 paisa → 2131 (half-up at line level)
    d3 = await deliver(client, token, c["id"], "2026-10-12", quantityMilliLitres=333)
    assert d3["amountPaisa"] == 2131

    # client-specific rate wins over the vendor default for the same product
    c2 = await make_client(client, token, product["id"], name="Default Rate", whatsappNumber="+919812340020", ratePaisaPerUnit=5500, scheduleStartDate="2026-10-01")
    await client.post("/v1/milk-vendor/rates", json={"productId": product["id"], "ratePaisaPerUnit": 5800, "effectiveFrom": "2026-10-01"}, headers=auth(token))
    d4 = await deliver(client, token, c2["id"], "2026-10-05")
    assert d4["appliedRatePaisaPerUnit"] == 5500

    # a product with only a vendor default resolves the default when the
    # client has no override for that product
    p2 = (await client.post("/v1/milk-vendor/products", json={"name": "Buffalo Milk"}, headers=auth(token))).json()
    await client.post("/v1/milk-vendor/rates", json={"productId": p2["id"], "ratePaisaPerUnit": 9000, "effectiveFrom": "2026-10-01"}, headers=auth(token))
    c3 = await make_client(client, token, product["id"], name="Buffalo Client", whatsappNumber="+919812340021", ratePaisaPerUnit=5500, scheduleStartDate="2026-10-01")
    d5 = await deliver(client, token, c3["id"], "2026-10-05", productId=p2["id"])
    assert d5["productId"] == p2["id"]
    assert d5["appliedRatePaisaPerUnit"] == 9000  # vendor default, no client override on p2


async def test_missing_rate_rejected(client, user_store):
    token = seed_vendor(user_store)
    product = await setup_vendor(client, token)
    p2 = (await client.post("/v1/milk-vendor/products", json={"name": "Curd"}, headers=auth(token))).json()
    c = await make_client(client, token, product["id"], scheduleStartDate="2026-10-01")
    resp = await client.post(
        "/v1/milk-vendor/deliveries",
        json={"clientId": c["id"], "deliveryDate": "2026-10-05", "status": "delivered", "productId": p2["id"]},
        headers=auth(token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "RATE_REQUIRED"
    # vendor-entered rate is accepted, never a silent zero
    ok = await deliver(client, token, c["id"], "2026-10-05", productId=p2["id"], ratePaisaPerUnit=12000)
    assert ok["appliedRatePaisaPerUnit"] == 12000


# --------------------------------------------------------------- deliveries --


async def test_delivery_duplicate_and_skip(client, user_store):
    token = seed_vendor(user_store)
    product = await setup_vendor(client, token)
    c = await make_client(client, token, product["id"])

    d = await deliver(client, token, c["id"], "2026-10-05")
    assert d["amountPaisa"] == 6000

    dup = await client.post(
        "/v1/milk-vendor/deliveries",
        json={"clientId": c["id"], "deliveryDate": "2026-10-05", "status": "delivered"},
        headers=auth(token),
    )
    assert dup.status_code == 409
    assert dup.json()["error"]["code"] == "DUPLICATE_DELIVERY"

    # extra delivery for the same day is a separate occurrence
    extra = await deliver(client, token, c["id"], "2026-10-05", extra=True, quantityMilliLitres=500)
    assert extra["extra"] is True and extra["amountPaisa"] == 3000

    skipped = await client.post(
        "/v1/milk-vendor/deliveries",
        json={"clientId": c["id"], "deliveryDate": "2026-10-06", "status": "skipped"},
        headers=auth(token),
    )
    assert skipped.status_code == 201
    assert skipped.json()["amountPaisa"] == 0 and skipped.json()["quantityMilliLitres"] == 0

    # zero/negative delivered quantity rejected
    bad = await client.post(
        "/v1/milk-vendor/deliveries",
        json={"clientId": c["id"], "deliveryDate": "2026-10-07", "status": "delivered", "quantityMilliLitres": 0},
        headers=auth(token),
    )
    assert bad.status_code == 422


async def test_bulk_deliveries_idempotent(client, user_store):
    token = seed_vendor(user_store)
    product = await setup_vendor(client, token)
    c1 = await make_client(client, token, product["id"], whatsappNumber="+919812340030")
    c2 = await make_client(client, token, product["id"], name="Second", whatsappNumber="+919812340031")
    day = "2026-10-05"
    payload = {
        "deliveryDate": day,
        "entries": [
            {"clientId": c1["id"], "quantityMilliLitres": 1000},
            {"clientId": c2["id"], "status": "skipped"},
        ],
    }
    headers = {**auth(token), "Idempotency-Key": "bulk-1"}
    first = await client.post("/v1/milk-vendor/deliveries/bulk", json=payload, headers=headers)
    assert first.status_code == 200, first.text
    assert first.json()["total"] == 2
    assert all(not r["duplicate"] for r in first.json()["results"])

    # replay with the same key returns the stored response, writes nothing new
    replay = await client.post("/v1/milk-vendor/deliveries/bulk", json=payload, headers=headers)
    assert replay.status_code == 200
    assert replay.json() == first.json()
    deliveries = (await client.get(f"/v1/milk-vendor/deliveries?from={day}&to={day}", headers=auth(token))).json()
    assert deliveries["total"] == 2

    # re-saving without a key upserts and flags duplicates instead of erroring
    again = await client.post("/v1/milk-vendor/deliveries/bulk", json=payload, headers=auth(token))
    assert again.status_code == 200
    assert all(r["duplicate"] for r in again.json()["results"])
    deliveries = (await client.get(f"/v1/milk-vendor/deliveries?from={day}&to={day}", headers=auth(token))).json()
    assert deliveries["total"] == 2  # still one active entry per occurrence

    # duplicate client inside one request rejected
    bad = await client.post(
        "/v1/milk-vendor/deliveries/bulk",
        json={"deliveryDate": day, "entries": [{"clientId": c1["id"]}, {"clientId": c1["id"]}]},
        headers=auth(token),
    )
    assert bad.status_code == 422


async def test_delivery_correction_audit(client, user_store):
    token = seed_vendor(user_store)
    product = await setup_vendor(client, token)
    c = await make_client(client, token, product["id"])
    d = await deliver(client, token, c["id"], "2026-10-05")

    no_reason = await client.patch(f"/v1/milk-vendor/deliveries/{d['id']}", json={"quantityMilliLitres": 1500}, headers=auth(token))
    assert no_reason.status_code == 422

    fixed = await client.patch(
        f"/v1/milk-vendor/deliveries/{d['id']}",
        json={"quantityMilliLitres": 1500, "correctionReason": "actual was 1.5L"},
        headers=auth(token),
    )
    assert fixed.status_code == 200
    body = fixed.json()
    assert body["amountPaisa"] == 9000
    assert body["correctionReason"] == "actual was 1.5L"
    assert len(body["corrections"]) == 1
    assert body["corrections"][0]["from"]["amountPaisa"] == 6000


# ---------------------------------------------------------------------- bills --


async def _billable_client(client, user_store, token, product, days=3, opening=0, **over):
    c = await make_client(client, token, product["id"], openingBalancePaisa=opening, scheduleStartDate="2026-10-01", **over)
    for i in range(days):
        await deliver(client, token, c["id"], f"2026-10-0{i + 5}")
    return c


async def test_bill_preview_and_generation_math(client, user_store):
    token = seed_vendor(user_store)
    product = await setup_vendor(client, token)
    c = await _billable_client(client, user_store, token, product, days=3, opening=5000)

    preview = await client.post(
        "/v1/milk-vendor/bills/preview",
        json={"clientId": c["id"], "periodStart": "2026-10-05", "periodEnd": "2026-10-20", "adjustmentsPaisa": -1000},
        headers=auth(token),
    )
    assert preview.status_code == 200, preview.text
    calc = preview.json()
    assert calc["deliveryTotalPaisa"] == 18000  # 3 x 1L @ Rs 60
    assert calc["grossTotalPaisa"] == 17000
    assert calc["openingBalancePaisa"] == 5000
    assert calc["balancePaisa"] == 22000
    assert len(calc["lineItems"]) == 3

    resp = await client.post(
        "/v1/milk-vendor/bills",
        json={"clientId": c["id"], "periodStart": "2026-10-05", "periodEnd": "2026-10-20", "adjustmentsPaisa": -1000},
        headers=auth(token),
    )
    assert resp.status_code == 201, resp.text
    bill = resp.json()
    assert bill["billNumber"] == "TEST-0001"
    assert bill["status"] == "generated"
    assert bill["revisionNumber"] == 1
    assert bill["deliveryTotalPaisa"] == 18000
    assert bill["grossTotalPaisa"] == 17000
    assert bill["openingBalancePaisa"] == 5000
    assert bill["balancePaisa"] == 22000
    assert bill["pdfStorageReference"]
    assert "shareTokenHash" not in bill or bill.get("shareTokenHash") in (None, "")

    # deliveries are locked against re-billing
    again = await client.post(
        "/v1/milk-vendor/bills",
        json={"clientId": c["id"], "periodStart": "2026-10-05", "periodEnd": "2026-10-20"},
        headers=auth(token),
    )
    assert again.status_code == 422
    assert again.json()["error"]["code"] == "NO_DELIVERIES"

    # vendor PDF download works
    pdf = await client.get(f"/v1/milk-vendor/bills/{bill['id']}/pdf", headers=auth(token))
    assert pdf.status_code == 200
    assert pdf.content[:4] == b"%PDF"


async def test_bill_excludes_skipped_and_applies_payments(client, user_store):
    token = seed_vendor(user_store)
    product = await setup_vendor(client, token)
    c = await make_client(client, token, product["id"], scheduleStartDate="2026-10-01")
    await deliver(client, token, c["id"], "2026-10-05")
    await client.post("/v1/milk-vendor/deliveries", json={"clientId": c["id"], "deliveryDate": "2026-10-06", "status": "skipped"}, headers=auth(token))
    await deliver(client, token, c["id"], "2026-10-07")

    # unlinked payment dated inside the period applies to the bill
    pay = await client.post(
        "/v1/milk-vendor/payments",
        json={"clientId": c["id"], "amountPaisa": 6000, "paymentDate": "2026-10-06", "method": "upi"},
        headers=auth(token),
    )
    assert pay.status_code == 201

    bill = (
        await client.post(
            "/v1/milk-vendor/bills",
            json={"clientId": c["id"], "periodStart": "2026-10-05", "periodEnd": "2026-10-20"},
            headers=auth(token),
        )
    ).json()
    assert bill["deliveryTotalPaisa"] == 12000  # skipped day excluded
    assert len(bill["lineItems"]) == 2
    assert bill["paymentsAppliedPaisa"] == 6000
    assert bill["balancePaisa"] == 6000

    # a second, later bill must not re-apply the same payment
    await deliver(client, token, c["id"], "2026-10-21")
    bill2 = (
        await client.post(
            "/v1/milk-vendor/bills",
            json={"clientId": c["id"], "periodStart": "2026-10-21", "periodEnd": "2026-10-31"},
            headers=auth(token),
        )
    ).json()
    assert bill2["paymentsAppliedPaisa"] == 0
    assert bill2["openingBalancePaisa"] == 6000  # carried from bill 1 balance
    assert bill2["balancePaisa"] == 12000


async def test_bill_immutable_after_delivery_correction(client, user_store):
    token = seed_vendor(user_store)
    product = await setup_vendor(client, token)
    c = await _billable_client(client, user_store, token, product, days=2)
    bill = (
        await client.post(
            "/v1/milk-vendor/bills",
            json={"clientId": c["id"], "periodStart": "2026-10-05", "periodEnd": "2026-10-20"},
            headers=auth(token),
        )
    ).json()
    assert bill["deliveryTotalPaisa"] == 12000

    first_delivery = bill["lineItems"][0]
    deliveries = (await client.get(f"/v1/milk-vendor/deliveries?clientId={c['id']}", headers=auth(token))).json()["data"]
    target = [d for d in deliveries if d["deliveryDate"] == first_delivery["deliveryDate"]][0]
    fixed = await client.patch(
        f"/v1/milk-vendor/deliveries/{target['id']}",
        json={"quantityMilliLitres": 2000, "correctionReason": "jug was bigger"},
        headers=auth(token),
    )
    assert fixed.status_code == 200
    assert fixed.json()["requiresBillRevision"] is True

    # stored bill is untouched (immutable)
    after = (await client.get(f"/v1/milk-vendor/bills/{bill['id']}", headers=auth(token))).json()
    assert after["deliveryTotalPaisa"] == 12000
    assert after["lineItems"] == bill["lineItems"]


async def test_bill_revision_chain_and_link_revocation(client, user_store):
    token = seed_vendor(user_store)
    product = await setup_vendor(client, token)
    c = await _billable_client(client, user_store, token, product, days=2)

    bill = (
        await client.post(
            "/v1/milk-vendor/bills",
            json={"clientId": c["id"], "periodStart": "2026-10-05", "periodEnd": "2026-10-20"},
            headers=auth(token),
        )
    ).json()
    link = (await client.post(f"/v1/milk-vendor/bills/{bill['id']}/share-link", headers=auth(token))).json()
    old_token = link["token"]
    old_url = link["url"]
    assert "/public/milk-bills/" in old_url

    # public view works before revision, sanitized
    pub = await client.get(f"/v1/public/milk-bills/{old_token}")
    assert pub.status_code == 200, pub.text
    pub_body = pub.json()
    assert pub_body["billNumber"] == "TEST-0001"
    assert pub_body["vendor"]["businessName"] == "Sharma Dairy"
    assert pub_body["client"]["name"] == "Suresh Yadav"
    for forbidden in ("clientId", "vendorId", "id", "shareTokenHash", "clientWhatsappNumber", "pdfStorageReference", "generatedBy"):
        assert forbidden not in pub_body, forbidden
    assert all("notes" not in item for item in pub_body["lineItems"])
    pub_pdf = await client.get(f"/v1/public/milk-bills/{old_token}/pdf")
    assert pub_pdf.status_code == 200 and pub_pdf.content[:4] == b"%PDF"

    # revision requires a reason
    bad = await client.post(f"/v1/milk-vendor/bills/{bill['id']}/revise", json={}, headers=auth(token))
    assert bad.status_code == 422

    # correct one delivery upward, then revise
    deliveries = (await client.get(f"/v1/milk-vendor/deliveries?clientId={c['id']}", headers=auth(token))).json()["data"]
    target = [d for d in deliveries if d["deliveryDate"] == "2026-10-05"][0]
    await client.patch(
        f"/v1/milk-vendor/deliveries/{target['id']}",
        json={"quantityMilliLitres": 2000, "correctionReason": "corrected qty"},
        headers=auth(token),
    )
    # record a payment before revision — must survive it
    await client.post("/v1/milk-vendor/payments", json={"clientId": c["id"], "billId": bill["id"], "amountPaisa": 6000, "paymentDate": "2026-10-12", "method": "cash"}, headers=auth(token))

    revised = (
        await client.post(f"/v1/milk-vendor/bills/{bill['id']}/revise", json={"reason": "quantity correction"}, headers=auth(token))
    ).json()
    assert revised["billNumber"] == bill["billNumber"]
    assert revised["revisionNumber"] == 2
    assert revised["supersedesBillId"] == bill["id"]
    assert revised["deliveryTotalPaisa"] == 18000  # 2L + 1L @ 60
    assert revised["paymentsAppliedPaisa"] == 6000  # payment carried over
    assert revised["balancePaisa"] == 12000

    old = (await client.get(f"/v1/milk-vendor/bills/{bill['id']}", headers=auth(token))).json()
    assert old["status"] == "revised"
    assert old["lineItems"] == bill["lineItems"]  # old snapshot preserved

    # old link revoked, new link works
    assert (await client.get(f"/v1/public/milk-bills/{old_token}")).status_code == 404
    new_link = (await client.post(f"/v1/milk-vendor/bills/{revised['id']}/share-link", headers=auth(token))).json()
    assert new_link["token"] != old_token
    assert (await client.get(f"/v1/public/milk-bills/{new_link['token']}")).status_code == 200

    # payment record still exists (never deleted by revision)
    payments = (await client.get(f"/v1/milk-vendor/payments?clientId={c['id']}", headers=auth(token))).json()
    assert payments["total"] == 1 and payments["data"][0]["amountPaisa"] == 6000


async def test_bill_cancellation_releases_deliveries(client, user_store):
    token = seed_vendor(user_store)
    product = await setup_vendor(client, token)
    c = await _billable_client(client, user_store, token, product, days=2)
    bill = (
        await client.post(
            "/v1/milk-vendor/bills",
            json={"clientId": c["id"], "periodStart": "2026-10-05", "periodEnd": "2026-10-20"},
            headers=auth(token),
        )
    ).json()
    link = (await client.post(f"/v1/milk-vendor/bills/{bill['id']}/share-link", headers=auth(token))).json()

    no_reason = await client.post(f"/v1/milk-vendor/bills/{bill['id']}/cancel", json={}, headers=auth(token))
    assert no_reason.status_code == 422

    cancelled = (
        await client.post(f"/v1/milk-vendor/bills/{bill['id']}/cancel", json={"reason": "wrong period"}, headers=auth(token))
    ).json()
    assert cancelled["status"] == "cancelled"

    # link revoked, bill preserved
    assert (await client.get(f"/v1/public/milk-bills/{link['token']}")).status_code == 404
    kept = (await client.get(f"/v1/milk-vendor/bills/{bill['id']}", headers=auth(token))).json()
    assert kept["status"] == "cancelled" and kept["deliveryTotalPaisa"] == 12000

    # deliveries released → can be billed again in a fresh bill
    rebill = (
        await client.post(
            "/v1/milk-vendor/bills",
            json={"clientId": c["id"], "periodStart": "2026-10-05", "periodEnd": "2026-10-20"},
            headers=auth(token),
        )
    ).json()
    assert rebill["status"] == "generated"
    assert rebill["billNumber"] == "TEST-0002"  # sequence kept moving, no reuse


async def test_concurrent_generation_safe(client, user_store):
    token = seed_vendor(user_store)
    product = await setup_vendor(client, token)
    c = await _billable_client(client, user_store, token, product, days=2)

    async def gen(key):
        return await client.post(
            "/v1/milk-vendor/bills",
            json={"clientId": c["id"], "periodStart": "2026-10-05", "periodEnd": "2026-10-20"},
            headers={**auth(token), "Idempotency-Key": key},
        )

    r1, r2 = await asyncio.gather(gen("c1"), gen("c2"))
    codes = sorted([r1.status_code, r2.status_code])
    assert codes in ([201, 201], [201, 422], [201, 409]), codes
    bills = [r.json() for r in (r1, r2) if r.status_code == 201]
    assert len({b["billNumber"] for b in bills}) == len(bills)  # no duplicate numbers
    billed = bills[0]["deliveryIds"]
    assert len(billed) == len(set(billed)) == 2
    if len(bills) == 2:  # no delivery billed twice across the two bills
        assert not set(bills[0]["deliveryIds"]) & set(bills[1]["deliveryIds"])


# ------------------------------------------------------------ share & whatsapp --


async def test_share_event_records_action_only(client, user_store):
    token = seed_vendor(user_store)
    product = await setup_vendor(client, token)
    c = await _billable_client(client, user_store, token, product, days=1)
    bill = (
        await client.post(
            "/v1/milk-vendor/bills",
            json={"clientId": c["id"], "periodStart": "2026-10-05", "periodEnd": "2026-10-20"},
            headers=auth(token),
        )
    ).json()
    ev = (await client.post(f"/v1/milk-vendor/bills/{bill['id']}/share-event", json={"channel": "whatsapp"}, headers=auth(token))).json()
    assert ev["ok"] is True
    assert ev["shareChannel"] == "whatsapp"
    assert ev["status"] == "shared"
    assert "delivered" not in ev and "read" not in ev  # never a delivery/read claim
    fresh = (await client.get(f"/v1/milk-vendor/bills/{bill['id']}", headers=auth(token))).json()
    assert fresh["sharedAt"] and fresh["shareChannel"] == "whatsapp"

    # unknown token denied
    assert (await client.get("/v1/public/milk-bills/does-not-exist")).status_code == 404


def test_whatsapp_message_text_unit():
    bill = {"billNumber": "TEST-0001", "periodStart": "2026-10-05", "periodEnd": "2026-10-20", "grossTotalPaisa": 12000, "paymentsAppliedPaisa": 2000, "balancePaisa": 10000}
    text = mv.whatsapp_share_text(client_name="Suresh", business_name="Sharma Dairy", bill=bill, secure_url="https://app.example.com/public/milk-bills/tok")
    assert text.startswith("Namaste Suresh,")
    assert "Bill: TEST-0001" in text
    assert "Bill amount: Rs 120.00" in text
    assert "Payments recorded: Rs 20.00" in text
    assert "Balance shown on bill: Rs 100.00" in text
    assert "https://app.example.com/public/milk-bills/tok" in text
    assert len(mv.new_share_token()) >= 40  # 32 bytes → ~43 url-safe chars
    assert mv.hash_share_token("abc") != "abc" and mv.hash_share_token("abc") == mv.hash_share_token("abc")


def test_public_pdf_render_unit():
    bill = {
        "billNumber": "T-1", "revisionNumber": 1, "periodStart": "2026-10-05", "periodEnd": "2026-10-20",
        "generatedAt": "2026-10-21T00:00:00+00:00",
        "lineItems": [{"deliveryDate": "2026-10-05", "shift": "morning", "productName": "Milk", "quantityMilliLitres": 1000, "appliedRatePaisaPerUnit": 6000, "amountPaisa": 6000}],
        "deliveryTotalPaisa": 6000, "adjustmentsPaisa": 0, "grossTotalPaisa": 6000,
        "openingBalancePaisa": 0, "paymentsAppliedPaisa": 0, "balancePaisa": 6000,
        "paymentInstructionsSnapshot": "Pay by UPI", "upiIdSnapshot": "x@upi", "notesSnapshot": "",
    }
    pdf = render_bill_pdf(bill, {"businessName": "Sharma Dairy", "address": "Nashik", "phone": "+9198"}, {"name": "Suresh", "area": "Nashik Road"})
    assert pdf[:4] == b"%PDF" and len(pdf) > 500


# ------------------------------------------------------------------- payments --


async def test_external_payments_and_void(client, user_store):
    token = seed_vendor(user_store)
    product = await setup_vendor(client, token)
    c = await make_client(client, token, product["id"], openingBalancePaisa=10000, scheduleStartDate="2026-10-01")

    # partial external payment
    p1 = (
        await client.post(
            "/v1/milk-vendor/payments",
            json={"clientId": c["id"], "amountPaisa": 4000, "paymentDate": "2026-10-03", "method": "cash", "notes": "morning collection"},
            headers=auth(token),
        )
    ).json()
    assert p1["clientRecordedBalancePaisa"] == 6000
    assert p1["recordedBy"]

    # full payment via UPI with external reference
    p2 = (
        await client.post(
            "/v1/milk-vendor/payments",
            json={"clientId": c["id"], "amountPaisa": 6000, "paymentDate": "2026-10-04", "method": "upi", "externalReference": "upi-ref-1"},
            headers=auth(token),
        )
    ).json()
    assert p2["clientRecordedBalancePaisa"] == 0

    # void requires reason and restores balance; record is preserved
    bad = await client.post(f"/v1/milk-vendor/payments/{p2['id']}/void", json={}, headers=auth(token))
    assert bad.status_code == 422
    voided = (await client.post(f"/v1/milk-vendor/payments/{p2['id']}/void", json={"reason": "wrong amount"}, headers=auth(token))).json()
    assert voided["voidedAt"] and voided["voidReason"] == "wrong amount"
    assert voided["clientRecordedBalancePaisa"] == 6000
    payments = (await client.get(f"/v1/milk-vendor/payments?clientId={c['id']}", headers=auth(token))).json()
    assert payments["total"] == 2  # audit trail kept, not deleted

    # invalid amount rejected
    bad_amount = await client.post("/v1/milk-vendor/payments", json={"clientId": c["id"], "amountPaisa": -5}, headers=auth(token))
    assert bad_amount.status_code == 422


async def test_cross_vendor_payment_privacy(client, user_store):
    token = seed_vendor(user_store, "mv-pa")
    token2 = seed_vendor(user_store, "mv-pb")
    product = await setup_vendor(client, token)
    c = await make_client(client, token, product["id"])
    pay = (
        await client.post("/v1/milk-vendor/payments", json={"clientId": c["id"], "amountPaisa": 1000, "paymentDate": "2026-10-05"}, headers=auth(token))
    ).json()
    resp = await client.get("/v1/milk-vendor/payments", headers=auth(token2))
    assert resp.json()["total"] == 0
    resp = await client.post(f"/v1/milk-vendor/payments/{pay['id']}/void", json={"reason": "hijack attempt"}, headers=auth(token2))
    assert resp.status_code == 404
