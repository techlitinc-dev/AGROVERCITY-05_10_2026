import pytest

from tests.test_users import _auth, _register

CONTRACTS = [
    {
        "id": "contract-1",
        "buyerCompany": "ITC Agri Business (e-Choupal)",
        "buyerRating": 4.9,
        "crop": "Wheat - Sharbati (शरबती गेहूं)",
        "lockedRateQuintal": 2650,
        "mspCurrentRate": 2425,
        "premiumAboveMSP": "+₹225/Quintal",
        "minQuantityQuintals": 30,
        "deliveryLocation": "ITC Choupal Sagar, Niphad Hub",
        "paymentTerms": "100% Instant Bank DBT within 24 hours of weighing",
        "status": "open",
        "contractDuration": "Pre-Harvest Lock (Delivery: Oct 2026)",
        "termsText": "यह अनुबंध बुवाई से पहले दर लॉक करता है। Payment within 24 hours of weighing.",
        "createdAt": "2026-09-16T00:00:00+00:00",
    },
    {
        "id": "contract-2",
        "buyerCompany": "Reliance Fresh / JioKrishi Retail",
        "buyerRating": 4.8,
        "crop": "Tomato - Grade A (टमाटर)",
        "lockedRateQuintal": 2300,
        "mspCurrentRate": 1800,
        "premiumAboveMSP": "+₹500/Quintal",
        "minQuantityQuintals": 50,
        "deliveryLocation": "Reliance Fresh Collection Center, Pimpalgaon",
        "paymentTerms": "Daily digital settlement via UPI/NEFT",
        "status": "open",
        "contractDuration": "Weekly Harvest Supply",
        "termsText": "यह साप्ताहिक आपूर्ति अनुबंध है। Grade A quality is mandatory.",
        "createdAt": "2026-09-16T00:00:00+00:00",
    },
    {
        "id": "contract-3",
        "buyerCompany": "Mother Dairy / Safal Processing",
        "buyerRating": 4.7,
        "crop": "Red Onion - Export Size 55mm+",
        "lockedRateQuintal": 2450,
        "mspCurrentRate": 2100,
        "premiumAboveMSP": "+₹350/Quintal",
        "minQuantityQuintals": 80,
        "deliveryLocation": "Safal Cold Chain Terminal, Nashik",
        "paymentTerms": "30% Advance at Sowing, 70% at Gate Delivery",
        "status": "accepted",
        "contractDuration": "Full Season Agreement",
        "termsText": "यह पूर्ण सीज़न अनुबंध है। 30% advance at sowing, 70% at gate delivery.",
        "createdAt": "2026-09-16T00:00:00+00:00",
    },
]

ACCEPT_BODY = {
    "signatureData": "aGVsbG8td29ybGQ=",
    "consentTimestamp": "2026-09-16T10:00:00Z",
    "mpin": "1234",
}


@pytest.fixture
def seeded_contracts(user_store):
    for doc in CONTRACTS:
        user_store[f"contracts/{doc['id']}"] = dict(doc)
    return user_store


async def _token(client, **overrides):
    resp = await _register(client, **overrides)
    return resp.json()["accessToken"]


async def test_list_contracts(client, seeded_contracts):
    token = await _token(client)
    resp = await client.get("/v1/contracts", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 3
    assert len(body["data"]) == 3
    resp = await client.get("/v1/contracts", params={"status": "open"}, headers=_auth(token))
    data = resp.json()["data"]
    assert len(data) == 2
    assert all(d["status"] == "open" for d in data)


async def test_detail_includes_terms(client, seeded_contracts):
    token = await _token(client)
    resp = await client.get("/v1/contracts/contract-1", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["buyerCompany"] == "ITC Agri Business (e-Choupal)"
    assert body["termsText"]
    resp = await client.get("/v1/contracts/nope", headers=_auth(token))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "CONTRACT_NOT_FOUND"


async def test_accept_success(client, seeded_contracts, user_store):
    token = await _token(client)
    resp = await client.post("/v1/contracts/contract-1/accept", json=ACCEPT_BODY, headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "status": "accepted", "contractId": "contract-1"}
    assert user_store["contracts/contract-1"]["status"] == "accepted"
    acceptance = user_store["contracts/contract-1/acceptances/uid-1"]
    assert acceptance["signatureData"] == ACCEPT_BODY["signatureData"]
    assert acceptance["consentTimestamp"] == ACCEPT_BODY["consentTimestamp"]


async def test_accept_wrong_mpin(client, seeded_contracts):
    token = await _token(client)
    resp = await client.post(
        "/v1/contracts/contract-1/accept",
        json={**ACCEPT_BODY, "mpin": "9999"},
        headers=_auth(token),
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "WRONG_MPIN"


async def test_accept_already_accepted(client, seeded_contracts):
    token = await _token(client)
    resp = await client.post("/v1/contracts/contract-1/accept", json=ACCEPT_BODY, headers=_auth(token))
    assert resp.status_code == 200
    resp = await client.post("/v1/contracts/contract-1/accept", json=ACCEPT_BODY, headers=_auth(token))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "CONTRACT_NOT_OPEN"


async def test_accept_broker_forbidden(client, seeded_contracts):
    token = await _token(client, profiles=["broker"], primaryProfile="broker")
    resp = await client.post("/v1/contracts/contract-1/accept", json=ACCEPT_BODY, headers=_auth(token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"


def _seed_analytics_store(user_store):
    user_store["contracts/con-a"] = {
        "id": "con-a",
        "buyerId": "uid-1",
        "farmerId": "uid-farmer",
        "crop": "Wheat",
        "status": "active",
        "createdAt": "2026-09-01T00:00:00+00:00",
        "deliveries": [
            {"slotDate": "2026-09-01", "purchaseId": "pur-ontime"},
            {"slotDate": "2026-09-08", "purchaseId": "pur-late"},
            {"slotDate": "2026-09-15", "purchaseId": "pur-pending"},
        ],
        "deliveriesGenerated": 3,
    }
    # Another buyer's contract must not leak into the caller's analytics.
    user_store["contracts/con-b"] = {
        "id": "con-b",
        "buyerId": "uid-2",
        "farmerId": "uid-farmer",
        "crop": "Onion",
        "status": "active",
        "createdAt": "2026-09-01T00:00:00+00:00",
        "deliveries": [{"slotDate": "2026-09-02", "purchaseId": "pur-other"}],
        "deliveriesGenerated": 1,
    }
    user_store["purchases/pur-ontime"] = {
        "id": "pur-ontime",
        "status": "completed",
        "events": [{"status": "completed", "at": "2026-09-01T10:00:00+00:00"}],
    }
    user_store["purchases/pur-late"] = {
        "id": "pur-late",
        "status": "completed",
        "events": [{"status": "completed", "at": "2026-09-12T10:00:00+00:00"}],
    }
    user_store["purchases/pur-pending"] = {
        "id": "pur-pending",
        "status": "confirmed",
        "events": [],
    }
    user_store["purchases/pur-other"] = {
        "id": "pur-other",
        "status": "completed",
        "events": [{"status": "completed", "at": "2026-09-02T10:00:00+00:00"}],
    }


async def test_contract_analytics_computes_fulfilment(client, user_store):
    token = await _token(client, primaryProfile="seller")
    _seed_analytics_store(user_store)
    resp = await client.get("/v1/contracts/analytics", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json() == {
        "fulfillment_pct": 67,
        "on_time_deliveries": 1,
        "total_deliveries": 3,
    }


async def test_contract_analytics_empty(client, user_store):
    token = await _token(client, primaryProfile="seller")
    resp = await client.get("/v1/contracts/analytics", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json() == {
        "fulfillment_pct": 0,
        "on_time_deliveries": 0,
        "total_deliveries": 0,
    }


async def test_contract_analytics_broker_forbidden(client, user_store):
    token = await _token(client, profiles=["broker"], primaryProfile="broker")
    resp = await client.get("/v1/contracts/analytics", headers=_auth(token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"
