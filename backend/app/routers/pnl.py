import json
from datetime import date, timedelta
from math import ceil

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from app.core.cache import cache_get, cache_set
from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.data.demo_pnl import DEMO_CROPS
from app.models.pnl import (
    BreakEvenIn,
    BreakEvenOut,
    CropPandL,
    ExpenseIn,
    PnlSummary,
)
from app.services import reports
from app.services.pnl_engine import build_dashboard
from app.services.users import get_user

router = APIRouter(prefix="/pnl", tags=["pnl"])

ROLES = ("farmer", "farmLandlord", "seller", "equipmentRental", "broker")
PNL_CACHE_TTL_SECONDS = 300


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def _viewer(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    # Farm P&L reads the user's own cashbook — every persona gets it
    # (product decision, same as the cashbook itself).
    return uid


async def list_subdocs(path: str) -> list[dict]:
    return await query(path, [], limit=1000)


async def _crops(uid: str) -> list[dict]:
    return await list_subdocs(f"users/{uid}/crop_pnl")


@router.get("/dashboard")
async def pnl_dashboard(
    months: int = Query(12, ge=3, le=24),
    uid: str = Depends(_viewer),
):
    """Full Farm P&L + cash-flow analysis over the user's cashbook.

    Everything is derived from diary entries, so the dashboard always
    reconciles with the cashbook. Cached 5 minutes like diary analytics.
    """
    key = f"pnl:dashboard:{uid}:{months}"
    cached = await cache_get(key)
    if cached is not None:
        return json.loads(cached)
    entries = await query(f"users/{uid}/diary_entries", [], limit=1000)
    payload = build_dashboard(entries, months)
    await cache_set(key, json.dumps(payload), ttl_seconds=PNL_CACHE_TTL_SECONDS)
    return payload


@router.get("/summary", response_model=PnlSummary)
async def pnl_summary(uid: str = Depends(_viewer)):
    crops = await _crops(uid)
    gross_income = sum(c.get("grossRevenue", 0) for c in crops)
    production_cost = sum(c.get("totalExpenses", 0) for c in crops)
    return PnlSummary(
        grossIncome=gross_income,
        productionCost=production_cost,
        netProfit=gross_income - production_cost,
    )


@router.get("/crops")
async def list_crops(uid: str = Depends(_viewer)):
    crops = await _crops(uid)
    if not crops:
        for demo in DEMO_CROPS:
            await set_doc(f"users/{uid}/crop_pnl", demo["id"], dict(demo))
        crops = await _crops(uid)
    return {"data": crops, "page": 1, "pageSize": 20, "total": len(crops)}


@router.post("/crops/{crop_id}/expenses", response_model=CropPandL)
async def add_expense(crop_id: str, body: ExpenseIn, uid: str = Depends(_viewer)):
    crop = await get_doc(f"users/{uid}/crop_pnl", crop_id)
    if crop is None:
        _error(404, "CROP_NOT_FOUND", "crop not found")
    breakdown = crop.get("expensesBreakdown", [])
    breakdown.append({"category": body.category, "amount": body.amount})
    crop["expensesBreakdown"] = breakdown
    crop["totalExpenses"] = sum(e.get("amount", 0) for e in breakdown)
    crop["netProfit"] = crop.get("grossRevenue", 0) - crop["totalExpenses"]
    crop["roiPercent"] = (
        round(crop["netProfit"] / crop["totalExpenses"] * 100, 1)
        if crop["totalExpenses"]
        else 0
    )
    await set_doc(f"users/{uid}/crop_pnl", crop_id, crop)
    return CropPandL(**crop)


@router.post("/break-even", response_model=BreakEvenOut)
async def break_even(body: BreakEvenIn, uid: str = Depends(_viewer)):
    return BreakEvenOut(
        minSafePricePerQuintal=ceil(body.totalCost / body.expectedYieldQuintals)
    )


def _resolve_range(from_date: str | None, to_date: str | None) -> tuple[str, str]:
    today = date.today()
    if from_date is None:
        from_date = today.replace(day=1).isoformat()
    if to_date is None:
        if today.month == 12:
            first_next = today.replace(year=today.year + 1, month=1, day=1)
        else:
            first_next = today.replace(month=today.month + 1, day=1)
        to_date = (first_next - timedelta(days=1)).isoformat()
    return from_date, to_date


async def _entries_in_range(uid: str, from_date: str, to_date: str) -> list[dict]:
    entries = await query(f"users/{uid}/diary_entries", [], limit=1000)
    return [e for e in entries if from_date <= e.get("date", "") <= to_date]


@router.get("/report.pdf")
async def pnl_report_pdf(
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    uid: str = Depends(_viewer),
):
    """PDF export of the P&L statement for the range (defaults to this month)."""
    start, end = _resolve_range(from_date, to_date)
    entries = await _entries_in_range(uid, start, end)
    path = reports.build_pnl_pdf(uid, entries, start, end)
    with open(path, "rb") as handle:
        body = handle.read()
    return Response(
        content=body,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="pnl-report.pdf"'},
    )


@router.get("/export/tally")
async def pnl_export_tally(
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    uid: str = Depends(_viewer),
):
    """Tally-compatible CSV export — column mapping in services/reports.py."""
    start, end = _resolve_range(from_date, to_date)
    entries = await _entries_in_range(uid, start, end)
    csv_body = reports.build_tally_csv(entries)
    return Response(
        content=csv_body,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="pnl-tally.csv"'},
    )
