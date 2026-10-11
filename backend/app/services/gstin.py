"""GSTIN verification (WS-03 step 7, task 3.37).

Format validation is local and synchronous-in-spirit; the async hook is where
the real GSTN API verification wires in, following the phase-00 provider-switch
convention (env-driven provider, deterministic shim for tests/dev).
"""
import re

GSTIN_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")


async def verify_gstin(gstin: str) -> bool:
    """True for a well-formed GSTIN. Provider hook: the live GSTN API check
    plugs in here behind the phase-00 provider-switch convention once the
    verification provider is onboarded; until then format validation stands."""
    return bool(gstin) and GSTIN_RE.match(gstin) is not None
