import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.lots import LotRequest, LotOut
from app.routers.users import require_role
from app.services.users import get_user

router = APIRouter(prefix="/market", tags=["lots"])


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def _farmer_user(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer")
    return uid


def _validate_lot(body: LotRequest):
    if body.quantityQuintals <= 0:
        _error(422, "VALIDATION_ERROR", "invalid lot", {"quantityQuintals": "must be greater than 0"})
    if body.expectedRate < 0:
        _error(422, "VALIDATION_ERROR", "invalid lot", {"expectedRate": "must be 0 or more"})


@router.post("/lots", status_code=201, response_model=LotOut)
async def create_lot(body: LotRequest, uid: str = Depends(_farmer_user)):
    _validate_lot(body)
    doc = {
        **body.model_dump(),
        "id": f"lot_{uuid.uuid4().hex[:12]}",
        "farmerId": uid,
        "status": "open",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("market_lots", doc["id"], doc)
    return doc


@router.get("/lots")
async def list_lots(
    status: str | None = None,
    page: int = 1,
    pageSize: int = 20,
    uid: str = Depends(_farmer_user),
):
    docs = await query("market_lots", [("farmerId", "==", uid)], limit=1000)
    if status:
        docs = [d for d in docs if d.get("status") == status]
    total = len(docs)
    start = (page - 1) * pageSize
    return {"data": docs[start:start + pageSize], "page": page, "pageSize": pageSize, "total": total}


@router.get("/lots/browse")
async def browse_lots(
    crop: str | None = None,
    state: str | None = None,
    minRate: float | None = None,
    maxRate: float | None = None,
    minQty: float | None = None,
    harvestBefore: str | None = None,
    sort: str = "newest",
    page: int = 1,
    pageSize: int = 20,
    uid: str = Depends(current_user_id),
):
    """Open discovery for buyers (any authenticated user) — spec V3."""
    docs = await query("market_lots", [("status", "==", "open")], limit=1000)
    docs = [d for d in docs if d.get("farmerId") != uid]
    if crop:
        docs = [d for d in docs if crop.lower() in d.get("crop", "").lower()]
    if state:
        docs = [d for d in docs if (d.get("location") or {}).get("state", "").lower() == state.lower()]
    if minRate is not None:
        docs = [d for d in docs if d.get("expectedRate", 0) >= minRate]
    if maxRate is not None:
        docs = [d for d in docs if d.get("expectedRate", 0) <= maxRate]
    if minQty is not None:
        docs = [d for d in docs if d.get("quantityQuintals", 0) >= minQty]
    if harvestBefore:
        docs = [d for d in docs if d.get("harvestDate", "") <= harvestBefore]
    if sort == "price":
        docs.sort(key=lambda d: d.get("expectedRate", 0))
    elif sort == "ready-date":
        docs.sort(key=lambda d: d.get("harvestDate", ""))
    else:
        docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    total = len(docs)
    start = (page - 1) * pageSize
    page_docs = docs[start:start + pageSize]
    # Anonymity per spec G1/G2: first name + village only, never phone/contact.
    enriched = []
    for lot in page_docs:
        farmer = await get_doc("users", lot.get("farmerId", "")) or {}
        name = (farmer.get("name") or "").strip().split(" ")[0]
        enriched.append({**lot, "farmerName": name, "farmerVillage": farmer.get("village", "")})
    return {"data": enriched, "page": page, "pageSize": pageSize, "total": total}


@router.get("/lots/{lot_id}/offers")
async def lot_offer_board(lot_id: str, uid: str = Depends(current_user_id)):
    """Farmer-only bid board with per-buyer trust summary and rate analytics."""
    lot = await get_doc("market_lots", lot_id)
    if lot is None:
        _error(404, "LOT_NOT_FOUND", "lot not found")
    if lot.get("farmerId") != uid:
        _error(403, "LOT_FORBIDDEN", "only the lot owner can view the offer board")
    offers = await query("offers", [("targetType", "==", "lot"), ("targetId", "==", lot_id)], limit=1000)
    # Best rate first; ties broken by higher quantity.
    offers.sort(key=lambda o: (o.get("pricePerUnit") or 0, o.get("quantity") or 0), reverse=True)
    purchases = await query("purchases", [], limit=2000)
    entries = []
    verified_count = 0
    for offer in offers:
        buyer_id = offer.get("fromId") or ""
        buyer = await get_user(buyer_id) or {}
        completed = sum(
            1 for p in purchases if p.get("buyerId") == buyer_id and p.get("status") == "completed"
        )
        rating_stats = buyer.get("ratingStats") or buyer.get("farmerRatingStats") or {}
        verified = bool(buyer.get("vyapariVerified"))
        if verified:
            verified_count += 1
        entries.append(
            {
                **offer,
                "buyer": {
                    "buyerId": buyer_id,
                    "name": buyer.get("name", ""),
                    "district": buyer.get("district", ""),
                    "village": buyer.get("village", ""),
                    "verified": verified,
                    "completedPurchases": completed,
                    "avgRating": rating_stats.get("average"),
                    "offersOnThisLotCount": sum(
                        1 for o in offers if o.get("fromId") == buyer_id
                    ),
                },
            }
        )
    rates = [o.get("pricePerUnit") or 0 for o in offers]
    quantities = [float(o.get("quantity") or 0) for o in offers]
    best_rate = max(rates) if rates else 0
    expected = lot.get("expectedRate") or 0
    analytics = {
        "totalOffers": len(offers),
        "bestRate": best_rate,
        "avgRate": round(sum(rates) / len(rates), 2) if rates else 0,
        "avgQuantity": round(sum(quantities) / len(quantities), 2) if quantities else 0,
        "totalOfferedQty": round(sum(quantities), 3),
        "verifiedOffers": verified_count,
        "bestOfferId": entries[0]["id"] if entries else None,
        "rateVsExpected": {
            "expected": expected,
            "bestDeltaPct": (
                round((best_rate - expected) / expected * 100, 2) if expected else None
            ),
        },
    }
    return {"data": entries, "analytics": analytics}


@router.get("/lots/{lot_id}")
async def get_lot(lot_id: str, uid: str = Depends(current_user_id)):
    doc = await get_doc("market_lots", lot_id)
    if doc is None:
        _error(404, "LOT_NOT_FOUND", "lot not found")
    return doc


@router.put("/lots/{lot_id}", response_model=LotOut)
async def update_lot(lot_id: str, body: LotRequest, uid: str = Depends(_farmer_user)):
    doc = await get_doc("market_lots", lot_id)
    if doc is None or doc.get("farmerId") != uid:
        _error(404, "LOT_NOT_FOUND", "lot not found")
    if doc.get("status") == "sold":
        _error(409, "LOT_NOT_EDITABLE", "a sold lot cannot be edited")
    _validate_lot(body)
    doc.update(body.model_dump())
    await set_doc("market_lots", lot_id, doc)
    return doc


@router.delete("/lots/{lot_id}")
async def withdraw_lot(lot_id: str, uid: str = Depends(_farmer_user)):
    doc = await get_doc("market_lots", lot_id)
    if doc is None or doc.get("farmerId") != uid:
        _error(404, "LOT_NOT_FOUND", "lot not found")
    if doc.get("status") == "sold":
        _error(409, "LOT_NOT_EDITABLE", "a sold lot cannot be withdrawn")
    doc["status"] = "withdrawn"
    await set_doc("market_lots", lot_id, doc)
    return {"ok": True, "status": "withdrawn"}
