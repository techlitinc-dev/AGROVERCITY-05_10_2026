"""Billing router (WS-05): plans, subscriptions, invoices, usage."""
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core.config import settings
from app.core.db import get_doc, query, set_doc
from app.core.deps import admin_user, current_user_id
from app.services import billing
from app.services.users import get_user

router = APIRouter(prefix="/billing", tags=["billing"])
admin_router = APIRouter(prefix="/admin/billing", tags=["billing-admin"])


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


@router.get("/subscriptions")
async def my_subscription_history(uid: str = Depends(current_user_id)):
    """Full subscription history for the caller (newest first) — every
    subscription doc ever created for this user, each with its plan snapshot
    and a derived lifecycle status."""
    docs = await query("subscriptions", [("userId", "==", uid)], limit=100)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    data = []
    for doc in docs:
        plan = await billing.get_plan(doc.get("planId", "")) or billing._matrix_plan(doc.get("planId", ""))
        data.append(
            {
                **doc,
                "plan": plan,
                "status": doc.get("status", "active"),
            }
        )
    current = await billing.get_subscription(uid)
    return {
        "data": data,
        "total": len(data),
        "current": current,
        "currentStatus": (current or {}).get("status", "none"),
    }


@router.post("/subscribe", status_code=201)
async def subscribe(body: SubscribeIn, uid: str = Depends(current_user_id)):
    plan = await billing.get_plan(body.planId)
    if plan is None:
        _error(404, "PLAN_NOT_FOUND", "plan not found")
    if plan.get("tier") == "free":
        _error(409, "ALREADY_FREE", "the free tier needs no subscription")
    # Subscription kill-switch: app_config.subscriptionsEnabled (default on).
    config = await get_doc("app_config", "current") or {}
    if config.get("subscriptionsEnabled", True) is False:
        _error(409, "subscriptions_disabled", "new subscriptions are temporarily disabled")

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
    # WS-09: plan upgrade analytics event (paid-plan conversion).
    await set_doc(
        "analytics_events",
        f"upgrade_{subscription['subId']}",
        {
            "eventId": f"upgrade_{subscription['subId']}",
            "userId": uid,
            "persona": None,
            "name": "plan_upgraded",
            "props": {"plan": plan["planId"]},
            "sessionId": None,
            "clientTs": None,
            "serverTs": _now(),
        },
    )
    return subscription


@router.get("/invoices")
async def my_invoices(uid: str = Depends(current_user_id)):
    invoices = await query("invoices", [("userId", "==", uid)], limit=200)
    invoices.sort(key=lambda i: i.get("issuedAt", ""), reverse=True)
    return {"data": invoices, "total": len(invoices)}


class BillingConfigIn(BaseModel):
    subscriptionsEnabled: bool


@admin_router.get("/config")
async def get_billing_config(_admin: dict = Depends(admin_user)):
    """Kill-switch state for new subscriptions (stored on app_config/current)."""
    config = await get_doc("app_config", "current") or {}
    return {"subscriptionsEnabled": config.get("subscriptionsEnabled", True) is not False}


@admin_router.put("/config")
async def put_billing_config(body: BillingConfigIn, admin: dict = Depends(admin_user)):
    config = await get_doc("app_config", "current") or {"id": "current"}
    previous = config.get("subscriptionsEnabled", True)
    config["subscriptionsEnabled"] = body.subscriptionsEnabled
    await set_doc("app_config", "current", config)
    await set_doc(
        "audit_logs",
        f"aud_billing_config_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        {
            "action": "BILLING_CONFIG_UPDATE",
            "adminId": admin.get("uid") or admin.get("sub") or admin.get("id"),
            "previous": {"subscriptionsEnabled": previous},
            "next": {"subscriptionsEnabled": body.subscriptionsEnabled},
            "at": datetime.now(timezone.utc).isoformat(),
        },
    )
    return {"subscriptionsEnabled": body.subscriptionsEnabled}
