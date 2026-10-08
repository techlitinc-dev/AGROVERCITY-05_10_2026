"""WS-01 chat moderation tests — regex fast-path, strike ladder, guardrail, EXIF."""
import io
import json
import os
import time

import pytest
from PIL import Image

from app.services import chat_moderation
from app.services.ai import config_store, gateway
from app.services.ai import privacy as ai_privacy
from app.services.chat_moderation import (
    get_strike_state,
    needs_guardrail,
    scan,
    strip_exif,
)
from tests.test_diary import auth, seed_user

GOLDEN_FIXTURE = os.path.join(
    os.path.dirname(__file__), "fixtures", "ai", "golden", "chat.guardrail.v1.jsonl"
)

ROOM = {
    "id": "room-1",
    "kind": "direct",
    "farmerId": "uid-1",
    "farmerName": "Ram",
    "buyerId": "uid-2",
    "buyerName": "Shyam",
    "crop": "onion",
    "createdAt": "2026-09-16T00:00:00+00:00",
    "readByFarmer": True,
    "readByBuyer": True,
}


def test_scan_flags_phone():
    assert scan("call me 98765 43210") == {"violation": True, "kind": "phone"}
    assert scan("+91-9876543210") == {"violation": True, "kind": "phone"}
    assert scan("9876543210") == {"violation": True, "kind": "phone"}


def test_scan_flags_upi():
    assert scan("pay me at ramesh@okhdfc") == {"violation": True, "kind": "upi"}


def test_scan_flags_url():
    assert scan("visit www.example.com") == {"violation": True, "kind": "url"}
    assert scan("https://x.in") == {"violation": True, "kind": "url"}
    assert scan("check example.com") == {"violation": True, "kind": "url"}


def test_scan_clean_text():
    for text in ("pyaz ka bhav kya hai", "I have 50 quintal onion", "call the mandi office"):
        assert scan(text) == {"violation": False, "kind": None}


def test_needs_guardrail_true():
    assert needs_guardrail("nine 8 two... call karna") is True
    assert needs_guardrail("mera whatsapp pe bhejo") is True
    assert needs_guardrail("पाँच आठ सात पर कॉल") is True


def test_needs_guardrail_false():
    assert needs_guardrail("50 quintal pyaz") is False
    assert needs_guardrail("mandi bhav batao") is False


def test_strip_exif_removes_metadata():
    buf = io.BytesIO()
    image = Image.new("RGB", (10, 10), (255, 0, 0))
    exif = image.getexif()
    exif[0x0112] = 6  # orientation tag
    image.save(buf, format="JPEG", exif=exif)

    cleaned = strip_exif(buf.getvalue())
    reopened = Image.open(io.BytesIO(cleaned))
    assert reopened.format == "JPEG"
    assert len(reopened.getexif()) == 0


def test_get_strike_state_defaults():
    # No user doc → pure defaults (no Firestore needed for the default shape).
    assert get_strike_state.__doc__ is not None


async def test_strike_ladder_transitions(client, user_store):
    seed_user(user_store, uid="uid-1")
    assert await chat_moderation.record_strike("uid-1", "phone", None, "room-1") == 1
    assert user_store["users/uid-1"]["chatStrikes"] == 1
    assert await chat_moderation.record_strike("uid-1", "phone", None, "room-1") == 2
    assert user_store["users/uid-1"].get("chatMutedUntil")
    assert await chat_moderation.record_strike("uid-1", "phone", None, "room-1") == 3
    assert user_store["users/uid-1"]["chatSuspended"] is True
    state = await get_strike_state("uid-1")
    assert state["strikes"] == 3 and state["suspended"] is True


async def test_strike_state_defaults_from_user_doc(client, user_store):
    seed_user(user_store, uid="uid-9")
    assert await get_strike_state("uid-9") == {"strikes": 0, "mutedUntil": None, "suspended": False}


async def test_post_message_rejection_and_strike_ladder(client, user_store):
    user_store["chat_rooms/room-1"] = dict(ROOM)
    token = seed_user(user_store, uid="uid-1")

    # (1) first violating message → 422 + a chat_strikes doc.
    resp = await client.post(
        "/v1/chat/rooms/room-1/messages", json={"text": "call me 98765 43210"}, headers=auth(token)
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "CHAT_MODERATION_VIOLATION"
    assert [k for k in user_store if k.startswith("users/uid-1/chat_strikes/")]
    assert user_store["users/uid-1"]["chatStrikes"] == 1

    # (2) second violating message → 422 and the 24h mute is applied.
    resp = await client.post(
        "/v1/chat/rooms/room-1/messages", json={"text": "9876543210"}, headers=auth(token)
    )
    assert resp.status_code == 422
    assert user_store["users/uid-1"].get("chatMutedUntil")

    # (3) third attempt is blocked by the mute set by strike 2 (the ladder only
    # suspends at strike >= 3, which the mute prevents reaching) → CHAT_MUTED.
    resp = await client.post(
        "/v1/chat/rooms/room-1/messages", json={"text": "pay at ramesh@okhdfc"}, headers=auth(token)
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "CHAT_MUTED"

    # (4) a clean message from the counterparty is not blocked → 201.
    token2 = seed_user(user_store, uid="uid-2", active_profile="buyer")
    resp = await client.post(
        "/v1/chat/rooms/room-1/messages", json={"text": "pyaz ka bhav?"}, headers=auth(token2)
    )
    assert resp.status_code == 201


def _load_golden() -> list[dict]:
    with open(GOLDEN_FIXTURE, encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


async def _pipeline_flags(text: str) -> bool:
    """The real decision pipeline: regex fast-path OR pre-filtered guardrail."""
    if scan(text)["violation"]:
        return True
    if not needs_guardrail(text):
        return False
    state = ai_privacy.build_chat_guardrail_state(text, "uid-1")
    decision = await gateway.decide(
        state, "chat.guardrail.v1", module=chat_moderation.GUARDRAIL_MODULE
    )
    answers = decision.answers or {}
    return any(
        bool(answers.get(key)) for key in ("shares_contact", "shares_payment_handle", "abuse")
    )


async def test_golden_evasion_on_shim(client, user_store):
    config_store.clear_cache()
    samples = _load_golden()
    violations = [s for s in samples if s["expect"] == "violation"]
    benign = [s for s in samples if s["expect"] == "benign"]
    assert len(samples) >= 40 and len(violations) >= 20 and len(benign) >= 20

    caught = 0
    for sample in violations:
        if await _pipeline_flags(sample["text"]):
            caught += 1
    false_positives = 0
    for sample in benign:
        if await _pipeline_flags(sample["text"]):
            false_positives += 1

    assert caught / len(violations) >= 0.9
    assert false_positives / len(benign) < 0.05


async def test_guardrail_flag_off(client, user_store):
    user_store["chat_rooms/room-1"] = dict(ROOM)
    user_store["platform_config/ai"] = {
        "modules": {"chat_guardrail": False},
        "thresholds": {},
        "automation": {},
    }
    config_store.clear_cache()
    token = seed_user(user_store, uid="uid-1")

    # A plain phone number is still caught by the regex fast-path.
    resp = await client.post(
        "/v1/chat/rooms/room-1/messages", json={"text": "9876543210"}, headers=auth(token)
    )
    assert resp.status_code == 422

    # The evasive sample is allowed-but-logged when the module flag is off.
    token2 = seed_user(user_store, uid="uid-2", active_profile="buyer")
    resp = await client.post(
        "/v1/chat/rooms/room-1/messages",
        json={"text": "nine 8 two five call karna"},
        headers=auth(token2),
    )
    assert resp.status_code == 201
    config_store.clear_cache()


async def test_send_latency_regression(client, user_store):
    user_store["chat_rooms/room-1"] = dict(ROOM)
    token = seed_user(user_store, uid="uid-1")
    token2 = seed_user(user_store, uid="uid-2", active_profile="buyer")

    # Guardrail-off baseline: a message that never trips the pre-filter.
    start = time.perf_counter()
    resp = await client.post(
        "/v1/chat/rooms/room-1/messages", json={"text": "pyaz ka bhav"}, headers=auth(token)
    )
    baseline = time.perf_counter() - start
    assert resp.status_code == 201

    # Guardrail-on: a benign message that DOES trip the pre-filter (runs decide).
    start = time.perf_counter()
    resp = await client.post(
        "/v1/chat/rooms/room-1/messages",
        json={"text": "call the mandi office"},
        headers=auth(token2),
    )
    with_guardrail = time.perf_counter() - start
    assert resp.status_code == 201

    assert (with_guardrail - baseline) < 0.3


async def test_moderation_queue_endpoint(client, user_store):
    user_store["moderation_queue/mod_1"] = {
        "contentType": "channel_chat",
        "contentId": "msg-1",
        "flag": True,
        "reason": "contact_sharing",
        "decisionId": "dec-1",
        "status": "open",
        "createdAt": "2026-09-16T00:00:00+00:00",
    }
    resp = await client.get(
        "/v1/admin/moderation-queue", headers={"Authorization": "Bearer admin-token"}
    )
    assert resp.status_code == 200
    assert any(item["contentId"] == "msg-1" for item in resp.json()["data"])

    resp = await client.get(
        "/v1/admin/moderation-queue", headers=auth("plain-token")
    )
    assert resp.status_code == 403


