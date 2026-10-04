from tests.test_transport import _token
from tests.test_users import _auth

ESTIMATE_BODY = {"vehicleType": "Tata Ace", "distanceKm": 20}
# Tata Ace: base 500 + 35*20 = 1200 before surge.
BASE_PLUS_DISTANCE = 1200.0


async def test_surge_clamped_to_cap_1_5(client):
    token = await _token(client)
    resp = await client.post(
        "/v1/transport/fare-estimate",
        json={**ESTIMATE_BODY, "surgeMultiplier": 2.0},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["surgeMultiplier"] == 1.5
    assert body["totalFare"] == BASE_PLUS_DISTANCE * 1.5
    assert body["breakdown"]["surgeMultiplier"] == 1.5


async def test_surge_below_cap_passes_through(client):
    token = await _token(client)
    resp = await client.post(
        "/v1/transport/fare-estimate",
        json={**ESTIMATE_BODY, "surgeMultiplier": 1.2},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["surgeMultiplier"] == 1.2
    assert body["totalFare"] == round(BASE_PLUS_DISTANCE * 1.2, 2)


async def test_surge_floor_and_default(client):
    token = await _token(client)
    low = await client.post(
        "/v1/transport/fare-estimate",
        json={**ESTIMATE_BODY, "surgeMultiplier": 0.5},
        headers=_auth(token),
    )
    assert low.json()["surgeMultiplier"] == 1.0
    assert low.json()["totalFare"] == BASE_PLUS_DISTANCE

    default = await client.post(
        "/v1/transport/fare-estimate", json=ESTIMATE_BODY, headers=_auth(token)
    )
    assert default.json()["surgeMultiplier"] == 1.0
    assert default.json()["totalFare"] == BASE_PLUS_DISTANCE
