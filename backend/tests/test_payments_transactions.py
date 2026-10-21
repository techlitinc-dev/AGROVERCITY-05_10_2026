"""SR 4: unified transaction ledger + user-initiated refund requests."""
import pytest

from tests.test_diary import auth, seed_user


def _seed_ledger(user_store):
    """A mixed-shape ledger: shared rail, field variants, domain payout ledgers."""
    user_store["users/uid-seller"] = {
        "id": "uid-seller",
        "name": "Sita Verma",
        "phone": "+919800000001",
        "activeProfile": "seller",
        "primaryProfile": "seller",
    }
    # Sent by uid-1 over the shared rail (canonical shape).
    user_store["payments/pay_sent"] = {
        "id": "pay_sent",
        "userId": "uid-1",
        "amountPaisa": 150000,
        "purpose": "produce purchase",
        "refId": "pur_1",
        "razorpayOrderId": "order_1",
        "status": "paid",
        "createdAt": "2026-10-19T10:00:00+00:00",
    }
    # Received by uid-1, written by a domain flow with variant field names.
    user_store["payments/pay_recv"] = {
        "id": "pay_recv",
        "fromUserId": "uid-seller",
        "toUserId": "uid-1",
        "amount": 500,  # bare amount in the shared collection is paisa
        "type": "produce_sale",
        "state": "success",
        "createdAt": "2026-10-18T09:00:00+00:00",
    }
    # Belongs to somebody else — must never leak into uid-1's ledger.
    user_store["payments/pay_other"] = {
        "id": "pay_other",
        "userId": "uid-x",
        "amountPaisa": 99900,
        "purpose": "produce purchase",
        "status": "paid",
        "createdAt": "2026-10-19T12:00:00+00:00",
    }
    # Domain payout ledgers keyed by user id.
    user_store["transport_payouts/tpay_1"] = {
        "id": "tpay_1",
        "userId": "uid-1",
        "amountPaisa": 7500,
        "status": "processed",
        "at": "2026-10-17T08:00:00+00:00",
    }
    user_store["nursery_payouts/npay_1"] = {
        "id": "npay_1",
        "nurseryId": "uid-1",
        "amount": 320.0,  # nursery ledger keeps rupees
        "status": "processed",
        "createdAt": "2026-10-16T08:00:00+00:00",
    }


# ------------------------------ Transactions ------------------------------


async def test_transactions_unified_ledger_and_normalization(client, user_store):
    token = seed_user(user_store)
    headers = auth(token)
    _seed_ledger(user_store)
    resp = await client.get("/v1/payments/transactions", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["page"] == 1
    assert body["pageSize"] == 20
    assert body["total"] == 4

    by_id = {t["id"]: t for t in body["data"]}
    # Desc by createdAt: pay_sent, pay_recv, tpay_1, npay_1.
    assert [t["id"] for t in body["data"]] == ["pay_sent", "pay_recv", "tpay_1", "npay_1"]

    sent = by_id["pay_sent"]
    assert sent["direction"] == "sent"
    assert sent["amount"] == 1500.0  # paisa → rupees
    assert sent["currency"] == "INR"
    assert sent["status"] == "paid"
    assert sent["type"] == "produce purchase"
    assert sent["source"] == "payments"

    recv = by_id["pay_recv"]
    assert recv["direction"] == "received"
    assert recv["amount"] == 5.0  # bare amount on the shared rail is paisa
    assert recv["status"] == "success"  # state → status
    assert recv["type"] == "produce_sale"  # type → purpose
    assert recv["counterparty"] == {
        "userId": "uid-seller",
        "name": "Sita Verma",
        "persona": "seller",
    }

    assert by_id["tpay_1"]["amount"] == 75.0
    assert by_id["tpay_1"]["direction"] == "received"
    assert by_id["npay_1"]["amount"] == 320.0  # nursery rupees stay rupees

    assert body["totals"] == {"totalReceived": 400.0, "totalSent": 1500.0, "refundsPending": 0}
    assert "pay_other" not in by_id


async def test_transactions_direction_filter(client, user_store):
    token = seed_user(user_store)
    headers = auth(token)
    _seed_ledger(user_store)
    received = await client.get(
        "/v1/payments/transactions", params={"direction": "received"}, headers=headers
    )
    assert received.status_code == 200
    assert {t["direction"] for t in received.json()["data"]} == {"received"}
    assert received.json()["total"] == 3

    sent = await client.get(
        "/v1/payments/transactions", params={"direction": "sent"}, headers=headers
    )
    assert sent.json()["total"] == 1
    assert sent.json()["data"][0]["id"] == "pay_sent"

    bad = await client.get(
        "/v1/payments/transactions", params={"direction": "sideways"}, headers=headers
    )
    assert bad.status_code == 422
    assert bad.json()["error"]["code"] == "INVALID_DIRECTION"


async def test_transactions_status_type_and_date_filters(client, user_store):
    token = seed_user(user_store)
    headers = auth(token)
    _seed_ledger(user_store)

    by_status = await client.get(
        "/v1/payments/transactions", params={"status": "processed"}, headers=headers
    )
    assert by_status.json()["total"] == 2
    assert {t["id"] for t in by_status.json()["data"]} == {"tpay_1", "npay_1"}

    by_type = await client.get(
        "/v1/payments/transactions", params={"type": "produce"}, headers=headers
    )
    assert by_type.json()["total"] == 2
    assert {t["id"] for t in by_type.json()["data"]} == {"pay_sent", "pay_recv"}

    by_date = await client.get(
        "/v1/payments/transactions",
        params={"from": "2026-10-18", "to": "2026-10-18"},
        headers=headers,
    )
    assert by_date.json()["total"] == 1
    assert by_date.json()["data"][0]["id"] == "pay_recv"

    upto = await client.get(
        "/v1/payments/transactions", params={"to": "2026-10-17"}, headers=headers
    )
    assert {t["id"] for t in upto.json()["data"]} == {"tpay_1", "npay_1"}


async def test_transactions_pagination(client, user_store):
    token = seed_user(user_store)
    headers = auth(token)
    for i in range(5):
        user_store[f"payments/pay_pg{i}"] = {
            "id": f"pay_pg{i}",
            "userId": "uid-1",
            "amountPaisa": 100,
            "purpose": "test purchase",
            "status": "paid",
            "createdAt": f"2026-10-1{i}T00:00:00+00:00",
        }
    page1 = await client.get(
        "/v1/payments/transactions", params={"page": 1, "pageSize": 2}, headers=headers
    )
    assert page1.json()["pageSize"] == 2
    assert page1.json()["total"] == 5
    assert len(page1.json()["data"]) == 2
    page3 = await client.get(
        "/v1/payments/transactions", params={"page": 3, "pageSize": 2}, headers=headers
    )
    assert len(page3.json()["data"]) == 1

    invalid = await client.get(
        "/v1/payments/transactions", params={"page": 0}, headers=headers
    )
    assert invalid.status_code == 422
    assert invalid.json()["error"]["code"] == "INVALID_PAGINATION"


async def test_transactions_requires_auth(client, user_store):
    _seed_ledger(user_store)
    resp = await client.get("/v1/payments/transactions")
    assert resp.status_code == 401


# ------------------------------ Refund request ------------------------------


def _seed_paid_payment(user_store, pid="pay_rf", uid="uid-1", status="paid"):
    user_store[f"payments/{pid}"] = {
        "id": pid,
        "userId": uid,
        "amountPaisa": 42000,
        "purpose": "machinery rental",
        "refId": "bk_1",
        "status": status,
        "createdAt": "2026-10-19T10:00:00+00:00",
    }


async def test_refund_request_marks_payment_and_notifies(client, user_store):
    token = seed_user(user_store)
    headers = auth(token)
    _seed_paid_payment(user_store)
    resp = await client.post("/v1/payments/pay_rf/refund-request", headers=headers)
    assert resp.status_code == 200
    doc = resp.json()
    assert doc["refundStatus"] == "requested"
    assert doc["refundRequestedAt"]
    stored = user_store["payments/pay_rf"]
    assert stored["refundStatus"] == "requested"

    notifications = [
        d for k, d in user_store.items() if k.startswith("notifications/") and d.get("userId") == "uid-1"
    ]
    assert len(notifications) == 1
    note = notifications[0]
    assert note["type"] == "payment_refund_requested"
    assert note["read"] is False
    assert "420.00" in note["body"]
    assert note["title"]


async def test_refund_request_accepts_spec_literal_statuses(client, user_store):
    token = seed_user(user_store)
    headers = auth(token)
    _seed_paid_payment(user_store, pid="pay_cap", status="captured")
    _seed_paid_payment(user_store, pid="pay_ok", status="success")
    for pid in ("pay_cap", "pay_ok"):
        resp = await client.post(f"/v1/payments/{pid}/refund-request", headers=headers)
        assert resp.status_code == 200, pid
        assert resp.json()["refundStatus"] == "requested"


async def test_refund_request_is_idempotent(client, user_store):
    token = seed_user(user_store)
    headers = auth(token)
    _seed_paid_payment(user_store)
    first = await client.post("/v1/payments/pay_rf/refund-request", headers=headers)
    assert first.status_code == 200
    second = await client.post("/v1/payments/pay_rf/refund-request", headers=headers)
    assert second.status_code == 200
    assert second.json()["refundStatus"] == "requested"
    notifications = [k for k in user_store if k.startswith("notifications/")]
    assert len(notifications) == 1
    # still idempotent after the money rail flips the status
    user_store["payments/pay_rf"]["status"] = "refunded"
    third = await client.post("/v1/payments/pay_rf/refund-request", headers=headers)
    assert third.status_code == 200


async def test_refund_request_only_by_payer(client, user_store):
    token = seed_user(user_store)
    headers = auth(token)
    _seed_paid_payment(user_store, pid="pay_theirs", uid="uid-someone-else")
    resp = await client.post("/v1/payments/pay_theirs/refund-request", headers=headers)
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_refund_request_requires_captured_status(client, user_store):
    token = seed_user(user_store)
    headers = auth(token)
    _seed_paid_payment(user_store, pid="pay_pending", status="created")
    resp = await client.post("/v1/payments/pay_pending/refund-request", headers=headers)
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "REFUND_NOT_APPLICABLE"


async def test_refund_request_not_found(client, user_store):
    token = seed_user(user_store)
    headers = auth(token)
    resp = await client.post("/v1/payments/pay_missing/refund-request", headers=headers)
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "PAYMENT_NOT_FOUND"


@pytest.mark.parametrize("status", ["paid", "captured", "success"])
async def test_refund_requested_shows_in_ledger(client, user_store, status):
    token = seed_user(user_store)
    headers = auth(token)
    _seed_paid_payment(user_store, pid="pay_vis", status=status)
    await client.post("/v1/payments/pay_vis/refund-request", headers=headers)
    resp = await client.get("/v1/payments/transactions", headers=headers)
    tx = next(t for t in resp.json()["data"] if t["id"] == "pay_vis")
    assert tx["refundStatus"] == "requested"
    assert resp.json()["totals"]["refundsPending"] == 1
