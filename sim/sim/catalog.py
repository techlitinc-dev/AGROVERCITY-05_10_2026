"""Fetch /openapi.json → runs/catalog.json; keyword search over operations (specs §6)."""
import json
import re
from pathlib import Path

import httpx

from .config import RUNS_DIR, settings

CATALOG_PATH = RUNS_DIR / "catalog.json"

_NON_ADMIN_BLOCK = ("admin",)


def fetch() -> list[dict]:
    url = f"{settings()['backend_url']}/openapi.json"
    spec = httpx.get(url, timeout=30).json()
    ops = []
    for path, methods in spec.get("paths", {}).items():
        for method, op in methods.items():
            if method.lower() not in ("get", "post", "put", "patch", "delete"):
                continue
            ops.append({
                "op_id": op.get("operationId") or _slug(method, path),
                "method": method.upper(),
                "path": path,
                "summary": (op.get("summary") or "")[:120],
                "tag": (op.get("tags") or ["misc"])[0],
                "admin": any(t.lower().startswith(_NON_ADMIN_BLOCK) for t in (op.get("tags") or []))
                         or "/admin" in path,
            })
    RUNS_DIR.mkdir(exist_ok=True)
    CATALOG_PATH.write_text(json.dumps({"ops": ops}, indent=1))
    return ops


def _slug(method: str, path: str) -> str:
    parts = re.sub(r"[{}]", "", path).strip("/").replace("v1/", "").replace("/", "_")
    return f"{method.lower()}_{parts}" or method


def load() -> list[dict]:
    if not CATALOG_PATH.exists():
        raise SystemExit("no catalog — run: python -m sim.cli catalog")
    return json.loads(CATALOG_PATH.read_text())["ops"]


def tags(ops: list[dict] | None = None) -> list[str]:
    return sorted({o["tag"] for o in (ops or load())})


def search(ops: list[dict], query: str, k: int = 5, allow_admin: bool = False) -> list[dict]:
    q = set(re.findall(r"[a-z0-9]+", query.lower())) - {"the", "for", "how", "what", "find", "get", "my"}
    scored = []
    for op in ops:
        if op["admin"] and not allow_admin:
            continue
        hay = f"{op['tag']} {op['path']} {op['summary']}".lower()
        tokens = set(re.findall(r"[a-z0-9]+", hay))
        score = len(q & tokens)
        if score:
            scored.append((score, op))
    scored.sort(key=lambda t: (-t[0], t[1]["path"]))
    return [op for _, op in scored[:k]]


def tool_index(ops: list[dict], persona_id: str, whitelist: list[str] | None) -> str:
    """Always-on compact tool list for one persona. Two sources:
    whitelisted tags, else keyword fallback (ops mentioning the persona id).
    Admin endpoints are excluded unless the persona is an operator."""
    allow_admin = persona_id.startswith(("operations", "finance_admin", "compliance",
                                         "agronomist", "content_moderator", "superadmin"))
    picked = []
    for op in ops:
        if op["admin"] and not allow_admin:
            continue
        if whitelist:
            if op["tag"] in whitelist:
                picked.append(op)
        elif persona_id.lower().replace("_", "-") in f"{op['tag']} {op['path']}":
            picked.append(op)
    # defaults every persona needs
    for op in ops:
        if not whitelist and op["tag"] in ("auth", "users", "notifications") and op not in picked:
            picked.append(op)
    lines = [f"- {o['op_id']} {o['method']} {o['path']} — {o['summary']}" for o in picked]
    return "\n".join(lines[:80])          # hard cap — the prefix must stay small (specs §3)
