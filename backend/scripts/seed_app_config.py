import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.db import set_doc

SEED = {
    "minSupportedVersion": "1.0.0",
    "forceUpdate": False,
    "featureFlags": {"liveChannels": True, "bnpl": False},
    "maintenanceMode": False,
}


async def main():
    await set_doc("app_config", "current", SEED)
    print("seeded app_config/current")


if __name__ == "__main__":
    asyncio.run(main())
