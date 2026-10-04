
"""S2: a posted vyapari rate is editable only within 2 hours of creation;
the edit re-runs the ±25% band check (RATE_OUT_OF_BAND stays untouched)."""
from datetime import datetime, timedelta, timezone

from tests.test_mandi import MANDI_PRICES
from tests.test_users import _auth, _register

MODAL = MANDI_PRICES[0]["modalPrice"]  # 1950 ₹/q tomato at Pimpalgaon Baswant APMC
IN_BAND = round(MODAL * 1.10) / 100     # +10% per-kg, inside ±25%


def _verify_shop_kyc(user_store, uid="uid-1"):
    """stands in for the admin KYC review: the seller shop case is verified."""
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


async def _token(client, user_store):
    resp = await _register(client, profiles=["farmer", "seller"], primaryProfile="seller")
    _verify_shop_kyc(user_store)
    return resp.json()["accessToken"]


async def _post_rate(client, token, **overrides):
    body = {"crop": "Tomato", "ratePerKg": IN_BAND, "mandiName": "Pimpalgaon Baswant APMC"}
    body.update(overrides)
    return await client.post("/v1/seller/rates", json=body, headers=_auth(token))


async def test_edit_inside_window_succeeds(client, user_store):
    for doc in MANDI_PRICES:
        user_store[f"mandi_prices/{doc['id']}"] = doc
    token = await _token(client, user_store)
    rate = (await _post_rate(client, token)).json()

    resp = await client.patch(
        f"/v1/seller/rates/{rate['id']}",
        json={"crop": "Tomato", "ratePerKg": IN_BAND + 1, "mandiName": "Pimpalgaon Baswant APMC"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["ratePerKg"] == IN_BAND + 1
    assert resp.json()["createdAt"] == rate["createdAt"]  # creation timestamp preserved
    assert "updatedAt" in resp.json()


async def test_edit_after_window_422(client, user_store):
    for doc in MANDI_PRICES:
        user_store[f"mandi_prices/{doc['id']}"] = doc
    token = await _token(client, user_store)
    rate = (await _post_rate(client, token)).json()
    user_store[f"vyapari_rates_pending/{rate['id']}"]["createdAt"] = (
        datetime.now(timezone.utc) - timedelta(hours=2, minutes=1)
    ).isoformat()

    resp = await client.patch(
        f"/v1/seller/rates/{rate['id']}",
        json={"crop": "Tomato", "ratePerKg": IN_BAND + 1, "mandiName": "Pimpalgaon Baswant APMC"},
        headers=_auth(token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "RATE_EDIT_WINDOW_CLOSED"
    # rate doc is unchanged
    assert user_store[f"vyapari_rates_pending/{rate['id']}"]["ratePerKg"] == IN_BAND


async def test_edit_out_of_band_still_422(client, user_store):
    for doc in MANDI_PRICES:
        user_store[f"mandi_prices/{doc['id']}"] = doc
    token = await _token(client, user_store)
    rate = (await _post_rate(client, token)).json()

    resp = await client.patch(
        f"/v1/seller/rates/{rate['id']}",
        json={"crop": "Tomato", "ratePerKg": round(MODAL * 2) / 100, "mandiName": "Pimpalgaon Baswant APMC"},
        headers=_auth(token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "RATE_OUT_OF_BAND"
    assert str(MODAL) in resp.json()["error"]["fieldErrors"]["ratePerKg"]


async def test_edit_other_sellers_rate_404(client, user_store):
    for doc in MANDI_PRICES:
        user_store[f"mandi_prices/{doc['id']}"] = doc
    token = await _token(client, user_store)
    rate = (await _post_rate(client, token)).json()
    user_store[f"vyapari_rates_pending/{rate['id']}"]["sellerId"] = "uid-someone-else"

    resp = await client.patch(
        f"/v1/seller/rates/{rate['id']}",
        json={"crop": "Tomato", "ratePerKg": IN_BAND, "mandiName": "Pimpalgaon Baswant APMC"},
        headers=_auth(token),
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "RATE_NOT_FOUND"
