from fastapi import HTTPException

from app.core.db import get_doc, query


async def blocked_pair(a: str, b: str) -> bool:
    # blocking is bidirectional in effect: either direction hides both
    if await get_doc(f"users/{a}/blocks", b) is not None:
        return True
    return await get_doc(f"users/{b}/blocks", a) is not None


async def list_blocked_ids(uid: str) -> set[str]:
    docs = await query(f"users/{uid}/blocks", [], limit=500)
    return {d["id"] for d in docs}


async def hidden_ids(uid: str) -> set[str]:
    """Ids to hide from `uid`: those they blocked AND those who blocked them.

    One query for the viewer's own blocks; the reverse direction is resolved by
    checking each other user's block of the viewer (bounded by the user count,
    one pass). Used by marketplace/deal listing filters.
    """
    hidden = set(await list_blocked_ids(uid))
    users = await query("users", [], limit=2000)
    for user in users:
        other = user.get("id")
        if not other or other == uid or other in hidden:
            continue
        if await get_doc(f"users/{other}/blocks", uid) is not None:
            hidden.add(other)
    return hidden


async def require_unblocked(sender_id: str, recipient_id: str):
    # X2 1:1 chat hook — call before creating a direct message
    if await blocked_pair(sender_id, recipient_id):
        raise HTTPException(
            status_code=403,
            detail={"code": "USER_BLOCKED", "message": "user is blocked", "fieldErrors": {}},
        )
