"""Live dashboard: run control + step streaming + report browsing.

    python -m sim.cli dashboard        # → http://localhost:8590
"""
import asyncio
import json
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import REPORTS_DIR, RUNS_DIR, llm_credentials
from .runner import BUS, Runner

STATIC = Path(__file__).resolve().parent.parent / "dashboard_static"

app = FastAPI(title="Agrovercity Sim Dashboard", docs_url=None, redoc_url=None)
runner = Runner()


@app.get("/api/status")
async def status():
    return {
        "llm_key_set": bool(llm_credentials()[0]),
        "current": runner.current,
        "recent_events": BUS.recent[-50:],
        "runs_on_disk": len(list(RUNS_DIR.glob("*.meta.json"))),
        "report_exists": (REPORTS_DIR / "report.json").exists(),
    }


@app.post("/api/run")
async def start_run(body: dict):
    if runner.current:
        return JSONResponse({"error": "a suite is already running"}, status_code=409)
    suite = body.get("suite", "smoke")
    budget = body.get("budget_usd")
    mock = bool(body.get("mock"))
    if not llm_credentials()[0] and not mock:
        return JSONResponse({"error": "no LLM key — set DEEPSEEK_API_KEY or OPENAI_API_KEY, or use mock"}, status_code=400)
    asyncio.ensure_future(runner.run_suite(suite, budget_usd=budget, mock_llm=mock))
    return {"started": suite}


@app.get("/api/runs")
async def runs():
    out = []
    for p in sorted(RUNS_DIR.glob("*.meta.json"), reverse=True)[:60]:
        try:
            m = json.loads(p.read_text())
            out.append({"file": p.name, "scenario": m["scenario"].get("id"),
                        "persona": m["scenario"].get("persona"),
                        "mode": m["scenario"].get("mode"),
                        "outcome": m.get("outcome", {}).get("outcome"),
                        "steps": m.get("outcome", {}).get("steps"),
                        "cost": m.get("budget", {}).get("usd")})
        except Exception:
            pass
    return out


@app.get("/api/runs/{name}")
async def run_detail(name: str):
    safe = "".join(c for c in name if c.isalnum() or c in "-_.")
    log_p = RUNS_DIR / safe.replace(".meta.json", ".jsonl")
    if not log_p.exists():
        return JSONResponse({"error": "not found"}, status_code=404)
    lines = [json.loads(l) for l in log_p.read_text().splitlines() if l.strip()]
    return {"log": lines[-400:]}


@app.get("/api/debriefs")
async def debriefs():
    out = []
    for p in sorted(RUNS_DIR.glob("*.debrief.json"), reverse=True)[:60]:
        out.append({"file": p.name, **json.loads(p.read_text())})
    return out


@app.post("/api/analyze")
async def analyze_api():
    from .analyzer import analyze
    report = await asyncio.to_thread(analyze)
    return {"ok": True, "missing_features": len(report.get("missing_features", []))}


@app.get("/api/report")
async def report():
    p = REPORTS_DIR / "report.json"
    return json.loads(p.read_text()) if p.exists() else {}


@app.get("/api/personas")
async def personas_activity():
    p = REPORTS_DIR / "personas.json"
    return json.loads(p.read_text()) if p.exists() else []


@app.websocket("/ws")
async def ws(websocket: WebSocket):
    await websocket.accept()
    q = BUS.subscribe()
    try:
        for ev in BUS.recent[-30:]:
            await websocket.send_text(json.dumps(ev))
        while True:
            ev = await q.get()
            await websocket.send_text(json.dumps(ev))
    except WebSocketDisconnect:
        pass
    finally:
        BUS.unsubscribe(q)


@app.get("/")
async def index():
    return FileResponse(STATIC / "index.html")


app.mount("/static", StaticFiles(directory=STATIC), name="static")


def serve(port: int = 8590):
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
