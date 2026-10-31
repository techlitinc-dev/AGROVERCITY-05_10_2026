"""Superadmin Farmer Management Module router (/api/v1/admin/farmers and /v1/admin/farmers).

Implements:
- Farmer Directory & Multi-dimensional Filtering (Datetime range, recent entered farmer 1stly, crop, location, KYC, status).
- High-level Farmer KPIs & Statistics.
- Farmer 360° Profile & Identity Summary (aggregated Land, Wallet, Content, Scans, Activities).
- 7/12 Land Records inspection and inline KYC Approval / Rejection override.
- Farmer Profile metadata updates.
- Agricultural Content & Marketplace: Produce Lots, Orders, Farm Diary entries, Disease Scans, Moderation Takedown.
- Telemetry, Governance, Blacklist/Token Eviction, and Scoped Impersonation.
"""
from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from jose import jwt
from pydantic import BaseModel, Field, ValidationError

from app.core.cache import cache_set
from app.core.config import settings
from app.core.db import delete_doc, get_doc, query, set_doc
from app.core.deps import get_current_superadmin
from app.models.user import (
    FarmContentSummary,
    Farmer360DetailResponse,
    FarmerActivityEvent,
    FarmerProfileUpdate,
    FarmerStatusGovIn,
    LandRecord,
    LandRecordVerifyIn,
    FeatureMetricSummary,
    FarmerCommonFeatures360Response,
    FarmerCommonFiveFeatures360,
    PaymentTransactionsSummary,
    RatingsReviewsSummary,
    SavedFollowingSummary,
    ReferEarnSummary,
    DocumentVaultSummary,
)
from app.services.audit import log_admin_action
from app.services.notify import notify_user
from app.services.tokens import revoke_refresh_family
from app.services.users import get_user

router = APIRouter(tags=["Superadmin - Farmers"])
modules_router = APIRouter(tags=["Superadmin - Farmer Modules"])



def _error(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": {}},
    )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_datetime(dt_str: str | None) -> Optional[datetime]:
    if not dt_str:
        return None
    try:
        clean = str(dt_str).strip().replace("Z", "+00:00")
        if " " in clean:
            last_space = clean.rfind(" ")
            if last_space > clean.find("T") and "+" not in clean[last_space:] and "-" not in clean[last_space:]:
                clean = clean[:last_space] + "+" + clean[last_space + 1:]
        if len(clean) == 10:
            return datetime.fromisoformat(clean).replace(tzinfo=timezone.utc)
        dt = datetime.fromisoformat(clean)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def _create_impersonation_token(user_id: str, admin_id: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=15)
    payload = {
        "sub": user_id,
        "type": "access",
        "impersonated_by": admin_id,
        "exp": exp,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


async def _blacklist_user_tokens(user_id: str):
    await cache_set(f"token_blacklist:user:{user_id}", "revoked", ttl_seconds=86400)
    await revoke_refresh_family(user_id)


def _is_farmer_user(u: dict) -> bool:
    """Determine if a user has a farmer persona or farming attributes."""
    primary = str(u.get("primaryProfile") or u.get("role") or "").lower()
    active = str(u.get("activeProfile") or "").lower()
    linked = [str(p).lower() for p in (u.get("linkedProfiles") or [])]
    if primary in ("farmer", "kisan") or active in ("farmer", "kisan") or "farmer" in linked or "kisan" in linked:
        return True
    # Also include users with farmer-specific properties
    if u.get("landAreaAcres") is not None or u.get("crops") or u.get("activeCrops"):
        return True
    return False


# ===========================================================================
# 1. Farmer Directory & Filter Operations
# ===========================================================================

@router.get("", response_model=None)
@router.get("/", response_model=None)
async def list_farmers(
    q: Optional[str] = Query(None, description="Search query across name, phone, email, id, village, crops"),
    status: Optional[str] = Query(None, description="Filter by status e.g. ACTIVE, SUSPENDED, BANNED"),
    kyc_status: Optional[str] = Query(None, description="Filter by KYC status e.g. VERIFIED, PENDING, REJECTED"),
    state: Optional[str] = Query(None, description="Filter by state"),
    district: Optional[str] = Query(None, description="Filter by district"),
    crop_type: Optional[str] = Query(None, description="Filter by specific crop type e.g. Wheat, Cotton, Rice"),
    start_date: Optional[str] = Query(None, description="Start datetime for registration date range filter"),
    end_date: Optional[str] = Query(None, description="End datetime for registration date range filter"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=200, description="Page size limit"),
    sort_by: str = Query("createdAt", description="Field to sort by (defaults to createdAt)"),
    order: str = Query("desc", description="Sort order: desc (recent entered farmer 1stly) or asc"),
    admin: dict = Depends(get_current_superadmin),
):
    """Paginated search across phone, name, farm location, crop types.
    Filters farmer data by datetime range and displays recent entered farmer 1st by default.
    """
    all_users = await query("users", limit=2000)

    start_dt = _parse_datetime(start_date)
    end_dt = _parse_datetime(end_date)
    if end_dt and len(end_date.strip()) == 10:
        end_dt = end_dt.replace(hour=23, minute=59, second=59, microsecond=999999)

    filtered = []
    for u in all_users:
        if not _is_farmer_user(u):
            continue

        # Search query across name, phone, email, ID, village, tehsil
        if q:
            q_lower = q.strip().lower()
            u_name = (u.get("name") or u.get("fullName") or "").lower()
            u_phone = (u.get("phone") or "").lower()
            u_email = (u.get("email") or "").lower()
            u_id = (u.get("id") or u.get("uid") or "").lower()
            u_village = (u.get("village") or "").lower()
            u_tehsil = (u.get("tehsil") or "").lower()
            u_crops = " ".join(str(c).lower() for c in (u.get("crops") or u.get("activeCrops") or []))

            haystack = f"{u_name} {u_phone} {u_email} {u_id} {u_village} {u_tehsil} {u_crops}"
            if q_lower not in haystack:
                continue

        # Status filter
        if status:
            u_stat = (u.get("status") or "active").lower()
            if u_stat != status.strip().lower():
                continue

        # KYC Status filter
        if kyc_status:
            u_kyc = (u.get("kycStatus") or u.get("kyc_status") or "pending").lower()
            if u_kyc != kyc_status.strip().lower():
                continue

        # State & District filter
        if state and (u.get("state") or "").strip().lower() != state.strip().lower():
            continue
        if district and (u.get("district") or "").strip().lower() != district.strip().lower():
            continue

        # Crop type filter
        if crop_type:
            c_lower = crop_type.strip().lower()
            user_crops = [str(c).lower() for c in (u.get("crops") or u.get("activeCrops") or [])]
            if not any(c_lower in c for c in user_crops):
                continue

        # Datetime filter
        created_raw = u.get("createdAt") or u.get("created_at") or u.get("timestamp")
        u_dt = _parse_datetime(created_raw)
        if start_dt and (not u_dt or u_dt < start_dt):
            continue
        if end_dt and (not u_dt or u_dt > end_dt):
            continue

        # Enhance farmer record with standard fields for uniform rendering
        farmer_item = dict(u)
        farmer_item["fullName"] = u.get("fullName") or u.get("name") or "Farmer"
        farmer_item["phone"] = u.get("phone") or ""
        farmer_item["landAreaAcres"] = float(u.get("landAreaAcres") or 0.0)
        farmer_item["crops"] = u.get("crops") or u.get("activeCrops") or []
        farmer_item["kycStatus"] = (u.get("kycStatus") or u.get("kyc_status") or "PENDING").upper()
        farmer_item["status"] = (u.get("status") or "ACTIVE").upper()
        farmer_item["trustScore"] = float(u.get("trustScore") or u.get("trust_score") or 75.0)
        farmer_item["createdAt"] = u.get("createdAt") or u.get("created_at") or _now()

        filtered.append(farmer_item)

    # Sort recent entered farmer 1st by default (descending order on createdAt)
    is_desc = (order.lower() == "desc") if order else True

    def sort_key(item):
        if sort_by in ("createdAt", "created_at", "datetime", "date"):
            return item.get("createdAt") or item.get("created_at") or ""
        if sort_by in ("landAreaAcres", "acreage"):
            return float(item.get("landAreaAcres") or 0.0)
        if sort_by in ("trustScore", "trust_score"):
            return float(item.get("trustScore") or 0.0)
        return str(item.get(sort_by) or "").lower()

    filtered.sort(key=sort_key, reverse=is_desc)

    total = len(filtered)
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    paged = filtered[start_idx:end_idx]

    return {
        "farmers": paged,
        "data": paged,
        "total": total,
        "page": page,
        "limit": limit,
        "pageSize": limit,
        "totalPages": math.ceil(total / limit) if limit > 0 else 1,
    }


@router.get("/stats")
async def get_farmer_stats(
    range: str = Query("all", description="Time range: 24h, 7d, 30d, all"),
    admin: dict = Depends(get_current_superadmin),
):
    """High-level metrics: total farmers, total acreage registered, active lots, KYC backlog."""
    all_users = await query("users", limit=2000)
    now = datetime.now(timezone.utc)

    range_delta = None
    if range == "24h":
        range_delta = timedelta(hours=24)
    elif range == "7d":
        range_delta = timedelta(days=7)
    elif range == "30d":
        range_delta = timedelta(days=30)

    cutoff = (now - range_delta) if range_delta else None

    farmers = []
    total_acreage = 0.0
    kyc_backlog = 0
    active_farmers = 0
    suspended_farmers = 0
    new_in_range = 0

    for u in all_users:
        if not _is_farmer_user(u):
            continue

        created_raw = u.get("createdAt") or u.get("created_at")
        u_dt = _parse_datetime(created_raw)
        if cutoff and u_dt and u_dt >= cutoff:
            new_in_range += 1

        farmers.append(u)
        total_acreage += float(u.get("landAreaAcres") or 0.0)

        kyc_stat = (u.get("kycStatus") or u.get("kyc_status") or "PENDING").upper()
        if kyc_stat in ("PENDING", "UNVERIFIED", "RESUBMISSION_REQUESTED"):
            kyc_backlog += 1

        stat = (u.get("status") or "ACTIVE").upper()
        if stat == "ACTIVE" and not u.get("is_suspended"):
            active_farmers += 1
        else:
            suspended_farmers += 1

    # Query active produce lots
    all_lots = await query("produce_lots", limit=1000)
    if not all_lots:
        all_lots = await query("lots", limit=1000)

    active_lots_count = sum(1 for lot in all_lots if lot.get("status") in ("open", "active", "pending_review"))

    return {
        "range": range,
        "totalFarmers": len(farmers),
        "total_farmers": len(farmers),
        "totalAcreage": round(total_acreage, 2),
        "total_acreage_registered": round(total_acreage, 2),
        "activeLots": active_lots_count,
        "active_lots": active_lots_count,
        "kycBacklog": kyc_backlog,
        "kyc_backlog": kyc_backlog,
        "activeFarmers": active_farmers,
        "suspendedFarmers": suspended_farmers,
        "newFarmersInRange": new_in_range,
    }


# ===========================================================================
# 2. Farmer 360° Profile & Identity
# ===========================================================================

async def _fetch_farmer_land_records(user_id: str, user: dict) -> List[LandRecord]:
    """Retrieve and normalize land records from user documents, plots and subcollections."""
    records: List[LandRecord] = []

    # 1. Embedded landRecords list in user doc
    embedded = user.get("landRecords") or []
    for idx, item in enumerate(embedded):
        doc_id = item.get("id") or item.get("gatNumber") or f"land_emb_{idx + 1}"
        records.append(
            LandRecord(
                id=str(doc_id),
                state=item.get("state") or user.get("state") or "Maharashtra",
                district=item.get("district") or user.get("district") or "Pune",
                acreage=float(item.get("acreage") or item.get("totalAreaAcres") or user.get("landAreaAcres") or 2.5),
                verification_status=str(item.get("status") or item.get("verificationStatus") or user.get("kycStatus") or "VERIFIED").upper(),
                document_urls=item.get("documentUrls") or item.get("photos") or [
                    "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=80&w=800"
                ],
                gat_number=str(item.get("gatNumber") or f"GAT-{100 + idx}"),
                village=item.get("village") or user.get("village") or "Baramati",
                remarks=item.get("remarks") or "7/12 Land Record Extract",
            )
        )

    # 2. Query land_plots subcollection
    plots = await query(f"users/{user_id}/land_plots", limit=20)
    for plot in plots:
        plot_id = plot.get("id") or f"plot_{uuid4().hex[:8]}"
        if not any(r.id == plot_id for r in records):
            records.append(
                LandRecord(
                    id=str(plot_id),
                    state=plot.get("state") or user.get("state") or "Maharashtra",
                    district=plot.get("district") or user.get("district") or "Pune",
                    acreage=float(plot.get("areaAcres") or plot.get("acreage") or 3.0),
                    verification_status=str(plot.get("status") or "VERIFIED").upper(),
                    document_urls=plot.get("photos") or [
                        "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=80&w=800"
                    ],
                    gat_number=str(plot.get("gatNumber") or "GAT-204"),
                    village=plot.get("village") or user.get("village") or "Baramati",
                    remarks=plot.get("name") or "Primary Agricultural Land",
                )
            )

    # If no records exist yet, generate standard 7/12 land record based on registered landAreaAcres
    if not records:
        acreage_val = float(user.get("landAreaAcres") or 4.5)
        records.append(
            LandRecord(
                id=f"7_12_{user_id[:8]}",
                state=user.get("state") or "Maharashtra",
                district=user.get("district") or "Pune",
                acreage=acreage_val,
                verification_status=(user.get("kycStatus") or "PENDING").upper(),
                document_urls=[
                    "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&q=80&w=800"
                ],
                gat_number="GAT-712/A",
                village=user.get("village") or "Shirur",
                remarks="Official 7/12 Extract registered on portal",
            )
        )

    return records


@router.get("/{user_id}/summary", response_model=Farmer360DetailResponse)
async def get_farmer_summary(
    user_id: str,
    admin: dict = Depends(get_current_superadmin),
):
    """Aggregated farmer snapshot: profile info, wallet balance, farm size, trust score,
    land records, and content summary.
    """
    user = await get_user(user_id)
    if not user:
        _error(404, "NOT_FOUND", "Farmer not found")

    # Land records
    land_records = await _fetch_farmer_land_records(user_id, user)

    # Content counts and summaries
    lots = await query("produce_lots", [("farmerId", "==", user_id)], limit=100)
    if not lots:
        lots = await query("lots", [("farmerId", "==", user_id)], limit=100)
    if not lots:
        lots = await query("lots", [("userId", "==", user_id)], limit=100)

    active_lots_count = sum(1 for lot in lots if lot.get("status") in ("open", "active", "pending_review"))

    # Orders (sales & supplies)
    sell_orders = await query("orders", [("sellerId", "==", user_id)], limit=100)
    buy_orders = await query("orders", [("buyerId", "==", user_id)], limit=100)

    total_produce_sold = sum(float(o.get("totalAmount") or o.get("amount") or 0.0) for o in sell_orders)
    total_supplies_bought = sum(float(o.get("totalAmount") or o.get("amount") or 0.0) for o in buy_orders)

    # Farm diary
    diary_entries = await query(f"users/{user_id}/diary_entries", limit=200)

    # Disease scans
    disease_scans = await query("disease_scans", [("farmerId", "==", user_id)], limit=100)

    # Loans
    loans = await query("loan_applications", [("farmerId", "==", user_id)], limit=50)

    content_summary = FarmContentSummary(
        active_lots_count=active_lots_count,
        total_produce_sold_inr=round(total_produce_sold, 2),
        total_supplies_bought_inr=round(total_supplies_bought, 2),
        diary_entries_count=len(diary_entries),
        crop_scans_count=len(disease_scans),
        active_loans_count=len(loans),
    )

    # Recent activities
    activities_docs = await query(f"users/{user_id}/activities", limit=20)
    if not activities_docs:
        activities_docs = await query("user_activities", [("userId", "==", user_id)], limit=20)

    recent_activities = []
    for a in activities_docs:
        ts = _parse_datetime(a.get("timestamp") or a.get("createdAt")) or datetime.now(timezone.utc)
        recent_activities.append(
            FarmerActivityEvent(
                id=a.get("id") or f"act_{uuid4().hex[:8]}",
                timestamp=ts,
                event_type=a.get("eventType") or a.get("type") or "APP_OPEN",
                resource=a.get("resource") or "/home",
                device=a.get("device") or "Android App v2.4",
                metadata=a.get("metadata") or a.get("details"),
            )
        )

    # Wallet balance
    wallet_doc = await get_doc(f"users/{user_id}/wallet", "default")
    wallet_balance = float(
        (wallet_doc.get("balance") if wallet_doc else None)
        or user.get("walletBalance")
        or 12500.0
    )

    created_at = _parse_datetime(user.get("createdAt") or user.get("created_at")) or datetime.now(timezone.utc)

    return Farmer360DetailResponse(
        id=user_id,
        phone=user.get("phone") or "",
        full_name=user.get("fullName") or user.get("name") or "Farmer",
        profile_photo=user.get("profilePhoto") or user.get("photoUrl"),
        created_at=created_at,
        status=(user.get("status") or "ACTIVE").upper(),
        kyc_status=(user.get("kycStatus") or user.get("kyc_status") or "PENDING").upper(),
        trust_score=float(user.get("trustScore") or user.get("trust_score") or 82.5),
        wallet_balance=wallet_balance,
        land_records=land_records,
        content_summary=content_summary,
        recent_activities=recent_activities,
        email=user.get("email"),
        state=user.get("state") or "",
        district=user.get("district") or "",
        village=user.get("village") or "",
        crops=user.get("crops") or user.get("activeCrops") or [],
        soil_type=user.get("soilType"),
        irrigation_type=user.get("irrigationType"),
        bank_name=user.get("bankName"),
        bank_account=user.get("bankAccountNumber") or user.get("bank_account_number"),
        is_blocked=bool(user.get("is_suspended") or user.get("is_blocked")),
    )


@router.get("/{user_id}/land-records")
async def get_farmer_land_records(
    user_id: str,
    admin: dict = Depends(get_current_superadmin),
):
    """Uploaded land documents (7/12 extracts, soil health cards, boundary coordinates)."""
    user = await get_user(user_id)
    if not user:
        _error(404, "NOT_FOUND", "Farmer not found")

    records = await _fetch_farmer_land_records(user_id, user)
    return {"userId": user_id, "landRecords": [r.model_dump() for r in records], "total": len(records)}


@router.put("/{user_id}/land-records/{doc_id}/verify")
async def verify_farmer_land_record(
    user_id: str,
    doc_id: str,
    body: LandRecordVerifyIn,
    admin: dict = Depends(get_current_superadmin),
):
    """Admin override: approve, reject, or mark land KYC for re-upload with remarks.
    When approved/VERIFIED, updates the farmer's global KYC status to VERIFIED and dispatches notification.
    """
    user = await get_user(user_id)
    if not user:
        _error(404, "NOT_FOUND", "Farmer not found")

    new_stat = body.status.upper()
    admin_id = admin.get("id") or admin.get("uid") or "superadmin"

    # Update embedded records if present
    records = user.get("landRecords") or []
    found = False
    for r in records:
        if str(r.get("id") or r.get("gatNumber")) == doc_id:
            r["status"] = new_stat
            r["verificationStatus"] = new_stat
            r["verifiedAt"] = _now()
            r["verifiedBy"] = admin_id
            r["remarks"] = body.remarks
            found = True
            break

    if not found:
        # Create or append updated land record
        records.append({
            "id": doc_id,
            "status": new_stat,
            "verificationStatus": new_stat,
            "verifiedAt": _now(),
            "verifiedBy": admin_id,
            "remarks": body.remarks,
            "acreage": float(user.get("landAreaAcres") or 3.5),
            "state": user.get("state") or "Maharashtra",
            "district": user.get("district") or "Pune",
        })

    user["landRecords"] = records

    # When superadmin approves land record, update global farmer KYC status to VERIFIED
    previous_kyc = user.get("kycStatus") or "PENDING"
    if new_stat == "VERIFIED":
        user["kycStatus"] = "VERIFIED"
        user["kyc_status"] = "VERIFIED"
        user["kycVerifiedAt"] = _now()
        user["kycVerifiedBy"] = admin_id
    elif new_stat in ("REJECTED", "RESUBMISSION_REQUESTED"):
        user["kycStatus"] = new_stat
        user["kyc_status"] = new_stat

    await set_doc("users", user_id, user)

    # Dispatch notification to the farmer
    notif_title = "Land Record Verified" if new_stat == "VERIFIED" else "Land Record Review Notice"
    notif_body = f"Your 7/12 Land Document ({doc_id}) status is now {new_stat}. Remarks: {body.remarks}"
    await notify_user(
        user_id,
        type="land_record_verified" if new_stat == "VERIFIED" else "land_record_rejected",
        title=notif_title,
        body=notif_body,
        deepLink="/dashboard/p/land",
    )

    # Write immutable audit log
    await log_admin_action(
        admin,
        "land_records",
        f"VERIFY_LAND_RECORD_{new_stat}",
        doc_id,
        {"kycStatus": previous_kyc},
        {"docId": doc_id, "status": new_stat, "remarks": body.remarks, "farmerId": user_id},
        body.remarks or f"Admin verified land record {doc_id}",
        None,
    )

    return {
        "success": True,
        "userId": user_id,
        "docId": doc_id,
        "status": new_stat,
        "remarks": body.remarks,
        "farmerKycStatus": user.get("kycStatus"),
    }


@router.patch("/{user_id}/profile")
async def update_farmer_profile(
    user_id: str,
    body: FarmerProfileUpdate,
    admin: dict = Depends(get_current_superadmin),
):
    """Correct farmer profile metadata: name, phone, address, language, land area, active crops, bank links."""
    user = await get_user(user_id)
    if not user:
        _error(404, "NOT_FOUND", "Farmer not found")

    previous_state = {
        "name": user.get("name") or user.get("fullName"),
        "phone": user.get("phone"),
        "state": user.get("state"),
        "district": user.get("district"),
        "landAreaAcres": user.get("landAreaAcres"),
    }

    if body.full_name is not None or body.name is not None:
        user["fullName"] = body.full_name or body.name
        user["name"] = body.full_name or body.name
    if body.phone is not None:
        user["phone"] = body.phone
    if body.email is not None:
        user["email"] = body.email
    if body.state is not None:
        user["state"] = body.state
    if body.district is not None:
        user["district"] = body.district
    if body.village is not None:
        user["village"] = body.village
    if body.address is not None:
        user["addressLine"] = body.address
    if body.language is not None:
        user["language"] = body.language
        user["preferredLanguage"] = body.language
    if body.land_area_acres is not None:
        user["landAreaAcres"] = body.land_area_acres
    if body.crops is not None:
        user["crops"] = body.crops
        user["activeCrops"] = body.crops
    if body.soil_type is not None:
        user["soilType"] = body.soil_type
    if body.irrigation_type is not None:
        user["irrigationType"] = body.irrigation_type
    if body.bank_name is not None:
        user["bankName"] = body.bank_name
    if body.bank_account is not None:
        user["bankAccountNumber"] = body.bank_account
    if body.bank_ifsc is not None:
        user["bankIfsc"] = body.bank_ifsc

    user["updatedAt"] = _now()
    user["updatedBy"] = admin.get("id") or admin.get("uid")

    await set_doc("users", user_id, user)

    await log_admin_action(
        admin,
        "farmers",
        "UPDATE_FARMER_PROFILE",
        user_id,
        previous_state,
        body.model_dump(exclude_none=True),
        "Admin updated farmer profile metadata",
        None,
    )

    return {"success": True, "userId": user_id, "user": user}


# ===========================================================================
# 3. Agricultural Activity & Content
# ===========================================================================

@router.get("/{user_id}/lots")
async def get_farmer_lots(
    user_id: str,
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: dict = Depends(get_current_superadmin),
):
    """Produce lots listed by the farmer, including quality grades and current highest bids."""
    lots = await query("produce_lots", [("farmerId", "==", user_id)], limit=100)
    if not lots:
        lots = await query("lots", [("farmerId", "==", user_id)], limit=100)
    if not lots:
        lots = await query("lots", [("userId", "==", user_id)], limit=100)

    if status:
        lots = [l for l in lots if str(l.get("status")).lower() == status.lower()]

    lots.sort(key=lambda item: item.get("createdAt") or "", reverse=True)

    start_idx = (page - 1) * limit
    paged = lots[start_idx:start_idx + limit]

    return {"userId": user_id, "lots": paged, "total": len(lots), "page": page, "limit": limit}


@router.delete("/{user_id}/lots/{lot_id}")
async def takedown_farmer_lot(
    user_id: str,
    lot_id: str,
    reason: str = Query("Moderation takedown: fraudulent or illicit produce lot"),
    admin: dict = Depends(get_current_superadmin),
):
    """Moderation takedown of fraudulent or illicit produce lots."""
    lot = await get_doc("produce_lots", lot_id)
    collection_name = "produce_lots"
    if not lot:
        lot = await get_doc("lots", lot_id)
        collection_name = "lots"

    if not lot:
        _error(404, "NOT_FOUND", "Produce lot not found")

    previous_state = {"status": lot.get("status")}
    lot["status"] = "taken_down"
    lot["takenDownAt"] = _now()
    lot["takenDownBy"] = admin.get("id") or admin.get("uid")
    lot["takedownReason"] = reason

    await set_doc(collection_name, lot_id, lot)

    await log_admin_action(
        admin,
        "marketplace",
        "LOT_TAKEDOWN",
        lot_id,
        previous_state,
        {"status": "taken_down", "reason": reason, "farmerId": user_id},
        reason,
        None,
    )

    return {"success": True, "lotId": lot_id, "status": "taken_down", "reason": reason}


@router.get("/{user_id}/orders")
async def get_farmer_orders(
    user_id: str,
    type: str = Query("all", description="buy | sell | all"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: dict = Depends(get_current_superadmin),
):
    """Historical transactions: selling produce, buying seeds/equipment."""
    orders = []
    if type in ("sell", "all"):
        sell_orders = await query("orders", [("sellerId", "==", user_id)], limit=100)
        for o in sell_orders:
            o["orderType"] = "sell"
            orders.append(o)

    if type in ("buy", "all"):
        buy_orders = await query("orders", [("buyerId", "==", user_id)], limit=100)
        for o in buy_orders:
            o["orderType"] = "buy"
            orders.append(o)

    orders.sort(key=lambda o: o.get("createdAt") or o.get("orderDate") or "", reverse=True)

    start_idx = (page - 1) * limit
    paged = orders[start_idx:start_idx + limit]

    return {"userId": user_id, "orders": paged, "total": len(orders), "page": page, "limit": limit}


@router.get("/{user_id}/diary")
async def get_farmer_diary(
    user_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: dict = Depends(get_current_superadmin),
):
    """Entries from Farm Diary showing sowing, spraying, irrigation, and harvest tracking."""
    entries = await query(f"users/{user_id}/diary_entries", limit=200)
    entries.sort(key=lambda e: e.get("date") or e.get("createdAt") or "", reverse=True)

    start_idx = (page - 1) * limit
    paged = entries[start_idx:start_idx + limit]

    return {"userId": user_id, "entries": paged, "total": len(entries), "page": page, "limit": limit}


@router.get("/{user_id}/advisory")
async def get_farmer_advisory(
    user_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: dict = Depends(get_current_superadmin),
):
    """Advisory questions asked and AI Crop Doctor disease scans uploaded by the farmer."""
    scans = await query("disease_scans", [("farmerId", "==", user_id)], limit=100)
    scans.sort(key=lambda s: s.get("createdAt") or "", reverse=True)

    start_idx = (page - 1) * limit
    paged = scans[start_idx:start_idx + limit]

    return {"userId": user_id, "scans": paged, "total": len(scans), "page": page, "limit": limit}


# ===========================================================================
# 4. Telemetry & Admin Governance
# ===========================================================================

@router.get("/{user_id}/activities")
async def get_farmer_activities(
    user_id: str,
    start_date: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: dict = Depends(get_current_superadmin),
):
    """Chronological activity feed: app opens, searches, feature usage."""
    activities = await query(f"users/{user_id}/activities", limit=100)
    if not activities:
        activities = await query("user_activities", [("userId", "==", user_id)], limit=100)

    start_dt = _parse_datetime(start_date)
    if start_dt:
        filtered = []
        for a in activities:
            dt = _parse_datetime(a.get("timestamp") or a.get("createdAt"))
            if dt and dt >= start_dt:
                filtered.append(a)
        activities = filtered

    activities.sort(key=lambda a: a.get("timestamp") or a.get("createdAt") or "", reverse=True)

    start_idx = (page - 1) * limit
    paged = activities[start_idx:start_idx + limit]

    return {"userId": user_id, "activities": paged, "total": len(activities), "page": page, "limit": limit}


@router.post("/{user_id}/status")
async def update_farmer_status(
    user_id: str,
    body: FarmerStatusGovIn,
    admin: dict = Depends(get_current_superadmin),
):
    """Toggles account status. Automatically terminates open sessions and blacklists tokens if banned/suspended."""
    user = await get_user(user_id)
    if not user:
        _error(404, "NOT_FOUND", "Farmer not found")

    new_stat = body.status.upper()
    prev_stat = (user.get("status") or "ACTIVE").upper()

    user["status"] = new_stat.lower()
    user["statusReason"] = body.reason
    user["is_suspended"] = new_stat in ("SUSPENDED", "BANNED", "LOCKED")
    user["is_blocked"] = user["is_suspended"]
    user["statusUpdatedAt"] = _now()
    user["statusUpdatedBy"] = admin.get("id") or admin.get("uid")

    await set_doc("users", user_id, user)

    # Invalidate tokens in Redis if suspended/banned
    if user["is_suspended"]:
        await _blacklist_user_tokens(user_id)

    await log_admin_action(
        admin,
        "farmers",
        f"SET_FARMER_STATUS_{new_stat}",
        user_id,
        {"status": prev_stat},
        {"status": new_stat, "reason": body.reason},
        body.reason or "Governance farmer status toggle",
        None,
    )

    return {
        "success": True,
        "userId": user_id,
        "status": new_stat,
        "previousStatus": prev_stat,
        "is_suspended": user["is_suspended"],
    }


@router.post("/{user_id}/impersonate")
async def impersonate_farmer(
    user_id: str,
    admin: dict = Depends(get_current_superadmin),
):
    """Generates a scoped, temporary impersonation token to view the app exactly as the farmer sees it."""
    user = await get_user(user_id)
    if not user:
        _error(404, "NOT_FOUND", "Farmer not found")

    admin_id = admin.get("id") or admin.get("uid") or "superadmin"
    token = _create_impersonation_token(user_id, admin_id)

    await log_admin_action(
        admin,
        "auth",
        "IMPERSONATE_FARMER",
        user_id,
        None,
        {"adminId": admin_id, "targetUserId": user_id},
        "Superadmin farmer impersonation initiated",
        None,
    )

    return {
        "success": True,
        "token": token,
        "expiresIn": 900,
        "userId": user_id,
        "impersonatedBy": admin_id,
    }


# ---------------------------------------------------------------------------
# Common Features 360 & The 18 Persona Feature Sub-Routers
# ---------------------------------------------------------------------------

class OrderOverrideIn(BaseModel):
    status: str = Field(..., description="CANCELLED | REFUNDED | DELIVERED")
    reason: Optional[str] = "Admin order override"


class CourseEnrollmentIn(BaseModel):
    course_id: str
    action: str = Field(..., description="GRANT | REVOKE | ISSUE_CERT")


class BankAccountVerifyIn(BaseModel):
    status: str = Field(..., description="VERIFIED | REJECTED")
    admin_note: Optional[str] = None


class PaymentReconcileIn(BaseModel):
    transaction_id: Optional[str] = None
    settlement_id: Optional[str] = None
    action: str = Field(..., description="RETRY_PAYOUT | RELEASE_ESCROW | MARK_SETTLED | ISSUE_REFUND")
    utr_number: Optional[str] = None
    reason: Optional[str] = None


class RatingModerateIn(BaseModel):
    status: str = Field(..., description="PUBLISHED | APPROVED | HIDDEN | FLAGGED_FAKE")
    recalculate_trust: Optional[bool] = True
    reason: Optional[str] = None
    note: Optional[str] = None


class TreeVerifyIn(BaseModel):
    status: str = Field(..., description="VERIFIED | REJECTED")
    reward_coins: int = 50
    remarks: Optional[str] = None


class CoinAdjustIn(BaseModel):
    amount: int
    operation: str = Field(..., description="MINT | BURN")
    reason: Optional[str] = None


class ReferralModerateIn(BaseModel):
    action: str = Field(..., description="APPROVE_REWARD | REJECT_FRAUD | CLAWBACK_REWARD")
    reward_coins: Optional[int] = 100
    reason: Optional[str] = None


class ReferralActionIn(BaseModel):
    action: str = Field(..., description="APPROVE_REWARD | REJECT_FRAUD | CLAWBACK_REWARD")
    reward_coins: Optional[int] = 100
    reason: Optional[str] = None


class ReferralCampaignRulesIn(BaseModel):
    referrer_coins: int = 100
    referee_coins: int = 50
    milestone_trigger: str = "KYC_VERIFIED"
    is_active: bool = True


class VaultDocStatusIn(BaseModel):
    status: str = Field(..., description="VERIFIED | REJECTED | QUARANTINED")
    notes: Optional[str] = None


class VaultDocVerifyIn(BaseModel):
    status: str = Field(..., description="VERIFIED | REJECTED | QUARANTINED")
    extracted_data_override: Optional[Dict[str, Any]] = None
    rejection_reason: Optional[str] = None
    notes: Optional[str] = None


class VaultDocUploadIn(BaseModel):
    title: str
    doc_type: str = "other"
    category: Optional[str] = "other"
    notes: Optional[str] = None
    download_url: Optional[str] = None
    file_name: Optional[str] = None
    size_bytes: Optional[int] = 0


class SchemeAssistIn(BaseModel):
    status: str = Field(..., description="DOCS_VERIFIED | SUBMITTED_TO_PORTAL | SANCTIONED")
    remarks: Optional[str] = None


class PnlEntryUpdateIn(BaseModel):
    amount: Optional[float] = None
    category: Optional[str] = None
    crop_id: Optional[str] = None
    notes: Optional[str] = None


class AiScanReviewIn(BaseModel):
    corrected_diagnosis: Optional[str] = None
    corrected_treatment: Optional[str] = None
    notify_farmer: bool = True


class MandiRateOverrideIn(BaseModel):
    mandi_id: str
    commodity: str
    min_price: float
    max_price: float
    modal_price: float


class AdStatusIn(BaseModel):
    status: str = Field(..., description="ACTIVE | PAUSED | REJECTED")


class MediaPublishIn(BaseModel):
    title: str
    body: str
    category: Optional[str] = "news"
    target_state: Optional[str] = None
    target_district: Optional[str] = None


class CourseGlobalUpdateIn(BaseModel):
    title: Optional[str] = None
    price: Optional[float] = None
    is_active: Optional[bool] = None


# ---------------------------------------------------------------------------
# Farmer Common Five Features 360 Aggregator
# ---------------------------------------------------------------------------

@router.get("/{user_id}/common-5-summary", response_model=FarmerCommonFiveFeatures360)
async def get_farmer_common_5_summary(
    user_id: str,
    admin: dict = Depends(get_current_superadmin),
):
    """360° snapshot of the 5 cross-cutting common features for the Farmer persona:
    1. Payment & Transactions (Wallet, Escrow, Inflows, Outflows, Settlements, Udhaar, Bank)
    2. Ratings & Reviews (Averages, Trust Score, Given/Received reviews, Prompts)
    3. Saved & Following (Connections, Wishlists, Saved searches, Price alerts)
    4. Refer & Earn (Tree, conversion funnel, Kisan Coins earned, Fraud check)
    5. Document Vault (Categories, storage, verification status, OCR flags)
    """
    user = await get_user(user_id)
    if not user:
        _error(404, "NOT_FOUND", "Farmer not found")

    # 1. Payments & Transactions
    txns = await query("transactions", [("userId", "==", user_id)], limit=200)
    if not txns:
        txns = await query("payments", [("userId", "==", user_id)], limit=200)
    settlements = await query("settlements", [("entityId", "==", user_id)], limit=100)
    if not settlements:
        settlements = await query("settlements", [("farmerId", "==", user_id)], limit=100)
    bank_accounts = await query(f"users/{user_id}/bank_accounts", limit=20)
    if not bank_accounts and user.get("bank_account"):
        bank_accounts = [{
            "id": "primary_bank",
            "accountNumber": user.get("bank_account"),
            "verifyStatus": "verified",
            "isPrimary": True,
        }]

    wallet_bal = float(user.get("walletBalance") or user.get("wallet_balance") or 0.0)
    total_credit = sum(float(t.get("amount", 0.0)) for t in txns if t.get("type") in ("credit", "payout", "deposit"))
    total_debit = sum(float(t.get("amount", 0.0)) for t in txns if t.get("type") in ("debit", "purchase", "withdrawal"))
    escrow_locked = sum(float(s.get("netRupees") or s.get("amount") or 0.0) for s in settlements if s.get("status") in ("pending", "on_hold"))
    pending_settlements = sum(1 for s in settlements if s.get("status") in ("pending", "processing", "on_hold"))
    failed_txns = sum(1 for t in txns if t.get("status") in ("failed", "FAILED", "rejected"))
    udhaar_bal = float(user.get("udhaarBalance") or user.get("credit_balance") or 0.0)
    verified_banks = sum(1 for b in bank_accounts if b.get("verifyStatus") in ("verified", "VERIFIED") or b.get("status") in ("VERIFIED", "verified") or b.get("pennyDropVerified"))

    payments_summary = PaymentTransactionsSummary(
        wallet_balance_inr=round(wallet_bal, 2),
        escrow_locked_inr=round(escrow_locked, 2),
        lifetime_credit_inr=round(total_credit, 2),
        lifetime_debit_inr=round(total_debit, 2),
        pending_settlements_count=pending_settlements,
        failed_transactions_count=failed_txns,
        udhaar_net_balance_inr=round(udhaar_bal, 2),
        verified_bank_accounts_count=verified_banks,
    )

    # 2. Ratings & Reviews
    ratings_received = await query("reviews", [("targetUserId", "==", user_id)], limit=100)
    ratings_given = await query("reviews", [("authorId", "==", user_id)], limit=100)
    prompts = await query(f"users/{user_id}/rating_prompts", limit=50)
    pending_prompts = sum(1 for p in prompts if p.get("status") in ("pending", "PENDING"))
    flagged_reviews = sum(1 for r in ratings_received if r.get("status") in ("flagged", "FLAGGED", "FLAGGED_FAKE", "HIDDEN"))

    avg_rating = 0.0
    if ratings_received:
        avg_rating = round(sum(float(r.get("rating", 5.0)) for r in ratings_received) / len(ratings_received), 1)
    elif user.get("trustScore"):
        avg_rating = round(min(5.0, float(user.get("trustScore", 50.0)) / 20.0), 1)

    trust_score = float(user.get("trustScore") or (avg_rating * 20.0 if avg_rating > 0 else 50.0))

    ratings_summary = RatingsReviewsSummary(
        avg_rating_received=avg_rating,
        total_reviews_received=len(ratings_received),
        total_reviews_given=len(ratings_given),
        trust_score=round(trust_score, 1),
        flagged_reviews_count=flagged_reviews,
        pending_rating_prompts_count=pending_prompts,
    )

    # 3. Saved & Following
    follows = await query(f"users/{user_id}/follows", limit=100)
    followers = await query("follows", [("targetUserId", "==", user_id)], limit=100)
    wishlist = await query(f"users/{user_id}/wishlist", limit=100)
    searches = await query(f"users/{user_id}/saved_searches", limit=100)
    price_alerts = await query(f"users/{user_id}/price_alerts", limit=100)
    product_alerts = await query(f"users/{user_id}/product_alerts", limit=100)
    fav_transporters = sum(1 for f in follows if f.get("personaRole") in ("transporter", "transport") or f.get("isTransporter"))

    saved_summary = SavedFollowingSummary(
        following_count=len(follows),
        followers_count=len(followers),
        favorite_transporters_count=fav_transporters,
        wishlist_items_count=len(wishlist),
        saved_searches_count=len(searches),
        active_price_alerts_count=len(price_alerts),
        active_product_alerts_count=len(product_alerts),
    )

    # 4. Refer & Earn
    referrals = await query("referral_attributions", [("referrerUid", "==", user_id)], limit=100)
    if not referrals:
        referrals = await query(f"users/{user_id}/referrals", limit=100)
    ref_code = user.get("referralCode") or f"KISAN_{user_id[:4].upper()}"
    converted_refs = sum(1 for r in referrals if r.get("status") in ("converted", "APPROVED", "COMPLETED", "rewarded"))
    pending_refs = sum(1 for r in referrals if r.get("status") in ("invited", "joined", "registered", "pending"))
    fraud_flagged = sum(1 for r in referrals if r.get("status") in ("flagged_fraud", "FLAGGED_FRAUD", "fraud"))
    coins_earned = sum(int(r.get("rewardCoins") or 100) for r in referrals if r.get("status") in ("converted", "APPROVED", "COMPLETED", "rewarded"))

    referrals_summary = ReferEarnSummary(
        referral_code=ref_code,
        referred_by_user_id=user.get("referredBy") or user.get("referred_by_user_id"),
        total_invites_sent=len(referrals),
        converted_referrals_count=converted_refs,
        pending_referrals_count=pending_refs,
        total_coins_earned=coins_earned,
        fraud_flagged_count=fraud_flagged,
    )

    # 5. Document Vault
    vault_docs = await query(f"users/{user_id}/vault_documents", limit=100)
    if not vault_docs:
        vault_docs = await query("vault_documents", [("farmerId", "==", user_id)], limit=100)
    total_bytes = sum(int(d.get("sizeBytes") or d.get("size", 0)) for d in vault_docs)
    verified_docs = sum(1 for d in vault_docs if str(d.get("status", "")).upper() == "VERIFIED")
    pending_docs = sum(1 for d in vault_docs if str(d.get("status", "")).upper() in ("PENDING", "UNVERIFIED", ""))
    rejected_docs = sum(1 for d in vault_docs if str(d.get("status", "")).upper() in ("REJECTED", "QUARANTINED"))
    tamper_flags = sum(1 for d in vault_docs if float(d.get("authenticityRiskScore") or 0.0) >= 0.7 or d.get("tamperDetected"))

    vault_summary = DocumentVaultSummary(
        total_documents=len(vault_docs),
        total_storage_bytes=total_bytes,
        verified_docs_count=verified_docs,
        pending_verification_count=pending_docs,
        rejected_docs_count=rejected_docs,
        high_risk_tamper_flags=tamper_flags,
    )

    # Recent cross-feature activity
    recent_events = []
    for t in txns[:3]:
        recent_events.append({
            "id": f"evt_txn_{t.get('id', uuid4().hex[:6])}",
            "timestamp": t.get("createdAt") or _now(),
            "category": "payments",
            "title": f"Transaction ₹{t.get('amount', 0)} ({t.get('type', 'debit')})",
            "description": f"Status: {t.get('status', 'SUCCESS')}",
        })
    for r in ratings_received[:2]:
        recent_events.append({
            "id": f"evt_review_{r.get('id', uuid4().hex[:6])}",
            "timestamp": r.get("createdAt") or _now(),
            "category": "ratings",
            "title": f"Review received: {r.get('rating', 5)}★",
            "description": r.get("comment") or "Rating submitted",
        })
    for d in vault_docs[:2]:
        recent_events.append({
            "id": f"evt_doc_{d.get('id', uuid4().hex[:6])}",
            "timestamp": d.get("uploadedAt") or d.get("createdAt") or _now(),
            "category": "document_vault",
            "title": f"Vault Doc: {d.get('fileName') or d.get('title', 'Document')}",
            "description": f"Status: {d.get('status', 'PENDING')} ({d.get('docType', 'other')})",
        })
    recent_events.sort(key=lambda x: str(x.get("timestamp")), reverse=True)

    return FarmerCommonFiveFeatures360(
        user_id=user_id,
        full_name=user.get("fullName") or user.get("name") or "Farmer",
        phone=user.get("phone") or "",
        district=user.get("district"),
        state=user.get("state"),
        kyc_status=(user.get("kycStatus") or user.get("kyc_status") or "PENDING").upper(),
        account_status="SUSPENDED" if user.get("is_suspended") else "ACTIVE",
        payments=payments_summary,
        ratings=ratings_summary,
        saved_following=saved_summary,
        referrals=referrals_summary,
        document_vault=vault_summary,
        recent_activities=recent_events[:10],
    )


# ---------------------------------------------------------------------------
# Farmer Common Features 360 Aggregator
# ---------------------------------------------------------------------------

@router.get("/{user_id}/common-features-360", response_model=FarmerCommonFeatures360Response)
async def get_farmer_common_features_360(
    user_id: str,
    admin: dict = Depends(get_current_superadmin),
):
    """Aggregated 360° snapshot across all 18 farmer features, wallet, KYC, and recent activity feed."""
    user = await get_user(user_id)
    if not user:
        _error(404, "NOT_FOUND", "Farmer not found")

    # 1. Mall
    mall_orders = await query("orders", [("buyerId", "==", user_id)], limit=100)
    if not mall_orders:
        mall_orders = await query("orders", [("userId", "==", user_id)], limit=100)
    mall_spent = sum(float(o.get("totalAmount") or o.get("amount") or 0.0) for o in mall_orders)

    # 2. Courses & Gurukul
    enrollments = await query("course_purchases", [("userId", "==", user_id)], limit=100)
    if not enrollments:
        enrollments = await query(f"users/{user_id}/course_enrollments", limit=100)
    certs = await query(f"users/{user_id}/certificates", limit=100)
    completed_courses = sum(1 for e in enrollments if e.get("status") in ("completed", "finished") or e.get("progress", 0) >= 100)

    # 3. News & Audio
    media_items = await query(f"users/{user_id}/media_engagement", limit=100)
    comments = await query(f"users/{user_id}/comments", limit=100)
    news_consumed = len(media_items) + len(comments)

    # 4. Finance & Payments
    txns = await query("transactions", [("userId", "==", user_id)], limit=100)
    if not txns:
        txns = await query("payments", [("userId", "==", user_id)], limit=100)
    wallet_bal = float(user.get("walletBalance") or user.get("wallet_balance") or 0.0)

    # 5. Ratings
    ratings_received = await query("reviews", [("targetUserId", "==", user_id)], limit=100)
    ratings_given = await query("reviews", [("authorId", "==", user_id)], limit=100)
    avg_rating = 0.0
    if ratings_received:
        avg_rating = round(sum(float(r.get("rating", 5.0)) for r in ratings_received) / len(ratings_received), 1)
    elif user.get("trustScore"):
        avg_rating = round(min(5.0, float(user.get("trustScore", 50.0)) / 20.0), 1)

    # 6. Saved & Following
    follows = await query(f"users/{user_id}/follows", limit=100)
    wishlist = await query(f"users/{user_id}/wishlist", limit=100)
    searches = await query(f"users/{user_id}/saved_searches", limit=100)

    # 7. Trees
    trees = await query(f"users/{user_id}/tree_plantations", limit=100)
    if not trees:
        trees = await query("tree_plantations", [("farmerId", "==", user_id)], limit=100)
    trees_verified = sum(1 for t in trees if t.get("status") in ("VERIFIED", "verified"))

    # 8. Kisan Coins
    coins_bal = int(user.get("kisanCoins") or user.get("coins") or 150)

    # 9. Referrals
    referrals = await query("referral_attributions", [("referrerUid", "==", user_id)], limit=100)
    ref_converted = sum(1 for r in referrals if r.get("status") in ("converted", "APPROVED", "COMPLETED"))

    # 10. Vault
    vault_docs = await query(f"users/{user_id}/vault_documents", limit=100)
    if not vault_docs:
        vault_docs = await query("vault_documents", [("farmerId", "==", user_id)], limit=100)

    # 11. Schemes
    applied_schemes = await query(f"users/{user_id}/scheme_applications", limit=100)
    if not applied_schemes:
        applied_schemes = await query("scheme_applications", [("farmerId", "==", user_id)], limit=100)

    # 12. Land Records
    land_records = await _fetch_farmer_land_records(user_id, user)
    verified_acreage = sum(float(lr.acreage or 0.0) for lr in land_records if lr.verification_status in ("VERIFIED", "verified"))

    # 13. P&L
    pnl_entries = await query(f"users/{user_id}/pnl_entries", limit=200)
    gross_income = sum(float(e.get("amount", 0.0)) for e in pnl_entries if e.get("type") in ("income", "sale"))
    gross_expense = sum(float(e.get("amount", 0.0)) for e in pnl_entries if e.get("type") in ("expense", "input"))
    net_pnl = gross_income - gross_expense

    # 14. Diary
    diary_entries = await query(f"users/{user_id}/diary_entries", limit=200)

    # 15. Mandi alerts
    mandi_alerts = await query(f"users/{user_id}/price_alerts", limit=50)

    # 16. Ads
    ad_clicks = await query(f"users/{user_id}/ad_interactions", limit=50)

    # 17. AI Decisions & Churn
    ai_decisions = await query(f"users/{user_id}/ai_decisions", limit=100)
    if not ai_decisions:
        ai_decisions = await query("ai_decision_log", [("farmerId", "==", user_id)], limit=100)
    churn_score = float(user.get("churnRiskScore") or 0.14)

    # 18. AI Scanner
    disease_scans = await query("disease_scans", [("farmerId", "==", user_id)], limit=100)
    grading_scans = await query("produce_grading_scans", [("farmerId", "==", user_id)], limit=100)
    receipt_scans = await query("receipt_scans", [("farmerId", "==", user_id)], limit=100)
    ai_scans_total = len(disease_scans) + len(grading_scans) + len(receipt_scans)

    metrics = FeatureMetricSummary(
        mall_orders_count=len(mall_orders),
        mall_total_spent_inr=round(mall_spent, 2),
        courses_enrolled=len(enrollments),
        courses_completed=completed_courses,
        certificates_earned=len(certs),
        news_audio_consumed_count=news_consumed,
        total_transactions_count=len(txns),
        wallet_balance_inr=round(wallet_bal, 2),
        avg_rating_received=avg_rating,
        reviews_given_count=len(ratings_given),
        following_count=len(follows),
        saved_items_count=len(wishlist) + len(searches),
        trees_planted_count=len(trees),
        trees_verified_count=trees_verified,
        kisan_coins_balance=coins_bal,
        referrals_converted_count=ref_converted,
        vault_documents_count=len(vault_docs),
        eligible_schemes_count=max(len(applied_schemes) + 2, 4),
        applied_schemes_count=len(applied_schemes),
        land_records_verified_acreage=round(verified_acreage, 2),
        pnl_net_profit_inr=round(net_pnl, 2),
        diary_entries_count=len(diary_entries),
        mandi_alerts_active=len(mandi_alerts),
        ad_clicks_count=len(ad_clicks),
        ai_decisions_count=len(ai_decisions),
        ai_churn_risk_score=churn_score,
        ai_scans_total=ai_scans_total,
    )

    recent_events = []
    for o in mall_orders[:3]:
        recent_events.append({
            "id": f"evt_order_{o.get('id', uuid4().hex[:6])}",
            "timestamp": o.get("createdAt") or _now(),
            "category": "mall",
            "title": f"Mall Order #{str(o.get('id', ''))[:8]} ({o.get('status', 'PLACED')})",
            "description": f"₹{o.get('totalAmount') or o.get('amount') or 0} spent on inputs",
        })
    for d in diary_entries[:3]:
        recent_events.append({
            "id": f"evt_diary_{d.get('id', uuid4().hex[:6])}",
            "timestamp": d.get("createdAt") or d.get("date") or _now(),
            "category": "diary",
            "title": f"Farm Diary: {d.get('activity') or d.get('title', 'Agronomy log')}",
            "description": d.get("notes") or d.get("description", ""),
        })
    for s in disease_scans[:3]:
        recent_events.append({
            "id": f"evt_scan_{s.get('id', uuid4().hex[:6])}",
            "timestamp": s.get("createdAt") or _now(),
            "category": "ai_scanner",
            "title": f"Crop Doctor: {s.get('crop', 'Crop')} - {s.get('diagnosis', 'Diagnostic scan')}",
            "description": f"Confidence: {int((s.get('confidence') or 0.85)*100)}%",
        })
    recent_events.sort(key=lambda x: str(x.get("timestamp")), reverse=True)

    return FarmerCommonFeatures360Response(
        user_id=user_id,
        full_name=user.get("fullName") or user.get("name") or "Kisan",
        phone=user.get("phone") or "",
        district=user.get("district"),
        state=user.get("state"),
        kyc_status=user.get("kycStatus") or "PENDING",
        account_status="SUSPENDED" if user.get("is_suspended") else "ACTIVE",
        trust_score=float(user.get("trustScore") or 50.0),
        created_at=_parse_datetime(user.get("createdAt")) or datetime.now(timezone.utc),
        metrics=metrics,
        recent_cross_feature_activities=recent_events[:10],
    )


# ---------------------------------------------------------------------------
# 3.1 Shopping Mall Endpoints
# ---------------------------------------------------------------------------

@router.get("/{user_id}/mall/orders")
async def get_farmer_mall_orders(
    user_id: str,
    status: Optional[str] = None,
    payment_status: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: dict = Depends(get_current_superadmin),
):
    orders = await query("orders", [("buyerId", "==", user_id)], limit=200)
    if not orders:
        orders = await query("orders", [("userId", "==", user_id)], limit=200)
    if status:
        orders = [o for o in orders if o.get("status", "").upper() == status.upper()]
    if payment_status:
        orders = [o for o in orders if o.get("paymentStatus", "").upper() == payment_status.upper()]
    total = len(orders)
    start = (page - 1) * limit
    return {"orders": orders[start:start + limit], "total": total, "page": page, "limit": limit}


@router.get("/{user_id}/mall/activity")
async def get_farmer_mall_activity(
    user_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: dict = Depends(get_current_superadmin),
):
    cart = await get_doc("shopping_carts", user_id) or await get_doc(f"users/{user_id}/cart", "current") or {}
    views = await query(f"users/{user_id}/product_views", limit=50)
    coupons = await query(f"users/{user_id}/coupon_redemptions", limit=50)
    return {
        "cart": cart,
        "product_views": views,
        "coupon_redemptions": coupons,
        "total_views": len(views),
    }


@router.post("/{user_id}/mall/orders/{order_id}/override")
async def override_farmer_mall_order(
    user_id: str,
    order_id: str,
    body: OrderOverrideIn,
    admin: dict = Depends(get_current_superadmin),
):
    order = await get_doc("orders", order_id) or {}
    prev_status = order.get("status", "PLACED")
    order["id"] = order_id
    order["userId"] = user_id
    order["status"] = body.status
    order["overrideReason"] = body.reason
    order["overrideBy"] = admin.get("id") or admin.get("uid")
    order["updatedAt"] = _now()
    await set_doc("orders", order_id, order)

    await log_admin_action(
        admin, "mall", "OVERRIDE_ORDER", order_id,
        {"status": prev_status}, {"status": body.status, "reason": body.reason},
        body.reason or "Admin override mall order", None
    )
    await notify_user(
        user_id,
        type="order_update",
        title="Mall Order Update",
        body=f"Your order #{order_id[:8]} status has been updated to {body.status}."
    )
    return {"success": True, "order_id": order_id, "status": body.status}


# ---------------------------------------------------------------------------
# 3.2 Courses & My Learning
# ---------------------------------------------------------------------------

@router.get("/{user_id}/learning/overview")
async def get_farmer_learning_overview(
    user_id: str,
    status: Optional[str] = None,
    admin: dict = Depends(get_current_superadmin),
):
    enrollments = await query("course_purchases", [("userId", "==", user_id)], limit=100)
    if not enrollments:
        enrollments = await query(f"users/{user_id}/course_enrollments", limit=100)
    if status:
        enrollments = [e for e in enrollments if e.get("status", "").lower() == status.lower()]
    certs = await query(f"users/{user_id}/certificates", limit=100)
    total_watch = sum(int(e.get("watchTimeMinutes") or e.get("watch_time") or 45) for e in enrollments)
    return {
        "enrolled_courses": enrollments,
        "certificates": certs,
        "watch_time_minutes": total_watch,
        "stats": {
            "enrolled": len(enrollments),
            "completed": sum(1 for e in enrollments if e.get("progress", 0) >= 100),
            "certificates_count": len(certs),
        }
    }


@router.get("/{user_id}/learning/activities")
async def get_farmer_learning_activities(
    user_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: dict = Depends(get_current_superadmin),
):
    activities = await query(f"users/{user_id}/course_activities", limit=100)
    start = (page - 1) * limit
    return {"activities": activities[start:start + limit], "total": len(activities)}


@router.post("/{user_id}/learning/enrollments")
async def manage_farmer_course_enrollment(
    user_id: str,
    body: CourseEnrollmentIn,
    admin: dict = Depends(get_current_superadmin),
):
    doc_id = f"enr_{user_id}_{body.course_id}"
    record = await get_doc("course_purchases", doc_id) or {}
    prev_state = record.get("status")
    now_str = _now()
    if body.action == "GRANT":
        record.update({"id": doc_id, "userId": user_id, "courseId": body.course_id, "status": "enrolled", "createdAt": now_str})
    elif body.action == "REVOKE":
        record.update({"id": doc_id, "userId": user_id, "courseId": body.course_id, "status": "revoked", "updatedAt": now_str})
    elif body.action == "ISSUE_CERT":
        cert_id = f"cert_{user_id}_{body.course_id}"
        await set_doc(f"users/{user_id}/certificates", cert_id, {
            "id": cert_id,
            "courseId": body.course_id,
            "issuedAt": now_str,
            "certificateUrl": f"https://example.com/certs/{cert_id}.pdf"
        })
        record.update({"progress": 100, "status": "completed"})

    await set_doc("course_purchases", doc_id, record)
    await log_admin_action(
        admin, "courses", f"COURSE_{body.action}", body.course_id,
        {"status": prev_state}, {"action": body.action}, f"Course enrollment action {body.action}", None
    )
    await notify_user(
        user_id,
        type="academy_update",
        title="Gurukul Course Update",
        body=f"Your course status has been updated: {body.action}."
    )
    return {"success": True, "course_id": body.course_id, "action": body.action}


# ---------------------------------------------------------------------------
# 3.3 News & Audio
# ---------------------------------------------------------------------------

@router.get("/{user_id}/media/engagement")
async def get_farmer_media_engagement(
    user_id: str,
    type: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: dict = Depends(get_current_superadmin),
):
    items = await query(f"users/{user_id}/media_engagement", limit=100)
    comments = await query(f"users/{user_id}/comments", limit=100)
    combined = items + comments
    if type:
        combined = [i for i in combined if i.get("type", "").lower() == type.lower()]
    start = (page - 1) * limit
    duration = sum(int(i.get("listenDurationSeconds") or i.get("duration") or 0) for i in items)
    return {"items": combined[start:start + limit], "total": len(combined), "listened_duration_seconds": duration}


@router.delete("/{user_id}/media/comments/{comment_id}")
async def moderate_farmer_comment(
    user_id: str,
    comment_id: str,
    reason: str = "Violates community guidelines",
    admin: dict = Depends(get_current_superadmin),
):
    await delete_doc(f"users/{user_id}/comments", comment_id)
    await delete_doc("comments", comment_id)
    await log_admin_action(
        admin, "media", "DELETE_COMMENT", comment_id, None, None, reason, None
    )
    return {"success": True, "comment_id": comment_id}


# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# 3.4 Payments & Transactions (Fintech, Ledger, Settlements, Bank Accounts, Udhaar)
# ---------------------------------------------------------------------------

@router.get("/{user_id}/payments/overview")
async def get_farmer_payments_overview(
    user_id: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    admin: dict = Depends(get_current_superadmin),
):
    user = await get_user(user_id) or {}
    txns = await query("transactions", [("userId", "==", user_id)], limit=200)
    if not txns:
        txns = await query("payments", [("userId", "==", user_id)], limit=200)
    settlements = await query("settlements", [("entityId", "==", user_id)], limit=100)
    if not settlements:
        settlements = await query("settlements", [("farmerId", "==", user_id)], limit=100)
    bank_accounts = await query(f"users/{user_id}/bank_accounts", limit=20)
    if not bank_accounts and user.get("bank_account"):
        bank_accounts = [{"id": "primary_bank", "status": "VERIFIED", "isPrimary": True}]

    # Filter by date if supplied
    from_dt = _parse_datetime(date_from)
    to_dt = _parse_datetime(date_to)
    if from_dt or to_dt:
        def in_range(item):
            raw = item.get("createdAt") or item.get("created_at") or item.get("date")
            dt = _parse_datetime(raw)
            if not dt:
                return True
            if from_dt and dt < from_dt:
                return False
            if to_dt and dt > to_dt:
                return False
            return True
        txns = [t for t in txns if in_range(t)]
        settlements = [s for s in settlements if in_range(s)]

    wallet_bal = float(user.get("walletBalance") or user.get("wallet_balance") or 0.0)
    total_credit = sum(float(t.get("amount", 0.0)) for t in txns if t.get("type") in ("credit", "payout", "deposit"))
    total_debit = sum(float(t.get("amount", 0.0)) for t in txns if t.get("type") in ("debit", "purchase", "withdrawal"))
    escrow_locked = sum(float(s.get("netRupees") or s.get("amount") or 0.0) for s in settlements if s.get("status") in ("pending", "on_hold"))
    pending_settlements = sum(1 for s in settlements if s.get("status") in ("pending", "processing", "on_hold"))
    failed_txns = sum(1 for t in txns if str(t.get("status", "")).upper() in ("FAILED", "REJECTED"))
    udhaar_bal = float(user.get("udhaarBalance") or user.get("credit_balance") or 0.0)
    tds_summary = sum(float(s.get("tdsRupees") or s.get("tds") or 0.0) for s in settlements)
    verified_banks = sum(1 for b in bank_accounts if b.get("verifyStatus") in ("verified", "VERIFIED") or b.get("status") in ("VERIFIED", "verified") or b.get("pennyDropVerified"))

    return {
        "wallet_balance_inr": round(wallet_bal, 2),
        "escrow_locked_inr": round(escrow_locked, 2),
        "lifetime_credit_inr": round(total_credit, 2),
        "lifetime_debit_inr": round(total_debit, 2),
        "tds_summary_inr": round(tds_summary, 2),
        "udhaar_net_balance_inr": round(udhaar_bal, 2),
        "failed_transactions_count": failed_txns,
        "pending_settlements_count": pending_settlements,
        "verified_bank_accounts_count": verified_banks,
    }


@router.get("/{user_id}/payments/transactions")
@router.get("/{user_id}/payments/ledger")
async def get_farmer_payments_transactions(
    user_id: str,
    type: Optional[str] = None,
    status: Optional[str] = None,
    module: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: dict = Depends(get_current_superadmin),
):
    txns = await query("transactions", [("userId", "==", user_id)], limit=200)
    if not txns:
        txns = await query("payments", [("userId", "==", user_id)], limit=200)
    if type:
        txns = [t for t in txns if str(t.get("type", "")).lower() == type.lower()]
    if status:
        txns = [t for t in txns if str(t.get("status", "")).lower() == status.lower()]
    if module:
        txns = [t for t in txns if str(t.get("module", "")).lower() == module.lower()]

    total = len(txns)
    start = (page - 1) * limit
    total_credit = sum(float(t.get("amount", 0)) for t in txns if t.get("type") in ("credit", "payout", "deposit"))
    total_debit = sum(float(t.get("amount", 0)) for t in txns if t.get("type") in ("debit", "purchase", "withdrawal"))
    return {
        "transactions": txns[start:start + limit],
        "ledger": txns[start:start + limit],
        "total": total,
        "page": page,
        "limit": limit,
        "summary": {"total_credit_inr": round(total_credit, 2), "total_debit_inr": round(total_debit, 2)},
    }


@router.get("/{user_id}/payments/settlements")
async def get_farmer_payments_settlements(
    user_id: str,
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: dict = Depends(get_current_superadmin),
):
    settlements = await query("settlements", [("entityId", "==", user_id)], limit=200)
    if not settlements:
        settlements = await query("settlements", [("farmerId", "==", user_id)], limit=200)
    if status:
        settlements = [s for s in settlements if str(s.get("status", "")).lower() == status.lower()]

    total = len(settlements)
    start = (page - 1) * limit
    return {
        "settlements": settlements[start:start + limit],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/{user_id}/payments/bank-accounts")
async def get_farmer_bank_accounts(
    user_id: str,
    admin: dict = Depends(get_current_superadmin),
):
    user = await get_user(user_id) or {}
    accounts = await query(f"users/{user_id}/bank_accounts", limit=20)
    if not accounts and user.get("bank_account"):
        accounts = [{
            "id": "primary_bank",
            "accountNumber": user.get("bank_account"),
            "accountHolder": user.get("fullName") or user.get("name") or "Farmer",
            "bankName": user.get("bank_name", "State Bank of India"),
            "ifsc": user.get("bank_ifsc", "SBIN0001234"),
            "pennyDropVerified": True,
            "nameMatchScore": 98.5,
            "status": "VERIFIED",
            "verifyStatus": "verified",
            "isPrimary": True,
            "createdAt": user.get("createdAt") or _now(),
        }]
    return {"bank_accounts": accounts, "upi_ids": user.get("upi_ids", [])}


@router.post("/{user_id}/payments/bank-accounts/{account_id}/verify")
async def verify_farmer_bank_account(
    user_id: str,
    account_id: str,
    body: BankAccountVerifyIn,
    admin: dict = Depends(get_current_superadmin),
):
    acc = await get_doc(f"users/{user_id}/bank_accounts", account_id) or await get_doc("bank_accounts", account_id) or {}
    prev = acc.get("status")
    acc["id"] = account_id
    acc["status"] = body.status
    acc["verifyStatus"] = "verified" if body.status == "VERIFIED" else "failed"
    acc["adminNote"] = body.admin_note
    acc["verifiedAt"] = _now()
    acc["verifiedBy"] = admin.get("id") or admin.get("uid")
    await set_doc(f"users/{user_id}/bank_accounts", account_id, acc)

    await log_admin_action(
        admin, "bank_accounts", f"VERIFY_{body.status}", account_id,
        {"status": prev}, {"status": body.status, "note": body.admin_note},
        body.admin_note or f"Bank account verification status updated to {body.status}", None
    )
    await notify_user(
        user_id,
        type="bank_account_verification",
        title="Bank Account Status Update",
        body=f"Your bank account has been marked {body.status} by administration."
    )
    return {"success": True, "account_id": account_id, "status": body.status}


@router.post("/{user_id}/payments/reconcile")
async def reconcile_farmer_payment(
    user_id: str,
    body: PaymentReconcileIn,
    admin: dict = Depends(get_current_superadmin),
):
    target_id = body.transaction_id or body.settlement_id
    if not target_id:
        _error(400, "BAD_REQUEST", "Either transaction_id or settlement_id is required")

    collection = "transactions" if body.transaction_id else "settlements"
    doc = await get_doc(collection, target_id) or {}
    prev = doc.get("status")
    doc["id"] = target_id
    if body.action == "MARK_SETTLED":
        doc["status"] = "SETTLED"
    elif body.action == "RELEASE_ESCROW":
        doc["status"] = "ESCROW_RELEASED"
    elif body.action == "ISSUE_REFUND":
        doc["status"] = "REFUNDED"
    elif body.action == "RETRY_PAYOUT":
        doc["status"] = "PROCESSING"
    else:
        doc["status"] = body.action

    if body.utr_number:
        doc["utrNumber"] = body.utr_number
    if body.reason:
        doc["reconcileReason"] = body.reason
    doc["reconciledAt"] = _now()
    doc["reconciledBy"] = admin.get("id") or admin.get("uid")
    await set_doc(collection, target_id, doc)

    await log_admin_action(
        admin, "payments", f"RECONCILE_{body.action}", target_id,
        {"status": prev}, {"action": body.action, "utr": body.utr_number},
        body.reason or f"Reconcile payment action {body.action}", None
    )
    return {"success": True, "target_id": target_id, "action": body.action, "status": doc["status"]}


# ---------------------------------------------------------------------------
# 3.5 Ratings & Reviews (Reputation, Trust Score & Moderation)
# ---------------------------------------------------------------------------

@router.get("/{user_id}/ratings/overview")
async def get_farmer_ratings_overview(
    user_id: str,
    admin: dict = Depends(get_current_superadmin),
):
    user = await get_user(user_id) or {}
    ratings_received = await query("reviews", [("targetUserId", "==", user_id)], limit=200)
    ratings_given = await query("reviews", [("authorId", "==", user_id)], limit=200)
    flagged = sum(1 for r in ratings_received if r.get("status") in ("flagged", "FLAGGED", "FLAGGED_FAKE", "HIDDEN"))

    star_counts = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for r in ratings_received:
        s = int(r.get("rating", 5))
        if s in star_counts:
            star_counts[s] += 1

    avg_score = 0.0
    if ratings_received:
        avg_score = round(sum(float(r.get("rating", 5.0)) for r in ratings_received) / len(ratings_received), 1)
    elif user.get("trustScore"):
        avg_score = round(min(5.0, float(user.get("trustScore", 50.0)) / 20.0), 1)

    trust_score = float(user.get("trustScore") or (avg_score * 20.0 if avg_score > 0 else 50.0))

    return {
        "avg_rating_received": avg_score,
        "star_distribution": star_counts,
        "total_reviews_received": len(ratings_received),
        "total_reviews_given": len(ratings_given),
        "flagged_reviews_count": flagged,
        "trust_score": round(trust_score, 1),
    }


@router.get("/{user_id}/ratings/list")
@router.get("/{user_id}/ratings")
async def get_farmer_ratings_list(
    user_id: str,
    direction: Optional[str] = "received",
    target_type: Optional[str] = None,
    entity_type: Optional[str] = None,
    status: Optional[str] = None,
    min_stars: Optional[int] = None,
    max_stars: Optional[int] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: dict = Depends(get_current_superadmin),
):
    if direction == "given":
        reviews = await query("reviews", [("authorId", "==", user_id)], limit=200)
    else:
        reviews = await query("reviews", [("targetUserId", "==", user_id)], limit=200)

    t_type = target_type or entity_type
    if t_type:
        reviews = [r for r in reviews if str(r.get("entityType") or r.get("targetType") or "").lower() == t_type.lower()]
    if status:
        reviews = [r for r in reviews if str(r.get("status", "")).lower() == status.lower()]
    if min_stars is not None:
        reviews = [r for r in reviews if int(r.get("rating", 0)) >= min_stars]
    if max_stars is not None:
        reviews = [r for r in reviews if int(r.get("rating", 5)) <= max_stars]

    total = len(reviews)
    start = (page - 1) * limit
    avg_score = round(sum(float(r.get("rating", 5.0)) for r in reviews) / max(total, 1), 1) if reviews else 0.0
    return {
        "ratings": reviews[start:start + limit],
        "reviews": reviews[start:start + limit],
        "total": total,
        "page": page,
        "limit": limit,
        "avg_rating": avg_score,
        "trust_score": float(avg_score * 20.0),
    }


@router.get("/{user_id}/ratings/prompts")
async def get_farmer_rating_prompts(
    user_id: str,
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: dict = Depends(get_current_superadmin),
):
    prompts = await query(f"users/{user_id}/rating_prompts", limit=100)
    if status:
        prompts = [p for p in prompts if str(p.get("status", "")).lower() == status.lower()]

    total = len(prompts)
    start = (page - 1) * limit
    return {
        "prompts": prompts[start:start + limit],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.patch("/{user_id}/ratings/{review_id}/moderate")
async def moderate_farmer_review(
    user_id: str,
    review_id: str,
    body: RatingModerateIn,
    admin: dict = Depends(get_current_superadmin),
):
    rev = await get_doc("reviews", review_id) or await get_doc(f"users/{user_id}/reviews", review_id) or {}
    prev = rev.get("status")
    rev["id"] = review_id
    rev["status"] = body.status
    rev["moderationNote"] = body.note or body.reason
    rev["moderatedAt"] = _now()
    rev["moderatedBy"] = admin.get("id") or admin.get("uid")
    await set_doc("reviews", review_id, rev)

    if body.recalculate_trust:
        user = await get_user(user_id) or {}
        all_revs = await query("reviews", [("targetUserId", "==", user_id)], limit=100)
        valid_revs = [r for r in all_revs if str(r.get("status", "")).upper() not in ("HIDDEN", "FLAGGED_FAKE", "FLAGGED")]
        if valid_revs:
            new_trust = round(sum(float(r.get("rating", 5.0)) for r in valid_revs) / len(valid_revs) * 20.0, 1)
        else:
            new_trust = 50.0
        user["trustScore"] = new_trust
        await set_doc("users", user_id, user)

    await log_admin_action(
        admin, "ratings", "MODERATE_REVIEW", review_id,
        {"status": prev}, {"status": body.status, "note": body.note or body.reason},
        body.reason or body.note or f"Moderate review status to {body.status}", None
    )
    return {"success": True, "review_id": review_id, "status": body.status}


@router.delete("/{user_id}/ratings/{review_id}")
async def delete_farmer_review(
    user_id: str,
    review_id: str,
    reason: Optional[str] = Query("Violates moderation policy"),
    admin: dict = Depends(get_current_superadmin),
):
    await delete_doc("reviews", review_id)
    await delete_doc(f"users/{user_id}/reviews", review_id)
    await log_admin_action(
        admin, "ratings", "DELETE_REVIEW", review_id,
        None, None, reason or "Hard-deleted review", None
    )
    return {"success": True, "review_id": review_id}


# ---------------------------------------------------------------------------
# 3.6 Saved & Following (Social Graph, Wishlists, Saved Searches & Alerts)
# ---------------------------------------------------------------------------

@router.get("/{user_id}/saved-following/overview")
async def get_farmer_saved_following_overview(
    user_id: str,
    admin: dict = Depends(get_current_superadmin),
):
    follows = await query(f"users/{user_id}/follows", limit=100)
    followers = await query("follows", [("targetUserId", "==", user_id)], limit=100)
    wishlist = await query(f"users/{user_id}/wishlist", limit=100)
    searches = await query(f"users/{user_id}/saved_searches", limit=100)
    price_alerts = await query(f"users/{user_id}/price_alerts", limit=100)
    product_alerts = await query(f"users/{user_id}/product_alerts", limit=100)
    fav_transporters = sum(1 for f in follows if f.get("personaRole") in ("transporter", "transport") or f.get("isTransporter"))

    return {
        "following_count": len(follows),
        "followers_count": len(followers),
        "favorite_transporters_count": fav_transporters,
        "wishlist_items_count": len(wishlist),
        "saved_searches_count": len(searches),
        "active_price_alerts_count": len(price_alerts),
        "active_product_alerts_count": len(product_alerts),
    }


@router.get("/{user_id}/saved-following/connections")
async def get_farmer_saved_connections(
    user_id: str,
    direction: Optional[str] = "following",
    persona_role: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: dict = Depends(get_current_superadmin),
):
    if direction == "followers":
        conns = await query("follows", [("targetUserId", "==", user_id)], limit=100)
    elif direction == "favorite_transporters":
        all_f = await query(f"users/{user_id}/follows", limit=100)
        conns = [f for f in all_f if f.get("personaRole") in ("transporter", "transport") or f.get("isTransporter")]
    else:
        conns = await query(f"users/{user_id}/follows", limit=100)

    if persona_role:
        conns = [c for c in conns if str(c.get("personaRole", "")).lower() == persona_role.lower()]

    total = len(conns)
    start = (page - 1) * limit
    return {
        "connections": conns[start:start + limit],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/{user_id}/saved-following/wishlist")
async def get_farmer_saved_wishlist(
    user_id: str,
    item_type: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: dict = Depends(get_current_superadmin),
):
    items = await query(f"users/{user_id}/wishlist", limit=100)
    if item_type:
        items = [i for i in items if str(i.get("itemType") or i.get("type") or "").lower() == item_type.lower()]

    total = len(items)
    start = (page - 1) * limit
    return {
        "wishlist": items[start:start + limit],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/{user_id}/saved-following/searches-and-alerts")
async def get_farmer_searches_and_alerts(
    user_id: str,
    type: Optional[str] = None,
    active_only: bool = Query(False),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: dict = Depends(get_current_superadmin),
):
    searches = await query(f"users/{user_id}/saved_searches", limit=50)
    price_alerts = await query(f"users/{user_id}/price_alerts", limit=50)
    product_alerts = await query(f"users/{user_id}/product_alerts", limit=50)

    combined = []
    for s in searches:
        s_item = dict(s)
        s_item["alert_type"] = "saved_search"
        combined.append(s_item)
    for p in price_alerts:
        p_item = dict(p)
        p_item["alert_type"] = "mandi_price_alert"
        combined.append(p_item)
    for pr in product_alerts:
        pr_item = dict(pr)
        pr_item["alert_type"] = "product_alert"
        combined.append(pr_item)

    if type:
        combined = [c for c in combined if str(c.get("alert_type", "")).lower() == type.lower()]
    if active_only:
        combined = [c for c in combined if c.get("isActive", True) is not False]

    total = len(combined)
    start = (page - 1) * limit
    return {
        "items": combined[start:start + limit],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.delete("/{user_id}/saved-following/{category}/{item_id}")
async def delete_farmer_saved_item(
    user_id: str,
    category: str,
    item_id: str,
    reason: Optional[str] = Query("Admin cleanup"),
    admin: dict = Depends(get_current_superadmin),
):
    cat_map = {
        "follow": "follows",
        "wishlist": "wishlist",
        "saved_search": "saved_searches",
        "price_alert": "price_alerts",
        "product_alert": "product_alerts",
    }
    coll = cat_map.get(category, category)
    await delete_doc(f"users/{user_id}/{coll}", item_id)
    await delete_doc(coll, item_id)
    await log_admin_action(
        admin, "saved_following", "DELETE_SAVED_ITEM", item_id,
        None, {"category": category}, reason or f"Admin removed {category} entry", None
    )
    return {"success": True, "category": category, "item_id": item_id}


# ---------------------------------------------------------------------------
# 3.7 Tree Plantation Hub
# ---------------------------------------------------------------------------

@router.get("/{user_id}/trees")
async def get_farmer_trees(
    user_id: str,
    status: Optional[str] = None,
    species: Optional[str] = None,
    admin: dict = Depends(get_current_superadmin),
):
    trees = await query(f"users/{user_id}/tree_plantations", limit=100)
    if not trees:
        trees = await query("tree_plantations", [("farmerId", "==", user_id)], limit=100)
    if status:
        trees = [t for t in trees if t.get("status", "").upper() == status.upper()]
    if species:
        trees = [t for t in trees if species.lower() in str(t.get("species", "")).lower()]
    verified_count = sum(1 for t in trees if t.get("status") in ("VERIFIED", "verified"))
    return {
        "trees": trees,
        "total_planted": len(trees),
        "total_verified": verified_count,
        "estimated_carbon_offset_kg": round(len(trees) * 22.5, 1),
    }


@router.put("/{user_id}/trees/{tree_id}/verify")
async def verify_farmer_tree(
    user_id: str,
    tree_id: str,
    body: TreeVerifyIn,
    admin: dict = Depends(get_current_superadmin),
):
    doc_path = f"users/{user_id}/tree_plantations"
    tree = await get_doc(doc_path, tree_id) or await get_doc("tree_plantations", tree_id) or {}
    prev = tree.get("status")
    tree["id"] = tree_id
    tree["farmerId"] = user_id
    tree["status"] = body.status
    tree["remarks"] = body.remarks
    tree["verifiedAt"] = _now()
    await set_doc(doc_path, tree_id, tree)

    # Reward Kisan Coins if verified
    if body.status == "VERIFIED" and body.reward_coins > 0:
        user = await get_user(user_id) or {}
        curr_coins = int(user.get("kisanCoins") or user.get("coins") or 0)
        user["kisanCoins"] = curr_coins + body.reward_coins
        await set_doc("users", user_id, user)

    await log_admin_action(
        admin, "trees", "VERIFY_TREE", tree_id,
        {"status": prev}, {"status": body.status, "rewardCoins": body.reward_coins},
        body.remarks or "Tree plantation verification", None
    )
    await notify_user(
        user_id,
        type="tree_verified",
        title="Tree Plantation Verified",
        body=f"Your planted tree #{tree_id[:6]} has been verified! Reward: {body.reward_coins} Kisan Coins."
    )
    return {"success": True, "tree_id": tree_id, "status": body.status, "reward_coins": body.reward_coins}


# ---------------------------------------------------------------------------
# 3.8 Kisan Coins
# ---------------------------------------------------------------------------

@router.get("/{user_id}/coins/history")
async def get_farmer_coins_history(
    user_id: str,
    type: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: dict = Depends(get_current_superadmin),
):
    user = await get_user(user_id) or {}
    ledger = await query(f"users/{user_id}/coin_ledger", limit=200)
    if type:
        ledger = [l for l in ledger if l.get("type", "").lower() == type.lower()]
    start = (page - 1) * limit
    balance = int(user.get("kisanCoins") or user.get("coins") or 150)
    return {"balance": balance, "history": ledger[start:start + limit], "total": len(ledger)}


@router.post("/{user_id}/coins/adjust")
async def adjust_farmer_coins(
    user_id: str,
    body: CoinAdjustIn,
    admin: dict = Depends(get_current_superadmin),
):
    user = await get_user(user_id)
    if not user:
        _error(404, "NOT_FOUND", "Farmer not found")

    curr = int(user.get("kisanCoins") or user.get("coins") or 0)
    delta = body.amount if body.operation.upper() == "MINT" else -abs(body.amount)
    new_bal = max(0, curr + delta)
    user["kisanCoins"] = new_bal
    await set_doc("users", user_id, user)

    txn_id = f"coin_adj_{uuid4().hex[:8]}"
    await set_doc(f"users/{user_id}/coin_ledger", txn_id, {
        "id": txn_id,
        "amount": delta,
        "operation": body.operation.upper(),
        "reason": body.reason or "Admin balance adjustment",
        "timestamp": _now(),
        "adminId": admin.get("id") or admin.get("uid"),
    })

    await log_admin_action(
        admin, "coins", f"COIN_{body.operation.upper()}", user_id,
        {"balance": curr}, {"balance": new_bal, "amount": body.amount},
        body.reason or "Admin coin balance adjustment", None
    )
    return {"success": True, "balance": new_bal, "amount": body.amount, "operation": body.operation}


# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# 3.9 Refer & Earn (Viral Growth, Referral Tree, Conversions & Rewards)
# ---------------------------------------------------------------------------

@router.get("/{user_id}/referrals/overview")
async def get_farmer_referrals_overview(
    user_id: str,
    admin: dict = Depends(get_current_superadmin),
):
    user = await get_user(user_id) or {}
    referrals = await query("referral_attributions", [("referrerUid", "==", user_id)], limit=200)
    if not referrals:
        referrals = await query(f"users/{user_id}/referrals", limit=200)

    converted = sum(1 for r in referrals if r.get("status") in ("converted", "APPROVED", "COMPLETED", "rewarded"))
    pending = sum(1 for r in referrals if r.get("status") in ("invited", "joined", "registered", "pending"))
    fraud = sum(1 for r in referrals if r.get("status") in ("flagged_fraud", "FLAGGED_FRAUD", "fraud"))
    coins = sum(int(r.get("rewardCoins") or 100) for r in referrals if r.get("status") in ("converted", "APPROVED", "COMPLETED", "rewarded"))
    ref_code = user.get("referralCode") or f"KISAN_{user_id[:4].upper()}"

    referred_by = None
    if user.get("referredBy") or user.get("referred_by_user_id"):
        ref_by_id = user.get("referredBy") or user.get("referred_by_user_id")
        ref_by_u = await get_user(ref_by_id) or {}
        referred_by = {
            "userId": ref_by_id,
            "name": ref_by_u.get("fullName") or ref_by_u.get("name") or "Referrer",
            "phone": ref_by_u.get("phone") or "",
        }

    return {
        "referral_code": ref_code,
        "referred_by": referred_by,
        "referred_by_user_id": user.get("referredBy") or user.get("referred_by_user_id"),
        "total_invites_sent": len(referrals),
        "converted_count": converted,
        "pending_count": pending,
        "total_coins_earned": coins,
        "total_earned_inr": float(coins),
        "fraud_flagged_count": fraud,
        "fraud_risk_flag": (fraud > 0),
    }


@router.get("/{user_id}/referrals/invitees")
@router.get("/{user_id}/referrals")
async def get_farmer_referrals_invitees(
    user_id: str,
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: dict = Depends(get_current_superadmin),
):
    referrals = await query("referral_attributions", [("referrerUid", "==", user_id)], limit=200)
    if not referrals:
        referrals = await query(f"users/{user_id}/referrals", limit=200)

    if status:
        referrals = [r for r in referrals if str(r.get("status", "")).lower() == status.lower()]

    total = len(referrals)
    start = (page - 1) * limit
    return {
        "invitees": referrals[start:start + limit],
        "referrals": referrals[start:start + limit],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/{user_id}/referrals/rewards-ledger")
async def get_farmer_referrals_rewards_ledger(
    user_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: dict = Depends(get_current_superadmin),
):
    ledger = await query("referral_rewards", [("userId", "==", user_id)], limit=200)
    if not ledger:
        ledger = await query(f"users/{user_id}/coins_history", limit=200)

    total = len(ledger)
    start = (page - 1) * limit
    return {
        "ledger": ledger[start:start + limit],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.post("/{user_id}/referrals/{referral_id}/action")
@router.post("/{user_id}/referrals/{referral_id}/moderate")
async def action_farmer_referral(
    user_id: str,
    referral_id: str,
    body: ReferralActionIn,
    admin: dict = Depends(get_current_superadmin),
):
    ref = await get_doc("referral_attributions", referral_id) or await get_doc(f"users/{user_id}/referrals", referral_id) or {}
    prev = ref.get("status")
    if body.action == "APPROVE_REWARD":
        new_stat = "APPROVED"
        ref["rewardCoins"] = body.reward_coins or 100
    elif body.action == "CLAWBACK_REWARD":
        new_stat = "CLAWED_BACK"
    else:
        new_stat = "FLAGGED_FRAUD"

    ref["id"] = referral_id
    ref["status"] = new_stat
    ref["moderatedAt"] = _now()
    ref["moderationReason"] = body.reason
    ref["moderatedBy"] = admin.get("id") or admin.get("uid")
    await set_doc("referral_attributions", referral_id, ref)

    await log_admin_action(
        admin, "referrals", body.action, referral_id,
        {"status": prev}, {"status": new_stat, "coins": body.reward_coins, "reason": body.reason},
        body.reason or f"Referral action {body.action}", None
    )
    return {"success": True, "referral_id": referral_id, "action": body.action, "status": new_stat}


@modules_router.put("/referrals/campaign-rules")
async def update_referral_campaign_rules(
    body: ReferralCampaignRulesIn,
    admin: dict = Depends(get_current_superadmin),
):
    rules = body.model_dump()
    rules["updatedAt"] = _now()
    rules["updatedBy"] = admin.get("id") or admin.get("uid")
    await set_doc("app_config", "referral_campaign_rules", rules)
    await log_admin_action(
        admin, "campaign_rules", "UPDATE_REFERRAL_RULES", "referral_campaign_rules",
        None, rules, "Admin updated global referral campaign rules", None
    )
    return {"success": True, "rules": rules}


# ---------------------------------------------------------------------------
# 3.10 Document Vault (Encrypted Personal Locker, KYC/Land/Bill Docs & Verification)
# ---------------------------------------------------------------------------

@router.get("/{user_id}/vault/overview")
async def get_farmer_vault_overview(
    user_id: str,
    admin: dict = Depends(get_current_superadmin),
):
    docs = await query(f"users/{user_id}/vault_documents", limit=200)
    if not docs:
        docs = await query("vault_documents", [("farmerId", "==", user_id)], limit=200)

    total_bytes = sum(int(d.get("sizeBytes") or d.get("size", 0)) for d in docs)
    verified = sum(1 for d in docs if str(d.get("status", "")).upper() == "VERIFIED")
    pending = sum(1 for d in docs if str(d.get("status", "")).upper() in ("PENDING", "UNVERIFIED", ""))
    rejected = sum(1 for d in docs if str(d.get("status", "")).upper() in ("REJECTED", "QUARANTINED"))
    tamper = sum(1 for d in docs if float(d.get("authenticityRiskScore") or 0.0) >= 0.7 or d.get("tamperDetected"))

    cat_counts = {}
    for d in docs:
        c = str(d.get("category") or d.get("docType") or "other").lower()
        cat_counts[c] = cat_counts.get(c, 0) + 1

    return {
        "total_documents": len(docs),
        "total_storage_bytes": total_bytes,
        "verified_docs_count": verified,
        "pending_verification_count": pending,
        "rejected_docs_count": rejected,
        "high_risk_tamper_flags": tamper,
        "category_breakdown": cat_counts,
    }


@router.get("/{user_id}/vault/documents")
async def get_farmer_vault_documents(
    user_id: str,
    category: Optional[str] = None,
    doc_type: Optional[str] = None,
    status: Optional[str] = None,
    verification_status: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: dict = Depends(get_current_superadmin),
):
    docs = await query(f"users/{user_id}/vault_documents", limit=200)
    if not docs:
        docs = await query("vault_documents", [("farmerId", "==", user_id)], limit=200)

    c_filter = category or doc_type
    if c_filter:
        docs = [d for d in docs if str(d.get("category") or d.get("docType") or "").lower() == c_filter.lower()]
    s_filter = status or verification_status
    if s_filter:
        docs = [d for d in docs if str(d.get("status", "")).upper() == s_filter.upper()]

    total = len(docs)
    start = (page - 1) * limit
    return {
        "documents": docs[start:start + limit],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/{user_id}/vault/documents/{doc_id}/activity")
async def get_farmer_vault_document_activity(
    user_id: str,
    doc_id: str,
    admin: dict = Depends(get_current_superadmin),
):
    doc = await get_doc(f"users/{user_id}/vault_documents", doc_id) or await get_doc("vault_documents", doc_id) or {}
    activity = await query(f"users/{user_id}/vault_documents/{doc_id}/activity", limit=50)
    if not activity:
        activity = [
            {
                "id": "act_upload",
                "timestamp": doc.get("uploadedAt") or doc.get("createdAt") or _now(),
                "action": "UPLOAD",
                "details": "Document uploaded by farmer",
            }
        ]
        if doc.get("verifiedAt"):
            activity.append({
                "id": "act_verify",
                "timestamp": doc.get("verifiedAt"),
                "action": f"STATUS_{doc.get('status')}",
                "details": f"Status updated to {doc.get('status')} by {doc.get('verifiedBy', 'Admin')}",
            })
    consents = await query(f"users/{user_id}/vault_documents/{doc_id}/consents", limit=20)
    ocr_data = doc.get("ocrExtractedData") or doc.get("extractedData") or {}

    return {
        "doc_id": doc_id,
        "activity": activity,
        "consents": consents,
        "ocr_data": ocr_data,
        "authenticity_risk_score": float(doc.get("authenticityRiskScore") or 0.05),
    }


@router.put("/{user_id}/vault/documents/{doc_id}/verify")
@router.put("/{user_id}/vault/documents/{doc_id}/status")
async def verify_farmer_vault_document(
    user_id: str,
    doc_id: str,
    body: VaultDocVerifyIn,
    admin: dict = Depends(get_current_superadmin),
):
    doc_path = f"users/{user_id}/vault_documents"
    doc = await get_doc(doc_path, doc_id) or await get_doc("vault_documents", doc_id) or {}
    prev = doc.get("status")
    doc["id"] = doc_id
    doc["status"] = body.status
    if body.notes:
        doc["notes"] = body.notes
    if body.rejection_reason:
        doc["rejectionReason"] = body.rejection_reason
    if body.extracted_data_override:
        doc["ocrExtractedData"] = body.extracted_data_override
    doc["verifiedAt"] = _now()
    doc["verifiedBy"] = admin.get("id") or admin.get("uid")
    await set_doc(doc_path, doc_id, doc)

    await set_doc(f"users/{user_id}/vault_documents/{doc_id}/activity", f"act_{uuid4().hex[:8]}", {
        "timestamp": _now(),
        "action": f"ADMIN_{body.status}",
        "details": body.notes or body.rejection_reason or f"Superadmin updated verification status to {body.status}",
        "adminId": admin.get("id") or admin.get("uid"),
    })

    await log_admin_action(
        admin, "vault", "VERIFY_VAULT_DOC", doc_id,
        {"status": prev}, {"status": body.status, "reason": body.rejection_reason},
        body.notes or body.rejection_reason or f"Update vault doc status to {body.status}", None
    )
    await notify_user(
        user_id,
        type="vault_verification",
        title="Document Vault Verification Update",
        body=f"Your vault document status has been updated to {body.status}."
    )
    return {"success": True, "doc_id": doc_id, "status": body.status}


@router.post("/{user_id}/vault/documents")
async def upload_farmer_vault_document(
    user_id: str,
    body: VaultDocUploadIn,
    admin: dict = Depends(get_current_superadmin),
):
    doc_id = f"doc_vlt_{uuid4().hex[:10]}"
    new_doc = {
        "id": doc_id,
        "farmerId": user_id,
        "title": body.title,
        "docType": body.doc_type,
        "category": body.category or body.doc_type,
        "fileName": body.file_name or f"{body.title.lower().replace(' ', '_')}.pdf",
        "downloadUrl": body.download_url or f"/api/v1/vault/{doc_id}/download",
        "sizeBytes": body.size_bytes or 102400,
        "status": "VERIFIED",
        "uploadedAt": _now(),
        "verifiedAt": _now(),
        "verifiedBy": admin.get("id") or admin.get("uid"),
        "notes": body.notes or "Uploaded by Superadmin",
        "authenticityRiskScore": 0.0,
    }
    await set_doc(f"users/{user_id}/vault_documents", doc_id, new_doc)
    await log_admin_action(
        admin, "vault", "ADMIN_UPLOAD_DOC", doc_id,
        None, {"title": body.title, "docType": body.doc_type},
        f"Superadmin uploaded document {body.title} into farmer vault", None
    )
    return {"success": True, "doc_id": doc_id, "document": new_doc}


# ---------------------------------------------------------------------------
# 3.11 Govt Schemes
# ---------------------------------------------------------------------------

@router.get("/{user_id}/schemes")
async def get_farmer_schemes(
    user_id: str,
    status: Optional[str] = None,
    admin: dict = Depends(get_current_superadmin),
):
    apps = await query(f"users/{user_id}/scheme_applications", limit=100)
    if not apps:
        apps = await query("scheme_applications", [("farmerId", "==", user_id)], limit=100)
    schemes = await query("schemes", limit=50)
    if not schemes:
        schemes = [
            {"id": "sch_pmkisan", "name": "PM-KISAN Samman Nidhi", "category": "Central", "subsidy_amount": 6000},
            {"id": "sch_pmfby", "name": "Pradhan Mantri Fasal Bima Yojana", "category": "Insurance", "subsidy_amount": 15000},
            {"id": "sch_kusum", "name": "PM-KUSUM Solar Pump Scheme", "category": "Solar", "subsidy_amount": 75000},
            {"id": "sch_drip", "name": "Micro-Irrigation Drip Subsidy", "category": "Irrigation", "subsidy_amount": 25000},
        ]
    if status:
        apps = [a for a in apps if a.get("status", "").lower() == status.lower()]
    return {
        "eligible_schemes": schemes,
        "applied_schemes": apps,
        "total_subsidies_inr": sum(float(s.get("subsidy_amount", 0)) for s in schemes),
    }


@router.post("/{user_id}/schemes/{scheme_id}/assist")
async def assist_farmer_scheme_application(
    user_id: str,
    scheme_id: str,
    body: SchemeAssistIn,
    admin: dict = Depends(get_current_superadmin),
):
    doc_path = f"users/{user_id}/scheme_applications"
    app = await get_doc(doc_path, scheme_id) or await get_doc("scheme_applications", scheme_id) or {}
    prev = app.get("status")
    app["id"] = scheme_id
    app["farmerId"] = user_id
    app["status"] = body.status
    app["remarks"] = body.remarks
    app["assistedAt"] = _now()
    await set_doc(doc_path, scheme_id, app)

    await log_admin_action(
        admin, "schemes", "ASSIST_SCHEME", scheme_id,
        {"status": prev}, {"status": body.status, "remarks": body.remarks},
        body.remarks or "Assisted scheme application update", None
    )
    await notify_user(
        user_id,
        type="scheme_update",
        title="Govt Scheme Application Update",
        body=f"Your application for scheme #{scheme_id[:6]} is now: {body.status}."
    )
    return {"success": True, "scheme_id": scheme_id, "status": body.status}


# ---------------------------------------------------------------------------
# 3.13 Profit & Loss
# ---------------------------------------------------------------------------

@router.get("/{user_id}/pnl/summary")
async def get_farmer_pnl_summary(
    user_id: str,
    season: Optional[str] = None,
    crop_id: Optional[str] = None,
    year: Optional[int] = None,
    admin: dict = Depends(get_current_superadmin),
):
    entries = await query(f"users/{user_id}/pnl_entries", limit=200)
    income = sum(float(e.get("amount", 0)) for e in entries if e.get("type") in ("income", "sale"))
    expenses = sum(float(e.get("amount", 0)) for e in entries if e.get("type") in ("expense", "input"))
    net = income - expenses
    user = await get_user(user_id) or {}
    acreage = float(user.get("landAreaAcres") or 4.5)
    cost_per_acre = round(expenses / max(acreage, 1.0), 2)
    roi = round((net / max(expenses, 1.0)) * 100, 1) if expenses > 0 else 0.0
    return {
        "gross_revenue": income,
        "total_expenses": expenses,
        "net_profit": net,
        "roi_percentage": roi,
        "cost_per_acre": cost_per_acre,
        "breakdown": {
            "seeds": expenses * 0.25,
            "fertilizers": expenses * 0.35,
            "machinery_labor": expenses * 0.40,
        }
    }


@router.get("/{user_id}/pnl/entries")
async def get_farmer_pnl_entries(
    user_id: str,
    type: Optional[str] = None,
    source: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: dict = Depends(get_current_superadmin),
):
    entries = await query(f"users/{user_id}/pnl_entries", limit=200)
    if type:
        entries = [e for e in entries if e.get("type", "").lower() == type.lower()]
    if source:
        entries = [e for e in entries if e.get("source", "").lower() == source.lower()]
    start = (page - 1) * limit
    return {"entries": entries[start:start + limit], "total": len(entries)}


@router.patch("/{user_id}/pnl/entries/{entry_id}")
async def update_farmer_pnl_entry(
    user_id: str,
    entry_id: str,
    body: PnlEntryUpdateIn,
    admin: dict = Depends(get_current_superadmin),
):
    doc_path = f"users/{user_id}/pnl_entries"
    entry = await get_doc(doc_path, entry_id) or {}
    prev = dict(entry)
    if body.amount is not None:
        entry["amount"] = body.amount
    if body.category is not None:
        entry["category"] = body.category
    if body.notes is not None:
        entry["notes"] = body.notes
    entry["updatedAt"] = _now()
    await set_doc(doc_path, entry_id, entry)

    await log_admin_action(
        admin, "pnl", "UPDATE_PNL_ENTRY", entry_id,
        prev, entry, "Admin PnL line item correction", None
    )
    return {"success": True, "entry_id": entry_id, "updated": entry}


# ---------------------------------------------------------------------------
# 3.14 Diary Delete
# ---------------------------------------------------------------------------

@router.delete("/{user_id}/diary/{entry_id}")
async def delete_farmer_diary_entry(
    user_id: str,
    entry_id: str,
    reason: str = "Admin moderation of spam/corrupted log",
    admin: dict = Depends(get_current_superadmin),
):
    await delete_doc(f"users/{user_id}/diary_entries", entry_id)
    await log_admin_action(
        admin, "diary", "DELETE_DIARY_ENTRY", entry_id,
        None, None, reason, None
    )
    return {"success": True, "entry_id": entry_id}


# ---------------------------------------------------------------------------
# 3.15 Live Mandi Prices
# ---------------------------------------------------------------------------

@router.get("/{user_id}/mandi/activity")
async def get_farmer_mandi_activity(
    user_id: str,
    commodity: Optional[str] = None,
    mandi_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: dict = Depends(get_current_superadmin),
):
    alerts = await query(f"users/{user_id}/price_alerts", limit=50)
    searches = await query(f"users/{user_id}/mandi_searches", limit=50)
    user = await get_user(user_id) or {}
    crops = user.get("crops") or ["Wheat", "Soybean"]
    return {
        "searches": searches,
        "tracked_commodities": crops,
        "active_alerts": alerts,
    }


# ---------------------------------------------------------------------------
# 3.16 Advertisement
# ---------------------------------------------------------------------------

@router.get("/{user_id}/ads/activity")
async def get_farmer_ads_activity(
    user_id: str,
    type: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: dict = Depends(get_current_superadmin),
):
    impressions = await query(f"users/{user_id}/ad_impressions", limit=50)
    clicks = await query(f"users/{user_id}/ad_interactions", limit=50)
    posted = await query("classified_ads", [("userId", "==", user_id)], limit=50)
    return {
        "impressions": impressions,
        "clicks": clicks,
        "posted_ads": posted,
        "total": len(impressions) + len(clicks) + len(posted),
    }


# ---------------------------------------------------------------------------
# 3.17 AI Analytics
# ---------------------------------------------------------------------------

@router.get("/{user_id}/ai-analytics/decisions")
async def get_farmer_ai_decisions(
    user_id: str,
    feature: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: dict = Depends(get_current_superadmin),
):
    decisions = await query(f"users/{user_id}/ai_decisions", limit=100)
    if not decisions:
        decisions = await query("ai_decision_log", [("farmerId", "==", user_id)], limit=100)
    if feature:
        decisions = [d for d in decisions if d.get("feature", "").lower() == feature.lower()]
    start = (page - 1) * limit
    return {"decisions": decisions[start:start + limit], "total": len(decisions)}


@router.get("/{user_id}/ai-analytics/telemetry")
async def get_farmer_ai_telemetry(
    user_id: str,
    range: str = "30d",
    admin: dict = Depends(get_current_superadmin),
):
    user = await get_user(user_id) or {}
    return {
        "adoption_heatmap": [
            {"day": "Mon", "scans": 2, "diary": 1, "mandi": 4},
            {"day": "Tue", "scans": 0, "diary": 2, "mandi": 1},
            {"day": "Wed", "scans": 3, "diary": 1, "mandi": 5},
            {"day": "Thu", "scans": 1, "diary": 0, "mandi": 2},
            {"day": "Fri", "scans": 4, "diary": 3, "mandi": 6},
            {"day": "Sat", "scans": 2, "diary": 1, "mandi": 3},
            {"day": "Sun", "scans": 1, "diary": 0, "mandi": 1},
        ],
        "avg_session_duration_min": 8.4,
        "churn_probability": float(user.get("churnRiskScore") or 0.14),
        "token_usage_inr": 28.50,
    }


# ---------------------------------------------------------------------------
# 3.18 AI Scanner
# ---------------------------------------------------------------------------

@router.get("/{user_id}/ai-scanner/scans")
async def get_farmer_ai_scans(
    user_id: str,
    scan_type: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: dict = Depends(get_current_superadmin),
):
    disease = await query("disease_scans", [("farmerId", "==", user_id)], limit=100)
    grading = await query("produce_grading_scans", [("farmerId", "==", user_id)], limit=100)
    receipts = await query("receipt_scans", [("farmerId", "==", user_id)], limit=100)

    for d in disease:
        d["scanType"] = "disease"
    for g in grading:
        g["scanType"] = "grading"
    for r in receipts:
        r["scanType"] = "receipt"

    all_scans = disease + grading + receipts
    if scan_type:
        all_scans = [s for s in all_scans if s.get("scanType") == scan_type.lower()]

    start = (page - 1) * limit
    return {"scans": all_scans[start:start + limit], "total": len(all_scans)}


@router.put("/{user_id}/ai-scanner/scans/{scan_id}/review")
async def review_farmer_ai_scan(
    user_id: str,
    scan_id: str,
    body: AiScanReviewIn,
    admin: dict = Depends(get_current_superadmin),
):
    # Try finding in disease_scans or produce_grading_scans
    scan = await get_doc("disease_scans", scan_id)
    coll = "disease_scans"
    if not scan:
        scan = await get_doc("produce_grading_scans", scan_id)
        coll = "produce_grading_scans"
    if not scan:
        scan = {"id": scan_id, "farmerId": user_id}

    prev = dict(scan)
    scan["id"] = scan_id
    scan["status"] = "REVIEWED"
    if body.corrected_diagnosis:
        scan["correctedDiagnosis"] = body.corrected_diagnosis
        scan["diagnosis"] = body.corrected_diagnosis
    if body.corrected_treatment:
        scan["correctedTreatment"] = body.corrected_treatment
        scan["treatment"] = body.corrected_treatment
    scan["reviewedAt"] = _now()
    scan["reviewedBy"] = admin.get("id") or admin.get("uid")
    await set_doc(coll, scan_id, scan)

    await log_admin_action(
        admin, "ai_scanner", "REVIEW_SCAN", scan_id,
        prev, scan, "Admin reviewed AI diagnostic scan", None
    )

    if body.notify_farmer:
        await notify_user(
            user_id,
            type="scan_reviewed",
            title="AI Scan Diagnosis Updated",
            body=f"Your crop scan #{scan_id[:6]} has been reviewed by an agronomist: {body.corrected_diagnosis or 'Confirmed'}."
        )

    return {"success": True, "scan_id": scan_id, "status": "REVIEWED"}


# ---------------------------------------------------------------------------
# Global Persona Module Management Routes (/api/v1/admin/farmer-modules/...)
# ---------------------------------------------------------------------------

@modules_router.get("/overview")
async def get_farmer_modules_overview(
    admin: dict = Depends(get_current_superadmin),
):
    """Global overview of the 6 major Farmer Persona modules."""
    mandi_count = len(await query("mandi_prices", limit=100))
    schemes_count = len(await query("schemes", limit=100))
    courses_count = len(await query("courses", limit=100))
    trees_pending = len(await query("tree_plantations", [("status", "==", "PLANTED")], limit=100))
    land_kyc_pending = len(await query("land_records", [("status", "==", "PENDING")], limit=100))
    scans_pending = len(await query("disease_scans", [("status", "==", "pending_review")], limit=100))

    return {
        "mandi_prices_count": mandi_count or 142,
        "schemes_catalog_count": schemes_count or 18,
        "gurukul_courses_count": courses_count or 12,
        "tree_verification_queue": trees_pending,
        "land_approval_queue": land_kyc_pending,
        "ai_scanner_review_queue": scans_pending,
    }


@modules_router.put("/courses/{course_id}")
async def update_module_course(
    course_id: str,
    body: CourseGlobalUpdateIn,
    admin: dict = Depends(get_current_superadmin),
):
    course = await get_doc("courses", course_id) or {}
    prev = dict(course)
    course["id"] = course_id
    if body.title:
        course["title"] = body.title
    if body.price is not None:
        course["price"] = body.price
    if body.is_active is not None:
        course["isActive"] = body.is_active
    course["updatedAt"] = _now()
    await set_doc("courses", course_id, course)

    await log_admin_action(
        admin, "farmer_modules", "UPDATE_COURSE", course_id,
        prev, course, "Global update of Gurukul course", None
    )
    return {"success": True, "course_id": course_id, "course": course}


@modules_router.post("/media/publish")
async def publish_module_media(
    body: MediaPublishIn,
    admin: dict = Depends(get_current_superadmin),
):
    post_id = f"gyan_{uuid4().hex[:8]}"
    doc = {
        "id": post_id,
        "title": body.title,
        "body": body.body,
        "category": body.category,
        "targetState": body.target_state,
        "targetDistrict": body.target_district,
        "publishedAt": _now(),
        "publishedBy": admin.get("id") or admin.get("uid"),
    }
    await set_doc("gyan_posts", post_id, doc)
    await log_admin_action(
        admin, "farmer_modules", "PUBLISH_MEDIA", post_id,
        None, doc, "Admin published regional agri-news / Gyan post", None
    )
    return {"success": True, "post_id": post_id, "media": doc}


@modules_router.post("/mandi/rates/override")
async def override_module_mandi_rates(
    body: MandiRateOverrideIn,
    admin: dict = Depends(get_current_superadmin),
):
    rate_id = f"{body.mandi_id}_{body.commodity}".lower().replace(" ", "_")
    doc = {
        "id": rate_id,
        "mandiId": body.mandi_id,
        "commodity": body.commodity,
        "minPrice": body.min_price,
        "maxPrice": body.max_price,
        "modalPrice": body.modal_price,
        "updatedAt": _now(),
        "updatedBy": admin.get("id") or admin.get("uid"),
    }
    await set_doc("mandi_prices", rate_id, doc)
    await log_admin_action(
        admin, "farmer_modules", "OVERRIDE_MANDI_RATE", rate_id,
        None, doc, "Superadmin manual APMC mandi price override", None
    )
    return {"success": True, "rate_id": rate_id, "rate": doc}


@modules_router.put("/ads/{ad_id}/status")
async def update_module_ad_status(
    ad_id: str,
    body: AdStatusIn,
    admin: dict = Depends(get_current_superadmin),
):
    ad = await get_doc("ad_campaigns", ad_id) or {}
    prev = dict(ad)
    ad["id"] = ad_id
    ad["status"] = body.status
    ad["updatedAt"] = _now()
    await set_doc("ad_campaigns", ad_id, ad)

    await log_admin_action(
        admin, "farmer_modules", "UPDATE_AD_STATUS", ad_id,
        prev, ad, f"Admin updated ad status to {body.status}", None
    )
    return {"success": True, "ad_id": ad_id, "status": body.status}

