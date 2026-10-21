"""Token/$ accounting with hard caps (specs §10)."""
from dataclasses import dataclass, field


@dataclass
class Budget:
    max_usd: float = 5.0
    max_llm_calls: int = 100_000
    usd_in_miss: float = 0.15
    usd_in_hit: float = 0.003
    usd_out: float = 0.60
    llm_calls: int = 0
    in_tokens: int = 0
    out_tokens: int = 0
    cached_tokens: int = 0
    _warned: float = field(default=0.0)

    @classmethod
    def from_settings(cls, s: dict) -> "Budget":
        return cls(max_usd=float(s.get("budget_usd", 5.0)),
                   usd_in_miss=float(s.get("price_in_miss", 0.15)),
                   usd_in_hit=float(s.get("price_in_hit", 0.003)),
                   usd_out=float(s.get("price_out", 0.60)))

    def charge(self, usage):
        self.llm_calls += 1
        self.in_tokens += usage.prompt_tokens
        self.out_tokens += usage.completion_tokens
        cached = getattr(usage, "prompt_cache_hit_tokens", None) or 0
        self.cached_tokens += cached

    @property
    def usd(self) -> float:
        fresh = self.in_tokens - self.cached_tokens
        return (fresh * self.usd_in_miss + self.cached_tokens * self.usd_in_hit
                + self.out_tokens * self.usd_out) / 1e6

    def exhausted(self) -> bool:
        return self.usd >= self.max_usd or self.llm_calls >= self.max_llm_calls

    def snapshot(self) -> dict:
        return {"usd": round(self.usd, 4), "calls": self.llm_calls,
                "in_tokens": self.in_tokens, "out_tokens": self.out_tokens,
                "cached_tokens": self.cached_tokens}
