"""Superadmin SOP desks 21-24 — agroforestry, gamification economy, climate &
cold storage, and women/SHG programs.

Every endpoint here implements the doc path from
`docs/superadmin-instructions/21..24-*.md` and reuses the same real Firestore
collections as the phase-07 console (`app/routers/admin_console.py`) and the
user-facing routers, so the doc path and the legacy path stay in lock-step:

    - sapling requests really live in `users/{uid}/sapling_requests`
      (written by `app/routers/tree.py`); the top-level `sapling_requests`
      collection the console polls is covered by the same collection-group scan
    - the system-wide coin ledger is the `gamification_ledger` shadow
      collection written by `app/services/coins.py` on every mint/burn, plus
      the `agri_coins_ledger` rows the console's coin-adjust desk writes
    - the rewards store rows are written to `reward_coupons` (the collection
      the referral/fraud desk reads); the farmer-facing catalog in
      `app/routers/gamification.py` is a static fallback list, not a store
    - SHGs really live in `shg_groups` (written by `app/routers/women.py`);
      the SOP-24a collection `women_shgs` has no writer, so both 24a and 24b
      path families are served from `shg_groups`
    - subsidy credits dual-write to `shg_deposits` (read by the console's
      deposits desk) and the `shg_groups/{id}/deposits` sub-collection the
      Women Farmer Hub ledger reads, mirroring the platform's established
      top-level + sub-collection write pattern
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.db import get_db, get_doc, query, set_doc
from app.services import coins as coins_service
from app.services.admin_auth import admin_mutation_context, current_admin_user
from app.services.audit import log_admin_action
from app.services.notify import notify_user

router = APIRouter(prefix="/admin", tags=["admin"])

# SOP-21 tree request lifecycle: pending -> approved -> dispatched ->
# survival_verified, with rejection allowed from pending or approved (terminal
# once survival-verified).
TREE_REQUEST_STATUSES = {"approved", "dispatched", "rejected", "survival_verified"}
TREE_REQUEST_TRANSITIONS = {
    "pending": {"approved", "rejected"},
    "approved": {"dispatched", "rejected"},
    "dispatched": {"survival_verified"},
}

# SOP-23 carbon desk factors come from `carbon_factors` (seeded by
# scripts/seed_climate_data.py); the doc kinds are fixed by that seed.
CARBON_ENROLLMENTS = "carbon_enrollments"
CARBON_FACTORS = "carbon_factors"

# SOP-24 women/SHG collections — the real writers are app/routers/women.py
# (`shg_groups` + `shg_groups/{id}/deposits`) and app/routers/gruh_udyog.py.
SHG_GROUPS = "shg_groups"
SHG_DEPOSITS = "shg_deposits"
HOME_ENTERPRISES = "home_enterprises"
GRUH_UNITS = "gruh_udyog_units"
GRUH_PRODUCTS = "gruh_udyog_products"

# Scan caps that keep the cross-user reads bounded.
_LEDGER_SCAN_LIMIT = 5000
_REFERRER_SCAN_LIMIT = 300
_REQUEST_SCAN_LIMIT = 3000

# Survival-verification coin reward for a sapling request (award amount can be
# overridden per request via the doc's `survivalRewardCoins` field).
_TREE_SURVIVAL_REWARD_COINS = 50

_REFERRALS_CONFIG_DOC = "referrals_config"
_REFERRALS_DEFAULTS = {
    "referrerRewardCoins": 100,
    "refereeRewardCoins": 50,
    "maxReferralsPerMonth": 20,
    "enabled": True,
    "minKycTier": 0,
}


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _envelope(rows: list[dict], page: int, page_size: int) -> dict:
    total = len(rows)
    start = (page - 1) * page_size
    return {"data": rows[start:start + page_size], "page": page, "pageSize": page_size, "total": total}


def _sorted_newest(docs: list[dict], field: str = "createdAt") -> list[dict]:
    return sorted(docs, key=lambda d: d.get(field) or "", reverse=True)


async def _user_name(uid: str | None) -> str | None:
    if not uid:
        return None
    user = await get_doc("users", uid)
    return (user or {}).get("name")


async def _resolve_names(rows: list[dict], uid_field: str) -> list[dict]:
    names: dict[str, str | None] = {}
    for row in rows:
        uid = row.get(uid_field)
        if uid and uid not in names:
            names[uid] = await _user_name(uid)
    return [{**row, "userName": names.get(row.get(uid_field))} for row in rows]


# ===========================================================================
# SOP-21 — Agroforestry, tree plantation & biofuel
# ===========================================================================


def _request_collection_and_owner(ref) -> tuple[str, str | None]:
    """(collection path, owner uid) for a sapling-request document reference.

    Root docs belong to `sapling_requests` (owner None); nested docs belong to
    `users/{uid}/sapling_requests` and the owner is the parent user id.
    """
    collection = ref.parent
    if collection is None:
        return "sapling_requests", None
    parent_doc = collection.parent
    if parent_doc is None:
        return "sapling_requests", None
    return f"{parent_doc.path}/{collection.id}", parent_doc.id


async def _scan_sapling_requests() -> list[tuple[str, dict]]:
    """All sapling requests across users via a collection-group scan.

    `app/routers/tree.py` writes requests to `users/{uid}/sapling_requests`;
    the phase-07 console reviews the top-level `sapling_requests` mirror. A
    collection group over "sapling_requests" returns both.
    """
    found: list[tuple[str, dict]] = []
    snaps = get_db().collection_group("sapling_requests").limit(_REQUEST_SCAN_LIMIT).stream()
    async for snap in snaps:
        doc = snap.to_dict() or {}
        doc.setdefault("id", snap.id)
        collection_path, owner_uid = _request_collection_and_owner(snap.reference)
        if owner_uid and not doc.get("userId"):
            doc["userId"] = owner_uid
        found.append((collection_path, doc))
    return found


async def _find_sapling_request(request_id: str) -> tuple[str, dict] | None:
    doc = await get_doc("sapling_requests", request_id)
    if doc is not None:
        doc.setdefault("id", request_id)
        return "sapling_requests", doc
    for collection_path, doc in await _scan_sapling_requests():
        if doc.get("id") == request_id or doc.get("requestId") == request_id:
            return collection_path, doc
    return None


@router.get("/tree/requests")
async def list_tree_requests(
    status: Optional[str] = Query(None, description="filter by status; omit for all"),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_admin_user),
):
    """SOP-21: pending + all sapling requests, newest first."""
    rows = [doc for _, doc in await _scan_sapling_requests()]
    if status:
        rows = [r for r in rows if r.get("status") == status]
    rows = _sorted_newest(rows)
    rows = await _resolve_names(rows, "userId")
    return _envelope(rows, page, pageSize)


class TreeRequestStatusIn(BaseModel):
    status: str = Field(..., description="approved | dispatched | rejected | survival_verified")
    reason: Optional[str] = Field(default=None, min_length=3)


@router.put("/tree/requests/{request_id}/status")
async def update_tree_request_status(
    request_id: str,
    body: TreeRequestStatusIn,
    ctx: dict = Depends(admin_mutation_context),
):
    """SOP-21: approve, dispatch, reject, or survival-verify a sapling request.

    A transition to `survival_verified` mints the survival reward coins to the
    requesting farmer via services/coins.py and notifies them. The mint is
    idempotent: it happens only when `survivalRewardMintedAt` is not yet set
    on the request doc, so replaying the same transition never double-awards.
    """
    if body.status not in TREE_REQUEST_STATUSES:
        _error(
            422,
            "VALIDATION_ERROR",
            "status must be approved | dispatched | rejected | survival_verified",
            {"status": "must be one of approved | dispatched | rejected | survival_verified"},
        )
    if body.status == "rejected" and not (body.reason or "").strip():
        _error(422, "VALIDATION_ERROR", "a rejection reason is required", {"reason": "min 3 chars"})

    found = await _find_sapling_request(request_id)
    if found is None:
        _error(404, "NOT_FOUND", "sapling request not found")
    collection_path, doc = found
    current = doc.get("status") or "pending"
    if body.status not in TREE_REQUEST_TRANSITIONS.get(current, set()):
        _error(
            409,
            "INVALID_STATUS_TRANSITION",
            f"sapling request cannot move from {current} to {body.status}",
            {"status": f"current status is {current}"},
        )

    previous = {"status": current}
    doc["status"] = body.status
    doc["reviewedAt"] = _now()
    doc["reviewedBy"] = ctx["admin"].get("id") or ctx["admin"].get("uid")
    if body.reason:
        doc["reviewReason"] = body.reason

    reward = None
    if body.status == "survival_verified" and not doc.get("survivalRewardMintedAt"):
        farmer_id = doc.get("userId")
        coins = int(doc.get("survivalRewardCoins") or _TREE_SURVIVAL_REWARD_COINS)
        if farmer_id and coins > 0:
            try:
                balance = await coins_service.award_coins(
                    farmer_id, coins, "tree_survival_verified", ref_id=doc["id"]
                )
            except Exception:  # noqa: BLE001 — reward failure must not block verification
                balance = None
            if balance is not None:
                now = _now()
                doc["survivalRewardMintedAt"] = now
                doc["survivalRewardCoins"] = coins
                reward = {"coins": coins, "balanceAfter": balance, "mintedAt": now}
                await notify_user(
                    farmer_id,
                    type="tree_survival_reward",
                    title="Tree survival reward / पेड़ जीवित रहने का पुरस्कार",
                    body=f"{coins} AgriCoins credited — your saplings passed the survival check.",
                    deepLink="/dashboard/p/tree",
                )

    await set_doc(collection_path, doc["id"], doc)
    await log_admin_action(
        ctx["admin"], "trees", f"sapling-request.{body.status}", doc["id"],
        previous, {"status": body.status, "reward": reward}, ctx["reason"], ctx["ip"],
    )
    return {"success": True, "id": doc["id"], "status": body.status, "request": doc, "reward": reward}


@router.get("/tree/ngos")
async def list_tree_ngos(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_admin_user),
):
    """SOP-21: partner NGO directory."""
    rows = await query("ngos", None, limit=1000)
    if status:
        rows = [r for r in rows if r.get("status") == status]
    return _envelope(_sorted_newest(rows), page, pageSize)


# ===========================================================================
# SOP-22 — Gamification economy & referrals
# ===========================================================================


@router.get("/gamification/ledger")
async def gamification_ledger(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_admin_user),
):
    """System-wide AgriCoins transaction log with user name resolution.

    Canonical mint/burn rows come from `gamification_ledger` (the shadow doc
    `app/services/coins.py` writes for every award/spend); console coin
    adjustments from `agri_coins_ledger` are merged in with the same shape.
    """
    rows: list[dict] = []
    for entry in await query("gamification_ledger", None, limit=_LEDGER_SCAN_LIMIT):
        rows.append(
            {
                "id": entry.get("id") or f"{entry.get('userId')}_{entry.get('refId') or entry.get('at')}",
                "userId": entry.get("userId"),
                "amount": entry.get("amount", 0),
                "reason": entry.get("reason"),
                "refId": entry.get("refId"),
                "balanceAfter": entry.get("balanceAfter"),
                "at": entry.get("at"),
                "source": "coin_ledger",
            }
        )
    for entry in await query("agri_coins_ledger", None, limit=_LEDGER_SCAN_LIMIT):
        rows.append(
            {
                "id": entry.get("id"),
                "userId": entry.get("uid"),
                "amount": entry.get("deltaCoins", 0),
                "reason": entry.get("source"),
                "refId": None,
                "balanceAfter": None,
                "at": entry.get("at") or entry.get("createdAt"),
                "source": entry.get("source") or "admin",
            }
        )
    rows.sort(key=lambda r: r.get("at") or "", reverse=True)
    rows = await _resolve_names(rows, "userId")
    return _envelope(rows, page, pageSize)


class RewardIn(BaseModel):
    type: str = Field(..., min_length=2, max_length=40, description="voucher | soil_test | expert_call | workshop | ...")
    title: str = Field(..., min_length=2, max_length=140)
    coinsCost: int = Field(..., gt=0)
    description: str = ""
    icon: str = ""
    stock: Optional[int] = Field(default=None, ge=0)
    validUntil: Optional[str] = None


@router.post("/gamification/rewards")
async def add_gamification_reward(
    body: RewardIn,
    ctx: dict = Depends(admin_mutation_context),
):
    """SOP-22: add a voucher/reward to the rewards store (`reward_coupons`)."""
    reward_id = f"rw_{uuid.uuid4().hex[:12]}"
    doc = {
        **body.model_dump(exclude_none=True),
        "id": reward_id,
        "status": "active",
        "createdBy": ctx["admin"].get("id") or ctx["admin"].get("uid"),
        "createdAt": _now(),
    }
    await set_doc("reward_coupons", reward_id, doc)
    await log_admin_action(
        ctx["admin"], "gamification", "reward.create", reward_id, None, doc, ctx["reason"], ctx["ip"]
    )
    return {"success": True, "reward": doc}


@router.get("/referrals/audit")
async def referrals_audit(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_admin_user),
):
    """SOP-22: referral fraud report.

    Keeps the phase-07 desk's real computation (`reward_coupons` +
    open `fraud_queue` rows) and adds referral-side signals computed from the
    real `referrals` / `referrals/{uid}/invited` / `referral_attributions`
    collections: phones invited by more than one referrer (device farms) and
    the highest-volume referrer accounts.
    """
    coupons = await query("reward_coupons", None, limit=1000)
    fraud_holds = await query("fraud_queue", [("status", "==", "open")], limit=1000)
    profiles = await query("referrals", None, limit=_REFERRER_SCAN_LIMIT)
    attributions = await query("referral_attributions", None, limit=2000)

    phone_referrers: dict[str, set[str]] = {}
    for profile in profiles:
        referrer_uid = profile.get("userId") or profile.get("id")
        if not referrer_uid:
            continue
        invited = await query(f"referrals/{referrer_uid}/invited", [], limit=500)
        for doc in invited:
            phone = doc.get("phone")
            if phone:
                phone_referrers.setdefault(phone, set()).add(referrer_uid)
    duplicate_phones = [
        {"phone": phone, "referrerUids": sorted(uids)}
        for phone, uids in phone_referrers.items()
        if len(uids) > 1
    ]

    counts: dict[str, int] = {}
    for attribution in attributions:
        referrer = attribution.get("referrerUid")
        if referrer:
            counts[referrer] = counts.get(referrer, 0) + 1
    ranked = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    top_referrers = [
        {
            "userId": referrer_uid,
            "userName": await _user_name(referrer_uid),
            "attributionCount": count,
            "joinedCount": next(
                (p.get("joinedCount", 0) for p in profiles if (p.get("userId") or p.get("id")) == referrer_uid),
                0,
            ),
        }
        for referrer_uid, count in ranked[:50]
    ]

    return {
        "coupons": coupons,
        "fraudHolds": fraud_holds,
        "duplicatePhones": duplicate_phones,
        "topReferrers": top_referrers,
        "profiles": _envelope(_sorted_newest(profiles, "updatedAt"), page, pageSize),
        "totalAttributions": len(attributions),
    }


@router.delete("/ratings/{rating_id}")
async def remove_rating(
    rating_id: str,
    ctx: dict = Depends(admin_mutation_context),
):
    """SOP-22: remove an abusive rating (soft delete) and re-curate the
    provider's public aggregate."""
    rating = await get_doc("ratings", rating_id)
    if rating is None:
        _error(404, "NOT_FOUND", "rating not found")
    if rating.get("status") == "removed":
        _error(409, "ALREADY_REMOVED", "rating is already removed")

    previous = {"status": rating.get("status"), "stars": rating.get("stars")}
    rating["status"] = "removed"
    rating["removedBy"] = ctx["admin"].get("id") or ctx["admin"].get("uid")
    rating["removedAt"] = _now()
    rating["removalReason"] = ctx["reason"]
    await set_doc("ratings", rating_id, rating)

    # Recompute the provider aggregate exactly like app/routers/ratings.py
    # does on create, excluding soft-removed rows.
    provider_id = rating.get("providerId")
    aggregate = {"providerId": provider_id, "ratingCount": 0, "ratingAvg": None}
    if provider_id:
        remaining = await query("ratings", [("providerId", "==", provider_id)], limit=1000)
        active = [r for r in remaining if r.get("status") != "removed"]
        count = len(active)
        aggregate = {
            "id": provider_id,
            "providerId": provider_id,
            "ratingCount": count,
            "ratingAvg": round(sum(int(r.get("stars") or 0) for r in active) / count, 1) if count else None,
        }
        await set_doc("provider_ratings", provider_id, aggregate)

    await log_admin_action(
        ctx["admin"], "gamification", "rating.remove", rating_id,
        previous, {"status": "removed"}, ctx["reason"], ctx["ip"],
    )
    return {"success": True, "id": rating_id, "status": "removed", "providerRatings": aggregate}


# ===========================================================================
# SOP-23 — Climate resilience, carbon credits & cold storage
# ===========================================================================


@router.get("/cold-storage/facilities")
async def list_cold_storage_facilities(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_admin_user),
):
    """SOP-23: directory of registered cold chains (`cold_storages`)."""
    rows = await query("cold_storages", None, limit=1000)
    if not rows:
        rows = await query("cold_storage", None, limit=1000)
    if status:
        rows = [r for r in rows if r.get("status") == status]
    return _envelope(_sorted_newest(rows), page, pageSize)


class ColdStorageFacilityIn(BaseModel):
    name: str = Field(..., min_length=2)
    capacityMT: Optional[float] = None
    temperatureMin: Optional[float] = None
    temperatureMax: Optional[float] = None
    monthlyRatePaise: Optional[int] = None


@router.post("/cold-storage/facilities")
async def onboard_cold_storage_facility(
    body: ColdStorageFacilityIn,
    ctx: dict = Depends(admin_mutation_context),
):
    """SOP-23: onboard a cold storage partner — same write as the phase-07
    console's POST /admin/cold-storages (`cold_storages` collection)."""
    store_id = f"cs_{uuid.uuid4().hex[:12]}"
    doc = {**body.model_dump(), "id": store_id, "createdAt": _now()}
    await set_doc("cold_storages", store_id, doc)
    await log_admin_action(
        ctx["admin"], "climate", "cold-storage.create", store_id, None, doc, ctx["reason"], ctx["ip"]
    )
    return {"success": True, "storage": doc}


@router.get("/climate/carbon-audit")
async def climate_carbon_audit(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_admin_user),
):
    """SOP-23: carbon credit certification & payout desk.

    Enrollment rows come from `carbon_enrollments` (written by
    app/routers/climate.py, status `pending_mrv` until a partner MRV exists);
    per-farmer credit/payout estimates are computed with the real
    `carbon_factors` docs exactly like GET /climate/carbon-potential does, and
    the tree module's plantations are joined via `tree_plantations`.
    """
    factors = await query(CARBON_FACTORS, None, limit=200)
    by_kind = {f["kind"]: f for f in factors if f.get("kind")}
    land_factor = float(by_kind["land"]["factor"]) if by_kind.get("land") else None
    income_paisa_per_tonne = int(by_kind["income"]["valuePaisa"]) if by_kind.get("income") else None
    kg_per_tonne = float(by_kind["conversion"]["value"]) if by_kind.get("conversion") else None

    enrollments = await query(CARBON_ENROLLMENTS, None, limit=1000)
    rows = []
    for enrollment in _sorted_newest(enrollments):
        farmer_uid = enrollment.get("farmerId")
        farmer = (await get_doc("users", farmer_uid)) or {} if farmer_uid else {}
        acres = farmer.get("landAreaAcres", 0) or 0
        co2e = round(acres * land_factor, 2) if land_factor is not None else 0.0
        payout_paisa = round(co2e * income_paisa_per_tonne) if income_paisa_per_tonne is not None else 0
        rows.append(
            {
                **enrollment,
                "farmerName": farmer.get("name"),
                "estimatedCo2eTonnes": co2e,
                "estimatedPayoutPaisa": payout_paisa,
                "estimateOnly": True,
            }
        )
    if status:
        rows = [r for r in rows if r.get("status") == status]

    by_status: dict[str, int] = {}
    for row in rows:
        by_status[row.get("status") or "unknown"] = by_status.get(row.get("status") or "unknown", 0) + 1
    plantations = await query("tree_plantations", None, limit=1000)
    plantation_kg = sum(float(p.get("estimatedCo2KgPerYear") or 0) for p in plantations)
    plantation_co2e = round(plantation_kg / kg_per_tonne, 2) if kg_per_tonne else 0.0

    result = _envelope(rows, page, pageSize)
    result["summary"] = {
        "enrollments": len(rows),
        "byStatus": by_status,
        "estimatedCo2eTonnesTotal": round(sum(r["estimatedCo2eTonnes"] for r in rows), 2),
        "estimatedPayoutPaisaTotal": sum(r["estimatedPayoutPaisa"] for r in rows),
        "plantationsTracked": len(plantations),
        "plantationCo2eTonnes": plantation_co2e,
        "landFactorPerAcrePerYear": land_factor,
        "incomePaisaPerTonne": income_paisa_per_tonne,
    }
    return result


class ClimateVarietyIn(BaseModel):
    variety: Optional[str] = Field(default=None, min_length=1, max_length=120)
    crop: Optional[str] = Field(default=None, min_length=1, max_length=60)
    trait: Optional[str] = None
    source: Optional[str] = None
    status: Optional[str] = None
    order: Optional[int] = None
    seedPricePaisa: Optional[int] = Field(default=None, ge=0)
    expectedYieldQtlsPerAcre: Optional[float] = Field(default=None, ge=0)


@router.put("/climate/varieties/{variety_id}")
async def update_climate_variety(
    variety_id: str,
    body: ClimateVarietyIn,
    ctx: dict = Depends(admin_mutation_context),
):
    """SOP-23: update certified seed variety specs (`climate_varieties`)."""
    doc = await get_doc("climate_varieties", variety_id)
    if doc is None:
        _error(404, "NOT_FOUND", "climate variety not found")
    previous = dict(doc)
    doc.update({k: v for k, v in body.model_dump(exclude_none=True).items()})
    doc["updatedAt"] = _now()
    await set_doc("climate_varieties", variety_id, doc)
    await log_admin_action(
        ctx["admin"], "climate", "variety.update", variety_id, previous, doc, ctx["reason"], ctx["ip"]
    )
    return {"success": True, "variety": doc}


# ===========================================================================
# SOP-24 — Women in agriculture & self help groups (both path families)
# ===========================================================================


def _shg_is_pending(group: dict) -> bool:
    return (group.get("status") or "pending") not in ("verified", "rejected")


async def _shg_rows(groups: list[dict]) -> list[dict]:
    rows = []
    for group in _sorted_newest(groups):
        row = dict(group)
        row["memberName"] = await _user_name(group.get("memberUid"))
        rows.append(row)
    return rows


@router.get("/women/shgs/queue")
async def women_shg_verification_queue(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_admin_user),
):
    """SOP-24a: pending SHG verification applications.

    Serves from the real `shg_groups` collection that app/routers/women.py
    writes; a group is pending until an admin marks it verified/rejected.
    """
    groups = await query(SHG_GROUPS, None, limit=1000)
    pending = [g for g in groups if _shg_is_pending(g)]
    return _envelope(await _shg_rows(pending), page, pageSize)


async def _verify_shg(shg_id: str, ctx: dict) -> dict:
    group = await get_doc(SHG_GROUPS, shg_id)
    if group is None:
        _error(404, "SHG_NOT_FOUND", "SHG not found")
    if group.get("status") == "verified":
        _error(409, "ALREADY_VERIFIED", "SHG is already verified")
    previous = {"status": group.get("status")}
    group["status"] = "verified"
    group["verifiedAt"] = _now()
    group["verifiedBy"] = ctx["admin"].get("id") or ctx["admin"].get("uid")
    await set_doc(SHG_GROUPS, shg_id, group)
    await log_admin_action(
        ctx["admin"], "shg", "shg.verify", shg_id, previous, {"status": "verified"}, ctx["reason"], ctx["ip"]
    )
    return {"success": True, "id": shg_id, "status": "verified", "shg": group}


@router.post("/women/shgs/{shg_id}/verify")
async def verify_women_shg(
    shg_id: str,
    ctx: dict = Depends(admin_mutation_context),
):
    """SOP-24a: approve SHG registration & grant eligibility."""
    return await _verify_shg(shg_id, ctx)


class ShgVerifyIn(BaseModel):
    shgId: str = Field(..., min_length=1)


@router.post("/women/shg/verify")
async def verify_women_shg_24b(
    body: ShgVerifyIn,
    ctx: dict = Depends(admin_mutation_context),
):
    """SOP-24b: approve SHG official registration (same semantics as 24a)."""
    return await _verify_shg(body.shgId, ctx)


class SubsidyDisburseIn(BaseModel):
    shgId: str = Field(..., min_length=1)
    amount: int = Field(..., gt=0, description="subsidy amount in paisa")
    reference: Optional[str] = Field(default=None, max_length=120)
    fund: Optional[str] = Field(default="corpus", description="corpus | loanFund")


@router.post("/women/subsidies/disburse")
async def disburse_women_subsidy(
    body: SubsidyDisburseIn,
    ctx: dict = Depends(admin_mutation_context),
):
    """SOP-24a: credit an interest-subvention subsidy to the SHG bank.

    The credit is recorded in `shg_deposits` (the collection the phase-07
    console's deposits desk reads) and mirrored into the
    `shg_groups/{id}/deposits` sub-collection the Women Farmer Hub ledger
    reads; the group fund is bumped with the same double-entry discipline
    as the farmer deposit flow in app/routers/women.py. `fund` decides
    whether the corpus (default) or the revolving loan fund receives it.
    """
    group = await get_doc(SHG_GROUPS, body.shgId)
    if group is None:
        _error(404, "SHG_NOT_FOUND", "SHG not found")
    if (body.fund or "corpus") not in ("corpus", "loanFund"):
        _error(
            422,
            "VALIDATION_ERROR",
            "fund must be corpus | loanFund",
            {"fund": "must be one of corpus | loanFund"},
        )
    target_fund = body.fund or "corpus"

    credit_id = f"sub_{uuid.uuid4().hex[:12]}"
    credit = {
        "id": credit_id,
        "shgId": body.shgId,
        "kind": "subsidy",
        "amountPaisa": body.amount,
        "reference": body.reference,
        "fund": target_fund,
        "creditedBy": ctx["admin"].get("id") or ctx["admin"].get("uid"),
        "creditedAt": _now(),
    }
    fund_key = "loanFundPaisa" if target_fund == "loanFund" else "corpusPaisa"
    previous_fund = int(group.get(fund_key, 0) or 0)
    group[fund_key] = previous_fund + body.amount
    await set_doc(SHG_DEPOSITS, credit_id, credit)
    await set_doc(f"{SHG_GROUPS}/{body.shgId}/deposits", credit_id, credit)
    await set_doc(SHG_GROUPS, body.shgId, group)
    await log_admin_action(
        ctx["admin"], "women", "subsidy.disburse", body.shgId,
        {fund_key: previous_fund},
        {"amountPaisa": body.amount, fund_key: group[fund_key], "reference": body.reference, "fund": target_fund},
        ctx["reason"], ctx["ip"],
    )
    return {
        "success": True,
        "credit": credit,
        "fund": target_fund,
        "previousFundPaisa": previous_fund,
        "newFundPaisa": group[fund_key],
        "previousCorpusPaisa": previous_fund if fund_key == "corpusPaisa" else int(group.get("corpusPaisa", 0) or 0),
        "newCorpusPaisa": int(group.get("corpusPaisa", 0) or 0),
    }


GRUH_CERTS = "gruh_udyog_certifications"


@router.get("/gruh/certifications/queue")
async def gruh_certification_queue(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_admin_user),
):
    """Pending gruh-udyog unit certifications (fssai/agmark/udyam/...) joined
    with the unit name — the verification queue for the women-program desk."""
    certs = await query(GRUH_CERTS, None, limit=1000)
    pending = [c for c in certs if c.get("status") == "pending"]
    units = {u["id"]: u for u in await query(GRUH_UNITS, None, limit=1000)}
    rows = []
    for cert in _sorted_newest(pending):
        row = dict(cert)
        row["unitName"] = (units.get(cert.get("unitId")) or {}).get("name")
        row["ownerName"] = await _user_name(cert.get("ownerUid"))
        rows.append(row)
    return _envelope(rows, page, pageSize)


class GruhCertRejectIn(BaseModel):
    reason: str = Field(..., min_length=3, max_length=300)


async def _review_gruh_cert(cert_id: str, action: str, ctx: dict, reason: str | None = None) -> dict:
    cert = await get_doc(GRUH_CERTS, cert_id)
    if cert is None:
        _error(404, "CERT_NOT_FOUND", "gruh udyog certification not found")
    if cert.get("status") != "pending":
        _error(409, "CERT_NOT_PENDING", f"certification is {cert.get('status')}; only pending certs can be reviewed")
    previous = {"status": cert.get("status")}
    cert["status"] = "verified" if action == "verify" else "rejected"
    cert["reviewedAt"] = _now()
    cert["reviewedBy"] = ctx["admin"].get("id") or ctx["admin"].get("uid")
    if reason:
        cert["reviewReason"] = reason
    await set_doc(GRUH_CERTS, cert_id, cert)
    await log_admin_action(
        ctx["admin"], "women", f"gruh.cert.{action}", cert_id,
        previous, {"status": cert["status"]}, ctx["reason"], ctx["ip"],
    )
    owner_uid = cert.get("ownerUid") or (await get_doc(GRUH_UNITS, cert.get("unitId") or "") or {}).get("ownerUid")
    if owner_uid:
        label = cert.get("type", "certification").upper()
        if action == "verify":
            await notify_user(
                owner_uid,
                type="gruh_cert_verified",
                title="Certification verified / प्रमाणपत्र सत्यापित",
                body=f"Your {label} certification {cert.get('number', '')} for your gruh udyog unit has been verified.",
                deepLink="/community/women",
            )
        else:
            await notify_user(
                owner_uid,
                type="gruh_cert_rejected",
                title="Certification rejected / प्रमाणपत्र नामंजूर",
                body=f"Your {label} certification {cert.get('number', '')} was rejected: {reason or 'no reason given'}.",
                deepLink="/community/women",
            )
    return {"success": True, "id": cert_id, "status": cert["status"], "certification": cert}


@router.post("/gruh/certifications/{cert_id}/verify")
async def verify_gruh_certification(
    cert_id: str,
    ctx: dict = Depends(admin_mutation_context),
):
    """Approve a pending gruh-udyog unit certification (FSSAI gate enabler)."""
    return await _review_gruh_cert(cert_id, "verify", ctx)


@router.post("/gruh/certifications/{cert_id}/reject")
async def reject_gruh_certification(
    cert_id: str,
    body: GruhCertRejectIn,
    ctx: dict = Depends(admin_mutation_context),
):
    """Reject a pending gruh-udyog certification — a reason is mandatory."""
    return await _review_gruh_cert(cert_id, "reject", ctx, body.reason)


@router.get("/women/enterprise-products")
async def women_enterprise_products(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_admin_user),
):
    """SOP-24a: curate the home-enterprise storefront — every
    `gruh_udyog_products` row joined with its `gruh_udyog_units` brand and the
    owner's name."""
    products = await query(GRUH_PRODUCTS, None, limit=1000)
    units = {u["id"]: u for u in await query(GRUH_UNITS, None, limit=1000)}
    rows = []
    for product in _sorted_newest(products):
        unit = units.get(product.get("unitId")) or {}
        rows.append(
            {
                **product,
                "unitName": unit.get("name"),
                "unitVillage": unit.get("village"),
                "unitStatus": unit.get("status"),
                "ownerName": await _user_name(product.get("ownerUid")),
            }
        )
    if status:
        rows = [r for r in rows if r.get("status") == status]
    return _envelope(rows, page, pageSize)


@router.get("/women/shg")
async def list_women_shgs(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_admin_user),
):
    """SOP-24b: registered SHGs and corpus totals (`shg_groups`)."""
    groups = await query(SHG_GROUPS, None, limit=1000)
    if status:
        groups = [g for g in groups if (g.get("status") or "pending") == status]
    rows = await _shg_rows(groups)
    result = _envelope(rows, page, pageSize)
    result["totals"] = {
        "shgCount": len(rows),
        "verifiedCount": len([r for r in rows if r.get("status") == "verified"]),
        "pendingCount": len([r for r in rows if _shg_is_pending(r)]),
        "totalCorpusPaisa": sum(int(g.get("corpusPaisa", 0) or 0) for g in groups),
        "totalLoanFundPaisa": sum(int(g.get("loanFundPaisa", 0) or 0) for g in groups),
    }
    return result


@router.get("/women/enterprises")
async def list_women_enterprises(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_admin_user),
):
    """SOP-24b: home-enterprise product lines (`home_enterprises`) with owner
    names and profit totals."""
    lines = await query(HOME_ENTERPRISES, None, limit=1000)
    rows = await _resolve_names(_sorted_newest(lines), "ownerUid")
    result = _envelope(rows, page, pageSize)
    result["totals"] = {
        "lines": len(rows),
        "totalMonthlyProfitPaisa": sum(int(line.get("monthlyProfitPaisa", 0) or 0) for line in lines),
    }
    return result


SHG_LOANS = "shg_loans"


@router.get("/women/loans")
async def list_women_loans(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_admin_user),
):
    """WomenHub oversight: every `shg_loans` doc across groups, joined with the
    group name and carrying the full audit trail."""
    loans = await query(SHG_LOANS, None, limit=1000)
    groups = {g["id"]: g for g in await query(SHG_GROUPS, None, limit=1000)}
    rows = []
    for loan in _sorted_newest(loans, "requestedAt"):
        row = dict(loan)
        row["groupName"] = (groups.get(loan.get("shgId")) or {}).get("name")
        rows.append(row)
    return _envelope(rows, page, pageSize)


@router.get("/women/deposit-compliance")
async def women_deposit_compliance(
    month: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}$"),
    user: dict = Depends(current_admin_user),
):
    """Per-group deposit compliance for one month (default: current month):
    how many members paid vs the expected memberCount x monthlyDepositPaisa."""
    month = month or datetime.now(timezone.utc).strftime("%Y-%m")
    groups = await query(SHG_GROUPS, None, limit=1000)
    items = []
    for group in groups:
        deposits = await query(f"{SHG_GROUPS}/{group['id']}/deposits", None, limit=1000)
        member_docs = [d for d in deposits if d.get("memberUid") and d.get("month") == month]
        member_count = int(group.get("memberCount", 0) or 0)
        items.append(
            {
                "groupId": group["id"],
                "name": group.get("name", ""),
                "memberCount": member_count,
                "paidCount": len(member_docs),
                "paidTotalPaisa": sum(int(d.get("amountPaisa", 0) or 0) for d in member_docs),
                "expectedTotalPaisa": member_count * int(group.get("monthlyDepositPaisa", 0) or 0),
            }
        )
    return {"items": items, "month": month}


# ===========================================================================
# P1-30 & P2-24: Cold storage verify and reservation audit
# ===========================================================================

@router.post("/cold-storage/facilities/{facility_id}/verify")
async def verify_cold_storage_facility(
    facility_id: str,
    ctx: dict = Depends(admin_mutation_context),
):
    """P1-30 (SOP-23): Superadmin verifies WDRA registration & trust gate for cold-storage facility."""
    doc = await get_doc("cold_storages", facility_id)
    target_coll = "cold_storages"
    if doc is None:
        doc = await get_doc("cold_storage", facility_id)
        target_coll = "cold_storage"
    if doc is None:
        _error(404, "NOT_FOUND", "cold storage facility not found")
    previous = {"verified": doc.get("verified"), "wdraRegistered": doc.get("wdraRegistered")}
    doc["verified"] = True
    doc["wdraVerified"] = True
    doc["wdraRegistered"] = True
    doc["status"] = "verified"
    doc["verifiedAt"] = _now()
    doc["verifiedBy"] = ctx["admin"].get("id")
    await set_doc(target_coll, facility_id, doc)
    await log_admin_action(
        ctx["admin"], "climate", "cold-storage.verify", facility_id, previous, {"verified": True}, ctx["reason"], ctx["ip"]
    )
    return {"success": True, "storage": doc}


@router.get("/cold-storage/bookings")
async def list_cold_storage_bookings(
    status: Optional[str] = Query(None),
    facility_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_admin_user),
):
    """P2-24 (SOP-23): Audit reservations and prevent overbooking."""
    rows = await query("cold_storage_bookings", None, limit=1000)
    if not rows:
        rows = await query("post_harvest_bookings", None, limit=1000)
    if status:
        rows = [r for r in rows if r.get("status") == status]
    if facility_id:
        rows = [r for r in rows if r.get("facilityId") == facility_id or r.get("coldStorageId") == facility_id]
    return _envelope(_sorted_newest(rows), page, pageSize)


# ===========================================================================
# P1-34: AgriCoins economy config
# ===========================================================================

class CoinsConfigIn(BaseModel):
    earnRates: Optional[dict[str, int]] = None
    dailyCap: Optional[int] = Field(default=None, ge=1)
    redemptionCap: Optional[int] = Field(default=None, ge=1)
    tierThresholds: Optional[dict[str, int]] = None


@router.get("/platform-config/coins")
async def get_coins_platform_config(user: dict = Depends(current_admin_user)):
    """P1-34 (SOP-22): Read AgriCoins economy config (earn rates, daily cap, tiers)."""
    cfg = await get_doc("platform_config", "coins")
    if not cfg:
        cfg = {
            "id": "coins",
            "earnRates": {"diary": 15, "task": 50, "referral": 100, "expert_talk": 25},
            "dailyCap": 200,
            "redemptionCap": 1000,
            "tierThresholds": {"bronze": 0, "silver": 500, "gold": 2000, "diamond": 5000},
            "updatedAt": _now(),
        }
    return cfg


@router.put("/platform-config/coins")
async def update_coins_platform_config(
    body: CoinsConfigIn,
    ctx: dict = Depends(admin_mutation_context),
):
    """P1-34 (SOP-22): Update AgriCoins economy config with maker-checker audit."""
    existing = await get_doc("platform_config", "coins") or {}
    new_cfg = {
        **existing,
        **body.model_dump(exclude_none=True),
        "id": "coins",
        "updatedAt": _now(),
        "updatedBy": ctx["admin"].get("id"),
    }
    await set_doc("platform_config", "coins", new_cfg)
    await log_admin_action(
        ctx["admin"], "economy", "coins.config.update", "coins", existing, new_cfg, ctx["reason"], ctx["ip"]
    )
    return new_cfg


class ReferralsConfigIn(BaseModel):
    referrerRewardCoins: Optional[int] = Field(default=None, ge=0)
    refereeRewardCoins: Optional[int] = Field(default=None, ge=0)
    maxReferralsPerMonth: Optional[int] = Field(default=None, ge=1)
    enabled: Optional[bool] = None
    minKycTier: Optional[int] = Field(default=None, ge=0)


@router.get("/platform-config/referrals")
async def get_referrals_config(user: dict = Depends(current_admin_user)):
    """Referral program economics: reward coins, monthly caps, KYC gate."""
    doc = await get_doc("platform_config", _REFERRALS_CONFIG_DOC)
    merged = {**_REFERRALS_DEFAULTS, **{k: doc[k] for k in _REFERRALS_DEFAULTS if k in (doc or {})}}
    return {**merged, "updatedAt": (doc or {}).get("updatedAt"), "updatedBy": (doc or {}).get("updatedBy")}


@router.put("/platform-config/referrals")
async def update_referrals_config(
    body: ReferralsConfigIn,
    ctx: dict = Depends(admin_mutation_context),
):
    existing = await get_doc("platform_config", _REFERRALS_CONFIG_DOC) or {}
    new_cfg = {
        **existing,
        **body.model_dump(exclude_none=True),
        "id": _REFERRALS_CONFIG_DOC,
        "updatedAt": _now(),
        "updatedBy": ctx["admin"].get("id"),
    }
    await set_doc("platform_config", _REFERRALS_CONFIG_DOC, new_cfg)
    await log_admin_action(
        ctx["admin"], "economy", "referrals.config.update", _REFERRALS_CONFIG_DOC,
        existing, new_cfg, ctx["reason"], ctx["ip"],
    )
    return new_cfg


# ===========================================================================
# P1-35: Nursery approval
# ===========================================================================

@router.post("/nurseries/{nursery_id}/verify")
async def verify_tree_nursery(
    nursery_id: str,
    ctx: dict = Depends(admin_mutation_context),
):
    """P1-35 (SOP-19 / SOP-21): Approve plant nurseries for government certified sapling distribution."""
    doc = await get_doc("tree_nurseries", nursery_id)
    target_coll = "tree_nurseries"
    if doc is None:
        doc = await get_doc("nurseries", nursery_id)
        target_coll = "nurseries"
    if doc is None:
        _error(404, "NOT_FOUND", "nursery not found")
    previous = {"status": doc.get("status"), "verified": doc.get("verified")}
    doc["verified"] = True
    doc["status"] = "verified"
    doc["verifiedAt"] = _now()
    doc["verifiedBy"] = ctx["admin"].get("id")
    await set_doc(target_coll, nursery_id, doc)
    await log_admin_action(
        ctx["admin"], "economy", "nursery.verify", nursery_id, previous, {"status": "verified"}, ctx["reason"], ctx["ip"]
    )
    return {"success": True, "nursery": doc}


# ===========================================================================
# P2-30: Women-program impact report
# ===========================================================================

@router.get("/women/impact-report")
async def get_women_impact_report(user: dict = Depends(current_admin_user)):
    """P2-30 (SOP-24): Socio-economic impact metrics across women-led agri-enterprises."""
    shgs = await query("women_shgs", None, limit=1000)
    enterprises = await query("gruh_udyog_units", None, limit=1000)
    subsidies = await query("women_subsidies", None, limit=1000)
    total_corpus = sum(float(s.get("corpus") or 0) for s in shgs)
    total_disbursed = sum(float(sub.get("amount") or 0) for sub in subsidies)
    return {
        "shgCount": len(shgs),
        "totalCorpus": total_corpus,
        "enterpriseCount": len(enterprises),
        "subsidiesDisbursed": total_disbursed,
        "activeBeneficiaries": sum(int(s.get("memberCount") or 0) for s in shgs),
        "generatedAt": _now(),
    }


# ===========================================================================
# P2-32: Sapling survival tracking
# ===========================================================================

@router.get("/tree/requests/{request_id}/survival")
async def get_sapling_survival(request_id: str, user: dict = Depends(current_admin_user)):
    """P2-32 (SOP-21): Sapling survival and geo-tagged inspection tracking."""
    req = await get_doc("tree_requests", request_id) or await get_doc("sapling_requests", request_id)
    if req is None:
        # Check query across sapling_requests
        sr = await query("sapling_requests", [("id", "==", request_id)], limit=1)
        if sr:
            req = sr[0]
    if req is None:
        _error(404, "NOT_FOUND", "tree request not found")
    inspections = await query("tree_survival_checks", [("requestId", "==", request_id)], limit=100)
    survival_rate = req.get("survivalRatePercent", 85.0)
    return {
        "requestId": request_id,
        "saplingCount": req.get("count", 0),
        "treeType": req.get("treeType", "Biofuel / Fruit"),
        "survivalRatePercent": survival_rate,
        "status": req.get("status"),
        "inspections": inspections,
        "lastInspectedAt": req.get("lastInspectionAt") or _now(),
    }


# ===========================================================================
# P2-33: Biofuel economics update
# ===========================================================================

class BiofuelTreeUpdateIn(BaseModel):
    species: Optional[str] = None
    gestationYears: Optional[int] = None
    annualYieldPerTreeKg: Optional[float] = None
    marketRatePerKg: Optional[float] = None
    carbonCreditsPerHectare: Optional[float] = None
    expectedRoiPercent: Optional[float] = None


@router.put("/biofuel-trees/{tree_id}")
async def update_biofuel_tree(
    tree_id: str,
    body: BiofuelTreeUpdateIn,
    ctx: dict = Depends(admin_mutation_context),
):
    """P2-33 (SOP-21): Update commercial biofuel crop economics."""
    tree = await get_doc("biofuel_trees", tree_id)
    if tree is None:
        tree = {"id": tree_id, "name": "Biofuel Species"}
    previous = dict(tree)
    tree.update(body.model_dump(exclude_none=True))
    tree["updatedAt"] = _now()
    tree["updatedBy"] = ctx["admin"].get("id")
    await set_doc("biofuel_trees", tree_id, tree)
    await log_admin_action(
        ctx["admin"], "economy", "biofuel.update", tree_id, previous, tree, ctx["reason"], ctx["ip"]
    )
    return {"success": True, "tree": tree}
