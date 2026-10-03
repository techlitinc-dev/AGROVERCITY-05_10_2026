# Phase 06 — Cross-Cutting Platform Services

> Build the shared services every persona app depends on: a moderated chat hub,
> a per-token push/SMS notification platform with deep links and AI timing/copy,
> trust & safety (report/block UI, ratings everywhere, fraud + payout-anomaly
> queues), consent & privacy (consent center, DPDP export, verified account
> deletion, localized legal), an in-app support system with an AI agent that
> cites its sources, an installable offline-capable PWA, i18n completion of the
> 28 partial locales behind a CI parity gate with a Gemini-assisted localization
> pipeline, semantic search over the phase-05 keyword search, and a single
> analytics taxonomy feeding a north-star metrics dashboard.
> Sources: `missing-features/robust.md` §8 items 1–8 (item 9 B2B API is
> phase-08), §11 phase 4; `missing-features/ai.md` §4.1 (A2, A3, A6, A7, A11,
> A12, A13), §4.3 (C13, C15); `missing-features/ai_implementation_plan.md`
> briefs M6, M7, M8, M23, M30, M32 (+ recipes §3, registry §2).

## Depends on

- **phase-01** — the task engine (`/v1/tasks`) and its per-task `deepLinks`
  map: notification deep links (WS-02) and the push→dashboard→action loop hang
  off it, and chat rooms are surfaced from booking/deal tasks (WS-01).
- Inherited from **phase-00** (already landed, not re-built here): AI gateway
  `backend/app/services/ai/` (M1), `audit_logs`, standard error envelope,
  `Idempotency-Key` write support, money rails used by the M8 settlement hooks.

## Workstreams

| WS | Title | Source | Output (what exists when done) |
|---|---|---|---|
| WS-01 | Chat hub + moderation + M6 guardrails | robust §8.1 (X2), brief M6, ai.md A7/A12 | Chats hub in every persona nav with unread badges; phone/UPI/URL regex fast-path + strike ladder + strike notice UI (en/hi); image OCR/EXIF strip; `chat.guardrail.v1` behind a cost-saving pre-filter; `content.moderation.v1` UGC queue |
| WS-02 | Notifications platform + M7 intelligence | robust §8.2 (X3/X4/G6), brief M7, ai.md A2/A3 | Per-token FCM (topic pings retired); deep-link map wired to task deepLinks; preferences center; MSG91/Twilio SMS stub with DLT templates; `notify.timing.v1` (quiet hours 21:00–06:30) + `notify.copy.v1` cached vernacular one-liners |
| WS-03 | Trust & safety + M8 fraud/payout anomaly | robust §8.3 (G9/X8/X9), brief M8, ai.md A6/A13 | Report/block UI surfaces; ratings on every completed transaction type; trust tiers per persona; nightly `trust.fraud.v1` batch → soft_hold + admin queue; `trust.payout_anomaly.v1` holds anomalous settlement lines for finance_admin |
| WS-04 | Consent & privacy | robust §8.4 (X17/F23/X18) | Consent center UI over existing consents API; DPDP data export; web account-deletion flow verified end-to-end; legal pages localized via `t()` |
| WS-05 | Support + M30 AI support agent | robust §8.5 (F20), brief M30, ai.md C13 | Help center + FAQ CMS; expert_tickets surfaced as in-app support threads; `support.intent.v1` answers app-help from FAQ embeddings citing source doc ids; money/account always escalates |
| WS-06 | PWA & offline | robust §8.6 (G7/X20) | Service worker + manifest, installable; offline form drafts synced via `/v1/sync` with `Idempotency-Key`; route-level `React.lazy`, first load <400 KB |
| WS-07 | i18n completion + M32 localization pipeline | robust §8.7 (G8), brief M32, ai.md C15 | 28 partial locales completed as AI drafts; locked agri glossary; admin review/approval UI; CI parity gate counting approved keys only |
| WS-08 | Search embeddings upgrade | brief M23, ai.md A11, robust §7.24 | `GET /v1/search` with `search.intent.v1` routing + `gemini-embedding-001` cosine merge over keyword search; index rebuild job; grouped results page |
| WS-09 | Analytics taxonomy | robust §8.8 (X13) | One event schema fired from the website; north-star dashboard (weekly transacting farmers, GMV, take-rate, paid conversion, tasks/user/week, deep-link completion) |

Internal ordering note: WS-05's FAQ retrieval reuses the embedding helper built
in WS-08 — land the shared index helper first (see WS-05 step 1). WS-07's CI
parity gate is part of the global gate for every later phase.

## Out of scope

- B2B API platform (robust §8.9, G11) — explicitly phase-08.
- Full admin console build (phase-07). This phase adds only the minimal queue
  surfaces/endpoints (moderation, fraud holds, locale approval) that the
  phase-07 console will consume and restyle.
- WhatsApp companion bot (C18) — post-DLT, not in this program phase.
- Flutter apps (`apps/mobile`, `apps/admin`, `flutter-prototype`) — website only.
- Voice/STT/TTS — descoped program-wide (M27, C1/C19 retired).

## Exit gate (done when)

- [ ] Red-team chat-evasion set ("nine 8 two... call karna" class) ≥90% caught in golden test; regex-only mode works with the AI flag off; chat latency regression <300ms
- [ ] Digest mode demonstrably batches notifications; vernacular copy renders in hi; zero notifications lost with `AI_PROVIDER=shim` / AI disabled
- [ ] Seeded fraud ring in test data is caught by `trust.fraud.v1`; legitimate settlements unaffected; every hold carries AI reason + `decision_id`
- [ ] Consent center toggles persist; DPDP export downloads a complete user archive; account deletion works end-to-end from the website
- [ ] Support agent answers app-help questions citing FAQ source doc ids; money/account questions always escalate to a human ticket
- [ ] App installs as a PWA; offline form draft created with network off syncs via `/v1/sync` when reconnected; first-load bundle <400 KB
- [ ] `ta` locale reaches 436/436 keys as approved; glossary terms (mandi, khasra, 7/12…) never translated; CI parity gate fails the build on a regression
- [ ] "pyaz ka bhav" returns mandi/lots results first; search index rebuild job runs; shim mode returns keyword-only results
- [ ] North-star dashboard renders all six metrics from real `analytics_events`
- [ ] Global verification gate (execution-plan/README.md §4) green — `cd backend && .venv/bin/python -m pytest -q`; `cd website && pnpm exec tsc --noEmit && pnpm build`; full suite green with `AI_PROVIDER=shim`; one manual end-to-end flow per workstream from dashboard task deep-link to completion

## Estimated effort

Weeks 10–16, parallel with phases 02–05 and 07 (robust.md §11 phase 4).
Nine workstreams; WS-01/02/03 are the heaviest (backend + AI + UI).
