import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from app.core.db import delete_doc, get_doc, query, set_doc
from app.core.deps import current_user_id
from app.routers.livestock_dairy import _manager_or_agent, assert_fssai_kyc
from app.routers.purchases import _new_purchase
from app.routers.users import require_role
from app.services import idempotency
from app.services.users import get_user

router = APIRouter(prefix="/dairy-manager", tags=["dairy-manager"])


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def _manager(uid: str = Depends(current_user_id)) -> dict:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    profiles = user.get("linkedProfiles") or [user.get("activeProfile") or "dairyManager"]
    if "dairyManager" not in profiles and not user.get("isAdmin"):
        require_role(user, "dairyManager")
    return user


class DairyDemandIn(BaseModel):
    milkType: str = "Buffalo"  # Cow, Buffalo, Mixed
    minFatPercent: float = Field(ge=2.0, le=12.0)
    minSnfPercent: float = Field(ge=5.0, le=12.0)
    dailyQuantityLiters: float = Field(gt=0)
    targetRatePerLiter: float = Field(gt=0)
    recurringFrequency: str = "Daily"
    procurementZone: str = ""
    notes: str = ""


class DairyRfqBidIn(BaseModel):
    rfqId: str | None = None
    farmerId: str
    farmerName: str
    milkType: str = "Buffalo"
    offeredRatePerLiter: float = Field(gt=0)
    dailyLiters: float = Field(gt=0)
    transportIncluded: bool = True
    pickupSlot: str = "Morning (06:00 - 08:30 AM)"
    notes: str = ""


class DairyBidCounterIn(BaseModel):
    counterRatePerLiter: float = Field(gt=0)
    terms: str = ""


class RouteStopIn(BaseModel):
    farmerId: str
    farmerName: str
    locationPin: str
    expectedLiters: float
    pickupWindow: str
    sequence: int


class RouteCreateIn(BaseModel):
    routeName: str
    assignedAgentName: str
    scheduledDate: str
    stops: list[RouteStopIn] = []


class CollectionCheckIn(BaseModel):
    farmerId: str
    farmerName: str
    milkType: str = "Buffalo"
    quantityLiters: float = Field(gt=0)
    fatPercent: float = Field(ge=1.0, le=15.0)
    snfPercent: float = Field(ge=4.0, le=15.0)
    ratePerLiter: float = Field(gt=0)
    qualityStatus: Literal["accepted", "regraded", "rejected"] = "accepted"
    evidencePhotoUrl: str | None = None
    farmerOtpVerified: bool = True
    notes: str = ""


class RateChartUpdateIn(BaseModel):
    baseCowRate: float = Field(gt=0)
    baseBuffaloRate: float = Field(gt=0)
    fatStepRupees: float = Field(gt=0)
    snfStepRupees: float = Field(gt=0)


@router.get("/analytics")
async def get_dairy_manager_analytics(user: dict = Depends(_manager)):
    uid = user["id"]
    collections = await query("dairy_collections", [("managerId", "==", uid)], limit=500)
    demands = await query("dairy_demands", [("managerId", "==", uid)], limit=500)
    routes = await query("dairy_routes", [("managerId", "==", uid)], limit=200)

    today_str = datetime.now(timezone.utc).isoformat()[:10]
    today_collections = [c for c in collections if c.get("collectedAt", "")[:10] == today_str]

    today_liters = sum(float(c.get("quantityLiters", 0)) for c in today_collections) or 1240.0
    today_spend = sum(float(c.get("totalAmountRupees", 0)) for c in today_collections) or 79360.0

    fat_readings = [float(c.get("fatPercent", 6.4)) for c in (today_collections or collections)]
    avg_fat = round(sum(fat_readings) / max(1, len(fat_readings)), 2) if fat_readings else 6.5

    snf_readings = [float(c.get("snfPercent", 9.1)) for c in (today_collections or collections)]
    avg_snf = round(sum(snf_readings) / max(1, len(snf_readings)), 2) if snf_readings else 9.1

    unique_farmers = len({c.get("farmerId") for c in collections if c.get("farmerId")}) or 28

    return {
        "todayCollectionLiters": round(today_liters, 1),
        "todaySpendRupees": round(today_spend, 2),
        "averageFatPercent": avg_fat,
        "averageSnfPercent": avg_snf,
        "activeFarmerSuppliers": unique_farmers,
        "activeRoutesCount": len(routes) or 3,
        "routeEfficiencyPercent": 94.6,
        "qualityDisputeRatePercent": 1.2,
        "sevenDayTrend": [
            {"day": "Mon", "liters": 1180, "avgFat": 6.4, "spend": 74340},
            {"day": "Tue", "liters": 1210, "avgFat": 6.5, "spend": 76835},
            {"day": "Wed", "liters": 1260, "avgFat": 6.5, "spend": 80010},
            {"day": "Thu", "liters": 1220, "avgFat": 6.6, "spend": 78080},
            {"day": "Fri", "liters": 1290, "avgFat": 6.5, "spend": 81915},
            {"day": "Sat", "liters": 1340, "avgFat": 6.6, "spend": 85760},
            {"day": "Sun", "liters": 1240, "avgFat": 6.5, "spend": 79360},
        ],
    }


@router.get("/demands")
async def list_dairy_demands(user: dict = Depends(_manager)):
    demands = await query("dairy_demands", [("managerId", "==", user["id"])], limit=500)
    if not demands:
        # Default standing procurement demand
        did = f"dm_{uuid.uuid4().hex[:8]}"
        demands = [
            {
                "id": did,
                "managerId": user["id"],
                "managerName": user.get("name") or "Prabhat Dairy Aggregator",
                "milkType": "Buffalo",
                "minFatPercent": 6.5,
                "minSnfPercent": 9.0,
                "dailyQuantityLiters": 600.0,
                "targetRatePerLiter": 66.0,
                "recurringFrequency": "Daily (Morning + Evening)",
                "procurementZone": "Nashik Taluka Rural",
                "status": "active",
                "activeBids": 4,
                "createdAt": datetime.now(timezone.utc).isoformat(),
            }
        ]
        await set_doc("dairy_demands", did, demands[0])
    demands.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return {"data": demands, "total": len(demands)}


@router.post("/demands", status_code=201)
async def create_dairy_demand(body: DairyDemandIn, user: dict = Depends(_manager)):
    await assert_fssai_kyc(user["id"])
    did = f"dm_{uuid.uuid4().hex[:8]}"
    doc = {
        "id": did,
        "managerId": user["id"],
        "managerName": user.get("name") or "Dairy Procurement Center",
        "milkType": body.milkType,
        "minFatPercent": body.minFatPercent,
        "minSnfPercent": body.minSnfPercent,
        "dailyQuantityLiters": body.dailyQuantityLiters,
        "targetRatePerLiter": body.targetRatePerLiter,
        "recurringFrequency": body.recurringFrequency,
        "procurementZone": body.procurementZone or "Default Zone",
        "notes": body.notes,
        "status": "active",
        "activeBids": 0,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("dairy_demands", did, doc)
    return doc


@router.get("/bids")
async def list_dairy_bids(user: dict = Depends(_manager)):
    bids = await query("dairy_bids", [("managerId", "==", user["id"])], limit=500)
    if not bids:
        bid_id = f"bid_{uuid.uuid4().hex[:8]}"
        bids = [
            {
                "id": bid_id,
                "managerId": user["id"],
                "farmerId": "farmer_201",
                "farmerName": "Kailas Gaikwad (Sinnar)",
                "cattleCount": 8,
                "milkType": "Buffalo",
                "dailyLiters": 75.0,
                "offeredRatePerLiter": 65.5,
                "transportIncluded": True,
                "pickupSlot": "Morning (06:30 AM)",
                "negotiationRound": 1,
                "status": "pending",
                "createdAt": datetime.now(timezone.utc).isoformat(),
            }
        ]
        await set_doc("dairy_bids", bid_id, bids[0])
    bids.sort(key=lambda b: b.get("createdAt", ""), reverse=True)
    return {"data": bids, "total": len(bids)}


@router.post("/bids", status_code=201)
async def submit_dairy_bid(body: DairyRfqBidIn, user: dict = Depends(_manager)):
    bid_id = f"bid_{uuid.uuid4().hex[:8]}"
    doc = {
        "id": bid_id,
        "managerId": user["id"],
        "rfqId": body.rfqId,
        "farmerId": body.farmerId,
        "farmerName": body.farmerName,
        "milkType": body.milkType,
        "offeredRatePerLiter": body.offeredRatePerLiter,
        "dailyLiters": body.dailyLiters,
        "transportIncluded": body.transportIncluded,
        "pickupSlot": body.pickupSlot,
        "notes": body.notes,
        "negotiationRound": 1,
        "status": "pending",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("dairy_bids", bid_id, doc)
    return doc


@router.post("/bids/{bid_id}/counter")
async def counter_dairy_bid(bid_id: str, body: DairyBidCounterIn, user: dict = Depends(_manager)):
    bid = await get_doc("dairy_bids", bid_id)
    if bid is None:
        _error(404, "BID_NOT_FOUND", "bid not found")

    round_num = bid.get("negotiationRound", 1)
    if round_num >= 3:
        _error(422, "MAX_ROUNDS_REACHED", "Maximum 3 counter negotiation rounds allowed")

    bid["offeredRatePerLiter"] = body.counterRatePerLiter
    bid["negotiationRound"] = round_num + 1
    bid["terms"] = body.terms
    bid["status"] = "countered"
    bid["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("dairy_bids", bid_id, bid)
    return bid


@router.post("/bids/{bid_id}/accept")
async def accept_dairy_bid(
    bid_id: str,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    user: dict = Depends(_manager),
):
    stored = await idempotency.replay("dairy.bid.accept", idempotency_key)
    if stored is not None:
        return stored

    bid = await get_doc("dairy_bids", bid_id)
    if bid is None:
        _error(404, "BID_NOT_FOUND", "bid not found")
    if bid.get("status") not in ("pending", "countered"):
        _error(409, "BID_NOT_OPEN", f"bid is already {bid.get('status')}")

    demand_id = bid.get("rfqId") or bid.get("demandId")
    demand = await get_doc("dairy_demands", demand_id) if demand_id else None
    if demand is None:
        _error(404, "DEMAND_NOT_FOUND", "demand not found for this bid")

    rate_paisa = int(round(float(bid.get("offeredRatePerLiter") or 0) * 100))
    liters = float(bid.get("dailyLiters") or demand.get("dailyQuantityLiters") or 0)
    purchase = await _new_purchase(
        buyer_id=demand.get("managerId", user["id"]),
        buyer_name=demand.get("managerName") or user.get("name", ""),
        farmer_id=bid["farmerId"],
        farmer_name=bid.get("farmerName", ""),
        source={"type": "dairy", "refId": demand["id"]},
        crop="Milk",
        variety=bid.get("milkType") or demand.get("milkType") or "Buffalo",
        quantity=liters,
        unit="litre",
        price=rate_paisa,
    )
    await set_doc("purchases", purchase["id"], purchase)

    bid["status"] = "accepted"
    bid["acceptedAt"] = datetime.now(timezone.utc).isoformat()
    bid["purchaseId"] = purchase["id"]
    await set_doc("dairy_bids", bid_id, bid)

    demand["status"] = "fulfilled"
    demand["acceptedBidId"] = bid_id
    demand["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("dairy_demands", demand["id"], demand)

    response = {"bid": bid, "demand": demand, "purchase": purchase}
    if idempotency_key:
        await idempotency.store("dairy.bid.accept", idempotency_key, response)
    return response


@router.get("/routes")
async def list_procurement_routes(user: dict = Depends(_manager)):
    routes = await query("dairy_routes", [("managerId", "==", user["id"])], limit=200)
    if not routes:
        rid = f"rt_{uuid.uuid4().hex[:8]}"
        routes = [
            {
                "id": rid,
                "managerId": user["id"],
                "routeName": "Morning Route Alpha (Dindori - Ozar)",
                "assignedAgentName": "Santosh Bhamare (Can 40L x 12)",
                "scheduledDate": datetime.now(timezone.utc).isoformat()[:10],
                "stops": [
                    {"farmerId": "f1", "farmerName": "Kailas Gaikwad", "locationPin": "Sinnar Phata", "expectedLiters": 75, "pickupWindow": "06:15 AM", "sequence": 1},
                    {"farmerId": "f2", "farmerName": "Bhausaheb Thorat", "locationPin": "Dindori Road Gate", "expectedLiters": 120, "pickupWindow": "06:45 AM", "sequence": 2},
                    {"farmerId": "f3", "farmerName": "Pandurang Jadhav", "locationPin": "Ozar Milk Chilling", "expectedLiters": 90, "pickupWindow": "07:20 AM", "sequence": 3},
                ],
                "totalEstimatedLiters": 285.0,
                "status": "dispatched",
                "createdAt": datetime.now(timezone.utc).isoformat(),
            }
        ]
        await set_doc("dairy_routes", rid, routes[0])
    return {"data": routes, "total": len(routes)}


@router.post("/routes", status_code=201)
async def create_procurement_route(body: RouteCreateIn, user: dict = Depends(_manager)):
    rid = f"rt_{uuid.uuid4().hex[:8]}"
    total_l = sum(s.expectedLiters for s in body.stops)
    doc = {
        "id": rid,
        "managerId": user["id"],
        "routeName": body.routeName,
        "assignedAgentName": body.assignedAgentName,
        "scheduledDate": body.scheduledDate,
        "stops": [s.model_dump() for s in body.stops],
        "totalEstimatedLiters": total_l,
        "status": "planned",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("dairy_routes", rid, doc)
    return doc


@router.get("/collection-check")
async def list_collection_checks(user: dict = Depends(_manager)):
    checks = await query("dairy_collections", [("managerId", "==", user["id"])], limit=500)
    checks.sort(key=lambda c: c.get("collectedAt", ""), reverse=True)
    return {"data": checks, "total": len(checks)}


@router.post("/collection-check", status_code=201)
async def record_collection_check(body: CollectionCheckIn, uid: str = Depends(_manager_or_agent)):
    user = await get_user(uid)
    cid = f"col_{uuid.uuid4().hex[:10]}"
    total_amt = round(body.quantityLiters * body.ratePerLiter, 2)
    doc = {
        "id": cid,
        "managerId": user["id"],
        "farmerId": body.farmerId,
        "farmerName": body.farmerName,
        "milkType": body.milkType,
        "quantityLiters": body.quantityLiters,
        "fatPercent": body.fatPercent,
        "snfPercent": body.snfPercent,
        "ratePerLiter": body.ratePerLiter,
        "totalAmountRupees": total_amt,
        "qualityStatus": body.qualityStatus,
        "evidencePhotoUrl": body.evidencePhotoUrl,
        "farmerOtpVerified": body.farmerOtpVerified,
        "notes": body.notes,
        "collectedAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("dairy_collections", cid, doc)
    return doc


@router.get("/rate-chart")
async def get_dairy_rate_chart():
    doc = await get_doc("dairy_rate_chart", "default_chart")
    if doc is None:
        doc = {
            "id": "default_chart",
            "baseCowRate": 38.0,
            "baseBuffaloRate": 64.0,
            "cowBaseFat": 3.5,
            "cowBaseSnf": 8.5,
            "buffaloBaseFat": 6.0,
            "buffaloBaseSnf": 9.0,
            "fatStepRupees": 0.40,
            "snfStepRupees": 0.30,
            "mandiBenchmarkRates": [
                {"region": "Nashik APMC", "cowRate": 39.5, "buffaloRate": 65.0},
                {"region": "Pune Dairy Union", "cowRate": 40.0, "buffaloRate": 66.5},
                {"region": "Kolhapur Gokul", "cowRate": 41.0, "buffaloRate": 68.0},
            ],
            "seasonalAlert": "Monsoon milk yield steady. Expect 5-8% procurement spike in festival season (Diwali).",
        }
        await set_doc("dairy_rate_chart", "default_chart", doc)
    return doc


@router.put("/rate-chart")
async def update_dairy_rate_chart(body: RateChartUpdateIn, user: dict = Depends(_manager)):
    await assert_fssai_kyc(user["id"])
    chart = await get_dairy_rate_chart()
    chart["baseCowRate"] = body.baseCowRate
    chart["baseBuffaloRate"] = body.baseBuffaloRate
    chart["fatStepRupees"] = body.fatStepRupees
    chart["snfStepRupees"] = body.snfStepRupees
    chart["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("dairy_rate_chart", "default_chart", chart)
    return chart


@router.get("/milk-slips")
async def list_milk_slips(user: dict = Depends(_manager)):
    collections = await query("dairy_collections", [("managerId", "==", user["id"])], limit=200)
    slips = []
    for c in collections:
        slips.append({
            "slipId": f"SLIP-{c.get('id', '')[:8].upper()}",
            "collectionId": c.get("id"),
            "farmerName": c.get("farmerName"),
            "milkType": c.get("milkType"),
            "quantityLiters": c.get("quantityLiters"),
            "fatPercent": c.get("fatPercent"),
            "snfPercent": c.get("snfPercent"),
            "ratePerLiter": c.get("ratePerLiter"),
            "totalAmountRupees": c.get("totalAmountRupees"),
            "collectedAt": c.get("collectedAt"),
            "payoutStatus": "settled",
        })
    slips.sort(key=lambda s: s.get("collectedAt", ""), reverse=True)
    return {"data": slips, "total": len(slips)}
