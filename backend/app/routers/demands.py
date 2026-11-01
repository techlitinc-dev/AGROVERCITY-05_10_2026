import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import delete_doc, get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.direct import DemandCreate, DemandUpdate
from app.routers.users import require_role
from app.services.notify import notify_user
from app.services.users import get_user
from app.services.verification import is_identity_verified

router = APIRouter(prefix="/demands", tags=["demands"])

LIVE_OFFER_STATUSES = ("pending", "countered")
# Open sourcing feed: a requirement with applications is still open for more
# applications (multi-farmer sourcing) — the buyer controls closure/fulfilment.
OPEN_FEED_STATUSES = ("open", "applicationsReceived")
EDITABLE_STATUSES = ("draft", "open", "paused", "applicationsReceived")
RECURRING_FREQUENCIES = ("weekly", "fortnightly", "monthly")

REQUIREMENT_COPY_FIELDS = (
    "crop", "variety", "quantity", "unit", "qualityGrade", "maxPrice", "packaging",
    "deliveryLocation", "neededBy", "frequency", "notes", "supplyType",
    "quantityPerDelivery", "startDate", "endDate", "deliveryMode", "district",
    "transportArrangement", "packagingRequirements", "labellingRequirements",
    "partialAllowed", "multipleFarmersAllowed", "targetPrice", "targetUnit",
    "samplingRequirements", "qualityConditions", "gradeNotes", "audience",
)


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _today():
    return datetime.now(timezone.utc).date()


def _parse_date(value: str, field: str):
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        _error(422, "VALIDATION_ERROR", "invalid date", {field: "must be YYYY-MM-DD"})


def _derive_supply_type(payload: dict) -> str:
    explicit = payload.get("supplyType")
    if explicit in ("oneTime", "recurring"):
        return explicit
    return "recurring" if payload.get("frequency") in RECURRING_FREQUENCIES else "oneTime"


def _validate_requirement(payload: dict, publishing: bool):
    """Validate a requirement draft/publish. Dates are always checked when
    present; presence of the core fields is enforced on publish (drafts may be
    saved incomplete). An EXPLICIT `supplyType: "recurring"` gets the full
    schedule check; legacy frequency-only payloads stay lenient (the schedule
    fields they omit are simply not published yet)."""
    if publishing:
        if not str(payload.get("crop") or "").strip():
            _error(422, "VALIDATION_ERROR", "crop is required", {"crop": "required"})
        if not payload.get("quantity") or float(payload.get("quantity")) <= 0:
            _error(422, "VALIDATION_ERROR", "quantity must be greater than zero", {"quantity": "must be > 0"})
        if not str(payload.get("unit") or "").strip():
            _error(422, "VALIDATION_ERROR", "unit is required", {"unit": "required"})
        if not str(payload.get("deliveryLocation") or "").strip():
            _error(422, "VALIDATION_ERROR", "delivery/collection location is required", {"deliveryLocation": "required"})
    explicit_supply = payload.get("supplyType") in ("oneTime", "recurring")
    supply_type = _derive_supply_type(payload)
    frequency = payload.get("frequency") or "oneTime"
    if supply_type == "oneTime":
        if explicit_supply and frequency != "oneTime":
            _error(422, "VALIDATION_ERROR", "invalid schedule", {"frequency": "must be oneTime for a one-time requirement"})
        needed_by = payload.get("neededBy") or ""
        if needed_by:
            if _parse_date(needed_by, "neededBy") < _today():
                _error(422, "VALIDATION_ERROR", "invalid date", {"neededBy": "must not be in the past"})
    else:
        if explicit_supply and frequency not in RECURRING_FREQUENCIES:
            _error(422, "INVALID_RECURRING_SCHEDULE", "invalid recurring schedule", {"frequency": "weekly, fortnightly or monthly"})
        if explicit_supply and publishing:
            if not payload.get("quantityPerDelivery"):
                _error(422, "INVALID_RECURRING_SCHEDULE", "quantity per delivery is required", {"quantityPerDelivery": "required"})
            if not payload.get("startDate"):
                _error(422, "INVALID_RECURRING_SCHEDULE", "start date is required", {"startDate": "required"})
        start = payload.get("startDate") or ""
        if start:
            if _parse_date(start, "startDate") < _today():
                _error(422, "VALIDATION_ERROR", "invalid date", {"startDate": "must not be in the past"})
            end = payload.get("endDate") or ""
            if end and _parse_date(end, "endDate") < _parse_date(start, "startDate"):
                _error(422, "INVALID_DATE_RANGE", "end date must be on or after the start date")
    target_price = int(payload.get("targetPrice") or 0)
    if target_price and not str(payload.get("targetUnit") or "").strip():
        # Sensible default: price unit falls back to the quantity unit.
        payload["targetUnit"] = payload.get("unit") or ""


async def _direct_buyer(uid: str = Depends(current_user_id)) -> tuple[dict, str]:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "directBuyer", "seller", "exporter")
    return user, uid


def _audience_of(user: dict) -> str:
    active = user.get("activeProfile") or ""
    if active == "seller":
        return "vyapari"
    if active == "exporter":
        return "exporter"
    return "industrialBuyer"


async def _company_of(uid: str) -> str:
    profile = await get_doc(f"users/{uid}/role_profiles", "directBuyer")
    company = (profile or {}).get("companyName", "")
    if not company:
        seller_profile = await get_doc(f"users/{uid}/role_profiles", "seller")
        company = (seller_profile or {}).get("shopName", "")
    if not company:
        exporter_profile = await get_doc(f"users/{uid}/role_profiles", "exporter")
        company = (exporter_profile or {}).get("companyName", "")
    return company


@router.post("", status_code=201)
async def create_demand(body: DemandCreate, ctx: tuple = Depends(_direct_buyer)):
    user, uid = ctx
    if not await is_identity_verified(user):
        _error(403, "KYC_REQUIRED", "complete identity verification (KYC) to post requirements")
    payload = body.model_dump()
    _validate_requirement(payload, publishing=payload.get("status") == "open")
    payload["supplyType"] = _derive_supply_type(payload)
    now = _now_iso()
    doc = {
        **payload,
        "id": f"dem_{uuid.uuid4().hex[:12]}",
        "buyerId": uid,
        "buyerName": user.get("name", ""),
        "buyerCompany": await _company_of(uid),
        "state": user.get("state", ""),
        "audience": _audience_of(user),
        "offersCount": 0,
        "applicationsCount": 0,
        "createdAt": now,
        "updatedAt": now,
    }
    await set_doc("demands", doc["id"], doc)
    return doc


def _apply_feed_filters(docs: list[dict], crop, state, district, supply_type, quantity_min, quantity_max, supply_date):
    if crop:
        docs = [d for d in docs if crop.lower() in d.get("crop", "").lower()]
    if state:
        docs = [d for d in docs if d.get("state", "").lower() == state.lower()]
    if district:
        docs = [d for d in docs if (d.get("district") or "").lower() == district.lower()]
    if supply_type:
        docs = [d for d in docs if _derive_supply_type(d) == supply_type]
    if quantity_min is not None:
        docs = [d for d in docs if float(d.get("quantity") or 0) >= quantity_min]
    if quantity_max is not None:
        docs = [d for d in docs if float(d.get("quantity") or 0) <= quantity_max]
    if supply_date:
        day = _parse_date(supply_date, "supplyDate")

        def _supplies_on(d: dict) -> bool:
            if _derive_supply_type(d) == "oneTime":
                needed_by = d.get("neededBy") or ""
                return (not needed_by) or _parse_date(needed_by, "neededBy") >= day
            start = d.get("startDate") or ""
            end = d.get("endDate") or ""
            if start and _parse_date(start, "startDate") > day:
                return False
            if end and _parse_date(end, "endDate") < day:
                return False
            return True

        docs = [d for d in docs if _supplies_on(d)]
    return docs


@router.get("")
async def list_demands(
    crop: str | None = None,
    state: str | None = None,
    district: str | None = None,
    supplyType: str | None = None,
    quantityMin: float | None = None,
    quantityMax: float | None = None,
    supplyDate: str | None = None,
    audience: str | None = None,
    status: str = "open",
    page: int = 1,
    pageSize: int = 20,
    uid: str = Depends(current_user_id),
):
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    if status == "all":
        docs = await query("demands", [("buyerId", "==", uid)], limit=1000)
    elif status == "open":
        docs = await query("demands", [("status", "==", "open")], limit=1000)
        docs += await query("demands", [("status", "==", "applicationsReceived")], limit=1000)
    else:
        docs = await query("demands", [("status", "==", status)], limit=1000)
    docs = _apply_feed_filters(docs, crop, state, district, supplyType, quantityMin, quantityMax, supplyDate)
    if audience:
        docs = [d for d in docs if (d.get("audience") or "industrialBuyer") == audience]
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    total = len(docs)
    start = (page - 1) * pageSize
    return {"data": docs[start:start + pageSize], "page": page, "pageSize": pageSize, "total": total}


async def _own_demand(demand_id: str, uid: str) -> dict:
    doc = await get_doc("demands", demand_id)
    if doc is None:
        _error(404, "DEMAND_NOT_FOUND", "demand not found")
    if doc.get("buyerId") != uid:
        _error(403, "FORBIDDEN", "not the demand owner")
    return doc


async def _buyer_summary(buyer_id: str) -> dict:
    buyer = await get_user(buyer_id) or {}
    role_profile = await get_doc(f"users/{buyer_id}/role_profiles", "directBuyer") or {}
    purchases = await query("purchases", [("buyerId", "==", buyer_id)], limit=1000)
    stars = []
    for p in purchases:
        rating_obj = p.get("rating")
        if isinstance(rating_obj, dict):
            fb = rating_obj.get("farmerToBuyer")
            if isinstance(fb, dict):
                r = fb.get("rating")
                if isinstance(r, (int, float)):
                    stars.append(r)
            elif isinstance(fb, (int, float)):
                stars.append(fb)
    cases = await query("kyc_cases", [("userId", "==", buyer_id)], limit=50)
    business_verified = any(
        c.get("persona") == "directBuyer" and c.get("status") == "verified" for c in cases
    )
    identity_verified = await is_identity_verified(buyer)
    return {
        "buyerId": buyer_id,
        "name": buyer.get("name", ""),
        "companyName": role_profile.get("companyName", ""),
        "buyerType": role_profile.get("buyerType", ""),
        # Distinct server-derived badges (spec §13): identity = unified KYC,
        # business = directBuyer documents actually reviewed. `verified` is the
        # legacy browse flag — identity verification only.
        "verified": identity_verified,
        "identityVerified": identity_verified,
        "businessVerified": business_verified,
        "capacityPerMonth": role_profile.get("capacityPerMonth", 0),
        "capacityPerDay": role_profile.get("capacityPerDay", 0),
        "serviceRadiusKm": role_profile.get("serviceRadiusKm", 0),
        "district": buyer.get("district", ""),
        "state": buyer.get("state", ""),
        "ratingAvg": round(sum(stars) / len(stars), 1) if stars else None,
        "ratingCount": len(stars),
    }


@router.get("/browse")
async def browse_demands(
    crop: str | None = None,
    state: str | None = None,
    district: str | None = None,
    supplyType: str | None = None,
    quantityMin: float | None = None,
    quantityMax: float | None = None,
    supplyDate: str | None = None,
    audience: str | None = None,
    page: int = 1,
    pageSize: int = 20,
    uid: str = Depends(current_user_id),
):
    """Live public feed of every open requirement (buyer post) enriched with the
    buyer card — used by farmers to watch all buyer posts/demands live. Private
    contact details and business documents are never included."""
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    docs = []
    for status in OPEN_FEED_STATUSES:
        docs += await query("demands", [("status", "==", status)], limit=1000)
    docs = _apply_feed_filters(docs, crop, state, district, supplyType, quantityMin, quantityMax, supplyDate)
    if audience:
        docs = [d for d in docs if (d.get("audience") or "industrialBuyer") == audience]
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    total = len(docs)
    start = (page - 1) * pageSize
    data = []
    for d in docs[start:start + pageSize]:
        data.append({**d, "buyerSummary": await _buyer_summary(d.get("buyerId", ""))})
    return {"data": data, "page": page, "pageSize": pageSize, "total": total}


@router.get("/matches")
async def match_demands(
    page: int = 1,
    pageSize: int = 20,
    uid: str = Depends(current_user_id),
):
    """"Matches your crops": deterministic crop/location matching against the
    farmer's existing profile data (activeCrops + posted lots). No AI scoring;
    the farmer can always browse the full open feed."""
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    my_lots = await query("market_lots", [("farmerId", "==", uid)], limit=500)
    my_crops = {c.lower() for c in (user.get("activeCrops") or []) if c}
    my_crops |= {l.get("crop", "").lower() for l in my_lots if l.get("crop")}
    my_district = (user.get("district") or "").lower()
    docs = []
    for status in OPEN_FEED_STATUSES:
        docs += await query("demands", [("status", "==", status)], limit=1000)

    def _score(d: dict) -> tuple:
        crop_match = d.get("crop", "").lower() in my_crops
        location_match = my_district and (d.get("district") or "").lower() == my_district
        return (crop_match, location_match)

    matched = [d for d in docs if _score(d)[0]]
    matched.sort(key=lambda d: (_score(d)[1], d.get("createdAt", "")), reverse=True)
    total = len(matched)
    start = (page - 1) * pageSize
    data = []
    for d in matched[start:start + pageSize]:
        score = _score(d)
        data.append(
            {
                **d,
                "buyerSummary": await _buyer_summary(d.get("buyerId", "")),
                "match": {"cropMatch": score[0], "locationMatch": score[1]},
            }
        )
    return {"data": data, "page": page, "pageSize": pageSize, "total": total}


@router.get("/standing")
async def browse_standing_orders(
    crop: str | None = None,
    state: str | None = None,
    page: int = 1,
    pageSize: int = 20,
    uid: str = Depends(current_user_id),
):
    """Live public feed of open standing demand orders (price band, calendar
    window, per-slot quantity, service area) with the buyer card."""
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    docs = await query("standing_orders", [("status", "==", "open")], limit=1000)
    if crop:
        docs = [d for d in docs if crop.lower() in d.get("crop", "").lower()]
    if state:
        docs = [d for d in docs if d.get("state", "").lower() == state.lower()]
    today = datetime.now(timezone.utc).date().isoformat()
    docs = [d for d in docs if (d.get("endDate") or "") >= today]
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    total = len(docs)
    start = (page - 1) * pageSize
    data = []
    for d in docs[start:start + pageSize]:
        data.append({**d, "buyerSummary": await _buyer_summary(d.get("buyerId", ""))})
    return {"data": data, "page": page, "pageSize": pageSize, "total": total}


@router.get("/{demand_id}")
async def get_demand(demand_id: str, uid: str = Depends(current_user_id)):
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    doc = await get_doc("demands", demand_id)
    if doc is None:
        _error(404, "DEMAND_NOT_FOUND", "demand not found")
    return doc


@router.put("/{demand_id}")
async def update_demand(demand_id: str, body: DemandUpdate, uid: str = Depends(current_user_id)):
    doc = await _own_demand(demand_id, uid)
    if doc.get("status") not in EDITABLE_STATUSES:
        _error(400, "DEMAND_CLOSED", "only draft/open/paused requirements can be edited")
    candidate = {**doc, **body.model_dump(exclude_none=True)}
    _validate_requirement(candidate, publishing=candidate.get("status") == "open")
    doc.update(body.model_dump(exclude_none=True))
    doc["updatedAt"] = _now_iso()
    await set_doc("demands", demand_id, doc)
    return doc


async def _notify_applicants(demand: dict, notif_type: str, title: str, body: str):
    applications = await query("leads", [("demandId", "==", demand["id"])], limit=1000)
    notified = set()
    for app in applications:
        farmer_id = app.get("farmerId") or ""
        if not farmer_id or farmer_id in notified or app.get("status") == "dismissed":
            continue
        notified.add(farmer_id)
        await notify_user(
            farmer_id,
            type=notif_type,
            title=title,
            body=body,
            deepLink="/farmer/demands",
        )


@router.post("/{demand_id}/close")
async def close_demand(demand_id: str, uid: str = Depends(current_user_id)):
    doc = await _own_demand(demand_id, uid)
    if doc.get("status") == "closed":
        return doc
    doc["status"] = "closed"
    doc["updatedAt"] = _now_iso()
    await set_doc("demands", demand_id, doc)
    # Every farmer who applied (has a lead on this demand) hears about it once.
    await _notify_applicants(
        doc,
        "demand_closed",
        "Requirement closed / मागणी बंद",
        f"The {doc.get('crop', 'crop')} requirement you applied to is now closed.",
    )
    return doc


@router.post("/{demand_id}/pause")
async def pause_demand(demand_id: str, uid: str = Depends(current_user_id)):
    doc = await _own_demand(demand_id, uid)
    if doc.get("status") == "paused":
        return doc
    if doc.get("status") not in OPEN_FEED_STATUSES:
        _error(400, "DEMAND_NOT_OPEN", "only open requirements can be paused")
    doc["status"] = "paused"
    doc["updatedAt"] = _now_iso()
    await set_doc("demands", demand_id, doc)
    await _notify_applicants(
        doc,
        "demand_paused",
        "Requirement paused / मागणी थांबवली",
        f"The {doc.get('crop', 'crop')} requirement you applied to is paused — new applications are on hold.",
    )
    return doc


@router.post("/{demand_id}/resume")
async def resume_demand(demand_id: str, uid: str = Depends(current_user_id)):
    doc = await _own_demand(demand_id, uid)
    if doc.get("status") != "paused":
        _error(400, "DEMAND_NOT_PAUSED", "only paused requirements can be resumed")
    doc["status"] = "open"
    doc["updatedAt"] = _now_iso()
    await set_doc("demands", demand_id, doc)
    return doc


@router.post("/{demand_id}/fulfil")
async def fulfil_demand(demand_id: str, uid: str = Depends(current_user_id)):
    """Buyer-controlled fulfilment — never automatic: offered quantities alone
    never mark a requirement fulfilled."""
    doc = await _own_demand(demand_id, uid)
    if doc.get("status") == "fulfilled":
        return doc
    if doc.get("status") == "draft":
        _error(400, "DEMAND_NOT_PUBLISHED", "draft requirements cannot be fulfilled")
    doc["status"] = "fulfilled"
    doc["updatedAt"] = _now_iso()
    await set_doc("demands", demand_id, doc)
    await _notify_applicants(
        doc,
        "demand_fulfilled",
        "Requirement fulfilled / मागणी पूर्ण",
        f"The {doc.get('crop', 'crop')} requirement you applied to is marked fulfilled — sourcing is complete.",
    )
    return doc


@router.post("/{demand_id}/duplicate", status_code=201)
async def duplicate_demand(demand_id: str, uid: str = Depends(current_user_id)):
    """Copy editable requirement fields into a NEW draft — applications,
    contacts, statuses and outcomes are never copied."""
    doc = await _own_demand(demand_id, uid)
    now = _now_iso()
    new_doc = {k: doc.get(k) for k in REQUIREMENT_COPY_FIELDS}
    new_doc.update(
        {
            "id": f"dem_{uuid.uuid4().hex[:12]}",
            "buyerId": uid,
            "buyerName": doc.get("buyerName", ""),
            "buyerCompany": doc.get("buyerCompany", ""),
            "state": doc.get("state", ""),
            "status": "draft",
            "offersCount": 0,
            "applicationsCount": 0,
            "createdAt": now,
            "updatedAt": now,
        }
    )
    await set_doc("demands", new_doc["id"], new_doc)
    return new_doc


@router.post("/{demand_id}/reopen")
async def reopen_demand(demand_id: str, uid: str = Depends(current_user_id)):
    doc = await _own_demand(demand_id, uid)
    if doc.get("status") != "closed":
        _error(400, "DEMAND_NOT_CLOSED", "only closed demands can be reopened")
    doc["status"] = "open"
    doc["updatedAt"] = _now_iso()
    await set_doc("demands", demand_id, doc)
    return doc


@router.delete("/{demand_id}", status_code=204)
async def delete_demand(demand_id: str, uid: str = Depends(current_user_id)):
    doc = await _own_demand(demand_id, uid)
    offers = await query(
        "offers",
        [("targetType", "==", "demand"), ("targetId", "==", demand_id)],
        limit=1000,
    )
    if any(o.get("status") in LIVE_OFFER_STATUSES for o in offers):
        _error(409, "DEMAND_HAS_OFFERS", "demand has live offers and cannot be deleted")
    await delete_doc("demands", demand_id)
