# Phase 08 — Experience AI, Scale & Launch — Build Instructions

> Self-contained execution sheet. Read `execution-plan/phase-08/readme.md` first.
> Global rules (execution-plan/README.md §3) apply to every workstream — the ones
> most at risk are repeated inline. This phase runs LAST: phases 00–07 exit gates
> must already be green. If a dependency is missing, stop and fix the earlier phase
> — do not stub around it here.
>
> **Verification standard for every AI brief (restate at each WS):**
> `cd backend && .venv/bin/python -m pytest -q` green ·
> `cd website && pnpm exec tsc --noEmit && pnpm build` green ·
> feature works with `AI_PROVIDER=shim`.

## Repo orientation

- Backend: FastAPI + Firestore — routers `backend/app/routers/`, services
  `backend/app/services/`, tests `backend/tests/`.
- AI foundation (from phase-00, brief M1): `backend/app/services/ai/` —
  `gateway.py` (`decide()`, `generate()`, `analyze_image()`, `embed()`),
  `question_sets.py`, `decision_log.py`, `outcomes.py`, `shim.py`, `budget.py`,
  `privacy.py`. Golden fixtures at `backend/tests/fixtures/ai/golden/<id>.jsonl`.
- Website: React + TS + Vite — API wrappers `website/src/lib/api/`, views
  `website/src/views/`, i18n `t()` in `website/src/lib/i18n/`, persona/module
  registry `website/src/lib/dashboard.ts`, routes in `website/src/App.tsx`.
  Shared AI primitives from earlier phases: `<AiBadge>`, `<AiExplainSheet>`,
  `<ConfidenceGate>`, `<AiDraftBanner>`; AI endpoints wrapper
  `website/src/lib/api/ai.ts`.
- Verified existing paths this phase builds on: `backend/app/routers/women.py`,
  `diary.py`, `offers.py`, `reference.py`, `notifications.py`,
  `services/diary_analytics.py`, `services/settlements.py`,
  `services/notifications.py`, `infra/firestore.indexes.json`,
  `website/src/views/onboarding/` (`LanguageSelect.tsx`, `ProfileDetails.tsx`,
  `ProfileSelect.tsx`, `FarmMap.tsx`), `website/src/views/diary/CashbookPage.tsx`,
  `website/src/views/legal/LegalPage.tsx`,
  `website/src/views/dashboard/DashboardHome.tsx`.
- Verify every additional path you cite exists (Glob/Read) before writing it
  down; paths from phases 00–07 that you consume but cannot find are blockers,
  not invitations to re-implement.

### Standard recipes (from ai_implementation_plan.md §3 — apply to every AI feature)

**SDR (Jev decision):** (1) register question set in `question_sets.py` (schema +
threshold + `fallback_fn`); (2) build state via a `privacy.py` builder
(pseudonymized via `HMAC(user_id, AI_HASH_SALT)`, ≤1,500 tokens target); (3)
`result = await gateway.decide(state, "<id>.v1", ctx)`; (4) act per automation
level — new features ALWAYS launch at `suggest` (annotate only); (5) on
exception/timeout/budget-trip → deterministic fallback, log with `fallbackUsed`;
(6) register an outcome hook; (7) tests: golden fixture on shim, fallback test
with gateway raising, flag-off test proving the module works without AI.

**SGR (Gemini generation):** `gateway.generate(prompt, model=lite|flash|pro,
json_schema=..., lang=user_lang)` → validate with a Pydantic model → one repair
retry → cache aggressively (per district-crop / per decision_id — NEVER per
page-view) → log cost → fallback = static template text in en/hi.

**Global rules most at risk in this phase:**
- Rule 10: all model calls through `services/ai/gateway.py` — never from routers.
- Rule 11: no Aadhaar (unmasked), phones, or emails in any AI payload; every call
  logged to `ai_decisions` with cost + confidence.
- Rule 12: automation `suggest → require_confirm → auto`; credit/insurance/legal
  never exceed `require_confirm`; new features launch at `suggest`.
- Rule 6: no hardcoded strings — `t()` with en+hi at ship time; no
  `alert()`/`prompt()`/`confirm()`; recommendations badged "AI sujhav".
- Rule 3: integer paisa everywhere; every financial mutation writes `audit_logs`.
- Rule 8: no admin action without `audit_logs` entry + reason (maker-checker for
  `platform_config/ai` edits and manual overrides > ₹10,000).

---

## WS-01 — Experience AI features (M26, M28, M29, M33)

**Source:** ai_implementation_plan.md §5 briefs M26, M28, M29, M33; ai.md §4.2 B16,
§4.3 C2/C7/C16/C17, flows 5.2/5.4; robust.md §7.12 · **Goal:** ship the four
experience-AI features on real phase-00–07 data, all suggest-level, all
flag-gated, all shim-green.

**Read first:** `backend/app/services/ai/question_sets.py`,
`backend/app/services/ai/gateway.py`, `backend/app/routers/women.py`,
`backend/app/routers/diary.py`, `backend/app/services/diary_analytics.py`,
`backend/app/routers/offers.py`, `backend/app/routers/reference.py`,
`backend/app/services/notifications.py`, `website/src/views/onboarding/`,
`website/src/views/diary/CashbookPage.tsx`, `website/src/lib/api/ai.ts`.

### M26 — SHG readiness (`women.shg_readiness.v1`)

1. Confirm phase-05 replaced the hardcoded SHG/garden data in
   `backend/app/routers/women.py` with real collections (SHG savings ledger,
   meeting workflow, home-enterprise income per robust.md §7.12). If hardcoded
   data remains, this feature is BLOCKED — M26 works only on real SHG data.
2. Register `women.shg_readiness.v1` in `question_sets.py`: questions
   `readiness` (score 0–1) and `gap` (choice with `criteria` covering e.g.
   `savings_regularity` / `meeting_attendance` / `enterprise_income` /
   `record_keeping`); set `confidence_threshold`, `automation_level: "suggest"`,
   deterministic fallback (rules: % meetings attended, savings streak, income
   entries last 90 days).
3. State builder via `privacy.py`: SHG pseudonymized ID, savings regularity,
   meeting attendance rate, enterprise income trend — no member names/phones.
4. Call site: SHG leader dashboard read → score + biggest gap + suggested next
   step; cache result on the SHG doc or Redis (never recompute per page view).
5. When `readiness` crosses the configured threshold, surface a link card to the
   loan marketplace (finance module, robust §7.8) — suggest-only, never an
   auto-application.
6. Website: readiness card in the women-hub SHG tab using `<AiBadge>` +
   `<AiExplainSheet>` showing the contributing factors (score must be
   explainable — factors rendered, not a bare number); en/hi via `t()`.
7. Outcome hook: SHG subsequently applies for a loan → `record_outcome`.
8. Tests: golden fixture `backend/tests/fixtures/ai/golden/women.shg_readiness.v1.jsonl`;
   fallback + flag-off tests.

**Acceptance (M26):** works only on real SHG data; score explainable (factors
shown in UI); suggest-only annotations; loan-marketplace link appears only past
threshold; shim green.

### M28 — Receipt/weigh-slip diary scan (C2) + churn signals (`churn.signal.v1`)

1. **Receipt scan (SGR + vision):** photo upload from the diary/Cashbook UI →
   Firebase Storage signed URL → `gateway.analyze_image()` with a Pydantic JSON
   schema `{amount_paisa, category, party, date, entry_type: expense|income}` →
   one repair retry → prefilled diary-entry form.
2. The prefill is CONFIRM-ONLY: diary totals and `diary_analytics` must be
   unchanged until the user taps save. Render `<AiDraftBanner>` on the prefilled
   form; all labels en/hi.
3. Vyapari/transporter reuse: the same extraction path serves weigh-slip
   auto-fill in procurement entries and weighbridge-slip reads into trip records
   (flows 5.5/5.6) — wire only if those surfaces from phases 02/03 expose the
   hook; otherwise note it in the deferral ledger.
4. Golden receipt set at `backend/tests/fixtures/ai/golden/receipt_scan/`
   (images + expected fields): ≥85% field accuracy required.
5. **Churn (SDR):** register `churn.signal.v1` — `churn_risk` (score),
   `best_hook` (choice e.g. `mandi_price_move` / `pending_offer` /
   `new_scheme` / `course_reminder`); fallback = inactivity-days rules.
6. Nightly job over activity recency: only users dormant ≥7 days are scored;
   `churn_risk` above threshold → emit a re-engagement task via `emit_task()`
   and a notification through the M7 dispatch path (`notify.timing.v1` +
   `notify.copy.v1`, quiet hours 21:00–06:30 respected).
7. Outcome hook: user returns within 72h of the re-engagement touch →
   `record_outcome`.

**Acceptance (M28):** ≥85% golden field accuracy; diary totals unchanged until
user confirms; churn tasks only for users dormant ≥7 days; nothing sent when the
module flag is off.

### M29 — Farmer standing agent (C17, `agent.rule_match.v1`)

> Hard cap: NOTHING auto-executes in v1. Every rule fire ends in a one-tap
> confirm by the user, executed via existing endpoints. This is rule 12 applied
> at its strictest.

1. New collection `agent_rules`: `{ruleId, userHash, module, condition, action,
   max_value_paisa, active, createdAt, lastFiredAt}` (`userHash` =
   `HMAC(user_id, AI_HASH_SALT)`; keep the real uid only on the server-side
   ownership field per existing auth patterns — never in AI payloads).
2. Rule creation: guided form with vernacular examples ("₹1,800 se upar offer
   aaye toh accept kar do") → `gateway.generate()` parses to the structured rule
   (Pydantic validation, one repair retry) → user reviews the parsed rule in
   plain en/hi language and confirms before `active: true`.
3. Register `agent.rule_match.v1`: `rule_fires` (bool), `rule_id` (choice over
   the user's active rules for the module); fallback = direct numeric/string
   comparison of the parsed `condition` against the event payload.
4. Evaluation: on relevant events (new offer on the user's lot, rate postings,
   etc. — start with offers per the brief), Jev evaluates each active rule
   against the event state. On fire: emit a task via `emit_task()` with an
   explicit confirm button; the confirm calls the EXISTING endpoint (e.g. offer
   accept on `routers/offers.py`) with normal auth + idempotency — no privileged
   agent write path.
5. Guardrails: `max_value_paisa` ceiling enforced server-side; pause/delete
   rules from a management view; every fire + outcome written to `audit_logs`
   (ruleId, decision_id, user action) and `ai_decisions`.
6. Website: rules list (active/paused), fire-notification task card with
   confirm/dismiss, audit history view; all en/hi.
7. Tests: "₹1800 se upar accept" fires only on qualifying offers (boundary
   tests at exactly ₹1,800); paused rule never fires; nothing executes without
   the tap (assert no state change on fire alone).

**Acceptance (M29):** boundary-correct firing; pause/delete works; full audit
trail (fire → confirm/dismiss → outcome); zero auto-execution paths in code
review; shim green.

### M33 — Onboarding copilot (C7, flow 5.4)

1. Village search / GPS grant in `website/src/views/onboarding/` → resolve via
   `backend/app/routers/reference.py` geo endpoints → language suggestion from
   resolved location (pre-select in `LanguageSelect.tsx`, user-overridable).
2. District-crop pre-selection: the spec's region-crop mapping covers 8
   districts — extend coverage via Gemini (agro-climatic grounding prompt) into
   an **admin-curated table** (new collection, e.g. `district_crops`, editable
   in the admin console with `audit_logs` + reason). AI proposes, admin
   disposes; never serve raw Gemini output to users.
3. Pre-select the resolved district's crops in `ProfileDetails.tsx`; every
   suggestion overridable.
4. Post-registration: pre-seed the new user's dashboard with scheme matches
   (M21 `schemes.match.v1` output from phase-05) + one starter course
   (M20 `courses.recommend.v1`) so the first dashboard is already populated
   (flow 5.4 step 4).
5. KYC-lite step: Jev/rules decide which docs the chosen personas need →
   checklist tasks emitted via `emit_task()`.
6. The entire flow must work by touch only (steppers, taps, GPS) — no required
   typing; measure time-to-first-action.

**Acceptance (M33):** time-to-first-action <60s in a usability pass; suggestions
overridable everywhere; touch-only completion; district-crop extensions come
from the admin-curated table, not live Gemini calls at registration time.

**WS-01 Verification:**
```bash
cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q
cd website && pnpm exec tsc --noEmit && pnpm build
```
Manual flows (staging, flags on): SHG leader sees readiness card with factors →
loan link past threshold; snap a receipt → prefilled diary form → confirm →
entry appears; dormant test user (≥7 days) gets a re-engagement task next
morning; create "₹1800 se upar accept" rule → qualifying offer arrives → task
with confirm → tap → offer accepted via the normal endpoint → audit trail
visible; register a fresh account with GPS → language + crops pre-selected →
dashboard pre-seeded in <60s. Repeat the SHG and agent flows with the module
flags off to prove graceful degradation.

---

## WS-02 — Automation raises & calibration (rollout phase G)

**Source:** ai_implementation_plan.md §4 (phase G gate), §7 (standing
requirements); ai.md §7 (trust/calibration), §6.1 (cost envelope) · **Goal:**
turn calibration from a plan into a running machine, and gate every automation
raise on evidence.

**Read first:** `backend/app/services/ai/outcomes.py`,
`backend/app/services/ai/decision_log.py`, `backend/app/services/ai/budget.py`,
`backend/app/services/ai/question_sets.py`, `backend/tests/fixtures/ai/golden/`,
the phase-07 admin "AI Health" page surface, `platform_config/ai` admin editor.

**Steps:**
1. **Phase-G gate enforcement.** Any change raising a question set from
   `suggest → require_confirm` in `platform_config/ai` must be refused by the
   admin editor unless: (a) ≥1,000 logged outcomes for that set, (b) >90%
   top-bucket accuracy in the latest calibration report, (c) maker-checker
   approval (second admin) + `audit_logs` entry with reason. Credit/insurance/
   legal sets (`loans.prescreen.v1`, `insurance.triage.v1`, dispute/legal
   surfaces) stay hard-capped at `require_confirm` — the editor must not offer
   `auto` for them (rule 12). Nothing in this program raises to `auto`.
2. **Golden datasets.** Ensure every shipped question set has
   `backend/tests/fixtures/ai/golden/<id>.jsonl`. Wire two runs: CI on shim
   (every merge) and a nightly job on live models; accuracy drop >5 points vs
   the trailing baseline → alert (Sentry + admin AI Health page banner).
3. **Contract tests.** Add tests validating live Jev responses against the
   registered schemas (channel-drift guard: OpenRouter schema vocabulary changes
   must fail CI/nightly loudly, not silently fall back).
4. **Weekly calibration job** (standing): per question set — accuracy,
   confidence-bucket reliability, fallback rate, cost per module → admin
   "AI Health" page. Verify it has run every week; backfill if gaps.
5. **Gateway load test.** 100 rps of `decide()` calls against staging; at
   budget trip (set `AI_DAILY_BUDGET_USD` low) the gateway must degrade to
   deterministic fallbacks with `fallbackUsed` logged — zero 5xx, no caller
   exceptions (budget caps degrade, never error — ai.md §7.5).
6. **AI spend review vs ai.md §6.1 envelope.** Pull per-model daily cost from
   `ai_decisions`/Redis counters (`ai:cost:<model>:<yyyymmdd>`); extrapolate to
   the 100k DAU × ~40 decisions/user/day envelope (~$134/day Jev at $0.042/M
   tokens — verify live OpenRouter/Gemini rates, noting the reported 10× pricing
   discrepancy). Apply the two named optimizations where the projection exceeds
   budget: state-trimming (≤1,500-token target per `privacy.py`) and batched
   questions (multiple questions per Jev call, ≤10 tasks per `tasks.rank.v1`
   batch). Confirm OpenRouter-side spend caps are set as backstop.

**Acceptance:** raise without evidence is refused by the editor (test it);
golden sets run in CI + nightly with alerting proven (force a >5pt regression
in a test set); contract test catches an injected schema violation; 100 rps
load test passes with clean budget-trip degradation; AI Health page shows 4+
weekly reports; spend projection documented against the §6.1 envelope with
optimizations applied.

**Verification:**
```bash
cd backend && .venv/bin/python -m pytest -q -k "calibration or contract or golden"
# load test (staging):
locust -f backend/tests/load/ai_gateway_locustfile.py --headless -u 100 -r 20 -t 3m  # or the repo's chosen load tool
```
Manual: attempt a `suggest → require_confirm` raise on a set with <1,000
outcomes → refused; repeat on a qualifying set with maker-checker → succeeds
with audit entry.

---

## WS-03 — B2B API platform (G11)

**Source:** robust.md §8.9 item 9, §1 revenue row R7 · **Goal:** API keys +
scoped read endpoints for partners — aggregated, consented, anonymized
mandi/saturation intelligence — with usage metering and billing hooks.

**Read first:** `backend/app/routers/mandi.py`, `backend/app/routers/advisory.py`
(saturation), `backend/app/core/deps.py` (auth patterns), the phase-06 consent
center (`backend/app/services/consents.py` + consent center UI), billing module
from phase-00.

**Steps:**
1. **Gate:** consent center must be proven (phase-06 exit) — partner data
   products serve only aggregated, anonymized rows; no user-level data ever
   leaves via this API. Verify consent coverage of the underlying signals
   (e.g. saturation opt-in per robust §7.2) before exposing aggregates.
2. New router (e.g. `backend/app/routers/partner_api.py` (new)): API-key auth
   (keys collection `{keyId, partnerId, scopes, rateLimit, createdAt, revokedAt}`,
   key shown once at creation, stored hashed); scopes like `mandi:read`,
   `saturation:read`.
3. Scoped read endpoints: mandi price series/aggregates (`GET /v1/partner/mandi/
   prices?crop=&district=&from=&to=`) and saturation insights (`GET /v1/partner/
   advisory/saturation?district=&crop=`) — district/crop-level aggregates only,
   with minimum cohort sizes (suppress buckets below a k-anonymity floor, e.g.
   k=5).
4. Standard platform conventions apply (rule 7): error envelope
   `{"error":{code,...}}`, cursor pagination, per-key rate limiting (Redis token
   bucket, from phase-00).
5. Usage metering: per-key request counters (Redis daily + Firestore monthly
   rollups); partner billing hooks — emit metered-usage records the phase-00
   billing module can invoice (Enterprise-tier adjacency; pricing itself is a
   business decision — wire the hook, don't invent prices).
6. Admin: partner key management (issue/revoke) in the admin console with
   `audit_logs` + reason (rule 8); usage dashboard per partner.
7. Website: none required beyond admin; a short partner-facing docs page
   (en/hi) describing scopes and endpoints.

**Acceptance:** a partner key can read mandi + saturation aggregates and nothing
else (negative test: user-level endpoint with partner key → 403); revoked key
fails immediately; usage counters increment and appear in admin; suppressed
small cohorts return no rows.

**Verification:** `pytest` (new partner_api tests) + manual curl of both
endpoints with a staging key; confirm consent-center linkage documented in the
DPDP audit (WS-05).

---

## WS-04 — Performance & cost hardening

**Source:** robust.md §11 Phase 6 row, §8.6 (PWA bundle diet), §3.6 (pagination/
indexes); ai_implementation_plan.md §6 (server-side caching standard), §1.1
(`ai_decisions` 90-day TTL) · **Goal:** prove the platform is fast and cheap at
beta scale.

**Read first:** `infra/firestore.indexes.json`, `backend/app/core/db.py`
(query/cursor helpers), `backend/app/services/ai/decision_log.py`,
`website/vite.config.*`, `website/src/App.tsx` (route-level `React.lazy`),
`backend/app/routers/offers.py`, orders/checkout routers, tasks router (phase-01).

**Steps:**
1. **Firestore cost audit:** enumerate every shipped query (routers + jobs);
   cap any unbounded scan (admin/analytics list endpoints must have cursor
   pagination + max page size — rule 7); verify `infra/firestore.indexes.json`
   contains a composite index for every shipped compound query (deploy to
   staging and exercise each screen, watching for index-missing errors).
2. **`ai_decisions` lifecycle:** 90-day TTL with export to cold storage
   (GCS bucket or BigQuery) before deletion — the calibration dataset is the
   moat, so export-then-expire, never just delete (ai.md §7.1 +
   ai_implementation_plan.md §1.1).
3. **Website bundle audit:** route-level `React.lazy` everywhere; measure first
   load <400 KB (gzipped) on the dashboard route; move heavy rarely-used views
   behind dynamic imports; record the number in the launch checklist.
4. **Backend load tests** on critical paths: `GET /v1/tasks/summary`, offers
   list/detail, checkout (payment order creation) — define p95 latency targets
   (e.g. p95 < 500 ms for reads at 50 rps on staging) and pass them; fix N+1
   Firestore patterns found.
5. **AI caching review:** grep/audit that no AI model call is triggered
   directly by a page view — results must come from docs or Redis (cached per
   district-crop / per decision_id per the SGR recipe). Fix violations by
   moving the call to a write-path or nightly job.

**Acceptance:** zero index-missing errors on a full staging click-through; no
endpoint returns an unbounded list; `ai_decisions` TTL + export job proven
(documents >90 days exported then gone); first-load bundle <400 KB measured and
recorded; load-test report attached to the launch checklist; AI-caching audit
clean.

**Verification:**
```bash
cd website && pnpm build && ls -la dist/assets/   # first-load chunk size
cd backend && .venv/bin/python -m pytest -q
# load tests (staging) for tasks/summary, offers, checkout — repo's chosen tool
```

---

## WS-05 — Compliance & launch readiness

**Source:** robust.md §3.1 (backdoors), §3.6 (Sentry/secrets/CORS), §8.4 (consent/
legal), §10 (pricing shelf); ai.md §7.4 (DPDP) · **Goal:** pass the audits that
make "production-ready beta" a claim with evidence.

**Read first:** `backend/app/main.py` (CORS), `backend/app/core/config.py`,
`backend/app/routers/auth.py`, `backend/app/services/payments.py`,
`backend/app/services/settlements.py`, billing/entitlements module (phase-00),
`backend/app/services/ai/privacy.py`, `backend/app/services/consents.py`,
`website/src/views/legal/LegalPage.tsx`.

**Steps:**
1. **DPDP audit (incl. AI):** verify payload minimization/pseudonymization —
   hashed IDs (`HMAC(user_id, AI_HASH_SALT)`), no phones/emails/unmasked Aadhaar
   in any AI payload (rule 11; grep the state builders), photos only to vision
   endpoints, retention disabled at providers where supported, AI disclosure
   present in the consent center. Verify consent coverage for every data use
   (incl. saturation opt-in and the WS-03 B2B aggregates) and that DPDP export
   + account deletion flows work end-to-end from the website. Write the audit
   report into the launch checklist evidence.
2. **Security sweep:** with `APP_ENV=prod`, grep + runtime-verify every phase-00
   backdoor is dead: MPIN `1234` bypass, `dev-`/`demo-` token acceptance,
   `/auth/quick-login` hardcoded accounts, Razorpay signature `"dev"`,
   `rzp_test_dev` fallback, hardcoded JWT default secret (startup must fail if
   unset in prod). CORS locked to real web origins per environment (no `["*"]`).
   Secrets sourced from GCP Secret Manager (no secrets in repo/env files
   committed). Sentry on backend + website with alert rules firing (trigger a
   test error on staging and confirm the alert).
3. **TDS/GST verification:** run a weekly settlement on staging with real
   Razorpay/RazorpayX keys; verify the per-transaction TDS 194-O ledger entries
   and GST invoices (vyapari sales + platform commission invoices to business
   personas) generate correctly, amounts in integer paisa, every mutation in
   `audit_logs` (rule 3).
4. **Legal pages localized:** `website/src/views/legal/LegalPage.tsx` and any
   hardcoded legal copy → `t()` keys with en + hi (X18); run the locale parity
   check.
5. **Pricing shelf validation (robust.md §10):** for every business persona,
   prove entitlements enforce the tier matrix and the upgrade→pay→unlock loop
   works (phase-00 billing + phase-03/04/05 surfaces). Tiers to verify:

   | Persona | Free | Pro (₹/mo) | Enterprise | Commission (always) |
   |---|---|---|---|---|
   | Farmer | everything core — never paywalled (rule 5) | — | — | 0% |
   | Landlord | 1 plot/1 lease | 299 | custom | — |
   | Transporter | 1 vehicle | 499 | fleet/API | 10% |
   | Vyapari | basic khata | 999 | multi-shop | 2% min ₹50 |
   | Equipment Owner | 1 machine | 399 | fleet | 12% |
   | Broker | 5 deals | 799 | — | 2% (0–10 configurable) |
   | Dairy Manager | 25 members | 1,499 | union | 3% milk / 5% produce / 2% livestock |
   | Instructor | 1 course | 499 | institution | 15–20% course GMV |
   | Direct Buyer | 1 contract | 4,999 | 24,999 | 1–2% settlement |
   | e-Market Customer | full | business invoicing | — | 5% seller-side |
   | Bank/Insurance/Cold Storage | — | console seats 2,000/seat | custom | origination/processing fees |

   For each: hit a Free-tier limit → upgrade prompt → Razorpay subscription
   payment (staging keys) → entitlement unlock observed in the API response and
   UI. Verify commission config lives in `platform_config/settlements`,
   effective-dated/versioned, admin-editable with maker-checker.

**Acceptance:** DPDP audit report signed; backdoor grep returns nothing with
`APP_ENV=prod`; CORS rejects a foreign origin; Sentry test alert received;
staging settlement run produces correct TDS ledger + GST invoices; legal pages
render fully in hi; every persona row in the §10 matrix has a proven
upgrade→pay→unlock recording/note.

**Verification:**
```bash
cd backend && APP_ENV=prod .venv/bin/python -m pytest -q
grep -rn "1234\|quick-login\|rzp_test_dev\|'dev'" backend/app/ --include="*.py"  # expect only gated dev paths
cd website && pnpm exec tsc --noEmit && pnpm build   # + locale parity check
```
Manual: one full staging settlement run; one upgrade→pay→unlock per business
persona.

---

## WS-06 — Beta launch checklist & deferral ledger

**Source:** robust.md §13 rule 10, §11 demo-cut; execution-plan/README.md §5;
ai_implementation_plan.md §8; ai.md §5 · **Goal:** nothing silent, everything
signed — the final acceptance.

**Read first:** `execution-plan/README.md` §5 (Definition of production-ready
beta), ai_implementation_plan.md §8 (done-when), ai.md §4 (catalog) + §5 (flows
5.1–5.10), robust.md §6/§7 (personas/modules), all phase readme.md exit gates.

**Steps:**
1. **Rule-10 deferral sweep.** Walk three lists and mark every entry SHIPPED
   (link to evidence) or DEFERRED (explicit dated note, in writing): (a)
   robust.md §6.1–6.14 personas + §7.1–7.24 modules; (b) ai.md §4 catalog
   A1–A13, B1–B17, C2–C20 (C1/C19 retired, M27 retired — record as such);
   (c) every workstream of phases 00–07. Known deferral candidates to adjudicate
   explicitly: C18 WhatsApp companion (post-DLT/template approval), streaming
   infra beyond embedded licensed streams (X16), Mahabhulekh/e-District real
   adapter, carbon MRV integration, BNPL partner integration. Silence is a
   failure — an unlisted item fails the gate.
2. **Ops runbook:** write (in the repo's docs convention) deploy steps
   (backend + website + Firestore indexes/rules), rollback steps, on-call
   rotation + alert routing (Sentry → who), kill-switch procedure for AI
   modules (`platform_config/ai` flags) and budget caps. Rehearse one rollback
   on staging.
3. **Demo-cut rehearsal (robust.md §11):** run the investor narrative live on
   staging, end-to-end, zero offline steps: farmer posts a lot → vyapari pays
   via escrow → transporter delivers with POD (handover OTP release) →
   commission settles to platform in the weekly run → dashboard shows the whole
   story as completed tasks → dairy manager upgrades to Pro (R1 + R2 + R3 in
   one narrative). Script it, time it, record it.
4. **Flows 5.1–5.10 final validation (ai.md §5):** exercise each flow on the
   website end-to-end: 5.1 farmer morning (ranked dashboard + hero card), 5.2
   AI-assisted sell (prefill → badges → coach → OTP → diary), 5.3 disease
   emergency (gate → vision → expert handoff), 5.4 onboarding (<60s), 5.5
   transporter day, 5.6 vyapari morning (band warning inline), 5.7 bank queue
   (AI sorts, human decides), 5.8 insurance claim (instant feedback → tracker),
   5.9 landlord lease, 5.10 admin ops morning (copilot briefing → deep links).
5. **README §5 sign-off** — check every item with evidence:
   - [ ] All 8 phase exit gates passed; every persona runs its core loop
     end-to-end on the website with zero offline steps.
   - [ ] All 24 modules resolve to real pages — zero "coming soon" tiles in the
     tools launcher; global search live.
   - [ ] Real money: Razorpay order/verify/webhook, escrow release on handover
     OTP, weekly RazorpayX payouts, TDS 194-O ledger, GST invoices — exercised
     in staging with real API keys (WS-05 evidence).
   - [ ] SaaS billing live; upgrade prompt → paid subscription → entitlement
     unlock proven per business persona tier matrix (WS-05 evidence).
   - [ ] AI: every active catalog ID live behind flags or dated-deferred; all
     persona dashboards AI-ranked; `ai_decisions` logging + budgets + weekly
     calibration running; suite green with `AI_PROVIDER=shim`.
   - [ ] Admin console: 27 superadmin modules operational with RBAC, audit
     logs, maker-checker; KYC queue real.
   - [ ] Cross-cutting: chat hub with guardrails, push with deep links, consent
     center + DPDP export/deletion, installable PWA, en/hi parity gate in CI,
     analytics taxonomy live.
   - [ ] Hardening: no demo backdoor with `APP_ENV=prod`; CORS locked; Sentry
     on backend + website; load test passed; DPDP audit done; launch checklist
     signed off.

**Acceptance:** deferral ledger complete (every item shipped or dated-deferred);
runbook written + rollback rehearsed; demo-cut recorded end-to-end; all ten
flows 5.1–5.10 validated; README §5 checklist signed item by item with evidence
links.

**Verification:** this WS IS the final verification — see Phase-final below.

---

## Phase-final verification

```bash
# 1. Backend suite fully green — shim and prod-config both
cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q
cd backend && APP_ENV=prod AI_PROVIDER=shim .venv/bin/python -m pytest -q

# 2. Website clean + bundle budget
cd website && pnpm exec tsc --noEmit && pnpm build
#    confirm first-load JS < 400 KB (gzipped) from dist/assets output

# 3. Locale parity gate (en/hi key parity — CI gate from phase-06)

# 4. Load tests green (staging): AI gateway 100 rps decisions with clean
#    budget-trip degradation; tasks/summary, offers, checkout within p95 targets

# 5. Nightly golden-set run (live models) green; weekly calibration report
#    present on the admin AI Health page
```

Manual final pass (staging, all flags on, then repeated with `AI_PROVIDER=shim`):
- The investor demo-cut from WS-06 step 3, start to finish, recorded.
- Flows 5.1–5.10 each exercised from dashboard task deep-link to completion —
  no "coming soon" reachable anywhere.
- One end-to-end user flow per workstream of THIS phase: SHG readiness card,
  receipt-scan confirm, churn re-engagement, standing-agent rule fire → confirm,
  onboarding <60s, partner API key call, upgrade→pay→unlock.
- execution-plan/README.md §5 checklist signed item by item;
  ai_implementation_plan.md §8 done-when signed item by item; deferral ledger
  attached.
