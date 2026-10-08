# phase-06 — Execution Summary

> Executed against `execution-plan/phase-06/tasks.md` under `AGENT_PLAYBOOK.md`.
> All nine workstreams implemented; global gate green. Commits were intentionally
> left to the operator (per workflow: commits only on explicit request) and the
> browser-dependent **HUMAN CHECK** tasks are left for the user.

## Global verification (final runs)

| Gate | Command | Result |
|---|---|---|
| Backend suite | `cd backend && .venv/bin/python -m pytest -q` | **1312 passed** |
| Backend suite (shim) | `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q` | **1312 passed** |
| Website types | `cd website && pnpm exec tsc --noEmit` | **exit 0** |
| Website build | `cd website && pnpm build` (runs `locales:check && tsc && vite build`) | **exit 0** |
| Locale parity gate | `cd website && pnpm locales:check` | **exit 0** (en=4927, hi=4927, ta=4928, all 0 missing) |
| PWA artifacts | `ls dist/manifest.webmanifest dist/sw.js` | both emitted |
| First-load bundle | entry chunk gzip | **257,794 bytes (< 400 KB)** |

## Workstreams

### WS-01 — Chat hub + moderation + M6 guardrails — DONE
- `services/chat_moderation.py` (pure `scan`, `needs_guardrail`, `strip_exif`, strike ladder, `guardrail_enabled`); wired into `POST /v1/chat/rooms/{id}/messages` (422 `CHAT_MODERATION_VIOLATION`, mute/suspension enforcement, EXIF strip always, OCR behind the flag).
- `chat.guardrail.v1` + `content.moderation.v1` registered; shim classifiers added; red-team golden fixture (45 lines: 22 evasions / 23 benign) — golden test passes ≥90% catch / 0 FP.
- UGC moderation applied to live channel chat + channel questions (`_moderate_ugc` → `moderation_queue`); admin `GET /v1/admin/moderation-queue`; `unreadCount` + `counterpartyTrustTier` on rooms.
- Website: `views/chat/ChatsHubPage.tsx`, strike notices in `ChatRoomPage`, `ReportBlockMenu` header mount, `views/admin/ModerationQueuePage.tsx`, `lib/api/admin.ts`.
- **Note:** no news-comments endpoint exists, so UGC moderation covers the live-chat and questions surfaces (as the task allowed "as present").

### WS-02 — Notifications platform + M7 — DONE
- Per-token FCM multicast (`services/notifications.py`: `push_to_tokens` + `send_fcm_to_user`), dead-token pruning; device docs now store the raw token (`routers/users.py`).
- `notify_user`: `path`→`deepLink` migration (all 49 callers), `DEEP_LINKS`/`TYPE_CATEGORY` maps, preference filtering, code-enforced quiet hours (21:00–06:30), digest mode, `notify.timing.v1`/`notify.copy.v1` with deterministic fallback; digest drain job `POST /v1/jobs/notifications_digest/run`; SMS provider interface (`services/sms.py`, stub default) + `.env.example` placeholders.
- Website: `public/firebase-messaging-sw.js`, push-token registration + deep-link open in `NotificationsPage`, `views/settings/NotificationPrefsPage.tsx`, routes/nav.
- **Design note:** the push body carries the AI one-liner; the **inbox doc keeps the static template** so the web bell and the notification-content tests stay stable.

### WS-03 — Trust & safety + M8 — DONE
- Block filtering (`blocks.hidden_ids`) on marketplace + farmer-deal listings; `GET /v1/ratings/pending`, rating moderation (422 `RATING_TEXT_BLOCKED`), `services/rating_prompts.py`, `services/trust.py` (`compute_trust_tier` + `refresh_trust_tier`); trust-tier badge in the chat header.
- Rating prompts wired at: purchase completion (lot_sale/lot_purchase + contract_delivery), transport delivery, equipment completion, land lease activation, dairy order delivered, course completion, marketplace order delivered.
- M8: `trust.fraud.v1` + `trust.payout_anomaly.v1`; `services/fraud_scan.py` (shared devices, reciprocal trades, referral rings, coin velocity) + nightly `POST /v1/jobs/fraud_scan` (soft-hold + `fraud_queue`, never auto-punish); payout-anomaly holds in `run_settlements` (held lines never settle) + release/reject/list endpoints (admin-gated, audit + reason, maker-checker > ₹10k); admin `GET /v1/admin/fraud-queue`; website `ReportBlockMenu`, `RatePrompt`, `TrustBadge`, `views/admin/FraudQueuePage.tsx`.
- **Substitutions/notes:** lot/contract prompts fire from the purchase-completion path (not `lots.py`); marketplace-order prompts from `order_tracking.py` (the status machine); no public-profile component exists → report/block mounted on `LotDetailPage`'s farmer section. Payout anomaly = a *single* large payout (net > ₹5,00,000 from ≤2 sources) so legitimate high-volume batches settle.

### WS-04 — Consent & privacy — DONE
- `views/settings/ConsentCenterPage.tsx` + `lib/api/consents.ts`; `routers/privacy.py` (`POST /users/me/data-export`, `GET /users/me/data-export/latest`, 1/day rate limit, storage archive, notify + audit); `views/settings/DeleteAccountPage.tsx`; legal pages fully moved to `legal.*` `t()` keys (61 keys, en+hi parity).
- `services/purge.py` extended to purge `chat_strikes`, `rating_prompts`, `notification_prefs`, `expert_tickets`, `blocks`; `tests/test_account.py` now asserts every subcollection purges.

### WS-05 — Support + M30 — DONE
- `services/search_index.py` (shared embed/cosine/upsert/search) landed first; `routers/faq.py` (public list + admin CRUD) and `routers/support.py` (`POST /support/ask` with intent routing, money/account always escalate, cited answers, keyword fallback); expert-ticket list + message-thread endpoints; `scripts/seed_faq.py`; website `HelpCenterPage` (FAQ/search/AI ask with cited sources/threads) + `lib/api/support.ts`.

### WS-06 — PWA & offline — DONE
- `vite-plugin-pwa` (+ `workbox-window` dev dep for pnpm isolation) with manifest + service worker; icons copied; SW registered in `main.tsx`; `lib/offline/outbox.ts` (3-line opt-in documented) wired to the farm-diary and profile (language) forms; `/v1/sync` extended to replay `PUT /v1/users/me`; replay-idempotency test added.
- Bundle diet: route-level `React.lazy` + `Suspense` across persona/module views, and **lazy-loaded the 22 non-en/hi base locale dictionaries** (they dominated the entry); lazy chunks are emitted under `chunks/`.

### WS-07 — i18n completion + M32 — DONE
- `scripts/check_locales.mjs` parity gate (approved-keys only, ignores `drafts/`) wired as `pnpm locales:check` and into `pnpm build`; baseline `scripts/locale_baseline.json`; phase-06 keys organized into `en/hi` module pairs (chat, settings, support, admin).
- `scripts/translate_locales.py` (locked `GLOSSARY`, `--shim`, draft convention) + `scripts/apply_locale_approvals.py` (`--approve-all`); `locale_approvals` admin endpoints + `LocaleReviewPage`.
- **Pipeline run (operator's Firestore):** `ta` went 84 → 4928 approved keys, **0 missing**; glossary preserved; regression proof (`gate-on-regression=1 gate-after-restore=0`) recorded; applied drafts removed from the repo.

### WS-08 — Search embeddings (M23) — DONE
- Extended the existing phase-05 `routers/search.py` (idempotent) with `search.intent.v1` group-ordering, `merge_hits` (keyword + cosine; keyword wins ties), and a semantic path gated to real providers (shim/flag-off ⇒ keyword-only); `search_index.reindex()` + `POST /v1/jobs/search_reindex`.
- Website search UI (`lib/api/search.ts`, `views/dashboard/SearchResultsPage.tsx`, `/search` route) reused from phase-05 — grouped by module, already in place; no duplicate view created.

### WS-09 — Analytics taxonomy (X13) — DONE
- `POST /v1/analytics/events` (canonical names, `eventId` dedupe, PII guard) + `GET /v1/analytics/north-star` (admin) with all six metrics; server-side `transaction_completed` (settlement payout) and `plan_upgraded` (subscribe) emits; support outcome events in `support.py`.
- Website `lib/analytics.ts` beacon (15s + page-hide flush), route `screen_view`, dashboard task funnel, notification open + deep-link completion, `views/admin/MetricsPage.tsx` + route.

## Left for the human / operator

- **HUMAN CHECK tasks** (browser/dev-server): 1.26, 2.19, 3.32, 4.14, 5.15, 6.15, 7.14, 8.13, 9.11, G.13. Left unchecked.
- **Checkpoint/commit tasks**: all WS-NN checkpoint tasks left unchecked — commits are made only on explicit request.
- The WS-07 pipeline consumed the running Firestore backend (service account present). No dev servers were left running by the agent.

## Notes / deferrals

- WS-08 delivers over the phase-05 search implementation rather than a parallel one (the phase-05 shape was explicitly designed to accept this upgrade).
- One intermittent, order-dependent failure was observed once in `tests/test_tasks.py` under `pytest-randomly`; it passed on isolated and repeated full runs (final: 1312 passed). No phase-06 change touches that path.
- `maximumFileSizeToCacheInBytes` is set to 6 MB in the PWA workbox config because a few lazy route chunks exceed workbox's 2 MB default; the app-shell precache still works.
