from app.services.tokens import create_access_token
from tests.test_diary import auth, seed_user


def _seed_landlord(user_store, uid="uid-l1"):
    seed_user(user_store, uid=uid, active_profile="farmLandlord", name="Landlord Patil")
    user_store[f"users/{uid}/land_plots/plot-1"] = {
        "id": "plot-1",
        "name": "North Field",
        "village": "Niphad",
        "district": "Nashik",
        "areaAcres": 5,
        "status": "leased",
    }
    user_store[f"users/{uid}/land_leases/lease-1"] = {
        "id": "lease-1",
        "plotId": "plot-1",
        "tenantName": "Sunil Pawar",
        "tenantPhone": "+919822200001",
        "monthlyRentRupees": 10000,
        "startDate": "2026-01-01",
        "endDate": "2026-12-31",
        "status": "active",
        "verified": False,
    }
    return create_access_token(uid)


async def test_open_dispute_and_idempotent_replay(client, user_store):
    token = _seed_landlord(user_store)
    headers = {**auth(token), "Idempotency-Key": "dispute-key-1"}
    resp = await client.post(
        "/v1/land/leases/lease-1/disputes",
        json={"category": "rent_dispute", "note": "rent unpaid for two months"},
        headers=headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "open"
    assert body["leaseId"] == "lease-1"
    disputes = [k for k in user_store if k.startswith("land_disputes/")]
    assert len(disputes) == 1
    stored = user_store[disputes[0]]
    assert stored["createdBy"] == "uid-l1"
    assert stored["status"] == "open"
    replay = await client.post(
        "/v1/land/leases/lease-1/disputes",
        json={"category": "rent_dispute", "note": "rent unpaid for two months"},
        headers=headers,
    )
    assert replay.json() == body
    assert len([k for k in user_store if k.startswith("land_disputes/")]) == 1
    audits = [doc for key, doc in user_store.items() if key.startswith("audit_logs/")]
    assert any(doc.get("action") == "LEASE_DISPUTE_OPENED" for doc in audits)


async def test_dispute_requires_idempotency_key(client, user_store):
    token = _seed_landlord(user_store)
    resp = await client.post(
        "/v1/land/leases/lease-1/disputes",
        json={"category": "rent_dispute"},
        headers=auth(token),
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "IDEMPOTENCY_KEY_REQUIRED"


async def test_lease_and_payment_carry_retention(client, user_store):
    seed_user(user_store, uid="uid-l1", active_profile="farmLandlord", name="Landlord Patil")
    user_store["users/uid-l1/land_plots/plot-1"] = {
        "id": "plot-1",
        "name": "North Field",
        "village": "Niphad",
        "district": "Nashik",
        "areaAcres": 5,
        "status": "vacant",
    }
    token = create_access_token("uid-l1")
    headers = auth(token)
    created = await client.post(
        "/v1/land/leases",
        json={
            "plotId": "plot-1",
            "tenantName": "Mahesh Jadhav",
            "tenantPhone": "+919822200002",
            "monthlyRentRupees": 8000,
            "startDate": "2026-10-01",
            "endDate": "2027-09-30",
        },
        headers=headers,
    )
    assert created.status_code == 201
    lease_id = created.json()["id"]
    lease_doc = user_store[f"users/uid-l1/land_leases/{lease_id}"]
    assert lease_doc["retainUntil"]

    payment = await client.post(
        f"/v1/land/leases/{lease_id}/payments",
        json={
            "amountRupees": 5000,
            "month": "2026-10",
            "method": "cash",
            "paidAt": "2026-10-12T10:00:00+00:00",
        },
        headers=headers,
    )
    assert payment.status_code == 201
    payment_id = payment.json()["id"]
    payment_doc = user_store[f"users/uid-l1/land_leases/{lease_id}/payments/{payment_id}"]
    assert payment_doc["retainUntil"]
    ledger = user_store[f"users/uid-l1/land_leases/{lease_id}/rent_ledger/2026-10"]
    assert ledger["retainUntil"]
