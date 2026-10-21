"""Post-run structured debrief (specs §9). One LLM call per run."""
from .agent import extract_json, persona_card

SYSTEM = """You are the persona below, debriefing your session with the app.
Report ONLY what actually happened in the trace. Strict JSON:
{"completed":true/false,
"blockers":[{"what":"...","step":0,"evidence":"..."}],
"missing_features":["capability you wanted but could not find/do"],
"confusing":["steps you retried or misunderstood"],
"unnecessary":["steps that felt redundant"],
"satisfaction":1-5,
"verbatim_frustration":"one sentence in your own voice"}
Rules: every blocker/missing_feature must reference something in the trace."""


async def debrief(llm, model: str, persona: dict, goal: str, runlog: list[dict],
                  max_tokens: int = 1500) -> dict:
    trace = "\n".join(
        f"{i+1}. {r.get('method','?')} {r.get('path') or r.get('query','?')} → {r.get('status','?')}"
        + (f" | expected: {r['expectation']}" if r.get("expectation") else "")
        + (f" | async_wait: {r['async_wait']}" if r.get("async_wait") else "")
        for i, r in enumerate(runlog[-40:]))
    last_err = "unparseable"
    for _ in range(2):                       # reasoning models can truncate JSON — retry once
        try:
            r = await llm.chat.completions.create(
                model=model, max_tokens=max_tokens,
                response_format={"type": "json_object"},
                messages=[{"role": "system", "content": SYSTEM + "\n" + persona_card(persona)},
                          {"role": "user", "content": f"GOAL: {goal}\nTRACE:\n{trace}"}])
            parsed = extract_json(r.choices[0].message.content)
            if "completed" in parsed or "blockers" in parsed:
                return parsed
            last_err = "missing keys"
        except Exception as e:
            last_err = type(e).__name__
    return {"completed": None, "error": f"debrief failed: {last_err}",
            "missing_features": [], "blockers": [], "satisfaction": None}
