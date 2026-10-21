# implementation-handoff.md — From sim findings to shipped features

How to convert each sim report into implementation work a coding agent can
execute without you in the loop. Use after every `sim analyze`.

---

## 1. Inputs

- `reports/report.json` — machine-readable findings (section ids below)
- `reports/report.md` — human context, especially §5 Missing-feature board,
  §3 Failure taxonomy, §6 Dataflow suspicions
- `runs/<run_id>.jsonl` — raw evidence trails (cite, don't paste wholesale)
- `sim/config/scenarios.yaml` — the scenario that exposed the finding

## 2. Priority order for tickets

| Order | Class | Source | Why first |
|---|---|---|---|
| P0 | confirmed bugs | §6 marked `confirmed`, security probes failed | broken trust, cheap fixes |
| P1 | feature gaps score ≥ 12 | §5 board | core user value |
| P2 | ease gaps, friction clusters | §5 low score, §7 retries | retention |
| P3 | unnecessary candidates | §2 zero-hit | delete/deprecate — only after 3+ clean runs |

Batch size: **≤ 5 tickets per coding-agent session**, P0 first. One session,
one batch, one verification — small loops close gaps; big loops create new ones.

## 3. Ticket template (one markdown file per ticket in `tickets/`)

```markdown
# [GAP-###] <imperative title>
severity: P0|P1|P2|P3 · score: <from board> · class: feature-gap|bug|ease|data-gap
personas_affected: [farmer, seller, ...]
source_scenarios: [farmer-sell-wheat, ...]
evidence: runs/<run_id>.jsonl steps <n-m>; report §<section> row <#>

## User story
As a <persona>, I want <capability>, so that <outcome>.
(Quote the verbatim frustration line here — it carries the "why".)

## Current behavior
<what happens today, from the run log. Include the actual failing request/response.>

## Expected behavior
<what the persona attempted/expected.>

## Proposed implementation
### API
- `POST /v1/...` — request shape, response shape, error cases (follow existing
  router conventions: /v1 prefix, paisa integers, require_role, error helper)
### Data
- collection(s), fields, state transitions
### Frontend
- route(s) under website/src/views/<domain>/, api module in
  website/src/lib/api/<domain>.ts, zustand store if needed, i18n keys
  (en + hi), sidebar entry if persona-facing
### Seeds / fixtures
- updates to backend/scripts/seed_*.py or sim seed_sim.py
### Tests
- backend/tests/test_<domain>.py (router/service), update
  sim scenario <id> or add checkpoint

## Acceptance criteria
- [ ] new scenario checkpoint passes (sim run <scenario-id> shows no recurrence)
- [ ] pytest green
- [ ] no regression: `sim analyze --diff` shows zero new entries
- [ ] i18n keys present en + hi

## Out of scope
<explicit non-goals so the agent doesn't gold-plate>
```

## 4. Worked example — GAP-001 subscription pause (P1, score 24)

```markdown
# [GAP-001] Let customers pause and resume produce subscriptions
severity: P1 · score: 24 · class: feature-gap
personas_affected: [customer, milkSeller, dairyManager]
source_scenarios: [customer-festival-week, milkseller-route-review, dairy-rate-change-confusion]
evidence: report §5 row 1; zero-result searches `pause subscription`, `skip week`,
         `vacation` (3 personas, 4 runs)

## User story
As a customer with a weekly vegetable box, I want to pause my subscription for
the two weeks I'm travelling, so that I don't pay for produce that rots at my
door. — "How do I stop box for my trip? I don't want to cancel."
(customer, customer-festival-week)

## Current behavior
`POST /v1/customer/subscriptions` creates subscriptions. State transitions cover
active/cancelled only. Search for pause/skip endpoints returns 0 results;
agents attempted `PATCH /v1/customer/subscriptions/{id}` with {status:"paused"}
→ 422 UNPROCESSABLE (enum rejects "paused").

## Expected behavior
Pause with an end date or "until I resume"; deliveries and billing stop while
paused; vendor sees it so they don't pack the box.

## Proposed implementation
### API
- `POST /v1/customer/subscriptions/{id}/pause`  body: {until?: ISO date}
  → 200 {subscriptionId, status: "paused", resumesAt}
- `POST /v1/customer/subscriptions/{id}/resume` → 200 {status:"active"}
- `GET  /v1/customer/subscriptions` includes paused + resumesAt
- errors: 404 SUBSCRIPTION_NOT_FOUND, 409 ALREADY_PAUSED, 422 until in past
### Data
- `subscriptions` doc: status enum += paused; fields pausedAt, resumesAt,
  pauseHistory[] (append-only, trust/reversibility)
### Frontend
- website/src/views/mall/routes.tsx — subscription card gets
  Pause/Resume actions; confirmation sheet shows resume date;
  api: website/src/lib/api/customer.ts += pauseSubscription/resumeSubscription;
  i18n: subscriptions.pause / subscriptions.resume (en+hi)
### Seeds / fixtures
- seed_sim.py: one active subscription per customer persona (world for chains)
### Tests
- backend/tests/test_customer_subscriptions_pause.py:
  pause→no deliveries→resume cycle, idempotent pause 409, vendor visibility,
  pauseHistory append; extend scenario customer-festival-week checkpoint:
  [subscription paused and resumed]

## Acceptance criteria
- [ ] sim rerun of customer-festival-week: agent finds pause via search_tools,
      completes pause+resume, no board entry recurs
- [ ] pytest green; i18n keys present
- [ ] report --diff: GAP-001 closed, zero new findings on touched endpoints

## Out of scope
- partial skips (skip single week inside active period) — GAP-xxx later
- refund proration while paused
```

And a short P0 bug ticket pattern (no full example needed — same template,
shorter): title = the broken seam, user story = both personas, current
behavior = the failing probe with ids, expected = visibility/handoff,
acceptance = probe green + chain scenario link step passes.

## 5. Batch instructions you paste to the coding agent

```
You are implementing sim tickets T-<batch>/.
Repo: Agrovercity (FastAPI backend in backend/, React in website/).
Read sim/implementation-handoff.md §3 for the ticket format.
Rules:
1. Backend first: router → service → model → tests (pytest green required).
2. Match existing conventions exactly (find a similar router and copy its shape).
3. Never touch sim/config/scenarios.yaml findings files — propose scenario edits
   as a separate diff section in your summary.
4. Run: cd backend && pytest -x -q
5. Output: summary of files changed + how each acceptance criterion was met.
After the agent finishes: re-seed, run the affected scenarios, `analyze --diff`
must show the ticket closed. Only then start the next batch.
```

## 6. Closing the loop (definition of done for a finding)

1. ticket merged
2. `sim seed` + `sim run --scenario <source>` → the recurrence check passes
3. `sim analyze --diff <before> <after>` → finding absent, no new entries on
   touched endpoints
4. verdict file `config/known_gaps.yaml` gets `closed-by: <commit>` so history
   is auditable

## 7. Appendix — ticket generator (add to harness at M3)

```python
# src/tickets.py — reports/report.json → tickets/GAP-###.md from the template
import json, re
from pathlib import Path

def generate(report_path="reports/report.json", out_dir="tickets"):
    rep = json.loads(Path(report_path).read_text())
    out = Path(out_dir); out.mkdir(exist_ok=True)
    n = 0
    for f in rep["missing_features"] + rep.get("confirmed_bugs", []):
        n += 1
        slug = re.sub(r"[^a-z0-9]+", "-", f["title"].lower()).strip("-")[:40]
        (out / f"GAP-{n:03d}-{slug}.md").write_text(render_ticket(n, f))
def render_ticket(n, f) -> str:
    ...  # fill §3 template fields from report row + evidence pointer
```
