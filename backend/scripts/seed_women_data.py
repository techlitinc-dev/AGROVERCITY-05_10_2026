import asyncio
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.db import get_doc, set_doc
from app.data.women_seed import (
    GARDEN_PLAN_TEMPLATES,
    HOME_ENTERPRISES,
    SHG_GROUPS,
    SHG_MEETINGS,
)

# Idempotent dev seed for the Women Farmer Hub (phase-05 WS-08 task 8.15).
# Writes the collections `app/routers/women.py` reads — the payloads that used
# to be hardcoded in the router (global rule 1):
#   shg_groups, shg_meetings, garden_plans, home_enterprises.
# Gated behind APP_ENV=dev so it can never touch production.
COLLECTIONS = (
    ("garden_plans", GARDEN_PLAN_TEMPLATES),
    ("shg_groups", SHG_GROUPS),
    ("shg_meetings", SHG_MEETINGS),
    ("home_enterprises", HOME_ENTERPRISES),
)


async def main() -> int:
    if os.getenv("APP_ENV", "dev") != "dev":
        print("skipped: seed_women_data is dev-only (APP_ENV != dev)")
        return 0
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
    print(f"seeded {seeded} women rows, skipped {skipped} existing")
    return seeded


if __name__ == "__main__":
    asyncio.run(main())
