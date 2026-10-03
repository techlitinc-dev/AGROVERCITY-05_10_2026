# phase-00 — Execution Summary

> Executed 2026-10-03. Protocol: `execution-plan/AGENT_PLAYBOOK.md`, task queue
> `execution-plan/phase-00/tasks.md` (WS-01/WS-02) + `instructions.md` (WS-03…WS-07).
> Backend suite went from **45 failed / 698 passed** at start to **fully green**.
> Checkpoints: `3fff613` WS-01 · `fb2fed4` WS-02 · `b0df039` WS-06a · `974ccdd` WS-07 ·
> `a527502` WS-03 · `7f45460` WS-04 · `54eb794` WS-05 · `6adc25e` WS-06b.

## Status at a glance

| WS | Title | Status | Notes |
|---|---|---|---|
| WS-01 | Kill demo backdoors & secrets hygiene | ✅ done (2 human checks open) | rotation log created; operator must record rotations |
| WS-02 | Auth & admin-auth unification | ✅ done (1 human check open) | automated 2.21 curl verified; manual admin flow pending |
| WS-03 | Real money rails | ✅ backend core | live staging keys + Route onboarding pending (human) |
| WS-04 | KYC pipeline | ⚠️ backend done | website wizard/status page deferred (API ready) |
| WS-05 | Subscriptions & billing | ⚠️ backend done | website paywall UX deferred; UPI Autopay deferred |
| WS-06 | Platform plumbing | ⚠️ mostly done | cursor pagination + secret-manager wiring deferred |
| WS-07 | AI foundation gateway | ✅ done (live key check pending) | shim suite green; live staging decide needs keys |

## Global verification gate (README §4)

```
backend  pytest (default, AI_PROVIDER=shim)      -> 786 passed, 1 skipped, 0 failed
backend  AI_PROVIDER=shim pytest                 -> 786 passed, 1 skipped, 0 failed
website  pnpm exec tsc --noEmit                  -> clean
website  pnpm build                              -> built
website  node scripts/check-locale-parity.mjs    -> locale parity ok (440 keys)
```

New regression suites added: `test_prod_guards.py` (5), `test_ai_gateway.py` (9),
`test_payments_rails.py` (13), `test_kyc_pipeline.py` (5), `test_billing.py` (5).

## WS-01 — demo backdoors & secrets hygiene ✅

- `env` validator: staging/prod refuse to boot without real `jwt_secret` + Razorpay keys.
- `/auth/quick-login`, MPIN `1234` bypasses, `dev-`/`demo-` id-tokens all gated to
  `env == "dev"`; quick-login now requires an explicit MPIN (`MPIN_REQUIRED`), trivial
  MPINs rejected outside dev (`WEAK_MPIN`).
- Razorpay: `"dev"` signature shortcut deleted, `rzp_test_dev` fallback deleted
  (`PAYMENTS_NOT_CONFIGURED` instead). Orders tests adapted to fake keys + real HMAC.
- CORS locked to `settings.web_origins`; Firebase web key moved to `VITE_FIREBASE_*`
  + App Check init and `X-Firebase-AppCheck` header; backend App Check middleware.
- Sweep (`grep -rn 'sess_demo\|dev-user\|demo-\|"1234"' backend/app website/src`):
  auth.py hits are dev-gated; security.py is the WEAK_MPIN denylist; website hits are
  zero. Demo seed **functions** (`seed_cold_storage`, `seed_livestock`) are dev-gated
  (their data literals remain, unreachable in prod); insurance `_demo_policy` calls gated.
- `models/auth.py` quick-login MPIN default removed; instructor `sess_demo` fetch removed.

**Human checks open:** task 1.20 (rotate the exposed Firebase web key + any leaked
Razorpay keys; record in `.run-logs/phase-00-secrets-rotation.md` — file created, header
only) and task 1.22 (browser dev-login confirmation; automated `MPIN_REQUIRED` +
explicit-MPIN login verified on a fresh server).

## WS-02 — auth & admin-auth unification ✅

- `admin.py` runs entirely through `core/deps.py:admin_user` (Firebase claims); the
  hardcoded UID fallback and local `_require_admin`/`_admin_user` are deleted.
- `admin_action(action)` dependency: `X-Audit-Reason` required, `X-Admin-Role` validated,
  every mutation writes an `audit_logs` doc; wired into all six admin mutations.
- Refresh tokens carry `jti`; Redis-backed rotation + replay detection (replay revokes
  the whole session family — WS-02 step 3 semantics); `GET/DELETE /v1/auth/sessions`,
  `POST /v1/auth/logout`.
- Website: `mpinReentryRequired` state, refresh-failure → `/auth?reentry=mpin`,
  `MpinReentrySheet.tsx` with en+hi keys, AuthView wiring.
- `core/ratelimit.py` (Redis fixed-window, fail-open) + limits on login, OTP reset,
  Razorpay order/verify, chat send.
- Tests: test_auth (15), test_admin (6), plus adapted `auth(admin)` call sites across
  test_courses / test_admin_finance / test_analytics.

**Human check open:** task 2.21 manual admin flow (`make_admin.py`, audit headers,
non-claim 403). Automated: `GET /v1/admin/overview` with a bad bearer → 401 verified.

## WS-03 — real money rails ✅ backend core

- New `routers/payments.py`: `POST /v1/payments/order` (idempotent on
  `Idempotency-Key`), `/verify` (HMAC), `/{id}/refund` (admin + `X-Audit-Reason`,
  audited), `/webhook` (dedicated `razorpay_webhook_secret`, persists `payment_events`,
  idempotent on event id, drives payment + subscription status).
- Nightly reconciliation job `/jobs/payments/reconcile` diffs Razorpay vs local
  payments and writes discrepancies to `audit_logs`.
- Escrow release clock: handover OTP starts `releaseAt` (24 h dispute window,
  configurable); a QC dispute pauses release; `/jobs/escrow/release-due` releases due
  holds; the resolution re-opens the clock.
- RazorpayX: real penny-drop adapter (`bank_verify/razorpayx.py`, provider selectable;
  stub only in dev/test) + payout client; `/jobs/settlements/payouts` pays verified
  accounts and sets `onHold` + reason for beneficiaries without a verified bank account.
- TDS 194-O `tds_ledger` (integer paisa) + GST commission `invoices` written at
  settlement time.
- Tests: 13 in `test_payments_rails.py` (webhook good/bad/idempotent, order verify +
  bad signature, refund admin reason, escrow wait/pause/release, onHold payout, TDS math,
  reconciliation).

**Deferred:** Razorpay Route linked-account onboarding & live release execution
(current escrow is doc-state + job driven; money movement needs staging keys), and
invoice PDF rendering (records exist; PDF via the reports pipeline is phase-later).
Live staging walk (order → webhook → verify → refund) requires operator keys.

## WS-04 — KYC pipeline ⚠️ backend done

- `services/kyc.py` + `routers/kyc.py`: `kyc_cases` collection, per-persona document
  matrices (base Aadhaar/PAN/bank + persona extras), `pending→verified→rejected` per-doc
  state machine with mandatory reject reasons, re-upload resets to pending, expiry
  tracking + `reverifyRequired` for licences.
- Admin queue rewritten to read `kyc_cases` (sample docs + hardcoded `pendingKycCount`
  deleted); `review` requires reason + audit; `/jobs/kyc/expiry-reminders` notifies 30
  days before expiry.
- Aadhaar is never stored unmasked (paths/masked refs only).
- Tests: 5 in `test_kyc_pipeline.py` + rewritten admin KYC flow test.

**Deferred (dated deferral — phase-04 instructor/persona web work):** website KYC
submission wizard + status page (`website/src/lib/api/kyc.ts`, routes). The backend
contract is complete and covered by tests; the exit-gate staging flow is executable
via API.

## WS-05 — subscriptions & billing ⚠️ backend done

- `services/billing.py`: full tier matrix (robust §10) seeded into `plans`;
  `subscriptions` collection; `effective_plan`, usage counters
  (`usage_counters`, monthly period), `check_entitlement`/`consume`.
- `routers/billing.py`: `/billing/plans`, `/billing/subscription` (+ usage + grace
  period), `/billing/subscribe`, `/billing/invoices`.
- 402 `ENTITLEMENT_EXCEEDED` envelope with `{limit, used, planId}`; wired to transport
  vehicles (`transport`) and equipment machines (`equipmentRental`) — proven by tests
  that block the 4th create and unlock after upgrade. Farmer plan is free with no
  limits (diary smoke test).
- Razorpay subscription status is webhook-driven (WS-03 webhook extended for
  `subscription.*` events).

**Deferred:** website paywall UX (upgrade prompt consuming the 402 payload, plan
comparison, invoice download) — phase-02+ web work; UPI Autopay mandates; real
Razorpay Subscriptions/RazorpayX keys (staging).

## WS-06 — platform plumbing ⚠️ mostly done

- **Test repair ✅**: all 45 failing tests fixed; `conftest.py` refactored to
  auto-discover `app.routers/services/data/core` modules (new modules need zero conftest
  edits — a new WS-03/04/05/07 module was added with no conftest change, proving it).
- **Error envelope ✅**: global handler now converts dict *and* non-dict HTTPException
  details into `{"error": {code, message, fieldErrors}}`.
- **Indexes ✅**: composite indexes added for payments, payment_events, subscriptions,
  kyc_cases, invoices, tds_ledger, ai_decisions (JSON validated).
- **Observability ✅/partial**: backend Sentry was already wired (env-tagged); website
  Sentry init added (`VITE_SENTRY_DSN`, lazy `@sentry/react`). Structured request-logging
  middleware + uptime alert hook: deferred.
- **CI ✅**: `.github/workflows/ci.yml` (pytest shim + tsc + build + locale parity) and
  `website/scripts/check-locale-parity.mjs` (en/hi parity now 440/440 after reconciling
  `dashActiveTrips` and `errMachineRequired`).
- **Environments partial**: keys documented in `backend/.env.example` /
  `website/.env.example`; GCP Secret Manager wiring is a deployment task.
- **Deferred:** real Firestore cursor pagination (`db.query` still limit-then-slice),
  unbounded-scan caps in admin/analytics, structured request logging middleware.

## WS-07 — AI foundation gateway ✅ (live check pending)

- New `services/ai/` package: `gateway.py` (single entry: `decide`/`generate`/
  `analyze_image`/`embed`, retries ×2 with backoff, fallback, budget, logging),
  `jev_client.py` (OpenRouter, one call per decide), `gemini_client.py` (AI Studio key),
  `question_sets.py` (registry scaffolding), `decision_log.py` (`ai_decisions` with cost +
  confidence + state hash), `outcomes.py`, `shim.py` (golden fixtures + schema defaults),
  `budget.py` (Redis per-day counters, 80 % alert / 100 % `BudgetExhausted` → fallback),
  `privacy.py` (HMAC ids, phone/email strip, Aadhaar mask, token trim/chunk),
  `config_store.py` (`platform_config/ai` reader, 60 s cache + seed).
- `DecisionResult` contract exactly per §1.3; config keys per §1.2 (+ `.env.example`);
  `chatbot.py` and `disease_model/gemini.py` refactored through the gateway;
  `grading_model/stub.py` carries the documented fallback seam.
- Golden fixtures: `backend/tests/fixtures/ai/golden/sample.jsonl`.
- Tests: 9 in `test_ai_gateway.py` — shim decide/generate round-trip, low-confidence
  fallback, client-exception fallback, budget trip, flag-off path, privacy sanitizers.

**Human check pending:** one live staging `decide()` + `generate()` with real
`OPENROUTER_API_KEY`/`GEMINI_API_KEY` and an inspect of the `ai_decisions` doc.

## Operator actions still required (human checks in tasks.md)

1. **1.20** — rotate the exposed Firebase web API key (previously hardcoded) in the
   Firebase console and any Razorpay keys that ever shipped; record entries in
   `.run-logs/phase-00-secrets-rotation.md`.
2. **1.22** — browser confirmation of dev logins (quick-login with explicit MPIN, then
   phone+MPIN; quick-login without MPIN → `MPIN_REQUIRED`).
3. **2.21** — manual admin/session flow: `scripts/make_admin.py`, mutation without
   `X-Audit-Reason` → 400, with headers → audit doc; non-claim account → 403.
4. **Staging keys** — Razorpay test order → signed webhook → verify → refund;
   settlement payout round-trip; live AI `decide()`.

## Explicit deferrals (robust §13 rule 10 — no silent drops)

| Item | Where it lands |
|---|---|
| Website KYC wizard + status page | phase-04 (instructor/persona web work) |
| Website paywall UX + plan page + invoice download | phase-02+ web work |
| Cursor pagination + admin/analytics scan caps | phase-06 (platform services) |
| Structured request-logging middleware, uptime hook | phase-06/08 |
| GCP Secret Manager wiring for staging/prod | deployment step, phase-08 launch checklist |
| Razorpay Route onboarding + real release execution | staging ops with live keys |
| Invoice PDF rendering | later report/PDF pass |
| UPI Autopay mandates | billing hardening with staging keys |
| Full question-set catalogue | each brief's phase (scaffolding shipped now) |

## Executor notes / deviations

- `git add -A` checkpoints excluded `backups/` (728 MB of archives **containing the
  Firebase admin key and `.env`**) — added to `.gitignore` instead; committing them
  would have leaked secrets (playbook §3 rule 5).
- Task 1.12's order tests exercised the removed dev no-key path; they were adapted to
  configured fake keys + real HMAC signatures (assertions kept, dev fallbacks not).
- Task 2.12's sessions test expected a per-session revoke to leave the second session
  alive; per WS-02 step 3 a replayed revoked token revokes the whole family, so the test
  asserts the spec behavior (`REFRESH_REPLAYED`, family dead).
- Diary role tests (`test_diary`) expect a farmer/landlord gate; the working tree had
  every-persona access ("product decision" comment). Per playbook rule 2 the tests were
  kept and the gate restored (`require_role(user, "farmer", "farmLandlord")`).
- WS-06 test-repair decisions: time-dependent tests (diary report month, gaushala
  dashboard month) made time-relative; notifications exact-key assertion updated for the
  shipped `data` deep-link field.
- The stale dev server on port 8000 was left running (started by the operator before
  this session); restart it to pick up WS-01/02 changes.
