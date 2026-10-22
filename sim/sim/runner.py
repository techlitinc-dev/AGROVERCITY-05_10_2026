"""Run orchestration: suites, chains, admin sweeps, security probes, live events.

Execution rules (specs §18c): guided/open/adversarial run with bounded concurrency;
chains and admin sweeps run SERIALLY in the shared world.
"""
import asyncio
import json
import time
from pathlib import Path

import httpx
from openai import AsyncOpenAI

from . import catalog as cat
from .agent import Agent, persona_card
from .budget import Budget
from .config import (REPORTS_DIR, RUNS_DIR, known_gaps, personas, persona_tools,
                     scenarios, settings)
from .debrief import debrief as run_debrief
from .identity import OPERATORS, resolve
from .tools import Tools, extract_ids


class EventBus:
    """Fan-out for the dashboard; works headless too (no subscribers)."""

    def __init__(self):
        self._subs: set[asyncio.Queue] = set()
        self.recent: list[dict] = []

    def subscribe(self) -> asyncio.Queue:
        q = asyncio.Queue(maxsize=500)
        self._subs.add(q)
        return q

    def unsubscribe(self, q):
        self._subs.discard(q)

    def publish(self, event: dict):
        event.setdefault("ts", time.time())
        self.recent.append(event)
        self.recent = self.recent[-300:]
        for q in list(self._subs):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                pass


BUS = EventBus()


class Runner:
    def __init__(self):
        self.cfg = settings()
        self.bus = BUS
        self.current: dict | None = None      # live status for the dashboard
        self.results: list[dict] = []

    # ── public entry points ─────────────────────────────────────────────
    async def run_suite(self, suite: str, budget_usd: float | None = None,
                        mock_llm: bool = False, only: list | None = None) -> list[dict]:
        picked = only or [s for s in scenarios() if suite in ("all", s.get("suite", "smoke"))]
        if not picked:
            raise SystemExit(f"no scenarios match suite '{suite}'")
        key, base = _creds()
        llm = AsyncOpenAI(api_key=key, base_url=base) if key else None
        budget = Budget.from_settings(self.cfg)
        if budget_usd:
            budget.max_usd = budget_usd
        run_id = f"{suite}-{time.strftime('%Y%m%dT%H-%M-%S')}"
        self.current = {"run_id": run_id, "suite": suite, "started": time.time(),
                        "scenario": None, "step": 0, "total": len(picked), "done": 0,
                        "budget": budget.snapshot(), "mock": mock_llm}
        self.bus.publish({"type": "suite_start", "run_id": run_id, "total": len(picked)})
        try:
            await self._execute(picked, llm, budget, run_id, mock_llm)
        finally:
            self.bus.publish({"type": "suite_end", "run_id": run_id,
                              "budget": budget.snapshot(),
                              "results": [{"scenario": r["scenario"]["id"],
                                           "outcome": r["outcome"].get("outcome")}
                                          for r in self.results]})
            self.current = None
        return self.results

    # ── internals ───────────────────────────────────────────────────────
    async def _execute(self, picked, llm, budget, run_id, mock_llm):
        ops = cat.load()
        pmap = personas()
        tmap = persona_tools()
        serial = [s for s in picked if s.get("mode") in ("chain", "admin", "security")]
        parallel = [s for s in picked if s not in serial]

        async with httpx.AsyncClient() as ac:
            with httpx.Client(base_url=self.cfg["backend_url"]) as sc:
                # serial world first (chains seed entities others could use)
                for scn in serial:
                    await self._run_one(scn, ops, pmap, tmap, llm, budget, run_id, mock_llm, ac, sc)
                sem = asyncio.Semaphore(int(self.cfg.get("concurrency", 3)))

                async def guarded(s):
                    async with sem:
                        await self._run_one(s, ops, pmap, tmap, llm, budget, run_id, mock_llm, ac, sc)

                await asyncio.gather(*[guarded(s) for s in parallel])

    async def _run_one(self, scn, ops, pmap, tmap, llm, budget, run_id, mock_llm, ac, sc):
        sid = scn["id"]
        self.current["scenario"], self.current["step"] = sid, 0
        mode = scn.get("mode", "guided")
        base = self.cfg["backend_url"]

        if mode == "security":
            result = await asyncio.to_thread(_security_probe, scn, self.cfg, sc)
            self._record(sid, scn, result.get("runlog", []), result["outcome"],
                         budget, debrief_data=None, run_id=run_id)
            return

        steps = [scn] + [{"id": f"{sid}·{i+2}", "persona": c["persona"], "mode": "guided",
                          "goal": c["goal"], "suite": scn.get("suite")} for i, c in
                         enumerate(scn.get("chain", []))]
        world: dict = {}
        all_logs: list[dict] = []
        outcome: dict = {}
        persona_id = scn["persona"]
        persona = pmap.get(persona_id, {"id": persona_id, "name": persona_id})
        ident = resolve(sc, base, persona_id) if mode != "chain" else None
        if mode != "chain" and ident.get("blocked"):
            outcome = {"outcome": "blocked_identity", "reason": ident["reason"]}
            self._record(sid, scn, [], outcome, budget, None, run_id)
            return

        for step_def in steps:
            pid = step_def["persona"]
            persona = pmap.get(pid, {"id": pid, "name": pid})
            if mode == "chain" or pid in OPERATORS:
                ident = resolve(sc, base, pid)
                if ident.get("blocked"):
                    outcome = {"outcome": "blocked_identity", "reason": f"{pid}: {ident['reason']}"}
                    break
            runlog: list[dict] = []
            tools = Tools(sc, base, ident["token"], ops, runlog,
                          audit_reason=f"sim-{run_id}" if pid in OPERATORS else None,
                          run_id=run_id)
            prefix = cat.tool_index(ops, pid, tmap.get(pid) or tmap.get("_default"))

            def on_step(n, act, _sid=sid, _pid=pid):
                self.current["step"] = n
                self.bus.publish({"type": "step", "run_id": run_id, "scenario": _sid,
                                  "persona": _pid, "step": n, "action": act.get("action"),
                                  "endpoint": act.get("endpoint_id"),
                                  "reason": act.get("reason", "")[:160]})

            agent = Agent(llm or _MockLLM(), self.cfg["model"], tools, budget, self.cfg,
                          on_step=on_step,
                          mock={"action": "done", "summary": "mock-llm"} if mock_llm else None)
            goal = step_def["goal"]
            if world:
                goal += "\nSHARED CONTEXT: " + json.dumps(world, ensure_ascii=False)
            self.bus.publish({"type": "run_start", "run_id": run_id, "scenario": sid,
                              "persona": pid, "goal": goal[:200]})
            outcome = await agent.run(persona_card(persona), goal, prefix,
                                      int(step_def.get("max_steps", self.cfg.get("max_steps_default", 30))),
                                      world=world or None)
            all_logs.extend(runlog)
            for k, v in extract_ids(json.dumps(runlog, ensure_ascii=False)).items():
                world.setdefault(k, v)
            if outcome.get("outcome") in ("done", "gave_up", "stuck_repeat",
                                          "stuck_no_progress", "step_cap") or step_def is steps[-1]:
                pass
            if outcome.get("outcome") not in ("done",) and mode == "chain":
                break          # chain link failed — seam recorded (specs §8 Mode E)

        db = None
        if llm and not mock_llm and all_logs and outcome.get("outcome") != "blocked_identity":
            db = await run_debrief(llm, self.cfg["model"], persona, steps[0]["goal"], all_logs)
        self._record(sid, scn, all_logs, outcome, budget, db, run_id)

    def _record(self, sid, scn, runlog, outcome, budget, debrief_data, run_id):
        (RUNS_DIR).mkdir(exist_ok=True)
        path = RUNS_DIR / f"{run_id}--{sid}.jsonl"
        path.write_text("\n".join(json.dumps(x, ensure_ascii=False) for x in runlog))
        meta = {"run_id": run_id, "scenario": scn, "outcome": outcome,
                "budget": budget.snapshot()}
        (RUNS_DIR / f"{run_id}--{sid}.meta.json").write_text(json.dumps(meta, indent=1))
        if debrief_data:
            (RUNS_DIR / f"{run_id}--{sid}.debrief.json").write_text(
                json.dumps(debrief_data, indent=1, ensure_ascii=False))
        rec = {"scenario": scn, "outcome": outcome, "meta_path": str(path)}
        self.results.append(rec)
        if self.current:
            self.current["done"] += 1
            self.current["budget"] = budget.snapshot()
        self.bus.publish({"type": "run_end", "run_id": run_id, "scenario": sid,
                          "outcome": outcome.get("outcome"), "steps": outcome.get("steps")})


class _MockLLM:
    async def close(self):
        pass


def _creds() -> tuple[str, str]:
    from .config import llm_credentials
    return llm_credentials()


# ── deterministic security probes (Mode F — zero LLM cost) ─────────────────
def _security_probe(scn: dict, cfg: dict, sc: httpx.Client) -> dict:
    base = cfg["backend_url"]
    log: list[dict] = []
    pid = scn["persona"]

    def rec(op, method, path, status, note=""):
        log.append({"op_id": op, "method": method, "path": path, "tag": "security",
                    "status": status, "latency_ms": 0, "resp_excerpt": json.dumps({"probe": note})})

    ident = resolve(sc, base, "customer")
    ident_b = resolve(sc, base, "farmer")
    probe = scn["id"]

    if probe == "sec-cross-tenant-read":
        r1 = sc.get(f"{base}/v1/marketplace/orders", headers={"Authorization": f"Bearer {ident['token']}"})
        rec("list_own_orders", "GET", "/v1/marketplace/orders", r1.status_code, "baseline")
        if r1.status_code == 200:
            try:
                first = (r1.json() or [{}])[0]
                oid = first.get("orderId") or first.get("id") or "ord_probe_0001"
            except Exception:
                oid = "ord_probe_0001"
            r2 = sc.get(f"{base}/v1/marketplace/orders/{oid}",
                        headers={"Authorization": f"Bearer {ident_b['token']}"})
            ok = r2.status_code in (401, 403, 404)
            rec("read_other_users_order", "GET", f"/v1/marketplace/orders/{oid}", r2.status_code,
                "PASS" if ok else "FAIL — cross-tenant read allowed")
        outcome = "pass"
    elif probe == "sec-revoked-token":
        sc.post(f"{base}/v1/auth/logout", headers={"Authorization": f"Bearer {ident['token']}"})
        r = sc.get(f"{base}/v1/users/me", headers={"Authorization": f"Bearer {ident['token']}"})
        rec("use_token_after_logout", "GET", "/v1/users/me", r.status_code,
            "PASS" if r.status_code == 401 else "FAIL — revoked token accepted")
        outcome = "pass" if r.status_code == 401 else "fail"
    elif probe == "sec-admin-no-audit-reason":
        op = resolve(sc, base, "operations_lead")
        h = {"Authorization": f"Bearer {op['token']}"}   # no X-Audit-Reason on purpose
        r = sc.post(f"{base}/v1/admin/users/status", json={"userId": "x", "status": "active"}, headers=h)
        rec("admin_mutation_no_audit", "POST", "/v1/admin/users/status", r.status_code,
            "PASS" if r.status_code == 400 else "FAIL — audit header not enforced")
        outcome = "pass" if r.status_code == 400 else "fail"
    elif probe == "sec-role-cross-call":
        r = sc.get(f"{base}/v1/admin/users", headers={"Authorization": f"Bearer {ident['token']}"})
        rec("user_hits_admin_endpoint", "GET", "/v1/admin/users", r.status_code,
            "PASS" if r.status_code in (401, 403) else "FAIL — RBAC bypass")
        outcome = "pass" if r.status_code in (401, 403) else "fail"
    else:
        outcome, log = "skipped", []
    fails = [l for l in log if "FAIL" in str(l.get("resp_excerpt", ""))]
    return {"outcome": {"outcome": outcome if not fails else "fail", "steps": len(log)},
            "runlog": log}
