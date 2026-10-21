# implement_simulation.md — Build Guide

Companion to `specs.md`. Follow the steps in order; each milestone ends with a
working run, per the implement → simulate → improve loop. Total new code
≈ 700 lines of Python + 4 YAML configs.

---

## 0. What you will get (the deliverable, up front)

One command (`python -m sim.cli run --suite full && python -m sim.cli analyze`)
produces `reports/report.md` with five sections. Direct answers:

**Yes — gaps (missing features).** Detected five independent ways:
1. `search_tools` returns 0 results for a goal-relevant query → "user looked, nothing there".
2. Debrief `missing_features` — agent reports what it wanted and couldn't do.
3. Expectation-vs-actual mismatch — agent reasonably assumed X, API did Y.
4. 404/405 on an agent-invented path — the endpoint *should* exist.
5. Watchdog STUCK on a checkpoint.

**Yes — userflow obstacles.** Friction index per journey (retries, backtracks,
p50/p95 step latency), watchdog stuck trails with exact step reproduction,
guided-mode checkpoint failures, satisfaction scores, verbatim persona
frustration quotes. Tells you *where* flows are painful, not just *that* they fail.

**Yes — dataflow obstacles.** Mechanisms:
1. **Write→read-back probes** — after a mutation, the agent re-reads through a
   *different* endpoint; analyzer flags when the created entity doesn't appear
   (Firestore collection wiring broken, event not propagated).
2. **Chain handoff failures** (Mode E) — farmer's lot invisible to seller;
   broker's deal missing from bank manager's queue. The seam between roles is
   exactly where dataflow breaks.
3. **Orphaned entity flags** — POST succeeded but no later step ever references
   the returned id (data written nowhere useful).
4. **403 surprises mid-flow** — role/permission rough edges in the data path.

Honest limits: this is the **API-level view**. It won't catch visual/layout
problems or pure-frontend dead buttons (dev-mode mocks can hide those) — that's
the M4 browser mode. And every finding is an **evidence-ranked candidate**;
eyeball the top 10 with a few humans before building.

---

## 1. Prerequisites

```bash
# 1. Backend running, dev mode, real Firestore TEST project
cd backend && cp .env.example .env          # ENV=dev; point FIREBASE_SERVICE_ACCOUNT_PATH at test creds
cd .. && ./run.sh backend &                 # serves :8000, /openapi.json, /v1/...

# 2. LLM key
export DEEPSEEK_API_KEY=sk-...              # https://platform.deepseek.com (OpenAI-compatible)
# optional alternates (any OpenAI-compatible endpoint works):
# export OPENAI_BASE_URL=...  OPENAI_API_KEY=...  SIM_MODEL=...

# 3. Harness env
cd sim
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

`requirements.txt`:

```
httpx>=0.27
openai>=1.40
pydantic>=2
pyyaml>=6
typer>=0.12
```

---

## 2. Build order

```
Step 1  catalog.py     # /openapi.json → catalog.json + search      (M0)
Step 2  budget.py     # token/$ caps                                 (M0)
Step 3  identity.py   # persona → JWT                               (M0)
Step 4  tools.py      # call_endpoint + truncation                  (M0)
Step 5  agent.py      # the perceive→decide→act loop                (M0)
Step 6  cli.py        # sim run --persona X --scenario Y            (M0 ✔)
Step 7  personas.yaml + scenarios.yaml + persona_tools.yaml         (M1)
Step 8  debrief.py    # structured experience report                (M1)
Step 9  analyzer.py   # coverage/failures/stuck/gaps/friction       (M1 ✔)
Step 10 admin + adversarial + chain modes                           (M2 ✔)
Step 11 replay + report diffing + CI                                (M3)
```

---

## Step 1 — `src/catalog.py`

Fetch and normalize the OpenAPI spec once per suite. This is the tool universe.

```python
"""Fetch /openapi.json → catalog.json; keyword search over operations."""
import json, re
from pathlib import Path
import httpx

CATALOG = Path(__file__).parent.parent / "runs" / "catalog.json"

def fetch(backend_url: str) -> list[dict]:
    spec = httpx.get(f"{backend_url}/openapi.json", timeout=30).json()
    ops = []
    for path, methods in spec.get("paths", {}).items():
        for method, op in methods.items():
            if method.lower() not in ("get", "post", "put", "patch", "delete"):
                continue
            ops.append({
                "op_id": op.get("operationId") or f"{method}_{path.strip('/').replace('/', '_').replace('{','').replace('}','')}",
                "method": method.upper(),
                "path": path,                       # e.g. /v1/market/lots/{lot_id}
                "summary": (op.get("summary") or "")[:120],
                "tag": (op.get("tags") or ["misc"])[0],
            })
    CATALOG.parent.mkdir(exist_ok=True)
    CATALOG.write_text(json.dumps({"ops": ops}, indent=1))
    return ops

def load() -> list[dict]:
    return json.loads(CATALOG.read_text())["ops"]

def search(ops: list[dict], query: str, k: int = 5) -> list[dict]:
    q = set(re.findall(r"[a-z0-9]+", query.lower()))
    scored = []
    for op in ops:
        hay = f"{op['tag']} {op['path']} {op['summary']}".lower()
        tokens = set(re.findall(r"[a-z0-9]+", hay))
        score = len(q & tokens)
        if score:
            scored.append((score, op))
    scored.sort(key=lambda t: -t[0])
    return [op for _, op in scored[:k]]

def tool_index(ops: list[dict], whitelist_tags: list[str]) -> str:
    """Compact always-on tool list for one persona (the cached prompt prefix)."""
    lines = []
    for op in ops:
        if op["tag"] in whitelist_tags:
            lines.append(f"- {op['op_id']} {op['method']} {op['path']} — {op['summary']}")
    return "\n".join(lines[:80])          # hard cap: index must stay small
```

Run once now: `python -m sim.cli catalog` (cli in Step 6), then inspect tags —
`python -c "import json;print(sorted({o['tag'] for o in json.load(open('runs/catalog.json'))['ops']}))"` —
you need the real tag names for `persona_tools.yaml` in Step 7.

---

## Step 2 — `src/budget.py`

```python
"""Token/$ accounting. Prices = deepseek-flash off-peak USD per 1M (settings.yaml)."""
from dataclasses import dataclass

@dataclass
class Budget:
    max_steps: int = 30
    max_llm_calls: int = 100_000
    max_usd: float = 5.0
    usd_in_miss: float = 0.15
    usd_in_hit: float = 0.003
    usd_out: float = 0.60
    llm_calls: int = 0
    in_tokens: int = 0
    out_tokens: int = 0

    def charge(self, usage, cached_input_tokens: int = 0):
        self.llm_calls += 1
        self.in_tokens += usage.prompt_tokens
        self.out_tokens += usage.completion_tokens
        self.cached = getattr(self, "cached", 0) + cached_input_tokens

    @property
    def usd(self) -> float:
        fresh = self.in_tokens - getattr(self, "cached", 0)
        return (fresh * self.usd_in_miss + getattr(self, "cached", 0) * self.usd_in_hit
                + self.out_tokens * self.usd_out) / 1e6

    def exhausted(self) -> bool:
        return self.usd >= self.max_usd or self.llm_calls >= self.max_llm_calls
```

Keep the system prefix byte-identical across calls so DeepSeek's context cache
counts (that's the $0.003/M tier).

---

## Step 3 — `src/identity.py`

Persona → JWT, with the fallback chain from specs §7. **Cache suite-wide** —
login is rate-limited (10/10 min per IP+phone, Redis-backed,
`app/core/ratelimit.py`).

```python
"""Resolve persona id → {uid, token}. Falls back gracefully; 'blocked' is a finding."""
import json, time
from pathlib import Path
import httpx

CACHE = Path(__file__).parent.parent / "runs" / ".tokens.json"
MPIN = "1234"                       # dev seeds (PERSONA_DEFAULTS, superadmin operators)

def _cache() -> dict:
    return json.loads(CACHE.read_text()) if CACHE.exists() else {}

def _save(c: dict):
    CACHE.parent.mkdir(exist_ok=True)
    CACHE.write_text(json.dumps(c, indent=1))

def resolve(client: httpx.Client, base: str, persona: str, admin: bool = False) -> dict:
    c = _cache()
    hit = c.get(persona)
    if hit and hit.get("exp", 0) > time.time() + 3600:
        return hit
    headers = {}
    if admin:
        headers["X-Admin-Role"] = persona          # operator role name
    r = client.post(f"{base}/v1/auth/quick-login",
                    json={"persona": persona, "mpin": MPIN}, headers=headers)
    if r.status_code == 200:
        data = r.json()
        tok = {"uid": data.get("user", {}).get("id"), "token": data["accessToken"],
               "exp": time.time() + 22 * 3600}
        c[persona] = tok; _save(c)
        return tok
    # Fallback: dev OTP (response includes devOtp when no SMS provider is set)
    phone = "+91" + "9" * 5 + f"{abs(hash(persona)) % 10**5:05d}"
    s = client.post(f"{base}/v1/auth/otp/send", json={"phone": phone}).json()
    v = client.post(f"{base}/v1/auth/otp/verify",
                    json={"phone": phone, "otp": s.get("devOtp"), "otpSessionId": s.get("otpSessionId")})
    if v.status_code == 200:
        tok = {"uid": v.json().get("user", {}).get("id"), "token": v.json()["accessToken"],
               "exp": time.time() + 22 * 3600}
        c[persona] = tok; _save(c)
        return tok
    return {"blocked": True, "reason": f"quick-login {r.status_code}, otp {v.status_code}"}
```

For personas with no `quick-login` seed and no phone: login as `omni-user-777`
(11 linked profiles) then `POST /v1/users/me/profiles/{type}/activate`, or run
`backend/scripts/seed_superadmin_users.py` for the 6 operators. Every persona
that ends `blocked` lands in the report — that's finding #0 (no test identity).

---

## Step 4 — `src/tools.py`

The truncation middleware is the biggest cost lever — Firestore payloads are
huge. Never show the agent raw JSON.

```python
"""Agent tools: call_endpoint + search_tools. All API traffic goes through here."""
import json, re, time
import httpx

NOISY_KEYS = {"audit", "history", "logs", "trace", "stack", "_firestore", "createdAt"}

def compact(obj, list_cap: int = 5, str_cap: int = 160, budget: int = 1400) -> str:
    def walk(o, depth=0):
        if isinstance(o, dict):
            return {k: walk(v, depth+1) for k, v in o.items()
                    if v not in (None, "", [], {}) and k.lower() not in NOISY_KEYS}
        if isinstance(o, list):
            extra = len(o) - list_cap
            out = [walk(v, depth+1) for v in o[:list_cap]]
            return out + ([f"... (+{extra} more)"] if extra > 0 else [])
        if isinstance(o, str) and len(o) > str_cap:
            return o[:str_cap] + "…"
        return o
    s = json.dumps(walk(obj), ensure_ascii=False, default=str)
    return s if len(s) <= budget else s[:budget] + " …[truncated]"

class Tools:
    def __init__(self, client: httpx.Client, base: str, token: str, catalog: list[dict],
                 runlog, audit_reason: str | None = None):
        self.client, self.base, self.catalog, self.log = client, base, catalog, runlog
        self.headers = {"Authorization": f"Bearer {token}"}
        if audit_reason:                       # admin mutations require it (400 otherwise)
            self.headers["X-Audit-Reason"] = audit_reason

    def call(self, op_id: str, params: dict) -> dict:
        op = next((o for o in self.catalog if o["op_id"] == op_id), None)
        if not op:
            return {"error": f"unknown endpoint {op_id}"}
        path = op["path"]
        for k, v in (params.get("path") or {}).items():
            path = path.replace("{" + k + "}", str(v))
        t0 = time.time()
        r = self.client.request(op["method"], f"{self.base}{path}",
                                params=params.get("query"), json=params.get("body") or None,
                                headers=self.headers, timeout=20)
        latency = int((time.time() - t0) * 1000)
        try:
            body = r.json()
        except Exception:
            body = {"raw": r.text[:200]}
        excerpt = compact(body)
        rec = {"op_id": op_id, "method": op["method"], "path": path,
               "status": r.status_code, "latency_ms": latency, "resp_excerpt": excerpt}
        self.log.append(rec)
        return {"status": r.status_code, "latency_ms": latency, "body": excerpt}
```

`search_tools` just calls `catalog.search()` and returns the compact list —
and **logs the query**: zero-result queries are prime missing-feature evidence.

---

## Step 5 — `src/agent.py`

```python
"""The perceive→decide→act loop. Only JSON ever comes out of the model."""
import json, re
from openai import AsyncOpenAI

ACTION_SCHEMA = """{"action":"call_endpoint|search_tools|wait|give_up|done",
"reason":"one line, persona voice","endpoint_id":"...","params":{"path":{},"query":{},"body":{}},
"expectation":"what I think happens","satisfaction":1}  // satisfaction required for done/give_up
For done add "summary". For give_up add "blocker"."""

RULES = """You are a real user of the Agrovercity app (see persona). You are NOT the system.
- Achieve your goal using only endpoints in the index, or search_tools to find more.
- Never invent endpoint paths. If search returns nothing, that itself is noteworthy — say so.
- After a successful POST/PUT, re-read the result with a GET to confirm it persisted.
- If blocked twice in a row, change approach; if truly stuck, give_up with the blocker.
- Think in your own language; respond ONLY with the JSON action."""

class Agent:
    def __init__(self, llm: AsyncOpenAI, model: str, tools: Tools, budget, mock=None):
        self.llm, self.model, self.tools, self.budget, self.mock = llm, model, tools, budget, mock

    async def decide(self, system: str, user_msg: str) -> dict:
        if self.mock:                        # --mock-llm: harness self-test, zero spend
            return self.mock
        r = await self.llm.chat.completions.create(
            model=self.model,
            messages=[{"role": "system", "content": system},
                      {"role": "user", "content": user_msg}],
            temperature=0.4, max_tokens=240,
            response_format={"type": "json_object"})
        self.budget.charge(r.usage, getattr(r.usage, "prompt_cache_hit_tokens", 0) or 0)
        return _extract_json(r.choices[0].message.content)

    async def run(self, persona_card: str, goal: str, system_prefix: str,
                  max_steps: int, step_cb) -> dict:
        system = system_prefix + "\n" + persona_card + "\n\n" + RULES + "\nACTION FORMAT:\n" + ACTION_SCHEMA
        history: list[str] = []
        memory: list[str] = []
        last_calls: list[tuple] = []
        for step in range(1, max_steps + 1):
            if self.budget.exhausted():
                return {"outcome": "budget_exhausted", "steps": step}
            ctx = f"GOAL: {goal}\nMEMORY: {memory[-6:]}\nRECENT: {history[-6:]}\nWhat do you do next?"
            act = await self.decide(system, ctx)
            step_cb(step, act)
            a = act.get("action")
            if a == "done":
                return {"outcome": "done", "steps": step, "act": act}
            if a == "give_up":
                return {"outcome": "gave_up", "steps": step, "act": act}
            if a == "search_tools":
                from . import catalog as cat
                res = cat.search(self.tools.catalog, act.get("reason", ""))
                obs = json.dumps([f"{o['op_id']} {o['method']} {o['path']}" for o in res] or [])
                if not res:
                    self.tools.log.append({"op_id": "search", "query": act.get("reason"),
                                           "status": 0, "latency_ms": 0, "resp_excerpt": "[]"})
            else:
                call = self.tools.call(act.get("endpoint_id", ""), act.get("params") or {})
                obs = json.dumps(call)
                last_calls.append((act.get("endpoint_id"), call.get("status")))
                last_calls = last_calls[-3:]
                if len(last_calls) == 3 and len(set(last_calls)) == 1:
                    return {"outcome": "stuck_repeat", "steps": step, "act": act}
            history.append(f"s{step} {a} {act.get('endpoint_id') or act.get('reason','')}"
                           f" → {obs[:220]}")
            if a == "call_endpoint" and act.get("expectation"):
                self.tools.log[-1]["expectation"] = act["expectation"][:200]
            mem = act.get("params", {}).get("body") or act.get("params", {}).get("query") or {}
            if isinstance(mem, dict):
                memory += [f"{k}={str(v)[:40]}" for k, v in mem.items()
                           if k.lower().endswith("id") or k.lower() in ("status", "name")]
        return {"outcome": "step_cap", "steps": max_steps}

def _extract_json(text: str) -> dict:
    m = re.search(r"\{.*\}", text, re.S)
    try:
        return json.loads(m.group(0)) if m else {"action": "wait", "reason": "unparseable"}
    except json.JSONDecodeError:
        return {"action": "wait", "reason": "unparseable"}
```

---

## Step 6 — `src/cli.py` (M0 wiring)

```python
"""sim catalog | seed | run | analyze | report"""
import asyncio, json, os, time
from pathlib import Path
import httpx, typer, yaml
from openai import AsyncOpenAI

from . import catalog as cat
from .agent import Agent
from .budget import Budget
from .identity import resolve
from .tools import Tools

app = typer.Typer()
ROOT = Path(__file__).parent.parent
CFG = yaml.safe_load((ROOT / "config" / "settings.yaml").read_text())
BASE = CFG["backend_url"]
LLM = AsyncOpenAI(api_key=os.environ[CFG["api_key_env"]],
                  base_url=os.environ.get("OPENAI_BASE_URL", "https://api.deepseek.com"))

def settings() -> dict:
    return CFG

@app.command()
def catalog_cmd():
    ops = cat.fetch(BASE)
    typer.echo(f"catalog: {len(ops)} operations → runs/catalog.json")

@app.command()
def run(suite: str = "smoke", persona: str | None = None, scenario: str | None = None,
        mock_llm: bool = False, budget_usd: float | None = None):
    scenarios = yaml.safe_load((ROOT / "config" / "scenarios.yaml").read_text())["scenarios"]
    picked = [s for s in scenarios if s.get("suite", "smoke") == suite or suite == "all"]
    if persona: picked = [s for s in picked if s["persona"] == persona]
    if scenario: picked = [s for s in picked if s["id"] == scenario]
    if not picked:
        typer.echo("no scenarios matched"); raise SystemExit(1)
    budget = Budget(max_usd=budget_usd or CFG["budget_usd"])
    asyncio.run(_run_suite(picked, budget, mock_llm))

async def _run_suite(scenarios, budget: Budget, mock_llm: bool):
    ops = cat.load()
    personas = {p["id"]: p for p in yaml.safe_load((ROOT / "config" / "personas.yaml").read_text())["personas"]}
    tools_map = yaml.safe_load((ROOT / "config" / "persona_tools.yaml").read_text())
    async with httpx.AsyncClient() as hc, httpx.Client(base_url=BASE) as sync_c:
        for sc in scenarios:
            rid = f"{sc['id']}-{int(time.time())}"
            runlog: list[dict] = []
            p = personas[sc["persona"]]
            ident = resolve(sync_c, BASE, sc["persona"], admin=sc.get("mode") == "admin")
            if ident.get("blocked"):
                _write_run(rid, sc, [], {"outcome": "blocked_identity", "reason": ident["reason"]}, budget)
                continue
            t = Tools(sync_c, BASE, ident["token"], ops, runlog,
                      audit_reason=f"sim-{rid}" if sc.get("mode") == "admin" else None)
            prefix = cat.tool_index(ops, tools_map.get(sc["persona"], []))
            agent = Agent(LLM, os.environ.get("SIM_MODEL", CFG["model"]), t, budget,
                          mock={"action": "done", "summary": "mock"} if mock_llm else None)
            outcome = await agent.run(_persona_card(p), sc["goal"], prefix,
                                      sc.get("max_steps", 30), lambda s, a: None)
            _write_run(rid, sc, runlog, outcome, budget)
            typer.echo(f"{rid}: {outcome['outcome']} ({outcome.get('steps')} steps, ${budget.usd:.3f} cumulative)")

def _persona_card(p: dict) -> str:
    return (f"PERSONA: {p['name']}, {p['district']}. Language: {p['language']}. "
            f"Tech literacy: {p['tech_literacy']}. Patience: {p['patience']}.")

def _write_run(rid, sc, runlog, outcome, budget):
    d = ROOT / "runs"; d.mkdir(exist_ok=True)
    (d / f"{rid}.jsonl").write_text("\n".join(json.dumps(x, ensure_ascii=False) for x in runlog))
    (d / f"{rid}.meta.json").write_text(json.dumps(
        {"scenario": sc, "outcome": outcome, "budget": {"usd": budget.usd, "calls": budget.llm_calls}},
        indent=1))

if __name__ == "__main__":
    app()
```

Run it: `python -m src.cli run --suite smoke` (add `__init__.py` files, run from `sim/`).

**M0 acceptance:** `python -m src.cli run --persona farmer --scenario farmer-sell-wheat`
completes; `runs/*.jsonl` shows real HTTP calls to `:8000` (mandi read, lot POST);
`--mock-llm` works offline; cumulative spend visible per run.

---

## Step 7 — the three YAML configs

`config/settings.yaml`:

```yaml
backend_url: "http://localhost:8000"
model: "deepseek-flash"
api_key_env: "DEEPSEEK_API_KEY"
budget_usd: 5.0
```

`config/personas.yaml` — 20 cards (specs §7 table), ≤120 tokens each:

```yaml
personas:
  - id: farmer
    name: Ramesh Patel
    district: Anand, Gujarat
    language: hinglish
    tech_literacy: low
    patience: low
    goals: [sell 20q wheat at good rate, check mandi first, buy urea if cheap]
    must_touch: [mandi, market, demands]
  # ... 19 more (seller, transporter, broker, customer, bankManager, ...)
```

`config/persona_tools.yaml` — map persona → catalog tags (use the tag list you
printed in Step 1). Start small, widen after the first run:

```yaml
farmer: [auth, users, mandi, market, demands, offers, farmer, purchases, diary,
         pnl, advisory, weather, schemes, finance, loans, insurance, kyc, uploads,
         addresses, notifications, chat]
customer: [auth, users, marketplace, orders, payments, customer, mall, wishlist, coupons, addresses, notifications]
```

`config/scenarios.yaml` — one guided + one open per persona minimum, plus chains:

```yaml
scenarios:
  - {id: farmer-sell-wheat, persona: farmer, suite: smoke, mode: guided, max_steps: 30,
     goal: "Sell 20 quintal wheat. Check today's mandi price first, then create a lot and handle any offer."}
  - {id: farmer-open-week, persona: farmer, suite: full, mode: open, max_steps: 25,
     goal: "It's harvest week. Do everything on the app you would realistically do in one evening."}
  - {id: market-chain-wheat, persona: farmer, suite: full, mode: chain, max_steps: 12,
     goal: "List 20q wheat for sale at a fair price.",
     chain: [
       {persona: seller, goal: "Find that wheat lot and negotiate a deal."},
       {persona: transporter, goal: "Get this load hauled to the buyer."},
       {persona: bankManager, goal: "Make sure the seller gets paid correctly."}]}
  - {id: ops-settle-dispute, persona: operations_lead, suite: full, mode: admin, max_steps: 20,
     goal: "Review one open dispute end-to-end and resolve it. Use the audit log."}
```

Chains (M2) run agents sequentially, injecting a shared `world` dict (lot id,
deal id from previous run's log) into each next agent's goal — that's what makes
handoff breaks visible.

---

## Step 8 — `src/debrief.py`

One extra LLM call per finished run (see schema in specs §9):

```python
SYSTEM = """You are the persona below, debriefing your session. From the run log,
report ONLY what actually happened. strict JSON:
{"completed":bool,"blockers":[{"what","step","evidence"}],
"missing_features":[...],"confusing":[...],"unnecessary":[...],
"satisfaction":1-5,"verbatim_frustration":"..."}"""

async def debrief(llm, model, persona_card, goal, runlog) -> dict:
    trace = "\n".join(f"{i+1}. {r.get('method','?')} {r.get('path','?')} → {r.get('status','?')}"
                      + (f" | expected: {r['expectation']}" if r.get("expectation") else "")
                      for i, r in enumerate(runlog[-40:]))
    r = await llm.chat.completions.create(model=model, temperature=0.2, max_tokens=500,
        response_format={"type": "json_object"},
        messages=[{"role": "system", "content": SYSTEM + "\n" + persona_card},
                  {"role": "user", "content": f"GOAL: {goal}\nTRACE:\n{trace}"}])
    return _extract_json(r.choices[0].message.content)   # reuse from agent.py
```

---

## Step 9 — `src/analyzer.py` (M1 done)

Pure stdlib + the run logs. Five report sections per specs §13:

```python
"""runs/*.jsonl + *.debrief.json → reports/report.md + report.json"""
import json, re, statistics
from collections import Counter, defaultdict
from pathlib import Path

def analyze(runs_dir="runs", out_dir="reports"):
    runs = sorted(Path(runs_dir).glob("*.jsonl"))
    cat = json.loads((Path(runs_dir) / "catalog.json").read_text())["ops"]
    hits, errors, expectations, lat, retries, suspicions = Counter(), Counter(), [], defaultdict(list), Counter(), []
    searches, stuck, debriefs, sat = [], [], [], []
    for r in runs:
        recs = [json.loads(l) for l in r.read_text().splitlines() if l.strip()]
        meta_p = Path(str(r).replace(".jsonl", ".meta.json"))
        meta = json.loads(meta_p.read_text()) if meta_p.exists() else {}
        prev = None
        for i, rec in enumerate(recs):
            if rec.get("op_id") == "search":
                if rec["resp_excerpt"] == "[]": searches.append(rec["query"])
                continue
            hits[(meta.get("scenario", {}).get("persona"), rec["op_id"])] += 1
            lat[rec["op_id"]].append(rec["latency_ms"])
            if rec["status"] >= 400: errors[rec["op_id"]] += 1
            if rec.get("expectation") and rec["status"] >= 400:
                expectations.append({"op": rec["op_id"], "expected": rec["expectation"],
                                     "got": rec["status"], "run": r.name})
            if prev and rec["op_id"] == prev.get("op_id"): retries[rec["op_id"]] += 1
            # write→read-back probe: mutation followed within 3 steps by a GET on same tag
            _consistency_probe(recs, i, suspicions, r.name)
            prev = rec
        if meta.get("outcome", {}).get("outcome") in ("stuck_repeat", "step_cap"):
            stuck.append({"run": r.name, "at_step": meta["outcome"].get("steps")})
        dp = Path(str(r).replace(".jsonl", ".debrief.json"))
        if dp.exists():
            d = json.loads(dp.read_text()); debriefs.append((r.name, d))
            if d.get("satisfaction"): sat.append(d["satisfaction"])
    # ... render sections below
```

Render, in order:

1. **Coverage map** — per persona: `must_touch` tags with zero hits (⚠️), and the
   suite-wide zero-hit list restricted to tags whitelisted for some persona →
   "unnecessary?" candidates. Cross-reference ≥3 suite runs before trusting.
2. **Failure taxonomy** — `errors` histogram, top expectation mismatches verbatim.
3. **Stuck report** — stuck runs with step trails.
4. **Missing-feature board** — merge: zero-result `searches` + debrief
   `missing_features` + `blockers`; dedupe by normalized text;
   rank = frequency × number of distinct personas mentioning it.
5. **Friction index** — per scenario: retry counts, p50/p95 latency per endpoint,
   mean satisfaction.
6. **Dataflow suspicions** — from `_consistency_probe`.

```python
def _consistency_probe(recs, i, out, run_name):
    rec = recs[i]
    if rec["method"] not in ("POST", "PUT", "PATCH") or rec["status"] >= 300: return
    m = re.search(r'"([a-zA-Z_]*id)"\s*:\s*"([^"]+)"', rec.get("resp_excerpt", ""))
    if not m: return
    key, val = m.group(1), m.group(2)
    for nxt in recs[i+1:i+4]:
        if nxt["method"] == "GET" and (val in nxt.get("path", "") or val in nxt.get("resp_excerpt", "")):
            if nxt["status"] in (404, 422) or nxt.get("resp_excerpt", "") in ("{}", "[]"):
                out.append({"run": run_name, "created": f"{key}={val} via {rec['op_id']}",
                            "read_via": nxt["op_id"], "status": nxt["status"]})
            return
```

Report it as "suspicions", not verdicts — the heuristic is deliberately simple.

**M1 acceptance:** `python -m src.cli run --suite smoke` (5 personas) then
`analyze` produces a `report.md` whose Missing-feature board has ≥1 entry with
a run-log citation, and the Coverage map shows at least one ⚠️ `must_touch` gap.

---

## Step 10 — M2: the remaining modes

- **Adversarial**: personas with `tech_literacy: low` + goals phrased with
  missing data ("sell wheat" — no quantity), plus a `chaos: true` flag the loop
  uses to randomly skip steps 3/4/5 (drops, rage-abandon). Implement as an
  optional `chaos` field read in `agent.run`.
- **Admin**: `mode: admin` scenarios use operator identities from
  `seed_superadmin_users.py`; `Tools` already injects `X-Audit-Reason: sim-<rid>`.
  Verify every mutation lands in `audit_logs` (add an analyzer check — query the
  backend once for `audit_logs` with reason prefix `sim-`, confirm 1:1 with
  admin mutations in the logs).
- **Chains**: run chain steps sequentially; after each agent, extract new entity
  ids from its runlog (same regex as the probe) into `world`; render the next
  goal as `f"{step.goal}\nCONTEXT: {world}"`. A chain fails at the seam → the
  analyzer reports which link and what was invisible.

**M2 acceptance:** full suite (20 personas + 6 admin + ≥3 chains) completes in
<45 min for <$2; report contains at least one seam failure *or* a clean chain —
either is information.

## Step 11 — M3: replay + CI

- `--replay`: analyzer reads old `runs/`; zero LLM calls (already true — the
  analyzer never calls the LLM).
- Report diffing: keep `reports/report-<date>.md`; `analyze --diff <a> <b>`
  lists closed gaps (entries in a not in b) and new regressions (in b not in a).
- CI/nightly: cron `./run.sh backend && cd sim && python -m src.cli run --suite full
  && python -m src.cli analyze`; commit `reports/` diff to a branch for review.

---

## 3. First-month cost expectation

| Milestone | LLM spend | Runs |
|---|---|---|
| M0 skeleton | <$0.10 | dozens of test runs |
| M1 smoke (5 personas ×2) | ~$0.10–0.30 | weekly |
| M2 full (20 personas + chains) | ~$0.30–0.60 | weekly |
| M3 regression, nightly | ~$10/month | daily |

Rules that keep it there: cached system prefix, `max_tokens=240`, truncation,
token reuse across steps, `Budget.exhausted()` checked before every call.

---

## 4. Codebase-specific gotchas

- **Never** point the harness at prod: `identity.py` hardcodes `localhost`;
  keep it that way. `.tokens.json` in `runs/` is gitignored — check.
- Backend must boot with `ENV=dev` (`_require_real_secrets_outside_dev` refuses
  otherwise) so `quick-login`/`devOtp` exist.
- Admin mutations **400 without** `X-Audit-Reason` — `Tools` sets it; if you see
  400s on admin runs, check the header first.
- All endpoints are under `/v1`; `openapi.json` is at the root.
- Login rate limit 10/10 min per IP+phone — the token cache is not optional.
- Tag names come from router `tags=` — print them from `catalog.json` before
  writing `persona_tools.yaml`; don't guess.
- If `response_format=json_object` errors on the model, drop it and rely on
  `_extract_json`; log unparseable rates in the report.
- Personas think in Hinglish but act in JSON — that's fine and desirable; don't
  force English thinking, only English action keys.
- DeepSeek peak hours (01:00–04:00, 06:00–10:00 UTC weekdays) double prices —
  set `budget_usd` accordingly or schedule runs off-peak.
