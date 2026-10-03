# ai_implementation_plan.md — AI-First AGROVERCITY: Execution Plan & Module-wise Agent Briefs

> v3 — 2026-10-03. Companion to `missing-features/ai.md` (research, feature catalog
> IDs A1–C20, user flows §5). Read that first.
>
> **Provider split (fixed):**
> - **Jev → OpenRouter** — model pinned `typesafe/jev-1.13`, key `OPENROUTER_API_KEY`
> - **Gemini → Google AI Studio direct** — `google-genai` SDK, key `GEMINI_API_KEY`
>   (from aistudio.google.com). No OpenRouter for Gemini.
>
> **Descoped:** Voice AI (STT/TTS, voice forms, voice onboarding, voice chatbot) is
> out of this program. Brief M27 is retired (ID reserved to keep numbering stable).
>
> **How to use this doc:** §1–§4 are the foundation (implement once). §5 contains
> **module-wise briefs written to be handed directly to an AI coding agent** — each
> is self-contained: goal, files to read, steps, acceptance criteria, verification.
> Paste one brief + the Global Agent Rules (§5.0) into your coding model of choice.

---

## 0. Guiding rules

1. Jev decides, Gemini explains, humans adjudicate.
2. All model calls go through `services/ai/gateway.py` — never call OpenRouter or
   Gemini from routers directly.
3. Every decision point has a deterministic fallback; the app fully works with
   `AI_PROVIDER=shim`.
4. Every call is logged to `ai_decisions` with cost + confidence; outcomes
   backfilled for calibration.
5. No Aadhaar (unmasked), phone numbers, or emails in any AI payload.
6. Automation levels: `suggest → require_confirm → auto`. Credit/insurance/legal
   never exceed `require_confirm`. New features always launch at `suggest`.
7. CI never calls paid APIs.

---

## 1. PHASE A — AI foundation (brief M1 implements this)

### 1.1 New package `backend/app/services/ai/`

| File | Responsibility |
|---|---|
| `gateway.py` | Single entry: `decide(state, question_set_id, ctx) -> DecisionResult`, `generate(prompt, opts) -> str`, `analyze_image(bytes, prompt, schema) -> dict`, `embed(texts) -> vectors`. Routing, retries (2, backoff), timeouts (Jev 2s, Gemini 20s), fallback, logging. |
| `jev_client.py` | OpenRouter HTTP client (httpx async). Model `typesafe/jev-1.13`. Batches multiple questions per call. `HTTP-Referer`/`X-Title` headers. |
| `gemini_client.py` | `google-genai` SDK wrapper (AI Studio key). Models via config. Count-tokens helper for cost logging. |
| `question_sets.py` | Registry of typed question schemas (see §2). Each: `{id, version, schema, state_builder, confidence_threshold, automation_level, fallback_fn}`. |
| `decision_log.py` | Writes `ai_decisions`; Firestore collection, 90-day TTL to cold storage later. |
| `outcomes.py` | `record_outcome(decision_id, outcome)` — links real-world resolution back. |
| `shim.py` | Deterministic fixture answers from `backend/tests/fixtures/ai/`; active when `AI_PROVIDER=shim`. |
| `budget.py` | Redis per-day cost counters per model; 80% → admin alert, 100% → module falls back. |
| `privacy.py` | Sanitizers: hash user IDs (`HMAC(user_id, AI_HASH_SALT)`), strip phones/emails, trim state to token budget, chunk >32k states. |

### 1.2 Config

`backend/.env`:
```
OPENROUTER_API_KEY=...
GEMINI_API_KEY=...
AI_PROVIDER=live            # shim in dev/test/CI
AI_JEV_MODEL=typesafe/jev-1.13
AI_GEMINI_MODEL=gemini-2.5-flash
AI_GEMINI_MODEL_LITE=gemini-2.5-flash-lite
AI_GEMINI_MODEL_PRO=gemini-2.5-pro
AI_GEMINI_EMBED_MODEL=gemini-embedding-001
AI_DAILY_BUDGET_USD=50
AI_HASH_SALT=...
```

`platform_config/ai` (Firestore, admin-editable with maker-checker + audit):
```json
{
  "modules": { "trade_offer_score": true, "seller_rate_check": true, "...": false },
  "thresholds": { "trade.offer_score.v1": 0.75 },
  "automation": { "trade.offer_score.v1": "suggest" }
}
```

### 1.3 Contracts

```python
class DecisionResult(BaseModel):
    answers: dict[str, Any]
    confidence: float
    source: Literal["jev", "gemini", "fallback", "shim"]
    escalated: bool
    decision_id: str
    latency_ms: int
```

### 1.4 Refactors into the gateway
- `services/chatbot.py` → prompt logic stays; model call via `gateway.generate()`.
- `services/disease_model/` → via `gateway.analyze_image()`; stub becomes fallback.
- `services/grading_model/` → real impl in brief M10; stub becomes fallback.

---

## 2. Question-set registry (catalog)

All IDs referenced by ai.md and the briefs. Schemas use Jev question types:
`bool`, `choice` (with `criteria` map), `score` (0–1). Version bumps on any
change. Golden fixtures live at `backend/tests/fixtures/ai/golden/<id>.jsonl`.

| Question set | Key questions (summary) | Used by brief |
|---|---|---|
| `tasks.rank.v1` | per-task `impact` score; `headline_task` choice | M5 |
| `notify.timing.v1` | `send_now` bool; `channel` choice(push/sms/digest/skip) | M7 |
| `notify.copy.v1` | (Gemini) vernacular one-liner | M7 |
| `seller.rate_check.v1` | `within_fair_band` bool; `manipulation_signal` score | M4 |
| `trade.offer_score.v1` | `best_action` choice(accept/counter/wait/move_mandi); `fairness`, `urgency` scores | M3 |
| `trust.fraud.v1` | `pattern` choice(circular_bidding/rate_collusion/referral_ring/coin_abuse/none); `risk` score | M8 |
| `trust.payout_anomaly.v1` | `anomaly` bool; `severity` score | M8 |
| `chat.guardrail.v1` | `shares_contact`/`shares_payment_handle`/`abuse` bools | M6 |
| `kyc.extract.v1` | (Gemini vision) field extraction to JSON schema | M11 |
| `kyc.authenticity_risk.v1` | `risk` score; `issue` choice | M11 |
| `dispute.triage.v1` | `category` choice; `urgency` score; `liability_hint` choice | M22 |
| `chatbot.intent.v1` | `intent` choice(agronomy/market/app_help/money/human_needed); `answerable` score | M2 |
| `chatbot.safety.v1` | `has_contact_info`/`has_financial_advice`/`has_medical_certainty` bools | M2 |
| `search.intent.v1` | `index` choice(schemes/products/news/crops/courses/lots) | M23 |
| `content.moderation.v1` | `flag` bool; `reason` choice | M6 |
| `mandi.smart_select.v1` | per-mandi `net_score` (batch); `explain_key` choice | M12 |
| `advisory.saturation.v1` | `risk` choice(low/med/high); `alt_crops` ranked choice | M13 |
| `loans.prescreen.v1` | `completeness` score; `risk_band` choice; `missing_docs` choice-list | M14 |
| `insurance.triage.v1` | `complete` bool; `photo_ok` bool; `fraud_signal` score | M15 |
| `transport.match.v1` | per-vehicle/load `fit` score (batch); `noshow_risk` score | M16 |
| `dairy.adulteration.v1` | `anomaly` bool; `confidence` score | M17 |
| `contracts.attractiveness.v1` | `income_vs_mandi` score; `risk_flags` choice-list | M18 |
| `broker.lead_score.v1` | `quality` score; `deadlock_risk` score | M19 |
| `land.listing_quality.v1` | `completeness` score; `rent_band_ok` bool | M25 |
| `courses.recommend.v1` | per-course `relevance` score (batch) | M20 |
| `schemes.match.v1` | `eligible` bool; `missing` choice-list; `fit` score | M21 |
| `women.shg_readiness.v1` | `readiness` score; `gap` choice | M26 |
| `disease.gate.v1` | `is_plant_leaf` bool; `quality_ok` bool | M9 |
| `grading.gate.v1` | `needs_human` bool; `confidence_class` choice | M10 |
| `churn.signal.v1` | `churn_risk` score; `best_hook` choice | M28 |
| `agent.rule_match.v1` | `rule_fires` bool; `rule_id` choice | M29 |
| `support.intent.v1` | `resolvable` bool; `category` choice; `escalate` bool | M30 |

(Gemini-only features — C2 receipts, C3/C4 forecasts, C5 crop planner, C6
negotiation coach, C12 briefs, C14 admin copilot, C15 localization — use
`gateway.generate()` / `analyze_image()` with JSON-mode prompts and output
Pydantic validation; no Jev question set needed unless listed above.)

---

## 3. Standard recipes (referenced by all briefs)

### SDR — Standard Decision Recipe (any Jev feature)
1. Register the question set in `question_sets.py` (schema + threshold + fallback).
2. At the call site, build state via a `privacy.py` builder (pseudonymized, ≤1,500
   tokens target).
3. `result = await gateway.decide(state, "<id>.v1", ctx)`.
4. Act per automation level: `suggest` = annotate only; `require_confirm` =
   preselect but require user tap; `auto` = execute (only where allowed).
5. On exception/timeout/low budget → fallback behavior; log with `fallbackUsed`.
6. Register an outcome hook (what real-world event resolves this decision).
7. Tests: golden fixture passes on shim; fallback test with gateway raising;
   flag-off test proving the module works without AI.

### SGR — Standard Generation Recipe (any Gemini feature)
1. `gateway.generate(prompt, model=lite|flash|pro, json_schema=..., lang=user_lang)`.
2. Validate output with a Pydantic model; one repair retry on validation failure.
3. Cache aggressively (per district-crop / per decision_id — never per page-view).
4. Log cost; fallback = static template text in en/hi.

---

## 4. Rollout phases & gates

| Phase | Briefs | Gate to proceed |
|---|---|---|
| A. Foundation | M1 | CI green on shim; staging decision log visible; budgets trip cleanly |
| B. Conversation & safety | M2, M6 | Red-team moderation set caught; handoff threads work on web |
| C. Decision wave 1 | M3, M4, M5, M7, M8 | 2 weeks of logs; fallback rate <5%; spend within budget |
| D. Vision & docs | M9, M10, M11 | Golden-set accuracy ≥ rule baseline |
| E. Persona waves | M12–M26 (any order, per persona priority) | Per-set calibration review |
| F. Experience AI | M28–M33 (M27 retired) | Each feature's own acceptance |
| G. Automation raises | — | ≥1,000 outcomes, >90% top-bucket accuracy, maker-checker |

---

## 5. Module-wise agent briefs

### 5.0 Global agent rules (paste with every brief)

> You are implementing one module of the AI-First AGROVERCITY plan. Repo:
> `/home/tushka/Projects/AGROVERCITY`. Backend: FastAPI + Firestore at `backend/`
> (routers in `backend/app/routers/`, services in `backend/app/services/`, tests in
> `backend/tests/`). Website: React+TS+Vite at `website/` (API wrappers in
> `website/src/lib/api/`, views in `website/src/views/`, i18n via `t()` in
> `website/src/lib/i18n/`). Follow the Global Rules in §0, the SDR/SGR recipes in
> §3, and the provider config in §1.2. Never call OpenRouter/Gemini outside
> `services/ai/gateway.py`. Never hardcode user-facing strings (use `t()`, en+hi).
> No voice/STT/TTS features — they are descoped.
> Verification for every brief: `cd backend && .venv/bin/python -m pytest -q`
> green, `cd website && pnpm build` green, and the feature works with
> `AI_PROVIDER=shim`.

---

### M1 — AI foundation gateway
- **Goal:** Build `backend/app/services/ai/` per §1.1 exactly, plus config per §1.2.
- **Read first:** `backend/app/services/chatbot.py` (existing Gemini usage),
  `backend/app/core/config.py`, `backend/app/core/db.py`,
  `backend/tests/conftest.py`.
- **Steps:**
  1. Create the package: `gateway.py`, `jev_client.py`, `gemini_client.py`,
     `question_sets.py`, `decision_log.py`, `outcomes.py`, `shim.py`, `budget.py`,
     `privacy.py` per §1.1 responsibilities.
  2. `jev_client`: POST to OpenRouter with model `typesafe/jev-1.13`; one HTTP call
     per `decide()` carrying all questions; map response into `DecisionResult`.
  3. `gemini_client`: `google-genai` async client; `generate` (with optional JSON
     schema + lang), `analyze_image`, `embed`; record token usage for cost.
  4. `budget.py`: Redis counters `ai:cost:<model>:<yyyymmdd>`; raise `BudgetExhausted`
     at cap → gateway marks fallback.
  5. `shim.py`: loads `backend/tests/fixtures/ai/golden/*.jsonl`; returns fixture
     answers keyed by question-set id; unknown sets return schema-valid defaults.
  6. Register `ai_decisions` write in `decision_log.py`; add module flag check via
     `platform_config/ai` reader (cache 60s).
  7. Refactor `chatbot.py` and `disease_model/` to route through the gateway (keep
     their prompts; keep stubs as fallbacks).
  8. Tests: `backend/tests/test_ai_gateway.py` — shim decide/generate round-trip,
     fallback on client exception, budget trip, privacy sanitizer strips
     phone/email/Aadhaar patterns.
- **Acceptance:** `AI_PROVIDER=shim pytest` green; a `decide()` call in a REPL
  (live, staging key) returns a valid `DecisionResult` and writes an `ai_decisions`
  doc with cost; gateway down → callers get fallback, not exceptions.

### M2 — Kisan Mitra 2.0 (chatbot + safety + web UI)
- **Goal:** Jev intent routing + safety post-check around Gemini chat; persona-aware
  prompts; website chat UI with handoff threads. (ai.md flows 5.3/5.10.)
- **Read first:** `backend/app/services/chatbot.py`, `backend/app/routers/chatbot.py`,
  `backend/app/routers/intelligence.py`, `website/src/lib/api/client.ts`,
  `website/src/views/trade/ChatRoomPage.tsx` (chat UI patterns).
- **Steps:**
  1. Register `chatbot.intent.v1` + `chatbot.safety.v1` (§2). On each user message:
     `decide()` intent; `human_needed` or `answerable < 0.6` → existing
     `expert_tickets` handoff path.
  2. Build persona-aware system prompt: active persona + `/intelligence` summary
     snippet + user language.
  3. After Gemini generates, run `chatbot.safety.v1`; on flag → strip + one
     regeneration, else static safe fallback (SDR step 5).
  4. Website: new `website/src/lib/api/chatbot.ts`; Kisan Mitra chat sheet
     (floating action button on dashboard) with en/hi strings and an
     expert-handoff thread view bound to `expert_tickets`.
  5. Wire dashboard "Chat (Kisan Mitra)" tile to the sheet.
- **Acceptance:** Marathi chat returns Marathi, persona-aware answers; red-team
  set (phone-sharing, loan advice) is filtered; handoff creates a visible thread;
  with shim, canned answers flow and UI still works.

### M3 — Trade: offer scoring + negotiation coach
- **Goal:** `[J] trade.offer_score.v1` badges on offers + `[G]` counter-coach.
  (Flow 5.2 steps 4–5.)
- **Read first:** `backend/app/routers/offers.py`, `backend/app/routers/lots.py`,
  `backend/app/routers/mandi.py`, `website/src/views/trade/OffersPage.tsx`,
  `OfferDetailPage.tsx`, `website/src/lib/api/offers.ts`.
- **Steps (SDR):**
  1. Register `trade.offer_score.v1`. State builder: lot (crop, qty, district),
     mandi modal/min/max today + 7-day trend (from `mandi.py` data), top 3 pending
     offers, season.
  2. Call sites: offer creation (store result on offer doc, field `ai`) and lot
     detail read (Redis-cache 15 min).
  3. Website: `<AiBadge>` on offer cards ("mandi +14%", confidence tint); on
     `best_action != null` show recommended action button (suggest level).
  4. Negotiation coach (SGR): `POST /v1/trade/offers/{id}/coach` → Gemini returns
     `{suggested_price_paisa, script_line}` in user language; cache per offer +
     price-band change.
  5. Outcome hook: offer accepted/rejected/expired → `record_outcome`.
- **Acceptance:** golden fixture of 20 historical offers ≥ 75% agreement with
  actual farmer action at threshold; badges render en/hi; coach returns valid
  JSON or is hidden; flag off → plain offer list.

### M4 — Seller rate-band guard + demand forecast
- **Goal:** Synchronous `[J] seller.rate_check.v1` on rate posting; `[G]`
  procurement forecast card. (Flow 5.6.)
- **Read first:** `backend/app/routers/seller.py`, `backend/app/routers/mandi.py`,
  `website/src/views/trade/` (rates, procurement pages).
- **Steps (SDR+SGR):**
  1. In `POST /seller/rates`: build state (posted rate, crop, mandi modal, 7-day
     volatility, seller history); `within_fair_band=false` → 422 with band in
     error payload; `manipulation_signal > 0.8` → write + flag `admin_review`.
  2. Fallback: static ±25% rule (current spec S2).
  3. Website rates form: inline band display + warning from the 422 payload (no
     `alert()`).
  4. Forecast (SGR): nightly job per seller → Gemini over 90-day procurement/sales
     → `{suggested_procurement: [{crop, qty_quintal, reason}]}`; card on seller
     dashboard; cache 24h.
- **Acceptance:** out-of-band post rejected with helpful message; flagged rates
  appear in admin queue (stub route ok); forecast validates or hides; shim works.

### M5 — Task ranking & AI dashboard
- **Goal:** `[J] tasks.rank.v1` orders `GET /v1/tasks/*`; hero next-best-action
  card on every persona dashboard. (Flow 5.1. Depends on robust.md §4 task engine
  existing — if not yet built, implement ranking against `/intelligence` items as
  a temporary adapter and note it.)
- **Read first:** `backend/app/routers/intelligence.py`,
  `website/src/views/dashboard/DashboardHome.tsx`, `website/src/lib/dashboard.ts`.
- **Steps (SDR):**
  1. Register `tasks.rank.v1` (batch ≤10 tasks/call; chunk larger lists).
  2. In tasks endpoints: rank before return; attach `headline_task`.
  3. Website: hero card component + ranked list; replace remaining hardcoded
     metric pills with `/intelligence` + ranked tasks.
  4. Fallback: due-date sort. Outcome: task completed within 24h of being
     headlined → outcome hook.
- **Acceptance:** every persona dashboard shows a ranked, working hero card;
  zero `?? <number>` fallbacks left in dashboard views; shim ranking is stable.

### M6 — Chat & content guardrails
- **Goal:** `[J] chat.guardrail.v1` after regex fast-path on message send;
  `content.moderation.v1` for UGC queues.
- **Read first:** `backend/app/services/chat.py`, `backend/app/routers/chat.py`,
  `backend/app/routers/content.py`.
- **Steps (SDR):** classify only messages that pass regex but look evasive
  (heuristic pre-filter to save cost: contains digits spelled out, "call", "upi",
  "whatsapp" in any script); confirmed violations feed the existing strike
  ladder; moderation queue endpoint for admin. Website: show strike notice in
  chat UI (en/hi).
- **Acceptance:** red-team evasion set ("nine 8 two... call karna") ≥90% caught in
  golden test; normal chat latency +<300ms; regex-only mode works with flag off.

### M7 — Notification intelligence
- **Goal:** `[J] notify.timing.v1` + `[G] notify.copy.v1` in the dispatch path.
- **Read first:** `backend/app/services/notifications.py`, `services/notify.py`,
  `services/fcm.py`, `backend/app/routers/notifications.py`.
- **Steps (SDR+SGR):** decide send/channel per notification (respect quiet hours
  21:00–06:30 unless urgent); Gemini generates the vernacular one-liner cached per
  (task type, lang, day); fallback = current templates + immediate send.
- **Acceptance:** digest mode demonstrably batches; copy renders in hi correctly;
  no notification lost when AI disabled.

### M8 — Trust: fraud & payout anomaly
- **Goal:** `[J] trust.fraud.v1` batch scoring + `trust.payout_anomaly.v1` on
  settlement runs.
- **Read first:** `backend/app/services/settlements.py`, `routers/jobs.py`,
  `services/referrals.py`, `routers/gamification.py`.
- **Steps (SDR):** nightly job scores flagged patterns (graph features: shared
  devices/accounts, circular trades); risk > 0.8 → `soft_hold` + admin queue entry
  (never auto-punish); payout job: anomalous lines held for finance_admin review
  with reason attached. Admin console: queue views.
- **Acceptance:** seeded fraud ring in test data is caught; legitimate settlements
  unaffected; holds carry AI reason + decision_id.

### M9 — Disease scan (vision)
- **Goal:** Web disease scan with `[J] disease.gate.v1` + Gemini vision. (Flow 5.3.)
- **Read first:** `backend/app/services/disease_model/`, `routers/advisory.py`,
  `website/src/lib/firebase.ts` (image upload).
- **Steps:** website scan page (camera/upload → Firebase Storage → signed URL);
  backend: gate decision first (retake guidance en/hi), then `analyze_image` with
  disease JSON schema (name, confidence, treatment, est_cost, urgency);
  per-plot scan history (F10); confidence < 0.7 → expert ticket with photo;
  treatment → task emission. Fallback: existing stub labeled "demo".
- **Acceptance:** golden image set accuracy ≥ stub baseline; history list works;
  expert handoff shows photo; retake guidance on blurry/non-leaf images.

### M10 — AI grading (AGMARK)
- **Goal:** Replace `grading_model` stub with Gemini vision + `[J] grading.gate.v1`.
- **Read first:** `backend/app/services/grading_model/`, `routers/post_harvest.py`.
- **Steps:** real `analyze_image` impl (grade, shelf_life_days, price_band vs
  mandi); gate: confidence < 0.7 → "human grader" pathway (task to ops queue);
  result card deep-links "list as lot" (prefill lot form); stub stays as fallback.
- **Acceptance:** golden graded-image set within ±1 grade ≥ 80%; lot-prefill loop
  works end-to-end on web; honest "AI estimate" label rendered.

### M11 — KYC extraction & triage
- **Goal:** `[G] kyc.extract.v1` + `[J] kyc.authenticity_risk.v1` feeding the real
  KYC queue (replaces hardcoded admin samples).
- **Read first:** `backend/app/routers/admin.py` (KYC queue), `routers/users.py`
  (role_profiles), superadmin-instructions module 03.
- **Steps:** on doc upload → Gemini vision extracts fields to per-doc-type
  Pydantic schema (Aadhaar masked only); Jev scores risk from extraction
  consistency (name/dob vs profile, doc age, image-quality signals);
  risk < 0.3 → auto-advance to verified-pending-bank; else human queue with
  extracted fields + risk reasons. Website: KYC wizard shows extraction for user
  confirmation.
- **Acceptance:** no unmasked Aadhaar ever logged or sent; extraction precision
  ≥90% on golden doc set; queue shows AI reasons; manual path unchanged.

### M12 — Mandi: smart selection + price forecast
- **Goal:** `[J] mandi.smart_select.v1` + `[G]` 7/30-day forecast. (B1, C3.)
- **Read first:** `backend/app/routers/mandi.py`, `routers/transport.py` (fare
  estimate), `website/src/views/trade/MandiPage.tsx`.
- **Steps:** state: lot + farmer location + candidate mandis (modal prices,
  distance, transport fare estimate) → per-mandi net score; UI: "best mandi" card
  with net-after-transport math shown; forecast: nightly Gemini job per
  (crop, mandi) over history + arrivals → projected band with confidence class
  (Jev), line chart on web, "estimate" label.
- **Acceptance:** selection matches hand-computed cases in golden set; forecast
  chart renders en/hi; fallback = current compare view.

### M13 — Advisory: saturation + AI crop planner
- **Goal:** `[J] advisory.saturation.v1` live classes + `[G]` season crop planner
  (C5) replacing hardcoded base prices.
- **Read first:** `backend/app/routers/advisory.py`, `services/advisory.py`,
  robust.md §4 (crop_cycles/task engine).
- **Steps:** replace hardcoded price logic with mandi-linked data; saturation
  decision from sowing-intent aggregates per district-crop; planner endpoint:
  inputs (soil, irrigation, plot size, history, saturation) → Gemini plan
  (2–3 options with rationale, en/hi) → on farmer confirm, create `crop_cycles`
  + generated task schedule. Website: advisory hub UI (it is a placeholder today).
- **Acceptance:** planner output validates and creates real crop_cycles + tasks
  on confirm; saturation classes stable across golden districts; nothing shown
  without data-basis citation.

### M14 — Loans pre-screen (CreditDesk)
- **Goal:** `[J] loans.prescreen.v1` sorts the bank-manager queue; completeness
  flags create farmer tasks. (Flow 5.7. Suggest-only forever.)
- **Read first:** `backend/app/routers/loans.py`, `routers/finance.py`.
- **Steps:** score on application submit + queue read; queue API returns sorted
  list with `ai` annotations (risk band, missing docs); missing docs → task
  emitted to farmer; manager UI badges. Outcome hook: approved/rejected/defaulted.
- **Acceptance:** AI never mutates application status; golden set ranking
  correlation ≥ 0.7 vs manager labels; flags off = submitted-order queue.

### M15 — Insurance claim triage (ClaimsDesk)
- **Goal:** `[J] insurance.triage.v1` at intimation + provider queue pre-sort.
  (Flow 5.8.)
- **Read first:** `backend/app/routers/insurance_claims.py`, `routers/insurance.py`.
- **Steps:** at intimation: photo-quality/completeness instant feedback (retake
  guidance en/hi); provider console: triage badges + suggested surveyor
  assignment; fraud_signal > 0.8 → flag, never auto-reject.
- **Acceptance:** incomplete claims get same-day farmer feedback; provider queue
  shows triage reasons; decision path unchanged (human).

### M16 — Transport matching & return loads
- **Goal:** `[J] transport.match.v1` vehicle↔load ranking, return-load matches,
  no-show risk. (Flow 5.5.)
- **Read first:** `backend/app/routers/transport.py`,
  `website/src/views/transport/`.
- **Steps:** match job per new load/booking request (batch scoring: route fit,
  vehicle type, capacity, history); return-load card on trip completion; no-show
  risk shown on accept screens; outcome hooks: completed/cancelled.
- **Acceptance:** matched suggestions beat distance-only baseline on golden set;
  UI cards en/hi; fallback = distance sort.

### M17 — Dairy adulteration & collection anomalies
- **Goal:** `[J] dairy.adulteration.v1` on collection entry.
- **Read first:** `backend/app/routers/dairy_manager.py`, `routers/livestock_dairy.py`.
- **Steps:** per collection: member's 30-day FAT/SNF baseline vs today → anomaly
  bool + confidence; anomalous entries flagged (not blocked) on console + member
  statement note; weekly batch job for route-level anomalies.
- **Acceptance:** seeded adulteration pattern flagged ≥85%; zero false-blocks;
  statements render flag notes en/hi.

### M18 — Contracts attractiveness (direct buyer)
- **Goal:** `[J] contracts.attractiveness.v1` on grow-for-us cards.
- **Read first:** `backend/app/routers/contracts.py`, `routers/direct_buyer.py`,
  `website/src/views/directbuyer/`, `website/src/views/farmer/`.
- **Steps:** state: contract terms (formula pricing), crop mandi trend, farmer
  crop history → income_vs_mandi score + risk flags; shown on farmer decision
  card with explanation sheet (Gemini one-liner, cached).
- **Acceptance:** card shows score + honest explanation; golden contracts rank
  sensibly; e-sign flow untouched.

### M19 — Broker lead scoring & deadlock prediction
- **Goal:** `[J] broker.lead_score.v1`.
- **Read first:** `backend/app/routers/broker.py`, `routers/farmer_deals.py`,
  `website/src/views/broker/`.
- **Steps:** score new leads (source, history, demand fit); per-deal deadlock
  risk at round 2 of 3 (message count, price gap, TTL) → suggest mediator
  action; dashboard pipeline annotated.
- **Acceptance:** scores surface in pipeline UI; golden deals: high-deadlock
  predictions correlate with actual deadlocks (document measured correlation).

### M20 — Courses: recommendations + auto-grading
- **Goal:** `[J] courses.recommend.v1` + `[G]` objective auto-grading (B14, C20).
- **Read first:** `backend/app/routers/courses.py`, `routers/teachers.py`.
- **Steps:** per-farmer course relevance (crops, season, completed courses) on
  catalog load (cached 24h); objective assignment grading via Gemini with rubric
  JSON schema, instructor confirm required; learning-path suggestion after each
  certificate.
- **Acceptance:** recommendations render on learner catalog; auto-grades require
  instructor confirm to publish; rubric validation strict.

### M21 — Schemes matching & doc-gap
- **Goal:** `[J] schemes.match.v1` + Gemini eligibility explanation (B15).
- **Read first:** `backend/app/routers/schemes.py`, `services/eligibility.py`.
- **Steps:** match on profile change + nightly; eligible schemes ranked with
  missing-doc list → tasks; Gemini generates vernacular "why eligible / what to
  do" cached per (scheme, profile-class).
- **Acceptance:** matches equal the rules engine's truth set (AI ranks, rules
  decide eligibility); explanations render en/hi; deadline tasks emitted.

### M22 — Dispute triage (admin)
- **Goal:** `[J] dispute.triage.v1` routing all dispute types.
- **Read first:** `backend/app/routers/admin.py`, settlement/dispute surfaces in
  `routers/purchases.py`, `routers/transport.py`.
- **Steps:** on dispute open: category, urgency, liability hint → routed to the
  correct RBAC queue (compliance/finance/ops) with SLA clock; admin detail shows
  AI summary + evidence links.
- **Acceptance:** all dispute types land in correct queues in tests; SLA visible;
  human decision unchanged.

### M23 — Search intent + embeddings
- **Goal:** `[J] search.intent.v1` + `gemini-embedding-001` semantic index for
  `GET /v1/search`.
- **Read first:** robust.md 7.24, `backend/app/routers/` (schemes, marketplace,
  content, courses).
- **Steps:** new `routers/search.py`: Jev classifies intent → targeted queries;
  embeddings for schemes/courses/news stored in Firestore vector field (or
  Redis), cosine match merged with keyword; website results page grouped by
  module.
- **Acceptance:** "pyaz ka bhav" → mandi/lots results first; index rebuild job
  works; shim returns keyword-only results.

### M24 — Equipment booking recommendations
- **Goal:** `[J]` approve-recommendation for owners + damage severity `[G-vision]`.
- **Read first:** `backend/app/routers/equipment_owner.py`, `routers/equipment.py`.
- **Steps:** booking request → recommendation score (renter history, slot
  conflicts, distance) shown in owner queue; damage claim photos → severity
  estimate + suggested deduction band (suggest-only, owner/admin confirm).
- **Acceptance:** queue annotated; damage flow requires human confirm; golden
  damage set severity within ±1 band ≥ 75%.

### M25 — Land listing quality
- **Goal:** `[J] land.listing_quality.v1` tips + rent band check.
- **Read first:** `backend/app/routers/land.py`, `website/src/views/landlord/`.
- **Steps:** on listing save: completeness score + actionable tips ("photo add
  karein"); rent vs village band check; tenant-request compatibility score for
  landlord inbox.
- **Acceptance:** tips render en/hi and are actionable; band from real lease
  data where available (else district defaults, labeled).

### M26 — Women hub: SHG readiness
- **Goal:** `[J] women.shg_readiness.v1`.
- **Read first:** `backend/app/routers/women.py` (hardcoded today — replace with
  real collections per robust.md 7.12 first).
- **Steps:** from SHG savings regularity, meeting attendance, enterprise income →
  readiness score + biggest gap; surfaced to SHG leader dashboard with suggested
  next step; links to loan marketplace when ready.
- **Acceptance:** works only on real SHG data; score explainable (factors shown);
  suggest-only.

### M27 — RETIRED
Voice AI (STT/TTS, voice forms, voice onboarding, Kisan Mitra voice mode) is
descoped from this program. ID reserved to keep brief numbering stable. Do not
implement.

### M28 — Receipt/weigh-slip diary scan + churn signals
- **Goal:** `[G-vision]` receipt/weigh-slip → diary entry (C2) + `[J] churn.signal.v1`.
- **Read first:** `backend/app/routers/diary.py`, `services/diary_analytics.py`.
- **Steps:** photo upload → extraction (amount, category, party, date) →
  prefilled diary form for confirm; nightly churn job over activity recency →
  re-engagement task/notification via M7.
- **Acceptance:** golden receipt set extraction ≥85% field accuracy; churn tasks
  only for users dormant ≥7 days; diary totals unchanged until user confirms.

### M29 — Farmer standing agent (rules in vernacular)
- **Goal:** `[G]` parse vernacular standing instruction → structured rule;
  `[J] agent.rule_match.v1` evaluates on events; one-tap confirm executes (C17).
- **Read first:** briefs M3, M5; `routers/offers.py`.
- **Steps:** `agent_rules` collection (`{userHash, module, condition, action,
  max_value_paisa, active}`); rule-creation guided form with vernacular
  examples; on relevant events (new offer etc.) Jev evaluates rule against
  state → if fire, task with explicit confirm button executes via existing
  endpoints; every fire + outcome logged; hard caps (no rule may auto-execute;
  confirm always required v1).
- **Acceptance:** "₹1800 se upar accept" fires only on qualifying offers;
  user can pause/delete rules; full audit trail; nothing executes without tap.

### M30 — AI support agent
- **Goal:** `[J] support.intent.v1` + Gemini answers for app-help; escalate
  money/account issues to humans (C13).
- **Read first:** `backend/app/routers/chatbot.py`, `expert_tickets` flow,
  help-center content (legal/faq pages).
- **Steps:** help-center chat: intent decide → resolvable app-help answered from
  FAQ corpus (embeddings retrieval, M23 infra) → unresolved/sensitive → human
  ticket; answers cite the FAQ source.
- **Acceptance:** resolution rate measured; money questions always escalate;
  no invented policy (answers must cite source doc ids).

### M31 — Admin copilot
- **Goal:** `[G]` NL ops queries + daily briefing in admin console (C14).
- **Read first:** `backend/app/routers/admin.py`, `routers/analytics.py`.
- **Steps:** whitelisted query tools (KYC backlog, settlement holds, fraud queue,
  scan clusters) exposed as function-calling schema to `gemini-2.5-pro`; copilot
  panel in admin console; nightly briefing doc → admin dashboard card; every
  query audit-logged.
- **Acceptance:** copilot can only call whitelisted read-only tools; briefing
  generates in <60s; answers show their data source.

### M32 — Localization pipeline
- **Goal:** Gemini-assisted completion of the 28 partial locales + review queue
  (C15).
- **Read first:** `website/src/lib/i18n/`, `website/src/lib/i18n/locales/en.ts`.
- **Steps:** script `backend/scripts/translate_locales.py`: diff missing keys per
  locale → Gemini batches with glossary (agri terms locked: mandi, khasra, 7/12…)
  → draft locale files flagged `ai-draft`; review UI (simple admin page) for
  native-speaker approval; CI parity gate counts only approved keys.
- **Acceptance:** ta goes 85→436 keys as draft; glossary terms never translated;
  approval workflow recorded; build passes with drafts excluded until approved.

### M33 — Onboarding copilot
- **Goal:** Guided onboarding with district-crop auto-suggest (C7, flow 5.4).
- **Read first:** `website/src/views/onboarding/`, `backend/app/routers/reference.py`
  (geo, crops).
- **Steps:** village search / GPS → resolve via reference/geo; language
  suggestion from location; crops pre-selected from district mapping (spec has
  8 districts — extend via Gemini with agro-climatic grounding + admin-curated
  table); post-registration dashboard pre-seeded with scheme matches (M21) +
  starter course (M20).
- **Acceptance:** time-to-first-action < 60s in usability pass; suggestions
  overridable everywhere; entire flow works by touch only.

---

## 6. Website integration standards (all briefs)

- `website/src/lib/api/ai.ts` for AI-specific endpoints; module AI surfaces ride
  their existing API modules.
- Shared primitives (build in M2/M3, reuse everywhere): `<AiBadge>`
  (confidence-tinted "AI sujhav"), `<AiExplainSheet>` (cached Gemini why-line per
  `decision_id`), `<ConfidenceGate>` (high = preselected primary action; low =
  neutral options, no nudge), `<AiDraftBanner>` for photo-extracted drafts.
- Server-side caching: AI results on docs or Redis — model calls never triggered
  directly by page views.
- All AI text generated in the user's language server-side; labels via `t()`.

## 7. Testing & calibration (standing requirements)

- Golden datasets per question set at `backend/tests/fixtures/ai/golden/`; CI on
  shim, nightly on live models (regression alert on accuracy drop >5pts).
- Contract tests validating Jev responses against schemas (channel-drift guard).
- Weekly calibration job: accuracy, confidence-bucket reliability, fallback rate,
  cost per module → admin "AI Health" page.
- Threshold/automation edits via `platform_config/ai` = maker-checker + audit.
- Load test: gateway at 100 rps decisions; budget trip degrades cleanly.

## 8. Done-when (whole program)

Every active ID in ai.md §4 (A1–A13, B1–B17, C2–C20 excluding retired C1/C19) is
live behind flags or has a dated deferral note; all 14 persona dashboards are
AI-ranked; every flow in ai.md §5 works end-to-end on the website; AI spend
metered/capped; calibration reports running weekly; and the entire app passes its
test suite with `AI_PROVIDER=shim`.
