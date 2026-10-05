import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from pydantic import BaseModel

from app.core.db import delete_doc, get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.gyan import EnrollIn, QuestionIn
from app.services import idempotency
from app.services.coins import InsufficientCoins, award_coins, spend_coins
from app.services.payments import create_razorpay_order, verify_razorpay_signature
from app.services.tasks import emit_task
from app.services.users import get_user

router = APIRouter(tags=["gyan"])

# X3 one-tap action: every gyan dashboard task deep-links to the Gyan Hub home.
GYAN_DEEP_LINK = "/dashboard/p/gyanHub"


class EnrollVerifyIn(BaseModel):
    """Razorpay checkout callback payload for a paid workshop enrollment."""

    razorpayOrderId: str
    razorpayPaymentId: str
    razorpaySignature: str


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


def _persona(user: dict) -> str:
    return user.get("activeProfile") or "farmer"


async def _emit_workshop_starting(user: dict, workshop: dict) -> None:
    """WS-04 task 4.13 — 'workshop you booked starts at …' (dedupe-safe)."""
    schedule = str(workshop.get("batchDate") or workshop.get("timing") or "")
    await emit_task(
        user["id"],
        persona=_persona(user),
        module="gyan",
        kind="workshop_starting",
        title_en="Your workshop is starting",
        title_hi="आपकी कार्यशाला शुरू हो रही है",
        subtitle=schedule,
        priority="today",
        deep_link=GYAN_DEEP_LINK,
        source_id=str(workshop.get("id") or ""),
    )


async def _emit_new_video_tasks(user: dict, videos: list[dict]) -> None:
    """WS-04 task 4.13 — 'new video in your crop category' (last 7 days).

    Videos without a parseable `createdAt` are skipped (never assume one), so
    the emission is deterministic and dedupe-safe on `sourceId` = video id.
    """
    crops = {
        str(c).strip().lower()
        for c in (user.get("crops") or user.get("activeCrops") or [])
        if str(c).strip()
    }
    if not crops:
        return
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    for video in videos:
        if str(video.get("category", "")).strip().lower() not in crops:
            continue
        try:
            created_at = datetime.fromisoformat(str(video.get("createdAt") or ""))
        except ValueError:
            continue
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        if created_at < cutoff:
            continue
        await emit_task(
            user["id"],
            persona=_persona(user),
            module="gyan",
            kind="new_video",
            title_en="New video in your crop category",
            title_hi="आपकी फसल श्रेणी में नया वीडियो",
            subtitle=str(video.get("title", "")),
            priority="upcoming",
            deep_link=GYAN_DEEP_LINK,
            source_id=str(video.get("id") or ""),
        )


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
        # X11: redemption is capped at min(instructor allowance, fee, % of
        # order). The %-of-order ceiling (default 50) is config-driven.
        cfg = await get_doc("platform_config", "gamification") or {}
        pct = int(cfg.get("redemptionMaxPctOfOrder", 50))
        pct_cap = int(workshop["feeRupees"]) * pct // 100
        max_redeemable = min(
            workshop["coinsDiscountAllowed"], int(workshop["feeRupees"]), pct_cap
        )
        if coins <= 0 or coins > max_redeemable:
            _error(
                422,
                "INVALID_COIN_AMOUNT",
                "invalid coin redemption amount",
                {"coinsToRedeem": f"must be 1..{max_redeemable}"},
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
    # WS-04 task 4.13 — free enrollment is immediately confirmed.
    await _emit_workshop_starting(user, workshop)
    response.status_code = 201
    return {"enrolled": True}


@router.post("/workshops/{workshop_id}/enroll/verify")
async def verify_workshop_enroll(
    workshop_id: str,
    body: EnrollVerifyIn,
    user: dict = Depends(_user),
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
):
    """Razorpay signature verify for a paid workshop enrollment (task 4.1).

    Mirrors courses.py::verify_purchase: flips `awaiting_payment` →
    `enrolled`, increments the workshop's `enrolledCount`, and is idempotent —
    a duplicate verify is a no-op (no double seat count, no stranded
    `awaiting_payment`).
    """
    scope = f"gyan.workshop_enroll.verify.{user['id']}.{workshop_id}"
    stored = await idempotency.replay(scope, idempotency_key)
    if stored is not None:
        return stored

    enrollment = await get_doc(f"users/{user['id']}/workshop_enrollments", workshop_id)
    if enrollment is None or enrollment.get("razorpayOrderId") != body.razorpayOrderId:
        _error(404, "ENROLLMENT_NOT_FOUND", "no enrollment awaiting payment for this order")
    if enrollment.get("status") == "enrolled":
        # Duplicate verify is a no-op — never double the seat count.
        response = {"enrolled": True}
        if idempotency_key:
            await idempotency.store(scope, idempotency_key, response)
        return response
    if not verify_razorpay_signature(
        body.razorpayOrderId, body.razorpayPaymentId, body.razorpaySignature
    ):
        _error(400, "PAYMENT_VERIFICATION_FAILED", "razorpay signature mismatch")

    enrollment["status"] = "enrolled"
    enrollment["razorpayPaymentId"] = body.razorpayPaymentId
    enrollment["enrolledAt"] = _now()
    await set_doc(f"users/{user['id']}/workshop_enrollments", workshop_id, enrollment)

    workshop = await get_doc("workshops", workshop_id)
    if workshop is not None:
        workshop["enrolledCount"] = workshop.get("enrolledCount", 0) + 1
        await set_doc("workshops", workshop_id, workshop)
        # WS-04 task 4.13 — 'workshop you booked starts at …'.
        await _emit_workshop_starting(user, workshop)

    response = {"enrolled": True}
    if idempotency_key:
        await idempotency.store(scope, idempotency_key, response)
    return response


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
    # WS-04 task 4.13 — '+25 coins from expert talk' (dedupe-safe on talk id).
    await emit_task(
        user["id"],
        persona=_persona(user),
        module="gyan",
        kind="coins_earned",
        title_en="+25 AgriCoins from an expert talk",
        title_hi="विशेषज्ञ वार्ता से +25 एग्रीकॉइन",
        subtitle=str(talk.get("topic", "")),
        priority="today",
        deep_link=GYAN_DEEP_LINK,
        source_id=talk_id,
    )
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
    # WS-04 task 4.13 — surface 'new video in your crop category' tasks.
    await _emit_new_video_tasks(user, docs)
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
