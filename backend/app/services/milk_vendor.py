"""Milk Vendor (Doodhwala) domain logic.

Door-to-door milk vendors manage private client records (no customer accounts),
record daily deliveries from schedules, and generate immutable bills with PDFs
and secure WhatsApp share links. This module holds the pure domain rules —
money arithmetic, schedule evaluation, rate resolution, bill calculation,
share tokens, and bill-number allocation — so the HTTP layer stays thin and
every rule is directly unit-testable.

Money rules (documented contract):
- Quantity is integer millilitres; money is integer paisa; rates are integer
  paisa per litre.
- Line amount: ``amountPaisa = (quantityMl * ratePaisaPerL + 500) // 1000`` —
  i.e. quantity-in-litres × rate, rounded HALF-UP at the line-item level.
- Bills sum integer line amounts; floating point is never used for stored
  totals.
"""

import hashlib
import secrets
import uuid
from datetime import date, datetime, timedelta, timezone

from app.core.config import settings
from app.core.db import get_doc, query, set_doc

PROFILES = "milk_vendor_profiles"
CLIENTS = "milk_clients"
PRODUCTS = "milk_vendor_products"
RATES = "milk_rate_rules"
DELIVERIES = "milk_deliveries"
BILLS = "milk_bills"
PAYMENTS = "milk_payments"

SHIFTS = ("morning", "evening")
BILL_STATUSES = ("generated", "shared", "revised", "cancelled")
ACTIVE_BILL_STATUSES = ("generated", "shared")

DEFAULT_TIMEZONE = "Asia/Kolkata"


# --------------------------------------------------------------------- dates --


def today_in(tz_name: str = DEFAULT_TIMEZONE) -> date:
    """Business 'today' in the vendor's timezone (defaults to Asia/Kolkata)."""
    try:
        from zoneinfo import ZoneInfo

        return datetime.now(ZoneInfo(tz_name or DEFAULT_TIMEZONE)).date()
    except Exception:  # noqa: BLE001 — unknown tz must never break the day book
        return datetime.now(timezone.utc).date()


def parse_day(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


# --------------------------------------------------------------------- money --


def amount_paisa(quantity_ml: int, rate_paisa_per_litre: int) -> int:
    """quantity(ml) × rate(paisa/litre) with HALF-UP rounding at line level."""
    if quantity_ml <= 0 or rate_paisa_per_litre <= 0:
        return 0
    return (quantity_ml * rate_paisa_per_litre + 500) // 1000


def fmt_rupees(paisa: int) -> str:
    rupees = (paisa or 0) / 100
    return f"Rs {rupees:,.2f}"


# ------------------------------------------------------------------ schedules --


def _pause_ranges(client: dict) -> list[dict]:
    return [r for r in (client.get("pauseRanges") or []) if r.get("startDate") and r.get("endDate")]


def is_paused_on(client: dict, day: date) -> bool:
    key = day.isoformat()
    return any(r["startDate"] <= key <= r["endDate"] for r in _pause_ranges(client))


def is_scheduled_on(client: dict, day: date) -> bool:
    """Whether an ACTIVE client expects a delivery on `day` (pause ranges excluded)."""
    if client.get("status") != "active":
        return False
    try:
        start = parse_day(client.get("scheduleStartDate") or "")
    except (ValueError, TypeError):
        return False
    if day < start:
        return False
    stype = client.get("scheduleType") or "daily"
    if stype == "daily":
        expected = True
    elif stype == "alternateDays":
        expected = (day - start).days % 2 == 0
    elif stype == "specificWeekdays":
        expected = day.weekday() in (client.get("weekdays") or [])
    elif stype == "oneTime":
        expected = day.isoformat() == (client.get("oneTimeDate") or "")
    else:
        expected = False
    if not expected or is_paused_on(client, day):
        return False
    return True


# ---------------------------------------------------------------------- rates --


async def resolve_rate(vendor_id: str, product_id: str, client_id: str, day: date) -> int | None:
    """Rate for a delivery date: latest client-specific override, else latest
    vendor default whose effectiveFrom <= day. None when no rule applies."""
    rules = await query(RATES, [("vendorId", "==", vendor_id), ("productId", "==", product_id)], limit=500)
    key = day.isoformat()
    applicable = [r for r in rules if (r.get("effectiveFrom") or "0000-00-00") <= key]
    client_rules = [r for r in applicable if r.get("clientId") == client_id]
    if client_rules:
        latest = max(client_rules, key=lambda r: r.get("effectiveFrom") or "")
        return int(latest["ratePaisaPerUnit"])
    default_rules = [r for r in applicable if not r.get("clientId")]
    if default_rules:
        latest = max(default_rules, key=lambda r: r.get("effectiveFrom") or "")
        return int(latest["ratePaisaPerUnit"])
    return None


# --------------------------------------------------------------- bill helpers --


def active_tip(bill: dict) -> bool:
    """A bill is the customer-facing tip of its chain while generated/shared."""
    return bill.get("status") in ACTIVE_BILL_STATUSES


async def client_bills(client_id: str) -> list[dict]:
    rows = await query(BILLS, [("clientId", "==", client_id)], limit=500)
    return sorted(rows, key=lambda b: (b.get("periodStart") or "", b.get("createdAt") or ""))


async def client_active_tips(client_id: str) -> list[dict]:
    return [b for b in await client_bills(client_id) if active_tip(b)]


async def applied_payment_ids(client_id: str) -> set[str]:
    ids: set[str] = set()
    for bill in await client_active_tips(client_id):
        ids |= set(bill.get("appliedPaymentIds") or [])
    return ids


async def opening_balance_paisa(client: dict, period_start: date) -> tuple[int, bool]:
    """Opening balance for a NEW bill: the client's openingBalancePaisa on the
    first ever (non-cancelled) bill, plus the outstanding balance of every
    earlier active bill chain. Returns (amount, used_client_opening)."""
    key = period_start.isoformat()
    bills = [
        b
        for b in await client_bills(client["id"])
        if (b.get("periodEnd") or "") < key and b.get("status") != "cancelled"
    ]
    prior_tips = [b for b in bills if active_tip(b)]
    if bills:  # a prior bill consumed the client opening balance
        return sum(int(b.get("balancePaisa") or 0) for b in prior_tips), False
    return int(client.get("openingBalancePaisa") or 0), True


async def applicable_payments(client_id: str, period_end: date, own_bill_id: str | None = None) -> tuple[list[dict], int]:
    """Non-voided payments applicable to a bill: payments already linked to it,
    plus unlinked payments dated on/before periodEnd not captured by any other
    active bill. Returns (payments, totalPaisa)."""
    rows = await query(PAYMENTS, [("clientId", "==", client_id)], limit=1000)
    taken = await applied_payment_ids(client_id)
    key = period_end.isoformat()
    out: list[dict] = []
    for p in rows:
        if p.get("voidedAt"):
            continue
        if own_bill_id and p.get("billId") == own_bill_id:
            out.append(p)
        elif not p.get("billId") and (p.get("paymentDate") or "9999-99-99") <= key and p["id"] not in taken:
            out.append(p)
    total = sum(int(p.get("amountPaisa") or 0) for p in out)
    return out, total


async def unbilled_deliveries(client_id: str, start: date, end: date) -> list[dict]:
    rows = await query(DELIVERIES, [("clientId", "==", client_id)], limit=5000)
    key_start, key_end = start.isoformat(), end.isoformat()
    out = [
        d
        for d in rows
        if d.get("status") == "delivered"
        and not d.get("billedBillId")
        and key_start <= d.get("deliveryDate", "") <= key_end
    ]
    return sorted(out, key=lambda d: (d.get("deliveryDate") or "", d.get("shift") or "", d.get("createdAt") or ""))


async def client_recorded_balance_paisa(client: dict) -> int:
    """Live recorded balance: opening balance + every delivered amount (billed
    or not, counting each delivery exactly once) + active-bill adjustments -
    every non-voided payment. Revisions/cancellations never double count."""
    opening = int(client.get("openingBalancePaisa") or 0)
    deliveries = await query(DELIVERIES, [("clientId", "==", client["id"])], limit=5000)
    delivered_total = sum(int(d.get("amountPaisa") or 0) for d in deliveries if d.get("status") == "delivered")
    tips = await client_active_tips(client["id"])
    adjustments = sum(int(b.get("adjustmentsPaisa") or 0) for b in tips)
    payments = await query(PAYMENTS, [("clientId", "==", client["id"])], limit=1000)
    paid = sum(int(p.get("amountPaisa") or 0) for p in payments if not p.get("voidedAt"))
    return opening + delivered_total + adjustments - paid


# ----------------------------------------------------------- bill generation --


def line_item_snapshot(delivery: dict, product_name: str) -> dict:
    return {
        "deliveryDate": delivery.get("deliveryDate"),
        "shift": delivery.get("shift"),
        "productName": product_name,
        "quantityMilliLitres": int(delivery.get("quantityMilliLitres") or 0),
        "appliedRatePaisaPerUnit": int(delivery.get("appliedRatePaisaPerUnit") or 0),
        "amountPaisa": int(delivery.get("amountPaisa") or 0),
        "notes": delivery.get("notes") or "",
    }


async def compute_bill(
    client: dict,
    period_start: date,
    period_end: date,
    adjustments_paisa: int,
    *,
    own_bill_id: str | None = None,
) -> dict:
    """Recompute a bill preview from source records. Client-provided totals are
    never trusted — everything here is backend-derived."""
    from app.services.milk_vendor_pdf import product_names_for

    deliveries = await unbilled_deliveries(client["id"], period_start, period_end)
    products = await query(PRODUCTS, [("vendorId", "==", client["vendorId"])], limit=200)
    names = product_names_for(products)
    line_items = [line_item_snapshot(d, names.get(d.get("productId"), "Milk")) for d in deliveries]
    delivery_total = sum(item["amountPaisa"] for item in line_items)
    gross = delivery_total + adjustments_paisa
    opening, used_client_opening = await opening_balance_paisa(client, period_start)
    payments, payments_applied = await applicable_payments(client["id"], period_end, own_bill_id)
    balance = gross + opening - payments_applied
    return {
        "lineItems": line_items,
        "deliveryIds": [d["id"] for d in deliveries],
        "deliveryTotalPaisa": delivery_total,
        "adjustmentsPaisa": adjustments_paisa,
        "grossTotalPaisa": gross,
        "openingBalancePaisa": opening,
        "usedClientOpeningBalance": used_client_opening,
        "appliedPayments": [
            {
                "id": p["id"],
                "amountPaisa": int(p.get("amountPaisa") or 0),
                "paymentDate": p.get("paymentDate"),
                "method": p.get("method"),
            }
            for p in payments
        ],
        "paymentsAppliedPaisa": payments_applied,
        "balancePaisa": balance,
    }


# -------------------------------------------------------------- bill numbers --


async def _redis_lock(name: str, token: str, ttl: int = 30) -> bool:
    try:
        from app.core.cache import REDIS_ERRORS, get_redis

        r = await get_redis()
        return bool(await r.set(name, token, nx=True, ex=ttl))
    except REDIS_ERRORS:
        return True  # fail open (dev without redis): generation stays correct per-process
    except Exception:  # noqa: BLE001
        return True


async def _redis_unlock(name: str, token: str):
    try:
        from app.core.cache import REDIS_ERRORS, get_redis

        r = await get_redis()
        if await r.get(name) == token:
            await r.delete(name)
    except REDIS_ERRORS:
        pass
    except Exception:  # noqa: BLE001
        pass


async def allocate_bill_number(vendor_id: str, prefix: str) -> str:
    """Next bill number, race-safe via a per-vendor Redis lock around the
    read-modify-write of ``nextBillSequence`` (fails open without redis)."""
    lock_name = f"lock:milk_vendor:billseq:{vendor_id}"
    lock_token = uuid.uuid4().hex
    await _redis_lock(lock_name, lock_token)
    try:
        profile = (await get_doc(PROFILES, vendor_id)) or {}
        seq = int(profile.get("nextBillSequence") or 1)
        profile["nextBillSequence"] = seq + 1
        profile["updatedAt"] = datetime.now(timezone.utc).isoformat()
        await set_doc(PROFILES, vendor_id, profile)
    finally:
        await _redis_unlock(lock_name, lock_token)
    return f"{prefix}-{seq:04d}"


# --------------------------------------------------------------- share tokens --


def new_share_token() -> str:
    return secrets.token_urlsafe(32)


def hash_share_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def public_bill_base_url() -> str:
    base = (settings.public_web_url or settings.web_app_base_url or "").rstrip("/")
    return f"{base}/public/milk-bills"


def public_bill_url(token: str) -> str:
    return f"{public_bill_base_url()}/{token}"


def whatsapp_share_text(*, client_name: str, business_name: str, bill: dict, secure_url: str) -> str:
    period = f"{bill.get('periodStart')} to {bill.get('periodEnd')}"
    return (
        f"Namaste {client_name},\n\n"
        f"Your milk bill from {business_name} is ready.\n\n"
        f"Bill: {bill.get('billNumber')}\n"
        f"Period: {period}\n"
        f"Bill amount: {fmt_rupees(int(bill.get('grossTotalPaisa') or 0))}\n"
        f"Payments recorded: {fmt_rupees(int(bill.get('paymentsAppliedPaisa') or 0))}\n"
        f"Balance shown on bill: {fmt_rupees(int(bill.get('balancePaisa') or 0))}\n\n"
        f"View/download bill:\n{secure_url}\n\n"
        f"Thank you."
    )


def sanitize_public_bill(bill: dict, profile: dict, client: dict) -> dict:
    """Customer-facing projection: exactly what a bill link may reveal — never
    database ids, private notes, internal references, or other bills."""
    vendor = {
        "businessName": profile.get("businessName") or "",
        "displayName": profile.get("displayName") or "",
        "phone": profile.get("phone") or "",
        "whatsappNumber": profile.get("whatsappNumber") or "",
        "address": profile.get("address") or "",
    }
    return {
        "billNumber": bill.get("billNumber"),
        "revisionNumber": bill.get("revisionNumber"),
        "status": bill.get("status"),
        "periodStart": bill.get("periodStart"),
        "periodEnd": bill.get("periodEnd"),
        "generatedAt": bill.get("generatedAt"),
        # Line items reveal only bill-facing data — never per-line vendor notes.
        "lineItems": [
            {k: v for k, v in (item or {}).items() if k != "notes"} for item in (bill.get("lineItems") or [])
        ],
        "deliveryTotalPaisa": bill.get("deliveryTotalPaisa"),
        "adjustmentsPaisa": bill.get("adjustmentsPaisa"),
        "grossTotalPaisa": bill.get("grossTotalPaisa"),
        "openingBalancePaisa": bill.get("openingBalancePaisa"),
        "paymentsAppliedPaisa": bill.get("paymentsAppliedPaisa"),
        "balancePaisa": bill.get("balancePaisa"),
        "paymentInstructions": bill.get("paymentInstructionsSnapshot") or "",
        "upiId": bill.get("upiIdSnapshot") or "",
        "notes": bill.get("notesSnapshot") or "",
        "vendor": vendor,
        "client": {"name": client.get("name") or "", "area": client.get("area") or ""},
    }
