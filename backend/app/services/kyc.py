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

# WS-02 task 2.26 — instructor credential KYC matrix. Identity = any ONE of the
# accepted identity documents, plus a mandatory liveness selfie. Specialization
# documents are gated by the specialization the instructor claims (drone
# training → RPTO-issued DGCA Remote Pilot Certificate; academic degree claims →
# degree certificate; scheme-literacy/FPO training → NABARD/NRLM/SRLM trainer
# empanelment, marked conditional). Every entry carries an SLA and an
# `expiresAt`-capable licence field so the licence-expiry job can re-verify it.
INSTRUCTOR_IDENTITY_DOCS = ("aadhaar_ekyc", "voter_id", "pan", "driving_licence")
INSTRUCTOR_MANDATORY_DOCS = ("liveness_selfie",)
INSTRUCTOR_SPECIALIZATION_DOCS: dict[str, dict] = {
    "drone_training": {
        "docType": "dgca_remote_pilot_certificate",
        "issuer": "RPTO",
        "conditional": False,
        "slaHours": 48,
        "licenceExpiryField": "licenceExpiry",
    },
    "degree_claimed": {
        "docType": "degree_certificate",
        "conditional": False,
        "slaHours": 48,
        "licenceExpiryField": "licenceExpiry",
    },
    "scheme_literacy_fpo": {
        "docType": "nabard_nrlm_srlm_empanelment",
        "conditional": True,
        "slaHours": 48,
        "licenceExpiryField": "licenceExpiry",
    },
}
# Credential docs that render as badges on course detail (WS-02 task 2.31).
INSTRUCTOR_CREDENTIAL_DOCS = tuple(
    entry["docType"] for entry in INSTRUCTOR_SPECIALIZATION_DOCS.values()
)
# docType -> the `expiresAt`-capable licence field the re-verification job reads.
CREDENTIAL_EXPIRY_FIELD = {
    entry["docType"]: entry["licenceExpiryField"]
    for entry in INSTRUCTOR_SPECIALIZATION_DOCS.values()
}
INSTRUCTOR_ALLOWED_DOCS = (
    *INSTRUCTOR_IDENTITY_DOCS,
    *INSTRUCTOR_MANDATORY_DOCS,
    *INSTRUCTOR_CREDENTIAL_DOCS,
    "instructor_credential",
)

# Case statuses. "verified" is the phase-00 approved value used by the
# publish/bookings gate and the credential badges; the re-verification job flips
# an approved case to NEEDS_REVERIFY when a credential licence lapses.
CASE_STATUS_APPROVED = "verified"
CASE_STATUS_NEEDS_REVERIFY = "needs_reverification"

PERSONA_DOC_MATRIX: dict[str, tuple[str, ...]] = {
    "farmer": (),
    "farmLandlord": ("land_712", "land_tax_receipt"),
    "transport": ("rc", "dl"),
    "seller": ("apmc_licence", "gst"),
    "broker": ("arhtiya_licence",),
    "equipmentRental": ("equipment_rc", "equipment_insurance", "operator_licence"),
    "dairyManager": ("fssai",),
    "directBuyer": ("fssai", "iec", "apeda", "gst"),
    "instructor": INSTRUCTOR_ALLOWED_DOCS,
    "bankManager": ("bank_authorisation",),
    "insuranceProvider": ("irdai_licence",),
    "coldStorageProvider": ("wdra_certificate",),
}

# Documents that must be re-verified periodically (instructor licences etc.).
REVERIFY_DOC_TYPES = (
    "instructor_credential",
    *INSTRUCTOR_CREDENTIAL_DOCS,
    "dl",
    "equipment_insurance",
    "fssai",
)
EXPIRY_REMINDER_DAYS = 30


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def doc_matrix_for(persona: str) -> list[str]:
    return list(BASE_DOCS) + list(PERSONA_DOC_MATRIX.get(persona, ()))


def instructor_required_specialization_docs(case: dict) -> list[str]:
    """Credential doc types the declared specializations require (task 2.27).

    A case "declares" specializations via its `specialization` field (a string or
    list). Each declared specialization makes its credential doc mandatory; the
    `conditional` flag marks docs that only apply once the specialization is
    claimed (e.g. scheme-literacy/FPO empanelment)."""
    specs = case.get("specialization") or []
    if isinstance(specs, str):
        specs = [specs]
    return [
        INSTRUCTOR_SPECIALIZATION_DOCS[spec]["docType"]
        for spec in specs
        if spec in INSTRUCTOR_SPECIALIZATION_DOCS
    ]


def verified_credential_types(case: dict | None) -> list[dict]:
    """Verified credential docs as `{type, verifiedAt}` for course-detail badges
    (task 2.31). Empty when the case is missing or has no verified credential."""
    if not case:
        return []
    out: list[dict] = []
    for doc in case.get("docs") or []:
        if doc.get("status") == "verified" and doc.get("type") in INSTRUCTOR_CREDENTIAL_DOCS:
            out.append({"type": doc.get("type"), "verifiedAt": doc.get("reviewedAt")})
    return out


async def latest_instructor_case(user_id: str) -> dict | None:
    """The instructor's most recent `kyc_cases` doc, or None when none exists."""
    cases = await query("kyc_cases", [("userId", "==", user_id)], limit=50)
    cases = [case for case in cases if case.get("persona") == "instructor"]
    if not cases:
        return None
    cases.sort(key=lambda case: case.get("submittedAt") or "", reverse=True)
    return cases[0]


async def instructor_publish_blocked_reason(user_id: str) -> str | None:
    """Task 2.27 gate: why an instructor cannot publish / take bookings.

    Returns None when the latest case is approved and every credential doc its
    declared specializations require is verified; otherwise a human-readable
    reason. Browse/read endpoints stay open — only publishing is gated."""
    case = await latest_instructor_case(user_id)
    if case is None:
        return "no KYC case submitted yet"
    if case.get("status") != CASE_STATUS_APPROVED:
        return "KYC case is not approved yet"
    verified = {
        doc.get("type") for doc in case.get("docs") or [] if doc.get("status") == "verified"
    }
    missing = [t for t in instructor_required_specialization_docs(case) if t not in verified]
    if missing:
        return f"missing verified specialization documents: {', '.join(missing)}"
    return None


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
                deepLink="/profile/kyc",
            )
            reminded += 1
            if doc.get("reverifyRequired"):
                doc["reverifyRequired"] = True
                await set_doc("kyc_cases", case["caseId"], case)
    return {"reminded": reminded}
