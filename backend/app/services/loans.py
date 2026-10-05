import logging
from datetime import datetime, timezone

from app.core.db import get_doc, set_doc
from app.models.loans import LoanApplicationOut, LoanScheduleEntry
from app.services.ai import config_store, decision_log, gateway, outcomes as ai_outcomes, question_sets
from app.services.ai.privacy import build_loan_prescreen_state
from app.services.notifications import send_fcm_to_user
from app.services.tasks import emit_task

log = logging.getLogger(__name__)

# --- WS-07 M14 — CreditDesk loan prescreen ---------------------------------
# The prescreen annotates the queue (risk band + missing docs) and NEVER
# mutates the application status; automation stays at `suggest`.
LOAN_PRESCREEN_MODULE = "loans_prescreen"
LOAN_PRESCREEN_QUESTION_SET = "loans.prescreen.v1"
LOAN_PRESCREEN_DEEP_LINK = "/dashboard/p/loanTracking"
LOAN_PRESCREEN_BAND_ORDER = {"high": 0, "medium": 1, "low": 2}

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

# WS-03 task 3.9 — partner-bank referral/origination fee per disbursal, in basis
# points of the disbursed principal (integer paisa; ledgered in settlements).
ORIGINATION_FEE_BPS = 50


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
        partnerBankId=loan.get("partnerBankId"),
        district=loan.get("district"),
        ai=loan.get("ai"),
    )


async def notify_farmer(user_id: str, title: str, body: str):
    try:
        await send_fcm_to_user(user_id, title, body, {"channel": "loans"})
    except Exception:
        pass


async def write_audit(
    actor_id: str,
    action: str,
    loan_id: str,
    detail: dict,
    reason: str | None = None,
):
    """WS-03 rule 8 — every banker decision writes an audit_logs row carrying the
    actor, the action and the reason/note from the request body."""
    await set_doc(
        "audit_logs",
        f"aud_loan_{loan_id}_{action.lower()}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        {
            "action": action,
            "adminId": actor_id,
            "loanId": loan_id,
            "reason": reason,
            "detail": detail,
            "timestamp": _now_iso(),
        },
    )


async def record_origination_fee(loan: dict, *, actor_id: str) -> dict | None:
    """WS-03 task 3.9 — ledger the partner-bank referral/origination fee for a
    disbursal. Follows the settlements-ledger entry pattern (settlements
    collection, integer paisa) and writes an audit_logs row. Returns None when
    the disbursed principal is not positive. Kept here so the loans flow is
    self-contained; relocate into services/settlements.py to centralise (see
    the WS-03 SHARED WIRING note)."""
    principal = int(loan.get("disbursedAmount") or loan.get("sanctionedAmount") or 0)
    if principal <= 0:
        return None
    app_id = loan.get("applicationId") or loan.get("id") or ""
    partner = loan.get("partnerBankId")
    principal_paisa = principal * 100
    fee_paisa = int(round(principal_paisa * ORIGINATION_FEE_BPS / 10000))
    now = _now_iso()
    ledger_id = f"orig_{app_id}"
    await set_doc(
        "settlements",
        ledger_id,
        {
            "id": ledger_id,
            "kind": "origination_fee",
            "role": "bankManager",
            "entityId": partner or loan.get("userId"),
            "partnerBankId": partner,
            "applicationId": app_id,
            "applicationNumber": loan.get("applicationNumber"),
            "principalPaisa": principal_paisa,
            "commissionPaisa": fee_paisa,
            "netPaisa": fee_paisa,
            "status": "pending",
            "createdAt": now,
        },
    )
    await set_doc(
        "audit_logs",
        f"aud_loan_fee_{app_id}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        {
            "action": "LOAN_ORIGINATION_FEE",
            "adminId": actor_id,
            "loanId": app_id,
            "partnerBankId": partner,
            "feePaisa": fee_paisa,
            "timestamp": now,
        },
    )
    return {"ledgerId": ledger_id, "feePaisa": fee_paisa}


async def schedule_emi_reminders(loan: dict) -> int:
    """WS-03 task 3.12 — persist one EMI reminder per installment at disbursal,
    in the notify-service payload shape (title/body en+hi, deep link). Delivery
    is a job concern (no new reminder infra); this only schedules them."""
    uid = loan.get("userId")
    principal = int(loan.get("sanctionedAmount") or loan.get("amount") or 0)
    if not uid or principal <= 0:
        return 0
    entries = compute_schedule(
        principal,
        loan.get("interestRate") or DEFAULT_INTEREST_RATE,
        int(loan.get("tenureMonths") or 1),
        start_date_iso=loan.get("disbursedAt") or loan.get("updatedAt"),
    )
    app_id = loan.get("applicationId") or loan.get("id") or ""
    now = _now_iso()
    count = 0
    for entry in entries:
        await set_doc(
            f"users/{uid}/loan_emi_reminders",
            f"{app_id}_emi_{entry.installmentNo}",
            {
                "applicationId": app_id,
                "installmentNo": entry.installmentNo,
                "dueDate": entry.dueDate,
                "amountPaisa": entry.emi * 100,
                "title": {"en": "EMI due soon", "hi": "किस्त जल्द देय है"},
                "body": {
                    "en": f"Installment {entry.installmentNo}: ₹{entry.emi} due on {entry.dueDate}",
                    "hi": f"किस्त {entry.installmentNo}: ₹{entry.emi} {entry.dueDate} को देय है",
                },
                "channel": "loans",
                "deepLink": "/dashboard/p/loanTracking",
                "status": "scheduled",
                "createdAt": now,
            },
        )
        count += 1
    return count


async def _emit_missing_docs_task(application: dict, missing: list[str]) -> str | None:
    """Nudge the farmer about the AI-flagged missing documents.

    Emitted with a stable `source_id` so re-scoring the same application
    dedupes (the task engine upserts on `dedupeKey`). Never blocks the queue.
    """
    uid = application.get("userId")
    app_id = application.get("applicationId") or application.get("id")
    if not uid or not app_id:
        return None
    try:
        return await emit_task(
            uid,
            persona="farmer",
            module="loans",
            kind="loan_prescreen_missing_docs",
            title_en="Some documents are still needed for your loan",
            title_hi="आपके ऋण के लिए कुछ दस्तावेज़ अभी बाकी हैं",
            subtitle=", ".join(missing),
            priority="today",
            deep_link=LOAN_PRESCREEN_DEEP_LINK,
            source_id=app_id,
            action_endpoint=f"/v1/loans/{app_id}/documents",
        )
    except Exception as exc:  # noqa: BLE001 — a nudge must never break a read
        log.warning("loan prescreen task emission failed (%s)", exc)
        return None


async def prescreen_application(
    application: dict, *, emit_missing_docs_task: bool = False
) -> dict | None:
    """M14 — annotate one loan application with an AI prescreen result.

    Returns the `ai: {riskBand, missingDocs}` annotation written onto the
    application, or None when the `loans_prescreen` module flag is off (so the
    queue is exactly as before with no `ai` field). The automation is `suggest`:
    this sorts/annotates only — it never mutates the application status. Provider
    failures degrade to the deterministic fallback and are logged with
    `fallbackUsed`.
    """
    if not await config_store.module_enabled(LOAN_PRESCREEN_MODULE):
        return None

    state = build_loan_prescreen_state(application)
    try:
        decision = await gateway.decide(
            state,
            LOAN_PRESCREEN_QUESTION_SET,
            ctx=application.get("userId"),
            module=LOAN_PRESCREEN_MODULE,
        )
        answers = dict(decision.answers or {})
        confidence = float(decision.confidence or 0.0)
        decision_id = decision.decision_id
    except Exception as exc:  # noqa: BLE001 — degrade, never error
        log.warning("loan prescreen failed (%s) — degrading to fallback", exc)
        answers = question_sets.fallback_answers(LOAN_PRESCREEN_QUESTION_SET, state)
        confidence = 0.0
        decision_id = await decision_log.log_decision(
            module=LOAN_PRESCREEN_MODULE,
            question_set_id=LOAN_PRESCREEN_QUESTION_SET,
            version="v1",
            state=state,
            answers=answers,
            confidence=0.0,
            latency_ms=0,
            cost_usd=0.0,
            model="none",
            source="fallback",
            fallback_used=True,
        )

    band = str(answers.get("riskBand") or "medium").lower()
    if band not in LOAN_PRESCREEN_BAND_ORDER:
        band = "medium"
    missing = [str(doc) for doc in (answers.get("missingDocs") or [])]
    annotation = {
        "riskBand": band,
        "missingDocs": missing,
        "confidence": round(confidence, 3),
        "decisionId": decision_id,
    }
    application["ai"] = annotation
    if emit_missing_docs_task and missing:
        await _emit_missing_docs_task(application, missing)
    return annotation


async def record_prescreen_outcome(loan: dict, outcome: str) -> None:
    """M14 outcome hook (task 7.6) — call from the approve/reject handlers.

    Links the prescreen annotation to what the banker actually decided. Never
    lets an outcome-write failure break a banker decision.
    """
    app_id = loan.get("applicationId") or loan.get("id")
    if not app_id:
        return
    try:
        await ai_outcomes.record_prescreen_outcome(
            app_id, outcome, decision_id=(loan.get("ai") or {}).get("decisionId")
        )
    except Exception as exc:  # noqa: BLE001 — bookkeeping must not block a decision
        log.warning("loan prescreen outcome hook failed (%s)", exc)
