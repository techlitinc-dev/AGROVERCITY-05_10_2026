import math
import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import delete_doc, get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.land import (
    LandListingIn,
    LandListingOut,
    LandListingUpdate,
    LeaseIn,
    LeaseOut,
    LeaseRequestIn,
    LeaseRequestOut,
    LeaseUpdate,
    PlotIn,
    PlotOut,
    PlotUpdate,
    RejectRequestIn,
    RentPaymentIn,
    RentPaymentOut,
    CounterRequestIn,
    MilestoneUpdateIn,
)
from app.routers.users import require_role
from app.services import reports
from app.services.users import get_user

router = APIRouter(prefix="/land", tags=["land"])


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def _owner(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer", "farmLandlord")
    return uid


async def _landlord(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmLandlord")
    return uid


async def _farmer(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer")
    return uid


async def list_subdocs(path: str) -> list[dict]:
    return await query(path, [], limit=1000)


def _envelope(items: list[dict]) -> dict:
    return {"data": items, "page": 1, "pageSize": 20, "total": len(items)}


async def _leases(uid: str) -> list[dict]:
    return await list_subdocs(f"users/{uid}/land_leases")


async def _require_plot(uid: str, plot_id: str) -> dict:
    plot = await get_doc(f"users/{uid}/land_plots", plot_id)
    if plot is None:
        _error(404, "PLOT_NOT_FOUND", "plot not found")
    return plot


async def _require_lease(uid: str, lease_id: str) -> dict:
    lease = await get_doc(f"users/{uid}/land_leases", lease_id)
    if lease is None:
        _error(404, "LEASE_NOT_FOUND", "lease not found")
    return lease


async def _set_plot_status(uid: str, plot_id: str, status: str):
    plot = await get_doc(f"users/{uid}/land_plots", plot_id)
    if plot is not None:
        plot["status"] = status
        await set_doc(f"users/{uid}/land_plots", plot_id, plot)


@router.get("/plots")
async def list_plots(uid: str = Depends(_owner)):
    return _envelope(await list_subdocs(f"users/{uid}/land_plots"))


@router.post("/plots", status_code=201, response_model=PlotOut)
async def create_plot(body: PlotIn, uid: str = Depends(_owner)):
    plot = PlotOut(id=uuid.uuid4().hex, status="vacant", **body.model_dump())
    await set_doc(f"users/{uid}/land_plots", plot.id, plot.model_dump())
    return plot


@router.put("/plots/{plot_id}", response_model=PlotOut)
async def update_plot(plot_id: str, body: PlotUpdate, uid: str = Depends(_owner)):
    plot = await _require_plot(uid, plot_id)
    plot.update(body.model_dump(exclude_unset=True))
    await set_doc(f"users/{uid}/land_plots", plot_id, plot)
    return PlotOut(**plot)


@router.delete("/plots/{plot_id}", status_code=204)
async def delete_plot(plot_id: str, uid: str = Depends(_owner)):
    await _require_plot(uid, plot_id)
    active = [
        l for l in await _leases(uid)
        if l.get("plotId") == plot_id and l.get("status") == "active"
    ]
    if active:
        _error(409, "PLOT_HAS_ACTIVE_LEASE", "plot has an active lease")
    await delete_doc(f"users/{uid}/land_plots", plot_id)


@router.get("/leases")
async def list_leases(status: str | None = None, uid: str = Depends(_owner)):
    leases = await _leases(uid)
    if status is not None:
        leases = [l for l in leases if l.get("status") == status]
    return _envelope(leases)


@router.post("/leases", status_code=201, response_model=LeaseOut)
async def create_lease(body: LeaseIn, uid: str = Depends(_owner)):
    await _require_plot(uid, body.plotId)
    if body.endDate <= body.startDate:
        _error(
            422,
            "INVALID_DATE_RANGE",
            "endDate must be after startDate",
            {"endDate": "must be after startDate"},
        )
    lease = LeaseOut(
        id=uuid.uuid4().hex, status="active", verified=False, **body.model_dump()
    )
    await set_doc(f"users/{uid}/land_leases", lease.id, lease.model_dump())
    await _set_plot_status(uid, body.plotId, "leased")
    return lease


@router.put("/leases/{lease_id}", response_model=LeaseOut)
async def update_lease(lease_id: str, body: LeaseUpdate, uid: str = Depends(_owner)):
    lease = await _require_lease(uid, lease_id)
    updates = body.model_dump(exclude_unset=True)
    lease.update(updates)
    await set_doc(f"users/{uid}/land_leases", lease_id, lease)
    if updates.get("status") == "ended":
        await _set_plot_status(uid, lease["plotId"], "vacant")
    return LeaseOut(**lease)


@router.delete("/leases/{lease_id}", status_code=204)
async def delete_lease(lease_id: str, uid: str = Depends(_owner)):
    lease = await _require_lease(uid, lease_id)
    await delete_doc(f"users/{uid}/land_leases", lease_id)
    if lease.get("status") == "active":
        await _set_plot_status(uid, lease["plotId"], "vacant")


@router.post("/leases/{lease_id}/payments", status_code=201, response_model=RentPaymentOut)
async def add_payment(lease_id: str, body: RentPaymentIn, uid: str = Depends(_owner)):
    await _require_lease(uid, lease_id)
    payments = await list_subdocs(f"users/{uid}/land_leases/{lease_id}/payments")
    if any(p.get("month") == body.month for p in payments):
        _error(409, "DUPLICATE_PAYMENT_MONTH", "payment already recorded for this month")
    payment = RentPaymentOut(id=uuid.uuid4().hex, leaseId=lease_id, **body.model_dump())
    await set_doc(
        f"users/{uid}/land_leases/{lease_id}/payments", payment.id, payment.model_dump()
    )
    return payment


@router.get("/leases/{lease_id}/payments")
async def list_payments(lease_id: str, uid: str = Depends(_owner)):
    lease = await _require_lease(uid, lease_id)
    payments = await list_subdocs(f"users/{uid}/land_leases/{lease_id}/payments")
    payments.sort(key=lambda p: p.get("month", ""), reverse=True)
    total = sum(p.get("amountRupees", 0) for p in payments)
    paid_months = {p.get("month") for p in payments}
    year, month = int(lease["startDate"][:4]), int(lease["startDate"][5:7])
    current = date.today().strftime("%Y-%m")
    pending = []
    while True:
        ym = f"{year:04d}-{month:02d}"
        if ym > current:
            break
        if ym not in paid_months:
            pending.append(ym)
        month += 1
        if month > 12:
            month = 1
            year += 1
    return {
        **_envelope(payments),
        "totalCollectedRupees": total,
        "pendingMonths": pending,
    }


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _add_months(d: date, months: int) -> date:
    month = d.month - 1 + months
    year = d.year + month // 12
    return date(year, month % 12 + 1, min(d.day, 28))


async def _require_listing(listing_id: str) -> dict:
    listing = await get_doc("land_listings", listing_id)
    if listing is None:
        _error(404, "LISTING_NOT_FOUND", "listing not found")
    return listing


async def _require_request(request_id: str) -> dict:
    request = await get_doc("lease_requests", request_id)
    if request is None:
        _error(404, "LISTING_NOT_FOUND", "lease request not found")
    return request


@router.post("/listings", status_code=201, response_model=LandListingOut)
async def create_listing(body: LandListingIn, uid: str = Depends(_landlord)):
    if body.plotId is not None:
        await _require_plot(uid, body.plotId)
    user = await get_user(uid)
    listing = LandListingOut(
        id=uuid.uuid4().hex,
        landlordId=uid,
        landlordName=user.get("name", ""),
        status="open",
        createdAt=datetime.now(timezone.utc).isoformat(),
        **body.model_dump(),
    )
    await set_doc("land_listings", listing.id, listing.model_dump())
    return listing


@router.get("/listings")
async def browse_listings(
    near: str | None = None,
    acres: float | None = None,
    uid: str = Depends(_owner),
):
    listings = [l for l in await query("land_listings", [], limit=1000) if l.get("status") == "open"]
    if acres is not None:
        listings = [l for l in listings if l.get("areaAcres", 0) >= acres]
    if near is not None:
        try:
            lat, lng = (float(p) for p in near.split(","))
        except ValueError:
            _error(422, "INVALID_NEAR", "near must be '<lat>,<lng>'", {"near": "invalid coordinates"})
        listings = [
            l for l in listings
            if _haversine_km(lat, lng, l.get("lat", 0), l.get("lng", 0)) <= 25
        ]
    return _envelope(listings)


@router.get("/listings/mine")
async def my_listings(uid: str = Depends(_landlord)):
    listings = await query("land_listings", [("landlordId", "==", uid)], limit=1000)
    return _envelope(listings)


@router.put("/listings/{listing_id}", response_model=LandListingOut)
async def update_listing(listing_id: str, body: LandListingUpdate, uid: str = Depends(_landlord)):
    listing = await _require_listing(listing_id)
    if listing.get("landlordId") != uid:
        _error(403, "NOT_LISTING_OWNER", "listing belongs to another landlord")
    listing.update(body.model_dump(exclude_unset=True))
    await set_doc("land_listings", listing_id, listing)
    return LandListingOut(**listing)


@router.delete("/listings/{listing_id}", status_code=204)
async def delete_listing(listing_id: str, uid: str = Depends(_landlord)):
    listing = await _require_listing(listing_id)
    if listing.get("landlordId") != uid:
        _error(403, "NOT_LISTING_OWNER", "listing belongs to another landlord")
    if listing.get("status") == "leased":
        _error(409, "LISTING_HAS_ACTIVE_LEASE", "listing is leased")
    await delete_doc("land_listings", listing_id)


@router.post("/lease-requests", status_code=201, response_model=LeaseRequestOut)
async def create_lease_request(body: LeaseRequestIn, uid: str = Depends(_farmer)):
    listing = await _require_listing(body.listingId)
    if listing.get("status") != "open":
        _error(409, "LISTING_NOT_OPEN", "listing is not open")
    existing = await query("lease_requests", [("listingId", "==", body.listingId)], limit=1000)
    if any(r.get("farmerId") == uid and r.get("status") == "pending" for r in existing):
        _error(409, "DUPLICATE_LEASE_REQUEST", "request already sent for this listing")
    user = await get_user(uid)
    request = LeaseRequestOut(
        id=uuid.uuid4().hex,
        farmerId=uid,
        farmerName=user.get("name", ""),
        farmerPhone=user.get("phone", ""),
        landlordId=listing["landlordId"],
        status="pending",
        createdAt=datetime.now(timezone.utc).isoformat(),
        **body.model_dump(),
    )
    await set_doc("lease_requests", request.id, request.model_dump())
    return request


@router.get("/lease-requests")
async def list_lease_requests(status: str | None = None, uid: str = Depends(_landlord)):
    requests = await query("lease_requests", [("landlordId", "==", uid)], limit=1000)
    if status is not None:
        requests = [r for r in requests if r.get("status") == status]
    return _envelope(requests)


@router.post("/lease-requests/{request_id}/accept")
async def accept_lease_request(request_id: str, uid: str = Depends(_landlord)):
    request = await _require_request(request_id)
    if request.get("landlordId") != uid:
        _error(403, "NOT_LISTING_OWNER", "request belongs to another landlord")
    if request.get("status") != "pending":
        _error(409, "REQUEST_ALREADY_RESOLVED", "request already resolved")
    listing = await _require_listing(request["listingId"])
    farmer = await get_doc("users", request["farmerId"]) or {}
    start = date.today()
    lease = LeaseOut(
        id=uuid.uuid4().hex,
        plotId=listing.get("plotId") or "",
        tenantName=farmer.get("name", request.get("farmerName", "")),
        tenantPhone=farmer.get("phone", request.get("farmerPhone", "")),
        monthlyRentRupees=listing["expectedRentRupees"],
        startDate=start.isoformat(),
        endDate=_add_months(start, request["durationMonths"]).isoformat(),
        status="active",
        verified=False,
    )
    await set_doc(f"users/{uid}/land_leases", lease.id, lease.model_dump())
    if lease.plotId:
        await _set_plot_status(uid, lease.plotId, "leased")
    listing["status"] = "leased"
    await set_doc("land_listings", listing["id"], listing)
    request["status"] = "accepted"
    await set_doc("lease_requests", request_id, request)
    others = await query("lease_requests", [("listingId", "==", listing["id"])], limit=1000)
    for other in others:
        if other["id"] != request_id and other.get("status") == "pending":
            other["status"] = "rejected"
            other["reason"] = "Listed plot leased to another farmer"
            await set_doc("lease_requests", other["id"], other)
    return {"leaseId": lease.id}


@router.post("/lease-requests/{request_id}/reject")
async def reject_lease_request(request_id: str, body: RejectRequestIn, uid: str = Depends(_landlord)):
    request = await _require_request(request_id)
    if request.get("landlordId") != uid:
        _error(403, "NOT_LISTING_OWNER", "request belongs to another landlord")
    if request.get("status") != "pending":
        _error(409, "REQUEST_ALREADY_RESOLVED", "request already resolved")
    request["status"] = "rejected"
    request["reason"] = body.reason
    await set_doc("lease_requests", request_id, request)
    return {"status": "rejected"}


@router.get("/leases/{lease_id}/agreement-pdf")
async def lease_agreement_pdf(lease_id: str, uid: str = Depends(_owner)):
    lease = await get_doc(f"users/{uid}/land_leases", lease_id)
    landlord_id = uid
    if lease is None:
        caller = await get_user(uid)
        for other in await query("users", [], limit=1000):
            lease = await get_doc(f"users/{other['id']}/land_leases", lease_id)
            if lease is not None:
                landlord_id = other["id"]
                break
        if lease is None or lease.get("tenantPhone") != caller.get("phone"):
            _error(404, "LEASE_NOT_FOUND", "lease not found")
    landlord = await get_doc("users", landlord_id) or {}
    tenant = {"name": lease.get("tenantName", ""), "phone": lease.get("tenantPhone", "")}
    if lease.get("plotId"):
        plot = await get_doc(f"users/{landlord_id}/land_plots", lease["plotId"])
        if plot is not None:
            lease = {**lease, "plotName": plot.get("name"), "gatNumber": plot.get("gatNumber")}
    path = reports.build_lease_agreement_pdf(lease, landlord, tenant)
    url = reports.upload_to_storage(path, f"agreements/{uid}/{lease_id}.pdf")
    return {"agreementUrl": url}


@router.get("/analytics")
async def get_landlord_analytics(uid: str = Depends(_landlord)):
    plots = await list_subdocs(f"users/{uid}/land_plots")
    leases = await _leases(uid)
    listings = await query("land_listings", [("landlordId", "==", uid)], limit=1000)
    requests = await query("lease_requests", [("landlordId", "==", uid)], limit=1000)

    total_plot_acres = sum(p.get("areaAcres", 0) for p in plots)
    total_listing_acres = sum(l.get("areaAcres", 0) for l in listings if not l.get("plotId"))
    total_acreage = round(total_plot_acres + total_listing_acres, 1)

    active_leases = [l for l in leases if l.get("status") == "active"]
    active_tenants = len(active_leases)
    leased_plots_count = len({l.get("plotId") for l in active_leases if l.get("plotId")})
    occupancy_rate = round((leased_plots_count / max(1, len(plots))) * 100, 1) if plots else 0.0

    monthly_rent_income = sum(float(l.get("monthlyRentRupees", 0)) for l in active_leases)

    # Collect payments across all leases
    total_collected = 0.0
    for l in leases:
        payments = await list_subdocs(f"users/{uid}/land_leases/{l['id']}/payments")
        total_collected += sum(p.get("amountRupees", 0) for p in payments)

    pending_requests = [r for r in requests if r.get("status") in ("pending", "countered")]

    soil_counts: dict[str, int] = {}
    for p in plots:
        st = p.get("soilType") or "Medium Black"
        soil_counts[st] = soil_counts.get(st, 0) + 1

    return {
        "totalAcreage": total_acreage,
        "totalPlots": len(plots),
        "activeTenants": active_tenants,
        "occupancyRatePercent": occupancy_rate,
        "monthlyRentIncomeRupees": round(monthly_rent_income, 2),
        "totalRentCollectedRupees": round(total_collected, 2),
        "pendingRequestsCount": len(pending_requests),
        "totalListings": len(listings),
        "soilBreakdown": [{"soilType": k, "count": v} for k, v in soil_counts.items()],
        "demandTrend": [
            {"month": "May", "demandScore": 68, "avgAcreRate": 18500},
            {"month": "Jun", "demandScore": 92, "avgAcreRate": 22000},
            {"month": "Jul", "demandScore": 85, "avgAcreRate": 21000},
            {"month": "Aug", "demandScore": 74, "avgAcreRate": 19500},
            {"month": "Sep", "demandScore": 79, "avgAcreRate": 20000},
            {"month": "Oct", "demandScore": 88, "avgAcreRate": 21500},
        ],
    }


@router.post("/lease-requests/{request_id}/counter")
async def counter_lease_request(
    request_id: str,
    body: CounterRequestIn,
    uid: str = Depends(_landlord),
):
    request = await _require_request(request_id)
    if request.get("landlordId") != uid:
        _error(403, "NOT_LISTING_OWNER", "request belongs to another landlord")
    if request.get("status") not in ("pending", "countered"):
        _error(409, "REQUEST_NOT_NEGOTIABLE", "only pending or countered requests can be countered")

    rounds = request.get("negotiationRounds", 1)
    if rounds >= 5:
        _error(422, "MAX_ROUNDS_REACHED", "Maximum 5 negotiation rounds allowed")

    request["counterRentRupees"] = body.counterRentRupees
    request["landlordNotes"] = body.note
    if body.durationMonths:
        request["durationMonths"] = body.durationMonths
    request["negotiationRounds"] = rounds + 1
    request["status"] = "countered"
    request["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("lease_requests", request_id, request)
    return request


@router.get("/lease-requests/mine")
async def my_sent_lease_requests(uid: str = Depends(_farmer)):
    requests = await query("lease_requests", [("farmerId", "==", uid)], limit=500)
    requests.sort(key=lambda r: r.get("createdAt", ""), reverse=True)
    return {"data": requests, "total": len(requests)}


@router.get("/leases/{lease_id}/milestones")
async def get_lease_milestones(lease_id: str, uid: str = Depends(_owner)):
    lease = await get_doc(f"users/{uid}/land_leases", lease_id)
    if lease is None:
        caller = await get_user(uid)
        for other in await query("users", [], limit=1000):
            lease = await get_doc(f"users/{other['id']}/land_leases", lease_id)
            if lease is not None:
                break
    if lease is None:
        _error(404, "LEASE_NOT_FOUND", "lease not found")

    milestones_doc = await get_doc(f"leases/{lease_id}/escrow", "milestones")
    if milestones_doc is None:
        annual_val = float(lease.get("monthlyRentRupees", 20000)) * 12
        milestones = [
            {
                "index": 0,
                "name": "Land Handover & Soil Verification",
                "percentage": 30,
                "amountRupees": round(annual_val * 0.30, 2),
                "status": "released",
                "targetWindow": "Day 1 (Handover)",
                "releaseDate": lease.get("startDate", ""),
                "notes": "Verified boundary markers and initial plot access.",
            },
            {
                "index": 1,
                "name": "Mid-Season Cultivation Inspection",
                "percentage": 40,
                "amountRupees": round(annual_val * 0.40, 2),
                "status": "pending",
                "targetWindow": "Mid-Crop Season (Day 90)",
                "releaseDate": None,
                "notes": "Escrow held pending crop health and water usage check.",
            },
            {
                "index": 2,
                "name": "Harvest & Plot Handover Reconciliation",
                "percentage": 30,
                "amountRupees": round(annual_val * 0.30, 2),
                "status": "pending",
                "targetWindow": "Post-Harvest / Lease End",
                "releaseDate": None,
                "notes": "Final release upon boundary clearance and handover confirmation.",
            },
        ]
        milestones_doc = {"leaseId": lease_id, "milestones": milestones}
        await set_doc(f"leases/{lease_id}/escrow", "milestones", milestones_doc)

    return milestones_doc


@router.post("/leases/{lease_id}/milestones")
async def update_lease_milestone(
    lease_id: str,
    body: MilestoneUpdateIn,
    uid: str = Depends(_owner),
):
    milestones_doc = await get_doc(f"leases/{lease_id}/escrow", "milestones")
    if milestones_doc is None:
        # initialize first
        await get_lease_milestones(lease_id=lease_id, uid=uid)
        milestones_doc = await get_doc(f"leases/{lease_id}/escrow", "milestones")

    ms_list = milestones_doc.get("milestones", [])
    if body.milestoneIndex < len(ms_list):
        ms_list[body.milestoneIndex]["status"] = body.status
        if body.status == "released":
            ms_list[body.milestoneIndex]["releaseDate"] = datetime.now(timezone.utc).isoformat()
        if body.notes:
            ms_list[body.milestoneIndex]["notes"] = body.notes
        milestones_doc["milestones"] = ms_list
        milestones_doc["updatedAt"] = datetime.now(timezone.utc).isoformat()
        await set_doc(f"leases/{lease_id}/escrow", "milestones", milestones_doc)

    return milestones_doc
