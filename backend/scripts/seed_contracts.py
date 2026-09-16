import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.db import set_doc

TERMS = {
    "contract-1": (
        "यह अनुबंध बुवाई से पहले दर लॉक करता है। The locked rate applies to the full minimum "
        "quantity delivered at the stated hub. Payment is released via bank DBT within 24 hours "
        "of weighing and quality acceptance."
    ),
    "contract-2": (
        "यह साप्ताहिक आपूर्ति अनुबंध है। Grade A quality is mandatory at the collection center; "
        "rejected lots are returned at the farmer's cost. Settlement is digital, daily, via UPI/NEFT."
    ),
    "contract-3": (
        "यह पूर्ण सीज़न अनुबंध है। 30% advance is paid at sowing against this verified contract; "
        "the balance 70% is paid at gate delivery after export-size grading (55mm+)."
    ),
}

CONTRACTS = [
    {
        "id": "contract-1",
        "buyerCompany": "ITC Agri Business (e-Choupal)",
        "buyerRating": 4.9,
        "crop": "Wheat - Sharbati (शरबती गेहूं)",
        "lockedRateQuintal": 2650,
        "mspCurrentRate": 2425,
        "premiumAboveMSP": "+₹225/Quintal",
        "minQuantityQuintals": 30,
        "deliveryLocation": "ITC Choupal Sagar, Niphad Hub",
        "paymentTerms": "100% Instant Bank DBT within 24 hours of weighing",
        "status": "open",
        "contractDuration": "Pre-Harvest Lock (Delivery: Oct 2026)",
    },
    {
        "id": "contract-2",
        "buyerCompany": "Reliance Fresh / JioKrishi Retail",
        "buyerRating": 4.8,
        "crop": "Tomato - Grade A (टमाटर)",
        "lockedRateQuintal": 2300,
        "mspCurrentRate": 1800,
        "premiumAboveMSP": "+₹500/Quintal",
        "minQuantityQuintals": 50,
        "deliveryLocation": "Reliance Fresh Collection Center, Pimpalgaon",
        "paymentTerms": "Daily digital settlement via UPI/NEFT",
        "status": "open",
        "contractDuration": "Weekly Harvest Supply",
    },
    {
        "id": "contract-3",
        "buyerCompany": "Mother Dairy / Safal Processing",
        "buyerRating": 4.7,
        "crop": "Red Onion - Export Size 55mm+",
        "lockedRateQuintal": 2450,
        "mspCurrentRate": 2100,
        "premiumAboveMSP": "+₹350/Quintal",
        "minQuantityQuintals": 80,
        "deliveryLocation": "Safal Cold Chain Terminal, Nashik",
        "paymentTerms": "30% Advance at Sowing, 70% at Gate Delivery",
        "status": "open",
        "contractDuration": "Full Season Agreement",
    },
]


async def main():
    now = datetime.now(timezone.utc).isoformat()
    for doc in CONTRACTS:
        await set_doc("contracts", doc["id"], {**doc, "termsText": TERMS[doc["id"]], "createdAt": now})
    print(f"seeded {len(CONTRACTS)} contracts")


if __name__ == "__main__":
    asyncio.run(main())
