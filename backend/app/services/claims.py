import zlib
from datetime import datetime, timedelta, timezone

from app.core.db import get_doc, set_doc

CLAIM_TRANSITIONS = {
    "intimated": ["surveyorAssigned"],
    "surveyorAssigned": ["fieldAssessed"],
    "fieldAssessed": ["dbtApproved", "rejected"],
    "dbtApproved": ["disbursed"],
    "disbursed": [],
    "rejected": [],
}

STATUS_TEXT = {
    "intimated": "दावा दर्ज — सर्वेयर नियुक्ति लंबित",
    "surveyorAssigned": "सर्वेयर नियुक्त",
    "fieldAssessed": "क्षेत्र मूल्यांकन पूर्ण",
    "dbtApproved": "DBT स्वीकृत",
    "disbursed": "राशि वितरित",
    "rejected": "दावा अस्वीकृत",
}

STATE_CODES = {
    "Maharashtra": "MH",
    "Madhya Pradesh": "MP",
    "Gujarat": "GJ",
    "Uttar Pradesh": "UP",
    "Punjab": "PB",
    "Rajasthan": "RJ",
}

SURVEYORS = [
    ("संदीप कुलकर्णी", "+919811000001"),
    ("मीना जाधव", "+919811000002"),
    ("अजय भोसले", "+919811000003"),
]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def advance_status(claim: dict, new_status: str, note: str = "") -> dict:
    if new_status not in CLAIM_TRANSITIONS.get(claim["status"], []):
        raise ValueError(f"illegal transition {claim['status']} -> {new_status}")
    claim["status"] = new_status
    claim["statusText"] = STATUS_TEXT[new_status]
    claim.setdefault("timeline", []).append({"status": new_status, "at": _now_iso(), "note": note})
    return claim


def appeal(claim: dict, reason: str) -> dict:
    # rejected -> intimated is allowed only through here; CLAIM_TRANSITIONS keeps "rejected": []
    if claim["status"] != "rejected":
        raise ValueError("only rejected claims can be appealed")
    claim["status"] = "intimated"
    claim["statusText"] = STATUS_TEXT["intimated"]
    claim["appealCount"] = claim.get("appealCount", 0) + 1
    claim.setdefault("timeline", []).append(
        {"status": "intimated", "at": _now_iso(), "note": f"Appeal submitted: {reason[:100]}"}
    )
    return claim


async def next_claim_number(state: str) -> str:
    # read-modify-write via db helpers so the tests' in-memory store works;
    # not transactional — fine at current write volume, revisit if collisions appear
    year = datetime.now(timezone.utc).year
    doc_id = f"claims_{year}"
    counter = await get_doc("counters", doc_id) or {"id": doc_id, "value": 0}
    counter["value"] += 1
    await set_doc("counters", doc_id, counter)
    return f"CLM-{year}-{STATE_CODES.get(state, 'XX')}-{counter['value']:04d}"


def auto_assign_surveyor(district: str) -> dict:
    name, phone = SURVEYORS[zlib.crc32((district or "").encode()) % 3]
    visit = (datetime.now(timezone.utc) + timedelta(days=3)).date().isoformat()
    return {"surveyorName": name, "surveyorPhone": phone, "surveyorVisitDate": visit}
