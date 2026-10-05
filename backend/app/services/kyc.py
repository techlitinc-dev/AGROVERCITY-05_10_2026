"""KYC pipeline (WS-04): one real `kyc_cases` collection replacing the
hardcoded admin samples. Per-persona document matrices, `pending → verified →
rejected` doc state machine with mandatory reject reasons, expiry tracking.
"""
from datetime import datetime, timedelta, timezone

from app.core.db import get_doc, query, set_doc

DOC_STATUSES = ("pending", "verified", "rejected")

# Base documents for every business persona: Aadhaar (masked only), PAN, and a
# penny-drop-verified bank account. Persona extras come from features/*.md.
BASE_DOCS = ("aadhaar", "pan", "bank")
PERSONA_DOC_MATRIX: dict[str, tuple[str, ...]] = {
    "farmer": (),
    "farmLandlord": ("land_712", "land_tax_receipt"),
    "transport": ("rc", "dl"),
    "seller": ("apmc_licence", "gst"),
    "broker": ("arhtiya_licence",),
    "equipmentRental": ("equipment_rc", "equipment_insurance", "operator_licence"),
    "dairyManager": ("fssai",),
    "directBuyer": ("fssai", "iec", "apeda", "gst"),
    "instructor": ("instructor_credential",),
    "bankManager": ("bank_authorisation",),
    "insuranceProvider": ("irdai_licence",),
    "coldStorageProvider": ("wdra_certificate",),
}

# Documents that must be re-verified periodically (instructor licences etc.).
REVERIFY_DOC_TYPES = ("instructor_credential", "dl", "equipment_insurance", "fssai")
EXPIRY_REMINDER_DAYS = 30


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def doc_matrix_for(persona: str) -> list[str]:
    return list(BASE_DOCS) + list(PERSONA_DOC_MATRIX.get(persona, ()))


def case_id_for(user_id: str, persona: str) -> str:
    return f"kyc_{user_id[:8]}_{persona}"


def _recompute_case_status(case: dict) -> str:
    statuses = [doc.get("status") for doc in case.get("docs") or []]
    if statuses and all(status == "verified" for status in statuses):
        return "verified"
    if any(status == "rejected" for status in statuses):
        return "rejected"
    return "pending"


async def submit_case(user_id: str, persona: str, docs: list[dict]) -> dict:
    """Create or replace the user's case for a persona. Document types are
    validated against the persona's matrix; no unmasked Aadhaar is persisted."""
    allowed = set(doc_matrix_for(persona))
    case_id = case_id_for(user_id, persona)
    prepared = []
    for doc in docs:
        doc_type = doc.get("type")
        if doc_type not in allowed:
            raise ValueError(f"document type not allowed for persona {persona}: {doc_type}")
        prepared.append(
            {
                "docId": f"{case_id}:{doc_type}",
                "type": doc_type,
                "storagePath": doc.get("storagePath"),
                "status": "pending",
                "reason": None,
                "expiresAt": doc.get("expiresAt"),
                "extractedRef": doc.get("extractedRef"),
                "reverifyRequired": doc_type in REVERIFY_DOC_TYPES,
                "updatedAt": _now(),
            }
        )
    case = {
        "caseId": case_id,
        "userId": user_id,
        "persona": persona,
        "docs": prepared,
        "status": _recompute_case_status({"docs": prepared}),
        "submittedAt": _now(),
        "reviewedBy": None,
        "reviewedAt": None,
    }
    await set_doc("kyc_cases", case_id, case)
    return case


async def get_case(case_id: str) -> dict | None:
    return await get_doc("kyc_cases", case_id)


async def cases_for_user(user_id: str) -> list[dict]:
    return await query("kyc_cases", [("userId", "==", user_id)], limit=50)


async def find_doc(case_id: str, doc_id: str) -> tuple[dict, dict]:
    case = await get_doc("kyc_cases", case_id)
    if case is None:
        raise ValueError("case not found")
    for doc in case.get("docs") or []:
        if doc.get("docId") == doc_id or doc.get("type") == doc_id:
            return case, doc
    raise ValueError("document not found in case")


async def review_doc(case_id: str, doc_id: str, status: str, reason: str | None, reviewer: str) -> dict:
    if status not in ("verified", "rejected"):
        raise ValueError("status must be verified or rejected")
    if status == "rejected" and not (reason or "").strip():
        raise ValueError("a rejection reason is required")
    case, doc = await find_doc(case_id, doc_id)
    doc["status"] = status
    doc["reason"] = reason if status == "rejected" else None
    doc["reviewedBy"] = reviewer
    doc["reviewedAt"] = _now()
    doc["updatedAt"] = _now()
    case["status"] = _recompute_case_status(case)
    case["reviewedBy"] = reviewer
    case["reviewedAt"] = _now()
    await set_doc("kyc_cases", case["caseId"], case)
    return case


async def reupload_doc(case_id: str, doc_id: str, storage_path: str) -> dict:
    case, doc = await find_doc(case_id, doc_id)
    doc["storagePath"] = storage_path
    doc["status"] = "pending"
    doc["reason"] = None
    doc["updatedAt"] = _now()
    case["status"] = _recompute_case_status(case)
    await set_doc("kyc_cases", case["caseId"], case)
    return case


async def pending_doc_count() -> int:
    cases = await query("kyc_cases", [], limit=2000)
    return sum(
        1 for case in cases for doc in (case.get("docs") or []) if doc.get("status") == "pending"
    )


async def expiry_reminders() -> dict:
    """Scheduled reminder: notify holders 30 days before a document expires and
    flag recurring re-verification (instructor licences etc.)."""
    from app.services.notify import notify_user

    cases = await query("kyc_cases", [], limit=2000)
    now = datetime.now(timezone.utc)
    threshold = now + timedelta(days=EXPIRY_REMINDER_DAYS)
    reminded = 0
    for case in cases:
        for doc in case.get("docs") or []:
            expires_at = doc.get("expiresAt")
            if not expires_at:
                continue
            try:
                expiry = datetime.fromisoformat(expires_at)
            except ValueError:
                continue
            if not (now <= expiry <= threshold):
                continue
            if doc.get("status") != "verified":
                continue
            await notify_user(
                case["userId"],
                type="kyc_expiring",
                title="KYC document expiring / दस्तावेज़ समाप्त हो रहा है",
                body=f"{doc.get('type')} expires on {expiry.date().isoformat()}",
                path="/profile/kyc",
            )
            reminded += 1
            if doc.get("reverifyRequired"):
                doc["reverifyRequired"] = True
                await set_doc("kyc_cases", case["caseId"], case)
    return {"reminded": reminded}
