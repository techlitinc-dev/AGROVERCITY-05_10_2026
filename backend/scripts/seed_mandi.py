import asyncio
import random
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.db import set_doc

MANDI_PRICES = [
    {
        "id": "mandi-1",
        "mandiName": "Pimpalgaon Baswant APMC",
        "distanceKm": 4.2,
        "commodity": "Tomato (टमाटर)",
        "variety": "Hybrid Red",
        "minPrice": 1600,
        "maxPrice": 2250,
        "modalPrice": 1950,
        "msp": 1400,
        "trend": "up",
        "changePercent": "+8.4%",
        "arrivalsQuintals": 2400,
        "updatedAt": "10 mins ago",
    },
    {
        "id": "mandi-2",
        "mandiName": "Nashik (Dindori Road) APMC",
        "distanceKm": 18.5,
        "commodity": "Tomato (टमाटर)",
        "variety": "Abhinav Grade A",
        "minPrice": 1750,
        "maxPrice": 2400,
        "modalPrice": 2150,
        "msp": 1400,
        "trend": "up",
        "changePercent": "+12.1%",
        "arrivalsQuintals": 4800,
        "updatedAt": "25 mins ago",
    },
    {
        "id": "mandi-3",
        "mandiName": "Lasalgaon APMC",
        "distanceKm": 28.0,
        "commodity": "Onion (प्याज)",
        "variety": "Garwa Red",
        "minPrice": 1800,
        "maxPrice": 2380,
        "modalPrice": 2120,
        "msp": 1750,
        "trend": "down",
        "changePercent": "-3.2%",
        "arrivalsQuintals": 18500,
        "updatedAt": "15 mins ago",
    },
    {
        "id": "mandi-4",
        "mandiName": "Vashi (Navi Mumbai) Terminal",
        "distanceKm": 165.0,
        "commodity": "Tomato (टमाटर)",
        "variety": "Premium Crate",
        "minPrice": 2200,
        "maxPrice": 2900,
        "modalPrice": 2650,
        "msp": 1400,
        "trend": "up",
        "changePercent": "+15.0%",
        "arrivalsQuintals": 12000,
        "updatedAt": "1 hour ago",
    },
]

MANDIS = [
    {"id": "mandi-1", "name": "Pimpalgaon Baswant APMC", "district": "Nashik", "state": "Maharashtra", "lat": 20.17, "lng": 73.98},
    {"id": "mandi-2", "name": "Nashik (Dindori Road) APMC", "district": "Nashik", "state": "Maharashtra", "lat": 20.0, "lng": 73.79},
    {"id": "mandi-3", "name": "Lasalgaon APMC", "district": "Nashik", "state": "Maharashtra", "lat": 20.15, "lng": 74.23},
    {"id": "mandi-4", "name": "Vashi (Navi Mumbai) Terminal", "district": "Navi Mumbai", "state": "Maharashtra", "lat": 19.07, "lng": 72.99},
]

VYAPARI_RATES = [
    {"id": "vyapari-1", "crop": "Tomato (टमाटर)", "rateDisplay": "₹24/kg", "priceChange": "₹2", "changeDir": "up", "mandiName": "Nashik Mandi", "vyapariCount": 3, "lastUpdated": "10 mins ago"},
    {"id": "vyapari-2", "crop": "Onion (प्याज)", "rateDisplay": "₹18/kg", "priceChange": "₹1", "changeDir": "down", "mandiName": "Pimpalgaon Mandi", "vyapariCount": 5, "lastUpdated": "15 mins ago"},
    {"id": "vyapari-3", "crop": "Wheat (गेहूं)", "rateDisplay": "₹2,100/qtl", "priceChange": "0", "changeDir": "flat", "mandiName": "Lasalgaon Mandi", "vyapariCount": 4, "lastUpdated": "1 hour ago"},
]


async def main():
    for doc in MANDI_PRICES:
        await set_doc("mandi_prices", doc["id"], doc)
    for doc in MANDIS:
        await set_doc("mandis", doc["id"], doc)
    print("seeded 4 mandi_prices, 4 mandis")
    for doc in VYAPARI_RATES:
        await set_doc("vyapari_rates", doc["id"], doc)
    print("seeded 3 vyapari_rates")
    # Real Agmarknet historical backfill is an integration TODO — deterministic synthetic walk for now.
    rng = random.Random(42)
    today = date.today()
    count = 0
    for mandi in MANDI_PRICES:
        prices = [int(mandi["modalPrice"])] * 90
        for i in range(88, -1, -1):
            prices[i] = max(1, round(prices[i + 1] * (1 + rng.uniform(-0.05, 0.05))))
        for i in range(90):
            day = (today - timedelta(days=89 - i)).isoformat()
            doc = {
                "mandiId": mandi["id"],
                "mandiName": mandi["mandiName"],
                "commodity": mandi["commodity"],
                "date": day,
                "modalPrice": prices[i],
            }
            await set_doc("mandi_price_history", f"{mandi['id']}-{day}", doc)
            count += 1
    print(f"seeded {count} price-history rows")


if __name__ == "__main__":
    asyncio.run(main())
