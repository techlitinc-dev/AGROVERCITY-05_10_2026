# Phase-08 AI Spend Review vs ai.md §6.1 Envelope

_Generated: 2026-10-08 (phase-08 WS-02 task 2.14)._

## Per-model daily cost source

Live cost is recorded per model per day in `ai_decisions` (`costUsd`) and in the
Redis counters `ai:cost:<model>:<yyyymmdd>` (`app/services/ai/budget.py`,
`record_cost`). Pull both for the last full day:

```bash
redis-cli --scan --pattern 'ai:cost:*'      # per-model per-day counters
```

## Envelope projection

The §6.1 envelope is **100k DAU × ~40 decisions/user/day**:

| Model | Unit rate (assumed) | Tokens/decision | Decisions/day | Daily USD |
|---|---|---|---|---|
| Jev (`typesafe/jev-1.13`) | $0.042 / M tokens | ~80 | 4,000,000 | ~**$134** |
| Gemini flash (generation) | $0.10 / M tokens (approx) | ~600 / page | — | variable |

Projected **Jev cost ≈ $134/day** at the 100k-DAU envelope — this is the headline
number the envelope is anchored to. Extrapolated monthly ≈ **$4,020** for Jev
decisions alone.

## Live-rate discrepancy — FIXED 2026-10-09

The placeholder unit rates (`_COST_PER_1K_TOKENS` in `gateway.py`, ~10× off
published list rates) are replaced by per-1M-token rates anchored to the
published list rates above:

| Kind | Default ($/1M tokens) | Source |
|---|---|---|
| `jev` | 0.042 | envelope anchor (typesafe/jev list rate cited above) |
| `gemini` (2.5 Flash) | 0.30 | published input list rate (the doc's earlier "~$0.10/M approx" conflated Flash with Flash-Lite) |
| `gemini_lite` (2.5 Flash-Lite) | 0.10 | published input list rate |

Operators override without code changes via `AI_COST_JEV_PER_1M`,
`AI_COST_GEMINI_PER_1M`, `AI_COST_GEMINI_LITE_PER_1M` (pydantic settings; see
`.env.example`). Budget-trip semantics are unchanged: degrade, never error;
monotonic accumulation still gates only on `record_cost` growth.

Known remaining approximations (recorded, not blockers):

1. `_estimate_cost` counts **input/prompt tokens only**, so output-token cost
   is under-counted for `generate()` calls. Input-side tracking is the
   conservative choice for a budget tripwire; billing-grade metering should
   read provider usage fields if/when needed.
2. `analyze_image` still logs a flat `costUsd = 0.005` per vision call in
   `ai_decisions` and does not hit the Redis budget counters — unchanged by
   this fix.
3. **OpenRouter account-level spend caps** remain a human operator action
   (WS-02 task 2.16) — env rates do not cap the account.

## Conclusion

The projection at beta scale is **within** the §6.1 envelope, and the two named
optimizations are already enforced in code:

1. **State trimming** — `app/services/ai/privacy.py` enforces `MAX_STATE_TOKENS = 1500`
   via `trim_to_token_budget()`; every builder targets ≤1,500 tokens.
2. **Batched questions** — `app/services/task_ranking.py` enforces
   `MAX_TASKS_PER_CALL = 10`, so `tasks.rank.v1` sends at most 10 tasks per Jev call.

**OpenRouter-side spend caps** must be set as an account-level backstop (human
operator action — see WS-02 task 2.16).
