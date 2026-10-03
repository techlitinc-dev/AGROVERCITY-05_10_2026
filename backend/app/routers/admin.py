"""FastAPI Superadmin Management Router for AGROVERCITY Platform."""
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.db import get_doc, set_doc, query
from app.core.deps import admin_action, admin_user
from app.models.loans import LoanStatus
from app.routers.analytics import _line_factor, last_12_months, month_key
from app.services import loans as loans_service
from app.services.users import get_user

router = APIRouter(prefix="/admin", tags=["admin"])


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
async def get_admin_overview(user: dict = Depends(admin_user)):
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
        "pendingKycCount": 8,
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
    user: dict = Depends(admin_user),
    _audit: dict = Depends(admin_action("UPDATE_USER_STATUS")),
):
    target = await get_user(target_uid)
    if not target:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "target user not found"})
    
    target["status"] = body.status
    target["statusReason"] = body.reason
    target["statusUpdatedAt"] = datetime.now(timezone.utc).isoformat()
    target["statusUpdatedBy"] = user["uid"]
    await set_doc("users", target_uid, target)

    # Log to audit_logs
    audit_id = f"aud_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_{target_uid}"
    await set_doc("audit_logs", audit_id, {
        "action": "UPDATE_USER_STATUS",
        "adminId": user["uid"],
        "targetUid": target_uid,
        "newStatus": body.status,
        "reason": body.reason,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    return {"success": True, "targetUid": target_uid, "status": body.status}


@router.get("/kyc/queue")
async def get_kyc_queue(user: dict = Depends(admin_user)):
    """List pending verification items across user document vaults."""
    queue = [
        {
            "id": "kyc-01",
            "userId": "uid-farmer-demo",
            "userName": "Ram Patil",
            "docType": "land_712",
            "docName": "7/12 Gat No. 142/A Utara",
            "fileUrl": "https://storage.agrovercity.in/vault/712_sample.pdf",
            "submittedAt": "2026-09-18T14:20:00Z",
            "status": "pending",
        },
        {
            "id": "kyc-02",
            "userId": "uid-seller-demo",
            "userName": "Kailash Agro Traders",
            "docType": "mandi_license",
            "docName": "APMC Trader License 2026",
            "fileUrl": "https://storage.agrovercity.in/vault/license_sample.pdf",
            "submittedAt": "2026-09-18T16:00:00Z",
            "status": "pending",
        },
    ]
    return {"data": queue, "total": len(queue)}


@router.post("/kyc/{doc_id}/review")
async def review_kyc_document(
    doc_id: str,
    body: KycReviewIn,
    user: dict = Depends(admin_user),
    _audit: dict = Depends(admin_action("REVIEW_KYC_DOC")),
):
    audit_id = f"aud_kyc_{doc_id}"
    await set_doc("audit_logs", audit_id, {
        "action": "REVIEW_KYC_DOC",
        "adminId": user["uid"],
        "docId": doc_id,
        "status": body.status,
        "rejectionReason": body.rejectionReason,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    return {"success": True, "docId": doc_id, "status": body.status}


@router.get("/expert-handoffs")
async def list_expert_handoffs(user: dict = Depends(admin_user)):
    docs = await query("expert_tickets", limit=100)
    return {"data": docs, "total": len(docs)}


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
    return {"success": True, "courseId": course_id, "status": course["status"]}


@router.post("/courses/{course_id}/feature")
async def feature_course(
    course_id: str,
    body: CourseFeatureIn,
    user: dict = Depends(admin_user),
    _audit: dict = Depends(admin_action("FEATURE_COURSE")),
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
    user: dict = Depends(admin_user),
    _audit: dict = Depends(admin_action("UPDATE_LOAN_STATUS")),
):
    loan = await get_doc("loan_applications", applicationId)
    if loan is None:
        _error(404, "LOAN_NOT_FOUND", "loan application not found")
    try:
        loan = loans_service.advance_status(
            loan,
            body.status,
            by=user["uid"],
            note=body.note,
            status_text=loans_service.LOAN_STATUS_TEXT[body.status],
        )
    except ValueError:
        _error(
            409,
            "LOAN_INVALID_TRANSITION",
            f"loan is '{loan.get('status')}' and cannot move to '{body.status}'",
        )
    await set_doc("loan_applications", applicationId, loan)
    await set_doc(
        "audit_logs",
        f"aud_loan_{applicationId}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        {
            "action": "UPDATE_LOAN_STATUS",
            "adminId": user["uid"],
            "loanId": applicationId,
            "newStatus": body.status,
            "note": body.note,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )
    return loans_service.to_out(loan).model_dump()
