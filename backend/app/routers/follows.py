"""Follows & followed profiles + mandi favorites (SR 11, SR 32).

Cross-persona "Saved Items & Followed Profiles" backend:
  - follows:        doc id f"{followerId}_{targetId}" in collection "follows"
  - mandi favorites: doc id f"{uid}_{mandiId}" in collection "mandi_favorites"
    (name/district/state denormalized from the "mandis" doc).
  - commodity watchlist: doc id f"{uid}_{slug}" in collection "commodity_watchlist"
    (the mandi terminal wishlist — commodity-level, prices resolved client-side
    from the Agmarknet live feed so no join is needed here).
"""
import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.db import delete_doc, get_doc, query, set_doc
from app.core.deps import current_user_id
from app.services.users import get_user

router = APIRouter(prefix="", tags=["follows"])


def _error(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": {}},
    )


# ---------------------------------------------------------------- follows

@router.post("/users/{user_id}/follow")
async def follow_user(user_id: str, uid: str = Depends(current_user_id)):
    """Follow another profile (any authenticated user; target must exist)."""
    if user_id == uid:
        _error(400, "CANNOT_FOLLOW_SELF", "you cannot follow yourself")
    target = await get_user(user_id)
    if not target:
        _error(404, "NOT_FOUND", "user not found")
    now = datetime.now(timezone.utc).isoformat()
    await set_doc(
        "follows",
        f"{uid}_{user_id}",
        {"followerId": uid, "targetId": user_id, "createdAt": now},
    )
    return {"status": "following"}


@router.delete("/users/{user_id}/follow")
async def unfollow_user(user_id: str, uid: str = Depends(current_user_id)):
    """Unfollow a profile (idempotent — no error if not following)."""
    await delete_doc("follows", f"{uid}_{user_id}")
    return {"status": "unfollowed"}


@router.get("/users/me/follows")
async def my_follows(uid: str = Depends(current_user_id)):
    """List profiles the current user follows, joined with their user docs."""
    docs = await query("follows", [("followerId", "==", uid)], limit=500)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    items = []
    for doc in docs:
        target_id = doc.get("targetId")
        if not target_id:
            continue
        user = await get_user(target_id)
        if not user:
            continue  # target account gone — skip rather than error the list
        item = {
            "userId": target_id,
            "name": user.get("name") or user.get("vernacularName") or target_id,
            "persona": user.get("activeProfile") or user.get("primaryProfile") or "farmer",
            "since": doc.get("createdAt", ""),
        }
        if user.get("photoUrl"):
            item["photoUrl"] = user["photoUrl"]
        if user.get("rating") is not None:
            item["rating"] = user["rating"]
        items.append(item)
    return {"items": items}


# ---------------------------------------------------------------- mandi favorites

class MandiFavoriteIn(BaseModel):
    mandiId: str
    # Optional denormalization fallback — the "mandis" doc is authoritative.
    name: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None


@router.get("/mandi/favorites")
async def list_mandi_favorites(uid: str = Depends(current_user_id)):
    """List the current user's saved (favorite) mandis."""
    docs = await query("mandi_favorites", [("uid", "==", uid)], limit=500)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    items = [
        {
            "mandiId": d.get("mandiId"),
            "name": d.get("name", "Mandi"),
            "district": d.get("district", ""),
            "state": d.get("state", ""),
            "since": d.get("createdAt", ""),
        }
        for d in docs
        if d.get("mandiId")
    ]
    return {"items": items}


@router.post("/mandi/favorites")
async def add_mandi_favorite(body: MandiFavoriteIn, uid: str = Depends(current_user_id)):
    """Save a mandi as a favorite; name/district/state resolve from the mandis doc."""
    mandi = await get_doc("mandis", body.mandiId)
    if not mandi:
        _error(404, "MANDI_NOT_FOUND", "mandi not found")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "uid": uid,
        "mandiId": body.mandiId,
        "name": mandi.get("name") or body.name or "Mandi",
        "district": mandi.get("district") or body.district or "",
        "state": mandi.get("state") or body.state or "",
        "createdAt": now,
    }
    await set_doc("mandi_favorites", f"{uid}_{body.mandiId}", doc)
    return {"status": "saved", **doc}


@router.delete("/mandi/favorites/{mandi_id}")
async def remove_mandi_favorite(mandi_id: str, uid: str = Depends(current_user_id)):
    """Remove a mandi favorite (idempotent)."""
    await delete_doc("mandi_favorites", f"{uid}_{mandi_id}")
    return {"status": "removed"}


# ---------------------------------------------------------------- commodity watchlist

class CommodityWatchIn(BaseModel):
    commodity: str
    group: Optional[str] = None  # denormalized for display when the live feed is down


def _watch_slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", (name or "").lower()).strip("_") or "unknown"


@router.get("/mandi/watchlist")
async def list_watchlist(uid: str = Depends(current_user_id)):
    """List the current user's commodity watchlist (terminal wishlist)."""
    docs = await query("commodity_watchlist", [("uid", "==", uid)], limit=200)
    docs.sort(key=lambda d: d.get("createdAt", ""))
    items = [
        {
            "commodity": d.get("commodity"),
            "slug": d.get("slug"),
            "group": d.get("group", ""),
            "since": d.get("createdAt", ""),
        }
        for d in docs
        if d.get("commodity")
    ]
    return {"items": items}


@router.post("/mandi/watchlist", status_code=201)
async def add_watchlist(body: CommodityWatchIn, uid: str = Depends(current_user_id)):
    """Pin a commodity to the watchlist (idempotent — same slug overwrites)."""
    commodity = (body.commodity or "").strip()
    if not commodity:
        _error(422, "VALIDATION_ERROR", "commodity is required")
    slug = _watch_slug(commodity)
    doc = {
        "uid": uid,
        "commodity": commodity,
        "slug": slug,
        "group": (body.group or "").strip(),
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("commodity_watchlist", f"{uid}_{slug}", doc)
    return {"status": "saved", **doc}


@router.delete("/mandi/watchlist/{slug}")
async def remove_watchlist(slug: str, uid: str = Depends(current_user_id)):
    """Remove a commodity from the watchlist (idempotent)."""
    await delete_doc("commodity_watchlist", f"{uid}_{slug}")
    return {"status": "removed"}
