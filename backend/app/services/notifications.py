import uuid
from datetime import datetime, timezone

import firebase_admin
from firebase_admin import messaging

from app.core.db import set_doc


async def send_fcm_to_user(uid: str, title: str, body: str, data: dict):
    # token-based FCM lands Day 13; until then we publish to the per-user topic
    if firebase_admin._apps:
        try:
            messaging.send(
                messaging.Message(
                    topic=f"user_{uid}",
                    notification=messaging.Notification(title=title, body=body),
                    data={k: str(v) for k, v in data.items()},
                )
            )
        except Exception:
            pass
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
