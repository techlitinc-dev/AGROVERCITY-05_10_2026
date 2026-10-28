"""Vehicle rate card — the data behind "Standard Vehicle Fleets & Rates".

Seeds the `vehicle_catalog` collection (base fare, per-km rate, payload
capacity per vehicle type) consumed by:

  * GET /v1/transport/vehicles (the farmer fleet-and-rates board)
  * POST /v1/transport/fare-estimate, instant bookings, nearby-vehicle fares
  * mandi smart-select transport estimates
  * admin master-data `vehicle-types`

Idempotent — existing docs are updated in place, so re-running after a rate
change is the supported way to edit the card.

    cd backend && APP_ENV=dev .venv/bin/python scripts/seed_vehicle_catalog.py
"""

import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import settings
from app.core.db import set_doc

# type / baseFare (₹) / perKmRate (₹/km) / capacityTonnes / extended.
# `extended: false` rows are the "core" card shown by default on the fleet
# board; extended rows appear with ?extended=true.
VEHICLE_CATALOG = [
    {"type": "Tata Ace", "baseFare": 500, "perKmRate": 35, "capacityTonnes": 0.75, "extended": False, "sortOrder": 1},
    {"type": "Bolero Maxi", "baseFare": 800, "perKmRate": 45, "capacityTonnes": 1.5, "extended": False, "sortOrder": 2},
    {"type": "Tractor Trolley", "baseFare": 1000, "perKmRate": 30, "capacityTonnes": 3.0, "extended": False, "sortOrder": 3},
    {"type": "Eicher 6-Wheeler", "baseFare": 1800, "perKmRate": 55, "capacityTonnes": 6.0, "extended": True, "sortOrder": 4},
    {"type": "Reefer Cold Van", "baseFare": 2200, "perKmRate": 65, "capacityTonnes": 3.5, "extended": True, "sortOrder": 5},
    {"type": "10-Wheeler Truck", "baseFare": 3500, "perKmRate": 75, "capacityTonnes": 16.0, "extended": True, "sortOrder": 6},
]


def doc_id(vehicle_type: str) -> str:
    return "vcat_" + vehicle_type.lower().replace(" ", "_").replace("-", "_")


async def main() -> None:
    now = datetime.now(timezone.utc).isoformat()
    for entry in VEHICLE_CATALOG:
        doc = {
            "id": doc_id(entry["type"]),
            **entry,
            "active": True,
            "updatedAt": now,
        }
        await set_doc("vehicle_catalog", doc["id"], doc)
        print(f"  seeded {doc['id']} — {entry['type']} ₹{entry['baseFare']} + ₹{entry['perKmRate']}/km")
    print(f"vehicle_catalog seeded ({len(VEHICLE_CATALOG)} types) into {settings.firebase_project_id}")


if __name__ == "__main__":
    asyncio.run(main())
