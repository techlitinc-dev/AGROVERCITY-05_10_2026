"""The perceive → decide → act loop (specs §5). Only JSON ever comes out of the model."""
import json
import re

from .tools import Tools, extract_ids

ACTION_SCHEMA = """{"action":"call_endpoint|search_tools|poll|wait|give_up|done",
"reason":"one line, persona voice","endpoint_id":"...","params":{"path":{},"query":{},"body":{}},
"expectation":"what I think happens","satisfaction":1}
Rules: 'done' adds "summary". 'give_up' adds "blocker". 'poll' adds "needle" (text to wait for)."""

RULES = """You are a real user of the Agrovercity app (see PERSONA). You are NOT the system.
- Achieve your goal using endpoints from the index, or search_tools to find more.
- Never invent endpoint paths. If a search returns nothing, that itself is noteworthy — say so in reason.
- Index parameter notation: q{name?, id!} = query params (? optional, ! required); p{...} = path params; body{...} = JSON body fields. Use these hints directly — do NOT waste steps searching for parameter names.
- After a successful POST/PUT, re-read with a GET to confirm it persisted.
- For things that take time (payments, settlements), use poll with the GET endpoint and a needle.
- Do NOT re-fetch information you already have — act on it. Re-checking the same price/list twice is a wasted step.
- Say 'done' only when the WHOLE goal is achieved (lot created, order paid, answer found) — never after just one step of it.
- If blocked twice in a row, change approach; if truly stuck, give_up with the blocker.
- Think in your own language; respond ONLY with the JSON action."""


class Agent:
    def __init__(self, llm, model: str, tools: Tools, budget, cfg: dict,
                 on_step=None, mock: dict | None = None):
        self.llm, self.model, self.tools, self.budget, self.cfg = llm, model, tools, budget, cfg
        self.on_step = on_step            # dashboard event hook
        self.mock = mock

    async def _decide(self, system: str, user_msg: str) -> dict:
        if self.mock:
            return dict(self.mock)
        last_err = None
        no_temp = False                    # provider quirks: e.g. Kimi Code allows only temperature=1
        attempts = int(self.cfg.get("llm_retries", 2)) + 1
        for _ in range(attempts):
            try:
                kwargs = {"model": self.model,
                          "messages": [{"role": "system", "content": system},
                                       {"role": "user", "content": user_msg}],
                          "max_tokens": int(self.cfg.get("llm_max_tokens", 800)),
                          "response_format": {"type": "json_object"}}
                temp = self.cfg.get("llm_temperature")
                if temp is not None and not no_temp:
                    kwargs["temperature"] = float(temp)
                r = await self.llm.chat.completions.create(**kwargs)
                self.budget.charge(r.usage)
                return extract_json(r.choices[0].message.content)
            except Exception as e:          # provider hiccup — backoff retry
                last_err = e
                if "temperature" in str(e).lower() and not no_temp:
                    no_temp = True          # retry once without temperature, then keep it off
        return {"action": "wait", "reason": f"llm error: {type(last_err).__name__}"}

    async def run(self, persona_card: str, goal: str, system_prefix: str,
                  max_steps: int, world: dict | None = None) -> dict:
        system = (system_prefix + "\n" + persona_card + "\n" + RULES
                  + "\nACTION FORMAT:\n" + ACTION_SCHEMA)
        history: list[str] = []
        memory: list[str] = []
        last_calls: list[tuple] = []
        no_progress = 0
        last_state = None
        for step in range(1, max_steps + 1):
            if self.budget.exhausted():
                return {"outcome": "budget_exhausted", "steps": step}
            goal_txt = goal + (f"\nCONTEXT from other users: {world}" if world else "")
            user_msg = (f"GOAL: {goal_txt}\nMEMORY: {memory[-8:]}\n"
                        f"RECENT: {history[-6:]}\nWhat do you do next?")
            act = await self._decide(system, user_msg)
            a = act.get("action")
            self._emit(step, act)

            if a == "done":
                return {"outcome": "done", "steps": step, "act": act}
            if a == "give_up":
                return {"outcome": "gave_up", "steps": step, "act": act}
            if a == "search_tools":
                obs = json.dumps(self.tools.search(act.get("reason", "")), ensure_ascii=False)
            elif a == "poll":
                obs = json.dumps(self.tools.poll(
                    act.get("endpoint_id", ""), act.get("params"), act.get("needle", ""),
                    int(self.cfg.get("poll_tries", 5)), int(self.cfg.get("poll_interval_s", 3))),
                    ensure_ascii=False)
            elif a == "wait":
                obs = '{"note":"waited"}'
            else:
                call = self.tools.call(act.get("endpoint_id", ""), act.get("params"))
                obs = json.dumps(call, ensure_ascii=False)
                sig = (act.get("endpoint_id", ""),
                       json.dumps(act.get("params"), sort_keys=True, ensure_ascii=False),
                       call.get("status"))
                last_calls.append(sig)
                last_calls = last_calls[-4:]
                if len(last_calls) == 4 and len(set(last_calls)) == 1:
                    return {"outcome": "stuck_repeat", "steps": step, "act": act}
                if act.get("expectation") and self.tools.log:
                    self.tools.log[-1]["expectation"] = str(act["expectation"])[:200]
                # memory: remember ids + statuses so later steps can reference them
                for k, v in extract_ids(str(call.get("body", ""))).items():
                    memory.append(f"{k}={v}")
                for kv in (act.get("params", {}).get("query") or {}).items():
                    if str(kv[0]).lower() in ("status", "state"):
                        memory.append(f"{kv[0]}={kv[1]}")
            state_sig = obs[-120:]
            no_progress = 0 if state_sig != last_state else no_progress + 1
            last_state = state_sig
            if no_progress >= 5:
                return {"outcome": "stuck_no_progress", "steps": step, "act": act}
            history.append(f"s{step} {a} {act.get('endpoint_id') or act.get('reason','')} → {obs[:220]}")
        return {"outcome": "step_cap", "steps": max_steps}

    def _emit(self, step: int, act: dict):
        if self.on_step:
            try:
                self.on_step(step, act)
            except Exception:
                pass


def extract_json(text: str) -> dict:
    m = re.search(r"\{.*\}", text or "", re.S)
    try:
        return json.loads(m.group(0)) if m else {"action": "wait", "reason": "unparseable"}
    except json.JSONDecodeError:
        return {"action": "wait", "reason": "unparseable"}


def persona_card(p: dict) -> str:
    return (f"PERSONA: {p.get('name','?')} from {p.get('district','?')}. "
            f"Speaks {p.get('language','hinglish')}. "
            f"Tech literacy: {p.get('tech_literacy','medium')}. "
            f"Patience: {p.get('patience','medium')}. "
            f"Goals: {', '.join(p.get('goals', [])[:3])}.")
