import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from pydantic import BaseModel

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.mandi import SellerRateRequest
from app.models.seller import BuyerLedgerEntryCreate, ProcurementLotCreate, SaleEntryCreate
from app.routers.users import require_role
from app.services import idempotency
from app.services import kyc as kyc_service
from app.services import reports
from app.services import settlements as settlements_service
from app.services.billing import effective_plan
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


async def _farmer_user(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer")
    return uid


async def _assert_shop_kyc(uid: str):
    """S1: rate posting and procurement require the phase-00 shop KYC case to
    be verified (APMC licence + GST on top of the base docs)."""
    case = await kyc_service.get_case(kyc_service.case_id_for(uid, "seller"))
    if case is None or case.get("status") != "verified":
        _error(
            403,
            "SHOP_KYC_REQUIRED",
            "shop KYC must be verified before posting rates or recording procurement",
        )


async def _plan_feature_guard(uid: str, feature: str) -> dict:
    """402 ENTITLEMENT_EXCEEDED when the seller's plan lacks a named SaaS
    feature (WS-03 step 8: GST invoices / TDS statements / analytics v2 are
    Pro+; Free is commission 2% min ₹50 + basic khata)."""
    plan = await effective_plan(uid, "seller")
    if feature not in (plan.get("features") or []):
        raise HTTPException(
            status_code=402,
            detail={
                "code": "ENTITLEMENT_EXCEEDED",
                "message": f"{feature} is not available on the {plan.get('tier')} plan — upgrade to Pro",
                "fieldErrors": {},
                "planId": plan.get("planId"),
                "feature": feature,
            },
        )
    return plan


async def _mirror_procurement_to_farmer(lot: dict):
    """S4: the farmer procured from sees a trust card + receipt — mirror a slim
    copy into the farmer's space (matched by the phone captured on the J-form).
    Offline farmers (no account for that phone) are skipped silently."""
    phone = (lot.get("farmerPhone") or "").strip()
    if not phone:
        return
    farmers = await query("users", [("phone", "==", phone)], limit=1)
    if not farmers:
        return
    farmer_id = farmers[0]["id"]
    mirror = {
        "id": lot["id"],
        "jFormNumber": lot.get("jFormNumber"),
        "crop": lot.get("crop"),
        "variety": lot.get("variety", ""),
        "netWeightQuintals": lot.get("netWeightQuintals"),
        "ratePerQuintal": lot.get("ratePerQuintal"),
        "finalAmount": lot.get("finalAmount"),
        "paymentStatus": lot.get("paymentStatus"),
        "paymentMode": lot.get("paymentMode"),
        "utrNumber": lot.get("utrNumber"),
        "receiptNo": lot.get("receiptNo"),
        "paidAt": lot.get("paidAt"),
        "amountPaisa": lot.get("amountPaisa"),
        "sellerId": lot.get("sellerId"),
        "sellerName": "",
        "createdAt": lot.get("createdAt"),
        "paymentStatusUpdatedAt": lot.get("paymentStatusUpdatedAt"),
    }
    seller = await get_user(lot.get("sellerId"))
    if seller:
        mirror["sellerName"] = seller.get("name") or seller.get("businessName") or ""
    await set_doc(f"users/{farmer_id}/procurement_payments", lot["id"], mirror)


def _loose_mandi_match(posted: str, actual: str) -> bool:
    words = [w for w in posted.lower().split() if len(w) > 3]
    return any(w in actual.lower() for w in words)


# S2: edits to a posted rate are allowed only within this window of createdAt.
RATE_EDIT_WINDOW_HOURS = 2


async def _band_violation(crop: str, rate_per_kg: float, mandi_name: str) -> str | None:
    """Return the band error message when outside modal ±25%, else None (S2)."""
    per_quintal = rate_per_kg * 100
    docs = await query("mandi_prices", [], limit=1000)
    matches = [d for d in docs if crop.lower() in d.get("commodity", "").lower()]
    reference = next((d for d in matches if _loose_mandi_match(mandi_name, d.get("mandiName", ""))), None)
    if reference is None and matches:
        reference = matches[0]
    if reference is None:
        return None  # no reference crop → accepted; coverage gap handled by admin queue
    modal = reference["modalPrice"]
    if per_quintal < modal * 0.75 or per_quintal > modal * 1.25:
        return f"मंडी भाव ₹{modal} के ±25% सीमा से बाहर"
    return None


async def _assert_rate_in_band(crop: str, rate_per_kg: float, mandi_name: str):
    """±25% sanity band vs the Agmarknet modal price (S2) — shared by post and edit."""
    violation = await _band_violation(crop, rate_per_kg, mandi_name)
    if violation is not None:
        _error(
            422,
            "RATE_OUT_OF_BAND",
            "posted rate is outside the sanity band",
            {"ratePerKg": violation},
        )
    # No reference for the crop → accept; the coverage gap is handled by the admin moderation queue (Day 14 item A6).


@router.post("/rates")
async def post_rate(body: SellerRateRequest, ctx: tuple = Depends(_seller_user)):
    _, uid = ctx
    await _assert_shop_kyc(uid)
    await _assert_rate_in_band(body.crop, body.ratePerKg, body.mandiName)
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


@router.patch("/rates/{rate_id}")
async def edit_rate(rate_id: str, body: SellerRateRequest, ctx: tuple = Depends(_seller_user)):
    """S2: a posted rate may be edited only within 2 hours of creation, and the
    edit re-runs the ±25% band check."""
    _, uid = ctx
    await _assert_shop_kyc(uid)
    doc = await get_doc("vyapari_rates_pending", rate_id)
    if doc is None or doc.get("sellerId") != uid:
        _error(404, "RATE_NOT_FOUND", "rate not found")
    created_at = datetime.fromisoformat(str(doc.get("createdAt")))
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    age = datetime.now(timezone.utc) - created_at
    if age > timedelta(hours=RATE_EDIT_WINDOW_HOURS):
        _error(
            422,
            "RATE_EDIT_WINDOW_CLOSED",
            f"rates can only be edited within {RATE_EDIT_WINDOW_HOURS} hours of posting",
        )
    await _assert_rate_in_band(body.crop, body.ratePerKg, body.mandiName)
    doc.update(body.model_dump())
    doc["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("vyapari_rates_pending", rate_id, doc)
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


@router.get("/sales/{sale_id}/invoice.pdf")
async def sale_gst_invoice(sale_id: str, ctx: tuple = Depends(_seller_user)):
    """S6: GST tax invoice PDF for a sale (seller GSTIN from the shop profile).
    GST invoices are a Pro feature (WS-03 step 8)."""
    _, uid = ctx
    sale = await get_doc(f"users/{uid}/seller_sales", sale_id)
    if sale is None:
        _error(404, "SALE_NOT_FOUND", "sale not found")
    await _plan_feature_guard(uid, "gstInvoices")
    seller = await get_user(uid) or {}
    file_path = reports.build_gst_invoice_pdf(sale, seller)
    with open(file_path, "rb") as handle:
        content = handle.read()
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="gst-invoice-{sale_id}.pdf"'},
    )


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
                "totalCreditPaisa": 0,
                "totalPaidPaisa": 0,
                "netBalancePaisa": 0,
                "lastTransaction": entry.get("createdAt", ""),
                "history": [],
            }

        amt = entry.get("amount", 0.0)
        amt_paisa = entry.get("amountPaisa")
        if amt_paisa is None:
            amt_paisa = int(round(amt * 100))
        e_type = entry.get("type", "credit_sale")
        if e_type == "credit_sale":
            buyers_map[b_key]["totalCredit"] += amt
            buyers_map[b_key]["netBalance"] += amt
            buyers_map[b_key]["totalCreditPaisa"] += amt_paisa
            buyers_map[b_key]["netBalancePaisa"] += amt_paisa
        elif e_type == "payment_received":
            buyers_map[b_key]["totalPaid"] += amt
            buyers_map[b_key]["netBalance"] -= amt
            buyers_map[b_key]["totalPaidPaisa"] += amt_paisa
            buyers_map[b_key]["netBalancePaisa"] -= amt_paisa
        elif e_type == "adjustment":
            buyers_map[b_key]["netBalance"] += amt
            buyers_map[b_key]["netBalancePaisa"] += amt_paisa

        enriched = {**entry, "amountPaisa": amt_paisa}
        buyers_map[b_key]["history"].append(enriched)

    # Running balance per entry, computed chronologically (S7).
    for buyer in buyers_map.values():
        running = 0
        for entry in sorted(buyer["history"], key=lambda e: e.get("createdAt", "")):
            e_type = entry.get("type", "credit_sale")
            if e_type == "credit_sale":
                running += entry["amountPaisa"]
            elif e_type == "payment_received":
                running -= entry["amountPaisa"]
            elif e_type == "adjustment":
                running += entry["amountPaisa"]
            entry["balanceAfterPaisa"] = running

    buyers_list = list(buyers_map.values())
    buyers_list.sort(key=lambda b: b["netBalance"], reverse=True)
    total_due = sum(b["netBalance"] for b in buyers_list if b["netBalance"] > 0)

    return {
        "data": buyers_list,
        "entries": entries,
        "totalCreditOutstanding": round(total_due, 2),
        "totalCreditOutstandingPaisa": sum(
            b["netBalancePaisa"] for b in buyers_list if b["netBalancePaisa"] > 0
        ),
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
    await _assert_shop_kyc(uid)
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
    await _mirror_procurement_to_farmer(doc)
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
    lot.setdefault("receiptNo", f"RCP-{lot.get('jFormNumber', lot_id)}")
    await set_doc(f"users/{uid}/seller_procurement", lot_id, lot)
    await _mirror_procurement_to_farmer(lot)
    audit_id = f"aud_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_{lot_id}_pay"
    await set_doc("audit_logs", audit_id, {
        "action": "PROCUREMENT_PAYMENT_STATUS",
        "actorId": uid,
        "targetId": lot_id,
        "newStatus": "paid",
        "paymentMode": paymentMode,
        "utrNumber": lot["utrNumber"],
        "amountPaisa": lot.get("amountPaisa"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    return lot


class ProcurementPaymentStatusUpdate(BaseModel):
    status: str  # "paid" | "udhaar" — validated manually for the standard envelope
    amountPaisa: int | None = None


@router.post("/procurement/{lot_id}/payment-status")
async def set_procurement_payment_status(
    lot_id: str,
    body: ProcurementPaymentStatusUpdate,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    ctx: tuple = Depends(_seller_user),
):
    """S3/S4: per-procurement payment status `paid | udhaar` with an
    idempotent transition and an audit_logs write (rule 3). Integer paisa only.
    """
    _, uid = ctx
    if not idempotency_key:
        _error(400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required")
    replayed = await idempotency.replay(f"procurement.{lot_id}.payment_status", idempotency_key)
    if replayed is not None:
        return replayed
    if body.status not in ("paid", "udhaar"):
        _error(422, "INVALID_STATUS", "status must be 'paid' or 'udhaar'", {"status": "must be paid or udhaar"})
    if body.amountPaisa is not None and (isinstance(body.amountPaisa, bool) or body.amountPaisa < 0):
        _error(422, "INVALID_AMOUNT", "amountPaisa must be a non-negative integer", {"amountPaisa": "must be >= 0"})
    lot = await get_doc(f"users/{uid}/seller_procurement", lot_id)
    if lot is None:
        _error(404, "LOT_NOT_FOUND", "procurement lot not found")

    lot["paymentStatus"] = body.status
    if body.amountPaisa is not None:
        lot["amountPaisa"] = body.amountPaisa
    if body.status == "paid":
        lot["paidAt"] = datetime.now(timezone.utc).isoformat()
        lot.setdefault("utrNumber", f"UTR{uuid.uuid4().hex[:10].upper()}")
        lot.setdefault("receiptNo", f"RCP-{lot.get('jFormNumber', lot_id)}")
    lot["paymentStatusUpdatedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc(f"users/{uid}/seller_procurement", lot_id, lot)
    await _mirror_procurement_to_farmer(lot)

    audit_id = f"aud_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_{lot_id}_{body.status}"
    await set_doc("audit_logs", audit_id, {
        "action": "PROCUREMENT_PAYMENT_STATUS",
        "actorId": uid,
        "targetId": lot_id,
        "newStatus": body.status,
        "amountPaisa": body.amountPaisa,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    await idempotency.store(f"procurement.{lot_id}.payment_status", idempotency_key, lot)
    return lot



# ==========================================
# FARMER-FACING PROCUREMENT VIEW (S4)
# ==========================================

@router.get("/procurement/mine")
async def my_procurement_payments(uid: str = Depends(_farmer_user)):
    """The farmer's view of J-form procurements recorded against their phone:
    'payment pending' trust card while udhaar, the receipt once paid."""
    docs = await query(f"users/{uid}/procurement_payments", [], limit=500)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    pending = sum(1 for d in docs if d.get("paymentStatus") == "udhaar")
    return {"data": docs, "pendingCount": pending, "total": len(docs)}


@router.get("/procurement/mine/{payment_id}/receipt")
async def procurement_receipt(payment_id: str, uid: str = Depends(_farmer_user)):
    """Receipt for a paid procurement (S4) — available only after mark-paid."""
    doc = await get_doc(f"users/{uid}/procurement_payments", payment_id)
    if doc is None:
        _error(404, "PAYMENT_NOT_FOUND", "procurement payment not found")
    if doc.get("paymentStatus") != "paid":
        _error(409, "RECEIPT_NOT_AVAILABLE", "receipt is available once the payment is marked paid")
    return doc


# ==========================================
# TDS 194-O STATEMENTS (S6)
# ==========================================

def _in_period(date_str: str | None, period_start: str, period_end: str) -> bool:
    day = (date_str or "")[:10]
    return bool(day) and period_start <= day <= period_end


@router.get("/tds-statements")
async def list_tds_statements(ctx: tuple = Depends(_seller_user)):
    """All TDS 194-O statements issued for this vyapari (integer paisa)."""
    _, uid = ctx
    docs = await query(
        "tds_ledger", [("persona", "==", "seller"), ("entityId", "==", uid)], limit=500
    )
    docs.sort(key=lambda d: d.get("period", ""), reverse=True)
    return {
        "data": docs,
        "totalTdsPaisa": sum(int(d.get("tdsPaisa", 0)) for d in docs),
        "total": len(docs),
    }


@router.get("/tds-statements/statement.pdf")
async def tds_statement_pdf(
    periodStart: str,
    periodEnd: str,
    ctx: tuple = Depends(_seller_user),
):
    """Compute (idempotently) and download the TDS 194-O statement for a
    settlement period — 1% of the seller's gross marketplace GMV in paisa.
    TDS statements are a Pro feature (WS-03 step 8)."""
    _, uid = ctx
    await _plan_feature_guard(uid, "tdsStatements")
    for raw in (periodStart, periodEnd):
        try:
            datetime.strptime(raw, "%Y-%m-%d")
        except ValueError:
            _error(422, "INVALID_PERIOD", "periodStart/periodEnd must be YYYY-MM-DD")
    sales = await query(f"users/{uid}/seller_sales", [], limit=1000)
    gross_paisa = sum(
        int(round(float(s.get("netAmount", 0) or 0) * 100))
        for s in sales
        if _in_period(s.get("createdAt"), periodStart, periodEnd)
    )
    tds_paisa = int(round(gross_paisa * settlements_service.TDS_194O_RATE))
    txn_id = f"seller_{uid[:8]}_{periodStart}"
    statement = {
        "txnId": txn_id,
        "persona": "seller",
        "entityId": uid,
        "grossPaisa": gross_paisa,
        "tdsPaisa": tds_paisa,
        "section": "194-O",
        "period": f"{periodStart}..{periodEnd}",
        "at": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("tds_ledger", f"tds_{txn_id}", statement)
    seller = await get_user(uid) or {}
    file_path = reports.build_tds_statement_pdf(statement, seller)
    with open(file_path, "rb") as handle:
        content = handle.read()
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="tds-{periodStart}.pdf"'},
    )


# ==========================================
# BUYER NETWORK / B2B (S5)
# ==========================================

class BulkOrderCreate(BaseModel):
    crop: str
    quantityQuintals: float
    targetPricePerQuintal: float | None = None
    neededBy: str | None = None
    notes: str | None = None


@router.post("/bulk-orders", status_code=201)
async def post_bulk_order(
    body: BulkOrderCreate,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(current_user_id),
):
    """A wholesale buyer posts a bulk requirement to the vyapari network (S5)."""
    if not idempotency_key:
        _error(400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required")
    replayed = await idempotency.replay(f"seller.bulk_orders", idempotency_key)
    if replayed is not None:
        return replayed
    if not body.crop.strip() or body.quantityQuintals <= 0:
        _error(422, "VALIDATION_ERROR", "crop and a positive quantity are required")
    user = await get_user(uid) or {}
    doc = {
        "id": f"bko_{uuid.uuid4().hex[:10]}",
        "buyerId": uid,
        "buyerName": user.get("name", ""),
        "buyerPhone": user.get("phone", ""),
        "crop": body.crop.strip(),
        "quantityQuintals": body.quantityQuintals,
        "targetPricePerQuintal": body.targetPricePerQuintal,
        "neededBy": body.neededBy,
        "notes": body.notes,
        "status": "open",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("seller_bulk_orders", doc["id"], doc)
    await idempotency.store(f"seller.bulk_orders", idempotency_key, doc)
    return doc


@router.get("/bulk-orders")
async def list_bulk_orders(ctx: tuple = Depends(_seller_user)):
    """The vyapari's incoming bulk-order requirements (S5)."""
    _, uid = ctx
    docs = await query("seller_bulk_orders", [], limit=500)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    open_count = sum(1 for d in docs if d.get("status") == "open")
    return {"data": docs, "openCount": open_count, "total": len(docs)}


@router.get("/buyer-directory")
async def buyer_directory(ctx: tuple = Depends(_seller_user)):
    """S5: buyer directory — buyers from the khata ledger plus bulk-order
    posters, with order counts."""
    _, uid = ctx
    directory: dict[str, dict] = {}
    ledgers = await query(f"users/{uid}/seller_buyer_ledgers", [], limit=1000)
    for entry in ledgers:
        phone = entry.get("buyerPhone", "")
        key = f"{entry.get('buyerName', 'Unknown')}_{phone}"
        row = directory.setdefault(key, {
            "buyerName": entry.get("buyerName", "Unknown"),
            "buyerPhone": phone,
            "companyName": entry.get("companyName", ""),
            "ledgerEntries": 0,
            "bulkOrders": 0,
        })
        row["ledgerEntries"] += 1
    orders = await query("seller_bulk_orders", [], limit=500)
    for order in orders:
        phone = order.get("buyerPhone", "")
        key = f"{order.get('buyerName', 'Unknown')}_{phone}"
        row = directory.setdefault(key, {
            "buyerName": order.get("buyerName", "Unknown"),
            "buyerPhone": phone,
            "companyName": "",
            "ledgerEntries": 0,
            "bulkOrders": 0,
        })
        row["bulkOrders"] += 1
    rows = sorted(directory.values(), key=lambda r: r["bulkOrders"] + r["ledgerEntries"], reverse=True)
    return {"data": rows, "total": len(rows)}


# ==========================================
# VYAPARI DASHBOARD SUMMARY (instructions.md WS-03 step 7)
# ==========================================

def _next_monday(today) -> str:
    return (today + timedelta(days=(7 - today.weekday()) % 7 or 7)).isoformat()


@router.get("/dashboard")
async def seller_dashboard(ctx: tuple = Depends(_seller_user)):
    """Home-screen summary: today's procurement (q + integer paisa), pending
    farmer payments (trust-critical), stock position, rate band status, open
    offers/negotiations, udhaar outstanding, and the settlement ETA."""
    _, uid = ctx
    today_iso = datetime.now(timezone.utc).date().isoformat()

    lots = await query(f"users/{uid}/seller_procurement", [], limit=1000)
    today_lots = [l for l in lots if str(l.get("createdAt", ""))[:10] == today_iso]
    today_procurement = {
        "lotsCount": len(today_lots),
        "quantityQuintals": round(sum(l.get("netWeightQuintals", 0) or 0 for l in today_lots), 2),
        "amountPaisa": sum(int(round(float(l.get("finalAmount", 0) or 0) * 100)) for l in today_lots),
    }
    pending = [l for l in lots if l.get("paymentStatus") in ("unpaid", "partial", "udhaar")]
    pending_farmer_payments = {
        "count": len(pending),
        "amountPaisa": sum(int(round(float(l.get("finalAmount", 0) or 0) * 100)) for l in pending),
        "pinned": True,
    }

    stock: dict[str, float] = {}
    for lot in lots:
        crop = lot.get("crop", "Unknown")
        stock[crop] = round(stock.get(crop, 0) + float(lot.get("netWeightQuintals", 0) or 0), 2)
    stock_position = [
        {"crop": crop, "quantityQuintals": qty}
        for crop, qty in sorted(stock.items(), key=lambda kv: kv[1], reverse=True)
    ]

    rates = await query("vyapari_rates_pending", [("sellerId", "==", uid)], limit=500)
    in_band = out_of_band = 0
    for rate in rates:
        violation = await _band_violation(
            rate.get("crop", ""), float(rate.get("ratePerKg", 0) or 0), rate.get("mandiName", "")
        )
        if violation is None:
            in_band += 1
        else:
            out_of_band += 1
    rate_status = {
        "pendingCount": len(rates),
        "inBand": in_band,
        "outOfBand": out_of_band,
    }

    offers = await query("offers", [], limit=1000)
    mine = [
        o for o in offers
        if uid in (o.get("fromId"), o.get("toId")) and o.get("status") in ("pending", "countered")
    ]
    open_offers = {
        "count": len(mine),
        "data": [
            {
                "id": o["id"],
                "crop": o.get("targetType"),
                "status": o.get("status"),
                "pricePerUnit": o.get("pricePerUnit"),
                "quantity": o.get("quantity"),
                "counterparty": o.get("toName") if o.get("fromId") == uid else o.get("fromName"),
            }
            for o in mine[:10]
        ],
    }

    entries = await query(f"users/{uid}/seller_buyer_ledgers", [], limit=1000)
    udhaar_paisa = 0
    for entry in entries:
        amt = entry.get("amountPaisa")
        if amt is None:
            amt = int(round(float(entry.get("amount", 0) or 0) * 100))
        e_type = entry.get("type", "credit_sale")
        if e_type == "credit_sale":
            udhaar_paisa += amt
        elif e_type == "payment_received":
            udhaar_paisa -= amt
        elif e_type == "adjustment":
            udhaar_paisa += amt
    udhaar_outstanding = {"netPaisa": max(udhaar_paisa, 0)}

    settlements = await query("settlements", [("role", "==", "seller"), ("entityId", "==", uid)], limit=100)
    pending_settlements = sorted(
        (s for s in settlements if s.get("status") == "pending"),
        key=lambda s: s.get("periodStart", ""),
    )
    settlement_eta = (
        {
            "periodStart": pending_settlements[0].get("periodStart"),
            "periodEnd": pending_settlements[0].get("periodEnd"),
            "netRupees": pending_settlements[0].get("netRupees"),
        }
        if pending_settlements
        else {"nextRunDate": _next_monday(datetime.now(timezone.utc).date())}
    )

    return {
        "todayProcurement": today_procurement,
        "pendingFarmerPayments": pending_farmer_payments,
        "stockPosition": stock_position,
        "rateStatus": rate_status,
        "openOffers": open_offers,
        "udhaarOutstanding": udhaar_outstanding,
        "settlementEta": settlement_eta,
    }
