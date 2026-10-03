# Phase 00 — SaaS Foundation & Hardening + AI Foundation

> Convert the demo-grade codebase into a production-safe SaaS foundation before
> any persona or module work begins: kill every demo backdoor, unify auth and
> admin auth, stand up real money rails (payments, escrow, payouts, bank
> verification, TDS/GST), build the real KYC pipeline, ship the subscriptions &
> billing core, fix platform plumbing (error envelope, pagination, indexes,
> tests, Sentry, envs, CI), and build the AI gateway package that every later AI
> brief depends on.
> Sources: `missing-features/robust.md` §2 (P5/P6), §3.1–3.6, §10 (tier matrix),
> §11 (roadmap); `missing-features/ai_implementation_plan.md` §0, §1.1–1.4,
> brief M1; `missing-features/ai.md` §6 (provider strategy), §7 (trust &
> calibration — foundation parts only).

## Depends on

Nothing — this phase blocks everything (phases 01–08 all assume its gates pass).

## Workstreams

| WS | Title | Source | Output (what exists when done) |
|---|---|---|---|
| WS-01 | Kill demo backdoors & secrets hygiene | robust §3.1, §2 P5 | MPIN `1234` bypass, `dev-`/`demo-` tokens, `/auth/quick-login`, Razorpay `"dev"` signature + `rzp_test_dev` fallback all gated to `APP_ENV=dev` or deleted; startup fails in prod without real `jwt_secret`; CORS locked; Firebase web key in env + App Check |
| WS-02 | Auth & admin-auth unification | robust §3.2; missing.md F2 | One admin path (`core/deps.py:admin_user` + `scripts/make_admin.py`); `routers/admin.py:_require_admin` deleted; `X-Admin-Role`/`X-Audit-Reason` enforced; refresh-token rotation + Redis revocation; `GET/DELETE /v1/auth/sessions`; MPIN re-entry UX; Redis rate limiting on auth/OTP/payments/chat |
| WS-03 | Real money rails | robust §3.3, §2 P6 | `POST /v1/payments/order` + `/verify` + signed Razorpay webhook + refunds + reconciliation job; Razorpay Route escrow with T+0/T+1 auto-release + 24 h dispute window wired to handover OTP; RazorpayX weekly payouts (`onHold` without verified bank); real penny-drop adapter; TDS 194-O ledger + GST invoices |
| WS-04 | KYC pipeline | robust §3.4 | `kyc_cases` collection + real review queue (hardcoded admin samples gone); per-persona document matrices; `pending→verified→rejected` state machine with reasons; expiry tracking + reminders; website KYC wizard + status page |
| WS-05 | Subscriptions & billing | robust §3.5, §10 | New `billing` module: `plans` + `subscriptions` collections; Razorpay Subscriptions / UPI Autopay; webhook-driven status; `require_entitlement` middleware + usage counters; paywall UX; farmer never paywalled |
| WS-06 | Platform plumbing | robust §3.6 | Error envelope everywhere; real cursor pagination; `infra/firestore.indexes.json` complete; 45 failing backend tests fixed + conftest auto-discovery; Sentry backend + website; dev/staging/prod envs + secrets; CI gates |
| WS-07 | AI foundation gateway | AI brief M1; ai plan §1; ai.md §6–§7 | `backend/app/services/ai/` package (gateway, jev_client, gemini_client, question_sets, decision_log, outcomes, shim, budget, privacy) per §1.1; config per §1.2; `DecisionResult` contract §1.3; `chatbot.py` + `disease_model` refactored through gateway; `test_ai_gateway.py` green on shim |

## Out of scope

- Task engine / Action Center dashboard (phase-01, robust §4).
- Any persona app build-out or module web UI beyond the KYC wizard/status page
  and paywall surfaces needed here (phases 02–05).
- Admin console web UI (phase-07) — WS-02/WS-04 only fix the backend auth and
  replace the hardcoded KYC queue data source.
- AI features beyond the foundation: question sets other than registration
  plumbing, Kisan Mitra 2.0 (M2), KYC AI triage (M11), calibration dashboards —
  later phases. WS-07 ships the gateway + two refactors only.
- Voice AI (retired, M27/C1/C19). Flutter apps (out of program scope).
- Weekly calibration job and "AI Health" page (phase-08 standing requirement).

## Exit gate (done when)

- [ ] Backend suite fully green — the 45 failing tests are fixed (`cd backend && .venv/bin/python -m pytest -q`).
- [ ] No demo backdoor reachable with `APP_ENV=prod` (MPIN 1234, `dev-`/`demo-` tokens, `/auth/quick-login`, Razorpay `"dev"` signature all rejected/absent); app refuses to start in prod without a real `jwt_secret`.
- [ ] Real Razorpay test order → webhook (signature-verified) → verify flow proven in staging.
- [ ] Entitlement middleware demonstrably blocks an over-limit request (429/402 with the standard error envelope).
- [ ] A KYC case flows `pending → verified` end-to-end in staging (wizard submit → queue → review → status page).
- [ ] `AI_PROVIDER=shim` full suite green; one live `decide()` against a staging key returns a valid `DecisionResult` and writes an `ai_decisions` doc with cost.
- [ ] Global verification gate (execution-plan/README.md §4) green.

## Estimated effort

Weeks 1–3 of the roadmap (robust.md §11, "Phase 0. Foundation, wks 1–3").
