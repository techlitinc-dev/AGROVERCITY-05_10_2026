# Phase 06 — Cross-Cutting Platform Services — Build Instructions

> Self-contained execution sheet. Read `execution-plan/phase-06/readme.md` first.
> Global rules (execution-plan/README.md §3) apply to every workstream —
> the ones most at risk are repeated inline per workstream.
> AI workstreams follow the SDR/SGR recipes (ai_implementation_plan.md §3):
> register the question set in `question_sets.py`, build pseudonymized state via
> `privacy.py`, call `gateway.decide()`/`gateway.generate()`, act per automation
> level (`suggest`/`require_confirm`/`auto` — new AI features always launch at
> `suggest`), fall back deterministically on exception/timeout/budget, register
> an outcome hook, and test golden-fixture-on-shim + gateway-raising-fallback +
> flag-off. Verification standard for every AI brief: `cd backend &&
> .venv/bin/python -m pytest -q` green, `cd website && pnpm build` green, feature
> fully works with `AI_PROVIDER=shim`. All model calls go through
> `backend/app/services/ai/gateway.py` (built in phase-00/M1) — never call
> OpenRouter/Gemini from routers; no phones/emails/unmasked Aadhaar in AI
> payloads; every AI call logged to `ai_decisions` with cost + confidence.

## Repo orientation

- Backend: FastAPI + Firestore — routers `backend/app/routers/`, services
  `backend/app/services/`, models `backend/app/models/`, scripts
  `backend/scripts/`, tests `backend/tests/`. All routers mount under `/v1`
  (`backend/app/main.py`). Existing endpoints relied on below:
  - Chat: `/v1/chat/rooms`, `/v1/chat/direct`, `/v1/chat/rooms/{id}/messages`,
    `/v1/chat/rooms/{id}/read` (`routers/chat.py`, prefix `/chat`).
  - Notifications: `routers/notifications.py` (prefix `/notifications`);
    senders `services/notifications.py` (`send_fcm_to_user` — currently publishes
    to FCM topic `user_{uid}`, comment says "token-based FCM lands Day 13") and
    `services/notify.py` (`notify_user`, trade inbox + topic ping).
  - Sync: `POST /v1/sync` replay(batch) (`routers/sync.py`, prefix `/sync`).
  - Consents: `GET/PUT /v1/users/me/consents` (`routers/users.py` +
    `services/consents.py` + `models/consents.py`).
  - Account deletion: `DELETE /v1/users/me` → `services/purge.py: purge_user`.
  - Report/block: `POST /v1/users/{user_id}/report` (`routers/users.py`),
    `services/blocks.py` (`blocked_pair`, `require_unblocked`).
  - Ratings: `POST /v1/ratings` (`routers/ratings.py`).
  - Support handoff: `POST /v1/chatbot/expert-handoff` writes `expert_tickets`
    and `users/{uid}/expert_tickets` (`routers/chatbot.py`).
  - Settlements/jobs: `routers/settlements.py`, `services/settlements.py`,
    `routers/jobs.py` (prefix `/jobs`); fraud inputs `services/referrals.py`,
    `routers/gamification.py`.
  - Analytics: `routers/analytics.py` (prefix `/analytics`) — extend, don't fork.
- Website: React + TS + Vite — API wrappers `website/src/lib/api/` (`chat.ts`,
  `notifications.ts` exist), views `website/src/views/` (existing:
  `trade/ChatRoomPage.tsx`, `trade/NotificationsPage.tsx`,
  `legal/LegalPage.tsx`), i18n `t()` in `website/src/lib/i18n/` with locales in
  `website/src/lib/i18n/locales/` (en.ts = 436 keys base; ta.ts = 85 keys;
  22 partial non-en/hi base locales + per-module `en.*`/`hi.*` pairs), registry
  `website/src/lib/dashboard.ts`, routes in `website/src/App.tsx`.
  `website/public/` is empty and there is no service worker/manifest yet;
  `package.json` has no locale-check script and no PWA plugin yet.
- Verify every path you cite exists (Glob/Read) before writing it down. Mark
  planned-new files "(new)".

## WS-01 — Chat hub + moderation pipeline + M6 guardrails

**Source:** robust.md §8.1 (X2), AI brief M6, ai.md A7/A12 · **Goal:** booking-gated chat rooms become a first-class, moderated hub in every persona's nav, with a regex fast-path, strike ladder, and Jev guardrail for evasive violations.

**Read first:** `backend/app/routers/chat.py`, `backend/app/services/chat.py`, `backend/app/routers/content.py`, `website/src/lib/api/chat.ts`, `website/src/views/trade/ChatRoomPage.tsx`, `website/src/lib/dashboard.ts`, `website/src/App.tsx`, `backend/app/services/ai/question_sets.py` (from phase-00).

Global rules at risk: **rule 4 — no phone numbers, UPI IDs, or external links in any chat surface (moderation regex + strike ladder)**; rule 6 — no English-only screens, strike notice `t()` en+hi; rule 7 — error envelope + pagination on new endpoints; rules 10/11 — Jev only via gateway, `suggest`-level launch, no contact data in AI payloads.

**Steps:**

1. Backend moderation module `backend/app/services/chat_moderation.py` (new):
   regex fast-path for Indian mobile numbers (`[6-9]\d{9}` with optional
   `+91`/space/dash separators), UPI handles (`[\w.\-]{2,}@[a-z]{2,}`), and
   URLs (`http(s)?://`, `www.`, bare-domain TLDs). Pure function
   `scan(text) -> {violation: bool, kind}` so it is unit-testable without
   Firestore.
2. Wire the fast-path into `POST /v1/chat/rooms/{room_id}/messages` in
   `routers/chat.py`: a violating message is rejected (or stored with
   `moderation: {flagged: true, kind}` and hidden from the counterparty —
   pick one behavior and document it), and a strike is recorded on
   `users/{uid}/chat_strikes` (new subcollection) with `{kind, messageId,
   roomId, createdAt}`. Strike ladder: strike 1 = warning notice, strike 2 =
   24h chat mute, strike 3 = chat suspension pending admin review. Enforce
   the mute/suspension in `post_message` before write.
3. Image messages: on upload, strip EXIF metadata server-side and run the OCR
   scan over extracted text through the same `scan()` fast-path (image OCR
   via `gateway.analyze_image()` only when the AI flag is on; with the flag
   off, EXIF strip still happens, OCR is skipped).
4. M6 — register `chat.guardrail.v1` in `question_sets.py` (registry §2:
   `shares_contact`/`shares_payment_handle`/`abuse` bools; threshold +
   fallback = "not a violation"). In the send path, call
   `gateway.decide(state, "chat.guardrail.v1", ctx)` **only** for messages
   that pass the regex but trip the cost-saving heuristic pre-filter:
   contains digits spelled out ("nine", "eight", Hindi numeral words), or
   "call", "upi", "whatsapp" in any script. Confirmed violations feed the
   same strike ladder from step 2. Log to `ai_decisions`.
5. Red-team golden fixture `backend/tests/fixtures/ai/golden/chat.guardrail.v1.jsonl`
   (new) with evasion samples of the "nine 8 two... call karna" class plus
   benign lookalikes (quantity mentions, "call the mandi office" without
   numbers). Shim answers must catch ≥90% of the evasive set with <5% false
   positives on the benign set.
6. Register `content.moderation.v1` (`flag` bool, `reason` choice) and apply
   it to UGC surfaces served by `routers/content.py` (news comments, live
   chat, reviews): flagged items go to a `moderation_queue` collection (new)
   with `{contentType, contentId, flag, reason, decisionId, status: open}`.
   Add a moderation queue read endpoint (admin-role gated) listing open items
   with cursor pagination — the phase-07 admin console will render it; for
   this phase a minimal JSON endpoint + simple admin list page suffices.
7. Website — Chats hub:
   a. New view `website/src/views/chat/ChatsHubPage.tsx` (new): room list from
      `GET /v1/chat/rooms` with unread badges (unread count per room; the
      backend `_room_view` already computes per-side state — extend it to
      include `unreadCount` if missing), sorted by last activity.
   b. Add "Chats" to every persona's nav in `website/src/lib/dashboard.ts`
      and the route in `website/src/App.tsx` (the two one-line edits per the
      §12 playbook), reusing `trade/ChatRoomPage.tsx` for the room view.
   c. Strike notice UI: when a send is rejected/muted, show the strike notice
      via `t()` keys (`chat.strikeWarning`, `chat.muted24h`,
      `chat.suspended`) in en + hi — never `alert()`.
   d. Extend `website/src/lib/api/chat.ts` with the new fields/endpoints.

**Acceptance:** red-team evasion set ≥90% caught in the golden test; benign false positives <5%; normal chat send latency regression <300ms with guardrail on; regex fast-path + strike ladder fully functional with the AI module flag off; unread badges live in all personas' nav; strike notice renders in en and hi.

**Verification:** `cd backend && .venv/bin/python -m pytest -q` (new tests: `tests/test_chat_moderation.py` (new) covering regex table, strike ladder transitions, golden evasion set on shim, flag-off path). `cd website && pnpm exec tsc --noEmit && pnpm build`. Manual: farmer↔vyapari booking chat — send "call me 98765 43210" → blocked + strike notice (hi locale); send evasive "nine 8 two... call karna" → caught with AI on, allowed-but-logged with AI off; open Chats hub from landlord persona nav → unread badge clears on read.

## WS-02 — Notifications platform + M7 intelligence

**Source:** robust.md §8.2 (X3/X4/G6), AI brief M7, ai.md A2/A3 · **Goal:** per-token FCM push with one-tap deep links into dashboard tasks, a preferences center, SMS fallback, and Jev/Gemini timing + copy in the dispatch path.

**Read first:** `backend/app/services/notifications.py`, `backend/app/services/notify.py`, `backend/app/services/fcm.py`, `backend/app/routers/notifications.py`, `backend/app/routers/users.py` (devices subcollection), phase-01 task engine (`/v1/tasks` deepLinks), `website/src/lib/api/notifications.ts`, `website/src/views/trade/NotificationsPage.tsx`.

Global rules at risk: rule 7 — standard envelope, cursor pagination, `Idempotency-Key` on writes; rule 6 — preferences center + notification copy `t()` en+hi; rules 10/11 — `notify.timing.v1`/`notify.copy.v1` via gateway, fallback = current templates + immediate send; **no notification may be lost when AI is disabled**.

**Steps:**

1. Per-token FCM (X4): replace the topic ping in
   `services/notifications.py: send_fcm_to_user` with
   `messaging.send_each_for_multicast` over the user's registered device
   tokens (`users/{uid}/devices` subcollection already exists — see
   `users.py` devices router). Prune tokens that return
   `registration-token-not-registered`. Keep the `notifications` inbox doc
   write exactly as today (web bell + inbox read from it).
2. Deep-link map (X3): every notification data payload carries `{type,
   deepLink}` where `deepLink` matches the task `deepLinks` emitted by the
   phase-01 task engine (e.g. `/dashboard?task=<id>` or the module route).
   One tap = push → open app → land on the dashboard task → complete the
   action. Update `services/notify.py: notify_user` to accept `deepLink`
   (it already takes `path` — align on one field name and migrate callers).
3. Website: register the Firebase web push service worker
   (`website/public/firebase-messaging-sw.js` (new)), request permission
   from the notifications settings UI, and POST the token to the existing
   devices endpoint. Clicking a push routes via `deepLink`; the inbox
   (`trade/NotificationsPage.tsx` pattern) opens `deepLink` on tap.
4. Preferences center (G6): new view
   `website/src/views/settings/NotificationPrefsPage.tsx` (new) backed by
   `GET/PUT /v1/notifications/preferences` (new endpoints): per-category
   toggles (tasks, trade, payments, social, marketing), channel toggles
   (push/SMS/in-app), quiet-hours override, and digest-mode opt-in. Store at
   `users/{uid}/notification_prefs/current`. Dispatch must filter by these
   prefs — marketing off means no marketing push, period.
5. SMS fallback: `backend/app/services/sms.py` (new) behind a provider
   interface `send_sms(phone, template_id, vars)` with two implementations:
   MSG91 and Twilio, selectable via env `SMS_PROVIDER=msg91|twilio|stub`
   (default `stub` which logs only — DLT template registration is pending,
   so the stub is the shipping default). DLT template IDs live in
   `platform_config/sms_templates` (Firestore, admin-editable).
6. M7 — register `notify.timing.v1` (`send_now` bool; `channel`
   choice(push/sms/digest/skip)) and `notify.copy.v1` (Gemini vernacular
   one-liner). In the dispatch path: `gateway.decide(state,
   "notify.timing.v1", ctx)` decides send/channel per notification —
   **hard constraint enforced in code, not the prompt: quiet hours
   21:00–06:30 local, only `urgent=True` notifications (payment failures,
   handover OTPs, dispute deadlines) send during quiet hours**; everything
   else queues for digest. `notify.copy.v1` via `gateway.generate()` produces
   the one-liner, cached per `(task_type, lang, day)` — never per page-view.
   Fallback on any failure: current static templates + immediate send.
7. Digest batcher: a `notifications_digest` queue collection drained by a
   `/v1/jobs` job that batches queued items into one digest push per user
   per window. Must demonstrably batch (3 queued events → 1 digest push).

**Acceptance:** push arrives per-token (not topic); tapping a push lands on the correct dashboard task; quiet hours suppress non-urgent sends; digest mode batches; hi copy renders correctly; with `AI_PROVIDER=shim` or the module flag off, every notification still delivers via template + immediate send; preferences toggles are honored.

**Verification:** pytest (new `tests/test_notifications_dispatch.py` (new): quiet-hours table, digest batching, pref filtering, AI-disabled delivery). `pnpm build` green. Manual: trigger a trade event → push on device → tap → dashboard task opens → complete action; set digest mode → fire 3 events → receive 1 digest; disable marketing → marketing event sends nothing.

## WS-03 — Trust & safety + M8 fraud & payout anomaly

**Source:** robust.md §8.3 (G9/X8/X9), AI brief M8, ai.md A6/A13 · **Goal:** report/block UI surfaces, ratings on every completed transaction, persona trust tiers, and AI batch scoring that holds — never auto-punishes — suspected fraud and anomalous payouts.

**Read first:** `backend/app/services/settlements.py`, `backend/app/routers/settlements.py`, `backend/app/routers/jobs.py`, `backend/app/services/referrals.py`, `backend/app/routers/gamification.py`, `backend/app/services/blocks.py`, `backend/app/routers/users.py` (report endpoint), `backend/app/routers/ratings.py`.

Global rules at risk: **rule 3 — every financial mutation writes `audit_logs`; money only via settlement rails; integer paisa**; rule 8 — no admin action without `audit_logs` + reason; rules 10/12 — M8 is `suggest`-level: **never auto-punish, holds are human-reviewed**.

**Steps:**

1. Report/block UI (X9): report + block buttons on profile/chat/deal
   surfaces (new component `website/src/components/ReportBlockMenu.tsx`
   (new)) calling `POST /v1/users/{user_id}/report` (exists) and a block
   endpoint under `users` (verify; `services/blocks.py` provides the logic —
   expose `POST/DELETE /v1/users/{user_id}/block` if missing). Blocked users
   are hidden from chat (`require_unblocked` already hooks direct chat) and
   from marketplace/deal listings — extend those queries.
2. Ratings (X8): `POST /v1/ratings` exists with provider-kind resolution.
   Inventory every completed transaction type (lot sale/purchase, transport
   delivery, equipment booking, land lease, dairy collection, course
   enrollment, contract delivery, marketplace order) and add a rate prompt
   on each completion surface on the website + the backend hook that opens
   the rating window on completion. Each rating writes `audit_logs`-style
   provenance (rater, ratee, transaction id, stars 1–5, optional text —
   text goes through WS-01 moderation scan).
3. Trust tiers per persona: compute from completed-transaction count,
   average rating, dispute rate, KYC status into tiers
   (`new / trusted / established / top`) stored on the user doc; display the
   tier badge in chat headers and deal surfaces (`t()` keys en+hi).
4. M8 — register `trust.fraud.v1` (`pattern`
   choice(circular_bidding/rate_collusion/referral_ring/coin_abuse/none);
   `risk` score) and `trust.payout_anomaly.v1` (`anomaly` bool; `severity`
   score).
5. Nightly fraud batch: new job (under `routers/jobs.py`, e.g.
   `POST /v1/jobs/fraud_scan`) that builds graph features per user/cluster —
   shared devices/accounts (device token hashes), circular trades (A→B→A
   lots/deals), referral rings (`services/referrals.py` graphs), coin abuse
   (`gamification` mint/burn velocity) — and calls `gateway.decide` per
   cluster. `risk > 0.8` → set `soft_hold` on the account's pending
   settlements/payouts + insert a `fraud_queue` doc (new collection) with
   `{userId, pattern, risk, decisionId, reason, status: open}`.
   **Never auto-punish: no bans, no forfeitures — only holds + queue.**
6. Payout anomaly: in the settlement run path
   (`services/settlements.py`), score each settlement line via
   `trust.payout_anomaly.v1`; anomalous lines are held for `finance_admin`
   review with the AI reason + `decision_id` attached to the line. Held
   lines never settle until a finance_admin releases/rejects them
   (release/reject writes `audit_logs` + reason; maker-checker > ₹10,000).
7. Minimal queue surfaces: admin-gated list endpoints
   (`GET /v1/admin/fraud-queue`, settlement holds list on the settlements
   router) + a plain admin page `website/src/views/admin/FraudQueuePage.tsx`
   (new) listing holds with reason/decision_id and release/reject actions.
   Full console styling is phase-07's job.
8. Test fixtures: seed a circular-bidding ring and a referral ring in test
   data (`backend/tests/`), plus a legitimate high-volume settlement batch.

**Acceptance:** seeded fraud ring is caught (risk > 0.8, soft_hold + queue entry); legitimate settlements settle unaffected; every hold carries AI reason + `decision_id`; fraud scan works with the flag off (heuristics only, no holds without score); report/block round-trips from the UI; every transaction type is rateable.

**Verification:** pytest (new `tests/test_trust_fraud.py` (new): ring detection on shim, legit-batch pass-through, hold provenance, flag-off mode). `pnpm build` green. Manual: complete a transport delivery → rate prompt → rating visible on transporter profile; report a user from chat → blocked from further contact; run `POST /v1/jobs/fraud_scan` against seeded data → queue page shows the ring with reason.

## WS-04 — Consent & privacy

**Source:** robust.md §8.4 (X17/F23/X18) · **Goal:** consent center UI over the existing consents backend, DPDP-compliant data export, verified web account deletion, localized legal pages.

**Read first:** `backend/app/routers/users.py` (`GET/PUT /v1/users/me/consents`, `DELETE /v1/users/me`), `backend/app/services/consents.py`, `backend/app/models/consents.py`, `backend/app/services/purge.py`, `website/src/views/legal/LegalPage.tsx`, `backend/tests/test_consents.py`, `backend/tests/test_account.py`.

Global rules at risk: rule 6 — legal pages and consent center `t()` en+hi (X18: currently English-only hardcoded); rule 1 — no dev backdoors in deletion/export paths; rule 8 — export/deletion events audit-logged.

**Steps:**

1. Consent center UI (X17): new view
   `website/src/views/settings/ConsentCenterPage.tsx` (new) reading/writing
   `GET/PUT /v1/users/me/consents` via a new `website/src/lib/api/consents.ts`
   (new) wrapper mirroring `models/consents.py` fields. Every consent toggle
   shows purpose text via `t()` in en + hi. Route + nav entry under settings.
2. DPDP data export (F23): new endpoint
   `POST /v1/users/me/data-export` (new, in `routers/users.py` or a new
   `routers/privacy.py` (new)) that asynchronously assembles the user's data
   (profile, personas, transactions, diaries, consents, notifications,
   chats metadata) into a JSON archive, stores it via `services/storage.py`,
   and notifies the user with a download link (deep link per WS-02 map).
   `GET /v1/users/me/data-export/latest` returns the link/status. Writes an
   `audit_logs` entry. Rate-limit to 1 export/day.
3. Account deletion web flow: `DELETE /v1/users/me` + `purge_user` exist.
   Build the website flow (settings → danger zone → MPIN/password re-auth →
   confirm screen with consequences in en+hi → delete → logged-out landing).
   Verify end-to-end that `purge_user` actually purges/anonymizes
   subcollections (test_account.py is the starting point — extend coverage
   if gaps appear); fix any gap found rather than documenting around it.
4. Localized legal pages (X18): `legal/LegalPage.tsx` is English-only
   hardcoded — move all copy (terms, privacy policy, refund policy as
   present) into `t()` keys with en + hi at minimum; other locales fall
   through to en per the i18n index. No hardcoded strings remain.

**Acceptance:** consent toggles persist and are reflected in `require_data_sharing`-gated flows; export produces a complete archive download; deletion works end-to-end from the browser with data purged; legal pages render fully in hi with zero hardcoded English strings.

**Verification:** pytest (extend `tests/test_consents.py`, `tests/test_account.py`; new export test). `pnpm build` green. Manual: toggle data-sharing consent off → gated feature refuses; request export → receive notification → download archive → spot-check contents; delete a throwaway account from the website → re-login impossible, data purged.

## WS-05 — Support + M30 AI support agent

**Source:** robust.md §8.5 (F20), AI brief M30, ai.md C13 · **Goal:** help center with FAQ CMS and expert_tickets as in-app support threads, plus an AI agent that answers app-help from the FAQ corpus with citations and always escalates money/account issues.

**Read first:** `backend/app/routers/chatbot.py` (`POST /v1/chatbot/expert-handoff`, `expert_tickets` flow), `backend/app/services/chatbot.py`, help-center content (`website/src/views/legal/`, FAQ/legal copy), `backend/app/services/ai/question_sets.py`.

Global rules at risk: rules 10/11/12 — answers only from retrieved FAQ sources, `suggest` level, **no invented policy (answers must cite source doc ids)**; **money/account questions always escalate to a human**; rule 6 — support UI `t()` en+hi.

**Steps:**

1. Shared embedding helper first: the FAQ retrieval index reuses the
   embedding infrastructure from WS-08 (step 3: `services/search_index.py`
   using `gateway.embed()` with `AI_GEMINI_EMBED_MODEL=gemini-embedding-001`).
   If WS-08 has not landed yet, implement the shared helper as step 1 here
   and let WS-08 build on it.
2. FAQ CMS: new collection `faq_articles` `{id, category, lang, title, body,
   status}` with admin-gated CRUD endpoints (new `routers/faq.py` (new) —
   minimal; phase-07 restyles). Seed from existing legal/help copy.
3. Help center UI: new view `website/src/views/support/HelpCenterPage.tsx`
   (new): FAQ browse/search (keyword over `faq_articles`), support thread
   list, and thread detail. API wrapper `website/src/lib/api/support.ts` (new).
4. Support threads (F20): surface `expert_tickets` as in-app support
   threads — `GET /v1/chatbot/expert-tickets` list endpoint (new if missing)
   + per-ticket message thread so users see handoff status and agent replies
   in-app instead of a fire-and-forget form.
5. M30 — register `support.intent.v1` (`resolvable` bool; `category` choice;
   `escalate` bool). Help-center chat flow: user question →
   `gateway.decide(state, "support.intent.v1", ctx)` → if `escalate` or
   category ∈ {money, account} → create human ticket immediately (reuse the
   expert-handoff write path); if resolvable app-help → embed the question,
   cosine-retrieve top FAQ articles, `gateway.generate()` an answer grounded
   in the retrieved articles, and **render the answer with its source
   `faq_articles` doc ids cited in the UI**. If retrieval confidence is low
   → escalate. Shim returns canned intent + fixed retrieval so the whole
   flow works with `AI_PROVIDER=shim`.
6. Instrumentation: log resolution vs escalation per conversation to measure
   resolution rate; every AI answer logged to `ai_decisions` with cost.

**Acceptance:** resolution rate is measured (metric emitted, WS-09 schema); money/account questions escalate 100% of the time in tests; no answer renders without ≥1 cited source doc id; support threads show handoff status end-to-end; full flow works on shim.

**Verification:** pytest (new `tests/test_support_agent.py` (new): intent routing table, money-escalation invariant, citation-required assertion, shim golden). `pnpm build` green. Manual: ask "how do I add a plot?" → cited answer; ask "where is my payment?" → human ticket created → reply visible in the support thread.

## WS-06 — PWA & offline

**Source:** robust.md §8.6 (G7/X20) · **Goal:** installable PWA with offline form drafts synced via the existing `/v1/sync`, and a first-load bundle under 400 KB.

**Read first:** `website/vite.config.ts`, `website/index.html`, `website/src/main.tsx`, `website/src/App.tsx`, `website/package.json`, `backend/app/routers/sync.py`, `website/src/lib/api/client.ts`.

Global rules at risk: rule 7 — **`Idempotency-Key` on every replayed write**; rule 6 — offline UI states `t()` en+hi; rule 1 — no demo fallbacks in sync logic.

**Steps:**

1. PWA shell: add `vite-plugin-pwa` (new devDependency — the project has no
   PWA plugin today), generate `manifest.webmanifest` (name AGROVERCITY,
   icons, `display: standalone`, theme color) and a service worker with:
   app-shell precache, runtime cache for `GET /v1/reference/*` and locale
   files, network-first for API GETs, **never cache writes**. App must pass
   installability (manifest + SW + HTTPS) — verify with Lighthouse/install
   prompt.
2. Offline drafts (X20): a small outbox store
   (`website/src/lib/offline/outbox.ts` (new), localStorage/IndexedDB) that
   form screens opt into: on submit while offline (or on network failure),
   queue the mutation as a sync batch item with a client-generated
   `Idempotency-Key`; a connectivity listener replays the outbox through
   `POST /v1/sync` (existing replay endpoint — verify its batch item shape
   in `routers/sync.py` and conform to it; extend it if a mutation type is
   missing). UI shows pending-sync state on drafted forms and a sync
   success/failure toast (`toast.ts`).
3. Wire at least the farm-diary entry form and one profile form as the
   reference implementations; document the 3-line opt-in pattern for other
   forms.
4. Bundle diet: convert top-level persona/module routes in `App.tsx` to
   `React.lazy` + `Suspense` route-level code splitting; measure first-load
   JS (gzip) with `pnpm build` output; target **<400 KB first load**. Move
   heavy deps (maps, charts) behind lazy boundaries.

**Acceptance:** app installs as a PWA (install prompt, standalone launch); a form drafted with network off appears in the outbox and syncs exactly once (server-side idempotency) when reconnected; first-load JS <400 KB; build passes.

**Verification:** `pnpm exec tsc --noEmit && pnpm build` (record bundle sizes in the PR description). Backend pytest green (any `/sync` changes). Manual: DevTools offline → create diary draft → go online → draft synced, no duplicate on double-replay; install prompt fires on Chrome/Android; Lighthouse PWA check passes.

## WS-07 — i18n completion + M32 localization pipeline

**Source:** robust.md §8.7 (G8), AI brief M32, ai.md C15 · **Goal:** finish the 28 partial locales via a Gemini-assisted pipeline with human approval, and lock quality in with a CI parity gate that counts approved keys only.

**Read first:** `website/src/lib/i18n/index.ts`, `website/src/lib/i18n/locales/en.ts` (436-key base), `website/src/lib/i18n/locales/ta.ts` (85 keys — partial port noted in its header), `website/package.json`, `backend/scripts/` (seed-script patterns).

Global rules at risk: **rule 6 — no English-only screens; every new view ships en+hi pairs**; rule 10 — Gemini only via gateway/script config, CI never calls paid APIs; glossary terms must never be translated.

**Steps:**

1. Parity tooling: `website/scripts/check_locales.mjs` (new) that diffs every
   locale + module pair against the en base and reports missing/extra keys;
   wire as `pnpm locales:check` and add to CI. **The gate counts only
   approved keys** (see step 4) — `ai-draft` keys do not satisfy parity.
2. Module locale pairs: audit every view shipped in this phase (chat hub,
   prefs center, consent center, help center, support, queues) and add
   `en.*`/`hi.*` pairs per the existing `en.trade.ts`/`hi.trade.ts` pattern.
3. M32 — `backend/scripts/translate_locales.py` (new): diffs missing keys
   per locale → batches to Gemini (`AI_GEMINI_MODEL`) with a **locked agri
   glossary** (mandi, khasra, 7/12, FPO, PMFBY, brand name AGROVERCITY, and
   the full list in the script's `GLOSSARY` constant) passed as
   do-not-translate terms → writes draft locale files flagged `ai-draft`
   (e.g. `ta.draft.ts` or a `__draft__` marker convention — pick one,
   document it in the script docstring). Drafts are excluded from the build
   until approved.
4. Review & approval: a simple admin page
   `website/src/views/admin/LocaleReviewPage.tsx` (new) listing draft keys
   side-by-side (en source vs draft) with approve/reject per key; approvals
   persist (small backend endpoint + `locale_approvals` collection (new) or
   a reviewed-file mechanism — keep it simple and recorded). Approving
   promotes the key into the real locale file. Approval workflow is
   audit-recorded (who, when, key).
5. CI gate: `pnpm locales:check` fails the build when any locale regresses
   below its approved-key baseline or when en/hi parity breaks.

**Acceptance:** `ta` goes 85 → 436 keys as drafts, and 436/436 as approved keys after review; glossary terms (mandi, khasra, 7/12…) appear untranslated in every draft; approval actions recorded; `pnpm build` passes with unapproved drafts excluded; the CI gate demonstrably fails on an injected missing-key regression.

**Verification:** `pnpm locales:check` output before/after; `pnpm build` green; backend pytest green (approval endpoints). Manual: run `translate_locales.py` for `ta` → draft file appears → approve keys in the review UI → parity check passes with ta complete; remove an approved key → CI gate fails.

## WS-08 — Search embeddings upgrade (M23)

**Source:** AI brief M23, ai.md A11, robust.md §7.24 · **Goal:** `GET /v1/search` routes intent via Jev and merges `gemini-embedding-001` semantic matches over the phase-05 keyword search.

**Read first:** `backend/app/routers/schemes.py`, `backend/app/routers/courses.py`, `backend/app/routers/content.py`, `backend/app/routers/marketplace.py`, `backend/app/routers/lots.py`, the phase-05 keyword search implementation (locate it first — router/service), `backend/app/services/ai/question_sets.py`.

Global rules at risk: rules 10/11 — embed/decide only via gateway, shim returns keyword-only; rule 7 — cursor pagination on search results; rule 6 — results page `t()` en+hi.

**Steps:**

1. Locate the phase-05 keyword search (`routers/` + `services/`; if phase-05
   is still in flight, this workstream delivers the merged endpoint and the
   keyword fallback itself). New `backend/app/routers/search.py` (new) with
   `GET /v1/search?q=...&cursor=...`, standard envelope + pagination.
2. Register `search.intent.v1` (`index`
   choice(schemes/products/news/crops/courses/lots)). On query:
   `gateway.decide(state, "search.intent.v1", ctx)` → targeted queries
   against the chosen index(es); fallback = query all indexes by keyword.
3. Embedding index: `backend/app/services/search_index.py` (new) — embed
   scheme/course/news documents via `gateway.embed()`
   (`AI_GEMINI_EMBED_MODEL=gemini-embedding-001`), store vectors in a
   Firestore vector field (or Redis if already present — check
   `backend/app/core/`), cosine-match the query embedding, and merge with
   keyword hits (keyword score + cosine score, keyword wins ties). This is
   the shared helper WS-05 reuses for FAQ retrieval.
4. Index rebuild job: `POST /v1/jobs/search_reindex` (new, in
   `routers/jobs.py`) re-embeds changed documents; idempotent and resumable.
5. Website: results page `website/src/views/search/SearchResultsPage.tsx`
   (new) grouped by module (mandi/lots, schemes, courses, news, products)
   with each group deep-linking into the module; wire the global search box
   from the all-tools launcher (§7.24) to it. API wrapper
   `website/src/lib/api/search.ts` (new).

**Acceptance:** "pyaz ka bhav" returns mandi/lots results first; "PM-Kisan" returns schemes first; index rebuild job completes and updates vectors; with `AI_PROVIDER=shim` the endpoint returns keyword-only results and nothing breaks; results page groups by module and deep-links.

**Verification:** pytest (new `tests/test_search.py` (new): intent routing on shim, keyword-only shim mode, reindex idempotency, merge ordering fixture). `pnpm build` green. Manual: search the three queries above from the launcher; run the reindex job; edit a scheme doc → reindex → new text findable semantically.

## WS-09 — Analytics taxonomy (X13)

**Source:** robust.md §8.8 (X13) · **Goal:** one event schema fired from the website, feeding a north-star metrics dashboard.

**Read first:** `backend/app/routers/analytics.py`, `backend/tests/test_analytics.py`, `website/src/lib/api/client.ts`, `website/src/views/dashboard/`.

Global rules at risk: rule 7 — envelope + idempotent ingest (events carry a client event id); rule 11 — no PII beyond user id in events; rule 6 — dashboard `t()` en+hi.

**Steps:**

1. Event schema (one schema, no per-module forks): `analytics_events`
   collection, `{eventId, userId, persona, name, props (flat map),
   sessionId, clientTs, serverTs}`. Canonical names:
   `screen_view`, `task_shown`, `task_clicked`, `task_completed`,
   `notification_sent`, `notification_opened`, `deep_link_completed`,
   `transaction_completed` (with `gmv_paisa`, `take_rate_paisa` — integer
   paisa, rule 3), `plan_upgraded`, `support_resolved`,
   `support_escalated`.
2. Ingest: `POST /v1/analytics/events` (new or extend `routers/analytics.py`)
   accepting a batch with `Idempotency-Key`; dedupe on `eventId`.
3. Website emitter: `website/src/lib/analytics.ts` (new) — tiny queued
   beacon (flush on interval + page hide), wired into: route changes
   (`App.tsx`), dashboard task render/click/complete (phase-01 Action
   Center), notification open + deep-link completion (WS-02), transaction
   completions (server-side emit is acceptable for money events — never
   trust the client for GMV), plan upgrades, support outcomes (WS-05).
4. North-star dashboard: backend aggregation endpoints + admin-facing page
   `website/src/views/admin/MetricsPage.tsx` (new) rendering: weekly
   transacting farmers, GMV per marketplace, take-rate revenue, paid-plan
   conversion, tasks-completed-per-user-per-week, notification deep-link
   completion rate. Aggregations run over `analytics_events` (+ settlement
   ledger for money truth).

**Acceptance:** all six north-star metrics render from real ingested events (seeded in tests/staging); duplicate event ids dedupe; deep-link completion rate is computable end-to-end (sent → opened → deep_link_completed); no PII in `props`.

**Verification:** pytest (new `tests/test_analytics_events.py` (new): ingest dedupe, aggregation correctness on seeded events). `pnpm build` green. Manual: complete a task from a push deep link → MetricsPage deep-link completion rate moves; upgrade a plan in staging → paid-plan conversion moves.

## Phase-final verification

```bash
cd backend && .venv/bin/python -m pytest -q          # fully green (incl. all new tests)
cd website && pnpm exec tsc --noEmit && pnpm build   # clean; first-load JS <400 KB
cd website && pnpm locales:check                     # parity gate green on approved keys
AI_PROVIDER=shim .venv/bin/python -m pytest -q       # full suite green on shim (from backend/)
```

Manual sweep (one flow per workstream, from dashboard task deep-link where applicable):

1. WS-01: booking chat → regex violation blocked + strike notice (hi) → evasive message caught with AI on → Chats hub unread badge in a second persona.
2. WS-02: push → tap → dashboard task → action completed; digest batches 3→1; quiet-hours hold at 22:00; AI off → still delivered.
3. WS-03: run fraud scan on seeded ring → hold with reason + decision_id → finance_admin releases with audit_logs reason; legit settlement batch settles.
4. WS-04: consent toggle persists → export downloads → delete account from website → purged.
5. WS-05: cited FAQ answer; money question → human ticket → thread reply visible.
6. WS-06: install PWA; offline draft → reconnect → synced once; Lighthouse PWA pass.
7. WS-07: ta approved-complete; inject a missing key → CI gate fails → revert → green.
8. WS-08: "pyaz ka bhav" → mandi/lots first; shim → keyword-only.
9. WS-09: all six north-star metrics render; deep-link completion rate reflects the WS-02 manual run.

No "coming soon" reachable from any surface touched by this phase.
