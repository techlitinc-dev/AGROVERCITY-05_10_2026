import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.db import delete_doc, get_doc, query, set_doc
from app.core.deps import current_user_id
from app.services.notify import notify_user
from app.services.tasks import emit_task
from app.services.users import get_user

router = APIRouter(prefix="/price-alerts", tags=["price-alerts"])

# Deep link into the mandi price-history chart tool (phase-05 WS-01 task 1.9).
MANDI_CHART_DEEP_LINK = "/dashboard/p/mandiCharts"


class PriceAlertCreate(BaseModel):
    crop: str
    targetPrice: float = Field(gt=0)
    above: bool = True


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _mandi_modal(crop: str, mandi_docs: list[dict]) -> float | None:
    matches = [d for d in mandi_docs if crop.lower() in d.get("commodity", "").lower()]
    if not matches:
        return None
    return round(sum(d.get("modalPrice", 0) for d in matches) / len(matches))


def _alert_out(doc: dict, modal: float | None) -> dict:
    return {
        "id": doc["id"],
        "crop": doc["crop"],
        "targetPrice": doc["targetPrice"],
        "above": doc.get("above", True),
        "currentModal": modal,
        "fired": bool(doc.get("firedAt")),
        "createdAt": doc.get("createdAt", ""),
    }


async def _alert_user(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    return uid


@router.get("")
async def list_alerts(uid: str = Depends(_alert_user)):
    docs = await query("price_alerts", [("userId", "==", uid)], limit=500)
    mandi_docs = await query("mandi_prices", [], limit=1000)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    data = []
    for doc in docs:
        modal = _mandi_modal(doc["crop"], mandi_docs)
        if modal is not None and not doc.get("firedAt"):
            crossed = modal >= doc["targetPrice"] if doc.get("above", True) else modal <= doc["targetPrice"]
            if crossed:
                doc["firedAt"] = datetime.now(timezone.utc).isoformat()
                await set_doc("price_alerts", doc["id"], doc)
                try:
                    await notify_user(
                        uid,
                        type="price_alert",
                        title="Price alert / भाव अलर्ट",
                        body=(
                            f"{doc['crop']}: mandi modal ₹{modal} "
                            f"{'≥' if doc.get('above', True) else '≤'} your ₹{doc['targetPrice']}"
                        ),
                        deepLink="/dashboard/p/mandi",
                    )
                except Exception:
                    pass  # notifications are best-effort
                try:
                    user = await get_user(uid)
                    await emit_task(
                        uid,
                        persona=(user or {}).get("activeProfile") or "farmer",
                        module="mandi",
                        kind="price_alert",
                        title_en=f"Price alert: {doc['crop']}",
                        title_hi=f"भाव अलर्ट: {doc['crop']}",
                        subtitle=(
                            f"{doc['crop']}: mandi modal ₹{modal} "
                            f"{'≥' if doc.get('above', True) else '≤'} your ₹{doc['targetPrice']}"
                        ),
                        priority="today",
                        deep_link=MANDI_CHART_DEEP_LINK,
                        source_id=doc["id"],
                    )
                except Exception:
                    pass  # task emission is best-effort
        data.append(_alert_out(doc, modal))
    return {"data": data}


@router.post("", status_code=201)
async def create_alert(body: PriceAlertCreate, uid: str = Depends(_alert_user)):
    mandi_docs = await query("mandi_prices", [], limit=1000)
    modal = _mandi_modal(body.crop, mandi_docs)
    if modal is None:
        _error(422, "VALIDATION_ERROR", "crop has no mandi data", {"crop": "no mandi data for this crop"})
    alert_id = f"pal_{uuid.uuid4().hex[:12]}"
    doc = {
        "id": alert_id,
        "userId": uid,
        "crop": body.crop,
        "targetPrice": body.targetPrice,
        "above": body.above,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("price_alerts", alert_id, doc)
    return _alert_out(doc, modal)


@router.delete("/{alert_id}", status_code=204)
async def delete_alert(alert_id: str, uid: str = Depends(_alert_user)):
    doc = await get_doc("price_alerts", alert_id)
    if doc is None or doc.get("userId") != uid:
        _error(404, "ALERT_NOT_FOUND", "alert not found")
    await delete_doc("price_alerts", alert_id)
