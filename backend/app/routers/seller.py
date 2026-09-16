import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import query, set_doc
from app.core.deps import current_user_id
from app.models.mandi import SellerRateRequest
from app.routers.users import require_role
from app.services.users import get_user

router = APIRouter(prefix="/seller", tags=["seller"])


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def _seller_user(uid: str = Depends(current_user_id)) -> tuple[dict, str]:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "seller")
    return user, uid


def _loose_mandi_match(posted: str, actual: str) -> bool:
    words = [w for w in posted.lower().split() if len(w) > 3]
    return any(w in actual.lower() for w in words)


@router.post("/rates")
async def post_rate(body: SellerRateRequest, ctx: tuple = Depends(_seller_user)):
    _, uid = ctx
    per_quintal = body.ratePerKg * 100
    docs = await query("mandi_prices", [], limit=1000)
    matches = [d for d in docs if body.crop.lower() in d.get("commodity", "").lower()]
    reference = next((d for d in matches if _loose_mandi_match(body.mandiName, d.get("mandiName", ""))), None)
    if reference is None and matches:
        reference = matches[0]
    if reference is not None:
        modal = reference["modalPrice"]
        if per_quintal < modal * 0.75 or per_quintal > modal * 1.25:
            _error(
                422,
                "RATE_OUT_OF_BAND",
                "posted rate is outside the sanity band",
                {"ratePerKg": f"मंडी भाव ₹{modal} के ±25% सीमा से बाहर"},
            )
    # No reference for the crop → accept; the coverage gap is handled by the admin moderation queue (Day 14 item A6).
    doc_id = f"rate_{uuid.uuid4().hex[:12]}"
    doc = {
        **body.model_dump(),
        "id": doc_id,
        "sellerId": uid,
        "status": "pending",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("vyapari_rates_pending", doc_id, doc)
    # vyapari_rates:* Redis keys are invalidated only when a rate flips to approved; approval flow is out of scope today.
    return doc


@router.get("/rates/my")
async def my_rates(ctx: tuple = Depends(_seller_user)):
    _, uid = ctx
    docs = await query("vyapari_rates_pending", [("sellerId", "==", uid)])
    return {"data": docs}
