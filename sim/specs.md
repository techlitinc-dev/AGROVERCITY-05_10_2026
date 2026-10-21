# Agrovercity Persona Simulation — Specs

Version 0.1 · 2026-10-21
Status: approved for implementation (M0 first)

---

## 1. Purpose

Drive the **real running system** (FastAPI backend on `:8000`, same endpoints the
React apps call) with LLM-controlled agents, each playing one of the 20 canonical
Agrovercity personas, in order to answer three questions without manual testing:

1. **What is missing?** — things a persona tries to do but cannot (no endpoint,
   404/403, dead end, confusing flow).
2. **What is unnecessary?** — endpoints/features that no persona across many runs
   ever touches.
3. **Where is it not smooth?** — retries, stuck loops, slow steps, error storms,
   frustrating sequences.

The agent's job is to *behave like a user*, not to test assertions. Findings come
from behavior + a structured debrief after every run.

Non-goals: load testing (use `backend/tests/load/` Locust files), unit-test
replacement (276 pytest files stay), UI pixel testing (Phase 2 option, §14 M4).

---

## 2. Decision: custom harness, NOT OASIS

OASIS (CAMEL-AI) is a social-dynamics research platform for simulating massive
agent populations on Twitter/Reddit-like graphs. It does not fit:

- Its environment model is a social graph, not a 1,495-endpoint product API.
- You would write a custom environment adapter anyway — the hardest 20% of the work.
- Heavy dependencies (torch, large infra) for zero relevant signal.
- Its output is emergent macro behavior; your output is a feature-gap report.

We instead steal OASIS's good idea — a tight **perceive → remember → decide → act**
loop per agent — and implement ~600 lines of Python against our own OpenAPI.

---

## 3. Model & cost

Provider-agnostic via the OpenAI-compatible client (`base_url` + `api_key` from
env). Default model: **deepseek-flash** (DeepSeek-V4.1-Flash).

| Model | Input (cache miss) | Input (cache hit) | Output | Notes |
|---|---|---|---|---|
| **deepseek-flash** (default) | $0.15/M | **$0.003/M** | $0.60/M | off-peak; peak (01:00–04:00, 06:00–10:00 UTC weekdays) doubles |
| gemini-2.5-flash-lite (alt) | $0.10/M | — | $0.40/M | flat rate, 1M context |
| ollama qwen3:4b (M4 option) | $0 | $0 | $0 | local, quality drop |

Worked estimate (full suite: 20 personas × 4 scenarios × ~20 steps ≈ 1,600 steps):

- Per step: ~400 fresh input tokens + ~120 output (~400-token cached persona prefix).
  ≈ $0.00013/step off-peak.
- Suite: ~1,600 steps + ~120 debriefs (~1,500 tokens each) ≈ **$0.30–0.60 per full
  20-persona run**. Peak worst case: still under ~$1.50.
- Budget guards (§10) hard-cap spend and abort gracefully.

Cost levers, in priority order:
1. **Stable prompt prefix** (persona card + tool index first) → cache hits.
2. **Truncate every API response** before giving it to the agent: strip nulls,
   cap arrays at 5 items, cap body at ~350 tokens. Firestore payloads are huge;
   this alone cuts input tokens ~5–10×.
3. **Two-tier tool catalog** (§6) — never the raw 1,495-endpoint spec.
4. Small max_tokens for decisions (`max_tokens=200`, temperature ~0.4).
5. Concurrency 5, token reuse across steps (no re-login per step).

---

## 4. Architecture

```
                    ┌──────────────────────────────────────────┐
                    │  sim CLI  (python -m sim.cli)            │
                    └───────┬──────────────────────────────────┘
        ┌───────────────────┼───────────────────────┐
        ▼                   ▼                       ▼
   ┌─────────┐       ┌────────────┐         ┌────────────┐
   │ agent.py│ ×N    │ debrief.py │ ×run    │ analyzer   │
   │ (loop)  │       │ (post-run) │         │ (post-suite│
   └────┬────┘       └─────┬──────┘         └─────┬──────┘
        │                  │                      │
        ▼                  ▼                      ▼
   runs/<id>.jsonl    runs/<id>.debrief.json  reports/report.md
        │
        ▼ calls via httpx (Bearer JWT, X-Audit-Reason for admin)
   ┌─────────────────────────────────────────┐
   │  FastAPI backend :8000  (/v1/...)       │ ← real server, real Firestore test project
   └─────────────────────────────────────────┘
        │
        ▼
   DeepSeek API (deepseek-flash) — decisions + debriefs only
```

Hard rule: **agents never touch a mock.** The website's dev-mode read mocks
(`website/src/lib/api/http.ts`) mean the UI can look fine while the API is broken;
hitting the real API is the point.

---

## 5. Agent loop

State per run: `persona card`, `goal`, `step count`, `history` (last ~8 actions,
compressed), `memory` (facts extracted: ids, tokens, names), `token budget`.

```
loop until done or step_cap (default 30):
  1. perceive   → last tool result (truncated) or fresh goal
  2. decide     → LLM call: persona + goal + memory + history + tool index
                  → ONE action, strict JSON (schema below)
  3. act        → execute via tools layer; record {step, action, http, latency_ms,
                  resp_status, resp_excerpt} to runs/<id>.jsonl
  4. reflect    → append 1-line summary to history; update memory
watchdog: same (method,path) 3× consecutively, or 5 steps with no state change
          → mark STUCK, force debrief
```

Action schema (the only thing the LLM ever emits):

```json
{
  "action": "call_endpoint" | "search_tools" | "wait" | "give_up" | "done",
  "reason": "one line, in persona voice",
  "endpoint_id": "marketplace_listProducts",   // for call_endpoint
  "params": {"query": {"page": 1}, "body": {}}, // only provided fields
  "expectation": "what I think this returns",   // used by analyzer for surprises
  "satisfaction": 1                             // 1-5, at "done"/"give_up"
}
```

- `done` requires a `summary` field ("what I achieved").
- `give_up` requires `blocker` ("why I can't continue").
- Every call records **expectation vs actual** — mismatch = candidate missing/bug.

---

## 6. Endpoint catalog (two-tier — the critical design piece)

`/openapi.json` from the running backend is fetched once per suite and normalized
into `catalog.json`: `{op_id, method, path, summary, tag}` per operation.

~1,495 operations cannot go in a prompt. Two tiers:

1. **Curated core list per persona** (always in context, ~15–30 endpoints, from
   `config/persona_tools.yaml`). E.g. farmer: `auth*, users/me*, mandi_*, market_*,
   demands_*, farmer_*, diary_*, advisory_*`.
2. **`search_tools(query)` tool** — keyword search over the full catalog
   (tag + path + summary), top-5 results injected on demand. This is also *how
   "missing features" get discovered*: a persona searches for something, gets zero
   results, records it in the debrief.

`op_id` = FastAPI `operationId` (deterministic, e.g. `marketplace_listProducts`).

---

## 7. Personas — the 20

Canonical source: `PLATFORM_PERSONAS` (`backend/app/routers/users.py:48-53`).
One account can hold many linked profiles (`linkedProfiles`); switching is
`POST /v1/users/me/profiles/{type}/activate`; role gating is `require_role` on
`activeProfile`.

| # | Persona (API value) | Brand / app | Core goals to simulate |
|---|---|---|---|
| 1 | `farmer` | Kisan super-app | mandi prices, sell lot, buy inputs, diary, P&L, crop doctor, loans, insurance |
| 2 | `farmLandlord` | LandBank | list plot, lease it, track rent & milestones |
| 3 | `transporter` | AgriFleet | verify vehicle, find load, run trip, wallet/payout |
| 4 | `seller` | Vyapari / FarmLink | mandi rates, procure, sell, POS, settlements |
| 5 | `equipmentRental` | MachineBazaar | list machine, accept booking, settle |
| 6 | `broker` | Dalal / DealDesk | leads → deal → commission → dispute |
| 7 | `dairyManager` | DairyOS | members, rate chart, collection, payment batch |
| 8 | `instructor` | Krishi Academy | create course, batch, grade, earnings |
| 9 | `directBuyer` | ProcurePro | post demand, standing order, QC, statements |
| 10 | `customer` | FarmGate e-market | browse mall, cart, order, track, wallet, subscriptions |
| 11 | `bankManager` | CreditDesk | review loan application, disburse, repayments |
| 12 | `insuranceProvider` | ClaimsDesk | policy ops, claim survey, dual sign-off |
| 13 | `coldStorageProvider` | StoreHouse | facility, bookings, receipts, fees |
| 14 | `gaushalaManager` | Gaushala | cattle, adoptions, receipts, expenses |
| 15 | `vet` | Vet practice | appointments, prescriptions, campaigns, earnings |
| 16 | `milkSeller` | Milk desk | clients, deliveries, bills, analytics |
| 17 | `exporter` | Export desk | RFQ, quote, shipment, LC, remittance |
| 18 | `fpoManager` | FPO hub | pool, machinery, verification flow |
| 19 | `womenShg` | Mahila / SHG | SHG savings, gruh-udyog product, subsidy |
| 20 | `nursery` | Nursery | inventory, batches, orders, payouts |

Persona card (YAML, `config/personas.yaml`) — keep each ≤120 tokens:

```yaml
id: farmer
name: Ramesh Patel
district: Anand, Gujarat
language: hinglish            # agents may think in Hinglish, act in English
tech_literacy: low            # low|medium|high → retries, searches, giving up
device: android_medianet
patience: low                 # gives up quickly; abandons cart
goals: [sell 20q wheat at good rate, check mandi price first, buy urea if cheap]
must_touch: [mandi, market, demands]   # for coverage scoring
never_touch: [admin]                 # enforced by tool whitelist too
```

**Identity resolution** (`src/identity.py`), try in order:
1. `POST /v1/auth/quick-login` `{persona, mpin:"1234"}` — 12 personas pre-seeded
   via `PERSONA_DEFAULTS` (`backend/app/routers/auth.py:666-871`); `omni-user-777`
   holds 11 linked profiles. **Cache the JWT for the whole suite** (login is
   rate-limited 10/10min per IP+phone, Redis-backed).
2. `POST /v1/auth/otp/send` → dev response includes `devOtp` → `POST /v1/auth/otp/verify`.
3. `POST /v1/auth/onboard` (seeds demo data via `onboarding_seed.py`) or
   omni-user + `profiles/{type}/activate` for profiles without seeds.
4. If none works: mark persona `blocked: no-test-identity` — itself a finding.

**Admin mode (Mode D, §8)**: 6 operator accounts from
`backend/scripts/seed_superadmin_users.py` (MPIN `1234`). Every mutating call must
send `X-Audit-Reason: sim-<run_id>` (backend 400s without it —
`app/core/deps.py:103`) and `X-Admin-Role` per operator.

---

## 8. Scenario library — 4 modes

`config/scenarios.yaml`. Each scenario: `id, persona, mode, goal, max_steps,
tools_whitelist (optional override), tags`.

**A. Guided journey** — scripted checkpoints, happy path.
```yaml
- id: farmer-sell-wheat
  persona: farmer
  mode: guided
  goal: "Sell 20 quintal wheat. First check today's mandi price, then create a lot and respond to any offer."
  checkpoints: [mandi price viewed, lot created, offer handled, status=live]
```

**B. Open exploration** — persona gets a life-goal, acts freely. Best mode for
missing-feature discovery. Example: `transporter`: "You have a pickup truck in
Rajkot and need ₹8,000 this week." Agent decides everything.

**C. Adversarial / friction** — low-tech-literacy persona, half-loaded data,
rage patterns, invalid inputs, abandoned carts, offline-ish pacing. Best mode for
"not smooth" discovery.

**D. Admin sweep** — operator persona walks its SOP desk (superadmin console
surface: `admin_console`, `admin_sop_*`). E.g. `operations_lead` moderates one lot,
resolves one dispute, checks audit log.

Suite definition (`config/settings.yaml`):
- `suite: smoke` = 5 personas × 1 guided + 1 open each (cheap, minutes).
- `suite: full` = all 20 personas × (1 guided + 1 open + 1 adversarial) + 6 admin sweeps.

---

## 9. Debrief (after every run)

One extra LLM call, same model, persona-context on, strict JSON out:

```json
{
  "completed": true,
  "blockers": [{"what": "...", "step": 12, "evidence": "403 on ..."}],
  "missing_features": ["expected X but no endpoint/tool found via search_tools"],
  "confusing": ["step where I retried because ..."],
  "unnecessary": ["steps/endpoints that felt redundant"],
  "satisfaction": 2,
  "verbatim_frustration": "persona-voice quote for the report"
}
```

`missing_features` entries are the gold. Rules: must reference an actual attempted
action (from the run log), not imagination.

---

## 10. Budget & guardrails

- `budget.py`: per-run `max_steps`, per-suite `max_llm_calls` + `max_usd`;
  counters checked before every LLM call; on exhaustion → finish current runs,
  write partial report, exit code 3.
- Concurrency: `asyncio.Semaphore(5)`; per-step HTTP timeout 15 s; LLM timeout 30 s
  with 2 retries (exponential backoff).
- `--replay runs/<id>`: re-run analyzer/debrief from recorded jsonl with **zero
  LLM calls** — tune reports for free.
- `--mock-llm`: canned responses so the harness itself is testable offline.
- Run id = `{suite}-{timestamp}-{git_sha[:7]}`; every report header carries it.

---

## 11. Seeding the world

Agents need data to find. Before a suite (`sim seed`):
1. Backend up per `run.sh` (`ENV=dev`, port 8000).
2. Firestore: dedicated **test project** only (service-account path via env) —
   never the production project.
3. Run existing scripts in order: `seed_mandi, seed_products, seed_equipment,
   seed_fpo, seed_faq, seed_coupons, seed_contracts, seed_insurance_demo,
   seed_search_data, seed_women_data, seed_app_config, seed_superadmin_users`.
4. Harness-owned `seed_sim.py`: 1–2 extra lots/demands/RFQs/loan apps per persona
   so every persona has something to act on in open mode.

---

## 12. Safety

- Localhost/staging backend only; `base_url` allowlist blocks non-local hosts.
- Dev/test auth paths only (quick-login / devOtp). No real Firebase phone OTP.
- No real money movement: agents may *create* orders/payments but the harness
  never completes live gateway steps; Razorpay stays on test keys in dev env.
- Admin mutations always carry `X-Audit-Reason: sim-<run_id>` → visible in
  `audit_logs`, easy to filter out later.
- No production service account paths; harness refuses to boot if
  `ENV` looks like prod.

---

## 13. Repo layout

```
sim/
├── specs.md                 ← this file
├── requirements.txt         # httpx, openai, pydantic, pyyaml, typer
├── config/
│   ├── settings.yaml        # model, base_url, budgets, suite defs
│   ├── personas.yaml        # 20 persona cards
│   ├── scenarios.yaml       # journey library
│   └── persona_tools.yaml   # persona → core endpoint whitelist
├── src/
│   ├── cli.py               # sim seed | run | analyze | report
│   ├── catalog.py           # /openapi.json → catalog.json + search index
│   ├── identity.py          # persona → JWT (§7)
│   ├── agent.py             # the loop (§5)
│   ├── tools.py             # call_endpoint / search_tools + truncation
│   ├── debrief.py           # structured experience report (§9)
│   ├── budget.py            # token/$ caps
│   ├── seed_sim.py
│   └── analyzer.py          # coverage, failures, stucks, gap clustering
├── runs/                    # *.jsonl, *.debrief.json (gitignored)
└── reports/                 # report.md + report.json per suite
```

Analyzer outputs (`reports/`):
1. **Coverage map** — per persona: endpoints hit vs `must_touch`; suite-wide hit map
   vs full catalog. **Zero-hit endpoints inside a relevant persona scope across ≥3
   suite runs → "unnecessary?" candidate list** (tag-clustered; never raw zero-hit
   alone — some endpoints are seasonal/webhook/admin-only).
2. **Failure taxonomy** — 4xx/5xx by endpoint; expectation-vs-actual mismatches;
   403s that surprise the agent (role/permission rough edges).
3. **Stuck report** — watchdog events with the exact step trail.
4. **Missing-feature board** — debrief `missing_features` + `blockers`, deduped by
   normalized text, ranked by frequency × persona breadth. Top entries with the
   run-log evidence attached.
5. **Friction index** — per journey: retries, backtracks, p50/p95 step latency,
   satisfaction mean.

---

## 14. Milestones (each ends with a sim run + report, per your loop)

- **M0 — skeleton (day 1)**: `catalog.py` + `identity.py` + `agent.py` +
  `budget.py`. Proof: `farmer` completes one guided journey (mandi → create lot)
  in ≤30 steps, ≤40k LLM tokens, writes `runs/*.jsonl` + a debrief. Done =
  command runs, log shows real HTTP calls to :8000, debrief JSON parses.
- **M1 — smoke suite**: 5 personas (farmer, seller, transporter, customer,
  bankManager) × guided+open. First `report.md` with a real missing-feature
  candidate list.
- **M2 — full suite**: all 20 personas + adversarial mode + 6 admin sweeps
  (Mode D). ~2,000 steps.
- **M3 — regression mode**: `sim run --suite full` wired as a nightly/CI job;
  report diffs between runs (new gaps fixed = closed, new failures = regressions).
  `--replay` free re-analysis.
- **M4 — optional**: (a) browser mode — Playwright + vision on the website for
  UI-level friction; (b) local-model mode via Ollama for $0 runs; (c) wire
  `ai_decisions`-style cost logging the backend already has.

---

## 15. CLI

```bash
cd backend && ../run.sh backend &        # real server on :8000, ENV=dev
cd sim
pip install -r requirements.txt
export DEEPSEEK_API_KEY=...               # or OPENAI_BASE_URL/KEY for any provider

python -m sim.cli catalog                 # fetch /openapi.json → catalog.json
python -m sim.cli seed                    # run backend seeds + seed_sim.py
python -m sim.cli run  --suite smoke      # cheap pass (~10 min, ~$0.10)
python -m sim.cli run  --suite full       # 20 personas (~20 min, ~$0.30–0.60)
python -m sim.cli analyze                 # runs/ → reports/report.md
python -m sim.cli report --json           # machine-readable
```

---

## 16. How to read results (your actual question)

- **Missing feature** signals, ranked by confidence:
  1. `search_tools` returned 0 results for a goal-relevant query (user looked, nothing there).
  2. Debrief `missing_features` with a logged attempt behind it.
  3. Expectation-vs-actual mismatch (agent reasonably assumed X, API did Y).
  4. 404/405 on a guessed path (agent "invented" an endpoint that should exist).
  5. Watchdog STUCK on a checkpoint.
- **Unnecessary feature** signals: zero coverage across ≥3 full suites *within a
  persona scope that should use it*, plus debrief "unnecessary" mentions. Review
  manually before deleting anything — cross-check seasonality and admin/webhook use.
- **Not smooth**: friction index + `verbatim_frustration` quotes; fix the top 3
  retried steps per journey first.

Iterate: fix/implement from the report → re-seed → `sim run` → diff reports.
That's the loop this spec exists to support.
