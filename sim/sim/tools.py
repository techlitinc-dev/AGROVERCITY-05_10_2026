"""Agent tools: call_endpoint + search_tools + poll. All API traffic passes here
so every call lands in the run log (evidence) and gets truncated (cost lever)."""
import json
import re
import time

import httpx

from . import catalog as cat

NOISY_KEYS = {"audit", "history", "logs", "trace", "stack", "createdat", "updatedat"}


def compact(obj, list_cap: int = 5, str_cap: int = 160, budget: int = 1400) -> str:
    def walk(o):
        if isinstance(o, dict):
            return {k: walk(v) for k, v in o.items()
                    if v not in (None, "", [], {}) and str(k).lower() not in NOISY_KEYS}
        if isinstance(o, list):
            extra = len(o) - list_cap
            out = [walk(v) for v in o[:list_cap]]
            return out + ([f"... (+{extra} more)"] if extra > 0 else [])
        if isinstance(o, str) and len(o) > str_cap:
            return o[:str_cap] + "…"
        return o
    s = json.dumps(walk(obj), ensure_ascii=False, default=str)
    return s if len(s) <= budget else s[:budget] + " …[truncated]"


class Tools:
    def __init__(self, client: httpx.Client, base: str, token: str,
                 catalog_ops: list[dict], runlog: list[dict],
                 audit_reason: str | None = None, run_id: str = ""):
        self.client, self.base, self.catalog, self.log = client, base, catalog_ops, runlog
        self.headers = {"Authorization": f"Bearer {token}"}
        if audit_reason:
            self.headers["X-Audit-Reason"] = audit_reason   # admin mutations 400 without it
        self.run_id = run_id

    # ── tool: call_endpoint ──────────────────────────────────────────────
    def call(self, op_id: str, params: dict | None) -> dict:
        params = params or {}
        op = next((o for o in self.catalog if o["op_id"] == op_id), None)
        if not op:
            return {"error": f"unknown endpoint '{op_id}' — use search_tools"}
        path = op["path"]
        for k, v in (params.get("path") or {}).items():
            path = path.replace("{" + k + "}", str(v))
        t0 = time.time()
        try:
            r = self.client.request(op["method"], f"{self.base}{path}",
                                    params=params.get("query"), json=params.get("body") or None,
                                    headers=self.headers, timeout=20)
            latency = int((time.time() - t0) * 1000)
            try:
                body = r.json()
            except Exception:
                body = {"raw": r.text[:200]}
            rec = {"op_id": op_id, "method": op["method"], "path": path,
                   "tag": op["tag"], "status": r.status_code, "latency_ms": latency,
                   "resp_excerpt": compact(body)}
        except Exception as e:
            rec = {"op_id": op_id, "method": op["method"], "path": path, "tag": op["tag"],
                   "status": 0, "latency_ms": int((time.time() - t0) * 1000),
                   "resp_excerpt": json.dumps({"transport_error": type(e).__name__})}
        self.log.append(rec)
        return {"status": rec["status"], "latency_ms": rec["latency_ms"],
                "body": rec["resp_excerpt"]}

    # ── tool: search_tools ───────────────────────────────────────────────
    def search(self, query: str, allow_admin: bool = False) -> dict:
        res = cat.search(self.catalog, query, allow_admin=allow_admin)
        self.log.append({"op_id": "search", "query": query, "method": "SEARCH",
                         "path": "", "tag": "meta", "status": 200 if res else 0,
                         "latency_ms": 0,
                         "resp_excerpt": compact([f"{o['op_id']} {o['method']} {o['path']}" for o in res] or [])})
        return {"matches": [f"{o['op_id']} {o['method']} {o['path']} — {o['summary']}" for o in res]}

    # ── tool: poll — async_wait read-back (specs §18b) ───────────────────
    def poll(self, op_id: str, params: dict | None, needle: str, tries: int, interval_s: int) -> dict:
        """Re-call a GET until `needle` appears or tries exhaust. Logged as ONE step."""
        last = None
        for attempt in range(1, tries + 1):
            last = self.call(op_id, params)
            if needle and needle in str(last.get("body", "")):
                last["async_wait"] = {"attempt": attempt, "tries": tries, "satisfied": True}
                return last
            if attempt < tries:
                time.sleep(interval_s)
        if last:
            last["async_wait"] = {"attempt": tries, "tries": tries, "satisfied": False,
                                  "note": "async settlement suspected (check jobs cron)"}
        return last or {"error": "poll failed"}


_ID_RE = re.compile(r'"([a-zA-Z_]*id)"\s*:\s*"([^"]+)"')


def extract_ids(text: str) -> dict[str, str]:
    """Pull id-like fields from a response excerpt — used for world context + probes."""
    return {m.group(1): m.group(2) for m in _ID_RE.finditer(text or "")}
