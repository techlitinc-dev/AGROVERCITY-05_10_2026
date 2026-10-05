from app.services.tokens import create_access_token


def seed_user(user_store, uid="uid-1", active_profile="farmer", **overrides):
    user_store[f"users/{uid}"] = {
        "id": uid,
        "name": "Ram Patil",
        "phone": "+919812345678",
        "linkedProfiles": [active_profile],
        "activeProfile": active_profile,
        "primaryProfile": active_profile,
        "agriCoins": 0,
        "bankName": "",
        "kccLimit": 0,
        "mpinHash": None,
        "createdAt": "2026-09-16T00:00:00+00:00",
        **overrides,
    }
    profiles = overrides.get("linkedProfiles") or [active_profile]
    if "dairyManager" in profiles or active_profile == "dairyManager":
        case_id = f"kyc_{uid[:8]}_dairyManager"
        user_store[f"kyc_cases/{case_id}"] = {
            "caseId": case_id,
            "userId": uid,
            "persona": "dairyManager",
            "status": "verified",
            "docs": [{"docId": f"{case_id}:fssai", "type": "fssai", "status": "verified"}],
        }
    # WS-02 task 2.27: instructors cannot publish courses / take bookings until
    # their KYC case is approved. Mirror the dairyManager precedent so instructor
    # fixtures start with an approved (verified) case; tests that need a pending
    # or specialization-gated case overwrite this doc.
    if "instructor" in profiles or active_profile == "instructor":
        case_id = f"kyc_{uid[:8]}_instructor"
        user_store[f"kyc_cases/{case_id}"] = {
            "caseId": case_id,
            "userId": uid,
            "persona": "instructor",
            "status": "verified",
            "specialization": [],
            "docs": [
                {"docId": f"{case_id}:pan", "type": "pan", "status": "verified"},
                {"docId": f"{case_id}:liveness_selfie", "type": "liveness_selfie", "status": "verified"},
            ],
            "submittedAt": "2026-09-16T00:00:00+00:00",
        }
    return create_access_token(uid)


def auth(token):
    return {"Authorization": f"Bearer {token}"}


ENTRY = {
    "title": "Urea 1 bag",
    "category": "fertilizer",
    "type": "expense",
    "amount": 450,
    "date": "2026-09-13",
    "cropName": "Wheat",
}


async def test_create_entry_awards_15_coins(client, user_store):
    token = seed_user(user_store)
    resp = await client.post("/v1/diary/entries", json=ENTRY, headers=auth(token))
    assert resp.status_code == 201
    body = resp.json()
    assert body["agriCoinsEarned"] == 15
    assert body["entry"]["title"] == "Urea 1 bag"
    assert user_store["users/uid-1"]["agriCoins"] == 15


async def test_list_filters_by_type(client, user_store):
    token = seed_user(user_store)
    await client.post("/v1/diary/entries", json=ENTRY, headers=auth(token))
    await client.post(
        "/v1/diary/entries",
        json={**ENTRY, "title": "Sold wheat", "type": "income", "amount": 5000},
        headers=auth(token),
    )
    resp = await client.get("/v1/diary/entries?type=expense", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["data"][0]["type"] == "expense"


async def test_delete_entry(client, user_store):
    token = seed_user(user_store)
    resp = await client.post("/v1/diary/entries", json=ENTRY, headers=auth(token))
    entry_id = resp.json()["entry"]["id"]
    resp = await client.delete(f"/v1/diary/entries/{entry_id}", headers=auth(token))
    assert resp.status_code == 204
    resp = await client.get("/v1/diary/entries", headers=auth(token))
    assert resp.json()["total"] == 0
    resp = await client.delete(f"/v1/diary/entries/{entry_id}", headers=auth(token))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "ENTRY_NOT_FOUND"


async def test_report_returns_url(client, user_store, monkeypatch):
    from datetime import date

    today = date.today().isoformat()
    token = seed_user(user_store)
    await client.post("/v1/diary/entries", json={**ENTRY, "date": today}, headers=auth(token))
    await client.post(
        "/v1/diary/entries",
        json={**ENTRY, "date": today, "title": "Sold wheat", "type": "income", "amount": 5000},
        headers=auth(token),
    )
    monkeypatch.setattr(
        "app.services.reports.upload_to_storage",
        lambda local_path, dest_path: "https://storage.example/x.pdf",
    )
    resp = await client.get("/v1/diary/report", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["reportUrl"] == "https://storage.example/x.pdf"
    assert body["entryCount"] == 2


async def test_forbidden_for_seller(client, user_store):
    token = seed_user(user_store, active_profile="seller")
    resp = await client.get("/v1/diary/entries", headers=auth(token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"


FAKE_PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32

ANALYTICS_SEED = [
    {"title": "Sold wheat", "category": "sale", "type": "income", "amount": 5000,
     "date": "2026-08-10", "cropName": "Wheat"},
    {"title": "Urea 1 bag", "category": "fertilizer", "type": "expense", "amount": 450,
     "date": "2026-08-12", "cropName": "Wheat"},
    {"title": "Sold rice", "category": "sale", "type": "income", "amount": 3000,
     "date": "2026-09-05", "cropName": "Rice"},
    {"title": "Seed treatment", "category": "seeds", "type": "expense", "amount": 800,
     "date": "2026-09-10", "cropName": "Rice", "quantity": 10, "unit": "kg"},
    {"title": "Irrigation round", "category": "irrigation", "type": "farmActivity", "amount": 0,
     "date": "2026-09-11", "cropName": "Wheat"},
]


async def _seed_entries(client, token, entries):
    for entry in entries:
        resp = await client.post("/v1/diary/entries", json=entry, headers=auth(token))
        assert resp.status_code == 201


async def test_create_entry_accepts_photos_quantity_unit(client, user_store):
    token = seed_user(user_store)
    body = {**ENTRY, "photos": ["https://cdn.example/p1.png"], "quantity": 10, "unit": "kg"}
    resp = await client.post("/v1/diary/entries", json=body, headers=auth(token))
    assert resp.status_code == 201
    entry = resp.json()["entry"]
    assert entry["photos"] == ["https://cdn.example/p1.png"]
    assert entry["quantity"] == 10
    assert entry["unit"] == "kg"
    assert entry["createdAt"]
    assert entry["updatedAt"]


async def test_update_entry(client, user_store):
    token = seed_user(user_store)
    resp = await client.post("/v1/diary/entries", json=ENTRY, headers=auth(token))
    created = resp.json()["entry"]
    resp = await client.put(
        f"/v1/diary/entries/{created['id']}",
        json={**ENTRY, "title": "Urea 2 bags", "amount": 900, "quantity": 2, "unit": "bag"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    entry = resp.json()["entry"]
    assert entry["title"] == "Urea 2 bags"
    assert entry["amount"] == 900
    assert entry["quantity"] == 2
    assert entry["unit"] == "bag"
    assert entry["id"] == created["id"]
    assert entry["createdAt"] == created["createdAt"]
    assert entry["updatedAt"] != created["createdAt"]
    listed = (await client.get("/v1/diary/entries", headers=auth(token))).json()
    assert listed["data"][0]["title"] == "Urea 2 bags"


async def test_update_entry_not_found(client, user_store):
    token = seed_user(user_store)
    resp = await client.put("/v1/diary/entries/missing", json=ENTRY, headers=auth(token))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "ENTRY_NOT_FOUND"


async def test_update_forbidden_for_seller(client, user_store):
    token = seed_user(user_store, active_profile="seller")
    resp = await client.put("/v1/diary/entries/x", json=ENTRY, headers=auth(token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"


async def test_analytics_summary(client, user_store):
    token = seed_user(user_store)
    await _seed_entries(client, token, ANALYTICS_SEED)
    resp = await client.get("/v1/diary/analytics/summary", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["from"] is None
    assert body["to"] is None
    totals = body["totals"]
    assert totals["income"] == 8000
    assert totals["expense"] == 1250
    assert totals["net"] == 6750
    assert totals["entryCount"] == 5
    assert totals["incomeCount"] == 2
    assert totals["expenseCount"] == 2
    assert totals["activityCount"] == 1
    amounts = [c["amount"] for c in body["byCategory"]]
    assert amounts == sorted(amounts, reverse=True)
    sale = next(c for c in body["byCategory"] if c["category"] == "sale")
    assert sale["type"] == "income"
    assert sale["amount"] == 8000
    assert sale["count"] == 2
    crops = {c["cropName"]: c for c in body["byCrop"]}
    assert set(crops) == {"Wheat", "Rice"}
    assert crops["Wheat"]["net"] == 4550
    assert crops["Rice"]["net"] == 2200
    crop_nets = [c["net"] for c in body["byCrop"]]
    assert crop_nets == sorted(crop_nets, reverse=True)
    months = [m["month"] for m in body["byMonth"]]
    assert months == ["2026-08", "2026-09"]
    assert body["byMonth"][0]["income"] == 5000
    assert body["byMonth"][0]["expense"] == 450
    days = {d["date"]: d for d in body["byDay"]}
    assert set(days) == {"2026-08-10", "2026-08-12", "2026-09-05", "2026-09-10"}
    assert days["2026-08-10"]["income"] == 5000
    assert days["2026-08-10"]["count"] == 1


async def test_analytics_respects_from_to(client, user_store):
    token = seed_user(user_store)
    await _seed_entries(client, token, ANALYTICS_SEED)
    resp = await client.get(
        "/v1/diary/analytics/summary?from=2026-09-01&to=2026-09-30",
        headers=auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["from"] == "2026-09-01"
    assert body["to"] == "2026-09-30"
    totals = body["totals"]
    assert totals["income"] == 3000
    assert totals["expense"] == 800
    assert totals["entryCount"] == 3
    assert totals["activityCount"] == 1
    assert [m["month"] for m in body["byMonth"]] == ["2026-09"]


async def test_entries_pagination(client, user_store):
    token = seed_user(user_store)
    for i in range(5):
        await client.post(
            "/v1/diary/entries",
            json={**ENTRY, "title": f"Entry {i}", "date": f"2026-09-0{i + 1}"},
            headers=auth(token),
        )
    resp = await client.get("/v1/diary/entries?page=2&pageSize=2", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["page"] == 2
    assert body["pageSize"] == 2
    assert body["total"] == 5
    assert len(body["data"]) == 2
    assert [e["date"] for e in body["data"]] == ["2026-09-03", "2026-09-02"]
    resp = await client.get("/v1/diary/entries?page=3&pageSize=2", headers=auth(token))
    assert len(resp.json()["data"]) == 1


def _patch_storage(monkeypatch):
    def fake_upload(uid, data, filename, content_type, prefix="vault"):
        return f"{prefix}/{uid}/{filename}", len(data)

    monkeypatch.setattr("app.services.storage.upload_user_file", fake_upload)
    monkeypatch.setattr(
        "app.services.storage.signed_download_url",
        lambda blob_path, minutes=60: f"https://cdn.example/{blob_path}",
    )


async def test_upload_photos(client, user_store, monkeypatch):
    _patch_storage(monkeypatch)
    token = seed_user(user_store)
    resp = await client.post("/v1/diary/entries", json=ENTRY, headers=auth(token))
    entry_id = resp.json()["entry"]["id"]
    resp = await client.post(
        f"/v1/diary/entries/{entry_id}/photos",
        files=[
            ("files", ("a.png", FAKE_PNG, "image/png")),
            ("files", ("b.webp", FAKE_PNG, "image/webp")),
        ],
        headers=auth(token),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert len(body["photoUrls"]) == 2
    assert body["photoUrls"][0].startswith("https://cdn.example/diary/uid-1/")
    assert body["photoUrls"][0].endswith(".png")
    assert body["photoUrls"][1].endswith(".webp")


async def test_upload_photos_too_many(client, user_store, monkeypatch):
    _patch_storage(monkeypatch)
    token = seed_user(user_store)
    resp = await client.post("/v1/diary/entries", json=ENTRY, headers=auth(token))
    entry_id = resp.json()["entry"]["id"]
    resp = await client.post(
        f"/v1/diary/entries/{entry_id}/photos",
        files=[("files", (f"p{i}.png", FAKE_PNG, "image/png")) for i in range(4)],
        headers=auth(token),
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_upload_photos_bad_mime(client, user_store, monkeypatch):
    _patch_storage(monkeypatch)
    token = seed_user(user_store)
    resp = await client.post("/v1/diary/entries", json=ENTRY, headers=auth(token))
    entry_id = resp.json()["entry"]["id"]
    resp = await client.post(
        f"/v1/diary/entries/{entry_id}/photos",
        files=[("files", ("doc.pdf", b"%PDF-1.4", "application/pdf"))],
        headers=auth(token),
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_upload_photos_missing_entry(client, user_store, monkeypatch):
    _patch_storage(monkeypatch)
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/diary/entries/missing/photos",
        files=[("files", ("a.png", FAKE_PNG, "image/png"))],
        headers=auth(token),
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "ENTRY_NOT_FOUND"
