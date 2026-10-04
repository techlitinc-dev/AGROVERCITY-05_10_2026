from datetime import datetime, timedelta, timezone

from app.routers.purchases import HANDOVER_OTP_MAX_ATTEMPTS
from tests.test_transport import (
    POD,
    _activate,
    _add_vehicle,
    _book,
    _token,
    _verify_vehicle,
)
from tests.test_users import _auth


async def _booked_enroute(client, user_store):
    """Farmer books, transporter (same dual-profile user) accepts and goes enRoute."""
    token = await _token(client)
    booking = (await _book(client, token)).json()
    await _activate(client, token)
    vehicle = await _add_vehicle(client, token)
    _verify_vehicle(user_store, vehicle["id"])
    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/accept",
        json={"vehicleId": vehicle["id"], "vehicleNo": vehicle["registrationNo"]},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    resp = await client.patch(
        f"/v1/transport/bookings/{booking['id']}", json={"status": "enRoute"}, headers=_auth(token)
    )
    assert resp.status_code == 200
    return token, booking


async def test_pod_otp_happy_path_delivers(client, user_store):
    token, booking = await _booked_enroute(client, user_store)

    resp = await client.get(
        f"/v1/transport/bookings/{booking['id']}/pod-otp", headers=_auth(token)
    )
    assert resp.status_code == 200
    otp = resp.json()["otp"]
    assert len(otp) == 6 and otp.isdigit()
    assert resp.json()["expiresAt"]

    wrong = await client.post(
        f"/v1/transport/bookings/{booking['id']}/verify-pod-otp",
        json={"otp": "000000" if otp != "000000" else "000001", **POD},
        headers=_auth(token),
    )
    assert wrong.status_code == 400
    assert wrong.json()["error"]["code"] == "INVALID_OTP"

    ok = await client.post(
        f"/v1/transport/bookings/{booking['id']}/verify-pod-otp",
        json={"otp": otp, **POD},
        headers=_auth(token),
    )
    assert ok.status_code == 200
    delivered = ok.json()
    assert delivered["status"] == "delivered"
    assert delivered["pod"]["otpVerified"] is True
    assert delivered["pod"]["photos"] == POD["podPhotos"]
    assert delivered["pod"]["receiverName"] == POD["receiverName"]

    replay = await client.post(
        f"/v1/transport/bookings/{booking['id']}/verify-pod-otp",
        json={"otp": otp, **POD},
        headers=_auth(token),
    )
    assert replay.status_code == 409
    assert replay.json()["error"]["code"] == "ALREADY_VERIFIED"


async def test_pod_otp_expired_422(client, user_store):
    token, booking = await _booked_enroute(client, user_store)
    otp = (
        await client.get(
            f"/v1/transport/bookings/{booking['id']}/pod-otp", headers=_auth(token)
        )
    ).json()["otp"]

    stored = user_store[f"transport_bookings/{booking['id']}"]
    stored["podOtp"]["expiresAt"] = (
        datetime.now(timezone.utc) - timedelta(minutes=1)
    ).isoformat()

    resp = await client.post(
        f"/v1/transport/bookings/{booking['id']}/verify-pod-otp",
        json={"otp": otp, **POD},
        headers=_auth(token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "OTP_EXPIRED"


async def test_pod_otp_max_attempts_lockout_422(client, user_store):
    token, booking = await _booked_enroute(client, user_store)
    await client.get(f"/v1/transport/bookings/{booking['id']}/pod-otp", headers=_auth(token))

    resp = None
    for _ in range(HANDOVER_OTP_MAX_ATTEMPTS + 1):
        resp = await client.post(
            f"/v1/transport/bookings/{booking['id']}/verify-pod-otp",
            json={"otp": "999999", **POD},
            headers=_auth(token),
        )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "OTP_MAX_ATTEMPTS"
