"""Milk-seller persona: client (customer) management, the daily delivery
ledger, monthly billing with missed-day detail, and analytics.

This replaces the paper notebook / punch-card system door-to-door milk
sellers use today: every client gets one delivered/missed/holiday entry per
day, and the month-end bill (with the missed-days list clients always ask
about) is computed from that ledger instead of by hand.
"""

import calendar
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from app.core.db import delete_doc, get_doc, query, set_doc
from app.core.deps import current_user_id
from app.routers.users import require_role
from app.services import idempotency
from app.services.notify import notify_user
from app.services.users import get_user

router = APIRouter(prefix="/milk-seller", tags=["milk-seller"])

CLIENTS = "milk_clients"
DELIVERIES = "milk_deliveries"
BILLS = "milk_bills"

DeliveryStatus = Literal["delivered", "missed", "holiday"]
BillStatus = Literal["draft", "sent", "partial", "paid"]


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def _seller(uid: str = Depends(current_user_id)) -> dict:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    profiles = user.get("linkedProfiles") or [user.get("activeProfile") or "milkSeller"]
    if "milkSeller" not in profiles and not user.get("isAdmin"):
        require_role(user, "milkSeller")
    return user


def _last10(phone: str) -> str:
    digits = "".join(ch for ch in str(phone or "") if ch.isdigit())
    return digits[-10:]


async def _find_uid_by_phone(phone: str | None) -> str | None:
    if not phone:
        return None
    hits = await query("users", [("phone", "==", phone)], limit=1)
    if hits:
        return hits[0].get("id")
    target = _last10(phone)
    if target:
        for user in await query("users", [], limit=1000):
            if _last10(user.get("phone", "")) == target:
                return user.get("id")
    return None


async def _notify(uid: str | None, *, type: str, title: str, body: str = ""):
    if not uid:
        return
    try:
        await notify_user(uid, type=type, title=title, body=body)
    except Exception:  # noqa: BLE001 — a failed notice must never fail the action
        pass


def _parse_date(value: str) -> str:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date().isoformat()
    except (ValueError, TypeError):
        _error(422, "INVALID_DATE", "date must be YYYY-MM-DD")


def _month_bounds(month: str) -> tuple[date, date]:
    try:
        start = datetime.strptime(month, "%Y-%m").date()
    except (ValueError, TypeError):
        _error(422, "INVALID_MONTH", "month must be YYYY-MM")
    last_day = calendar.monthrange(start.year, start.month)[1]
    return start, start.replace(day=last_day)


def _current_month() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


def _last_months(anchor: str, count: int) -> list[str]:
    start, _ = _month_bounds(anchor)
    months = []
    for i in range(count):
        m = start.month - i
        y = start.year
        while m < 1:
            m += 12
            y -= 1
        months.append(f"{y:04d}-{m:02d}")
    return list(reversed(months))


async def _get_client(uid: str, client_id: str) -> dict:
    client = await get_doc(CLIENTS, client_id)
    if client is None or client.get("sellerId") != uid:
        _error(404, "CLIENT_NOT_FOUND", "client not found")
    return client


async def _client_deliveries(client_id: str) -> list[dict]:
    rows = await query(DELIVERIES, [("clientId", "==", client_id)], limit=5000)
    return sorted(rows, key=lambda d: d.get("date", ""))


def _entry_amount(status: str, qty: float | None, rate: float | None) -> float:
    if status != "delivered" or not qty or not rate:
        return 0.0
    return round(qty * rate, 2)


def _public_bill(bill: dict) -> dict:
    return bill


def _bill_total(bill: dict) -> float:
    return float((bill.get("summary") or {}).get("totalRupees", bill.get("totalRupees", 0)) or 0)


# ---------------------------------------------------------------- clients --


class ClientCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=20)
    address: str = ""
    deliverySlot: Literal["Morning", "Evening"] = "Morning"
    milkType: Literal["Cow", "Buffalo", "Mixed"] = "Cow"
    defaultQuantityLiters: float = Field(gt=0, le=100)
    ratePerLiter: float = Field(gt=0)
    startDate: str | None = None
    notes: str = ""


class ClientUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=20)
    address: str | None = None
    deliverySlot: Literal["Morning", "Evening"] | None = None
    milkType: Literal["Cow", "Buffalo", "Mixed"] | None = None
    defaultQuantityLiters: float | None = Field(default=None, gt=0, le=100)
    ratePerLiter: float | None = Field(default=None, gt=0)
    startDate: str | None = None
    status: Literal["active", "archived"] | None = None
    notes: str | None = None


@router.post("/clients", status_code=201)
async def create_client(body: ClientCreateIn, user: dict = Depends(_seller)):
    uid = user["id"]
    start = _parse_date(body.startDate) if body.startDate else date.today().isoformat()
    now = datetime.now(timezone.utc).isoformat()
    client = {
        "id": f"mcl_{uuid.uuid4().hex[:12]}",
        "sellerId": uid,
        "sellerName": user.get("name", ""),
        "name": body.name.strip(),
        "phone": body.phone,
        "clientUserId": await _find_uid_by_phone(body.phone),
        "address": body.address,
        "deliverySlot": body.deliverySlot,
        "milkType": body.milkType,
        "defaultQuantityLiters": round(body.defaultQuantityLiters, 2),
        "ratePerLiter": round(body.ratePerLiter, 2),
        "startDate": start,
        "status": "active",
        "notes": body.notes,
        "createdAt": now,
        "updatedAt": now,
    }
    await set_doc(CLIENTS, client["id"], client)
    return client


@router.get("/clients")
async def list_clients(
    status: Literal["active", "archived", "all"] = "active",
    q: str | None = None,
    user: dict = Depends(_seller),
):
    uid = user["id"]
    month = _current_month()
    month_start = f"{month}-01"
    clients = await query(CLIENTS, [("sellerId", "==", uid)], limit=1000)
    deliveries = await query(DELIVERIES, [("sellerId", "==", uid)], limit=5000)
    bills = await query(BILLS, [("sellerId", "==", uid)], limit=1000)

    by_client: dict[str, dict] = {}
    for d in deliveries:
        if d.get("date", "")[:7] != month:
            continue
        agg = by_client.setdefault(
            d["clientId"], {"deliveredDays": 0, "missedDays": 0, "liters": 0.0, "amountRupees": 0.0}
        )
        if d.get("status") == "delivered":
            agg["deliveredDays"] += 1
            agg["liters"] += float(d.get("quantityLiters") or 0)
            agg["amountRupees"] += float(d.get("amountRupees") or 0)
        elif d.get("status") == "missed":
            agg["missedDays"] += 1
    due: dict[str, float] = {}
    for b in bills:
        if b.get("status") in ("sent", "partial"):
            left = round(_bill_total(b) - float(b.get("paidAmountRupees", 0)), 2)
            if left > 0:
                due[b["clientId"]] = round(due.get(b["clientId"], 0.0) + left, 2)

    data = []
    for c in sorted(clients, key=lambda x: x.get("name", "").lower()):
        if status != "all" and c.get("status", "active") != status:
            continue
        if q and q.strip().lower() not in c.get("name", "").lower():
            continue
        item = dict(c)
        item["currentMonth"] = by_client.get(
            c["id"], {"deliveredDays": 0, "missedDays": 0, "liters": 0.0, "amountRupees": 0.0}
        )
        item["currentMonth"]["month"] = month
        item["outstandingRupees"] = due.get(c["id"], 0.0)
        data.append(item)
    return {"data": data, "total": len(data), "month": month, "monthStart": month_start}


@router.get("/clients/{client_id}")
async def get_client(client_id: str, user: dict = Depends(_seller)):
    client = await _get_client(user["id"], client_id)
    deliveries = await _client_deliveries(client_id)
    recent = [d for d in deliveries if d.get("status") == "delivered"][-10:][::-1]
    bills = sorted(
        await query(BILLS, [("clientId", "==", client_id)], limit=200),
        key=lambda b: b.get("month", ""),
        reverse=True,
    )
    outstanding = round(
        sum(
            max(0.0, _bill_total(b) - float(b.get("paidAmountRupees", 0)))
            for b in bills
            if b.get("status") in ("sent", "partial")
        ),
        2,
    )
    return {**client, "recentDeliveries": recent, "bills": bills, "outstandingRupees": outstanding}


@router.put("/clients/{client_id}")
async def update_client(client_id: str, body: ClientUpdateIn, user: dict = Depends(_seller)):
    client = await _get_client(user["id"], client_id)
    updates = body.model_dump(exclude_unset=True)
    if "startDate" in updates and updates["startDate"] is not None:
        updates["startDate"] = _parse_date(updates["startDate"])
    for field, value in updates.items():
        if value is None:
            continue
        client[field] = value
    if updates.get("phone") is not None:
        client["clientUserId"] = await _find_uid_by_phone(updates["phone"])
    client["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc(CLIENTS, client_id, client)
    return client


@router.delete("/clients/{client_id}")
async def archive_client(client_id: str, user: dict = Depends(_seller)):
    """Archive a client (history and old bills are kept for records)."""
    client = await _get_client(user["id"], client_id)
    client["status"] = "archived"
    client["archivedAt"] = datetime.now(timezone.utc).isoformat()
    client["updatedAt"] = client["archivedAt"]
    await set_doc(CLIENTS, client_id, client)
    return {"ok": True, "status": "archived"}


# -------------------------------------------------------------- deliveries --


class DeliveryEntryIn(BaseModel):
    clientId: str
    date: str
    status: DeliveryStatus = "delivered"
    quantityLiters: float | None = Field(default=None, gt=0, le=100)
    ratePerLiter: float | None = Field(default=None, gt=0)
    note: str = ""


class BulkEntryItem(BaseModel):
    clientId: str
    status: DeliveryStatus = "delivered"
    quantityLiters: float | None = Field(default=None, gt=0, le=100)
    note: str = ""


class BulkDeliveriesIn(BaseModel):
    date: str
    entries: list[BulkEntryItem] = Field(min_length=1, max_length=500)
    markUnlistedMissed: bool = False


async def _write_entry(
    uid: str,
    client: dict,
    day: str,
    status: DeliveryStatus,
    quantity: float | None,
    rate: float | None,
    note: str,
) -> tuple[dict, bool]:
    entry_id = f"mdlv_{client['id']}_{day}"
    existing = await get_doc(DELIVERIES, entry_id)
    if status == "delivered":
        qty = round(quantity if quantity is not None else client["defaultQuantityLiters"], 2)
        applied_rate = round(rate if rate is not None else client["ratePerLiter"], 2)
    else:
        qty = 0.0
        applied_rate = None
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": entry_id,
        "sellerId": uid,
        "clientId": client["id"],
        "clientName": client["name"],
        "date": day,
        "status": status,
        "quantityLiters": qty,
        "ratePerLiter": applied_rate,
        "amountRupees": _entry_amount(status, qty, applied_rate),
        "note": note,
        "createdAt": (existing or {}).get("createdAt", now),
        "updatedAt": now,
    }
    await set_doc(DELIVERIES, entry_id, doc)
    return doc, existing is None


@router.post("/deliveries", status_code=201)
async def record_delivery(body: DeliveryEntryIn, user: dict = Depends(_seller)):
    uid = user["id"]
    client = await _get_client(uid, body.clientId)
    if client.get("status") != "active":
        _error(409, "CLIENT_ARCHIVED", "client is archived; reactivate before recording deliveries")
    day = _parse_date(body.date)
    doc, _created = await _write_entry(uid, client, day, body.status, body.quantityLiters, body.ratePerLiter, body.note)
    return doc


@router.post("/deliveries/bulk")
async def record_bulk_deliveries(
    body: BulkDeliveriesIn,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    user: dict = Depends(_seller),
):
    """The punch-card replacement: mark every client for one day in one call.

    With markUnlistedMissed=true, active clients not in `entries` are marked
    missed for the day — the end-of-day sweep sellers do from memory today.
    """
    uid = user["id"]
    day = _parse_date(body.date)

    stored = await idempotency.replay(f"milk.deliveries.bulk.{uid}", idempotency_key)
    if stored:
        return stored

    wanted = {item.clientId for item in body.entries}
    if body.markUnlistedMissed:
        wanted |= {
            c["id"]
            for c in await query(CLIENTS, [("sellerId", "==", uid)], limit=1000)
            if c.get("status") == "active" and c.get("startDate", "0000-00-00") <= day
        }
    clients = {c["id"]: c for c in await query(CLIENTS, [("sellerId", "==", uid)], limit=1000) if c["id"] in wanted}
    missing = [cid for cid in wanted if cid not in clients]
    if missing:
        _error(404, "CLIENT_NOT_FOUND", f"unknown clients: {', '.join(sorted(missing))}")

    items: list[BulkEntryItem] = list(body.entries)
    covered = {item.clientId for item in items}
    if body.markUnlistedMissed:
        items += [BulkEntryItem(clientId=cid, status="missed") for cid in wanted - covered]

    docs, created_count = [], 0
    for item in items:
        doc, created = await _write_entry(uid, clients[item.clientId], day, item.status, item.quantityLiters, None, item.note)
        docs.append(doc)
        created_count += 1 if created else 0
    docs.sort(key=lambda d: (d.get("clientName", ""), d.get("status", "")))
    result = {"data": docs, "created": created_count, "updated": len(docs) - created_count, "date": day}
    if idempotency_key:
        await idempotency.store(f"milk.deliveries.bulk.{uid}", idempotency_key, result)
    return result


@router.get("/deliveries")
async def list_deliveries(
    clientId: str | None = None,
    status: DeliveryStatus | None = None,
    fromDate: str | None = None,
    toDate: str | None = None,
    user: dict = Depends(_seller),
):
    uid = user["id"]
    start = _parse_date(fromDate) if fromDate else None
    end = _parse_date(toDate) if toDate else None
    filters = [("sellerId", "==", uid)]
    if clientId:
        client = await _get_client(uid, clientId)
        filters.append(("clientId", "==", client["id"]))
    rows = await query(DELIVERIES, filters, limit=5000)
    data = [
        d
        for d in rows
        if (status is None or d.get("status") == status)
        and (start is None or d.get("date", "") >= start)
        and (end is None or d.get("date", "") <= end)
    ]
    data.sort(key=lambda d: (d.get("date", ""), d.get("clientName", "")), reverse=True)
    return {"data": data, "total": len(data)}


@router.get("/deliveries/{entry_id}")
async def get_delivery(entry_id: str, user: dict = Depends(_seller)):
    entry = await get_doc(DELIVERIES, entry_id)
    if entry is None or entry.get("sellerId") != user["id"]:
        _error(404, "ENTRY_NOT_FOUND", "delivery entry not found")
    return entry


@router.put("/deliveries/{entry_id}")
async def update_delivery(entry_id: str, body: DeliveryEntryIn, user: dict = Depends(_seller)):
    uid = user["id"]
    entry = await get_doc(DELIVERIES, entry_id)
    if entry is None or entry.get("sellerId") != uid:
        _error(404, "ENTRY_NOT_FOUND", "delivery entry not found")
    client = await _get_client(uid, entry["clientId"])
    day = _parse_date(body.date)
    if day != entry.get("date") or body.clientId != entry.get("clientId"):
        _error(422, "ENTRY_IDENTITY_IMMUTABLE", "date and client of an entry are fixed; delete and re-create instead")
    doc, _ = await _write_entry(uid, client, day, body.status, body.quantityLiters, body.ratePerLiter, body.note)
    return doc


@router.delete("/deliveries/{entry_id}")
async def delete_delivery(entry_id: str, user: dict = Depends(_seller)):
    entry = await get_doc(DELIVERIES, entry_id)
    if entry is None or entry.get("sellerId") != user["id"]:
        _error(404, "ENTRY_NOT_FOUND", "delivery entry not found")
    await delete_doc(DELIVERIES, entry_id)
    return {"ok": True}


@router.get("/clients/{client_id}/calendar")
async def client_calendar(client_id: str, month: str, user: dict = Depends(_seller)):
    """Month view of one client — one row per day of the month (punch card).

    Days with no entry are reported as `unmarked` so the seller can see
    exactly which days still need recording.
    """
    client = await _get_client(user["id"], client_id)
    start, end = _month_bounds(month)
    entries = {d["date"]: d for d in await _client_deliveries(client_id)}
    days = []
    cursor = start
    while cursor <= end:
        key = cursor.isoformat()
        entry = entries.get(key)
        if entry is None:
            days.append({"date": key, "status": "unmarked", "quantityLiters": 0.0, "amountRupees": 0.0, "note": ""})
        else:
            days.append(
                {
                    "date": key,
                    "status": entry.get("status"),
                    "quantityLiters": float(entry.get("quantityLiters") or 0),
                    "amountRupees": float(entry.get("amountRupees") or 0),
                    "note": entry.get("note", ""),
                }
            )
        cursor += timedelta(days=1)
    summary = {
        "deliveredDays": sum(1 for d in days if d["status"] == "delivered"),
        "missedDays": sum(1 for d in days if d["status"] == "missed"),
        "holidayDays": sum(1 for d in days if d["status"] == "holiday"),
        "unmarkedDays": sum(1 for d in days if d["status"] == "unmarked"),
        "totalLiters": round(sum(d["quantityLiters"] for d in days), 2),
        "totalAmountRupees": round(sum(d["amountRupees"] for d in days), 2),
    }
    return {"clientId": client_id, "clientName": client["name"], "month": month, "days": days, "summary": summary}


# -------------------------------------------------------------------- bills --


class BillGenerateIn(BaseModel):
    clientId: str
    month: str
    adjustmentsRupees: float = 0.0
    note: str = ""


class BillPaymentIn(BaseModel):
    amount: float = Field(gt=0)
    method: str = "cash"
    note: str = ""
    paidAt: str | None = None


def _bill_doc_id(client_id: str, month: str) -> str:
    return f"mbill_{client_id}_{month}"


def _prior_outstanding(bills: list[dict], before_month: str, client_id: str) -> float:
    total = 0.0
    for b in bills:
        if b.get("clientId") != client_id or b.get("month", "") >= before_month:
            continue
        if b.get("status") in ("sent", "partial", "paid"):
            total += max(0.0, _bill_total(b) - float(b.get("paidAmountRupees", 0)))
    return round(total, 2)


@router.post("/bills/generate", status_code=201)
async def generate_bill(
    body: BillGenerateIn,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    user: dict = Depends(_seller),
):
    uid = user["id"]
    client = await _get_client(uid, body.clientId)
    start, end = _month_bounds(body.month)
    if body.month > _current_month():
        _error(422, "INVALID_MONTH", "cannot generate a bill for a future month")

    stored = await idempotency.replay(f"milk.bills.generate.{uid}", idempotency_key)
    if stored:
        return stored

    bill_id = _bill_doc_id(client["id"], body.month)
    existing = await get_doc(BILLS, bill_id)
    if existing and existing.get("status") != "draft":
        _error(409, "BILL_LOCKED", f"bill already {existing.get('status')}; generate is allowed only while draft")

    deliveries = await _client_deliveries(client["id"])
    period = [d for d in deliveries if start.isoformat() <= d.get("date", "") <= end.isoformat()]
    line_items = [
        {
            "date": d["date"],
            "status": d.get("status"),
            "quantityLiters": float(d.get("quantityLiters") or 0),
            "ratePerLiter": d.get("ratePerLiter"),
            "amountRupees": float(d.get("amountRupees") or 0),
            "note": d.get("note", ""),
        }
        for d in period
    ]
    delivered = [d for d in period if d.get("status") == "delivered"]
    missed_days = [{"date": d["date"], "note": d.get("note", "")} for d in period if d.get("status") == "missed"]
    holiday_days = [d["date"] for d in period if d.get("status") == "holiday"]
    subtotal = round(sum(float(d.get("amountRupees") or 0) for d in delivered), 2)
    total_liters = round(sum(float(d.get("quantityLiters") or 0) for d in delivered), 2)

    all_client_bills = await query(BILLS, [("clientId", "==", client["id"])], limit=200)
    previous_balance = _prior_outstanding(all_client_bills, body.month, client["id"])
    total = round(subtotal + previous_balance + body.adjustmentsRupees, 2)

    now = datetime.now(timezone.utc).isoformat()
    bill = {
        "id": bill_id,
        "billNumber": f"MB-{body.month.replace('-', '')}-{client['id'][-4:].upper()}",
        "sellerId": uid,
        "clientId": client["id"],
        "clientName": client["name"],
        "clientPhone": client.get("phone"),
        "month": body.month,
        "periodStart": start.isoformat(),
        "periodEnd": end.isoformat(),
        "lineItems": line_items,
        "missedDays": missed_days,
        "summary": {
            "billedDays": len(delivered),
            "missedDays": len(missed_days),
            "holidayDays": len(holiday_days),
            "totalLiters": total_liters,
            "subtotalRupees": subtotal,
            "previousBalanceRupees": previous_balance,
            "adjustmentsRupees": round(body.adjustmentsRupees, 2),
            "totalRupees": total,
        },
        "adjustmentsRupees": round(body.adjustmentsRupees, 2),
        "note": body.note,
        "status": "draft",
        "sentAt": None,
        "payments": (existing or {}).get("payments", []),
        "paidAmountRupees": float((existing or {}).get("paidAmountRupees", 0.0)),
        "generatedAt": now,
        "updatedAt": now,
    }
    if bill["paidAmountRupees"] > 0:
        bill["status"] = "partial" if bill["paidAmountRupees"] < total else "paid"
    await set_doc(BILLS, bill_id, bill)
    if idempotency_key:
        await idempotency.store(f"milk.bills.generate.{uid}", idempotency_key, bill)
    return bill


@router.get("/bills")
async def list_bills(
    month: str | None = None,
    clientId: str | None = None,
    status: BillStatus | None = None,
    user: dict = Depends(_seller),
):
    uid = user["id"]
    filters = [("sellerId", "==", uid)]
    if clientId:
        client = await _get_client(uid, clientId)
        filters.append(("clientId", "==", client["id"]))
    if month:
        _month_bounds(month)
        filters.append(("month", "==", month))
    rows = await query(BILLS, filters, limit=1000)
    data = [b for b in rows if status is None or b.get("status") == status]
    data.sort(key=lambda b: (b.get("month", ""), b.get("clientName", "")), reverse=True)
    return {"data": data, "total": len(data)}


@router.get("/bills/{bill_id}")
async def get_bill(bill_id: str, user: dict = Depends(_seller)):
    bill = await get_doc(BILLS, bill_id)
    if bill is None or bill.get("sellerId") != user["id"]:
        _error(404, "BILL_NOT_FOUND", "bill not found")
    return _public_bill(bill)


@router.post("/bills/{bill_id}/send")
async def send_bill(bill_id: str, user: dict = Depends(_seller)):
    """Mark the bill sent (records sentAt, notifies the client if their phone
    matches an app user). Re-sending a sent bill is a no-op replay."""
    uid = user["id"]
    bill = await get_doc(BILLS, bill_id)
    if bill is None or bill.get("sellerId") != uid:
        _error(404, "BILL_NOT_FOUND", "bill not found")
    if bill.get("status") == "draft":
        bill["status"] = "sent"
        bill["sentAt"] = datetime.now(timezone.utc).isoformat()
        bill["updatedAt"] = bill["sentAt"]
        await set_doc(BILLS, bill_id, bill)
        client_uid = bill.get("clientUserId") or await _find_uid_by_phone(bill.get("clientPhone"))
        await _notify(
            client_uid,
            type="milk_bill_sent",
            title=f"Milk bill for {bill['month']}",
            body=f"{bill['clientName']}, your milk bill {bill['billNumber']} is Rs {bill['summary']['totalRupees']:.2f} ({bill['summary']['billedDays']} delivery days, {bill['summary']['missedDays']} missed).",
        )
    return bill


@router.post("/bills/{bill_id}/payments")
async def record_bill_payment(bill_id: str, body: BillPaymentIn, user: dict = Depends(_seller)):
    uid = user["id"]
    bill = await get_doc(BILLS, bill_id)
    if bill is None or bill.get("sellerId") != uid:
        _error(404, "BILL_NOT_FOUND", "bill not found")
    due = round(_bill_total(bill) - float(bill.get("paidAmountRupees", 0)), 2)
    amount = round(body.amount, 2)
    if amount > due:
        _error(409, "PAYMENT_EXCEEDS_DUE", f"payment exceeds outstanding due of Rs {due:.2f}")
    payment = {
        "id": f"pay_{uuid.uuid4().hex[:12]}",
        "amount": amount,
        "method": body.method,
        "note": body.note,
        "paidAt": _parse_date(body.paidAt) if body.paidAt else date.today().isoformat(),
        "recordedAt": datetime.now(timezone.utc).isoformat(),
    }
    bill.setdefault("payments", []).append(payment)
    bill["paidAmountRupees"] = round(float(bill.get("paidAmountRupees", 0)) + amount, 2)
    bill["status"] = "paid" if bill["paidAmountRupees"] >= _bill_total(bill) else "partial"
    bill["updatedAt"] = payment["recordedAt"]
    await set_doc(BILLS, bill_id, bill)
    client_uid = bill.get("clientUserId") or await _find_uid_by_phone(bill.get("clientPhone"))
    await _notify(
        client_uid,
        type="milk_bill_payment_recorded",
        title=f"Payment of Rs {amount:.2f} recorded",
        body=f"Against bill {bill['billNumber']} ({bill['month']}). Balance: Rs {_bill_total(bill) - bill['paidAmountRupees']:.2f}.",
    )
    return bill


# --------------------------------------------------------------- analytics --


@router.get("/analytics")
async def milk_seller_analytics(month: str | None = None, user: dict = Depends(_seller)):
    uid = user["id"]
    month = month or _current_month()
    start, end = _month_bounds(month)
    today = datetime.now(timezone.utc).date()
    today_s = today.isoformat()
    period_end = min(end, today) if month == _current_month() else end

    clients = await query(CLIENTS, [("sellerId", "==", uid)], limit=1000)
    deliveries = await query(DELIVERIES, [("sellerId", "==", uid)], limit=5000)
    bills = await query(BILLS, [("sellerId", "==", uid)], limit=1000)

    active = [c for c in clients if c.get("status") == "active"]
    started_active = [c for c in active if c.get("startDate", "0000-00-00") <= period_end.isoformat()]

    month_entries = [
        d for d in deliveries if start.isoformat() <= d.get("date", "") <= end.isoformat()
    ]
    delivered_entries = [d for d in month_entries if d.get("status") == "delivered"]
    missed_entries = [d for d in month_entries if d.get("status") == "missed"]
    holiday_entries = [d for d in month_entries if d.get("status") == "holiday"]

    # unmarked = expected client-days minus recorded ones (the punch-card gaps)
    recorded_by_client: dict[str, set[str]] = {}
    for d in month_entries:
        recorded_by_client.setdefault(d["clientId"], set()).add(d["date"])
    unmarked = 0
    expected_liters = 0.0
    for c in started_active:
        c_start = max(start, date.fromisoformat(c["startDate"]))
        days_expected = (period_end - c_start).days + 1
        unmarked += max(0, days_expected - len(recorded_by_client.get(c["id"], set())))
        expected_liters += float(c.get("defaultQuantityLiters", 0)) * max(0, days_expected)

    today_entries = [d for d in deliveries if d.get("date") == today_s]
    today_delivered = [d for d in today_entries if d.get("status") == "delivered"]

    month_bills = [b for b in bills if b.get("month") == month]
    billed = round(sum(_bill_total(b) for b in month_bills), 2)
    collected = round(
        sum(
            float(p.get("amount", 0))
            for b in bills
            for p in b.get("payments", [])
            if str(p.get("paidAt", ""))[:7] == month
        ),
        2,
    )
    outstanding = round(
        sum(
            max(0.0, _bill_total(b) - float(b.get("paidAmountRupees", 0)))
            for b in bills
            if b.get("status") in ("sent", "partial")
        ),
        2,
    )

    recorded_days = len(delivered_entries) + len(missed_entries)
    delivery_rate = round(len(delivered_entries) / recorded_days * 100, 1) if recorded_days else None

    # per-client rollup for the selected month
    per_client: dict[str, dict] = {}
    for c in clients:
        per_client[c["id"]] = {"clientId": c["id"], "name": c["name"], "liters": 0.0, "missedDays": 0, "billedRupees": 0.0}
    for d in delivered_entries:
        agg = per_client.get(d["clientId"])
        if agg:
            agg["liters"] += float(d.get("quantityLiters") or 0)
    for d in missed_entries:
        agg = per_client.get(d["clientId"])
        if agg:
            agg["missedDays"] += 1
    for b in month_bills:
        agg = per_client.get(b["clientId"])
        if agg:
            agg["billedRupees"] += _bill_total(b)
    top_clients = sorted(
        (a for a in per_client.values() if a["liters"] or a["billedRupees"]),
        key=lambda a: a["billedRupees"],
        reverse=True,
    )[:5]
    for agg in top_clients:
        agg["liters"] = round(agg["liters"], 2)
        agg["billedRupees"] = round(agg["billedRupees"], 2)

    trend = []
    for m in _last_months(month, 6):
        m_start, m_end = _month_bounds(m)
        m_delivered = [d for d in deliveries if m_start.isoformat() <= d.get("date", "") <= m_end.isoformat() and d.get("status") == "delivered"]
        m_missed = [d for d in deliveries if m_start.isoformat() <= d.get("date", "") <= m_end.isoformat() and d.get("status") == "missed"]
        m_bills = [b for b in bills if b.get("month") == m]
        m_collected = sum(
            float(p.get("amount", 0))
            for b in bills
            for p in b.get("payments", [])
            if str(p.get("paidAt", ""))[:7] == m
        )
        trend.append(
            {
                "month": m,
                "deliveredDays": len(m_delivered),
                "missedDays": len(m_missed),
                "liters": round(sum(float(d.get("quantityLiters") or 0) for d in m_delivered), 2),
                "billedRupees": round(sum(_bill_total(b) for b in m_bills), 2),
                "collectedRupees": round(m_collected, 2),
            }
        )

    return {
        "month": month,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "clients": {
            "total": len(clients),
            "active": len(active),
            "archived": len(clients) - len(active),
            "newThisMonth": sum(1 for c in clients if str(c.get("createdAt", ""))[:7] == month),
        },
        "today": {
            "date": today_s,
            "expectedDeliveries": len(started_active),
            "deliveredCount": len(today_delivered),
            "missedCount": sum(1 for d in today_entries if d.get("status") == "missed"),
            "liters": round(sum(float(d.get("quantityLiters") or 0) for d in today_delivered), 2),
            "expectedLiters": round(sum(float(c.get("defaultQuantityLiters", 0)) for c in started_active), 2),
        },
        "monthToDate": {
            "deliveredDays": len(delivered_entries),
            "missedDays": len(missed_entries),
            "holidayDays": len(holiday_entries),
            "unmarkedDays": unmarked,
            "totalLiters": round(sum(float(d.get("quantityLiters") or 0) for d in delivered_entries), 2),
            "expectedLiters": round(expected_liters, 2),
            "deliveryRatePercent": delivery_rate,
        },
        "money": {"billedRupees": billed, "collectedRupees": collected, "outstandingRupees": outstanding},
        "topClients": top_clients,
        "monthlyTrend": trend,
    }
