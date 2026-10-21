# Agrovercity Simulation Harness

LLM-driven persona simulation over the real FastAPI backend. Design:
`specs.md` · Build guide: `implement_simulation.md` · Coding-agent handoff:
`implementation-handoff.md` · Sample outputs: `examples/`

## Quickstart

```bash
# 1. backend running in dev (real Firestore TEST project, never prod)
cd .. && ./run.sh backend &

# 2. harness
cd sim
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill DEEPSEEK_API_KEY (or Kimi: OPENAI_BASE_URL+OPENAI_API_KEY)

# 3. doctor → catalog → seed → run → report
python -m sim.cli doctor
python -m sim.cli catalog
python -m sim.cli seed
python -m sim.cli run --suite smoke          # ~$0.10
python -m sim.cli analyze
python -m sim.cli dashboard                  # http://localhost:8590  (live runs + reports)
```

## Outputs

- `runs/<id>.jsonl` — every HTTP call an agent made (the evidence)
- `runs/<id>.debrief.json` — what the persona reported afterward
- `reports/report.md` + `report.json` — gaps, friction, coverage, dataflow
- `reports/personas.md` + `personas.json` — what each persona did, narrated
- `reports/tickets/` + `tickets.md` — coding-agent-ready tickets
- `reports/review_queue.md` — top-20 human verdict checklist

## Safety rails

Localhost-only backend allowlist · dev/test auth paths only · budget caps
(default $5/suite) · every admin mutation auto-tagged `X-Audit-Reason: sim-<id>`.
