"""Farm P&L engine — pure analysis over cashbook (diary) entries.

Money rules mirror services/diary_analytics.py: only entries with type
"income"/"expense" AND amount != 0 move money. Everything here is computed
from the user's own diary entries so the P&L always reconciles with the
cashbook to the paisa.
"""

from datetime import date

OTHER_BUCKET = "other"


def _month_key(d: date) -> str:
    return f"{d.year:04d}-{d.month:02d}"


def _month_keys(months: int) -> tuple[list[str], list[str]]:
    """Current window (last `months`) + previous equal-length window keys."""
    today = date.today()
    def build(n: int, end_year: int, end_month: int) -> list[str]:
        keys = []
        y, m = end_year, end_month
        for _ in range(n):
            keys.append(f"{y:04d}-{m:02d}")
            m -= 1
            if m == 0:
                m, y = 12, y - 1
        return list(reversed(keys))
    cur = build(months, today.year, today.month)
    prev_end_y, prev_end_m = today.year, today.month - months
    while prev_end_m <= 0:
        prev_end_m += 12
        prev_end_y -= 1
    return cur, build(months, prev_end_y, prev_end_m)


def _is_money(e: dict) -> bool:
    return e.get("type") in ("income", "expense") and e.get("amount", 0) != 0


def _r2(v: float) -> float:
    return round(v + 1e-9, 2)


def _pct(part: float, whole: float) -> float:
    return round(part / whole * 100, 1) if whole else 0.0


def _delta_pct(cur: float, prev: float) -> float:
    if not prev:
        return 0.0
    return round((cur - prev) / abs(prev) * 100, 1)


def _in_months(e: dict, keys: set[str]) -> bool:
    return e.get("date", "")[:7] in keys


def build_dashboard(entries: list[dict], months: int = 12) -> dict:
    months = max(3, min(months, 24))
    cur_keys, prev_keys = _month_keys(months)
    cur_set, prev_set = set(cur_keys), set(prev_keys)

    cur = [e for e in entries if _is_money(e) and _in_months(e, cur_set)]
    prev = [e for e in entries if _is_money(e) and _in_months(e, prev_set)]

    cur_income = _r2(sum(e["amount"] for e in cur if e["type"] == "income"))
    cur_expense = _r2(sum(e["amount"] for e in cur if e["type"] == "expense"))
    prev_income = _r2(sum(e["amount"] for e in prev if e["type"] == "income"))
    prev_expense = _r2(sum(e["amount"] for e in prev if e["type"] == "expense"))
    cur_net = _r2(cur_income - cur_expense)
    prev_net = _r2(prev_income - prev_expense)

    # ---- monthly cash flow + cumulative position + savings rate ----
    monthly_buckets = {k: {"income": 0.0, "expense": 0.0} for k in cur_keys}
    for e in cur:
        bucket = monthly_buckets[e["date"][:7]]
        bucket[e["type"]] += e["amount"]
    cashflow = []
    cumulative = 0.0
    for key in cur_keys:
        b = monthly_buckets[key]
        income = _r2(b["income"])
        expense = _r2(b["expense"])
        net = _r2(income - expense)
        cumulative = _r2(cumulative + net)
        cashflow.append({
            "month": key,
            "income": income,
            "expense": expense,
            "net": net,
            "cumulativeNet": cumulative,
            "savingsRate": _pct(net, income),
        })

    # ---- P&L statement lines ----
    def statement(bucket_entries: list[dict], entry_type: str) -> list[dict]:
        rows: dict[str, dict] = {}
        total = sum(e["amount"] for e in bucket_entries if e["type"] == entry_type)
        for e in bucket_entries:
            if e["type"] != entry_type:
                continue
            cat = e.get("category") or OTHER_BUCKET
            row = rows.setdefault(cat, {"category": cat, "amount": 0.0, "count": 0})
            row["amount"] += e["amount"]
            row["count"] += 1
        out = [
            {"category": c, "type": entry_type, "amount": _r2(r["amount"]), "sharePct": _pct(r["amount"], total), "count": r["count"]}
            for c, r in rows.items()
        ]
        out.sort(key=lambda r: r["amount"], reverse=True)
        return out

    income_lines = statement(cur, "income")
    expense_lines = statement(cur, "expense")

    # ---- category deep dive (trend + share + spike detection) ----
    deep_dive = []
    for line in expense_lines[:8] + income_lines[:4]:
        cat = line["category"]
        etype = line["type"]
        monthly = []
        for key in cur_keys:
            amt = sum(
                e["amount"] for e in cur
                if e.get("category") == cat and e["type"] == etype and e["date"][:7] == key
            )
            monthly.append({"month": key, "amount": _r2(amt)})
        amounts = [m["amount"] for m in monthly]
        nonzero = [a for a in amounts if a > 0]
        avg = _r2(sum(nonzero) / len(nonzero)) if nonzero else 0.0
        max_m = max(monthly, key=lambda m: m["amount"]) if monthly else {"month": "", "amount": 0}
        deep_dive.append({
            "category": cat,
            "type": etype,
            "total": line["amount"],
            "sharePct": line["sharePct"],
            "count": line["count"],
            "avgPerMonth": avg,
            "maxMonth": max_m,
            "spike": bool(avg and max_m["amount"] > 2 * avg and max_m["amount"] > 0),
            "monthly": monthly,
        })

    # ---- party (counterparty) analysis ----
    parties: dict[str, dict] = {}
    for e in cur:
        party = (e.get("party") or "").strip()
        if not party:
            continue
        row = parties.setdefault(party, {"party": party, "inflow": 0.0, "outflow": 0.0, "count": 0})
        row["count"] += 1
        if e["type"] == "income":
            row["inflow"] += e["amount"]
        else:
            row["outflow"] += e["amount"]
    party_rows = [
        {
            "party": p,
            "inflow": _r2(r["inflow"]),
            "outflow": _r2(r["outflow"]),
            "net": _r2(r["inflow"] - r["outflow"]),
            "count": r["count"],
        }
        for p, r in parties.items()
    ]
    party_rows.sort(key=lambda r: max(r["inflow"], r["outflow"]), reverse=True)

    # ---- crop / activity P&L ----
    crops: dict[str, dict] = {}
    for e in cur:
        crop = (e.get("cropName") or "").strip() or OTHER_BUCKET
        row = crops.setdefault(crop, {"cropName": crop, "income": 0.0, "expense": 0.0, "count": 0})
        row["count"] += 1
        if e["type"] == "income":
            row["income"] += e["amount"]
        else:
            row["expense"] += e["amount"]
    crop_rows = [
        {
            "cropName": c,
            "income": _r2(r["income"]),
            "expense": _r2(r["expense"]),
            "net": _r2(r["income"] - r["expense"]),
            "marginPct": _pct(r["income"] - r["expense"], r["income"]),
            "count": r["count"],
        }
        for c, r in crops.items()
    ]
    crop_rows.sort(key=lambda r: r["net"], reverse=True)

    # ---- highlights ----
    best = max(cashflow, key=lambda m: m["net"]) if cashflow else None
    worst = min(cashflow, key=lambda m: m["net"]) if cashflow else None
    highlights = {
        "bestMonth": best,
        "worstMonth": worst,
        "biggestExpense": expense_lines[0] if expense_lines else None,
        "topParty": party_rows[0] if party_rows else None,
    }

    return {
        "months": months,
        "window": {"from": cur_keys[0], "to": cur_keys[-1]},
        "previousWindow": {"from": prev_keys[0], "to": prev_keys[-1]},
        "summary": {
            "income": cur_income,
            "expense": cur_expense,
            "net": cur_net,
            "marginPct": _pct(cur_net, cur_income),
            "expenseRatioPct": _pct(cur_expense, cur_income),
            "savingsRate": _pct(cur_net, cur_income),
            "prevIncome": prev_income,
            "prevExpense": prev_expense,
            "prevNet": prev_net,
            "incomeDeltaPct": _delta_pct(cur_income, prev_income),
            "expenseDeltaPct": _delta_pct(cur_expense, prev_expense),
            "netDeltaPct": _delta_pct(cur_net, prev_net),
            "prevSavingsRate": _pct(prev_net, prev_income),
        },
        "statement": {"income": income_lines, "expense": expense_lines},
        "cashflow": cashflow,
        "categoryDeepDive": deep_dive,
        "parties": party_rows[:10],
        "crops": crop_rows,
        "highlights": highlights,
    }
