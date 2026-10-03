import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response

from app.core.db import delete_doc, get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.gyan import EnrollIn, QuestionIn
from app.services.coins import InsufficientCoins, award_coins, spend_coins
from app.services.payments import create_razorpay_order
from app.services.users import get_user

router = APIRouter(tags=["gyan"])


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


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("/workshops")
async def list_workshops(page: int = 1, pageSize: int = 20, user: dict = Depends(_user)):
    docs = await query("workshops", [], limit=500)
    enrollments = await query(f"users/{user['id']}/workshop_enrollments", [], limit=500)
    enrolled_ids = {e["workshopId"] for e in enrollments if e.get("status") == "enrolled"}
    docs.sort(key=lambda d: d.get("id", ""))
    for doc in docs:
        doc["isEnrolled"] = doc["id"] in enrolled_ids
    return _envelope(docs, page, pageSize)


@router.post("/workshops/{workshop_id}/enroll")
async def enroll_workshop(
    workshop_id: str,
    body: EnrollIn,
    response: Response,
    user: dict = Depends(_user),
):
    workshop = await get_doc("workshops", workshop_id)
    if workshop is None:
        _error(404, "WORKSHOP_NOT_FOUND", "workshop not found")
    if workshop.get("enrolledCount", 0) >= workshop.get("totalSeats", 0):
        _error(409, "WORKSHOP_FULL", "सीटें भर गईं")
    if await get_doc(f"users/{user['id']}/workshop_enrollments", workshop_id) is not None:
        _error(409, "ALREADY_ENROLLED", "पहले से नामांकित")
    coins = body.coinsToRedeem if body.useCoins else 0
    if body.useCoins:
        if coins <= 0 or coins > workshop["coinsDiscountAllowed"] or coins > workshop["feeRupees"]:
            _error(
                422,
                "INVALID_COIN_AMOUNT",
                "invalid coin redemption amount",
                {"coinsToRedeem": f"must be 1..{min(workshop['coinsDiscountAllowed'], int(workshop['feeRupees']))}"},
            )
        try:
            await spend_coins(user["id"], coins, "workshop_enroll", workshop_id)
        except InsufficientCoins:
            _error(409, "INSUFFICIENT_COINS", "पर्याप्त कॉइन नहीं")
    remaining = workshop["feeRupees"] - coins
    if remaining > 0:
        order = create_razorpay_order(int(remaining * 100), f"ws-{workshop_id}-{user['id'][:8]}")
        await set_doc(
            f"users/{user['id']}/workshop_enrollments",
            workshop_id,
            {
                "id": workshop_id,
                "workshopId": workshop_id,
                "userId": user["id"],
                "status": "awaiting_payment",
                "razorpayOrderId": order["id"],
                "coinsRedeemed": coins,
                "createdAt": _now(),
            },
        )
        return {"enrolled": False, "paymentOrderId": order["id"], "amountDue": remaining}
    await set_doc(
        f"users/{user['id']}/workshop_enrollments",
        workshop_id,
        {
            "id": workshop_id,
            "workshopId": workshop_id,
            "userId": user["id"],
            "status": "enrolled",
            "coinsRedeemed": coins,
            "enrolledAt": _now(),
        },
    )
    workshop["enrolledCount"] = workshop.get("enrolledCount", 0) + 1
    await set_doc("workshops", workshop_id, workshop)
    response.status_code = 201
    return {"enrolled": True}


@router.get("/expert-talks")
async def list_expert_talks(page: int = 1, pageSize: int = 20, user: dict = Depends(_user)):
    docs = await query("expert_talks", [], limit=500)
    docs.sort(key=lambda d: d.get("id", ""))
    return _envelope(docs, page, pageSize)


async def _require_talk(talk_id: str) -> dict:
    talk = await get_doc("expert_talks", talk_id)
    if talk is None:
        _error(404, "TALK_NOT_FOUND", "expert talk not found")
    return talk


@router.post("/expert-talks/{talk_id}/register")
async def register_talk(talk_id: str, user: dict = Depends(_user)):
    talk = await _require_talk(talk_id)
    if await get_doc(f"users/{user['id']}/talk_registrations", talk_id) is not None:
        _error(409, "ALREADY_REGISTERED", "पहले से पंजीकृत")
    await set_doc(
        f"users/{user['id']}/talk_registrations",
        talk_id,
        {"id": talk_id, "talkId": talk_id, "userId": user["id"], "registeredAt": _now()},
    )
    talk["registeredCount"] = talk.get("registeredCount", 0) + 1
    await set_doc("expert_talks", talk_id, talk)
    await award_coins(user["id"], 25, "expert_talk", talk_id)
    return {"registered": True, "agriCoinsEarned": 25}


@router.post("/expert-talks/{talk_id}/questions", status_code=201)
async def ask_question(talk_id: str, body: QuestionIn, user: dict = Depends(_user)):
    await _require_talk(talk_id)
    question_id = uuid.uuid4().hex
    await set_doc(
        f"expert_talks/{talk_id}/questions",
        question_id,
        {"id": question_id, "userId": user["id"], "question": body.question, "askedAt": _now()},
    )
    return {"asked": True}


@router.get("/videos")
async def list_videos(
    category: str | None = None,
    page: int = 1,
    pageSize: int = 20,
    user: dict = Depends(_user),
):
    docs = await query("videos", [], limit=500)
    if category:
        docs = [d for d in docs if d.get("category") == category]
    docs.sort(key=lambda d: d.get("id", ""))
    return _envelope(docs, page, pageSize)


@router.get("/blogs")
async def list_blogs(
    category: str | None = None,
    page: int = 1,
    pageSize: int = 20,
    user: dict = Depends(_user),
):
    docs = await query("blogs", [], limit=500)
    if category:
        docs = [d for d in docs if d.get("category") == category]
    bookmarks = await query(f"users/{user['id']}/bookmarks", [], limit=500)
    bookmarked_ids = {b["blogId"] for b in bookmarks}
    docs.sort(key=lambda d: d.get("id", ""))
    for doc in docs:
        doc["isBookmarked"] = doc["id"] in bookmarked_ids
    return _envelope(docs, page, pageSize)


async def _require_blog(blog_id: str) -> dict:
    blog = await get_doc("blogs", blog_id)
    if blog is None:
        _error(404, "BLOG_NOT_FOUND", "blog not found")
    return blog


@router.post("/blogs/{blog_id}/bookmark")
async def toggle_bookmark(blog_id: str, user: dict = Depends(_user)):
    await _require_blog(blog_id)
    path = f"users/{user['id']}/bookmarks"
    if await get_doc(path, blog_id) is not None:
        await delete_doc(path, blog_id)
        return {"isBookmarked": False}
    await set_doc(path, blog_id, {"id": blog_id, "blogId": blog_id, "createdAt": _now()})
    return {"isBookmarked": True}


@router.post("/blogs/{blog_id}/like")
async def like_blog(blog_id: str, user: dict = Depends(_user)):
    blog = await _require_blog(blog_id)
    like_path = f"blogs/{blog_id}/likes"
    if await get_doc(like_path, user["id"]) is None:
        await set_doc(like_path, user["id"], {"id": user["id"], "userId": user["id"], "createdAt": _now()})
        blog["likesCount"] = blog.get("likesCount", 0) + 1
        await set_doc("blogs", blog_id, blog)
    return {"likesCount": blog["likesCount"]}
