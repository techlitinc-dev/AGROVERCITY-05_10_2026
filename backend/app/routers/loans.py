import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.core.pagination import InvalidCursor, decode_cursor, encode_cursor
from app.models.loans import (
    ApproveIn,
    DisburseIn,
    InfoRequestIn,
    LoanDocument,
    LoanRepaymentOut,
    RejectIn,
    RepaymentIn,
    RespondIn,
)
from app.routers.users import require_role
from app.services import billing
from app.services import loans as loans_service
from app.services import storage
from app.services.ai import config_store as ai_config
from app.services.tasks import COLLECTION as TASKS_COLLECTION
from app.services.tasks import emit_task
from app.services.users import get_user

router = APIRouter(prefix="/loans", tags=["loans"])

LOAN_DOC_TYPES = storage.IMAGE_CONTENT_TYPES | {"application/pdf"}

# WS-03 task 3.3 — queue SLA buckets (hours since the application was created).
SLA_DUE_SOON_HOURS = 24
SLA_BREACH_HOURS = 48
SLA_AT_RISK_HOURS = 168
AT_RISK_CREDIT_SCORE = 550

LOAN_DOC_REQUEST_DEEP_LINK = "/dashboard/p/loanTracking"

# P1-23 — signed document download URLs are time-boxed to 60 minutes.
DOC_DOWNLOAD_URL_TTL_MINUTES = 60

# P1-24 — EMI repayment ledger (top-level collection, one doc per repayment,
# carrying the applicationId for bank-manager/applicant-scoped queries).
REPAYMENTS_COLLECTION = "loan_repayments"


def _error(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": {}},
    )


async def _banker(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "bankManager")
    await _enforce_banker_seat(uid)
    return uid


async def _enforce_banker_seat(uid: str) -> None:
    """WS-03 task 3.14 — per-seat licensing for partner institutions.

    Enforces the bankManager `seats` entitlement and records one seat per
    distinct banker uid (idempotent: only the first call per uid consumes a
    seat). Over-limit raises the phase-00 402 ENTITLEMENT_EXCEEDED envelope.
    Farmer/participant endpoints never call this (global rule 5)."""
    if await billing.usage_count(uid, "seats") > 0:
        return
    await billing.check_entitlement(uid, "bankManager", "seats")
    await billing.record_usage(uid, "seats")


async def _participant(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    return uid


async def _load_loan(application_id: str) -> dict:
    loan = await get_doc("loan_applications", application_id)
    if loan is None:
        _error(404, "LOAN_NOT_FOUND", "loan application not found")
    return loan


async def _participant_loan(uid: str, application_id: str) -> dict:
    user = await get_user(uid)
    loan = await _load_loan(application_id)
    if loan.get("userId") != uid and (user or {}).get("activeProfile") != "bankManager":
        _error(404, "LOAN_NOT_FOUND", "loan application not found")
    return loan


def _transition(loan: dict, to: str, *, by: str | None, note: str | None) -> dict:
    try:
        return loans_service.advance_status(
            loan,
            to,
            by=by,
            note=note,
            status_text=loans_service.LOAN_STATUS_TEXT[to],
        )
    except ValueError:
        _error(
            409,
            "LOAN_INVALID_TRANSITION",
            f"loan is '{loan.get('status')}' and cannot move to '{to}'",
        )


async def _notify_officer(loan: dict, title: str, body: str):
    officer = loan.get("assignedOfficerId")
    if officer:
        await loans_service.notify_farmer(officer, title, body)


@router.get("/queue")
async def review_queue(
    status: str | None = Query(None),
    q: str | None = Query(None),
    minAmount: int | None = Query(None, ge=0),
    maxAmount: int | None = Query(None, ge=0),
    district: str | None = Query(None),
    cursor: str | None = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    uid: str = Depends(_banker),
):
    filters = [("status", "==", status)] if status else None
    docs = await query("loan_applications", filters, limit=2000)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    if q:
        needle = q.lower()
        docs = [
            d
            for d in docs
            if needle in (d.get("farmerName") or "").lower()
            or needle in (d.get("farmerPhone") or "")
            or needle in (d.get("applicationNumber") or "").lower()
        ]
    if minAmount is not None:
        docs = [d for d in docs if int(round(d.get("amount", 0))) >= minAmount]
    if maxAmount is not None:
        docs = [d for d in docs if int(round(d.get("amount", 0))) <= maxAmount]
    if district:
        needle = district.lower()
        docs = [d for d in docs if (d.get("district") or "").lower() == needle]
    total = len(docs)

    next_cursor = None
    if cursor:
        try:
            cursor_value = decode_cursor(cursor)
        except InvalidCursor:
            _error(400, "INVALID_CURSOR", "the pagination cursor is not valid")
        remaining = [d for d in docs if (d.get("createdAt") or "") < cursor_value]
        window = remaining[:pageSize]
        if len(remaining) > pageSize and window:
            next_cursor = encode_cursor(window[-1].get("createdAt"))
    else:
        start = (page - 1) * pageSize
        window = docs[start : start + pageSize]
        if len(docs) > start + pageSize and window:
            next_cursor = encode_cursor(window[-1].get("createdAt"))

    # WS-07 M14 — AI prescreen: annotate + risk-sort the queue page. The window
    # and cursor were computed on `createdAt` above, so pagination is unchanged;
    # the annotation never mutates the application status (sorting only). With
    # the `loans_prescreen` flag off the queue is exactly the submitted order
    # with no `ai` annotation.
    if await ai_config.module_enabled(loans_service.LOAN_PRESCREEN_MODULE):
        for row in window:
            await loans_service.prescreen_application(row, emit_missing_docs_task=True)
            await set_doc("loan_applications", row.get("applicationId") or row.get("id"), row)
        window.sort(
            key=lambda d: loans_service.LOAN_PRESCREEN_BAND_ORDER.get(
                (d.get("ai") or {}).get("riskBand"), len(loans_service.LOAN_PRESCREEN_BAND_ORDER)
            )
        )
    else:
        for row in window:
            row["ai"] = None

    data = [loans_service.to_out(d).model_dump() for d in window]
    return {
        "data": data,
        "page": page,
        "pageSize": pageSize,
        "total": total,
        "nextCursor": next_cursor,
    }


def _age_hours(iso: str | None, now: datetime) -> float:
    if not iso:
        return 0.0
    try:
        created = datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
    except ValueError:
        return 0.0
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    return max(0.0, (now - created).total_seconds() / 3600.0)


@router.get("/stats")
async def loan_stats(uid: str = Depends(_banker)):
    docs = await query("loan_applications", limit=5000)
    by_status: dict[str, int] = {}
    for d in docs:
        status = d.get("status", "unknown")
        by_status[status] = by_status.get(status, 0) + 1

    now = datetime.now(timezone.utc)
    today = now.date().isoformat()
    week_start = (now - timedelta(days=7)).date().isoformat()

    breach = due_soon = on_track = 0
    approvals_today = 0
    disbursals_week_count = 0
    disbursals_week_paisa = 0
    at_risk = 0
    sanctioned_paisa = 0
    disbursed_paisa = 0
    outstanding_paisa = 0
    npa_watch: list[dict] = []

    for d in docs:
        status = d.get("status")
        age_hours = _age_hours(d.get("createdAt"), now)
        score = d.get("farmerCreditScore")
        sanctioned = int(d.get("sanctionedAmount") or 0)
        disbursed = int(d.get("disbursedAmount") or 0)

        if status in ("submitted", "underReview", "infoRequested"):
            if age_hours >= SLA_BREACH_HOURS:
                breach += 1
            elif age_hours >= SLA_DUE_SOON_HOURS:
                due_soon += 1
            else:
                on_track += 1
            is_risky = (score is not None and int(score) < AT_RISK_CREDIT_SCORE) or (
                age_hours >= SLA_AT_RISK_HOURS
            )
            if is_risky:
                at_risk += 1
                npa_watch.append(
                    {
                        "applicationId": d.get("applicationId") or d.get("id"),
                        "applicationNumber": d.get("applicationNumber"),
                        "farmerName": d.get("farmerName"),
                        "amountPaisa": int(round(float(d.get("amount") or 0) * 100)),
                        "status": status,
                        "daysOverdue": int(age_hours // 24),
                        "creditScore": score,
                    }
                )

        if status in ("approved", "disbursed"):
            sanctioned_paisa += sanctioned * 100
        if status == "disbursed":
            # No EMI repayment ledger in this phase: released principal stands as
            # the outstanding amount and is the base of the collection rate.
            outstanding_paisa += sanctioned * 100
            disbursed_paisa += disbursed * 100
            disb_day = str(d.get("disbursedAt") or "")[:10]
            if disb_day and disb_day >= week_start:
                disbursals_week_count += 1
                disbursals_week_paisa += (disbursed or sanctioned) * 100

        for entry in d.get("timeline") or []:
            if entry.get("status") == "approved" and str(entry.get("at") or "")[:10] == today:
                approvals_today += 1
                break

    total = len(docs)
    emi_collection_rate = 0 if total == 0 else max(0, min(100, round(100 * (total - at_risk) / total)))

    return {
        "byStatus": by_status,
        "totalApplications": total,
        "totalRequestedAmount": int(round(sum(d.get("amount", 0) for d in docs))),
        "totalSanctionedAmount": sum(int(d.get("sanctionedAmount") or 0) for d in docs),
        "pendingReview": sum(by_status.get(s, 0) for s in ("submitted", "underReview", "infoRequested")),
        "queueDepthBySla": {"breach": breach, "dueSoon": due_soon, "onTrack": on_track},
        "approvalsToday": approvals_today,
        "disbursalsThisWeek": {"count": disbursals_week_count, "amountPaisa": disbursals_week_paisa},
        "atRiskAccounts": at_risk,
        "portfolioTotals": {
            "sanctionedPaisa": sanctioned_paisa,
            "disbursedPaisa": disbursed_paisa,
            "outstandingPaisa": outstanding_paisa,
        },
        "npaWatch": npa_watch,
        "emiCollectionRate": emi_collection_rate,
    }


@router.get("/audit-logs")
async def loan_audit_logs(
    applicationId: str | None = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    uid: str = Depends(_banker),
):
    """P2-20 — bank-manager-scoped read of the audit rows the loan mutations
    write (WS-03 rule 8: every decision lands in `audit_logs` with `loanId`).

    Rows are filtered to the requested application, so a bank manager only ever
    sees logs for applications they can access (the same access model as
    GET /loans/{id}: any bank manager, or the applicant via the loan itself).
    Ordered newest-first by audit timestamp, offset-paginated like the queue."""
    if not applicationId:
        _error(400, "VALIDATION_ERROR", "applicationId query parameter is required")
    await _load_loan(applicationId)
    rows = await query("audit_logs", [("loanId", "==", applicationId)], limit=5000)
    rows.sort(key=lambda d: d.get("timestamp") or "", reverse=True)
    total = len(rows)
    start = (page - 1) * pageSize
    return {
        "data": rows[start : start + pageSize],
        "page": page,
        "pageSize": pageSize,
        "total": total,
    }


@router.get("/{applicationId}")
async def get_loan(applicationId: str, uid: str = Depends(_participant)):
    loan = await _participant_loan(uid, applicationId)
    return loans_service.to_out(loan).model_dump()


@router.post("/{applicationId}/review")
async def review_loan(applicationId: str, uid: str = Depends(_banker)):
    loan = await _load_loan(applicationId)
    banker = await get_user(uid)
    loan = _transition(loan, "underReview", by=uid, note=None)
    loan["assignedOfficerId"] = uid
    loan["assignedOfficerName"] = (banker or {}).get("name")
    await set_doc("loan_applications", applicationId, loan)
    await loans_service.notify_farmer(
        loan["userId"], "ऋण आवेदन समीक्षा में", f"आवेदन {loan.get('applicationNumber') or applicationId} बैंक समीक्षा में है"
    )
    await loans_service.write_audit(
        uid,
        "LOAN_REVIEW",
        applicationId,
        {"applicationNumber": loan.get("applicationNumber")},
        reason=None,
    )
    return loans_service.to_out(loan).model_dump()


@router.post("/{applicationId}/approve")
async def approve_loan(applicationId: str, body: ApproveIn, uid: str = Depends(_banker)):
    loan = await _load_loan(applicationId)
    loan = _transition(loan, "approved", by=uid, note=body.note)
    loan["sanctionedAmount"] = body.sanctionedAmount
    loan["interestRate"] = body.interestRate
    loan["tenureMonths"] = body.tenureMonths
    await set_doc("loan_applications", applicationId, loan)
    await loans_service.notify_farmer(
        loan["userId"], "ऋण स्वीकृत", f"₹{body.sanctionedAmount} @ {body.interestRate}% स्वीकृत"
    )
    await loans_service.write_audit(uid, "LOAN_APPROVE", applicationId, body.model_dump(), reason=body.note)
    # WS-07 task 7.6 — M14 outcome hook (approved; sorting/annotation never
    # changed this decision).
    await loans_service.record_prescreen_outcome(loan, "approved")
    return loans_service.to_out(loan).model_dump()


@router.post("/{applicationId}/reject")
async def reject_loan(applicationId: str, body: RejectIn, uid: str = Depends(_banker)):
    loan = await _load_loan(applicationId)
    loan = _transition(loan, "rejected", by=uid, note=body.reason)
    loan["rejectionReason"] = body.reason
    await set_doc("loan_applications", applicationId, loan)
    await loans_service.notify_farmer(loan["userId"], "ऋण अस्वीकृत", body.reason)
    await loans_service.write_audit(uid, "LOAN_REJECT", applicationId, {"reason": body.reason}, reason=body.reason)
    # WS-07 task 7.6 — M14 outcome hook (rejected). The status machine has no
    # `defaulted` transition, so that label stays reserved (see outcomes.py).
    await loans_service.record_prescreen_outcome(loan, "rejected")
    return loans_service.to_out(loan).model_dump()


@router.post("/{applicationId}/info-request")
async def request_info(applicationId: str, body: InfoRequestIn, uid: str = Depends(_banker)):
    loan = await _load_loan(applicationId)
    loan = _transition(loan, "infoRequested", by=uid, note=body.message)
    # WS-03 task 3.11 — emit a task-engine task to the farmer (dedupe-safe);
    # the farmer answers via POST /loans/{id}/documents + POST /loans/{id}/respond.
    if loan.get("userId"):
        task_id = await emit_task(
            loan["userId"],
            persona="farmer",
            module="loans",
            kind="loan_doc_request",
            title_en="Documents needed for your loan application",
            title_hi="आपके ऋण आवेदन के लिए दस्तावेज़ चाहिए",
            subtitle=body.message,
            priority="today",
            deep_link=LOAN_DOC_REQUEST_DEEP_LINK,
            source_id=applicationId,
            action_endpoint=f"/v1/loans/{applicationId}/documents",
        )
        loan["infoRequestTaskId"] = task_id
    await set_doc("loan_applications", applicationId, loan)
    await loans_service.notify_farmer(loan["userId"], "जानकारी आवश्यक", body.message)
    await loans_service.write_audit(
        uid, "LOAN_INFO_REQUEST", applicationId, {"message": body.message}, reason=body.message
    )
    return loans_service.to_out(loan).model_dump()


@router.post("/{applicationId}/respond")
async def respond_loan(applicationId: str, body: RespondIn, uid: str = Depends(_participant)):
    loan = await _participant_loan(uid, applicationId)
    if loan.get("userId") != uid:
        _error(403, "FORBIDDEN_ROLE", "only the applicant can respond to an info request")
    if loan.get("status") != "infoRequested":
        _error(
            409,
            "LOAN_INVALID_TRANSITION",
            f"loan is '{loan.get('status')}' and cannot move to 'underReview'",
        )
    loan = _transition(loan, "underReview", by=uid, note=body.message)
    # WS-03 task 3.11 — resolve the document-request task the banker emitted.
    task_id = loan.get("infoRequestTaskId")
    if task_id:
        task_doc = await get_doc(TASKS_COLLECTION, task_id)
        if task_doc is not None and task_doc.get("status") == "open":
            task_doc["status"] = "done"
            task_doc["updatedAt"] = datetime.now(timezone.utc).isoformat()
            await set_doc(TASKS_COLLECTION, task_id, task_doc)
    await set_doc("loan_applications", applicationId, loan)
    await _notify_officer(loan, "किसान ने जानकारी भेजी", body.message)
    return loans_service.to_out(loan).model_dump()


@router.post("/{applicationId}/cancel")
async def cancel_loan(applicationId: str, uid: str = Depends(_participant)):
    loan = await _participant_loan(uid, applicationId)
    if loan.get("userId") != uid:
        _error(403, "FORBIDDEN_ROLE", "only the applicant can cancel this application")
    if loan.get("status") not in ("submitted", "infoRequested"):
        _error(
            409,
            "LOAN_INVALID_TRANSITION",
            f"loan is '{loan.get('status')}' and cannot move to 'cancelled'",
        )
    loan = _transition(loan, "cancelled", by=uid, note=None)
    await set_doc("loan_applications", applicationId, loan)
    await _notify_officer(loan, "ऋण आवेदन रद्द", f"आवेदन {loan.get('applicationNumber') or applicationId} किसान ने रद्द किया")
    return loans_service.to_out(loan).model_dump()


@router.post("/{applicationId}/disburse")
async def disburse_loan(applicationId: str, body: DisburseIn, uid: str = Depends(_banker)):
    loan = await _load_loan(applicationId)
    loan = _transition(loan, "disbursed", by=uid, note=None)
    loan["disbursementRef"] = body.disbursementRef
    loan["disbursedAt"] = datetime.now(timezone.utc).isoformat()
    loan["disbursedAmount"] = body.disbursedAmount or loan.get("sanctionedAmount")
    # WS-03 task 3.12 — schedule one EMI reminder per installment at disbursal.
    loan["emiRemindersScheduled"] = await loans_service.schedule_emi_reminders(loan)
    await set_doc("loan_applications", applicationId, loan)
    # WS-03 task 3.9 — partner-bank referral/origination fee ledger entry.
    await loans_service.record_origination_fee(loan, actor_id=uid)
    amount = loan["disbursedAmount"]
    await loans_service.notify_farmer(loan["userId"], "राशि वितरित", f"₹{amount} आपके खाते में भेजी गई — ref {body.disbursementRef}")
    await loans_service.write_audit(
        uid, "LOAN_DISBURSE", applicationId, body.model_dump(), reason=body.disbursementRef
    )
    return loans_service.to_out(loan).model_dump()


@router.get("/{applicationId}/farmer360")
async def loan_farmer360(applicationId: str, uid: str = Depends(_banker)):
    """WS-03 task 3.5 — banker-scoped farmer-360 aggregate: applicant profile,
    KCC, credit score, land/crop data, repayment history and documents. The
    underlying /finance/kcc + /finance/loans endpoints are role-scoped to the
    farmer, so the console reads them server-side here instead of 403-ing."""
    loan = await _load_loan(applicationId)
    applicant_uid = loan.get("userId")
    user = await get_user(applicant_uid) if applicant_uid else None
    user = user or {}
    score = user.get("kisanCreditScore") or loan.get("farmerCreditScore")
    tier = user.get("creditTier") or loan.get("farmerCreditTier")
    kcc_limit = user.get("kccLimit") or 0
    phone = user.get("phone") or ""
    kcc = None
    if kcc_limit:
        kcc = {
            "bankName": user.get("bankName", ""),
            "cardNumberMasked": "XXXX-XXXX-" + phone[-4:],
            "kccLimit": kcc_limit,
            "availableLimit": kcc_limit,
        }
    history: list[dict] = []
    if applicant_uid:
        docs = await query("loan_applications", [("userId", "==", applicant_uid)], limit=500)
        docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
        history = [loans_service.to_out(d).model_dump() for d in docs]
    return {
        "applicationId": applicationId,
        "profile": {
            "userId": applicant_uid,
            "name": user.get("name") or loan.get("farmerName"),
            "phone": user.get("phone") or loan.get("farmerPhone"),
            "village": user.get("village"),
            "district": user.get("district") or loan.get("district"),
        },
        "credit": {"kisanCreditScore": score, "creditTier": tier},
        "kcc": kcc,
        "landCrop": {
            "landHoldingAcres": user.get("landHoldingAcres"),
            "primaryCrops": user.get("primaryCrops") or [],
        },
        "repaymentHistory": history,
        "documents": loan.get("documents") or [],
    }


@router.get("/{applicationId}/schedule")
async def loan_schedule(applicationId: str, uid: str = Depends(_participant)):
    loan = await _participant_loan(uid, applicationId)
    if loan.get("status") in ("approved", "disbursed") and loan.get("sanctionedAmount"):
        entries = loans_service.compute_schedule(
            loan["sanctionedAmount"],
            loan.get("interestRate") or loans_service.DEFAULT_INTEREST_RATE,
            loan.get("tenureMonths") or 1,
            start_date_iso=loan.get("updatedAt"),
        )
    else:
        entries = loans_service.compute_schedule(
            loan["amount"],
            loans_service.DEFAULT_INTEREST_RATE,
            loan.get("tenureMonths") or 1,
            start_date_iso=loan.get("createdAt"),
        )
    return {"data": [e.model_dump() for e in entries]}


@router.post("/{applicationId}/documents", status_code=201)
async def upload_documents(
    applicationId: str,
    files: list[UploadFile] | None = File(None),
    reference_no: str | None = Form(None),
    uid: str = Depends(_participant),
):
    # phase-03 task 5.13 — alongside the applicant's file upload, a bank officer
    # may attach a warehouse receipt as a collateral reference document. File
    # upload stays applicant-only; officers never gain file-upload rights here.
    user = await get_user(uid)
    loan = await _participant_loan(uid, applicationId)
    is_applicant = loan.get("userId") == uid
    is_banker = (user or {}).get("activeProfile") == "bankManager"
    receipt_no = reference_no.strip() if reference_no is not None else ""
    if not files and not receipt_no:
        _error(422, "VALIDATION_ERROR", "at least one of files or reference_no is required")
    now = datetime.now(timezone.utc).isoformat()
    if receipt_no:
        if not is_banker:
            _error(403, "FORBIDDEN_ROLE", "only a bank officer can attach a reference document")
        loan.setdefault("documents", []).append(
            LoanDocument(
                documentId=uuid.uuid4().hex,
                name="Warehouse Receipt",
                storagePath=f"warehouse-receipt/{applicationId}/{receipt_no}",
                uploadedAt=now,
                referenceNo=receipt_no,
            ).model_dump()
        )
        loan["updatedAt"] = now
        await set_doc("loan_applications", applicationId, loan)
        await loans_service.write_audit(
            uid,
            "LOAN_WAREHOUSE_RECEIPT_ATTACH",
            applicationId,
            {"referenceNo": receipt_no},
            reason=receipt_no,
        )
        return loans_service.to_out(loan).model_dump()
    if not is_applicant:
        _error(403, "FORBIDDEN_ROLE", "only the applicant can upload loan documents")
    added = []
    for f in files or []:
        data = await storage.validate_upload(f, allowed_types=LOAN_DOC_TYPES)
        blob_path, _ = storage.upload_user_file(
            uid, data, f.filename or "document", f.content_type, prefix="loandocs"
        )
        added.append(
            LoanDocument(
                documentId=uuid.uuid4().hex,
                name=f.filename or "document",
                storagePath=blob_path,
                uploadedAt=now,
            ).model_dump()
        )
    loan.setdefault("documents", []).extend(added)
    loan["updatedAt"] = now
    await set_doc("loan_applications", applicationId, loan)
    return loans_service.to_out(loan).model_dump()


@router.get("/{applicationId}/documents/{documentId}/download")
async def download_document(
    applicationId: str,
    documentId: str,
    uid: str = Depends(_participant),
):
    """P1-23 — time-boxed signed download URL for one loan document.

    Access reuses the loan GET helper (`_participant_loan`): the applicant
    farmer or a bank manager (the officer assigned at review). The document
    must belong to this application — anything else is a 404 so document ids
    cannot be probed across loans."""
    loan = await _participant_loan(uid, applicationId)
    doc = next(
        (d for d in loan.get("documents") or [] if d.get("documentId") == documentId),
        None,
    )
    if doc is None:
        _error(404, "LOAN_DOCUMENT_NOT_FOUND", "document not found on this loan application")
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=DOC_DOWNLOAD_URL_TTL_MINUTES)
    url = storage.signed_download_url(doc["storagePath"], minutes=DOC_DOWNLOAD_URL_TTL_MINUTES)
    return {"url": url, "expiresAt": expires_at.isoformat()}


def _repayment_principal_paisa(loan: dict) -> int | None:
    """Disbursed (else sanctioned) principal in integer paisa, or None when the
    loan has not been approved yet and therefore has no EMI schedule basis."""
    principal = int(loan.get("disbursedAmount") or loan.get("sanctionedAmount") or 0)
    return principal * 100 if principal > 0 else None


def _default_risk(loan: dict, total_repaid_paisa: int) -> dict:
    """P1-24 — deterministic default-risk indicator for the repayment ledger.

    `daysOverdue` is the number of days elapsed since the due date of the
    first installment whose cumulative due amount exceeds the total repaid
    (0 when every due installment is covered or when the loan has no EMI
    schedule yet — `basis` says which). The EMI schedule is recomputed with
    the same terms as GET /loans/{id}/schedule."""
    if _repayment_principal_paisa(loan) is None or loan.get("status") not in ("approved", "disbursed"):
        return {"daysOverdue": 0, "basis": "no_emi_schedule"}
    entries = loans_service.compute_schedule(
        loan["disbursedAmount"] or loan["sanctionedAmount"],
        loan.get("interestRate") or loans_service.DEFAULT_INTEREST_RATE,
        int(loan.get("tenureMonths") or 1),
        start_date_iso=loan.get("disbursedAt") or loan.get("updatedAt"),
    )
    cumulative_due_paisa = 0
    first_unpaid_due_date = None
    for entry in entries:
        cumulative_due_paisa += entry.emi * 100
        if cumulative_due_paisa > total_repaid_paisa:
            first_unpaid_due_date = entry.dueDate
            break
    if first_unpaid_due_date is None:
        return {"daysOverdue": 0, "basis": "emi_schedule"}
    due = date.fromisoformat(first_unpaid_due_date)
    days_overdue = (datetime.now(timezone.utc).date() - due).days
    return {"daysOverdue": max(0, days_overdue), "basis": "emi_schedule"}


@router.post("/{applicationId}/repayments", status_code=201)
async def record_repayment(
    applicationId: str,
    body: RepaymentIn,
    uid: str = Depends(_banker),
):
    """P1-24 — record an EMI/principal repayment against a loan (bank-manager
    scoped, integer paise). Appends one doc to the `loan_repayments` ledger and
    rolls the loan doc's `paidAmountPaisa` / `emisPaid` up. `emiIndex` is the
    1-based installment number: recording the same index twice is rejected with
    409 DUPLICATE_EMI (idempotent collection), while index-less entries are
    always allowed. Every mutation writes an audit_logs row (WS-03 rule 8)."""
    loan = await _load_loan(applicationId)
    rows = await query(REPAYMENTS_COLLECTION, [("applicationId", "==", applicationId)], limit=5000)
    if body.emiIndex is not None and any(r.get("emiIndex") == body.emiIndex for r in rows):
        _error(409, "DUPLICATE_EMI", f"EMI installment {body.emiIndex} is already recorded for this loan")
    now = datetime.now(timezone.utc).isoformat()
    repayment = {
        "repaymentId": f"repay_{applicationId}_{uuid.uuid4().hex}",
        "applicationId": applicationId,
        "amountPaise": body.amountPaise,
        "mode": body.mode,
        "emiIndex": body.emiIndex,
        "paidAt": body.paidAt or now,
        "note": body.note,
        "recordedAt": now,
    }
    await set_doc(REPAYMENTS_COLLECTION, repayment["repaymentId"], repayment)
    distinct_emis = {r.get("emiIndex") for r in rows if r.get("emiIndex") is not None}
    if body.emiIndex is not None:
        distinct_emis.add(body.emiIndex)
    loan["paidAmountPaisa"] = int(loan.get("paidAmountPaisa") or 0) + body.amountPaise
    loan["emisPaid"] = len(distinct_emis)
    loan["updatedAt"] = now
    await set_doc("loan_applications", applicationId, loan)
    await loans_service.write_audit(
        uid,
        "LOAN_REPAYMENT",
        applicationId,
        {"amountPaise": body.amountPaise, "mode": body.mode, "emiIndex": body.emiIndex},
        reason=body.note,
    )
    return LoanRepaymentOut(runningPaidPaisa=loan["paidAmountPaisa"], **repayment).model_dump()


@router.get("/{applicationId}/repayments")
async def list_repayments(
    applicationId: str,
    uid: str = Depends(_participant),
):
    """P1-24 — repayment ledger for one loan, readable by the bank manager or
    the applicant farmer (the loan GET access helper). Entries are ordered by
    payment time with a running paid balance, plus the computed `defaultRisk`
    indicator (see `_default_risk` for the exact deterministic rule)."""
    loan = await _participant_loan(uid, applicationId)
    rows = await query(REPAYMENTS_COLLECTION, [("applicationId", "==", applicationId)], limit=5000)
    rows.sort(key=lambda r: (r.get("paidAt") or "", r.get("recordedAt") or ""))
    total_repaid_paisa = 0
    data = []
    for row in rows:
        total_repaid_paisa += int(row.get("amountPaise") or 0)
        data.append(LoanRepaymentOut(runningPaidPaisa=total_repaid_paisa, **row).model_dump())
    return {
        "applicationId": applicationId,
        "data": data,
        "total": len(data),
        "totalRepaidPaisa": total_repaid_paisa,
        "principalPaisa": _repayment_principal_paisa(loan),
        "defaultRisk": _default_risk(loan, total_repaid_paisa),
    }
