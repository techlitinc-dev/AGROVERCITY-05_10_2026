"""Post-harvest farmer face (phase-05 WS-06, §7.14) — grading card + receipts vault.

- the grade endpoint returns a recommended price band in integer paisa with an
  honest vs-mandi delta (M10);
- the warehouse receipts vault lists only the caller's own e-NWR documents.
"""
from tests.test_diary import auth, seed_user

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


async def test_grade_price_band_vs_mandi(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/post-harvest/grade",
        files=[("images", ("lot.png", b"grade:a", "image/png"))],
        data={"crop": "Onion", "mandiModalPaisa": "150000"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    band = resp.json()["priceBandPaisa"]
    assert band["recommendedPaisa"] == 165000
    assert band["lowPaisa"] == 148500
    assert band["highPaisa"] == 181500
    assert band["mandiModalPaisa"] == 150000
    assert band["vsMandiPct"] == 10


async def test_grade_without_mandi_data_has_no_delta(client, user_store):
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/post-harvest/grade",
        files=[("images", ("lot.png", b"grade:a", "image/png"))],
        headers=auth(token),
    )
    assert resp.status_code == 200
    band = resp.json()["priceBandPaisa"]
    assert band["mandiModalPaisa"] is None
    assert band["vsMandiPct"] is None


def _seed_receipt(user_store):
    user_store["users/uid-1/cold_storage_bookings/b-1"] = {
        "id": "b-1",
        "farmerUid": "uid-1",
        "facilityId": "cs-1",
        "receiptNumber": "NWR-TEST-1",
        "status": "inwarded",
    }
    user_store["warehouse_receipts/NWR-TEST-1"] = {
        "receiptNumber": "NWR-TEST-1",
        "bookingId": "b-1",
        "facilityId": "cs-1",
        "facilityName": "Nashik Cold Chain Pvt Ltd",
        "wdraRegNo": "WDRA/MH/NSK/2026/044",
        "depositorName": "किसान",
        "depositorPhone": "",
        "cropName": "Onion",
        "netQuintals": 10.0,
        "bagsCount": 20,
        "qcGrade": "Grade A",
        "chamberName": "Chamber A",
        "lotNumber": "LOT-1",
        "valuationRupees": 22000.0,
        "issueDate": "2026-10-01T00:00:00+00:00",
        "pledgeFinancingEligible": True,
        "status": "active",
    }


async def test_receipts_vault_lists_own_receipts(client, user_store):
    token = seed_user(user_store)
    _seed_receipt(user_store)
    resp = await client.get("/v1/post-harvest/receipts", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["data"][0]["receiptNumber"] == "NWR-TEST-1"
    # Verifiable document — the vault surfaces the collateral-usable flag.
    assert body["data"][0]["pledgeFinancingEligible"] is True


async def test_receipts_vault_empty(client, user_store):
    token = seed_user(user_store)
    resp = await client.get("/v1/post-harvest/receipts", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["data"] == []


async def test_receipts_vault_unauthenticated_401(client):
    resp = await client.get("/v1/post-harvest/receipts")
    assert resp.status_code == 401
