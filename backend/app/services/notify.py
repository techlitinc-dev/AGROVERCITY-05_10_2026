"""Trade notification emitter.

Writes an inbox doc per event (web bell + inbox read from this collection)
and publishes an FCM topic ping. Spec C7: in-app inbox is primary; external
pushes are content-free alerts that pull the user back into the app.
"""

import uuid
from datetime import datetime, timezone

import firebase_admin
from firebase_admin import messaging

from app.core.db import set_doc


async def notify_user(
    uid: str,
    *,
    type: str,
    title: str,
    body: str = "",
    path: str | None = None,
) -> None:
    """Emit one notification. `path` is an in-app route the inbox can open."""
    if not uid:
        return
    data: dict = {"type": type}
    if path:
        data["path"] = path
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
    if firebase_admin._apps:
        try:
            await messaging.send_async(
                messaging.Message(
                    topic=f"user_{uid}",
                    notification=messaging.Notification(title=title, body=doc["body"]),
                    data={k: str(v) for k, v in data.items()},
                )
            )
        except Exception:
            pass  # never let a push failure break the trade flow
