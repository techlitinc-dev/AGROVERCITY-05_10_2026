# Taste

## Workflow
- Drives work through a numbered phase-based execution plan (e.g. `execution-plan/phase-NN/`), where each phase folder holds `readme.md`, `instructions.md`, and `tasks.md`; expects the agent to read all three, execute the task queue/workstreams in order, and write a `summary.md` into that phase folder. Confidence: 0.8
- Delegates terse, high-level instructions (point at the plan docs, "execute task and create summary.md") and expects the agent to run end-to-end autonomously — recon → execute → verify → summarize — without asking for step-by-step confirmation. Confidence: 0.7
- Expects commits to happen only on explicit request: checkpoint/commit tasks in a phase plan are deliberately left unchecked, and browser-dependent "HUMAN CHECK" items are left for the user rather than marked done. Confidence: 0.6
- Treats the phase task list as idempotent across re-runs/sessions: explicitly says to ignore/skip tasks already implemented rather than redoing them, so the agent should detect existing work and only build the remainder. Confidence: 0.65
- Enforces documented project rules as hard gates before calling work done — no silent feature drops (anything deferred needs a dated deferral note), en/hi locale parity, no `alert`/`confirm`/`prompt` in views, no hardcoded numeric fallbacks — and wants the gate results reported with concrete pass/fail counts. Confidence: 0.65
