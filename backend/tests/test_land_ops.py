"""Tests for the land marketplace ops extension (extension-2026-10-11):
listing enrichment, leads CRM, waitlist, lease lifecycle (renew/terminate/
handover), profit management (plot expenses, crop-share settlements,
profit dashboard) and two-sided land reviews."""
from datetime import date

from app.routers.land import _add_months
from app.services.billing import seed_plans
from tests.test_diary import auth, seed_user
from tests.test_land_market import LISTING_NEAR, _make_listing

LANDLORD = {"active_profile": "farmLandlord", "name": "Landlord Patil", "phone": "+919811100001"}
FARMER = {"active_profile": "farmer", "name": "Sunil Pawar", "phone": "+919822200001"}


def _landlord(store, uid="uid-l1", **overrides):
    return seed_user(store, uid=uid, **{**LANDLORD, **overrides})


def _farmer(store, uid="uid-f1", **overrides):
    return seed_user(store, uid=uid, **{**FARMER, **overrides})


def _month_start(months_back: int) -> str:
    today = date.today()
    slot = today.month - 1 - months_back
    return f"{today.year + slot // 12:04d}-{slot % 12 + 1:02d}-01"


def _ym(months_back: int) -> str:
    return _month_start(months_back)[:7]


async def _make_pro(store, uid="uid-l1"):
    """Activate the Pro landlord plan (free tier caps plots/activeLeases at 1)."""
    await seed_plans()
    store["subscriptions/sub_pro_landlord"] = {
        "subId": "sub_pro_landlord",
        "userId": uid,
        "planId": "farmLandlord_pro",
        "status": "active",
        "provider": "razorpay_sub",
        "providerRef": "sub_test_1",
        "currentPeriodEnd": "2027-01-01T00:00:00+00:00",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }


def _tasks_for(store, uid, kind):
    return [
        doc
        for key, doc in store.items()
        if key.startswith("tasks/") and doc.get("userId") == uid and doc.get("kind") == kind
    ]


async def _apply(client, farmer_token, listing_id, months=12):
    resp = await client.post(
        "/v1/land/lease-requests",
        json={"listingId": listing_id, "durationMonths": months},
        headers=auth(farmer_token),
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _accept(client, landlord_token, request_id):
    resp = await client.post(
        f"/v1/land/lease-requests/{request_id}/accept", headers=auth(landlord_token)
    )
    assert resp.status_code == 200
    return resp.json()["leaseId"]


async def _active_lease_via_listing(client, store, landlord_token, farmer_token):
    listing_id = await _make_listing(client, landlord_token)
    request_id = await _apply(client, farmer_token, listing_id)
    lease_id = await _accept(client, landlord_token, request_id)
    return listing_id, lease_id


# ---------------------------------------------------------------------------
# Listing enrichment
# ---------------------------------------------------------------------------


async def test_listing_detail_with_enrichment(client, user_store):
    landlord = _landlord(user_store)
    listing_id = await _make_listing(client, landlord)
    await client.post(
        f"/v1/land/listings/{listing_id}/photos",
        json={"url": "https://img.example/p1.jpg", "caption": "North boundary"},
        headers=auth(landlord),
    )
    await client.put(
        f"/v1/land/listings/{listing_id}/availability",
        json={"windows": [{"fromDate": "2026-11-01", "toDate": "2027-10-31", "status": "available"}]},
        headers=auth(landlord),
    )
    farmer = _farmer(user_store)
    await client.post(f"/v1/land/listings/{listing_id}/view", headers=auth(farmer))
    await client.post(f"/v1/land/listings/{listing_id}/save", headers=auth(farmer))

    resp = await client.get(f"/v1/land/listings/{listing_id}", headers=auth(farmer))
    assert resp.status_code == 200
    body = resp.json()
    assert body["photos"][0]["caption"] == "North boundary"
    assert body["availability"][0]["status"] == "available"
    assert body["viewsCount"] == 1
    assert body["savesCount"] == 1
    assert body["requestsCount"] == 0
    assert body["reviewAggregate"] == {"count": 0, "avgStars": None, "aspectAvgs": {}}


async def test_photo_limit_and_ownership(client, user_store):
    landlord = _landlord(user_store)
    other = _landlord(user_store, uid="uid-l2", phone="+919811100002")
    listing_id = await _make_listing(client, landlord)
    resp = await client.post(
        f"/v1/land/listings/{listing_id}/photos",
        json={"url": "https://img.example/x.jpg"},
        headers=auth(other),
    )
    assert resp.status_code == 403
    for i in range(10):
        resp = await client.post(
            f"/v1/land/listings/{listing_id}/photos",
            json={"url": f"https://img.example/p{i}.jpg"},
            headers=auth(landlord),
        )
        assert resp.status_code == 201
    resp = await client.post(
        f"/v1/land/listings/{listing_id}/photos",
        json={"url": "https://img.example/overflow.jpg"},
        headers=auth(landlord),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "PHOTO_LIMIT_REACHED"
    photo_id = user_store[f"land_listings/{listing_id}"]["photos"][0]["id"]
    resp = await client.delete(
        f"/v1/land/listings/{listing_id}/photos/{photo_id}", headers=auth(landlord)
    )
    assert resp.status_code == 204
    resp = await client.delete(
        f"/v1/land/listings/{listing_id}/photos/{photo_id}", headers=auth(landlord)
    )
    assert resp.status_code == 404


async def test_availability_window_validation(client, user_store):
    landlord = _landlord(user_store)
    listing_id = await _make_listing(client, landlord)
    resp = await client.put(
        f"/v1/land/listings/{listing_id}/availability",
        json={"windows": [{"fromDate": "2027-01-01", "toDate": "2026-12-01"}]},
        headers=auth(landlord),
    )
    assert resp.status_code == 422
    resp = await client.put(
        f"/v1/land/listings/{listing_id}/availability",
        json={"windows": [{"fromDate": "2026-12-01", "toDate": "2027-02-01", "status": "blocked"}]},
        headers=auth(landlord),
    )
    assert resp.status_code == 200
    assert resp.json()["availability"][0]["status"] == "blocked"


async def test_view_tracks_counter_and_lead(client, user_store):
    landlord = _landlord(user_store)
    listing_id = await _make_listing(client, landlord)
    farmer = _farmer(user_store)
    resp = await client.post(f"/v1/land/listings/{listing_id}/view", headers=auth(farmer))
    assert resp.status_code == 201
    assert resp.json()["viewsCount"] == 1
    resp = await client.post(f"/v1/land/listings/{listing_id}/view", headers=auth(farmer))
    assert resp.json()["viewsCount"] == 2
    resp = await client.post(f"/v1/land/listings/{listing_id}/view", headers=auth(landlord))
    assert resp.status_code == 403
    leads = [
        d
        for d in user_store.values()
        if d.get("type") == "view" and d.get("listingId") == listing_id
    ]
    assert len(leads) == 1  # idempotent lead per farmer/listing/type


async def test_price_suggestion_from_real_samples(client, user_store):
    uid = _landlord(user_store)
    for i, rent in enumerate((6000, 8000, 10000)):
        user_store[f"land_listings/seed{i}"] = {
            **LISTING_NEAR,
            "id": f"seed{i}",
            "village": "Pimplas",
            "status": "leased",
            "landlordId": uid,
            "areaAcres": 2.0,
            "expectedRentRupees": rent,
        }
    resp = await client.get("/v1/land/price-suggestion?village=Pimplas&areaAcres=2", headers=auth(uid))
    assert resp.status_code == 200
    body = resp.json()
    assert body["sampleCount"] == 3
    # per-acre rates are 3000/4000/5000 -> band 2700..5500, median 4000 * 2 acres
    assert body["bandMinRupeesPerAcre"] == 2700
    assert body["bandMaxRupeesPerAcre"] == 5500
    assert body["suggestedRentRupees"] == 8000
    resp = await client.get("/v1/land/price-suggestion?village=Nowhere", headers=auth(uid))
    assert resp.json()["suggestedRentRupees"] is None


async def test_boost_spends_coins_and_gates_free_plan(client, user_store):
    await seed_plans()
    landlord = _landlord(user_store, agriCoins=500)
    listing_id = await _make_listing(client, landlord)
    resp = await client.post(
        f"/v1/land/listings/{listing_id}/boost", json={"days": 7}, headers=auth(landlord)
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["coinsBalance"] == 300
    assert body["boostCount"] == 1
    assert "boostedUntil" in body
    resp = await client.post(
        f"/v1/land/listings/{listing_id}/boost", json={"days": 7}, headers=auth(landlord)
    )
    assert resp.status_code == 402
    assert resp.json()["error"]["code"] == "UPGRADE_REQUIRED"

    # pro landlord can boost repeatedly
    user_store["subscriptions/sub_pro"] = {
        "subId": "sub_pro",
        "userId": "uid-l1",
        "planId": "farmLandlord_pro",
        "status": "active",
        "currentPeriodEnd": "2027-01-01T00:00:00+00:00",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    resp = await client.post(
        f"/v1/land/listings/{listing_id}/boost", json={"days": 3}, headers=auth(landlord)
    )
    assert resp.status_code == 200
    assert resp.json()["boostCount"] == 2

    # insufficient coins
    poor = _landlord(user_store, uid="uid-l3", phone="+919811100003", agriCoins=0)
    poor_listing = await _make_listing(client, poor)
    resp = await client.post(
        f"/v1/land/listings/{poor_listing}/boost", json={}, headers=auth(poor)
    )
    assert resp.status_code == 402
    assert resp.json()["error"]["code"] == "INSUFFICIENT_COINS"


# ---------------------------------------------------------------------------
# Saves & waitlist
# ---------------------------------------------------------------------------


async def test_save_unsave_and_saved_listings(client, user_store):
    landlord = _landlord(user_store)
    listing_id = await _make_listing(client, landlord)
    farmer = _farmer(user_store)
    resp = await client.post(f"/v1/land/listings/{listing_id}/save", headers=auth(farmer))
    assert resp.status_code == 201
    resp = await client.post(f"/v1/land/listings/{listing_id}/save", headers=auth(farmer))
    assert resp.status_code in (200, 201)  # idempotent
    resp = await client.get("/v1/land/saved-listings", headers=auth(farmer))
    assert resp.json()["total"] == 1
    assert resp.json()["data"][0]["id"] == listing_id
    leads = [d for d in user_store.values() if d.get("type") == "save"]
    assert len(leads) == 1
    resp = await client.delete(f"/v1/land/listings/{listing_id}/save", headers=auth(farmer))
    assert resp.status_code == 204
    resp = await client.get("/v1/land/saved-listings", headers=auth(farmer))
    assert resp.json()["total"] == 0


async def test_waitlist_positions_and_leave(client, user_store):
    landlord = _landlord(user_store)
    listing_id = await _make_listing(client, landlord)
    f1 = _farmer(user_store)
    f2 = _farmer(user_store, uid="uid-f2", phone="+919822200002")
    resp = await client.post(f"/v1/land/listings/{listing_id}/waitlist", headers=auth(f1))
    assert resp.status_code == 201
    assert resp.json()["position"] == 1
    resp = await client.post(f"/v1/land/listings/{listing_id}/waitlist", headers=auth(f2))
    assert resp.json()["position"] == 2
    resp = await client.post(f"/v1/land/listings/{listing_id}/waitlist", headers=auth(f2))
    assert resp.status_code == 409
    resp = await client.get("/v1/land/waitlist/mine", headers=auth(f1))
    assert resp.json()["total"] == 1
    assert resp.json()["data"][0]["listing"]["id"] == listing_id
    resp = await client.delete(f"/v1/land/listings/{listing_id}/waitlist", headers=auth(f1))
    assert resp.status_code == 204
    resp = await client.get("/v1/land/waitlist/mine", headers=auth(f1))
    assert resp.json()["total"] == 0


async def test_termination_promotes_waitlist_and_reopens_listing(client, user_store):
    landlord = _landlord(user_store)
    listing_id, lease_id = await _active_lease_via_listing(client, user_store, landlord, _farmer(user_store))
    waiter = _farmer(user_store, uid="uid-f2", phone="+919822200002")
    resp = await client.post(f"/v1/land/listings/{listing_id}/waitlist", headers=auth(waiter))
    entry_id = resp.json()["id"]

    resp = await client.post(
        f"/v1/land/leases/{lease_id}/terminate",
        json={"reason": "Tenant repeatedly defaulted"},
        headers=auth(landlord),
    )
    assert resp.status_code == 201
    record = resp.json()
    assert record["terminatedBy"] == "landlord"
    assert record["penaltyDirection"] == "landlord_pays_tenant"
    assert record["penaltyRupees"] > 0

    lease = user_store[f"users/uid-l1/land_leases/{lease_id}"]
    assert lease["status"] == "terminated"
    assert user_store[f"land_listings/{listing_id}"]["status"] == "open"
    assert user_store[f"land_waitlist/{entry_id}"]["status"] == "offered"
    assert _tasks_for(user_store, "uid-f2", "waitlist_offer")
    assert _tasks_for(user_store, "uid-f1", "lease_terminated")
    # landlord broke the lease -> the farmer gets to rate the landlord
    prompt = user_store.get(f"users/uid-f1/rating_prompts/{lease_id}")
    assert prompt is not None
    assert prompt["rateeUid"] == "uid-l1"


# ---------------------------------------------------------------------------
# Leads CRM
# ---------------------------------------------------------------------------


async def test_lead_inbox_pipeline_and_notes(client, user_store):
    landlord = _landlord(user_store)
    listing_id = await _make_listing(client, landlord)
    farmer = _farmer(user_store)
    await client.post(f"/v1/land/listings/{listing_id}/view", headers=auth(farmer))
    await _apply(client, farmer, listing_id)

    resp = await client.get("/v1/land/leads", headers=auth(landlord))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    assert body["byStatus"]["new"] == 2
    view_lead = next(l for l in body["data"] if l["type"] == "view")
    app_lead = next(l for l in body["data"] if l["type"] == "application")

    resp = await client.post(
        f"/v1/land/leads/{view_lead['id']}/status", json={"status": "contacted"}, headers=auth(landlord)
    )
    assert resp.json()["status"] == "contacted"
    resp = await client.post(
        f"/v1/land/leads/{app_lead['id']}/notes",
        json={"note": "KYC verified, good payer"},
        headers=auth(landlord),
    )
    assert resp.status_code == 201

    resp = await client.get("/v1/land/leads?status=contacted", headers=auth(landlord))
    assert resp.json()["total"] == 1
    resp = await client.get("/v1/land/leads?type=application", headers=auth(landlord))
    assert resp.json()["total"] == 1
    assert resp.json()["data"][0]["notes"][0]["note"] == "KYC verified, good payer"

    # accept-conversion is covered in test_application_lead_converted_on_accept;
    # here exercise foreign access and delete
    other = _landlord(user_store, uid="uid-l2", phone="+919811100002")
    resp = await client.post(
        f"/v1/land/leads/{view_lead['id']}/status", json={"status": "dropped"}, headers=auth(other)
    )
    assert resp.status_code == 404
    resp = await client.delete(f"/v1/land/leads/{view_lead['id']}", headers=auth(landlord))
    assert resp.status_code == 204
    resp = await client.get("/v1/land/leads", headers=auth(landlord))
    assert resp.json()["total"] == 1


async def test_application_lead_converted_on_accept(client, user_store):
    landlord = _landlord(user_store)
    listing_id, lease_id = await _active_lease_via_listing(client, user_store, landlord, _farmer(user_store))
    assert lease_id
    leads = [d for d in user_store.values() if d.get("type") == "application"]
    assert len(leads) == 1
    assert leads[0]["status"] == "converted"


# ---------------------------------------------------------------------------
# Lease lifecycle: renewals, termination, handover
# ---------------------------------------------------------------------------


async def test_renewal_accept_extends_lease(client, user_store):
    landlord = _landlord(user_store)
    listing_id, lease_id = await _active_lease_via_listing(client, user_store, landlord, _farmer(user_store))
    end_before = user_store[f"users/uid-l1/land_leases/{lease_id}"]["endDate"]

    resp = await client.post(
        f"/v1/land/leases/{lease_id}/renew",
        json={"extensionMonths": 12, "newRentRupees": 9000, "note": "Happy with tenant"},
        headers=auth(landlord),
    )
    assert resp.status_code == 201
    renewal_id = resp.json()["id"]
    assert resp.json()["status"] == "proposed"
    assert _tasks_for(user_store, "uid-f1", "lease_renewal")

    resp = await client.post(
        f"/v1/land/lease-renewals/{renewal_id}/respond",
        json={"action": "accept"},
        headers=auth(_farmer(user_store)),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "accepted"
    lease = user_store[f"users/uid-l1/land_leases/{lease_id}"]
    expected_end = _add_months(date.fromisoformat(end_before), 12).isoformat()
    assert lease["endDate"] == expected_end
    assert lease["monthlyRentRupees"] == 9000
    assert _tasks_for(user_store, "uid-l1", "lease_renewal_accepted")

    resp = await client.post(
        f"/v1/land/lease-renewals/{renewal_id}/respond",
        json={"action": "accept"},
        headers=auth(_farmer(user_store)),
    )
    assert resp.status_code == 409


async def test_renewal_decline_and_foreign_access(client, user_store):
    landlord = _landlord(user_store)
    _, lease_id = await _active_lease_via_listing(client, user_store, landlord, _farmer(user_store))
    resp = await client.post(
        f"/v1/land/leases/{lease_id}/renew",
        json={"extensionMonths": 6},
        headers=auth(landlord),
    )
    renewal_id = resp.json()["id"]
    outsider = _farmer(user_store, uid="uid-x", phone="+919833300009")
    resp = await client.post(
        f"/v1/land/lease-renewals/{renewal_id}/respond",
        json={"action": "accept"},
        headers=auth(outsider),
    )
    assert resp.status_code == 404
    resp = await client.post(
        f"/v1/land/lease-renewals/{renewal_id}/respond",
        json={"action": "decline", "reason": "Moving districts"},
        headers=auth(_farmer(user_store)),
    )
    assert resp.json()["status"] == "declined"
    resp = await client.get(f"/v1/land/leases/{lease_id}/renewals", headers=auth(landlord))
    assert resp.json()["total"] == 1


async def test_tenant_termination_forfeiture_and_handover(client, user_store):
    landlord = _landlord(user_store)
    _, lease_id = await _active_lease_via_listing(client, user_store, landlord, _farmer(user_store))

    resp = await client.post(
        f"/v1/land/leases/{lease_id}/handover",
        json={
            "type": "move_in",
            "checklist": [
                {"label": "Boundary fence", "condition": "good"},
                {"label": "Borewell pump", "condition": "fair"},
            ],
            "notes": "Both parties present",
        },
        headers=auth(_farmer(user_store)),
    )
    assert resp.status_code == 201
    resp = await client.get(f"/v1/land/leases/{lease_id}/handover", headers=auth(landlord))
    assert resp.json()["total"] == 1
    assert resp.json()["data"][0]["createdByRole"] == "tenant"
    outsider = _farmer(user_store, uid="uid-x", phone="+919833300009")
    resp = await client.get(f"/v1/land/leases/{lease_id}/handover", headers=auth(outsider))
    assert resp.status_code == 404

    resp = await client.post(
        f"/v1/land/leases/{lease_id}/terminate",
        json={"reason": "Family emergency"},
        headers=auth(_farmer(user_store)),
    )
    record = resp.json()
    assert record["terminatedBy"] == "tenant"
    assert record["penaltyDirection"] == "tenant_forfeits"
    rent = user_store[f"users/uid-l1/land_leases/{lease_id}"]["monthlyRentRupees"]
    assert record["penaltyRupees"] == round(rent * 0.5, 2)
    # tenant broke the lease -> landlord rates the farmer
    prompt = user_store.get(f"users/uid-l1/rating_prompts/{lease_id}")
    assert prompt is not None
    assert prompt["rateeUid"] == "uid-f1"


async def test_ending_lease_via_update_reopens_listing(client, user_store):
    landlord = _landlord(user_store)
    listing_id, lease_id = await _active_lease_via_listing(client, user_store, landlord, _farmer(user_store))
    plot_id = user_store[f"land_listings/{listing_id}"].get("plotId") or ""
    resp = await client.put(
        f"/v1/land/leases/{lease_id}", json={"status": "ended"}, headers=auth(landlord)
    )
    assert resp.status_code == 200
    assert user_store[f"land_listings/{listing_id}"]["status"] == "open"
    if plot_id:
        assert user_store[f"users/uid-l1/land_plots/{plot_id}"]["status"] == "vacant"
    assert user_store.get(f"users/uid-l1/rating_prompts/{lease_id}") is not None


# ---------------------------------------------------------------------------
# Tenancies & rent dues (farmer side)
# ---------------------------------------------------------------------------


async def _phone_lease(client, landlord, farmer_phone, months_back=2, rent=8000):
    resp = await client.post(
        "/v1/land/plots",
        json={"name": "Pimplas Plot 9", "village": "Pimplas", "district": "Nashik", "areaAcres": 2.5},
        headers=auth(landlord),
    )
    plot_id = resp.json()["id"]
    resp = await client.post(
        "/v1/land/leases",
        json={
            "plotId": plot_id,
            "tenantName": "Sunil Pawar",
            "tenantPhone": farmer_phone,
            "monthlyRentRupees": rent,
            "startDate": _month_start(months_back),
            "endDate": _add_months(date.fromisoformat(_month_start(months_back)), 12).isoformat(),
        },
        headers=auth(landlord),
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def test_tenancies_and_rent_dues(client, user_store):
    landlord = _landlord(user_store)
    farmer = _farmer(user_store)
    lease_id = await _phone_lease(client, landlord, FARMER["phone"], months_back=2)

    resp = await client.get("/v1/land/tenancies", headers=auth(farmer))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    tenancy = body["data"][0]
    assert tenancy["leaseId"] == lease_id
    assert tenancy["landlordName"] == "Landlord Patil"
    assert tenancy["plotName"] == "Pimplas Plot 9"
    # 3 months elapsed (2 back + current), none paid
    assert len(tenancy["monthsDue"]) == 3

    resp = await client.get("/v1/land/rent/dues", headers=auth(farmer))
    body = resp.json()
    assert body["total"] == 1
    assert body["data"][0]["status"] == "overdue"
    assert body["totalOutstandingPaisa"] == 3 * 8000 * 100
    assert body["data"][0]["monthsDue"][0] == _ym(2)

    # pay all three months -> paid up
    for back in (2, 1, 0):
        resp = await client.post(
            f"/v1/land/leases/{lease_id}/payments",
            json={"amountRupees": 8000, "month": _ym(back), "method": "upi", "paidAt": "2026-10-11"},
            headers=auth(landlord),
        )
        assert resp.status_code == 201
    resp = await client.get("/v1/land/rent/dues", headers=auth(farmer))
    assert resp.json()["data"][0]["status"] == "paid_up"
    assert resp.json()["totalOutstandingPaisa"] == 0


# ---------------------------------------------------------------------------
# Profit management
# ---------------------------------------------------------------------------


async def test_plot_expenses_feed_pnl(client, user_store):
    landlord = _landlord(user_store)
    resp = await client.post(
        "/v1/land/plots",
        json={"name": "Plot E", "village": "Pimplas", "district": "Nashik", "areaAcres": 3.0},
        headers=auth(landlord),
    )
    plot_id = resp.json()["id"]
    resp = await client.post(
        f"/v1/land/plots/{plot_id}/expenses",
        json={"category": "boundary_maintenance", "amountRupees": 5000, "note": "Fence repair"},
        headers=auth(landlord),
    )
    assert resp.status_code == 201
    expense_id = resp.json()["id"]
    await client.post(
        f"/v1/land/plots/{plot_id}/expenses",
        json={"category": "irrigation", "amountRupees": 2000},
        headers=auth(landlord),
    )
    entry = user_store[f"users/uid-l1/diary_entries/auto_plot_expense__{expense_id}"]
    assert entry["type"] == "expense"
    assert entry["amount"] == 5000

    resp = await client.get(f"/v1/land/plots/{plot_id}/expenses", headers=auth(landlord))
    body = resp.json()
    assert body["summary"]["totalRupees"] == 7000
    assert body["summary"]["byCategory"] == {"boundary_maintenance": 5000, "irrigation": 2000}


async def test_harvest_declaration_settlement_flow(client, user_store):
    await _make_pro(user_store)
    landlord = _landlord(user_store)
    farmer = _farmer(user_store)
    resp = await client.post(
        "/v1/land/plots",
        json={"name": "Share Plot", "village": "Pimplas", "district": "Nashik", "areaAcres": 4.0},
        headers=auth(landlord),
    )
    plot_id = resp.json()["id"]
    resp = await client.post(
        "/v1/land/leases",
        json={
            "plotId": plot_id,
            "tenantName": FARMER["name"],
            "tenantPhone": FARMER["phone"],
            "monthlyRentRupees": 1000,
            "startDate": _month_start(1),
            "endDate": _add_months(date.fromisoformat(_month_start(1)), 11).isoformat(),
            "rentModel": "cropShare",
            "cropSharePercent": 40,
        },
        headers=auth(landlord),
    )
    assert resp.status_code == 201
    lease_id = resp.json()["id"]

    # fixed-rent lease rejects declarations
    fixed_lease = await _phone_lease(client, landlord, "+919844400004", months_back=0)
    resp = await client.post(
        f"/v1/land/leases/{fixed_lease}/harvest-declarations",
        json={"crop": "Wheat", "season": "rabi", "areaAcres": 1, "yieldQuintals": 10, "saleRatePerQuintal": 2000},
        headers=auth(_farmer(user_store, uid="uid-f9", phone="+919844400004")),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "NOT_CROPSHARE_LEASE"

    resp = await client.post(
        f"/v1/land/leases/{lease_id}/harvest-declarations",
        json={"crop": "Soybean", "season": "kharif", "areaAcres": 4, "yieldQuintals": 40, "saleRatePerQuintal": 3000},
        headers=auth(farmer),
    )
    assert resp.status_code == 201
    decl = resp.json()
    assert decl["totalSaleRupees"] == 120000
    assert decl["landlordShareRupees"] == 48000
    assert decl["farmerShareRupees"] == 72000
    assert _tasks_for(user_store, "uid-l1", "harvest_declared")

    # landlord cannot declare
    resp = await client.post(
        f"/v1/land/leases/{lease_id}/harvest-declarations",
        json={"crop": "Soybean", "season": "kharif", "areaAcres": 4, "yieldQuintals": 1, "saleRatePerQuintal": 1},
        headers=auth(landlord),
    )
    assert resp.status_code == 403

    resp = await client.post(
        f"/v1/land/leases/{lease_id}/harvest-declarations/{decl['id']}/settle",
        headers=auth(landlord),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "settled"
    landlord_entry = user_store[f"users/uid-l1/diary_entries/auto_harvest_declaration__{decl['id']}"]
    assert landlord_entry["type"] == "income"
    assert landlord_entry["amount"] == 48000
    farmer_entry = user_store[f"users/uid-f1/diary_entries/auto_harvest_declaration__{decl['id']}"]
    assert farmer_entry["amount"] == 72000
    assert _tasks_for(user_store, "uid-f1", "harvest_settled")

    resp = await client.post(
        f"/v1/land/leases/{lease_id}/harvest-declarations/{decl['id']}/settle",
        headers=auth(landlord),
    )
    assert resp.status_code == 409


async def test_profit_dashboard_and_export(client, user_store):
    landlord = _landlord(user_store)
    farmer = _farmer(user_store)
    lease_id = await _phone_lease(client, landlord, FARMER["phone"], months_back=0, rent=8000)
    resp = await client.post(
        f"/v1/land/leases/{lease_id}/payments",
        json={"amountRupees": 8000, "month": _ym(0), "method": "upi", "paidAt": "2026-10-11"},
        headers=auth(landlord),
    )
    assert resp.status_code == 201
    plot_id = user_store[f"users/uid-l1/land_leases/{lease_id}"]["plotId"]
    await client.post(
        f"/v1/land/plots/{plot_id}/expenses",
        json={"category": "soil_health", "amountRupees": 3000},
        headers=auth(landlord),
    )

    resp = await client.get("/v1/land/profit-dashboard", headers=auth(landlord))
    assert resp.status_code == 200
    body = resp.json()
    assert body["income"]["rentCollectedRupees"] == 8000
    assert body["expensesRupees"] == 3000
    assert body["netProfitRupees"] == 5000
    assert body["outstandingDuesPaisa"] == 0
    current_row = next(r for r in body["byMonth"] if r["month"] == _ym(0))
    assert current_row["rentRupees"] == 8000
    assert current_row["expenseRupees"] == 3000
    assert current_row["netRupees"] == 5000
    lease_row = next(l for l in body["byLease"] if l["leaseId"] == lease_id)
    assert lease_row["rentCollectedRupees"] == 8000

    resp = await client.get("/v1/land/profit-dashboard/export", headers=auth(landlord))
    assert resp.status_code == 200
    assert "TOTAL,8000,0,3000,5000" in resp.text
    resp = await client.get("/v1/land/profit-dashboard/export?format=pdf", headers=auth(landlord))
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Land reviews
# ---------------------------------------------------------------------------


async def test_reviews_require_accepted_lease_and_moderate(client, user_store):
    await _make_pro(user_store)
    landlord = _landlord(user_store)
    listing_id = await _make_listing(client, landlord)
    farmer = _farmer(user_store)

    resp = await client.post(
        f"/v1/land/listings/{listing_id}/reviews",
        json={"stars": 4},
        headers=auth(farmer),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "REVIEW_NOT_ALLOWED"

    request_id = await _apply(client, farmer, listing_id)
    await _accept(client, landlord, request_id)

    resp = await client.post(
        f"/v1/land/listings/{listing_id}/reviews",
        json={
            "stars": 4,
            "aspects": {"soilQuality": 5, "waterAvailability": 4, "valueForMoney": 4},
            "comment": "Good black soil, borewell works",
        },
        headers=auth(farmer),
    )
    assert resp.status_code == 201
    review_id = resp.json()["id"]

    resp = await client.post(
        f"/v1/land/listings/{listing_id}/reviews",
        json={"stars": 5},
        headers=auth(farmer),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "ALREADY_REVIEWED"

    resp = await client.get(f"/v1/land/listings/{listing_id}/reviews", headers=auth(landlord))
    body = resp.json()
    assert body["total"] == 1
    assert body["aggregate"]["avgStars"] == 4
    assert body["aggregate"]["aspectAvgs"]["soilQuality"] == 5
    assert body["data"][0]["id"] == review_id

    # invalid aspect name and blocked contact info on a fresh listing
    f2 = _farmer(user_store, uid="uid-f2", phone="+919822200002")
    listing2 = await _make_listing(client, landlord)
    request_id = await _apply(client, f2, listing2)
    await _accept(client, landlord, request_id)
    resp = await client.post(
        f"/v1/land/listings/{listing2}/reviews",
        json={"stars": 3, "aspects": {"location": 5}},
        headers=auth(f2),
    )
    assert resp.status_code == 422
    resp = await client.post(
        f"/v1/land/listings/{listing2}/reviews",
        json={"stars": 3, "comment": "call me on 9876543210"},
        headers=auth(f2),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "REVIEW_TEXT_BLOCKED"
