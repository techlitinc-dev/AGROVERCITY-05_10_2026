import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.db import set_doc

EQUIPMENT = [
    {
        "id": "eq-1",
        "name": "Mahindra 575 DI Tractor",
        "type": "tractor",
        "ownerType": "fpo",
        "hourlyRate": 650,
        "perAcreRate": None,
        "distanceKm": 2.5,
        "slotTemplate": None,
        "active": True,
        "docStatus": "verified",
        "rejectionReason": None,
    },
    {
        "id": "eq-2",
        "name": "Shaktiman Rotavator",
        "type": "rotavator",
        "ownerType": "private",
        "ownerId": "owner-demo",
        "hourlyRate": 500,
        "perAcreRate": None,
        "distanceKm": 4.0,
        "slotTemplate": None,
        "active": True,
        "docStatus": "verified",
        "rejectionReason": None,
    },
]


async def main():
    now = datetime.now(timezone.utc).isoformat()
    for doc in EQUIPMENT:
        await set_doc("equipment", doc["id"], {**doc, "createdAt": now})
    print(f"seeded {len(EQUIPMENT)} equipment")


if __name__ == "__main__":
    asyncio.run(main())
