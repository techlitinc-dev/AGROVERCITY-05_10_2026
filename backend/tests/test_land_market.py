import glob

from tests.test_diary import auth, seed_user

LISTING_NEAR = {
    "village": "Pimplas",
    "district": "Nashik",
    "lat": 20.0,
    "lng": 73.85,
    "areaAcres": 2.0,
    "expectedRentRupees": 8000,
}

LISTING_FAR = {**LISTING_NEAR, "village": "Farangaon", "lng": 74.8}


def _landlord(user_store, uid="uid-l1"):
    return seed_user(
        user_store, uid=uid, active_profile="farmLandlord",
        name="Landlord Patil", phone="+919811100001",
    )


def _farmer(user_store, uid="uid-f1", phone="+919822200001"):
    return seed_user(
        user_store, uid=uid, active_profile="farmer",
        name="Sunil Pawar", phone=phone,
    )


async def _make_listing(client, token, body=LISTING_NEAR):
    resp = await client.post("/v1/land/listings", json=body, headers=auth(token))
    assert resp.status_code == 201
    return resp.json()["id"]


async def test_create_and_browse_near_filter(client, user_store):
    landlord = _landlord(user_store)
    near_id = await _make_listing(client, landlord, LISTING_NEAR)
    await _make_listing(client, landlord, LISTING_FAR)
    farmer = _farmer(user_store)
    resp = await client.get("/v1/land/listings?near=20.0,73.8", headers=auth(farmer))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["data"][0]["id"] == near_id


async def test_duplicate_request_409(client, user_store):
    landlord = _landlord(user_store)
    listing_id = await _make_listing(client, landlord)
    farmer = _farmer(user_store)
    payload = {"listingId": listing_id, "durationMonths": 12}
    resp = await client.post("/v1/land/lease-requests", json=payload, headers=auth(farmer))
    assert resp.status_code == 201
    resp = await client.post("/v1/land/lease-requests", json=payload, headers=auth(farmer))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "DUPLICATE_LEASE_REQUEST"


async def test_accept_creates_lease_and_flips_listing(client, user_store):
    landlord = _landlord(user_store)
    listing_id = await _make_listing(client, landlord)
    farmer1 = _farmer(user_store)
    farmer2 = _farmer(user_store, uid="uid-f2", phone="+919822200002")
    resp = await client.post(
        "/v1/land/lease-requests",
        json={"listingId": listing_id, "durationMonths": 12},
        headers=auth(farmer1),
    )
    request_id = resp.json()["id"]
    resp = await client.post(
        "/v1/land/lease-requests",
        json={"listingId": listing_id, "durationMonths": 6},
        headers=auth(farmer2),
    )
    other_request_id = resp.json()["id"]
    resp = await client.post(
        f"/v1/land/lease-requests/{request_id}/accept", headers=auth(landlord)
    )
    assert resp.status_code == 200
    lease_id = resp.json()["leaseId"]
    assert user_store[f"land_listings/{listing_id}"]["status"] == "leased"
    resp = await client.get("/v1/land/leases", headers=auth(landlord))
    assert any(l["id"] == lease_id for l in resp.json()["data"])
    competing = user_store[f"lease_requests/{other_request_id}"]
    assert competing["status"] == "rejected"
    assert competing["reason"] == "Listed plot leased to another farmer"


async def test_non_owner_accept_403(client, user_store):
    landlord = _landlord(user_store)
    listing_id = await _make_listing(client, landlord)
    farmer = _farmer(user_store)
    resp = await client.post(
        "/v1/land/lease-requests",
        json={"listingId": listing_id, "durationMonths": 12},
        headers=auth(farmer),
    )
    request_id = resp.json()["id"]
    other_landlord = _landlord(user_store, uid="uid-l2")
    resp = await client.post(
        f"/v1/land/lease-requests/{request_id}/accept", headers=auth(other_landlord)
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "NOT_LISTING_OWNER"


async def _make_lease(client, landlord, tenant_phone):
    resp = await client.post(
        "/v1/land/plots",
        json={
            "name": "Pimplas Plot 1",
            "village": "Pimplas",
            "district": "Nashik",
            "areaAcres": 2.5,
            "gatNumber": "123/4",
        },
        headers=auth(landlord),
    )
    plot_id = resp.json()["id"]
    resp = await client.post(
        "/v1/land/leases",
        json={
            "plotId": plot_id,
            "tenantName": "Sunil Pawar",
            "tenantPhone": tenant_phone,
            "monthlyRentRupees": 8000,
            "startDate": "2026-07-01",
            "endDate": "2027-06-30",
        },
        headers=auth(landlord),
    )
    assert resp.status_code == 201
    return resp.json()["id"]



async def _make_pro(user_store, uid="uid-l1"):
    """Activate the Pro plan so PDF/analytics endpoints are reachable."""
    from app.services.billing import seed_plans

    await seed_plans()
    user_store["subscriptions/sub_pro_landlord"] = {
        "subId": "sub_pro_landlord",
        "userId": uid,
        "planId": "farmLandlord_pro",
        "status": "active",
        "provider": "razorpay_sub",
        "providerRef": "sub_test_1",
        "currentPeriodEnd": "2027-01-01T00:00:00+00:00",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }

async def test_agreement_pdf_returns_url(client, user_store, monkeypatch):
    await _make_pro(user_store)
    landlord = _landlord(user_store)
    lease_id = await _make_lease(client, landlord, "+919822200001")
    monkeypatch.setattr(
        "app.services.reports.upload_to_storage",
        lambda local_path, dest_path: "https://storage.example/agreement.pdf",
    )
    resp = await client.get(
        f"/v1/land/leases/{lease_id}/agreement-pdf", headers=auth(landlord)
    )
    assert resp.status_code == 200
    assert resp.json()["agreementUrl"] == "https://storage.example/agreement.pdf"
    generated = sorted(glob.glob(f"/tmp/lease_agreement_{lease_id}_*.pdf"))
    assert generated
    with open(generated[-1], "rb") as f:
        assert f.read(4) == b"%PDF"


async def test_tenant_can_fetch_agreement(client, user_store, monkeypatch):
    await _make_pro(user_store)
    monkeypatch.setattr(
        "app.services.reports.upload_to_storage",
        lambda local_path, dest_path: f"file://{local_path}",
    )
    landlord = _landlord(user_store)
    lease_id = await _make_lease(client, landlord, "+919822200001")
    tenant = _farmer(user_store)
    resp = await client.get(
        f"/v1/land/leases/{lease_id}/agreement-pdf", headers=auth(tenant)
    )
    assert resp.status_code == 200
    assert "agreementUrl" in resp.json()
    outsider = _farmer(user_store, uid="uid-x1", phone="+919833300003")
    resp = await client.get(
        f"/v1/land/leases/{lease_id}/agreement-pdf", headers=auth(outsider)
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "LEASE_NOT_FOUND"
