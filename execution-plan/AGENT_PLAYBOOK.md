# AGENT_PLAYBOOK — Execution Protocol for the Executor Agent

> Read this file fully before touching any task. It is the operating manual for
> executing `execution-plan/phase-XX/tasks.md`. Follow it mechanically.
> You are not the designer — the plan is. Your job is exact execution + honest
> reporting. When the plan and your instinct disagree, the plan wins.

---

## 1. Your memory model (you will forget things — plan for it)

- Your durable memory is **the repo + the checkboxes in the phase's `tasks.md`**.
  Nothing else survives a session restart.
- Mark `[x]` on a task **immediately after** its check passes. Never batch-mark.
- On every new session:
  1. Open `execution-plan/README.md` §2 (phase map) to find the active phase.
  2. Open that phase's `tasks.md`, find the **first unchecked `[ ]` task**.
  3. Resume there. Do NOT re-run checked tasks. Do NOT restart the phase.
- If a task is checked but you suspect it was never really done, run its RUN
  command. If it passes, move on. If it fails, uncheck it and report.

## 2. The task loop (follow exactly, for every task)

Each task in `tasks.md` has four fields: **DO / RUN / EXPECT / IF FAIL**.

1. **READ** the whole task, including PRECONDITION if present.
2. **PRECONDITION** (when present): run the listed check first. If it fails, the
   phase dependency is missing → STOP the phase (see §5).
3. **READ the files the task names** before editing anything.
4. **DO** exactly the stated action — nothing more:
   - Touch only the files the task names. Files marked `(new)` must be created;
     all others must already exist (if one doesn't → STOP, see §5).
   - Do not reformat, rename, "improve", or refactor anything outside the task.
   - Do not add features the task did not ask for.
5. **RUN** the check command(s) exactly as written, from the stated directory.
6. Compare real output to **EXPECT**:
   - Match → mark `[x]`, report one line, go to next task.
   - No match → apply **IF FAIL** exactly once, re-run the check.
   - Still failing → **STOP** (see §5). Never skip a failing task. Never mark
     it done. Never move to the next task "to come back later".

## 3. Hard rules (violating any one = the task is failed, revert it)

1. Never edit a file the task did not name.
2. Never delete or weaken a test to make it pass. Never delete a failing
   assertion. The test is the truth; fix the code.
3. Never add `?? <number>` fallback values, `alert()`/`confirm()`/`prompt()`,
   hardcoded user-facing strings (use `t()` with en + hi keys), commented-out
   code, or TODO placeholders.
4. Never call OpenRouter/Gemini except through
   `backend/app/services/ai/gateway.py`. In dev/CI always `AI_PROVIDER=shim`.
5. Never read, print, or commit `.env` files or secrets. If a task needs an env
   var, it will say to add a placeholder to `.env.example` — real values come
   from the human operator.
6. Money amounts are integer paisa. Dates are ISO strings. No floats for money.
7. Every new write endpoint accepts `Idempotency-Key`; every new endpoint
   returns the `{"error":{code,...}}` envelope on failure.
8. Run commands exactly as written — no added flags, no "similar" commands.
9. If a command needs a server/emulator running, the task will say so and give
   the exact start command. Do not invent your own.

## 4. Reporting (after every task, and at session end)

Per task, one line:
`phase-XX task N.N ✅ <title>` or `phase-XX task N.N ❌ <title> — <reason>`

At session end (or when told to stop), output:

```
PHASE: XX | WORKSTREAM: NN | LAST COMPLETED: task N.N
NEXT TASK: task N.N+1 — <title>
COMMANDS RUN SINCE LAST REPORT: <count>
FAILURES ENCOUNTERED: <task ids + one-line cause each>
BLOCKED: yes/no (+ why)
```

## 5. STOP conditions (halt and report — do not improvise around these)

Stop the **task** when: its check fails after the single IF FAIL retry.

Stop the **whole phase** and report to the human operator when:
- A PRECONDITION fails (an earlier phase's deliverable is missing, e.g.
  `backend/app/services/ai/` does not exist when a task needs it).
- A file the task expects (not marked `(new)`) does not exist.
- Two consecutive tasks fail their checks.
- The task text contradicts the repo (wrong endpoint name, renamed file,
  changed schema). Report the contradiction; do not guess the fix.
- The global gate (`execution-plan/README.md` §4) fails for reasons unrelated
  to your current workstream.

A STOP report must include: phase/workstream/task id, the exact command, the
full real output, what you changed so far (file list), and your one-line
hypothesis. Then wait for the human.

## 6. Git checkpoints

- After the final task of each workstream passes, the tasks.md includes a
  checkpoint task: `git add -A && git commit -m "phase-XX WS-NN: <title>"`.
- Never amend, force-push, rebase, or commit anything outside the repo.
- If git commit fails (no identity configured etc.), note it in the report and
  continue — checkpoints are helpful but not blocking.

## 7. Pacing rules for a basic executor

- One task at a time. Never start the next task in the same breath.
- Never parallelize, batch, or "do a few similar ones together".
- Prefer many small verified edits over one big unverified one.
- If context is running low mid-workstream: finish the current task's check,
  mark it, write the §4 session report, and stop cleanly. The checkboxes are
  your resume point.
- Slow is correct. An unverified "fast" change costs ten recoveries.

## 8. File map (where things live)

| File | Purpose |
|---|---|
| `execution-plan/README.md` | Master index, global rules, global gate |
| `execution-plan/AGENT_PLAYBOOK.md` | This protocol |
| `execution-plan/phase-XX/readme.md` | Phase contract + exit gate (read once per phase) |
| `execution-plan/phase-XX/instructions.md` | Full build reference (consult when a task says "see WS-NN") |
| `execution-plan/phase-XX/tasks.md` | **Your work queue. Execute top to bottom.** |
