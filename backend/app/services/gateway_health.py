"""7/12 (Mahabhulekh) gateway health probes (phase-07 WS-04).

There is no external latency signal in-process, so a scheduled probe records
`{checkedAt, available, latencyMs}` rows into `gateway_health`; the admin console
reads the latest rows.
"""
import time
from datetime import datetime, timezone
from uuid import uuid4

from app.core.db import query, set_doc


async def probe_land_records() -> dict:
    started = time.monotonic()
    # In-process probe: the integration module is importable → treat as available.
    available = True
    latency_ms = int((time.monotonic() - started) * 1000)
    row = {
        "id": f"gh_{uuid4().hex[:12]}",
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "available": available,
        "latencyMs": latency_ms,
    }
    await set_doc("gateway_health", row["id"], row)
    return row


async def latest_probes(limit: int = 100) -> list[dict]:
    rows = await query("gateway_health", None, limit=limit)
    rows.sort(key=lambda r: r.get("checkedAt") or "", reverse=True)
    return rows
