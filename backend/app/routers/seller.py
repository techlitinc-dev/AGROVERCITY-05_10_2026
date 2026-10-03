import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.mandi import SellerRateRequest
from app.models.seller import BuyerLedgerEntryCreate, ProcurementLotCreate, SaleEntryCreate
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


# ==========================================
# SELLER POS: SALES ENTRY & BILLING
# ==========================================

@router.post("/sales", status_code=201)
async def create_sale_entry(body: SaleEntryCreate, ctx: tuple = Depends(_seller_user)):
    _, uid = ctx
    sale_id = f"sale_{uuid.uuid4().hex[:10]}"
    now_iso = datetime.now(timezone.utc).isoformat()
    
    gross_amount = round(body.quantity * body.ratePerUnit, 2)
    mandi_fee = round(gross_amount * (body.mandiFeePct / 100), 2)
    net_amount = round(gross_amount + mandi_fee, 2)
    
    amount_paid = body.amountPaid
    if body.paymentMode in ("cash", "upi", "bank_transfer") and amount_paid == 0:
        amount_paid = net_amount
    
    balance_due = max(0.0, round(net_amount - amount_paid, 2))
    status = "paid" if balance_due <= 0 else ("partial" if amount_paid > 0 else "credit")

    doc = {
        **body.model_dump(),
        "id": sale_id,
        "sellerId": uid,
        "grossAmount": gross_amount,
        "mandiFee": mandi_fee,
        "netAmount": net_amount,
        "amountPaid": amount_paid,
        "balanceDue": balance_due,
        "status": status,
        "billNumber": f"INV-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{sale_id[-4:].upper()}",
        "createdAt": now_iso,
    }
    await set_doc(f"users/{uid}/seller_sales", sale_id, doc)

    # If credit balance exists, reflect in buyer ledger
    if balance_due > 0:
        ledger_id = f"ledg_{uuid.uuid4().hex[:10]}"
        ledger_entry = {
            "id": ledger_id,
            "sellerId": uid,
            "buyerName": body.buyerName,
            "buyerPhone": body.buyerPhone,
            "companyName": "",
            "type": "credit_sale",
            "amount": balance_due,
            "paymentMode": "credit",
            "reference": doc["billNumber"],
            "notes": f"Sale of {body.quantity} {body.unit} {body.item}",
            "createdAt": now_iso,
        }
        await set_doc(f"users/{uid}/seller_buyer_ledgers", ledger_id, ledger_entry)

    return doc


@router.get("/sales")
async def list_sales(ctx: tuple = Depends(_seller_user)):
    _, uid = ctx
    sales = await query(f"users/{uid}/seller_sales", [], limit=1000)
    sales.sort(key=lambda s: s.get("createdAt", ""), reverse=True)
    
    total_revenue = sum(s.get("netAmount", 0) for s in sales)
    total_received = sum(s.get("amountPaid", 0) for s in sales)
    total_outstanding = sum(s.get("balanceDue", 0) for s in sales)

    return {
        "data": sales,
        "stats": {
            "totalRevenue": total_revenue,
            "totalReceived": total_received,
            "totalOutstanding": total_outstanding,
            "totalInvoices": len(sales),
        }
    }


# ==========================================
# BUYER KHATA & CREDIT LEDGER
# ==========================================

@router.get("/ledgers")
async def list_buyer_ledgers(ctx: tuple = Depends(_seller_user)):
    _, uid = ctx
    entries = await query(f"users/{uid}/seller_buyer_ledgers", [], limit=1000)
    entries.sort(key=lambda e: e.get("createdAt", ""), reverse=True)

    # Group ledger balances by buyer
    buyers_map = {}
    for entry in entries:
        b_key = f"{entry.get('buyerName', 'Unknown')}_{entry.get('buyerPhone', '')}"
        if b_key not in buyers_map:
            buyers_map[b_key] = {
                "buyerName": entry.get("buyerName", "Unknown"),
                "buyerPhone": entry.get("buyerPhone", ""),
                "companyName": entry.get("companyName", ""),
                "totalCredit": 0.0,
                "totalPaid": 0.0,
                "netBalance": 0.0,
                "lastTransaction": entry.get("createdAt", ""),
                "history": [],
            }
        
        amt = entry.get("amount", 0.0)
        e_type = entry.get("type", "credit_sale")
        if e_type == "credit_sale":
            buyers_map[b_key]["totalCredit"] += amt
            buyers_map[b_key]["netBalance"] += amt
        elif e_type == "payment_received":
            buyers_map[b_key]["totalPaid"] += amt
            buyers_map[b_key]["netBalance"] -= amt
        elif e_type == "adjustment":
            buyers_map[b_key]["netBalance"] += amt
        
        buyers_map[b_key]["history"].append(entry)

    buyers_list = list(buyers_map.values())
    buyers_list.sort(key=lambda b: b["netBalance"], reverse=True)
    total_due = sum(b["netBalance"] for b in buyers_list if b["netBalance"] > 0)

    return {
        "data": buyers_list,
        "entries": entries,
        "totalCreditOutstanding": round(total_due, 2),
        "totalDebtors": len([b for b in buyers_list if b["netBalance"] > 0]),
    }


@router.post("/ledgers", status_code=201)
async def add_ledger_entry(body: BuyerLedgerEntryCreate, ctx: tuple = Depends(_seller_user)):
    _, uid = ctx
    entry_id = f"ledg_{uuid.uuid4().hex[:10]}"
    now_iso = datetime.now(timezone.utc).isoformat()

    doc = {
        **body.model_dump(),
        "id": entry_id,
        "sellerId": uid,
        "createdAt": now_iso,
    }
    await set_doc(f"users/{uid}/seller_buyer_ledgers", entry_id, doc)
    return doc


# ==========================================
# MANDI PROCUREMENT & J-FORM WEIGHBRIDGE
# ==========================================

@router.get("/procurement")
async def list_procurement_lots(ctx: tuple = Depends(_seller_user)):
    _, uid = ctx
    lots = await query(f"users/{uid}/seller_procurement", [], limit=1000)
    lots.sort(key=lambda l: l.get("createdAt", ""), reverse=True)

    total_procured_quintals = sum(l.get("netWeightQuintals", 0) for l in lots)
    total_payout_amount = sum(l.get("finalAmount", 0) for l in lots)
    pending_payouts = sum(l.get("finalAmount", 0) for l in lots if l.get("paymentStatus") != "paid")

    return {
        "data": lots,
        "stats": {
            "totalProcuredQuintals": total_procured_quintals,
            "totalPayoutAmount": total_payout_amount,
            "pendingPayouts": pending_payouts,
            "totalLots": len(lots),
        }
    }


@router.post("/procurement", status_code=201)
async def create_procurement_lot(body: ProcurementLotCreate, ctx: tuple = Depends(_seller_user)):
    _, uid = ctx
    lot_id = f"proc_{uuid.uuid4().hex[:10]}"
    now_iso = datetime.now(timezone.utc).isoformat()

    gross_value = round(body.netWeightQuintals * body.ratePerQuintal, 2)
    quality_deduction_amt = round(gross_value * (body.qualityDeductionPct / 100), 2)
    final_amount = round(gross_value - quality_deduction_amt, 2)

    doc = {
        **body.model_dump(),
        "id": lot_id,
        "sellerId": uid,
        "grossValue": gross_value,
        "qualityDeductionAmount": quality_deduction_amt,
        "finalAmount": final_amount,
        "jFormNumber": f"JFORM-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{lot_id[-4:].upper()}",
        "createdAt": now_iso,
    }
    await set_doc(f"users/{uid}/seller_procurement", lot_id, doc)
    return doc


@router.post("/procurement/{lot_id}/pay")
async def mark_procurement_paid(lot_id: str, paymentMode: str = "bank_transfer", utrNo: str = "", ctx: tuple = Depends(_seller_user)):
    _, uid = ctx
    lot = await get_doc(f"users/{uid}/seller_procurement", lot_id)
    if not lot:
        _error(404, "LOT_NOT_FOUND", "procurement lot not found")
    
    lot["paymentStatus"] = "paid"
    lot["paymentMode"] = paymentMode
    lot["utrNumber"] = utrNo or f"UTR{uuid.uuid4().hex[:10].upper()}"
    lot["paidAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc(f"users/{uid}/seller_procurement", lot_id, lot)
    return lot

