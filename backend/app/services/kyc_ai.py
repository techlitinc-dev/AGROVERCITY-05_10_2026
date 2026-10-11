"""KYC document AI (M11) — vault upload pipeline.

Vision field extraction (`kyc.extract`) and authenticity-risk scoring
(`kyc.authenticity_risk.v1`) run here, never in the router (rule 10). The
service mutates the pending vault doc in place: risk < 0.3 auto-advances to
`verified-pending-bank`, anything else stays pending for the human queue with
reasons attached. It never auto-rejects.
"""
from app.services.ai import gateway, kyc_schemas, privacy
from app.services.users import get_user

KYC_EXTRACT_MODULE = "kyc_extract"
KYC_RISK_MODULE = "kyc_risk"
KYC_RISK_AUTO_ADVANCE = 0.3


def _names_match(a: object, b: object) -> bool:
    """Profile-consistency check; unknown on either side counts as a match."""
    left = str(a or "").strip().casefold()
    right = str(b or "").strip().casefold()
    if not left or not right:
        return True
    return left == right


async def run_kyc_ai(uid: str, data: bytes, doc: dict) -> None:
    """Extract fields (vision) then score authenticity risk on `doc`."""
    doc_type = doc["docType"]
    defaults = kyc_schemas.schema_defaults(doc_type)
    if not defaults:
        return
    raw = await gateway.analyze_image(
        data,
        prompt=f"AGROVERCITY KYC document extraction for {doc_type}. Return the extracted fields as JSON.",
        schema=defaults,
        module=KYC_EXTRACT_MODULE,
    )
    parsed = kyc_schemas.parse_extract(doc_type, raw or {})
    if parsed is None:
        # invalid/unreadable extraction → human queue, no fabricated fields
        doc["riskScore"] = 1.0
        doc["riskReasons"] = ["extraction failed — manual review required"]
        return

    doc["extracted"] = parsed  # masked Aadhaar only (schema-enforced)
    user = await get_user(uid) or {}
    name_field = kyc_schemas.NAME_FIELD.get(doc_type)
    name_match = _names_match(user.get("name"), parsed.get(name_field or ""))
    dob_match = _names_match(
        user.get("dob") or user.get("dateOfBirth"), parsed.get("dob")
    )
    risk_state = privacy.build_kyc_risk_state(
        doc_type,
        name_match=name_match,
        dob_match=dob_match,
        image_quality_ok=True,
        extracted_field_count=len(parsed),
    )
    decision = await gateway.decide(
        risk_state, "kyc.authenticity_risk.v1", module=KYC_RISK_MODULE
    )
    answers = decision.answers or {}
    risk_score = answers.get("riskScore", 1.0)
    doc["riskScore"] = risk_score
    doc["riskReasons"] = answers.get("riskReasons") or []
    try:
        if float(risk_score) < KYC_RISK_AUTO_ADVANCE:
            doc["status"] = "verified-pending-bank"
    except (TypeError, ValueError):
        pass
