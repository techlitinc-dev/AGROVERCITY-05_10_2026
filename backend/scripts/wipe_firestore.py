"""Wipe every document from Firestore — all top-level collections and every
subcollection, recursively. Destructive and irreversible (Firestore has no
trash). A full export exists at
backup/firestore-full-export-20261028-065552.jsonl.

The resolved project is hard-asserted to agrovercity-bafec so this script can
never run against any other project.

Usage (from backend/):  .venv/bin/python scripts/wipe_firestore.py
"""

import asyncio

from app.core.config import settings
from app.core.db import get_db

EXPECTED_PROJECT = "agrovercity-bafec"
BATCH = 400  # Firestore batch limit is 500 — stay under it.


async def _delete_docs(ref, docs):
    batch = ref._client.batch()
    for doc in docs:
        batch.delete(doc.reference)
    await batch.commit()
    return len(docs)


async def _wipe_collection(ref) -> int:
    """Delete every document in `ref` plus, for each document, all of its
    subcollections (at any depth). Returns the number of documents deleted."""
    deleted = 0
    buffered = []
    async for doc in ref.stream():
        async for sub in doc.reference.collections():
            deleted += await _wipe_collection(sub)
        buffered.append(doc)
        if len(buffered) >= BATCH:
            deleted += await _delete_docs(ref, buffered)
            buffered = []
    if buffered:
        deleted += await _delete_docs(ref, buffered)
    return deleted


async def main() -> None:
    # Double gate: the configured project AND the connected client must both
    # be the real project before a single document is touched.
    assert settings.firebase_project_id == EXPECTED_PROJECT, (
        f"settings project {settings.firebase_project_id!r} != {EXPECTED_PROJECT!r}"
    )
    client = get_db()
    assert client.project == EXPECTED_PROJECT, f"client project {client.project!r} != {EXPECTED_PROJECT!r}"

    total = 0
    async for collection in client.collections():
        n = await _wipe_collection(collection)
        total += n
        print(f"wiped {collection.id}: {n} doc(s) incl. subcollections", flush=True)
    print(f"TOTAL deleted: {total} doc(s)", flush=True)

    # The Redis cache holds sessions/rate-limits/tasks — flush it too.
    try:
        import redis.asyncio as aioredis

        redis_client = aioredis.from_url(settings.redis_url)
        await redis_client.flushdb()
        await redis_client.aclose()
        print("redis cache flushed", flush=True)
    except Exception as exc:  # noqa: BLE001 — cache flush must not fail the wipe
        print(f"redis flush skipped: {exc}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
