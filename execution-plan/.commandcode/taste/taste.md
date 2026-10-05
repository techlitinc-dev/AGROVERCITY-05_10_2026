# Taste

## Workflow
- Drives work through a numbered phase-based execution plan (e.g. `execution-plan/phase-NN/`), where each phase folder holds `readme.md`, `instructions.md`, and `tasks.md`; expects the agent to read all three, execute the task queue/workstreams in order, and write a `summary.md` into that phase folder. Confidence: 0.75
- Delegates terse, high-level instructions (point at the plan docs, "execute task and create summary.md") and expects the agent to run end-to-end autonomously — recon → execute → verify → summarize — without asking for step-by-step confirmation. Confidence: 0.6
