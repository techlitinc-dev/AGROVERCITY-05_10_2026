"""reports/report.json → reports/tickets/ per implementation-handoff.md."""
import json
import re
from pathlib import Path

from .config import REPORTS_DIR

TEMPLATE = """# [GAP-{n:03d}] {title}
severity: {prio} · score: {score} · class: {cls}
personas_affected: {personas}
source_scenarios: see evidence runs
evidence: {evidence}

## User story
As a <persona>, I want <capability>, so that <outcome>.
Quote: "{quote}"

## Current behavior
<from run evidence — failing request/response in the cited run file>

## Expected behavior
<what the persona attempted/expected>

## Proposed implementation
### API
<endpoints, request/response shapes — follow existing router conventions>
### Data
<collections / fields / state transitions>
### Frontend
<routes in website/src/views/, api module, i18n en+hi>
### Seeds / fixtures
<backend/scripts/seed_*.py or sim seed_sim.py updates>
### Tests
<backend/tests/test_*.py + scenario checkpoint update>

## Acceptance criteria
- [ ] scenario rerun shows no recurrence
- [ ] pytest green
- [ ] sim analyze --diff shows zero new entries on touched endpoints
- [ ] i18n keys present (en + hi)

## Out of scope
<explicit non-goals>
"""


def generate() -> list[Path]:
    rep_p = REPORTS_DIR / "report.json"
    if not rep_p.exists():
        raise SystemExit("no report.json — run: python -m sim.cli analyze")
    rep = json.loads(rep_p.read_text())
    out = REPORTS_DIR / "tickets"
    out.mkdir(exist_ok=True)
    quotes = {d["scenario"]: d.get("verbatim_frustration") for d in rep.get("debriefs", [])}
    written = []
    for n, f in enumerate(rep.get("missing_features", [])[:30], 1):
        slug = re.sub(r"[^a-z0-9]+", "-", f["title"].lower()).strip("-")[:40]
        prio = "P0" if f["class"] in ("dataflow-suspicion", "bug-suspicion") and f["score"] >= 12 else \
               "P1" if f["score"] >= 12 else "P2"
        ev = f["evidence"][0] if f["evidence"] else {}
        md = TEMPLATE.format(n=n, title=f["title"], prio=prio, score=f["score"], cls=f["class"],
                             personas=", ".join(f["personas"]) or "?",
                             evidence=f"{ev.get('kind', '?')} @ {ev.get('run', '?')}",
                             quote=quotes.get(ev.get("run", "").split("--")[-1].replace(".meta.json", ""), "") or "—")
        p = out / f"GAP-{n:03d}-{slug}.md"
        p.write_text(md)
        written.append(p)
    index = ["# Tickets (from latest report)", ""] + [f"- [{p.name}](tickets/{p.name})" for p in written]
    (REPORTS_DIR / "tickets.md").write_text("\n".join(index) + "\n")
    return written
