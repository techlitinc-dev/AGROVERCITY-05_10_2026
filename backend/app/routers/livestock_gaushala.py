import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import delete_doc, get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.livestock_mgmt import (
    AdoptionStatusIn,
    CattleEventIn,
    DonationStatusIn,
    GaushalaExpenseIn,
    GaushalaProfileIn,
)
from app.routers.users import require_role
from app.services.notifications import send_fcm_to_user
from app.services.users import get_user

router = APIRouter(tags=["livestock"])

_CATTLE_STATUS = {
    "intake": "in-shelter",
    "adopted-out": "adopted-out",
    "deceased": "deceased",
    "transferred": "transferred",
}


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _envelope(docs: list[dict], page: int, page_size: int) -> dict:
    total = len(docs)
    start = (page - 1) * page_size
    return {"data": docs[start:start + page_size], "page": page, "pageSize": page_size, "total": total}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _notify(uid: str, title: str, body: str, data: dict):
    if not uid:
        return
    await send_fcm_to_user(uid, title, body, data)


async def _manager(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "dairyManager")
    return uid


async def _my_gaushala(uid: str) -> dict | None:
    docs = await query("gaushalas", [("managerId", "==", uid)], limit=10)
    return docs[0] if docs else None


async def _require_gaushala(uid: str) -> dict:
    gaushala = await _my_gaushala(uid)
    if not gaushala:
        _error(404, "GAUSHALA_NOT_FOUND", "no gaushala profile linked to this manager")
    return gaushala


async def _create_receipt(kind: str, ref_id: str, person_name: str, amount, gaushala, issued_by: str) -> dict:
    receipt_id = f"crt_{uuid.uuid4().hex[:12]}"
    cert_no = f"GOSH-{datetime.now(timezone.utc).year}-{kind.upper()}-{uuid.uuid4().hex[:6].upper()}"
    doc = {
        "id": receipt_id,
        "kind": kind,
        "refId": ref_id,
        "personName": person_name,
        "amount": amount,
        "panNumber": "",
        "eightyGEligible": True,
        "certificateNumber": cert_no,
        "certificateUrl": "",
        "issuedBy": issued_by,
        "gaushalaId": gaushala.get("id", ""),
        "gaushalaName": gaushala.get("name", ""),
        "issuedAt": _now(),
    }
    await set_doc("receipts", receipt_id, doc)
    return doc


# =========================================================================
# Gaushala profile
# =========================================================================

@router.get("/livestock/gaushala/mine")
async def get_my_gaushala(uid: str = Depends(_manager)):
    return await _require_gaushala(uid)


@router.post("/livestock/gaushala/profile", status_code=201)
async def create_gaushala_profile(body: GaushalaProfileIn, uid: str = Depends(_manager)):
    if await _my_gaushala(uid):
        _error(409, "GAUSHALA_EXISTS", "manager already has a gaushala profile")
    gaushala_id = f"gau_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": gaushala_id,
        "managerId": uid,
        "name": body.name,
        "trustName": body.trustName,
        "address": body.address,
        "district": body.district,
        "phone": body.phone,
        "capacity": body.capacity,
        "certifications": body.certifications,
        "bankDetails": body.bankDetails,
        "cowCount": 0,
        "rating": 0.0,
        "createdAt": _now(),
    }
    await set_doc("gaushalas", gaushala_id, doc)
    return doc


@router.put("/livestock/gaushala/profile")
async def update_gaushala_profile(body: GaushalaProfileIn, uid: str = Depends(_manager)):
    doc = await _require_gaushala(uid)
    doc.update({
        "name": body.name,
        "trustName": body.trustName,
        "address": body.address,
        "district": body.district,
        "phone": body.phone,
        "capacity": body.capacity,
        "certifications": body.certifications,
        "bankDetails": body.bankDetails,
        "updatedAt": _now(),
    })
    await set_doc("gaushalas", doc["id"], doc)
    return doc


# =========================================================================
# Cattle inventory & events
# =========================================================================

@router.get("/livestock/gaushala/cattle")
async def list_cattle(
    category: str | None = None,
    page: int = 1,
    pageSize: int = 50,
    uid: str = Depends(_manager),
):
    gaushala = await _require_gaushala(uid)
    docs = await query("livestock_animals", [("gaushalaId", "==", gaushala["id"])], limit=500)
    if category:
        docs = [d for d in docs if d.get("category", "other") == category]
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return _envelope(docs, page, pageSize)


@router.post("/livestock/gaushala/cattle/{animal_id}/events", status_code=201)
async def add_cattle_event(animal_id: str, body: CattleEventIn, uid: str = Depends(_manager)):
    gaushala = await _require_gaushala(uid)
    animal = await get_doc("livestock_animals", animal_id)
    if not animal or animal.get("gaushalaId") != gaushala["id"]:
        _error(404, "CATTLE_NOT_FOUND", "cattle not found in this gaushala")
    event = {
        "type": body.type,
        "note": body.note,
        "date": body.date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "at": _now(),
    }
    events = animal.get("events") or []
    events.append(event)
    animal["events"] = events
    animal["cattleStatus"] = _CATTLE_STATUS[body.type]
    if body.type == "intake":
        animal["source"] = animal.get("source") or "rescued"
    await set_doc("livestock_animals", animal_id, animal)
    return animal


# =========================================================================
# Adoptions & donations
# =========================================================================

@router.put("/livestock/gaushala/adoptions/{adoption_id}/status")
async def update_adoption_status(adoption_id: str, body: AdoptionStatusIn, uid: str = Depends(_manager)):
    gaushala = await _require_gaushala(uid)
    adoption = await get_doc("cow_adoptions", adoption_id)
    if not adoption or adoption.get("gaushalaId") != gaushala["id"]:
        _error(404, "ADOPTION_NOT_FOUND", "adoption not found")
    current = adoption.get("status", "active")
    allowed = {
        "active": {"approved", "rejected"},
        "approved": {"completed", "rejected"},
    }
    if body.status not in allowed.get(current, set()):
        _error(409, "INVALID_TRANSITION", f"cannot move adoption from {current} to {body.status}")
    adoption["status"] = body.status
    adoption["updatedAt"] = _now()
    await set_doc("cow_adoptions", adoption_id, adoption)
    receipt = None
    if body.status == "approved":
        receipt = await _create_receipt(
            "adoption", adoption_id, adoption.get("donorName", ""),
            adoption.get("amountInr"), gaushala, uid,
        )
        adoption["receiptId"] = receipt["id"]
        await set_doc("cow_adoptions", adoption_id, adoption)
        await _notify(
            adoption.get("donorId", ""),
            "गोदत्तक स्वीकृत (Adoption Approved)",
            f"आपका गोदत्तक अनुरोध स्वीकृत हुआ। रसीद क्र. {receipt['certificateNumber']} जारी की गई है।",
            {"kind": "adoption_approved", "adoptionId": adoption_id, "receiptId": receipt["id"]},
        )
    return {"adoption": adoption, "receipt": receipt}


@router.put("/livestock/gaushala/donations/{donation_id}/status")
async def update_donation_status(donation_id: str, body: DonationStatusIn, uid: str = Depends(_manager)):
    gaushala = await _require_gaushala(uid)
    donation = await get_doc("fodder_donations", donation_id)
    if not donation or donation.get("gaushalaId") != gaushala["id"]:
        _error(404, "DONATION_NOT_FOUND", "donation not found")
    donation["status"] = body.status
    donation["updatedAt"] = _now()
    await set_doc("fodder_donations", donation_id, donation)
    receipt = None
    if body.status == "acknowledged":
        receipt = await _create_receipt(
            "donation", donation_id, donation.get("donorName", ""),
            donation.get("amountInr"), gaushala, uid,
        )
        await _notify(
            donation.get("donorId", ""),
            "दान रसीद जारी (Donation Receipt)",
            f"आपके दान की 80G रसीद क्र. {receipt['certificateNumber']} जारी की गई है।",
            {"kind": "donation_acknowledged", "donationId": donation_id, "receiptId": receipt["id"]},
        )
    return {"donation": donation, "receipt": receipt}


# =========================================================================
# Expenses
# =========================================================================

@router.get("/livestock/gaushala/expenses")
async def list_expenses(
    month: str | None = None,
    page: int = 1,
    pageSize: int = 50,
    uid: str = Depends(_manager),
):
    gaushala = await _require_gaushala(uid)
    docs = await query("gaushala_expenses", [("gaushalaId", "==", gaushala["id"])], limit=500)
    if month:
        docs = [d for d in docs if d.get("expenseDate", "").startswith(month)]
    docs.sort(key=lambda d: d.get("expenseDate", ""), reverse=True)
    return _envelope(docs, page, pageSize)


@router.post("/livestock/gaushala/expenses", status_code=201)
async def create_expense(body: GaushalaExpenseIn, uid: str = Depends(_manager)):
    gaushala = await _require_gaushala(uid)
    expense_id = f"exp_{uuid.uuid4().hex[:12]}"
    doc = {
        "id": expense_id,
        "gaushalaId": gaushala["id"],
        "category": body.category,
        "amount": body.amount,
        "note": body.note,
        "expenseDate": body.expenseDate,
        "createdBy": uid,
        "createdAt": _now(),
    }
    await set_doc("gaushala_expenses", expense_id, doc)
    return doc


@router.put("/livestock/gaushala/expenses/{expense_id}")
async def update_expense(expense_id: str, body: GaushalaExpenseIn, uid: str = Depends(_manager)):
    gaushala = await _require_gaushala(uid)
    doc = await get_doc("gaushala_expenses", expense_id)
    if not doc or doc.get("gaushalaId") != gaushala["id"]:
        _error(404, "EXPENSE_NOT_FOUND", "expense not found")
    doc.update({
        "category": body.category,
        "amount": body.amount,
        "note": body.note,
        "expenseDate": body.expenseDate,
        "updatedAt": _now(),
    })
    await set_doc("gaushala_expenses", expense_id, doc)
    return doc


@router.delete("/livestock/gaushala/expenses/{expense_id}")
async def delete_expense(expense_id: str, uid: str = Depends(_manager)):
    gaushala = await _require_gaushala(uid)
    doc = await get_doc("gaushala_expenses", expense_id)
    if not doc or doc.get("gaushalaId") != gaushala["id"]:
        _error(404, "EXPENSE_NOT_FOUND", "expense not found")
    await delete_doc("gaushala_expenses", expense_id)
    return {"success": True, "id": expense_id}


@router.get("/livestock/gaushala/expenses/summary")
async def expenses_summary(month: str | None = None, uid: str = Depends(_manager)):
    gaushala = await _require_gaushala(uid)
    docs = await query("gaushala_expenses", [("gaushalaId", "==", gaushala["id"])], limit=500)
    if month:
        docs = [d for d in docs if d.get("expenseDate", "").startswith(month)]
    by_category: dict[str, float] = {}
    for d in docs:
        cat = d.get("category", "other")
        by_category[cat] = round(by_category.get(cat, 0.0) + d.get("amount", 0.0), 2)
    return {
        "month": month or "all",
        "total": round(sum(by_category.values()), 2),
        "count": len(docs),
        "byCategory": by_category,
    }


# =========================================================================
# Dashboard
# =========================================================================

@router.get("/livestock/gaushala/dashboard")
async def dashboard(uid: str = Depends(_manager)):
    gaushala = await _require_gaushala(uid)
    cattle = await query("livestock_animals", [("gaushalaId", "==", gaushala["id"])], limit=1000)
    by_category: dict[str, int] = {}
    for animal in cattle:
        cat = animal.get("category") or animal.get("lactationStatus") or "other"
        by_category[cat] = by_category.get(cat, 0) + 1
    adoptions = await query("cow_adoptions", [("gaushalaId", "==", gaushala["id"])], limit=500)
    active_adoptions = [a for a in adoptions if a.get("status") in ("active", "approved")]
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    donations = await query("fodder_donations", [("gaushalaId", "==", gaushala["id"])], limit=500)
    donations_month = [d for d in donations if d.get("createdAt", "").startswith(month)]
    expenses = await query("gaushala_expenses", [("gaushalaId", "==", gaushala["id"])], limit=500)
    expenses_month = [e for e in expenses if e.get("expenseDate", "").startswith(month)]
    headcount = len([c for c in cattle if c.get("cattleStatus", "in-shelter") != "deceased"])
    return {
        "gaushalaId": gaushala["id"],
        "headcount": headcount,
        "byCategory": by_category,
        "activeAdoptions": len(active_adoptions),
        "donationsMonthTotal": round(sum(d.get("amountInr", 0) for d in donations_month), 2),
        "expensesMonthTotal": round(sum(e.get("amount", 0.0) for e in expenses_month), 2),
        "capacity": gaushala.get("capacity", 0),
        "occupancy": headcount,
        "occupancyPercent": round(headcount * 100 / gaushala["capacity"], 1) if gaushala.get("capacity") else None,
    }


# =========================================================================
# Analytics & receipts
# =========================================================================

def _last_months(n: int) -> list[str]:
    current = datetime.now(timezone.utc).strftime("%Y-%m")
    months = []
    year, mon = int(current[:4]), int(current[5:7])
    for i in range(n - 1, -1, -1):
        m = mon - i
        y = year
        while m < 1:
            m += 12
            y -= 1
        months.append(f"{y:04d}-{m:02d}")
    return months


@router.get("/livestock/gaushala/analytics")
async def gaushala_analytics(month: str | None = None, uid: str = Depends(_manager)):
    gaushala = await _require_gaushala(uid)
    target = month or datetime.now(timezone.utc).strftime("%Y-%m")
    months = _last_months(6)
    expenses = await query("gaushala_expenses", [("gaushalaId", "==", gaushala["id"])], limit=500)
    donations = await query("fodder_donations", [("gaushalaId", "==", gaushala["id"])], limit=500)
    adoptions = await query("cow_adoptions", [("gaushalaId", "==", gaushala["id"])], limit=500)
    cattle = await query("livestock_animals", [("gaushalaId", "==", gaushala["id"])], limit=1000)

    monthly_map: dict[str, dict] = {
        m: {"month": m, "expenses": 0.0, "donations": 0.0, "adoptions": 0, "adoptionAmount": 0.0, "intakes": 0}
        for m in months
    }
    for e in expenses:
        key = e.get("expenseDate", "")[:7]
        if key in monthly_map:
            monthly_map[key]["expenses"] = round(monthly_map[key]["expenses"] + e.get("amount", 0.0), 2)
    for d in donations:
        key = d.get("createdAt", "")[:7]
        if key in monthly_map:
            monthly_map[key]["donations"] = round(monthly_map[key]["donations"] + d.get("amountInr", 0), 2)
    for a in adoptions:
        key = a.get("createdAt", "")[:7]
        if key in monthly_map:
            monthly_map[key]["adoptions"] += 1
            monthly_map[key]["adoptionAmount"] = round(
                monthly_map[key]["adoptionAmount"] + a.get("amountInr", 0), 2
            )
    for animal in cattle:
        for event in animal.get("events") or []:
            if event.get("type") == "intake":
                key = (event.get("date") or "")[:7]
                if key in monthly_map:
                    monthly_map[key]["intakes"] += 1

    by_category: dict[str, float] = {}
    for e in expenses:
        if e.get("expenseDate", "").startswith(target):
            cat = e.get("category", "other")
            by_category[cat] = round(by_category.get(cat, 0.0) + e.get("amount", 0.0), 2)
    by_status: dict[str, int] = {}
    for animal in cattle:
        status = animal.get("cattleStatus", "in-shelter")
        by_status[status] = by_status.get(status, 0) + 1

    return {
        "month": target,
        "monthly": [monthly_map[m] for m in months],
        "expenseByCategory": by_category,
        "cattleByStatus": by_status,
    }


@router.get("/livestock/gaushala/receipts")
async def list_receipts(
    page: int = 1,
    pageSize: int = 50,
    uid: str = Depends(_manager),
):
    gaushala = await _require_gaushala(uid)
    docs = await query("receipts", [("gaushalaId", "==", gaushala["id"])], limit=500)
    docs.sort(key=lambda d: d.get("issuedAt", ""), reverse=True)
    return _envelope(docs, page, pageSize)
