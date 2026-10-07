"""Govt-scheme eligibility rules engine.

The RULES here are the single source of truth for who is eligible for a scheme
(phase-05 WS-05, brief M21). The AI match path (`services/schemes_match.py`)
only ranks and explains — it never decides eligibility, so `match_schemes()`
always returns the verdict computed by these functions.

`evaluate()` returns a criterion-level checklist (key + met + params); the
website renders each entry met/unmet and localizes the key, so no eligibility
logic ever lives on the client (task 5.10).
"""


def evaluate(user: dict, rules: dict) -> list[dict]:
    """Criterion-by-criterion verdict for a scheme's `eligibilityRules`.

    Unknown rule keys are ignored so new rules stay forward-compatible. Every
    criterion carries a stable `key` (the UI maps it to an en/hi string) and any
    `params` the copy needs; `met` is the boolean the rules engine decided.
    """
    user = user or {}
    rules = rules or {}
    criteria: list[dict] = []

    if "maxLandAcres" in rules:
        max_acres = rules["maxLandAcres"]
        actual = user.get("landAreaAcres", 0)
        criteria.append(
            {
                "key": "maxLandAcres",
                "met": not (actual > max_acres),
                "params": {"max": max_acres, "actual": actual},
            }
        )

    states = rules.get("states") or []
    if states:
        criteria.append(
            {
                "key": "states",
                "met": user.get("state") in states,
                "params": {"states": list(states)},
            }
        )

    if rules.get("requiresKcc"):
        criteria.append(
            {
                "key": "requiresKcc",
                "met": user.get("kccLimit", 0) > 0,
                "params": {},
            }
        )

    return criteria


def is_eligible(user: dict, rules: dict) -> bool:
    # Unknown rule keys are ignored so new rules stay forward-compatible.
    return all(criterion["met"] for criterion in evaluate(user, rules))


# Map every document label a scheme may require to the vault doc-type tokens
# that satisfy it. The vault stores machine tokens (`aadhaar`, `712`,
# `bankPassbook`, `soilHealthCard`, `other`); schemes carry human labels.
_DOC_TYPE_TOKENS: dict[str, tuple[str, ...]] = {
    "aadhaar": ("aadhaar", "आधार", "uidai"),
    "712": ("712", "7/12", "7-12", "land", "खसरा", "भूमि", "landrecord", "land_record"),
    "bankpassbook": ("passbook", "bank", "पासबुक", "बैंक"),
    "soilhealthcard": ("soil", "मिट्टी", "soilhealthcard"),
}


def _matches(required: str, vault_type: str) -> bool:
    required = (required or "").strip().lower()
    vault_type = (vault_type or "").strip().lower()
    if not required or not vault_type:
        return False
    if required in vault_type or vault_type in required:
        return True
    for tokens in _DOC_TYPE_TOKENS.values():
        if any(token in required for token in tokens) and any(
            token in vault_type for token in tokens
        ):
            return True
    return False


def missing_documents(required_docs: list[str], vault_types: list[str]) -> list[str]:
    """Required scheme documents the farmer has not yet uploaded to the vault.

    Deterministic: the returned list preserves the scheme's declared order so
    the same set always renders the same way.
    """
    vault = [str(token) for token in (vault_types or [])]
    return [
        doc
        for doc in (required_docs or [])
        if not any(_matches(doc, vault_type) for vault_type in vault)
    ]
