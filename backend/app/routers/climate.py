import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from app.core.db import query, set_doc
from app.core.deps import current_user_id
from app.routers.users import require_role
from app.services import idempotency
from app.services.users import get_user

router = APIRouter(prefix="/climate", tags=["climate"])

# Every payload here is read from Firestore (global rule 1 — no hardcoded data
# in the response path). `climate_varieties` holds the resilient catalog and
# `carbon_factors` holds the land/income/conversion factors + practices; both
# are seeded by `backend/scripts/seed_climate_data.py`.
VARIETIES_COLLECTION = "climate_varieties"
FACTORS_COLLECTION = "carbon_factors"
ENROLLMENTS_COLLECTION = "carbon_enrollments"

# Deferred(2026-10-03, phase-07): partner-MRV verification of carbon enrollments.
# Hook: enrollment docs carry `mrvPartner` (null until a partner integration
# exists) and `status` (`pending_mrv`). The UI labels this honestly.
MRV_PARTNER = None


class EnrollmentIn(BaseModel):
    plotId: str | None = None
    practices: list[str] = Field(default_factory=list)


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def _farmer(uid: str = Depends(current_user_id)) -> dict:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer")
    return user


def _factors_by_kind(factors: list[dict]) -> dict[str, dict]:
    return {f["kind"]: f for f in factors if f.get("kind")}


@router.get("/carbon-potential")
async def carbon_potential(
    lat: float | None = None,
    lng: float | None = None,
    user: dict = Depends(_farmer),
):
    """Practice-based carbon-potential estimate.

    Every number is an **estimate, not credits** — the UI renders the
    `carbonEstimateNotCredits` label next to it until a partner MRV exists.
    """
    factors = await query(FACTORS_COLLECTION, [], limit=200)
    by_kind = _factors_by_kind(factors)
    land_factor = by_kind.get("land")
    income_factor = by_kind.get("income")
    conversion = by_kind.get("conversion")
    practices = sorted(
        (f for f in factors if f.get("kind") == "practice"),
        key=lambda f: f.get("order", 0),
    )

    acres = user.get("landAreaAcres", 0) or 0
    co2e = round(acres * float(land_factor["factor"]), 1) if land_factor else 0
    annual_income_paisa = (
        round(co2e * float(income_factor["valuePaisa"])) if income_factor else 0
    )

    # Join the tree module's plantations into the same estimate (task 7.15).
    plantations = await query(f"users/{user['id']}/tree_plantations", [], limit=500)
    total_kg = sum(float(p.get("estimatedCo2KgPerYear") or 0) for p in plantations)
    kg_per_tonne = float(conversion["value"]) if conversion else 0
    plantation_estimate = round(total_kg / kg_per_tonne, 2) if kg_per_tonne else 0

    return {
        "co2eTonnes": co2e,
        "annualIncomePotential": annual_income_paisa // 100,
        "annualIncomePotentialPaisa": annual_income_paisa,
        "practices": [f["practice"] for f in practices],
        "plantation_estimate": plantation_estimate,
        "estimateOnly": True,
    }


@router.get("/resilient-varieties")
async def resilient_varieties(
    crop: str | None = None,
    district: str | None = None,
    user: dict = Depends(_farmer),
):
    items = await query(VARIETIES_COLLECTION, [], limit=200)
    items.sort(key=lambda v: v.get("order", 0))
    if crop:
        needle = crop.lower()
        items = [v for v in items if needle in str(v.get("crop", "")).lower()]
    return {"data": items, "page": 1, "pageSize": 20, "total": len(items)}


@router.get("/enrollments/mine")
async def list_my_enrollments(user: dict = Depends(_farmer)):
    docs = await query(ENROLLMENTS_COLLECTION, [("farmerId", "==", user["id"])], limit=100)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return {"data": docs, "page": 1, "pageSize": 20, "total": len(docs)}


@router.post("/enrollments", status_code=201)
async def create_enrollment(
    body: EnrollmentIn,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    user: dict = Depends(_farmer),
):
    """Enroll a plot in the carbon-farming program (status `pending_mrv`).

    Real verification depends on a partner MRV integration that does not exist
    yet — the docs stay `pending_mrv` with `mrvPartner: null` (honest placeholder).
    """
    scope = f"climate.enroll.{user['id']}"
    replayed = await idempotency.replay(scope, idempotency_key)
    if replayed is not None:
        return replayed

    enrollment_id = f"enr_{uuid.uuid4().hex[:12]}"
    doc = {
        "id": enrollment_id,
        "farmerId": user["id"],
        "plotId": body.plotId,
        "practices": body.practices,
        "status": "pending_mrv",
        "mrvPartner": MRV_PARTNER,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc(ENROLLMENTS_COLLECTION, enrollment_id, doc)
    if idempotency_key:
        await idempotency.store(scope, idempotency_key, doc)
    return doc
