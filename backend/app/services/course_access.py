"""Course access model for the Farmer–Instructor learning workflow.

Agrovercity connects learners and instructors; it never holds course payment.
A learner gets course access in exactly two ways:

- ``free``               — instant self-serve enrolment on a free course.
- ``manualOffPlatform``  — the instructor manually grants access after the
                           learner paid them directly, outside Agrovercity.

Access (can the learner open the content right now?) is tracked separately
from learning progress (notStarted / inProgress / completed).  The access +
progress record continues to live in the ``course_purchases`` collection so
every existing learning surface (classroom, progress, certificates, chat
guardrails, session check-in) keeps working — only the *meaning* of the
record changed from "purchase" to "course access".

Legacy compatibility: records written by the old checkout flow carry
``status == "paid"``.  They are still honoured as granted access (and remain
the input of the legacy settlements/cancellation code, which is retained for
those records only).  New records never use payment statuses such as
``paid`` / ``paymentPending`` / ``paymentVerified`` — they use
``accessType`` + ``accessStatus`` instead.
"""
from datetime import datetime, timezone

from app.core.db import get_doc, query
from app.services.kyc import (
    CASE_STATUS_APPROVED,
    INSTRUCTOR_CREDENTIAL_DOCS,
    TEACHER_LETTER_DOCS,
)

ACCESS_TYPE_FREE = "free"
ACCESS_TYPE_MANUAL = "manualOffPlatform"

ACCESS_STATUS_GRANTED = "granted"
ACCESS_STATUS_REVOKED = "revoked"

LEARNING_NOT_STARTED = "notStarted"
LEARNING_IN_PROGRESS = "inProgress"
LEARNING_COMPLETED = "completed"

REQUEST_STATUS_CONTACTED = "contacted"
REQUEST_STATUS_DISMISSED = "dismissed"

TERMS_VERSION = "2026-11-01"
TERMS_TEXT = (
    "Agrovercity only connects learners and instructors. Course price, payment, "
    "access, refunds, and disputes are handled directly between the learner and "
    "instructor. Payment is made outside Agrovercity and is not verified by "
    "Agrovercity. The instructor is responsible for granting course access after "
    "receiving payment. After confirmation, contact details will be shared between "
    "both parties."
)

# Doc types that count as reviewed expertise evidence for the
# "Expertise Verified" badge. Identity KYC, profile text, document upload
# alone, or course publication alone never produce this badge.
EXPERTISE_DOC_TYPES = tuple(set(INSTRUCTOR_CREDENTIAL_DOCS) | set(TEACHER_LETTER_DOCS))

VERIFIED_DOC_STATUS = "verified"


def is_granted(record: dict | None) -> bool:
    """Whether an access record currently unlocks course content.

    New model: ``accessStatus == "granted"``.  Legacy checkout records:
    ``status == "paid"`` (kept for backward compatibility only).
    """
    if not record:
        return False
    if record.get("accessStatus") == ACCESS_STATUS_GRANTED:
        return True
    return record.get("status") == "paid"


def is_revoked(record: dict | None) -> bool:
    if not record:
        return False
    return record.get("accessStatus") == ACCESS_STATUS_REVOKED


def learning_status(record: dict | None) -> str:
    if not record:
        return LEARNING_NOT_STARTED
    if record.get("isCompleted"):
        return LEARNING_COMPLETED
    if float(record.get("progressPercent") or 0) > 0 or record.get("completedLessonIds"):
        return LEARNING_IN_PROGRESS
    return LEARNING_NOT_STARTED


def access_summary(record: dict | None) -> dict:
    """The display-facing access block for learner/instructor surfaces.

    Never contains payment-verification language: manual access means
    "Access granted by instructor", not "Payment verified".
    """
    if not record:
        return {
            "accessType": None,
            "accessStatus": "none",
            "learningStatus": LEARNING_NOT_STARTED,
            "progressPercent": 0,
            "isCompleted": False,
        }
    return {
        "accessType": record.get("accessType") or ("legacy" if record.get("status") == "paid" else None),
        "accessStatus": record.get("accessStatus") or (ACCESS_STATUS_GRANTED if record.get("status") == "paid" else "none"),
        "learningStatus": learning_status(record),
        "progressPercent": record.get("progressPercent", 0),
        "isCompleted": bool(record.get("isCompleted")),
        "grantedAt": record.get("grantedAt") or record.get("paidAt"),
        "grantedBy": record.get("grantedBy"),
    }


def new_access_doc(
    *,
    user: dict,
    course: dict,
    access_type: str,
    request_id: str | None = None,
    price_at_contact: float | None = None,
    currency: str = "INR",
) -> dict:
    """A fresh access + progress record for a newly entitled learner."""
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": f"{user['id']}_{course['id']}",
        "userId": user["id"],
        "studentName": user.get("name") or "Student",
        "studentPhone": user.get("phone") or "",
        "courseId": course["id"],
        "courseTitle": course.get("title") or "",
        "instructorId": course["instructorId"],
        "accessType": access_type,
        "accessStatus": ACCESS_STATUS_GRANTED,
        "learningStatus": LEARNING_NOT_STARTED,
        "progressPercent": 0,
        "completedLessonIds": [],
        "isCompleted": False,
        "certificateId": None,
        "grantedBy": course["instructorId"] if access_type == ACCESS_TYPE_MANUAL else None,
        "grantedAt": now,
        "createdAt": now,
        "updatedAt": now,
    }
    if access_type == ACCESS_TYPE_FREE:
        doc["grantedBy"] = None
        doc["enrolledAt"] = now
    if request_id:
        doc["requestId"] = request_id
    if price_at_contact is not None:
        doc["priceAtContactRupees"] = price_at_contact
        doc["currency"] = currency
    return doc


def expertise_verified(case: dict | None) -> bool:
    """True only when qualification/experience documents were actually reviewed.

    Never inferred from identity KYC, profile text, upload alone, or from the
    course being published.
    """
    if not case:
        return False
    for doc in case.get("docs") or []:
        if doc.get("type") in EXPERTISE_DOC_TYPES and doc.get("status") == VERIFIED_DOC_STATUS:
            return True
    return False


async def badge_map(uids: list[str]) -> dict[str, dict]:
    """Batched {identity, expertise} verification lookup — one kyc_cases scan
    plus one users read per uid, no N+1 on the cases collection."""
    users = {}
    for uid in dict.fromkeys(uids):
        user = await get_doc("users", uid)
        if user:
            users[uid] = user
    cases = await query("kyc_cases", [], limit=4000)
    out: dict[str, dict] = {}
    for uid in dict.fromkeys(uids):
        user = users.get(uid) or {}
        identity = bool(
            user.get("kycStatus") == "verified" or user.get("vyapariVerified")
        ) or any(
            c.get("userId") == uid and c.get("status") == CASE_STATUS_APPROVED
            for c in cases
        )
        expertise = any(
            c.get("userId") == uid and expertise_verified(c) for c in cases
        )
        out[uid] = {"identity": identity, "expertise": expertise}
    return out


def strip_internal_fields(course: dict) -> dict:
    """Remove instructor-internal / payment-ledger fields from a public course
    payload (learner-facing catalog and detail)."""
    doc = dict(course)
    for field in (
        "instructorEarningsRupees",
        "commissionRupees",
        "razorpayOrderId",
        "rejectedReason",
    ):
        doc.pop(field, None)
    return doc
