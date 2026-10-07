import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.db import get_doc, set_doc
from app.data.climate_seed import CARBON_FACTORS, CLIMATE_VARIETIES

# Idempotent dev seed for the climate module (phase-05 WS-07 task 7.8). Writes
# the resilient-variety catalog (`climate_varieties`) and the carbon factors +
# practices (`carbon_factors`) that `app/routers/climate.py` reads — the data
# that used to be hardcoded in the router (global rule 1).
COLLECTIONS = (
    ("climate_varieties", CLIMATE_VARIETIES),
    ("carbon_factors", CARBON_FACTORS),
)


async def main():
    now = datetime.now(timezone.utc).isoformat()
    seeded = 0
    skipped = 0
    for collection, items in COLLECTIONS:
        for item in items:
            if await get_doc(collection, item["id"]) is not None:
                skipped += 1
                continue
            await set_doc(collection, item["id"], {**item, "updated_at": now})
            seeded += 1
    print(f"seeded {seeded} climate rows, skipped {skipped} existing")


if __name__ == "__main__":
    asyncio.run(main())
