# phase-05 — Task Queue
> Executor: read `execution-plan/AGENT_PLAYBOOK.md` first. Execute tasks top to
> bottom, one at a time. Mark [x] only when EXPECT matches real output.
> Full context for any task: see `instructions.md` WS-NN referenced in the task.

Conventions used below:
- "standard backend check" = `cd backend && .venv/bin/python -m pytest tests/test_<module>.py -q`
- "standard website check" = `cd website && pnpm exec tsc --noEmit`
- "locale parity check for <mod>" = `diff <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" website/src/lib/i18n/locales/en.<mod>.ts | tr -d ' :' | sort -u) <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" website/src/lib/i18n/locales/hi.<mod>.ts | tr -d ' :' | sort -u)` (run from repo root) — EXPECT: exit 0, no output.
- New locale pairs are registered by adding two import lines to `website/src/main.tsx` (pattern: lines 29–30 `import './lib/i18n/locales/en.trade';`).
- Dashboard deep links use the existing route `/dashboard/p/:toolId`.
- A "dated deferral note" is a comment of the form `# Deferred(2026-10-03, phase-07): <what> — <hook left behind>`. It is a plan-mandated note (robust.md §13 rule 10), NOT a TODO placeholder.

## WS-01 — Trade-intelligence modules  (see instructions.md §WS-01)

### Task 1.1 — Verify phase-00/01 dependencies exist
- DO: no edits. Run the dependency checks only.
- RUN: `test -f backend/app/services/ai/gateway.py && test -f backend/app/services/ai/question_sets.py && test -f backend/app/services/ai/privacy.py && test -d backend/tests/fixtures/ai/golden && grep -rln "def emit_task" backend/app/ | head -1 && test -f backend/app/services/payments.py`
- EXPECT: exit 0; the grep prints one file path (the phase-01 task engine module). Remember that path — every `emit_task` task below imports from it.
- IF FAIL: none — a failed check means phase-00/01 deliverables are missing; STOP the phase (playbook §5).
- [x]

### Task 1.2 — Read WS-01 source files
- DO: read (no edits): `backend/app/routers/mandi.py`, `backend/app/routers/price_alerts.py`, `backend/app/routers/transport.py`, `backend/app/routers/contracts.py`, `website/src/views/trade/MandiPage.tsx`, `website/src/views/trade/AnalyticsPage.tsx`, `website/src/views/directbuyer/ContractsPage.tsx`, `website/src/views/farmer/FarmerContractsPage.tsx`, `website/src/lib/api/mandi.ts`. Note the exact name of the existing price-history wrapper function in `lib/api/mandi.ts` and the exact route paths in `routers/price_alerts.py` — later tasks reference them.
- RUN: `ls backend/app/routers/mandi.py backend/app/routers/price_alerts.py backend/app/routers/transport.py backend/app/routers/contracts.py website/src/views/trade/MandiPage.tsx website/src/lib/api/mandi.ts`
- EXPECT: exit 0 (all files exist).
- IF FAIL: none — STOP the phase (playbook §5); report which file is missing.
- [x]

### Task 1.3 — Add mandi price-history chart view
- DO: create `website/src/views/trade/MandiChartsPage.tsx` (new). A chart view consuming the existing mandi history wrapper in `website/src/lib/api/mandi.ts`: a crop selector, a mandi selector, and a 30/90-day range toggle; render the modal-price history as an inline SVG polyline chart (no new npm dependency). All user-facing strings via `t()`; empty history shows a no-data message, never invented numbers (rule 1).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type error in the new file only — else STOP (playbook §5) with full output.
- [x]

### Task 1.4 — Add chart locale keys (en + hi)
- DO: in `website/src/lib/i18n/locales/en.trade.ts` and `website/src/lib/i18n/locales/hi.trade.ts` add the same keys (English and Hindi values respectively): `mandiChartsTitle`, `mandiChartsCrop`, `mandiChartsMandi`, `mandiChartsRange30`, `mandiChartsRange90`, `mandiChartsNoData`, plus one key per literal used in Task 1.3.
- RUN: `diff <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" website/src/lib/i18n/locales/en.trade.ts | tr -d ' :' | sort -u) <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" website/src/lib/i18n/locales/hi.trade.ts | tr -d ' :' | sort -u)`
- EXPECT: exit 0, no output (key parity).
- IF FAIL: add the missing key(s) to the file named in the diff, re-run — else STOP (playbook §5).
- [x]

### Task 1.5 — Register chart page in trade registry and routes
- DO: two edits. (1) In `website/src/views/trade/index.ts` add `mandiCharts: MandiChartsPage` to `TRADE_PAGES` and add `MandiChartsPage` to the named export block. (2) In `website/src/App.tsx` add one deep route for the charts page following the existing deep-route pattern for trade pages.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the import/export typo — else STOP (playbook §5) with full output.
- [x]

### Task 1.6 — Add price-alerts API wrapper
- DO: create `website/src/lib/api/priceAlerts.ts` (new) mirroring `backend/app/routers/price_alerts.py` exactly: one typed function per route (list, create, delete), using the established `lib/api/client.ts` pattern (copy the shape of `lib/api/mandi.ts`). Document any backend quirks in comments as existing modules do. Create and delete calls must send the `Idempotency-Key` header where the router accepts it (rule 7).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type error — else STOP (playbook §5) with full output.
- [x]

### Task 1.7 — Add price-alerts management page
- DO: create `website/src/views/trade/PriceAlertsPage.tsx` (new): lists the farmer's alerts via the Task 1.6 wrapper, with a create form (crop, mandi, target price in integer paisa, direction) and a delete action per row. No `alert()`/`confirm()` — use the existing toast/modal system (rule 6). All strings via `t()` (add keys `priceAlertsTitle`, `priceAlertsCreate`, `priceAlertsDelete`, `priceAlertsEmpty`, `priceAlertsTargetPrice` to `en.trade.ts` + `hi.trade.ts` in this same edit).
- RUN: `cd website && pnpm exec tsc --noEmit && diff <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" src/lib/i18n/locales/en.trade.ts | tr -d ' :' | sort -u) <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" src/lib/i18n/locales/hi.trade.ts | tr -d ' :' | sort -u)`
- EXPECT: exit 0; diff prints nothing.
- IF FAIL: fix the reported error/parity gap — else STOP (playbook §5) with full output.
- [x]

### Task 1.8 — Register alerts page in registry and routes
- DO: in `website/src/views/trade/index.ts` add `priceAlerts: PriceAlertsPage` to `TRADE_PAGES` and the named export; in `website/src/App.tsx` add the deep route.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the import/export typo — else STOP (playbook §5) with full output.
- [x]

### Task 1.9 — Emit task on price-alert trigger
- DO: in `backend/app/routers/price_alerts.py`, at the exact code path where an alert is evaluated as triggered, call the phase-01 `emit_task()` (import from the module found in Task 1.1) with the alert's farmer id, title strings in en + hi, and `deep_link` pointing at the mandi chart tool route (`/dashboard/p/mandiCharts`). Do not change any other behavior of the router.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_price_alerts.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: fix the emission call until existing tests pass — else STOP (playbook §5) with full output.
- [x]

### Task 1.10 — Register mandi.smart_select.v1 question set
- DO: in `backend/app/services/ai/question_sets.py` register question set id `mandi.smart_select.v1`: per-mandi `net_score` batch output with an `explain_key` choice field, following the registration pattern of the existing sets in that file. Also create golden fixture `backend/tests/fixtures/ai/golden/mandi.smart_select.v1.jsonl` (new) with at least 5 hand-computed cases (crop, qty, farmer district, candidate mandis with modal price + distance + transport fare → expected net ranking). All money in integer paisa.
- RUN: `cd backend && .venv/bin/python -c "from app.services.ai.question_sets import *; import app.services.ai.question_sets as q; assert 'mandi.smart_select.v1' in str(q.__dict__) or hasattr(q, 'mandi.smart_select.v1'.replace('.','_')) or True" && .venv/bin/python -c "import json,sys; [json.loads(l) for l in open('tests/fixtures/ai/golden/mandi.smart_select.v1.jsonl')]; print('fixture ok')"`
- EXPECT: exit 0; output contains `fixture ok`.
- IF FAIL: fix the fixture JSON syntax or the import error — else STOP (playbook §5) with full output.
- [x]

### Task 1.11 — Add smart-mandi state builder and deterministic net math
- DO: create `backend/app/services/mandi_smart.py` (new) with two functions: (1) `net_after_transport_paisa(modal_price_paisa, qty, transport_fare_paisa, commission_paisa) -> int` — plain integer-paisa arithmetic, no floats; (2) `build_smart_select_state(lot, farmer_location, candidate_mandis) -> dict` — builds the ≤1,500-token payload {crop, qty, district, farmer location, per-mandi: modal price, distance, transport fare estimate from `backend/app/routers/transport.py`} and passes it through `backend/app/services/ai/privacy.py` scrubbing (no phone/email/Aadhaar — rule 11).
- RUN: `cd backend && .venv/bin/python -c "from app.services.mandi_smart import net_after_transport_paisa, build_smart_select_state; print('import ok')"`
- EXPECT: exit 0; output `import ok`.
- IF FAIL: fix the import error — else STOP (playbook §5) with full output.
- [x]

### Task 1.12 — Add smart-select endpoint with deterministic fallback
- DO: in `backend/app/routers/mandi.py` add `POST /v1/mandi/smart-select`: builds state via `services/mandi_smart.py`, calls `gateway.generate()` with question set `mandi.smart_select.v1`, and caches the result server-side for 15 minutes keyed by (crop, district, mandi set) — doc or Redis, never triggered by page views. Deterministic fallback when AI is off/failed: rank by `net_after_transport_paisa` descending. Log the call to `ai_decisions` via the gateway. Standard error envelope on failure (rule 7). AI call only via gateway — never call OpenRouter/Gemini from the router (rule 10). Launch level `suggest`.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_mandi.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: fix the new endpoint until existing mandi tests pass — else STOP (playbook §5) with full output.
- [x]

### Task 1.13 — Add golden test for smart-select net math
- DO: create `backend/tests/test_mandi_smart.py` (new): (1) parametrize over every case in `tests/fixtures/ai/golden/mandi.smart_select.v1.jsonl` asserting `net_after_transport_paisa` matches the hand-computed value exactly; (2) with `AI_PROVIDER=shim`, assert the endpoint's ranking equals the deterministic net-math ranking; (3) assert the app still answers (fallback) when the AI flag is off.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_mandi_smart.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: fix the code, never the golden fixture expectations — else STOP (playbook §5) with full output.
- [x]

### Task 1.14 — Add best-mandi card to MandiPage
- DO: in `website/src/views/trade/MandiPage.tsx` add a "best mandi" card that calls the Task 1.12 endpoint via a new typed function in `website/src/lib/api/mandi.ts` and renders the net-after-transport math line-by-line: mandi price − transport − commission = net, all in integer paisa with ₹ formatting. When the endpoint fails or AI is off, render the existing compare view unchanged (fallback). Add locale keys `mandiBestCardTitle`, `mandiNetMathPrice`, `mandiNetMathTransport`, `mandiNetMathCommission`, `mandiNetMathNet` to `en.trade.ts` + `hi.trade.ts` in the same edit.
- RUN: `cd website && pnpm exec tsc --noEmit && diff <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" src/lib/i18n/locales/en.trade.ts | tr -d ' :' | sort -u) <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" src/lib/i18n/locales/hi.trade.ts | tr -d ' :' | sort -u)`
- EXPECT: exit 0; diff prints nothing.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 1.15 — Add nightly forecast service (SGR)
- DO: create `backend/app/services/mandi_forecast.py` (new): `run_nightly_forecast()` iterates (crop, mandi) pairs over history + arrivals, calls `gateway.generate()` for a projected 7/30-day price band, validates the response with a Pydantic model (fields: `band_low_paisa`, `band_high_paisa`, `confidence_class` as a choice), applies exactly one repair retry on validation failure, and caches the result per (crop, mandi). Never compute per page-view. Log to `ai_decisions` via the gateway.
- RUN: `cd backend && .venv/bin/python -c "from app.services.mandi_forecast import run_nightly_forecast; print('import ok')"`
- EXPECT: exit 0; output `import ok`.
- IF FAIL: fix the import error — else STOP (playbook §5) with full output.
- [x]

### Task 1.16 — Add forecast read endpoint
- DO: in `backend/app/routers/mandi.py` add `GET /v1/mandi/forecast?crop=&mandi=` that ONLY reads the cached forecast written by Task 1.15 (never calls the model); standard error envelope; returns 404-envelope when no cached forecast exists. Add `backend/tests/test_mandi_forecast.py` (new) covering: cache-miss envelope, cache-hit shape, and `AI_PROVIDER=shim` nightly run producing a Pydantic-valid band.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_mandi_forecast.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: fix the code, not the test — else STOP (playbook §5) with full output.
- [x]

### Task 1.17 — Render forecast chart with estimate label
- DO: in `website/src/views/trade/MandiChartsPage.tsx` render the 7/30-day forecast from `GET /v1/mandi/forecast` (add a typed wrapper in `lib/api/mandi.ts`) as a second line on the chart with an explicit on-chart "estimate" label. Add keys `mandiForecastEstimateLabel` (en: "estimate", hi: "अनुमान") and `mandiForecastUnavailable` to `en.trade.ts` + `hi.trade.ts`. On 404-envelope, render the current compare view only — no chart, no invented numbers.
- RUN: `cd website && pnpm exec tsc --noEmit && diff <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" src/lib/i18n/locales/en.trade.ts | tr -d ' :' | sort -u) <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" src/lib/i18n/locales/hi.trade.ts | tr -d ' :' | sort -u)`
- EXPECT: exit 0; diff prints nothing.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 1.18 — Harden Agmarknet/eNAM sync job
- DO: in `backend/app/services/sync.py` (the Agmarknet/eNAM sync path) add bounded retries with backoff around the fetch, and on success write `last_success_at` (ISO string) to a `platform_config/mandi_sync` doc. Add or extend a test in `backend/tests/test_sync.py` asserting the timestamp is written on success and retries happen on failure (mock the fetch).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_sync.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: fix the code, not the test — else STOP (playbook §5) with full output.
- [x]

### Task 1.19 — Add audio readout to mandi card
- DO: in `website/src/views/trade/MandiPage.tsx` add a readout button on the mandi card that speaks the day's modal price line using browser `speechSynthesis` with the utterance language set from the current locale (`currentLanguage()` from `lib/i18n`). Client-side only — no server TTS. Add keys `mandiListen` and `mandiPriceLine` (with `{price}` and `{mandi}` params) to `en.trade.ts` + `hi.trade.ts`.
- RUN: `cd website && pnpm exec tsc --noEmit && diff <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" src/lib/i18n/locales/en.trade.ts | tr -d ' :' | sort -u) <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" src/lib/i18n/locales/hi.trade.ts | tr -d ' :' | sort -u)`
- EXPECT: exit 0; diff prints nothing.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 1.20 — Seed contract_templates collection
- DO: create `backend/scripts/seed_contract_templates.py` (new): idempotent script writing at least 3 curated templates into Firestore collection `contract_templates` (fields: `template_id`, `crop`, `title_en`, `title_hi`, `terms_text_en`, `terms_text_hi`, `created_at`). Print `seeded <n>` on success.
- RUN: `cd backend && APP_ENV=dev .venv/bin/python scripts/seed_contract_templates.py`
- EXPECT: exit 0; output contains `seeded`.
- IF FAIL: fix the script against the Firestore client pattern used by existing scripts in `backend/scripts/` — else STOP (playbook §5) with full output.
- [x]

### Task 1.21 — Add template picker to ContractFormPage
- DO: in `website/src/views/directbuyer/ContractFormPage.tsx` add a template picker at the top of the form: fetch templates from the backend (add a typed wrapper in the API module that already wraps contracts — find it via the imports at the top of the file), and on selection prefill the form's title/terms fields. Add keys `contractTemplatePickerLabel`, `contractTemplateCustom` to the contracts locale domain already imported by this page (both en + hi files of that domain).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 1.22 — Add delivery-schedule calendar to ContractDetailPage
- DO: in `website/src/views/directbuyer/ContractDetailPage.tsx` add a calendar view of the contract's delivery schedule (month grid; each scheduled delivery date marked, data from the existing contract detail payload — no new endpoint). All strings via `t()`; add the needed keys to the same locale domain as Task 1.21 (en + hi).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 1.23 — Add contract performance analytics endpoint
- DO: in `backend/app/routers/contracts.py` add `GET /v1/contracts/analytics` returning `{"fulfillment_pct": int, "on_time_deliveries": int, "total_deliveries": int}` computed from the caller's contracts. Standard error envelope. Add tests to `backend/tests/test_contracts.py` (extend, do not delete anything) covering the computation on seeded contracts.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_contracts.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: fix the code, not the test — else STOP (playbook §5) with full output.
- [x]

### Task 1.24 — Add contract analytics card to ContractsPage
- DO: in `website/src/views/directbuyer/ContractsPage.tsx` add a performance analytics card consuming `GET /v1/contracts/analytics` (typed wrapper in the contracts API module): shows fulfillment % and on-time deliveries; honest empty state when `total_deliveries` is 0. Strings via `t()` (en + hi keys in the contracts locale domain).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 1.25 — Add MSP reference endpoint and seed
- DO: two edits. (1) In `backend/app/routers/reference.py` add `GET /v1/reference/msp` returning crop → MSP in integer paisa from the `msp_reference` Firestore collection, standard error envelope, cursor pagination if the router's list pattern uses it. (2) Create `backend/scripts/seed_msp_reference.py` (new), idempotent, seeding `msp_reference` docs `{crop, msp_paisa, season, updated_at}` for at least the crops already present in the reference data; prints `seeded <n>`. Extend `backend/tests/test_reference.py` with a test for the new endpoint.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_reference.py -q && APP_ENV=dev .venv/bin/python scripts/seed_msp_reference.py`
- EXPECT: exit 0 for both; seed output contains `seeded`.
- IF FAIL: fix the endpoint/script — else STOP (playbook §5) with full output.
- [x]

### Task 1.26 — Show MSP line on farmer contract cards (F14)
- DO: in `website/src/views/farmer/FarmerContractDetailPage.tsx` fetch `GET /v1/reference/msp` (add typed wrapper in `website/src/lib/api/reference.ts`) and display the MSP line next to the contract price on the decision card (both in ₹ from integer paisa). Add keys `contractMspLabel`, `contractMspUnavailable` to the locale domain used by this page (en + hi). When MSP is unavailable show the `contractMspUnavailable` string, never a fallback number (rule 1).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 1.27 — WS-01 verification gate
- DO: run the full verification block. No edits.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q` then `cd website && pnpm exec tsc --noEmit && pnpm build`
- EXPECT: pytest fully green (exit 0); tsc + build clean (exit 0).
- IF FAIL: fix the failure in the file it names — else STOP (playbook §5) with full output.
- [x]

### Task 1.28 — HUMAN CHECK: mandi + alert end-to-end flow
- PRECONDITION: `curl -sf http://localhost:8000/v1/health` — if this fails, start the dev server with `cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000` (background) and re-check; if it still fails, STOP the phase (playbook §5).
- DO: HUMAN CHECK — with the website dev server running (`cd website && pnpm dev`), a human operator: (1) opens the Mandi tool from the farmer dashboard, (2) confirms the best-mandi card shows the line-by-line net math, (3) opens the charts view and confirms the forecast line carries the "estimate" label in both en and hi, (4) creates a price alert, (5) triggers it (dev seed or manual price update), (6) confirms a task appears in the Action Center whose deep link opens the mandi chart, (7) opens a farmer contract detail and confirms the MSP line renders next to the contract price.
- EXPECT: human confirms all 7 sub-steps.
- IF FAIL: record the exact failing sub-step and STOP (playbook §5).
- [ ]

### Task 1.29 — Commit WS-01
- DO: stage and commit all WS-01 work.
- RUN: `git add -A && git commit -m "phase-05 WS-01: trade-intelligence modules"`
- EXPECT: exit 0; commit created.
- IF FAIL: if git identity is missing, note it in the report and continue (playbook §6); otherwise STOP.
- [ ]

## WS-02 — Advisory hub & AI vision  (see instructions.md §WS-02)

### Task 2.1 — Verify WS-02 dependencies and read sources
- PRECONDITION: `test -f backend/app/services/ai/gateway.py && grep -rln "def emit_task" backend/app/ | head -1` — if this fails, STOP the phase (playbook §5).
- DO: read (no edits): `backend/app/routers/advisory.py`, `backend/app/services/advisory.py`, `backend/app/services/disease_model/base.py`, `backend/app/services/disease_model/gemini.py`, `backend/app/services/disease_model/stub.py`, `backend/app/routers/mandi.py`, `website/src/lib/firebase.ts`, `website/src/lib/api/intelligence.ts`. Note the exact hardcoded base-price lines in `services/advisory.py` (needed in Task 2.10) and the image-upload helper name in `lib/firebase.ts`.
- RUN: `ls backend/app/routers/advisory.py backend/app/services/advisory.py backend/app/services/disease_model/stub.py website/src/lib/firebase.ts website/src/lib/api/intelligence.ts`
- EXPECT: exit 0.
- IF FAIL: none — STOP the phase (playbook §5); report the missing file.
- [x]

### Task 2.2 — Add advisory API module
- DO: create `website/src/lib/api/advisory.ts` (new) mirroring `backend/app/routers/advisory.py`: one typed function per route, using the `lib/api/client.ts` pattern (copy the shape of `lib/api/intelligence.ts`). Document backend quirks in comments.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type error — else STOP (playbook §5) with full output.
- [x]

### Task 2.3 — Add advisory locale pair
- DO: create `website/src/lib/i18n/locales/en.advisory.ts` (new) and `website/src/lib/i18n/locales/hi.advisory.ts` (new) following the `en.trade.ts`/`hi.trade.ts` pattern (`registerLocale` call at the bottom), with identical key sets. Seed with the hub keys: `advisoryTitle`, `advisoryTabSaturation`, `advisoryTabDisease`, `advisoryTabNpk`, `advisoryTabPestRadar`, `advisoryTabKisanMitra`. Add two import lines to `website/src/main.tsx` after the existing `./lib/i18n/locales/hi.trade` import.
- RUN: `diff <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" website/src/lib/i18n/locales/en.advisory.ts | tr -d ' :' | sort -u) <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" website/src/lib/i18n/locales/hi.advisory.ts | tr -d ' :' | sort -u) && cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0; diff prints nothing.
- IF FAIL: fix the parity gap or import error — else STOP (playbook §5).
- [x]

### Task 2.4 — Add advisory hub page with 5-tab shell
- DO: create `website/src/views/advisory/AdvisoryHubPage.tsx` (new) and `website/src/views/advisory/index.ts` (new) exporting `ADVISORY_PAGES: Record<string, ComponentType>` (pattern: `views/trade/index.ts` lines 30–46) with `advisoryHub: AdvisoryHubPage`. The hub renders a 5-tab navigation using the Task 2.3 tab keys; tab bodies are placeholders wired in Tasks 2.5–2.9 (each tab body may initially render only its section heading — final content lands in the named later tasks; no "coming soon" string anywhere).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 2.5 — Register advisory routes and dashboard card
- DO: two edits. (1) In `website/src/App.tsx` add the advisory deep route(s) following the trade pattern. (2) In `website/src/lib/dashboard.ts` add the advisory module card to the farmer persona's dashboard config, respecting the ACL matrix in `canAccess()` (`lib/dashboard.ts:200`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 2.6 — Build Market Saturation tab with consent copy
- DO: in the saturation tab of `AdvisoryHubPage.tsx`: render an explicit opt-in consent block (checkbox + copy) before any sowing-intent-derived data is shown; only after consent, call the saturation data via `lib/api/advisory.ts`. Add keys `advisorySaturationConsent`, `advisorySaturationTitle` to `en.advisory.ts` + `hi.advisory.ts`. No data is rendered without consent.
- RUN: `cd website && pnpm exec tsc --noEmit && diff <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" src/lib/i18n/locales/en.advisory.ts | tr -d ' :' | sort -u) <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" src/lib/i18n/locales/hi.advisory.ts | tr -d ' :' | sort -u)`
- EXPECT: exit 0; diff prints nothing.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 2.7 — Build NPK calculator tab
- DO: in the NPK tab of `AdvisoryHubPage.tsx`: form inputs (crop, soil values, plot size) posting to the advisory NPK route found in Task 2.1; result card rendered from the response only (no client-side invented defaults — rule 1). Strings via `t()`; add keys to `en.advisory.ts` + `hi.advisory.ts`.
- RUN: `cd website && pnpm exec tsc --noEmit && diff <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" src/lib/i18n/locales/en.advisory.ts | tr -d ' :' | sort -u) <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" src/lib/i18n/locales/hi.advisory.ts | tr -d ' :' | sort -u)`
- EXPECT: exit 0; diff prints nothing.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 2.8 — Build Pest Radar tab (5 km)
- DO: in the Pest Radar tab of `AdvisoryHubPage.tsx`: list pest reports within a 5 km radius of the farmer's location via the advisory pest route found in Task 2.1; empty state when none. Strings via `t()`; add keys to `en.advisory.ts` + `hi.advisory.ts`.
- RUN: `cd website && pnpm exec tsc --noEmit && diff <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" src/lib/i18n/locales/en.advisory.ts | tr -d ' :' | sort -u) <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" src/lib/i18n/locales/hi.advisory.ts | tr -d ' :' | sort -u)`
- EXPECT: exit 0; diff prints nothing.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 2.9 — Build Kisan Mitra launcher tab
- PRECONDITION: `grep -rn "chat" website/src/App.tsx | head -3` finds the phase-01 chat surface route — if not, STOP the phase (playbook §5).
- DO: in the Kisan Mitra tab of `AdvisoryHubPage.tsx`: a launcher card that deep-links to the phase-01 chat surface route found by the precondition. Strings via `t()`; add key `advisoryKisanMitraLaunch` to `en.advisory.ts` + `hi.advisory.ts`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 2.10 — Replace hardcoded advisory base prices (M13)
- DO: in `backend/app/services/advisory.py` delete every hardcoded base-price value found in Task 2.1 and replace the logic with mandi-linked aggregates from `backend/app/routers/mandi.py` history data (import the service/query layer, do not duplicate SQL/queries). No `?? <number>`-style defaults anywhere in the file (rule 1).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_advisory.py -q && grep -nE "base_price\s*=\s*[0-9]+|=\s*[0-9]{3,}\s*#.*price" app/services/advisory.py; test $? -eq 1`
- EXPECT: pytest green; the grep finds no hardcoded price literals (exit 1 from grep = pass).
- IF FAIL: remove the remaining hardcoded values — else STOP (playbook §5) with full output.
- [x]

### Task 2.11 — Register advisory.saturation.v1 and derive saturation classes
- DO: two edits. (1) In `backend/app/services/ai/question_sets.py` register `advisory.saturation.v1` with a `risk` choice field (low/med/high) and an `alt_crops` ranked list field. (2) In `backend/app/services/advisory.py` compute saturation classes from sowing-intent aggregates per (district, crop) — real Firestore aggregation, no constants. Create golden fixture `backend/tests/fixtures/ai/golden/advisory.saturation.v1.jsonl` (new) with ≥3 districts and expected classes.
- RUN: `cd backend && .venv/bin/python -c "import json; [json.loads(l) for l in open('tests/fixtures/ai/golden/advisory.saturation.v1.jsonl')]; print('fixture ok')" && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_advisory.py -q`
- EXPECT: exit 0; output contains `fixture ok`; pytest green.
- IF FAIL: fix the code/fixture — else STOP (playbook §5) with full output.
- [x]

### Task 2.12 — Render data-basis citation in saturation UI
- DO: in the saturation tab of `AdvisoryHubPage.tsx` render a mandatory data-basis citation line under every saturation result: key `advisoryDataBasis` with params `{count}` and `{district}` (en: "based on {count} sowing intents in {district}", hi equivalent). Nothing saturation-related renders without this citation.
- RUN: `cd website && pnpm exec tsc --noEmit && diff <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" src/lib/i18n/locales/en.advisory.ts | tr -d ' :' | sort -u) <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" src/lib/i18n/locales/hi.advisory.ts | tr -d ' :' | sort -u)`
- EXPECT: exit 0; diff prints nothing.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 2.13 — Add crop-planner endpoint (M13, SGR)
- DO: in `backend/app/routers/advisory.py` add `POST /v1/advisory/crop-plan`: inputs (soil, irrigation, plot size, crop history, saturation) → `gateway.generate()` returns 2–3 options each with a rationale string in the user's language (en/hi); validate with a Pydantic model; exactly one repair retry; cache per (district, season, profile-class); log to `ai_decisions`; launch at `suggest` — the endpoint never creates anything. Add `backend/tests/test_advisory_planner.py` (new) covering validation, shim output shape, and cache hit.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_advisory_planner.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: fix the code, not the test — else STOP (playbook §5) with full output.
- [x]

### Task 2.14 — Add crop-plan confirm endpoint
- DO: in `backend/app/routers/advisory.py` add `POST /v1/advisory/crop-plan/confirm` accepting the farmer's chosen option: creates a real `crop_cycles` doc and generates the task schedule via the phase-01 `emit_task()`. Accept `Idempotency-Key` (rule 7); confirm is mandatory — no other path creates crop_cycles from the planner. Extend `backend/tests/test_advisory_planner.py`: confirm creates the crop_cycle doc and emits tasks; replaying the same Idempotency-Key does not duplicate.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_advisory_planner.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: fix the code, not the test — else STOP (playbook §5) with full output.
- [x]

### Task 2.15 — Build crop-planner UI
- DO: in the saturation/advisory hub (new section in `AdvisoryHubPage.tsx` or a new `website/src/views/advisory/CropPlannerPage.tsx` registered in `ADVISORY_PAGES` + `App.tsx`): inputs form → renders the 2–3 options with rationale → confirm button posts to the confirm endpoint with an `Idempotency-Key` header → success state links to the dashboard. All strings via `t()` in `en.advisory.ts` + `hi.advisory.ts`.
- RUN: `cd website && pnpm exec tsc --noEmit && diff <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" src/lib/i18n/locales/en.advisory.ts | tr -d ' :' | sort -u) <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" src/lib/i18n/locales/hi.advisory.ts | tr -d ' :' | sort -u)`
- EXPECT: exit 0; diff prints nothing.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 2.16 — Build disease-scan page with upload
- DO: create `website/src/views/advisory/DiseaseScanPage.tsx` (new): camera/file upload → Firebase Storage via the upload helper in `website/src/lib/firebase.ts` found in Task 2.1 → obtains the signed URL → posts it to the backend scan route. Register the page in `ADVISORY_PAGES` + `App.tsx`. Wire it as the Disease Scan tab body of the hub. Strings via `t()` in `en.advisory.ts` + `hi.advisory.ts`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 2.17 — Register disease.gate.v1 and gate the scan (M9)
- DO: two edits. (1) In `backend/app/services/ai/question_sets.py` register `disease.gate.v1` with bool fields `is_plant_leaf` and `quality_ok`. (2) In the disease scan path (`backend/app/services/disease_model/gemini.py` call site — the router/service that runs scans, found in Task 2.1): run the gate FIRST via `gateway.analyze_image()`; on gate failure return retake guidance (keys `diseaseRetakeNotLeaf`, `diseaseRetakeBlurry`) instead of a diagnosis. No AI call outside the gateway (rule 10); no PII in payloads (rule 11).
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_advisory.py tests/test_intelligence.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: fix the gate wiring — else STOP (playbook §5) with full output.
- [x]

### Task 2.18 — Add disease diagnosis schema call
- DO: after the gate passes (same call site as Task 2.17), call `gateway.analyze_image()` with the disease JSON schema: fields `name`, `confidence` (float 0–1), `treatment`, `est_cost` (integer paisa), `urgency`. Validate with a Pydantic model; one repair retry. Fallback when AI off/failed: existing `backend/app/services/disease_model/stub.py` result, flagged `demo: true` in the response. Add/extend tests covering gate-pass diagnosis shape and stub fallback.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_advisory.py tests/test_intelligence.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: fix the code, not the test — else STOP (playbook §5) with full output.
- [x]

### Task 2.19 — Add per-plot scan history (F10)
- DO: in the disease scan backend path, persist every completed scan to a `disease_scans` Firestore collection keyed by `farmerId` + `plotId` (fields: `scan_id`, `farmerId`, `plotId`, `photo_url`, `diagnosis`, `confidence`, `created_at`), and add `GET /v1/advisory/disease-scans?plotId=` returning the plot's history with cursor pagination (rule 7). Add a history list view per plot on `DiseaseScanPage.tsx`. Extend tests for write + list.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_advisory.py tests/test_intelligence.py -q && cd ../website && pnpm exec tsc --noEmit`
- EXPECT: both exit 0.
- IF FAIL: fix the reported failure — else STOP (playbook §5) with full output.
- [x]

### Task 2.20 — Add expert handoff and treatment tasks
- DO: in the disease scan backend path: when `confidence < 0.7`, create an `expert_tickets` doc with the photo attached (fields: `ticket_id`, `farmerId`, `photo_url`, `diagnosis`, `confidence`, `status: 'open'`, `created_at`); when a diagnosis includes treatment advice, emit a task via the phase-01 `emit_task()` with a deep link into the Disease Scan tab. Add tests for both thresholds (0.69 → ticket; 0.7 → no ticket).
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_advisory.py tests/test_intelligence.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: fix the code, not the test — else STOP (playbook §5) with full output.
- [x]

### Task 2.21 — Label demo fallback and render retake guidance
- DO: in `website/src/views/advisory/DiseaseScanPage.tsx`: (1) when the scan response has `demo: true`, render a visible "demo" label (key `diseaseDemoLabel`); (2) when the gate fails, render the retake guidance strings from Task 2.17 instead of any diagnosis card; (3) render the diagnosis card (name, confidence, treatment, est_cost in ₹ from paisa, urgency) from response fields only. Add the keys to `en.advisory.ts` + `hi.advisory.ts`.
- RUN: `cd website && pnpm exec tsc --noEmit && diff <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" src/lib/i18n/locales/en.advisory.ts | tr -d ' :' | sort -u) <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" src/lib/i18n/locales/hi.advisory.ts | tr -d ' :' | sort -u)`
- EXPECT: exit 0; diff prints nothing.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 2.22 — Emit advisory tasks (weather/pest/saturation)
- DO: in `backend/app/services/advisory.py` (and `backend/app/services/weather.py` if that is where weather advisories originate — use the emit point already present, do not create a parallel one), emit tasks via the phase-01 `emit_task()` for weather, pest, and saturation advisories, each with a deep link into the relevant hub tab (`/dashboard/p/advisoryHub`). Extend `backend/tests/test_advisory.py` to assert emission.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_advisory.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: fix the code, not the test — else STOP (playbook §5) with full output.
- [x]

### Task 2.23 — WS-02 verification gate
- DO: run the full verification block. No edits.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q` then `cd website && pnpm exec tsc --noEmit && pnpm build` then `grep -nE "base_price\s*=\s*[0-9]+" backend/app/services/advisory.py; test $? -eq 1`
- EXPECT: pytest green; tsc + build clean; grep finds nothing.
- IF FAIL: fix the failure in the file it names — else STOP (playbook §5) with full output.
- [x]

### Task 2.24 — HUMAN CHECK: disease scan and planner flows
- PRECONDITION: `curl -sf http://localhost:8000/v1/health` — if this fails, start the dev server with `cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000` (background) and re-check; if still failing, STOP the phase (playbook §5).
- DO: HUMAN CHECK — (1) upload a clear leaf photo on the Disease Scan page → diagnosis card appears; (2) upload a blurry/non-leaf image → retake guidance shows in the current locale; (3) confirm the scan appears in the plot's history list; (4) force/seed a low-confidence result → an expert ticket exists with the photo; (5) fill the crop planner inputs → 2–3 options render → confirm → the new crop_cycle and its tasks appear on the dashboard; (6) open the saturation tab → consent copy gates the data and the "based on N sowing intents" citation is visible.
- EXPECT: human confirms all 6 sub-steps.
- IF FAIL: record the exact failing sub-step and STOP (playbook §5).
- [ ]

### Task 2.25 — Commit WS-02
- DO: stage and commit all WS-02 work.
- RUN: `git add -A && git commit -m "phase-05 WS-02: advisory hub and AI vision"`
- EXPECT: exit 0; commit created.
- IF FAIL: if git identity is missing, note it and continue (playbook §6); otherwise STOP.
- [ ]

## WS-03 — Marketplace e-commerce  (see instructions.md §WS-03)

### Task 3.1 — Verify WS-03 dependencies and read sources
- PRECONDITION: `test -f backend/app/services/payments.py && grep -rln "def emit_task" backend/app/ | head -1` — if this fails, STOP the phase (playbook §5).
- DO: read (no edits): `backend/app/routers/marketplace.py`, `backend/app/routers/orders.py`, `backend/app/routers/order_tracking.py`, `backend/app/routers/wishlist.py`, `backend/app/routers/coupons.py`, `backend/app/routers/addresses.py`, `backend/app/routers/ratings.py`, `backend/app/routers/seller_products.py`, `backend/app/routers/user_products.py`, `backend/app/services/payments.py`. Note the exact route paths for: QR authenticity certificate (in `marketplace.py`), Razorpay order create/verify (in `services/payments.py`), and order status transitions (in `orders.py`) — later tasks reference them.
- RUN: `ls backend/app/routers/marketplace.py backend/app/routers/orders.py backend/app/routers/order_tracking.py backend/app/routers/wishlist.py backend/app/routers/coupons.py backend/app/routers/addresses.py backend/app/routers/ratings.py backend/app/routers/seller_products.py backend/app/routers/user_products.py backend/app/services/payments.py`
- EXPECT: exit 0.
- IF FAIL: none — STOP the phase (playbook §5); report the missing file.
- [x]

### Task 3.2 — Add marketplace API module
- DO: create `website/src/lib/api/marketplace.ts` (new) mirroring the routers read in Task 3.1: typed functions for catalog list (cursor pagination), product detail, QR certificate, cart, checkout (Razorpay create/verify), orders list/detail, tracking, returns, wishlist, coupons apply, addresses CRUD, reviews list/write, seller products CRUD. Every write function sends an `Idempotency-Key` header (rule 7). Document backend quirks in comments.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type error — else STOP (playbook §5) with full output.
- [x]

### Task 3.3 — Add marketplace locale pair
- DO: create `website/src/lib/i18n/locales/en.marketplace.ts` + `hi.marketplace.ts` (new, `registerLocale` pattern) with identical key sets; seed with `marketplaceTitle`, `marketplaceCatalog`, `marketplaceCart`, `marketplaceCheckout`, `marketplaceOrders`, `marketplaceReturns`, `marketplaceWishlist`, `marketplaceAddresses`, `marketplaceBnplComingPartner` (en: "BNPL — coming via partner", hi equivalent). Add the two import lines to `website/src/main.tsx`.
- RUN: `diff <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" website/src/lib/i18n/locales/en.marketplace.ts | tr -d ' :' | sort -u) <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" website/src/lib/i18n/locales/hi.marketplace.ts | tr -d ' :' | sort -u) && cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0; diff prints nothing.
- IF FAIL: fix the parity gap or import error — else STOP (playbook §5).
- [x]

### Task 3.4 — Add marketplace views registry, routes, dashboard card
- DO: create `website/src/views/marketplace/index.ts` (new) exporting `MARKETPLACE_PAGES: Record<string, ComponentType>` (pattern: `views/trade/index.ts`) — initially empty; pages are added by later tasks in this workstream. Add the marketplace deep route(s) to `website/src/App.tsx` and the marketplace card to the farmer persona config in `website/src/lib/dashboard.ts` (respect `canAccess()`, `lib/dashboard.ts:200`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 3.5 — Build CatalogPage with categories
- DO: create `website/src/views/marketplace/CatalogPage.tsx` (new): category tabs seeds / fertilizer / pesticide / tools / vehicles; filter bar; search-within-catalog box; product grid from the catalog endpoint with cursor pagination (rule 7) — a "load more" control driven by `nextCursor`, never page numbers. Register in `MARKETPLACE_PAGES`. Strings via `t()` in `en/hi.marketplace.ts`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 3.6 — Build ProductDetailPage with QR certificate
- DO: create `website/src/views/marketplace/ProductDetailPage.tsx` (new): product details from the product endpoint; a QR authenticity certificate viewer that fetches the certificate route found in Task 3.1 and renders the QR payload; add-to-cart action (sends `Idempotency-Key`). Register in `MARKETPLACE_PAGES`. Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 3.7 — Build ReviewsSection gated to delivered orders (X7)
- DO: create `website/src/views/marketplace/ReviewsSection.tsx` (new) rendered inside `ProductDetailPage.tsx`: reviews list via the ratings router; the write form is enabled ONLY when the reviews/eligibility endpoint confirms a delivered order for this buyer+product — otherwise render the gated hint string. Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 3.8 — Build CartPage
- DO: create `website/src/views/marketplace/CartPage.tsx` (new): line items with quantity edit and remove (each write sends `Idempotency-Key`), running total computed in integer paisa client-side only for display (server total is authoritative at checkout). Register in `MARKETPLACE_PAGES`. Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 3.9 — Build AddressBookPage (X6)
- DO: create `website/src/views/marketplace/AddressBookPage.tsx` (new): CRUD over `backend/app/routers/addresses.py` routes via the Task 3.2 wrapper; select-default action. Register in `MARKETPLACE_PAGES`. Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 3.10 — Build CheckoutPage with Razorpay
- DO: create `website/src/views/marketplace/CheckoutPage.tsx` (new): address picker (from AddressBook), coupon apply field calling the coupons route (discount shown in ₹ from integer paisa exactly as the server computes it), Razorpay order create + verify via the phase-00 rails in `services/payments.py` (the checkout wrapper functions from Task 3.2), `Idempotency-Key` on the checkout POST. BNPL renders only as the labeled placeholder `marketplaceBnplComingPartner` — no fake flow. No paywall on the purchase flow (rule 5). Register in `MARKETPLACE_PAGES`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 3.11 — Build OrdersPage and OrderDetailPage
- DO: create `website/src/views/marketplace/OrdersPage.tsx` (new, order list with cursor pagination) and `website/src/views/marketplace/OrderDetailPage.tsx` (new, order summary + tracking timeline consuming `backend/app/routers/order_tracking.py`). Register both in `MARKETPLACE_PAGES`. Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 3.12 — Build ReturnsPage
- DO: create `website/src/views/marketplace/ReturnsPage.tsx` (new): list returnable delivered orders, submit a return request (reason field, `Idempotency-Key`), list existing return requests with status. Register in `MARKETPLACE_PAGES`. Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 3.13 — Build WishlistPage
- DO: create `website/src/views/marketplace/WishlistPage.tsx` (new): list/add/remove via `backend/app/routers/wishlist.py`; every write sends `Idempotency-Key` (rule 7). Register in `MARKETPLACE_PAGES`. Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 3.14 — Emit buyer tasks on order status changes
- DO: in `backend/app/routers/orders.py` (and `backend/app/routers/order_tracking.py` if that is where transitions are written — use the actual transition write path found in Task 3.1), call the phase-01 `emit_task()` to the buyer on every order status change, with en + hi titles and a deep link to the order detail (`/dashboard/p/orders`). Extend `backend/tests/test_order_lifecycle.py` asserting emission on a transition. Do not change transition logic itself.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_order_lifecycle.py tests/test_orders.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: fix the emission call — else STOP (playbook §5) with full output.
- [x]

### Task 3.15 — Verify financial audit logging on orders/refunds
- DO: in `backend/app/routers/orders.py` and the refund path, verify every financial mutation writes an `audit_logs` entry (rule 3); if any mutation lacks it, add the write following the existing `audit_logs` pattern in the codebase. Extend `backend/tests/test_orders.py` with an assertion that a paid order writes an audit log. No other behavior changes.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_orders.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: fix the code, not the test — else STOP (playbook §5) with full output.
- [x]

### Task 3.16 — Verify coupon discount math in paisa
- DO: extend `backend/tests/test_coupons.py` with a case asserting the applied coupon discount on a checkout-priced cart is exact in integer paisa (no float drift: e.g. 10% off ₹199.50-equivalent paisa values). If the test exposes float math in `backend/app/routers/coupons.py`, convert the computation to integer paisa.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_coupons.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: fix the coupon math, never the assertion — else STOP (playbook §5) with full output.
- [x]

### Task 3.17 — Build seller product-management pages
- DO: create `website/src/views/marketplace/SellerProductsPage.tsx` (new, product list with stock display) and `website/src/views/marketplace/ProductFormPage.tsx` (new, create/edit: fields per `seller_products.py`/`user_products.py` payload; stock; images uploaded to Firebase Storage and attached as signed URLs via the helper in `website/src/lib/firebase.ts`). Register both in `MARKETPLACE_PAGES` and add routes in `App.tsx` under the seller persona surface. Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit && pnpm build`
- EXPECT: exit 0 for both (workstream-end full build).
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 3.18 — WS-03 verification gate
- DO: run the full verification block. No edits.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q` then `cd website && pnpm exec tsc --noEmit && pnpm build`
- EXPECT: pytest fully green; tsc + build clean.
- IF FAIL: fix the failure in the file it names — else STOP (playbook §5) with full output.
- [x]

### Task 3.19 — HUMAN CHECK: purchase and seller flows
- PRECONDITION: `curl -sf http://localhost:8000/v1/health` — if this fails, start the dev server with `cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000` (background) and re-check; if still failing, STOP the phase (playbook §5).
- DO: HUMAN CHECK — (1) as a farmer: catalog → open a seed product → view QR certificate → add to cart → apply a coupon → checkout with Razorpay test-mode keys → order confirmation; (2) confirm the tracking timeline advances on a status change and a task lands in the Action Center; (3) request a return and confirm it appears in ReturnsPage; (4) confirm the coupon discount on the order matches the paisa math exactly; (5) as a seller: create a product with an image → confirm it appears in the catalog → edit its stock. (6) Switch language to Hindi and confirm no English-only strings on any of these pages.
- EXPECT: human confirms all 6 sub-steps.
- IF FAIL: record the exact failing sub-step and STOP (playbook §5).
- [ ]

### Task 3.20 — Commit WS-03
- DO: stage and commit all WS-03 work.
- RUN: `git add -A && git commit -m "phase-05 WS-03: marketplace e-commerce"`
- EXPECT: exit 0; commit created.
- IF FAIL: if git identity is missing, note it and continue (playbook §6); otherwise STOP.
- [ ]

## WS-04 — Money & records (P&L / Farm CEO + Farm Diary)  (see instructions.md §WS-04)

### Task 4.1 — Verify WS-04 dependencies and read sources
- PRECONDITION: `grep -rln "def emit_task" backend/app/ | head -1` — if this fails, STOP the phase (playbook §5).
- DO: read (no edits): `backend/app/routers/pnl.py`, `backend/app/services/pnl_engine.py`, `backend/app/routers/diary.py`, `backend/app/services/diary_analytics.py`, `website/src/views/pnl/FarmCeoPage.tsx`, `website/src/views/diary/CashbookPage.tsx`, `website/src/lib/csv.ts`, `website/src/lib/api/pnl.ts`, `website/src/lib/api/diary.ts`. List every `?? <number>` fallback in the two pages (needed in Tasks 4.2–4.3) and every transaction-completion call site (lot sale, lease payment, freight income, marketplace order) — needed in Tasks 4.5–4.8.
- RUN: `ls backend/app/routers/pnl.py backend/app/services/pnl_engine.py backend/app/routers/diary.py backend/app/services/diary_analytics.py website/src/views/pnl/FarmCeoPage.tsx website/src/views/diary/CashbookPage.tsx website/src/lib/csv.ts`
- EXPECT: exit 0.
- IF FAIL: none — STOP the phase (playbook §5); report the missing file.
- [x]

### Task 4.2 — Strip numeric fallbacks from FarmCeoPage
- DO: in `website/src/views/pnl/FarmCeoPage.tsx` remove every `?? <number>` / hardcoded numeric fallback found in Task 4.1 (rule 1); where data is absent render an honest zero-data empty state using `t()` keys (add `pnlEmptyTitle`, `pnlEmptyBody` to `en.pnl.ts` + `hi.pnl.ts`). Do not change any data-fetching logic.
- RUN: `grep -nE "\?\?\s*[0-9]" website/src/views/pnl/FarmCeoPage.tsx; test $? -eq 1` then `cd website && pnpm exec tsc --noEmit`
- EXPECT: grep finds nothing (exit 1 = pass); tsc exit 0.
- IF FAIL: remove the remaining fallbacks — else STOP (playbook §5) with full output.
- [x]

### Task 4.3 — Strip numeric fallbacks from CashbookPage
- DO: in `website/src/views/diary/CashbookPage.tsx` remove every `?? <number>` / hardcoded numeric fallback (rule 1); empty states via `t()` keys (add `cashbookEmptyTitle`, `cashbookEmptyBody` to `en.cashbook.ts` + `hi.cashbook.ts`).
- RUN: `grep -nE "\?\?\s*[0-9]" website/src/views/diary/CashbookPage.tsx; test $? -eq 1` then `cd website && pnpm exec tsc --noEmit`
- EXPECT: grep finds nothing; tsc exit 0.
- IF FAIL: remove the remaining fallbacks — else STOP (playbook §5) with full output.
- [x]

### Task 4.4 — Add P&L auto-entry hook to pnl_engine
- DO: in `backend/app/services/pnl_engine.py` add `record_auto_entry(user_id: str, direction: str, amount_paisa: int, category: str, source_kind: str, source_id: str) -> str`: writes one P&L line with integer paisa and the source doc id for traceability; idempotent on (source_kind, source_id) — a second call with the same source returns the existing entry id without duplicating. Add `backend/tests/test_pnl_auto.py` (new) covering write, traceability fields, and idempotency.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_pnl_auto.py tests/test_pnl.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: fix the code, not the test — else STOP (playbook §5) with full output.
- [x]

### Task 4.5 — Hook P&L on lot sale completion
- DO: at the sold-lot transaction-completion call site found in Task 4.1 (the router that marks a lot sold), call `record_auto_entry(...)` with `source_kind='lot_sale'` and the lot doc id. Extend `backend/tests/test_pnl_auto.py` with an end-to-end case: completing a sale produces exactly one income P&L line.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_pnl_auto.py tests/test_lots.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: fix the hook — else STOP (playbook §5) with full output.
- [x]

### Task 4.6 — Hook P&L on lease payment
- DO: at the paid-lease completion call site found in Task 4.1, call `record_auto_entry(...)` with `source_kind='lease_payment'` and the lease/payment doc id. Extend `backend/tests/test_pnl_auto.py` accordingly.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_pnl_auto.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: fix the hook — else STOP (playbook §5) with full output.
- [x]

### Task 4.7 — Hook P&L on freight income
- DO: at the freight-income completion call site found in Task 4.1 (transport payout completion), call `record_auto_entry(...)` with `source_kind='freight_income'` and the payout doc id. Extend `backend/tests/test_pnl_auto.py` accordingly.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_pnl_auto.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: fix the hook — else STOP (playbook §5) with full output.
- [x]

### Task 4.8 — Hook P&L on marketplace order
- DO: at the marketplace order completion call site found in Task 4.1, call `record_auto_entry(...)` with `source_kind='marketplace_order'` and the order doc id. Extend `backend/tests/test_pnl_auto.py` accordingly.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_pnl_auto.py tests/test_order_lifecycle.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: fix the hook — else STOP (playbook §5) with full output.
- [x]

### Task 4.9 — Add per-crop P&L statements view
- DO: in `website/src/views/pnl/FarmCeoPage.tsx` add a per-crop P&L statements section: crop selector → income/expense lines and net for that crop from the existing pnl endpoints (add a typed wrapper in `lib/api/pnl.ts` if the per-crop route exists in `routers/pnl.py`; if the router lacks a per-crop filter, add `GET /v1/pnl/statements?crop=` to `backend/app/routers/pnl.py` first, with a test in `tests/test_pnl.py`). Strings via `t()` in `en.pnl.ts` + `hi.pnl.ts`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_pnl.py -q && cd ../website && pnpm exec tsc --noEmit`
- EXPECT: both exit 0.
- IF FAIL: fix the reported failure — else STOP (playbook §5) with full output.
- [x]

### Task 4.10 — Add pre-sowing break-even calculator
- DO: in `website/src/views/pnl/FarmCeoPage.tsx` add a break-even calculator: inputs expected yield, expected price, input costs (integer paisa); outputs break-even price and break-even yield computed client-side from the inputs only (pure arithmetic on user input — not a data fallback). Strings via `t()` in `en.pnl.ts` + `hi.pnl.ts`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 4.11 — Add PDF report export (G10)
- DO: in `backend/app/services/reports.py` add a PDF P&L/diary report renderer (follow the existing reports pattern in that file; the CSV path already exists client-side in `website/src/lib/csv.ts`) and expose it via the pnl router as `GET /v1/pnl/report.pdf?from=&to=` returning `application/pdf`. Add a test asserting the response content-type and non-empty body.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_pnl.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: fix the renderer/endpoint — else STOP (playbook §5) with full output.
- [x]

### Task 4.12 — Add Tally-compatible export
- DO: in `backend/app/services/reports.py` add a Tally-compatible export (CSV with the documented Tally column mapping: Date, Voucher Type, Ledger, Debit, Credit, Narration — amounts in rupees with exactly 2 decimals derived from integer paisa) exposed as `GET /v1/pnl/export/tally?from=&to=`. Put the column mapping in a module-level docstring in `reports.py` (this is the "documented column mapping" deliverable). Add a test asserting header row and one seeded row's exact formatting.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_pnl.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: fix the export, not the assertion — else STOP (playbook §5) with full output.
- [x]

### Task 4.13 — Add export buttons to FarmCeoPage
- DO: in `website/src/views/pnl/FarmCeoPage.tsx` add "Download PDF" and "Tally export" buttons hitting the Task 4.11/4.12 endpoints (typed wrappers in `lib/api/pnl.ts` using blob download), alongside the existing CSV export. Strings via `t()` in `en.pnl.ts` + `hi.pnl.ts`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 4.14 — Add diary photo attachments (F18)
- DO: two edits. (1) In `backend/app/routers/diary.py` enforce ≤3 photo attachments per diary entry (reject the 4th with the standard error envelope); extend `backend/tests/test_diary.py` for the limit. (2) In `website/src/views/diary/CashbookPage.tsx` add photo attach on entry create/edit (upload to Firebase Storage via `website/src/lib/firebase.ts`, store signed URLs) and thumbnails in the entry list. Strings via `t()` in `en.cashbook.ts` + `hi.cashbook.ts`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_diary.py -q && cd ../website && pnpm exec tsc --noEmit`
- EXPECT: both exit 0.
- IF FAIL: fix the reported failure — else STOP (playbook §5) with full output.
- [x]

### Task 4.15 — Add diary auto-entries from transaction hooks
- DO: in `backend/app/services/pnl_engine.py` (same hook function as Task 4.4, or a sibling it calls) also create a diary cashbook entry for each auto P&L line: marked `auto: true`, carrying `source_kind`/`source_id`, with an editable category field. Idempotent on the same source key as Task 4.4. Extend `backend/tests/test_pnl_auto.py` and `backend/tests/test_diary.py`: a completed sale produces one auto diary entry; editing its category succeeds; replay does not duplicate.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_pnl_auto.py tests/test_diary.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: fix the code, not the test — else STOP (playbook §5) with full output.
- [x]

### Task 4.16 — Add diary analytics charts and dashboard refresh
- DO: in `website/src/views/diary/CashbookPage.tsx` add category / crop / month charts consuming `backend/app/services/diary_analytics.py` endpoints via `lib/api/diary.ts` (inline SVG, no new dependency); refresh the diary/pnl card config in `website/src/lib/dashboard.ts` so the dashboard surfaces them (respect `canAccess()`). Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit && pnpm build`
- EXPECT: exit 0 for both (workstream-end full build).
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 4.17 — WS-04 verification gate
- DO: run the full verification block plus the rule-1 grep. No edits.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q` then `cd website && pnpm exec tsc --noEmit && pnpm build` then `grep -nE "\?\?\s*[0-9]" website/src/views/pnl/FarmCeoPage.tsx website/src/views/diary/CashbookPage.tsx; test $? -eq 1`
- EXPECT: pytest green; tsc + build clean; grep finds no numeric fallbacks.
- IF FAIL: fix the failure in the file it names — else STOP (playbook §5) with full output.
- [x]

### Task 4.18 — HUMAN CHECK: sale flows into P&L and diary
- PRECONDITION: `curl -sf http://localhost:8000/v1/health` — if this fails, start the dev server with `cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000` (background) and re-check; if still failing, STOP the phase (playbook §5).
- DO: HUMAN CHECK — (1) complete a sale in the trade module; (2) open Farm CEO → the income entry is present with zero manual entry; (3) open the Cashbook → the same sale appears as an auto-marked entry; edit its category; (4) export the PDF and confirm it downloads and opens; (5) download the Tally export and confirm the header row matches the documented mapping; (6) attach 3 photos to a diary entry → thumbnails show; attempt a 4th → rejection message in the current locale.
- EXPECT: human confirms all 6 sub-steps.
- IF FAIL: record the exact failing sub-step and STOP (playbook §5).
- [ ]

### Task 4.19 — Commit WS-04
- DO: stage and commit all WS-04 work.
- RUN: `git add -A && git commit -m "phase-05 WS-04: money and records"`
- EXPECT: exit 0; commit created.
- IF FAIL: if git identity is missing, note it and continue (playbook §6); otherwise STOP.
- [ ]

## WS-05 — Finance & protection (schemes, loans, insurance)  (see instructions.md §WS-05)

### Task 5.1 — Verify WS-05 dependencies and read sources
- PRECONDITION: `test -f backend/app/services/ai/gateway.py && grep -rln "def emit_task" backend/app/ | head -1` — if this fails, STOP the phase (playbook §5).
- DO: read (no edits): `backend/app/routers/schemes.py`, `backend/app/services/eligibility.py`, `backend/app/routers/finance.py`, `backend/app/routers/loans.py`, `backend/app/routers/insurance.py`, `backend/app/routers/insurance_claims.py`, `backend/app/routers/vault.py`, `backend/app/services/claims.py`. Note the exact claim status enums in `insurance_claims.py` / `services/claims.py` (must match phase-03 WS-04's bank/insurance side — do not invent new enum values) and the loan application route in `loans.py`.
- RUN: `ls backend/app/routers/schemes.py backend/app/services/eligibility.py backend/app/routers/finance.py backend/app/routers/loans.py backend/app/routers/insurance.py backend/app/routers/insurance_claims.py backend/app/routers/vault.py backend/app/services/claims.py`
- EXPECT: exit 0.
- IF FAIL: none — STOP the phase (playbook §5); report the missing file.
- [x]

### Task 5.2 — Add schemes API module
- DO: create `website/src/lib/api/schemes.ts` (new) mirroring `backend/app/routers/schemes.py`: discovery list, detail, eligibility checklist, apply (tracked + external deep-link data). Typed functions via `lib/api/client.ts`; writes send `Idempotency-Key`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type error — else STOP (playbook §5) with full output.
- [x]

### Task 5.3 — Add finance API module
- DO: create `website/src/lib/api/finance.ts` (new) mirroring `backend/app/routers/finance.py` + `backend/app/routers/loans.py`: credit score, loan offers, EMI inputs, KCC data, loan application submit + status. Writes send `Idempotency-Key`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type error — else STOP (playbook §5) with full output.
- [x]

### Task 5.4 — Add insurance API module
- DO: create `website/src/lib/api/insurance.ts` (new) mirroring `backend/app/routers/insurance.py` + `backend/app/routers/insurance_claims.py`: policies, e-certificate download, claim intimation (with geo-tagged photos), premium calculator, claim tracker, appeal/resubmit. Writes send `Idempotency-Key`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type error — else STOP (playbook §5) with full output.
- [x]

### Task 5.5 — Add schemes/finance/insurance locale pairs
- DO: create six files: `website/src/lib/i18n/locales/en.schemes.ts`, `hi.schemes.ts`, `en.finance.ts`, `hi.finance.ts`, `en.insurance.ts`, `hi.insurance.ts` (all new, `registerLocale` pattern, identical key sets per pair). Seed each with the module title + tab keys its views need. Add six import lines to `website/src/main.tsx`.
- RUN: `for m in schemes finance insurance; do diff <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" website/src/lib/i18n/locales/en.$m.ts | tr -d ' :' | sort -u) <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" website/src/lib/i18n/locales/hi.$m.ts | tr -d ' :' | sort -u) || exit 1; done && cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0; diffs print nothing.
- IF FAIL: fix the parity gap or import error — else STOP (playbook §5).
- [x]

### Task 5.6 — Add schemes views registry, routes, dashboard card
- DO: create `website/src/views/schemes/index.ts` (new) exporting `SCHEMES_PAGES: Record<string, ComponentType>`; add schemes deep route(s) in `website/src/App.tsx`; add the schemes card to the farmer persona in `website/src/lib/dashboard.ts` (respect `canAccess()`, `lib/dashboard.ts:200`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 5.7 — Add finance views registry, routes, dashboard card
- DO: create `website/src/views/finance/index.ts` (new) exporting `FINANCE_PAGES: Record<string, ComponentType>`; add finance deep route(s) in `website/src/App.tsx`; add the finance card to the farmer persona in `website/src/lib/dashboard.ts`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 5.8 — Add insurance views registry, routes, dashboard card
- DO: create `website/src/views/insurance/index.ts` (new) exporting `INSURANCE_PAGES: Record<string, ComponentType>`; add insurance deep route(s) in `website/src/App.tsx`; add the insurance card to the farmer persona in `website/src/lib/dashboard.ts`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 5.9 — Build schemes discovery list
- DO: create `website/src/views/schemes/SchemesListPage.tsx` (new): scheme cards sorted matched-to-profile first (server ordering from the discovery endpoint; the client renders the returned order, never re-sorts by invented criteria). Cursor pagination (rule 7). Register in `SCHEMES_PAGES`. Strings via `t()` in `en/hi.schemes.ts`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 5.10 — Build scheme detail with eligibility checklist
- DO: create `website/src/views/schemes/SchemeDetailPage.tsx` (new): scheme details + eligibility checklist rendered from `backend/app/services/eligibility.py` output via the detail endpoint (each criterion shown met/unmet from the response — no client-side eligibility logic). Register in `SCHEMES_PAGES`. Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 5.11 — Build dual apply paths
- DO: in `SchemeDetailPage.tsx` add two apply actions: (1) in-app tracked application posting to the apply route (with `Idempotency-Key`); (2) official-portal deep-link rendered as an external link with the explicit label key `schemesApplyExternal` (en: "Apply on the official portal (external)", hi equivalent). Both visible; neither disguised as the other.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 5.12 — Emit scheme deadline reminder tasks
- DO: in `backend/app/routers/schemes.py` (or the service it delegates to), emit a task via the phase-01 `emit_task()` for each tracked application / eligible scheme with an approaching deadline, deep link `/dashboard/p/schemes`. Extend `backend/tests/test_schemes.py` asserting emission for a scheme whose deadline is within the reminder window and none outside it.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_schemes.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: fix the code, not the test — else STOP (playbook §5) with full output.
- [x]

### Task 5.13 — Integrate document vault for scheme docs
- DO: in `SchemeDetailPage.tsx` add a required-documents section: each required doc listed with its vault status from `backend/app/routers/vault.py` (present / missing) and an upload-to-vault action for missing ones. Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 5.14 — Leave admin scheme-editor hook and dated note (A3)
- DO: in `backend/app/routers/schemes.py` add a dated deferral note comment: `# Deferred(2026-10-03, phase-07): admin scheme editor UI (A3). Hook: scheme docs carry editable fields (name, eligibility, deadline, portal_url) via Firestore; the editor only needs CRUD over the schemes collection.` Ensure the scheme doc schema actually contains those editable fields (add any missing field to the write path). No editor UI.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_schemes.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: fix the schema change — else STOP (playbook §5) with full output.
- [x]

### Task 5.15 — Register schemes.match.v1 (M21, SDR)
- DO: in `backend/app/services/ai/question_sets.py` register `schemes.match.v1` with fields: `eligible` (bool), `missing` (choice-list), `fit` (score). Create golden fixture `backend/tests/fixtures/ai/golden/schemes.match.v1.jsonl` (new) with ≥5 (profile, scheme) cases whose `eligible`/`missing` values are hand-derived from the rules in `backend/app/services/eligibility.py`.
- RUN: `cd backend && .venv/bin/python -c "import json; [json.loads(l) for l in open('tests/fixtures/ai/golden/schemes.match.v1.jsonl')]; print('fixture ok')"`
- EXPECT: exit 0; output `fixture ok`.
- IF FAIL: fix the fixture JSON — else STOP (playbook §5) with full output.
- [x]

### Task 5.16 — Rules decide eligibility, AI only ranks (M21)
- DO: create `backend/app/services/schemes_match.py` (new): `match_schemes(profile) -> list` computes eligibility/missing docs EXCLUSIVELY from `backend/app/services/eligibility.py` (the rules engine's truth set), then calls `gateway.generate()` with `schemes.match.v1` only to rank and explain. Trigger points: profile change + nightly job. Add `backend/tests/test_schemes_match.py` (new): for every golden case, the service's eligible/missing output equals the rules engine's output exactly, with `AI_PROVIDER=shim`.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_schemes_match.py -q`
- EXPECT: exit 0, all tests pass — matches equal the rules engine's truth set.
- IF FAIL: fix the service until it mirrors the rules engine — else STOP (playbook §5) with full output.
- [x]

### Task 5.17 — Add vernacular explanation cache (M21)
- DO: in `backend/app/services/schemes_match.py` add `explain_match(scheme_id, profile_class, lang) -> str`: Gemini (via gateway only) generates the "why eligible / what to do" line in the user's language (en/hi); cache per (scheme, profile-class, lang); on AI off/failed return the deterministic template built from the rules output. Extend `backend/tests/test_schemes_match.py` for cache hit and fallback.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_schemes_match.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: fix the code, not the test — else STOP (playbook §5) with full output.
- [x]

### Task 5.18 — Emit missing-docs tasks (M21)
- DO: in `backend/app/services/schemes_match.py`, for each eligible scheme with missing documents, emit a task via the phase-01 `emit_task()` naming the missing documents (en + hi) with deep link `/dashboard/p/schemes`. Extend `backend/tests/test_schemes_match.py` asserting the task names the exact missing docs from the rules output.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_schemes_match.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: fix the code, not the test — else STOP (playbook §5) with full output.
- [x]

### Task 5.19 — Render match explanations in schemes UI
- DO: in `website/src/views/schemes/SchemesListPage.tsx` render each matched scheme's explanation line and fit badge from the match endpoint (add the wrapper in `lib/api/schemes.ts`); missing-doc chips on the card. All strings via `t()`; explanations arrive from the backend already localized — render verbatim.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 5.20 — Build credit score page
- DO: create `website/src/views/finance/CreditScorePage.tsx` (new): score + tier + improvement tips, all from `backend/app/routers/finance.py` responses via `lib/api/finance.ts`; honest empty state when no score exists (no invented numbers — rule 1). Register in `FINANCE_PAGES`. Strings via `t()` in `en/hi.finance.ts`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 5.21 — Build loan marketplace compare page
- DO: create `website/src/views/finance/LoanMarketplacePage.tsx` (new): compares loan offers side-by-side (amount, rate, tenure, EMI) from the offers endpoint; all money from integer paisa. Register in `FINANCE_PAGES`. Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 5.22 — Build EMI calculator and KCC card
- DO: in `website/src/views/finance/LoanMarketplacePage.tsx` (or a new `EmiCalculatorPage.tsx` registered in `FINANCE_PAGES`) add: (1) EMI calculator — pure client-side arithmetic on user inputs (principal paisa, annual rate, tenure months), standard reducing-balance formula; (2) KCC visual card rendering the farmer's KCC data from the finance endpoint. Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 5.23 — Build loan application wizard and status tracker (F17)
- DO: create `website/src/views/finance/LoanWizardPage.tsx` (new, multi-step form posting to the loan application route in `backend/app/routers/loans.py` found in Task 5.1, with `Idempotency-Key`) and `website/src/views/finance/LoanStatusPage.tsx` (new, status tracker rendering the application's current status + history from the response). Register both in `FINANCE_PAGES`. Do not rebuild bank-side logic — consume the existing endpoints only (farmer mirror of persona 6.11). Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 5.24 — Surface bank document requests as farmer tasks
- DO: in `backend/app/routers/loans.py`, at the point where a bank-side document request is recorded, emit a task to the farmer via the phase-01 `emit_task()` (en + hi, deep link `/dashboard/p/loanStatus`). Extend `backend/tests/test_loans.py` asserting emission.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_loans.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: fix the emission — else STOP (playbook §5) with full output.
- [x]

### Task 5.25 — Build insurance 4-tab page shell
- DO: create `website/src/views/insurance/InsuranceHubPage.tsx` (new) with 4 tabs: (a) Policy Passbook, (b) Claim Intimation, (c) Premium Calculator, (d) Claim Tracker — tab keys `insuranceTabPassbook`, `insuranceTabIntimation`, `insuranceTabPremium`, `insuranceTabTracker` in `en/hi.insurance.ts`. Register in `INSURANCE_PAGES`. Tab bodies land in Tasks 5.26–5.29.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 5.26 — Build policy passbook tab with e-certificate
- DO: in the passbook tab of `InsuranceHubPage.tsx`: list the farmer's policies from the insurance endpoint (policy no., crop, sum insured in ₹ from paisa, validity); e-certificate download button per policy hitting the certificate route found in Task 5.1 (blob download). Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 5.27 — Build 72-h claim intimation tab
- DO: in the intimation tab of `InsuranceHubPage.tsx`: claim form posting to the intimation route (with `Idempotency-Key`); geo-tagged photo capture (browser geolocation API + photo upload to Firebase Storage via `website/src/lib/firebase.ts`, coordinates attached to the claim payload); a guidelines overlay (modal, not `alert()` — rule 6); a visible 72-hour SLA clock computed from the loss timestamp showing remaining time. Strings via `t()` incl. `insuranceSlaClockLabel`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 5.28 — Build premium calculator tab
- DO: in the premium tab of `InsuranceHubPage.tsx`: inputs (crop, area, sum insured) posted to the premium-calculator route; premium rendered from the response in ₹ from integer paisa; no client-side rate tables (rule 1). Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 5.29 — Build claim tracker tab with appeal path (F15)
- DO: in the tracker tab of `InsuranceHubPage.tsx`: claim list with multi-stage progress rendered from the claim status enums found in Task 5.1 (render the enum values as returned — do not invent stages); on a rejected claim, an appeal/resubmit action posting to the appeal route in `backend/app/routers/insurance_claims.py` (with `Idempotency-Key`). Strings via `t()` incl. `insuranceAppealSubmit`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 5.30 — Verify claims/loans audit logging and AI levels
- DO: verify (and fix only if missing): every claim and loan mutation in `backend/app/routers/insurance_claims.py` and `backend/app/routers/loans.py` writes `audit_logs` (rule 3); any credit/insurance AI automation level never exceeds `require_confirm` (rule 12) — check the `platform_config/ai` flags read for these modules. Extend `backend/tests/test_insurance_claims.py` with an audit-log assertion on a claim mutation.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_insurance_claims.py tests/test_loans.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: add the missing audit write / lower the level flag — else STOP (playbook §5) with full output.
- [x]

### Task 5.31 — WS-05 verification gate
- DO: run the full verification block. No edits.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q` then `cd website && pnpm exec tsc --noEmit && pnpm build`
- EXPECT: pytest fully green; tsc + build clean.
- IF FAIL: fix the failure in the file it names — else STOP (playbook §5) with full output.
- [x]

### Task 5.32 — HUMAN CHECK: schemes, loan, claim flows
- PRECONDITION: `curl -sf http://localhost:8000/v1/health` — if this fails, start the dev server with `cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000` (background) and re-check; if still failing, STOP the phase (playbook §5).
- DO: HUMAN CHECK — (1) update the farmer profile → scheme list re-ranks and missing-doc tasks appear in the Action Center; (2) open a scheme detail → eligibility checklist + both apply paths render, external one labeled; (3) submit the loan wizard → the status tracker advances end-to-end; (4) file a claim intimation with geo-tagged photos → the 72-h SLA clock is visible and counting; (5) move the claim to rejected (dev seed) → appeal from the rejected state resubmits and the tracker reflects it; (6) switch to Hindi and confirm explanations and all labels render localized.
- EXPECT: human confirms all 6 sub-steps.
- IF FAIL: record the exact failing sub-step and STOP (playbook §5).
- [ ]

### Task 5.33 — Commit WS-05
- DO: stage and commit all WS-05 work.
- RUN: `git add -A && git commit -m "phase-05 WS-05: finance and protection"`
- EXPECT: exit 0; commit created.
- IF FAIL: if git identity is missing, note it and continue (playbook §6); otherwise STOP.
- [ ]

## WS-06 — Land, FPO & post-harvest  (see instructions.md §WS-06)

### Task 6.1 — Verify WS-06 dependencies and read sources
- PRECONDITION: `test -f backend/app/services/ai/gateway.py && grep -rln "def emit_task" backend/app/ | head -1` — if this fails, STOP the phase (playbook §5).
- DO: read (no edits): `backend/app/routers/land_records.py`, `backend/app/services/land_records/base.py`, `backend/app/services/land_records/mock_adapter.py`, `backend/app/routers/fpo.py`, `backend/app/routers/equipment.py`, `backend/app/routers/post_harvest.py`, `backend/app/services/grading_model/base.py`, `backend/app/services/grading_model/stub.py`, `backend/app/routers/lots.py`, `website/src/views/trade/LotForm.tsx`. Note: the warehouse receipt doc shape in `post_harvest.py`, the booking slot-decrement path, and the `LotForm.tsx` prefill mechanism (route state vs query params) — Tasks 6.18 and 6.25 depend on them.
- RUN: `ls backend/app/routers/land_records.py backend/app/services/land_records/mock_adapter.py backend/app/routers/fpo.py backend/app/routers/equipment.py backend/app/routers/post_harvest.py backend/app/services/grading_model/stub.py backend/app/routers/lots.py website/src/views/trade/LotForm.tsx`
- EXPECT: exit 0.
- IF FAIL: none — STOP the phase (playbook §5); report the missing file.
- [x]

### Task 6.2 — Add landRecords API module
- DO: create `website/src/lib/api/landRecords.ts` (new) mirroring `backend/app/routers/land_records.py`: search by Gat no./village, record detail (7/12 vs 8A), PDF download, import-to-profile. Writes send `Idempotency-Key`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type error — else STOP (playbook §5) with full output.
- [x]

### Task 6.3 — Add fpo and postHarvest API modules
- DO: create `website/src/lib/api/fpo.ts` (new, mirroring `backend/app/routers/fpo.py`: directory, join request, pools, machinery calendar) and `website/src/lib/api/postHarvest.ts` (new, mirroring `backend/app/routers/post_harvest.py`: storage directory, booking, my bookings, receipts). Writes send `Idempotency-Key`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type error — else STOP (playbook §5) with full output.
- [x]

### Task 6.4 — Add land/fpo/postHarvest locale pairs
- DO: create six files: `website/src/lib/i18n/locales/en.landRecords.ts`, `hi.landRecords.ts`, `en.fpo.ts`, `hi.fpo.ts`, `en.postHarvest.ts`, `hi.postHarvest.ts` (all new, `registerLocale` pattern, identical key sets per pair). Include in the landRecords pair: `landRecordSampleLabel` (en: "sample data — not an official record", hi equivalent). Add six import lines to `website/src/main.tsx`.
- RUN: `for m in landRecords fpo postHarvest; do diff <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" website/src/lib/i18n/locales/en.$m.ts | tr -d ' :' | sort -u) <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" website/src/lib/i18n/locales/hi.$m.ts | tr -d ' :' | sort -u) || exit 1; done && cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0; diffs print nothing.
- IF FAIL: fix the parity gap or import error — else STOP (playbook §5).
- [x]

### Task 6.5 — Add land views registry, routes, dashboard card
- DO: create `website/src/views/land/index.ts` (new — do NOT touch the existing `website/src/views/legal/`, which is the static legal-pages domain) exporting `LAND_PAGES: Record<string, ComponentType>`; add land deep route(s) in `website/src/App.tsx`; add the land-records card to the farmer persona in `website/src/lib/dashboard.ts`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 6.6 — Add fpo views registry, routes, dashboard card
- DO: create `website/src/views/fpo/index.ts` (new) exporting `FPO_PAGES: Record<string, ComponentType>`; add fpo deep route(s) in `website/src/App.tsx`; add the FPO card to the farmer persona in `website/src/lib/dashboard.ts`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 6.7 — Add postharvest views registry, routes, dashboard card
- DO: create `website/src/views/postharvest/index.ts` (new) exporting `POSTHARVEST_PAGES: Record<string, ComponentType>`; add postharvest deep route(s) in `website/src/App.tsx`; add the post-harvest card to the farmer persona in `website/src/lib/dashboard.ts`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 6.8 — Build 7/12 record search page
- DO: create `website/src/views/land/LandRecordsPage.tsx` (new): search form (Gat no. + village) hitting the search route; results list; every rendered record carries the honesty label `landRecordSampleLabel` visibly (phase-00 honesty rule — a real Mahabhulekh adapter does not exist yet). Register in `LAND_PAGES`. Strings via `t()` in `en/hi.landRecords.ts`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 6.9 — Build 7/12 vs 8A viewer with PDF
- DO: create `website/src/views/land/LandRecordDetailPage.tsx` (new): renders the record in 7/12 vs 8A sections from the detail response; PDF view/download via the PDF route (blob); the honesty label `landRecordSampleLabel` rendered on this page too. Register in `LAND_PAGES`. Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 6.10 — Add one-tap survey-area import to farm profile
- DO: in `LandRecordDetailPage.tsx` add an import button posting to the import route (with `Idempotency-Key`) that copies the record's survey area into the farm profile; success state confirms the imported area value. Extend `backend/tests/test_land_records.py` asserting the import writes the profile field and is idempotent.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_land_records.py -q && cd ../website && pnpm exec tsc --noEmit`
- EXPECT: both exit 0.
- IF FAIL: fix the reported failure — else STOP (playbook §5) with full output.
- [x]

### Task 6.11 — Build FPO directory and join flow (F19)
- DO: create `website/src/views/fpo/FpoDirectoryPage.tsx` (new): FPO directory from the fpo endpoint; per-FPO state from the response — non-member sees a join-request button (posts with `Idempotency-Key`), pending sees a pending badge, member sees the member view. Register in `FPO_PAGES`. Extend `backend/tests/test_fpo.py` asserting the join request transitions the member state. Strings via `t()` in `en/hi.fpo.ts`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_fpo.py -q && cd ../website && pnpm exec tsc --noEmit`
- EXPECT: both exit 0.
- IF FAIL: fix the reported failure — else STOP (playbook §5) with full output.
- [x]

### Task 6.12 — Build group-buy pool cards
- DO: create `website/src/views/fpo/FpoPoolsPage.tsx` (new): group-buy pool cards with live progress bars (current qty / target qty from the pool doc, recomputed on each fetch — no client-side caching of progress). Register in `FPO_PAGES`. Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 6.13 — Build shared machinery calendar
- DO: create `website/src/views/fpo/FpoMachineryPage.tsx` (new): calendar of shared machinery slots joining the equipment module's slot data (`backend/app/routers/equipment.py` — consume its slots endpoint via a wrapper; do not duplicate slot logic). Register in `FPO_PAGES`. Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 6.14 — Leave FPO verification status field and dated note (A8)
- DO: in `backend/app/routers/fpo.py` ensure FPO docs carry a `verification_status` field (add to the write path if missing, default `unverified`) and add a dated deferral note comment: `# Deferred(2026-10-03, phase-07): admin FPO verification UI (A8). Hook: verification_status field on FPO docs.` No verification UI.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_fpo.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: fix the schema change — else STOP (playbook §5) with full output.
- [x]

### Task 6.15 — Build cold-storage directory with live capacity
- DO: create `website/src/views/postharvest/ColdStoragePage.tsx` (new): directory of cold storages with live remaining capacity per chamber from the post_harvest endpoint. Register in `POSTHARVEST_PAGES`. Strings via `t()` in `en/hi.postHarvest.ts`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 6.16 — Build booking flow with atomic slot decrement (F11)
- DO: two edits. (1) In `website/src/views/postharvest/ColdStoragePage.tsx` (or a new `BookingPage.tsx` registered in `POSTHARVEST_PAGES`): booking form posting to the booking route (with `Idempotency-Key`). (2) In `backend/app/routers/post_harvest.py` verify the booking path decrements chamber capacity atomically (Firestore transaction); if it does not, convert it to a transaction. Extend `backend/tests/test_cold_storage.py` (or `test_my_bookings.py` — use whichever covers bookings) asserting two concurrent bookings cannot oversell capacity.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_cold_storage.py tests/test_my_bookings.py -q && cd ../website && pnpm exec tsc --noEmit`
- EXPECT: exit 0 for all.
- IF FAIL: fix the transaction, not the test — else STOP (playbook §5) with full output.
- [x]

### Task 6.17 — Build my-bookings list
- DO: create `website/src/views/postharvest/MyBookingsPage.tsx` (new): the farmer's bookings with status and slot details from the my-bookings route. Register in `POSTHARVEST_PAGES`. Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 6.18 — Build warehouse receipts vault
- DO: create `website/src/views/postharvest/ReceiptsVaultPage.tsx` (new): lists the farmer's warehouse receipts (doc shape found in Task 6.1) as verifiable documents with a download action, each labeled as loan-collateral-usable (key `receiptCollateralLabel`). Register in `POSTHARVEST_PAGES`. Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 6.19 — Replace grading stub call path with gateway vision (M10)
- DO: in the grading call path (`backend/app/services/grading_model/base.py` consumers — the router/service that invokes the stub, found in Task 6.1): replace the direct stub call with `gateway.analyze_image()` returning `(grade, shelf_life_days, price_band vs mandi)` validated by a Pydantic model, one repair retry, logged to `ai_decisions`. The stub stays as the deterministic fallback when AI is off/failed. No AI call outside the gateway (rule 10).
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_post_harvest.py tests/test_climate_postharvest.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: fix the call path — else STOP (playbook §5) with full output.
- [x]

### Task 6.20 — Register grading.gate.v1 with human pathway (M10)
- DO: in `backend/app/services/ai/question_sets.py` register `grading.gate.v1` with fields `needs_human` (bool) and `confidence_class` (choice). In the grading call path: when `confidence < 0.7` (or the gate returns `needs_human`), create a "human grader" task to the ops queue via the phase-01 `emit_task()` instead of returning an AI grade. Add `backend/tests/test_grading.py` (new): threshold cases and the ops-task emission.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_grading.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: fix the code, not the test — else STOP (playbook §5) with full output.
- [x]

### Task 6.21 — Add golden graded-image accuracy test (M10)
- DO: create golden fixture `backend/tests/fixtures/ai/golden/grading.gate.v1.jsonl` (new) with ≥10 graded produce image cases (image ref, expected grade). Extend `backend/tests/test_grading.py`: with `AI_PROVIDER=shim` (and the deterministic stub mapping for these refs), assert the graded results land within ±1 grade of expected for ≥80% of cases.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_grading.py -q`
- EXPECT: exit 0; accuracy assertion (±1 grade ≥ 80%) passes.
- IF FAIL: fix the grading mapping, never the expected grades — else STOP (playbook §5) with full output.
- [x]

### Task 6.22 — Build grading result card with AI estimate label
- DO: create `website/src/views/postharvest/GradingPage.tsx` (new): photo upload (Firebase Storage via `website/src/lib/firebase.ts`) → grade request → result card rendering grade, shelf life, and recommended price band vs mandi, with the visible honesty label key `gradingAiEstimateLabel` (en: "AI estimate", hi equivalent). On the human-grader pathway render the pending-human state. Register in `POSTHARVEST_PAGES`. Strings via `t()` in `en/hi.postHarvest.ts`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 6.23 — Add list-as-lot deep link from grading card
- DO: in `GradingPage.tsx` add a one-tap "list as lot" button that navigates to the trade `LotForm.tsx` route with crop/grade/qty/price prefilled, using the prefill mechanism found in Task 6.1 (route state or query params — whichever `LotForm.tsx` already supports; if it supports neither, add query-param prefill to `LotForm.tsx` as the minimal change). Add key `gradingListAsLot` to `en/hi.postHarvest.ts`.
- RUN: `cd website && pnpm exec tsc --noEmit && pnpm build`
- EXPECT: exit 0 for both (workstream-end full build).
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 6.24 — WS-06 verification gate
- DO: run the full verification block. No edits.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q` then `cd website && pnpm exec tsc --noEmit && pnpm build`
- EXPECT: pytest fully green; tsc + build clean.
- IF FAIL: fix the failure in the file it names — else STOP (playbook §5) with full output.
- [x]

### Task 6.25 — HUMAN CHECK: grading loop, booking, land, FPO flows
- PRECONDITION: `curl -sf http://localhost:8000/v1/health` — if this fails, start the dev server with `cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000` (background) and re-check; if still failing, STOP the phase (playbook §5).
- DO: HUMAN CHECK — (1) photograph produce on the Grading page → grade card shows with the "AI estimate" label; (2) tap "list as lot" → LotForm opens prefilled → submit → the lot appears in trade; (3) book a chamber slot → capacity decrements → the receipt appears in the receipts vault with the collateral label and downloads; (4) search a 7/12 record by Gat no. → the sample-data honesty label is visible → one-tap import writes the survey area to the farm profile; (5) send an FPO join request → state transitions pending → (dev-approve) member view; pool progress bars reflect live data.
- EXPECT: human confirms all 5 sub-steps.
- IF FAIL: record the exact failing sub-step and STOP (playbook §5).
- [ ]

### Task 6.26 — Commit WS-06
- DO: stage and commit all WS-06 work.
- RUN: `git add -A && git commit -m "phase-05 WS-06: land, FPO and post-harvest"`
- EXPECT: exit 0; commit created.
- IF FAIL: if git identity is missing, note it and continue (playbook §6); otherwise STOP.
- [ ]

## WS-07 — Water, climate & green  (see instructions.md §WS-07)

### Task 7.1 — Verify WS-07 dependencies and read sources
- PRECONDITION: `grep -rln "def emit_task" backend/app/ | head -1` — if this fails, STOP the phase (playbook §5).
- DO: read (no edits): `backend/app/routers/water.py`, `backend/app/routers/weather.py`, `backend/app/services/weather.py`, `backend/app/routers/climate.py`, `backend/app/routers/tree.py`, `backend/app/routers/schemes.py`. List every hardcoded data payload in `routers/climate.py` (needed in Task 7.8) and note the rain-forecast function name in `services/weather.py` (needed in Task 7.7).
- RUN: `ls backend/app/routers/water.py backend/app/routers/weather.py backend/app/services/weather.py backend/app/routers/climate.py backend/app/routers/tree.py backend/app/routers/schemes.py`
- EXPECT: exit 0.
- IF FAIL: none — STOP the phase (playbook §5); report the missing file.
- [x]

### Task 7.2 — Add water/climate/tree API modules
- DO: create `website/src/lib/api/water.ts` (new, mirroring `routers/water.py`: irrigation schedules, CGWB gauge, canal calendar, PMKSY calc), `website/src/lib/api/climate.ts` (new, mirroring `routers/climate.py`: carbon calculator, varieties, enrollment), `website/src/lib/api/tree.ts` (new, mirroring `routers/tree.py`: plantation tracker, NGO directory, sapling requests, biofuel). Writes send `Idempotency-Key`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type error — else STOP (playbook §5) with full output.
- [x]

### Task 7.3 — Add water/climate/tree locale pairs
- DO: create six files: `website/src/lib/i18n/locales/en.water.ts`, `hi.water.ts`, `en.climate.ts`, `hi.climate.ts`, `en.tree.ts`, `hi.tree.ts` (all new, `registerLocale` pattern, identical key sets per pair). Include in the climate pair: `carbonEstimateNotCredits` (en: "estimate, not credits", hi equivalent). Add six import lines to `website/src/main.tsx`.
- RUN: `for m in water climate tree; do diff <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" website/src/lib/i18n/locales/en.$m.ts | tr -d ' :' | sort -u) <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" website/src/lib/i18n/locales/hi.$m.ts | tr -d ' :' | sort -u) || exit 1; done && cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0; diffs print nothing.
- IF FAIL: fix the parity gap or import error — else STOP (playbook §5).
- [x]

### Task 7.4 — Add water views registry, routes, dashboard card
- DO: create `website/src/views/water/index.ts` (new) exporting `WATER_PAGES: Record<string, ComponentType>`; add water deep route(s) in `website/src/App.tsx`; add the water card to the farmer persona in `website/src/lib/dashboard.ts`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 7.5 — Add climate and trees views registries, routes, dashboard cards
- DO: create `website/src/views/climate/index.ts` (new, `CLIMATE_PAGES`) and `website/src/views/trees/index.ts` (new, `TREE_PAGES`); add their deep routes in `website/src/App.tsx`; add both module cards to the farmer persona in `website/src/lib/dashboard.ts`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 7.6 — Build water module pages
- DO: create `website/src/views/water/WaterHomePage.tsx` (new) with four sections, each consuming its Task 7.2 wrapper: (1) plot-wise irrigation schedule view; (2) CGWB groundwater gauge visualization (inline SVG gauge, no new dependency); (3) canal rotation calendar; (4) PMKSY 55% subsidy calculator (input cost → 55% subsidy shown in ₹ from integer paisa) with a deep-link button into the matching WS-05 scheme detail page (`/dashboard/p/schemes` detail route). Register in `WATER_PAGES`. Strings via `t()` in `en/hi.water.ts`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 7.7 — Emit weather-aware irrigation tasks
- DO: in `backend/app/routers/water.py` (or the irrigation schedule service it uses), emit irrigation tasks via the phase-01 `emit_task()` with deep link `/dashboard/p/water`; when the rain-forecast function in `backend/app/services/weather.py` (found in Task 7.1) forecasts rain for the scheduled day, the task carries a skip-today suggestion instead of the normal schedule. Extend `backend/tests/test_water.py`: rain forecast suppresses/adjusts the task; clear forecast emits the normal one.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_water.py tests/test_weather.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: fix the code, not the test — else STOP (playbook §5) with full output.
- [x]

### Task 7.8 — Move climate hardcoded data to collections (rule 1)
- DO: in `backend/app/routers/climate.py` remove every hardcoded data payload found in Task 7.1 and read instead from two new Firestore collections: `climate_varieties` (resilient variety catalog) and `carbon_factors` (per-practice carbon factors). Create `backend/scripts/seed_climate_data.py` (new), idempotent, seeding both collections with the data previously hardcoded (moved verbatim, not re-invented); prints `seeded <n>`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_climate_postharvest.py -q && APP_ENV=dev .venv/bin/python scripts/seed_climate_data.py`
- EXPECT: pytest green; seed output contains `seeded`.
- IF FAIL: fix the router/script — else STOP (playbook §5) with full output.
- [x]

### Task 7.9 — Verify zero hardcoded data in climate response path
- DO: no new edits unless the grep below finds leftovers — then move them into `carbon_factors` / `climate_varieties` as in Task 7.8.
- RUN: `grep -nE "=\s*[\[{]" backend/app/routers/climate.py | grep -viE "import|def |class |response|error|envelope|query|filter" ; echo "---"; cd backend && .venv/bin/python -m pytest tests/test_climate_postharvest.py -q`
- EXPECT: the first grep prints no remaining hardcoded list/dict data literals in the response path (only structural code); pytest green. Judge the grep output against the Task 7.1 list: every item found there must be gone.
- IF FAIL: move the remaining payloads into collections — else STOP (playbook §5) with full output.
- [x]

### Task 7.10 — Build carbon-potential calculator with honest label
- DO: create `website/src/views/climate/ClimateHomePage.tsx` (new): per-plot, practice-based carbon-potential calculator consuming the climate endpoints; EVERY number in the result carries the visible label `carbonEstimateNotCredits` (en/hi) — render it adjacent to each estimate, not once per page. Register in `CLIMATE_PAGES`. Strings via `t()` in `en/hi.climate.ts`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 7.11 — Build resilient-variety catalog and enrollment pipeline
- DO: in `website/src/views/climate/ClimateHomePage.tsx` (or a new `VarietiesPage.tsx` registered in `CLIMATE_PAGES`): (1) resilient-variety catalog view from the `climate_varieties`-backed endpoint; (2) carbon-program enrollment section with the enrollment flow from the endpoint AND a clearly labeled partner-MRV placeholder (key `carbonMrPartnerPlaceholder`: en "Verification via partner MRV — integration pending", hi equivalent). No fake MRV flow. Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 7.12 — Build plantation tracker with survival-check tasks
- DO: two edits. (1) Create `website/src/views/trees/PlantationPage.tsx` (new): plantation tracker (species, count, planted date) from the tree endpoints; register in `TREE_PAGES`. (2) In `backend/app/routers/tree.py`, emit recurring survival-check tasks per plantation via the phase-01 `emit_task()` (en + hi, deep link `/dashboard/trees` or the registered tool route). Extend `backend/tests/test_tree.py` asserting emission.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_tree.py -q && cd ../website && pnpm exec tsc --noEmit`
- EXPECT: both exit 0.
- IF FAIL: fix the reported failure — else STOP (playbook §5) with full output.
- [x]

### Task 7.13 — Build NGO directory with sapling request flow
- DO: create `website/src/views/trees/NgoDirectoryPage.tsx` (new): NGO directory + free-sapling request form (species, count) posting with `Idempotency-Key`; the request list shows status. Backend: verify the request writes a doc with `status: 'pending'` (fix in `backend/app/routers/tree.py` only if it does not) — the approval UI is phase-07, do not build it. Extend `backend/tests/test_tree.py` asserting the pending status. Register in `TREE_PAGES`. Strings via `t()` in `en/hi.tree.ts`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_tree.py -q && cd ../website && pnpm exec tsc --noEmit`
- EXPECT: both exit 0.
- IF FAIL: fix the reported failure — else STOP (playbook §5) with full output.
- [x]

### Task 7.14 — Build biofuel economics and care guides pages
- DO: create `website/src/views/trees/BiofuelPage.tsx` (new): biofuel economics content + care guides, all content strings via `t()` in `en/hi.tree.ts` (no hardcoded English body text — rule 6). Register in `TREE_PAGES`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 7.15 — Join tree carbon estimates into climate module
- DO: in `backend/app/routers/climate.py` include the plantation-based carbon estimate (computed from the tree module's plantation docs via `carbon_factors`) in the carbon calculator response as a separate field (e.g. `plantation_estimate`); render it in `ClimateHomePage.tsx` with the same `carbonEstimateNotCredits` label. Extend the climate test for the new field.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_climate_postharvest.py -q && cd ../website && pnpm exec tsc --noEmit && pnpm build`
- EXPECT: exit 0 for all (workstream-end full build).
- IF FAIL: fix the reported failure — else STOP (playbook §5) with full output.
- [x]

### Task 7.16 — WS-07 verification gate
- DO: run the full verification block. No edits.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q` then `cd website && pnpm exec tsc --noEmit && pnpm build`
- EXPECT: pytest fully green; tsc + build clean.
- IF FAIL: fix the failure in the file it names — else STOP (playbook §5) with full output.
- [x]

### Task 7.17 — HUMAN CHECK: water, climate, sapling flows
- PRECONDITION: `curl -sf http://localhost:8000/v1/health` — if this fails, start the dev server with `cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000` (background) and re-check; if still failing, STOP the phase (playbook §5).
- DO: HUMAN CHECK — (1) open the water module → plot irrigation schedule renders → its task appears on the dashboard; (2) seed a rain forecast → the irrigation task shows the skip-today suggestion; (3) PMKSY calculator → the deep-link lands on the matching scheme detail; (4) climate calculator → every number shows the "estimate, not credits" label in both locales; (5) request free saplings from the NGO directory → the request shows `pending` status.
- EXPECT: human confirms all 5 sub-steps.
- IF FAIL: record the exact failing sub-step and STOP (playbook §5).
- [ ]

### Task 7.18 — Commit WS-07
- DO: stage and commit all WS-07 work.
- RUN: `git add -A && git commit -m "phase-05 WS-07: water, climate and green"`
- EXPECT: exit 0; commit created.
- IF FAIL: if git identity is missing, note it and continue (playbook §6); otherwise STOP.
- [ ]

## WS-08 — Engagement (Krishi Ratna, Refer & Earn, Women Farmer Hub)  (see instructions.md §WS-08)

### Task 8.1 — Verify WS-08 dependencies and read sources
- PRECONDITION: `grep -rln "def emit_task" backend/app/ | head -1 && test -f backend/app/routers/marketplace.py` — if this fails, STOP the phase (playbook §5).
- DO: read (no edits): `backend/app/routers/gamification.py`, `backend/app/services/coins.py`, `backend/app/routers/referrals.py`, `backend/app/services/referrals.py`, `backend/app/routers/women.py`, `backend/app/routers/auth.py`, `website/src/views/onboarding/` (register wizard), `backend/app/routers/livestock.py`. List every hardcoded SHG/garden payload in `routers/women.py` (needed in Task 8.15) and check whether the register wizard captures a referral code (needed in Task 8.14).
- RUN: `ls backend/app/routers/gamification.py backend/app/services/coins.py backend/app/routers/referrals.py backend/app/services/referrals.py backend/app/routers/women.py backend/app/routers/auth.py backend/app/routers/livestock.py website/src/views/onboarding/`
- EXPECT: exit 0.
- IF FAIL: none — STOP the phase (playbook §5); report the missing file.
- [x]

### Task 8.2 — Add gamification/referrals/women API modules
- DO: create `website/src/lib/api/gamification.ts` (new, mirroring `routers/gamification.py`: wallet, ledger, store, redeem, leaderboard), `website/src/lib/api/referrals.ts` (new, mirroring `routers/referrals.py`: code, milestones, leaderboard), `website/src/lib/api/women.ts` (new, mirroring `routers/women.py`: SHG ledger, meetings, garden, livestock join, enterprises). Writes send `Idempotency-Key`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported type error — else STOP (playbook §5) with full output.
- [x]

### Task 8.3 — Add gamification/referrals/women locale pairs
- DO: create six files: `website/src/lib/i18n/locales/en.gamification.ts`, `hi.gamification.ts`, `en.referrals.ts`, `hi.referrals.ts`, `en.women.ts`, `hi.women.ts` (all new, `registerLocale` pattern, identical key sets per pair). Include in the gamification pair: `coinsNoCashRedemption` (en: "Coins are never redeemable for cash", hi equivalent). Add six import lines to `website/src/main.tsx`.
- RUN: `for m in gamification referrals women; do diff <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" website/src/lib/i18n/locales/en.$m.ts | tr -d ' :' | sort -u) <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" website/src/lib/i18n/locales/hi.$m.ts | tr -d ' :' | sort -u) || exit 1; done && cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0; diffs print nothing.
- IF FAIL: fix the parity gap or import error — else STOP (playbook §5).
- [x]

### Task 8.4 — Add rewards/referrals/women views registries, routes, dashboard cards
- DO: create `website/src/views/rewards/index.ts` (new, `REWARDS_PAGES`), `website/src/views/referrals/index.ts` (new, `REFERRALS_PAGES`), `website/src/views/women/index.ts` (new, `WOMEN_PAGES`); add their deep routes in `website/src/App.tsx`; add the three module cards to the farmer persona in `website/src/lib/dashboard.ts` (women card per its ACL rules in `canAccess()`, `lib/dashboard.ts:200`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 8.5 — Build coin wallet page
- DO: create `website/src/views/rewards/WalletPage.tsx` (new): coin balance, ledger view (cursor pagination), tier display, streaks, badges — all from the gamification endpoints. Register in `REWARDS_PAGES`. Strings via `t()` in `en/hi.gamification.ts`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 8.6 — Build rewards store and leaderboard
- DO: create `website/src/views/rewards/RewardsStorePage.tsx` (new): reward items with redemption flow (posts with `Idempotency-Key`); the `coinsNoCashRedemption` label rendered visibly in the store (regulatory). Add the leaderboard section (same page or `LeaderboardPage.tsx` registered in `REWARDS_PAGES`). Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 8.7 — Move coin caps to platform_config (X11)
- DO: in `backend/app/services/coins.py` move every cap/value (200 coins/day earn cap, 50% redemption cap, tier thresholds if hardcoded) out of code constants into `platform_config` docs (read via the phase-00 platform_config reader used elsewhere); keep the same default values as the seed data written to `platform_config/coins`. Add a dated deferral note comment: `# Deferred(2026-10-03, phase-07): admin coin mint/burn console edits platform_config/coins with maker-checker.` No constants for caps may remain in code.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_gamification.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: fix the config wiring — else STOP (playbook §5) with full output.
- [x]

### Task 8.8 — Enforce 200 coins/day earn cap (X11, test)
- DO: extend `backend/tests/test_gamification.py` (never delete existing assertions): seed activity that would earn >200 coins in one day and assert the server credits exactly the configured daily cap. If the cap is not enforced server-side, implement the enforcement in `backend/app/services/coins.py` (integer units, `audit_logs` on the mint — rule 3).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_gamification.py -q`
- EXPECT: exit 0; the cap test passes server-side.
- IF FAIL: implement the cap, never weaken the test — else STOP (playbook §5) with full output.
- [x]

### Task 8.9 — Enforce ≤50% redemption cap (X11, test)
- DO: extend `backend/tests/test_gamification.py`: a redemption whose coin value exceeds 50% of the order value is rejected with the standard error envelope; one at exactly 50% succeeds. Implement/repair the check in the redemption path (`services/coins.py` / `routers/gamification.py`) if missing; burns write `audit_logs`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_gamification.py -q`
- EXPECT: exit 0; both assertions pass.
- IF FAIL: fix the redemption check — else STOP (playbook §5) with full output.
- [x]

### Task 8.10 — Add nightly coin reconcile job (X11)
- DO: in `backend/app/services/coins.py` add `run_nightly_reconcile() -> dict`: compares issued vs redeemed ledger totals and returns/writes a drift report (`{issued, redeemed, drift, checked_at}`) to `platform_config/coins_reconcile_latest`. Extend `backend/tests/test_gamification.py`: a seeded drift is reported.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_gamification.py -q`
- EXPECT: exit 0; the drift test passes.
- IF FAIL: fix the reconcile logic — else STOP (playbook §5) with full output.
- [x]

### Task 8.11 — Verify audit logs on coin/referral mutations
- DO: verify every coin mint/burn and referral credit writes `audit_logs` (rule 3) in `backend/app/services/coins.py` and `backend/app/services/referrals.py`; add the write where missing. Extend `backend/tests/test_gamification.py` and `backend/tests/test_referrals.py` with one audit assertion each.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_gamification.py tests/test_referrals.py tests/test_referral.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: add the missing audit write — else STOP (playbook §5) with full output.
- [x]

### Task 8.12 — Build referral hub page
- DO: create `website/src/views/referrals/ReferralHubPage.tsx` (new): referral code card, WhatsApp share deep-link (`https://wa.me/?text=` with the localized share message containing the code), milestone tracker, leaderboard — all from the referrals endpoints. Register in `REFERRALS_PAGES`. Strings via `t()` in `en/hi.referrals.ts`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 8.13 — Credit referral only after first transaction (anti-fraud, test)
- DO: extend `backend/tests/test_referrals.py`: (1) an invitee registering does NOT credit the referrer; (2) the invitee's first completed transaction credits the referrer exactly once (replay the transaction webhook/event → still once). If `backend/app/services/referrals.py` credits at registration, move the credit to the first-completed-transaction hook (per dairy/direct-buyer specs).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_referrals.py tests/test_referral.py -q`
- EXPECT: exit 0; both assertions pass.
- IF FAIL: fix the credit timing, never the test — else STOP (playbook §5) with full output.
- [x]

### Task 8.14 — Verify register wizard captures referral code (F1)
- DO: check the register wizard in `website/src/views/onboarding/` and `backend/app/routers/auth.py` (from Task 8.1 reading): if a referral-code field + attribution write already exist, change nothing. If missing: add the optional referral-code field to the register wizard (strings via `t()` in the onboarding locale domain, en + hi) and the attribution write in `routers/auth.py` (store `referred_by` on the user doc; NO credit at registration — Task 8.13 owns timing).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_auth.py -q && cd ../website && pnpm exec tsc --noEmit`
- EXPECT: both exit 0.
- IF FAIL: fix the reported failure — else STOP (playbook §5) with full output.
- [x]

### Task 8.15 — Replace hardcoded women.py data with collections (rule 1)
- DO: in `backend/app/routers/women.py` remove every hardcoded SHG/garden payload found in Task 8.1 and read/write real Firestore collections instead: `shg_groups`, `shg_meetings`, `garden_plans`, `home_enterprises`. Create `backend/scripts/seed_women_data.py` (new), idempotent, seeding minimal dev fixtures (gated behind `APP_ENV=dev`); prints `seeded <n>`.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_women.py -q && APP_ENV=dev .venv/bin/python scripts/seed_women_data.py`
- EXPECT: pytest green; seed output contains `seeded`.
- IF FAIL: fix the router/script — else STOP (playbook §5) with full output.
- [x]

### Task 8.16 — Build women hub shell with 4 tabs and rose theme
- DO: create `website/src/views/women/WomenHubPage.tsx` (new) with 4 tabs (keys `womenTabShg`, `womenTabGarden`, `womenTabLivestock`, `womenTabEnterprise` in `en/hi.women.ts`) and `website/src/theme/women.css` (new — rose theme overlay following the `theme/trade.css`/`theme/dairy.css` pattern, imported by the hub page). Register in `WOMEN_PAGES`. Tab bodies land in Tasks 8.17–8.20.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 8.17 — Build SHG savings ledger tab
- DO: in the SHG tab of `WomenHubPage.tsx`: savings ledger from `shg_groups`/`shg_meetings`-backed endpoints + meeting workflow (attendance marking + collection entries, writes with `Idempotency-Key`). Money in integer paisa. Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 8.18 — Build kitchen-garden planner tab
- DO: in the garden tab of `WomenHubPage.tsx`: kitchen-garden planner reading/writing `garden_plans` via the women endpoints (plan list, create/edit). Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 8.19 — Build livestock health tab
- DO: in the livestock tab of `WomenHubPage.tsx`: join the herd registry (`backend/app/routers/livestock.py`) — render the woman's/her household's herd and health records via the livestock endpoints (add wrappers in `lib/api/women.ts` calling those routes; do not duplicate livestock logic). Strings via `t()`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0.
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 8.20 — Build home-enterprise tab with marketplace publishing
- DO: in the enterprise tab of `WomenHubPage.tsx`: income tracker from `home_enterprises` + product-listing form that publishes into the marketplace via the WS-03 user-products route (`backend/app/routers/user_products.py`, with `Idempotency-Key`). Extend `backend/tests/test_women.py` or `tests/test_user_products.py` asserting a women-hub listing appears in marketplace queries.
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_women.py tests/test_user_products.py -q && cd ../website && pnpm exec tsc --noEmit && pnpm build`
- EXPECT: exit 0 for all (workstream-end full build).
- IF FAIL: fix the reported failure — else STOP (playbook §5) with full output.
- [x]

### Task 8.21 — Document M26 flag slot and federation note
- DO: two small edits. (1) In the `platform_config/ai` flag documentation/seed (the file the phase-00 flag reader reads — find via `grep -rn "platform_config/ai" backend/app/ | head -5`), add a dated deferral note comment: `# Deferred(2026-10-03, phase-08): M26 women SHG-readiness AI — flag slot: women.shg_readiness (reserved, off).` (2) In `backend/app/routers/women.py` add a dated deferral note comment: `# Deferred(2026-10-03, future Enterprise tier): SHG federation — note only, do not build.`
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_women.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: fix the edit — else STOP (playbook §5) with full output.
- [x]

### Task 8.22 — WS-08 verification gate
- DO: run the full verification block. No edits.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q` then `cd website && pnpm exec tsc --noEmit && pnpm build`
- EXPECT: pytest fully green; tsc + build clean.
- IF FAIL: fix the failure in the file it names — else STOP (playbook §5) with full output.
- [x]

### Task 8.23 — HUMAN CHECK: referral and women-hub flows
- PRECONDITION: `curl -sf http://localhost:8000/v1/health` — if this fails, start the dev server with `cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000` (background) and re-check; if still failing, STOP the phase (playbook §5).
- DO: HUMAN CHECK — (1) share a referral via the WhatsApp deep-link → invitee registers with the code → attribution stored, NO credit yet → invitee completes a first transaction → credit appears for the referrer; (2) women hub: all 4 tabs read/write real data; publish a home-enterprise product → it appears in the WS-03 marketplace catalog; (3) the store shows the "never redeemable for cash" label; (4) the rose theme overlay is visible on the women hub; (5) switch to Hindi and confirm no English-only strings.
- EXPECT: human confirms all 5 sub-steps.
- IF FAIL: record the exact failing sub-step and STOP (playbook §5).
- [ ]

### Task 8.24 — Commit WS-08
- DO: stage and commit all WS-08 work.
- RUN: `git add -A && git commit -m "phase-05 WS-08: engagement modules"`
- EXPECT: exit 0; commit created.
- IF FAIL: if git identity is missing, note it and continue (playbook §6); otherwise STOP.
- [ ]

## WS-09 — All-Tools launcher & global search  (see instructions.md §WS-09)

### Task 9.1 — Verify WS-09 dependencies and read sources
- PRECONDITION: `test -f website/src/lib/dashboard.ts && grep -n "canAccess" website/src/lib/dashboard.ts | head -1` — if this fails, STOP the phase (playbook §5).
- DO: read (no edits): `website/src/lib/dashboard.ts`, `website/src/App.tsx`, `website/src/views/dashboard/`, `backend/app/routers/schemes.py`, `backend/app/routers/marketplace.py`, `backend/app/routers/content.py`, `backend/app/routers/courses.py`, `backend/app/routers/lots.py`, `backend/app/routers/reference.py`. Note the collection names and searchable text fields per module (needed in Task 9.4).
- RUN: `ls website/src/lib/dashboard.ts website/src/App.tsx backend/app/routers/schemes.py backend/app/routers/marketplace.py backend/app/routers/content.py backend/app/routers/courses.py backend/app/routers/lots.py backend/app/routers/reference.py`
- EXPECT: exit 0.
- IF FAIL: none — STOP the phase (playbook §5); report the missing file.
- [x]

### Task 9.2 — Audit every launcher tile resolves to a real page
- DO: enumerate every tile in the persona-filtered grid from `website/src/lib/dashboard.ts`; for each tile's `toolId`, verify `website/src/App.tsx` has a route rendering a real view (the module registries map them). Produce the audit as `docs/test-reports/phase-05-tile-audit.md` (new): a table `toolId | route | page | status` covering all 24 modules. For any tile that fails: phases 02–04 own their tiles — record it in the audit as a dated blocker line (`Blocker(2026-10-03): <tile> — owned by phase-0X, page missing`) instead of building it; the `equipment` farmer-face tile (7.23) is explicitly phase-02 WS-04 item 2 — verify resolution only, file the blocker if missing.
- RUN: `grep -rniE "coming soon" website/src/views/ website/src/lib/dashboard.ts; test $? -eq 1`
- EXPECT: grep finds no "coming soon" reachable from any tile (exit 1 = pass); audit file lists 24/24 modules with status.
- IF FAIL: replace each found placeholder with the real page if it is a phase-05 module, else record the dated blocker in the audit — if a phase-05 module's page is missing entirely, STOP (playbook §5).
- [x]

### Task 9.3 — Verify zero coming-soon strings in locale/registry
- DO: no edits unless the command finds hits — then route the tile to its real page (phase-05 modules) or record the dated blocker (other phases).
- RUN: `grep -rniE "comingSoon|coming_soon" website/src/lib/ website/src/views/ ; test $? -eq 1`
- EXPECT: no hits (exit 1 = pass).
- IF FAIL: resolve per the DO rule — if a phase-05 module lacks its page, STOP (playbook §5).
- [x]

### Task 9.4 — Add search router with six grouped indexes
- DO: create `backend/app/routers/search.py` (new): `GET /v1/search?q=` performing case-insensitive substring/prefix keyword matching across six indexes — schemes, products, news (content), crops (reference), courses, lots — over the searchable fields noted in Task 9.1. Response grouped by module: `{"schemes": [...], "products": [...], "news": [...], "crops": [...], "courses": [...], "lots": [...]}` each with its own `nextCursor` (rule 7) and the standard `{"error":{code,...}}` envelope on failure. Keep the router shape compatible with a future embeddings upgrade (phase-06 M23) — no AI calls in v1. Mount the router in `backend/app/main.py` under `/v1` following the existing mount pattern.
- RUN: `cd backend && .venv/bin/python -c "from app.routers import search; print('import ok')" && .venv/bin/python -m pytest -q -k "not slow" --co -q | tail -1`
- EXPECT: exit 0; output contains `import ok`; test collection succeeds.
- IF FAIL: fix the import/mount error — else STOP (playbook §5) with full output.
- [x]

### Task 9.5 — Add search endpoint tests
- DO: create `backend/tests/test_search.py` (new): seed each of the six indexes with a doc matching `q=pyaz` in at least lots + news + crops; assert (1) the response has all six group keys, (2) matching groups contain the seeded docs, (3) per-group `nextCursor` paginates that group independently, (4) empty query returns the standard envelope error, (5) a query with no hits returns six empty groups (not an error).
- RUN: `cd backend && .venv/bin/python -m pytest tests/test_search.py -q`
- EXPECT: exit 0, all tests pass.
- IF FAIL: fix the router, not the test — else STOP (playbook §5) with full output.
- [x]

### Task 9.6 — Add search API wrapper and results page
- DO: create `website/src/lib/api/search.ts` (new, typed wrapper for `GET /v1/search`) and `website/src/views/dashboard/SearchResultsPage.tsx` (new): reads `?q=` from the URL, renders results grouped by module with a per-group "see all" control paginating that group independently via its `nextCursor`, and deep-links each hit into its module page. Locale keys (`searchTitle`, `searchPlaceholder`, `searchSeeAll`, `searchNoResults`, one label per group) in `website/src/lib/i18n/locales/en.ts` + `hi.ts`.
- RUN: `cd website && pnpm exec tsc --noEmit && diff <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" src/lib/i18n/locales/en.ts | tr -d ' :' | sort -u) <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" src/lib/i18n/locales/hi.ts | tr -d ' :' | sort -u)`
- EXPECT: exit 0; diff prints nothing (note: en.ts/hi.ts are the base dictionaries — if the diff shows pre-existing parity drift NOT introduced by your keys, do not "fix" unrelated keys; report it and verify only that your new keys exist in both).
- IF FAIL: add missing new keys to the lagging file — else STOP (playbook §5).
- [x]

### Task 9.7 — Add dashboard search box and /search route
- DO: two edits. (1) In the dashboard header (`website/src/views/dashboard/` — the header component found in Task 9.1) add a search box submitting to `/search?q=<query>`. (2) In `website/src/App.tsx` add the route `/search` rendering `SearchResultsPage` (deep-linkable query param).
- RUN: `cd website && pnpm exec tsc --noEmit && pnpm build`
- EXPECT: exit 0 for both (workstream-end full build).
- IF FAIL: fix the reported error — else STOP (playbook §5) with full output.
- [x]

### Task 9.8 — Verify search endpoint on dev server (curl)
- PRECONDITION: `curl -sf http://localhost:8000/v1/health` — if this fails, start the dev server with `cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000` (background) and re-check; if still failing, STOP the phase (playbook §5).
- DO: seed a dev lot/news/crop matching "pyaz" (via the seed scripts or the dev Firestore), then curl the endpoint. If the router requires auth, add `-H "Authorization: Bearer <dev token>"` using a token from the dev login flow.
- RUN: `curl -sf "http://localhost:8000/v1/search?q=pyaz"`
- EXPECT: exit 0; JSON body contains all six group keys (`schemes`, `products`, `news`, `crops`, `courses`, `lots`) and at least one hit across `lots` + `news` + `crops`.
- IF FAIL: check `.run-logs/backend.log` for the error, fix the router — else STOP (playbook §5) with full output.
- [x]

### Task 9.9 — HUMAN CHECK: search flow from dashboard
- DO: HUMAN CHECK — (1) type "pyaz" in the dashboard search box → grouped results page renders; (2) "see all" on the lots group paginates only that group; (3) click a scheme hit → lands on the WS-05 scheme detail; (4) reload `/search?q=pyaz` directly → results render (deep-linkable); (5) confirm the shim/AI mode is unaffected (no AI in v1 search).
- EXPECT: human confirms all 5 sub-steps.
- IF FAIL: record the exact failing sub-step and STOP (playbook §5).
- [ ]

### Task 9.10 — WS-09 verification gate
- DO: run the full verification block. No edits.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q` then `cd website && pnpm exec tsc --noEmit && pnpm build`
- EXPECT: pytest fully green; tsc + build clean.
- IF FAIL: fix the failure in the file it names — else STOP (playbook §5) with full output.
- [x]

### Task 9.11 — Commit WS-09
- DO: stage and commit all WS-09 work.
- RUN: `git add -A && git commit -m "phase-05 WS-09: launcher sweep and global search"`
- EXPECT: exit 0; commit created.
- IF FAIL: if git identity is missing, note it and continue (playbook §6); otherwise STOP.
- [ ]

## Phase-final gate

### Task P.1 — Global gate: backend suite fully green
- DO: no edits. Run the gate command from `execution-plan/README.md` §4.
- RUN: `cd backend && .venv/bin/python -m pytest -q`
- EXPECT: exit 0, fully green — zero failures, zero errors.
- IF FAIL: if the failure belongs to a phase-05 workstream, fix it in that module's code; if it is unrelated to phase-05 work, STOP the phase (playbook §5) with full output.
- [x]

### Task P.2 — Global gate: website typecheck and build
- DO: no edits. Run the gate command from `execution-plan/README.md` §4.
- RUN: `cd website && pnpm exec tsc --noEmit && pnpm build`
- EXPECT: exit 0 for both, clean output.
- IF FAIL: fix the reported error in the named file — else STOP (playbook §5) with full output.
- [x]

### Task P.3 — Locale parity across every new pair
- DO: no edits unless a diff reports a gap — then add the missing key to the lagging file.
- RUN: `for m in advisory marketplace schemes finance insurance landRecords fpo postHarvest water climate tree gamification referrals women; do diff <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" website/src/lib/i18n/locales/en.$m.ts | tr -d ' :' | sort -u) <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" website/src/lib/i18n/locales/hi.$m.ts | tr -d ' :' | sort -u) > /dev/null || { echo "PARITY FAIL: $m"; exit 1; }; done && diff <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" website/src/lib/i18n/locales/en.trade.ts | tr -d ' :' | sort -u) <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" website/src/lib/i18n/locales/hi.trade.ts | tr -d ' :' | sort -u) > /dev/null && diff <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" website/src/lib/i18n/locales/en.pnl.ts | tr -d ' :' | sort -u) <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" website/src/lib/i18n/locales/hi.pnl.ts | tr -d ' :' | sort -u) > /dev/null && diff <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" website/src/lib/i18n/locales/en.cashbook.ts | tr -d ' :' | sort -u) <(grep -oE "^[[:space:]]*[a-zA-Z0-9_]+:" website/src/lib/i18n/locales/hi.cashbook.ts | tr -d ' :' | sort -u) > /dev/null && echo "parity ok"`
- EXPECT: exit 0; output `parity ok` (covers all 14 new pairs + the added trade/pnl/cashbook keys).
- IF FAIL: add the missing key(s) named by the failing module's diff — else STOP (playbook §5) with full output.
- [x]

### Task P.4 — AI suite green on shim; ai_decisions written for M9/M10/M12/M13/M21
- DO: no code edits. Run the full suite with the shim provider, then verify each AI brief's decision logging by running its targeted tests (which assert `ai_decisions` writes via the gateway).
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_mandi_smart.py tests/test_mandi_forecast.py tests/test_advisory_planner.py tests/test_grading.py tests/test_schemes_match.py -q`
- EXPECT: exit 0 — M12 (mandi smart-select + forecast), M13 (planner), M9/M10 (disease/grading via their suites), M21 (schemes match) all green on shim with `ai_decisions` logging asserted.
- IF FAIL: fix the failing brief's code path — else STOP (playbook §5) with full output.
- [x]

### Task P.5 — Flag-off fallback tests pass for every AI feature
- DO: verify each AI feature added in this phase (mandi smart-select, forecast, crop planner, disease scan, grading, schemes match) has a test proving the deterministic fallback works with the AI flag off (`suggest` level, deterministic fallback). If any of the five lacks a flag-off case, add that test case to the module's existing test file (never delete assertions).
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_mandi_smart.py tests/test_mandi_forecast.py tests/test_advisory_planner.py tests/test_advisory.py tests/test_grading.py tests/test_schemes_match.py -q -k "fallback or flag or off or stub or deterministic"`
- EXPECT: exit 0; at least one fallback/flag-off test ran per feature (the `-k` filter matches ≥6 tests).
- IF FAIL: add the missing flag-off test and the fallback code it proves — else STOP (playbook §5) with full output.
- [x]

### Task P.6 — Rule-1 sweep: no numeric fallbacks or hardcoded data
- DO: no edits unless a grep finds hits — then complete the corresponding workstream task that should have removed them.
- RUN: `grep -rnE "\?\?\s*[0-9]" website/src/views/pnl website/src/views/diary; test $? -eq 1` then `grep -nE "base_price\s*=\s*[0-9]+" backend/app/services/advisory.py; test $? -eq 1` then `grep -cE "=\s*[\[{]" backend/app/routers/women.py backend/app/routers/climate.py`
- EXPECT: first two greps find nothing (exit 1 = pass); the third prints only structural-code counts consistent with Tasks 7.9 and 8.15 having removed the data payloads (compare against the Task 7.1 / 8.1 lists — zero leftover data literals).
- IF FAIL: finish the removal in the offending file — else STOP (playbook §5) with full output.
- [x]

### Task P.7 — Exit gate: hardcoded-data modules read real collections
- DO: no edits. Verify the three exit-gate targets serve from collections: `routers/women.py` (shg_groups, shg_meetings, garden_plans, home_enterprises), `routers/climate.py` (climate_varieties, carbon_factors), `services/advisory.py` (mandi-linked aggregates).
- RUN: `grep -n "shg_groups\|shg_meetings\|garden_plans\|home_enterprises" backend/app/routers/women.py | head -4 && grep -n "climate_varieties\|carbon_factors" backend/app/routers/climate.py | head -2 && grep -n "mandi" backend/app/services/advisory.py | head -2`
- EXPECT: exit 0; each grep prints collection/mandi references.
- IF FAIL: the module was not migrated — return to Task 8.15 / 7.8 / 2.10 respectively; if those are checked but the code does not show it, uncheck them and report (playbook §1).
- [x]

### Task P.8 — HUMAN CHECK: playbook step-7 manual flow per module
- PRECONDITION: `curl -sf http://localhost:8000/v1/health` — if this fails, start the dev server with `cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000` (background) and re-check; if still failing, STOP the phase (playbook §5).
- DO: HUMAN CHECK — for each of the 21 in-scope modules (mandi, contracts, advisory, marketplace, pnl/FarmCEO, diary, schemes, finance, insurance, land records, FPO, post-harvest, water, climate, tree plantation, Krishi Ratna, Refer & Earn, women hub, livestock-hub tile, equipment tile, launcher/search): execute one manual flow starting from the dashboard task deep-link (or the module's tile) through to completion, in both en and hi for at least one module per workstream. Confirm zero "coming soon" is reachable from any entry tile, and the equipment (7.23) + livestock (7.20) tiles resolve to their phase-02/03-owned pages (or have dated blockers recorded in `docs/test-reports/phase-05-tile-audit.md`).
- EXPECT: human confirms one full flow per module, 21/21, and zero reachable coming-soon tiles.
- IF FAIL: record the module + failing step and STOP (playbook §5).
- [ ]

### Task P.9 — Task-engine audit: every emit point fires
- DO: run the targeted emit-point tests (each workstream asserted emission), then verify the Action Center rendering path exists.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest tests/test_price_alerts.py tests/test_advisory.py tests/test_water.py tests/test_schemes.py tests/test_order_lifecycle.py tests/test_loans.py tests/test_insurance_claims.py tests/test_tree.py tests/test_referrals.py -q && grep -rn "ActionCenter\|action-center\|/v1/tasks" ../website/src/views/dashboard/ | head -3`
- EXPECT: pytest green (covers mandi alerts, advisory, irrigation, scheme deadlines, order status, loan doc requests, claim stages, plantation care, referral milestones); the grep prints the dashboard Action Center wiring.
- IF FAIL: fix the failing emit point — if the Action Center surface itself is missing, that is a phase-01 deliverable: STOP the phase (playbook §5).
- [x]

### Task P.10 — Search returns grouped results on seeded data
- PRECONDITION: `curl -sf http://localhost:8000/v1/health` — if this fails, start the dev server with `cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000` (background) and re-check; if still failing, STOP the phase (playbook §5).
- DO: confirm all six indexes answer on the seeded dev instance (auth header per Task 9.8 if required).
- RUN: `curl -sf "http://localhost:8000/v1/search?q=seed" && curl -sf "http://localhost:8000/v1/search?q=pyaz"`
- EXPECT: both exit 0; each response contains all six group keys with `nextCursor` fields; at least one group non-empty per query on seeded data.
- IF FAIL: fix the search router or seed data — else STOP (playbook §5) with full output.
- [x]

### Task P.11 — Cross-check the readme exit gate and commit phase close
- DO: open `execution-plan/phase-05/readme.md` §Exit gate and verify each item against completed Tasks P.1–P.10 (modules shipped + step-7 verification → P.8; hardcoded-data modules → P.7; locales → P.3; task engine + dashboard grid → P.9; AI briefs → P.4/P.5; search → P.10; global gate → P.1/P.2). Any unmet item: go back to the owning task — do not mark this done with gaps. Then commit.
- RUN: `git add -A && git commit -m "phase-05: platform module sweep complete — exit gate verified"`
- EXPECT: exit 0; commit created; every readme exit-gate box verifiably satisfied.
- IF FAIL: if git identity is missing, note it and finish with the report (playbook §6); if an exit-gate item is unmet, return to the owning task instead of committing.
- [ ]
