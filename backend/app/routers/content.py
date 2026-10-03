import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response

from app.core.cache import REDIS_ERRORS, get_redis
from app.core.db import delete_doc, get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.content import (
    ChannelGiftIn,
    ChannelPinIn,
    ChatMessageIn,
    ChatMessageOut,
    LiveChannelIn,
    LivePollIn,
    LiveQuestionIn,
    PollVoteIn,
)
from app.services import blocks
from app.services.users import get_user

router = APIRouter(tags=["content"])


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def _user(uid: str = Depends(current_user_id)) -> dict:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    return user


def _envelope(docs: list[dict], page: int, page_size: int) -> dict:
    total = len(docs)
    start = (page - 1) * page_size
    return {"data": docs[start:start + page_size], "page": page, "pageSize": page_size, "total": total}


@router.get("/news")
async def list_news(
    category: str | None = None,
    page: int = 1,
    pageSize: int = 20,
    user: dict = Depends(_user),
):
    docs = await query("news", [], limit=1000)
    if category:
        docs = [d for d in docs if d.get("category") == category]
    docs.sort(key=lambda d: (d.get("isBreaking", False), d.get("timestamp", "")), reverse=True)
    return _envelope(docs, page, pageSize)


@router.get("/channels")
async def list_channels(page: int = 1, pageSize: int = 20, user: dict = Depends(_user)):
    docs = await query("channels", [], limit=100)
    docs.sort(key=lambda d: d.get("id", ""))
    redis = await get_redis()
    for channel in docs:
        try:
            viewers = await redis.get(f"channel:{channel['id']}:viewers")
        except REDIS_ERRORS:
            break  # redis down — keep the Firestore seed counts
        if viewers is not None:
            channel["liveViewersCount"] = int(viewers)
    return _envelope(docs, page, pageSize)


@router.post("/channels", status_code=201)
async def create_channel(body: LiveChannelIn, user: dict = Depends(_user)):
    channel_id = f"ch_{uuid.uuid4().hex[:8]}"
    channel_doc = {
        "id": channel_id,
        "channelName": body.channelName,
        "broadcaster": body.broadcaster,
        "programTitle": body.programTitle,
        "currentSpeaker": body.currentSpeaker or user.get("name", "कृषी तज्ज्ञ"),
        "liveViewersCount": 1,
        "isLiveNow": True,
        "category": body.category,
        "streamThumbnail": body.streamThumbnail or "assets/app_icon.png",
        "streamUrl": body.streamUrl,
        "scheduleTime": body.scheduleTime,
        "pinnedAnnouncement": "",
        "isBroadcasterHost": True,
    }
    await set_doc("channels", channel_id, channel_doc)
    return channel_doc


@router.get("/channels/schedule")
async def list_channel_schedules(user: dict = Depends(_user)):
    docs = await query("broadcast_schedules", [], limit=100)
    user_reminders = await query(f"users/{user['id']}/broadcast_reminders", [], limit=100)
    reminded_ids = {r["id"] for r in user_reminders}
    result = []
    for doc in docs:
        item = dict(doc)
        item["hasReminder"] = doc["id"] in reminded_ids
        result.append(item)
    result.sort(key=lambda d: d.get("id", ""))
    return {"data": result, "page": 1, "pageSize": len(result), "total": len(result)}


@router.post("/channels/schedule/{bcast_id}/remind")
async def toggle_broadcast_reminder(bcast_id: str, user: dict = Depends(_user)):
    doc = await get_doc("broadcast_schedules", bcast_id)
    if doc is None:
        _error(404, "BROADCAST_NOT_FOUND", "scheduled broadcast not found")
    rem_path = f"users/{user['id']}/broadcast_reminders"
    existing = await get_doc(rem_path, bcast_id)
    if existing:
        await delete_doc(rem_path, bcast_id)
        count = max(0, doc.get("reminderCount", 1) - 1)
        await set_doc("broadcast_schedules", bcast_id, {**doc, "reminderCount": count})
        return {"broadcastId": bcast_id, "hasReminder": False, "reminderCount": count}
    else:
        await set_doc(rem_path, bcast_id, {"id": bcast_id, "createdAt": datetime.now(timezone.utc).isoformat()})
        count = doc.get("reminderCount", 0) + 1
        await set_doc("broadcast_schedules", bcast_id, {**doc, "reminderCount": count})
        return {"broadcastId": bcast_id, "hasReminder": True, "reminderCount": count}


async def _require_channel(channel_id: str) -> dict:
    channel = await get_doc("channels", channel_id)
    if channel is None:
        _error(404, "CHANNEL_NOT_FOUND", "channel not found")
    return channel


@router.get("/channels/{channel_id}/chat")
async def get_chat(channel_id: str, user: dict = Depends(_user)):
    await _require_channel(channel_id)
    messages = await query(f"channels/{channel_id}/chat", [], limit=500)
    blocked = await blocks.list_blocked_ids(user["id"])
    messages = [m for m in messages if m.get("userId") not in blocked]
    messages.sort(key=lambda m: m.get("sentAt", ""))
    messages = messages[-50:]
    return {"data": messages, "page": 1, "pageSize": 50, "total": len(messages)}


@router.post("/channels/{channel_id}/chat")
async def post_chat(
    channel_id: str,
    body: ChatMessageIn,
    response: Response,
    joined: bool = False,
    left: bool = False,
    user: dict = Depends(_user),
):
    channel = await _require_channel(channel_id)
    redis = await get_redis()
    viewers_key = f"channel:{channel_id}:viewers"
    if joined or left:
        try:
            if joined:
                count = await redis.incr(viewers_key)
            else:
                count = await redis.decr(viewers_key)
                if count < 0:
                    await redis.set(viewers_key, 0)
                    count = 0
        except REDIS_ERRORS:
            count = channel.get("liveViewersCount", 0)
        return {"liveViewersCount": count}
    text = body.text.strip()
    if not text:
        _error(422, "VALIDATION_ERROR", "message text required", {"text": "must not be empty"})
    try:
        allowed = await redis.set(f"ratelimit:chat:{user['id']}:{channel_id}", 1, ex=2, nx=True)
    except REDIS_ERRORS:
        allowed = True
    if not allowed:
        _error(429, "CHAT_RATE_LIMITED", "थोड़ा धीरे भेजें")
    message = ChatMessageOut(
        id=uuid.uuid4().hex,
        userId=user["id"],
        userName=user.get("name", ""),
        text=text,
        sentAt=datetime.now(timezone.utc).isoformat(),
    )
    await set_doc(f"channels/{channel_id}/chat", message.id, message.model_dump())
    response.status_code = 201
    return message


@router.put("/channels/{channel_id}/pin")
async def pin_announcement(channel_id: str, body: ChannelPinIn, user: dict = Depends(_user)):
    channel = await _require_channel(channel_id)
    updated = {**channel, "pinnedAnnouncement": body.pinnedText.strip()}
    await set_doc("channels", channel_id, updated)
    return {"channelId": channel_id, "pinnedAnnouncement": body.pinnedText.strip()}


@router.get("/channels/{channel_id}/polls")
async def list_polls(channel_id: str, user: dict = Depends(_user)):
    await _require_channel(channel_id)
    polls = await query(f"channels/{channel_id}/polls", [], limit=20)
    user_votes = await query(f"users/{user['id']}/channel_poll_votes", [], limit=100)
    user_voted_map = {v["pollId"]: v["optionIndex"] for v in user_votes}
    result = []
    for p in polls:
        poll_copy = dict(p)
        poll_copy["userVotedOption"] = user_voted_map.get(p["id"])
        result.append(poll_copy)
    result.sort(key=lambda p: p.get("createdAt", ""), reverse=True)
    return {"data": result, "page": 1, "pageSize": len(result), "total": len(result)}


@router.post("/channels/{channel_id}/polls", status_code=201)
async def create_poll(channel_id: str, body: LivePollIn, user: dict = Depends(_user)):
    await _require_channel(channel_id)
    poll_id = f"poll_{uuid.uuid4().hex[:8]}"
    poll_doc = {
        "id": poll_id,
        "channelId": channel_id,
        "question": body.question,
        "options": body.options,
        "votes": {str(i): 0 for i in range(len(body.options))},
        "totalVotes": 0,
        "isActive": True,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc(f"channels/{channel_id}/polls", poll_id, poll_doc)
    return poll_doc


@router.post("/channels/{channel_id}/polls/{poll_id}/vote")
async def vote_poll(channel_id: str, poll_id: str, body: PollVoteIn, user: dict = Depends(_user)):
    await _require_channel(channel_id)
    poll = await get_doc(f"channels/{channel_id}/polls", poll_id)
    if poll is None:
        _error(404, "POLL_NOT_FOUND", "poll not found")
    if not poll.get("isActive", True):
        _error(400, "POLL_INACTIVE", "this poll has ended")
    if body.optionIndex >= len(poll.get("options", [])):
        _error(422, "INVALID_OPTION", "option index out of bounds")

    user_vote_path = f"users/{user['id']}/channel_poll_votes"
    existing = await get_doc(user_vote_path, poll_id)
    votes = dict(poll.get("votes", {}))
    idx_str = str(body.optionIndex)

    if existing:
        prev_idx = str(existing.get("optionIndex"))
        if prev_idx != idx_str:
            votes[prev_idx] = max(0, votes.get(prev_idx, 1) - 1)
            votes[idx_str] = votes.get(idx_str, 0) + 1
    else:
        votes[idx_str] = votes.get(idx_str, 0) + 1
        poll["totalVotes"] = poll.get("totalVotes", 0) + 1

    poll["votes"] = votes
    await set_doc(f"channels/{channel_id}/polls", poll_id, poll)
    await set_doc(user_vote_path, poll_id, {"pollId": poll_id, "optionIndex": body.optionIndex})
    res = dict(poll)
    res["userVotedOption"] = body.optionIndex
    return res


@router.get("/channels/{channel_id}/questions")
async def list_questions(channel_id: str, user: dict = Depends(_user)):
    await _require_channel(channel_id)
    questions = await query(f"channels/{channel_id}/questions", [], limit=100)
    user_upvotes = await query(f"users/{user['id']}/question_upvotes", [], limit=100)
    upvoted_ids = {u["id"] for u in user_upvotes}
    res = []
    for q in questions:
        item = dict(q)
        item["userHasUpvoted"] = q["id"] in upvoted_ids
        res.append(item)
    res.sort(key=lambda q: (not q.get("isAnswered", False), q.get("upvotesCount", 0)), reverse=True)
    return {"data": res, "page": 1, "pageSize": len(res), "total": len(res)}


@router.post("/channels/{channel_id}/questions", status_code=201)
async def ask_question(channel_id: str, body: LiveQuestionIn, user: dict = Depends(_user)):
    await _require_channel(channel_id)
    q_id = f"q_{uuid.uuid4().hex[:8]}"
    now_iso = datetime.now(timezone.utc).isoformat()
    q_doc = {
        "id": q_id,
        "channelId": channel_id,
        "userId": user["id"],
        "userName": user.get("name", "शेतकरी"),
        "questionText": body.questionText.strip(),
        "upvotesCount": 1,
        "isAnswered": False,
        "createdAt": now_iso,
    }
    await set_doc(f"channels/{channel_id}/questions", q_id, q_doc)
    await set_doc(f"users/{user['id']}/question_upvotes", q_id, {"id": q_id})
    res = dict(q_doc)
    res["userHasUpvoted"] = True
    return res


@router.post("/channels/{channel_id}/questions/{q_id}/upvote")
async def upvote_question(channel_id: str, q_id: str, user: dict = Depends(_user)):
    await _require_channel(channel_id)
    q_doc = await get_doc(f"channels/{channel_id}/questions", q_id)
    if q_doc is None:
        _error(404, "QUESTION_NOT_FOUND", "question not found")
    upvote_path = f"users/{user['id']}/question_upvotes"
    existing = await get_doc(upvote_path, q_id)
    if existing:
        await delete_doc(upvote_path, q_id)
        count = max(0, q_doc.get("upvotesCount", 1) - 1)
        has_upvoted = False
    else:
        await set_doc(upvote_path, q_id, {"id": q_id})
        count = q_doc.get("upvotesCount", 0) + 1
        has_upvoted = True
    updated = {**q_doc, "upvotesCount": count}
    await set_doc(f"channels/{channel_id}/questions", q_id, updated)
    return {"questionId": q_id, "upvotesCount": count, "userHasUpvoted": has_upvoted}


@router.put("/channels/{channel_id}/questions/{q_id}/answer")
async def answer_question(channel_id: str, q_id: str, user: dict = Depends(_user)):
    await _require_channel(channel_id)
    q_doc = await get_doc(f"channels/{channel_id}/questions", q_id)
    if q_doc is None:
        _error(404, "QUESTION_NOT_FOUND", "question not found")
    updated = {**q_doc, "isAnswered": True}
    await set_doc(f"channels/{channel_id}/questions", q_id, updated)
    return updated


@router.post("/channels/{channel_id}/gift", status_code=201)
async def send_gift(channel_id: str, body: ChannelGiftIn, user: dict = Depends(_user)):
    channel = await _require_channel(channel_id)
    gift_names = {
        "green_sprout": "हिरवे रोप (Green Sprout 🌱)",
        "golden_wheat": "सोनेरी गहू (Golden Wheat 🌾)",
        "tractor_salute": "ट्रॅक्टर सलामी (Tractor Salute 🚜)",
    }
    gift_label = gift_names.get(body.giftType, "AgriCoin Gift 🎁")
    gift_id = f"gift_{uuid.uuid4().hex[:8]}"
    now_iso = datetime.now(timezone.utc).isoformat()
    gift_doc = {
        "id": gift_id,
        "channelId": channel_id,
        "userId": user["id"],
        "userName": user.get("name", "शेतकरी"),
        "giftType": body.giftType,
        "giftLabel": gift_label,
        "coins": body.coins,
        "note": body.note,
        "sentAt": now_iso,
    }
    await set_doc(f"channels/{channel_id}/gifts", gift_id, gift_doc)

    chat_msg = ChatMessageOut(
        id=uuid.uuid4().hex,
        userId=user["id"],
        userName=user.get("name", "शेतकरी"),
        text=f"🎁 {gift_label} भेट दिली ({body.coins} नाणी)! {body.note}".strip(),
        sentAt=now_iso,
    )
    await set_doc(f"channels/{channel_id}/chat", chat_msg.id, chat_msg.model_dump())
    return gift_doc

