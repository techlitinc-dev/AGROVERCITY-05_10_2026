"""Pickup agents — platform-managed logistics fleet for purchase pickups.

The fleet registry lives in the `pickup_agents` collection; admins manage it
under /v1/admin/pickup-agents (Firebase-admin-token gated via app.core.deps),
and any authenticated user can list the active agents (optionally by area) to
attach one to a purchase pickup (routers/purchases.py).
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.db import get_doc, query, set_doc
from app.core.deps import admin_user, current_user_id

router = APIRouter(prefix="/pickup", tags=["pickup"])
admin_router = APIRouter(prefix="/admin/pickup-agents", tags=["admin-pickup-agents"])


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


class PickupAgentCreateIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=10, max_length=15)
    vehicleType: str = Field(min_length=2, max_length=60)
    vehicleNumber: str = Field(min_length=4, max_length=20)
    areas: list[str] = Field(default_factory=list)


class PickupAgentUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    phone: str | None = Field(default=None, min_length=10, max_length=15)
    vehicleType: str | None = Field(default=None, min_length=2, max_length=60)
    vehicleNumber: str | None = Field(default=None, min_length=4, max_length=20)
    areas: list[str] | None = None
    active: bool | None = None
    rating: float | None = Field(default=None, ge=0, le=5)


@router.get("/agents")
async def list_pickup_agents(area: str | None = None, uid: str = Depends(current_user_id)):
    """Active pickup agents, optionally filtered to one service area."""
    docs = await query("pickup_agents", [("active", "==", True)], limit=500)
    if area:
        needle = area.strip().lower()
        docs = [
            d for d in docs
            if any(needle in (a or "").lower() for a in (d.get("areas") or []))
        ]
    docs.sort(key=lambda d: (d.get("rating") or 0), reverse=True)
    return {"items": docs, "total": len(docs)}


@admin_router.get("")
async def admin_list_pickup_agents(
    active: bool | None = None,
    claims: dict = Depends(admin_user),
):
    docs = await query("pickup_agents", [], limit=1000)
    if active is not None:
        docs = [d for d in docs if bool(d.get("active")) is active]
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return {"items": docs, "total": len(docs)}


@admin_router.post("", status_code=201)
async def admin_create_pickup_agent(
    body: PickupAgentCreateIn,
    claims: dict = Depends(admin_user),
):
    agent_id = f"pa_{uuid.uuid4().hex[:10]}"
    doc = {
        **body.model_dump(),
        "id": agent_id,
        "active": True,
        "rating": 0,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("pickup_agents", agent_id, doc)
    return doc


@admin_router.patch("/{agent_id}")
async def admin_update_pickup_agent(
    agent_id: str,
    body: PickupAgentUpdateIn,
    claims: dict = Depends(admin_user),
):
    doc = await get_doc("pickup_agents", agent_id)
    if doc is None:
        _error(404, "PICKUP_AGENT_NOT_FOUND", "pickup agent not found")
    for key, value in body.model_dump(exclude_none=True).items():
        doc[key] = value
    doc["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("pickup_agents", agent_id, doc)
    return doc
