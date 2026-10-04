"""features/Vyapari.md probation: a new vyapari is limited to 3 bookings and a
₹50,000 cumulative escrow cap until the Verified trust tier is earned."""
from tests.test_direct_buyer import _lot, _register_buyer, _seed_user
from tests.test_users import _auth, _register

LOT = "lot_prob{}"


async def _vyapari(client):
    resp = await _register(
        client,
        profiles=["seller"],
        primaryProfile="seller",
        roleProfiles={"seller": {"shopName": "New Kirana Mandi"}},
    )
    return resp.json()["accessToken"]


async def _seed_lot(user_store, n, farmer="uid-f1"):
    user_store[f"market_lots/{LOT.format(n)}"] = _lot(
        LOT.format(n), farmer, "Tomato", "2026-09-15T00:00:00+00:00"
    )


async def _buy(client, token, n):
    return await client.post(
        "/v1/purchases", json={"lotId": LOT.format(n)}, headers=_auth(token)
    )


async def _setup(client, user_store, n_lots=5):
    token = await _vyapari(client)
    _seed_user(user_store, "uid-f1", "Ram Patel")
    for n in range(1, n_lots + 1):
        await _seed_lot(user_store, n)
    return token


async def test_fourth_booking_blocked_until_verified(client, user_store):
    token = await _setup(client, user_store)
    for n in (1, 2, 3):
        resp = await _buy(client, token, n)
        assert resp.status_code == 201

    blocked = await _buy(client, token, 4)
    assert blocked.status_code == 403
    assert blocked.json()["error"]["code"] == "PROBATION_BOOKING_CAP"


async def test_cancelled_bookings_free_up_cap(client, user_store):
    token = await _setup(client, user_store)
    purchases = []
    for n in (1, 2, 3):
        resp = await _buy(client, token, n)
        assert resp.status_code == 201
        purchases.append(resp.json()["id"])
    # cancel one — the slot frees
    resp = await client.post(
        f"/v1/purchases/{purchases[2]}/cancel",
        json={"reason": "farmer asked to reschedule"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    resp = await _buy(client, token, 4)
    assert resp.status_code == 201


async def test_escrow_cap_blocks_funding_above_50k(client, user_store):
    token = await _setup(client, user_store)
    # three purchases of ₹20,000 each — funding all three would be ₹60,000
    ids = []
    for n in (1, 2, 3):
        resp = await _buy(client, token, n)
        assert resp.status_code == 201
        ids.append(resp.json()["id"])

    for pid in ids[:2]:
        resp = await client.post(
            f"/v1/purchases/{pid}/escrow/fund",
            json={"method": "upi", "reference": ""},
            headers=_auth(token),
        )
        assert resp.status_code == 200

    blocked = await client.post(
        f"/v1/purchases/{ids[2]}/escrow/fund",
        json={"method": "upi", "reference": ""},
        headers=_auth(token),
    )
    assert blocked.status_code == 403
    assert blocked.json()["error"]["code"] == "PROBATION_ESCROW_CAP"


async def test_verified_vyapari_escapes_caps(client, user_store):
    token = await _setup(client, user_store)
    user_store["users/uid-1"]["vyapariVerified"] = True
    ids = []
    for n in (1, 2, 3, 4):
        resp = await _buy(client, token, n)
        assert resp.status_code == 201
        ids.append(resp.json()["id"])
    # ₹80,000 cumulative escrow — over the probation cap but the tier is earned
    for pid in ids:
        resp = await client.post(
            f"/v1/purchases/{pid}/escrow/fund",
            json={"method": "upi", "reference": ""},
            headers=_auth(token),
        )
        assert resp.status_code == 200


async def test_non_vyapari_buyers_unaffected(client, user_store):
    buyer = (await _register_buyer(client)).json()["accessToken"]
    _seed_user(user_store, "uid-f1", "Ram Patel")
    for n in (1, 2, 3, 4):
        await _seed_lot(user_store, n)
    for n in (1, 2, 3, 4):
        resp = await _buy(client, buyer, n)
        assert resp.status_code == 201


async def _complete_purchase(client, token, farmer_token, n):
    """Full lifecycle to `completed` (advance → pickup → dispatch → deliver → clean QC)."""
    resp = await _buy(client, token, n)
    assert resp.status_code == 201
    pid = resp.json()["id"]
    assert (
        await client.post(
            f"/v1/purchases/{pid}/advance", json={"amount": 5000, "method": "upi"},
            headers=_auth(token),
        )
    ).status_code == 200
    assert (
        await client.post(
            f"/v1/purchases/{pid}/pickup",
            json={"date": "2026-10-10", "vehicleType": "Truck", "address": "Nashik", "notes": ""},
            headers=_auth(farmer_token),
        )
    ).status_code == 200
    assert (await client.post(f"/v1/purchases/{pid}/dispatch", headers=_auth(farmer_token))).status_code == 200
    assert (await client.post(f"/v1/purchases/{pid}/deliver", headers=_auth(token))).status_code == 200
    resp = await client.post(
        f"/v1/purchases/{pid}/qc",
        json={"grade": "A", "acceptedQty": 10, "rejectedQty": 0, "note": ""},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "completed"
    return pid


async def test_verified_tier_awarded_after_third_completed_booking(client, user_store):
    from app.services.tokens import create_access_token

    token = await _setup(client, user_store)
    farmer_token = _seed_user(user_store, "uid-f1", "Ram Patel")

    for n in (1, 2):
        await _complete_purchase(client, token, farmer_token, n)
    assert not user_store["users/uid-1"].get("vyapariVerified")

    await _complete_purchase(client, token, farmer_token, 3)
    assert user_store["users/uid-1"]["vyapariVerified"] is True
    assert "vyapariVerifiedAt" in user_store["users/uid-1"]

    # the earned tier escapes the booking cap (4th booking now allowed)
    resp = await _buy(client, token, 4)
    assert resp.status_code == 201
