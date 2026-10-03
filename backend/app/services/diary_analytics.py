"""Pure aggregation helpers for the Farm Diary analytics endpoint.

These functions only transform lists of entry dicts; every Firestore read
stays in the router. Money rules (matching the diary money contract):

- Only entries with type "income"/"expense" AND amount != 0 move money:
  they feed the income/expense sums and the per-type counts. "farmActivity"
  entries and zero-amount entries are counted in ``entryCount`` (farmActivity
  also in ``activityCount``) but never contribute to sums.
- ``byCategory`` and ``byCrop`` bucket every entry with amount != 0 — i.e.
  income/expense entries plus any farmActivity that carried a cost. A
  farmActivity amount adds to neither income nor expense but still bumps
  ``count``.
- ``byMonth`` and ``byDay`` are breakdowns of the money sums, so they only
  include income/expense entries with amount != 0; ``count`` there is the
  number of money entries in the bucket.
- Entries with a null/empty cropName are grouped under OTHER_CROP ("अन्य").
- All amounts are rounded to 2 decimals.
"""

OTHER_CROP = "अन्य"

_MONEY_TYPES = ("income", "expense")


def filter_by_range(
    entries: list[dict],
    from_date: str | None,
    to_date: str | None,
) -> list[dict]:
    """Keep entries whose YYYY-MM-DD ``date`` falls within [from_date, to_date].

    String comparison is correct for zero-padded ISO dates; a missing bound
    leaves that side open.
    """
    out = entries
    if from_date is not None:
        out = [e for e in out if e.get("date", "") >= from_date]
    if to_date is not None:
        out = [e for e in out if e.get("date", "") <= to_date]
    return out


def _is_money(entry: dict) -> bool:
    return entry.get("type") in _MONEY_TYPES and entry.get("amount", 0) != 0


def _round2(value: float) -> float:
    return round(value, 2)


def summarize(entries: list[dict]) -> dict:
    """Aggregate diary entries into totals and per-category/crop/month/day buckets.

    See the module docstring for the exact inclusion rules.
    """
    income = _round2(
        sum(e.get("amount", 0) for e in entries if _is_money(e) and e["type"] == "income")
    )
    expense = _round2(
        sum(e.get("amount", 0) for e in entries if _is_money(e) and e["type"] == "expense")
    )
    totals = {
        "income": income,
        "expense": expense,
        "net": _round2(income - expense),
        "entryCount": len(entries),
        "incomeCount": sum(1 for e in entries if _is_money(e) and e["type"] == "income"),
        "expenseCount": sum(1 for e in entries if _is_money(e) and e["type"] == "expense"),
        "activityCount": sum(1 for e in entries if e.get("type") == "farmActivity"),
    }

    by_category: dict[tuple[str, str], dict] = {}
    by_crop: dict[str, dict] = {}
    by_month: dict[str, dict] = {}
    by_day: dict[str, dict] = {}

    for entry in entries:
        amount = entry.get("amount", 0)
        entry_type = entry.get("type") or ""

        if amount != 0:
            crop = entry.get("cropName") or OTHER_CROP
            crop_bucket = by_crop.setdefault(
                crop, {"cropName": crop, "income": 0.0, "expense": 0.0, "net": 0.0, "count": 0}
            )
            crop_bucket["count"] += 1
            if entry_type == "income":
                crop_bucket["income"] += amount
            elif entry_type == "expense":
                crop_bucket["expense"] += amount

            category = entry.get("category") or OTHER_CROP
            cat_key = (category, entry_type)
            cat_bucket = by_category.setdefault(
                cat_key, {"category": category, "type": entry_type, "amount": 0.0, "count": 0}
            )
            cat_bucket["amount"] += amount
            cat_bucket["count"] += 1

        if _is_money(entry):
            month = entry.get("date", "")[:7]
            month_bucket = by_month.setdefault(
                month,
                {"month": month, "income": 0.0, "expense": 0.0, "net": 0.0, "count": 0},
            )
            day_bucket = by_day.setdefault(
                entry.get("date", ""),
                {"date": entry.get("date", ""), "income": 0.0, "expense": 0.0, "count": 0},
            )
            for bucket in (month_bucket, day_bucket):
                bucket["count"] += 1
                if entry_type == "income":
                    bucket["income"] += amount
                else:
                    bucket["expense"] += amount

    category_rows = list(by_category.values())
    category_rows.sort(key=lambda r: r["amount"], reverse=True)

    crop_rows = list(by_crop.values())
    for row in crop_rows:
        row["net"] = _round2(row["income"] - row["expense"])
    crop_rows.sort(key=lambda r: r["net"], reverse=True)

    month_rows = list(by_month.values())
    month_rows.sort(key=lambda r: r["month"])
    day_rows = list(by_day.values())
    day_rows.sort(key=lambda r: r["date"])

    for row in category_rows:
        row["amount"] = _round2(row["amount"])
    for row in crop_rows + month_rows + day_rows:
        row["income"] = _round2(row["income"])
        row["expense"] = _round2(row["expense"])
        if "net" in row:
            row["net"] = _round2(row["net"])

    return {
        "totals": totals,
        "byCategory": category_rows,
        "byCrop": crop_rows,
        "byMonth": month_rows,
        "byDay": day_rows,
    }
