"""S1: shop KYC gates rate posting and procurement — unverified shop → 403."""
from tests.test_mandi import MANDI_PRICES
from tests.test_users import _auth, _register

RATE_BODY = {"crop": "Tomato", "ratePerKg": 24, "mandiName": "Pimpalgaon Baswant APMC"}
PROCUREMENT_BODY = {
    "farmerName": "Shamrao Pawar",
    "crop": "Onion",
    "grossWeightKg": 1200,
    "tareWeightKg": 150,
    "netWeightQuintals": 10.5,
    "ratePerQuintal": 1800,
}


async def _token(client):
    resp = await _register(client, profiles=["farmer", "seller"], primaryProfile="seller")
    return resp.json()["accessToken"]


def _verify_shop_kyc(user_store, uid="uid-1"):
    user_store[f"kyc_cases/kyc_{uid}_seller"] = {
        "caseId": f"kyc_{uid}_seller",
        "userId": uid,
        "persona": "seller",
        "status": "verified",
        "docs": [
            {"docId": f"kyc_{uid}_seller:apmc_licence", "type": "apmc_licence", "status": "verified"},
            {"docId": f"kyc_{uid}_seller:gst", "type": "gst", "status": "verified"},
        ],
    }


async def test_rate_posting_403_without_shop_kyc(client, user_store):
    for doc in MANDI_PRICES:
        user_store[f"mandi_prices/{doc['id']}"] = doc
    token = await _token(client)

    resp = await client.post("/v1/seller/rates", json=RATE_BODY, headers=_auth(token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "SHOP_KYC_REQUIRED"

    _verify_shop_kyc(user_store)
    resp = await client.post("/v1/seller/rates", json=RATE_BODY, headers=_auth(token))
    assert resp.status_code == 200


async def test_procurement_403_without_shop_kyc(client, user_store):
    token = await _token(client)

    resp = await client.post(
        "/v1/seller/procurement", json=PROCUREMENT_BODY, headers=_auth(token)
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "SHOP_KYC_REQUIRED"

    _verify_shop_kyc(user_store)
    resp = await client.post(
        "/v1/seller/procurement", json=PROCUREMENT_BODY, headers=_auth(token)
    )
    assert resp.status_code == 201


async def test_pending_case_is_not_verified(client, user_store):
    user_store["kyc_cases/kyc_uid-1_seller"] = {
        "caseId": "kyc_uid-1_seller",
        "userId": "uid-1",
        "persona": "seller",
        "status": "pending",
        "docs": [],
    }
    token = await _token(client)
    resp = await client.post(
        "/v1/seller/procurement", json=PROCUREMENT_BODY, headers=_auth(token)
    )
    assert resp.status_code == 403
