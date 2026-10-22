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
    schemas = spec.get("components", {}).get("schemas", {})
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
                "params": _params(op, schemas),
            })
    RUNS_DIR.mkdir(exist_ok=True)
    CATALOG_PATH.write_text(json.dumps({"ops": ops}, indent=1))
    return ops


def _schema_kind(schema: dict, schemas: dict) -> str:
    """Compact type label for a parameter/property schema."""
    if not isinstance(schema, dict):
        return "str"
    if "$ref" in schema:
        schema = schemas.get(schema["$ref"].rsplit("/", 1)[-1], {})
    if "enum" in schema and schema["enum"]:
        return "|".join(str(e) for e in schema["enum"][:6])
    t = schema.get("type") or ("obj" if schema.get("properties") else "str")
    return {"integer": "int", "number": "float", "boolean": "bool", "array": "list",
            "object": "obj", "string": "str"}.get(t, str(t))


def _params(op: dict, schemas: dict) -> dict:
    """Extract query/path params and top-level body field names — the discovery fix."""
    out = {"query": [], "path": [], "body": []}
    for p in op.get("parameters", []) or []:
        entry = {"name": p.get("name", "?"), "required": bool(p.get("required")),
                 "kind": _schema_kind(p.get("schema", {}), schemas)}
        if p.get("description"):
            entry["hint"] = str(p["description"])[:80]
        loc = p.get("in", "query")
        if loc in out:
            out[loc].append(entry)
    body = (op.get("requestBody", {}) or {}).get("content", {}) or {}
    media = body.get("application/json") or next(iter(body.values()), {}) or {}
    bschema = media.get("schema", {}) or {}
    if bschema.get("$ref"):
        bschema = schemas.get(bschema["$ref"].rsplit("/", 1)[-1], {}) or {}
    props = bschema.get("properties", {}) or {}
    out["body"] = [{"name": k, "required": k in (bschema.get("required") or []),
                    "kind": _schema_kind(v, schemas)} for k, v in props.items()]
    return out


def _fmt_params(p: dict) -> str:
    bits = []
    for loc, mark in (("query", "q"), ("path", "p")):
        if p.get(loc):
            bits.append(f"{mark}{{{', '.join(x['name'] + ('!' if x['required'] else '?') for x in p[loc])}}}")
    if p.get("body"):
        bits.append(f"body{{{', '.join(x['name'] + ('!' if x['required'] else '?') for x in p['body'])}}}")
    return " ".join(bits)


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
        pnames = " ".join(x["name"] for sec in ("query", "path", "body")
                          for x in (op.get("params") or {}).get(sec, []))
        hay = f"{op['tag']} {op['path']} {op['summary']} {pnames}".lower()
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
    lines = []
    for o in picked:
        hint = _fmt_params(o.get("params") or {})
        lines.append(f"- {o['op_id']} {o['method']} {o['path']} — {o['summary']}"
                     + (f" · {hint}" if hint else ""))
    return "\n".join(lines[:80])          # hard cap — the prefix must stay small (specs §3)
