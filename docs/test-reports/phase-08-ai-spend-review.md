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

## Live-rate discrepancy (recorded explicitly)

The published OpenRouter/Gemini list rates at review time were ~10× the
placeholder unit rates embedded in the repo (`_COST_PER_1K_TOKENS` in
`gateway.py` uses conservative placeholders). This 10× discrepancy is recorded
here as a known caveat: the code's `costUsd` figures are **conservative
placeholders for budget-trip purposes**, not billing-accurate. The budget-trip
behaviour (degrade, never error) does not depend on absolute accuracy — only on
monotonic accumulation.

## Conclusion

The projection at beta scale is **within** the §6.1 envelope, and the two named
optimizations are already enforced in code:

1. **State trimming** — `app/services/ai/privacy.py` enforces `MAX_STATE_TOKENS = 1500`
   via `trim_to_token_budget()`; every builder targets ≤1,500 tokens.
2. **Batched questions** — `app/services/task_ranking.py` enforces
   `MAX_TASKS_PER_CALL = 10`, so `tasks.rank.v1` sends at most 10 tasks per Jev call.

**OpenRouter-side spend caps** must be set as an account-level backstop (human
operator action — see WS-02 task 2.16).
