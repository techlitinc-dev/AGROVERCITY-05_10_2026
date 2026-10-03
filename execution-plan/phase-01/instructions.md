# Phase 01 — Universal Action Dashboard + Conversational AI — Build Instructions

> Self-contained execution sheet. Read `execution-plan/phase-01/readme.md` first.
> Global rules (execution-plan/README.md §3) apply to every workstream —
> the ones most at risk of violation are repeated inline per workstream.
> Verification standard for the whole phase (AI briefs §5.0):
> `cd backend && .venv/bin/python -m pytest -q` green,
> `cd website && pnpm exec tsc --noEmit && pnpm build` green, and every feature
> works with `AI_PROVIDER=shim`.

## Repo orientation

- Backend: FastAPI + Firestore — routers `backend/app/routers/`, services
  `backend/app/services/`, tests `backend/tests/`. Routers are mounted in
  `backend/app/main.py` with `prefix="/v1"`; the existing error-envelope shape
  is `HTTPException(detail={"code","message","fieldErrors"})` (see
  `routers/intelligence.py:_error`).
- Existing, verified: `routers/intelligence.py` (`GET /v1/intelligence`, line
  423), `routers/chatbot.py` (`POST /v1/chatbot/messages`, `GET
  /v1/chatbot/history`, `POST /v1/chatbot/expert-handoff` → writes
  `expert_tickets`, `GET /v1/chatbot/experts`), `services/chatbot.py` (Gemini
  direct, Kisan Mitra prompt), `services/rent_reminders.py` +
  `routers/jobs.py` (`POST /jobs/rent-reminders/run`, `X-Cron-Secret` header).
  All module routers cited in WS-05 exist in `backend/app/routers/`.
- **Not yet existing** (phase-00 deliverables, required by WS-03/WS-04):
  `backend/app/services/ai/` (gateway, question_sets, shim, budget, privacy,
  decision_log, outcomes). Do not stub around its absence — sequence the work.
- Website: React + TS + Vite — API wrappers `website/src/lib/api/`
  (`client.ts` already injects `Idempotency-Key: crypto.randomUUID()` on all
  writes), views `website/src/views/`, i18n `t()`/`useT()` in
  `website/src/lib/i18n/index.ts` with module locale pairs
  (`locales/en.trade.ts` + `hi.trade.ts` pattern; `mr.ts` exists), persona/tool
  registry `website/src/lib/dashboard.ts` (`TOOL_BY_ID`, `PROFILE_ROUTES`,
  `DEFAULT_HOME_ROUTE`, `PERSONA_HOME_CONFIG`), routes in `website/src/App.tsx`.
  UI primitives that already exist: `components/ModalSheet.tsx`,
  `components/toast.ts`, `components/intelligence/InsightsPanel.tsx`,
  `stores/dashboard.ts` (`activeProfile`, `linkedProfiles`).
- `website/src/views/dashboard/DashboardHome.tsx` (136 lines) is static today
  — its own comment says "Placeholders only: no API data, no charts". This
  phase replaces it.
- Verify every path you cite exists (Glob/Read) before writing it down.

---

## WS-01 — Task engine backend

**Source:** robust.md §4.1, §13 rules 6–8 · ai.md flow 5.1 step 1
**Goal:** New `tasks` collection + `/v1/tasks` router + shared `emit_task()`
service; `/intelligence` extended (not duplicated) as the numbers layer.

**Read first:**
- `backend/app/routers/intelligence.py` (ops-summary router to extend)
- `backend/app/main.py` (router mounting, `/v1` prefix)
- `backend/app/core/db.py`, `backend/app/core/deps.py`
- `backend/app/services/rent_reminders.py` + `backend/app/routers/jobs.py` (existing job that must also emit tasks)
- `backend/tests/conftest.py`
- phase-00 outputs: pagination + idempotency helpers (use them; do not reinvent)

**Rules at risk:** no endpoint without the error envelope, real cursor
pagination, and `Idempotency-Key` on writes (rule 7); no `?? <hardcoded>`
fallbacks (rule 1); integer paisa for any ₹ amounts carried in task
subtitles/metadata (rule 3).

**Steps:**
1. Create the `tasks` collection. Document shape exactly per robust.md §4.1:
   ```
   { taskId, userId, persona, module, kind, title: {en, hi}, subtitle,
     priority: urgent|today|upcoming, deepLink, actionEndpoint?, dueAt,
     status: open|done|dismissed, sourceId, createdAt }
   ```
   Additions allowed (document why): `updatedAt`, `dedupeKey`
   (`userId:module:kind:sourceId`) for idempotent emission, `decisionId`
   (set later by WS-03 ranking), `coinsAwarded` (for WS-02 celebration).
2. New `backend/app/services/tasks.py` with
   `emit_task(user_id, persona, module, kind, title_en, title_hi, subtitle,
   priority, deep_link, source_id, due_at=None, action_endpoint=None)`.
   Upsert on `dedupeKey` so re-firing a state transition never double-creates;
   reset `status` to `open` only if the underlying condition re-opened.
   Generators call this from existing state transitions — **no separate cron
   where avoidable** (robust.md §4.1).
3. New `backend/app/routers/tasks.py`, `APIRouter(prefix="/tasks")`, mounted in
   `main.py` with `/v1`:
   - `GET /v1/tasks/today` — open tasks for the caller where `priority` is
     `urgent|today` or `dueAt <= end of today`; ordered urgent-first then dueAt.
   - `GET /v1/tasks?persona=&status=` — filters + cursor pagination
     (phase-00 helper, not limit-100-then-slice).
   - `POST /v1/tasks/{id}/done` and `POST /v1/tasks/{id}/dismiss` —
     `Idempotency-Key` required; ownership check (404 if not the caller's
     task); transition `open → done|dismissed`; accept optional
     `{decisionId}` body for the WS-03 outcome hook.
   - `GET /v1/tasks/summary` — per-module open counts + **top-3 urgent items
     per persona**, for one persona or aggregated across all of the caller's
     personas (`?persona=all`). This feeds the WS-02 summary grid.
4. Extend `routers/intelligence.py` only where money/number aggregates are
   missing for the dashboard money snapshot (pending receivables/payables/
   settlements). `/intelligence` = numbers layer, `/tasks` = action layer —
   do not copy task logic into it.
5. Add Firestore composite indexes to `infra/firestore.indexes.json` for every
   shipped query: `(userId, status, priority, dueAt)`,
   `(userId, persona, status)`, `(userId, module, status)`,
   `(dedupeKey)` unique-equivalent lookup.
6. Notification deep-link map alignment (X3 prep): notifications today carry
   `data` payloads like `{type: "rent_reminder", leaseId, dueMonth}`
   (`services/rent_reminders.py`). Define the canonical `deepLink` route table
   (module → website route, matching `website/src/App.tsx` paths) in
   `services/tasks.py` and make emitted notifications use the **same** deepLink
   values, so push → dashboard → action is one tap. Full per-token FCM push is
   phase-06; here you only align the payload values.
7. Tests `backend/tests/test_tasks.py`: emit + dedupe (same sourceId twice →
   one doc); `today` and `summary` response shapes (per-module counts, top-3
   urgent); `done`/`dismiss` transitions, idempotent replay, cross-user 404;
   pagination cursor round-trip; error-envelope shape on bad requests.

**Acceptance:** all five endpoints live with envelope + pagination +
idempotency; `emit_task()` is dedupe-safe; `GET /v1/tasks/summary?persona=all`
unions personas; indexes committed; `test_tasks.py` green.

**Verification:**
```bash
cd backend && .venv/bin/python -m pytest -q tests/test_tasks.py
# manual: create a task via a module action (e.g. run rent-reminders job),
# then GET /v1/tasks/today and /v1/tasks/summary with a user token;
# POST /v1/tasks/{id}/done twice with the same Idempotency-Key → one transition.
```

---

## WS-02 — Website Action Center

**Source:** robust.md §4.2 + principle P7 (low-literacy UX) · ai.md flow 5.1
**Goal:** Rebuild `DashboardHome.tsx` around five real sections, all fed by
`/v1/tasks/summary` + `/intelligence`.

**Read first:**
- `website/src/views/dashboard/DashboardHome.tsx` (current static shell)
- `website/src/lib/dashboard.ts` (ACL matrix / persona tool registry)
- `website/src/lib/personas.ts`, `website/src/stores/dashboard.ts`
- `website/src/lib/api/intelligence.ts`, `website/src/lib/api/client.ts`
- `website/src/components/intelligence/InsightsPanel.tsx`,
  `website/src/components/dashboard/tiles.tsx`
- `website/src/lib/i18n/index.ts`, `website/src/lib/i18n/locales/en.ts`,
  `hi.ts`, and one module pair (`en.trade.ts`/`hi.trade.ts`) for the pattern
- `website/src/theme/dashboard.css`, `website/src/App.tsx`

**Rules at risk:** no hardcoded strings — every label via `t()` with en+hi at
ship time (rule 6 / P4); **zero `?? <number>` fallbacks** — missing data renders
an empty/loading state, never an invented number (rule 1 / §4.3); no
`alert()`/`prompt()`/`confirm()` — use `components/toast.ts` and
`ModalSheet.tsx` (rule 6); icon-first actions, timeline-over-tables (P7).

**Steps:**
1. New `website/src/lib/api/tasks.ts`: `getToday()`, `list({persona, status,
   cursor})`, `summary(persona | 'all')`, `markDone(id, decisionId?)`,
   `markDismiss(id)`. Follow the existing module conventions (client.ts
   already adds `Idempotency-Key` on writes — do not add your own).
2. Rebuild `DashboardHome.tsx` with these five sections (robust.md §4.2), in
   this order:
   1. **Hero next-best-action card** — placeholder mount point rendered by
      WS-03 (render it only when a `headline_task` is present).
   2. **Urgent strip** — red/amber cards for `priority=urgent` time-boxed
      items (expiring offers, pickups today, payment releases).
   3. **Today's tasks** — checklist from `GET /v1/tasks/today`; each row:
      icon, localized title/subtitle, one-tap primary action that navigates to
      `deepLink`; a done toggle calling `markDone`; on done, a celebration
      micro-animation, with coins shown when `coinsAwarded > 0`
      ("+coins where applicable", §4.2).
   4. **Module summary grid** — one card per module the active persona can
      access per the ACL matrix in `lib/dashboard.ts`; each card shows the
      live open count + one-line status from `/v1/tasks/summary` (e.g.
      "2 offers expiring", "Rent overdue ₹12,000" — strings from `t()` with
      count params, never hardcoded).
   5. **Money snapshot** — pending receivables/payables/settlements from
      `/intelligence`; this **replaces every hardcoded metric pill**
      (including `PersonaBanner` metrics fed from static config).
   6. **Persona switcher + aggregate mode** — "All profiles" toggle that
      unions tasks across the user's linked profiles (`summary('all')`);
      farmer persona defaults aggregate ON (he is the super-user, §4.2).
3. Keep the existing persona home boards (`SellerHomeBoard`,
  `TransportHomeBoard`, etc.) mounted below the new sections — they are
  refactored in phases 02–04, not here.
4. i18n: add a `locales/en.dashboard.ts` + `hi.dashboard.ts` module pair
  (register in the locales index) covering every new key: section titles, task
  row actions, empty states, celebration copy, aggregate toggle. Marathi
  (`mr.ts`) gets the chat keys in WS-04; dashboard mr keys may ride along if
  trivial, but en+hi are the ship gate.
5. Deep-link integrity: a task is only rendered with an action if its
   `deepLink` resolves to a route registered in `App.tsx`; WS-05 guarantees
   this server-side — assert it client-side too (unknown route → render the
   task without the action button, never a dead tap).
6. Loading/empty states per P7: skeleton cards while loading; honest empty
   states ("no tasks today") with icons — no fake numbers anywhere.

**Acceptance:** all five sections render from live API data on at least the
farmer persona and one business persona; aggregate toggle unions tasks;
completing a task updates the checklist + summary count without a reload;
grep for `?? <number>` in `website/src/views` returns nothing; zero hardcoded
user-facing strings (spot-check en/hi parity for the new keys).

**Verification:**
```bash
cd website && pnpm exec tsc --noEmit && pnpm build
grep -rn "?? [0-9]" src/views || echo "clean"
# manual: log in as a multi-profile user; toggle All profiles; tap a task →
# lands on its module screen; mark done → celebration + count decrement;
# switch language to hi and re-walk the page.
```

---

## WS-03 — Task ranking AI (brief M5)

**Source:** AI brief M5 · question set `tasks.rank.v1` (plan §2) · SDR recipe
(§3) · ai.md flow 5.1 · website integration standards (§6)
**Goal:** `tasks.rank.v1` orders `GET /v1/tasks/*`; hero next-best-action card
on every persona dashboard.

**Read first:**
- `backend/app/services/ai/` (phase-00 output: `gateway.py`,
  `question_sets.py`, `privacy.py`, `outcomes.py`, `shim.py`)
- `backend/app/routers/tasks.py` (WS-01), `backend/app/routers/intelligence.py`
- `website/src/views/dashboard/DashboardHome.tsx` (WS-02),
  `website/src/lib/dashboard.ts`

**Rules at risk:** all model calls through `services/ai/gateway.py` — never
OpenRouter/Gemini from routers (rule 10); no phones/emails/Aadhaar in AI
payloads, IDs HMAC-hashed via `privacy.py` (rule 11); automation level
`suggest` only — ranking annotates, the user still taps (rule 12); every call
logged to `ai_decisions` with cost + confidence; deterministic fallback
(due-date sort) and full function with `AI_PROVIDER=shim`.

**Steps (SDR):**
1. Register `tasks.rank.v1` in `question_sets.py` (plan §2): per-task `impact`
   score (0–1) + `headline_task` choice; set `confidence_threshold`,
   `automation_level: "suggest"`, `fallback_fn` = due-date sort.
2. State builder via `privacy.py`: pseudonymized user id
   (`HMAC(user_id, AI_HASH_SALT)`), task list (module, kind, priority, dueAt,
   localized title), plus persona and `/intelligence` money context — target
   ≤1,500 tokens. **Batch ≤10 tasks per `decide()` call; chunk larger lists**
   (M5 step 1).
3. Call sites: in `GET /v1/tasks/today` and `GET /v1/tasks/summary`, rank
   before return and attach `headline_task: true` to the chosen task plus
   `decisionId` on ranked items (WS-01 reserved these fields).
4. Website: hero **next-best-action card** component at the top of
   `DashboardHome.tsx` (WS-02 mount point) rendering the `headline_task`;
   ranked ordering in the today's-tasks list. Build the shared
   `<AiBadge>` primitive (confidence-tinted "AI sujhav", plan §6 — M2/M3 own
   the primitive set, so build it here and export for reuse) and a
   `<ConfidenceGate>` behavior: high confidence → preselected primary action;
   low → neutral display, no nudge. All labels via `t()`.
5. Fallback: on gateway exception/timeout/budget trip → due-date sort; log
   with `fallbackUsed` (SDR step 5). Flag off (`platform_config/ai.modules`)
   → plain due-date ordering, no errors.
6. Outcome hook: task completed within 24 h of being headlined →
   `record_outcome(decision_id, "task-completed-within-24h")` — wire it in the
   `POST /v1/tasks/{id}/done` handler using the `decisionId` from WS-01/WS-02.
7. Temporary adapter (only if WS-01 is somehow not landed): rank
   `/intelligence` items instead, and leave a dated note in this file per M5.
   Remove the adapter once tasks exist.
8. Tests: golden fixture `backend/tests/fixtures/ai/golden/tasks.rank.v1.jsonl`
   — shim ranking is stable/deterministic; fallback test with gateway raising;
   flag-off test proving tasks endpoints work without AI.

**Acceptance:** every persona dashboard shows a ranked, working hero card;
shim ranking stable across repeated calls; zero `?? <number>` fallbacks left
in dashboard views; flag off → due-date order; outcome recorded on
done-within-24h.

**Verification:**
```bash
cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q
cd website && pnpm build
# manual: with shim, reload a persona dashboard twice → same hero card;
# disable the module flag → list falls back to due-date order, hero hidden or
# neutral; complete the hero task → outcome hook fires (check ai_decisions).
```

---

## WS-04 — Kisan Mitra 2.0 (brief M2)

**Source:** AI brief M2 · question sets `chatbot.intent.v1` +
`chatbot.safety.v1` (plan §2) · SDR/SGR recipes (§3) · ai.md flows 5.3/5.10 and
the L2→L3 architecture (Gemini explains, humans adjudicate)
**Goal:** Jev intent routing + safety post-check around the existing Gemini
chat; persona-aware prompts; website chat UI with handoff threads.

**Read first:**
- `backend/app/services/chatbot.py` (existing Kisan Mitra Gemini prompt —
  keep it; the model call goes through `gateway.generate()` per phase-00)
- `backend/app/routers/chatbot.py` — `POST /v1/chatbot/messages`,
  `GET /v1/chatbot/history`, `POST /v1/chatbot/expert-handoff` (writes
  `expert_tickets` + `users/{uid}/expert_tickets`), `GET /v1/chatbot/experts`
- `backend/app/routers/intelligence.py` (persona summary for prompts)
- `backend/tests/test_chatbot.py` (existing handoff tests to extend)
- `website/src/lib/api/client.ts`, `website/src/views/trade/ChatRoomPage.tsx`
  (chat UI patterns), `website/src/components/ModalSheet.tsx`

**Rules at risk:** gateway-only model calls (rule 10); no phone numbers, UPI
IDs, or external links in any chat surface — the bot must never emit them and
flagged content is stripped (rule 4); money/credit/insurance/legal topics
never exceed `require_confirm` — the bot explains and routes to a human, it
never advises a decision (rule 12); en+hi strings at ship time, Marathi
round-trip required by acceptance (rule 6); no `alert()` (rule 6).

**Steps:**
1. Register `chatbot.intent.v1` (plan §2): `intent`
   choice(`agronomy`/`market`/`app_help`/`money`/`human_needed`) + `answerable`
   score. Register `chatbot.safety.v1`: `has_contact_info`,
   `has_financial_advice`, `has_medical_certainty` bools. Golden fixtures for
   both under `backend/tests/fixtures/ai/golden/`.
2. In the message flow (`services/chatbot.py` + `routers/chatbot.py`): on each
   user message, `gateway.decide(state, "chatbot.intent.v1", ctx)`. If
   `intent == human_needed` **or `answerable < 0.6`** → take the existing
   `expert_tickets` handoff path (M2 step 1). If `intent == money` → answer
   only with neutral explanation + offer handoff; never prescriptive advice.
3. Persona-aware system prompt (M2 step 2): active persona + a compact
   `/intelligence` summary snippet + user language, prepended to the existing
   Kisan Mitra prompt. Pseudonymize via `privacy.py`; no phone/email/Aadhaar
   in the payload.
4. Safety post-check (M2 step 3): after Gemini generates, run
   `chatbot.safety.v1`; on any flag → strip the offending content + **one**
   regeneration; if still flagged → static safe fallback text in the user's
   language (SDR step 5). Log everything to `ai_decisions`.
5. Website:
   - New `website/src/lib/api/chatbot.ts`: `sendMessage`, `getHistory`,
     `requestHandoff`, `listExperts`.
   - Kisan Mitra **chat sheet**: floating action button (FAB) on the dashboard
     opening a `ModalSheet`-based chat; message list, input, typing state;
     en/hi strings (add to the WS-02 locale pair or a `chatbot` pair) plus
     Marathi coverage for the chat surface keys.
   - **Expert-handoff thread view** bound to `expert_tickets`: when a handoff
     happens, the sheet shows a persistent "expert se jawab aayega" thread
     (ai.md flow 5.3 step 3) with status; the thread must be visible on
     return (history endpoint).
6. Wire the dashboard "Chat (Kisan Mitra)" tile to open the sheet. The
   registry has a `chats` toolId (`lib/dashboard.ts` line 77) — add/rename a
   Kisan Mitra tile entry and point it at the sheet; remove any "coming soon"
   behavior for it.
7. Tests: extend `backend/tests/test_chatbot.py` — shim intent
   `human_needed` → ticket created; `answerable < 0.6` → handoff; safety flag
   → stripped/regenerated/fallback response; persona snippet present in
   prompt state; golden fixtures pass on shim.

**Acceptance (M2 verbatim):** Marathi chat returns Marathi, persona-aware
answers; red-team set (phone-sharing, loan advice) is filtered; handoff
creates a visible thread; with shim, canned answers flow and UI still works.

**Verification:**
```bash
cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q tests/test_chatbot.py
cd website && pnpm exec tsc --noEmit && pnpm build
# manual: dashboard FAB → ask an agronomy question in Hindi, then Marathi;
# try "mujhe loan chahiye, kya karun" → neutral answer + handoff offer;
# try sharing a phone number in a reply context → filtered;
# request expert → thread persists across reload.
```

---

## WS-05 — Module task emission sweep

**Source:** robust.md §4.1 generator table (verbatim below) · §4.3 · §12
playbook step 5 · ai.md flow 5.3 step 4
**Goal:** Wire `emit_task()` into every **existing** module's state
transitions so each module emits ≥1 task type and appears in the summary grid.

**Read first:**
- `backend/app/services/tasks.py` (WS-01) and its deep-link route table
- The module routers (all verified to exist in `backend/app/routers/`):
  `advisory.py`, `weather.py`, `lots.py`/`offers.py`/`purchases.py`,
  `transport.py`, `equipment.py`/`equipment_owner.py`, `land.py` +
  `services/rent_reminders.py`, `dairy_manager.py`, `loans.py`/`finance.py`,
  `insurance.py`/`insurance_claims.py`, `contracts.py`/`direct_buyer.py`,
  `schemes.py` + `services/eligibility.py`, `courses.py`/`teachers.py`,
  `broker.py`, `post_harvest.py`, `gamification.py`/`referrals.py`,
  `users.py` (KYC state)
- `website/src/App.tsx` + `website/src/lib/dashboard.ts` (`PROFILE_ROUTES`)
  to confirm each `deepLink` resolves to a real route

**Rules at risk:** task titles/subtitles ship in en+hi in the emitted doc
(rule 6); no invented numbers — subtitles use real values from the triggering
document, integer paisa for ₹ (rules 1, 3); every emitted `deepLink` must land
on a working screen — §4.3 "no coming soon from a task" (see step 4);
silence is not allowed — a module that cannot emit gets a dated deferral note
(rule 10).

**Steps:**
1. Use this table (carried verbatim from robust.md §4.1) as the emission
   checklist. Map each row to concrete trigger points in the cited router:

   | Source module | Example tasks emitted |
   |---|---|
   | crop_cycles / advisory | "Sow tomato this week", "Spray window tomorrow 6–9am", sowing-intent nudges, saturation warnings |
   | weather | "Heavy rain in 48h — delay urea" (severe-weather alerts) |
   | trade (lots/offers/purchases) | "3 new offers on your onion lot", "Counter expires in 6h", "Pickup scheduled — keep produce ready", "Payment ₹18,400 pending release" |
   | transport | "New booking request", "Trip starts in 2h", "POD pending upload", "Weekly settlement ₹28,500 ready" |
   | equipment | "Booking approval needed", "Machine due back today", "Service due: Mahindra 575" |
   | land | "Rent due from tenant in 3 days" (exists as job — emit tasks), "Lease expiring in 30 days", "New lease request" |
   | dairy | "Morning collection not logged", "Payment batch ready to approve", "Rate chart expires Sunday" |
   | loans / finance | "Loan approved — accept terms", "EMI due in 5 days", "KCC limit top-up available" |
   | insurance | "Claim surveyor assigned", "Claim rejected — appeal within 15 days", "PMFBY enrollment deadline" |
   | contracts / direct buyer | "Contract delivery due this week", "New grow-for-us offer matches your crops" |
   | schemes | "PM-Kisan installment credited", "New scheme matches your profile — apply by 12 Nov" |
   | courses / instructor | "Live class at 5pm", "12 pending assignment reviews", "Certificate ready" |
   | broker | "Deal awaiting your confirmation", "Commission payout processed" |
   | cold storage | "Chamber booking confirmed", "Lot releases tomorrow" |
   | gamification / referrals | "50 coins to next reward", "Referral milestone reached" |
   | KYC / account | "KYC verification needed to receive payouts", "Document expiring" |

2. For each module: identify the existing state transitions (offer created,
   booking requested, claim status change, batch ready, lease request, etc.)
   and call `emit_task()` there — inline in the transition, no new cron where
   avoidable. For the land row, extend `services/rent_reminders.py` (the job
   exists, triggered via `POST /jobs/rent-reminders/run`) to also emit tasks
   alongside its notification writes.
3. Set `kind`, `priority`, `dueAt`, and `deepLink` per the WS-01 route table;
   `sourceId` = the underlying doc id (offer/lease/claim/batch…) so dedupe
   works; ₹ values in subtitles come from the source doc as integer paisa
   formatted client-side.
4. Deep-link gate: before wiring a task, confirm its `deepLink` resolves to a
   route in `website/src/App.tsx`. If the target screen does not exist yet
   (several modules are still placeholder toolIds — e.g. schemes/finance/
   insurance web UIs), either point the task at the closest working screen or
   record an explicit **dated deferral note** in `missing-features/robust.md`
   under that module's §7 entry (rule 10) and skip emission for that kind.
   Never emit a task that dead-ends.
5. Notification alignment: wherever these transitions also create
   notification docs, make the notification `data` payload carry the same
   `deepLink` (X3 alignment from WS-01 step 6).
6. Tests: per-module emission tests (extend the existing module test files,
   e.g. `tests/test_broker_deals.py`, `tests/test_dairy_mgmt.py`) — perform
   the state transition, assert a `tasks` doc exists with the right `module`,
   `kind`, `status=open`, localized `title.en`/`title.hi`, and a `deepLink`
   present in the route table. One aggregate test: `GET /v1/tasks/summary`
   after seeding shows every wired module with a count.
7. Cross-check client-side: the WS-02 summary grid iterates the persona's ACL
   modules — verify every module with emitted tasks also has a summary-grid
   card for the personas that can access it.

**Acceptance:** every existing module emits ≥1 task type (or carries a dated
deferral note); each appears in `GET /v1/tasks/summary`; every emitted
`deepLink` resolves to a registered website route (grep-check route table vs
`App.tsx`); rent-reminders job emits tasks as well as notifications; full
backend suite green.

**Verification:**
```bash
cd backend && .venv/bin/python -m pytest -q
# manual per module: trigger one transition (create offer, request booking,
# run rent-reminders job with X-Cron-Secret, advance a claim…) → task appears
# in GET /v1/tasks/today → tap it on the website → lands on a working screen.
```

---

## Phase-final verification

```bash
cd backend && .venv/bin/python -m pytest -q          # fully green
cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q   # green on shim
cd website && pnpm exec tsc --noEmit && pnpm build   # clean
grep -rn "?? [0-9]" website/src/views                # empty (robust §4.3)
```

Manual exit-gate walk (robust §4.3 + phase readme):
1. **Farmer morning (ai.md flow 5.1):** open the dashboard → hero
   next-best-action card renders (shim-stable across reloads) → urgent strip +
   today's tasks + summary grid + money snapshot all live → tap the hero
   card's task → land on the module screen → complete the action → task flips
   to done with celebration → summary count decrements.
2. **Aggregate mode:** multi-profile user toggles "All profiles" → tasks from
   both personas union; farmer defaults ON.
3. **Persona sweep:** every persona dashboard shows a working AI-ranked hero
   card; flag off → due-date order, no errors.
4. **Kisan Mitra:** Hindi and Marathi round-trips; red-team message filtered;
   expert handoff creates a visible, persistent thread.
5. **Task sweep:** for every module in the §4.1 table, at least one task type
   fires and its deep-link lands on a working screen — no "coming soon"
   reachable from any task.
6. Confirm `ai_decisions` entries exist for ranking + chatbot calls with cost
   and confidence, and that no payload contains phones/emails/unmasked Aadhaar.
