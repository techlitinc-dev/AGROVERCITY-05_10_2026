"""Produce lot → pickup → delivery linkage (F12): booking create accepts lotId,
persists it, and /users/me/bookings filters by lotId.
"""
from tests.test_lots import LOT_BODY
from tests.test_transport import _auth, _book, _token
from tests.test_users import _register


async def _farmer_token(client):
    resp = await _register(client)
    return resp.json()["accessToken"]


async def _create_lot(client, token, **overrides):
    return await client.post("/v1/market/lots", json={**LOT_BODY, **overrides}, headers=_auth(token))


async def test_booking_with_lot_persists_linkage(client):
    token = await _farmer_token(client)
    lot = (await _create_lot(client, token)).json()
    resp = await _book(client, token, lotId=lot["id"])
    assert resp.status_code == 200
    booking = resp.json()
    assert booking["lotId"] == lot["id"]


async def test_my_bookings_filtered_by_lot_id(client):
    token = await _farmer_token(client)
    lot_a = (await _create_lot(client, token)).json()
    lot_b = (await _create_lot(client, token)).json()
    await _book(client, token, lotId=lot_a["id"])
    await _book(client, token, lotId=lot_b["id"])

    resp = await client.get("/v1/users/me/bookings", params={"lotId": lot_a["id"]}, headers=_auth(token))
    assert resp.status_code == 200
    transport = resp.json()["transport"]
    assert len(transport) == 1
    assert transport[0]["status"] == "requested"
    assert transport[0]["kind"] == "transport"

    # unfiltered list still returns both legs
    resp = await client.get("/v1/users/me/bookings", headers=_auth(token))
    assert len(resp.json()["transport"]) == 2


async def test_booking_with_unknown_lot_404(client):
    token = await _farmer_token(client)
    resp = await _book(client, token, lotId="lot_missing")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "LOT_NOT_FOUND"


async def test_booking_with_closed_lot_409(client):
    token = await _farmer_token(client)
    lot = (await _create_lot(client, token)).json()
    await client.delete(f"/v1/market/lots/{lot['id']}", headers=_auth(token))
    resp = await _book(client, token, lotId=lot["id"])
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "LOT_NOT_OPEN"


async def test_booking_detail_embeds_lot_summary(client):
    token = await _farmer_token(client)
    lot = (await _create_lot(client, token)).json()
    booking = (await _book(client, token, lotId=lot["id"])).json()
    resp = await client.get(f"/v1/transport/bookings/{booking['id']}", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["lot"]["crop"] == lot["crop"]
    assert resp.json()["lot"]["quantityQuintals"] == lot["quantityQuintals"]
