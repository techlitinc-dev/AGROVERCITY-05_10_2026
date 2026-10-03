import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.loans import (
    ApproveIn,
    DisburseIn,
    InfoRequestIn,
    LoanDocument,
    RejectIn,
    RespondIn,
)
from app.routers.users import require_role
from app.services import loans as loans_service
from app.services import storage
from app.services.users import get_user

router = APIRouter(prefix="/loans", tags=["loans"])

LOAN_DOC_TYPES = storage.IMAGE_CONTENT_TYPES | {"application/pdf"}


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
    return uid


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
    start = (page - 1) * pageSize
    data = [loans_service.to_out(d).model_dump() for d in docs[start : start + pageSize]]
    return {"data": data, "page": page, "pageSize": pageSize, "total": len(docs)}


@router.get("/stats")
async def loan_stats(uid: str = Depends(_banker)):
    docs = await query("loan_applications", limit=5000)
    by_status: dict[str, int] = {}
    for d in docs:
        status = d.get("status", "unknown")
        by_status[status] = by_status.get(status, 0) + 1
    return {
        "byStatus": by_status,
        "totalApplications": len(docs),
        "totalRequestedAmount": int(round(sum(d.get("amount", 0) for d in docs))),
        "totalSanctionedAmount": sum(int(d.get("sanctionedAmount") or 0) for d in docs),
        "pendingReview": sum(by_status.get(s, 0) for s in ("submitted", "underReview", "infoRequested")),
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
    await loans_service.write_audit(uid, "LOAN_REVIEW", applicationId, {"applicationNumber": loan.get("applicationNumber")})
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
    await loans_service.write_audit(uid, "LOAN_APPROVE", applicationId, body.model_dump())
    return loans_service.to_out(loan).model_dump()


@router.post("/{applicationId}/reject")
async def reject_loan(applicationId: str, body: RejectIn, uid: str = Depends(_banker)):
    loan = await _load_loan(applicationId)
    loan = _transition(loan, "rejected", by=uid, note=body.reason)
    loan["rejectionReason"] = body.reason
    await set_doc("loan_applications", applicationId, loan)
    await loans_service.notify_farmer(loan["userId"], "ऋण अस्वीकृत", body.reason)
    await loans_service.write_audit(uid, "LOAN_REJECT", applicationId, {"reason": body.reason})
    return loans_service.to_out(loan).model_dump()


@router.post("/{applicationId}/info-request")
async def request_info(applicationId: str, body: InfoRequestIn, uid: str = Depends(_banker)):
    loan = await _load_loan(applicationId)
    loan = _transition(loan, "infoRequested", by=uid, note=body.message)
    await set_doc("loan_applications", applicationId, loan)
    await loans_service.notify_farmer(loan["userId"], "जानकारी आवश्यक", body.message)
    await loans_service.write_audit(uid, "LOAN_INFO_REQUEST", applicationId, {"message": body.message})
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
    await set_doc("loan_applications", applicationId, loan)
    amount = loan["disbursedAmount"]
    await loans_service.notify_farmer(loan["userId"], "राशि वितरित", f"₹{amount} आपके खाते में भेजी गई — ref {body.disbursementRef}")
    await loans_service.write_audit(uid, "LOAN_DISBURSE", applicationId, body.model_dump())
    return loans_service.to_out(loan).model_dump()


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
    files: list[UploadFile] = File(...),
    uid: str = Depends(_participant),
):
    loan = await _participant_loan(uid, applicationId)
    if loan.get("userId") != uid:
        _error(403, "FORBIDDEN_ROLE", "only the applicant can upload loan documents")
    now = datetime.now(timezone.utc).isoformat()
    added = []
    for f in files:
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
