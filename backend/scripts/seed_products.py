import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.db import set_doc

PRODUCTS = [
    {
        "id": "prod-1",
        "title": "IFFCO Nano DAP (500 ml Bottle)",
        "vernacularTitle": "इफको नैनो डीएपी (500 मिली)",
        "category": "Fertilizer (खाद)",
        "brand": "IFFCO Official",
        "rating": 4.8,
        "reviewsCount": 324,
        "dealerName": "Kisan Suvidha Kendra - Pimpalgaon",
        "distanceKm": 2.1,
        "mrp": 600,
        "discountedPrice": 570,
        "bnplAvailable": True,
        "batchNo": "IFFCO-DAP-2026-993",
    },
    {
        "id": "prod-2",
        "title": "Bayer Nativo Fungicide (100 gm)",
        "vernacularTitle": "बायेर नेटिवो कवकनाशी (100 ग्राम)",
        "category": "Pesticide (फफूंदनाशक)",
        "brand": "Bayer CropScience",
        "rating": 4.9,
        "reviewsCount": 512,
        "dealerName": "Maharashtra Krishi Seva Kendra",
        "distanceKm": 3.8,
        "mrp": 850,
        "discountedPrice": 790,
        "bnplAvailable": True,
        "batchNo": "BAY-NAT-44821-QR",
    },
    {
        "id": "prod-3",
        "title": "Seminis Tomato Seeds - Abhinav (10g)",
        "vernacularTitle": "सेमिनिस अभिनव टमाटर बीज (10 ग्राम)",
        "category": "Seeds (प्रमाणित बीज)",
        "brand": "Seminis / Bayer",
        "rating": 4.7,
        "reviewsCount": 890,
        "dealerName": "Gramin Krishi Vikas Bhandar",
        "distanceKm": 5.0,
        "mrp": 980,
        "discountedPrice": 899,
        "bnplAvailable": True,
        "batchNo": "SEM-ABH-88301-GEN",
    },
    {
        "id": "prod-4",
        "title": "Jain Drip Lateral Pipe 16mm (400m Coil)",
        "vernacularTitle": "जैन ड्रिप लैटरल पाइप 16mm (400 मी)",
        "category": "Irrigation (सिंचाई)",
        "brand": "Jain Irrigation Systems",
        "rating": 4.9,
        "reviewsCount": 144,
        "dealerName": "Jain Micro-Irrigation Hub Nashik",
        "distanceKm": 8.5,
        "mrp": 3200,
        "discountedPrice": 2850,
        "bnplAvailable": True,
        "batchNo": "JAIN-DRIP-2026-CL",
    },
    {
        "id": "prod-5",
        "title": "IFFCO Urea (45 kg Bag)",
        "vernacularTitle": "इफको यूरिया (45 किग्रा बोरी)",
        "category": "Fertilizer (खाद)",
        "brand": "IFFCO Official",
        "rating": 4.6,
        "reviewsCount": 1024,
        "dealerName": "Kisan Suvidha Kendra - Pimpalgaon",
        "distanceKm": 2.1,
        "mrp": 320,
        "discountedPrice": 290,
        "bnplAvailable": False,
        "batchNo": "IFFCO-UREA-2026-111",
    },
]


async def main():
    now = datetime.now(timezone.utc).isoformat()
    for doc in PRODUCTS:
        await set_doc("products", doc["id"], doc)
    for i, doc in enumerate(PRODUCTS, start=1):
        cert = {
            "batchNo": doc["batchNo"],
            "certifier": "AGMARK / Ministry of Agriculture",
            "certificateNo": f"AGM-2026-{i:04d}",
            "valid": True,
            "verifiedAt": now,
        }
        await set_doc("certificates", doc["batchNo"], cert)
    print(f"seeded {len(PRODUCTS)} products, {len(PRODUCTS)} certificates")


if __name__ == "__main__":
    asyncio.run(main())
