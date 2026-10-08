# phase-08 — Summary

**Phase:** 08 — Experience AI, Scale & Launch
**Date:** 2026-10-08
**Branch:** main (no commits made — checkpoint/final commits left unchecked per the
phase convention; only code/docs changed in the working tree)
**Executor:** autonomous agent run (recon → execute → verify → summarise)

---

## 1. What was delivered (by workstream)

### WS-01 — Experience AI features (M26, M28, M29, M33)

| Feature | Status | Artifacts |
|---|---|---|
| M26 SHG readiness (`women.shg_readiness.v1`) | ✅ backend done | `services/shg_readiness.py`, `privacy.build_shg_readiness_state`, question set, `routers/women.py` wiring + loan link card, golden fixture, `tests/test_shg_readiness.py` |
| M28 receipt/weigh-slip scan (vision, confirm-only) | ✅ backend done | `services/receipt_scan.py`, `POST /v1/diary/receipt-scan`, `storage.read_blob`, receipt golden set, `tests/test_receipt_scan.py` |
| M28 churn signal (nightly) | ✅ backend done | `services/churn.py`, `churn.signal.v1`, job `/jobs/churn/score`, return hook, `tests/test_churn.py` |
| M29 farmer standing agent (confirm-only) | ✅ backend done | `services/agent_rules.py`, `routers/agent_rules.py`, `agent.rule_match.v1`, offers-flow evaluation, `tests/test_agent_rules.py` |
| M33 onboarding copilot | ✅ backend done | `services/district_crops.py`, `GET /v1/reference/district-crops`, admin CRUD + approve, proposal job, `tests/test_*` |

Website (WS-01 UI): **gap-fill primitives created** (`components/ai/AiExplainSheet.tsx`,
`components/ai/AiDraftBanner.tsx`, `lib/api/ai.ts` — these were referenced by the
plan but never built in phases 00–07), plus wrappers `women.getShgReadiness`,
`diary.scanDiaryReceipt`, `reference.fetchDistrictCrops`, `agentRules.ts`, and
en/hi i18n keys. **View wiring not completed** (SHG readiness card rendering,
CashbookPage receipt upload, AgentRulesPage) — see §4.

### WS-02 — Automation raises & calibration — ✅ backend done
- Phase-G gate: `services/ai/phase_g.py`; wired into the `platform_config/ai` editor
  (`PUT /v1/admin/platform-config/ai`) — refuses `suggest → require_confirm` without
  ≥1,000 outcomes + >90% top-bucket accuracy + maker-checker; `auto` refused for
  credit/insurance/legal; `cappedSets` exposed on GET. Tests: `tests/test_phase_g_gate.py`.
- Golden coverage: `tests/test_golden_coverage.py`; missing `<id>.jsonl` fixtures generated
  (without `questionSetId` so shim behaviour is unchanged).
- Contract tests: `services/ai/contracts.py`, `tests/test_ai_contracts.py`.
- Regression alerting: `services/ai/golden_alerts.py` (Sentry + `ai_golden_banner/current`
  read by AI Health), `tests/test_golden_alerts.py`.
- Weekly calibration + `backfill()`; `tests/test_ai_calibration_backfill.py`.
- CI: golden step on shim + nightly cron in `.github/workflows/ci.yml`.
- Load test authored: `tests/load/ai_gateway_locustfile.py` (locust installed).
- Spend review: `docs/test-reports/phase-08-ai-spend-review.md` (~$134/day envelope; 10× rate caveat recorded).

### WS-03 — B2B API platform — ✅ backend done
`services/partner_keys.py`, `core/deps.py` (`get_partner`, `require_scope`, and the
403 `PARTNER_KEY_NOT_ALLOWED` guard on user endpoints), `routers/partner_api.py`
(mandi prices + saturation aggregates, k=5 suppression, rate limiting, metering +
billing hook), admin key management (`/admin/partner-keys*`), `tests/test_partner_api.py`.
Website partner docs page + admin UI **not done** (§4).

### WS-04 — Performance & cost hardening — ✅ backend done (partial)
- Unbounded-scan audit (task 4.1): clean (`grep .stream()` without `.limit(` → none).
- `ai_decisions` export-then-expire: `services/ai/decision_export.py` + job +
  `tests/test_decision_export.py`.
- Website bundle: **entry chunk 268 KB gzipped (< 400 KB)** — build succeeds.
- Task 4.12 AI-caching audit **NOT clean** (pre-existing router→gateway calls, §4).

### WS-05 — Compliance & launch readiness — ✅ static checks pass
- 5.1 PII: no unmasked Aadhaar in AI payloads (matches are maskers/schemas/docstrings);
  phone/email only in docstrings/key-strip lists.
- 5.7 backdoor grep: every match is dev-gated or a non-security string.
- 5.8 prod startup refuses unset JWT/razorpay secrets (verified).
- 5.9 CORS: no `"*"` origins.
- 5.12/5.16/5.18 settlement + SaaS entitlement suites: green (16 + 7 tests).
- DPDP audit: `docs/test-reports/phase-08-dpdp-audit.md`.
- Website legal page i18n + parity gate: parity passes (542 keys).

### WS-06 — Beta launch checklist & deferral ledger — ✅ docs done
- `docs/deferral-ledger.md` — 103 rows, every row SHIPPED/DEFERRED/RETIRED, no TBD/TODO;
  C1/C19/M27 RETIRED; named deferrals (WhatsApp, streaming X16, Mahabhulekh, carbon MRV, BNPL) present.
- `docs/launch-checklist.md` — bundle row recorded; §5 sign-off section present but
  **left unchecked** (needs staging/browser evidence).
- `docs/deployment/ops-runbook.md`, `docs/deployment/demo-cut-script.md`.

---

## 2. Verification results (concrete pass/fail)

| Gate | Command | Result |
|---|---|---|
| Backend suite (shim) | `cd backend && AI_PROVIDER=shim pytest -q` | **1384 passed** (clean run) |
| New WS-01 suites | `pytest tests/test_shg_readiness.py tests/test_receipt_scan.py tests/test_churn.py tests/test_agent_rules.py` | 19 passed |
| WS-02 selection | `pytest -q -k "calibration or contract or golden"` | **91 passed** |
| WS-03 | `pytest tests/test_partner_api.py` | 7 passed |
| WS-04 | `pytest tests/test_decision_export.py` | 2 passed |
| Website types | `cd website && pnpm exec tsc --noEmit` | exit 0 |
| Website build | `pnpm build` | success; entry 268 KB gz |
| Locale parity | `node scripts/check-locale-parity.mjs` | ok (542 keys) |
| Deferral ledger | awk/grep gate | 0 unmarked rows; 5 RETIRED |
| Prod-config suite | `APP_ENV=prod … pytest -q` | **NOT green (411 failed)** — see §4 |

**Intermittent flake (noted):** two full shim runs each showed one unrelated
single-test failure (aadhaar scan / tasks-today) that passed on re-run; a third
clean run was fully green. Appears to be pre-existing cross-test state leakage,
not caused by phase-08 code; not resolved in this session.

---

## 3. Left unchecked on purpose (operator/human work)

**HUMAN CHECK tasks (browser/staging/real keys):** 1.47, 1.49, 2.16, 4.3, 4.6,
5.11, 5.13, 5.19–5.29, 6.8, 6.10–6.20, G.16.
**Commit/checkpoint tasks (left unchecked per convention):** 1.50, 2.17, 3.14,
4.13, 5.30, 6.30, G.17.
**Staging-run tasks needing a live server/keys:** 2.13, 4.2, 4.10, 4.11, G.3.

---

## 4. Deferred / partial (reported, not hidden)

1. **Website views not wired** — SHG readiness card (1.13), CashbookPage receipt
   upload (1.19), AgentRulesPage + route/registry (1.35–1.37), ProfileDetails crop
   pre-selection (1.43), LanguageSelect suggestion (1.39), Cashbook i18n (1.20).
   Wrappers + primitives + en/hi keys are in place and typecheck clean.
2. **Task 4.7** — 3 eager view imports remain in `App.tsx` (Splash, AuthView,
   LegalPage; deliberately eager first-screen routes). Bundle budget is met anyway.
3. **Task 4.12** — router→gateway calls remain in 14 pre-existing routers
   (rule-10 architecture debt from phases 01–07); NOT moved in this session.
4. **Tasks 1.9, 1.44, 1.45** — SHG loan-application outcome hook and
   post-registration dashboard seeding + KYC checklist tasks are not implemented
   (require deeper coupling to phase-05 matching services).
5. **Prod-config suite** (`APP_ENV=prod pytest`) fails broadly (App Check middleware
   + prod MPIN rules vs dev-style fixtures) — pre-existing; needs a prod-test profile.
6. **Gap-fill:** the phase-08 plan assumed `AiExplainSheet`, `AiDraftBanner`, and
   `lib/api/ai.ts` existed from phase-01; they did not, so minimal versions were
   created here (recorded for traceability).

---

## 5. Files created / changed (working tree)

**Backend (new):** `services/{shg_readiness,churn,agent_rules,district_crops,receipt_scan}.py`,
`routers/agent_rules.py`, `routers/partner_api.py`, `services/partner_keys.py`,
`services/ai/{phase_g,contracts,golden_alerts,decision_export}.py`,
`tests/load/ai_gateway_locustfile.py`, and test files
`test_{shg_readiness,receipt_scan,churn,agent_rules,phase_g_gate,golden_coverage,ai_contracts,golden_alerts,ai_calibration_backfill,decision_export,partner_api}.py`,
plus 19 generated golden fixtures / `receipt_scan/` set.

**Backend (edited):** `services/ai/{question_sets,config_store,privacy,shim,calibration}.py`,
`services/storage.py`, `core/deps.py`, `routers/{women,diary,offers,reference,jobs,admin,auth,main}.py`,
`tests/test_women.py` (response shape), `.github/workflows/ci.yml`.

**Website (new):** `components/ai/{AiExplainSheet,AiDraftBanner}.tsx`, `lib/api/{ai.ts,agentRules.ts}`.
**Website (edited):** `lib/api/{women,diary,reference}.ts`, `lib/i18n/locales/{en,hi}.ts`.

**Docs (new):** `docs/deferral-ledger.md`, `docs/launch-checklist.md`,
`docs/test-reports/phase-08-{ai-spend-review,dpdp-audit}.md`,
`docs/deployment/{ops-runbook,demo-cut-script}.md`.

---

## 6. Session report (playbook §4)

```
PHASE: 08 | WORKSTREAM: WS-01..WS-06 | LAST COMPLETED: task 6.30-equivalent docs
NEXT TASK: task 1.13/1.19/1.35 (website view wiring) and the HUMAN CHECK tasks
COMMANDS RUN SINCE LAST REPORT: ~30 (tests, tsc, build, greps)
FAILURES ENCOUNTERED: prod-config suite (411, pre-existing); 2 intermittent single-test flakes (isolate-pass)
BLOCKED: no — remaining items are human/staging or explicitly deferred
```
