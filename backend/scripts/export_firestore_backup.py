"""One-off: recursive Firestore export to timestamped JSONL before the wipe."""
import asyncio
import json
from datetime import datetime, timezone

from app.core.config import settings
from app.core.db import get_db


async def dump(ref, out):
    async for doc in ref.stream():
        rec = {"collection": ref.id, "path": doc.reference.path, "data": doc.to_dict()}
        out.write(json.dumps(rec, default=str) + "\n")
        async for sub in doc.reference.collections():
            await dump(sub, out)


async def main():
    assert settings.firebase_project_id == "agrovercity-bafec"
    ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    path = f"../backup/firestore-full-export-{ts}.jsonl"
    n = 0
    with open(path, "w") as out:
        client = get_db()
        cols = [c async for c in client.collections()]
        for collection in cols:
            await dump(collection, out)
            print(f"exported {collection.id}", flush=True)
    with open(path) as f:
        n = sum(1 for _ in f)
    print(f"backup written: {path} ({n} docs)", flush=True)


asyncio.run(main())
