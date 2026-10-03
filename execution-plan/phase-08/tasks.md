# phase-08 — Task Queue
> Executor: read `execution-plan/AGENT_PLAYBOOK.md` first. Execute tasks top to
> bottom, one at a time. Mark [x] only when EXPECT matches real output.
> Full context for any task: see `instructions.md` WS-NN referenced in the task.

## WS-01 — Experience AI features (M26, M28, M29, M33)  (see instructions.md §WS-01)

### Task 1.1 — Verify phase-00 AI foundation exists
- DO: nothing (read-only check). This confirms the phase-00 deliverables this phase builds on.
- RUN: `test -f backend/app/services/ai/gateway.py && test -f backend/app/services/ai/question_sets.py && test -f backend/app/services/ai/privacy.py && test -f backend/app/services/ai/outcomes.py && test -f backend/app/services/ai/budget.py && test -f backend/app/services/ai/decision_log.py && test -d backend/tests/fixtures/ai/golden`
- EXPECT: exit 0.
- IF FAIL: none — STOP the phase (playbook §5); phase-00 deliverable missing.
- [ ]

### Task 1.2 — Verify phase-01/05/06/07 surfaces exist
- DO: nothing (read-only check). Confirms the task engine (`emit_task`), website AI primitives, and AI API wrapper from earlier phases.
- RUN: `grep -rn "def emit_task" backend/app/ && grep -rln "AiBadge" website/src/ && grep -rln "AiExplainSheet" website/src/ && grep -rln "AiDraftBanner" website/src/ && test -f website/src/lib/api/ai.ts`
- EXPECT: exit 0 with at least one match per grep.
- IF FAIL: none — STOP the phase (playbook §5); an earlier-phase deliverable is missing.
- [ ]

### Task 1.3 — Confirm women.py uses real SHG data
- DO: read `backend/app/routers/women.py` and confirm phase-05 replaced hardcoded SHG/garden data with real collections (SHG savings ledger, meeting workflow, home-enterprise income). M26 is BLOCKED on hardcoded data.
- RUN: `grep -n "shg" backend/app/routers/women.py | head -30`
- EXPECT: matches reference Firestore collection reads/writes (e.g. `.collection(` usage for SHG docs), not hardcoded sample list/dict literals of SHG data.
- IF FAIL: none — STOP the phase (playbook §5) and report that phase-05 WS (robust §7.12) is incomplete.
- [ ]

### Task 1.4 — Register women.shg_readiness.v1 question set
- PRECONDITION: task 1.1 passed.
- DO: edit `backend/app/services/ai/question_sets.py` — read it first and follow the existing registration pattern exactly. Register `women.shg_readiness.v1` with: questions `readiness` (score 0–1) and `gap` (choice with `criteria` = `savings_regularity` / `meeting_attendance` / `enterprise_income` / `record_keeping`); a `confidence_threshold` matching the file's existing convention; `automation_level: "suggest"` (rule 12 — new features always launch at suggest); a deterministic `fallback_fn` computing from rules: % meetings attended, savings streak, income entries in last 90 days.
- RUN: `cd backend && .venv/bin/python -c "import app.services.ai.question_sets" && grep -q "women.shg_readiness.v1" app/services/ai/question_sets.py`
- EXPECT: exit 0.
- IF FAIL: fix the syntax/registration error shown, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 1.5 — Add SHG readiness state builder
- DO: edit `backend/app/services/ai/privacy.py` — read it first, follow the existing builder pattern. Add `build_shg_readiness_state(shg_id)` returning `{shgHash: HMAC(shg_id, AI_HASH_SALT), savings_regularity, meeting_attendance_rate, enterprise_income_trend}` — pseudonymized ID only, NO member names, phones, or emails (rule 11); keep state ≤1,500 tokens.
- RUN: `cd backend && .venv/bin/python -c "from app.services.ai.privacy import build_shg_readiness_state"`
- EXPECT: exit 0.
- IF FAIL: fix the import error shown, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 1.6 — Create SHG readiness service
- DO: create `backend/app/services/shg_readiness.py` (new) with `async def get_shg_readiness(shg_id)`: build state via `build_shg_readiness_state(shg_id)`; `result = await gateway.decide(state, "women.shg_readiness.v1", ctx)` (rule 10 — gateway only, never a direct model call); cache the result on the SHG doc or in Redis (never recompute per page view); on exception/timeout/budget-trip call the registered deterministic fallback and log with `fallbackUsed`. Return score + biggest gap + suggested next step.
- RUN: `cd backend && .venv/bin/python -c "from app.services.shg_readiness import get_shg_readiness"`
- EXPECT: exit 0.
- IF FAIL: fix the import error shown, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 1.7 — Wire readiness into SHG leader dashboard read
- DO: edit `backend/app/routers/women.py` — in the SHG leader dashboard read endpoint, include the cached readiness result from `services/shg_readiness.py` (score + biggest gap + suggested next step) in the response.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_women.py -q`
- EXPECT: all tests pass, exit 0.
- IF FAIL: read the failing assertion, fix the wiring (never weaken the test), re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 1.8 — Add loan-marketplace link card past threshold
- DO: edit `backend/app/routers/women.py` (or the service response shape in `backend/app/services/shg_readiness.py`): when `readiness` crosses the configured threshold, include a suggest-only link card payload pointing to the loan marketplace (finance module). Never an auto-application — annotation only.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_women.py -q`
- EXPECT: all tests pass, exit 0.
- IF FAIL: fix the code, re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 1.9 — Record SHG loan-application outcome hook
- DO: find where an SHG applies for a loan (read `backend/app/routers/loans.py` / finance module call path) and add a `record_outcome` call (from `backend/app/services/ai/outcomes.py`) keyed to `women.shg_readiness.v1` with the SHG's decision_id.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_loans.py -q`
- EXPECT: all tests pass, exit 0.
- IF FAIL: fix the hook placement, re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 1.10 — Create SHG readiness golden fixture
- DO: read one existing file in `backend/tests/fixtures/ai/golden/` to copy its exact JSONL format, then create `backend/tests/fixtures/ai/golden/women.shg_readiness.v1.jsonl` (new) with shim-deterministic cases covering: high readiness, low readiness, and each `gap` criterion value.
- RUN: `.venv/bin/python -c "import json;[json.loads(l) for l in open('backend/tests/fixtures/ai/golden/women.shg_readiness.v1.jsonl') if l.strip()]"` (from `backend/` use `.venv/bin/python`; path relative to repo root)
- EXPECT: exit 0 (every line parses as JSON).
- IF FAIL: fix the malformed JSONL line shown, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 1.11 — Write SHG readiness tests
- DO: create `backend/tests/test_shg_readiness.py` (new) — read an existing AI test from an earlier phase first (e.g. `grep -rln "golden" backend/tests/`) and copy its pattern. Tests: (1) golden fixture passes on shim; (2) fallback test with the gateway raising — deterministic fallback returned and `fallbackUsed` logged; (3) flag-off test — module works without AI; (4) loan-marketplace link present only past threshold.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_shg_readiness.py -q`
- EXPECT: all tests pass, exit 0.
- IF FAIL: fix the code (never the test assertions), re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 1.12 — Add SHG readiness website API wrapper
- DO: locate the women-hub API wrapper from phase-05 with `grep -rln "women\|shg" website/src/lib/api/` (if nothing found → STOP, phase-05 deliverable missing). Add `getShgReadiness(shgId: string)` calling the backend endpoint wired in task 1.7, following the file's existing wrapper style. No `?? <number>` fallbacks anywhere (hard rule 3).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the type error shown, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 1.13 — Build SHG readiness card UI
- DO: locate the women-hub SHG tab view from phase-05 with `grep -rln "shg" website/src/views/` (if nothing → STOP). Add a readiness card using `<AiBadge>` + `<AiExplainSheet>` that renders the contributing factors (`savings_regularity`, `meeting_attendance`, `enterprise_income`, `record_keeping`) — factors rendered, never a bare number. Show the loan-marketplace link card only when the response says the threshold was crossed. All user-facing strings via `t()` (rule 6); no `alert()`/`confirm()`; badge the recommendation per the existing "AI sujhav" convention.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the type error shown, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 1.14 — Add SHG readiness i18n keys
- DO: add every new `t()` key used in task 1.13 (e.g. `shgReadiness.title`, `shgReadiness.factors.savings_regularity`, `shgReadiness.factors.meeting_attendance`, `shgReadiness.factors.enterprise_income`, `shgReadiness.factors.record_keeping`, `shgReadiness.loanCta`) to BOTH `website/src/lib/i18n/locales/en.ts` and `website/src/lib/i18n/locales/hi.ts`, following the files' existing key structure.
- RUN: `for k in shgReadiness; do grep -q "$k" website/src/lib/i18n/locales/en.ts && grep -q "$k" website/src/lib/i18n/locales/hi.ts; done && cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0 (key present in both locale files; types clean).
- IF FAIL: add the missing key to the missing locale file, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 1.15 — Add receipt-scan endpoint to diary router
- PRECONDITION: `test -f backend/app/routers/diary.py` — if this fails, STOP the phase (playbook §5).
- DO: edit `backend/app/routers/diary.py` — add `POST /v1/diary/receipt-scan` accepting `{storage_path}` (a Firebase Storage path the client already uploaded via signed URL). Define a Pydantic model `ReceiptScanResult` with fields `{amount_paisa: int, category: str, party: str, date: str, entry_type: Literal["expense", "income"]}` (money is integer paisa — rule 3, no floats). Call `gateway.analyze_image()` with that JSON schema, allow exactly one repair retry, and return the parsed prefill payload. The endpoint MUST NOT write any diary entry — extraction/prefill only (confirm-only). Failure returns the `{"error":{code,...}}` envelope (rule 7).
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_diary.py -q`
- EXPECT: all tests pass, exit 0.
- IF FAIL: fix the code, re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 1.16 — Create golden receipt fixture set
- DO: create directory `backend/tests/fixtures/ai/golden/receipt_scan/` (new) containing sample receipt/weigh-slip fixture images plus one expected-fields JSON per image matching the `ReceiptScanResult` shape from task 1.15. Follow any existing image-fixture convention in `backend/tests/fixtures/`.
- RUN: `test -d backend/tests/fixtures/ai/golden/receipt_scan && ls backend/tests/fixtures/ai/golden/receipt_scan/ | wc -l`
- EXPECT: exit 0 and a count ≥ 6 (at least 3 image+JSON pairs).
- IF FAIL: add the missing fixture files, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 1.17 — Write receipt-scan tests
- DO: create `backend/tests/test_receipt_scan.py` (new): (1) golden field accuracy ≥85% across the fixture set on shim; (2) confirm-only test — diary totals and `diary_analytics` output unchanged after calling the scan endpoint (no entry created until save); (3) flag-off test — endpoint refuses/degrades per the module-flag convention when the AI flag is off.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_receipt_scan.py -q`
- EXPECT: all tests pass, exit 0.
- IF FAIL: fix the code (never the test assertions), re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 1.18 — Add receipt-scan website API wrapper
- DO: edit `website/src/lib/api/diary.ts` — add `scanDiaryReceipt(storagePath: string)` calling `POST /v1/diary/receipt-scan`, returning the typed prefill payload (`amount_paisa`, `category`, `party`, `date`, `entry_type`). No `?? <number>` fallbacks.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the type error shown, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 1.19 — Wire receipt upload into CashbookPage
- PRECONDITION: `test -f website/src/views/diary/CashbookPage.tsx` — if this fails, STOP the phase (playbook §5).
- DO: edit `website/src/views/diary/CashbookPage.tsx` — add a receipt photo upload control: upload to Firebase Storage via the repo's existing storage helper (locate with `grep -rln "getStorage\|uploadBytes\|signed" website/src/lib/ website/src/views/` — if none exists → STOP), call `scanDiaryReceipt`, and prefill the diary-entry form with the result. Render `<AiDraftBanner>` on the prefilled form. Diary totals must remain unchanged until the user taps save. All labels via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the type error shown, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 1.20 — Add receipt-scan i18n keys
- DO: add every new `t()` key from task 1.19 (upload button, prefill banner, field labels) to BOTH `website/src/lib/i18n/locales/en.cashbook.ts` and `website/src/lib/i18n/locales/hi.cashbook.ts`.
- RUN: `cd website && pnpm exec tsc --noEmit && git diff --stat src/lib/i18n/locales/en.cashbook.ts src/lib/i18n/locales/hi.cashbook.ts | grep -q cashbook`
- EXPECT: exit 0 (both locale files modified, types clean).
- IF FAIL: add the missing keys to the missing file, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 1.21 — Adjudicate vyapari/transporter scan reuse
- DO: check whether the phases-02/03 procurement-entry and trip-record surfaces expose a scan hook: run `grep -n "scan\|receipt" backend/app/routers/purchases.py backend/app/routers/transport.py`. If a hook exists, wire the same extraction path from task 1.15 into weigh-slip auto-fill (procurement) and weighbridge-slip reads (trip records). If no hook exists, create `docs/deferral-ledger.md` (new, if absent — with a `| ID | Item | Status | Evidence / dated note |` table header) and append a dated DEFERRED row for weigh-slip/weighbridge scan reuse.
- RUN: `grep -rn "scan" backend/app/routers/purchases.py backend/app/routers/transport.py | grep -q . || grep -q "weigh" docs/deferral-ledger.md`
- EXPECT: exit 0 (either the wiring exists in the routers, or the deferral row exists).
- IF FAIL: complete the missing branch (wire it or write the deferral row), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 1.22 — Register churn.signal.v1 question set
- DO: edit `backend/app/services/ai/question_sets.py` — register `churn.signal.v1` with questions `churn_risk` (score 0–1) and `best_hook` (choice with criteria `mandi_price_move` / `pending_offer` / `new_scheme` / `course_reminder`); `automation_level: "suggest"`; deterministic fallback = inactivity-days rules.
- RUN: `cd backend && .venv/bin/python -c "import app.services.ai.question_sets" && grep -q "churn.signal.v1" app/services/ai/question_sets.py`
- EXPECT: exit 0.
- IF FAIL: fix the registration error shown, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 1.23 — Create churn nightly scoring service
- DO: create `backend/app/services/churn.py` (new) with `async def score_dormant_users()`: select ONLY users dormant ≥7 days (activity recency); build state via a `privacy.py` builder (pseudonymized via `HMAC(user_id, AI_HASH_SALT)` — no phones/emails, rule 11); `await gateway.decide(state, "churn.signal.v1", ctx)`; where `churn_risk` is above the configured threshold, emit a re-engagement task via `emit_task()` and send a notification through the M7 dispatch path (`notify.timing.v1` + `notify.copy.v1`), respecting quiet hours 21:00–06:30. On gateway failure use the deterministic fallback and log `fallbackUsed`.
- RUN: `cd backend && .venv/bin/python -c "from app.services.churn import score_dormant_users"`
- EXPECT: exit 0.
- IF FAIL: fix the import error shown, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 1.24 — Register churn job in the nightly scheduler
- DO: read `backend/app/routers/jobs.py` (and any existing nightly-job registration pattern it uses) and register `score_dormant_users` as a nightly job following that exact pattern. Do not invent a new scheduler.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -c "import app.main" && .venv/bin/python -m pytest tests/test_notifications.py -q`
- EXPECT: exit 0, tests pass.
- IF FAIL: fix the registration to match the existing pattern, re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 1.25 — Record churn re-engagement outcome hook
- DO: in the user-activity/login path (read `backend/app/routers/auth.py` or the activity-tracking service), add: when a user returns within 72h of a churn re-engagement touch, call `record_outcome` for `churn.signal.v1` with that decision_id.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_auth.py -q`
- EXPECT: all tests pass, exit 0.
- IF FAIL: fix the hook, re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 1.26 — Write churn tests
- DO: create `backend/tests/test_churn.py` (new): (1) only users dormant ≥7 days are scored (a 3-day-dormant user is never scored); (2) `churn_risk` above threshold emits exactly one re-engagement task; (3) module flag off → nothing scored and nothing sent; (4) quiet hours 21:00–06:30 respected (no notification dispatched inside the window).
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_churn.py -q`
- EXPECT: all tests pass, exit 0.
- IF FAIL: fix the code, re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 1.27 — Create agent_rules service
- DO: create `backend/app/services/agent_rules.py` (new) with `COLLECTION = "agent_rules"` and document fields exactly `{ruleId, userHash, module, condition, action, max_value_paisa, active, createdAt, lastFiredAt}` where `userHash = HMAC(user_id, AI_HASH_SALT)` (real uid stays only on the server-side ownership field per existing auth patterns — never in AI payloads). Implement `create_rule`, `list_rules_for_user`, `pause_rule`, `delete_rule`, `record_fire`. Money fields integer paisa.
- RUN: `cd backend && .venv/bin/python -c "from app.services.agent_rules import create_rule, list_rules_for_user, pause_rule, delete_rule"`
- EXPECT: exit 0.
- IF FAIL: fix the import error shown, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 1.28 — Register agent.rule_match.v1 question set
- DO: edit `backend/app/services/ai/question_sets.py` — register `agent.rule_match.v1` with questions `rule_fires` (bool) and `rule_id` (choice over the user's active rules for the module); `automation_level: "suggest"`; deterministic fallback = direct numeric/string comparison of the parsed `condition` against the event payload.
- RUN: `cd backend && .venv/bin/python -c "import app.services.ai.question_sets" && grep -q "agent.rule_match.v1" app/services/ai/question_sets.py`
- EXPECT: exit 0.
- IF FAIL: fix the registration error shown, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 1.29 — Create agent rules router with parse endpoint
- DO: create `backend/app/routers/agent_rules.py` (new) and register it in `backend/app/main.py` following the existing router-registration pattern. Add `POST /v1/agent/rules/parse` accepting `{text, module}`: call `gateway.generate()` to parse the vernacular rule text into the structured rule, validate with a Pydantic model (`condition`, `action`, `max_value_paisa`), allow one repair retry, and return the parsed rule for user review — do NOT save anything in this endpoint. Failure → `{"error":{code,...}}` envelope.
- RUN: `cd backend && .venv/bin/python -c "import app.main"`
- EXPECT: exit 0.
- IF FAIL: fix the router/registration error shown, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 1.30 — Add agent rule CRUD endpoints
- DO: edit `backend/app/routers/agent_rules.py` — add: `POST /v1/agent/rules` (body = the user-confirmed parsed rule → persist with `active: true`; accepts `Idempotency-Key` per rule 7; writes `audit_logs`), `GET /v1/agent/rules` (list own rules, cursor pagination), `POST /v1/agent/rules/{ruleId}/pause`, `DELETE /v1/agent/rules/{ruleId}` (writes `audit_logs` with reason, rule 8). All failures use the error envelope.
- RUN: `cd backend && .venv/bin/python -c "import app.main"`
- EXPECT: exit 0.
- IF FAIL: fix the error shown, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 1.31 — Wire rule evaluation into the offers flow
- DO: edit `backend/app/services/agent_rules.py` — add `async def evaluate_rules_for_event(user_id, module, event_payload)`: for each active rule of the user for the module, call `gateway.decide(state, "agent.rule_match.v1", ctx)` (fallback = direct comparison); on fire: enforce the `max_value_paisa` ceiling server-side (never fire above it), emit a task via `emit_task()` carrying an explicit confirm action, and write to both `ai_decisions` and `audit_logs` (ruleId, decision_id). Then call this from the new-offer path — read `backend/app/routers/offers.py` and hook the evaluation into offer creation (logic stays in the service, not the router). HARD CAP: a fire NEVER executes the action — one-tap confirm only.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_demands_offers.py -q`
- EXPECT: all tests pass, exit 0.
- IF FAIL: fix the wiring, re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 1.32 — Wire rule-fire confirm to existing endpoint
- DO: read the phase-01 task engine confirm-action mechanism (`grep -rn "confirm" backend/app/services/tasks.py` or wherever `emit_task` lives) and set the agent-rule fire task's confirm action to call the EXISTING offer-accept endpoint on `backend/app/routers/offers.py` with normal auth + `Idempotency-Key`. No privileged agent write path may exist.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_demands_offers.py -q`
- EXPECT: all tests pass, exit 0.
- IF FAIL: fix the confirm payload wiring, re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 1.33 — Write agent rules tests
- DO: create `backend/tests/test_agent_rules.py` (new): (1) "₹1800 se upar accept" rule fires only on qualifying offers — boundary tests at exactly ₹1,800 = 180000 paisa (fires) and 179999 paisa (does not fire); (2) paused rule never fires; (3) a fire alone causes NO state change (offer status unchanged until the confirm tap); (4) full audit trail — fire → confirm/dismiss → outcome present in `audit_logs` and `ai_decisions`; (5) `max_value_paisa` ceiling blocks an over-ceiling fire.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_agent_rules.py -q`
- EXPECT: all tests pass, exit 0.
- IF FAIL: fix the code (never the test assertions), re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 1.34 — Create agent rules website API wrapper
- DO: create `website/src/lib/api/agentRules.ts` (new) following the style of an existing wrapper (read `website/src/lib/api/offers.ts` first): `parseRule(text, module)`, `createRule(rule)`, `listRules()`, `pauseRule(ruleId)`, `deleteRule(ruleId)`. No `?? <number>` fallbacks.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the type error shown, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 1.35 — Create agent rules management page
- DO: create `website/src/views/farmer/AgentRulesPage.tsx` (new): rules list showing active/paused state with pause/delete controls, and an audit history section (fire → confirm/dismiss → outcome). Register the route in `website/src/App.tsx` with `React.lazy` and add the entry to the persona/module registry `website/src/lib/dashboard.ts` following its existing pattern. All strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the type error shown, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 1.36 — Build guided rule creation form
- DO: edit `website/src/views/farmer/AgentRulesPage.tsx` — add the guided creation form: vernacular example hints (including "₹1,800 se upar offer aaye toh accept kar do"), call `parseRule`, then show the parsed rule back in plain en/hi language for review, and only call `createRule` after the user explicitly confirms. No `alert()`/`confirm()` dialogs — inline review UI.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the type error shown, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 1.37 — Add rule-fire confirm/dismiss task card
- DO: locate the phase-01 dashboard task card component with `grep -rln "TaskCard\|task-card" website/src/` (if nothing → STOP) and extend it so agent-rule fire tasks render explicit confirm/dismiss buttons; confirm calls the confirm action from task 1.32, dismiss records the dismissal. Follow the component's existing action-button pattern.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the type error shown, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 1.38 — Add agent rules i18n keys
- DO: add every new `t()` key from tasks 1.35–1.37 (rule form labels, examples, review text, list headers, audit history labels, confirm/dismiss) to BOTH `website/src/lib/i18n/locales/en.ts` and `website/src/lib/i18n/locales/hi.ts`.
- RUN: `grep -q "agentRules" website/src/lib/i18n/locales/en.ts && grep -q "agentRules" website/src/lib/i18n/locales/hi.ts && cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: add the missing keys, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 1.39 — Add language suggestion to LanguageSelect
- PRECONDITION: `test -f website/src/views/onboarding/LanguageSelect.tsx` — if this fails, STOP the phase (playbook §5).
- DO: edit `website/src/views/onboarding/LanguageSelect.tsx` — after village search / GPS grant resolves a location via the `backend/app/routers/reference.py` geo endpoints (wrapper in `website/src/lib/api/reference.ts`), pre-select the suggested language for the resolved location. The pre-selection must remain user-overridable. Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the type error shown, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 1.40 — Create district_crops service and public read endpoint
- DO: create `backend/app/services/district_crops.py` (new) with `COLLECTION = "district_crops"` and document fields `{district, crops: [], source: "curated" | "ai_proposed", status: "active" | "pending", updatedBy, updatedAt}`. Add `GET /v1/reference/district-crops?district=` to `backend/app/routers/reference.py` returning ONLY `status: "active"` rows — raw AI proposals are never served to users.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_reference.py -q`
- EXPECT: all tests pass, exit 0.
- IF FAIL: fix the code, re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 1.41 — Add admin CRUD for district_crops
- DO: read the existing admin router pattern (`backend/app/routers/admin.py` or the phase-07 admin console backend) and add admin endpoints to list/edit/approve `district_crops` rows (approve flips `status: "pending" → "active"`). Every mutation writes `audit_logs` with a reason (rule 8).
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass, exit 0.
- IF FAIL: fix the code, re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 1.42 — Create district-crop AI proposal job
- DO: edit `backend/app/services/district_crops.py` — add `async def propose_district_crops()`: for districts beyond the spec's 8-district region-crop mapping, call `gateway.generate()` with an agro-climatic grounding prompt, validate with a Pydantic model, one repair retry, and write results ONLY as `status: "pending"`, `source: "ai_proposed"` rows. AI proposes, admin disposes. Register the job in the scheduler following the pattern used in task 1.24.
- RUN: `cd backend && .venv/bin/python -c "from app.services.district_crops import propose_district_crops" && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_reference.py -q`
- EXPECT: exit 0, tests pass.
- IF FAIL: fix the error shown, re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 1.43 — Pre-select crops in ProfileDetails
- PRECONDITION: `test -f website/src/views/onboarding/ProfileDetails.tsx` — if this fails, STOP the phase (playbook §5).
- DO: edit `website/src/views/onboarding/ProfileDetails.tsx` — fetch `GET /v1/reference/district-crops?district=` for the resolved district (add a wrapper to `website/src/lib/api/reference.ts`) and pre-select the returned crops. Every pre-selection is user-overridable. Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the type error shown, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 1.44 — Pre-seed dashboard after registration
- PRECONDITION: `grep -rq "schemes.match.v1" backend/app/ && grep -rq "courses.recommend.v1" backend/app/` — if this fails, STOP the phase (phase-05 M21/M20 missing).
- DO: in the post-registration path (read `backend/app/routers/auth.py` / users service to find where registration completes), seed the new user's dashboard with the stored M21 `schemes.match.v1` matches plus one starter course from M20 `courses.recommend.v1`, so the first dashboard is already populated. Consume the phase-05 services — do not re-implement matching.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_auth.py tests/test_users.py -q`
- EXPECT: all tests pass, exit 0.
- IF FAIL: fix the seeding call, re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 1.45 — Emit KYC-lite checklist tasks
- DO: in the post-registration path from task 1.44, decide which KYC documents the chosen personas require (Jev/rules per the existing KYC service — read `backend/app/services/eligibility.py` and the KYC module first) and emit one checklist task per required document via `emit_task()`.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_auth.py tests/test_users.py -q`
- EXPECT: all tests pass, exit 0.
- IF FAIL: fix the emission logic, re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 1.46 — Add onboarding copilot i18n keys
- DO: add every new `t()` key from tasks 1.39, 1.43 (language suggestion hint, crop pre-selection labels) to BOTH `website/src/lib/i18n/locales/en.ts` and `website/src/lib/i18n/locales/hi.ts`.
- RUN: `cd website && pnpm exec tsc --noEmit && git diff --name-only src/lib/i18n/locales/ | grep -q "hi"`
- EXPECT: exit 0 (both en and hi locale files carry the new keys).
- IF FAIL: add the missing keys, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 1.47 — HUMAN CHECK: touch-only onboarding under 60s
- DO: HUMAN CHECK — on staging with flags on: (1) open the website registration flow; (2) grant GPS (or search a village) — confirm language is pre-selected and overridable; (3) confirm district crops are pre-selected in ProfileDetails and overridable; (4) complete the entire flow using only steppers/taps/GPS — no typing anywhere; (5) measure time from first screen to first dashboard action with a stopwatch; (6) confirm the first dashboard shows scheme matches + one starter course + KYC checklist tasks.
- RUN: none (manual).
- EXPECT: human confirms time-to-first-action <60s, touch-only completion, all suggestions overridable, dashboard pre-seeded.
- IF FAIL: record which step failed and STOP (playbook §5) with the observation.
- [ ]

### Task 1.48 — Run WS-01 automated verification
- DO: run the full WS-01 verification block from instructions.md.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q && cd ../website && pnpm exec tsc --noEmit && pnpm build`
- EXPECT: backend suite fully green; tsc clean; build succeeds; exit 0.
- IF FAIL: fix the reported failure in the code this workstream touched, re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 1.49 — HUMAN CHECK: WS-01 staging flows with flags on and off
- DO: HUMAN CHECK — on staging with module flags on: (1) SHG leader opens women-hub SHG tab → readiness card shows factors → loan link appears past threshold; (2) snap a receipt in Cashbook → prefilled form with draft banner → confirm → entry appears and totals update only after save; (3) a test user dormant ≥7 days receives a re-engagement task the next morning; (4) create the "₹1800 se upar accept" rule → a qualifying offer arrives → task with confirm appears → tap confirm → offer accepted via the normal endpoint → audit trail visible; (5) register a fresh account with GPS → language + crops pre-selected → dashboard pre-seeded in <60s. Then turn the SHG and agent module flags off and repeat flows (1) and (4) — the modules must still work without AI (graceful degradation, no errors).
- RUN: none (manual).
- EXPECT: human confirms every flow above, including both flag-off degradation runs.
- IF FAIL: record the failing flow and STOP (playbook §5) with the observation.
- [ ]

### Task 1.50 — Commit WS-01 checkpoint
- DO: stage and commit all WS-01 work.
- RUN: `git add -A && git commit -m "phase-08 WS-01: experience AI features (M26, M28, M29, M33)"`
- EXPECT: commit created (exit 0). If git identity is missing, note it and continue (playbook §6).
- IF FAIL: check `git status` for the error, fix the cause (not by amending), re-run once — else note it and continue per playbook §6.
- [ ]

## WS-02 — Automation raises & calibration (rollout phase G)  (see instructions.md §WS-02)

### Task 2.1 — Verify calibration prerequisites exist
- DO: nothing (read-only check). Confirms phase-00 AI files, the phase-07 admin AI Health page surface, and the CI configuration from phase-00.
- RUN: `test -f backend/app/services/ai/outcomes.py && test -f backend/app/services/ai/decision_log.py && test -f backend/app/services/ai/budget.py && ls .github/workflows/*.yml && grep -rln "platform_config" backend/app/routers/ backend/app/services/`
- EXPECT: exit 0 with at least one workflow file and one platform_config match.
- IF FAIL: none — STOP the phase (playbook §5); an earlier-phase deliverable is missing.
- [ ]

### Task 2.2 — Add phase-G gate to the platform_config/ai editor
- DO: locate the admin editor backend for `platform_config/ai` (from the grep in task 2.1 — read that file). Add a guard on any change raising a question set from `suggest → require_confirm`: refuse unless ALL of (a) ≥1,000 logged outcomes for that set (query `outcomes.py`/`decision_log.py`), (b) >90% top-bucket accuracy in the latest calibration report, (c) maker-checker approval by a second admin plus an `audit_logs` entry with reason (rule 8). Refusals return the `{"error":{code,...}}` envelope.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass, exit 0.
- IF FAIL: fix the guard, re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 2.3 — Hard-cap credit/insurance/legal sets at require_confirm
- DO: in the same editor file as task 2.2, add a hard-capped set list containing `loans.prescreen.v1`, `insurance.triage.v1`, and the dispute/legal question sets (read `question_sets.py` for their exact IDs). The editor must reject `auto` for these sets and never offer it — rule 12; nothing in this program raises to `auto`.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass, exit 0.
- IF FAIL: fix the cap list, re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 2.4 — Write phase-G gate tests
- DO: create `backend/tests/test_phase_g_gate.py` (new): (1) a `suggest → require_confirm` raise on a set with <1,000 outcomes is refused; (2) a raise on a set with ≥1,000 outcomes and >90% top-bucket accuracy plus maker-checker approval succeeds AND writes an `audit_logs` entry with reason; (3) `auto` is rejected for `loans.prescreen.v1` and `insurance.triage.v1` even with full evidence.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_phase_g_gate.py -q`
- EXPECT: all tests pass, exit 0.
- IF FAIL: fix the code (never the test assertions), re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 2.5 — Add golden-dataset coverage test
- DO: create `backend/tests/test_golden_coverage.py` (new): iterate every question set registered in `question_sets.py` and assert `backend/tests/fixtures/ai/golden/<id>.jsonl` exists for each. Any missing fixture fails the test with the set id in the message.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_golden_coverage.py -q`
- EXPECT: all tests pass, exit 0.
- IF FAIL: create the missing golden fixture(s) named by the failure (follow task 1.10's format), re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 2.6 — Wire golden run into CI on shim
- DO: edit the CI workflow file found in task 2.1 (`.github/workflows/*.yml`) — add a job/step that runs `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q -k golden` on every merge, following the file's existing job structure. CI never calls paid APIs (rule 10) — shim only.
- RUN: `grep -n "golden" .github/workflows/*.yml`
- EXPECT: at least one match; exit 0.
- IF FAIL: correct the workflow YAML, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 2.7 — Create nightly live golden-run job
- DO: add a nightly scheduled run of the golden suites against LIVE models — use the same scheduler mechanism the repo already uses for scheduled work (CI cron in the workflow file from task 2.6, or the backend jobs pattern from task 1.24 — match whichever phase-00/06 established). The run compares per-set accuracy against the trailing baseline stored with the calibration reports.
- RUN: `grep -rn "golden" .github/workflows/*.yml backend/app/routers/jobs.py | grep -qi "night\|cron\|schedule"`
- EXPECT: at least one match; exit 0.
- IF FAIL: wire the schedule into the correct mechanism, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 2.8 — Add >5pt regression alerting
- DO: in the nightly golden job from task 2.7: when a set's accuracy drops >5 points vs the trailing baseline, fire a Sentry alert AND set the banner flag the admin AI Health page reads (read the phase-07 AI Health page surface to find the exact flag/doc it consumes). Add a test that forces a >5pt regression on a test set and asserts both the Sentry call and the banner flag.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q -k "golden"`
- EXPECT: all tests pass, exit 0.
- IF FAIL: fix the alert path, re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 2.9 — Write live-response contract tests
- DO: create `backend/tests/test_ai_contracts.py` (new): validate Jev/gateway responses against the schemas registered in `question_sets.py` (channel-drift guard — an OpenRouter schema-vocabulary change must fail loudly, never silently fall back). Include one test that injects a schema-violating response and asserts the contract validator RAISES (the violation is caught).
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_ai_contracts.py -q`
- EXPECT: all tests pass, exit 0.
- IF FAIL: fix the validator (never delete the injected-violation test), re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 2.10 — Create weekly calibration job
- DO: create `backend/app/services/ai/calibration.py` (new) with `run_weekly_calibration()` computing, per question set: accuracy, confidence-bucket reliability, fallback rate, and cost per module — reading `ai_decisions`/outcomes via `decision_log.py` and `outcomes.py`. Persist each weekly report to the collection/doc the phase-07 AI Health page reads. Include a `backfill()` that generates reports for any missing past weeks. Register it as a weekly job using the scheduler pattern from task 1.24.
- RUN: `cd backend && .venv/bin/python -c "from app.services.ai.calibration import run_weekly_calibration, backfill"`
- EXPECT: exit 0.
- IF FAIL: fix the import error shown, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 2.11 — Backfill calibration and verify 4+ weekly reports
- DO: run the backfill, then verify at least 4 weekly calibration reports exist in the store the AI Health page reads.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -c "from app.services.ai.calibration import backfill; backfill()"`
- EXPECT: exit 0 with no exception; the run output/log shows reports written for every missing week (4+ total when the phase-07 surface is queried in task 6.x / the AI Health page check).
- IF FAIL: read the exception, fix the job, re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 2.12 — Create AI gateway load-test locustfile
- PRECONDITION: `cd backend && .venv/bin/python -c "import locust"` — if this fails, run `cd backend && .venv/bin/pip install locust` once, then re-check.
- DO: create `backend/tests/load/ai_gateway_locustfile.py` (new): a Locust user driving `decide()` calls (via the HTTP surface that exercises the gateway) with a scenario where `AI_DAILY_BUDGET_USD` is set low so the budget trips mid-run. Assertions in the locustfile: zero 5xx responses, no caller exceptions, and `fallbackUsed` logged on budget-trip responses (budget caps degrade, never error).
- RUN: `test -f backend/tests/load/ai_gateway_locustfile.py && cd backend && .venv/bin/python -c "import locust; import locust.main"` 
- EXPECT: exit 0.
- IF FAIL: fix the locustfile syntax/import error shown, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 2.13 — Run gateway 100 rps load test
- PRECONDITION: backend running — start it with `cd backend && AI_PROVIDER=shim AI_DAILY_BUDGET_USD=0.01 .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000` and confirm `curl -sf http://localhost:8000/v1/health` succeeds.
- DO: run the load test exactly as specified in instructions.md.
- RUN: `cd backend && .venv/bin/locust -f tests/load/ai_gateway_locustfile.py --headless -u 100 -r 20 -t 3m --host http://localhost:8000`
- EXPECT: run completes; the report shows 0 failures; budget-trip responses degraded to deterministic fallbacks with `fallbackUsed` logged (check the backend log); zero 5xx.
- IF FAIL: read the failure lines, fix the gateway degradation path (never the assertions), re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 2.14 — Write AI spend review vs the §6.1 envelope
- DO: pull per-model daily cost from `ai_decisions` / the Redis counters `ai:cost:<model>:<yyyymmdd>` (read `backend/app/services/ai/budget.py` for the exact counter access), extrapolate to the 100k DAU × ~40 decisions/user/day envelope (~$134/day Jev at $0.042/M tokens), verify the live OpenRouter/Gemini rates and record the reported 10× pricing discrepancy explicitly. Write the projection into `docs/test-reports/phase-08-ai-spend-review.md` (new), stating whether the projection exceeds the envelope.
- RUN: `test -f docs/test-reports/phase-08-ai-spend-review.md && grep -q "134" docs/test-reports/phase-08-ai-spend-review.md`
- EXPECT: exit 0.
- IF FAIL: complete the document with the required numbers, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 2.15 — Apply spend optimizations if projection exceeds budget
- DO: read `docs/test-reports/phase-08-ai-spend-review.md`. If the projection exceeds the envelope, apply the two named optimizations: (1) state-trimming — verify/enforce the ≤1,500-token target in every `privacy.py` state builder; (2) batched questions — verify/enforce ≤10 tasks per `tasks.rank.v1` batch (multiple questions per Jev call). If the projection is within budget, record that conclusion in the same file instead. Either way the suite must stay green.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q`
- EXPECT: all tests pass, exit 0.
- IF FAIL: fix the regression shown, re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 2.16 — HUMAN CHECK: spend caps and manual raise gate
- DO: HUMAN CHECK — (1) open the OpenRouter dashboard and confirm account-level spend caps are set as a backstop; (2) on staging, in the admin `platform_config/ai` editor, attempt a `suggest → require_confirm` raise on a set with <1,000 outcomes → must be refused with the error envelope; (3) repeat on a qualifying set (≥1,000 outcomes, >90% accuracy) WITH a second admin's maker-checker approval → must succeed and show an `audit_logs` entry with reason; (4) confirm the editor does not offer `auto` for `loans.prescreen.v1` / `insurance.triage.v1`.
- RUN: none (manual).
- EXPECT: human confirms all four checks.
- IF FAIL: record which check failed and STOP (playbook §5) with the observation.
- [ ]

### Task 2.17 — Run WS-02 verification and commit
- DO: run the WS-02 verification block from instructions.md, then commit.
- RUN: `cd backend && .venv/bin/python -m pytest -q -k "calibration or contract or golden" && cd .. && git add -A && git commit -m "phase-08 WS-02: automation raises & calibration"`
- EXPECT: selected tests all pass; commit created (exit 0).
- IF FAIL: fix the failing test's root cause in code, re-run once — else STOP (playbook §5) with full output.
- [ ]

## WS-03 — B2B API platform (G11)  (see instructions.md §WS-03)

### Task 3.1 — Verify consent-center gate
- DO: nothing (read-only check). The B2B API serves only aggregated, anonymized rows — consent coverage of the underlying signals (incl. the saturation opt-in per robust §7.2) must exist first (phase-06 exit).
- RUN: `test -f backend/app/services/consents.py && grep -rn "saturation" backend/app/services/consents.py && grep -rln "consent" website/src/views/`
- EXPECT: exit 0 with matches from both greps.
- IF FAIL: none — STOP the phase (playbook §5); the phase-06 consent center is not proven.
- [ ]

### Task 3.2 — Create partner API key service
- DO: create `backend/app/services/partner_keys.py` (new) with `COLLECTION = "partner_api_keys"` and document fields exactly `{keyId, partnerId, scopes, rateLimit, createdAt, revokedAt}`. Implement `issue_key(partnerId, scopes, rateLimit)` (returns the plaintext key exactly once, stores only a hash — read `backend/app/core/security.py` and reuse its hash helpers), `revoke_key(keyId)`, and `verify_key(plaintext_key)` returning the key doc or `None` (must reject revoked keys).
- RUN: `cd backend && .venv/bin/python -c "from app.services.partner_keys import issue_key, revoke_key, verify_key"`
- EXPECT: exit 0.
- IF FAIL: fix the import error shown, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.3 — Create API-key auth dependency
- DO: read `backend/app/core/deps.py` and add, in the same style, a `get_partner` dependency that authenticates the `X-API-Key` header via `verify_key`, plus a `require_scope(scope)` helper that raises the standard error envelope with 403 when the key lacks the scope (scopes: `mandi:read`, `saturation:read`).
- RUN: `cd backend && .venv/bin/python -c "from app.core.deps import get_partner, require_scope"`
- EXPECT: exit 0.
- IF FAIL: fix the import error shown, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.4 — Create partner API router skeleton
- DO: create `backend/app/routers/partner_api.py` (new) and register it in `backend/app/main.py` following the existing registration pattern. All endpoints use `get_partner` + `require_scope`, the `{"error":{code,...}}` envelope, and cursor pagination (rule 7).
- RUN: `cd backend && .venv/bin/python -c "import app.main"`
- EXPECT: exit 0.
- IF FAIL: fix the registration error shown, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.5 — Add partner mandi prices endpoint
- DO: edit `backend/app/routers/partner_api.py` — add `GET /v1/partner/mandi/prices?crop=&district=&from=&to=` (scope `mandi:read`): district/crop-level aggregate price series only, reading from the same data services `backend/app/routers/mandi.py` uses. Suppress any bucket with a cohort below the k-anonymity floor k=5 (suppressed buckets return no rows). Cursor pagination; error envelope.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_mandi.py -q`
- EXPECT: all tests pass, exit 0.
- IF FAIL: fix the endpoint, re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 3.6 — Add partner saturation insights endpoint
- DO: edit `backend/app/routers/partner_api.py` — add `GET /v1/partner/advisory/saturation?district=&crop=` (scope `saturation:read`): district/crop-level aggregates only, sourced from the same saturation data `backend/app/routers/advisory.py` serves. Same k=5 suppression, cursor pagination, error envelope. No user-level data may ever leave via this API.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_advisory.py -q`
- EXPECT: all tests pass, exit 0.
- IF FAIL: fix the endpoint, re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 3.7 — Add per-key rate limiting
- DO: reuse the phase-00 Redis token-bucket helper (locate with `grep -rn "token_bucket\|rate_limit" backend/app/ --include="*.py" | grep -v test` — if nothing → STOP, phase-00 deliverable missing) and enforce each key's `rateLimit` on both partner endpoints. Over-limit responses use the error envelope with a 429-style code.
- RUN: `cd backend && .venv/bin/python -c "import app.main"`
- EXPECT: exit 0.
- IF FAIL: fix the wiring, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.8 — Add usage metering and billing hook
- DO: edit `backend/app/routers/partner_api.py` (or a small helper in `backend/app/services/partner_keys.py`): increment a per-key Redis daily request counter on every call, roll up to Firestore monthly usage docs, and emit a metered-usage record the phase-00 billing module can invoice (read the phase-00 billing module's usage-record interface first — `grep -rn "usage\|meter" backend/app/services/ | grep -i bill`). Wire the hook only — do NOT invent prices.
- RUN: `cd backend && .venv/bin/python -c "import app.main"`
- EXPECT: exit 0.
- IF FAIL: fix the wiring, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.9 — Add admin partner-key management endpoints
- DO: in the phase-07 admin console backend (locate with `grep -rln "admin" backend/app/routers/ | head`), add endpoints to issue and revoke partner keys and to read per-partner usage stats. Every issue/revoke writes `audit_logs` with a reason (rule 8).
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_admin.py -q`
- EXPECT: all tests pass, exit 0.
- IF FAIL: fix the endpoints, re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 3.10 — Write partner API tests
- DO: create `backend/tests/test_partner_api.py` (new): (1) a valid key with both scopes reads mandi prices AND saturation aggregates; (2) negative test — the partner key against a user-level endpoint (e.g. any `/v1/users/...` route) returns 403; (3) a revoked key fails immediately; (4) a district/crop bucket below k=5 returns no rows; (5) usage counters increment per call; (6) a key missing `saturation:read` gets 403 on the saturation endpoint.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_partner_api.py -q`
- EXPECT: all tests pass, exit 0.
- IF FAIL: fix the code (never the test assertions), re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 3.11 — Add admin console partner-key UI
- DO: in the phase-07 admin console surface (locate with `grep -rln "admin" website/src/views/ | head` — if nothing → STOP, phase-07 deliverable missing), add a partner key management section: issue key (plaintext shown exactly once), revoke with a reason field, and a per-partner usage dashboard reading the task-3.9 stats endpoint. All strings via `t()` with en+hi keys in both `website/src/lib/i18n/locales/en.ts` and `hi.ts`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the type error shown, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.12 — Add partner-facing API docs page
- DO: create `website/src/views/partner/PartnerApiDocs.tsx` (new): a short page describing the scopes (`mandi:read`, `saturation:read`), both endpoints with their query params, the k-anonymity behavior, and the rate-limit convention. Register the route in `website/src/App.tsx` with `React.lazy`. All copy via `t()` with keys in both `en.ts` and `hi.ts`.
- RUN: `cd website && pnpm exec tsc --noEmit && grep -q "partnerApi" src/lib/i18n/locales/hi.ts`
- EXPECT: exit 0.
- IF FAIL: fix the missing keys/types, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.13 — Curl-verify both partner endpoints
- PRECONDITION: backend running — start with `cd backend && AI_PROVIDER=shim .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000` and confirm `curl -sf http://localhost:8000/v1/health` succeeds. Create a test key via the task-3.9 admin endpoint first and export it as `PARTNER_KEY`.
- DO: exercise both endpoints with the staging key.
- RUN: `curl -sf -H "X-API-Key: $PARTNER_KEY" "http://localhost:8000/v1/partner/mandi/prices?crop=wheat&district=meerut" && curl -sf -H "X-API-Key: $PARTNER_KEY" "http://localhost:8000/v1/partner/advisory/saturation?district=meerut&crop=wheat" && curl -s -o /dev/null -w "%{http_code}" -H "X-API-Key: $PARTNER_KEY" http://localhost:8000/v1/users/me`
- EXPECT: both partner calls return 200 JSON aggregates; the user-level call prints `403`.
- IF FAIL: read the error body, fix the endpoint, re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 3.14 — Run WS-03 verification and commit
- DO: run the partner API tests plus the full website type check, then commit.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_partner_api.py -q && cd ../website && pnpm exec tsc --noEmit && cd .. && git add -A && git commit -m "phase-08 WS-03: B2B API platform"`
- EXPECT: tests pass, tsc clean, commit created (exit 0).
- IF FAIL: fix the reported failure, re-run once — else STOP (playbook §5) with full output.
- [ ]

## WS-04 — Performance & cost hardening  (see instructions.md §WS-04)

### Task 4.1 — Cap every unbounded Firestore scan
- DO: find every unbounded query stream and cap it with cursor pagination + max page size (rule 7): admin/analytics list endpoints must never return unbounded lists. Read each flagged file before editing.
- RUN: `grep -rn "\.stream()" backend/app/ --include="*.py" | grep -v "\.limit("`
- EXPECT: no output (every `.stream()` call is preceded by a `.limit(...)` on the query), exit 1 from grep = clean.
- IF FAIL: for each listed call site, add the limit + cursor pattern used by the repo's pagination helper (read `backend/app/core/db.py` first), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 4.2 — Verify composite index coverage and deploy
- DO: enumerate the compound queries shipped by routers + jobs (read `backend/app/core/db.py` query helpers and the routers touched in this program) and confirm `infra/firestore.indexes.json` contains a matching composite index for each; add any missing index entry following the file's existing JSON shape. Then deploy indexes to staging.
- RUN: `firebase deploy --only firestore:indexes`
- EXPECT: deploy completes, exit 0.
- IF FAIL: read the deploy error (auth/project), fix the indexes file if it is a validation error and re-run once; if it is a project/credential issue → STOP (playbook §5) with full output.
- [ ]

### Task 4.3 — HUMAN CHECK: staging click-through for index errors
- DO: HUMAN CHECK — on staging, exercise every website screen (all persona dashboards and all module pages), then run the log check below.
- RUN: `grep -i "index" .run-logs/backend.log | grep -i "missing\|failed_precondition" ; true`
- EXPECT: no output lines (zero index-missing errors on the full click-through).
- IF FAIL: add the index the error message names to `infra/firestore.indexes.json`, redeploy with `firebase deploy --only firestore:indexes`, re-run the affected screens — else STOP (playbook §5).
- [ ]

### Task 4.4 — Create ai_decisions export-then-expire job
- DO: create `backend/app/services/ai/decision_export.py` (new) with `export_expired_decisions()`: find `ai_decisions` documents older than 90 days, export them to cold storage (GCS bucket or BigQuery — match whatever the repo's storage/config already provisions; read `backend/app/core/config.py` first), and only after a verified export delete them. Export-then-expire, never just delete (the calibration dataset is the moat). Register as a scheduled job using the pattern from task 1.24.
- RUN: `cd backend && .venv/bin/python -c "from app.services.ai.decision_export import export_expired_decisions"`
- EXPECT: exit 0.
- IF FAIL: fix the import error shown, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 4.5 — Test the decision export job
- DO: create `backend/tests/test_decision_export.py` (new): seed `ai_decisions` docs with ages 30, 91, and 400 days; run the export; assert docs >90 days were exported (export record exists) THEN deleted, and the 30-day doc is untouched; assert deletion never happens when the export step fails.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_decision_export.py -q`
- EXPECT: all tests pass, exit 0.
- IF FAIL: fix the job (never the test assertions), re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 4.6 — HUMAN CHECK: enable ai_decisions 90-day TTL
- DO: HUMAN CHECK — in the Firebase/GCP console for the staging project: Firestore → Indexes → TTL policies → add a TTL policy on collection group `ai_decisions`, field = the expiry timestamp field written by `decision_log.py` (read it for the exact field name), TTL = 90 days. Then run the verification command below.
- RUN: `gcloud firestore fields ttls list --collection-group=ai_decisions 2>/dev/null || echo "verify TTL policy in console"`
- EXPECT: the TTL policy is listed (or the human confirms it in the console); documents older than 90 days disappear after the export job runs (spot-check one old doc id from task 4.5's staging seed).
- IF FAIL: record the console error and STOP (playbook §5) with the observation.
- [ ]

### Task 4.7 — Convert all routes to React.lazy
- DO: read `website/src/App.tsx` and convert every route view import to route-level `React.lazy` (move heavy rarely-used views behind dynamic imports), following the pattern already used for any lazy routes in the file. Keep the Suspense fallback convention the file already uses.
- RUN: `grep -nE "^import [A-Z][A-Za-z]+ from ['\"].*views/" website/src/App.tsx`
- EXPECT: no output (no eager view imports remain), exit 1 from grep = clean; then `cd website && pnpm exec tsc --noEmit` exits 0.
- IF FAIL: convert the listed imports to `React.lazy`, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 4.8 — Measure first-load bundle under 400 KB
- DO: build and measure the first-load JS of the dashboard route entry chunk, gzipped.
- RUN: `cd website && pnpm build && ls -la dist/assets/ && for f in dist/assets/index-*.js; do echo "$f $(gzip -c "$f" | wc -c) bytes gzipped"; done`
- EXPECT: the entry/first-load chunk is < 409600 bytes (400 KB) gzipped.
- IF FAIL: move the largest rarely-used views behind dynamic imports (same pattern as task 4.7) and re-run once — else STOP (playbook §5) with the measured numbers.
- [ ]

### Task 4.9 — Record bundle size in launch checklist
- DO: create `docs/launch-checklist.md` (new, if absent — header `# AGROVERCITY Launch Checklist`) and append: `| Website first-load JS (gzipped) | <measured KB from task 4.8> KB | <today's date> | PASS (<400 KB) |`.
- RUN: `grep -q "first-load JS" docs/launch-checklist.md`
- EXPECT: exit 0.
- IF FAIL: write the row, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 4.10 — Create and run critical-path load tests
- PRECONDITION: backend running — start with `cd backend && AI_PROVIDER=shim .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000` and confirm `curl -sf http://localhost:8000/v1/health` succeeds.
- DO: create `backend/tests/load/critical_paths_locustfile.py` (new): tasks exercising `GET /v1/tasks/summary`, offers list + detail, and checkout (payment order creation) with an auth fixture matching the repo's dev-auth convention; targets: p95 < 500 ms for reads at 50 rps. Run it.
- RUN: `cd backend && .venv/bin/locust -f tests/load/critical_paths_locustfile.py --headless -u 50 -r 10 -t 3m --host http://localhost:8000`
- EXPECT: run completes with 0 failures and p95 < 500 ms on the read endpoints.
- IF FAIL: profile the slow endpoint for N+1 Firestore patterns (sequential per-item fetches), batch them, re-run once — else STOP (playbook §5) with the latency report.
- [ ]

### Task 4.11 — Attach load-test report to launch checklist
- DO: re-run the task-4.10 command with `--csv .run-logs/phase-08-load` (same flags otherwise), then append to `docs/launch-checklist.md`: `| Backend load test (tasks/offers/checkout, 50 rps) | p95 <500 ms | <today's date> | PASS — .run-logs/phase-08-load_stats.csv |`.
- RUN: `grep -q "Backend load test" docs/launch-checklist.md && test -f .run-logs/phase-08-load_stats.csv`
- EXPECT: exit 0.
- IF FAIL: produce the CSV and the row, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 4.12 — Audit AI caching (no model call per page view)
- DO: verify no AI model call is triggered directly by a page view / GET request — rule 10 says routers never call the gateway; results must come from Firestore docs or Redis (cached per district-crop / per decision_id per the SGR recipe).
- RUN: `grep -rn "gateway\.\(decide\|generate\|analyze_image\|embed\)" backend/app/routers/ --include="*.py"`
- EXPECT: no output (zero gateway calls in routers), exit 1 from grep = clean.
- IF FAIL: move each listed call into the owning service's write-path or a nightly job (services may call the gateway; routers may not), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 4.13 — Run WS-04 verification and commit
- DO: run the WS-04 verification block from instructions.md, then commit.
- RUN: `cd website && pnpm build && ls -la dist/assets/ && cd ../backend && .venv/bin/python -m pytest -q && cd .. && git add -A && git commit -m "phase-08 WS-04: performance & cost hardening"`
- EXPECT: build succeeds, pytest fully green, commit created (exit 0).
- IF FAIL: fix the reported failure, re-run once — else STOP (playbook §5) with full output.
- [ ]

## WS-05 — Compliance & launch readiness  (see instructions.md §WS-05)

### Task 5.1 — Grep AI state builders for PII leaks
- DO: verify payload minimization in every AI state builder — hashed IDs only (`HMAC(user_id, AI_HASH_SALT)`), no phones, emails, or unmasked Aadhaar in any AI payload (rule 11). Read `backend/app/services/ai/privacy.py` and every builder added in this program.
- RUN: `grep -rniE "aadhaar" backend/app/services/ai/ ; grep -rnE "phone|email" backend/app/services/ai/privacy.py | grep -v "#" ; true`
- EXPECT: no Aadhaar matches anywhere under `backend/app/services/ai/`; phone/email identifiers in `privacy.py` appear only in comments/docs stating they are excluded — never as state fields.
- IF FAIL: remove the leaking field from the builder (pseudonymize or drop it), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.2 — Verify vision-only photos and provider retention settings
- DO: read `backend/app/services/ai/gateway.py` and confirm: (1) `analyze_image()` is the only path sending photos, and it is called only for vision endpoints; (2) provider data-retention is disabled where the provider supports it (config flag in the gateway's request builder). If the retention flag is missing, add it per the provider's API and log it in the DPDP audit (task 5.6).
- RUN: `grep -rn "analyze_image" backend/app/ --include="*.py" | grep -v "services/ai/gateway.py" | grep -v test`
- EXPECT: matches only in service-layer call sites (e.g. the diary receipt-scan service path) — never in routers; and `gateway.py` contains the retention-disabled request option.
- IF FAIL: move the call out of the router into a service, or add the retention flag, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.3 — Verify consent coverage and AI disclosure
- DO: read `backend/app/services/consents.py` and the consent-center UI (locate with `grep -rln "consent" website/src/views/`): confirm (1) an AI disclosure entry is present in the consent center; (2) consent coverage exists for every data use including the saturation opt-in and the WS-03 B2B aggregates. Add any missing consent entry following the file's existing pattern (en+hi strings via `t()` on the website side).
- RUN: `grep -rni "saturation\|b2b\|partner" backend/app/services/consents.py && grep -rni "ai" website/src/views/ --include="*.tsx" -l | xargs grep -lni "consent" | head -3`
- EXPECT: exit 0 with matches (saturation/partner coverage in consents service; AI disclosure in the consent UI).
- IF FAIL: add the missing consent coverage/disclosure, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.4 — Curl-verify DPDP export flow
- PRECONDITION: backend running — start with `cd backend && AI_PROVIDER=shim .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000` and confirm `curl -sf http://localhost:8000/v1/health` succeeds. Locate the exact export endpoint path first with `grep -rn "export" backend/app/routers/users.py backend/app/services/consents.py backend/app/routers/auth.py`.
- DO: register/login a test user via the repo's dev-auth convention, then call the DPDP export endpoint with that user's token.
- RUN: `curl -sf -H "Authorization: Bearer $TEST_TOKEN" http://localhost:8000/v1/users/me/export` (use the exact path found in the PRECONDITION grep if it differs — if the grep finds nothing → STOP, phase-06 deliverable missing)
- EXPECT: HTTP 200 with a JSON archive containing the test user's data.
- IF FAIL: read the error body, fix the export flow, re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 5.5 — Curl-verify DPDP deletion flow
- PRECONDITION: same running server as task 5.4; a second disposable test user (`$TEST_TOKEN2`).
- DO: call the account-deletion endpoint (locate with `grep -rn "delete" backend/app/routers/users.py`), then attempt to fetch the deleted profile.
- RUN: `curl -sf -X DELETE -H "Authorization: Bearer $TEST_TOKEN2" http://localhost:8000/v1/users/me && curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TEST_TOKEN2" http://localhost:8000/v1/users/me`
- EXPECT: deletion returns 200; the follow-up fetch prints `404` or `410` (use the exact paths from the grep if they differ — if no deletion endpoint exists → STOP, phase-06 deliverable missing).
- IF FAIL: read the error body, fix the deletion flow, re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 5.6 — Write the DPDP audit report
- DO: write `docs/test-reports/phase-08-dpdp-audit.md` (new) covering, with the evidence from tasks 5.1–5.5: payload minimization/pseudonymization (hashed IDs), no PII in AI payloads, photos only to vision endpoints, provider retention settings, AI disclosure in the consent center, consent coverage for every data use (incl. saturation opt-in + WS-03 B2B aggregates), and the working export + deletion flows. End with a sign-off line: `DPDP audit signed: <name> <today's date>`.
- RUN: `test -f docs/test-reports/phase-08-dpdp-audit.md && grep -q "DPDP audit signed" docs/test-reports/phase-08-dpdp-audit.md`
- EXPECT: exit 0.
- IF FAIL: complete the report, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.7 — Run the backdoor grep sweep
- DO: run the exact sweep from instructions.md and inspect every match: with `APP_ENV=prod` every phase-00 backdoor must be dead — MPIN `1234` bypass, `dev-`/`demo-` token acceptance, `/auth/quick-login` hardcoded accounts, Razorpay signature `"dev"`, `rzp_test_dev` fallback. Read the surrounding lines of each match to confirm it sits inside an `APP_ENV=dev`-gated branch.
- RUN: `grep -rn "1234\|quick-login\|rzp_test_dev\|'dev'" backend/app/ --include="*.py"`
- EXPECT: every matched line is inside a branch gated on `APP_ENV=dev` / `AI_PROVIDER=shim` (dev fixtures only); zero matches in prod-reachable code.
- IF FAIL: gate or remove the ungated backdoor path, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.8 — Verify prod startup fails without JWT secret
- DO: verify startup fails fast in prod config when the JWT secret is unset (no hardcoded default).
- RUN: `cd backend && APP_ENV=prod JWT_SECRET= .venv/bin/python -c "import app.core.config" ; test $? -ne 0`
- EXPECT: the import raises (non-zero exit), so the final `test` passes — startup refuses to run with an unset secret in prod.
- IF FAIL: add startup validation in `backend/app/core/config.py` raising when `APP_ENV=prod` and the secret is unset, re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 5.9 — Verify CORS is locked to real origins
- PRECONDITION: backend running (same start command as task 5.4).
- DO: read `backend/app/main.py` CORS setup; confirm origins come from per-environment config with no `["*"]`. Then probe with a foreign origin.
- RUN: `grep -n '"\*"' backend/app/main.py backend/app/core/config.py ; curl -s -D - -o /dev/null -H "Origin: https://evil.example" http://localhost:8000/v1/health | grep -i "access-control-allow-origin" ; true`
- EXPECT: no `"*"` literal in CORS config; the foreign-origin response carries NO `access-control-allow-origin: https://evil.example` header (origin rejected).
- IF FAIL: lock `allow_origins` to the configured environment origins, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.10 — Verify secrets come from GCP Secret Manager
- DO: read `backend/app/core/config.py` and confirm secret values resolve from GCP Secret Manager (per the phase-00 pattern), not from committed files. Then sweep the repo for committed private keys.
- RUN: `grep -rn "secretmanager\|secret_manager\|access_secret" backend/app/core/config.py backend/app/core/*.py | head -5 ; git grep -ln "PRIVATE KEY-----" -- . ':!*.md' ; true`
- EXPECT: at least one Secret Manager access match in config; the `git grep` finds no committed private-key material outside documentation.
- IF FAIL: if a committed key file is found (including any legacy `*-adminsdk-*.json` with key material), wire config to Secret Manager per the phase-00 pattern and STOP for the human operator to rotate the exposed key — report the file path.
- [ ]

### Task 5.11 — HUMAN CHECK: Sentry alerts fire on backend and website
- DO: HUMAN CHECK — (1) confirm Sentry is initialized in the backend (`grep -rn "sentry" backend/app/main.py backend/app/core/*.py`) and on the website (`grep -rn "sentry\|Sentry" website/src/`) — both greps must match, else STOP; (2) on staging, trigger a deliberate test error on the backend (the Sentry test endpoint if phase-00 added one, else a temporary throw on a dev route — remove it after) and one on the website; (3) confirm both alert rules fire and the alerts arrive at the configured channel.
- RUN: `grep -rn "sentry" backend/app/main.py backend/app/core/ website/src/ | head -5`
- EXPECT: matches in both backend and website; human confirms both test alerts were received.
- IF FAIL: record which side is missing alert delivery and STOP (playbook §5) with the observation.
- [ ]

### Task 5.12 — Run settlement/TDS test suite
- DO: run the existing settlement tests as the scripted pre-check for the staging settlement run (task 5.13).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_settlements.py -q`
- EXPECT: all tests pass, exit 0 — per-transaction TDS 194-O ledger entries and GST invoice generation covered, amounts integer paisa, every mutation in `audit_logs` (rule 3).
- IF FAIL: fix the code (never the test assertions), re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 5.13 — HUMAN CHECK: staging settlement run with real keys
- DO: HUMAN CHECK — on staging configured with REAL Razorpay/RazorpayX keys (human operator provides them): (1) trigger the weekly settlement run from the admin console; (2) verify per-transaction TDS 194-O ledger entries generate with correct integer-paisa amounts; (3) verify GST invoices generate for vyapari sales AND platform commission invoices to business personas; (4) verify every financial mutation has an `audit_logs` entry; (5) append the evidence (run id, ledger counts, invoice numbers) to `docs/launch-checklist.md` as a row: `| Staging settlement run (real keys) | TDS 194-O ledger + GST invoices correct | <today's date> | PASS |`.
- RUN: `grep -q "Staging settlement run" docs/launch-checklist.md`
- EXPECT: exit 0 after the human records the evidence row.
- IF FAIL: record what was incorrect (ledger/invoice/audit) and STOP (playbook §5) with the observation.
- [ ]

### Task 5.14 — Localize legal pages to en+hi
- PRECONDITION: `test -f website/src/views/legal/LegalPage.tsx` — if this fails, STOP the phase (playbook §5).
- DO: edit `website/src/views/legal/LegalPage.tsx` (and any other file under `website/src/views/legal/` with hardcoded copy) — move every hardcoded user-facing legal string into `t()` keys, adding each key with full text to BOTH `website/src/lib/i18n/locales/en.ts` and `website/src/lib/i18n/locales/hi.ts` (X18). No `?? <number>` fallbacks; no English-only strings (rule 6).
- RUN: `cd website && pnpm exec tsc --noEmit && grep -q "legal" src/lib/i18n/locales/hi.ts`
- EXPECT: exit 0 (types clean; legal keys present in the hi locale).
- IF FAIL: add the missing keys, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.15 — Run the locale parity gate
- DO: run the en/hi key-parity gate established in phase-06. Locate it first: `grep -rn "parity" website/package.json .github/workflows/ backend/ 2>/dev/null | grep -v node_modules | head`. If no parity gate exists → STOP (phase-06 CI gate deliverable missing).
- RUN: the exact parity command found above (e.g. `cd website && pnpm run <parity-script>` or the CI step's command).
- EXPECT: parity check passes, exit 0 — en and hi key sets identical.
- IF FAIL: add the missing keys named by the checker to the missing locale, re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 5.16 — Run SaaS entitlement test suites
- DO: run the repo's per-persona entitlement suites as the scripted base of the pricing-shelf validation.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_saas_dairy_manager.py tests/test_saas_emarket_customer.py tests/test_saas_equipment_owner.py tests/test_saas_landlord.py tests/test_saas_teachers.py -q`
- EXPECT: all tests pass, exit 0.
- IF FAIL: fix the entitlement enforcement code (never the tests), re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 5.17 — Verify farmer core loop is never paywalled
- DO: verify rule 5 — the farmer's core grow-sell-insure loop carries no entitlement gate. Read the entitlements service (phase-00 billing module) and confirm no farmer core action is tier-limited.
- RUN: `grep -rni "farmer" backend/app/services/ --include="*.py" | grep -i "entitle\|tier\|paywall\|plan" ; true`
- EXPECT: no output lines, OR every match is a comment/exemption stating the farmer is exempt — never an enforcement branch gating a farmer core action.
- IF FAIL: remove the farmer paywall gate, re-run the task-5.16 suites to confirm green — else STOP (playbook §5) with full output.
- [ ]

### Task 5.18 — Verify commission config in platform_config/settlements
- DO: read the settlements config path (`grep -rn "platform_config" backend/app/services/settlements.py backend/app/routers/settlements.py`) and confirm commission rates live in `platform_config/settlements`, are effective-dated and versioned, and are admin-editable with maker-checker (rule 8 audit trail). Confirm the robust §10 rates are representable: Transporter 10%; Vyapari 2% min ₹50 (5000 paisa); Equipment Owner 12%; Broker 2% (0–10 configurable); Dairy 3% milk / 5% produce / 2% livestock; Instructor 15–20% course GMV; Direct Buyer 1–2% settlement; e-Market 5% seller-side.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_settlements.py tests/test_admin_finance.py -q`
- EXPECT: all tests pass, exit 0.
- IF FAIL: fix the config/enforcement code, re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 5.19 — HUMAN CHECK: Landlord upgrade→pay→unlock
- DO: HUMAN CHECK — on staging with Razorpay staging keys, as a Landlord on the Free tier (1 plot/1 lease): (1) attempt to add a 2nd plot/lease → upgrade prompt appears; (2) complete the ₹299/mo Pro subscription via Razorpay checkout; (3) confirm entitlement unlock in the API response AND the UI (2nd plot now allowed); (4) append evidence row to `docs/launch-checklist.md`: `| Landlord Free→Pro ₹299 | upgrade→pay→unlock proven | <today's date> | PASS |`.
- RUN: `grep -q "Landlord Free→Pro" docs/launch-checklist.md`
- EXPECT: exit 0 after the evidence row exists.
- IF FAIL: record the failing step and STOP (playbook §5) with the observation.
- [ ]

### Task 5.20 — HUMAN CHECK: Transporter upgrade→pay→unlock
- DO: HUMAN CHECK — as a Transporter on Free (1 vehicle): hit the vehicle limit → upgrade prompt → ₹499/mo Pro Razorpay subscription → unlock observed in API + UI. Append row `| Transporter Free→Pro ₹499 | upgrade→pay→unlock proven | <today's date> | PASS |` to `docs/launch-checklist.md`.
- RUN: `grep -q "Transporter Free→Pro" docs/launch-checklist.md`
- EXPECT: exit 0 after the evidence row exists.
- IF FAIL: record the failing step and STOP (playbook §5) with the observation.
- [ ]

### Task 5.21 — HUMAN CHECK: Vyapari upgrade→pay→unlock
- DO: HUMAN CHECK — as a Vyapari on Free (basic khata): hit the Free-tier limit → upgrade prompt → ₹999/mo Pro Razorpay subscription → unlock observed in API + UI. Append row `| Vyapari Free→Pro ₹999 | upgrade→pay→unlock proven | <today's date> | PASS |` to `docs/launch-checklist.md`.
- RUN: `grep -q "Vyapari Free→Pro" docs/launch-checklist.md`
- EXPECT: exit 0 after the evidence row exists.
- IF FAIL: record the failing step and STOP (playbook §5) with the observation.
- [ ]

### Task 5.22 — HUMAN CHECK: Equipment Owner upgrade→pay→unlock
- DO: HUMAN CHECK — as an Equipment Owner on Free (1 machine): hit the machine limit → upgrade prompt → ₹399/mo Pro Razorpay subscription → unlock observed in API + UI. Append row `| Equipment Owner Free→Pro ₹399 | upgrade→pay→unlock proven | <today's date> | PASS |` to `docs/launch-checklist.md`.
- RUN: `grep -q "Equipment Owner Free→Pro" docs/launch-checklist.md`
- EXPECT: exit 0 after the evidence row exists.
- IF FAIL: record the failing step and STOP (playbook §5) with the observation.
- [ ]

### Task 5.23 — HUMAN CHECK: Broker upgrade→pay→unlock
- DO: HUMAN CHECK — as a Broker on Free (5 deals): attempt a 6th deal → upgrade prompt → ₹799/mo Pro Razorpay subscription → unlock observed in API + UI. Append row `| Broker Free→Pro ₹799 | upgrade→pay→unlock proven | <today's date> | PASS |` to `docs/launch-checklist.md`.
- RUN: `grep -q "Broker Free→Pro" docs/launch-checklist.md`
- EXPECT: exit 0 after the evidence row exists.
- IF FAIL: record the failing step and STOP (playbook §5) with the observation.
- [ ]

### Task 5.24 — HUMAN CHECK: Dairy Manager upgrade→pay→unlock
- DO: HUMAN CHECK — as a Dairy Manager on Free (25 members): attempt to add member 26 → upgrade prompt → ₹1,499/mo Pro Razorpay subscription → unlock observed in API + UI. Append row `| Dairy Manager Free→Pro ₹1,499 | upgrade→pay→unlock proven | <today's date> | PASS |` to `docs/launch-checklist.md`.
- RUN: `grep -q "Dairy Manager Free→Pro" docs/launch-checklist.md`
- EXPECT: exit 0 after the evidence row exists.
- IF FAIL: record the failing step and STOP (playbook §5) with the observation.
- [ ]

### Task 5.25 — HUMAN CHECK: Instructor upgrade→pay→unlock
- DO: HUMAN CHECK — as an Instructor on Free (1 course): attempt a 2nd course → upgrade prompt → ₹499/mo Pro Razorpay subscription → unlock observed in API + UI. Append row `| Instructor Free→Pro ₹499 | upgrade→pay→unlock proven | <today's date> | PASS |` to `docs/launch-checklist.md`.
- RUN: `grep -q "Instructor Free→Pro" docs/launch-checklist.md`
- EXPECT: exit 0 after the evidence row exists.
- IF FAIL: record the failing step and STOP (playbook §5) with the observation.
- [ ]

### Task 5.26 — HUMAN CHECK: Direct Buyer upgrade→pay→unlock
- DO: HUMAN CHECK — as a Direct Buyer on Free (1 contract): attempt a 2nd contract → upgrade prompt → ₹4,999/mo Pro Razorpay subscription → unlock observed in API + UI. Append row `| Direct Buyer Free→Pro ₹4,999 | upgrade→pay→unlock proven | <today's date> | PASS |` to `docs/launch-checklist.md`.
- RUN: `grep -q "Direct Buyer Free→Pro" docs/launch-checklist.md`
- EXPECT: exit 0 after the evidence row exists.
- IF FAIL: record the failing step and STOP (playbook §5) with the observation.
- [ ]

### Task 5.27 — HUMAN CHECK: e-Market Customer upgrade→pay→unlock
- DO: HUMAN CHECK — as an e-Market Customer: trigger the business-invoicing Pro feature → upgrade prompt → Razorpay subscription → unlock observed in API + UI. Append row `| e-Market Customer Free→Pro (business invoicing) | upgrade→pay→unlock proven | <today's date> | PASS |` to `docs/launch-checklist.md`.
- RUN: `grep -q "e-Market Customer Free→Pro" docs/launch-checklist.md`
- EXPECT: exit 0 after the evidence row exists.
- IF FAIL: record the failing step and STOP (playbook §5) with the observation.
- [ ]

### Task 5.28 — HUMAN CHECK: Bank/Insurance/Cold Storage console seats
- DO: HUMAN CHECK — as a Bank (or Insurance / Cold Storage) admin: hit the console-seat boundary → upgrade prompt → ₹2,000/seat Razorpay payment → seat unlock observed in API + UI. Append row `| Bank/Insurance/Cold Storage console seats ₹2,000/seat | upgrade→pay→unlock proven | <today's date> | PASS |` to `docs/launch-checklist.md`.
- RUN: `grep -q "console seats" docs/launch-checklist.md`
- EXPECT: exit 0 after the evidence row exists.
- IF FAIL: record the failing step and STOP (playbook §5) with the observation.
- [ ]

### Task 5.29 — HUMAN CHECK: legal pages render fully in Hindi
- DO: HUMAN CHECK — on staging, switch the website language to Hindi and open every page under the legal section: confirm all legal copy renders in Hindi with no English fallback strings and no untranslated keys visible.
- RUN: none (manual).
- EXPECT: human confirms full Hindi rendering on every legal page.
- IF FAIL: note the untranslated strings, add the missing hi keys (task 5.14's files), re-run the parity gate (task 5.15) — else STOP (playbook §5).
- [ ]

### Task 5.30 — Run WS-05 verification and commit
- DO: run the WS-05 verification block from instructions.md, then commit.
- RUN: `cd backend && APP_ENV=prod AI_PROVIDER=shim .venv/bin/python -m pytest -q && cd ../website && pnpm exec tsc --noEmit && pnpm build && cd .. && git add -A && git commit -m "phase-08 WS-05: compliance & launch readiness"`
- EXPECT: prod-config suite fully green; website clean; commit created (exit 0).
- IF FAIL: fix the reported failure, re-run once — else STOP (playbook §5) with full output.
- [ ]

## WS-06 — Beta launch checklist & deferral ledger  (see instructions.md §WS-06)

### Task 6.1 — Create the deferral ledger skeleton
- DO: create `docs/deferral-ledger.md` (new — or keep the file if task 1.21 already created it) with header `# AGROVERCITY Deferral Ledger (robust.md §13 rule 10)` and a table with columns `| ID | Item | Status (SHIPPED / DEFERRED / RETIRED) | Evidence link or dated deferral note |`. Rule 10: every persona/module/AI catalog ID ships or gets an explicit dated deferral — silence fails the gate.
- RUN: `test -f docs/deferral-ledger.md && grep -q "SHIPPED / DEFERRED / RETIRED" docs/deferral-ledger.md`
- EXPECT: exit 0.
- IF FAIL: write the header/table, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 6.2 — Ledger part A: personas and modules
- DO: edit `docs/deferral-ledger.md` — add one row for each of robust.md §6.1–6.14 personas (Farmer, Landlord, Transporter, Vyapari, Equipment Owner, Broker, Dairy Manager, Instructor, Direct Buyer, e-Market Customer, Bank, Insurance, Cold Storage, Gaushala+Vet) and each of robust.md §7.1–7.24 modules (read `missing-features/robust.md` §6/§7 for the exact names). Mark each SHIPPED with an evidence link (phase tasks/test file) or DEFERRED with an explicit dated note. No row may be left blank.
- RUN: `awk -F'|' 'NF>3 && $3 !~ /Status/ {print}' docs/deferral-ledger.md | grep -vc "SHIPPED\|DEFERRED\|RETIRED"`
- EXPECT: prints `0` (every filled row carries a status).
- IF FAIL: fill the unmarked rows, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 6.3 — Ledger part B: AI catalog
- DO: edit `docs/deferral-ledger.md` — add one row per AI catalog ID A1–A13, B1–B17, C2–C20 (read `missing-features/ai.md` §4 for the exact list). Mark C1, C19, and brief M27 as `RETIRED` (voice AI descoped — record it as such). Every other ID is SHIPPED (evidence) or DEFERRED (dated note).
- RUN: `grep -c "RETIRED" docs/deferral-ledger.md && awk -F'|' 'NF>3 && $3 !~ /Status/ {print}' docs/deferral-ledger.md | grep -vc "SHIPPED\|DEFERRED\|RETIRED"`
- EXPECT: at least 3 RETIRED rows (C1, C19, M27); the second command prints `0`.
- IF FAIL: complete the catalog rows, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 6.4 — Ledger part C: phases 00–07 workstreams
- DO: edit `docs/deferral-ledger.md` — add one row per workstream of phases 00–07 (read each `execution-plan/phase-0X/readme.md` workstream table for the exact WS list). Mark each SHIPPED (its phase exit gate passed — evidence: the phase's commit history) or DEFERRED with a dated note.
- RUN: `awk -F'|' 'NF>3 && $3 !~ /Status/ {print}' docs/deferral-ledger.md | grep -vc "SHIPPED\|DEFERRED\|RETIRED"`
- EXPECT: prints `0`.
- IF FAIL: fill the unmarked rows, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 6.5 — Adjudicate the named deferral candidates
- DO: edit `docs/deferral-ledger.md` — add explicit dated decision rows (SHIPPED or DEFERRED, never silent) for each of: (1) C18 WhatsApp companion bot (deferral only allowed as post-DLT/template-approval dated note); (2) streaming infra beyond embedded licensed streams (X16); (3) Mahabhulekh/e-District real adapter; (4) carbon MRV integration; (5) BNPL partner integration.
- RUN: `for item in "WhatsApp" "streaming" "Mahabhulekh" "carbon MRV" "BNPL"; do grep -qi "$item" docs/deferral-ledger.md || echo "MISSING: $item"; done`
- EXPECT: no `MISSING:` lines.
- IF FAIL: add the missing adjudication rows, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 6.6 — Verify ledger completeness (no silent items)
- DO: final completeness sweep of the ledger — no TODO/TBD/empty-status cells anywhere.
- RUN: `grep -niE "TBD|TODO|silence" docs/deferral-ledger.md ; awk -F'|' 'NF>3 && $3 !~ /Status/ {print}' docs/deferral-ledger.md | grep -vc "SHIPPED\|DEFERRED\|RETIRED"`
- EXPECT: the grep prints nothing; the awk pipeline prints `0`.
- IF FAIL: resolve every unmarked/placeholder row, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 6.7 — Write the ops runbook
- DO: create `docs/deployment/ops-runbook.md` (new — follow the style of the existing files in `docs/deployment/`) covering: (1) deploy steps for backend + website + Firestore indexes/rules; (2) rollback steps for each; (3) on-call rotation + alert routing (Sentry → who, with the escalation path); (4) the AI kill-switch procedure — flipping `platform_config/ai` module flags and budget caps (`AI_DAILY_BUDGET_USD`) to degrade AI cleanly.
- RUN: `test -f docs/deployment/ops-runbook.md && grep -qi "rollback" docs/deployment/ops-runbook.md && grep -q "platform_config/ai" docs/deployment/ops-runbook.md`
- EXPECT: exit 0.
- IF FAIL: complete the missing sections, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 6.8 — HUMAN CHECK: rehearse one rollback on staging
- DO: HUMAN CHECK — on staging, execute the runbook's rollback procedure once end-to-end (deploy a known-good previous revision of the backend and website per the runbook, verify health, then roll forward again). Time it and record the duration in `docs/deployment/ops-runbook.md` under a "Rehearsal log" heading with today's date.
- RUN: `grep -qi "Rehearsal log" docs/deployment/ops-runbook.md`
- EXPECT: exit 0 after the rehearsal is logged.
- IF FAIL: record what blocked the rollback and STOP (playbook §5) with the observation.
- [ ]

### Task 6.9 — Write the investor demo-cut script
- DO: create `docs/deployment/demo-cut-script.md` (new): the exact click-by-click staging narrative with zero offline steps — farmer posts a lot → vyapari pays via escrow → transporter delivers with POD (handover OTP release) → commission settles to the platform in the weekly run → dashboard shows the whole story as completed tasks → dairy manager upgrades to Pro (R1 + R2 + R3 in one narrative). Include per-beat timings and the staging test accounts/data setup needed.
- RUN: `test -f docs/deployment/demo-cut-script.md && grep -qi "escrow" docs/deployment/demo-cut-script.md && grep -qi "POD\|handover OTP" docs/deployment/demo-cut-script.md`
- EXPECT: exit 0.
- IF FAIL: complete the script, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 6.10 — HUMAN CHECK: run and record the demo-cut
- DO: HUMAN CHECK — perform the demo-cut script live on staging start to finish, zero offline steps; record it (screen recording); note the total runtime; append the recording link/path and the timing to `docs/deployment/demo-cut-script.md` under a "Recording" heading with today's date.
- RUN: `grep -qi "Recording" docs/deployment/demo-cut-script.md`
- EXPECT: exit 0 after the recording reference is logged; human confirms every beat completed live.
- IF FAIL: record the failing beat and STOP (playbook §5) with the observation.
- [ ]

### Task 6.11 — HUMAN CHECK: flow 5.1 farmer morning
- DO: HUMAN CHECK — on the website (staging, flags on), as a farmer: open the dashboard in a fresh session → confirm the AI-ranked dashboard and hero card render with real data → tap the hero task deep-link → complete the action to its end state.
- RUN: none (manual).
- EXPECT: human confirms ranked dashboard + hero card work end-to-end with no dead ends.
- IF FAIL: record the failing step and STOP (playbook §5) with the observation.
- [ ]

### Task 6.12 — HUMAN CHECK: flow 5.2 AI-assisted sell
- DO: HUMAN CHECK — as a farmer on staging: start the sell flow from the dashboard task → confirm AI prefill of the lot form → confirm "AI sujhav" badges on recommendations → read the coach output → complete the sale through the handover OTP → confirm the diary entry appears.
- RUN: none (manual).
- EXPECT: human confirms prefill → badges → coach → OTP → diary, all end-to-end.
- IF FAIL: record the failing step and STOP (playbook §5) with the observation.
- [ ]

### Task 6.13 — HUMAN CHECK: flow 5.3 disease emergency
- DO: HUMAN CHECK — as a farmer on staging: open the crop-doctor/disease flow → pass the confidence gate (low-confidence input must route to the fallback, not a guess) → submit a photo through the vision path → confirm the expert handoff is offered/completed.
- RUN: none (manual).
- EXPECT: human confirms gate → vision → expert handoff end-to-end.
- IF FAIL: record the failing step and STOP (playbook §5) with the observation.
- [ ]

### Task 6.14 — HUMAN CHECK: flow 5.4 onboarding under 60s
- DO: HUMAN CHECK — repeat the task-1.47 onboarding pass as the final validation: GPS → language pre-selected → crops pre-selected → touch-only completion → pre-seeded dashboard, timing it again.
- RUN: none (manual).
- EXPECT: human confirms time-to-first-action <60s.
- IF FAIL: record the measured time and failing step; STOP (playbook §5) with the observation.
- [ ]

### Task 6.15 — HUMAN CHECK: flow 5.5 transporter day
- DO: HUMAN CHECK — as a transporter on staging: open the morning dashboard → accept a trip from the ranked tasks → complete pickup and delivery including the weighbridge-slip/trip-record path and the POD with handover OTP → confirm payout visibility.
- RUN: none (manual).
- EXPECT: human confirms the full transporter day end-to-end.
- IF FAIL: record the failing step and STOP (playbook §5) with the observation.
- [ ]

### Task 6.16 — HUMAN CHECK: flow 5.6 vyapari morning
- DO: HUMAN CHECK — as a vyapari on staging: open the morning dashboard → confirm the band/credit warning renders INLINE (not a blocking dialog) → complete a procurement entry including the weigh-slip path if wired (task 1.21) → confirm khata updates.
- RUN: none (manual).
- EXPECT: human confirms the inline band warning and the full procurement loop.
- IF FAIL: record the failing step and STOP (playbook §5) with the observation.
- [ ]

### Task 6.17 — HUMAN CHECK: flow 5.7 bank queue
- DO: HUMAN CHECK — as a bank persona on staging: open the loan queue → confirm AI sorting/ranking of applications → confirm a human makes every decision (AI sorts, human decides — no auto-approval path exists) → approve/reject one application and confirm the audit trail entry.
- RUN: none (manual).
- EXPECT: human confirms AI-sorted queue, human-only decisions, audit entry written.
- IF FAIL: record the failing step and STOP (playbook §5) with the observation.
- [ ]

### Task 6.18 — HUMAN CHECK: flow 5.8 insurance claim
- DO: HUMAN CHECK — as a farmer on staging: file an insurance claim → confirm instant AI triage feedback (suggest-level) → confirm the claim tracker shows live status through resolution.
- RUN: none (manual).
- EXPECT: human confirms instant feedback → tracker end-to-end.
- IF FAIL: record the failing step and STOP (playbook §5) with the observation.
- [ ]

### Task 6.19 — HUMAN CHECK: flow 5.9 landlord lease
- DO: HUMAN CHECK — as a landlord on staging: complete the lease flow from listing/draft → tenant match → signed lease → rent schedule visible, all from dashboard tasks.
- RUN: none (manual).
- EXPECT: human confirms the lease flow end-to-end.
- IF FAIL: record the failing step and STOP (playbook §5) with the observation.
- [ ]

### Task 6.20 — HUMAN CHECK: flow 5.10 admin ops morning
- DO: HUMAN CHECK — as a superadmin on staging: open the admin console → read the copilot morning briefing → follow at least two deep links from the briefing into the underlying queues → confirm each deep link lands on the correct filtered view.
- RUN: none (manual).
- EXPECT: human confirms briefing → deep links end-to-end.
- IF FAIL: record the failing step and STOP (playbook §5) with the observation.
- [ ]

### Task 6.21 — README §5 item 1: phase gates and persona loops
- DO: verify all 8 phase exit gates passed: open each `execution-plan/phase-0X/readme.md` exit-gate section and confirm every box is checked (or its tasks.md fully checked). Then confirm each persona's core loop ran end-to-end on the website with zero offline steps (evidence: the flow checks 6.11–6.20 plus earlier-phase flow records).
- RUN: `grep -l "\[ \]" execution-plan/phase-0*/readme.md ; true`
- EXPECT: no output (no unchecked exit-gate boxes in any phase readme).
- IF FAIL: the named phase gate is open — STOP the phase (playbook §5) and report which phase.
- [ ]

### Task 6.22 — README §5 item 2: all 24 modules real, zero coming-soon
- DO: verify all 24 platform modules resolve to real pages and global search is live (locate the search surface with `grep -rln "search" website/src/views/ website/src/components/` and confirm it is routed).
- RUN: `grep -rni "coming soon" website/src/ ; true`
- EXPECT: no output (zero "coming soon" reachable anywhere in the website).
- IF FAIL: the named tile/page is unshipped — it needs a dated deferral row in `docs/deferral-ledger.md` (task 6.2) and removal of the "coming soon" reachability; re-run — else STOP (playbook §5).
- [ ]

### Task 6.23 — README §5 item 3: real money evidence
- DO: confirm the money-rails evidence exists: Razorpay order/verify/webhook, escrow release on handover OTP, weekly RazorpayX payouts, TDS 194-O ledger, GST invoices — exercised in staging with real API keys (WS-05 evidence row).
- RUN: `grep -q "Staging settlement run" docs/launch-checklist.md && cd backend && .venv/bin/python -m pytest tests/test_settlements.py tests/test_admin_finance.py -q`
- EXPECT: evidence row present; settlement tests green (exit 0).
- IF FAIL: complete the missing evidence (re-run task 5.13) — else STOP (playbook §5).
- [ ]

### Task 6.24 — README §5 item 4: SaaS billing proven per persona
- DO: confirm one upgrade→pay→unlock evidence row exists for every business persona row of the robust §10 matrix.
- RUN: `for p in "Landlord" "Transporter" "Vyapari" "Equipment Owner" "Broker" "Dairy Manager" "Instructor" "Direct Buyer" "e-Market Customer" "console seats"; do grep -q "$p" docs/launch-checklist.md || echo "MISSING: $p"; done`
- EXPECT: no `MISSING:` lines.
- IF FAIL: complete the missing persona's flow (tasks 5.19–5.28) — else STOP (playbook §5).
- [ ]

### Task 6.25 — README §5 item 5: AI catalog, dashboards, logging, calibration
- DO: confirm (1) every active AI catalog ID is live behind flags or dated-deferred (ledger part B, task 6.3); (2) all persona dashboards are AI-ranked (spot-check the dashboard registry `website/src/lib/dashboard.ts` against the ranking service); (3) `ai_decisions` logging + budgets + weekly calibration are running (tasks 2.10–2.11); (4) the full suite passes with `AI_PROVIDER=shim`.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q`
- EXPECT: fully green, exit 0.
- IF FAIL: fix the failing test's root cause, re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task 6.26 — README §5 item 6: admin console operational
- DO: confirm the 27 superadmin modules are operational with RBAC, audit logs, and maker-checker, and the KYC queue is real (no hardcoded samples — grep the KYC queue source for sample fixtures).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_admin.py -q && grep -rni "sample\|hardcod" backend/app/routers/admin.py ; true`
- EXPECT: admin tests green; no hardcoded-sample matches in the admin KYC paths (matches only in comments are acceptable).
- IF FAIL: fix the named gap, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 6.27 — README §5 item 7: cross-cutting services live
- DO: confirm each cross-cutting service exists and is reachable: chat hub with guardrails, push notifications with deep links, consent center + DPDP export/deletion, installable PWA (manifest + service worker), en/hi parity gate in CI, analytics taxonomy.
- RUN: `test -f website/public/manifest.webmanifest -o -f website/manifest.webmanifest -o -f website/public/manifest.json ; grep -rln "serviceWorker\|workbox\|vite-plugin-pwa" website/src/ website/vite.config.* ; grep -rln "analytics" backend/app/routers/ website/src/lib/ | head -3`
- EXPECT: PWA manifest + service worker found; analytics surface found. If any leg is missing → it is a phase-06 deliverable: STOP (playbook §5).
- IF FAIL: STOP (playbook §5) naming the missing cross-cutting leg.
- [ ]

### Task 6.28 — README §5 item 8: hardening evidence complete
- DO: confirm the hardening evidence set is complete: no demo backdoor with `APP_ENV=prod` (task 5.7), CORS locked (task 5.9), Sentry on backend + website (task 5.11), load test passed (task 4.11 CSV), DPDP audit signed (task 5.6), launch checklist being signed.
- RUN: `test -f docs/test-reports/phase-08-dpdp-audit.md && test -f .run-logs/phase-08-load_stats.csv && grep -q "DPDP audit signed" docs/test-reports/phase-08-dpdp-audit.md`
- EXPECT: exit 0.
- IF FAIL: complete the missing evidence artifact via its owning task — else STOP (playbook §5).
- [ ]

### Task 6.29 — Sign the README §5 checklist with evidence links
- DO: append a `## Production-ready-beta sign-off (execution-plan/README.md §5)` section to `docs/launch-checklist.md` with all 8 README §5 items as `- [x]` lines, each followed by its evidence pointer (task ids and artifact paths from tasks 6.21–6.28). Then append the final line: `Launch checklist signed off: <name> <today's date>`.
- RUN: `grep -c "\- \[x\]" docs/launch-checklist.md && grep -q "Launch checklist signed off" docs/launch-checklist.md`
- EXPECT: at least 8 checked items; the sign-off line present (exit 0).
- IF FAIL: complete the sign-off section, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 6.30 — Commit WS-06 checkpoint
- DO: stage and commit all WS-06 work.
- RUN: `git add -A && git commit -m "phase-08 WS-06: beta launch checklist & deferral ledger"`
- EXPECT: commit created (exit 0). If git identity is missing, note it and continue (playbook §6).
- IF FAIL: check `git status` for the cause, fix, re-run once — else note it and continue per playbook §6.
- [ ]

## Phase-final gate

### Task G.1 — M26/M28/M29/M33 green behind flags on shim
- DO: run the four features' test suites with the shim provider (phase readme exit-gate item 1).
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_shg_readiness.py tests/test_receipt_scan.py tests/test_churn.py tests/test_agent_rules.py -q`
- EXPECT: all tests pass, exit 0.
- IF FAIL: fix the failing feature's code, re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task G.2 — Golden datasets in CI + nightly and calibration live
- DO: confirm the CI golden step and the nightly schedule exist (tasks 2.6–2.7), the >5pt alert path is tested (task 2.8), and 4+ weekly calibration reports feed the AI Health page (task 2.11).
- RUN: `grep -rn "golden" .github/workflows/*.yml && cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q -k "calibration or contract or golden"`
- EXPECT: workflow matches present; selected tests green (exit 0).
- IF FAIL: complete the missing leg via its owning WS-02 task — else STOP (playbook §5).
- [ ]

### Task G.3 — Gateway 100 rps load test with clean budget trip
- PRECONDITION: backend running with a low budget — `cd backend && AI_PROVIDER=shim AI_DAILY_BUDGET_USD=0.01 .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000` and `curl -sf http://localhost:8000/v1/health` succeeds.
- DO: re-run the gateway load test as the exit-gate proof.
- RUN: `cd backend && .venv/bin/locust -f tests/load/ai_gateway_locustfile.py --headless -u 100 -r 20 -t 3m --host http://localhost:8000`
- EXPECT: 0 failures; budget trip degrades to deterministic fallbacks with `fallbackUsed` logged; zero 5xx; no caller exceptions.
- IF FAIL: fix the degradation path, re-run once — else STOP (playbook §5) with the load report.
- [ ]

### Task G.4 — Automation-raise evidence gate holds
- DO: re-run the phase-G gate tests as the exit-gate proof (≥1,000 outcomes + >90% accuracy + maker-checker; credit/insurance/legal still capped).
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_phase_g_gate.py -q`
- EXPECT: all tests pass, exit 0.
- IF FAIL: fix the gate code, re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task G.5 — B2B API live with metering
- PRECONDITION: backend running (task 5.4 start command); a valid non-revoked test key `$PARTNER_KEY` from task 3.13.
- DO: re-verify the partner endpoints and the 403 negative case as the exit-gate proof.
- RUN: `curl -sf -H "X-API-Key: $PARTNER_KEY" "http://localhost:8000/v1/partner/mandi/prices?crop=wheat&district=meerut" && curl -sf -H "X-API-Key: $PARTNER_KEY" "http://localhost:8000/v1/partner/advisory/saturation?district=meerut&crop=wheat" && cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_partner_api.py -q`
- EXPECT: both curls return 200 aggregates; the metering tests pass (exit 0).
- IF FAIL: fix the failing leg, re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task G.6 — Bundle, indexes, and TTL verified
- DO: re-measure the first-load bundle, re-confirm index deployment state, and confirm the `ai_decisions` 90-day TTL is active.
- RUN: `cd website && pnpm build && for f in dist/assets/index-*.js; do test $(gzip -c "$f" | wc -c) -lt 409600; done && cd .. && grep -q "first-load JS" docs/launch-checklist.md`
- EXPECT: exit 0 (entry chunk < 400 KB gzipped; the recorded launch-checklist row matches the fresh measurement).
- IF FAIL: re-apply task 4.7/4.8 fixes, re-run once — else STOP (playbook §5) with the numbers.
- [ ]

### Task G.7 — Compliance sweep clean
- DO: re-run the compliance spot checks: backdoor grep, prod-secret startup failure, CORS foreign-origin rejection, DPDP signature present.
- RUN: `grep -rn "1234\|quick-login\|rzp_test_dev\|'dev'" backend/app/ --include="*.py" | grep -v "APP_ENV" ; test $? -ne 0 && grep -q "DPDP audit signed" docs/test-reports/phase-08-dpdp-audit.md`
- EXPECT: no ungated backdoor lines (grep finds nothing outside APP_ENV gates); DPDP audit signed (exit 0).
- IF FAIL: fix the ungated path or missing signature via its owning task — else STOP (playbook §5).
- [ ]

### Task G.8 — TDS/GST staging evidence present
- DO: confirm the staging settlement evidence (TDS 194-O ledger + GST invoices, real keys) is recorded.
- RUN: `grep -q "Staging settlement run" docs/launch-checklist.md`
- EXPECT: exit 0.
- IF FAIL: complete task 5.13 — else STOP (playbook §5).
- [ ]

### Task G.9 — Pricing shelf evidence complete
- DO: confirm every robust §10 tier row has a proven upgrade→pay→unlock evidence entry.
- RUN: `for p in "Landlord" "Transporter" "Vyapari" "Equipment Owner" "Broker" "Dairy Manager" "Instructor" "Direct Buyer" "e-Market Customer" "console seats"; do grep -q "$p" docs/launch-checklist.md || echo "MISSING: $p"; done`
- EXPECT: no `MISSING:` lines.
- IF FAIL: complete the missing persona's task 5.19–5.28 — else STOP (playbook §5).
- [ ]

### Task G.10 — Deferral ledger complete
- DO: confirm every persona/module/AI catalog ID is shipped or dated-deferred (rule 10).
- RUN: `awk -F'|' 'NF>3 && $3 !~ /Status/ {print}' docs/deferral-ledger.md | grep -vc "SHIPPED\|DEFERRED\|RETIRED"`
- EXPECT: prints `0`.
- IF FAIL: complete the ledger rows (tasks 6.2–6.5) — else STOP (playbook §5).
- [ ]

### Task G.11 — README §5 checklist fully signed
- DO: confirm the production-ready-beta sign-off section is complete, item by item.
- RUN: `grep -c "\- \[x\]" docs/launch-checklist.md && grep -q "Launch checklist signed off" docs/launch-checklist.md`
- EXPECT: at least 8 checked items and the sign-off line (exit 0).
- IF FAIL: complete tasks 6.21–6.29 — else STOP (playbook §5).
- [ ]

### Task G.12 — ai_implementation_plan §8 done-when signed
- DO: open `missing-features/ai_implementation_plan.md` §8 and append a `## ai_implementation_plan.md §8 done-when` section to `docs/launch-checklist.md` with one `- [x]` line per §8 item (every active AI ID live behind flags or dated-deferred; all persona dashboards AI-ranked; flows 5.1–5.10 work end-to-end on the website; spend metered/capped; weekly calibration running; full suite green with `AI_PROVIDER=shim`), each with its evidence pointer from this phase.
- RUN: `grep -q "done-when" docs/launch-checklist.md`
- EXPECT: exit 0; every §8 item has a checked line with evidence.
- IF FAIL: complete the section (or the underlying missing work via its owning task) — else STOP (playbook §5).
- [ ]

### Task G.13 — Demo-cut rehearsal recorded
- DO: confirm the investor demo-cut was rehearsed end-to-end and recorded (task 6.10).
- RUN: `grep -qi "Recording" docs/deployment/demo-cut-script.md`
- EXPECT: exit 0.
- IF FAIL: complete task 6.10 — else STOP (playbook §5).
- [ ]

### Task G.14 — Global verification gate (execution-plan/README.md §4)
- DO: run the global gate exactly: backend suite fully green (both configs), website clean, shim suite green.
- RUN: `cd backend && .venv/bin/python -m pytest -q && APP_ENV=prod AI_PROVIDER=shim .venv/bin/python -m pytest -q && AI_PROVIDER=shim .venv/bin/python -m pytest -q && cd ../website && pnpm exec tsc --noEmit && pnpm build`
- EXPECT: every command exits 0 — backend green (plain, prod-config shim, shim), tsc clean, build succeeds.
- IF FAIL: if the failure is unrelated to phase-08 work → STOP the phase (playbook §5) with full output; otherwise fix the root cause and re-run once.
- [ ]

### Task G.15 — Locale parity gate green
- DO: re-run the en/hi parity gate located in task 5.15.
- RUN: the exact parity command from task 5.15.
- EXPECT: parity passes, exit 0.
- IF FAIL: add the missing keys named by the checker, re-run once — else STOP (playbook §5) with full output.
- [ ]

### Task G.16 — HUMAN CHECK: final manual pass and nightly golden run
- DO: HUMAN CHECK — (1) confirm the latest nightly golden-set run on live models is green (check the scheduled run's status/artifacts); (2) confirm the current weekly calibration report is visible on the admin AI Health page; (3) on staging with all flags on, re-run the demo-cut start to finish; (4) exercise flows 5.1–5.10 from the dashboard task deep-link to completion — no "coming soon" reachable anywhere; (5) run one end-to-end flow per workstream of THIS phase: SHG readiness card, receipt-scan confirm, churn re-engagement, standing-agent rule fire → confirm, onboarding <60s, partner API key call, upgrade→pay→unlock; (6) repeat steps 3–5 with `AI_PROVIDER=shim`.
- RUN: none (manual).
- EXPECT: human confirms all six checks on both flag configurations.
- IF FAIL: record the failing check and STOP (playbook §5) with the observation.
- [ ]

### Task G.17 — Final phase commit
- DO: commit the completed phase.
- RUN: `git add -A && git commit -m "phase-08: final gate green — production-ready beta"`
- EXPECT: commit created (exit 0). If git identity is missing, note it and continue (playbook §6).
- IF FAIL: check `git status` for the cause, fix, re-run once — else note it and continue per playbook §6.
- [ ]
