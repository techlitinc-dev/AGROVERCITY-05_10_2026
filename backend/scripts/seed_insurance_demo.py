"""Seed a demo insurance policy + two claims at different tracker stages for a user.

Usage: .venv/bin/python scripts/seed_insurance_demo.py <uid>
Idempotent: existing docs are skipped.
"""
import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.db import get_doc, set_doc

NOW = datetime.now(timezone.utc).isoformat()

POLICY = {
    "id": "demo-policy-1",
    "policyNumber": "PMFBY-2026-0001",
    "schemeName": "PMFBY",
    "cropName": "Wheat",
    "season": "Kharif",
    "year": 2026,
    "landAreaAcres": 2.0,
    "sumInsured": 80000,
    "farmerPremium": 1600,
    "govtSubsidy": 8400,
    "status": "active",
    "insuranceCompany": "AIC of India",
    "coverageStartDate": "2026-07-01",
    "coverageEndDate": "2026-12-31",
    "bankName": "SBI",
    "kccAccountNo": "XXXX4521",
    "certificateUrl": None,
}

BASE_CLAIM = {
    "policyId": "demo-policy-1",
    "cropName": "Wheat",
    "calamityType": "hailstorm",
    "dateOfDamage": "2026-09-10",
    "cropStage": "flowering",
    "estimatedLossPercent": 40,
    "requestedAmount": 32000.0,
    "gpsCoordinates": "20.0,73.8",
    "village": "Ozarkhed",
    "damagePhotos": [],
    "submittedAt": NOW,
    "bankAccountLast4": "5678",
    "appealCount": 0,
    "rejectionReason": None,
}

CLAIM_1 = {
    **BASE_CLAIM,
    "id": "demo-claim-1",
    "claimNumber": "CLM-2026-MH-9001",
    "approvedAmount": None,
    "status": "surveyorAssigned",
    "statusText": "सर्वेयर नियुक्त",
    "surveyorName": "संदीप कुलकर्णी",
    "surveyorPhone": "+919811000001",
    "surveyorVisitDate": "2026-09-20",
    "dbtTransactionId": None,
    "timeline": [
        {"status": "intimated", "at": NOW, "note": "Claim intimated within 72h window"},
        {"status": "surveyorAssigned", "at": NOW, "note": "Surveyor assigned"},
    ],
}

CLAIM_2 = {
    **BASE_CLAIM,
    "id": "demo-claim-2",
    "claimNumber": "CLM-2026-MH-9002",
    "approvedAmount": 22400,
    "status": "disbursed",
    "statusText": "राशि वितरित",
    "surveyorName": "मीना जाधव",
    "surveyorPhone": "+919811000002",
    "surveyorVisitDate": "2026-09-05",
    "dbtTransactionId": "DBT20260901234",
    "timeline": [
        {"status": "intimated", "at": "2026-08-28T06:00:00+00:00", "note": "Claim intimated within 72h window"},
        {"status": "surveyorAssigned", "at": "2026-08-29T06:00:00+00:00", "note": "Surveyor assigned"},
        {"status": "fieldAssessed", "at": "2026-08-30T06:00:00+00:00", "note": "Field assessment complete"},
        {"status": "dbtApproved", "at": "2026-08-31T06:00:00+00:00", "note": "DBT approved"},
        {"status": "disbursed", "at": "2026-09-01T06:00:00+00:00", "note": "Amount disbursed"},
    ],
}


async def _put_if_absent(collection: str, doc: dict) -> str:
    if await get_doc(collection, doc["id"]) is not None:
        return f"skip {doc['id']} (exists)"
    await set_doc(collection, doc["id"], doc)
    return f"created {doc['id']}"


async def main(uid: str):
    pol = dict(POLICY)
    pol["userId"] = uid
    c1 = dict(CLAIM_1)
    c1["userId"] = uid
    c2 = dict(CLAIM_2)
    c2["userId"] = uid
    print(await _put_if_absent(f"users/{uid}/insurance_policies", pol))
    print(await _put_if_absent("insurance_policies", pol))
    print(await _put_if_absent(f"users/{uid}/insurance_claims", c1))
    print(await _put_if_absent("insurance_claims", c1))
    print(await _put_if_absent(f"users/{uid}/insurance_claims", c2))
    print(await _put_if_absent("insurance_claims", c2))
    print(f"seeded demo insurance for {uid}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: seed_insurance_demo.py <uid>")
    asyncio.run(main(sys.argv[1]))
