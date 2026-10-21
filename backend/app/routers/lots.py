import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

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


def _validate_lot(body: LotRequest) -> tuple[float, int]:
    qty = body.quantityQuintals if body.quantityQuintals is not None else body.quantityQuintal
    if qty is None or qty <= 0:
        _error(422, "VALIDATION_ERROR", "invalid lot", {"quantityQuintals": "must be greater than 0"})
    rate = body.expectedRate if body.expectedRate is not None else body.expectedPricePerQuintal
    if rate is None or rate < 0:
        _error(422, "VALIDATION_ERROR", "invalid lot", {"expectedRate": "must be 0 or more"})
    return float(qty), int(rate)


@router.post("/lots", status_code=201, response_model=LotOut)
async def create_lot(body: LotRequest, uid: str = Depends(_farmer_user)):
    qty, rate = _validate_lot(body)
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": f"lot_{uuid.uuid4().hex[:12]}",
        "farmerId": uid,
        "crop": body.crop,
        "variety": body.variety or "Standard",
        "grade": body.grade or "A",
        "quantityQuintals": qty,
        "quantityQuintal": qty,
        "expectedRate": rate,
        "expectedPricePerQuintal": rate,
        "harvestDate": body.harvestDate or now[:10],
        "photos": body.photos or [],
        "location": body.location or "Pimpalgaon Baswant, Nashik",
        "lat": body.lat,
        "lng": body.lng,
        "village": body.village,
        "status": "pending_review" if body.submitForReview else "open",
        "createdAt": now,
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
    for d in docs:
        qty = d.get("quantityQuintals") or d.get("quantityQuintal") or 0.0
        rate = d.get("expectedRate") or d.get("expectedPricePerQuintal") or 0
        d["quantityQuintals"] = qty
        d["quantityQuintal"] = qty
        d["expectedRate"] = rate
        d["expectedPricePerQuintal"] = rate
        if isinstance(d.get("location"), dict):
            loc = d["location"]
            d["location"] = f"{loc.get('village', '')}, {loc.get('district', '')}".strip(', ')
    if status:
        docs = [d for d in docs if d.get("status") == status]
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
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
    status: str | None = None,
    lat: float | None = None,
    lng: float | None = None,
    maxDistanceKm: float | None = None,
    sort: str = "newest",
    page: int = 1,
    pageSize: int = 20,
    uid: str = Depends(current_user_id),
):
    """Open discovery for buyers (any authenticated user) — spec V3."""
    if status:
        # An explicit status narrows the default open-only discovery surface
        # (moderation states like rejected/taken_down stay hidden by default).
        docs = await query("market_lots", [("status", "==", status)], limit=1000)
    else:
        docs = await query("market_lots", [("status", "==", "open")], limit=1000)
    docs = [d for d in docs if d.get("farmerId") != uid]
    if crop:
        docs = [d for d in docs if crop.lower() in d.get("crop", "").lower()]
    if state:
        docs = [
            d for d in docs
            if state.lower() in (
                (d.get("state") or (d.get("location") or {}).get("state", "")).lower()
            )
        ]
    if minRate is not None:
        docs = [d for d in docs if d.get("expectedRate", 0) >= minRate]
    if maxRate is not None:
        docs = [d for d in docs if d.get("expectedRate", 0) <= maxRate]
    if minQty is not None:
        docs = [d for d in docs if d.get("quantityQuintals", 0) >= minQty]
    if harvestBefore:
        docs = [d for d in docs if d.get("harvestDate", "") <= harvestBefore]
    if lat is not None and lng is not None and maxDistanceKm is not None:
        # Haversine km against the lot's own coords; lots without coords can
        # never satisfy a distance filter and are skipped.
        docs = [
            d for d in docs
            if d.get("lat") is not None
            and d.get("lng") is not None
            and _haversine_km(lat, lng, float(d["lat"]), float(d["lng"])) <= maxDistanceKm
        ]
        for d in docs:
            d["distanceKm"] = round(_haversine_km(lat, lng, float(d["lat"]), float(d["lng"])), 2)
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


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in kilometres (small float math, radians)."""
    import math

    radius_km = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)
    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    return 2 * radius_km * math.asin(math.sqrt(a))


@router.post("/lots/{lot_id}/submit-for-review")
async def submit_lot_for_review(lot_id: str, uid: str = Depends(_farmer_user)):
    """Farmer moves an open (or previously rejected) lot into the admin review
    queue — browse/discovery keep serving only `open` lots until approval."""
    doc = await get_doc("market_lots", lot_id)
    if doc is None or doc.get("farmerId") != uid:
        _error(404, "LOT_NOT_FOUND", "lot not found")
    if doc.get("status") not in ("open", "rejected"):
        _error(
            409,
            "LOT_NOT_SUBMITTABLE",
            f"a lot in status '{doc.get('status')}' cannot be submitted for review",
        )
    doc["status"] = "pending_review"
    doc["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("market_lots", lot_id, doc)
    return doc


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
    qty, rate = _validate_lot(body)
    # Merge only the fields the client actually sent — absent optional fields
    # (lat/lng/village/photos/…) must not clobber stored values with None.
    doc.update(body.model_dump(exclude_none=True, exclude={"submitForReview"}))
    doc["quantityQuintals"] = qty
    doc["quantityQuintal"] = qty
    doc["expectedRate"] = rate
    doc["expectedPricePerQuintal"] = rate
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


class RelistRequest(BaseModel):
    priority: bool = False
    expectedRate: Optional[int] = None
    quantityQuintals: Optional[float] = None
    note: Optional[str] = None


@router.post("/lots/{lot_id}/relist")
async def relist_lot(
    lot_id: str,
    body: RelistRequest = RelistRequest(),
    uid: str = Depends(_farmer_user),
):
    """P2-4: Farmer relists lot with optional priority boost (e.g. after Vyapari no-show)."""
    doc = await get_doc("market_lots", lot_id)
    if doc is None or doc.get("farmerId") != uid:
        _error(404, "LOT_NOT_FOUND", "lot not found")
    if doc.get("status") == "sold":
        _error(409, "LOT_ALREADY_SOLD", "a sold lot cannot be relisted")
    now = datetime.now(timezone.utc).isoformat()
    doc["status"] = "open"
    doc["priority"] = body.priority
    if body.expectedRate is not None:
        if body.expectedRate < 0:
            _error(422, "VALIDATION_ERROR", "invalid lot", {"expectedRate": "must be 0 or more"})
        doc["expectedRate"] = body.expectedRate
    if body.quantityQuintals is not None:
        if body.quantityQuintals <= 0:
            _error(422, "VALIDATION_ERROR", "invalid lot", {"quantityQuintals": "must be greater than 0"})
        doc["quantityQuintals"] = body.quantityQuintals
    doc["relistedAt"] = now
    doc["updatedAt"] = now
    if body.priority:
        doc["priorityRelistedAt"] = now
        doc["priorityBoost"] = True
    if body.note:
        doc["relistNote"] = body.note
    await set_doc("market_lots", lot_id, doc)
    return doc

