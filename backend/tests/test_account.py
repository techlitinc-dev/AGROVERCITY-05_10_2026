from unittest.mock import AsyncMock, Mock

import firebase_admin.auth as firebase_auth

from app.core.security import hash_mpin
from tests.test_diary import auth, seed_user


def _seed_with_mpin(user_store, uid="uid-1"):
    return seed_user(user_store, uid=uid, mpinHash=hash_mpin("1234"))


async def test_delete_wrong_mpin_401(client, user_store, monkeypatch):
    monkeypatch.setattr(
        "app.routers.users._bump_delete_attempts", AsyncMock(return_value=1)
    )
    token = _seed_with_mpin(user_store)
    resp = await client.request(
        "DELETE", "/v1/users/me", json={"mpin": "9999"}, headers=auth(token)
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "WRONG_MPIN"


async def test_delete_purges_everything(client, user_store, monkeypatch):
    monkeypatch.setattr(
        "app.routers.users._bump_delete_attempts", AsyncMock(return_value=1)
    )
    delete_user = Mock()
    monkeypatch.setattr(firebase_auth, "delete_user", delete_user)
    token = _seed_with_mpin(user_store)
    user_store["users/uid-1/diary_entries/e1"] = {"id": "e1", "title": "Urea"}
    user_store["users/uid-1/devices/d1"] = {"id": "d1", "platform": "android"}
    user_store["transport_bookings/b1"] = {"id": "b1", "userId": "uid-1", "fare": 800}
    resp = await client.request(
        "DELETE", "/v1/users/me", json={"mpin": "1234"}, headers=auth(token)
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["deleted"] is True
    assert body["purged"]["subcollectionsDeleted"] == 2
    assert body["purged"]["financialAnonymized"] == 1
    assert "users/uid-1" not in user_store
    assert "users/uid-1/diary_entries/e1" not in user_store
    assert "users/uid-1/devices/d1" not in user_store
    delete_user.assert_called_once_with("uid-1")
    assert user_store["transport_bookings/b1"]["userId"] == "deleted:uid-1"


async def test_delete_rate_limited_429(client, user_store, monkeypatch):
    token = _seed_with_mpin(user_store)
    attempts = {"n": 0}

    async def fake_bump(uid):
        attempts["n"] += 1
        return attempts["n"]

    monkeypatch.setattr("app.routers.users._bump_delete_attempts", fake_bump)
    for i in range(3):
        resp = await client.request(
            "DELETE", "/v1/users/me", json={"mpin": "9999"}, headers=auth(token)
        )
        assert resp.status_code == 401, f"attempt {i + 1}"
    resp = await client.request(
        "DELETE", "/v1/users/me", json={"mpin": "9999"}, headers=auth(token)
    )
    assert resp.status_code == 429
    assert resp.json()["error"]["code"] == "TOO_MANY_ATTEMPTS"


async def test_register_device_idempotent(client, user_store):
    token = seed_user(user_store)
    payload = {"fcmToken": "fcm-token-abc", "platform": "android"}
    resp = await client.post("/v1/devices", json=payload, headers=auth(token))
    assert resp.status_code == 201
    resp = await client.post("/v1/devices", json=payload, headers=auth(token))
    assert resp.status_code == 201
    devices = [k for k in user_store if k.startswith("users/uid-1/devices/")]
    assert len(devices) == 1
    resp = await client.delete(f"/v1/devices/{devices[0].split('/')[-1]}", headers=auth(token))
    assert resp.status_code == 204
    resp = await client.delete("/v1/devices/unknownhash", headers=auth(token))
    assert resp.status_code == 204
