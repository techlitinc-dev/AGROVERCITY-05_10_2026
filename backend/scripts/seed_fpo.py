import asyncio
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.db import set_doc

FPO = {
    "id": "sahyadri-fpo",
    "name": "Sahyadri Shetkari FPO",
    "memberCount": 214,
    "district": "Nashik",
}

POOL = {
    "id": "pool-1",
    "fpoId": "sahyadri-fpo",
    "fpoName": "Sahyadri Shetkari FPO",
    "item": "Nano Urea (500 ml)",
    "bookedUnits": 380,
    "targetUnits": 500,
    "discountPercent": 18,
    "status": "open",
}


async def main():
    now = datetime.now(timezone.utc)
    await set_doc("fpos", FPO["id"], {**FPO, "createdAt": now.isoformat()})
    deadline = (now + timedelta(days=10)).date().isoformat()
    await set_doc("fpo_pools", POOL["id"], {**POOL, "deadline": deadline, "createdAt": now.isoformat()})
    print("seeded 1 fpo, 1 pool")


if __name__ == "__main__":
    asyncio.run(main())
