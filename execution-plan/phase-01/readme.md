# Phase 01 — Universal Action Dashboard + Conversational AI

> Replace the static placeholder dashboard with the real retention engine: a
> backend task engine (`tasks` collection + `/v1/tasks`) that every existing
> module emits into, a rebuilt website Action Center (`DashboardHome.tsx`) with
> urgent strip / today's tasks / module summary grid / money snapshot / persona
> aggregate mode, Jev-ranked task ordering with a hero next-best-action card on
> every persona dashboard, and Kisan Mitra 2.0 — Jev intent routing + safety
> post-check around the existing Gemini chatbot, with a website chat sheet and
> expert-handoff threads.
> Sources: `missing-features/robust.md` §4 (§4.1 task engine, §4.2 Action
> Center, §4.3 definition of done) + principle P7; `missing-features/ai.md`
> flows 5.1 and 5.3; `missing-features/ai_implementation_plan.md` briefs M5 and
> M2, question sets `tasks.rank.v1` / `chatbot.intent.v1` /
> `chatbot.safety.v1` (§2), recipes §3, website integration standards §6.

## Depends on

- **phase-00**, specifically: the standard error envelope
  (`{"error":{code,message,fieldErrors}}`), real cursor pagination helpers,
  `Idempotency-Key` write support, and the AI foundation (brief M1):
  `backend/app/services/ai/` (`gateway.py`, `question_sets.py`, `shim.py`,
  `budget.py`, `privacy.py`, `decision_log.py`, `outcomes.py`) plus
  `platform_config/ai` flags. Verified at planning time: `backend/app/services/ai/`
  does **not** exist yet — WS-03 and WS-04 cannot start until phase-00 lands it.

## Workstreams

| WS | Title | Source | Output (what exists when done) |
|---|---|---|---|
| WS-01 | Task engine backend | robust.md §4.1, §13 | `tasks` collection, `services/tasks.py` `emit_task()`, `routers/tasks.py` (`GET /v1/tasks/today`, `GET /v1/tasks?persona=&status=`, `POST /v1/tasks/{id}/done|dismiss`, `GET /v1/tasks/summary`), `/intelligence` confirmed as numbers layer, deep-link map aligned with notifications, tests |
| WS-02 | Website Action Center | robust.md §4.2, P7 | Rebuilt `website/src/views/dashboard/DashboardHome.tsx`: urgent strip, today's-tasks checklist with one-tap actions + coin celebration, module summary grid with live counts, money snapshot from `/intelligence`, persona switcher + aggregate mode; `lib/api/tasks.ts`; en+hi locale pairs; zero hardcoded metrics |
| WS-03 | Task ranking AI | AI brief M5, q-set `tasks.rank.v1`, ai.md flow 5.1 | `tasks.rank.v1` registered (batch ≤10), ranking inside tasks endpoints with due-date-sort fallback, hero next-best-action card + `<AiBadge>` on every persona dashboard, outcome hook task-completed-within-24h, golden fixture |
| WS-04 | Kisan Mitra 2.0 | AI brief M2, q-sets `chatbot.intent.v1` + `chatbot.safety.v1`, ai.md flows 5.3/5.10 | Intent + safety question sets around `services/chatbot.py`, persona-aware prompts using `/intelligence`, `expert_tickets` handoff at `answerable < 0.6`, `lib/api/chatbot.ts` + chat sheet UI with FAB + handoff thread view, en/hi(/mr) strings, dashboard tile wired |
| WS-05 | Module task emission sweep | robust.md §4.1 table, §4.3, §12 | `emit_task()` wired into every existing module's state transitions per the §4.1 source-module→example-tasks table; every module appears in the summary grid; notification deep-link map (X3) aligned; dated deferral notes for any module that cannot comply |

## Out of scope

- Disease-scan vision UI and model work (brief M9) and AI grading (M10) — phase-05. ai.md flow 5.3 is used here only for its handoff-thread and task-emission contract.
- Notification timing/copy AI (`notify.timing.v1`/`notify.copy.v1`, brief M7), chat guardrails AI (`chat.guardrail.v1`, M6), per-token FCM push — phase-06.
- Full persona app builds (landlord/transporter/vyapari/broker/dairy/etc. "Dashboard summary must show" extras) — phases 02–05; this phase wires only what existing modules already emit.
- Flutter apps; voice AI (M27 retired).

## Exit gate (done when)

- [ ] robust.md §4.3 verbatim: zero hardcoded metrics on any dashboard (grep for `?? <number>` returns nothing in `website/src/views`); every module emits ≥1 task type and appears in the summary grid; tapping any task lands on a working screen (no "coming soon" reachable from a task).
- [ ] Every persona dashboard shows a working AI-ranked hero next-best-action card; ranking is deterministic/stable with `AI_PROVIDER=shim`; flag off → due-date order with no errors.
- [ ] Marathi and Hindi chat round-trips work: persona-aware answers, red-team set (phone-sharing, loan advice) filtered by `chatbot.safety.v1`, and a handoff creates a visible `expert_tickets` thread in the UI.
- [ ] `GET /v1/tasks/summary` returns per-module counts + top-3 urgent per persona; `done`/`dismiss` are idempotent; all endpoints use the error envelope + cursor pagination.
- [ ] Global verification gate (execution-plan/README.md §4) green: `cd backend && .venv/bin/python -m pytest -q`; `cd website && pnpm exec tsc --noEmit && pnpm build`; full suite green with `AI_PROVIDER=shim`; one end-to-end flow per workstream from dashboard task deep-link to completion.

## Estimated effort

Weeks 3–5 of the program (robust.md §11 roadmap, "Phase 1. Dashboard"), running immediately after phase-00.
