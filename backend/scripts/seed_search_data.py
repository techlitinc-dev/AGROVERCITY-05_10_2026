"""Dev fixture for the WS-09 global-search curl (task 9.8).

Seeds one reference crop, one open market lot and one news item that all match
the query "pyaz", so `GET /v1/search?q=pyaz` returns hits across the crops, lots
and news groups on a dev instance. Dev-only and idempotent.

    cd backend && APP_ENV=dev .venv/bin/python scripts/seed_search_data.py
"""

import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import settings
from app.core.db import get_doc, set_doc

CROPS = [
    {
        "id": "onion",
        "name": "Onion",
        "vernacularName": "प्याज (Pyaz)",
        "category": "vegetable",
        "aliases": ["pyaz", "kanda"],
    },
    {
        "id": "tomato",
        "name": "Tomato",
        "vernacularName": "टमाटर (Tamatar)",
        "category": "vegetable",
        "aliases": ["tamatar"],
    },
]

LOTS = [
    {
        "id": "search-lot-pyaz",
        "crop": "Onion (Pyaz)",
        "grade": "A",
        "quantityQuintals": 25,
        "expectedRate": 2100,
        "harvestDate": "2026-10-15",
        "status": "open",
        "farmerId": "dev-user-1",
        "location": {"village": "Pimpalgaon", "district": "Nashik", "state": "Maharashtra"},
        "createdAt": "2026-10-06T00:00:00+00:00",
    }
]

NEWS = [
    {
        "id": "search-news-pyaz",
        "title": "Onion export floor price raised — pyaz buffer procurement",
        "vernacularTitle": "प्याज निर्यात भाव वाढ",
        "summary": "NAFED to procure 5 lakh tonnes of pyaz at ₹2,200/quintal.",
        "content": "The centre has directed buffer procurement of pyaz to support farmgate prices.",
        "category": "market-policy",
        "source": "Agri Ministry Press Bureau",
        "timestamp": "2026-10-06T08:30:00Z",
        "isBreaking": False,
        "impactRating": "High Bullish",
    }
]


async def main():
    if settings.env != "dev":
        print("refusing to seed: APP_ENV is not dev")
        return
    seeded = 0
    for crop in CROPS:
        if await get_doc("crops", crop["id"]) is None:
            await set_doc("crops", crop["id"], crop)
            seeded += 1
    for lot in LOTS:
        if await get_doc("market_lots", lot["id"]) is None:
            await set_doc("market_lots", lot["id"], lot)
            seeded += 1
    for item in NEWS:
        if await get_doc("news", item["id"]) is None:
            await set_doc("news", item["id"], item)
            seeded += 1
    print(f"seeded {seeded} search fixture rows at {datetime.now(timezone.utc).isoformat()}")


if __name__ == "__main__":
    asyncio.run(main())
