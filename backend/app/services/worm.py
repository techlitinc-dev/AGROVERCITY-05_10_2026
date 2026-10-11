"""WORM evidence retention (WS-03 step 3): order/inspection/dispute evidence in
append-only object storage.

Writes refuse to overwrite (FileExistsError); reads need a dual-control approval
doc (`worm_access_approvals/{approval_id}`, status approved, two distinct
approvers) and every read appends a `worm_access_log` entry. Retention: 3 years
active + 5 years archive (constants consumed by the retention job).

EVIDENCE_ROOT is resolved from the repo root so the path is stable regardless
of the process cwd (pytest runs with cwd=backend/).
"""
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from app.core.db import set_doc

_REPO_ROOT = Path(__file__).resolve().parents[3]
EVIDENCE_ROOT = _REPO_ROOT / "backend" / ".local_uploads" / "worm"

RETENTION_ACTIVE_YEARS = 3
RETENTION_ARCHIVE_YEARS = 5


def _utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")


async def put_evidence(kind: str, doc_id: str, payload: dict) -> str:
    """Write EVIDENCE_ROOT/<kind>/<doc_id>/<utc-timestamp>.json; refuse to
    overwrite an existing file. Returns the written path."""
    directory = EVIDENCE_ROOT / kind / doc_id
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f"{_utc_stamp()}.json"
    with path.open("x", encoding="utf-8") as handle:
        json.dump(payload, handle, sort_keys=True)
    return str(path)


async def read_evidence(path: str, approval_id: str, accessor_id: str) -> dict:
    """Read back an evidence file under dual control.

    Requires a `worm_access_approvals/{approval_id}` doc with status
    "approved" and two distinct approver ids; every read appends a
    `worm_access_log` doc. Raises PermissionError without a valid approval.
    """
    from app.core.db import get_doc

    approval = await get_doc("worm_access_approvals", approval_id)
    approvers = (approval or {}).get("approvers") or []
    if (approval or {}).get("status") != "approved" or len({*approvers}) < 2:
        raise PermissionError("worm access requires a dual-approved access request")

    evidence_path = Path(path)
    if EVIDENCE_ROOT not in evidence_path.resolve().parents:
        raise PermissionError("path is outside the WORM evidence root")
    with evidence_path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)

    await set_doc(
        "worm_access_log",
        f"wlog_{uuid.uuid4().hex[:12]}",
        {
            "path": path,
            "approvalId": approval_id,
            "accessorId": accessor_id,
            "at": datetime.now(timezone.utc).isoformat(),
        },
    )
    return payload
