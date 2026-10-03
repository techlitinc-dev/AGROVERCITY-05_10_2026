from tests.test_diary import auth, seed_user

PROFILE = {
    "name": "Shrimant Panchvati Desi Gaushala",
    "trustName": "Shree Ram Panchavati Trust",
    "address": "Panchavati, Nashik",
    "district": "Nashik",
    "phone": "+91 98224 88771",
    "capacity": 50,
    "certifications": {"eightyG": True, "fcra": False, "awbi": True},
    "bankDetails": {"bankName": "SBI", "accountNo": "XXXXXX1234", "ifsc": "SBIN0021673"},
}


async def _create_profile(client, token):
    resp = await client.post("/v1/livestock/gaushala/profile", json=PROFILE, headers=auth(token))
    assert resp.status_code == 201
    return resp.json()


def _seed_cattle(user_store, gaushala_id):
    cattle = [
        {"id": "c-g1", "tagId": "TAG-001", "name": "गौरी", "species": "cow",
         "gaushalaId": gaushala_id, "category": "milking", "createdAt": "2026-09-01T08:00:00Z"},
        {"id": "c-g2", "tagId": "TAG-002", "name": "गंगा", "species": "cow",
         "gaushalaId": gaushala_id, "category": "dry", "createdAt": "2026-09-02T08:00:00Z"},
        {"id": "c-g3", "tagId": "TAG-003", "name": "तारा", "species": "cow",
         "gaushalaId": gaushala_id, "category": "aged", "cattleStatus": "deceased",
         "createdAt": "2026-09-03T08:00:00Z"},
        {"id": "c-x1", "tagId": "TAG-099", "name": "बाहेरील गाय",
         "gaushalaId": "gau-other", "category": "milking", "createdAt": "2026-09-03T08:00:00Z"},
    ]
    for animal in cattle:
        user_store[f"livestock_animals/{animal['id']}"] = animal
    return cattle


# --- Profile ---

async def test_profile_create_and_get(client, user_store):
    token = seed_user(user_store, uid="mgr-1", active_profile="dairyManager")
    profile = await _create_profile(client, token)
    assert profile["managerId"] == "mgr-1"
    assert profile["capacity"] == 50
    assert profile["certifications"]["eightyG"] is True
    assert profile["bankDetails"]["ifsc"] == "SBIN0021673"

    resp = await client.get("/v1/livestock/gaushala/mine", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["id"] == profile["id"]
    assert user_store[f"gaushalas/{profile['id']}"]["managerId"] == "mgr-1"


async def test_profile_duplicate_409(client, user_store):
    token = seed_user(user_store, uid="mgr-1", active_profile="dairyManager")
    await _create_profile(client, token)
    resp = await client.post("/v1/livestock/gaushala/profile", json=PROFILE, headers=auth(token))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "GAUSHALA_EXISTS"


async def test_profile_update(client, user_store):
    token = seed_user(user_store, uid="mgr-1", active_profile="dairyManager")
    profile = await _create_profile(client, token)
    resp = await client.put(
        "/v1/livestock/gaushala/profile",
        json={**PROFILE, "name": "Updated Gaushala", "capacity": 75},
        headers=auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated Gaushala"
    stored = user_store[f"gaushalas/{profile['id']}"]
    assert stored["capacity"] == 75
    assert stored["managerId"] == "mgr-1"


async def test_profile_requires_manager_role(client, user_store):
    token = seed_user(user_store, uid="mgr-1", active_profile="dairyManager")
    await _create_profile(client, token)
    farmer_token = seed_user(user_store, uid="farmer-1", active_profile="farmer")
    resp = await client.get("/v1/livestock/gaushala/mine", headers=auth(farmer_token))
    assert resp.status_code == 403
    resp = await client.post(
        "/v1/livestock/gaushala/profile", json=PROFILE, headers=auth(farmer_token)
    )
    assert resp.status_code == 403


async def test_gaushala_endpoints_require_profile(client, user_store):
    token = seed_user(user_store, uid="mgr-1", active_profile="dairyManager")
    resp = await client.get("/v1/livestock/gaushala/mine", headers=auth(token))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "GAUSHALA_NOT_FOUND"
    resp = await client.get("/v1/livestock/gaushala/cattle", headers=auth(token))
    assert resp.status_code == 404


# --- Cattle ---

async def test_cattle_listing_filter(client, user_store):
    token = seed_user(user_store, uid="mgr-1", active_profile="dairyManager")
    profile = await _create_profile(client, token)
    _seed_cattle(user_store, profile["id"])

    resp = await client.get("/v1/livestock/gaushala/cattle", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 3
    assert all(c["gaushalaId"] == profile["id"] for c in body["data"])

    resp = await client.get("/v1/livestock/gaushala/cattle?category=milking", headers=auth(token))
    assert resp.json()["total"] == 1
    assert resp.json()["data"][0]["id"] == "c-g1"


async def test_cattle_event_append_and_status(client, user_store):
    token = seed_user(user_store, uid="mgr-1", active_profile="dairyManager")
    profile = await _create_profile(client, token)
    _seed_cattle(user_store, profile["id"])

    resp = await client.post(
        "/v1/livestock/gaushala/cattle/c-g1/events",
        json={"type": "intake", "note": "rescued from highway", "date": "2026-09-10"},
        headers=auth(token),
    )
    assert resp.status_code == 201
    animal = resp.json()
    assert len(animal["events"]) == 1
    assert animal["events"][0]["type"] == "intake"
    assert animal["cattleStatus"] == "in-shelter"
    assert animal["source"] == "rescued"

    resp = await client.post(
        "/v1/livestock/gaushala/cattle/c-g1/events",
        json={"type": "deceased", "note": "old age"},
        headers=auth(token),
    )
    animal = resp.json()
    assert len(animal["events"]) == 2
    assert animal["events"][1]["type"] == "deceased"
    assert animal["events"][1]["date"] != ""
    assert animal["cattleStatus"] == "deceased"


async def test_cattle_event_other_gaushala_404(client, user_store):
    token = seed_user(user_store, uid="mgr-1", active_profile="dairyManager")
    profile = await _create_profile(client, token)
    _seed_cattle(user_store, profile["id"])
    resp = await client.post(
        "/v1/livestock/gaushala/cattle/c-x1/events",
        json={"type": "intake"},
        headers=auth(token),
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "CATTLE_NOT_FOUND"


# --- Adoptions & donations ---

async def test_adoption_approve_creates_receipt(client, user_store):
    token = seed_user(user_store, uid="mgr-1", active_profile="dairyManager")
    profile = await _create_profile(client, token)
    user_store["cow_adoptions/adopt-1"] = {
        "id": "adopt-1",
        "gaushalaId": profile["id"],
        "donorId": "farmer-1",
        "donorName": "विनोद शहा",
        "amountInr": 1100,
        "status": "active",
        "createdAt": "2026-09-01T08:00:00Z",
    }
    resp = await client.put(
        "/v1/livestock/gaushala/adoptions/adopt-1/status",
        json={"status": "approved"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    receipt = body["receipt"]
    assert receipt is not None
    assert receipt["kind"] == "adoption"
    assert receipt["eightyGEligible"] is True
    assert receipt["personName"] == "विनोद शहा"
    assert receipt["amount"] == 1100
    assert receipt["refId"] == "adopt-1"

    stored = user_store[f"receipts/{receipt['id']}"]
    assert stored["kind"] == "adoption"
    assert stored["certificateNumber"].startswith("GOSH-")
    assert user_store["cow_adoptions/adopt-1"]["status"] == "approved"
    assert user_store["cow_adoptions/adopt-1"]["receiptId"] == receipt["id"]

    notifications = [d for d in user_store.values() if d.get("userId") == "farmer-1"]
    assert len(notifications) == 1
    assert notifications[0]["data"]["kind"] == "adoption_approved"


async def test_adoption_invalid_transition(client, user_store):
    token = seed_user(user_store, uid="mgr-1", active_profile="dairyManager")
    profile = await _create_profile(client, token)
    user_store["cow_adoptions/adopt-1"] = {
        "id": "adopt-1", "gaushalaId": profile["id"], "donorId": "farmer-1",
        "donorName": "विनोद शहा", "amountInr": 1100, "status": "active",
    }
    resp = await client.put(
        "/v1/livestock/gaushala/adoptions/adopt-1/status",
        json={"status": "completed"},
        headers=auth(token),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "INVALID_TRANSITION"

    await client.put(
        "/v1/livestock/gaushala/adoptions/adopt-1/status",
        json={"status": "approved"},
        headers=auth(token),
    )
    resp = await client.put(
        "/v1/livestock/gaushala/adoptions/adopt-1/status",
        json={"status": "completed"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["adoption"]["status"] == "completed"


async def test_donation_acknowledge_creates_receipt(client, user_store):
    token = seed_user(user_store, uid="mgr-1", active_profile="dairyManager")
    profile = await _create_profile(client, token)
    user_store["fodder_donations/don-1"] = {
        "id": "don-1", "gaushalaId": profile["id"], "donorId": "farmer-1",
        "donorName": "अशोकराव कदम", "amountInr": 3500, "donationType": "green_fodder",
        "createdAt": "2026-09-20T10:00:00Z",
    }
    resp = await client.put(
        "/v1/livestock/gaushala/donations/don-1/status",
        json={"status": "acknowledged"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    receipt = resp.json()["receipt"]
    assert receipt["kind"] == "donation"
    assert receipt["eightyGEligible"] is True
    assert receipt["amount"] == 3500
    assert user_store[f"receipts/{receipt['id']}"]["personName"] == "अशोकराव कदम"
    assert user_store["fodder_donations/don-1"]["status"] == "acknowledged"


# --- Expenses ---

async def test_expenses_crud(client, user_store):
    token = seed_user(user_store, uid="mgr-1", active_profile="dairyManager")
    profile = await _create_profile(client, token)
    resp = await client.post(
        "/v1/livestock/gaushala/expenses",
        json={"category": "fodder", "amount": 5000.0, "note": "maize fodder", "expenseDate": "2026-09-10"},
        headers=auth(token),
    )
    assert resp.status_code == 201
    expense_id = resp.json()["id"]
    assert resp.json()["gaushalaId"] == profile["id"]
    assert resp.json()["createdBy"] == "mgr-1"

    resp = await client.get("/v1/livestock/gaushala/expenses", headers=auth(token))
    assert resp.json()["total"] == 1

    resp = await client.put(
        f"/v1/livestock/gaushala/expenses/{expense_id}",
        json={"category": "fodder", "amount": 5500.0, "note": "updated", "expenseDate": "2026-09-10"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    assert user_store[f"gaushala_expenses/{expense_id}"]["amount"] == 5500.0

    resp = await client.delete(f"/v1/livestock/gaushala/expenses/{expense_id}", headers=auth(token))
    assert resp.status_code == 200
    assert f"gaushala_expenses/{expense_id}" not in user_store


async def test_expenses_summary_by_category(client, user_store):
    token = seed_user(user_store, uid="mgr-1", active_profile="dairyManager")
    profile = await _create_profile(client, token)
    expenses = [
        {"category": "fodder", "amount": 5000.0, "expenseDate": "2026-09-10"},
        {"category": "fodder", "amount": 2500.0, "expenseDate": "2026-09-15"},
        {"category": "medical", "amount": 3400.0, "expenseDate": "2026-09-12"},
        {"category": "staff", "amount": 9000.0, "expenseDate": "2026-08-05"},
    ]
    for expense in expenses:
        resp = await client.post(
            "/v1/livestock/gaushala/expenses",
            json={"note": "", **expense},
            headers=auth(token),
        )
        assert resp.status_code == 201

    resp = await client.get("/v1/livestock/gaushala/expenses/summary", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 19900.0
    assert body["byCategory"] == {"fodder": 7500.0, "medical": 3400.0, "staff": 9000.0}
    assert body["count"] == 4

    resp = await client.get("/v1/livestock/gaushala/expenses/summary?month=2026-09", headers=auth(token))
    body = resp.json()
    assert body["total"] == 10900.0
    assert body["byCategory"] == {"fodder": 7500.0, "medical": 3400.0}


async def test_expenses_forbidden_for_farmer(client, user_store):
    token = seed_user(user_store, uid="mgr-1", active_profile="dairyManager")
    await _create_profile(client, token)
    farmer_token = seed_user(user_store, uid="farmer-1", active_profile="farmer")
    resp = await client.post(
        "/v1/livestock/gaushala/expenses",
        json={"category": "fodder", "amount": 100.0, "expenseDate": "2026-09-10"},
        headers=auth(farmer_token),
    )
    assert resp.status_code == 403


# --- Dashboard ---

async def test_dashboard_aggregates(client, user_store):
    from datetime import datetime, timezone

    month = datetime.now(timezone.utc).strftime("%Y-%m")
    token = seed_user(user_store, uid="mgr-1", active_profile="dairyManager")
    profile = await _create_profile(client, token)
    _seed_cattle(user_store, profile["id"])
    user_store["cow_adoptions/adopt-1"] = {
        "id": "adopt-1", "gaushalaId": profile["id"], "donorId": "farmer-1",
        "donorName": "विनोद शहा", "amountInr": 1100, "status": "active",
    }
    user_store["cow_adoptions/adopt-2"] = {
        "id": "adopt-2", "gaushalaId": profile["id"], "donorId": "farmer-2",
        "donorName": "मीना शहा", "amountInr": 2100, "status": "approved",
    }
    user_store["cow_adoptions/adopt-3"] = {
        "id": "adopt-3", "gaushalaId": profile["id"], "donorId": "farmer-2",
        "donorName": "मीना शहा", "amountInr": 2100, "status": "rejected",
    }
    user_store["fodder_donations/don-1"] = {
        "id": "don-1", "gaushalaId": profile["id"], "donorId": "farmer-1",
        "donorName": "अशोकराव कदम", "amountInr": 3500, "createdAt": f"{month}-20T10:00:00Z",
    }
    user_store["gaushala_expenses/exp-1"] = {
        "id": "exp-1", "gaushalaId": profile["id"], "category": "fodder",
        "amount": 5000.0, "expenseDate": f"{month}-10", "createdBy": "mgr-1",
    }

    resp = await client.get("/v1/livestock/gaushala/dashboard", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["gaushalaId"] == profile["id"]
    assert body["headcount"] == 2  # deceased excluded
    assert body["byCategory"] == {"milking": 1, "dry": 1, "aged": 1}
    assert body["activeAdoptions"] == 2  # active + approved, rejected excluded
    assert body["donationsMonthTotal"] == 3500.0
    assert body["expensesMonthTotal"] == 5000.0
    assert body["capacity"] == 50
    assert body["occupancy"] == 2
    assert body["occupancyPercent"] == 4.0
