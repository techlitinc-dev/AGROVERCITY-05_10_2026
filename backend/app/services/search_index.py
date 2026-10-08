"""Shared search/embedding index helper (WS-08 M23; reused by WS-05 FAQ retrieval).

Vectors are stored in the Firestore collection `search_index` with doc id
`{index}__{doc_id}`. Embeddings go through `gateway.embed()`
(`AI_GEMINI_EMBED_MODEL`, default `gemini-embedding-001`); the shim returns
deterministic vectors so the whole pipeline works with `AI_PROVIDER=shim`.
"""
import math
from datetime import datetime, timezone

from app.core.db import get_doc, query, set_doc
from app.services.ai import gateway

COLLECTION = "search_index"

# index -> source collection
SOURCES: dict[str, str] = {
    "schemes": "schemes",
    "products": "products",
    "news": "news",
    "crops": "crops",
    "courses": "courses",
    "lots": "market_lots",
}


async def embed_texts(texts: list[str]) -> list[list[float]]:
    return await gateway.embed(texts)


def cosine(a: list[float], b: list[float]) -> float:
    """Cosine similarity of two vectors (0.0 for an empty vector)."""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


async def upsert_document(index: str, doc_id: str, text: str, marker: str | None = None) -> None:
    vector = (await embed_texts([text]))[0]
    doc = {
        "index": index,
        "docId": doc_id,
        "text": text,
        "vector": vector,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    if marker is not None:
        doc["sourceMarker"] = marker
    await set_doc(COLLECTION, f"{index}__{doc_id}", doc)


async def search_similar(index: str, query_text: str, limit: int = 5) -> list[dict]:
    query_vector = (await embed_texts([query_text]))[0]
    docs = await query(COLLECTION, [("index", "==", index)], limit=1000)
    scored = [
        {
            "index": doc.get("index"),
            "docId": doc.get("docId"),
            "text": doc.get("text", ""),
            "score": cosine(query_vector, doc.get("vector") or []),
        }
        for doc in docs
    ]
    scored.sort(key=lambda hit: hit["score"], reverse=True)
    return scored[:limit]


def _source_text(index: str, doc: dict) -> str:
    if index == "lots":
        fields = [doc.get("crop"), doc.get("grade"), doc.get("variety")]
    elif index == "crops":
        fields = [doc.get("name"), doc.get("vernacularName")]
    elif index == "schemes":
        fields = [doc.get("name"), doc.get("description")]
    elif index == "products":
        fields = [doc.get("title"), doc.get("vernacularTitle"), doc.get("category")]
    elif index == "news":
        fields = [doc.get("title"), doc.get("summary")]
    elif index == "courses":
        fields = [doc.get("title"), doc.get("subtitle")]
    else:
        fields = [doc.get("title")]
    return " ".join(str(f) for f in fields if f)


async def reindex(indexes: list[str] | None = None) -> dict:
    """Re-embed changed documents. Idempotent + resumable: a doc whose source
    marker is unchanged is skipped, and a `search_index_meta/last_run`
    checkpoint is stamped after the pass."""
    targets = indexes or list(SOURCES)
    counts: dict[str, int] = {}
    for index in targets:
        collection = SOURCES.get(index)
        if not collection:
            continue
        docs = await query(collection, [], limit=1000)
        embedded = 0
        for doc in docs:
            doc_id = doc.get("id")
            if not doc_id:
                continue
            marker = str(doc.get("updatedAt") or doc.get("createdAt") or "")
            existing = await get_doc(COLLECTION, f"{index}__{doc_id}")
            if existing is not None and str(existing.get("sourceMarker")) == marker:
                continue
            await upsert_document(index, doc_id, _source_text(index, doc), marker=marker)
            embedded += 1
        counts[index] = embedded
    await set_doc(
        "search_index_meta",
        "last_run",
        {"cursor": None, "updatedAt": datetime.now(timezone.utc).isoformat()},
    )
    return counts
