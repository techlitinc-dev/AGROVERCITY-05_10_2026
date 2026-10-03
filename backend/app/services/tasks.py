"""Task engine (phase-01 WS-01) — the action layer every module emits into.

`tasks` doc shape (robust.md §4.1):
    { taskId, userId, persona, module, kind, title: {en, hi}, subtitle,
      priority: urgent|today|upcoming, deepLink, actionEndpoint?, dueAt,
      status: open|done|dismissed, sourceId, createdAt }
Additions (documented):
    - updatedAt    — last mutation time for the checklist UI
    - dedupeKey    — `userId:module:kind:sourceId`; idempotent emission
    - decisionId   — reserved for the WS-03 ranking outcome hook
    - coinsAwarded — WS-02 celebration amount
"""
from datetime import datetime, timezone
from uuid import uuid4

from app.core.db import get_doc, query, set_doc

COLLECTION = "tasks"

# Canonical module → website route table (X3: push → dashboard → action in one
# tap). Static values are route prefixes exactly as registered in App.tsx;
# parameterized routes append the source doc id at emission time. Tool deep
# links resolve through the generic `/dashboard/p/:toolId` route — only toolIds
# with real pages are listed (placeholder-only modules carry dated deferral
# notes in missing-features/robust.md §7 until their web UI lands).
DEEP_LINKS: dict[str, str] = {
    "trade": "/dashboard/p/myOffers",
    "transport": "/dashboard/p/transport/trips",
    "purchases": "/dashboard/p/purchases",
    "broker": "/dashboard/p/broker/deals",
    "contracts": "/dashboard/p/contracts",
    "dairy": "/dairy/console",
    "chats": "/dashboard/p/chats",
    "equipment": "/dashboard/p/machineManage",
    "land": "/dashboard/p/landlordLeases",
    "courses": "/dashboard/p/courses",
    "farmer_deals": "/dashboard/p/farmer/deals",
    "my_contracts": "/dashboard/p/myContracts",
}

# Modules whose route accepts a trailing source-doc id (parameterized routes).
PARAMETERIZED_MODULES = {"transport", "broker", "contracts", "purchases", "dairy"}


def module_deep_link(module: str, source_id: str | None = None) -> str:
    """Deep link for a module, optionally parameterized by the source doc id."""
    base = DEEP_LINKS.get(module, "")
    if not base:
        return ""
    if source_id and module in PARAMETERIZED_MODULES:
        return f"{base}/{source_id}"
    return base


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def emit_task(
    user_id: str,
    persona: str,
    module: str,
    kind: str,
    title_en: str,
    title_hi: str,
    subtitle: str,
    priority: str,
    deep_link: str,
    source_id: str,
    due_at: str | None = None,
    action_endpoint: str | None = None,
) -> str:
    """Create or refresh a task for a state transition (dedupe-safe).

    Upserts on `dedupeKey` so re-firing a transition never double-creates. A
    `done`/`dismissed` task is never resurrected — callers re-open the
    underlying condition by emitting again only when it genuinely re-opened.
    Returns the task doc id.
    """
    dedupe_key = f"{user_id}:{module}:{kind}:{source_id}"
    existing = await query(COLLECTION, [("dedupeKey", "==", dedupe_key)], limit=1)
    now = _now()

    if existing:
        doc = existing[0]
        doc["title"] = {"en": title_en, "hi": title_hi}
        doc["subtitle"] = subtitle
        doc["priority"] = priority
        doc["deepLink"] = deep_link
        doc["dueAt"] = due_at
        if action_endpoint is not None:
            doc["actionEndpoint"] = action_endpoint
        doc["updatedAt"] = now
        await set_doc(COLLECTION, doc["taskId"], doc)
        return doc["taskId"]

    task_id = f"task_{uuid4().hex[:12]}"
    doc = {
        "taskId": task_id,
        "userId": user_id,
        "persona": persona,
        "module": module,
        "kind": kind,
        "title": {"en": title_en, "hi": title_hi},
        "subtitle": subtitle,
        "priority": priority,
        "deepLink": deep_link,
        "dueAt": due_at,
        "status": "open",
        "sourceId": source_id,
        "dedupeKey": dedupe_key,
        "decisionId": None,
        "coinsAwarded": 0,
        "createdAt": now,
        "updatedAt": now,
    }
    if action_endpoint is not None:
        doc["actionEndpoint"] = action_endpoint
    await set_doc(COLLECTION, task_id, doc)
    return task_id
