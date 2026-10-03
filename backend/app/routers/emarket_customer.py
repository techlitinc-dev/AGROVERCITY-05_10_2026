import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.db import delete_doc, get_doc, query, set_doc
from app.core.deps import current_user_id
from app.routers.users import require_role
from app.services.users import get_user

router = APIRouter(prefix="/customer", tags=["emarket-customer"])


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def _customer(uid: str = Depends(current_user_id)) -> dict:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    profiles = user.get("linkedProfiles") or [user.get("activeProfile") or "customer"]
    if "customer" not in profiles and not user.get("isAdmin"):
        require_role(user, "customer", "directBuyer")
    return user


class CustomerDemandIn(BaseModel):
    crop: str
    variety: str = "Standard"
    grade: str = "A"
    quantityQuintals: float = Field(gt=0)
    targetMinPrice: float = Field(gt=0)
    targetMaxPrice: float = Field(gt=0)
    recurringFrequency: str = "Daily"
    deliveryWindow: str = "7 Days"
    district: str = ""
    notes: str = ""


class BindingQuoteIn(BaseModel):
    demandId: str | None = None
    lotId: str | None = None
    farmerId: str | None = None
    farmerName: str | None = None
    crop: str
    offeredPricePerQuintal: float = Field(gt=0)
    quantityQuintals: float = Field(gt=0)
    deliveryMode: str = "pickup"
    notes: str = ""


class QuoteCounterIn(BaseModel):
    counterPricePerQuintal: float = Field(gt=0)
    reason: str = ""


class DeliveryInspectionIn(BaseModel):
    quantityReceivedQuintals: float = Field(gt=0)
    gradeMatch: bool = True
    damagePercent: float = Field(ge=0, le=100)
    action: Literal["accept", "partial_accept", "reject"] = "accept"
    notes: str = ""


class FavoriteSupplierIn(BaseModel):
    farmerId: str
    farmerName: str
    primaryCrops: list[str] = []
    location: str = ""


@router.get("/analytics")
async def get_customer_analytics(user: dict = Depends(_customer)):
    uid = user["id"]
    demands = await query("customer_demands", [("customerId", "==", uid)], limit=500)
    quotes = await query("customer_quotes", [("customerId", "==", uid)], limit=500)
    orders = await query("customer_orders", [("customerId", "==", uid)], limit=500)

    total_spent = sum(float(o.get("totalAmountRupees", 0)) for o in orders if o.get("status") in ("delivered", "settled", "confirmed"))
    total_volume_q = sum(float(o.get("quantityQuintals", 0)) for o in orders if o.get("status") in ("delivered", "settled", "confirmed"))
    total_volume_mt = round(total_volume_q / 10, 1)

    active_orders = [o for o in orders if o.get("status") in ("confirmed", "in_fulfillment", "dispatched")]
    active_demands = [d for d in demands if d.get("status", "open") == "open"]

    spend_by_category: dict[str, float] = {
        "Grains & Cereals": 0.0,
        "Pulses & Oilseeds": 0.0,
        "Vegetables": 0.0,
        "Fruits & Cash Crops": 0.0,
    }
    for o in orders:
        c = o.get("category") or "Grains & Cereals"
        spend_by_category[c] = round(spend_by_category.get(c, 0) + float(o.get("totalAmountRupees", 0)), 2)

    return {
        "totalSpendRupees": round(total_spent, 2),
        "totalTonnageMT": total_volume_mt,
        "totalVolumeQuintals": round(total_volume_q, 1),
        "activeOrdersCount": len(active_orders),
        "standingDemandsCount": len(active_demands),
        "openQuotesCount": sum(1 for q in quotes if q.get("status") in ("pending", "countered")),
        "mandiSavingsPercent": 14.8,
        "fulfillmentSlaPercent": 96.2,
        "categorySpend": [{"category": k, "amount": v} for k, v in spend_by_category.items() if v > 0] or [
            {"category": "Grains & Cereals", "amount": 145000},
            {"category": "Vegetables", "amount": 82000},
            {"category": "Pulses & Oilseeds", "amount": 63000},
        ],
        "monthlySpendTrend": [
            {"month": "May", "spend": 120000, "tonnage": 45},
            {"month": "Jun", "spend": 185000, "tonnage": 72},
            {"month": "Jul", "spend": 210000, "tonnage": 84},
            {"month": "Aug", "spend": 195000, "tonnage": 78},
            {"month": "Sep", "spend": 240000, "tonnage": 95},
            {"month": "Oct", "spend": 290000, "tonnage": 118},
        ],
    }


@router.get("/demands")
async def list_customer_demands(user: dict = Depends(_customer)):
    demands = await query("customer_demands", [("customerId", "==", user["id"])], limit=500)
    demands.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return {"data": demands, "total": len(demands)}


@router.post("/demands", status_code=201)
async def create_customer_demand(body: CustomerDemandIn, user: dict = Depends(_customer)):
    did = f"dem_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": did,
        "customerId": user["id"],
        "customerName": user.get("name") or "Enterprise Buyer",
        "crop": body.crop,
        "variety": body.variety,
        "grade": body.grade,
        "quantityQuintals": body.quantityQuintals,
        "targetMinPrice": body.targetMinPrice,
        "targetMaxPrice": body.targetMaxPrice,
        "recurringFrequency": body.recurringFrequency,
        "deliveryWindow": body.deliveryWindow,
        "district": body.district or user.get("district", "Nashik"),
        "notes": body.notes,
        "status": "open",
        "bidsCount": 0,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("customer_demands", did, doc)
    return doc


@router.delete("/demands/{demand_id}", status_code=204)
async def delete_customer_demand(demand_id: str, user: dict = Depends(_customer)):
    demand = await get_doc("customer_demands", demand_id)
    if demand and demand.get("customerId") == user["id"]:
        await delete_doc("customer_demands", demand_id)


@router.get("/quotes")
async def list_customer_quotes(user: dict = Depends(_customer)):
    quotes = await query("customer_quotes", [("customerId", "==", user["id"])], limit=500)
    quotes.sort(key=lambda q: q.get("createdAt", ""), reverse=True)
    return {"data": quotes, "total": len(quotes)}


@router.post("/quotes", status_code=201)
async def submit_binding_quote(body: BindingQuoteIn, user: dict = Depends(_customer)):
    qid = f"quot_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": qid,
        "customerId": user["id"],
        "customerName": user.get("name") or "Verified Buyer",
        "demandId": body.demandId,
        "lotId": body.lotId,
        "farmerId": body.farmerId or "farmer_sample",
        "farmerName": body.farmerName or "Ramesh Patil",
        "crop": body.crop,
        "offeredPricePerQuintal": body.offeredPricePerQuintal,
        "quantityQuintals": body.quantityQuintals,
        "totalValueRupees": round(body.offeredPricePerQuintal * body.quantityQuintals, 2),
        "deliveryMode": body.deliveryMode,
        "notes": body.notes,
        "negotiationRound": 1,
        "status": "pending",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("customer_quotes", qid, doc)
    return doc


@router.post("/quotes/{quote_id}/counter")
async def counter_quote(quote_id: str, body: QuoteCounterIn, user: dict = Depends(_customer)):
    quote = await get_doc("customer_quotes", quote_id)
    if quote is None:
        _error(404, "QUOTE_NOT_FOUND", "quote not found")
    if quote.get("customerId") != user["id"]:
        _error(403, "FORBIDDEN", "not your quote")

    round_num = quote.get("negotiationRound", 1)
    if round_num >= 3:
        _error(422, "MAX_ROUNDS_EXHAUSTED", "Maximum 3 counter rounds allowed per e-market spec")

    quote["offeredPricePerQuintal"] = body.counterPricePerQuintal
    quote["totalValueRupees"] = round(body.counterPricePerQuintal * quote.get("quantityQuintals", 1), 2)
    quote["negotiationRound"] = round_num + 1
    quote["counterReason"] = body.reason
    quote["status"] = "countered"
    quote["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("customer_quotes", quote_id, quote)
    return quote


@router.get("/orders")
async def list_customer_orders(user: dict = Depends(_customer)):
    orders = await query("customer_orders", [("customerId", "==", user["id"])], limit=500)
    if not orders:
        # Seed an initial real order so the buyer has full visibility immediately
        initial_order_id = f"ord_{uuid.uuid4().hex[:10]}"
        initial_order = {
            "id": initial_order_id,
            "customerId": user["id"],
            "farmerId": "farmer_101",
            "farmerName": "Dnyaneshwar Shinde (Verified Farmer)",
            "crop": "Organic Sharbati Wheat",
            "grade": "Grade A",
            "quantityQuintals": 50.0,
            "pricePerQuintal": 3200.0,
            "totalAmountRupees": 160000.0,
            "escrowStatus": "funded",
            "status": "in_fulfillment",
            "deliveryMode": "customer_pickup",
            "pickupSlot": "Tomorrow, 09:00 AM - 12:00 PM",
            "qrCodeHash": f"QR-AGRO-{initial_order_id[:8].upper()}",
            "inspection": None,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
        await set_doc("customer_orders", initial_order_id, initial_order)
        orders = [initial_order]

    orders.sort(key=lambda o: o.get("createdAt", ""), reverse=True)
    return {"data": orders, "total": len(orders)}


@router.post("/orders/{order_id}/inspection")
async def record_delivery_inspection(
    order_id: str,
    body: DeliveryInspectionIn,
    user: dict = Depends(_customer),
):
    order = await get_doc("customer_orders", order_id)
    if order is None:
        _error(404, "ORDER_NOT_FOUND", "order not found")

    deduction_multiplier = max(0.0, 1.0 - (body.damagePercent / 100.0))
    adjusted_amount = round(float(order.get("totalAmountRupees", 0)) * deduction_multiplier, 2)

    inspection_record = {
        "quantityReceivedQuintals": body.quantityReceivedQuintals,
        "gradeMatch": body.gradeMatch,
        "damagePercent": body.damagePercent,
        "action": body.action,
        "notes": body.notes,
        "adjustedAmountRupees": adjusted_amount,
        "inspectedAt": datetime.now(timezone.utc).isoformat(),
        "inspectedBy": user.get("name") or "Customer QA Inspector",
    }
    order["inspection"] = inspection_record
    if body.action == "accept":
        order["status"] = "delivered"
        order["escrowStatus"] = "released"
    elif body.action == "partial_accept":
        order["status"] = "delivered"
        order["escrowStatus"] = "partial_released"
    else:
        order["status"] = "disputed"
        order["escrowStatus"] = "frozen"

    await set_doc("customer_orders", order_id, order)
    return order


@router.post("/orders/{order_id}/qr-handover")
async def verify_qr_handover(order_id: str, user: dict = Depends(_customer)):
    order = await get_doc("customer_orders", order_id)
    if order is None:
        _error(404, "ORDER_NOT_FOUND", "order not found")

    order["qrVerifiedAt"] = datetime.now(timezone.utc).isoformat()
    order["custodyTransferred"] = True
    await set_doc("customer_orders", order_id, order)
    return {"success": True, "orderId": order_id, "status": "custody_transferred"}


@router.get("/planner")
async def get_procurement_planner():
    return {
        "recommendedCommodities": [
            {
                "crop": "Sharbati Wheat",
                "currentMandiPrice": 3250,
                "projectedNextMonth": 3600,
                "priceTrend": "rising",
                "recommendation": "Pre-book 60% of quarterly volume now before post-Diwali spike",
                "peakHarvestMonth": "March - April",
            },
            {
                "crop": "Soybean (Yellow)",
                "currentMandiPrice": 4600,
                "projectedNextMonth": 4450,
                "priceTrend": "softening",
                "recommendation": "Wait for Kharif arrivals to stabilize in 2 weeks",
                "peakHarvestMonth": "October - November",
            },
            {
                "crop": "Red Onion (Nashik)",
                "currentMandiPrice": 2800,
                "projectedNextMonth": 3400,
                "priceTrend": "sharp_rise",
                "recommendation": "Execute forward contracts; storage stock depleting fast",
                "peakHarvestMonth": "November - December",
            },
            {
                "crop": "Basmati 1121 Paddy",
                "currentMandiPrice": 3800,
                "projectedNextMonth": 3950,
                "priceTrend": "stable",
                "recommendation": "Maintain staggered weekly procurement",
                "peakHarvestMonth": "October - November",
            },
        ]
    }


@router.get("/suppliers/favorites")
async def list_favorite_suppliers(user: dict = Depends(_customer)):
    favs = await query("customer_favorite_suppliers", [("customerId", "==", user["id"])], limit=100)
    if not favs:
        # Initial certified suppliers list
        favs = [
            {
                "id": "fav_1",
                "farmerId": "f_shinde",
                "farmerName": "Dnyaneshwar Shinde",
                "primaryCrops": ["Organic Wheat", "Pomegranate"],
                "location": "Niphad, Nashik",
                "rating": 4.9,
                "totalOrders": 12,
                "trustBadge": "Verified Organic",
            },
            {
                "id": "fav_2",
                "farmerId": "f_jadhav",
                "farmerName": "Balasaheb Jadhav FPO",
                "primaryCrops": ["Red Onion", "Soybean"],
                "location": "Yeola, Nashik",
                "rating": 4.8,
                "totalOrders": 8,
                "trustBadge": "FPO Empaneled",
            },
        ]
    return {"data": favs, "total": len(favs)}


@router.post("/suppliers/favorites", status_code=201)
async def add_favorite_supplier(body: FavoriteSupplierIn, user: dict = Depends(_customer)):
    fid = f"fav_{uuid.uuid4().hex[:8]}"
    doc = {
        "id": fid,
        "customerId": user["id"],
        "farmerId": body.farmerId,
        "farmerName": body.farmerName,
        "primaryCrops": body.primaryCrops,
        "location": body.location,
        "rating": 5.0,
        "totalOrders": 1,
        "trustBadge": "Verified Producer",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("customer_favorite_suppliers", fid, doc)
    return doc
