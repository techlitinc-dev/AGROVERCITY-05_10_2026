import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.db import get_doc, set_doc

# Minimum Support Price reference (phase-05 WS-01 task 1.25). Covers the MSP-
# notified crops that also appear in the reference crop data
# (app/data/district_crops.py). Values are ₹/quintal × 100 (integer paisa). The
# farmer contract decision card shows this line beside the contract price; a
# crop without an MSP-notified price is intentionally omitted (honest absence).
MSP_PAISA = {
    "Wheat": (227500, "rabi"),
    "Rice": (230000, "kharif"),
    "Maize": (209000, "kharif"),
    "Bajra": (250000, "kharif"),
    "Jowar": (318000, "kharif"),
    "Gram": (544000, "rabi"),
    "Soybean": (460000, "kharif"),
    "Mustard": (565000, "rabi"),
    "Cotton": (702000, "kharif"),
    "Sugarcane": (315000, "kharif"),
}


async def main():
    now = datetime.now(timezone.utc).isoformat()
    seeded = 0
    for crop, (msp_paisa, season) in MSP_PAISA.items():
        doc_id = crop.lower().replace(" ", "-")
        if await get_doc("msp_reference", doc_id) is not None:
            continue
        await set_doc(
            "msp_reference",
            doc_id,
            {
                "crop": crop,
                "msp_paisa": msp_paisa,
                "season": season,
                "updated_at": now,
            },
        )
        seeded += 1
    print(f"seeded {seeded} msp reference rows, skipped {len(MSP_PAISA) - seeded} existing")


if __name__ == "__main__":
    asyncio.run(main())
