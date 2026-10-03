"""Reader for the `platform_config/ai` Firestore doc (ai_implementation_plan §1.2).

Shape: {modules: {<flag>: bool}, thresholds: {"<id>.v1": 0.75},
        automation: {"<id>.v1": "suggest"}}

Edits are maker-checker + audited in the admin console (phase-07); this module
provides the cached reader and the dev seed only. 60 s cache TTL.
"""
import time

from app.core.db import get_doc, set_doc

DEFAULT_AI_CONFIG = {"modules": {}, "thresholds": {}, "automation": {}}
CACHE_TTL_SECONDS = 60.0

_cache: dict = {"doc": None, "at": 0.0}


def clear_cache() -> None:
    _cache["doc"] = None
    _cache["at"] = 0.0


async def get_ai_config(force: bool = False) -> dict:
    now = time.monotonic()
    if not force and _cache["doc"] is not None and now - _cache["at"] < CACHE_TTL_SECONDS:
        return _cache["doc"]
    doc = await get_doc("platform_config", "ai") or {}
    merged = {
        "modules": doc.get("modules") or {},
        "thresholds": doc.get("thresholds") or {},
        "automation": doc.get("automation") or {},
    }
    _cache["doc"] = merged
    _cache["at"] = now
    return merged


async def module_enabled(module: str) -> bool:
    config = await get_ai_config()
    return bool(config["modules"].get(module, True))


async def threshold_for(question_set_id: str, default: float = 0.75) -> float:
    config = await get_ai_config()
    value = config["thresholds"].get(question_set_id)
    return float(value) if value is not None else default


async def automation_for(question_set_id: str, default: str = "suggest") -> str:
    config = await get_ai_config()
    return config["automation"].get(question_set_id) or default


async def seed_ai_config() -> None:
    existing = await get_doc("platform_config", "ai")
    if existing is None:
        await set_doc("platform_config", "ai", dict(DEFAULT_AI_CONFIG))
