"""WS-02 notification dispatch tests — per-token FCM, prefs, quiet hours, digest."""
from datetime import datetime, timedelta, timezone

import firebase_admin
import httpx
from firebase_admin import messaging

import app.services.notify as notify
from app.services.ai import config_store
from app.services.notifications import send_fcm_to_user
from app.services.sms import send_sms
from tests.test_diary import seed_user

IST = timezone(timedelta(hours=5, minutes=30))
SHIM_COPY = "[shim] deterministic response — live AI provider not enabled"


def _capture_pushes(monkeypatch) -> list:
    calls: list = []

    async def _fake(uid, title, body, data):
        calls.append({"uid": uid, "title": title, "body": body, "data": data})
        return 1

    monkeypatch.setattr(notify, "push_to_tokens", _fake)
    return calls


def _freeze_local(monkeypatch, hour, minute):
    def _now(user, now=None):
        return datetime(2026, 10, 7, hour, minute, tzinfo=IST)

    monkeypatch.setattr(notify, "user_local_now", _now)


class _Result:
    def __init__(self, error=None):
        self.exception = error


class _Response:
    def __init__(self, responses):
        self.responses = responses


def _fake_multicast(recorder, dead_index=None):
    def _send(message):
        recorder["tokens"] = list(message.tokens)
        recorder["data"] = dict(message.data or {})
        results = []
        for index, _token in enumerate(message.tokens):
            if dead_index is not None and index == dead_index:
                error = Exception("registration-token-not-registered")
                error.code = "registration-token-not-registered"
                results.append(_Result(error))
            else:
                results.append(_Result(None))
        return _Response(results)

    return _send


async def test_per_token_multicast_prunes_dead_token(client, user_store, monkeypatch):
    user_store["users/uid-1/devices/dev-a"] = {"id": "dev-a", "token": "token-a", "platform": "web"}
    user_store["users/uid-1/devices/dev-b"] = {"id": "dev-b", "token": "token-b", "platform": "web"}

    recorder: dict = {}
    monkeypatch.setattr(firebase_admin, "_apps", {"app": object()})
    monkeypatch.setattr(messaging, "send_each_for_multicast", _fake_multicast(recorder, dead_index=1))

    await send_fcm_to_user("uid-1", "Title", "Body", {"type": "trade"})

    assert set(recorder["tokens"]) == {"token-a", "token-b"}  # per-token, no topic
    assert "users/uid-1/devices/dev-b" not in user_store  # dead token pruned
    assert "users/uid-1/devices/dev-a" in user_store


async def test_quiet_hours_table(client, user_store, monkeypatch):
    seed_user(user_store, uid="uid-1")
    pushes = _capture_pushes(monkeypatch)

    for hour, minute in [(22, 0), (23, 59), (3, 0), (6, 15)]:
        _freeze_local(monkeypatch, hour, minute)
        before = len(pushes)
        await notify.notify_user("uid-1", type="offer_received", title="T", body="B")
        assert len(pushes) == before  # non-urgent held during quiet hours
        assert any(k.startswith("notifications_digest/") for k in user_store)

    for hour, minute in [(7, 0), (12, 0)]:
        _freeze_local(monkeypatch, hour, minute)
        before = len(pushes)
        await notify.notify_user("uid-1", type="offer_received", title="T", body="B")
        assert len(pushes) == before + 1

    _freeze_local(monkeypatch, 2, 0)
    before = len(pushes)
    await notify.notify_user("uid-1", type="offer_received", title="T", body="B", urgent=True)
    assert len(pushes) == before + 1  # urgent sends during quiet hours


async def test_preference_filtering(client, user_store, monkeypatch):
    seed_user(user_store, uid="uid-1")
    pushes = _capture_pushes(monkeypatch)

    # Marketing off → no marketing push, but the inbox doc still lands.
    user_store["users/uid-1/notification_prefs/current"] = {"categories": {"marketing": False}}
    await notify.notify_user("uid-1", type="marketing", title="Promo", body="Sale")
    assert len(pushes) == 0
    assert any(k.startswith("notifications/") for k in user_store)

    # Push channel off → inbox only.
    user_store["users/uid-1/notification_prefs/current"] = {"channels": {"push": False}}
    await notify.notify_user("uid-1", type="offer_received", title="Offer", body="X")
    assert len(pushes) == 0


async def test_sms_provider_stub_no_network(client, monkeypatch):
    monkeypatch.delenv("SMS_PROVIDER", raising=False)
    result = await send_sms("+919812345678", "tpl", {"a": 1})
    assert result["provider"] == "stub"

    def _boom(*args, **kwargs):
        raise AssertionError("network call in stub mode")

    monkeypatch.setattr(httpx, "AsyncClient", _boom)
    monkeypatch.setenv("SMS_PROVIDER", "stub")
    result = await send_sms("+919812345678", "tpl", {})
    assert result["provider"] == "stub"


async def test_copy_shim_and_template_fallback(client, user_store, fake_redis, monkeypatch):
    seed_user(user_store, uid="uid-1", language="hi")
    pushes = _capture_pushes(monkeypatch)

    await notify.notify_user("uid-1", type="offer_received", title="Title", body="Static body")
    assert pushes[-1]["body"] == SHIM_COPY  # hi copy from the shim

    await fake_redis.flushall()  # clear the per-(type,lang,day) copy cache

    async def _boom(*args, **kwargs):
        raise RuntimeError("gateway down")

    monkeypatch.setattr(notify.gateway, "generate", _boom)
    await notify.notify_user("uid-1", type="offer_expired", title="Title", body="Static body")
    assert pushes[-1]["body"] == "Static body"  # static template on failure


async def test_digest_batches_three_into_one(client, user_store, monkeypatch):
    sent: list = []

    async def _fake_send(uid, title, body, data):
        sent.append({"uid": uid, "data": data})

    for i in range(3):
        user_store[f"notifications_digest/dig_{i}"] = {
            "id": f"dig_{i}",
            "uid": "uid-1",
            "type": "offer_received",
            "title": "T",
            "body": "B",
            "status": "queued",
            "queuedAt": "2026-10-07T00:00:00+00:00",
        }
    monkeypatch.setattr(notify, "send_fcm_to_user", _fake_send)

    result = await notify.run_notifications_digest()
    assert len(sent) == 1
    assert result["sent"] == 3
    assert all(user_store[f"notifications_digest/dig_{i}"]["status"] == "sent" for i in range(3))


async def test_ai_disabled_still_delivers(client, user_store, monkeypatch):
    seed_user(user_store, uid="uid-1")
    pushes = _capture_pushes(monkeypatch)
    _freeze_local(monkeypatch, 12, 0)  # outside quiet hours

    # Variant 1: shim (default).
    config_store.clear_cache()
    await notify.notify_user("uid-1", type="offer_received", title="T", body="B")
    assert len(pushes) == 1
    assert any(k.startswith("notifications/") for k in user_store)

    # Variant 2: notify module flags off.
    user_store["platform_config/ai"] = {
        "modules": {"notify_timing": False, "notify_copy": False},
        "thresholds": {},
        "automation": {},
    }
    config_store.clear_cache()
    before = len(pushes)
    await notify.notify_user("uid-1", type="offer_received", title="T", body="B")
    assert len(pushes) == before + 1
    config_store.clear_cache()

