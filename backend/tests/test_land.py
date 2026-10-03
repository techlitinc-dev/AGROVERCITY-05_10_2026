from tests.test_diary import auth, seed_user

PLOT = {
    "name": "Pimplas Plot 1",
    "village": "Pimplas",
    "district": "Nashik",
    "areaAcres": 2.5,
    "gatNumber": "123/4",
    "soilType": "Black Cotton",
}

LEASE = {
    "tenantName": "Sunil Pawar",
    "tenantPhone": "+919822211122",
    "monthlyRentRupees": 8000,
    "startDate": "2026-07-01",
    "endDate": "2027-06-30",
}

PAYMENT = {
    "amountRupees": 8000,
    "month": "2026-09",
    "method": "upi",
    "paidAt": "2026-09-05",
}


async def _make_lease(client, token):
    resp = await client.post("/v1/land/plots", json=PLOT, headers=auth(token))
    plot_id = resp.json()["id"]
    resp = await client.post(
        "/v1/land/leases", json={**LEASE, "plotId": plot_id}, headers=auth(token)
    )
    return plot_id, resp.json()["id"]


async def test_create_plot_vacant(client, user_store):
    token = seed_user(user_store)
    resp = await client.post("/v1/land/plots", json=PLOT, headers=auth(token))
    assert resp.status_code == 201
    assert resp.json()["status"] == "vacant"


async def test_create_lease_marks_plot_leased(client, user_store):
    token = seed_user(user_store)
    resp = await client.post("/v1/land/plots", json=PLOT, headers=auth(token))
    plot_id = resp.json()["id"]
    resp = await client.post(
        "/v1/land/leases", json={**LEASE, "plotId": plot_id}, headers=auth(token)
    )
    assert resp.status_code == 201
    assert resp.json()["status"] == "active"
    resp = await client.get("/v1/land/plots", headers=auth(token))
    plot = next(p for p in resp.json()["data"] if p["id"] == plot_id)
    assert plot["status"] == "leased"


async def test_payment_and_duplicate_month_409(client, user_store):
    token = seed_user(user_store)
    _, lease_id = await _make_lease(client, token)
    resp = await client.post(
        f"/v1/land/leases/{lease_id}/payments", json=PAYMENT, headers=auth(token)
    )
    assert resp.status_code == 201
    assert resp.json()["leaseId"] == lease_id
    resp = await client.post(
        f"/v1/land/leases/{lease_id}/payments", json=PAYMENT, headers=auth(token)
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "DUPLICATE_PAYMENT_MONTH"


async def test_payments_summary(client, user_store):
    token = seed_user(user_store)
    _, lease_id = await _make_lease(client, token)
    for month in ("2026-08", "2026-09"):
        resp = await client.post(
            f"/v1/land/leases/{lease_id}/payments",
            json={**PAYMENT, "month": month},
            headers=auth(token),
        )
        assert resp.status_code == 201
    resp = await client.get(f"/v1/land/leases/{lease_id}/payments", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["totalCollectedRupees"] == 16000
    assert "2026-07" in body["pendingMonths"]


async def test_delete_plot_with_active_lease_409(client, user_store):
    token = seed_user(user_store)
    plot_id, _ = await _make_lease(client, token)
    resp = await client.delete(f"/v1/land/plots/{plot_id}", headers=auth(token))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "PLOT_HAS_ACTIVE_LEASE"


async def test_end_lease_frees_plot(client, user_store):
    token = seed_user(user_store)
    plot_id, lease_id = await _make_lease(client, token)
    resp = await client.put(
        f"/v1/land/leases/{lease_id}", json={"status": "ended"}, headers=auth(token)
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "ended"
    resp = await client.get("/v1/land/plots", headers=auth(token))
    plot = next(p for p in resp.json()["data"] if p["id"] == plot_id)
    assert plot["status"] == "vacant"


async def test_lease_bad_dates_422(client, user_store):
    token = seed_user(user_store)
    resp = await client.post("/v1/land/plots", json=PLOT, headers=auth(token))
    plot_id = resp.json()["id"]
    resp = await client.post(
        "/v1/land/leases",
        json={**LEASE, "plotId": plot_id, "endDate": "2026-06-01"},
        headers=auth(token),
    )
    assert resp.status_code == 422
