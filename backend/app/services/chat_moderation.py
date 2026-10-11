"""Chat moderation pipeline (WS-01, global rule 4).

Policy decision: violating chat messages are REJECTED with a 422 error
envelope (code CHAT_MODERATION_VIOLATION); they are never stored. Rejections
follow the strike ladder — strike 1 warning, strike 2 = 24h mute, strike >= 3 =
chat suspension pending admin review.

The regex fast-path is a pure function (`scan`) with no Firestore/FastAPI
imports so it is unit-testable in isolation. `needs_guardrail` is the
cost-saving pre-filter deciding whether the M6 `chat.guardrail.v1` model call is
worth making. `strip_exif` removes image metadata before an image message is
stored.
"""
import io
import logging
import re
import uuid
from datetime import datetime, timedelta, timezone

from app.core.db import get_doc, query, set_doc
from app.services.ai import config_store, gateway, privacy

log = logging.getLogger(__name__)

CONTENT_MODERATION_MODULE = "content_moderation"

# Indian mobile: optional +91 / space / dash separators around [6-9]\d{9}, with
# optional single separators between the remaining digits so grouped numbers
# like "98765 43210" are caught.
PHONE_RE = re.compile(r"(?:(?:\+?91[\s-]?)?[6-9](?:[\s-]?\d){9})\b")
# UPI handle: handle@provider
UPI_RE = re.compile(r"[\w.\-]{2,}@[a-z]{2,}", re.IGNORECASE)
# URL: scheme, www., or a bare domain with a common TLD.
URL_RE = re.compile(r"(https?://|www\.|\.(?:com|in|net|org|co)\b)", re.IGNORECASE)

MUTED_HOURS = 24

# Digit words that hint at a spelled-out number (English + Hindi).
_SPELLED_DIGITS = (
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    "एक", "दो", "तीन", "चार", "पाँच", "पांच", "छह", "सात", "आठ", "नौ", "शून्य",
)
# Contact-intent keywords, any script.
_CONTACT_HINTS = (
    "call", "upi", "whatsapp", "कॉल", "यूपीआई", "व्हाट्सएप",
)

GUARDRAIL_MODULE = "chat_guardrail"


def scan(text: str) -> dict:
    """Pure regex fast-path. Returns {"violation": bool, "kind": str | None}.

    `kind` is one of "phone", "upi", "url" (first match wins, checked in that
    order) or None when the text is clean.
    """
    body = text or ""
    if PHONE_RE.search(body):
        return {"violation": True, "kind": "phone"}
    if UPI_RE.search(body):
        return {"violation": True, "kind": "upi"}
    if URL_RE.search(body):
        return {"violation": True, "kind": "url"}
    return {"violation": False, "kind": None}


def needs_guardrail(text: str) -> bool:
    """Cost-saving heuristic pre-filter for the M6 guardrail model call.

    True when the text contains a spelled-out digit word (en/hi) or a
    contact-intent keyword (call / upi / whatsapp, any script).
    """
    lower = (text or "").lower()
    if any(word in lower for word in _CONTACT_HINTS):
        return True
    return any(word in lower for word in _SPELLED_DIGITS)


async def guardrail_enabled() -> bool:
    """Feature-flag gate for the M6 guardrail / image OCR paths."""
    return await config_store.module_enabled(GUARDRAIL_MODULE)


async def guardrail_check(state: dict) -> bool:
    """M6 guardrail for messages the regex missed; takes the prebuilt
    `chat.guardrail.v1` state. True when the model flags contact sharing /
    payment handle / abuse. Never raises for provider problems — the caller
    fail-open path stays in the router."""
    decision = await gateway.decide(
        state, "chat.guardrail.v1", module=GUARDRAIL_MODULE
    )
    answers = decision.answers or {}
    return any(
        bool(answers.get(key))
        for key in ("shares_contact", "shares_payment_handle", "abuse")
    )


async def ocr_scan(image_bytes: bytes) -> str:
    """Visible text in a chat image (vision OCR through the gateway)."""
    ocr = await gateway.analyze_image(
        image_bytes,
        "Extract any visible text from this chat image.",
        module=GUARDRAIL_MODULE,
    )
    return str(ocr.get("text") or ocr.get("extractedText") or "")


async def moderate_ugc(content_type: str, content_id: str, text: str, uid: str) -> None:
    """WS-01 task 1.16 — post-write UGC moderation (suggest level).

    Flagged items are queued for human review; content is never deleted here.
    On any gateway failure the content simply stays un-flagged."""
    state = privacy.build_ugc_moderation_state(text, uid)
    try:
        decision = await gateway.decide(
            state, "content.moderation.v1", module=CONTENT_MODERATION_MODULE
        )
    except Exception as exc:  # noqa: BLE001 — moderation never breaks a write
        log.warning("content moderation unavailable (%s) — content stays", exc)
        return
    answers = decision.answers or {}
    if not answers.get("flag"):
        return
    await set_doc(
        "moderation_queue",
        f"mod_{content_type}_{content_id}",
        {
            "contentType": content_type,
            "contentId": content_id,
            "flag": True,
            "reason": str(answers.get("reason") or "none"),
            "decisionId": decision.decision_id,
            "status": "open",
            "createdAt": datetime.now(timezone.utc).isoformat(),
        },
    )


async def record_strike(uid: str, kind: str, message_id: str | None, room_id: str | None) -> int:
    """Append a strike and apply the ladder. Returns the new strike count."""
    now = datetime.now(timezone.utc)
    strike_id = f"strike_{uuid.uuid4().hex[:12]}"
    await set_doc(
        f"users/{uid}/chat_strikes",
        strike_id,
        {
            "id": strike_id,
            "kind": kind,
            "messageId": message_id,
            "roomId": room_id,
            "createdAt": now.isoformat(),
        },
    )
    strikes = await query(f"users/{uid}/chat_strikes", [], limit=1000)
    count = len(strikes)

    user = await get_doc("users", uid) or {}
    user["chatStrikes"] = count
    if count == 2:
        user["chatMutedUntil"] = (now + timedelta(hours=MUTED_HOURS)).isoformat()
    elif count >= 3:
        user["chatSuspended"] = True
    await set_doc("users", uid, user)
    return count


async def get_strike_state(uid: str) -> dict:
    """Current strike state read from the user doc (defaults 0 / None / False)."""
    user = await get_doc("users", uid) or {}
    return {
        "strikes": int(user.get("chatStrikes") or 0),
        "mutedUntil": user.get("chatMutedUntil"),
        "suspended": bool(user.get("chatSuspended") or False),
    }


def strip_exif(image_bytes: bytes) -> bytes:
    """Rebuild an image without metadata by copying raw pixels into a clean canvas."""
    from PIL import Image

    image = Image.open(io.BytesIO(image_bytes))
    fmt = image.format or "JPEG"
    clean = Image.new(image.mode, image.size)
    clean.putdata(list(image.getdata()))
    out = io.BytesIO()
    clean.save(out, format=fmt)
    return out.getvalue()
