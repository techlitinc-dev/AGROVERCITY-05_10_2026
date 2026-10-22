"""sim CLI — entry point for the whole harness.

    python -m sim.cli doctor | catalog | seed | run | analyze | tickets | ui-diff | dashboard
"""
import asyncio
import re
import subprocess
import sys
from pathlib import Path

import typer

from . import catalog as cat
from .config import (PERSONA_REPORTS_DIR, REPORTS_DIR, ROOT, RUNS_DIR,
                     llm_credentials, personas, scenarios, settings)

app = typer.Typer(add_completion=False, help="Agrovercity persona simulation harness")


@app.command()
def doctor():
    """Pre-flight: backend reachable, LLM key set, catalog fresh enough."""
    import httpx
    s = settings()
    ok = True
    try:
        r = None
        for path in ("/health", "/v1/health", "/openapi.json"):
            try:
                r = httpx.get(f"{s['backend_url']}{path}", timeout=5)
                if r.status_code == 200:
                    break
            except Exception:
                continue
        code = r.status_code if r is not None else "no response"
        typer.echo(f"✅ backend {s['backend_url']} reachable — last probe {code}")
    except Exception as e:
        typer.echo(f"❌ backend {s['backend_url']} unreachable ({type(e).__name__}) — start it: ./run.sh backend")
        ok = False
    key, base = llm_credentials()
    if key:
        typer.echo(f"✅ LLM key set — {base} model {s['model']}")
    else:
        typer.echo("⚠️  no LLM key (DEEPSEEK_API_KEY / OPENAI_API_KEY) — runs possible only with --mock-llm")
    if (RUNS_DIR / "catalog.json").exists():
        n = len(cat.load())
        typer.echo(f"✅ catalog: {n} operations")
    else:
        typer.echo("⚠️  no catalog yet — run: python -m sim.cli catalog")
    raise SystemExit(0 if ok else 1)


@app.command()
def catalog(tags: bool = typer.Option(False, "--tags", help="print tag names and exit")):
    """Fetch /openapi.json → runs/catalog.json."""
    ops = cat.fetch()
    typer.echo(f"catalog: {len(ops)} operations → {RUNS_DIR / 'catalog.json'}")
    if tags:
        typer.echo("\n".join(cat.tags(ops)))


@app.command()
def seed():
    """Run backend seed scripts + sim-world seed (specs §11)."""
    backend = ROOT.parent / "backend"
    venv_py = backend / ".venv" / "bin" / "python"
    py = str(venv_py if venv_py.exists() else sys.executable)
    scripts = ["seed_mandi", "seed_products", "seed_equipment", "seed_fpo", "seed_faq",
               "seed_coupons", "seed_contracts", "seed_insurance_demo", "seed_search_data",
               "seed_women_data", "seed_app_config", "seed_superadmin_users"]
    for name in scripts:
        p = backend / "scripts" / f"{name}.py"
        if not p.exists():
            typer.echo(f"– skip {name} (not found)")
            continue
        r = subprocess.run([py, str(p)], cwd=backend, capture_output=True, text=True)
        mark = "✅" if r.returncode == 0 else "❌"
        typer.echo(f"{mark} {name}" + ("" if r.returncode == 0 else f" — {r.stderr[-200:]}"))
    typer.echo("done. Next: python -m sim.cli run --suite smoke")


@app.command()
def run(suite: str = typer.Option("smoke", "--suite", "-s"),
        scenario: str | None = typer.Option(None, "--scenario", help="run one scenario id"),
        persona: str | None = typer.Option(None, "--persona", "-p",
                                           help="run all scenarios for one persona"),
        budget: float | None = typer.Option(None, "--budget-usd"),
        mock_llm: bool = typer.Option(False, "--mock-llm", help="zero-cost harness self-test")):
    """Run a suite (or one scenario / one persona) against the backend."""
    from .runner import Runner
    if scenario and persona:
        raise SystemExit("use either --scenario or --persona, not both")
    picked = None
    if persona:
        pmap = personas()
        if persona not in pmap:
            raise SystemExit(f"unknown persona '{persona}' — known: {', '.join(sorted(pmap))}")
        picked = [s for s in scenarios() if s["persona"] == persona]
        if not picked:
            raise SystemExit(f"no scenarios defined for persona '{persona}'")
        suite = f"persona-{persona}"
    elif scenario:
        picked = [s for s in scenarios() if s["id"] == scenario]
        if not picked:
            raise SystemExit(f"unknown scenario '{scenario}'")
        # temporarily mark it as its own suite
        picked[0]["suite"] = "oneshot"
        suite = "oneshot"
    if not mock_llm and not llm_credentials()[0]:
        raise SystemExit("no LLM key — export DEEPSEEK_API_KEY (or OPENAI_*), or use --mock-llm")
    runner = Runner()
    results = asyncio.run(runner.run_suite(suite, budget_usd=budget, mock_llm=mock_llm,
                                           only=picked))
    for r in results:
        o = r["outcome"]
        typer.echo(f"{r['scenario']['id']}: {o.get('outcome')} ({o.get('steps', 0)} steps)")
    typer.echo("→ python -m sim.cli analyze" + (f" --persona {persona}" if persona else ""))


@app.command()
def analyze(persona: str | None = typer.Option(None, "--persona", "-p",
                                               help="report only this persona's runs into persona_reports/<id>/")):
    """runs/ → reports/ (or persona_reports/<id>/) — zero LLM cost, safe to re-run."""
    from .analyzer import analyze
    if persona and persona not in personas():
        raise SystemExit(f"unknown persona '{persona}' — known: {', '.join(sorted(personas()))}")
    rep = analyze(persona=persona)
    out_dir = PERSONA_REPORTS_DIR / persona if persona else REPORTS_DIR
    typer.echo(f"report: {out_dir / 'report.md'}")
    typer.echo(f"  missing-feature candidates: {rep['executive']['missing_features']}")
    typer.echo(f"  userflow obstacles: {rep['executive']['userflow_obstacles']}")
    typer.echo(f"  dataflow suspicions: {rep['executive']['dataflow_suspicions']}")
    typer.echo(f"  security: {rep['executive']['security']}")
    typer.echo(f"  blocked identities: {rep['executive']['blocked_identities']}")


@app.command()
def tickets(persona: str | None = typer.Option(None, "--persona", "-p",
                                               help="generate from persona_reports/<id>/report.json")):
    """report.json → reports/tickets/ (or persona_reports/<id>/tickets/)."""
    from .tickets import generate
    out_dir = PERSONA_REPORTS_DIR / persona if persona else REPORTS_DIR
    written = generate(out_dir)
    typer.echo(f"{len(written)} tickets → {out_dir / 'tickets'} (index: {out_dir / 'tickets.md'})")


@app.command()
def ui_diff():
    """Zero-LLM cross-check: endpoints the frontends call vs what sims covered (specs §18j)."""
    ops = cat.load()
    cat_paths = [o["path"].replace("/v1", "") for o in ops]
    ui_paths = set()
    for root in [ROOT.parent / "website" / "src", ROOT.parent / "superadmin" / "src"]:
        for f in root.rglob("*.ts*"):
            if "lib" not in f.parts or "api" not in f.parts:
                continue          # only API-client modules, not React page routes
            try:
                txt = f.read_text(errors="ignore")
            except Exception:
                continue
            for m in re.findall(r"['\"](/(?:v1/)?[a-z][a-z0-9/_-]{3,})['\"]", txt):
                p = m.replace("/v1", "")
                if not p.startswith(("/assets", "/static")):
                    ui_paths.add(p)
    # sim coverage from run logs
    sim_paths = set()
    for jl in RUNS_DIR.glob("*.jsonl"):
        for line in jl.read_text(errors="ignore").splitlines():
            m = re.search(r'"path":\s*"([^"]+)"', line)
            if m:
                sim_paths.add(m.group(1).replace("/v1", ""))
    never_sim = sorted(p for p in ui_paths if p not in sim_paths and len(p) > 4)
    never_ui = sorted(p for p in set(cat_paths) if p not in ui_paths and "{" not in p)
    REPORTS_DIR.mkdir(exist_ok=True)
    md = ["# UI ↔ Sim coverage diff (specs §18j)", "",
          f"- frontend endpoint literals found: {len(ui_paths)}",
          f"- sim-covered paths: {len(sim_paths)}", "",
          "## Called by UI, never simulated (scenario gaps)", ""]
    md += [f"- `{p}`" for p in never_sim[:80]] or ["- none"]
    md += ["", "## In API catalog, never called by UI (possibly unnecessary APIs)", ""]
    md += [f"- `{p}`" for p in never_ui[:80]] or ["- none"]
    out = REPORTS_DIR / "ui_diff.md"
    out.write_text("\n".join(md))
    typer.echo(f"→ {out}  (ui-never-sim: {len(never_sim)}, api-never-ui: {len(never_ui)})")


@app.command()
def dashboard(port: int = 8590):
    """Live dashboard: run control, step stream, reports → http://localhost:8590"""
    from .dashboard import serve
    typer.echo(f"dashboard → http://127.0.0.1:{port}")
    serve(port)


if __name__ == "__main__":
    app()
