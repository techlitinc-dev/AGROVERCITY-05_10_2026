"""Milk Vendor (Doodhwala) HTTP API.

Vendor-managed private clients (no customer accounts/KYC), schedule-driven
daily delivery entry, rate rules, immutable bills with PDF + secure share
links, WhatsApp sharing, and vendor-recorded external payments.

All /milk-vendor endpoints require auth, the milkSeller persona, and verified
vendor KYC (except reading/updating the vendor's own profile so an
unverified vendor can see what is blocked). Public bill resolution lives at
/public/milk-bills/{token} and is rate limited.
"""

import re
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response

from app.core.config import settings
from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.core import ratelimit
from app.routers.users import require_role
from app.services import idempotency
from app.services import milk_vendor as mv
from app.services import milk_vendor_pdf as mvpdf
from app.services.storage import read_blob, upload_user_file
from app.services.users import get_user

router = APIRouter(prefix="/milk-vendor", tags=["milk-vendor"])
public_router = APIRouter(prefix="/public/milk-bills", tags=["milk-vendor-public"])

DeliveryStatus = Literal["delivered", "skipped", "paused"]

PHONE_RE = re.compile(r"^\+?[1-9]\d{7,14}$")


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def _vendor(uid: str = Depends(current_user_id)) -> dict:
    """milkSeller persona guard — the Doodhwala maps onto the existing persona."""
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    profiles = user.get("linkedProfiles") or [user.get("activeProfile") or "milkSeller"]
    if "milkSeller" not in profiles and not user.get("isAdmin"):
        require_role(user, "milkSeller")
    return user


def _require_kyc(user: dict):
    if user.get("isAdmin"):
        return
    if str(user.get("kycStatus") or "").lower() != "verified":
        _error(403, "KYC_REQUIRED", "vendor KYC must be verified before using milk vendor features")


def _kyc_verified(user: dict) -> bool:
    return bool(user.get("isAdmin")) or str(user.get("kycStatus") or "").lower() == "verified"


def _parse_day(value: str, field: str = "date") -> date:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        _error(422, "INVALID_DATE", f"{field} must be YYYY-MM-DD", {field: "must be YYYY-MM-DD"})


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_whatsapp(raw: str | None) -> str | None:
    if not raw:
        return None
    value = str(raw).strip()
    if not PHONE_RE.match(value):
        return None
    return value


def _last10(phone: str | None) -> str:
    return "".join(ch for ch in str(phone or "") if ch.isdigit())[-10:]


# ------------------------------------------------------------- vendor profile --


def _default_profile(user: dict) -> dict:
    now = _now()
    return {
        "id": user["id"],
        "vendorUserId": user["id"],
        "businessName": "",
        "displayName": user.get("name") or "",
        "phone": user.get("phone") or "",
        "whatsappNumber": "",
        "address": "",
        "logoStorageReference": None,
        "billPrefix": "MV",
        "nextBillSequence": 1,
        "defaultBillingCycle": "monthly",
        "defaultShift": "morning",
        "paymentInstructions": "",
        "upiId": "",
        "defaultBillNotes": "",
        "timezone": mv.DEFAULT_TIMEZONE,
        "active": True,
        "createdAt": now,
        "updatedAt": now,
    }


async def _get_profile(vendor_id: str) -> dict:
    profile = await get_doc(mv.PROFILES, vendor_id)
    return profile if profile is not None else _default_profile(await get_user(vendor_id) or {"id": vendor_id})


PROFILE_FIELDS = {
    "businessName",
    "displayName",
    "phone",
    "whatsappNumber",
    "address",
    "logoStorageReference",
    "billPrefix",
    "defaultBillingCycle",
    "defaultShift",
    "paymentInstructions",
    "upiId",
    "defaultBillNotes",
    "timezone",
    "active",
}


@router.get("/profile")
async def get_profile(user: dict = Depends(_vendor)):
    profile = await _get_profile(user["id"])
    profile["kycVerified"] = _kyc_verified(user)
    return profile


@router.put("/profile")
async def put_profile(body: dict, user: dict = Depends(_vendor)):
    existing = await get_doc(mv.PROFILES, user["id"])
    profile = dict(existing) if existing is not None else _default_profile(user)
    whatsapp = body.get("whatsappNumber", profile.get("whatsappNumber"))
    if whatsapp and normalize_whatsapp(whatsapp) is None:
        _error(422, "INVALID_PHONE", "whatsappNumber must include country code", {"whatsappNumber": "e.g. +919812345678"})
    for field in PROFILE_FIELDS:
        if field in body:
            profile[field] = body[field]
    prefix = str(profile.get("billPrefix") or "MV").strip().upper()
    profile["billPrefix"] = re.sub(r"[^A-Z0-9-]", "", prefix)[:10] or "MV"
    if profile.get("defaultBillingCycle") not in ("weekly", "fifteenDays", "monthly", "custom"):
        _error(422, "INVALID_CYCLE", "defaultBillingCycle must be weekly/fifteenDays/monthly/custom")
    if profile.get("defaultShift") not in mv.SHIFTS:
        _error(422, "INVALID_SHIFT", "defaultShift must be morning/evening")
    created = existing is None
    profile["updatedAt"] = _now()
    await set_doc(mv.PROFILES, user["id"], profile)
    if created:
        # First save: give the vendor a starter product so daily entry works out of the box.
        existing = await query(mv.PRODUCTS, [("vendorId", "==", user["id"])], limit=1)
        if not existing:
            now = _now()
            product_id = f"mpr_{uuid.uuid4().hex[:12]}"
            await set_doc(
                mv.PRODUCTS,
                product_id,
                {"id": product_id, "vendorId": user["id"], "name": "Milk", "unit": "litre", "active": True, "createdAt": now, "updatedAt": now},
            )
    profile["kycVerified"] = _kyc_verified(user)
    return profile


# ------------------------------------------------------------------- products --


async def _vendor_products(vendor_id: str) -> list[dict]:
    return await query(mv.PRODUCTS, [("vendorId", "==", vendor_id)], limit=200)


@router.get("/products")
async def list_products(user: dict = Depends(_vendor)):
    _require_kyc(user)
    products = await _vendor_products(user["id"])
    return {"data": sorted(products, key=lambda p: p.get("name", "").lower()), "total": len(products)}


@router.post("/products", status_code=201)
async def create_product(body: dict, user: dict = Depends(_vendor)):
    _require_kyc(user)
    name = str(body.get("name") or "").strip()
    if not name or len(name) > 80:
        _error(422, "INVALID_NAME", "name is required (max 80 chars)", {"name": "required"})
    unit = str(body.get("unit") or "litre").strip()[:20] or "litre"
    now = _now()
    product = {
        "id": f"mpr_{uuid.uuid4().hex[:12]}",
        "vendorId": user["id"],
        "name": name,
        "unit": unit,
        "active": bool(body.get("active", True)),
        "createdAt": now,
        "updatedAt": now,
    }
    await set_doc(mv.PRODUCTS, product["id"], product)
    return product


@router.patch("/products/{product_id}")
async def update_product(product_id: str, body: dict, user: dict = Depends(_vendor)):
    _require_kyc(user)
    product = await get_doc(mv.PRODUCTS, product_id)
    if product is None or product.get("vendorId") != user["id"]:
        _error(404, "PRODUCT_NOT_FOUND", "product not found")
    if "name" in body:
        name = str(body.get("name") or "").strip()
        if not name or len(name) > 80:
            _error(422, "INVALID_NAME", "name is required (max 80 chars)", {"name": "required"})
        product["name"] = name
    if "unit" in body:
        product["unit"] = str(body.get("unit") or "litre").strip()[:20] or "litre"
    if "active" in body:
        product["active"] = bool(body.get("active"))
    product["updatedAt"] = _now()
    await set_doc(mv.PRODUCTS, product_id, product)
    return product


# ----------------------------------------------------------------------- rates --


@router.get("/rates")
async def list_rates(productId: str | None = None, clientId: str | None = None, user: dict = Depends(_vendor)):
    _require_kyc(user)
    filters = [("vendorId", "==", user["id"])]
    if productId:
        filters.append(("productId", "==", productId))
    if clientId:
        filters.append(("clientId", "==", clientId))
    rules = await query(mv.RATES, filters, limit=500)
    rules.sort(key=lambda r: (r.get("productId", ""), r.get("clientId") or "", r.get("effectiveFrom", "")), reverse=True)
    return {"data": rules, "total": len(rules)}


@router.post("/rates", status_code=201)
async def create_rate(body: dict, user: dict = Depends(_vendor)):
    """A new rate rule. clientId omitted = vendor default for the product.
    Rules are append-only history: changing a rate adds a rule with a new
    effectiveFrom; older deliveries keep the rate they were recorded with."""
    _require_kyc(user)
    product_id = str(body.get("productId") or "")
    product = await get_doc(mv.PRODUCTS, product_id)
    if product is None or product.get("vendorId") != user["id"]:
        _error(404, "PRODUCT_NOT_FOUND", "product not found")
    client_id = body.get("clientId")
    if client_id:
        await _get_client(user["id"], str(client_id))
    rate = body.get("ratePaisaPerUnit")
    if not isinstance(rate, int) or isinstance(rate, bool) or rate <= 0:
        _error(422, "INVALID_RATE", "ratePaisaPerUnit must be a positive integer (paisa per litre)", {"ratePaisaPerUnit": "positive integer"})
    effective_from = _parse_day(str(body.get("effectiveFrom") or ""), "effectiveFrom") if body.get("effectiveFrom") else mv.today_in()
    rule = {
        "id": f"mrt_{uuid.uuid4().hex[:12]}",
        "vendorId": user["id"],
        "productId": product_id,
        "clientId": str(client_id) if client_id else None,
        "ratePaisaPerUnit": rate,
        "effectiveFrom": effective_from.isoformat(),
        "createdAt": _now(),
    }
    await set_doc(mv.RATES, rule["id"], rule)
    return rule


# --------------------------------------------------------------------- clients --


def _client_out(client: dict) -> dict:
    return client


async def _get_client(vendor_id: str, client_id: str) -> dict:
    client = await get_doc(mv.CLIENTS, client_id)
    if client is None or client.get("vendorId") != vendor_id:
        _error(404, "CLIENT_NOT_FOUND", "client not found")
    return client


def _validate_schedule(body: dict, client: dict | None = None) -> dict:
    out = {}
    current = client or {}
    stype = body.get("scheduleType")
    if stype is not None:
        if stype not in ("daily", "alternateDays", "specificWeekdays", "oneTime"):
            _error(422, "INVALID_SCHEDULE", "scheduleType must be daily/alternateDays/specificWeekdays/oneTime")
        out["scheduleType"] = stype
    effective = out.get("scheduleType") or current.get("scheduleType") or "daily"
    if body.get("weekdays") is not None or (client is None and effective == "specificWeekdays"):
        weekdays = body.get("weekdays")
        if weekdays is None:
            weekdays = current.get("weekdays") or []
        if not isinstance(weekdays, list) or any(not isinstance(w, int) or w < 0 or w > 6 for w in weekdays):
            _error(422, "INVALID_WEEKDAYS", "weekdays must be integers 0 (Mon) to 6 (Sun)")
        out["weekdays"] = weekdays
    if body.get("oneTimeDate") is not None or (client is None and effective == "oneTime"):
        otd = body.get("oneTimeDate") or current.get("oneTimeDate")
        if not otd:
            _error(422, "INVALID_SCHEDULE", "oneTimeDate is required for oneTime schedules", {"oneTimeDate": "required"})
        out["oneTimeDate"] = _parse_day(str(otd), "oneTimeDate").isoformat()
    return out


@router.get("/clients")
async def list_clients(status: Literal["active", "paused", "inactive", "all"] = "active", q: str | None = None, user: dict = Depends(_vendor)):
    _require_kyc(user)
    clients = await query(mv.CLIENTS, [("vendorId", "==", user["id"])], limit=1000)
    products = {p["id"]: p.get("name") for p in await _vendor_products(user["id"])}
    today = mv.today_in()
    data = []
    for c in sorted(clients, key=lambda x: x.get("name", "").lower()):
        if status != "all" and c.get("status", "active") != status:
            continue
        if q and q.strip().lower() not in c.get("name", "").lower():
            continue
        item = dict(c)
        item["productName"] = products.get(c.get("defaultProductId"), "")
        item["scheduledToday"] = mv.is_scheduled_on(c, today)
        item["recordedBalancePaisa"] = await mv.client_recorded_balance_paisa(c)
        data.append(item)
    return {"data": data, "total": len(data)}


@router.post("/clients", status_code=201)
async def create_client(body: dict, user: dict = Depends(_vendor)):
    _require_kyc(user)
    name = str(body.get("name") or "").strip()
    if not name or len(name) > 120:
        _error(422, "INVALID_NAME", "name is required (max 120 chars)", {"name": "required"})
    whatsapp = normalize_whatsapp(body.get("whatsappNumber"))
    if not whatsapp:
        _error(422, "INVALID_PHONE", "whatsappNumber with country code is required", {"whatsappNumber": "e.g. +919812345678"})
    address = str(body.get("address") or body.get("area") or "").strip()
    if not address:
        _error(422, "INVALID_ADDRESS", "delivery address/area is required", {"address": "required"})
    product_id = str(body.get("defaultProductId") or "")
    product = await get_doc(mv.PRODUCTS, product_id)
    if product is None or product.get("vendorId") != user["id"]:
        _error(422, "INVALID_PRODUCT", "defaultProductId must be one of your products", {"defaultProductId": "required"})
    qty = body.get("defaultQuantityMilliLitres")
    if not isinstance(qty, int) or isinstance(qty, bool) or qty <= 0 or qty > 200_000:
        _error(422, "INVALID_QUANTITY", "defaultQuantityMilliLitres must be a positive integer", {"defaultQuantityMilliLitres": "positive integer (ml)"})
    start = _parse_day(str(body.get("scheduleStartDate") or ""), "scheduleStartDate") if body.get("scheduleStartDate") else mv.today_in()
    shift = body.get("defaultShift") or (await _get_profile(user["id"])).get("defaultShift") or "morning"
    if shift not in mv.SHIFTS:
        _error(422, "INVALID_SHIFT", "defaultShift must be morning/evening")
    cycle = body.get("billingCycle")
    if cycle and cycle not in ("weekly", "fifteenDays", "monthly", "custom"):
        _error(422, "INVALID_CYCLE", "billingCycle must be weekly/fifteenDays/monthly/custom")
    opening = body.get("openingBalancePaisa")
    if opening is not None and (not isinstance(opening, int) or isinstance(opening, bool) or opening < 0):
        _error(422, "INVALID_AMOUNT", "openingBalancePaisa must be a non-negative integer")
    rate = body.get("ratePaisaPerUnit")
    if not isinstance(rate, int) or isinstance(rate, bool) or rate <= 0:
        _error(422, "INVALID_RATE", "ratePaisaPerUnit is required (positive integer paisa per litre)", {"ratePaisaPerUnit": "required"})

    schedule = _validate_schedule({"scheduleType": body.get("scheduleType", "daily"), "weekdays": body.get("weekdays"), "oneTimeDate": body.get("oneTimeDate")})
    alternate = normalize_whatsapp(body.get("alternatePhone"))
    if body.get("alternatePhone") and not alternate:
        _error(422, "INVALID_PHONE", "alternatePhone must include country code")

    now = _now()
    client = {
        "id": f"mvc_{uuid.uuid4().hex[:12]}",
        "vendorId": user["id"],
        "name": name,
        "whatsappNumber": whatsapp,
        "alternatePhone": alternate,
        "address": address,
        "area": address,
        "deliveryNotes": str(body.get("deliveryNotes") or "")[:500],
        "defaultProductId": product_id,
        "defaultQuantityMilliLitres": qty,
        "scheduleType": schedule.get("scheduleType", "daily"),
        "weekdays": schedule.get("weekdays") or [],
        "scheduleStartDate": start.isoformat(),
        "oneTimeDate": schedule.get("oneTimeDate"),
        "defaultShift": shift,
        "billingCycle": cycle,
        "status": "active",
        "pauseRanges": [],
        "openingBalancePaisa": opening or 0,
        "createdAt": now,
        "updatedAt": now,
    }
    await set_doc(mv.CLIENTS, client["id"], client)
    # Opening rate rule (client-specific) — historical rates live in milk_rate_rules.
    rate_id = f"mrt_{uuid.uuid4().hex[:12]}"
    await set_doc(
        mv.RATES,
        rate_id,
        {
            "id": rate_id,
            "vendorId": user["id"],
            "productId": product_id,
            "clientId": client["id"],
            "ratePaisaPerUnit": rate,
            "effectiveFrom": start.isoformat(),
            "createdAt": now,
        },
    )
    others = await query(mv.CLIENTS, [("vendorId", "==", user["id"])], limit=1000)
    client["duplicatePhone"] = any(o["id"] != client["id"] and _last10(o.get("whatsappNumber")) == _last10(whatsapp) for o in others)
    client["recordedBalancePaisa"] = await mv.client_recorded_balance_paisa(client)
    return client


@router.get("/clients/{client_id}")
async def get_client(client_id: str, user: dict = Depends(_vendor)):
    _require_kyc(user)
    client = await _get_client(user["id"], client_id)
    deliveries = await query(mv.DELIVERIES, [("clientId", "==", client_id)], limit=5000)
    deliveries.sort(key=lambda d: (d.get("deliveryDate") or "", d.get("createdAt") or ""), reverse=True)
    bills = await mv.client_bills(client_id)
    payments = await query(mv.PAYMENTS, [("clientId", "==", client_id)], limit=1000)
    payments.sort(key=lambda p: (p.get("paymentDate") or "", p.get("createdAt") or ""), reverse=True)
    out = dict(client)
    out["recentDeliveries"] = deliveries[:30]
    out["bills"] = bills[::-1][:30]
    out["payments"] = payments[:30]
    out["recordedBalancePaisa"] = await mv.client_recorded_balance_paisa(client)
    return out


@router.patch("/clients/{client_id}")
async def update_client(client_id: str, body: dict, user: dict = Depends(_vendor)):
    _require_kyc(user)
    client = await _get_client(user["id"], client_id)
    if "name" in body:
        name = str(body.get("name") or "").strip()
        if not name or len(name) > 120:
            _error(422, "INVALID_NAME", "name is required (max 120 chars)", {"name": "required"})
        client["name"] = name
    if "whatsappNumber" in body:
        whatsapp = normalize_whatsapp(body.get("whatsappNumber"))
        if not whatsapp:
            _error(422, "INVALID_PHONE", "whatsappNumber must include country code", {"whatsappNumber": "e.g. +919812345678"})
        client["whatsappNumber"] = whatsapp
    if "alternatePhone" in body:
        alternate = normalize_whatsapp(body.get("alternatePhone"))
        if body.get("alternatePhone") and not alternate:
            _error(422, "INVALID_PHONE", "alternatePhone must include country code")
        client["alternatePhone"] = alternate
    if "address" in body or "area" in body:
        client["address"] = str(body.get("address") or body.get("area") or "").strip()
        client["area"] = client["address"]
    if "deliveryNotes" in body:
        client["deliveryNotes"] = str(body.get("deliveryNotes") or "")[:500]
    if "defaultProductId" in body:
        product = await get_doc(mv.PRODUCTS, str(body.get("defaultProductId")))
        if product is None or product.get("vendorId") != user["id"]:
            _error(422, "INVALID_PRODUCT", "defaultProductId must be one of your products")
        client["defaultProductId"] = product["id"]
    if "defaultQuantityMilliLitres" in body:
        qty = body.get("defaultQuantityMilliLitres")
        if not isinstance(qty, int) or isinstance(qty, bool) or qty <= 0 or qty > 200_000:
            _error(422, "INVALID_QUANTITY", "defaultQuantityMilliLitres must be a positive integer")
        client["defaultQuantityMilliLitres"] = qty
    if "defaultShift" in body:
        if body.get("defaultShift") not in mv.SHIFTS:
            _error(422, "INVALID_SHIFT", "defaultShift must be morning/evening")
        client["defaultShift"] = body["defaultShift"]
    if "billingCycle" in body:
        if body.get("billingCycle") and body.get("billingCycle") not in ("weekly", "fifteenDays", "monthly", "custom"):
            _error(422, "INVALID_CYCLE", "billingCycle must be weekly/fifteenDays/monthly/custom")
        client["billingCycle"] = body.get("billingCycle")
    if "openingBalancePaisa" in body:
        opening = body.get("openingBalancePaisa")
        if not isinstance(opening, int) or isinstance(opening, bool) or opening < 0:
            _error(422, "INVALID_AMOUNT", "openingBalancePaisa must be a non-negative integer")
        client["openingBalancePaisa"] = opening
    schedule = _validate_schedule(body, client)
    client.update(schedule)

    warnings = {}
    if "ratePaisaPerUnit" in body:
        rate = body.get("ratePaisaPerUnit")
        if not isinstance(rate, int) or isinstance(rate, bool) or rate <= 0:
            _error(422, "INVALID_RATE", "ratePaisaPerUnit must be a positive integer")
        effective = body.get("effectiveFrom")
        if not effective:
            _error(422, "EFFECTIVE_DATE_REQUIRED", "effectiveFrom is required when changing a rate", {"effectiveFrom": "required"})
        effective_day = _parse_day(str(effective), "effectiveFrom")
        product_id = str(body.get("productId") or client["defaultProductId"])
        now = _now()
        rate_id = f"mrt_{uuid.uuid4().hex[:12]}"
        await set_doc(
            mv.RATES,
            rate_id,
            {"id": rate_id, "vendorId": user["id"], "productId": product_id, "clientId": client_id, "ratePaisaPerUnit": rate, "effectiveFrom": effective_day.isoformat(), "createdAt": now},
        )
        warnings["rate"] = "new rate applies from " + effective_day.isoformat() + "; historical deliveries are unchanged"
    client["updatedAt"] = _now()
    await set_doc(mv.CLIENTS, client_id, client)
    others = await query(mv.CLIENTS, [("vendorId", "==", user["id"])], limit=1000)
    client["duplicatePhone"] = any(o["id"] != client_id and _last10(o.get("whatsappNumber")) == _last10(client.get("whatsappNumber")) for o in others)
    client["recordedBalancePaisa"] = await mv.client_recorded_balance_paisa(client)
    client["warnings"] = warnings
    return client


@router.post("/clients/{client_id}/pause")
async def pause_client(client_id: str, body: dict, user: dict = Depends(_vendor)):
    _require_kyc(user)
    client = await _get_client(user["id"], client_id)
    start = _parse_day(str(body.get("startDate") or ""), "startDate") if body.get("startDate") else mv.today_in()
    end = _parse_day(str(body.get("endDate") or ""), "endDate") if body.get("endDate") else None
    if end and end < start:
        _error(422, "INVALID_RANGE", "endDate must be on/after startDate")
    ranges = client.get("pauseRanges") or []
    ranges.append({"startDate": start.isoformat(), "endDate": end.isoformat() if end else None, "reason": str(body.get("reason") or "")[:200]})
    client["pauseRanges"] = ranges
    today = mv.today_in()
    if end is None or end >= today:
        client["status"] = "paused"
    client["updatedAt"] = _now()
    await set_doc(mv.CLIENTS, client_id, client)
    return client


@router.post("/clients/{client_id}/resume")
async def resume_client(client_id: str, user: dict = Depends(_vendor)):
    _require_kyc(user)
    client = await _get_client(user["id"], client_id)
    today_key = mv.today_in().isoformat()
    # Drop pause ranges that still cover today or the future — history stays.
    client["pauseRanges"] = [
        r
        for r in (client.get("pauseRanges") or [])
        if r.get("endDate") and r["endDate"] < today_key
    ]
    client["status"] = "active"
    client["updatedAt"] = _now()
    await set_doc(mv.CLIENTS, client_id, client)
    return client


@router.post("/clients/{client_id}/deactivate")
async def deactivate_client(client_id: str, user: dict = Depends(_vendor)):
    _require_kyc(user)
    client = await _get_client(user["id"], client_id)
    client["status"] = "inactive"
    client["deactivatedAt"] = _now()
    client["updatedAt"] = client["deactivatedAt"]
    await set_doc(mv.CLIENTS, client_id, client)
    return client


# ----------------------------------------------------------------- deliveries --


async def _duplicate_delivery(vendor_id: str, client_id: str, product_id: str, day: str, shift: str, extra: bool) -> dict | None:
    rows = await query(mv.DELIVERIES, [("vendorId", "==", vendor_id), ("clientId", "==", client_id)], limit=5000)
    for d in rows:
        if (
            d.get("productId") == product_id
            and d.get("deliveryDate") == day
            and d.get("shift") == shift
            and bool(d.get("extra")) == extra
        ):
            return d
    return None


async def _write_delivery(
    vendor_id: str,
    client: dict,
    day: date,
    shift: str,
    status: DeliveryStatus,
    quantity_ml: int | None,
    product_id: str | None,
    extra: bool,
    notes: str,
    vendor_rate: int | None,
    created_by: str,
    existing: dict | None = None,
) -> dict:
    product_id = product_id or client.get("defaultProductId")
    product = await get_doc(mv.PRODUCTS, product_id)
    if product is None or product.get("vendorId") != vendor_id:
        _error(422, "INVALID_PRODUCT", "product must be one of your products")
    if vendor_rate is not None and (not isinstance(vendor_rate, int) or isinstance(vendor_rate, bool) or vendor_rate <= 0):
        _error(422, "INVALID_RATE", "ratePaisaPerUnit must be a positive integer")
    if status == "delivered":
        # Prefill rule: an omitted quantity means the client's default — the
        # vendor edits only exceptions.
        qty = int(quantity_ml if quantity_ml is not None else client.get("defaultQuantityMilliLitres") or 0)
        if qty <= 0:
            _error(422, "INVALID_QUANTITY", "delivered quantity must be positive", {"quantityMilliLitres": "must be > 0"})
        rate = vendor_rate if vendor_rate is not None else await mv.resolve_rate(vendor_id, product_id, client["id"], day)
        if rate is None:
            _error(422, "RATE_REQUIRED", "no rate rule applies — set a product rate or pass ratePaisaPerUnit", {"ratePaisaPerUnit": "required"})
        amount = mv.amount_paisa(qty, rate)
    else:
        qty = 0
        rate = None
        amount = 0
    now = _now()
    doc = {
        "id": (existing or {}).get("id") or f"mdv_{uuid.uuid4().hex[:12]}",
        "vendorId": vendor_id,
        "clientId": client["id"],
        "clientName": client.get("name", ""),
        "productId": product_id,
        "deliveryDate": day.isoformat(),
        "shift": shift,
        "quantityMilliLitres": qty,
        "appliedRatePaisaPerUnit": rate,
        "amountPaisa": amount,
        "status": status,
        "extra": bool(extra),
        "notes": str(notes or "")[:300],
        "billedBillId": (existing or {}).get("billedBillId"),
        "createdAt": (existing or {}).get("createdAt") or now,
        "updatedAt": now,
        "createdBy": (existing or {}).get("createdBy") or created_by,
        "corrections": (existing or {}).get("corrections") or [],
    }
    await set_doc(mv.DELIVERIES, doc["id"], doc)
    return doc


@router.get("/today")
async def today(date: str | None = None, shift: str | None = None, user: dict = Depends(_vendor)):
    """The default vendor screen: scheduled clients with prefilled quantities,
    joined with whatever has already been recorded for the day."""
    _require_kyc(user)
    profile = await _get_profile(user["id"])
    day = _parse_day(date) if date else mv.today_in(profile.get("timezone"))
    shift = shift or profile.get("defaultShift") or "morning"
    if shift not in mv.SHIFTS:
        _error(422, "INVALID_SHIFT", "shift must be morning/evening")

    clients = await query(mv.CLIENTS, [("vendorId", "==", user["id"])], limit=1000)
    products = {p["id"]: p for p in await _vendor_products(user["id"])}
    rates = await query(mv.RATES, [("vendorId", "==", user["id"])], limit=500)

    def rate_for(product_id: str, client_id: str) -> int | None:
        key = day.isoformat()
        applicable = [r for r in rates if r.get("productId") == product_id and (r.get("effectiveFrom") or "") <= key]
        client_rules = [r for r in applicable if r.get("clientId") == client_id]
        pool = client_rules or [r for r in applicable if not r.get("clientId")]
        if not pool:
            return None
        return int(max(pool, key=lambda r: r.get("effectiveFrom") or "")["ratePaisaPerUnit"])

    rows = []
    for c in clients:
        if c.get("status") == "inactive":
            continue
        scheduled = mv.is_scheduled_on(c, day)
        paused = mv.is_paused_on(c, day)
        matches_shift = c.get("defaultShift") or "morning"
        entries = await query(mv.DELIVERIES, [("clientId", "==", c["id"])], limit=5000)
        todays = [e for e in entries if e.get("deliveryDate") == day.isoformat() and e.get("shift") == shift]
        if not scheduled and not todays and not paused:
            continue
        if matches_shift != shift and not todays:
            continue
        product = products.get(c.get("defaultProductId")) or {}
        saved = todays[0] if todays else None
        rows.append(
            {
                "clientId": c["id"],
                "name": c.get("name"),
                "area": c.get("area") or c.get("address") or "",
                "productId": c.get("defaultProductId"),
                "productName": product.get("name", ""),
                "defaultQuantityMilliLitres": c.get("defaultQuantityMilliLitres"),
                "resolvedRatePaisaPerUnit": rate_for(c.get("defaultProductId"), c["id"]),
                "required": scheduled and not paused,
                "paused": paused,
                "status": (saved or {}).get("status") or ("paused" if paused else "pending"),
                "entryId": (saved or {}).get("id"),
                "quantityMilliLitres": (saved or {}).get("quantityMilliLitres"),
                "amountPaisa": (saved or {}).get("amountPaisa"),
                "extraEntries": len(todays),
            }
        )
    rows.sort(key=lambda r: (not r["required"], r["name"] or ""))
    all_entries = await query(mv.DELIVERIES, [("vendorId", "==", user["id"])], limit=5000)
    day_entries = [e for e in all_entries if e.get("deliveryDate") == day.isoformat() and e.get("shift") == shift]
    delivered = [e for e in day_entries if e.get("status") == "delivered"]
    summary = {
        "requiredCount": sum(1 for r in rows if r["required"]),
        "deliveredCount": len(delivered),
        "skippedCount": sum(1 for e in day_entries if e.get("status") == "skipped"),
        "totalQuantityMilliLitres": sum(int(e.get("quantityMilliLitres") or 0) for e in delivered),
        "collectionValuePaisa": sum(int(e.get("amountPaisa") or 0) for e in delivered),
    }
    return {"date": day.isoformat(), "shift": shift, "rows": rows, "summary": summary}


@router.post("/deliveries", status_code=201)
async def create_delivery(body: dict, user: dict = Depends(_vendor)):
    _require_kyc(user)
    client = await _get_client(user["id"], str(body.get("clientId") or ""))
    if client.get("status") == "inactive":
        _error(409, "CLIENT_INACTIVE", "client is inactive; reactivate before recording deliveries")
    day = _parse_day(str(body.get("deliveryDate") or ""), "deliveryDate") if body.get("deliveryDate") else mv.today_in()
    shift = body.get("shift") or client.get("defaultShift") or "morning"
    if shift not in mv.SHIFTS:
        _error(422, "INVALID_SHIFT", "shift must be morning/evening")
    status = body.get("status") or "delivered"
    if status not in ("delivered", "skipped", "paused"):
        _error(422, "INVALID_STATUS", "status must be delivered/skipped/paused")
    extra = bool(body.get("extra"))
    product_id = str(body.get("productId") or client.get("defaultProductId") or "")
    dup = await _duplicate_delivery(user["id"], client["id"], product_id, day.isoformat(), shift, extra)
    if dup is not None:
        _error(409, "DUPLICATE_DELIVERY", "an entry already exists for this client, product, date, shift and type; edit it instead")
    vendor_rate = body.get("ratePaisaPerUnit")
    if vendor_rate is not None and (not isinstance(vendor_rate, int) or isinstance(vendor_rate, bool) or vendor_rate <= 0):
        _error(422, "INVALID_RATE", "ratePaisaPerUnit must be a positive integer")
    qty = body.get("quantityMilliLitres")
    if qty is not None and (not isinstance(qty, int) or isinstance(qty, bool) or qty < 0):
        _error(422, "INVALID_QUANTITY", "quantityMilliLitres must be an integer")
    doc = await _write_delivery(
        user["id"], client, day, shift, status, qty, product_id or None, extra,
        str(body.get("notes") or ""), vendor_rate, user["id"],
    )
    return doc


@router.post("/deliveries/bulk")
async def bulk_deliveries(
    body: dict,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    user: dict = Depends(_vendor),
):
    """One-call day save. Entries upsert by occurrence (client+product+date+
    shift+extra); a repeated Idempotency-Key replays the stored response."""
    _require_kyc(user)
    stored = await idempotency.replay(f"milk.vendor.deliveries.bulk.{user['id']}", idempotency_key)
    if stored:
        return stored
    day = _parse_day(str(body.get("deliveryDate") or ""), "deliveryDate") if body.get("deliveryDate") else mv.today_in()
    shift = body.get("shift")
    if shift and shift not in mv.SHIFTS:
        _error(422, "INVALID_SHIFT", "shift must be morning/evening")
    entries = body.get("entries") or []
    if not isinstance(entries, list) or not (1 <= len(entries) <= 500):
        _error(422, "INVALID_ENTRIES", "entries must be a list of 1..500 items")

    results = []
    seen: set[tuple] = set()
    for raw in entries:
        item = dict(raw)
        client = await _get_client(user["id"], str(item.get("clientId") or ""))
        if client.get("status") == "inactive":
            _error(409, "CLIENT_INACTIVE", f"client {client.get('name')} is inactive")
        item_shift = item.get("shift") or shift or client.get("defaultShift") or "morning"
        status = item.get("status") or "delivered"
        if status not in ("delivered", "skipped", "paused"):
            _error(422, "INVALID_STATUS", "status must be delivered/skipped/paused")
        extra = bool(item.get("extra"))
        product_id = str(item.get("productId") or client.get("defaultProductId") or "")
        key = (client["id"], product_id, day.isoformat(), item_shift, extra)
        if key in seen:
            _error(422, "DUPLICATE_IN_REQUEST", f"duplicate entry for {client.get('name')} in this request")
        seen.add(key)
        qty = item.get("quantityMilliLitres")
        if qty is not None and (not isinstance(qty, int) or isinstance(qty, bool) or qty < 0):
            _error(422, "INVALID_QUANTITY", "quantityMilliLitres must be an integer")
        existing = await _duplicate_delivery(user["id"], client["id"], product_id, day.isoformat(), item_shift, extra)
        doc = await _write_delivery(
            user["id"], client, day, item_shift, status, qty, product_id or None, extra,
            str(item.get("notes") or ""), item.get("ratePaisaPerUnit"), user["id"], existing=existing,
        )
        results.append({"delivery": doc, "duplicate": existing is not None})
    out = {"date": day.isoformat(), "results": results, "total": len(results)}
    if idempotency_key:
        await idempotency.store(f"milk.vendor.deliveries.bulk.{user['id']}", idempotency_key, out)
    return out


@router.get("/deliveries")
async def list_deliveries(
    clientId: str | None = None,
    status: DeliveryStatus | None = None,
    from_: str | None = Query(None, alias="from"),
    to: str | None = None,
    user: dict = Depends(_vendor),
):
    _require_kyc(user)
    filters = [("vendorId", "==", user["id"])]
    if clientId:
        client = await _get_client(user["id"], clientId)
        filters.append(("clientId", "==", client["id"]))
    start = _parse_day(from_, "from") if from_ else None
    end = _parse_day(to, "to") if to else None
    rows = await query(mv.DELIVERIES, filters, limit=5000)
    data = [
        d
        for d in rows
        if (status is None or d.get("status") == status)
        and (start is None or d.get("deliveryDate", "") >= start.isoformat())
        and (end is None or d.get("deliveryDate", "") <= end.isoformat())
    ]
    data.sort(key=lambda d: (d.get("deliveryDate") or "", d.get("createdAt") or ""), reverse=True)
    return {"data": data, "total": len(data)}


@router.patch("/deliveries/{delivery_id}")
async def correct_delivery(delivery_id: str, body: dict, user: dict = Depends(_vendor)):
    """Correction with mandatory reason + audit trail. If the delivery is part
    of a generated bill, the bill is left untouched and the response flags
    that a revised bill is needed — historical bills are never silently edited."""
    _require_kyc(user)
    delivery = await get_doc(mv.DELIVERIES, delivery_id)
    if delivery is None or delivery.get("vendorId") != user["id"]:
        _error(404, "DELIVERY_NOT_FOUND", "delivery not found")
    client = await _get_client(user["id"], delivery["clientId"])
    reason = str(body.get("correctionReason") or "").strip()
    if len(reason) < 3:
        _error(422, "REASON_REQUIRED", "correctionReason is required for corrections", {"correctionReason": "required"})

    status = body.get("status") or delivery.get("status")
    if status not in ("delivered", "skipped", "paused"):
        _error(422, "INVALID_STATUS", "status must be delivered/skipped/paused")
    qty = body.get("quantityMilliLitres", delivery.get("quantityMilliLitres"))
    if status == "delivered":
        if not isinstance(qty, int) or isinstance(qty, bool) or qty <= 0:
            _error(422, "INVALID_QUANTITY", "delivered quantity must be positive")
    vendor_rate = body.get("ratePaisaPerUnit")
    if vendor_rate is not None and (not isinstance(vendor_rate, int) or isinstance(vendor_rate, bool) or vendor_rate <= 0):
        _error(422, "INVALID_RATE", "ratePaisaPerUnit must be a positive integer")

    before = {
        "status": delivery.get("status"),
        "quantityMilliLitres": delivery.get("quantityMilliLitres"),
        "amountPaisa": delivery.get("amountPaisa"),
        "appliedRatePaisaPerUnit": delivery.get("appliedRatePaisaPerUnit"),
    }
    day = mv.parse_day(delivery["deliveryDate"])
    doc = await _write_delivery(
        user["id"], client, day, delivery.get("shift") or "morning", status,
        qty if status == "delivered" else 0, delivery.get("productId"), bool(delivery.get("extra")),
        str(body.get("notes") if body.get("notes") is not None else delivery.get("notes") or ""),
        vendor_rate, user["id"], existing=delivery,
    )
    doc["corrections"] = (delivery.get("corrections") or []) + [
        {"at": _now(), "by": user["id"], "reason": reason, "from": before,
         "to": {"status": doc["status"], "quantityMilliLitres": doc["quantityMilliLitres"], "amountPaisa": doc["amountPaisa"]}}
    ]
    doc["correctionReason"] = reason
    doc["correctedAt"] = _now()
    await set_doc(mv.DELIVERIES, doc["id"], doc)
    if doc.get("billedBillId"):
        doc["requiresBillRevision"] = True
        doc["billWarning"] = "this delivery is part of a generated bill — generate a revised bill to update the customer-facing amount"
    return doc


# ----------------------------------------------------------------------- bills --


def _bill_out(bill: dict) -> dict:
    out = dict(bill)
    out["hasShareLink"] = bool(bill.get("shareTokenHash"))
    return out


async def _get_bill(vendor_id: str, bill_id: str) -> dict:
    bill = await get_doc(mv.BILLS, bill_id)
    if bill is None or bill.get("vendorId") != vendor_id:
        _error(404, "BILL_NOT_FOUND", "bill not found")
    return bill


def _validate_period(body: dict) -> tuple[date, date]:
    if not body.get("periodStart") or not body.get("periodEnd"):
        _error(422, "INVALID_PERIOD", "periodStart and periodEnd are required", {"periodStart": "required", "periodEnd": "required"})
    start = _parse_day(str(body["periodStart"]), "periodStart")
    end = _parse_day(str(body["periodEnd"]), "periodEnd")
    if end < start:
        _error(422, "INVALID_PERIOD", "periodEnd must be on/after periodStart")
    if (end - start).days > 92:
        _error(422, "INVALID_PERIOD", "billing period cannot exceed 92 days")
    return start, end


async def _build_bill_doc(user: dict, client: dict, profile: dict, calc: dict, start: date, end: date, adjustments: int, notes: str, reason: str | None = None) -> dict:
    now = _now()
    return {
        "id": f"mbill_{uuid.uuid4().hex[:12]}",
        "vendorId": user["id"],
        "clientId": client["id"],
        "billNumber": "PENDING",
        "revisionNumber": 1,
        "supersedesBillId": None,
        "periodStart": start.isoformat(),
        "periodEnd": end.isoformat(),
        "status": "generated",
        "deliveryTotalPaisa": calc["deliveryTotalPaisa"],
        "adjustmentsPaisa": calc["adjustmentsPaisa"],
        "grossTotalPaisa": calc["grossTotalPaisa"],
        "openingBalancePaisa": calc["openingBalancePaisa"],
        "paymentsAppliedPaisa": calc["paymentsAppliedPaisa"],
        "balancePaisa": calc["balancePaisa"],
        "usedClientOpeningBalance": calc["usedClientOpeningBalance"],
        "appliedPaymentIds": [p["id"] for p in calc["appliedPayments"]],
        "lineItems": calc["lineItems"],
        "deliveryIds": calc["deliveryIds"],
        "clientName": client.get("name", ""),
        "clientArea": client.get("area") or client.get("address") or "",
        "clientWhatsappNumber": client.get("whatsappNumber", ""),
        "vendorBusinessName": profile.get("businessName") or profile.get("displayName") or "",
        "vendorDisplayName": profile.get("displayName") or "",
        "vendorPhone": profile.get("phone") or "",
        "vendorWhatsappNumber": profile.get("whatsappNumber") or "",
        "vendorAddress": profile.get("address") or "",
        "paymentInstructionsSnapshot": profile.get("paymentInstructions") or "",
        "upiIdSnapshot": profile.get("upiId") or "",
        "notesSnapshot": notes or profile.get("defaultBillNotes") or "",
        "pdfStorageReference": None,
        "shareTokenHash": None,
        "sharedAt": None,
        "shareChannel": None,
        "generatedAt": now,
        "generatedBy": user["id"],
        "revisionReason": reason,
        "createdAt": now,
        "updatedAt": now,
    }


async def _attach_pdf(bill: dict, user: dict, client: dict, profile: dict) -> dict:
    pdf_bytes = mvpdf.render_bill_pdf(bill, profile, client)
    blob_path, _ = upload_user_file(user["id"], pdf_bytes, f"{bill['billNumber']}.pdf", "application/pdf", prefix="milk_bills")
    bill["pdfStorageReference"] = blob_path
    bill["updatedAt"] = _now()
    await set_doc(mv.BILLS, bill["id"], bill)
    return bill


@router.post("/bills/preview")
async def preview_bill(body: dict, user: dict = Depends(_vendor)):
    _require_kyc(user)
    client = await _get_client(user["id"], str(body.get("clientId") or ""))
    start, end = _validate_period(body)
    adjustments = body.get("adjustmentsPaisa") or 0
    if not isinstance(adjustments, int) or isinstance(adjustments, bool):
        _error(422, "INVALID_AMOUNT", "adjustmentsPaisa must be an integer")
    calc = await mv.compute_bill(client, start, end, adjustments)
    calc["client"] = {"id": client["id"], "name": client.get("name"), "billingCycle": client.get("billingCycle")}
    return calc


@router.post("/bills", status_code=201)
async def generate_bill(
    body: dict,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    user: dict = Depends(_vendor),
):
    _require_kyc(user)
    stored = await idempotency.replay(f"milk.vendor.bills.{user['id']}", idempotency_key)
    if stored:
        return stored
    client = await _get_client(user["id"], str(body.get("clientId") or ""))
    start, end = _validate_period(body)
    adjustments = body.get("adjustmentsPaisa") or 0
    if not isinstance(adjustments, int) or isinstance(adjustments, bool):
        _error(422, "INVALID_AMOUNT", "adjustmentsPaisa must be an integer")
    notes = str(body.get("notes") or "")[:500]

    # Atomicity: a per-vendor lock around revalidation → recalculation →
    # delivery locking → sequence allocation, so concurrent generation can
    # never duplicate a bill number or bill the same delivery twice.
    from app.services.milk_vendor import _redis_lock, _redis_unlock

    lock_name = f"lock:milk_vendor:billgen:{user['id']}"
    lock_token = uuid.uuid4().hex
    await _redis_lock(lock_name, lock_token, ttl=60)
    try:
        calc = await mv.compute_bill(client, start, end, adjustments)
        if not calc["deliveryIds"]:
            _error(422, "NO_DELIVERIES", "no unbilled delivered deliveries in this period")
        profile = await _get_profile(user["id"])
        bill = await _build_bill_doc(user, client, profile, calc, start, end, adjustments, notes)
        bill["billNumber"] = await mv.allocate_bill_number(user["id"], profile.get("billPrefix") or "MV")
        for delivery_id in calc["deliveryIds"]:
            delivery = await get_doc(mv.DELIVERIES, delivery_id)
            if delivery is None or delivery.get("billedBillId"):
                _error(409, "BILL_OVERLAP", "a delivery in this period was just billed — retry the preview")
            delivery["billedBillId"] = bill["id"]
            delivery["updatedAt"] = _now()
            await set_doc(mv.DELIVERIES, delivery_id, delivery)
        bill["lineItems"] = calc["lineItems"]
        bill["deliveryIds"] = calc["deliveryIds"]
        bill["deliveryTotalPaisa"] = calc["deliveryTotalPaisa"]
        bill["grossTotalPaisa"] = calc["grossTotalPaisa"]
        bill["openingBalancePaisa"] = calc["openingBalancePaisa"]
        bill["paymentsAppliedPaisa"] = calc["paymentsAppliedPaisa"]
        bill["balancePaisa"] = calc["balancePaisa"]
        bill["appliedPaymentIds"] = [p["id"] for p in calc["appliedPayments"]]
        await set_doc(mv.BILLS, bill["id"], bill)
        bill = await _attach_pdf(bill, user, client, profile)
    finally:
        await _redis_unlock(lock_name, lock_token)
    result = _bill_out(bill)
    if idempotency_key:
        await idempotency.store(f"milk.vendor.bills.{user['id']}", idempotency_key, result)
    return result


@router.get("/bills")
async def list_bills(clientId: str | None = None, status: str | None = None, user: dict = Depends(_vendor)):
    _require_kyc(user)
    filters = [("vendorId", "==", user["id"])]
    if clientId:
        client = await _get_client(user["id"], clientId)
        filters.append(("clientId", "==", client["id"]))
    rows = await query(mv.BILLS, filters, limit=1000)
    data = [_bill_out(b) for b in rows if status is None or b.get("status") == status]
    data.sort(key=lambda b: (b.get("periodStart") or "", b.get("createdAt") or ""), reverse=True)
    return {"data": data, "total": len(data)}


@router.get("/bills/{bill_id}")
async def get_bill(bill_id: str, user: dict = Depends(_vendor)):
    _require_kyc(user)
    return _bill_out(await _get_bill(user["id"], bill_id))


@router.get("/bills/{bill_id}/pdf")
async def bill_pdf(bill_id: str, user: dict = Depends(_vendor)):
    _require_kyc(user)
    bill = await _get_bill(user["id"], bill_id)
    ref = bill.get("pdfStorageReference")
    if not ref:
        _error(404, "PDF_NOT_FOUND", "this bill has no stored PDF")
    data = read_blob(ref)
    if not data:
        _error(404, "PDF_NOT_FOUND", "stored PDF is unavailable")
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="milk_bill_{bill.get("billNumber", bill_id)}.pdf"'},
    )


@router.post("/bills/{bill_id}/revise", status_code=201)
async def revise_bill(bill_id: str, body: dict, user: dict = Depends(_vendor)):
    """Immutable-bill rule: the original stays untouched; a new revision (same
    bill number, +1 revision) is generated, the old link is revoked, and
    deliveries are re-pointed to the new revision. Payments are never deleted."""
    _require_kyc(user)
    old = await _get_bill(user["id"], bill_id)
    if not mv.active_tip(old):
        _error(409, "BILL_NOT_ACTIVE", "only a generated/shared bill can be revised")
    reason = str(body.get("reason") or "").strip()
    if len(reason) < 3:
        _error(422, "REASON_REQUIRED", "a revision reason is required", {"reason": "required"})
    adjustments = body.get("adjustmentsPaisa", old.get("adjustmentsPaisa") or 0)
    if not isinstance(adjustments, int) or isinstance(adjustments, bool):
        _error(422, "INVALID_AMOUNT", "adjustmentsPaisa must be an integer")

    client = await _get_client(user["id"], old["clientId"])
    profile = await _get_profile(user["id"])
    start = mv.parse_day(old["periodStart"])
    end = mv.parse_day(old["periodEnd"])

    from app.services.milk_vendor import _redis_lock, _redis_unlock

    lock_name = f"lock:milk_vendor:billgen:{user['id']}"
    lock_token = uuid.uuid4().hex
    await _redis_lock(lock_name, lock_token, ttl=60)
    try:
        # Recompute from the delivery records the old bill selected (plus any
        # newly delivered unbilled ones in the same period).
        calc = await mv.compute_bill(client, start, end, adjustments)
        selected = set(calc["deliveryIds"]) | set(old.get("deliveryIds") or [])
        rows = []
        for did in selected:
            d = await get_doc(mv.DELIVERIES, did)
            if d is not None and d.get("status") == "delivered":
                rows.append(d)
        rows.sort(key=lambda d: (d.get("deliveryDate") or "", d.get("createdAt") or ""))
        products = await _vendor_products(user["id"])
        names = mvpdf.product_names_for(products)
        line_items = [mv.line_item_snapshot(d, names.get(d.get("productId"), "Milk")) for d in rows]
        delivery_total = sum(i["amountPaisa"] for i in line_items)
        gross = delivery_total + adjustments
        # Payments linked to the old bill carry over; unlinked payments not
        # captured elsewhere and dated on/before periodEnd apply too.
        payments, payments_applied = await mv.applicable_payments(client["id"], end, own_bill_id=old["id"])
        opening = int(old.get("openingBalancePaisa") or 0)
        balance = gross + opening - payments_applied

        now = _now()
        new_bill = dict(old)
        new_bill.update(
            {
                "id": f"mbill_{uuid.uuid4().hex[:12]}",
                "revisionNumber": int(old.get("revisionNumber") or 1) + 1,
                "supersedesBillId": old["id"],
                "status": "generated",
                "deliveryTotalPaisa": delivery_total,
                "adjustmentsPaisa": adjustments,
                "grossTotalPaisa": gross,
                "paymentsAppliedPaisa": payments_applied,
                "balancePaisa": balance,
                "appliedPaymentIds": [p["id"] for p in payments],
                "lineItems": line_items,
                "deliveryIds": [d["id"] for d in rows],
                "revisionReason": reason,
                "generatedAt": now,
                "generatedBy": user["id"],
                "pdfStorageReference": None,
                "shareTokenHash": None,
                "sharedAt": None,
                "shareChannel": None,
                "createdAt": now,
                "updatedAt": now,
            }
        )
        for d in rows:
            d["billedBillId"] = new_bill["id"]
            d["updatedAt"] = now
            await set_doc(mv.DELIVERIES, d["id"], d)
        # Old revision: preserved but no longer customer-facing.
        old["status"] = "revised"
        old["shareTokenHash"] = None
        old["supersededById"] = new_bill["id"]
        old["updatedAt"] = now
        await set_doc(mv.BILLS, old["id"], old)
        await set_doc(mv.BILLS, new_bill["id"], new_bill)
        new_bill = await _attach_pdf(new_bill, user, client, profile)
    finally:
        await _redis_unlock(lock_name, lock_token)
    return _bill_out(new_bill)


@router.post("/bills/{bill_id}/cancel")
async def cancel_bill(bill_id: str, body: dict, user: dict = Depends(_vendor)):
    _require_kyc(user)
    bill = await _get_bill(user["id"], bill_id)
    if not mv.active_tip(bill):
        _error(409, "BILL_NOT_ACTIVE", "only a generated/shared bill can be cancelled")
    reason = str(body.get("reason") or "").strip()
    if len(reason) < 3:
        _error(422, "REASON_REQUIRED", "a cancellation reason is required", {"reason": "required"})
    now = _now()
    for did in bill.get("deliveryIds") or []:
        delivery = await get_doc(mv.DELIVERIES, did)
        if delivery is not None and delivery.get("billedBillId") == bill_id:
            delivery["billedBillId"] = None
            delivery["updatedAt"] = now
            await set_doc(mv.DELIVERIES, did, delivery)
    bill["status"] = "cancelled"
    bill["cancelReason"] = reason
    bill["cancelledAt"] = now
    bill["shareTokenHash"] = None
    bill["updatedAt"] = now
    await set_doc(mv.BILLS, bill_id, bill)
    return _bill_out(bill)


@router.post("/bills/{bill_id}/share-link")
async def bill_share_link(bill_id: str, user: dict = Depends(_vendor)):
    """Create/regenerate the secure customer link. Only a hash is stored; the
    raw token is returned exactly once, here."""
    _require_kyc(user)
    bill = await _get_bill(user["id"], bill_id)
    if not mv.active_tip(bill):
        _error(409, "BILL_NOT_ACTIVE", "only a generated/shared bill can be shared")
    token = mv.new_share_token()
    bill["shareTokenHash"] = mv.hash_share_token(token)
    ttl_days = int(getattr(settings, "milk_vendor_share_link_ttl_days", 0) or 0)
    bill["shareTokenExpiresAt"] = (datetime.now(timezone.utc) + timedelta(days=ttl_days)).isoformat() if ttl_days > 0 else None
    bill["updatedAt"] = _now()
    await set_doc(mv.BILLS, bill_id, bill)
    return {"url": mv.public_bill_url(token), "token": token, "expiresAt": bill["shareTokenExpiresAt"]}


@router.post("/bills/{bill_id}/share-event")
async def bill_share_event(bill_id: str, body: dict, user: dict = Depends(_vendor)):
    """Records that the vendor started a share (e.g. opened WhatsApp) — never a
    delivered/read claim, which no official integration here returns."""
    _require_kyc(user)
    bill = await _get_bill(user["id"], bill_id)
    if not mv.active_tip(bill):
        _error(409, "BILL_NOT_ACTIVE", "bill is not customer-facing")
    channel = str(body.get("channel") or "whatsapp")
    if channel not in ("whatsapp", "link", "pdf"):
        _error(422, "INVALID_CHANNEL", "channel must be whatsapp/link/pdf")
    bill["sharedAt"] = _now()
    bill["shareChannel"] = channel
    bill["status"] = "shared"
    bill["updatedAt"] = bill["sharedAt"]
    await set_doc(mv.BILLS, bill_id, bill)
    return {"ok": True, "sharedAt": bill["sharedAt"], "shareChannel": channel, "status": "shared"}


# ------------------------------------------------------------------- payments --


@router.get("/payments")
async def list_payments(clientId: str | None = None, user: dict = Depends(_vendor)):
    _require_kyc(user)
    filters = [("vendorId", "==", user["id"])]
    if clientId:
        client = await _get_client(user["id"], clientId)
        filters.append(("clientId", "==", client["id"]))
    rows = await query(mv.PAYMENTS, filters, limit=1000)
    rows.sort(key=lambda p: (p.get("paymentDate") or "", p.get("createdAt") or ""), reverse=True)
    return {"data": rows, "total": len(rows)}


@router.post("/payments", status_code=201)
async def record_payment(body: dict, user: dict = Depends(_vendor)):
    """Vendor-entered external payment (cash/UPI/bank made directly to the
    vendor, outside Agrovercity). Never verified, never a gateway txn."""
    _require_kyc(user)
    client = await _get_client(user["id"], str(body.get("clientId") or ""))
    amount = body.get("amountPaisa")
    if not isinstance(amount, int) or isinstance(amount, bool) or amount <= 0:
        _error(422, "INVALID_AMOUNT", "amountPaisa must be a positive integer", {"amountPaisa": "positive integer (paisa)"})
    day = _parse_day(str(body.get("paymentDate") or ""), "paymentDate") if body.get("paymentDate") else mv.today_in()
    method = body.get("method") or "cash"
    if method not in ("cash", "upi", "bankTransfer", "other"):
        _error(422, "INVALID_METHOD", "method must be cash/upi/bankTransfer/other")
    bill_id = body.get("billId")
    if bill_id:
        await _get_bill(user["id"], str(bill_id))
    now = _now()
    payment = {
        "id": f"mpay_{uuid.uuid4().hex[:12]}",
        "vendorId": user["id"],
        "clientId": client["id"],
        "billId": str(bill_id) if bill_id else None,
        "amountPaisa": amount,
        "paymentDate": day.isoformat(),
        "method": method,
        "externalReference": str(body.get("externalReference") or "")[:120] or None,
        "notes": str(body.get("notes") or "")[:300],
        "recordedBy": user["id"],
        "createdAt": now,
        "voidedAt": None,
        "voidReason": None,
    }
    await set_doc(mv.PAYMENTS, payment["id"], payment)
    payment["clientRecordedBalancePaisa"] = await mv.client_recorded_balance_paisa(client)
    return payment


@router.post("/payments/{payment_id}/void")
async def void_payment(payment_id: str, body: dict, user: dict = Depends(_vendor)):
    _require_kyc(user)
    payment = await get_doc(mv.PAYMENTS, payment_id)
    if payment is None or payment.get("vendorId") != user["id"]:
        _error(404, "PAYMENT_NOT_FOUND", "payment not found")
    if payment.get("voidedAt"):
        return payment
    reason = str(body.get("reason") or "").strip()
    if len(reason) < 3:
        _error(422, "REASON_REQUIRED", "a void reason is required", {"reason": "required"})
    payment["voidedAt"] = _now()
    payment["voidReason"] = reason
    await set_doc(mv.PAYMENTS, payment_id, payment)
    client = await _get_client(user["id"], payment["clientId"])
    payment["clientRecordedBalancePaisa"] = await mv.client_recorded_balance_paisa(client)
    return payment


# --------------------------------------------------------------------- public --


async def _resolve_public_bill(token: str) -> dict:
    bill_hash = mv.hash_share_token(token)
    hits = await query(mv.BILLS, [("shareTokenHash", "==", bill_hash)], limit=1)
    if not hits:
        _error(404, "BILL_LINK_INVALID", "bill link is invalid or revoked")
    bill = hits[0]
    if not mv.active_tip(bill):
        _error(404, "BILL_LINK_INVALID", "bill link is invalid or revoked")
    expiry = bill.get("shareTokenExpiresAt")
    if expiry and expiry < _now():
        _error(404, "BILL_LINK_INVALID", "bill link is invalid or revoked")
    return bill


@public_router.get("/{token}")
async def public_bill(token: str, request: Request):
    await ratelimit.hit("public.milk_bills", request.client.host if request.client else "unknown", 60, 60)
    bill = await _resolve_public_bill(token)
    client = await get_doc(mv.CLIENTS, bill["clientId"]) or {"name": bill.get("clientName"), "area": bill.get("clientArea")}
    profile = await get_doc(mv.PROFILES, bill["vendorId"]) or {}
    return mv.sanitize_public_bill(bill, profile, client)


@public_router.get("/{token}/pdf")
async def public_bill_pdf(token: str, request: Request):
    await ratelimit.hit("public.milk_bills.pdf", request.client.host if request.client else "unknown", 30, 60)
    bill = await _resolve_public_bill(token)
    ref = bill.get("pdfStorageReference")
    if not ref:
        _error(404, "PDF_NOT_FOUND", "bill PDF is unavailable")
    data = read_blob(ref)
    if not data:
        _error(404, "PDF_NOT_FOUND", "bill PDF is unavailable")
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="milk_bill_{bill.get("billNumber", "bill")}.pdf"'},
    )
