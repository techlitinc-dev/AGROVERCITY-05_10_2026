"""FCM delivery.

Per-token multicast (X4) — one message per registered device token instead of
a per-user topic. Dead tokens are pruned. `send_fcm_to_user` writes the
`notifications` inbox doc (web bell + inbox read from this collection);
`push_to_tokens` is the push-only half reused by the trade emitter
(`services/notify.py`) so it can apply channel filtering without a double
inbox write.
"""
import hashlib
import logging
import uuid
from datetime import datetime, timezone

import firebase_admin
from firebase_admin import messaging

from app.core.db import delete_doc, query, set_doc

log = logging.getLogger(__name__)

_DEAD_TOKEN_MARKERS = ("registration-token-not-registered", "not-registered", "not_registered")


async def push_to_tokens(uid: str, title: str, body: str, data: dict) -> int:
    """Send one multicast message over the user's registered device tokens.

    Returns the number of tokens targeted. Prunes tokens that FCM reports as
    unregistered. A push failure never raises to the caller."""
    devices = await query(f"users/{uid}/devices", [], limit=100)
    token_to_device = {d.get("token"): d for d in devices if d.get("token")}
    tokens = list(token_to_device)
    if not (firebase_admin._apps and tokens):
        return 0
    try:
        response = messaging.send_each_for_multicast(
            messaging.MulticastMessage(
                tokens=tokens,
                notification=messaging.Notification(title=title, body=body),
                data={k: str(v) for k, v in (data or {}).items()},
            )
        )
        for token, result in zip(tokens, response.responses):
            error = getattr(result, "exception", None)
            if error is None:
                continue
            code = str(getattr(error, "code", "") or error).lower()
            if any(marker in code for marker in _DEAD_TOKEN_MARKERS):
                device = token_to_device.get(token) or {}
                device_id = device.get("id") or hashlib.sha256(token.encode()).hexdigest()[:16]
                await delete_doc(f"users/{uid}/devices", device_id)
    except Exception as exc:  # noqa: BLE001 — a push failure never breaks the caller
        log.warning("fcm multicast failed for %s: %s", uid, exc)
    return len(tokens)


async def send_fcm_to_user(uid: str, title: str, body: str, data: dict):
    await push_to_tokens(uid, title, body, data)
    await set_doc(
        "notifications",
        f"ntf_{uuid.uuid4().hex[:12]}",
        {
            "userId": uid,
            "title": title,
            "body": body,
            "data": data,
            "read": False,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        },
    )
