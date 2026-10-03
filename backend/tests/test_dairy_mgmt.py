from app.services.tasks import DEEP_LINKS  # noqa: F401
from tests.test_diary import auth, seed_user

MANAGER = {"uid": "mgr-1", "active_profile": "dairyManager"}
FARMER = {"uid": "farmer-1", "active_profile": "farmer"}

MEMBER_A = {
    "name": "रामसिंग पाटील",
    "phone": "+919999999999",
    "village": "पिंपळगाव",
    "farmerUid": "farmer-1",
    "memberCode": "F-042",
    "deduction": 50.0,
}
MEMBER_B = {
    "name": "तुकाराम जाधव",
    "phone": "+919822011223",
    "village": "निफाड",
    "memberCode": "F-018",
    "deduction": 0.0,
}

COW_CHART = {
    "species": "cow",
    "effectiveFrom": "2026-09-01",
    "baseRate": 35.0,
    "fatBase": 3.5,
    "snfBase": 8.5,
    "fatStep": 4.0,
    "snfStep": 2.5,
    "minRate": 28.0,
    "active": True,
}
BUFFALO_CHART = {
    "species": "buffalo",
    "effectiveFrom": "2026-09-01",
    "baseRate": 55.0,
    "fatBase": 6.0,
    "snfBase": 9.0,
    "fatStep": 5.0,
    "snfStep": 3.0,
    "minRate": 42.0,
    "active": True,
}

CUSTOMER = {
    "name": "Hotel Panchavati",
    "phone": "+919822334455",
    "type": "hotel",
    "address": "Nashik Road",
    "ratePerLiter": 70.0,
}


def _collection(member_id, date, liters, farmer_code="F-042", farmer_name="रामसिंग पाटील"):
    return {
        "farmerName": farmer_name,
        "farmerCode": farmer_code,
        "farmerPhone": "+919999999999",
        "date": date,
        "shift": "morning",
        "milkType": "cow",
        "liters": liters,
        "fatPercent": 3.5,
        "snfPercent": 8.5,
        "clr": 28.0,
        "memberId": member_id,
        "quality": {"lacto": 1.02, "waterPct": 0.0, "adulterant": "none"},
    }


async def _create_member(client, token, payload=MEMBER_A):
    resp = await client.post("/v1/livestock/dairy/members", json=payload, headers=auth(token))
    assert resp.status_code == 201
    return resp.json()


async def _create_customer(client, token, payload=CUSTOMER):
    resp = await client.post("/v1/livestock/dairy/sales/customers", json=payload, headers=auth(token))
    assert resp.status_code == 201
    return resp.json()


# --- Members ---

async def test_member_create_and_list(client, user_store):
    token = seed_user(user_store, **MANAGER)
    member = await _create_member(client, token)
    assert member["centerId"] == "mgr-1"
    assert member["status"] == "active"
    assert member["memberCode"] == "F-042"

    resp = await client.get("/v1/livestock/dairy/members", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["data"][0]["name"] == "रामसिंग पाटील"


async def test_member_update(client, user_store):
    token = seed_user(user_store, **MANAGER)
    member = await _create_member(client, token)
    resp = await client.put(
        f"/v1/livestock/dairy/members/{member['id']}",
        json={**MEMBER_A, "name": "Updated Name", "deduction": 75.0},
        headers=auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated Name"
    assert user_store[f"dairy_members/{member['id']}"]["deduction"] == 75.0


async def test_member_soft_delete(client, user_store):
    token = seed_user(user_store, **MANAGER)
    member = await _create_member(client, token)
    resp = await client.delete(f"/v1/livestock/dairy/members/{member['id']}", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["status"] == "inactive"
    assert user_store[f"dairy_members/{member['id']}"]["status"] == "inactive"


async def test_member_endpoints_forbidden_for_farmer(client, user_store):
    token = seed_user(user_store, **MANAGER)
    member = await _create_member(client, token)
    farmer_token = seed_user(user_store, **FARMER)
    for method, url in (
        ("GET", "/v1/livestock/dairy/members"),
        ("POST", "/v1/livestock/dairy/members"),
        ("PUT", f"/v1/livestock/dairy/members/{member['id']}"),
        ("DELETE", f"/v1/livestock/dairy/members/{member['id']}"),
    ):
        resp = await client.request(method, url, json=MEMBER_A, headers=auth(farmer_token))
        assert resp.status_code == 403, url
        assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"


async def test_member_other_center_not_found(client, user_store):
    token = seed_user(user_store, **MANAGER)
    member = await _create_member(client, token)
    other_mgr = seed_user(user_store, uid="mgr-2", active_profile="dairyManager")
    resp = await client.get("/v1/livestock/dairy/members", headers=auth(other_mgr))
    assert resp.json()["total"] == 0
    resp = await client.put(
        f"/v1/livestock/dairy/members/{member['id']}",
        json=MEMBER_A,
        headers=auth(other_mgr),
    )
    assert resp.status_code == 404


async def test_member_statement_ledger(client, user_store):
    token = seed_user(user_store, **MANAGER)
    member = await _create_member(client, token)
    for date, liters in (("2026-09-20", 10.0), ("2026-09-21", 12.0)):
        resp = await client.post(
            "/v1/livestock/procurement/collections",
            json=_collection(member["id"], date, liters),
            headers=auth(token),
        )
        assert resp.status_code == 201
    resp = await client.get(
        f"/v1/livestock/dairy/members/{member['id']}/statement?date_from=2026-09-01&date_to=2026-09-30",
        headers=auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["collections"]) == 2
    assert body["totals"]["liters"] == 22.0
    assert body["totals"]["amount"] == 770.0
    assert body["member"]["id"] == member["id"]


# --- Rate charts ---

async def test_rate_chart_public_read(client, user_store):
    token = seed_user(user_store, **MANAGER)
    farmer_token = seed_user(user_store, **FARMER)
    resp = await client.get("/v1/livestock/dairy/rate-chart?species=cow", headers=auth(farmer_token))
    assert resp.status_code == 404

    resp = await client.post("/v1/livestock/dairy/rate-chart", json=COW_CHART, headers=auth(token))
    assert resp.status_code == 201
    resp = await client.get("/v1/livestock/dairy/rate-chart?species=cow", headers=auth(farmer_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["baseRate"] == 35.0
    assert body["fatBase"] == 3.5
    assert body["snfBase"] == 8.5
    assert body["active"] is True


async def test_rate_chart_versions(client, user_store):
    token = seed_user(user_store, **MANAGER)
    await client.post("/v1/livestock/dairy/rate-chart", json=COW_CHART, headers=auth(token))
    await client.post(
        "/v1/livestock/dairy/rate-chart",
        json={**COW_CHART, "effectiveFrom": "2026-10-01", "baseRate": 37.0, "active": False},
        headers=auth(token),
    )
    resp = await client.get("/v1/livestock/dairy/rate-chart/versions", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["total"] == 2
    resp = await client.get("/v1/livestock/dairy/rate-chart/versions?species=cow", headers=auth(token))
    assert resp.json()["total"] == 2


async def test_rate_chart_activation_exclusivity(client, user_store):
    token = seed_user(user_store, **MANAGER)
    first = await client.post("/v1/livestock/dairy/rate-chart", json=COW_CHART, headers=auth(token))
    second = await client.post(
        "/v1/livestock/dairy/rate-chart",
        json={**COW_CHART, "effectiveFrom": "2026-10-01", "baseRate": 38.0},
        headers=auth(token),
    )
    assert second.status_code == 201
    first_doc = user_store[f"rate_charts/{first.json()['id']}"]
    second_doc = user_store[f"rate_charts/{second.json()['id']}"]
    assert first_doc["active"] is False
    assert second_doc["active"] is True

    # activating the first again via PUT deactivates the second
    resp = await client.put(
        f"/v1/livestock/dairy/rate-chart/{first.json()['id']}",
        json=COW_CHART,
        headers=auth(token),
    )
    assert resp.status_code == 200
    assert user_store[f"rate_charts/{first.json()['id']}"]["active"] is True
    assert user_store[f"rate_charts/{second.json()['id']}"]["active"] is False

    # buffalo chart activation does not disturb cow charts
    buffalo = await client.post(
        "/v1/livestock/dairy/rate-chart", json=BUFFALO_CHART, headers=auth(token)
    )
    assert buffalo.status_code == 201
    assert user_store[f"rate_charts/{first.json()['id']}"]["active"] is True


async def test_rate_chart_write_forbidden_for_farmer(client, user_store):
    farmer_token = seed_user(user_store, **FARMER)
    resp = await client.post(
        "/v1/livestock/dairy/rate-chart", json=COW_CHART, headers=auth(farmer_token)
    )
    assert resp.status_code == 403


# --- Payment batches ---

async def _setup_batch_scenario(client, user_store):
    token = seed_user(user_store, **MANAGER)
    member_a = await _create_member(client, token)
    member_b = await _create_member(client, token, MEMBER_B)
    collections = [
        (member_a["id"], "2026-09-20", 10.0, "F-042"),
        (member_a["id"], "2026-09-21", 12.0, "F-042"),
        (member_b["id"], "2026-09-20", 8.0, "F-018"),
        (member_b["id"], "2026-09-28", 5.0, "F-018"),  # outside period
    ]
    for member_id, date, liters, farmer_code in collections:
        resp = await client.post(
            "/v1/livestock/procurement/collections",
            json=_collection(member_id, date, liters, farmer_code=farmer_code),
            headers=auth(token),
        )
        assert resp.status_code == 201
    # memberId/quality passthrough stored on the doc
    stored = [d for d in user_store.values() if d.get("memberId") == member_a["id"]]
    assert stored[0]["quality"]["lacto"] == 1.02
    return token, member_a, member_b


async def test_batch_generation_math(client, user_store):
    token, member_a, member_b = await _setup_batch_scenario(client, user_store)
    resp = await client.post(
        "/v1/livestock/dairy/payments/batches",
        json={"periodFrom": "2026-09-01", "periodTo": "2026-09-25"},
        headers=auth(token),
    )
    assert resp.status_code == 201
    batch = resp.json()
    assert batch["status"] == "draft"
    assert batch["totalLiters"] == 30.0
    assert batch["totalAmount"] == 1050.0
    assert batch["totalDeduction"] == 50.0
    assert batch["totalNet"] == 1000.0
    assert len(batch["entries"]) == 2

    entry_a = next(e for e in batch["entries"] if e["memberId"] == member_a["id"])
    assert entry_a["liters"] == 22.0
    assert entry_a["amount"] == 770.0
    assert entry_a["deduction"] == 50.0
    assert entry_a["netAmount"] == 720.0
    assert entry_a["status"] == "pending"
    entry_b = next(e for e in batch["entries"] if e["memberId"] == member_b["id"])
    assert entry_b["liters"] == 8.0
    assert entry_b["netAmount"] == 280.0

    stored_entry = user_store[f"payment_entries/{entry_a['id']}"]
    assert stored_entry["batchId"] == batch["id"]


async def test_batch_mark_paid_notifies_members(client, user_store):
    token, member_a, _ = await _setup_batch_scenario(client, user_store)
    resp = await client.post(
        "/v1/livestock/dairy/payments/batches",
        json={"periodFrom": "2026-09-01", "periodTo": "2026-09-25"},
        headers=auth(token),
    )
    batch = resp.json()
    resp = await client.post(
        f"/v1/livestock/dairy/payments/batches/{batch['id']}/mark-paid",
        json={"payoutRef": "UTR-TEST-001"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "paid"
    assert resp.json()["paidAt"] != ""

    entries = [d for d in user_store.values() if d.get("batchId") == batch["id"]]
    assert all(e["status"] == "paid" for e in entries)
    assert all(e["payoutRef"] == "UTR-TEST-001" for e in entries)

    notifications = [d for d in user_store.values() if d.get("userId") == "farmer-1"]
    assert len(notifications) == 1
    assert notifications[0]["data"]["kind"] == "payment_paid"
    assert notifications[0]["data"]["payoutRef"] == "UTR-TEST-001"


async def test_batch_mark_paid_twice_409(client, user_store):
    token, _, _ = await _setup_batch_scenario(client, user_store)
    resp = await client.post(
        "/v1/livestock/dairy/payments/batches",
        json={"periodFrom": "2026-09-01", "periodTo": "2026-09-25"},
        headers=auth(token),
    )
    batch_id = resp.json()["id"]
    await client.post(
        f"/v1/livestock/dairy/payments/batches/{batch_id}/mark-paid",
        json={},
        headers=auth(token),
    )
    resp = await client.post(
        f"/v1/livestock/dairy/payments/batches/{batch_id}/mark-paid",
        json={},
        headers=auth(token),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "ALREADY_PAID"


async def test_farmer_payments_view(client, user_store):
    token, member_a, _ = await _setup_batch_scenario(client, user_store)
    await client.post(
        "/v1/livestock/dairy/payments/batches",
        json={"periodFrom": "2026-09-01", "periodTo": "2026-09-25"},
        headers=auth(token),
    )
    farmer_token = seed_user(user_store, **FARMER)
    resp = await client.get("/v1/livestock/dairy/farmer/payments", headers=auth(farmer_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["data"][0]["memberId"] == member_a["id"]
    assert body["data"][0]["netAmount"] == 720.0

    other_farmer = seed_user(user_store, uid="farmer-2", active_profile="farmer")
    resp = await client.get("/v1/livestock/dairy/farmer/payments", headers=auth(other_farmer))
    assert resp.json()["total"] == 0


async def test_farmer_slips_view(client, user_store):
    token, member_a, _ = await _setup_batch_scenario(client, user_store)
    farmer_token = seed_user(user_store, **FARMER)
    resp = await client.get(
        "/v1/livestock/dairy/farmer/slips?date_from=2026-09-01&date_to=2026-09-25",
        headers=auth(farmer_token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["memberCode"] == "F-042"
    assert body["total"] == 2
    assert all(s["memberId"] == member_a["id"] for s in body["data"])


# --- Milk sales ---

async def test_sale_customer_crud(client, user_store):
    token = seed_user(user_store, **MANAGER)
    customer = await _create_customer(client, token)
    assert customer["centerId"] == "mgr-1"

    resp = await client.get("/v1/livestock/dairy/sales/customers", headers=auth(token))
    assert resp.json()["total"] == 1

    resp = await client.put(
        f"/v1/livestock/dairy/sales/customers/{customer['id']}",
        json={**CUSTOMER, "ratePerLiter": 72.0},
        headers=auth(token),
    )
    assert resp.status_code == 200
    assert user_store[f"milk_sale_customers/{customer['id']}"]["ratePerLiter"] == 72.0


async def test_sale_order_amount_from_items(client, user_store):
    token = seed_user(user_store, **MANAGER)
    customer = await _create_customer(client, token)
    resp = await client.post(
        "/v1/livestock/dairy/sales/orders",
        json={
            "customerId": customer["id"],
            "orderDate": "2026-09-25",
            "shift": "am",
            "liters": 20.0,
            "items": [
                {"name": "A2 Milk", "qty": 20.0, "unitPrice": 70.0},
                {"name": "Curd", "qty": 2.0, "unitPrice": 60.0},
            ],
        },
        headers=auth(token),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["amount"] == 1520.0
    assert body["status"] == "scheduled"


async def test_sale_order_amount_from_customer_rate(client, user_store):
    token = seed_user(user_store, **MANAGER)
    customer = await _create_customer(client, token)
    resp = await client.post(
        "/v1/livestock/dairy/sales/orders",
        json={"customerId": customer["id"], "orderDate": "2026-09-25", "liters": 10.0},
        headers=auth(token),
    )
    assert resp.status_code == 201
    assert resp.json()["amount"] == 700.0


async def test_sale_order_lifecycle(client, user_store):
    token = seed_user(user_store, **MANAGER)
    customer = await _create_customer(client, token)
    resp = await client.post(
        "/v1/livestock/dairy/sales/orders",
        json={"customerId": customer["id"], "orderDate": "2026-09-25", "liters": 10.0},
        headers=auth(token),
    )
    order_id = resp.json()["id"]

    resp = await client.post(
        f"/v1/livestock/dairy/sales/orders/{order_id}/status",
        json={"status": "billed"},
        headers=auth(token),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "INVALID_TRANSITION"

    for status in ("delivered", "billed", "paid"):
        resp = await client.post(
            f"/v1/livestock/dairy/sales/orders/{order_id}/status",
            json={"status": status},
            headers=auth(token),
        )
        assert resp.status_code == 200, status
        assert resp.json()["status"] == status
    assert user_store[f"milk_sale_orders/{order_id}"]["deliveredAt"] != ""


async def test_sales_summary(client, user_store):
    token = seed_user(user_store, **MANAGER)
    customer = await _create_customer(client, token)
    for liters in (10.0, 20.0):
        await client.post(
            "/v1/livestock/dairy/sales/orders",
            json={"customerId": customer["id"], "orderDate": "2026-09-25", "liters": liters},
            headers=auth(token),
        )
    resp = await client.get(
        "/v1/livestock/dairy/sales/summary?date_from=2026-09-01&date_to=2026-09-30",
        headers=auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["totalOrders"] == 2
    assert body["totalLiters"] == 30.0
    assert body["totalAmount"] == 2100.0
    assert body["byStatus"] == {"scheduled": 2}
    assert body["collectedAmount"] == 0.0


# --- Stock ---

async def test_stock_create_and_adjust(client, user_store):
    token = seed_user(user_store, **MANAGER)
    resp = await client.post(
        "/v1/livestock/dairy/stock/items",
        json={"name": "A2 Milk", "category": "milk", "unit": "liter",
              "stockQty": 100.0, "unitPrice": 62.0},
        headers=auth(token),
    )
    assert resp.status_code == 201
    item_id = resp.json()["id"]

    resp = await client.post(
        f"/v1/livestock/dairy/stock/items/{item_id}/adjust",
        json={"delta": -20.0, "reason": "evening dispatch"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["stockQty"] == 80.0
    assert body["lastAdjustment"]["delta"] == -20.0
    assert body["lastAdjustment"]["reason"] == "evening dispatch"

    resp = await client.get("/v1/livestock/dairy/stock/items", headers=auth(token))
    assert resp.json()["total"] == 1


# --- Reports ---

async def test_daily_report_shape(client, user_store):
    token = seed_user(user_store, **MANAGER)
    member = await _create_member(client, token)
    await client.post(
        "/v1/livestock/procurement/collections",
        json=_collection(member["id"], "2026-09-25", 10.0),
        headers=auth(token),
    )
    customer = await _create_customer(client, token)
    await client.post(
        "/v1/livestock/dairy/sales/orders",
        json={"customerId": customer["id"], "orderDate": "2026-09-25", "liters": 10.0},
        headers=auth(token),
    )
    await client.post(
        "/v1/livestock/dairy/stock/items",
        json={"name": "Ghee", "category": "ghee", "unit": "500ml", "stockQty": 5.0, "unitPrice": 900.0},
        headers=auth(token),
    )
    resp = await client.get("/v1/livestock/dairy/reports/daily?date=2026-09-25", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["date"] == "2026-09-25"
    assert body["collections"]["count"] == 1
    assert body["collections"]["liters"] == 10.0
    assert body["collections"]["amount"] == 350.0
    assert body["sales"]["orders"] == 1
    assert body["sales"]["amount"] == 700.0
    assert len(body["closingStock"]) == 1
    assert body["closingStock"][0]["stockQty"] == 5.0


async def test_pl_report_math(client, user_store):
    token = seed_user(user_store, **MANAGER)
    member = await _create_member(client, token)
    for date, liters in (("2026-09-20", 10.0), ("2026-09-21", 10.0)):
        await client.post(
            "/v1/livestock/procurement/collections",
            json=_collection(member["id"], date, liters),
            headers=auth(token),
        )
    customer = await _create_customer(client, token)
    resp = await client.post(
        "/v1/livestock/dairy/sales/orders",
        json={"customerId": customer["id"], "orderDate": "2026-09-21", "liters": 10.0},
        headers=auth(token),
    )
    order_id = resp.json()["id"]
    await client.post(
        f"/v1/livestock/dairy/sales/orders/{order_id}/status",
        json={"status": "delivered"},
        headers=auth(token),
    )
    resp = await client.get("/v1/livestock/dairy/reports/pl?month=2026-09", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["month"] == "2026-09"
    assert body["procurementCost"] == 700.0
    assert body["salesIncome"] == 700.0
    assert body["grossProfit"] == 0.0
    assert body["collectionsCount"] == 2
    assert body["ordersCount"] == 1


async def test_payment_batch_ready_emits_task(client, user_store):
    token, _member_a, _member_b = await _setup_batch_scenario(client, user_store)
    resp = await client.post(
        "/v1/livestock/dairy/payments/batches",
        json={"periodFrom": "2026-09-01", "periodTo": "2026-09-25"},
        headers=auth(token),
    )
    assert resp.status_code == 201
    batch_id = resp.json()["id"]
    tasks = [doc for key, doc in user_store.items() if key.startswith("tasks/")]
    assert len(tasks) == 1
    task = tasks[0]
    assert task["module"] == "dairy"
    assert task["kind"] == "payment_batch_ready"
    assert task["sourceId"] == batch_id
    assert task["deepLink"] == f"{DEEP_LINKS['dairy']}/payments/{batch_id}"
