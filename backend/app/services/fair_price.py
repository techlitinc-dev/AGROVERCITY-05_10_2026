"""Fair-price band (WS-03 C5/E8): per-unit price band for a crop + district
computed from the last 90 days of delivered customer orders.

Integer paisa throughout; `sampleSize: 0` with null bounds when there is no
history — the band is never invented.
"""
from datetime import datetime, timedelta, timezone

from app.core.db import query

BAND_WINDOW_DAYS = 90


async def fair_price_band(crop: str, district: str) -> dict:
    """{crop, district, minUnitPaisa, maxUnitPaisa, sampleSize} over delivered
    orders in the window; null bounds when sampleSize is 0."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=BAND_WINDOW_DAYS)).isoformat()
    orders = await query(
        "customer_orders",
        [("status", "==", "delivered"), ("crop", "==", crop)],
        limit=2000,
    )
    unit_prices: list[int] = []
    for order in orders:
        if (order.get("district") or "").lower() != (district or "").lower():
            continue
        if (order.get("deliveredAt") or "") < cutoff:
            continue
        unit_paisa = order.get("unitPricePaisa")
        if unit_paisa is None:
            qty = float(order.get("quantityQuintals") or 0)
            value = int(order.get("orderValuePaisa") or 0)
            if qty <= 0 or value <= 0:
                continue
            unit_paisa = int(value / qty)
        unit_prices.append(int(unit_paisa))

    if not unit_prices:
        return {
            "crop": crop,
            "district": district,
            "minUnitPaisa": None,
            "maxUnitPaisa": None,
            "sampleSize": 0,
        }
    return {
        "crop": crop,
        "district": district,
        "minUnitPaisa": min(unit_prices),
        "maxUnitPaisa": max(unit_prices),
        "sampleSize": len(unit_prices),
    }
