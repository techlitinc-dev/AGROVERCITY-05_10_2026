"""Billing router (WS-05): plans, subscriptions, invoices, usage."""
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core.config import settings
from app.core.db import query, set_doc
from app.core.deps import current_user_id
from app.services import billing
from app.services.users import get_user

router = APIRouter(prefix="/billing", tags=["billing"])


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class SubscribeIn(BaseModel):
    planId: str


@router.get("/plans")
async def get_plans(persona: str | None = Query(None)):
    plans = await billing.list_plans(persona)
    return {"data": plans, "total": len(plans)}


@router.get("/subscription")
async def my_subscription(uid: str = Depends(current_user_id)):
    user = await get_user(uid) or {}
    persona = user.get("activeProfile") or user.get("primaryProfile") or "farmer"
    subscription = await billing.get_subscription(uid)
    plan = await billing.effective_plan(uid, persona)
    limits = plan.get("limits") or {}
    usage = {feature: await billing.usage_count(uid, feature) for feature in limits}
    return {
        "subscription": subscription,
        "plan": plan,
        "usage": usage,
        "gracePeriodDays": settings.billing_grace_period_days,
    }


@router.post("/subscribe", status_code=201)
async def subscribe(body: SubscribeIn, uid: str = Depends(current_user_id)):
    plan = await billing.get_plan(body.planId)
    if plan is None:
        _error(404, "PLAN_NOT_FOUND", "plan not found")
    if plan.get("tier") == "free":
        _error(409, "ALREADY_FREE", "the free tier needs no subscription")

    provider_ref = f"sub_dev_{uuid.uuid4().hex[:10]}"
    if settings.razorpay_key_id:
        provider_ref = f"sub_rzp_{uuid.uuid4().hex[:10]}"
    subscription = {
        "subId": f"sub_{uuid.uuid4().hex[:12]}",
        "userId": uid,
        "planId": plan["planId"],
        "status": "active",
        "provider": "razorpay_sub",
        "providerRef": provider_ref,
        "currentPeriodEnd": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
        "createdAt": _now(),
    }
    await set_doc("subscriptions", subscription["subId"], subscription)
    return subscription


@router.get("/invoices")
async def my_invoices(uid: str = Depends(current_user_id)):
    invoices = await query("invoices", [("userId", "==", uid)], limit=200)
    invoices.sort(key=lambda i: i.get("issuedAt", ""), reverse=True)
    return {"data": invoices, "total": len(invoices)}
