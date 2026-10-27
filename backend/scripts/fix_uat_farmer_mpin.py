"""One-off dev repair: restore the UAT farmer account's MPIN + profile.

The module05 e2e suite (and manual_test/01_farmer.md) expects the seeded
farmer `+919822000001` (Ramesh Patil) to log in with MPIN 4321. The dev
Firestore doc for that phone currently has no `mpinHash` at all, so
POST /auth/login fails with 409 MPIN_NOT_SET before any test can start.
The doc's profile fields are also blank strings (name/state/district/village
were wiped when the doc was re-created), while the suite asserts the
canonical Ramesh Patil profile (e2e/test-data.ts, mirrored from
manual_test/01_farmer.md).

This script sets `mpinHash` on every user doc with that phone and fills in
the canonical profile fields that are currently blank. It touches no other
field. Idempotent.

    cd backend && .venv/bin/python scripts/fix_uat_farmer_mpin.py
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.db import query, set_doc
from app.core.security import hash_mpin

PHONE = "+919822000001"
MPIN = "4321"

# Canonical UAT farmer profile — e2e/test-data.ts FARMER (manual_test/01_farmer.md).
PROFILE_DEFAULTS = {
    "name": "Ramesh Patil",
    "vernacularName": "रमेश पाटील",
    "state": "Maharashtra",
    "district": "Nashik",
    "village": "Pimpalgaon Baswant",
    "landAreaAcres": 3,
    "primaryProfile": "farmer",
    "activeProfile": "farmer",
}


async def main() -> None:
    docs = await query("users", [("phone", "==", PHONE)], limit=50)
    if not docs:
        print(f"no user docs found for {PHONE} — nothing to repair")
        return
    for doc in docs:
        doc["mpinHash"] = hash_mpin(MPIN)
        patched = []
        for key, value in PROFILE_DEFAULTS.items():
            if not doc.get(key):
                doc[key] = value
                patched.append(key)
        await set_doc("users", doc["id"], doc)
        print(f"set mpinHash on {doc['id']}; filled blank fields: {patched or 'none'}")
    print(f"done: {len(docs)} doc(s) for {PHONE} can now log in with MPIN {MPIN}")


if __name__ == "__main__":
    asyncio.run(main())
