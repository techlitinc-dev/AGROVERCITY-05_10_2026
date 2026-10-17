"""Superadmin SOP router — FPO engine & pools, livestock/dairy/vet network,
content CMS & workshops (SOP-18/19/20).

Implements the doc-18/19/20 console contract:
  GET  /admin/fpo                              — FPO list + membership counts
  POST /admin/fpo/verify/{id}                  — approve FPO credentials
  POST /admin/fpo/pools                        — create platform-sponsored pool
  PUT  /admin/fpo/pools/{id}/status            — close pool / change status
  GET  /admin/livestock/vets                   — vets + verification status
  POST /admin/livestock/vets/{id}/verify       — verify vet credentials/license
  GET  /admin/livestock/gaushalas              — gaushalas + offerings
  GET  /admin/livestock/orders                 — audit dairy + manure orders
  GET/POST /admin/content/{collection}         — generic CMS list/create
  PUT/DELETE /admin/content/{collection}/{id}  — generic CMS update/remove
  GET  /admin/workshops/{id}/roster            — enrolled farmers for a workshop

The doc-named collections `agri_news`, `agri_channels`, `video_guides` and
`blog_articles` have no user-facing writer; the platform serves that content
from `news`, `channels`, `videos` and `blogs` (see routers/content.py,
routers/gyan.py and the app/data seeds), so the CMS whitelist maps each doc
name to the real collection behind the live surface.
"""
import asyncio
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from app.core.db import delete_doc, get_doc, query, set_doc
from app.services.admin_auth import admin_mutation_context, current_admin_user
from app.services.audit import log_admin_action

router = APIRouter(prefix="/admin", tags=["admin"])

# Doc-20 names -> real collections used by routers/content.py, routers/gyan.py
# and the app/data seeds. Unknown names are rejected with 404.
CONTENT_COLLECTIONS = {
    "news": "news",
    "agri_news": "news",
    "channels": "channels",
    "agri_channels": "channels",
    "workshops": "workshops",
    "expert_talks": "expert_talks",
    "videos": "videos",
    "video_guides": "videos",
    "blogs": "blogs",
    "blog_articles": "blogs",
}

POOL_STATUSES = frozenset({"open", "closed", "cancelled"})
POOL_TERMINAL_STATUSES = frozenset({"closed", "cancelled"})


def _error(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": {}},
    )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _paginate(docs: list, page: int, page_size: int) -> dict:
    start = (page - 1) * page_size
    return {
        "data": docs[start : start + page_size],
        "page": page,
        "pageSize": page_size,
        "total": len(docs),
    }


def _created_key(doc: dict) -> str:
    """Newest-first sort key across doc shapes (createdAt / timestamp / orderDate)."""
    return doc.get("createdAt") or doc.get("timestamp") or doc.get("orderDate") or ""


def _resolve_collection(collection: str) -> str:
    real = CONTENT_COLLECTIONS.get(collection)
    if real is None:
        _error(404, "UNKNOWN_COLLECTION", f"unknown content collection: {collection}")
    return real


# ===========================================================================
# SOP-18 — FPO engine & bulk procurement pools
# ===========================================================================
@router.get("/fpo")
async def list_fpos(
    status: str = Query("all"),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_admin_user),
):
    """Registered FPOs with computed membership counts and pool counts."""
    fpos = await query("fpos", [], limit=1000)
    users = await query("users", [], limit=1000)
    join_requests = await query("fpo_join_requests", [], limit=1000)
    pools = await query("fpo_pools", [], limit=1000)

    member_ids: dict[str, set] = {}
    for u in users:
        uid = u.get("id")
        if not uid:
            continue
        memberships = set(u.get("fpoMemberships") or [])
        if u.get("fpoId"):
            memberships.add(u["fpoId"])
        for fpo_id in memberships:
            member_ids.setdefault(fpo_id, set()).add(uid)
    for req in join_requests:
        if req.get("status") == "approved" and req.get("fpoId") and req.get("farmerId"):
            member_ids.setdefault(req["fpoId"], set()).add(req["farmerId"])
    pools_count: dict[str, int] = {}
    for pool in pools:
        fpo_id = pool.get("fpoId")
        if fpo_id:
            pools_count[fpo_id] = pools_count.get(fpo_id, 0) + 1

    rows = []
    for fpo in fpos:
        if status and status != "all" and fpo.get("status", "pending") != status:
            continue
        if search:
            needle = search.lower()
            haystack = " ".join(
                str(fpo.get(k) or "") for k in ("id", "name", "district", "phone")
            ).lower()
            if needle not in haystack:
                continue
        fpo_id = fpo.get("id") or ""
        rows.append(
            {
                **fpo,
                "membershipCount": len(member_ids.get(fpo_id, set())),
                "poolsCount": pools_count.get(fpo_id, 0),
            }
        )
    rows.sort(key=_created_key, reverse=True)
    return _paginate(rows, page, pageSize)


@router.post("/fpo/verify/{fpo_id}")
async def verify_fpo(fpo_id: str, ctx: dict = Depends(admin_mutation_context)):
    """Approve FPO credential verification (same semantics as the legacy
    POST /admin/fpos/{fpo_id}/verify, plus the farmer-facing
    `verification_status` field routers/fpo.py reads)."""
    doc = await get_doc("fpos", fpo_id)
    if doc is None:
        _error(404, "FPO_NOT_FOUND", "fpo not found")
    previous = {"status": doc.get("status"), "verification_status": doc.get("verification_status")}
    doc["status"] = "verified"
    doc["verification_status"] = "verified"
    doc["verifiedAt"] = _now()
    doc["updatedAt"] = _now()
    await set_doc("fpos", fpo_id, doc)
    await log_admin_action(
        ctx["admin"], "fpo", "fpo.verified", fpo_id, previous,
        {"status": "verified", "verification_status": "verified"},
        ctx["reason"], ctx["ip"],
    )
    return {"success": True, "id": fpo_id, "status": "verified"}


class FpoPoolIn(BaseModel):
    item: str = Field(..., min_length=2)
    targetUnits: int = Field(..., ge=1)
    fpoId: Optional[str] = None
    discountPercent: float = Field(default=0.0, ge=0, le=100)
    deadline: Optional[str] = None


@router.post("/fpo/pools", status_code=201)
async def create_fpo_pool(body: FpoPoolIn, ctx: dict = Depends(admin_mutation_context)):
    """Create a platform-sponsored group-buy pool (SOP-18)."""
    fpo_name = None
    if body.fpoId:
        fpo = await get_doc("fpos", body.fpoId)
        if fpo is None:
            _error(404, "FPO_NOT_FOUND", "fpo not found")
        fpo_name = fpo.get("name")
    pool_id = f"pool_{uuid.uuid4().hex[:12]}"
    doc = {
        "id": pool_id,
        "fpoId": body.fpoId or "",
        "fpoName": fpo_name or "Platform Sponsored",
        "item": body.item,
        "bookedUnits": 0,
        "targetUnits": body.targetUnits,
        "discountPercent": body.discountPercent,
        "deadline": body.deadline or "",
        "status": "open",
        "sponsoredBy": ctx["admin"].get("id") or ctx["admin"].get("uid"),
        "createdAt": _now(),
    }
    await set_doc("fpo_pools", pool_id, doc)
    await log_admin_action(
        ctx["admin"], "fpo", "pool.create", pool_id, None, doc, ctx["reason"], ctx["ip"]
    )
    return {"success": True, "pool": doc}


class FpoPoolStatusIn(BaseModel):
    status: str = Field(..., description="open | closed | cancelled")


@router.put("/fpo/pools/{pool_id}/status")
async def update_fpo_pool_status(
    pool_id: str,
    body: FpoPoolStatusIn,
    ctx: dict = Depends(admin_mutation_context),
):
    """Close a pool and trigger the supplier purchase order (SOP-18)."""
    if body.status not in POOL_STATUSES:
        _error(422, "INVALID_STATUS", "status must be one of open, closed, cancelled")
    pool = await get_doc("fpo_pools", pool_id)
    if pool is None:
        _error(404, "POOL_NOT_FOUND", "pool not found")
    current = pool.get("status", "open")
    if current == body.status:
        _error(409, "STATUS_ALREADY_SET", f"pool is already '{current}'")
    if current in POOL_TERMINAL_STATUSES:
        _error(409, "POOL_ALREADY_CLOSED", f"pool is '{current}' and cannot change status")

    previous = {"status": current}
    pool["status"] = body.status
    pool["updatedAt"] = _now()
    purchase_ref = None
    if body.status == "closed":
        purchase_ref = f"PO-{datetime.now(timezone.utc):%Y%m%d}-{pool_id}"
        pool["closedAt"] = _now()
        pool["purchaseOrderRef"] = purchase_ref
    await set_doc("fpo_pools", pool_id, pool)
    await log_admin_action(
        ctx["admin"], "fpo", "pool.status", pool_id, previous,
        {"status": body.status, "purchaseOrderRef": purchase_ref},
        ctx["reason"], ctx["ip"],
    )
    result = {"success": True, "id": pool_id, "status": body.status}
    if purchase_ref:
        result["purchaseOrderRef"] = purchase_ref
    return result


# ===========================================================================
# SOP-19 — livestock, dairy & veterinary network
# ===========================================================================
@router.get("/livestock/vets")
async def list_livestock_vets(
    credentialStatus: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_admin_user),
):
    """Vet doctors with credential verification status (`credentialStatus`
    defaults to `pending` for records predating WS-06 verification)."""
    docs = await query("vets", [], limit=1000)
    rows = []
    for doc in docs:
        row = dict(doc)
        row["credentialStatus"] = doc.get("credentialStatus", "pending")
        row["claimed"] = bool(doc.get("claimedByUid"))
        if credentialStatus and row["credentialStatus"] != credentialStatus:
            continue
        if status and doc.get("status", "active") != status:
            continue
        if search:
            needle = search.lower()
            haystack = " ".join(
                str(doc.get(k) or "")
                for k in ("id", "name", "phone", "qualification", "vetCouncilRegNo", "clinicAddress")
            ).lower()
            if needle not in haystack:
                continue
        rows.append(row)
    rows.sort(key=_created_key, reverse=True)
    return _paginate(rows, page, pageSize)


@router.post("/livestock/vets/{vet_id}/verify")
async def verify_livestock_vet(
    vet_id: str,
    ctx: dict = Depends(admin_mutation_context),
):
    """Verify vet credentials/license. Sets the WS-06 `credentialStatus` the
    vet workspace gates on, matching the legacy POST /admin/vets/{id}/verify
    status semantics."""
    doc = await get_doc("vets", vet_id)
    if doc is None:
        _error(404, "VET_NOT_FOUND", "vet not found")
    previous = {"status": doc.get("status"), "credentialStatus": doc.get("credentialStatus")}
    doc["status"] = "verified"
    doc["credentialStatus"] = "verified"
    doc["credentialUpdatedAt"] = _now()
    await set_doc("vets", vet_id, doc)
    await log_admin_action(
        ctx["admin"], "vets", "vets.verified", vet_id, previous,
        {"status": "verified", "credentialStatus": "verified"},
        ctx["reason"], ctx["ip"],
    )
    return {"success": True, "id": vet_id, "status": "verified"}


@router.get("/livestock/gaushalas")
async def list_livestock_gaushalas(
    district: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_admin_user),
):
    """Gaushala directory with computed product/service offerings."""
    docs = await query("gaushalas", [], limit=1000)
    products = await query("panchagavya_products", [], limit=1000)
    products_by_gaushala: dict[str, list] = {}
    for product in products:
        gid = product.get("gaushalaId")
        if gid:
            products_by_gaushala.setdefault(gid, []).append(product)

    rows = []
    for doc in docs:
        if district and doc.get("district") != district:
            continue
        if search:
            needle = search.lower()
            haystack = " ".join(
                str(doc.get(k) or "") for k in ("id", "name", "trustName", "district", "phone")
            ).lower()
            if needle not in haystack:
                continue
        offerings = []
        if doc.get("providesOrganicManure"):
            offerings.append("organic_manure")
        if doc.get("offersCowAdoption"):
            offerings.append("cow_adoption")
        row = dict(doc)
        row["offerings"] = offerings
        row["panchagavyaProducts"] = products_by_gaushala.get(doc.get("id") or "", [])
        rows.append(row)
    rows.sort(key=_created_key, reverse=True)
    return _paginate(rows, page, pageSize)


@router.get("/livestock/orders")
async def audit_livestock_orders(
    source: Optional[str] = Query(None, description="milk_sale | manure | dairy_product"),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_admin_user),
):
    """Audit dairy + manure orders across the network.

    Aggregates the real order stores into one envelope, each row tagged with
    its `source`: `milk_sale` (top-level `milk_sale_orders` from
    routers/livestock_dairy.py), `manure` and `dairy_product` (per-user
    `users/{uid}/manure_orders` / `users/{uid}/dairy_orders` from
    routers/livestock.py — no top-level writer exists for either).
    """
    rows = []

    milk_orders = await query("milk_sale_orders", [], limit=1000)
    rows.extend({**doc, "source": "milk_sale"} for doc in milk_orders)

    users = await query("users", [], limit=1000)

    async def _user_order_docs(u: dict):
        uid = u.get("id")
        if not uid:
            return [], []
        manure = await query(f"users/{uid}/manure_orders", [], limit=200)
        dairy = await query(f"users/{uid}/dairy_orders", [], limit=200)
        return manure, dairy

    for u, (manure, dairy) in zip(
        users, await asyncio.gather(*[_user_order_docs(u) for u in users])
    ):
        uid = u.get("id")
        rows.extend({**doc, "source": "manure", "userId": uid} for doc in manure)
        rows.extend({**doc, "source": "dairy_product", "userId": uid} for doc in dairy)

    if source:
        rows = [r for r in rows if r.get("source") == source]
    if status:
        rows = [r for r in rows if r.get("status") == status]
    rows.sort(key=_created_key, reverse=True)
    return _paginate(rows, page, pageSize)


# ===========================================================================
# SOP-20 — knowledge hub, content CMS & live media
# ===========================================================================
class ContentItemIn(BaseModel):
    """Generic CMS item body — common fields validated, any extra field allowed."""

    model_config = ConfigDict(extra="allow")

    title: Optional[str] = Field(default=None, min_length=1)
    status: Optional[str] = None


@router.get("/content/{collection}")
async def list_content(
    collection: str,
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_admin_user),
):
    """List and paginate CMS content items for a whitelisted collection."""
    real = _resolve_collection(collection)
    docs = await query(real, [], limit=1000)
    rows = []
    for doc in docs:
        if status and doc.get("status") != status:
            continue
        if search:
            needle = search.lower()
            haystack = " ".join(
                str(doc.get(k) or "")
                for k in ("id", "title", "vernacularTitle", "channelName", "programTitle", "body")
            ).lower()
            if needle not in haystack:
                continue
        rows.append(doc)
    rows.sort(key=_created_key, reverse=True)
    return _paginate(rows, page, pageSize)


@router.post("/content/{collection}", status_code=201)
async def create_content(
    collection: str,
    body: ContentItemIn,
    ctx: dict = Depends(admin_mutation_context),
):
    """Create a content item (news, channel, workshop, talk, video, blog)."""
    real = _resolve_collection(collection)
    item_id = f"{collection}_{uuid.uuid4().hex[:12]}"
    payload = body.model_dump(exclude_none=True)
    doc = {
        **payload,
        "id": item_id,
        "status": body.status or "published",
        "createdAt": _now(),
        "createdBy": ctx["admin"].get("id") or ctx["admin"].get("uid"),
    }
    await set_doc(real, item_id, doc)
    await log_admin_action(
        ctx["admin"], "content", f"content.{collection}.create", item_id, None, doc,
        ctx["reason"], ctx["ip"],
    )
    return {"success": True, "collection": collection, "item": doc}


@router.put("/content/{collection}/{item_id}")
async def update_content(
    collection: str,
    item_id: str,
    body: ContentItemIn,
    ctx: dict = Depends(admin_mutation_context),
):
    """Update a content item's details."""
    real = _resolve_collection(collection)
    doc = await get_doc(real, item_id)
    if doc is None:
        _error(404, "NOT_FOUND", f"{collection} item not found")
    previous = dict(doc)
    patch = body.model_dump(exclude_none=True)
    patch.pop("id", None)
    doc.update(patch)
    doc["updatedAt"] = _now()
    await set_doc(real, item_id, doc)
    await log_admin_action(
        ctx["admin"], "content", f"content.{collection}.update", item_id, previous, doc,
        ctx["reason"], ctx["ip"],
    )
    return {"success": True, "collection": collection, "item": doc}


@router.delete("/content/{collection}/{item_id}")
async def delete_content(
    collection: str,
    item_id: str,
    ctx: dict = Depends(admin_mutation_context),
):
    """Remove a content item."""
    real = _resolve_collection(collection)
    doc = await get_doc(real, item_id)
    if doc is None:
        _error(404, "NOT_FOUND", f"{collection} item not found")
    await delete_doc(real, item_id)
    await log_admin_action(
        ctx["admin"], "content", f"content.{collection}.delete", item_id, doc, None,
        ctx["reason"], ctx["ip"],
    )
    return {"success": True, "collection": collection, "id": item_id}


@router.get("/workshops/{workshop_id}/roster")
async def workshop_roster(
    workshop_id: str,
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_admin_user),
):
    """Enrolled farmers for a workshop, resolved against user docs.

    Enrollment docs live in the per-user `users/{uid}/workshop_enrollments`
    subcollection (written by routers/gyan.py); there is no top-level
    enrollment collection, so users are scanned and each subcollection is
    queried for the workshop id.
    """
    workshop = await get_doc("workshops", workshop_id)
    if workshop is None:
        _error(404, "WORKSHOP_NOT_FOUND", "workshop not found")

    users = await query("users", [], limit=1000)

    async def _enrollments(u: dict):
        uid = u.get("id")
        if not uid:
            return []
        return await query(
            f"users/{uid}/workshop_enrollments",
            [("workshopId", "==", workshop_id)],
            limit=20,
        )

    rows = []
    for u, enrollments in zip(
        users, await asyncio.gather(*[_enrollments(u) for u in users])
    ):
        for enrollment in enrollments:
            rows.append(
                {
                    **enrollment,
                    "userId": u.get("id"),
                    "userName": u.get("name", ""),
                    "userPhone": u.get("phone", ""),
                }
            )
    rows.sort(key=lambda r: r.get("enrolledAt") or r.get("createdAt") or "", reverse=True)
    return {**_paginate(rows, page, pageSize), "workshop": workshop}
