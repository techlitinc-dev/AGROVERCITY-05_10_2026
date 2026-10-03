from datetime import datetime, timezone

from app.core.db import get_doc, set_doc
from app.models.loans import LoanApplicationOut, LoanScheduleEntry
from app.services.notifications import send_fcm_to_user

LOAN_TRANSITIONS = {
    "submitted": ["underReview", "cancelled"],
    "underReview": ["approved", "rejected", "infoRequested", "cancelled"],
    "infoRequested": ["underReview"],
    "approved": ["disbursed", "rejected"],
    "rejected": [],
    "disbursed": [],
    "cancelled": [],
}

LOAN_STATUS_TEXT = {
    "submitted": "ऋण आवेदन जमा हुआ",
    "underReview": "बैंक समीक्षा में",
    "infoRequested": "अतिरिक्त जानकारी मांगी गई",
    "approved": "ऋण स्वीकृत",
    "rejected": "ऋण अस्वीकृत",
    "disbursed": "राशि वितरित",
    "cancelled": "आवेदन रद्द",
}

DEFAULT_INTEREST_RATE = 12.0


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def tier_for_score(score: int) -> str:
    if score >= 750:
        return "Platinum"
    if score >= 650:
        return "Gold"
    if score >= 550:
        return "Silver"
    return "Bronze"


def advance_status(
    loan: dict,
    to: str,
    *,
    by: str | None = None,
    note: str | None = None,
    status_text: str,
) -> dict:
    if to not in LOAN_TRANSITIONS.get(loan.get("status"), []):
        raise ValueError(f"illegal transition {loan.get('status')} -> {to}")
    now = _now_iso()
    loan["status"] = to
    loan["statusText"] = status_text
    if note is not None:
        loan["note"] = note
    loan["updatedAt"] = now
    loan.setdefault("timeline", []).append(
        {"status": to, "statusText": status_text, "note": note, "at": now, "by": by}
    )
    return loan


async def next_application_number() -> str:
    # read-modify-write via db helpers so the tests' in-memory store works;
    # not transactional — fine at current write volume, revisit if collisions appear
    year = datetime.now(timezone.utc).year
    doc_id = f"loans_{year}"
    counter = await get_doc("counters", doc_id) or {"id": doc_id, "value": 0}
    counter["value"] += 1
    await set_doc("counters", doc_id, counter)
    return f"LN-{year}-{counter['value']:04d}"


def compute_schedule(
    amount: float,
    interest_rate: float,
    tenure_months: int,
    start_date_iso: str | None = None,
) -> list[LoanScheduleEntry]:
    principal_total = round(amount)
    r = interest_rate / 1200
    n = tenure_months
    if r > 0:
        growth = (1 + r) ** n
        emi = round(principal_total * r * growth / (growth - 1))
    else:
        emi = round(principal_total / n)
    if start_date_iso:
        start = datetime.fromisoformat(start_date_iso.replace("Z", "+00:00"))
    else:
        start = datetime.now(timezone.utc)
    entries = []
    outstanding = principal_total
    for i in range(1, n + 1):
        interest = round(outstanding * r)
        if i < n:
            principal_component = emi - interest
            installment_emi = emi
        else:
            # absorb the rounding drift so the final outstanding hits exactly 0
            principal_component = outstanding
            installment_emi = principal_component + interest
        outstanding -= principal_component
        month_index = start.month - 1 + i
        year = start.year + month_index // 12
        month = month_index % 12 + 1
        entries.append(
            LoanScheduleEntry(
                installmentNo=i,
                dueDate=f"{year:04d}-{month:02d}-01",
                emi=installment_emi,
                principal=principal_component,
                interest=interest,
                outstanding=outstanding,
            )
        )
    return entries


def to_out(loan: dict) -> LoanApplicationOut:
    return LoanApplicationOut(
        applicationId=loan.get("applicationId") or loan.get("id", ""),
        amount=loan.get("amount", 0),
        tenureMonths=loan.get("tenureMonths", 0),
        purpose=loan.get("purpose", ""),
        status=loan.get("status", "submitted"),
        createdAt=loan.get("createdAt", ""),
        applicationNumber=loan.get("applicationNumber"),
        userId=loan.get("userId"),
        farmerName=loan.get("farmerName"),
        farmerPhone=loan.get("farmerPhone"),
        farmerCreditScore=loan.get("farmerCreditScore"),
        farmerCreditTier=loan.get("farmerCreditTier"),
        bankAccountId=loan.get("bankAccountId"),
        bankAccountLast4=loan.get("bankAccountLast4"),
        bankIfsc=loan.get("bankIfsc"),
        sanctionedAmount=loan.get("sanctionedAmount"),
        interestRate=loan.get("interestRate"),
        disbursementRef=loan.get("disbursementRef"),
        disbursedAt=loan.get("disbursedAt"),
        rejectionReason=loan.get("rejectionReason"),
        assignedOfficerId=loan.get("assignedOfficerId"),
        assignedOfficerName=loan.get("assignedOfficerName"),
        documents=loan.get("documents") or [],
        timeline=loan.get("timeline") or [],
        note=loan.get("note"),
        updatedAt=loan.get("updatedAt"),
    )


async def notify_farmer(user_id: str, title: str, body: str):
    try:
        await send_fcm_to_user(user_id, title, body, {"channel": "loans"})
    except Exception:
        pass


async def write_audit(actor_id: str, action: str, loan_id: str, detail: dict):
    await set_doc(
        "audit_logs",
        f"aud_loan_{loan_id}_{action.lower()}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        {
            "action": action,
            "adminId": actor_id,
            "loanId": loan_id,
            "detail": detail,
            "timestamp": _now_iso(),
        },
    )
