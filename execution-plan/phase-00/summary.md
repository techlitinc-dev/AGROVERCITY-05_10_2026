# phase-00 — Execution Summary

> Executed 2026-10-03 per `execution-plan/AGENT_PLAYBOOK.md`, task queue
> `execution-plan/phase-00/tasks.md` (WS-01/WS-02) + `instructions.md` (WS-03…WS-07).
> Re-verified 2026-10-03 (second pass at operator request: all non-human tasks already
> `[x]`; the three HUMAN CHECK tasks re-run for their automated parts — results below).
> Backend suite went from **45 failed / 698 passed** at phase start to **fully green**.
> Checkpoints: `3fff613` WS-01 · `fb2fed4` WS-02 · `b0df039` WS-06a · `974ccdd` WS-07 ·
> `a527502` WS-03 · `7f45460` WS-04 · `54eb794` WS-05 · `6adc25e` WS-06b ·
> `8e4e26c` execution summary.

## Status at a glance

| WS | Title | Status | Notes |
|---|---|---|---|
| WS-01 | Kill demo backdoors & secrets hygiene | ✅ done (human check 1.20 open) | automated 1.22 re-verified this pass |
| WS-02 | Auth & admin-auth unification | ✅ done (human check 2.21 open) | automated 2.21 curl re-verified this pass |
| WS-03 | Real money rails | ✅ backend core | live staging keys + Route onboarding pending (human) |
| WS-04 | KYC pipeline | ⚠️ backend done | website wizard/status page deferred (API ready) |
| WS-05 | Subscriptions & billing | ⚠️ backend done | website paywall UX deferred; UPI Autopay deferred |
| WS-06 | Platform plumbing | ⚠️ mostly done | cursor pagination + secret-manager wiring deferred |
| WS-07 | AI foundation gateway | ✅ done (live key check pending) | shim suite green; live staging decide needs keys |

## Global verification gate (README §4) — re-run 2026-10-03

```
backend  pytest (default env, AI_PROVIDER=shim)  -> 844 passed, 1 skipped, 0 failed
website  pnpm exec tsc --noEmit                  -> clean
website  pnpm build                              -> built (chunk-size warning only)
```

(Suite grew from 786 to 844 tests vs the first pass — later phases 01–03 added tests;
all green. `test_prod_guards.py` 5, `test_ai_gateway.py` 9, `test_payments_rails.py`
13, `test_kyc_pipeline.py` 5, `test_billing.py` 5 all pass within the suite.)

## Re-verification pass (2026-10-03) — evidence

- **Prod boot guards**: `APP_ENV=prod JWT_SECRET=` → `ValidationError: refusing to
  start with env=prod: unsafe/missing jwt_secret, razorpay_key_id, razorpay_key_secret`.
  With placeholder secrets → `boot ok`. (Exit-gate item 2 ✅)
- **Demo-path sweep** (`sess_demo\|dev-user\|demo-\|"1234"` over `backend/app`,
  `website/src`): hits only in `routers/auth.py` (inside the dev-gated
  `_verify_firebase_token` / `login_with_phone_mpin` / `mpin_verify` / `quick_login`
  blocks), `core/security.py:28` (WEAK_MPIN denylist), seed data literals in
  `data/cold_storage_seed.py` / `data/livestock_seed.py` (both seed functions return
  early unless `settings.env == "dev"` — cold_storage_seed.py:165, livestock_seed.py:743),
  and `routers/insurance.py` `_demo_policy` call sites (gated at insurance.py:135 and
  :274). **Zero hits in `website/src`.** (Exit-gate item 2 ✅)
- **Task 1.22 (automated parts)** on a fresh dev server (`uvicorn app.main:app
  --port 8000`):
  - quick-login WITHOUT MPIN → `MPIN_REQUIRED` ✅ (the task's RUN command output).
  - quick-login WITH explicit MPIN → token pair issued ✅.
  - phone + same MPIN re-login → succeeds on a fresh user (verified end-to-end with a
    new phone: quick-login created `user_9000000123`, login returned tokens) ✅.
  - Note: re-login as persona `farmer` on the shared dev emulator returns `WRONG_MPIN`
    because `dev-user-1`'s stored hash predates this session (quick-login only writes
    the hash at create-time or when unset, per task 1.9 spec) — stale seed data, not a
    code defect. Browser confirmation remains the human's.
- **Task 2.21 (automated part)**: `GET /v1/admin/overview` with `Bearer invalid` →
  `401` ✅. Manual admin flow (make_admin, audit headers) remains the human's.
- **Task 1.20**: `.run-logs/phase-00-secrets-rotation.md` exists (created in the first
  pass) — header only, **no rotation entries recorded yet**; the human operator must
  rotate the keys and record them.

## WS-01 — demo backdoors & secrets hygiene ✅

- `env` validator: staging/prod refuse to boot without real `jwt_secret` + Razorpay keys.
- `/auth/quick-login`, MPIN `1234` bypasses, `dev-`/`demo-` id-tokens all gated to
  `env == "dev"`; quick-login requires an explicit MPIN (`MPIN_REQUIRED`), trivial
  MPINs rejected outside dev (`WEAK_MPIN`).
- Razorpay: `"dev"` signature shortcut deleted, `rzp_test_dev` fallback deleted
  (`PAYMENTS_NOT_CONFIGURED` instead); order tests adapted to fake keys + real HMAC.
- CORS locked to `settings.web_origins`; Firebase web key moved to `VITE_FIREBASE_*`
  + App Check init, `X-Firebase-AppCheck` header from the website, backend App Check
  middleware.
- `models/auth.py` quick-login MPIN default removed; instructor `sess_demo` fetch removed.

## WS-02 — auth & admin-auth unification ✅

- `admin.py` runs entirely through `core/deps.py:admin_user` (Firebase claims);
  hardcoded UID fallback and local `_require_admin`/`_admin_user` deleted.
- `admin_action(action)` dependency: `X-Audit-Reason` required, `X-Admin-Role`
  validated, every mutation writes an `audit_logs` doc; wired into all admin mutations.
- Refresh tokens carry `jti`; Redis-backed rotation + replay detection (replay revokes
  the whole session family); `GET/DELETE /v1/auth/sessions`, `POST /v1/auth/logout`.
- Website: `mpinReentryRequired` state, refresh-failure → `/auth?reentry=mpin`,
  `MpinReentrySheet.tsx` with en+hi keys, AuthView wiring.
- `core/ratelimit.py` (Redis fixed-window, fail-open) + limits on login, OTP reset,
  Razorpay order/verify, chat send.

## WS-03 — real money rails ✅ backend core

- `routers/payments.py`: `POST /v1/payments/order` (idempotent on `Idempotency-Key`),
  `/verify` (HMAC), `/{id}/refund` (admin + audit), `/webhook` (dedicated
  `razorpay_webhook_secret`, persists `payment_events`, idempotent on event id, drives
  payment + subscription status).
- Nightly reconciliation job `/jobs/payments/reconcile` diffs Razorpay vs local payments.
- Escrow release clock: handover OTP starts `releaseAt` (24 h dispute window); QC
  dispute pauses release; `/jobs/escrow/release-due` releases due holds.
- RazorpayX: real penny-drop adapter (`bank_verify/razorpayx.py`, provider selectable;
  stub only in dev/test) + payout client; `/jobs/settlements/payouts` pays verified
  accounts, sets `onHold` + reason for unverified beneficiaries.
- TDS 194-O `tds_ledger` (integer paisa) + GST commission `invoices` at settlement.

**Deferred:** Razorpay Route linked-account onboarding & live release execution
(money movement needs staging keys); invoice PDF rendering (later report pass).

## WS-04 — KYC pipeline ⚠️ backend done

- `services/kyc.py` + `routers/kyc.py`: `kyc_cases` collection, per-persona document
  matrices, `pending→verified→rejected` per-doc state machine with mandatory reject
  reasons, re-upload resets to pending, expiry tracking + `reverifyRequired`.
- Admin queue reads `kyc_cases` (hardcoded samples deleted); `review` requires reason +
  audit; `/jobs/kyc/expiry-reminders` notifies 30 days before expiry.
- Aadhaar never stored unmasked.

**Deferred (dated):** website KYC wizard + status page → phase-04 web work; backend
contract complete and test-covered, so the staging exit-gate flow is executable via API.

## WS-05 — subscriptions & billing ⚠️ backend done

- `services/billing.py`: full tier matrix (robust §10) in `plans`; `subscriptions`;
  `effective_plan`, usage counters, `check_entitlement`/`consume`.
- `routers/billing.py`: `/billing/plans`, `/billing/subscription` (+ usage + grace),
  `/billing/subscribe`, `/billing/invoices`.
- 402 `ENTITLEMENT_EXCEEDED` envelope with `{limit, used, planId}`; wired to transport
  vehicles + equipment machines (tests prove the 4th create blocked, unlock after
  upgrade). Farmer plan free, no limits (exit-gate item: entitlement block proven by
  test_billing.py within the green suite ✅).
- Razorpay subscription status webhook-driven (WS-03 webhook extended for
  `subscription.*`).

**Deferred:** website paywall UX; UPI Autopay mandates; real Razorpay keys (staging).

## WS-06 — platform plumbing ⚠️ mostly done

- **Test repair ✅**: all 45 failing tests fixed; `conftest.py` auto-discovers
  `app.routers/services/data/core` modules.
- **Error envelope ✅**: global handler converts dict and non-dict HTTPException
  details into `{"error": {code, message, fieldErrors}}`.
- **Indexes ✅**: composite indexes for payments, payment_events, subscriptions,
  kyc_cases, invoices, tds_ledger, ai_decisions.
- **Observability partial**: backend Sentry already wired; website Sentry added
  (`VITE_SENTRY_DSN`); structured request logging + uptime hook deferred.
- **CI ✅**: `.github/workflows/ci.yml` (pytest shim + tsc + build + locale parity) and
  `website/scripts/check-locale-parity.mjs`.
- **Environments partial**: keys documented in `.env.example` files; GCP Secret Manager
  wiring is a deployment task.

**Deferred:** real cursor pagination (`db.query` still limit-then-slice), admin/
analytics scan caps, structured request logging → phase-06.

## WS-07 — AI foundation gateway ✅ (live check pending)

- `services/ai/` package: `gateway.py` (single entry: `decide`/`generate`/
  `analyze_image`/`embed`, retries ×2, fallback, budget, logging), `jev_client.py`,
  `gemini_client.py`, `question_sets.py`, `decision_log.py` (`ai_decisions` with cost +
  confidence + state hash), `outcomes.py`, `shim.py` (golden fixtures), `budget.py`
  (Redis counters, 80 % alert / 100 % → fallback), `privacy.py` (HMAC ids, phone/email
  strip, Aadhaar mask, token trim), `config_store.py`.
- `DecisionResult` contract per §1.3; config per §1.2; `chatbot.py` and
  `disease_model/gemini.py` refactored through the gateway.
- Tests: 9 in `test_ai_gateway.py` (shim round-trip, low-confidence fallback,
  client-exception fallback, budget trip, flag-off, privacy sanitizers) — green in the
  full suite ✅ (exit-gate shim item). **Live staging `decide()` pending keys (human).**

## Exit gate (readme.md) — final status

- [x] Backend suite fully green — 844 passed, 1 skipped, 0 failed (re-run 2026-10-03).
- [x] No demo backdoor reachable with `APP_ENV=prod`; prod refuses to boot without a
      real `jwt_secret` (boot checks re-run 2026-10-03, evidence above).
- [ ] Real Razorpay test order → webhook → verify proven in staging — **operator keys**.
- [x] Entitlement middleware demonstrably blocks over-limit (402 envelope) — via
      `test_billing.py` in the green suite.
- [ ] KYC case `pending → verified` end-to-end in staging — **operator/staging**;
      backend flow covered by `test_kyc_pipeline.py`.
- [x] `AI_PROVIDER=shim` full suite green — 844 passed.
- [ ] One live `decide()` against a staging key writing `ai_decisions` — **operator keys**.
- [x] Global verification gate (README §4) green — pytest + tsc + build re-run today.

## Operator actions still required (human checks in tasks.md)

1. **1.20** — rotate the exposed Firebase web API key (previously hardcoded) and any
   Razorpay keys that shipped; record entries in
   `.run-logs/phase-00-secrets-rotation.md` (file exists, header only).
2. **1.22** — browser confirmation of dev logins; the automated behavior is re-verified
   (MPIN_REQUIRED, explicit-MPIN quick-login, fresh-user phone re-login all pass).
3. **2.21** — manual admin/session flow: `scripts/make_admin.py`, mutation without
   `X-Audit-Reason` → 400, with headers → audit doc; non-claim account → 403
   (automated 401 check re-verified).
4. **Staging keys** — Razorpay order/webhook/verify/refund walk; settlement payout
   round-trip; KYC queue review; live AI `decide()`.

## Explicit deferrals (robust §13 rule 10 — no silent drops)

| Item | Where it lands |
|---|---|
| Website KYC wizard + status page | phase-04 (persona web work) |
| Website paywall UX + plan page + invoice download | phase-02+ web work |
| Cursor pagination + admin/analytics scan caps | phase-06 (platform services) |
| Structured request-logging middleware, uptime hook | phase-06/08 |
| GCP Secret Manager wiring for staging/prod | deployment step, phase-08 launch checklist |
| Razorpay Route onboarding + real release execution | staging ops with live keys |
| Invoice PDF rendering | later report/PDF pass |
| UPI Autopay mandates | billing hardening with staging keys |
| Full question-set catalogue | each brief's phase (scaffolding shipped) |

## Executor notes / deviations

- `git add -A` checkpoints excluded `backups/` (728 MB of archives **containing the
  Firebase admin key and `.env`**) — added to `.gitignore` instead; committing them
  would have leaked secrets (playbook §3 rule 5).
- Task 1.12's order tests exercised the removed dev no-key path; adapted to configured
  fake keys + real HMAC signatures (assertions kept).
- Task 2.12's sessions test asserts spec behavior (`REFRESH_REPLAYED` revokes the
  family), matching WS-02 step 3.
- Diary role gate restored (`require_role(user, "farmer", "farmLandlord")`) rather than
  weakening the tests.
- This re-verification pass made **no code changes**; dev server started for the
  human-check curls was stopped afterwards. The phase-00/01/02/03 `summary.md` files
  were found deleted in the working tree; this file re-creates the phase-00 one from
  git history (`8e4e26c`) plus today's fresh evidence.
