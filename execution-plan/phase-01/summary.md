# phase-01 — Execution Summary

> Executed 2026-10-03 per `execution-plan/AGENT_PLAYBOOK.md`, task queue
> `execution-plan/phase-01/tasks.md` (WS-01…WS-05) + `instructions.md`.
> Re-verified 2026-10-03 (second pass at operator request: all non-human tasks already
> `[x]`; scriptable gates and the tasks-API flow re-run — evidence below).
> Checkpoints: `fc1c525` WS-01 · `82d1f3e` WS-02 · `62114a4` WS-03 · `b4897ff` WS-04 ·
> `8b750ed` WS-05 · `04fc3e6` exit gate green.
> Task queue: **109/118 checked**; the 9 open items are all human checks
> (1.18, 2.18, 3.15, 4.15, 5.36, P.7–P.10).

## Status at a glance

| WS | Title | Status | Notes |
|---|---|---|---|
| WS-01 | Task engine backend | ✅ done (1.18 human) | 5 endpoints live; dedupe-safe emission; cursor pagination + idempotency helpers built (phase-00 deferral completed) |
| WS-02 | Website Action Center | ✅ done (2.18 human) | five live sections; aggregate mode; zero `?? <number>` across all views |
| WS-03 | Task ranking AI | ✅ done (3.15 human) | `tasks.rank.v1` + shim/golden/fallback/flag-off; hero card + AiBadge + ConfidenceGate |
| WS-04 | Kisan Mitra 2.0 | ✅ done (4.15 human) | intent + safety question sets, persona prompts, handoff threads, chat sheet, en/hi/mr |
| WS-05 | Module task emission sweep | ✅ done (5.36 human) | 8 modules wired + tested; 9 dated deferral notes (rule 10) |

## Phase-final gates — re-run 2026-10-03

```
backend  pytest (default env, AI_PROVIDER=shim)  -> 844 passed, 1 skipped, 0 failed
pytest tests/test_tasks.py tests/test_chatbot.py  -> 34 passed
website  pnpm exec tsc --noEmit && pnpm build      -> clean + built
P.4  grep -rn "?? [0-9]" website/src/views         -> CLEAN (no matches)
locale dashboard pair en/hi                        -> 38 keys each, full parity
```

(Suite grew from 823 to 844 vs the first pass — phases 02–03 added tests; all green.)

## Live tasks-API flow — re-verified against a dev server (2026-10-03)

Executed the automatable half of human check 1.18 on `uvicorn app.main:app --port 8000`
(dev env, `ai_provider` default = shim):

- Auth: a **backend JWT** was obtained via `POST /v1/auth/quick-login`
  (`{"persona":"farmer","mpin":"9876"}`) — raw `Bearer dev-user-1` is correctly rejected
  with 401 `INVALID_TOKEN` by `/v1/tasks/*` (JWT auth since phase-00 WS-02; see
  deviations). Task 1.18's literal `Bearer dev-user-1` curl text predates that
  unification.
- `POST /v1/jobs/rent-reminders/run` → 200 `{"reminded":0,...}` (ran clean; no due
  leases in the dev DB). Jobs are mounted under `/v1` (`/v1/jobs/...`); cron secret is
  fail-open when unset (dev).
- Two tasks seeded through the real `emit_task()` path (`land/rent_due` high,
  `schemes/scheme_check` medium), then exercised over HTTP:
  - `GET /v1/tasks/today` → 200, task returned **with live AI ranking fields**
    (`headline_task: true`, `rank_confidence: 0.9`, `decisionId: dec_…`) — gateway
    ranking end-to-end on shim ✅ (exit-gate ranking item).
  - `GET /v1/tasks/summary?persona=all` → 200
    `{"personas":{"farmer":{"moduleCounts":{"schemes":1,"land":1},"topUrgent":[…]}}}` —
    per-module counts + top-3 urgent shape ✅ (exit-gate summary item).
  - `POST /{id}/done` with `Idempotency-Key: check-123` → 200; **replayed with the same
    key** → 200, byte-identical result (idempotent) ✅. Repeat without a key → 400
    (Idempotency-Key required on writes, per spec).
  - `POST /{id}/dismiss` → 200, `status: "dismissed"` ✅.
  - `GET /v1/tasks/today` after completion → empty ✅.
  - `GET /v1/tasks?status=bogus` → 400 standard envelope
    `{"error":{"code":"INVALID_STATUS",…}}` ✅.
- The two seeded tasks were completed/dismissed during the check; no dev-data residue
  left open. No code was changed in this pass.

## WS-01 — Task engine backend ✅

- `tasks` collection shape per robust §4.1 + documented additions (`updatedAt`,
  `dedupeKey`, `decisionId`, `coinsAwarded`); `services/tasks.py:emit_task()` upserts on
  `dedupeKey`, never resurrects done/dismissed tasks.
- `routers/tasks.py` (`/v1/tasks`): `GET /today`, `GET ?persona=&status=` (real cursor
  pagination via `core/pagination.py` + `db.query_cursor` — the phase-00 deferral
  completed here), `POST /{id}/done|dismiss` (Idempotency-Key required, cross-user 404),
  `GET /summary` (per-persona module counts + top-3 urgent).
- Deep-link table (`services/tasks.py:DEEP_LINKS`, 12 entries) verified against
  `App.tsx`; tool deep links resolve through `/dashboard/p/:toolId` (real pages only).
- `/intelligence` extended with integer-paisa aggregates (`pendingReceivablesPaisa`,
  `pendingPayablesPaisa`, `pendingSettlementsPaisa`).
- `tasks` composite indexes + `dedupeKey` override in `infra/firestore.indexes.json`.
- Rent-reminders notifications carry `data.deepLink` aligned with the task table.

## WS-02 — Website Action Center ✅

- `DashboardHome.tsx` rebuilt around five live sections: hero next-best-action → urgent
  strip → today's-tasks checklist (one-tap open, done toggle, celebration + coins when
  `coinsAwarded > 0`) → module summary grid (live counts, honest zero state) → money
  snapshot from `/intelligence`; persona boards stay mounted below.
- Aggregate mode ("All profiles", farmer defaults ON) unions tasks via `summary('all')`;
  skeletons + honest empty states; route-integrity guard (`lib/routes.ts`); wrapper
  `lib/api/tasks.ts`.
- Locale pair `en.dashboard.ts` / `hi.dashboard.ts` (38 keys each today, full parity),
  registered like the existing module pairs.
- **Hardcoded-metric sweep:** every `?? <number>` in `website/src/views` removed —
  verified CLEAN again today; arithmetic identities and form defaults use named
  constants (`lib/numDefaults.ts`).

## WS-03 — Task ranking AI ✅

- `tasks.rank.v1` registered (impact + headline choice, `suggest` automation,
  due-date-sort `fallback_fn`); `services/task_ranking.py` builds the pseudonymized state
  (HMAC user id via `privacy.py`, ≤10 tasks per `decide()` with chunked merging).
- `/v1/tasks/today` and `/summary` rank before return, attaching `headline_task`,
  `rank_confidence`, `decisionId`; gateway-only model calls. Live-confirmed on shim in
  the re-verification pass (fields attached, deterministic across calls).
- Fallback on gateway exception → due-date order, no headline; module flag off → no AI
  call, no `ai_decisions` docs. Outcome hook records `task-completed-within-24h`.
- Website: `AiBadge` (confidence-tinted), `ConfidenceGate` (high → preselected CTA, low →
  neutral), full hero card.
- Golden fixture `tasks.rank.v1.jsonl` (urgent-winner, deterministic tie-break,
  12-task chunking) replayed through the shim.

## WS-04 — Kisan Mitra 2.0 ✅

- `chatbot.intent.v1` (five intents + answerable score) and `chatbot.safety.v1`
  (contact info / financial advice / medical certainty) registered with golden fixtures.
- Message flow: intent gate → `human_needed` or `answerable < 0.6` takes the shared
  `expert_tickets` handoff path; `money` answers only with neutral copy + handoff offer
  (rule 12); persona-aware system prompt (active persona + compact `/intelligence`
  snippet, pseudonymized user id, no phones/emails/Aadhaar).
- Safety post-check: contact detection locally on raw text (gateway sanitizer masks
  phones before any model payload — rule 11) + model check for advice categories; strip →
  one regeneration → static safe fallback per language. Every decision logged.
- Router refactor: shared `create_expert_ticket` for the message flow and
  `/expert-handoff`; `GET /v1/chatbot/handoffs` for the thread view.
- Website: `lib/api/chatbot.ts`, `KisanMitraSheet` (messages, typing state, handoff
  thread bound to tickets, history-backed persistence), dashboard FAB + always-visible
  "Kisan Mitra" pill (no coming-soon path), en/hi/`mr` chat strings.

## WS-05 — Module task emission sweep ✅

- Wired (`emit_task` at real transitions, en+hi titles, real-value subtitles, source ids
  for dedupe, deep links verified against `App.tsx`): **trade** (new offer → lot owner),
  **transport** (booking accepted → trip reminder), **equipment** (slot booked → owner
  approval), **land** (rent-reminders job → `rent_due`, idempotent rerun), **dairy**
  (payment batch generated → ready), **contracts** (delivery created → farmer due),
  **courses** (certificate issued), **broker** (deal created → seller confirmation).
- Each wired module has an emission test in its existing suite; the aggregate coverage
  test proves every wired module appears in `GET /v1/tasks/summary`.
- **Deferred with dated notes** (rule 10, in `missing-features/robust.md` §7): advisory,
  schemes, finance/loans, crop insurance, climate/weather, post-harvest/cold storage,
  gamification, referrals, and KYC/account — their web screens are still placeholders, so
  emitting a task would dead-end (robust §4.3).

## Exit gate (readme.md) — final status

- [x] Zero hardcoded metrics (`?? <number>` grep CLEAN over `website/src/views`).
- [~] Every wired module emits ≥1 task type and appears in the summary grid — backend
      proven by emission + coverage tests and the live flow; per-module trigger sweep
      and dead-tap walk remain human (5.36, P.10).
- [~] AI-ranked hero card on every persona dashboard, shim-stable, flag-off fallback —
      ranking proven live + determinism/flag-off tests; visual walk remains human
      (3.15, P.7, P.8).
- [ ] Marathi/Hindi chat round-trips, red-team filtering, visible handoff thread —
      backend intent/safety suites green (13 tests); language answers and UI remain
      human (4.15, P.9; true Marathi/Gemini answers need the operator's dev Gemini key).
- [x] `GET /v1/tasks/summary` shape + idempotent `done`/`dismiss` + error envelope +
      cursor pagination — live-verified 2026-10-03 (above) + 21 tests green.
- [x] Global verification gate (README §4) green — pytest 844 ✓, tsc ✓, build ✓
      (re-run this pass; no code changes since the first pass).

## Human checks still required (task queue)

1. **1.18 / 5.36 / P.10** — manual task API + per-module trigger sweep against the
   running app: trigger each wired transition, tap its deep link, confirm no "coming
   soon"; audit `ai_decisions` payloads for PII. (Automated API behavior re-verified
   today; use a quick-login backend JWT, not the literal `Bearer dev-user-1`.)
2. **2.18 / P.7 / P.8** — Action Center walkthrough: five sections on farmer + one
   business persona; aggregate union; done-celebration + count decrement; Hindi walk;
   hero stability across reloads; flag-off fallback.
3. **3.15** — hero stability + flag-off + outcome doc inspection (backend outcome hook
   covered by tests; doc inspection is human).
4. **4.15 / P.9** — chat round-trips (Hindi/Marathi), red-team set (phone sharing, loan
   advice), persistent handoff thread.

## Explicit deferrals (no silent drops)

| Item | Where it lands |
|---|---|
| Task emission for 8 placeholder-only modules + KYC | their web UI phases (02–05); dated notes in robust.md §7 |
| Per-token FCM push timing/copy AI (`notify.*`), chat guardrails AI (`chat.guardrail.v1`) | phase-06 |
| Full persona app builds / dashboard extras | phases 02–05 |

## Executor notes / deviations

- **Phase-00 deferrals completed here:** cursor pagination and an Idempotency-Key helper
  were required by WS-01 tasks 1.6/1.7 — built as `core/pagination.py` +
  `core/db.query_cursor` (real Firestore `start_after`) and `services/idempotency.py`.
- **The `?? <number>` sweep went beyond `DashboardHome`** because task 2.17 / P.4 sweep
  all of `src/views`; 21 files were cleaned (invented board metrics → honest states;
  arithmetic/form defaults → named `ZERO` / `DEFAULT_BROKER_PCT`).
- **Task 1.18 auth note (re-verification finding):** `/v1/tasks/*` uses backend JWTs via
  `core/deps.py:current_user_id` since the phase-00 auth unification; the task's literal
  `Authorization: Bearer dev-user-1` returns 401 `INVALID_TOKEN`. Obtain a token via
  `POST /v1/auth/quick-login` first. The Firebase-style `dev-` token acceptance only
  exists in `_verify_firebase_token` for Firebase-bound routes.
- **Jobs mount:** the jobs router is mounted at `/v1` (`/v1/jobs/rent-reminders/run`);
  `_check_cron_secret` is fail-open when `CRON_SECRET` is unset (dev).
- **Task 1.3 deep-link check:** tool deep links point at tools with real pages,
  documented in `App.tsx` with their `path="…"` notation. All 12 values verified.
- **Kisan Mitra tile (task 4.14):** the `chats` registry entry already renders a real
  page, so Kisan Mitra is always reachable via the FAB and a dashboard pill; the
  coming-soon grep for the path is clean.
- **Shim for state-dependent sets:** `tasks.rank.v1`, `chatbot.intent.v1`,
  `chatbot.safety.v1` compute deterministic answers from the input state (keyword/regex
  classifiers); golden files document expected outputs and are replayed through
  `shim.decide` (the gateway sanitizer would mask phones before the safety classifier,
  so the safety golden replays shim-direct).
- This re-verification pass made **no code changes**; the dev server started for the
  API checks was stopped afterwards. This file re-creates `summary.md` from git history
  (`04fc3e6`) plus today's fresh evidence — the working-tree copy had been deleted.
