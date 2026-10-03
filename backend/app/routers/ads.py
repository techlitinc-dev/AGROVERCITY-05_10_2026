import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.db import delete_doc, get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.ads import (
    AdCampaignCreateIn,
    AdCampaignUpdateIn,
    AdPlacement,
)
from app.services.users import get_user

router = APIRouter(prefix="/ads", tags=["ads"])


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def _user(uid: str = Depends(current_user_id)) -> dict:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    return user


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Public Ad Serving & Tracking
# ---------------------------------------------------------------------------
@router.get("/active")
async def list_active_ads(
    placement: AdPlacement | None = None,
    limit: int = 10,
):
    """Public endpoint to fetch active ads for storefront, hero banners, and sidebars."""
    docs = await query("ad_campaigns", [("status", "==", "active")], limit=100)
    if placement:
        target_val = placement.value if hasattr(placement, "value") else str(placement)
        docs = [d for d in docs if d.get("placement") == target_val]

    # Rotate or sort by highest remaining budget or newest
    docs.sort(key=lambda d: d.get("clicks", 0) / max(1, d.get("impressions", 1)), reverse=True)
    return {"data": docs[:limit], "total": len(docs)}


@router.post("/{ad_id}/impression", status_code=200)
async def track_ad_impression(ad_id: str):
    """Track an ad impression."""
    ad = await get_doc("ad_campaigns", ad_id)
    if ad is None:
        _error(404, "AD_NOT_FOUND", "ad campaign not found")

    ad["impressions"] = ad.get("impressions", 0) + 1
    # Cost per thousand impressions (CPM) simulation: 50 paise per impression
    cpm_rate = 0.50
    current_spend = ad.get("spentRupees", 0.0) + cpm_rate
    ad["spentRupees"] = round(current_spend, 2)

    # Check budget expiry
    if ad.get("budgetRupees") and ad["spentRupees"] >= float(ad["budgetRupees"]):
        ad["status"] = "completed"

    await set_doc("ad_campaigns", ad_id, ad)
    return {"status": "ok", "impressions": ad["impressions"]}


@router.post("/{ad_id}/click", status_code=200)
async def track_ad_click(ad_id: str):
    """Track an ad click."""
    ad = await get_doc("ad_campaigns", ad_id)
    if ad is None:
        _error(404, "AD_NOT_FOUND", "ad campaign not found")

    ad["clicks"] = ad.get("clicks", 0) + 1
    # Cost per click (CPC) simulation: ₹2.00 per click
    cpc_rate = 2.00
    current_spend = ad.get("spentRupees", 0.0) + cpc_rate
    ad["spentRupees"] = round(current_spend, 2)

    # Calculate CTR
    impressions = max(1, ad.get("impressions", 1))
    ad["ctrPercent"] = round((ad["clicks"] / impressions) * 100, 2)

    if ad.get("budgetRupees") and ad["spentRupees"] >= float(ad["budgetRupees"]):
        ad["status"] = "completed"

    await set_doc("ad_campaigns", ad_id, ad)
    return {
        "status": "ok",
        "clicks": ad["clicks"],
        "targetUrl": ad.get("targetId"),
        "targetType": ad.get("targetType"),
    }


# ---------------------------------------------------------------------------
# Advertiser / Teacher Ad Campaign Management
# ---------------------------------------------------------------------------
@router.post("", status_code=201)
async def create_ad_campaign(body: AdCampaignCreateIn, user: dict = Depends(_user)):
    ad_id = uuid.uuid4().hex[:14]
    now = _now()
    status = "active" if body.autoActivate else "pending_approval"

    doc = {
        "id": ad_id,
        "advertiserId": user["id"],
        "advertiserName": user.get("name") or "Teacher / Creator",
        "title": body.title,
        "headline": body.headline,
        "description": body.description,
        "bannerUrl": body.bannerUrl,
        "ctaText": body.ctaText,
        "placement": body.placement.value if hasattr(body.placement, "value") else str(body.placement),
        "targetType": body.targetType.value if hasattr(body.targetType, "value") else str(body.targetType),
        "targetId": body.targetId,
        "budgetRupees": float(body.budgetRupees),
        "dailyBudgetRupees": float(body.dailyBudgetRupees),
        "spentRupees": 0.0,
        "startDate": body.startDate or now[:10],
        "endDate": body.endDate or "2026-12-31",
        "status": status,
        "impressions": 0,
        "clicks": 0,
        "ctrPercent": 0.0,
        "createdAt": now,
        "updatedAt": now,
    }
    await set_doc("ad_campaigns", ad_id, doc)
    return doc


@router.get("/mine")
async def list_my_ad_campaigns(user: dict = Depends(_user)):
    docs = await query("ad_campaigns", [("advertiserId", "==", user["id"])], limit=200)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)

    # Calculate overall summary
    total_spent = sum(d.get("spentRupees", 0.0) for d in docs)
    total_impressions = sum(d.get("impressions", 0) for d in docs)
    total_clicks = sum(d.get("clicks", 0) for d in docs)
    overall_ctr = round((total_clicks / max(1, total_impressions)) * 100, 2) if total_impressions else 0.0

    return {
        "data": docs,
        "total": len(docs),
        "summary": {
            "totalCampaigns": len(docs),
            "activeCampaigns": sum(1 for d in docs if d.get("status") == "active"),
            "totalImpressions": total_impressions,
            "totalClicks": total_clicks,
            "overallCtrPercent": overall_ctr,
            "totalSpentRupees": round(total_spent, 2),
        },
    }


@router.get("/{ad_id}")
async def get_ad_campaign(ad_id: str, user: dict = Depends(_user)):
    ad = await get_doc("ad_campaigns", ad_id)
    if ad is None:
        _error(404, "AD_NOT_FOUND", "ad campaign not found")
    if ad["advertiserId"] != user["id"] and not user.get("isAdmin"):
        _error(403, "FORBIDDEN", "not your ad campaign")
    return ad


@router.put("/{ad_id}")
async def update_ad_campaign(ad_id: str, body: AdCampaignUpdateIn, user: dict = Depends(_user)):
    ad = await get_doc("ad_campaigns", ad_id)
    if ad is None:
        _error(404, "AD_NOT_FOUND", "ad campaign not found")
    if ad["advertiserId"] != user["id"] and not user.get("isAdmin"):
        _error(403, "FORBIDDEN", "not your ad campaign")

    fields = body.model_dump(exclude_none=True)
    for key, value in fields.items():
        if hasattr(value, "value"):
            ad[key] = value.value
        else:
            ad[key] = value

    ad["updatedAt"] = _now()
    await set_doc("ad_campaigns", ad_id, ad)
    return ad


@router.delete("/{ad_id}", status_code=204)
async def delete_ad_campaign(ad_id: str, user: dict = Depends(_user)):
    ad = await get_doc("ad_campaigns", ad_id)
    if ad is None:
        _error(404, "AD_NOT_FOUND", "ad campaign not found")
    if ad["advertiserId"] != user["id"] and not user.get("isAdmin"):
        _error(403, "FORBIDDEN", "not your ad campaign")

    await delete_doc("ad_campaigns", ad_id)


@router.get("/{ad_id}/analytics")
async def get_ad_campaign_analytics(ad_id: str, user: dict = Depends(_user)):
    ad = await get_doc("ad_campaigns", ad_id)
    if ad is None:
        _error(404, "AD_NOT_FOUND", "ad campaign not found")
    if ad["advertiserId"] != user["id"] and not user.get("isAdmin"):
        _error(403, "FORBIDDEN", "not your ad campaign")

    impressions = ad.get("impressions", 0)
    clicks = ad.get("clicks", 0)
    ctr = round((clicks / max(1, impressions)) * 100, 2)
    spent = ad.get("spentRupees", 0.0)

    # Generate daily trend breakdown
    return {
        "adId": ad_id,
        "title": ad.get("title"),
        "impressions": impressions,
        "clicks": clicks,
        "ctrPercent": ctr,
        "spentRupees": spent,
        "budgetRupees": ad.get("budgetRupees", 0.0),
        "remainingBudgetRupees": max(0.0, float(ad.get("budgetRupees", 0)) - spent),
        "status": ad.get("status"),
        "dailyBreakdown": [
            {"day": "Day 1", "impressions": int(impressions * 0.2), "clicks": int(clicks * 0.2), "spend": round(spent * 0.2, 2)},
            {"day": "Day 2", "impressions": int(impressions * 0.3), "clicks": int(clicks * 0.3), "spend": round(spent * 0.3, 2)},
            {"day": "Day 3", "impressions": int(impressions * 0.5), "clicks": int(clicks * 0.5), "spend": round(spent * 0.5, 2)},
        ],
    }
