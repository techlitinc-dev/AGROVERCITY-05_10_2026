"""FastAPI Superadmin Management Router for AGROVERCITY Platform."""
import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, List
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, Header, HTTPException, Query

from app.core.db import get_doc, set_doc, query
from app.core.deps import admin_action, admin_user
from app.core.pagination import fetch_page
from app.models.loans import LoanStatus
from app.routers.analytics import _line_factor, last_12_months, month_key
from app.services import approvals
from app.services import kyc as kyc_service
from app.services import loans as loans_service
from app.services.admin_auth import (
    admin_context,
    admin_mutation_context,
    current_admin_user,
    require_admin_role,
)
from app.services.audit import log_admin_action
from app.services.users import get_user

router = APIRouter(prefix="/admin", tags=["admin"])

# Thin aliases kept so existing `Depends(_admin_user)` call sites keep working
# while the console migrates onto the phase-07 RBAC helpers.
_admin_user = admin_user
_require_admin = admin_user

# Expert-handoff SLA window (hours) used to compute `slaDueAt`/`slaBreached`.
EXPERT_SLA_HOURS = 24


def _error(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": {}},
    )


class UserStatusUpdate(BaseModel):
    status: str = Field(..., description="active | suspended | banned")
    reason: str = Field(..., min_length=3)


class KycReviewIn(BaseModel):
    status: str = Field(..., description="verified | rejected")
    rejectionReason: Optional[str] = None
    auditNotes: Optional[str] = None


class ClaimAdjudicateIn(BaseModel):
    action: str = Field(..., description="approve | reject | assign_surveyor")
    surveyorName: Optional[str] = None
    approvedAmount: Optional[float] = None
    notes: Optional[str] = None


class ExpertTicketResolveIn(BaseModel):
    prescriptionNotes: str = Field(..., min_length=5)
    recommendedProducts: List[str] = Field(default_factory=list)


@router.get("/overview")
async def get_admin_overview(user: dict = Depends(current_admin_user)):
    """Unified superadmin KPI metrics across all 26 modules."""
    users_list = await query("users", limit=1000)
    
    # Persona counts
    persona_counts = {
        "farmer": sum(1 for u in users_list if "farmer" in u.get("linkedProfiles", [])),
        "farmLandlord": sum(1 for u in users_list if "farmLandlord" in u.get("linkedProfiles", [])),
        "transporter": sum(1 for u in users_list if "transporter" in u.get("linkedProfiles", [])),
        "seller": sum(1 for u in users_list if "seller" in u.get("linkedProfiles", [])),
        "equipmentRental": sum(1 for u in users_list if "equipmentRental" in u.get("linkedProfiles", [])),
        "broker": sum(1 for u in users_list if "broker" in u.get("linkedProfiles", [])),
        "instructor": sum(1 for u in users_list if "instructor" in u.get("linkedProfiles", [])),
    }

    orders = await query("orders", limit=1000)
    total_gmv = sum(o.get("total", 0) for o in orders)
    
    claims = await query("insurance_claims", limit=500)
    pending_claims = sum(1 for c in claims if c.get("status") in ("intimated", "under_survey"))

    settlements = await query("settlements", limit=500)
    pending_settlements_volume = sum(s.get("netRupees", 0) for s in settlements if s.get("status") == "pending")

    return {
        "activeUsersTotal": len(users_list),
        "personaBreakdown": persona_counts,
        "marketplaceGMV": total_gmv,
        "pendingKycCount": await kyc_service.pending_doc_count(),
        "pendingClaimsCount": pending_claims,
        "pendingSettlementsAmount": pending_settlements_volume,
        "activeFarmlandLeases": 42,
        "platformHealth": "100% Operational",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/users")
async def list_users(
    persona: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(admin_user),
):
    users_list = await query("users", limit=500)
    filtered = []
    for u in users_list:
        if persona and persona not in u.get("linkedProfiles", []):
            continue
        if status and u.get("status", "active") != status:
            continue
        if search:
            s_lower = search.lower()
            if s_lower not in u.get("name", "").lower() and s_lower not in u.get("phone", "") and s_lower not in u.get("id", ""):
                continue
        filtered.append(u)

    start = (page - 1) * pageSize
    end = start + pageSize
    return {
        "data": filtered[start:end],
        "page": page,
        "pageSize": pageSize,
        "total": len(filtered),
    }


@router.post("/users/{target_uid}/status")
async def update_user_status(
    target_uid: str,
    body: UserStatusUpdate,
    ctx: dict = Depends(admin_mutation_context),
):
    admin = ctx["admin"]
    target = await get_user(target_uid)
    if not target:
        _error(404, "NOT_FOUND", "target user not found")

    previous = {"status": target.get("status", "active")}
    target["status"] = body.status
    target["statusReason"] = body.reason
    target["statusUpdatedAt"] = datetime.now(timezone.utc).isoformat()
    target["statusUpdatedBy"] = admin.get("id") or admin.get("uid")
    await set_doc("users", target_uid, target)

    await log_admin_action(
        admin,
        "users",
        "UPDATE_USER_STATUS",
        target_uid,
        previous,
        {"status": body.status, "reason": body.reason},
        ctx["reason"],
        ctx["ip"],
    )

    return {"success": True, "targetUid": target_uid, "status": body.status}


@router.get("/kyc/queue")
async def get_kyc_queue(user: dict = Depends(admin_user)):
    """Live KYC review queue from the `kyc_cases` collection (WS-04)."""
    cases = await query("kyc_cases", [], limit=1000)
    queue = []
    for case in cases:
        for doc in case.get("docs") or []:
            if doc.get("status") != "pending":
                continue
            queue.append(
                {
                    "id": doc.get("docId"),
                    "caseId": case.get("caseId"),
                    "userId": case.get("userId"),
                    "persona": case.get("persona"),
                    "docType": doc.get("type"),
                    "docName": doc.get("type"),
                    "fileUrl": doc.get("storagePath") or "",
                    "submittedAt": case.get("submittedAt"),
                    "status": "pending",
                }
            )
    return {"data": queue, "total": len(queue)}


@router.post("/kyc/{doc_id}/review")
async def review_kyc_document(
    doc_id: str,
    body: KycReviewIn,
    user: dict = Depends(admin_user),
    _audit: dict = Depends(admin_action("REVIEW_KYC_DOC")),
):
    cases = await query("kyc_cases", [], limit=1000)
    target_case = None
    for case in cases:
        if any(
            doc.get("docId") == doc_id or doc.get("type") == doc_id
            for doc in case.get("docs") or []
        ):
            target_case = case
            break
    if target_case is None:
        _error(404, "KYC_DOC_NOT_FOUND", "kyc document not found")
    try:
        updated = await kyc_service.review_doc(
            target_case["caseId"],
            doc_id,
            body.status,
            body.rejectionReason or body.auditNotes,
            user["uid"],
        )
    except ValueError as exc:
        _error(422, "VALIDATION_ERROR", str(exc))
    audit_id = f"aud_kyc_{doc_id}"
    await set_doc("audit_logs", audit_id, {
        "action": "REVIEW_KYC_DOC",
        "adminId": user["uid"],
        "docId": doc_id,
        "caseId": updated["caseId"],
        "status": body.status,
        "rejectionReason": body.rejectionReason,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    return {
        "success": True,
        "caseId": updated["caseId"],
        "docId": doc_id,
        "status": body.status,
        "caseStatus": updated["status"],
    }


class KycRejectIn(BaseModel):
    rejectionReason: str = Field(..., min_length=3)


async def _find_case_for_doc(doc_id: str):
    cases = await query("kyc_cases", [], limit=1000)
    for case in cases:
        for doc in case.get("docs") or []:
            if doc.get("docId") == doc_id or doc.get("type") == doc_id:
                return case, doc
    return None, None


def _kyc_row(case: dict, doc: dict) -> dict:
    return {
        "id": doc.get("docId"),
        "docId": doc.get("docId"),
        "caseId": case.get("caseId"),
        "userId": case.get("userId"),
        "persona": case.get("persona"),
        "docType": doc.get("type"),
        "docName": doc.get("type"),
        "fileUrl": doc.get("storagePath") or "",
        "submittedAt": case.get("submittedAt"),
        "status": doc.get("status"),
        "extracted": doc.get("extracted"),
        "riskScore": doc.get("riskScore"),
        "riskReasons": doc.get("riskReasons"),
    }


@router.get("/kyc/pending")
async def list_pending_kyc(
    user: dict = Depends(require_admin_role("superadmin", "compliance_officer")),
):
    """Real pending-document queue with the AI extraction + risk reasons attached."""
    cases = await query("kyc_cases", [], limit=1000)
    rows = []
    for case in cases:
        for doc in case.get("docs") or []:
            if doc.get("status") != "pending":
                continue
            rows.append(_kyc_row(case, doc))
    rows.sort(key=lambda r: r.get("submittedAt") or "", reverse=True)
    return {"data": rows, "total": len(rows)}


@router.get("/kyc/history")
async def list_kyc_history(
    user: dict = Depends(require_admin_role("superadmin", "compliance_officer")),
):
    cases = await query("kyc_cases", [], limit=1000)
    rows = []
    for case in cases:
        for doc in case.get("docs") or []:
            if doc.get("status") in ("verified", "rejected"):
                rows.append(_kyc_row(case, doc))
    rows.sort(key=lambda r: r.get("submittedAt") or "", reverse=True)
    return {"data": rows, "total": len(rows)}


async def _review_kyc(doc_id: str, status: str, reason: Optional[str], ctx: dict) -> dict:
    case, doc = await _find_case_for_doc(doc_id)
    if case is None:
        _error(404, "KYC_DOC_NOT_FOUND", "kyc document not found")
    previous = {"status": doc.get("status"), "reason": doc.get("reason")}
    try:
        updated = await kyc_service.review_doc(
            case["caseId"], doc.get("docId") or doc_id, status, reason, ctx["admin"].get("id")
        )
    except ValueError as exc:
        _error(422, "VALIDATION_ERROR", str(exc))
    await log_admin_action(
        ctx["admin"],
        "kyc",
        f"kyc.{status}",
        doc_id,
        previous,
        {"status": status, "reason": reason},
        ctx["reason"],
        ctx["ip"],
    )
    return {
        "success": True,
        "caseId": updated["caseId"],
        "docId": doc_id,
        "status": status,
        "caseStatus": updated["status"],
    }


@router.post("/kyc/{doc_id}/verify")
async def verify_kyc_document(
    doc_id: str,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "compliance_officer")),
):
    return await _review_kyc(doc_id, "verified", None, ctx)


@router.post("/kyc/{doc_id}/reject")
async def reject_kyc_document(
    doc_id: str,
    body: KycRejectIn,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "compliance_officer")),
):
    return await _review_kyc(doc_id, "rejected", body.rejectionReason, ctx)


@router.get("/expert-handoffs")
async def list_expert_handoffs(
    user: dict = Depends(require_admin_role("superadmin", "agronomist", "content_moderator"))
):
    docs = await query("expert_tickets", limit=100)
    now = datetime.now(timezone.utc)
    rows = []
    for ticket in docs:
        row = dict(ticket)
        sla_due = row.get("slaDueAt")
        if not sla_due and row.get("createdAt"):
            try:
                created = datetime.fromisoformat(str(row["createdAt"]))
                sla_due = (created + timedelta(hours=EXPERT_SLA_HOURS)).isoformat()
            except ValueError:
                sla_due = None
        row["slaDueAt"] = sla_due
        row["slaBreached"] = bool(sla_due) and sla_due < now.isoformat() and row.get("status") != "resolved"
        rows.append(row)
    return {"data": rows, "total": len(rows)}


@router.post("/expert-handoffs/{ticket_id}/resolve")
async def resolve_expert_handoff(
    ticket_id: str,
    body: ExpertTicketResolveIn,
    user: dict = Depends(admin_user),
    _audit: dict = Depends(admin_action("RESOLVE_EXPERT_HANDOFF")),
):
    ticket = await get_doc("expert_tickets", ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "ticket not found"})
    
    ticket["status"] = "resolved"
    ticket["resolvedAt"] = datetime.now(timezone.utc).isoformat()
    ticket["resolvedBy"] = user.get("name", user["uid"])
    ticket["prescriptionNotes"] = body.prescriptionNotes
    ticket["recommendedProducts"] = body.recommendedProducts
    await set_doc("expert_tickets", ticket_id, ticket)

    return {"success": True, "ticketId": ticket_id, "status": "resolved"}


# ---------------------------------------------------------------------------
# Module 27 — Instructor courses & podcasts moderation
# ---------------------------------------------------------------------------
class CourseReviewIn(BaseModel):
    action: str = Field(..., description="publish | reject")
    reason: Optional[str] = None


class CourseFeatureIn(BaseModel):
    isFeatured: bool


@router.get("/courses/queue")
async def course_review_queue(
    status: str = Query("pendingReview", description="pendingReview | published | rejected | all"),
    user: dict = Depends(admin_user),
):
    if status == "all":
        docs = await query("courses", [], limit=1000)
    else:
        docs = await query("courses", [("status", "==", status)], limit=1000)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return {"data": docs, "total": len(docs)}


@router.post("/courses/{course_id}/review")
async def review_course(
    course_id: str,
    body: CourseReviewIn,
    user: dict = Depends(admin_user),
    _audit: dict = Depends(admin_action("REVIEW_COURSE")),
    _role: dict = Depends(require_admin_role("superadmin", "compliance_officer")),
    x_audit_reason: Optional[str] = Header(None, alias="X-Audit-Reason"),
):
    course = await get_doc("courses", course_id)
    if not course:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "course not found"})
    if body.action not in ("publish", "reject"):
        raise HTTPException(
            status_code=422,
            detail={"code": "VALIDATION_ERROR", "message": "action must be publish or reject"},
        )
    if body.action == "reject" and not body.reason:
        raise HTTPException(
            status_code=422,
            detail={"code": "VALIDATION_ERROR", "message": "a rejection reason is required", "fieldErrors": {"reason": "required when rejecting"}},
        )
    now = datetime.now(timezone.utc).isoformat()
    if body.action == "publish":
        course["status"] = "published"
        course["rejectedReason"] = None
        course["publishedAt"] = now
        course["reviewedBy"] = user.get("name", user["uid"])
    else:
        course["status"] = "rejected"
        course["rejectedReason"] = body.reason
        course["reviewedBy"] = user.get("name", user["uid"])
    course["updatedAt"] = now
    await set_doc("courses", course_id, course)
    await set_doc("audit_logs", f"aud_course_{course_id}_{int(datetime.now(timezone.utc).timestamp())}", {
        "action": "REVIEW_COURSE",
        "adminId": user["uid"],
        "courseId": course_id,
        "reviewAction": body.action,
        "reason": body.reason,
        "timestamp": now,
    })
    await log_admin_action(
        user, "courses", "REVIEW_COURSE", course_id, None,
        {"status": course["status"], "action": body.action},
        x_audit_reason or body.reason or "course review", None,
    )
    return {"success": True, "courseId": course_id, "status": course["status"]}


@router.post("/courses/{course_id}/feature")
async def feature_course(
    course_id: str,
    body: CourseFeatureIn,
    user: dict = Depends(admin_user),
    _audit: dict = Depends(admin_action("FEATURE_COURSE")),
    _role: dict = Depends(require_admin_role("superadmin", "compliance_officer")),
):
    course = await get_doc("courses", course_id)
    if not course:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "course not found"})
    if course.get("status") != "published":
        raise HTTPException(
            status_code=409,
            detail={"code": "NOT_PUBLISHED", "message": "only published courses can be featured"},
        )
    course["isFeatured"] = body.isFeatured
    course["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("courses", course_id, course)
    return {"success": True, "courseId": course_id, "isFeatured": body.isFeatured}


@router.get("/courses/report")
async def courses_report(user: dict = Depends(admin_user)):
    courses = await query("courses", [], limit=1000)
    purchases = await query("course_purchases", [("status", "==", "paid")], limit=2000)
    by_status: dict[str, int] = {}
    for course in courses:
        by_status[course.get("status", "unknown")] = by_status.get(course.get("status", "unknown"), 0) + 1
    gmv = round(sum(float(p.get("amountRupees") or 0) for p in purchases), 2)
    commission = round(sum(
        float(p.get("amountRupees") or 0) * float(p.get("commissionPercent") or 0) / 100
        for p in purchases
    ), 2)
    return {
        "totalCourses": len(courses),
        "byStatus": by_status,
        "totalSales": len(purchases),
        "freeClaims": sum(1 for p in purchases if float(p.get("amountRupees") or 0) == 0),
        "grossMerchandiseValueRupees": gmv,
        "platformCommissionRupees": commission,
        "instructorEarningsRupees": round(gmv - commission, 2),
    }


# ---------------------------------------------------------------------------
# E-Market analytics (extension-2026-09-26)
# ---------------------------------------------------------------------------
@router.get("/analytics/emarket")
async def emarket_analytics(user: dict = Depends(admin_user)):
    orders = await query("orders", limit=1000)
    users_list = await query("users", limit=1000)
    products = await query("products", limit=1000)
    coupons = await query("coupons", limit=1000)
    product_map = {p["id"]: p for p in products}
    months = last_12_months()
    monthly_gmv = {m: 0 for m in months}
    orders_by_status: dict[str, int] = {}
    category_share: dict[str, int] = {}
    top_products: dict[str, dict] = {}
    top_sellers: dict[str, dict] = {}
    gmv = 0
    returned = 0
    for order in orders:
        status = order.get("status", "unknown")
        orders_by_status[status] = orders_by_status.get(status, 0) + 1
        if order.get("returnStatus") in ("requested", "processed") or status == "returned":
            returned += 1
        if status == "cancelled":
            continue
        amount = order.get("finalTotal", order.get("total", 0))
        gmv += amount
        factor = _line_factor(order)
        key = month_key(order.get("createdAt"))
        if key in monthly_gmv:
            monthly_gmv[key] += amount
        for item in order.get("items", []):
            product = product_map.get(item["productId"]) or {}
            line = round(product.get("discountedPrice", 0) * item["quantity"] * factor, 2)
            category = product.get("category", "Other")
            category_share[category] = category_share.get(category, 0) + line
            tp = top_products.setdefault(
                item["productId"],
                {"id": item["productId"], "title": product.get("title", ""), "revenue": 0, "orders": 0},
            )
            tp["revenue"] += line
            tp["orders"] += 1
            seller_id = product.get("sellerId")
            if seller_id:
                ts = top_sellers.setdefault(
                    seller_id, {"sellerId": seller_id, "name": "", "revenue": 0, "orders": 0}
                )
                ts["revenue"] += line
                ts["orders"] += 1
    user_names = {u.get("id"): u.get("name", "") for u in users_list}
    for ts in top_sellers.values():
        ts["name"] = user_names.get(ts["sellerId"], "")
    total_orders = len(orders)
    return {
        "gmv": gmv,
        "totalOrders": total_orders,
        "totalCustomers": sum(1 for u in users_list if "customer" in u.get("linkedProfiles", [])),
        "totalSellers": sum(1 for u in users_list if "seller" in u.get("linkedProfiles", [])),
        "aov": round(gmv / total_orders, 2) if total_orders else 0.0,
        "monthlyGmv": [{"month": m, "amount": monthly_gmv[m]} for m in months],
        "ordersByStatus": orders_by_status,
        "categoryShare": [
            {"category": k, "revenue": v}
            for k, v in sorted(category_share.items(), key=lambda kv: -kv[1])
        ],
        "topProducts": sorted(top_products.values(), key=lambda e: -e["revenue"])[:5],
        "topSellers": sorted(top_sellers.values(), key=lambda e: -e["revenue"])[:5],
        "returnRate": round(returned / total_orders, 2) if total_orders else 0.0,
        "couponUsage": {
            "issued": len(coupons),
            "used": sum(c.get("usedCount", 0) for c in coupons),
        },
    }


# ---------------------------------------------------------------------------
# Module 14 — Banking, credit & loan underwriting
# ---------------------------------------------------------------------------
class LoanStatusUpdateIn(BaseModel):
    status: LoanStatus
    note: Optional[str] = None


@router.get("/finance/loans")
async def list_finance_loans(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(admin_user),
):
    """Loan application underwriting queue for the superadmin console."""
    filters = [("status", "==", status)] if status else None
    docs = await query("loan_applications", filters, limit=2000)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    start = (page - 1) * pageSize
    data = [loans_service.to_out(d).model_dump() for d in docs[start : start + pageSize]]
    return {"data": data, "page": page, "pageSize": pageSize, "total": len(docs)}


@router.put("/finance/loans/{applicationId}/status")
async def update_finance_loan_status(
    applicationId: str,
    body: LoanStatusUpdateIn,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "finance_admin")),
):
    admin = ctx["admin"]
    loan = await get_doc("loan_applications", applicationId)
    if loan is None:
        _error(404, "LOAN_NOT_FOUND", "loan application not found")
    previous = {"status": loan.get("status")}
    try:
        updated = loans_service.advance_status(
            loan,
            body.status,
            by=admin.get("id") or admin.get("uid"),
            note=body.note,
            status_text=loans_service.LOAN_STATUS_TEXT[body.status],
        )
    except ValueError:
        _error(
            409,
            "LOAN_INVALID_TRANSITION",
            f"loan is '{loan.get('status')}' and cannot move to '{body.status}'",
        )
    # Note enforcement comes after transition validation so illegal jumps stay 409.
    if not (body.note or "").strip():
        _error(422, "VALIDATION_ERROR", "a status-change note is required")
    await set_doc("loan_applications", applicationId, updated)
    await set_doc(
        "audit_logs",
        f"aud_loan_{applicationId}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        {
            "action": "UPDATE_LOAN_STATUS",
            "adminId": admin.get("id") or admin.get("uid"),
            "loanId": applicationId,
            "newStatus": body.status,
            "note": body.note,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )
    await log_admin_action(
        admin, "loans", "UPDATE_LOAN_STATUS", applicationId, previous,
        {"status": body.status, "note": body.note}, ctx["reason"], ctx["ip"],
    )
    return loans_service.to_out(updated).model_dump()


# ---------------------------------------------------------------------------
# Module M4 — AI Flagged Rates Review (WS-06 step 1)
# ---------------------------------------------------------------------------
@router.get("/rates/flagged")
@router.get("/flagged-rates")
async def list_flagged_rates(user: dict = Depends(admin_user)):
    """Stub route listing rates flagged admin_review by M4 (full console in phase-07)."""
    rates = await query("vyapari_rates_pending", [], limit=1000)
    flagged = [
        r for r in rates
        if r.get("adminReview") or r.get("reviewStatus") == "admin_review" or r.get("flag") == "admin_review"
    ]
    flagged.sort(key=lambda r: r.get("createdAt", ""), reverse=True)
    return {"data": flagged, "total": len(flagged)}


# ---------------------------------------------------------------------------
# WS-01 — UGC moderation queue (phase-07 console renders this)
# ---------------------------------------------------------------------------
@router.get("/moderation-queue")
async def list_moderation_queue(
    cursor: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(admin_user),
):
    """Open UGC items flagged by `content.moderation.v1`, newest first."""
    page = await fetch_page(
        "moderation_queue",
        [("status", "==", "open")],
        order_field="createdAt",
        descending=True,
        cursor=cursor,
        page_size=limit,
    )
    return {"data": page["items"], "nextCursor": page["nextCursor"]}


@router.get("/fraud-queue")
async def list_fraud_queue(
    cursor: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(admin_user),
):
    """Open fraud holds flagged by `trust.fraud.v1`, newest first (WS-03)."""
    page = await fetch_page(
        "fraud_queue",
        [("status", "==", "open")],
        order_field="createdAt",
        descending=True,
        cursor=cursor,
        page_size=limit,
    )
    return {"data": page["items"], "nextCursor": page["nextCursor"]}


# ---------------------------------------------------------------------------
# WS-07 — locale translation approvals (M32)
# ---------------------------------------------------------------------------
class LocaleApprovalIn(BaseModel):
    locale: str
    key: str
    action: str = Field(..., description="approve | reject")


@router.get("/locale-drafts")
async def list_locale_drafts(
    locale: str = Query(...),
    cursor: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(admin_user),
):
    """Pending AI translation drafts for a locale (WS-07)."""
    page = await fetch_page(
        "locale_approvals",
        [("locale", "==", locale), ("status", "==", "pending")],
        order_field="key",
        descending=False,
        cursor=cursor,
        page_size=limit,
    )
    return {"data": page["items"], "nextCursor": page["nextCursor"]}


@router.post("/locale-approvals")
async def set_locale_approval(
    body: LocaleApprovalIn,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    user: dict = Depends(admin_action("LOCALE_APPROVAL")),
):
    if body.action not in ("approve", "reject"):
        _error(422, "VALIDATION_ERROR", "action must be approve or reject")
    doc_id = f"{body.locale}__{body.key}"
    doc = await get_doc("locale_approvals", doc_id)
    if doc is None:
        _error(404, "DRAFT_NOT_FOUND", "no draft for that locale/key")
    now = datetime.now(timezone.utc).isoformat()
    doc["status"] = "approved" if body.action == "approve" else "rejected"
    doc["reviewedBy"] = user["uid"]
    doc["reviewedAt"] = now
    await set_doc("locale_approvals", doc_id, doc)
    return {
        "locale": body.locale,
        "key": body.key,
        "status": doc["status"],
        "reviewedBy": user["uid"],
        "reviewedAt": now,
    }


# ===========================================================================
# WS-01 — Foundation: audit feed, maker-checker, MPIN re-entry
# ===========================================================================
@router.get("/audit")
async def get_audit_log(
    targetId: Optional[str] = Query(None),
    module: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_admin_user),
):
    """Newest-first admin audit trail, optionally filtered by target or module."""
    docs = await query("audit_logs", [], limit=5000)
    if targetId:
        docs = [d for d in docs if d.get("targetId") == targetId]
    if module:
        docs = [d for d in docs if d.get("module") == module]
    docs.sort(key=lambda d: d.get("timestamp") or "", reverse=True)
    start = (page - 1) * pageSize
    return {
        "data": docs[start : start + pageSize],
        "total": len(docs),
        "page": page,
        "pageSize": pageSize,
    }


@router.get("/approvals")
async def list_approvals(
    status: str = Query("pending"),
    user: dict = Depends(current_admin_user),
):
    """Maker-checker queue: pending (or decided) approval requests."""
    return {"data": await approvals.list_approvals(status)}


@router.post("/approvals/{approval_id}/approve")
async def approve_action(
    approval_id: str,
    ctx: dict = Depends(admin_mutation_context),
):
    try:
        doc = await approvals.approve(approval_id, ctx["admin"], ctx["reason"], ctx["ip"])
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, dict) else {}
        _error(exc.status_code, detail.get("code", "ERROR"), detail.get("message", "error"))
    return {"success": True, "approval": doc}


@router.post("/approvals/{approval_id}/reject")
async def reject_action(
    approval_id: str,
    ctx: dict = Depends(admin_mutation_context),
):
    try:
        doc = await approvals.reject(approval_id, ctx["admin"], ctx["reason"], ctx["ip"])
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, dict) else {}
        _error(exc.status_code, detail.get("code", "ERROR"), detail.get("message", "error"))
    return {"success": True, "approval": doc}


class MpinVerifyIn(BaseModel):
    mpin: str = Field(..., min_length=4, max_length=6)


@router.post("/verify-mpin")
async def verify_admin_mpin(body: MpinVerifyIn, user: dict = Depends(current_admin_user)):
    """Two-step safeguard: re-verify the acting admin's MPIN before a
    destructive action (ban, refund, payout release, override)."""
    from app.core.security import verify_mpin

    record = await get_user(user.get("id") or user["uid"])
    stored = (record or {}).get("mpinHash")
    if not stored or not verify_mpin(body.mpin, stored):
        _error(403, "INVALID_MPIN", "अमान्य MPIN")
    return {"ok": True}


@router.get("/platform-config/ai")
async def get_platform_ai_config(user: dict = Depends(require_admin_role("superadmin"))):
    """Current `platform_config/ai` (question-set thresholds + automation)."""
    from app.services.ai.config_store import get_ai_config

    return await get_ai_config(force=True)


class AiConfigIn(BaseModel):
    config: dict = Field(default_factory=dict)


@router.put("/platform-config/ai")
async def put_platform_ai_config(
    body: AiConfigIn,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin")),
):
    from app.services.ai.config import validate_ai_config

    try:
        validate_ai_config(body.config)
    except ValueError:
        _error(422, "AI_AUTOMATION_LEVEL_FORBIDDEN", "automation level is not permitted")
    payload = {"config": body.config}
    pending = await approvals.maybe_require_approval(
        ctx["admin"], "ai-config", "update", payload, ctx["reason"], force=True
    )
    if pending is not None:
        return {"success": True, "requiresApproval": True, "approval": pending}
    previous = await get_doc("platform_config", "ai")
    await set_doc("platform_config", "ai", body.config)
    from app.services.ai import config_store

    config_store.clear_cache()
    await log_admin_action(ctx["admin"], "ai-config", "update", "platform_config/ai", previous, body.config, ctx["reason"], ctx["ip"])
    return {"success": True, "config": body.config}


async def _exec_ai_config(approval: dict, approver: dict) -> None:
    from app.services.ai import config_store

    await set_doc("platform_config", "ai", (approval.get("payload") or {}).get("config") or {})
    config_store.clear_cache()


approvals.register_executor("ai-config", "update", _exec_ai_config)


@router.get("/ai/health")
async def get_ai_health(
    user: dict = Depends(
        require_admin_role(
            "superadmin", "compliance_officer", "finance_admin",
            "agronomist", "operations_lead", "content_moderator",
        )
    ),
):
    docs = await query("ai_calibration", None, limit=500)
    docs.sort(key=lambda d: d.get("week") or "", reverse=True)
    latest = docs[0] if docs else {}
    previous = docs[1] if len(docs) > 1 else {}
    prev_metrics = previous.get("metrics") or {}
    rows = []
    for qs, metric in (latest.get("metrics") or {}).items():
        prev = prev_metrics.get(qs) or {}
        rows.append(
            {
                **metric,
                "trendVsPreviousWeek": round(float(metric.get("accuracy") or 0) - float(prev.get("accuracy") or 0), 3),
                "regressionAlert": bool(metric.get("regressionAlert")),
            }
        )
    golden: list[str] = []
    try:
        from pathlib import Path

        golden_dir = Path(__file__).resolve().parents[2] / "tests" / "fixtures" / "ai" / "golden"
        golden = sorted(p.name for p in golden_dir.glob("*") if p.is_file())
    except Exception:  # noqa: BLE001 — fixtures are optional at runtime
        golden = []
    return {"week": latest.get("week"), "metrics": rows, "goldenSets": golden}



# ===========================================================================
# WS-02 — P1 security modules (sessions, config, broadcast, moderation, DPDP)
# ===========================================================================
@router.get("/users/{uid}/role-profiles")
async def get_role_profiles(
    uid: str, user: dict = Depends(require_admin_role("superadmin", "operations_lead"))
):
    docs = await query(f"users/{uid}/role_profiles", [], limit=100)
    return {"data": docs, "total": len(docs)}


@router.get("/auth/users")
async def list_auth_users(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_admin_role("superadmin", "compliance_officer")),
):
    tokens = await query("auth_tokens", [], limit=2000)
    sessions = await query("sessions", [], limit=2000)
    rows = []
    for t in tokens:
        rows.append({
            "uid": t.get("userId") or t.get("uid"),
            "kind": "token",
            "lastLoginAt": t.get("createdAt"),
            "ip": t.get("ip") or t.get("ipAddress"),
            "revoked": bool(t.get("revoked")),
        })
    for s in sessions:
        rows.append({
            "uid": s.get("userId") or s.get("uid"),
            "kind": "session",
            "lastLoginAt": s.get("createdAt") or s.get("lastSeenAt"),
            "ip": s.get("ip"),
            "revoked": bool(s.get("revoked")),
        })
    rows.sort(key=lambda r: r.get("lastLoginAt") or "", reverse=True)
    start = (page - 1) * pageSize
    return {"data": rows[start : start + pageSize], "total": len(rows), "page": page, "pageSize": pageSize}


@router.post("/auth/users/{uid}/reset-mpin")
async def admin_reset_mpin(
    uid: str,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "compliance_officer")),
):
    target = await get_user(uid)
    if not target:
        _error(404, "NOT_FOUND", "user not found")
    otp = f"{random.randint(0, 999999):06d}"
    target["mpinResetOtp"] = otp
    target["mpinResetIssuedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("users", uid, target)
    await log_admin_action(
        ctx["admin"], "sessions", "reset-mpin", uid,
        {"mpinHash": bool(target.get("mpinHash"))}, {"otpIssued": True}, ctx["reason"], ctx["ip"],
    )
    return {"success": True, "uid": uid, "otp": otp}


@router.post("/auth/users/{uid}/revoke-sessions")
async def admin_revoke_sessions(
    uid: str,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "compliance_officer")),
):
    from app.services.tokens import revoke_refresh_family

    tokens = await query("auth_tokens", [("userId", "==", uid)], limit=1000)
    revoked = 0
    for token in tokens:
        token_id = token.get("id") or token.get("jti")
        if not token_id:
            continue
        token["revoked"] = True
        await set_doc("auth_tokens", token_id, token)
        revoked += 1
    await revoke_refresh_family(uid)
    await log_admin_action(
        ctx["admin"], "sessions", "revoke-sessions", uid, None, {"revoked": revoked}, ctx["reason"], ctx["ip"],
    )
    return {"success": True, "uid": uid, "revoked": revoked}


@router.get("/feature-flags")
async def get_feature_flags(user: dict = Depends(require_admin_role("superadmin", "operations_lead"))):
    doc = await get_doc("app_config", "current") or {}
    return {"featureFlags": doc.get("featureFlags") or {}}


class FeatureFlagsIn(BaseModel):
    featureFlags: dict = Field(default_factory=dict)


@router.put("/feature-flags")
async def put_feature_flags(
    body: FeatureFlagsIn,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "operations_lead")),
):
    admin = ctx["admin"]
    doc = await get_doc("app_config", "current") or {}
    previous = {"featureFlags": doc.get("featureFlags") or {}}
    payload = {"featureFlags": body.featureFlags}
    pending = await approvals.maybe_require_approval(
        admin, "config", "feature-flags", payload, ctx["reason"], force=True
    )
    if pending is not None:
        return {"success": True, "requiresApproval": True, "approval": pending}
    doc["featureFlags"] = body.featureFlags
    await set_doc("app_config", "current", doc)
    await log_admin_action(admin, "config", "feature-flags", "app_config/current", previous, payload, ctx["reason"], ctx["ip"])
    return {"success": True, "featureFlags": body.featureFlags}


@router.get("/app-config")
async def get_admin_app_config(user: dict = Depends(require_admin_role("superadmin", "operations_lead"))):
    doc = await get_doc("app_config", "current") or {}
    return {
        "minSupportedVersion": doc.get("minSupportedVersion"),
        "forceUpdate": doc.get("forceUpdate", False),
        "maintenanceMode": doc.get("maintenanceMode", False),
        "featureFlags": doc.get("featureFlags") or {},
    }


class AppConfigIn(BaseModel):
    minSupportedVersion: str = Field(..., min_length=1)
    forceUpdate: bool = False
    maintenanceMode: bool = False
    featureFlags: dict = Field(default_factory=dict)


@router.put("/app-config")
async def put_admin_app_config(
    body: AppConfigIn,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "operations_lead")),
):
    admin = ctx["admin"]
    previous = await get_doc("app_config", "current") or {}
    payload = body.model_dump()
    pending = await approvals.maybe_require_approval(
        admin, "config", "app-config", payload, ctx["reason"], force=True
    )
    if pending is not None:
        return {"success": True, "requiresApproval": True, "approval": pending}
    await set_doc("app_config", "current", payload)
    await log_admin_action(admin, "config", "app-config", "app_config/current", previous, payload, ctx["reason"], ctx["ip"])
    return {"success": True, "appConfig": payload}


class BroadcastIn(BaseModel):
    segment: dict = Field(default_factory=dict)
    titleEn: str = Field(..., min_length=1)
    titleHi: str = Field(..., min_length=1)
    bodyEn: str = Field(..., min_length=1)
    bodyHi: str = Field(..., min_length=1)


@router.post("/broadcasts")
async def create_broadcast(
    body: BroadcastIn,
    ctx: dict = Depends(admin_mutation_context),
    _role: dict = Depends(require_admin_role("superadmin", "operations_lead")),
):
    admin = ctx["admin"]
    broadcast_id = f"bc_{uuid.uuid4().hex[:12]}"
    doc = {
        "id": broadcast_id,
        "segment": body.segment,
        "titleEn": body.titleEn,
        "titleHi": body.titleHi,
        "bodyEn": body.bodyEn,
        "bodyHi": body.bodyHi,
        "status": "sent",
        "createdBy": admin.get("id") or admin.get("uid"),
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc("broadcasts", broadcast_id, doc)
    await log_admin_action(admin, "broadcasts", "create", broadcast_id, None, doc, ctx["reason"], ctx["ip"])
    return {"success": True, "broadcast": doc}


@router.get("/moderation/queue")
async def moderation_queue(user: dict = Depends(current_admin_user)):
    user_reports = await query("user_reports", [], limit=500)
    ugc_flags = await query("moderation_queue", [("status", "==", "open")], limit=500)
    fraud_holds = await query("fraud_queue", [("status", "==", "open")], limit=500)
    return {"userReports": user_reports, "ugcFlags": ugc_flags, "fraudHolds": fraud_holds}


class ModerationActionIn(BaseModel):
    action: str = Field(..., description="dismiss | warn | suspend")
    targetUid: Optional[str] = None


@router.post("/moderation/{item_id}/action")
async def moderation_action(
    item_id: str,
    body: ModerationActionIn,
    ctx: dict = Depends(admin_mutation_context),
):
    if body.action not in ("dismiss", "warn", "suspend"):
        _error(422, "VALIDATION_ERROR", "action must be dismiss, warn or suspend")
    admin = ctx["admin"]
    if body.action == "suspend" and body.targetUid:
        target = await get_user(body.targetUid)
        if target is not None:
            target["status"] = "suspended"
            target["statusReason"] = ctx["reason"]
            await set_doc("users", body.targetUid, target)
    await log_admin_action(
        admin, "moderation", body.action, item_id, None, {"action": body.action, "targetUid": body.targetUid}, ctx["reason"], ctx["ip"]
    )
    return {"success": True, "action": body.action}


@router.get("/consents/{uid}")
async def get_admin_consents(
    uid: str, user: dict = Depends(require_admin_role("superadmin", "compliance_officer"))
):
    from app.services import consents as consents_service

    current = await consents_service.get_consents(uid)
    timeline = await query("consent_log", [("userId", "==", uid)], limit=500)
    timeline.sort(key=lambda d: d.get("at") or "", reverse=True)
    export_requests = await query("data_export_requests", [("userId", "==", uid)], limit=50)
    deletion_requests = await query("deletion_requests", [("userId", "==", uid)], limit=50)
    return {
        "current": current,
        "timeline": timeline,
        "exportRequests": export_requests,
        "deletionRequests": deletion_requests,
    }


# Config approval executors — applied only after a second admin approves.
async def _exec_feature_flags(approval: dict, approver: dict) -> None:
    doc = await get_doc("app_config", "current") or {}
    doc["featureFlags"] = (approval.get("payload") or {}).get("featureFlags") or {}
    await set_doc("app_config", "current", doc)


async def _exec_app_config(approval: dict, approver: dict) -> None:
    await set_doc("app_config", "current", approval.get("payload") or {})


approvals.register_executor("config", "feature-flags", _exec_feature_flags)
approvals.register_executor("config", "app-config", _exec_app_config)
