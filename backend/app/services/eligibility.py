def is_eligible(user: dict, rules: dict) -> bool:
    # Unknown rule keys are ignored so new rules stay forward-compatible.
    if "maxLandAcres" in rules and user.get("landAreaAcres", 0) > rules["maxLandAcres"]:
        return False
    states = rules.get("states") or []
    if states and user.get("state") not in states:
        return False
    if rules.get("requiresKcc") and user.get("kccLimit", 0) <= 0:
        return False
    return True
