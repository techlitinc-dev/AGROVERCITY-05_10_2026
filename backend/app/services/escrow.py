"""Escrow release clock (WS-03, spec C4).

Handover OTP verification starts the clock (`releaseAt` = now + dispute window,
default 24 h). A dispute opened inside the window pauses the release; the
resolution re-opens it. The nightly job releases holds whose window closed
silently — T+0/T+1 auto-release semantics.
"""
from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.core.db import query, set_doc
from app.routers.purchases import _release_escrow


def _clock_start(hours: int | None = None) -> str:
    window = settings.escrow_dispute_window_hours if hours is None else hours
    return (datetime.now(timezone.utc) + timedelta(hours=window)).isoformat()


def is_paused(escrow: dict) -> bool:
    return bool(escrow.get("disputeOpenedAt")) and not escrow.get("disputeResolvedAt")


def is_due(escrow: dict, now: datetime | None = None) -> bool:
    release_at = escrow.get("releaseAt")
    if not release_at:
        return False
    try:
        due = datetime.fromisoformat(release_at) <= (now or datetime.now(timezone.utc))
    except ValueError:
        return False
    return due and not is_paused(escrow)


async def release_due_escrows() -> dict:
    """Nightly job body: release every held escrow whose window closed."""
    purchases = await query("purchases", [], limit=2000)
    released = paused = pending = 0
    now = datetime.now(timezone.utc)
    for purchase in purchases:
        escrow = purchase.get("escrow") or {}
        if escrow.get("status") != "held":
            continue
        if is_paused(escrow):
            paused += 1
            continue
        if not is_due(escrow, now):
            pending += 1
            continue
        await _release_escrow(purchase)
        purchase["updatedAt"] = datetime.now(timezone.utc).isoformat()
        await set_doc("purchases", purchase["id"], purchase)
        released += 1
    return {"released": released, "paused": paused, "pending": pending}


def start_clock(escrow: dict, hours: int | None = None) -> None:
    escrow["releaseAt"] = _clock_start(hours)
    escrow["disputeWindowHours"] = settings.escrow_dispute_window_hours if hours is None else hours
