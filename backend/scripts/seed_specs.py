import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.data.specs_seed import TEMPLATES, seed_specs

if __name__ == "__main__":
    asyncio.run(seed_specs())
