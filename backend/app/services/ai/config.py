"""AI config validator (phase-07 WS-08, ai_implementation_plan §7 + global rule 12).

Automation levels may never exceed `require_confirm` for credit / insurance /
legal question sets, and no question set may be set to `auto` while the phase-G
allowlist is empty. Violations raise `ValueError("AI_AUTOMATION_LEVEL_FORBIDDEN")`.
"""
VALID_LEVELS = ("suggest", "require_confirm", "auto")
SENSITIVE_MARKERS = ("credit", "loan", "insurance", "legal")
# Question sets explicitly cleared for automation above `suggest` (phase-G gate).
ALLOWLIST: frozenset[str] = frozenset()

FORBIDDEN = "AI_AUTOMATION_LEVEL_FORBIDDEN"


def validate_ai_config(config: dict) -> None:
    automation = (config or {}).get("automation") or {}
    for question_set_id, level in automation.items():
        if level not in VALID_LEVELS:
            raise ValueError(FORBIDDEN)
        if level == "auto":
            # With an empty phase-G allowlist no question set may run on `auto`;
            # credit/insurance/legal are capped at `require_confirm` regardless.
            raise ValueError(FORBIDDEN)
