"""Chat persona grouping + voice notes.

The manual pass flagged "all persona chats merged together" and "voice chat not
working". These tests lock in:
- GET /chat/rooms exposes `counterpartyPersona` so the UI groups rooms per persona;
- POST messages accepts `audioUrl` (voice notes) alongside text and images.
"""
from app.services.tokens import create_access_token
from tests.test_diary import auth, seed_user


def _token(uid: str) -> str:
    return create_access_token(uid)

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


async def test_rooms_expose_counterparty_persona(client, user_store):
    seed_user(user_store, uid="uid-1", active_profile="farmer", name="Ram Patil")
    seed_user(user_store, uid="uid-2", active_profile="transporter", name="Shyam Singh")
    user_store["chat_rooms/room-1"] = dict(ROOM)

    resp = await client.get("/v1/chat/rooms", headers=auth(_token("uid-1")))
    assert resp.status_code == 200
    rooms = resp.json()["data"]
    assert rooms[0]["counterpartyPersona"] == "transporter"


async def test_rooms_transport_bucket_overrides_counterparty_profile(client, user_store):
    seed_user(user_store, uid="uid-1", active_profile="farmer", name="Ram Patil")
    seed_user(user_store, uid="uid-2", active_profile="farmer", name="Shyam Singh")
    user_store["chat_rooms/room-t"] = {**ROOM, "id": "room-t", "kind": "transport"}

    resp = await client.get("/v1/chat/rooms", headers=auth(_token("uid-1")))
    room = next(r for r in resp.json()["data"] if r["id"] == "room-t")
    assert room["counterpartyPersona"] == "transport"


async def test_voice_note_message_accepted(client, user_store):
    seed_user(user_store, uid="uid-1", active_profile="farmer", name="Ram Patil")
    seed_user(user_store, uid="uid-2", active_profile="transporter", name="Shyam Singh")
    user_store["chat_rooms/room-1"] = dict(ROOM)

    resp = await client.post(
        "/v1/chat/rooms/room-1/messages",
        json={"audioUrl": "https://cdn.example.com/voice.webm"},
        headers=auth(_token("uid-1")),
    )
    assert resp.status_code == 201
    msg = resp.json()
    assert msg["audioUrl"] == "https://cdn.example.com/voice.webm"
    # Stored under the room's message subcollection.
    stored = user_store[f"chat_rooms/room-1/messages/{msg['id']}"]
    assert stored["audioUrl"].endswith("voice.webm")


async def test_empty_message_still_rejected(client, user_store):
    seed_user(user_store, uid="uid-1", active_profile="farmer", name="Ram Patil")
    seed_user(user_store, uid="uid-2", active_profile="transporter", name="Shyam Singh")
    user_store["chat_rooms/room-1"] = dict(ROOM)

    resp = await client.post(
        "/v1/chat/rooms/room-1/messages",
        json={},
        headers=auth(_token("uid-1")),
    )
    assert resp.status_code == 422
