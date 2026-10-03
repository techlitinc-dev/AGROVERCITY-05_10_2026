# phase-01 — Task Queue
> Executor: read `execution-plan/AGENT_PLAYBOOK.md` first. Execute tasks top to
> bottom, one at a time. Mark [x] only when EXPECT matches real output.
> Full context for any task: see `instructions.md` WS-NN referenced in the task.

## WS-01 — Task engine backend  (see instructions.md §WS-01)

### Task 1.1 — Read orientation files, confirm phase-00 helpers
- DO: Read these files (no edits): `backend/app/routers/intelligence.py`, `backend/app/main.py`, `backend/app/core/db.py`, `backend/app/core/deps.py`, `backend/app/services/rent_reminders.py`, `backend/app/routers/jobs.py`, `backend/tests/conftest.py`. Locate the phase-00 cursor-pagination helper and the phase-00 `Idempotency-Key` helper and write down their exact import paths — tasks 1.6 and 1.7/1.8 must import and use them (do not reinvent them).
- RUN: `ls backend/app/routers/intelligence.py backend/app/main.py backend/app/core/db.py backend/app/core/deps.py backend/app/services/rent_reminders.py backend/app/routers/jobs.py backend/tests/conftest.py && grep -rln "cursor" backend/app | head -5 && grep -rln "dempotency" backend/app | head -5`
- EXPECT: `ls` prints all 7 paths with no error; each grep prints at least one file path (phase-00 helpers exist).
- IF FAIL: if `ls` errors, a cited file is missing → STOP the phase (playbook §5). If either grep prints nothing, phase-00 deliverables are missing → STOP the phase (playbook §5).
- [x]

### Task 1.2 — Create tasks service: constants and deep-link table
- DO: Create `backend/app/services/tasks.py` (new). Contents: (a) a module docstring stating the `tasks` doc shape verbatim from instructions.md §WS-01 step 1 — `{ taskId, userId, persona, module, kind, title: {en, hi}, subtitle, priority: urgent|today|upcoming, deepLink, actionEndpoint?, dueAt, status: open|done|dismissed, sourceId, createdAt }` — plus the allowed additions `updatedAt`, `dedupeKey` (`userId:module:kind:sourceId`, for idempotent emission), `decisionId` (set later by WS-03 ranking), `coinsAwarded` (for WS-02 celebration), each with a one-line why; (b) `COLLECTION = "tasks"`; (c) `DEEP_LINKS: dict[str, str]` — the canonical module → website route table (X3 prep, instructions.md §WS-01 step 6) — seeded with these entries verified against `website/src/App.tsx`: `"trade": "/dashboard/p/myOffers"`, `"transport": "/dashboard/p/transport/trips"`, `"purchases": "/dashboard/p/purchases"`, `"broker": "/dashboard/p/broker/deals"`, `"contracts": "/dashboard/p/contracts"`, `"dairy": "/dairy/console"`, `"chats": "/dashboard/p/chats"`. Values are route prefixes exactly as they appear in `App.tsx`; parameterized routes append the source doc id at emission time.
- RUN: `cd backend && .venv/bin/python -c "from app.services.tasks import COLLECTION, DEEP_LINKS; print(COLLECTION, sorted(DEEP_LINKS))"`
- EXPECT: exit 0; output starts with `tasks [` and lists the 7 keys above.
- IF FAIL: fix the Python syntax/import error shown, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 1.3 — Complete deep-link table from App.tsx
- DO: In `backend/app/services/tasks.py`, add one `DEEP_LINKS` entry for each remaining module in the instructions.md §WS-05 table (`advisory`, `weather`, `equipment`, `land`, `loans`, `insurance`, `schemes`, `courses`, `post_harvest`, `gamification`, `kyc`) whose website route exists. For each module: run `grep -n "path=" website/src/App.tsx` and pick the route prefix that serves that module (e.g. equipment routes under `/dashboard/p/...`, dairy-style consoles under `/<module>/console`). Add an entry ONLY when a matching route exists; do not invent paths. Modules with no route get no entry (WS-05 records dated deferral notes for them).
- RUN: `cd backend && .venv/bin/python -c "from app.services.tasks import DEEP_LINKS; [print(k, v) for k, v in sorted(DEEP_LINKS.items())]" && grep -F "path=\"" website/src/App.tsx | grep -F -f <(.venv/bin/python -c "from app.services.tasks import DEEP_LINKS; [print(v) for v in DEEP_LINKS.values()]") | head -20`
- EXPECT: exit 0; every value printed by the first command appears in a `path="..."` line in the grep output (no deep-link value is absent from `App.tsx`).
- IF FAIL: remove or correct the DEEP_LINKS value that has no matching `App.tsx` path, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 1.4 — Implement emit_task with dedupe upsert
- DO: In `backend/app/services/tasks.py`, add `async def emit_task(user_id, persona, module, kind, title_en, title_hi, subtitle, priority, deep_link, source_id, due_at=None, action_endpoint=None)`. Exact behavior, using the same db helpers other services in `backend/app/services/` use: compute `dedupe_key = f"{user_id}:{module}:{kind}:{source_id}"`; query `COLLECTION` where `dedupeKey == dedupe_key`. If a doc exists: update only `subtitle`, `priority`, `dueAt`, `deepLink`, `actionEndpoint`, `title`, and `updatedAt`; do NOT change `status` (a `done`/`dismissed` task is never resurrected — reset to `open` only if the caller is re-opening the underlying condition, which callers signal by simply not calling emit for closed conditions); return the existing doc id. If no doc exists: create one with exactly these fields — `taskId` (the new Firestore doc id), `userId`, `persona`, `module`, `kind`, `title: {"en": title_en, "hi": title_hi}`, `subtitle`, `priority`, `deepLink`, `actionEndpoint` (only when given), `dueAt` (ISO string or None), `status: "open"`, `sourceId`, `dedupeKey`, `decisionId: None`, `coinsAwarded: 0`, `createdAt`, `updatedAt`. All datetimes are ISO strings. Return the doc id.
- RUN: `cd backend && .venv/bin/python -c "import inspect; from app.services.tasks import emit_task; print(inspect.signature(emit_task))"`
- EXPECT: exit 0; output is exactly `(user_id, persona, module, kind, title_en, title_hi, subtitle, priority, deep_link, source_id, due_at=None, action_endpoint=None)`.
- IF FAIL: fix the signature/implementation error shown, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 1.5 — Create tasks router with GET /today
- DO: Create `backend/app/routers/tasks.py` (new). Contents: `router = APIRouter(prefix="/tasks", tags=["tasks"])`; an `_error(status_code, code, message, field_errors=None)` helper copied from the pattern in `backend/app/routers/intelligence.py` (raises `HTTPException(status_code, detail={"code": code, "message": message, "fieldErrors": field_errors or {}})` — this is the error envelope; every error path in this router must use it); `GET /today` — authenticated via the same `current_user_id` dependency `routers/intelligence.py` uses; query `tasks` where `userId == uid` and `status == "open"`, then in Python keep docs where `priority` is `urgent` or `today`, or `dueAt <= ` end of today (local ISO); sort urgent-first, then `dueAt` ascending; return `{"items": [...]}`.
- RUN: `cd backend && .venv/bin/python -c "from app.routers.tasks import router; print([r.path for r in router.routes])"`
- EXPECT: exit 0; output contains `/today`.
- IF FAIL: fix the error shown, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 1.6 — Add GET /tasks list with filters and cursor pagination
- DO: In `backend/app/routers/tasks.py`, add `GET ""` (i.e. `GET /v1/tasks`) with query params `persona` (optional), `status` (optional, one of `open|done|dismissed`), and `cursor` (optional). Filter by `userId == uid` plus the given filters, and paginate with the phase-00 cursor-pagination helper located in task 1.1 — do NOT limit-100-then-slice. Invalid `status` → `_error(400, "INVALID_STATUS", ...)`. Response shape: the helper's standard `{"items": [...], "nextCursor": ...}`.
- RUN: `cd backend && .venv/bin/python -c "from app.routers.tasks import router; print([r.path for r in router.routes])"`
- EXPECT: exit 0; output contains both `/today` and `/tasks` (or `` path on the `/tasks` prefix route).
- IF FAIL: fix the error shown, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 1.7 — Add POST /tasks/{id}/done
- DO: In `backend/app/routers/tasks.py`, add `POST /{task_id}/done`: require the `Idempotency-Key` header via the phase-00 idempotency helper located in task 1.1 (same key replayed → return the stored first response, no second transition); fetch the doc, `_error(404, "TASK_NOT_FOUND", ...)` when missing or `userId != uid` (ownership check); accept optional JSON body `{"decisionId": str}` and store it on the doc when present; transition `open → done`, set `updatedAt`; if already `done`, return the current doc unchanged (idempotent); if `dismissed`, `_error(409, "TASK_ALREADY_DISMISSED", ...)`. The `decisionId` field is the WS-03 outcome-hook input — keep it on the doc.
- RUN: `cd backend && .venv/bin/python -c "from app.routers.tasks import router; print([ (r.path, sorted(r.methods)) for r in router.routes])"`
- EXPECT: exit 0; output contains `/{task_id}/done` with `POST`.
- IF FAIL: fix the error shown, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 1.8 — Add POST /tasks/{id}/dismiss
- DO: In `backend/app/routers/tasks.py`, add `POST /{task_id}/dismiss` — identical structure to task 1.7's `done` handler (Idempotency-Key required via the phase-00 helper, 404 ownership check, optional `{"decisionId"}` body, `updatedAt`), transitioning `open → dismissed`; if already `dismissed` return the doc unchanged; if already `done`, `_error(409, "TASK_ALREADY_DONE", ...)`.
- RUN: `cd backend && .venv/bin/python -c "from app.routers.tasks import router; print([ (r.path, sorted(r.methods)) for r in router.routes])"`
- EXPECT: exit 0; output contains `/{task_id}/dismiss` with `POST`.
- IF FAIL: fix the error shown, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 1.9 — Add GET /tasks/summary
- DO: In `backend/app/routers/tasks.py`, add `GET /summary` with query param `persona` (a persona id, or the literal `all`). Query open tasks for the caller; when `persona` is a persona id, restrict to it; when `all`, union across all of the caller's personas present in their open tasks. Response: `{"personas": { "<persona>": {"moduleCounts": {"<module>": <int>}, "topUrgent": [<up to 3 urgent open tasks, urgent-first then dueAt>] } }}`. Counts come from real docs only — no hardcoded numbers anywhere.
- RUN: `cd backend && .venv/bin/python -c "from app.routers.tasks import router; print([r.path for r in router.routes])"`
- EXPECT: exit 0; output contains `/summary`.
- IF FAIL: fix the error shown, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 1.10 — Mount tasks router in main.py
- DO: In `backend/app/main.py`, add the import for the new tasks router following the exact style of the existing router imports, and add `app.include_router(tasks.router, prefix="/v1")` (use the imported module name as written) immediately after the existing `include_router` block, so all five routes live under `/v1/tasks`.
- RUN: `cd backend && .venv/bin/python -c "from app.main import app; print(sorted({r.path for r in app.routes if r.path.startswith('/v1/tasks')}))"`
- EXPECT: exit 0; output lists `/v1/tasks`, `/v1/tasks/summary`, `/v1/tasks/today`, `/v1/tasks/{task_id}/dismiss`, `/v1/tasks/{task_id}/done`.
- IF FAIL: fix the import/mount line (name mismatch is the usual cause), re-run — else STOP (playbook §5) with full output.
- [x]

### Task 1.11 — Extend intelligence money aggregates
- DO: In `backend/app/routers/intelligence.py`, extend the persona intel builders (`_farmer_intel`, `_broker_intel`, `_buyer_intel`, `_transport_intel`) ONLY where the dashboard money snapshot is missing an aggregate: pending receivables, pending payables, pending settlements. Add each missing aggregate as a NEW field named `pendingReceivablesPaisa` / `pendingPayablesPaisa` / `pendingSettlementsPaisa` (integer paisa — no floats for money), computed from the same collections the existing builder already queries; do not rename or re-type existing fields, and do not copy any task logic into this router (`/intelligence` = numbers layer, `/tasks` = action layer). If a builder already exposes an equivalent number, skip that field for that builder.
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_intelligence.py`
- EXPECT: exit 0, all tests in `tests/test_intelligence.py` pass.
- IF FAIL: read the failure, fix the new aggregate code (never weaken the test), re-run — else STOP (playbook §5) with full output.
- [x]

### Task 1.12 — Add Firestore composite indexes
- DO: In `infra/firestore.indexes.json`, add composite indexes on the `tasks` collection for every shipped query: `(userId, status, priority, dueAt)`, `(userId, persona, status)`, `(userId, module, status)`, and a single-field entry for `dedupeKey` (unique-equivalent lookup). Match the JSON shape of the existing index entries in that file; do not remove existing entries.
- RUN: `python3 -c "import json; d=json.load(open('infra/firestore.indexes.json')); print(sum(1 for i in d.get('indexes',[]) if i.get('collectionGroup')=='tasks'))"`
- EXPECT: exit 0; printed number is ≥ 3 and the file parses as valid JSON.
- IF FAIL: fix the JSON syntax or add the missing `tasks` indexes, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 1.13 — Align rent-reminders notification payload deepLinks
- DO: In `backend/app/services/rent_reminders.py` (X3 prep, instructions.md §WS-01 step 6): where the service writes notification docs with `data` payloads like `{"type": "rent_reminder", "leaseId", "dueMonth"}`, add a `deepLink` key to that `data` payload whose value is the `land` entry from `DEEP_LINKS` in `backend/app/services/tasks.py` (import it; if no `land` entry exists, use the closest working land route from `website/src/App.tsx`). Push → dashboard → action must be one tap; payload values only — no FCM per-token push work (that is phase-06).
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_rent_reminders.py`
- EXPECT: exit 0, all tests in `tests/test_rent_reminders.py` pass.
- IF FAIL: read the failure and fix the payload change (never weaken the test), re-run — else STOP (playbook §5) with full output.
- [x]

### Task 1.14 — Write emit + dedupe tests
- DO: Create `backend/tests/test_tasks.py` (new) using the existing `client` fixture in `backend/tests/conftest.py` (fake Firestore + fake auth; follow the style of `backend/tests/test_rent_reminders.py`). Add tests `test_emit_task_creates_doc` (call `emit_task(...)` directly, assert a `tasks` doc exists with all fields from the task-1.4 shape, `status == "open"`, `title.en`/`title.hi` set) and `test_emit_task_dedupes_on_source` (call `emit_task` twice with the same `source_id`, assert exactly one doc exists and the second call updated mutable fields without creating a doc).
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_tasks.py -k "emit"`
- EXPECT: exit 0; 2 tests pass.
- IF FAIL: fix the service code (never the test assertions), re-run — else STOP (playbook §5) with full output.
- [x]

### Task 1.15 — Write today + summary shape tests
- DO: In `backend/tests/test_tasks.py`, add `test_today_returns_urgent_and_due_open_tasks` (seed tasks via `emit_task` with mixed priorities/dueAt/status; `GET /v1/tasks/today`; assert only open urgent/today/due-today items, urgent-first then dueAt order) and `test_summary_counts_and_top_urgent` (seed tasks across ≥2 modules and ≥2 personas with ≥4 urgent in one persona; `GET /v1/tasks/summary?persona=all`; assert per-module open counts per persona and that `topUrgent` has at most 3 items; also call with a single persona and assert restriction).
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_tasks.py -k "today or summary"`
- EXPECT: exit 0; the 2 new tests pass.
- IF FAIL: fix the router code (never the test assertions), re-run — else STOP (playbook §5) with full output.
- [x]

### Task 1.16 — Write done/dismiss, replay, ownership tests
- DO: In `backend/tests/test_tasks.py`, add: `test_done_transition` (open → done via `POST /v1/tasks/{id}/done` with an `Idempotency-Key` header), `test_dismiss_transition` (open → dismissed), `test_done_idempotent_replay` (same `Idempotency-Key` sent twice → exactly one transition, second response equals the first, doc not double-mutated), `test_done_cross_user_404` (a different user's task id → 404 with the error envelope), and `test_done_then_dismiss_409`.
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_tasks.py -k "done or dismiss"`
- EXPECT: exit 0; the 5 new tests pass.
- IF FAIL: fix the router code (never the test assertions), re-run — else STOP (playbook §5) with full output.
- [x]

### Task 1.17 — Write pagination + error-envelope tests
- DO: In `backend/tests/test_tasks.py`, add: `test_list_cursor_round_trip` (seed more open tasks than one page; `GET /v1/tasks?status=open`, follow `nextCursor` with a second request; assert no duplicate items across pages and all items eventually returned) and `test_error_envelope_shape` (`GET /v1/tasks?status=bogus` → 400; assert body matches `{"detail": {"code": ..., "message": ..., "fieldErrors": ...}}` exactly as `_error` produces).
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_tasks.py`
- EXPECT: exit 0; all tests in `tests/test_tasks.py` pass (the full file).
- IF FAIL: fix the code under test (never the test assertions), re-run — else STOP (playbook §5) with full output.
- [x]

### Task 1.18 — HUMAN CHECK: manual tasks API flow
- DO: Human: start the backend with `./run.sh --backend-only` from the repo root (API on :8000). Using a dev token (`Authorization: Bearer dev-user-1` — dev- prefixed tokens are accepted by `backend/app/routers/auth.py` in dev): (1) trigger the rent-reminders job: `curl -X POST http://localhost:8000/jobs/rent-reminders/run -H "X-Cron-Secret: <value from the human operator's env>"`; (2) `curl http://localhost:8000/v1/tasks/today -H "Authorization: Bearer dev-user-1"`; (3) `curl "http://localhost:8000/v1/tasks/summary?persona=all" -H "Authorization: Bearer dev-user-1"`; (4) pick a task id from (2) and run `curl -X POST http://localhost:8000/v1/tasks/<id>/done -H "Authorization: Bearer dev-user-1" -H "Idempotency-Key: check-123"` twice.
- RUN: manual — no command (human executes the curls above).
- EXPECT: human confirms: (2) returns open urgent/today tasks; (3) returns per-module counts + top-3 urgent; (4) both responses show one `done` transition (no error, no double effect).
- IF FAIL: human pastes the failing curl output; diagnose against the router code and fix, then re-run the failing curl — else STOP (playbook §5) with full output.
- [ ]

### Task 1.19 — WS-01 checkpoint: verify + commit
- DO: Run the WS-01 Verification block from instructions.md §WS-01, then commit: `git add -A && git commit -m "phase-01 WS-01: Task engine backend"`.
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_tasks.py`
- EXPECT: exit 0, all `test_tasks.py` tests pass; then the commit succeeds (if git identity is missing, note it in the report and continue — playbook §6).
- IF FAIL: fix the failing test's code (never the test), re-run; only commit when green — else STOP (playbook §5) with full output.
- [x]

## WS-02 — Website Action Center  (see instructions.md §WS-02)

### Task 2.1 — Read orientation files
- DO: Read these files (no edits): `website/src/views/dashboard/DashboardHome.tsx`, `website/src/lib/dashboard.ts`, `website/src/lib/personas.ts`, `website/src/stores/dashboard.ts`, `website/src/lib/api/intelligence.ts`, `website/src/lib/api/client.ts`, `website/src/components/intelligence/InsightsPanel.tsx`, `website/src/components/dashboard/tiles.tsx`, `website/src/lib/i18n/index.ts`, `website/src/lib/i18n/locales/en.ts`, `website/src/lib/i18n/locales/hi.ts`, `website/src/lib/i18n/locales/en.trade.ts`, `website/src/lib/i18n/locales/hi.trade.ts`, `website/src/theme/dashboard.css`, `website/src/App.tsx`.
- RUN: `ls website/src/views/dashboard/DashboardHome.tsx website/src/lib/dashboard.ts website/src/lib/personas.ts website/src/stores/dashboard.ts website/src/lib/api/intelligence.ts website/src/lib/api/client.ts website/src/components/intelligence/InsightsPanel.tsx website/src/components/dashboard/tiles.tsx website/src/lib/i18n/index.ts website/src/lib/i18n/locales/en.ts website/src/lib/i18n/locales/hi.ts website/src/lib/i18n/locales/en.trade.ts website/src/lib/i18n/locales/hi.trade.ts website/src/theme/dashboard.css website/src/App.tsx`
- EXPECT: exit 0; all 15 paths printed.
- IF FAIL: a cited file is missing → STOP the phase (playbook §5).
- [x]

### Task 2.2 — Create tasks API wrapper
- PRECONDITION: `test -f backend/app/routers/tasks.py` — if this fails, STOP the phase (playbook §5).
- DO: Create `website/src/lib/api/tasks.ts` (new) following the conventions of an existing wrapper such as `website/src/lib/api/intelligence.ts` (same client import, same error handling). Export exactly these functions against the WS-01 endpoints: `getToday()` → `GET /v1/tasks/today`; `list({persona, status, cursor})` → `GET /v1/tasks` with those query params; `summary(persona: string | 'all')` → `GET /v1/tasks/summary?persona=...`; `markDone(id: string, decisionId?: string)` → `POST /v1/tasks/{id}/done` with body `{decisionId}` when given; `markDismiss(id: string)` → `POST /v1/tasks/{id}/dismiss`. Do NOT add an `Idempotency-Key` header yourself — `client.ts` already injects `Idempotency-Key: crypto.randomUUID()` on all writes. Export TypeScript types for the task doc matching the WS-01 shape (`taskId, userId, persona, module, kind, title: {en, hi}, subtitle, priority, deepLink, actionEndpoint?, dueAt, status, sourceId, createdAt, updatedAt, decisionId?, coinsAwarded`).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0, no type errors.
- IF FAIL: fix the type/import errors shown, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 2.3 — Create en.dashboard locale file
- DO: Create `website/src/lib/i18n/locales/en.dashboard.ts` (new) following the `en.trade.ts` module-pair pattern. Add English strings for every new UI label the Action Center needs: the five section titles (hero next-best-action, urgent strip, today's tasks, module summary grid, money snapshot), task-row actions (done, dismiss, open), empty states ("no tasks today" style per section), celebration copy including a coins variant with a count param, the aggregate toggle ("All profiles"), per-module one-line status strings with count/amount params (e.g. offers-expiring, rent-overdue patterns), and loading skeleton accessibility labels. Every string with a number takes it as a `t()` param — never bake numbers into strings.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0, no type errors.
- IF FAIL: fix the file to match the locale-module type shape used by `en.trade.ts`, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 2.4 — Create hi.dashboard locale file with full parity
- DO: Create `website/src/lib/i18n/locales/hi.dashboard.ts` (new) containing a Hindi translation for EVERY key added in task 2.3 — identical key set, same param names. en+hi parity at ship time is a hard gate (rule 6).
- RUN: `cd website && pnpm exec tsc --noEmit && grep -o "^[[:space:]]*[a-zA-Z0-9_]*:" src/lib/i18n/locales/en.dashboard.ts | sort > /tmp/en.keys && grep -o "^[[:space:]]*[a-zA-Z0-9_]*:" src/lib/i18n/locales/hi.dashboard.ts | sort > /tmp/hi.keys && diff /tmp/en.keys /tmp/hi.keys && echo PARITY_OK`
- EXPECT: exit 0 and output ends with `PARITY_OK` (en/hi key sets identical); `tsc` clean.
- IF FAIL: add/remove keys in `hi.dashboard.ts` until `diff` is empty, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 2.5 — Register dashboard locale pair in i18n index
- DO: In `website/src/lib/i18n/index.ts`, register the new `en.dashboard` / `hi.dashboard` module pair exactly the way the existing module pairs (`en.trade`/`hi.trade` etc.) are registered — same import style, same merge/registration call. Touch only the registration lines.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0, no type errors.
- IF FAIL: match the registration pattern of an existing pair, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 2.6 — Wire DashboardHome data fetching
- DO: In `website/src/views/dashboard/DashboardHome.tsx`, begin the rebuild: using `useT()` for strings, the `activeProfile`/`linkedProfiles` from `website/src/stores/dashboard.ts`, and the new `website/src/lib/api/tasks.ts` + existing `website/src/lib/api/intelligence.ts`, add state + effects that fetch `getToday()`, `summary(activePersona | 'all')`, and the intelligence response on mount and when the active profile changes. Keep the fetched data in component state; render nothing new yet beyond the data wiring (sections land in tasks 2.7–2.13). No `?? <number>` fallbacks anywhere — missing data stays undefined and renders loading/empty UI (tasks 2.16).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0, no type errors.
- IF FAIL: fix the type errors shown, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 2.7 — Build urgent strip section
- DO: In `website/src/views/dashboard/DashboardHome.tsx`, render the urgent strip (instructions.md §WS-02 step 2.2): red/amber cards for tasks with `priority === "urgent"` from the fetched today/summary data (expiring offers, pickups today, payment releases), each card showing the localized title/subtitle via `t()` and navigating to the task's `deepLink` on tap. Section title via `t()`. Render the section only when at least one urgent task exists.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0, no type errors.
- IF FAIL: fix the errors shown, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 2.8 — Build today's-tasks checklist
- DO: In `website/src/views/dashboard/DashboardHome.tsx`, render the today's-tasks checklist from the `getToday()` data: each row shows an icon, the localized `title`/`subtitle` from the task doc, a one-tap primary action that navigates to `deepLink`, and a done toggle that calls `markDone(id, decisionId)` and updates local state so the row flips to done WITHOUT a reload. Strings via `t()`; icon-first rows (P7); no `alert()`/`confirm()` — use `components/toast.ts` for feedback.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0, no type errors.
- IF FAIL: fix the errors shown, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 2.9 — Add done celebration with coins
- DO: In `website/src/views/dashboard/DashboardHome.tsx`, on a successful `markDone`: play a celebration micro-animation on the row (CSS in `website/src/theme/dashboard.css` — add the animation class there if needed) and, when the completed task's `coinsAwarded > 0`, show the coins celebration string from the dashboard locale pair with the coin count as a `t()` param ("+coins where applicable", robust.md §4.2). No hardcoded copy; no invented coin numbers.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0, no type errors.
- IF FAIL: fix the errors shown, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 2.10 — Build module summary grid
- DO: In `website/src/views/dashboard/DashboardHome.tsx`, render the module summary grid: one card per module the active persona can access per the ACL matrix in `website/src/lib/dashboard.ts`; each card shows the live open count and a one-line status string (from the dashboard locale pair, count/amount as `t()` params — e.g. offers-expiring / rent-overdue patterns) sourced from the `summary()` response's `moduleCounts` and `topUrgent`. A module with zero open tasks shows its honest empty/zero state string — never an invented number.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0, no type errors.
- IF FAIL: fix the errors shown, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 2.11 — Build money snapshot, remove hardcoded metric pills
- DO: In `website/src/views/dashboard/DashboardHome.tsx`, render the money snapshot section from the `/intelligence` response (pending receivables/payables/settlements fields from WS-01 task 1.11), formatting paisa client-side as ₹. Then DELETE every hardcoded metric pill in this file — including any `PersonaBanner` metrics fed from static config — so the snapshot replaces them (instructions.md §WS-02 step 2.5). If `PersonaBanner` in `website/src/components/dashboard/tiles.tsx` takes metrics only from static config, stop passing them; missing API data renders a loading/empty state, never a fallback number.
- RUN: `cd website && pnpm exec tsc --noEmit && grep -rn "?? [0-9]" src/views/dashboard/DashboardHome.tsx || echo CLEAN`
- EXPECT: exit 0 from `tsc`; grep prints `CLEAN` (no `?? <number>` in the file).
- IF FAIL: remove the hardcoded fallback/metric and re-run — else STOP (playbook §5) with full output.
- [x]

### Task 2.12 — Build persona switcher + aggregate mode
- DO: In `website/src/views/dashboard/DashboardHome.tsx`, add the "All profiles" aggregate toggle (string from the dashboard locale pair): when ON, fetch `summary('all')` and union tasks across the user's `linkedProfiles`; when OFF, use the active persona only. The farmer persona defaults the toggle ON (robust.md §4.2 — farmer is the super-user); other personas default OFF. Persist nothing server-side; local state is fine.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0, no type errors.
- IF FAIL: fix the errors shown, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 2.13 — Add hero card mount point
- DO: In `website/src/views/dashboard/DashboardHome.tsx`, add the hero next-best-action mount point as the FIRST section above the urgent strip: render it only when a fetched task carries `headline_task === true` (WS-03 attaches this server-side); for now it renders the task's localized title + primary action navigating to `deepLink` (WS-03 task 3.13 replaces this with the full hero component). Section order after this task: hero → urgent strip → today's tasks → module summary grid → money snapshot → persona switcher/aggregate toggle.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0, no type errors.
- IF FAIL: fix the errors shown, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 2.14 — Keep persona home boards mounted below
- DO: In `website/src/views/dashboard/DashboardHome.tsx`, confirm the existing persona home boards (`SellerHomeBoard`, `TransportHomeBoard`, `BrokerHomeBoard`, `BuyerHomeBoard`, `LandlordHomeBoard`, `EquipmentOwnerHomeBoard`, `CustomerHomeBoard`, `InstructorHomeBoard`, `DairyManagerHomeBoard`) still render BELOW the new Action Center sections, unchanged (they are refactored in phases 02–04, not here). Restore any the rebuild accidentally dropped.
- RUN: `cd website && grep -c "HomeBoard" src/views/dashboard/DashboardHome.tsx && pnpm exec tsc --noEmit`
- EXPECT: `grep -c` prints a number ≥ 9 (all boards still referenced); `tsc` exits 0.
- IF FAIL: restore the missing board import/JSX exactly as it was, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 2.15 — Assert deep-link route integrity client-side
- DO: In `website/src/views/dashboard/DashboardHome.tsx`, add a route-integrity guard for task actions: build the set of registered route prefixes from `website/src/App.tsx` (export a `ROUTE_PREFIXES` constant from a small new module `website/src/lib/routes.ts` (new) listing the `path=` prefixes, or reuse an existing registry if one exists); when rendering a task's action button, check the task's `deepLink` against that set — unknown route → render the task WITHOUT the action button (never a dead tap, robust.md §4.3). All other task rendering is unchanged.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0, no type errors.
- IF FAIL: fix the errors shown, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 2.16 — Add loading skeletons and honest empty states
- DO: In `website/src/views/dashboard/DashboardHome.tsx`, add per P7: skeleton card placeholders (styles in `website/src/theme/dashboard.css` if not already present) while any section's fetch is in flight, and an honest empty state with an icon per section when its data is empty (all strings from the dashboard locale pair — "no tasks today" etc.). No fake numbers anywhere in loading or empty states.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0, no type errors.
- IF FAIL: fix the errors shown, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 2.17 — WS-02 cleanliness gate
- DO: Run the scriptable parts of the WS-02 acceptance: the `?? <number>` grep over all dashboard views, and a spot check that the new dashboard keys exist in both locale files.
- RUN: `cd website && grep -rn "?? [0-9]" src/views || echo CLEAN; grep -c ":" src/lib/i18n/locales/en.dashboard.ts src/lib/i18n/locales/hi.dashboard.ts`
- EXPECT: grep prints `CLEAN` (robust.md §4.3: zero hardcoded metrics); both locale files print a key count > 0 and the counts are equal.
- IF FAIL: remove the offending fallback or fix locale parity, re-run — else STOP (playbook §5) with full output.
- [x]

### Task 2.18 — HUMAN CHECK: Action Center walkthrough
- DO: Human: start the app with `./run.sh --no-mobile` from the repo root (API :8000, website :5173). Log in at http://localhost:5173 as a multi-profile user. (1) Confirm the five sections render with live data on the farmer persona and on one business persona; (2) toggle "All profiles" and confirm tasks from both personas union; (3) tap a task → confirm it lands on its module screen (no dead tap, no "coming soon"); (4) mark a task done → confirm the celebration plays, coins show when `coinsAwarded > 0`, and the summary count decrements without a reload; (5) switch language to Hindi and re-walk the page, confirming every new label is Hindi.
- RUN: manual — no command (human walks the UI above).
- EXPECT: human confirms all five checks pass.
- IF FAIL: human reports the failing step with a screenshot/console error; fix the implicated component, then repeat that step — else STOP (playbook §5) with full output.
- [ ]

### Task 2.19 — WS-02 checkpoint: verify + commit
- DO: Run the WS-02 Verification block from instructions.md §WS-02, then commit: `git add -A && git commit -m "phase-01 WS-02: Website Action Center"`.
- RUN: `cd website && pnpm exec tsc --noEmit && pnpm build && grep -rn "?? [0-9]" src/views || echo "clean"`
- EXPECT: `tsc` clean, `pnpm build` exits 0, grep prints `clean`; then the commit succeeds (if git identity is missing, note it and continue — playbook §6).
- IF FAIL: fix the build/grep failure, re-run; only commit when green — else STOP (playbook §5) with full output.
- [x]

## WS-03 — Task ranking AI  (see instructions.md §WS-03)

### Task 3.1 — Confirm AI foundation and read orientation files
- PRECONDITION: `test -d backend/app/services/ai` — if this fails, STOP the phase (playbook §5): phase-00's AI foundation is missing and WS-03/WS-04 cannot start. (Per the phase readme this directory did not exist at planning time.)
- DO: Read these files (no edits): `backend/app/services/ai/gateway.py`, `backend/app/services/ai/question_sets.py`, `backend/app/services/ai/privacy.py`, `backend/app/services/ai/outcomes.py`, `backend/app/services/ai/shim.py`, `backend/app/routers/tasks.py`, `backend/app/routers/intelligence.py`, `website/src/views/dashboard/DashboardHome.tsx`, `website/src/lib/dashboard.ts`. Also confirm WS-01 landed (the temporary-adapter path in instructions.md §WS-03 step 7 applies ONLY if WS-01 is somehow not landed — with this precondition green it is not needed; do not build it).
- RUN: `ls backend/app/services/ai/gateway.py backend/app/services/ai/question_sets.py backend/app/services/ai/privacy.py backend/app/services/ai/outcomes.py backend/app/services/ai/shim.py && grep -n "def emit_task" backend/app/services/tasks.py`
- EXPECT: exit 0; all five `services/ai` files listed; grep prints the `emit_task` definition line.
- IF FAIL: any missing file → STOP the phase (playbook §5).
- [ ]

### Task 3.2 — Register tasks.rank.v1 question set
- DO: In `backend/app/services/ai/question_sets.py`, register the question set `tasks.rank.v1` exactly per AI plan §2 (see `missing-features/ai_implementation_plan.md`): output schema = per-task `impact` score (0–1) plus a single `headline_task` choice (the taskId of the next-best action); set `confidence_threshold`, `automation_level: "suggest"` (ranking annotates, the user still taps — never auto-acts), and `fallback_fn` = due-date sort. Follow the registration pattern of the question sets already in that file.
- RUN: `cd backend && .venv/bin/python -c "from app.services.ai import question_sets as q; s=[x for x in dir(q) if 'rank' in x.lower()]; print(s)" && .venv/bin/python -m pytest -q tests/ -k "question_set or questionset" 2>/dev/null | tail -2`
- EXPECT: exit 0; the first command prints a non-empty list referencing `tasks.rank.v1` (or the registry getter returns it); any existing question-set tests still pass (or print "no tests ran").
- IF FAIL: fix the registration to match the file's existing pattern, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.3 — Build ranking state builder with privacy + batching
- DO: In `backend/app/services/tasks.py` (or a new `backend/app/services/task_ranking.py` (new) if it keeps `tasks.py` focused — pick one and use it consistently), add the `tasks.rank.v1` state builder: pseudonymized user id via `privacy.py` (`HMAC(user_id, AI_HASH_SALT)` — never the raw uid, no phones/emails/Aadhaar in the payload), the task list (per task: `module`, `kind`, `priority`, `dueAt`, localized `title`), plus `persona` and a compact `/intelligence` money-context snippet — target ≤1,500 tokens. Add the batching wrapper: at most 10 tasks per `decide()` call; chunk larger lists and merge the ranked results (M5 step 1).
- RUN: `cd backend && .venv/bin/python -c "import app.services.tasks as t; print('ok')" && .venv/bin/python -m pytest -q tests/test_tasks.py`
- EXPECT: exit 0; import prints `ok`; all `test_tasks.py` tests still pass.
- IF FAIL: fix the error shown (never weaken tests), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.4 — Rank GET /v1/tasks/today before return
- DO: In `backend/app/routers/tasks.py`, in the `GET /today` handler: after building the open-task list, call `gateway.decide(state, "tasks.rank.v1", ctx)` with the task-3.3 state builder; order the response by the returned ranking; attach `headline_task: true` to the chosen task and `decisionId` on each ranked item (fields reserved in WS-01). The model call goes ONLY through `backend/app/services/ai/gateway.py` — never OpenRouter/Gemini from the router (rule 10).
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q tests/test_tasks.py -k "today"`
- EXPECT: exit 0; the today tests pass with `AI_PROVIDER=shim`.
- IF FAIL: fix the handler (never the test), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.5 — Rank GET /v1/tasks/summary before return
- DO: In `backend/app/routers/tasks.py`, in the `GET /summary` handler: rank each persona's open tasks with `tasks.rank.v1` the same way as task 3.4 — attach `headline_task: true` to the per-persona chosen task and `decisionId` on ranked items; keep the `moduleCounts`/`topUrgent` response shape from WS-01 unchanged otherwise.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q tests/test_tasks.py -k "summary"`
- EXPECT: exit 0; the summary tests pass with `AI_PROVIDER=shim`.
- IF FAIL: fix the handler (never the test), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.6 — Implement deterministic fallback and flag-off path
- DO: In `backend/app/routers/tasks.py` (and/or the ranking helper from task 3.3): wrap every `gateway.decide` call so that on gateway exception, timeout, or budget trip the endpoints fall back to plain due-date sort (urgent-first then dueAt, same as WS-01 ordering) and log the call with `fallbackUsed` per the SDR recipe; when the module flag in `platform_config/ai.modules` is off, skip the AI call entirely — plain due-date ordering, no errors, no `headline_task`. Every AI call (success or fallback) is logged to `ai_decisions` with cost + confidence.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q tests/test_tasks.py`
- EXPECT: exit 0; the full `test_tasks.py` file passes with `AI_PROVIDER=shim`.
- IF FAIL: fix the fallback wiring (never the tests), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.7 — Wire outcome hook into done handler
- DO: In `backend/app/routers/tasks.py`, in `POST /{task_id}/done`: when the request carried a `decisionId` (WS-01 stored it) and the task is being completed within 24 h of when it was headlined (compare completion time to the decision's `createdAt` in `ai_decisions` via `outcomes.py`'s lookup), call `record_outcome(decision_id, "task-completed-within-24h")` from `backend/app/services/ai/outcomes.py`. No outcome write when `decisionId` is absent or the window has passed.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q tests/test_tasks.py -k "done"`
- EXPECT: exit 0; the done tests pass with `AI_PROVIDER=shim`.
- IF FAIL: fix the hook wiring (never the tests), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.8 — Create golden fixture for tasks.rank.v1
- DO: Create `backend/tests/fixtures/ai/golden/tasks.rank.v1.jsonl` (new): golden input/output pairs for the shim provider following the format of any existing golden fixtures under `backend/tests/fixtures/ai/golden/` (match that format exactly if files exist; otherwise one JSON object per line with `input` state and expected `output` ranking + `headline_task`). Cases: a clear-urgent-winner list, an all-equal-priority list (deterministic tie-break), and a >10-task list exercising the task-3.3 chunking.
- RUN: `cd backend && .venv/bin/python -c "import json; [json.loads(l) for l in open('tests/fixtures/ai/golden/tasks.rank.v1.jsonl') if l.strip()]; print('valid jsonl')"`
- EXPECT: exit 0; prints `valid jsonl`.
- IF FAIL: fix the malformed JSONL line, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.9 — Test shim ranking determinism
- DO: In `backend/tests/test_tasks.py` (or the phase-00 AI test file if one exists for golden fixtures — use it if present), add `test_rank_v1_shim_is_deterministic`: with `AI_PROVIDER=shim`, call the ranked `GET /v1/tasks/today` twice over the same seeded tasks and assert identical ordering and identical `headline_task`; add `test_rank_v1_golden_fixture` replaying the task-3.8 fixture through the shim and asserting the expected outputs.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q tests/test_tasks.py -k "rank or golden or deterministic"`
- EXPECT: exit 0; the new tests pass.
- IF FAIL: fix the ranking code to be deterministic (never the test), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.10 — Test fallback and flag-off behavior
- DO: In `backend/tests/test_tasks.py`, add `test_rank_fallback_on_gateway_error` (monkeypatch `gateway.decide` to raise; `GET /v1/tasks/today` still returns 200 with due-date ordering and no `headline_task`) and `test_rank_flag_off_due_date_order` (module flag off in `platform_config/ai`; endpoints work with plain due-date order and zero AI calls — assert no new `ai_decisions` docs).
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q tests/test_tasks.py -k "fallback or flag"`
- EXPECT: exit 0; the new tests pass.
- IF FAIL: fix the fallback/flag code (never the tests), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.11 — Build AiBadge primitive component
- DO: Create `website/src/components/ai/AiBadge.tsx` (new) — the shared confidence-tinted "AI sujhav" badge primitive from AI plan §6, built here and exported for reuse by later briefs: props `confidence: number` and optional `labelKey`; tint varies by confidence band; label via `t()` (no hardcoded strings). Export it from the component module for reuse.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0, no type errors.
- IF FAIL: fix the type errors shown, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.12 — Implement ConfidenceGate behavior
- DO: In `website/src/views/dashboard/DashboardHome.tsx` (or a small `website/src/components/ai/ConfidenceGate.tsx` (new) — pick one and use it consistently), implement the ConfidenceGate behavior for ranked tasks: when the ranking `confidence` meets the question set's threshold → the hero task's primary action is preselected/highlighted; below threshold → neutral display, no nudge (suggest-level automation only — the user always taps). Attach the task-3.11 `<AiBadge>` to AI-ranked items.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0, no type errors.
- IF FAIL: fix the errors shown, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.13 — Build hero next-best-action card
- DO: In `website/src/views/dashboard/DashboardHome.tsx`, replace the task-2.13 placeholder mount point with the full hero next-best-action card: renders the task carrying `headline_task === true` at the top of the dashboard with its localized title/subtitle, the `<AiBadge>`, the ConfidenceGate behavior from task 3.12, and a primary action navigating to the task's `deepLink` (subject to the task-2.15 route-integrity guard). Hidden entirely when no `headline_task` is present (flag-off state renders nothing here, no errors). The today's-tasks list renders in the ranked order returned by the API.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0, no type errors.
- IF FAIL: fix the errors shown, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.14 — Add hero + badge i18n keys (en + hi)
- DO: In `website/src/lib/i18n/locales/en.dashboard.ts` AND `website/src/lib/i18n/locales/hi.dashboard.ts`, add the keys for the hero card (title, subtitle template, primary action) and the `<AiBadge>` label — identical key sets in both files, Hindi translations in `hi.dashboard.ts`.
- RUN: `cd website && grep -o "^[[:space:]]*[a-zA-Z0-9_]*:" src/lib/i18n/locales/en.dashboard.ts | sort > /tmp/en3.keys; grep -o "^[[:space:]]*[a-zA-Z0-9_]*:" src/lib/i18n/locales/hi.dashboard.ts | sort > /tmp/hi3.keys; diff /tmp/en3.keys /tmp/hi3.keys && echo PARITY_OK && pnpm exec tsc --noEmit`
- EXPECT: output contains `PARITY_OK` and `tsc` exits 0.
- IF FAIL: fix locale parity or the type errors, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 3.15 — HUMAN CHECK: hero stability, flag-off, outcome
- DO: Human: with the app running via `./run.sh --no-mobile` and `AI_PROVIDER=shim` for the backend: (1) open a persona dashboard, note the hero card, reload — confirm the SAME hero card renders (shim-stable); (2) disable the ranking module flag in `platform_config/ai` and reload — confirm the list falls back to due-date order with no errors and the hero is hidden or neutral; re-enable the flag; (3) complete the hero task from its card → confirm in Firestore (or the admin tooling) that an `ai_decisions` outcome `task-completed-within-24h` was recorded for that `decisionId`.
- RUN: manual — no command (human walks the three checks above).
- EXPECT: human confirms all three checks pass.
- IF FAIL: human reports the failing step with console/backend-log output; fix the implicated code, repeat that step — else STOP (playbook §5) with full output.
- [ ]

### Task 3.16 — WS-03 checkpoint: verify + commit
- DO: Run the WS-03 Verification block from instructions.md §WS-03, then commit: `git add -A && git commit -m "phase-01 WS-03: Task ranking AI"`.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q && cd ../website && pnpm exec tsc --noEmit && pnpm build`
- EXPECT: backend suite fully green with `AI_PROVIDER=shim`; `tsc` clean; `pnpm build` exits 0; then the commit succeeds (if git identity is missing, note it and continue — playbook §6).
- IF FAIL: fix the failure shown (never weaken tests), re-run; only commit when green — else STOP (playbook §5) with full output.
- [ ]

## WS-04 — Kisan Mitra 2.0  (see instructions.md §WS-04)

### Task 4.1 — Confirm AI foundation and read orientation files
- PRECONDITION: `test -d backend/app/services/ai` — if this fails, STOP the phase (playbook §5): phase-00's AI foundation is missing.
- DO: Read these files (no edits): `backend/app/services/chatbot.py` (existing Kisan Mitra Gemini prompt — keep it; the model call must go through `gateway.generate()` per phase-00), `backend/app/routers/chatbot.py`, `backend/app/routers/intelligence.py`, `backend/tests/test_chatbot.py`, `backend/app/services/ai/question_sets.py`, `backend/app/services/ai/privacy.py`, `website/src/lib/api/client.ts`, `website/src/views/trade/ChatRoomPage.tsx` (chat UI patterns), `website/src/components/ModalSheet.tsx`, `website/src/lib/dashboard.ts` (note the `chats` toolId at line ~77).
- RUN: `ls backend/app/services/chatbot.py backend/app/routers/chatbot.py backend/tests/test_chatbot.py website/src/views/trade/ChatRoomPage.tsx website/src/components/ModalSheet.tsx && grep -n "expert_tickets\|expert-handoff\|/messages\|/history\|/experts" backend/app/routers/chatbot.py | head`
- EXPECT: exit 0; all files listed; grep prints the existing chatbot endpoints (`POST /messages`, `GET /history`, `POST /expert-handoff` writing `expert_tickets`, `GET /experts`).
- IF FAIL: a cited file or endpoint is missing/renamed → STOP the phase (playbook §5) and report the contradiction.
- [ ]

### Task 4.2 — Register chatbot.intent.v1 with golden fixture
- DO: In `backend/app/services/ai/question_sets.py`, register `chatbot.intent.v1` per AI plan §2: output schema = `intent` as choice(`agronomy`/`market`/`app_help`/`money`/`human_needed`) plus an `answerable` score (0–1); set `confidence_threshold` and `automation_level: "suggest"`. Create the golden fixture `backend/tests/fixtures/ai/golden/chatbot.intent.v1.jsonl` (new) with input/output pairs covering all five intents plus a low-answerable case (format matching task 3.8's fixture).
- RUN: `cd backend && .venv/bin/python -c "import json; [json.loads(l) for l in open('tests/fixtures/ai/golden/chatbot.intent.v1.jsonl') if l.strip()]; print('valid jsonl')" && .venv/bin/python -c "from app.services.ai import question_sets; print('import ok')"`
- EXPECT: exit 0; prints `valid jsonl` and `import ok`.
- IF FAIL: fix the fixture/registration error shown, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 4.3 — Register chatbot.safety.v1 with golden fixture
- DO: In `backend/app/services/ai/question_sets.py`, register `chatbot.safety.v1` per AI plan §2: output schema = booleans `has_contact_info`, `has_financial_advice`, `has_medical_certainty`. Create `backend/tests/fixtures/ai/golden/chatbot.safety.v1.jsonl` (new) with cases: a phone-number-sharing reply (`has_contact_info: true`), a loan-advice reply (`has_financial_advice: true`), a medical-certainty reply, and a clean reply (all false).
- RUN: `cd backend && .venv/bin/python -c "import json; [json.loads(l) for l in open('tests/fixtures/ai/golden/chatbot.safety.v1.jsonl') if l.strip()]; print('valid jsonl')"`
- EXPECT: exit 0; prints `valid jsonl`.
- IF FAIL: fix the malformed line or registration, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 4.4 — Add intent routing to the message flow
- DO: In `backend/app/services/chatbot.py` and `backend/app/routers/chatbot.py` (keep the split of responsibilities the files already have): on each user message to `POST /v1/chatbot/messages`, call `gateway.decide(state, "chatbot.intent.v1", ctx)` (gateway only — never Gemini/OpenRouter directly, rule 10). Routing: if `intent == "human_needed"` OR `answerable < 0.6` → take the EXISTING `expert_tickets` handoff path already used by `POST /v1/chatbot/expert-handoff` (M2 step 1) instead of a bot answer. Log the decision to `ai_decisions` with cost + confidence.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q tests/test_chatbot.py`
- EXPECT: exit 0; existing chatbot tests pass on shim.
- IF FAIL: fix the flow wiring (never weaken tests), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 4.5 — Handle money intent with neutral-explanation-only replies
- DO: In `backend/app/services/chatbot.py`: when the task-4.4 intent is `money`, the bot answers ONLY with a neutral explanation plus an offer of expert handoff — never prescriptive money/credit/insurance/legal advice (rule 12: these topics never exceed `require_confirm`; the bot explains and routes to a human, it never advises a decision). Add the neutral-answer + handoff-offer copy as constants keyed by user language (en/hi at minimum) in the service, not inline in the router.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q tests/test_chatbot.py`
- EXPECT: exit 0; tests pass on shim.
- IF FAIL: fix the branch (never the tests), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 4.6 — Prepend persona-aware system prompt
- DO: In `backend/app/services/chatbot.py` (M2 step 2): build the system prompt as [active persona + a compact `/intelligence` summary snippet (reuse the numbers-layer call, trimmed to a few lines) + user language] prepended to the EXISTING Kisan Mitra prompt (keep that prompt text unchanged). Pseudonymize the user id via `privacy.py` (`HMAC(user_id, AI_HASH_SALT)`); the payload must contain no phone numbers, emails, or Aadhaar (rule 11).
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q tests/test_chatbot.py`
- EXPECT: exit 0; tests pass on shim.
- IF FAIL: fix the prompt builder (never the tests), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 4.7 — Add safety post-check with strip/regenerate/fallback
- DO: In `backend/app/services/chatbot.py` (M2 step 3 + SDR step 5): after the model generates a reply, run `gateway.decide(state, "chatbot.safety.v1", ctx)` on the reply text. On ANY flag: strip the offending content and regenerate ONCE; if the regeneration is still flagged, return the static safe fallback text in the user's language (add en/hi fallback constants in the service). The bot must never emit phone numbers, UPI IDs, or external links (rule 4). Log every safety decision to `ai_decisions` with cost + confidence.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q tests/test_chatbot.py`
- EXPECT: exit 0; tests pass on shim.
- IF FAIL: fix the post-check wiring (never the tests), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 4.8 — Test intent routing and handoff triggers
- DO: In `backend/tests/test_chatbot.py` (extend — do not remove existing tests), add: `test_intent_human_needed_creates_ticket` (shim intent `human_needed` on a message → an `expert_tickets` doc created, same shape as the existing handoff path) and `test_low_answerable_triggers_handoff` (shim `answerable < 0.6` → handoff path taken instead of a bot answer). Reuse the shim/golden mechanisms from WS-03 tests for controlling `gateway.decide` outputs.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q tests/test_chatbot.py -k "intent or answerable or handoff"`
- EXPECT: exit 0; the new tests (and any existing handoff tests) pass.
- IF FAIL: fix the routing code (never the tests), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 4.9 — Test safety post-check and persona prompt
- DO: In `backend/tests/test_chatbot.py`, add: `test_safety_flag_strips_and_regenerates` (first reply flagged → stripped/regenerated clean reply returned), `test_safety_double_flag_returns_fallback` (both attempts flagged → static safe fallback text in the user's language), `test_persona_snippet_in_prompt_state` (the prompt state sent to the gateway contains the active persona and the intelligence snippet, and contains no phone/email/Aadhaar), and `test_chatbot_golden_fixtures_on_shim` (both task-4.2/4.3 fixtures replay clean on shim).
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q tests/test_chatbot.py`
- EXPECT: exit 0; the full `test_chatbot.py` file passes on shim.
- IF FAIL: fix the chatbot code (never the tests), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 4.10 — Create chatbot API wrapper
- DO: Create `website/src/lib/api/chatbot.ts` (new) following the conventions of the existing wrappers (e.g. `website/src/lib/api/chat.ts`): export `sendMessage(text)` → `POST /v1/chatbot/messages`, `getHistory()` → `GET /v1/chatbot/history`, `requestHandoff(...)` → `POST /v1/chatbot/expert-handoff`, `listExperts()` → `GET /v1/chatbot/experts`, with TypeScript types for messages and expert tickets matching the backend payloads. Do NOT add an `Idempotency-Key` header — `client.ts` injects it on writes.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0, no type errors.
- IF FAIL: fix the type errors shown, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 4.11 — Build Kisan Mitra chat sheet with FAB
- DO: Create the Kisan Mitra chat sheet: a floating action button (FAB) on `website/src/views/dashboard/DashboardHome.tsx` that opens a `website/src/components/ModalSheet.tsx`-based chat panel (new component `website/src/components/chatbot/KisanMitraSheet.tsx` (new)) with a message list, text input, send action via `sendMessage`, and a typing/awaiting state while the reply is in flight. Follow the chat UI patterns in `website/src/views/trade/ChatRoomPage.tsx`. All strings via `t()`; no `alert()`/`prompt()`/`confirm()` — use `components/toast.ts`.
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0, no type errors.
- IF FAIL: fix the errors shown, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 4.12 — Build expert-handoff thread view
- DO: In `website/src/components/chatbot/KisanMitraSheet.tsx`: when a handoff happens (bot routes to expert, or the user taps the handoff action calling `requestHandoff`), render a persistent thread block bound to the `expert_tickets` record showing the "expert se jawab aayega" status string (ai.md flow 5.3 step 3) with the ticket status; on sheet open, reload history via `getHistory()` so the thread is visible on return (persistence comes from the history endpoint, not local state only).
- RUN: `cd website && pnpm exec tsc --noEmit`
- EXPECT: exit 0, no type errors.
- IF FAIL: fix the errors shown, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 4.13 — Add chat i18n keys (en + hi + mr)
- DO: Add the chat-surface strings — FAB label, sheet title, input placeholder, send, typing state, handoff offer, "expert se jawab aayega" thread status, safe-fallback display, empty history — to a locale module pair: either the WS-02 `en.dashboard.ts`/`hi.dashboard.ts` pair or a new `website/src/lib/i18n/locales/en.chatbot.ts` + `hi.chatbot.ts` pair (pick one; if new, register it in `website/src/lib/i18n/index.ts` per task 2.5's pattern). ALSO add Marathi coverage for every chat-surface key in `website/src/lib/i18n/locales/mr.ts` (Marathi round-trip is an acceptance requirement).
- RUN: `cd website && pnpm exec tsc --noEmit && for k in $(grep -o "^[[:space:]]*[a-zA-Z0-9_]*:" src/lib/i18n/locales/en.chatbot.ts 2>/dev/null || grep -o "^[[:space:]]*[a-zA-Z0-9_]*:" src/lib/i18n/locales/en.dashboard.ts); do grep -q "$k" src/lib/i18n/locales/mr.ts || echo "MISSING_IN_MR: $k"; done; echo MR_CHECK_DONE`
- EXPECT: `tsc` exits 0; the loop prints no `MISSING_IN_MR` lines (every chat key exists in `mr.ts`); ends with `MR_CHECK_DONE`.
- IF FAIL: add the missing keys to `mr.ts` (Marathi translations), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 4.14 — Wire dashboard Kisan Mitra tile to the sheet
- DO: In `website/src/lib/dashboard.ts` and the tile-rendering code that consumes it (`website/src/components/dashboard/tiles.tsx` / `DashboardHome.tsx` — wherever the `chats` toolId currently renders): add/rename a "Chat (Kisan Mitra)" tile entry for the existing `chats` toolId (line ~77 of `lib/dashboard.ts`) and point its action at opening the task-4.11 chat sheet. Remove any "coming soon" behavior for this toolId — tapping the tile opens the sheet, always.
- RUN: `cd website && grep -n "coming soon\|comingSoon\|coming_soon" src/components/dashboard/tiles.tsx src/views/dashboard/DashboardHome.tsx src/lib/dashboard.ts; pnpm exec tsc --noEmit`
- EXPECT: grep prints nothing for the `chats`/Kisan Mitra tile path (no coming-soon behavior left for it); `tsc` exits 0.
- IF FAIL: remove the coming-soon branch for the tile and wire the sheet open action, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 4.15 — HUMAN CHECK: chat round-trips, red team, persistence
- DO: Human: with the app running via `./run.sh --no-mobile` and the backend on `AI_PROVIDER=shim` (or dev Gemini config from the human operator for the language checks): (1) open the dashboard FAB → ask an agronomy question in Hindi, then in Marathi → confirm the replies come back in the same language and are persona-aware; (2) send "mujhe loan chahiye, kya karun" → confirm a neutral explanation + handoff offer, never advice; (3) try sharing a phone number in a reply context → confirm it is filtered/stripped; (4) request an expert → confirm the "expert se jawab aayega" thread appears; reload the page and reopen the sheet → confirm the thread persists.
- RUN: manual — no command (human walks the four checks above).
- EXPECT: human confirms all four checks pass (with shim, canned answers flow and the UI still works end-to-end).
- IF FAIL: human reports the failing step with console/backend output; fix the implicated code, repeat that step — else STOP (playbook §5) with full output.
- [ ]

### Task 4.16 — WS-04 checkpoint: verify + commit
- DO: Run the WS-04 Verification block from instructions.md §WS-04, then commit: `git add -A && git commit -m "phase-01 WS-04: Kisan Mitra 2.0"`.
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q tests/test_chatbot.py && cd ../website && pnpm exec tsc --noEmit && pnpm build`
- EXPECT: `test_chatbot.py` fully green on shim; `tsc` clean; `pnpm build` exits 0; then the commit succeeds (if git identity is missing, note it and continue — playbook §6).
- IF FAIL: fix the failure shown (never weaken tests), re-run; only commit when green — else STOP (playbook §5) with full output.
- [ ]

## WS-05 — Module task emission sweep  (see instructions.md §WS-05)

### Task 5.1 — Read orientation files and the emission table
- DO: Read `backend/app/services/tasks.py` (WS-01, including `DEEP_LINKS`), `website/src/App.tsx`, and `website/src/lib/dashboard.ts` (`PROFILE_ROUTES`, ACL matrix). Read the emission table in instructions.md §WS-05 step 1 — it is the checklist for tasks 5.2–5.33. Verify the cited module routers exist.
- RUN: `ls backend/app/routers/advisory.py backend/app/routers/weather.py backend/app/routers/offers.py backend/app/routers/lots.py backend/app/routers/purchases.py backend/app/routers/transport.py backend/app/routers/equipment.py backend/app/routers/equipment_owner.py backend/app/routers/land.py backend/app/services/rent_reminders.py backend/app/routers/dairy_manager.py backend/app/routers/loans.py backend/app/routers/finance.py backend/app/routers/insurance.py backend/app/routers/insurance_claims.py backend/app/routers/contracts.py backend/app/routers/direct_buyer.py backend/app/routers/schemes.py backend/app/services/eligibility.py backend/app/routers/courses.py backend/app/routers/teachers.py backend/app/routers/broker.py backend/app/routers/post_harvest.py backend/app/routers/gamification.py backend/app/routers/referrals.py backend/app/routers/users.py`
- EXPECT: exit 0; all 26 paths printed.
- IF FAIL: a cited router is missing/renamed → STOP the phase (playbook §5) and report the contradiction.
- [ ]

### Task 5.2 — Wire emit_task into advisory/crop_cycles
- DO: In `backend/app/routers/advisory.py` (and the advisory service it calls, if transitions live there), call `await emit_task(...)` (import from `app.services.tasks`) at the existing advisory state transitions for the §WS-05 table row "crop_cycles / advisory": sowing-window advisories ("Sow tomato this week"), spray-window advisories ("Spray window tomorrow 6–9am"), sowing-intent nudges, saturation warnings. Per call: `module="advisory"`, a snake_case `kind` per trigger (e.g. `sowing_window`, `spray_window`, `sowing_intent_nudge`, `saturation_warning`), `title_en` from the table example, `title_hi` its Hindi translation, `subtitle` from real values in the triggering doc (no invented numbers), `priority` per time pressure (`spray_window` → `urgent`), `due_at` ISO from the doc when a deadline exists, `source_id` = the advisory/crop-cycle doc id, `deep_link` = `DEEP_LINKS["advisory"]` (+ doc id if parameterized). FIRST run the deep-link gate: `grep -n "path=" website/src/App.tsx` — if no advisory route exists, instead write a dated deferral note in `missing-features/robust.md` under the advisory module's §7 entry and skip emission (never a dead-end task). If a transition also writes a notification doc, set its `data.deepLink` to the same value.
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_advisory.py`
- EXPECT: exit 0; existing advisory tests pass (emission wired or deferral note written).
- IF FAIL: fix the wiring (never weaken tests), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.3 — Test advisory task emission
- DO: In `backend/tests/test_advisory.py` (extend — do not remove tests), add `test_advisory_transition_emits_task`: perform one wired transition from task 5.2 (or, if 5.2 ended in a deferral note, assert nothing and mark this task [x] with the note "deferred per robust.md"), then assert a `tasks` doc exists with `module="advisory"`, the expected `kind`, `status="open"`, non-empty `title.en` and `title.hi`, and a `deepLink` present in `DEEP_LINKS` from `app.services.tasks`.
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_advisory.py`
- EXPECT: exit 0; all advisory tests pass.
- IF FAIL: fix the emission code (never the test), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.4 — Wire emit_task into weather alerts
- DO: In `backend/app/routers/weather.py` / `backend/app/services/weather.py`, at the severe-weather alert transition, call `await emit_task(...)` for the §WS-05 table row "weather": "Heavy rain in 48h — delay urea" (`module="weather"`, `kind="severe_weather_alert"`, `priority="urgent"`, `title_en`/`title_hi` from the example + Hindi, `subtitle` from real alert values, `due_at` = alert window start ISO, `source_id` = the alert doc id, `deep_link` = `DEEP_LINKS["weather"]`). Deep-link gate first: `grep -n "path=" website/src/App.tsx`; no weather route → dated deferral note in `missing-features/robust.md` under weather's §7 entry, skip emission. If the transition also writes a notification doc, set `data.deepLink` to the same value.
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_weather.py`
- EXPECT: exit 0; existing weather tests pass.
- IF FAIL: fix the wiring, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.5 — Test weather task emission
- DO: In `backend/tests/test_weather.py`, add `test_severe_weather_emits_task`: trigger the alert path and assert a `tasks` doc with `module="weather"`, `kind="severe_weather_alert"`, `status="open"`, localized `title.en`/`title.hi`, `deepLink` in `DEEP_LINKS` (or mark [x] with "deferred per robust.md" if task 5.4 deferred).
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_weather.py`
- EXPECT: exit 0; all weather tests pass.
- IF FAIL: fix the emission code, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.6 — Wire emit_task into trade (lots/offers/purchases)
- DO: In `backend/app/routers/offers.py`, `backend/app/routers/lots.py`, and `backend/app/routers/purchases.py`, call `await emit_task(...)` at the transitions for the §WS-05 table row "trade": new offers on a lot ("3 new offers on your onion lot" — count from the real offers query), counter expiring ("Counter expires in 6h"), pickup scheduled ("Pickup scheduled — keep produce ready"), payment pending release ("Payment ₹18,400 pending release" — integer paisa from the purchase/settlement doc, formatted client-side). `module="trade"`, kinds e.g. `new_offers`, `counter_expiring`, `pickup_scheduled`, `payment_pending_release`; `source_id` = the offer/lot/purchase doc id; `deep_link` = `DEEP_LINKS["trade"]` (or `DEEP_LINKS["purchases"]` for the payment row) + doc id for parameterized routes. Deep-link gate first via `grep -n "path=" website/src/App.tsx` (the `myOffers`/`purchases` routes exist — use them); notification `data.deepLink` aligned where notifications are also written.
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_demands_offers.py tests/test_lots.py tests/test_purchases.py`
- EXPECT: exit 0; existing trade tests pass.
- IF FAIL: fix the wiring, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.7 — Test trade task emission
- DO: In `backend/tests/test_demands_offers.py`, add `test_offer_created_emits_task`: create an offer on another user's lot and assert a `tasks` doc for the lot owner with `module="trade"`, `kind="new_offers"`, `status="open"`, `title.en`/`title.hi` non-empty, `deepLink` in `DEEP_LINKS`. Add a second test for one more wired trade transition (e.g. payment pending release) in the matching test file with the same assertions on its kind.
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_demands_offers.py tests/test_lots.py tests/test_purchases.py`
- EXPECT: exit 0; all trade tests pass.
- IF FAIL: fix the emission code, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.8 — Wire emit_task into transport
- DO: In `backend/app/routers/transport.py`, call `await emit_task(...)` at the transitions for the §WS-05 table row "transport": new booking request, trip starting soon ("Trip starts in 2h"), POD pending upload, weekly settlement ready ("Weekly settlement ₹28,500 ready" — integer paisa). `module="transport"`, kinds e.g. `booking_request`, `trip_starting`, `pod_pending`, `settlement_ready`; `source_id` = the booking/trip/settlement doc id; `deep_link` = `DEEP_LINKS["transport"]` + trip id where parameterized (the `/dashboard/p/transport/trips/:tripId` route exists). Deep-link gate first via `grep -n "path=" website/src/App.tsx`; align notification `data.deepLink` where applicable.
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_transport.py tests/test_tms.py`
- EXPECT: exit 0; existing transport tests pass.
- IF FAIL: fix the wiring, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.9 — Test transport task emission
- DO: In `backend/tests/test_transport.py`, add `test_booking_request_emits_task`: create a booking request and assert a `tasks` doc for the vehicle owner with `module="transport"`, `kind="booking_request"`, `status="open"`, localized titles, `deepLink` in `DEEP_LINKS`.
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_transport.py tests/test_tms.py`
- EXPECT: exit 0; all transport tests pass.
- IF FAIL: fix the emission code, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.10 — Wire emit_task into equipment
- DO: In `backend/app/routers/equipment.py` and `backend/app/routers/equipment_owner.py`, call `await emit_task(...)` at the transitions for the §WS-05 table row "equipment": booking approval needed, machine due back today, service due ("Service due: Mahindra 575" — machine name from the real doc). `module="equipment"`, kinds e.g. `booking_approval_needed`, `machine_due_back`, `service_due`; `source_id` = the booking/machine doc id; `deep_link` = `DEEP_LINKS["equipment"]` if it exists. Deep-link gate first via `grep -n "path=" website/src/App.tsx`; no equipment route → dated deferral note in `missing-features/robust.md` under equipment's §7 entry, skip emission. Align notification `data.deepLink` where applicable.
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_equipment.py tests/test_equipment_approve.py tests/test_equipment_owner.py`
- EXPECT: exit 0; existing equipment tests pass.
- IF FAIL: fix the wiring, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.11 — Test equipment task emission
- DO: In `backend/tests/test_equipment_approve.py`, add `test_booking_approval_emits_task`: request an equipment booking and assert a `tasks` doc for the owner with `module="equipment"`, `kind="booking_approval_needed"`, `status="open"`, localized titles, `deepLink` in `DEEP_LINKS` (or mark [x] with "deferred per robust.md" if task 5.10 deferred).
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_equipment.py tests/test_equipment_approve.py tests/test_equipment_owner.py`
- EXPECT: exit 0; all equipment tests pass.
- IF FAIL: fix the emission code, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.12 — Wire emit_task into land + rent-reminders job
- DO: (a) In `backend/app/services/rent_reminders.py` (the job triggered via `POST /jobs/rent-reminders/run` with the `X-Cron-Secret` header): alongside its existing notification writes, ALSO call `await emit_task(...)` for "Rent due from tenant in 3 days" (`module="land"`, `kind="rent_due"`, `priority` per days-left, `due_at` = due date ISO, `source_id` = the lease doc id + due month so dedupe works per period, ₹ as integer paisa in the subtitle). (b) In `backend/app/routers/land.py`, emit at the transitions for lease expiring in 30 days and new lease request (`kinds` `lease_expiring`, `lease_request`). `deep_link` = `DEEP_LINKS["land"]` if it exists — deep-link gate first via `grep -n "path=" website/src/App.tsx`; no land route → dated deferral note under land's §7 entry in `missing-features/robust.md`, skip emission. Notification `data.deepLink` must carry the same value (continues task 1.13).
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_land.py tests/test_rent_reminders.py`
- EXPECT: exit 0; existing land + rent-reminders tests pass.
- IF FAIL: fix the wiring, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.13 — Test land + rent-reminders task emission
- DO: In `backend/tests/test_rent_reminders.py`, add `test_rent_reminder_job_emits_task`: run the job path and assert BOTH the notification doc AND a `tasks` doc (`module="land"`, `kind="rent_due"`, `status="open"`, localized titles, `deepLink` in `DEEP_LINKS`) exist, and that running the job twice creates only one task (dedupe via `source_id`). In `backend/tests/test_land.py`, add `test_lease_request_emits_task` with the same field assertions for `kind="lease_request"` (or mark [x] with "deferred per robust.md" if task 5.12 deferred).
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_land.py tests/test_rent_reminders.py`
- EXPECT: exit 0; all land + rent-reminders tests pass.
- IF FAIL: fix the emission code, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.14 — Wire emit_task into dairy
- DO: In `backend/app/routers/dairy_manager.py`, call `await emit_task(...)` at the transitions for the §WS-05 table row "dairy": morning collection not logged, payment batch ready to approve, rate chart expiring ("Rate chart expires Sunday"). `module="dairy"`, kinds e.g. `collection_missing`, `payment_batch_ready`, `rate_chart_expiring`; `source_id` = the collection-day/batch/rate-chart doc id; `deep_link` = `DEEP_LINKS["dairy"]` (+ sub-path like `/payments` per `website/src/App.tsx` dairy console routes, e.g. `/dairy/console/payments/:batchId`). Deep-link gate first via `grep -n "path=" website/src/App.tsx` (dairy console routes exist — use the matching one per kind). Align notification `data.deepLink` where applicable.
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/ -k "dairy" `
- EXPECT: exit 0; existing dairy tests pass.
- IF FAIL: fix the wiring, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.15 — Test dairy task emission
- DO: In the existing dairy test file (instructions cite `backend/tests/test_dairy_mgmt.py`; locate with `ls backend/tests | grep -i dairy` and extend the file that tests the dairy manager transitions), add `test_payment_batch_ready_emits_task`: bring a payment batch to ready and assert a `tasks` doc for the dairy manager with `module="dairy"`, `kind="payment_batch_ready"`, `status="open"`, localized titles, `deepLink` in `DEEP_LINKS`.
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/ -k "dairy"`
- EXPECT: exit 0; all dairy tests pass.
- IF FAIL: fix the emission code, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.16 — Wire emit_task into loans/finance
- DO: In `backend/app/routers/loans.py` and `backend/app/routers/finance.py`, call `await emit_task(...)` at the transitions for the §WS-05 table row "loans / finance": loan approved ("Loan approved — accept terms"), EMI due in 5 days, KCC limit top-up available. `module="loans"`, kinds e.g. `loan_approved`, `emi_due`, `kcc_topup_available`; `source_id` = the loan/EMI doc id; ₹ as integer paisa. `deep_link` = `DEEP_LINKS["loans"]` if it exists — deep-link gate first via `grep -n "path=" website/src/App.tsx`; no loans/finance route → dated deferral note under the module's §7 entry in `missing-features/robust.md`, skip emission. Align notification `data.deepLink` where applicable.
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_loans.py tests/test_finance.py`
- EXPECT: exit 0; existing loans/finance tests pass.
- IF FAIL: fix the wiring, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.17 — Test loans/finance task emission
- DO: In `backend/tests/test_loans.py`, add `test_loan_approved_emits_task`: advance a loan to approved and assert a `tasks` doc with `module="loans"`, `kind="loan_approved"`, `status="open"`, localized titles, `deepLink` in `DEEP_LINKS` (or mark [x] with "deferred per robust.md" if task 5.16 deferred).
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_loans.py tests/test_finance.py`
- EXPECT: exit 0; all loans/finance tests pass.
- IF FAIL: fix the emission code, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.18 — Wire emit_task into insurance
- DO: In `backend/app/routers/insurance.py` and `backend/app/routers/insurance_claims.py`, call `await emit_task(...)` at the transitions for the §WS-05 table row "insurance": claim surveyor assigned, claim rejected ("Claim rejected — appeal within 15 days" — `due_at` = appeal deadline ISO), PMFBY enrollment deadline. `module="insurance"`, kinds e.g. `claim_surveyor_assigned`, `claim_rejected_appeal`, `pmfby_enrollment_deadline`; `source_id` = the claim/policy doc id. `deep_link` = `DEEP_LINKS["insurance"]` if it exists — deep-link gate first via `grep -n "path=" website/src/App.tsx`; no insurance route → dated deferral note under insurance's §7 entry in `missing-features/robust.md`, skip emission. Align notification `data.deepLink` where applicable.
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_insurance_claims.py tests/test_insurance_policies.py tests/test_insurance_provider.py`
- EXPECT: exit 0; existing insurance tests pass.
- IF FAIL: fix the wiring, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.19 — Test insurance task emission
- DO: In `backend/tests/test_insurance_claims.py`, add `test_claim_status_change_emits_task`: advance a claim to surveyor-assigned (or rejected) and assert a `tasks` doc with `module="insurance"`, the expected `kind`, `status="open"`, localized titles, `deepLink` in `DEEP_LINKS` (or mark [x] with "deferred per robust.md" if task 5.18 deferred).
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_insurance_claims.py tests/test_insurance_policies.py tests/test_insurance_provider.py`
- EXPECT: exit 0; all insurance tests pass.
- IF FAIL: fix the emission code, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.20 — Wire emit_task into contracts/direct buyer
- DO: In `backend/app/routers/contracts.py` and `backend/app/routers/direct_buyer.py`, call `await emit_task(...)` at the transitions for the §WS-05 table row "contracts / direct buyer": contract delivery due this week, new grow-for-us offer matching the farmer's crops. `module="contracts"`, kinds e.g. `contract_delivery_due`, `grow_for_us_offer_match`; `source_id` = the contract/offer doc id; `deep_link` = `DEEP_LINKS["contracts"]` + contract id where parameterized (the `/dashboard/p/contracts/:contractId` and `/dashboard/p/myContracts/:contractId` routes exist — pick the one matching the user's role in the contract). Deep-link gate first via `grep -n "path=" website/src/App.tsx`; align notification `data.deepLink` where applicable.
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_contracts.py tests/test_contracts_direct.py`
- EXPECT: exit 0; existing contracts tests pass.
- IF FAIL: fix the wiring, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.21 — Test contracts task emission
- DO: In `backend/tests/test_contracts.py`, add `test_contract_delivery_due_emits_task`: move a contract into its delivery week and assert a `tasks` doc with `module="contracts"`, `kind="contract_delivery_due"`, `status="open"`, localized titles, `deepLink` in `DEEP_LINKS`.
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_contracts.py tests/test_contracts_direct.py`
- EXPECT: exit 0; all contracts tests pass.
- IF FAIL: fix the emission code, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.22 — Wire emit_task into schemes
- DO: In `backend/app/routers/schemes.py` and `backend/app/services/eligibility.py`, call `await emit_task(...)` at the transitions for the §WS-05 table row "schemes": PM-Kisan installment credited, new scheme matching the user's profile ("New scheme matches your profile — apply by 12 Nov" — deadline from the scheme doc). `module="schemes"`, kinds e.g. `scheme_installment_credited`, `scheme_match_deadline`; `source_id` = the scheme/installment doc id; `due_at` = application deadline ISO. `deep_link` = `DEEP_LINKS["schemes"]` if it exists — deep-link gate first via `grep -n "path=" website/src/App.tsx`; no schemes route → dated deferral note under schemes' §7 entry in `missing-features/robust.md`, skip emission. Align notification `data.deepLink` where applicable.
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_schemes.py`
- EXPECT: exit 0; existing schemes tests pass.
- IF FAIL: fix the wiring, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.23 — Test schemes task emission
- DO: In `backend/tests/test_schemes.py`, add `test_scheme_match_emits_task`: trigger the eligibility match path and assert a `tasks` doc with `module="schemes"`, `kind="scheme_match_deadline"`, `status="open"`, localized titles, `deepLink` in `DEEP_LINKS` (or mark [x] with "deferred per robust.md" if task 5.22 deferred).
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_schemes.py`
- EXPECT: exit 0; all schemes tests pass.
- IF FAIL: fix the emission code, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.24 — Wire emit_task into courses/instructor
- DO: In `backend/app/routers/courses.py` and `backend/app/routers/teachers.py`, call `await emit_task(...)` at the transitions for the §WS-05 table row "courses / instructor": live class starting ("Live class at 5pm"), pending assignment reviews ("12 pending assignment reviews" — real count), certificate ready. `module="courses"`, kinds e.g. `live_class_starting`, `assignment_reviews_pending`, `certificate_ready`; `source_id` = the class/assignment/certificate doc id. `deep_link` = `DEEP_LINKS["courses"]` if it exists — deep-link gate first via `grep -n "path=" website/src/App.tsx`; no courses route → dated deferral note under the module's §7 entry in `missing-features/robust.md`, skip emission. Align notification `data.deepLink` where applicable.
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_courses.py tests/test_saas_teachers.py`
- EXPECT: exit 0; existing courses/teachers tests pass.
- IF FAIL: fix the wiring, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.25 — Test courses task emission
- DO: In `backend/tests/test_courses.py`, add `test_live_class_emits_task`: schedule/move a live class into its start window and assert a `tasks` doc with `module="courses"`, `kind="live_class_starting"`, `status="open"`, localized titles, `deepLink` in `DEEP_LINKS` (or mark [x] with "deferred per robust.md" if task 5.24 deferred).
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_courses.py tests/test_saas_teachers.py`
- EXPECT: exit 0; all courses/teachers tests pass.
- IF FAIL: fix the emission code, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.26 — Wire emit_task into broker
- DO: In `backend/app/routers/broker.py`, call `await emit_task(...)` at the transitions for the §WS-05 table row "broker": deal awaiting confirmation, commission payout processed. `module="broker"`, kinds e.g. `deal_confirmation_pending`, `commission_payout_processed`; `source_id` = the deal/payout doc id; `deep_link` = `DEEP_LINKS["broker"]` + deal id where parameterized (the `/dashboard/p/broker/deals/:dealId` route exists). Deep-link gate first via `grep -n "path=" website/src/App.tsx`; align notification `data.deepLink` where applicable.
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_broker_deals.py`
- EXPECT: exit 0; existing broker tests pass.
- IF FAIL: fix the wiring, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.27 — Test broker task emission
- DO: In `backend/tests/test_broker_deals.py`, add `test_deal_confirmation_emits_task`: move a deal into awaiting-confirmation and assert a `tasks` doc with `module="broker"`, `kind="deal_confirmation_pending"`, `status="open"`, localized titles, `deepLink` in `DEEP_LINKS`.
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_broker_deals.py`
- EXPECT: exit 0; all broker tests pass.
- IF FAIL: fix the emission code, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.28 — Wire emit_task into cold storage (post_harvest)
- DO: In `backend/app/routers/post_harvest.py`, call `await emit_task(...)` at the transitions for the §WS-05 table row "cold storage": chamber booking confirmed, lot releases tomorrow. `module="post_harvest"`, kinds e.g. `chamber_booking_confirmed`, `lot_release_tomorrow`; `source_id` = the booking/lot doc id. `deep_link` = `DEEP_LINKS["post_harvest"]` if it exists — deep-link gate first via `grep -n "path=" website/src/App.tsx`; no cold-storage route → dated deferral note under the module's §7 entry in `missing-features/robust.md`, skip emission. Align notification `data.deepLink` where applicable.
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_cold_storage.py tests/test_climate_postharvest.py tests/test_cold_storage_provider.py`
- EXPECT: exit 0; existing cold-storage tests pass.
- IF FAIL: fix the wiring, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.29 — Test cold-storage task emission
- DO: In `backend/tests/test_cold_storage.py`, add `test_chamber_booking_emits_task`: confirm a chamber booking and assert a `tasks` doc with `module="post_harvest"`, `kind="chamber_booking_confirmed"`, `status="open"`, localized titles, `deepLink` in `DEEP_LINKS` (or mark [x] with "deferred per robust.md" if task 5.28 deferred).
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_cold_storage.py tests/test_climate_postharvest.py tests/test_cold_storage_provider.py`
- EXPECT: exit 0; all cold-storage tests pass.
- IF FAIL: fix the emission code, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.30 — Wire emit_task into gamification/referrals
- DO: In `backend/app/routers/gamification.py` and `backend/app/routers/referrals.py`, call `await emit_task(...)` at the transitions for the §WS-05 table row "gamification / referrals": coins close to next reward ("50 coins to next reward" — real delta), referral milestone reached. `module="gamification"`, kinds e.g. `coins_to_next_reward`, `referral_milestone`; `source_id` = the reward/milestone doc id (or a stable key like `<userId>:next-reward` so dedupe works). `deep_link` = `DEEP_LINKS["gamification"]` if it exists — deep-link gate first via `grep -n "path=" website/src/App.tsx`; no route → dated deferral note under the module's §7 entry in `missing-features/robust.md`, skip emission. Align notification `data.deepLink` where applicable.
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_gamification.py tests/test_referrals.py tests/test_referral.py`
- EXPECT: exit 0; existing gamification/referrals tests pass.
- IF FAIL: fix the wiring, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.31 — Test gamification task emission
- DO: In `backend/tests/test_gamification.py`, add `test_reward_proximity_emits_task`: push a user's coin balance to within the reward threshold and assert a `tasks` doc with `module="gamification"`, `kind="coins_to_next_reward"`, `status="open"`, localized titles, `deepLink` in `DEEP_LINKS` (or mark [x] with "deferred per robust.md" if task 5.30 deferred).
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_gamification.py tests/test_referrals.py tests/test_referral.py`
- EXPECT: exit 0; all gamification/referrals tests pass.
- IF FAIL: fix the emission code, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.32 — Wire emit_task into KYC/account
- DO: In `backend/app/routers/users.py`, call `await emit_task(...)` at the KYC state transitions for the §WS-05 table row "KYC / account": KYC verification needed to receive payouts, document expiring. `module="kyc"`, kinds e.g. `kyc_needed_for_payout`, `kyc_document_expiring`; `source_id` = the KYC/document doc id (or a stable key `<userId>:kyc` for dedupe). `deep_link` = `DEEP_LINKS["kyc"]` if it exists — deep-link gate first via `grep -n "path=" website/src/App.tsx`; no KYC route → dated deferral note under the module's §7 entry in `missing-features/robust.md`, skip emission. Align notification `data.deepLink` where applicable.
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_users.py tests/test_account.py`
- EXPECT: exit 0; existing users/account tests pass.
- IF FAIL: fix the wiring, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.33 — Test KYC task emission
- DO: In `backend/tests/test_users.py`, add `test_kyc_state_emits_task`: transition a user into KYC-required and assert a `tasks` doc with `module="kyc"`, `kind="kyc_needed_for_payout"`, `status="open"`, localized titles, `deepLink` in `DEEP_LINKS` (or mark [x] with "deferred per robust.md" if task 5.32 deferred).
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_users.py tests/test_account.py`
- EXPECT: exit 0; all users/account tests pass.
- IF FAIL: fix the emission code, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.34 — Aggregate summary-coverage test
- DO: In `backend/tests/test_tasks.py`, add `test_summary_covers_every_wired_module`: seed (via `emit_task`) one open task for every module that was actually wired in tasks 5.2–5.33 (skip modules with deferral notes), then `GET /v1/tasks/summary?persona=all` and assert every wired module key appears in `moduleCounts` with a count ≥ 1.
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_tasks.py -k "covers_every_wired_module"`
- EXPECT: exit 0; the aggregate test passes.
- IF FAIL: fix the summary endpoint or the missing emission (never the test), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.35 — Cross-check summary grid covers emitted modules
- DO: Client-side cross-check (instructions.md §WS-05 step 7): for every module key wired in tasks 5.2–5.33, confirm the WS-02 summary grid in `website/src/views/dashboard/DashboardHome.tsx` renders a card for it for the personas whose ACL matrix in `website/src/lib/dashboard.ts` grants access. Where a wired module has no grid card, add the card mapping (module key → icon + locale status string in `en.dashboard.ts`/`hi.dashboard.ts`) — do not change ACL entries.
- RUN: `cd website && pnpm exec tsc --noEmit && grep -o "^[[:space:]]*[a-zA-Z0-9_]*:" src/lib/i18n/locales/en.dashboard.ts | sort > /tmp/en5.keys; grep -o "^[[:space:]]*[a-zA-Z0-9_]*:" src/lib/i18n/locales/hi.dashboard.ts | sort > /tmp/hi5.keys; diff /tmp/en5.keys /tmp/hi5.keys && echo PARITY_OK`
- EXPECT: `tsc` exits 0; output contains `PARITY_OK`; every wired module has a grid card (verified by reading the grid mapping against the task-5.34 seeded list).
- IF FAIL: add the missing card mapping/locale keys, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task 5.36 — HUMAN CHECK: per-module trigger sweep
- DO: Human: with the app running via `./run.sh --no-mobile`: for each module wired in tasks 5.2–5.33, trigger ONE transition (create an offer, request a booking, run the rent-reminders job via `curl -X POST http://localhost:8000/jobs/rent-reminders/run -H "X-Cron-Secret: <from operator env>"`, advance a claim, etc.), then open the dashboard and confirm the task appears in today's tasks; tap it and confirm it lands on a working screen — no "coming soon" reachable from any task (robust.md §4.3). Modules with dated deferral notes are exempt; confirm each such note exists in `missing-features/robust.md` with a date.
- RUN: manual — no command (human performs the sweep above).
- EXPECT: human confirms every wired module fires ≥1 task type whose deep-link lands on a working screen, and every skipped module carries a dated deferral note.
- IF FAIL: human reports the module + failing step; fix the emission or deep-link, repeat that module's check — else STOP (playbook §5) with full output.
- [ ]

### Task 5.37 — WS-05 checkpoint: verify + commit
- DO: Run the WS-05 Verification block from instructions.md §WS-05, then commit: `git add -A && git commit -m "phase-01 WS-05: Module task emission sweep"`.
- RUN: `cd backend && .venv/bin/python -m pytest -q`
- EXPECT: exit 0; the FULL backend suite is green; then the commit succeeds (if git identity is missing, note it and continue — playbook §6).
- IF FAIL: fix the failing code (never weaken tests), re-run; only commit when green — else STOP (playbook §5) with full output.
- [ ]

## Phase-final gate

### Task P.1 — Gate: full backend suite green
- DO: Run the phase-final verification backend command from instructions.md §Phase-final verification.
- RUN: `cd backend && .venv/bin/python -m pytest -q`
- EXPECT: exit 0; the entire backend suite passes, zero failures.
- IF FAIL: identify the failing test's workstream, fix the code there (never weaken the test), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task P.2 — Gate: full backend suite green on shim
- DO: Run the AI-provider gate from instructions.md §Phase-final verification (everything must work with the shim — rule 10).
- RUN: `cd backend && AI_PROVIDER=shim .venv/bin/python -m pytest -q`
- EXPECT: exit 0; the entire suite passes with `AI_PROVIDER=shim`.
- IF FAIL: fix the shim-path code (likely a missing fallback in WS-03/WS-04), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task P.3 — Gate: website typecheck + build clean
- DO: Run the phase-final verification website command from instructions.md §Phase-final verification.
- RUN: `cd website && pnpm exec tsc --noEmit && pnpm build`
- EXPECT: `tsc` exits 0 with no errors; `pnpm build` exits 0.
- IF FAIL: fix the type/build errors shown, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task P.4 — Gate: zero hardcoded metrics in dashboard views
- DO: Run the robust.md §4.3 verbatim check from the phase readme exit gate and instructions.md §Phase-final verification.
- RUN: `grep -rn "?? [0-9]" website/src/views`
- EXPECT: exit 1 (grep finds NOTHING — no output). Any match is a failure.
- IF FAIL: remove the offending `?? <number>` fallback (missing data renders loading/empty state), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task P.5 — Gate: every module emits and appears in summary
- DO: Verify the exit-gate item "every module emits ≥1 task type and appears in the summary grid" via the automated coverage tests written in WS-05 (task 5.34) plus the deferral-note check.
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_tasks.py -k "covers_every_wired_module" && grep -n "deferr" ../missing-features/robust.md | tail -20`
- EXPECT: the coverage test passes; the grep lists a dated deferral note for every module that was NOT wired (silence is not allowed — rule 10). Cross-check by reading: wired modules + deferred modules = the 16 rows of the instructions.md §WS-05 table.
- IF FAIL: wire the missing module or write its dated deferral note, re-run — else STOP (playbook §5) with full output.
- [ ]

### Task P.6 — Gate: tasks API contract (summary shape, idempotency, envelope, pagination)
- DO: Verify the exit-gate item "`GET /v1/tasks/summary` returns per-module counts + top-3 urgent per persona; `done`/`dismiss` idempotent; error envelope + cursor pagination on all endpoints" via the WS-01 automated suite.
- RUN: `cd backend && .venv/bin/python -m pytest -q tests/test_tasks.py`
- EXPECT: exit 0; all `test_tasks.py` tests pass (they cover summary shape, top-3 urgent, idempotent replay, cross-user 404, cursor round-trip, envelope shape).
- IF FAIL: fix the router code (never the tests), re-run — else STOP (playbook §5) with full output.
- [ ]

### Task P.7 — HUMAN CHECK: farmer morning end-to-end flow
- DO: Human (ai.md flow 5.1, exit-gate walk item 1): with the app running via `./run.sh --no-mobile` and backend on `AI_PROVIDER=shim`: open the farmer dashboard → confirm the hero next-best-action card renders and is stable across two reloads → confirm urgent strip + today's tasks + summary grid + money snapshot all show live data → tap the hero card's task → confirm it lands on the module screen → complete the action → confirm the task flips to done with the celebration (coins when applicable) and the summary count decrements without reload.
- RUN: manual — no command (human walks the flow above).
- EXPECT: human confirms every step of the flow works end-to-end.
- IF FAIL: human reports the failing step; fix the implicated code, repeat the flow — else STOP (playbook §5) with full output.
- [ ]

### Task P.8 — HUMAN CHECK: aggregate mode + persona sweep
- DO: Human (exit-gate walk items 2–3): (1) log in as a multi-profile user, toggle "All profiles" → confirm tasks from both personas union; confirm a farmer-only profile shows the toggle defaulted ON. (2) Sweep every persona dashboard: each shows a working AI-ranked hero next-best-action card; then disable the ranking module flag in `platform_config/ai` → confirm every dashboard falls back to due-date order with no errors; re-enable the flag.
- RUN: manual — no command (human walks both checks above).
- EXPECT: human confirms aggregate union, farmer default-ON, hero card per persona, and clean flag-off fallback.
- IF FAIL: human reports the failing persona/step; fix, repeat — else STOP (playbook §5) with full output.
- [ ]

### Task P.9 — HUMAN CHECK: Kisan Mitra exit gate
- DO: Human (exit-gate walk item 4, M2 acceptance verbatim): (1) ask the chat a question in Hindi → Hindi answer; ask in Marathi → Marathi answer; confirm answers are persona-aware. (2) Red-team set: try phone-sharing and "mujhe loan chahiye, kya karun" → confirm `chatbot.safety.v1` filters them (stripped/regenerated/safe fallback; neutral + handoff for the loan ask). (3) Request an expert handoff → confirm a visible `expert_tickets` thread appears in the sheet and persists across a page reload.
- RUN: manual — no command (human walks the three checks above).
- EXPECT: human confirms Marathi + Hindi round-trips, red-team filtering, and a persistent handoff thread.
- IF FAIL: human reports the failing check; fix the implicated WS-04 code, repeat — else STOP (playbook §5) with full output.
- [ ]

### Task P.10 — HUMAN CHECK: task deep-link sweep + ai_decisions audit
- DO: Human (exit-gate walk items 5–6): (1) Task sweep — for every module in the instructions.md §WS-05 table, fire at least one task type and tap it on the website: every deep-link lands on a working screen; no "coming soon" is reachable from any task. (2) `ai_decisions` audit — in Firestore, confirm entries exist for both ranking (`tasks.rank.v1`) and chatbot (`chatbot.intent.v1`, `chatbot.safety.v1`) calls with cost and confidence recorded, and inspect several payloads to confirm none contains phone numbers, emails, or unmasked Aadhaar (rule 11).
- RUN: manual — no command (human performs the sweep and audit above).
- EXPECT: human confirms every task deep-link resolves and the `ai_decisions` audit passes (entries exist with cost + confidence; payloads are clean).
- IF FAIL: human reports the failing module or payload; fix the deep-link/emission or the privacy pseudonymization, repeat — else STOP (playbook §5) with full output.
- [ ]

### Task P.11 — Phase-final commit
- DO: Commit any remaining phase-01 changes: `git add -A && git commit -m "phase-01: Universal Action Dashboard + Conversational AI — exit gate green"`. Then write the playbook §4 session report (PHASE / WORKSTREAM / LAST COMPLETED / NEXT TASK / COMMANDS RUN / FAILURES / BLOCKED) and hand the phase back to the human operator.
- RUN: `git status --short | head -20`
- EXPECT: after the commit, `git status --short` prints nothing (clean tree). If git identity is missing, note it in the report and continue (playbook §6).
- IF FAIL: commit the remaining files or resolve the reported git error — else STOP (playbook §5) with full output.
- [ ]
