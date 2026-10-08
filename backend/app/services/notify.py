"""Trade notification emitter (WS-02).

Writes an inbox doc per event (web bell + inbox read from this collection) and
sends a per-token push. Dispatch is filtered by the user's notification
preferences (G6), a code-enforced quiet-hours window (21:00–06:30 local), digest
mode, and an AI timing/copy layer (`notify.timing.v1` / `notify.copy.v1`) with
deterministic fallbacks — a notification is never lost when AI is disabled.
"""

import logging
import uuid
from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo

from app.core.cache import cache_get, cache_set
from app.core.db import get_doc, query, set_doc
from app.services.ai import gateway, privacy
from app.services.notifications import push_to_tokens, send_fcm_to_user
from app.services.sms import get_template_id, send_sms

log = logging.getLogger(__name__)

NOTIFY_TIMING_MODULE = "notify_timing"
NOTIFY_COPY_MODULE = "notify_copy"

INBOX_DEEP_LINK = "/dashboard/p/notifications"

# Default in-app route per notification type. Mirrors the strings the phase-01
# task engine emits for the same action; notify_user falls back to this map when
# the caller passes no explicit deepLink.
DEEP_LINKS: dict[str, str] = {
    "booking_confirmed": "/dashboard/p/purchases",
    "booking_cancelled": "/dashboard/p/purchases",
    "chat_message": "/dashboard/p/chats",
    "chat_unlocked": "/dashboard/p/chats",
    "damage_dispute_opened": "/dashboard/p/equipment/claims",
    "deal_completed": "/dashboard/p/farmer/deals",
    "deal_offer_expired": "/dashboard/p/farmer/deals",
    "deal_counter_offer": "/dashboard/p/farmer/deals",
    "deal_accepted": "/dashboard/p/farmer/deals",
    "deal_offer_received": "/dashboard/p/farmer/deals",
    "deal_contract_issued": "/dashboard/p/myContracts",
    "deal_in_transit": "/dashboard/p/farmer/deals",
    "delivered": "/dashboard/p/purchases",
    "dispatched": "/dashboard/p/transport/trips",
    "dispute_resolved": "/dashboard/p/equipment/claims",
    "escrow_funded": "/dashboard/p/purchases",
    "handover_verified": "/dashboard/p/purchases",
    "kyc_expiring": "/dashboard/profile",
    "offer_countered": "/dashboard/p/myOffers",
    "offer_expired": "/dashboard/p/myOffers",
    "offer_received": "/dashboard/p/myOffers",
    "offer_rejected": "/dashboard/p/myOffers",
    "offer_withdrawn": "/dashboard/p/myOffers",
    "payment_received": "/dashboard/p/purchases",
    "pickup_scheduled": "/dashboard/p/transport/trips",
    "price_alert": "/dashboard/p/mandi",
    "qc_disputed": "/dashboard/p/purchases",
    "rated": "/dashboard/profile",
    "trip_delivered": "/dashboard/p/transport/trips",
    "trip_enroute": "/dashboard/p/transport/trips",
    "trip_milestone": "/dashboard/p/transport/trips",
    "weighbridge_recorded": "/dashboard/p/purchases",
    "contract_offer_received": "/dashboard/p/myContracts",
    "contract_cancelled": "/dashboard/p/myContracts",
    "contract_declined": "/dashboard/p/myContracts",
    "contract_accepted": "/dashboard/p/myContracts",
}

# Notification type -> preference category (task 2.9). Default "trade".
TYPE_CATEGORY: dict[str, str] = {
    "chat_message": "social",
    "chat_unlocked": "social",
    "rated": "social",
    "payment_received": "payments",
    "escrow_funded": "payments",
    "marketing": "marketing",
    "promo": "marketing",
}

DEFAULT_PREFS: dict = {
    "categories": {"tasks": True, "trade": True, "payments": True, "social": True, "marketing": True},
    "channels": {"push": True, "sms": True, "inApp": True},
    "quietHoursOverride": False,
    "digestMode": False,
}

QUIET_START = time(21, 0)
QUIET_END = time(6, 30)


def in_quiet_hours(now_local: datetime) -> bool:
    """True between 21:00 and 06:30 local."""
    current = now_local.time()
    return current >= QUIET_START or current < QUIET_END


def user_local_now(user: dict, now: datetime | None = None) -> datetime:
    """Current time in the user's timezone (default Asia/Kolkata)."""
    tz_name = (user or {}).get("timezone") or "Asia/Kolkata"
    try:
        zone = ZoneInfo(tz_name)
    except Exception:  # noqa: BLE001 — unknown timezone falls back
        zone = ZoneInfo("Asia/Kolkata")
    return (now or datetime.now(timezone.utc)).astimezone(zone)


async def get_prefs(uid: str) -> dict:
    doc = await get_doc(f"users/{uid}/notification_prefs", "current") or {}
    return {
        "categories": {**DEFAULT_PREFS["categories"], **(doc.get("categories") or {})},
        "channels": {**DEFAULT_PREFS["channels"], **(doc.get("channels") or {})},
        "quietHoursOverride": bool(doc.get("quietHoursOverride", False)),
        "digestMode": bool(doc.get("digestMode", False)),
    }


async def _timing_decision(uid: str, type: str, user: dict) -> dict:
    """`notify.timing.v1` (suggest) — decides send-now vs channel. Fallback is
    immediate push so AI-off never loses a notification."""
    state = privacy.sanitize_state(
        {
            "user_pseudo_id": privacy.hash_user_id(uid),
            "type": type,
            "local_time": user_local_now(user).strftime("%H:%M"),
        }
    )
    answers = (await gateway.decide(state, "notify.timing.v1", module=NOTIFY_TIMING_MODULE)).answers
    return answers or {"send_now": True, "channel": "push"}


async def _vernacular_copy(type: str, fallback_text: str, lang: str) -> str:
    """`notify.copy.v1` one-liner, cached per (task_type, lang, day)."""
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    key = f"notify_copy:{type}:{lang}:{day}"
    cached = await cache_get(key)
    if cached is not None:
        return cached
    prompt = f"Write a one-line {lang} push notification for a '{type}' event. Base text: {fallback_text}"
    try:
        text = await gateway.generate(
            prompt,
            {"module": NOTIFY_COPY_MODULE, "fallback_text": fallback_text, "language": lang},
        )
    except Exception as exc:  # noqa: BLE001 — copy failure falls back to the static template
        log.warning("notify copy generation failed (%s) — using template", exc)
        text = fallback_text
    text = text or fallback_text
    await cache_set(key, text, 86400)
    return text


async def _enqueue_digest(uid: str, type: str, title: str, body: str, deep_link: str | None) -> None:
    digest_id = f"dig_{uuid.uuid4().hex[:12]}"
    await set_doc(
        "notifications_digest",
        digest_id,
        {
            "id": digest_id,
            "uid": uid,
            "type": type,
            "title": title,
            "body": body,
            "deepLink": deep_link,
            "queuedAt": datetime.now(timezone.utc).isoformat(),
            "status": "queued",
        },
    )


async def run_notifications_digest() -> dict:
    """Drain the digest queue: one summary push per user, then mark items sent."""
    queued = await query("notifications_digest", [("status", "==", "queued")], limit=1000)
    by_uid: dict[str, list[dict]] = {}
    for item in queued:
        by_uid.setdefault(item.get("uid") or "", []).append(item)

    users = 0
    sent = 0
    for uid, items in by_uid.items():
        if not uid:
            continue
        count = len(items)
        await send_fcm_to_user(
            uid,
            "Your daily update / आपका दैनिक अपडेट",
            f"{count} updates waiting / {count} अपडेट बाकी",
            {"type": "digest", "deepLink": INBOX_DEEP_LINK, "count": count},
        )
        for item in items:
            item["status"] = "sent"
            await set_doc("notifications_digest", item.get("id"), item)
            sent += 1
        users += 1
    return {"users": users, "queued": len(queued), "sent": sent}


async def notify_user(
    uid: str,
    *,
    type: str,
    title: str,
    body: str = "",
    deepLink: str | None = None,
    urgent: bool = False,
) -> None:
    """Emit one notification. `deepLink` opens the inbox's target action."""
    if not uid:
        return

    user = await get_doc("users", uid) or {}
    prefs = await get_prefs(uid)
    category = TYPE_CATEGORY.get(type, "trade")
    resolved_link = deepLink or DEEP_LINKS.get(type)

    data: dict = {"type": type}
    if resolved_link:
        data["deepLink"] = resolved_link

    lang = user.get("language") or user.get("locale") or "en"
    copy_body = await _vernacular_copy(type, body or title, lang)

    push_allowed = bool(prefs["categories"].get(category, True)) and bool(
        prefs["channels"].get("push", True)
    )
    inapp_allowed = bool(prefs["channels"].get("inApp", True))

    # Hard constraint in code (not the prompt): quiet hours hold non-urgent.
    queued = False
    suppress = False
    channel = "push"
    if not urgent and (in_quiet_hours(user_local_now(user)) and not prefs["quietHoursOverride"]):
        queued = True
    elif not urgent and prefs["digestMode"]:
        queued = True
    elif push_allowed:
        timing = await _timing_decision(uid, type, user)
        channel = str(timing.get("channel") or "push")
        if not timing.get("send_now", True) or channel == "digest":
            queued = True
        elif channel == "skip":
            suppress = True

    if queued:
        await _enqueue_digest(uid, type, title, copy_body, resolved_link)
    elif not suppress and push_allowed:
        if channel == "sms" and prefs["channels"].get("sms", True) and user.get("phone"):
            template_id = await get_template_id(type) or type
            try:
                await send_sms(user["phone"], template_id, {"title": title, "body": copy_body})
            except Exception as exc:  # noqa: BLE001 — SMS failure falls back to push
                log.warning("sms send failed (%s) — falling back to push", exc)
                await push_to_tokens(uid, title, copy_body, data)
        else:
            await push_to_tokens(uid, title, copy_body, data)

    if inapp_allowed:
        doc = {
            "id": f"ntf_{uuid.uuid4().hex[:12]}",
            "userId": uid,
            "title": title,
            "body": body or title,
            "type": type,
            "data": data,
            "read": False,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
        await set_doc("notifications", doc["id"], doc)
