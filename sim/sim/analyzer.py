"""runs/*.jsonl + *.debrief.json → reports/ (specs §13, §18; formats in examples/).

Pure stdlib — re-running analysis costs zero LLM tokens (specs §10 replay).
"""
import json
import re
import statistics as stats
from collections import Counter, defaultdict
from pathlib import Path

from .config import (REPORTS_DIR, RUNS_DIR, known_gaps, personas, severity, slo)
from .tools import extract_ids

TITLES = {
    "sec-cross-tenant-read": "Cross-tenant object reads blocked (IDOR)",
    "sec-revoked-token": "Revoked tokens rejected",
    "sec-admin-no-audit-reason": "Admin mutations require X-Audit-Reason",
    "sec-role-cross-call": "User tokens rejected on admin endpoints (RBAC)",
}
STUCK_OUTCOMES = {"stuck_repeat", "stuck_no_progress"}
MUTATING = {"POST", "PUT", "PATCH"}


def _runs() -> list[tuple[Path, dict, list[dict], dict | None]]:
    out = []
    for meta_p in sorted(RUNS_DIR.glob("*.meta.json")):
        meta = json.loads(meta_p.read_text())
        stem = str(meta_p).replace(".meta.json", "")
        log_p = Path(stem + ".jsonl")
        log = [json.loads(l) for l in log_p.read_text().splitlines() if l.strip()] if log_p.exists() else []
        deb_p = Path(stem + ".debrief.json")
        deb = json.loads(deb_p.read_text()) if deb_p.exists() else None
        out.append((meta_p, meta, log, deb))
    return out


def analyze() -> dict:
    runs = _runs()
    sev = severity()
    slo_cfg = slo()
    suppressed = {v["title"].lower() for v in known_gaps() if v.get("verdict") in ("not-real", "duplicate-of")}
    closed = {v["title"].lower(): v for v in known_gaps() if v.get("closed_by")}

    hits, errors, lat = Counter(), Counter(), defaultdict(list)
    retries = Counter()
    mismatches, suspicions, searches_nohit, searches_all = [], [], [], []
    stuck_runs, debriefs, satisfaction = [], [], []
    coverage = defaultdict(set)          # persona -> set of ops
    persona_kw_hits = defaultdict(set)   # persona -> must_touch keywords seen in paths
    security = []
    per_run: list[dict] = []

    for meta_p, meta, log, deb in runs:
        scn, outcome = meta["scenario"], meta.get("outcome", {})
        pid = scn.get("persona", "?")
        per = {"id": scn.get("id"), "persona": pid, "mode": scn.get("mode"),
               "outcome": outcome.get("outcome"), "steps": outcome.get("steps", 0),
               "goal": scn.get("goal", "")[:300], "run": meta_p.name}
        per_run.append(per)
        if scn.get("mode") == "security":
            security.append({"id": scn.get("id"), "title": TITLES.get(scn.get("id"), scn.get("id")),
                             "result": outcome.get("outcome", "?"), "run": meta_p.name})
            continue
        if outcome.get("outcome") == "blocked_identity":
            stuck_runs.append({**per, "pattern": f"identity: {outcome.get('reason')}"})
            continue

        prev, prev_prev = None, None
        for i, rec in enumerate(log):
            if rec.get("op_id") == "search":
                (searches_nohit if rec.get("status") == 0 else searches_all).append(
                    {"q": rec.get("query", ""), "run": meta_p.name})
                continue
            coverage[pid].add(rec["op_id"])
            for kw in (personas().get(pid, {}).get("must_touch") or []):
                if kw and kw in rec.get("path", ""):
                    persona_kw_hits[pid].add(kw)
            lat[rec["op_id"]].append(rec.get("latency_ms", 0))
            if rec.get("status", 0) >= 400:
                errors[rec["op_id"]] += 1
            if rec.get("expectation") and rec.get("status", 0) >= 400:
                mismatches.append({"op": rec["op_id"], "expected": rec["expectation"],
                                   "got": rec["status"], "run": meta_p.name})
            if prev and rec["op_id"] == prev.get("op_id") and rec.get("method") in ("GET",):
                retries[rec["op_id"]] += 1
            if rec["method"] in MUTATING and rec.get("status", 0) < 300:
                _consistency_probe(log, i, suspicions, meta_p.name)
            prev_prev, prev = prev, rec

        if outcome.get("outcome") in STUCK_OUTCOMES | {"step_cap"}:
            pat = _stuck_pattern(log)
            stuck_runs.append({**per, "pattern": pat})
        if deb:
            debriefs.append((meta_p.name, pid, scn.get("id"), deb))
            if deb.get("satisfaction"):
                satisfaction.append(int(deb["satisfaction"]))

    # ── missing-feature board ────────────────────────────────────────────
    board: dict[str, dict] = {}

    def add(title, cls, score_hint, evidence):
        key = re.sub(r"\s+", " ", title.lower()).strip()[:90]
        if key in suppressed:
            return
        e = board.setdefault(key, {"title": title, "class": cls, "personas": set(),
                                   "runs": 0, "evidence": []})
        e["runs"] += 1
        e["personas"].add(evidence.get("persona", "?"))
        if len(e["evidence"]) < 3:
            e["evidence"].append(evidence)

    for s in searches_nohit:
        add(f"capability not found via search: '{s['q']}'", "feature-gap",
            sev.get("default", 1), {"persona": "?", "run": s["run"], "kind": "zero-search"})
    for name, pid, sid, d in debriefs:
        for m in (d.get("missing_features") or []):
            if _evidenced(str(m), name):
                add(str(m)[:110], "feature-gap", sev.get("default", 1),
                    {"persona": pid, "run": name, "kind": "debrief"})
        for b in (d.get("blockers") or []):
            what = b.get("what") if isinstance(b, dict) else str(b)
            if what and _evidenced(str(what), name):
                add(str(what)[:110], "bug-suspicion", sev.get("default", 1),
                    {"persona": pid, "run": name, "kind": "blocker"})
    for m in mismatches:
        add(f"{m['op']}: expected '{m['expected']}' got {m['got']}", "expectation-mismatch",
            sev.get("default", 1), {"persona": "?", "run": m["run"], "kind": "mismatch"})
    for sp in suspicions:
        add(f"dataflow: created {sp['created']} not visible via {sp['read_via']}",
            "dataflow-suspicion", sev.get("default", 1),
            {"persona": "?", "run": sp["run"], "kind": "probe"})

    scored = []
    for e in board.values():
        weight = max([sev.get(k, sev.get("default", 1)) for k in
                      re.findall(r"[a-z-]+", e["title"].lower())] or [sev.get("default", 1)])
        e["score"] = e["runs"] * max(1, len(e["personas"])) * weight
        scored.append(e)
    scored.sort(key=lambda e: -e["score"])

    # ── friction ─────────────────────────────────────────────────────────
    friction = []
    for per, (meta_p, meta, log, deb) in zip(per_run, runs):
        if meta["scenario"].get("mode") in ("security",):
            continue
        lats = [r.get("latency_ms", 0) for r in log if r.get("status")]
        gets = [r.get("latency_ms", 0) for r in log if r.get("method") == "GET"]
        muts = [r.get("latency_ms", 0) for r in log if r.get("method") in MUTATING]
        p95 = lambda xs: sorted(xs)[int(0.95 * (len(xs) - 1))] if xs else 0
        n5 = sum(1 for r in log if r.get("status", 0) >= 500)
        slo_ok = (p95(gets) <= slo_cfg.get("get_p95_ms", 400)
                  and p95(muts) <= slo_cfg.get("mutation_p95_ms", 800)
                  and n5 <= slo_cfg.get("max_5xx", 0))
        friction.append({"scenario": per["id"], "persona": per["persona"],
                         "outcome": per["outcome"], "steps": per["steps"],
                         "retry_ops": dict(Counter(k for k, v in retries.items()
                                                   if any(r.get("op_id") == k for r in log))),
                         "p95_ms": p95(lats), "slo_ok": slo_ok,
                         "satisfaction": (deb or {}).get("satisfaction")})

    report = {
        "meta": {"runs": len(runs), "generated": time_str(),
                 "cost_usd": _total_cost(runs)},
        "executive": {
            "missing_features": len(scored),
            "userflow_obstacles": len(stuck_runs) + sum(len(f["retry_ops"]) for f in friction),
            "dataflow_suspicions": len(suspicions),
            "security": f"{sum(1 for s in security if s['result'] == 'pass')}/{len(security)} passed",
            "blocked_identities": sum(1 for p in per_run if p["outcome"] == "blocked_identity"),
        },
        "missing_features": [{**e, "personas": sorted(e["personas"])} for e in scored],
        "stuck": stuck_runs,
        "mismatches": mismatches,
        "suspicions": suspicions,
        "failures": [{"op": k, "count": v} for k, v in errors.most_common(15)],
        "coverage": {
            "per_persona": {pid: {"must_touch": personas().get(pid, {}).get("must_touch", []),
                                  "seen": sorted(persona_kw_hits.get(pid, set())),
                                  "ops_hit": len(coverage.get(pid, set()))}
                            for pid in {p["persona"] for p in per_run}},
            "top_hit_ops": [{"op": k, "hits": v} for k, v in hits.most_common(0)][:0] or
                           [{"op": k, "hits": v} for k, v in
                            Counter({op: len([1 for c in coverage.values() if op in c]) for op in
                                     {o for c in coverage.values() for o in c}}).most_common(15)],
            "zero_hit_total": None,
        },
        "friction": friction,
        "security": security,
        "debriefs": [{"run": n, "persona": p, "scenario": s, **d} for n, p, s, d in debriefs],
        "searches_no_hit": searches_nohit,
        "satisfaction_avg": round(sum(satisfaction) / len(satisfaction), 2) if satisfaction else None,
    }

    REPORTS_DIR.mkdir(exist_ok=True)
    (REPORTS_DIR / "report.json").write_text(json.dumps(report, indent=1, ensure_ascii=False))
    _render_report_md(report)
    _render_personas(runs)
    _render_review_queue(report)
    return report


def time_str():
    import time
    return time.strftime("%Y-%m-%d %H:%M:%S")


def _total_cost(runs) -> float:
    return round(max((m.get("budget", {}).get("usd", 0) for _, m, _, _ in runs), default=0), 4)


def _evidenced(text: str, run_name: str) -> bool:
    """Debrief hallucination guard (specs §18g): claim must fuzzy-match the run log."""
    try:
        log_text = Path(str(RUNS_DIR / run_name.replace(".meta.json", "")) + ".jsonl").read_text().lower()
    except Exception:
        return True                       # no log to check — don't drop, flag as weak
    toks = {t for t in re.findall(r"[a-z]{4,}", text.lower()) if t not in ("this", "that", "with", "from", "want", "cant", "cannot", "feature", "should")}
    return bool(toks) and len(toks & set(re.findall(r"[a-z]{4,}", log_text))) >= max(1, len(toks) // 2)


def _stuck_pattern(log: list[dict]) -> str:
    tail = [r for r in log[-6:] if r.get("op_id") != "search"]
    if not tail:
        return "no actions logged"
    op = tail[-1]["op_id"]
    codes = Counter(r.get("status") for r in tail if r["op_id"] == op)
    code = codes.most_common(1)[0][0] if codes else "?"
    return f"repeated {op} (status {code}) near end of run"


def _consistency_probe(log, i, out, run_name):
    rec = log[i]
    ids = extract_ids(rec.get("resp_excerpt", ""))
    if not ids:
        return
    key, val = next(iter(ids.items()))
    tag_prefix = "/" + rec.get("path", "").strip("/").split("/")[1] if rec.get("path", "").count("/") > 1 else ""
    for nxt in log[i + 1:i + 4]:
        if nxt.get("method") == "GET" and (val in nxt.get("path", "") or val in nxt.get("resp_excerpt", "")):
            empty = nxt.get("resp_excerpt", "") in ("{}", "[]", "")
            if nxt.get("status") in (404, 422) or empty:
                out.append({"run": run_name, "created": f"{key}={val} via {rec['op_id']}",
                            "read_via": nxt["op_id"], "status": nxt["status"]})
            return


# ── markdown renderers ─────────────────────────────────────────────────────
def _render_report_md(r: dict):
    L = ["# Agrovercity Sim Report", "", f"generated: {r['meta']['generated']} · "
         f"runs: {r['meta']['runs']} · cumulative cost: ${r['meta']['cost_usd']}", ""]
    ex = r["executive"]
    L += ["## 1. Executive summary", "",
          f"- missing-feature candidates: **{ex['missing_features']}**",
          f"- userflow obstacles: **{ex['userflow_obstacles']}**",
          f"- dataflow suspicions: **{ex['dataflow_suspicions']}**",
          f"- security probes: **{ex['security']}**",
          f"- blocked identities (harness gaps, specs §18i): **{ex['blocked_identities']}**",
          f"- avg satisfaction: {r['satisfaction_avg']}", ""]
    if r["missing_features"]:
        L += ["## 2. Missing-feature board", "", "| # | finding | class | score | personas | evidence |", "|---|---|---|---|---|---|"]
        for n, e in enumerate(r["missing_features"][:20], 1):
            ev = "; ".join(f"{x['kind']}@{x['run'].replace('.meta.json','')}" for x in e["evidence"][:2])
            L.append(f"| {n} | {e['title']} | {e['class']} | {e['score']} | {', '.join(e['personas'][:4])} | {ev} |")
        L.append("")
    if r["failures"]:
        L += ["## 3. Failure taxonomy (top)", "", "| endpoint | errors |", "|---|---|"]
        L += [f"| `{f['op']}` | {f['count']} |" for f in r["failures"][:10]] + [""]
    if r["stuck"]:
        L += ["## 4. Stuck report", ""]
        L += [f"- **{s['id']}** ({s['persona']}): {s['pattern']} — outcome {s['outcome']}" for s in r["stuck"]] + [""]
    if r["suspicions"]:
        L += ["## 5. Dataflow suspicions (write→read-back)", "",
              "| created via | read via | status | run |", "|---|---|---|---|"]
        L += [f"| {s['created']} | {s['read_via']} | {s['status']} | {s['run'].replace('.meta.json','')} |"
              for s in r["suspicions"]] + [""]
    if r["friction"]:
        L += ["## 6. Friction index", "",
              "| scenario | outcome | steps | p95 ms | SLO | sat |", "|---|---|---|---|---|---|"]
        for f in r["friction"]:
            L.append(f"| {f['scenario']} | {f['outcome']} | {f['steps']} | {f['p95_ms']} | "
                     f"{'✅' if f['slo_ok'] else '❌'} | {f['satisfaction'] or '-'} |")
        L.append("")
    if r["security"]:
        L += ["## 7. Security probes", ""]
        L += [f"- {'✅' if s['result'] == 'pass' else '❌'} {s['title']} ({s['id']})" for s in r["security"]] + [""]
    cov = r["coverage"]["per_persona"]
    if cov:
        L += ["## 8. Coverage (must_touch keywords seen in requests)", ""]
        for pid, c in cov.items():
            missing = [k for k in c["must_touch"] if k not in c["seen"]]
            mark = "⚠️ " + ", ".join(missing) if missing else "✓"
            L.append(f"- **{pid}** ({c['ops_hit']} ops): {mark}")
        L.append("")
    q = [d for d in r["debriefs"] if d.get("verbatim_frustration")]
    if q:
        L += ["## 9. Verbatim frustrations", ""]
        L += [f"> \"{d['verbatim_frustration']}\"\n> — {d['persona']}, {d['scenario']}\n" for d in q[:8]]
    L += ["---", "*Suspicions are heuristics, not verdicts — work the review queue.*", ""]
    (REPORTS_DIR / "report.md").write_text("\n".join(L))


def _render_personas(runs):
    pmap = personas()
    items = []
    md = ["# Persona Activity", ""]
    for meta_p, meta, log, deb in runs:
        scn, outcome = meta["scenario"], meta.get("outcome", {})
        if scn.get("mode") == "security":
            continue
        pid = scn.get("persona", "?")
        p = pmap.get(pid, {})
        tl = []
        for i, rec in enumerate(log[:40], 1):
            if rec.get("op_id") == "search":
                tl.append({"step": i, "action": "searched", "target": rec.get("query"),
                           "result": "no matches" if rec.get("status") == 0 else "found"})
                continue
            res = rec.get("resp_excerpt", "")[:120]
            tl.append({"step": i, "action": f"{rec.get('method')} {rec.get('path')}",
                       "target": rec.get("op_id"), "status": rec.get("status"),
                       "result": res, "latency_ms": rec.get("latency_ms")})
        item = {"persona": pid, "name": p.get("name"), "scenario": scn.get("id"),
                "goal": scn.get("goal"), "outcome": outcome.get("outcome"),
                "steps": outcome.get("steps"), "satisfaction": (deb or {}).get("satisfaction"),
                "quote": (deb or {}).get("verbatim_frustration"),
                "timeline": tl,
                "touched": sorted({r.get("tag", "?") for r in log if r.get("op_id") != "search"}),
                "run": meta_p.name}
        items.append(item)
        icon = {"done": "✅", "gave_up": "🛑"}.get(item["outcome"], "⚠️")
        md.append(f"## {icon} {pid} — {p.get('name', '')} · `{scn.get('id')}`  ")
        md.append(f"**{item['outcome']}** · {item['steps']} steps · satisfaction {item['satisfaction'] or '-'}  ")
        if item["quote"]:
            md.append(f"> \"{item['quote']}\"  ")
        md.append("")
        for t in tl[:14]:
            md.append(f"{t['step']}. {t['action']}" + (f" `{t.get('target')}`" if t.get("target") else "")
                      + f" → {t.get('status', t.get('result', ''))}")
        if len(tl) > 14:
            md.append(f"… ({len(tl) - 14} more steps in runs/{meta_p.name.replace('.meta.json', '.jsonl')})")
        md.append("")
    (REPORTS_DIR / "personas.json").write_text(json.dumps(items, indent=1, ensure_ascii=False))
    (REPORTS_DIR / "personas.md").write_text("\n".join(md))


def _render_review_queue(r: dict):
    L = ["# Review queue — human verdicts (specs §18a)", "",
         "Verdicts go to config/known_gaps.yaml; not-real/duplicate-of suppress,",
         "closed_by records the fix commit.", ""]
    for n, e in enumerate(r["missing_features"][:20], 1):
        ev = e["evidence"][0] if e["evidence"] else {}
        L.append(f"- [ ] #{n} [{e['class']}] {e['title']}  ")
        L.append(f"      evidence: {ev.get('kind', '?')} @ {ev.get('run', '?')} · "
                 f"personas: {', '.join(e['personas'][:4])} · score {e['score']}")
    (REPORTS_DIR / "review_queue.md").write_text("\n".join(L) + "\n")
