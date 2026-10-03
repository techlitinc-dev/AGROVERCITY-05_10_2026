# Phase 00 — SaaS Foundation & Hardening + AI Foundation — Build Instructions

> Self-contained execution sheet. Read `execution-plan/phase-00/readme.md` first.
> Global rules (execution-plan/README.md §3) apply to every workstream — the
> ones most at risk of violation are repeated inline. Execute workstreams in
> numbered order: WS-01/02 unlock safe auth, WS-03/04/05 build on it, WS-06 is
> cross-cutting (start the test repair early, it unblocks the exit gate), WS-07
> is independent and can run in parallel once WS-01 config keys exist.

## Repo orientation

- Backend: FastAPI + Firestore — routers `backend/app/routers/` (mounted with
  prefix `/v1` in `backend/app/main.py`), services `backend/app/services/`,
  core `backend/app/core/` (`config.py`, `db.py`, `deps.py`, `security.py`,
  `cache.py` Redis, `firebase.py`), tests `backend/tests/` (`pytest.ini` has
  `asyncio_mode = auto`). Run tests: `cd backend && .venv/bin/python -m pytest -q`.
- Website: React + TS + Vite — API wrappers `website/src/lib/api/` (e.g.
  `auth.ts`, `client.ts`), views `website/src/views/`, i18n `t()` in
  `website/src/lib/i18n/` (`locales/en.ts`, `locales/hi.ts` + module pairs),
  persona/module registry `website/src/lib/dashboard.ts`, routes in
  `website/src/App.tsx`, Firebase init `website/src/lib/firebase.ts`.
- Verified current-state anchors cited below: `backend/app/routers/auth.py`
  (dev-token acceptance ~L39, MPIN `1234` bypass ~L75/L295, `/quick-login`
  ~L316 with hardcoded `dev-user-1..8`, `dev-user-insurance-1`,
  `dev-user-coldstorage-1`); `backend/app/core/config.py` (`jwt_secret =
  "dev-secret-change-me"`, `env = "dev"`); `backend/app/main.py` (CORS
  `allow_origins=["*"]` ~L104); `backend/app/services/payments.py`
  (`signature == "dev"` fallback L22); `backend/app/routers/orders.py`
  (`or "rzp_test_dev"` ~L193); `backend/app/routers/admin.py`
  (`_require_admin` with hardcoded UIDs `admin-root`/`uid-admin`/`admin-demo`,
  hardcoded KYC queue `kyc-01`/`kyc-02` ~L166); `website/src/lib/firebase.ts`
  (hardcoded `apiKey` ~L17).

## WS-01 — Kill demo backdoors & secrets hygiene

**Source:** robust.md §3.1, §2 principle P5 · **Goal:** with `APP_ENV=prod`
(or `env=prod`) no demo path executes and no secret has a code-level default.

**Read first:** `backend/app/routers/auth.py`, `backend/app/core/config.py`,
`backend/app/core/security.py`, `backend/app/services/payments.py`,
`backend/app/routers/orders.py`, `backend/app/main.py`,
`website/src/lib/firebase.ts`, `backend/.env.example`, `website/.env.example`.

**Steps:**
1. In `backend/app/core/config.py` add a startup validator: when
   `env in ("staging", "prod")`, raise at import/startup if
   `jwt_secret` is unset or still `"dev-secret-change-me"`, and if
   `razorpay_key_id`/`razorpay_key_secret` are empty. Add `app_env` alias or
   reuse `env` — pick one name (`env`) and document it in `.env.example`.
2. `backend/app/routers/auth.py`: gate the `dev-`/`demo-` id_token acceptance
   (~L39), the MPIN `1234` bypasses (~L75 for `dev-` users, ~L295 for
   `dev-`/`omni-`/`isDemo`), and the whole `/quick-login` endpoint (11
   hardcoded accounts) behind `settings.env == "dev"`. In non-dev, these paths
   must return the standard error envelope (401 `INVALID_TOKEN` /
   403 `DISABLED_IN_PROD`), never succeed. Remove the `or "1234"` default-MPIN
   fallbacks in the register/reset flows (~L532–593) — require an explicit
   MPIN and reject 4-digit trivial sequences server-side in prod.
3. `backend/app/services/payments.py` L22: delete the
   `return signature == "dev"` shortcut in `verify_razorpay_signature`; if
   `razorpay_key_secret` is empty the function must return `False` (never
   accept). `backend/app/routers/orders.py` L193: remove the
   `or "rzp_test_dev"` fallback — return the envelope error `PAYMENTS_NOT_CONFIGURED`
   when the key is missing.
4. CORS: in `backend/app/main.py` replace `allow_origins=["*"]` with a
   per-env list from config (`web_origins: list[str]`), e.g. dev allows
   `http://localhost:5173`, staging/prod the real domains.
5. Firebase web key: move the hardcoded config in `website/src/lib/firebase.ts`
   to `import.meta.env.VITE_FIREBASE_API_KEY` etc.; extend
   `website/.env.example` with all `VITE_FIREBASE_*` keys; wire Firebase App
   Check (reCAPTCHA v3) and send the App Check token from
   `website/src/lib/api/client.ts` (`X-Firebase-AppCheck` header); verify the
   token backend-side in `core/firebase.py` when `env != "dev"`.
6. Rotate exposed secrets: the Firebase web API key currently in
   `firebase.ts` and any keys that ever shipped in code must be rotated in the
   Firebase/Razorpay consoles; record rotation in the run log.
7. Sweep: `grep -rn 'sess_demo\|dev-user\|demo-\|"1234"' backend/app website/src`
   — every hit is either deleted or provably behind `env == "dev"`.

**Acceptance:** with `env=prod` the app boots only with real secrets; MPIN
`1234` login fails; `/quick-login` returns 403; a bad Razorpay signature fails
verification; CORS preflight from an unknown origin is rejected; the grep sweep
returns no ungated hits.

**Verification:**
```bash
cd backend && .venv/bin/python -m pytest -q tests/test_auth.py tests/test_infra.py
APP_ENV=prod JWT_SECRET= .venv/bin/python -c "from app.main import app"   # must fail
cd website && pnpm exec tsc --noEmit && pnpm build
```
Manual: log in with a real OTP/MPIN in dev; confirm the same flows work and
demo shortcuts are dev-only.

## WS-02 — Auth & admin-auth unification

**Source:** robust.md §3.2; missing.md F2 (MPIN re-entry) · **Goal:** one admin
mechanism, hardened JWT lifecycle, abuse-resistant auth surfaces.

**Read first:** `backend/app/core/deps.py` (`admin_user` ~L23, Firebase custom
claims), `backend/scripts/make_admin.py`, `backend/app/routers/admin.py`
(`_require_admin` L24, `_admin_user` L35), `backend/app/services/tokens.py`
(`create_access_token` / `create_refresh_token` / `decode_token` — no rotation
today), `backend/app/core/cache.py` (`get_redis`), `backend/app/routers/auth.py`
(`/refresh` ~L249), `website/src/lib/api/auth.ts`.

**Steps:**
1. Admin unification: route every admin endpoint through
   `core/deps.py:admin_user` (custom claims set by `scripts/make_admin.py`).
   Delete `_require_admin` and the local `_admin_user` from
   `backend/app/routers/admin.py` — including the hardcoded UID fallback
   (`admin-root`, `uid-admin`, `admin-demo`). Update all call sites.
2. Add `X-Admin-Role` + `X-Audit-Reason` headers per the superadmin spec:
   extend `admin_user` (or a new `admin_action(role)` dependency) to require a
   non-empty `X-Audit-Reason` on every mutating admin endpoint and to validate
   `X-Admin-Role` against the caller's claims. Every admin mutation writes an
   `audit_logs` doc `{adminId, role, action, targetId, reason, at}`.
   **Rule 8 inline: no admin action without `audit_logs` entry + reason.**
3. Refresh-token rotation + revocation: in `services/tokens.py` add `jti` to
   refresh tokens; store live refresh `jti`s in Redis (`auth:refresh:<jti>`,
   TTL = `jwt_refresh_ttl_days`); `/refresh` rotates (new pair, old `jti`
   revoked — replay of a revoked token revokes the whole session family).
4. Sessions: add `GET /v1/auth/sessions` (list active sessions: device,
   created, last-used) and `DELETE /v1/auth/sessions/{id}` (revoke) to
   `routers/auth.py`; logout revokes the current `jti`.
5. Website session-restore UX: on 401 `TOKEN_EXPIRED`, show the MPIN re-entry
   sheet (missing.md F2) instead of a hard logout; on success refresh silently.
   **Rule 6 inline: all new strings via `t()` in en + hi; no `alert()`.**
6. Rate limiting (Redis token bucket) via a FastAPI dependency in
   `backend/app/core/` (new `ratelimit.py`): auth login/MPIN, OTP request,
   payments order/verify, chat send. Suggested limits: OTP 5/10 min per phone,
   login 10/10 min per IP+phone, payments 20/min per user, chat 60/min per
   user; keys `rl:<scope>:<id>`; 429 with the error envelope.

**Acceptance:** admin access with a non-claim account (even a formerly
hardcoded UID) is 403; an admin mutation without `X-Audit-Reason` is 400 and
one with it writes an `audit_logs` doc; rotating refresh tokens invalidates
the old one (replay → full revocation); sessions list/revoke works from two
devices; rate limiter returns 429 on the 6th OTP request in 10 min.

**Verification:**
```bash
cd backend && .venv/bin/python -m pytest -q tests/test_auth.py tests/test_admin.py
```
Manual: `scripts/make_admin.py` a test user → call an admin endpoint with +
without headers; log in on two browser profiles, revoke one session, confirm
the other survives; run the OTP flow 6× and observe 429.

## WS-03 — Real money rails

**Source:** robust.md §3.3, §2 principle P6 · **Goal:** payments, escrow,
payouts, bank verification, and tax ledgers move real money with audit trails.

**Read first:** `backend/app/services/payments.py` (order/verify/refund
helpers), `backend/app/routers/orders.py` (current Razorpay order surface),
`backend/app/routers/purchases.py` (escrow doc + handover OTP: 6-digit,
single-use, 15-min validity, ~L21–107), `backend/app/services/settlements.py`
(`run_settlements(period_start, period_end)`, `_config()` from
`platform_config`), `backend/app/routers/settlements.py`,
`backend/app/routers/jobs.py`, `backend/app/services/bank_verify/base.py` +
`stub.py` (`BankVerifyAdapter`, always-verified stub),
`backend/app/routers/bank_accounts.py` (penny-drop call ~L86).

**Rules inline (P6 / global 3):** integer paisa everywhere — never floats;
commission deducted at source; every financial mutation writes `audit_logs`;
maker-checker for manual overrides > ₹10,000; no money movement outside these
rails; every write endpoint accepts `Idempotency-Key`.

**Steps:**
1. New payments router `backend/app/routers/payments.py` (new) exposing
   `services/payments.py`: `POST /v1/payments/order` (amountPaisa, purpose,
   refId → Razorpay order; idempotent), `POST /v1/payments/verify`
   (order_id/payment_id/signature → HMAC verify), refund endpoint
   (`POST /v1/payments/{paymentId}/refund`, admin + reason), and
   `POST /v1/payments/webhook` — Razorpay webhook with
   `X-Razorpay-Signature` verification against a dedicated
   `razorpay_webhook_secret` config key; persist `payment_events` and make
   webhook handling idempotent on event id. Register in `main.py` with
   prefix `/v1`.
2. Reconciliation job: extend `routers/jobs.py` with a nightly job that diffs
   Razorpay payments (API list) vs `payment_events`/`orders` and writes
   discrepancies to an `audit_logs` + admin alert surface.
3. Escrow via Razorpay Route: create linked accounts per
   seller/transporter/equipment owner/broker; on purchase payment, hold in
   escrow with transfers configured; auto-release T+0/T+1 after a 24 h silent
   dispute window; wire release to the existing handover OTP verification in
   `routers/purchases.py` (OTP confirm starts the release clock; a dispute
   opened inside the window pauses release). Store `escrowStatus` and
   `releaseAt` on the purchase doc.
4. Payouts: weekly settlement run in `services/settlements.py` +
   `routers/jobs.py` moves real money via RazorpayX payouts to verified bank
   accounts; beneficiaries without a verified bank account are set `onHold`
   with reason (existing field semantics — keep). Dry-run mode per run config.
5. Bank verification: implement a real penny-drop adapter
   (`backend/app/services/bank_verify/razorpayx.py` (new)) behind the existing
   `BankVerifyAdapter` interface; select via config (`bank_verify_provider =
   stub|razorpayx`, stub allowed only in dev/test). Remove the always-verified
   stub from any non-dev path.
6. TDS 194-O & GST: per-transaction TDS ledger collection `tds_ledger`
   `{txnId, persona, grossPaisa, tdsPaisa, section:"194-O", period}` written
   at settlement; GST invoice generation for vyapari sales (spec S6) and for
   platform commission invoices to business personas (`invoices` collection +
   PDF via the existing report/PDF patterns).
7. Tests: extend `backend/tests/` — webhook signature good/bad, idempotent
   replay, escrow release timing, onHold payout, TDS math (integer paisa).

**Acceptance:** staging: create order → pay with Razorpay test card → webhook
verified → `/verify` returns success → refund round-trip; escrow releases only
after OTP + 24 h window (or is paused by dispute); settlement run pays out to
a verified account and holds an unverified one; penny-drop fails an invalid
IFSC via the real adapter; TDS ledger lines sum exactly to settled gross.

**Verification:**
```bash
cd backend && .venv/bin/python -m pytest -q tests/test_admin_finance.py tests/test_booking_accept.py -k "payment or settlement or escrow or tds"
cd backend && .venv/bin/python -m pytest -q
```
Manual (staging keys): full purchase flow → handover OTP → escrow release →
weekly settlement payout; inspect `audit_logs` for every mutation.

## WS-04 — KYC pipeline

**Source:** robust.md §3.4 · **Goal:** one real KYC pipeline replacing the
hardcoded admin samples, gating every business persona.

**Read first:** `backend/app/routers/admin.py` (hardcoded queue `kyc-01`/
`kyc-02` ~L166–194, `pendingKycCount: 8` ~L95), `backend/app/routers/users.py`
(role_profiles), `backend/app/routers/bank_accounts.py`,
`website/src/lib/api/users.ts`, `website/src/views/onboarding/`,
`features/farm_transporter.md` / `features/Vyapari.md` etc. for document
matrices.

**Steps:**
1. New `kyc_cases` collection: `{caseId, userId, persona, docs:[{docId, type,
   storagePath, status: pending|verified|rejected, reason?, expiresAt?,
   extractedRef?}], status, submittedAt, reviewedBy?, reviewedAt?}`.
2. Per-persona document matrices (from `features/*.md`, encode as config):
   base for all: Aadhaar (DigiLocker/offline-eKYC, masked only), PAN,
   penny-drop bank; transporter RC/DL; vyapari APMC licence + GST; broker
   arhtiya licence; equipment owner RC/insurance/operator licence; dairy
   FSSAI; exporter IEC/APEDA; instructor credential per specialization;
   landlord 7/12 title + tax receipt.
3. Router `backend/app/routers/kyc.py` (new): `POST /v1/kyc/cases` (submit),
   `GET /v1/kyc/status`, doc upload via signed URLs (reuse
   `services/storage.py`); admin endpoints moved to read from `kyc_cases`:
   rewrite the `admin.py` KYC queue (`GET /kyc/queue`, `POST /kyc/{id}/review`)
   to query/mutate the collection — delete the sample docs and the hardcoded
   `pendingKycCount`. Every review action requires reason + writes
   `audit_logs` (depends on WS-02).
4. Doc state machine `pending → verified → rejected` (with mandatory reason on
   reject); expiry tracking (`expiresAt`) + a scheduled reminder job (extend
   `routers/jobs.py`) for RC/insurance/fitness/licences; recurring
   re-verification flag for instructor licences.
5. Website: KYC submission wizard per persona (doc checklist from the matrix,
   upload, masked-Aadhaar notice) + KYC status page (per-doc state, reject
   reasons, re-upload); API wrapper `website/src/lib/api/kyc.ts` (new);
   register routes in `App.tsx`. **Rule 6: `t()` en+hi only; no `alert()`.**
6. Privacy: never store unmasked Aadhaar numbers — mask before persist; this
   matches global rule 11 and the AI payload rules later.

**Acceptance:** a transporter submits Aadhaar+PAN+bank+RC/DL via the wizard →
case appears in the real queue → admin verifies 4 docs and rejects RC with
reason → status page shows per-doc states + reason → re-upload moves the case
back to pending → full verify flips the case verified; `pendingKycCount`
reflects live data; expiry reminder job emits a notification 30 days before
`expiresAt`.

**Verification:**
```bash
cd backend && .venv/bin/python -m pytest -q tests/test_admin.py -k kyc
cd website && pnpm exec tsc --noEmit && pnpm build
```
Manual: full wizard→queue→review→status round-trip in staging (exit-gate
flow).

## WS-05 — Subscriptions & billing

**Source:** robust.md §3.5 (+ §10 tier matrix) · **Goal:** the SaaS core —
plans, subscriptions, entitlements, paywall UX.

**Read first:** `backend/app/core/deps.py`, `backend/app/routers/` (pick 2–3
business-persona routers to instrument first: `transport.py`,
`equipment_owner.py`, `broker.py`), `backend/app/services/payments.py`,
`website/src/lib/api/client.ts`, `website/src/lib/dashboard.ts`,
`website/src/views/`.

**Steps:**
1. New backend module `billing`: `backend/app/routers/billing.py` (new) +
   `backend/app/services/billing.py` (new). `plans` collection shape (per
   §3.5): `{planId, persona, tier: free|pro|enterprise, priceMonthlyPaisa,
   limits: {listings, vehicles, machines, teamSeats, analyticsHistoryDays,
   prioritySupport}, features: [...]}`.
2. Seed the tier matrix from robust §10 (prices ₹/mo, commissions always on):
   Farmer free everything / 0% commission (never paywalled); Landlord 299;
   Transporter 499 (10% commission); Vyapari 999 (2% min ₹50); Equipment 399
   (12%); Broker 799 (2%, 0–10 configurable); Dairy 1,499 (3/5/2% marketplace);
   Instructor 499 (15–20% course GMV); Direct Buyer 4,999 / Enterprise 24,999
   (1–2% settlement); e-Market customer free (5% seller-side); Bank/Insurance/
   ColdStorage console seats 2,000/seat.
3. `subscriptions` collection: `{subId, userId, planId, status:
   active|past_due|cancelled, provider: razorpay_sub|upi_autopay,
   providerRef, currentPeriodEnd}`. Create via Razorpay Subscriptions or UPI
   Autopay mandates (critical for rural India); status driven by the WS-03
   webhook (extend it for subscription events). Grace period + downgrade rules
   documented in config.
4. Entitlements: `require_entitlement(persona, feature)` FastAPI dependency +
   per-billing-period usage counters (Redis or Firestore `usage_counters`);
   wire it into the 2–3 chosen routers' limit-relevant endpoints (e.g. add
   vehicle beyond plan limit → 402/429 envelope `ENTITLEMENT_EXCEEDED` with
   `{limit, used, planId}`). Free tier must stay genuinely useful; **rule 5:
   never paywall the farmer's core grow-sell-insure loop.**
5. Website paywall UX: upgrade prompt at limit hits (consumes the 402
   payload), plan comparison page, invoices list + GST invoice download
   (WS-03 invoices), subscription status on the profile screen; API wrapper
   `website/src/lib/api/billing.ts` (new); `t()` en+hi.

**Acceptance:** an over-limit request is blocked with the envelope payload
(exit-gate proof); upgrade → Razorpay subscription (test mode) → webhook
activates sub → the same request now succeeds; invoices downloadable; farmer
endpoints carry no entitlement checks.

**Verification:**
```bash
cd backend && .venv/bin/python -m pytest -q -k billing
cd website && pnpm exec tsc --noEmit && pnpm build
```
Manual: free transporter adds vehicles to the limit → paywall → upgrade in
test mode → limit raised; GST invoice PDF downloads.

## WS-06 — Platform plumbing

**Source:** robust.md §3.6 · **Goal:** consistency, observability, and a green
CI spine. **Global rule 9: the backend suite must be green — start the 45-test
repair on day 1, not at the gate.**

**Read first:** `backend/tests/conftest.py` (manual monkeypatch lists
~L111–123), `backend/app/core/db.py`, `backend/app/main.py`,
`backend/app/routers/analytics.py` + `admin.py` (unbounded scans),
`infra/firestore.indexes.json`, `backend/pytest.ini`, `website/package.json`.

**Steps:**
1. Error envelope: standardize every error as `{"error":{code, message,
   fieldErrors}}`; add a global exception handler in `main.py` converting
   `HTTPException(detail=...)` leaks and unhandled exceptions into the
   envelope; sweep routers for raw `{"detail": ...}` returns.
2. Real cursor pagination on `db.query()`: Firestore cursors (start_after)
   replacing limit-100-then-slice; standard response shape `{items,
   nextCursor}`; cap unbounded scans in `admin.py`/`analytics.py` queries.
3. Indexes: for every shipped composite query add an entry to
   `infra/firestore.indexes.json` (including new WS-03/04/05/07 collections).
4. Test repair: fix the 45 failing backend tests (run
   `.venv/bin/python -m pytest -q` to enumerate; robust §3.6 counts 45).
   Refactor `conftest.py` so the fake Firestore registry auto-discovers
   `app.routers`/`app.services` modules instead of the manual monkeypatch
   lists — new modules must need zero conftest edits.
5. Sentry: backend (`sentry_dsn` already in config — wire `sentry-sdk` FastAPI
   integration, env-tagged) + website (`@sentry/react` with
   `VITE_SENTRY_DSN`); structured request logging middleware (request id,
   user, latency); uptime alerting hook (health router exists:
   `routers/health.py`).
6. Environments: dev/staging/prod config files + secrets via env → GCP Secret
   Manager for staging/prod; document keys in `backend/.env.example`.
7. CI: pipeline running `pytest` + `cd website && pnpm exec tsc --noEmit &&
   pnpm build` + locale-parity check (en/hi key parity script) as merge gates.

**Acceptance:** `pytest` fully green; adding a new router module needs no
conftest change (prove with a smoke test); no `detail`-shape error reachable;
a paginated endpoint returns a working `nextCursor`; index file deploys
cleanly; CI fails on a red test or an en/hi key mismatch.

**Verification:** global gate commands; plus trigger a Sentry test event on
backend + website; run the CI pipeline on a PR.

## WS-07 — AI foundation gateway (brief M1)

**Source:** ai_implementation_plan.md §0, §1.1–1.4, brief M1; ai.md §6–§7 ·
**Goal:** the single AI entry point every later brief uses. **Rules inline
(global 10/11/12):** all model calls through `gateway.py` — never from
routers; deterministic fallback at every decision point; app fully works with
`AI_PROVIDER=shim`; CI never calls paid APIs; no unmasked Aadhaar/phones/
emails in any AI payload; every call logged to `ai_decisions` with cost +
confidence; new AI features launch at `suggest` automation level.

**Read first:** `backend/app/services/chatbot.py` (existing Gemini usage),
`backend/app/services/disease_model/` (`base.py`, `gemini.py`, `stub.py`),
`backend/app/core/config.py`, `backend/app/core/db.py`,
`backend/app/core/cache.py`, `backend/tests/conftest.py`.

**Steps:**
1. Create package `backend/app/services/ai/` (all new) per §1.1:
   - `gateway.py` — single entry: `decide(state, question_set_id, ctx) ->
     DecisionResult`, `generate(prompt, opts) -> str`,
     `analyze_image(bytes, prompt, schema) -> dict`, `embed(texts) -> vectors`.
     Routing, retries (2 with backoff), timeouts (Jev 2 s, Gemini 20 s),
     fallback, logging.
   - `jev_client.py` — OpenRouter HTTP client (httpx async), model
     `typesafe/jev-1.13`, one HTTP call per `decide()` batching all questions,
     `HTTP-Referer`/`X-Title` headers.
   - `gemini_client.py` — `google-genai` SDK wrapper (AI Studio key direct —
     never OpenRouter for Gemini); `generate` (optional JSON schema + lang),
     `analyze_image`, `embed`; count-tokens helper for cost logging.
   - `question_sets.py` — registry: `{id, version, schema, state_builder,
     confidence_threshold, automation_level, fallback_fn}`. Scaffolding only;
     individual sets land with their briefs in later phases.
   - `decision_log.py` — writes `ai_decisions` docs (module, question set +
     version, state hash, answers, confidence, latency, cost, model,
     fallback flag); 90-day TTL to cold storage later.
   - `outcomes.py` — `record_outcome(decision_id, outcome)` linking real-world
     resolution back (calibration dataset per ai.md §7).
   - `shim.py` — deterministic fixture answers from
     `backend/tests/fixtures/ai/golden/*.jsonl` (new dir), keyed by
     question-set id; unknown sets return schema-valid defaults; active when
     `AI_PROVIDER=shim`.
   - `budget.py` — Redis per-day cost counters `ai:cost:<model>:<yyyymmdd>`;
     80% → admin alert, 100% → raise `BudgetExhausted` → gateway marks
     fallback (degrade, never error).
   - `privacy.py` — sanitizers: `HMAC(user_id, AI_HASH_SALT)` for IDs, strip
     phones/emails, masked Aadhaar only, trim state to token budget
     (≤1,500 tokens target), chunk >32k states (Jev context limit).
2. Config (§1.2) — extend `backend/app/core/config.py` + `.env.example`:
   `OPENROUTER_API_KEY`, `GEMINI_API_KEY` (both fields exist), `AI_PROVIDER`
   (`live`; `shim` in dev/test/CI), `AI_JEV_MODEL=typesafe/jev-1.13`,
   `AI_GEMINI_MODEL=gemini-2.5-flash`, `AI_GEMINI_MODEL_LITE=gemini-2.5-flash-lite`,
   `AI_GEMINI_MODEL_PRO=gemini-2.5-pro`, `AI_GEMINI_EMBED_MODEL=gemini-embedding-001`,
   `AI_DAILY_BUDGET_USD=50`, `AI_HASH_SALT`. Also `platform_config/ai`
   Firestore doc `{modules: {<flag>: bool}, thresholds: {"<id>.v1": 0.75},
   automation: {"<id>.v1": "suggest"}}` — reader with 60 s cache; edits are
   maker-checker + audited (admin console lands in phase-07; provide the
   reader + doc seed now).
3. Contract (§1.3) — Pydantic `DecisionResult`: `{answers: dict[str, Any],
   confidence: float, source: Literal["jev","gemini","fallback","shim"],
   escalated: bool, decision_id: str, latency_ms: int}`.
4. Refactors (§1.4): `services/chatbot.py` — keep prompt logic, route the
   model call through `gateway.generate()`; `services/disease_model/` — route
   through `gateway.analyze_image()`, the existing stub becomes the fallback
   (label it "demo" where surfaced). `services/grading_model/` stays stubbed
   (real impl is brief M10, phase-05) — just note the fallback seam.
5. Module flag check: `decide()`/`generate()` consult `platform_config/ai`
   module flags; flag off → deterministic fallback, logged with
   `fallbackUsed` (SDR step 5 semantics from §3).
6. Tests `backend/tests/test_ai_gateway.py` (new): shim decide/generate
   round-trip; fallback on client exception; budget trip degrades cleanly;
   privacy sanitizer strips phone/email/Aadhaar patterns; flag-off path.
   Golden fixtures in `backend/tests/fixtures/ai/golden/`. Ensure conftest
   auto-discovery (WS-06) covers the new package.

**Acceptance:** `AI_PROVIDER=shim .venv/bin/python -m pytest -q` green; a
`decide()` in a REPL with a live staging key returns a valid `DecisionResult`
and writes an `ai_decisions` doc with cost; gateway down/exception → callers
get fallback, never exceptions; budget counters trip at 100% and degrade.

**Verification (brief-M1 standard):**
```bash
cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q
cd website && pnpm build
```
Live check with staging `OPENROUTER_API_KEY`/`GEMINI_API_KEY`: one
`decide()` + one `generate()`; inspect the `ai_decisions` docs.

## Phase-final verification

```bash
cd backend && .venv/bin/python -m pytest -q                      # fully green (45 fixed)
cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q     # shim suite green
cd website && pnpm exec tsc --noEmit && pnpm build               # clean
```
Manual exit-gate flows (staging, `env=prod`-like config):
1. Boot backend without `jwt_secret` → refuses to start; MPIN `1234` and
   `/auth/quick-login` → 401/403.
2. Razorpay test order → signed webhook → `/v1/payments/verify` → refund →
   reconciliation job shows no diff.
3. Entitlement block: over-limit request returns `ENTITLEMENT_EXCEEDED`
   envelope; after test subscription activation it succeeds.
4. KYC: wizard submit → real queue → review → `pending → verified` on the
   status page.
5. AI: one live `decide()` writes an `ai_decisions` doc with cost + confidence;
   repeat with budget forced to 0 → clean fallback.
6. One full admin mutation with `X-Admin-Role` + `X-Audit-Reason` lands in
   `audit_logs`; the same call without the reason header is rejected.
