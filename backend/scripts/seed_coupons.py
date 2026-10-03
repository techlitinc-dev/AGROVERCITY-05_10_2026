import asyncio
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.db import get_doc, set_doc

COUPONS = [
    {
        "code": "WELCOME10",
        "type": "percentage",
        "value": 10,
        "minOrder": 500,
        "maxDiscount": 200,
        "usageLimit": 1000,
        "description": "10% off on your first order above ₹500",
    },
    {
        "code": "KISAN20",
        "type": "percentage",
        "value": 20,
        "minOrder": 1000,
        "maxDiscount": 300,
        "usageLimit": 500,
        "description": "20% off on orders above ₹1000 (max ₹300)",
    },
    {
        "code": "FLAT50",
        "type": "flat",
        "value": 50,
        "minOrder": 299,
        "maxDiscount": None,
        "usageLimit": 2000,
        "description": "Flat ₹50 off on orders above ₹299",
    },
    {
        "code": "DIWALI15",
        "type": "percentage",
        "value": 15,
        "minOrder": 1500,
        "maxDiscount": 500,
        "usageLimit": 250,
        "description": "Festive 15% off on orders above ₹1500 (max ₹500)",
    },
]


async def main():
    now = datetime.now(timezone.utc)
    seeded = 0
    for coupon in COUPONS:
        if await get_doc("coupons", coupon["code"]) is not None:
            continue
        await set_doc(
            "coupons",
            coupon["code"],
            {
                **coupon,
                "validUntil": (now + timedelta(days=90)).isoformat(),
                "usedCount": 0,
                "active": True,
            },
        )
        seeded += 1
    print(f"seeded {seeded} coupons, skipped {len(COUPONS) - seeded} existing")


if __name__ == "__main__":
    asyncio.run(main())
