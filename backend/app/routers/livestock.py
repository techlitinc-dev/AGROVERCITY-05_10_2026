import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.livestock import (
    Animal,
    AnimalIn,
    AnimalYieldLog,
    AnimalYieldLogIn,
    BreedingCycle,
    BreedingCycleIn,
    CowAdoption,
    CowAdoptionIn,
    DairyOrderIn,
    FodderDonation,
    FodderDonationIn,
    ManureOrderIn,
    MilkCollection,
    MilkCollectionIn,
    MilkProcurementSummary,
    PanchagavyaProduct,
    PanchagavyaProductIn,
    RateChartCalcIn,
    RateChartCalcOut,
    VaccinationSchedule,
    VaccinationScheduleIn,
    VetBookIn,
    VetRecord,
    VetRecordIn,
)
from app.routers.ratings import provider_rating_fields
from app.routers.users import require_role
from app.services.users import get_user

router = APIRouter(tags=["livestock"])


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def _any_livestock_user(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer", "seller", "dairyManager")
    return uid


async def _farmer_seller(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer", "seller", "dairyManager")
    return uid


async def _farmer(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer", "dairyManager")
    return uid


def _envelope(docs: list[dict], page: int, page_size: int) -> dict:
    total = len(docs)
    start = (page - 1) * page_size
    return {"data": docs[start:start + page_size], "page": page, "pageSize": page_size, "total": total}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# =========================================================================
# 1. Baseline & Legacy Compatible Endpoints
# =========================================================================

@router.get("/gaushalas")
async def list_gaushalas(
    district: str | None = None,
    lat: float | None = None,
    lng: float | None = None,
    page: int = 1,
    pageSize: int = 20,
    uid: str = Depends(_farmer_seller),
):
    docs = await query("gaushalas", [], limit=500)
    if district:
        docs = [d for d in docs if d.get("district") == district]
    docs.sort(key=lambda d: d.get("distanceKm", 0))
    return _envelope(docs, page, pageSize)


@router.post("/gaushalas/{gaushala_id}/manure-order", status_code=201)
async def order_manure(gaushala_id: str, body: ManureOrderIn, uid: str = Depends(_farmer)):
    if await get_doc("gaushalas", gaushala_id) is None:
        _error(404, "GAUSHALA_NOT_FOUND", "gaushala not found")
    order_id = f"mo_{uuid.uuid4().hex[:12]}"
    await set_doc(
        f"users/{uid}/manure_orders",
        order_id,
        {
            "id": order_id,
            "product": body.product,
            "quantity": body.quantity,
            "gaushalaId": gaushala_id,
            "status": "placed",
            "createdAt": _now(),
        },
    )
    return {"orderId": order_id, "status": "placed"}


@router.get("/nurseries")
async def list_nurseries(
    lat: float | None = None,
    lng: float | None = None,
    page: int = 1,
    pageSize: int = 20,
    uid: str = Depends(_farmer_seller),
):
    docs = await query("nurseries", [], limit=500)
    docs.sort(key=lambda d: d.get("distanceKm", 0))
    return _envelope(docs, page, pageSize)


@router.get("/vets")
async def list_vets(
    lat: float | None = None,
    lng: float | None = None,
    emergency: bool = False,
    page: int = 1,
    pageSize: int = 20,
    uid: str = Depends(_farmer),
):
    docs = await query("vets", [], limit=500)
    if emergency:
        docs = [d for d in docs if d.get("emergencyAvailable")]
    docs.sort(key=lambda d: d.get("distanceKm", 0))
    for doc in docs:
        doc.update(await provider_rating_fields(doc["id"]))
    return _envelope(docs, page, pageSize)


@router.post("/vets/{vet_id}/book", status_code=201)
async def book_vet(vet_id: str, body: VetBookIn, uid: str = Depends(_farmer)):
    vet = await get_doc("vets", vet_id)
    if vet is None:
        _error(404, "VET_NOT_FOUND", "vet not found")
    if body.visitType == "farm" and not vet.get("availableForFarmVisit"):
        _error(400, "FARM_VISIT_UNAVAILABLE", "यह डॉक्टर फ़ार्म विज़िट नहीं करते")
    booking_id = f"vetb_{uuid.uuid4().hex[:12]}"
    booking = {
        "id": booking_id,
        "vetId": vet_id,
        "vetName": vet["name"],
        "visitType": body.visitType,
        "slot": body.slot,
        "animalType": body.animalType,
        "consultationFeeRupees": vet["consultationFeeRupees"],
        "status": "confirmed",
        "createdAt": _now(),
    }
    await set_doc(f"users/{uid}/vet_bookings", booking_id, booking)
    return booking


@router.get("/dairy-products")
async def list_dairy_products(
    category: str | None = None,
    page: int = 1,
    pageSize: int = 20,
    uid: str = Depends(_farmer_seller),
):
    docs = await query("dairy_products", [], limit=500)
    if category:
        docs = [d for d in docs if d.get("category") == category]
    docs.sort(key=lambda d: d.get("id", ""))
    return _envelope(docs, page, pageSize)


@router.post("/dairy-products/{product_id}/order", status_code=201)
async def order_dairy(product_id: str, body: DairyOrderIn, uid: str = Depends(_farmer_seller)):
    product = await get_doc("dairy_products", product_id)
    if product is None:
        _error(404, "PRODUCT_NOT_FOUND", "dairy product not found")
    if not product.get("inStock"):
        _error(409, "OUT_OF_STOCK", "स्टॉक में नहीं")
    order_id = f"do_{uuid.uuid4().hex[:12]}"
    total = product["price"] * body.quantity
    await set_doc(
        f"users/{uid}/dairy_orders",
        order_id,
        {
            "id": order_id,
            "productId": product_id,
            "quantity": body.quantity,
            "total": total,
            "status": "placed",
            "createdAt": _now(),
        },
    )
    return {"orderId": order_id, "total": total}


# =========================================================================
# 2. Cattle & Herd Management (Pashu Aadhaar)
# =========================================================================

@router.post("/livestock/animals", status_code=201, response_model=Animal)
async def register_animal(body: AnimalIn, uid: str = Depends(_any_livestock_user)):
    user = await get_user(uid)
    gaushala_id = ""
    cattle_status = ""
    owner_type = body.ownerType
    if body.gaushalaId:
        gaushalas = await query("gaushalas", [("managerId", "==", uid)], limit=10)
        if not any(g.get("id") == body.gaushalaId for g in gaushalas):
            _error(404, "GAUSHALA_NOT_FOUND", "gaushala not found for this manager")
        gaushala_id = body.gaushalaId
        cattle_status = "in-shelter"
        owner_type = "gaushala"
    animal_id = f"c_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": animal_id,
        "tagId": body.tagId,
        "name": body.name,
        "species": body.species,
        "breed": body.breed,
        "gender": body.gender,
        "ageMonths": body.ageMonths,
        "lactationStatus": body.lactationStatus,
        "lactationCycle": body.lactationCycle,
        "dailyYieldLiters": body.dailyYieldLiters,
        "sire": body.sire,
        "dam": body.dam,
        "healthStatus": body.healthStatus,
        "ownerType": owner_type,
        "ownerId": uid,
        "ownerName": (user.get("name") if user else "") or "पशुपालक शेतकरी",
        "photoUrl": body.photoUrl,
        "createdAt": _now(),
    }
    if gaushala_id:
        doc["gaushalaId"] = gaushala_id
        doc["cattleStatus"] = cattle_status
        doc["events"] = [{"type": "intake", "note": "registered", "date": _now()[:10], "at": _now()}]
    await set_doc("livestock_animals", animal_id, doc)
    return doc


@router.get("/livestock/animals")
async def list_animals(
    species: str | None = None,
    ownerType: str | None = None,
    tagId: str | None = None,
    page: int = 1,
    pageSize: int = 50,
    uid: str = Depends(_any_livestock_user),
):
    docs = await query("livestock_animals", [], limit=500)
    user = await get_user(uid)
    if (user or {}).get("activeProfile") == "dairyManager":
        gaushalas = await query("gaushalas", [("managerId", "==", uid)], limit=10)
        gaushala_ids = {g.get("id") for g in gaushalas}
        docs = [
            d for d in docs
            if d.get("ownerId") == uid or (gaushala_ids and d.get("gaushalaId") in gaushala_ids)
        ]
    else:
        docs = [d for d in docs if d.get("ownerId") == uid]
    if species:
        docs = [d for d in docs if d.get("species") == species]
    if ownerType:
        docs = [d for d in docs if d.get("ownerType") == ownerType]
    if tagId:
        docs = [d for d in docs if tagId.lower() in d.get("tagId", "").lower()]
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return _envelope(docs, page, pageSize)


@router.get("/livestock/animals/{animal_id}", response_model=Animal)
async def get_animal(animal_id: str, uid: str = Depends(_any_livestock_user)):
    doc = await get_doc("livestock_animals", animal_id)
    if not doc:
        _error(404, "ANIMAL_NOT_FOUND", "Animal not found")
    return doc


@router.post("/livestock/animals/{animal_id}/logs", status_code=201, response_model=AnimalYieldLog)
async def add_animal_log(animal_id: str, body: AnimalYieldLogIn, uid: str = Depends(_any_livestock_user)):
    animal = await get_doc("livestock_animals", animal_id)
    if not animal:
        _error(404, "ANIMAL_NOT_FOUND", "Animal not found")
    log_id = f"yl_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": log_id,
        "animalId": animal_id,
        "tagId": animal.get("tagId", ""),
        "date": body.date,
        "shift": body.shift,
        "yieldLiters": body.yieldLiters,
        "fatPercent": body.fatPercent,
        "snfPercent": body.snfPercent,
        "notes": body.notes,
        "loggedAt": _now(),
    }
    await set_doc(f"livestock_animals/{animal_id}/yield_logs", log_id, doc)
    return doc


@router.get("/livestock/animals/{animal_id}/logs")
async def list_animal_logs(animal_id: str, uid: str = Depends(_any_livestock_user)):
    docs = await query(f"livestock_animals/{animal_id}/yield_logs", [], limit=200)
    docs.sort(key=lambda d: d.get("date", ""), reverse=True)
    return {"data": docs}


# =========================================================================
# 3. Dairy Operations & Milk Procurement
# =========================================================================

def _calculate_milk_rate(milk_type: str, fat: float, snf: float) -> tuple[float, float, float, float, str]:
    """Calculates milk rate per liter based on FAT % & SNF % standards in India."""
    if milk_type == "buffalo":
        base_rate = 55.0
        fat_diff = fat - 6.0
        snf_diff = snf - 9.0
        fat_premium = round(fat_diff * 5.0, 2)
        snf_premium = round(snf_diff * 3.0, 2)
        rate = max(42.0, base_rate + fat_premium + snf_premium)
        formula = "म्हैस दूध: Base ₹55.00 (FAT 6.0%, SNF 9.0%) + FAT/SNF प्रीमियम"
    else:
        base_rate = 35.0
        fat_diff = fat - 3.5
        snf_diff = snf - 8.5
        fat_premium = round(fat_diff * 4.0, 2)
        snf_premium = round(snf_diff * 2.5, 2)
        rate = max(28.0, base_rate + fat_premium + snf_premium)
        formula = "गाय दूध: Base ₹35.00 (FAT 3.5%, SNF 8.5%) + FAT/SNF प्रीमियम"
    return round(rate, 2), base_rate, fat_premium, snf_premium, formula


@router.post("/livestock/procurement/rate-calc", response_model=RateChartCalcOut)
async def calculate_rate_chart(body: RateChartCalcIn):
    rate, base, fat_p, snf_p, formula = _calculate_milk_rate(body.milkType, body.fatPercent, body.snfPercent)
    total = round(rate * body.liters, 2)
    return {
        "milkType": body.milkType,
        "fatPercent": body.fatPercent,
        "snfPercent": body.snfPercent,
        "liters": body.liters,
        "ratePerLiter": rate,
        "totalAmount": total,
        "baseRate": base,
        "fatPremium": fat_p,
        "snfPremium": snf_p,
        "formula": formula,
    }


async def _active_center_chart(center_id: str, species: str) -> dict | None:
    charts = await query(
        "rate_charts",
        [("centerId", "==", center_id), ("species", "==", species), ("active", "==", True)],
        limit=10,
    )
    if not charts:
        return None
    charts.sort(key=lambda d: d.get("effectiveFrom", ""), reverse=True)
    return charts[0]


def _chart_based_rate(chart: dict, fat: float, snf: float) -> float:
    min_fat = chart.get("minFat", 0.0)
    min_snf = chart.get("minSnf", 0.0)
    min_rate = chart.get("minRate", 0.0)
    if (min_fat and fat < min_fat) or (min_snf and snf < min_snf):
        return round(min_rate, 2)
    rate = chart.get("baseRate", 0.0)
    rate += (fat - chart.get("fatBase", 0.0)) * chart.get("fatStep", 0.0)
    rate += (snf - chart.get("snfBase", 0.0)) * chart.get("snfStep", 0.0)
    if min_rate:
        rate = max(rate, min_rate)
    return round(rate, 2)


def _scoped_collections(docs: list[dict], user: dict | None, uid: str) -> list[dict]:
    profile = (user or {}).get("activeProfile", "")
    if profile == "dairyManager":
        return [d for d in docs if d.get("dairyId") == uid]
    return [d for d in docs if d.get("farmerId") == uid or d.get("dairyId") == uid]


@router.post("/livestock/procurement/collections", status_code=201, response_model=MilkCollection)
async def record_milk_collection(body: MilkCollectionIn, uid: str = Depends(_any_livestock_user)):
    user = await get_user(uid)
    dairy_name = (user.get("roleProfiles", {}).get("dairyManager", {}).get("centerName")
                  if user else None) or "श्री गणेश दुग्ध संकलन केंद्र"
    rate_chart_id = ""
    chart = None
    if user and user.get("activeProfile") == "dairyManager":
        chart = await _active_center_chart(uid, body.milkType)
    if chart:
        rate = _chart_based_rate(chart, body.fatPercent, body.snfPercent)
        rate_chart_id = chart["id"]
    else:
        rate, _, _, _, _ = _calculate_milk_rate(body.milkType, body.fatPercent, body.snfPercent)
    total = round(rate * body.liters, 2)
    col_id = f"mc_{uuid.uuid4().hex[:10]}"
    slip_no = f"SLIP-{body.date.replace('-', '')}-{body.shift[0].upper()}-{body.farmerCode}"

    doc = {
        "id": col_id,
        "dairyId": uid,
        "dairyName": dairy_name,
        "farmerId": body.farmerId or uid,
        "farmerName": body.farmerName,
        "farmerCode": body.farmerCode,
        "farmerPhone": body.farmerPhone,
        "date": body.date,
        "shift": body.shift,
        "milkType": body.milkType,
        "liters": body.liters,
        "fatPercent": body.fatPercent,
        "snfPercent": body.snfPercent,
        "clr": body.clr,
        "ratePerLiter": rate,
        "totalAmount": total,
        "slipNumber": slip_no,
        "status": "recorded",
        "recordedAt": _now(),
    }
    if body.memberId:
        doc["memberId"] = body.memberId
    if body.quality:
        doc["quality"] = body.quality
    if rate_chart_id:
        doc["rateChartId"] = rate_chart_id
    await set_doc("milk_collections", col_id, doc)
    return doc


@router.get("/livestock/procurement/collections")
async def list_milk_collections(
    date: str | None = None,
    shift: str | None = None,
    farmerCode: str | None = None,
    page: int = 1,
    pageSize: int = 50,
    uid: str = Depends(_any_livestock_user),
):
    docs = await query("milk_collections", [], limit=500)
    docs = _scoped_collections(docs, await get_user(uid), uid)
    if date:
        docs = [d for d in docs if d.get("date") == date]
    if shift:
        docs = [d for d in docs if d.get("shift") == shift]
    if farmerCode:
        docs = [d for d in docs if d.get("farmerCode") == farmerCode]
    docs.sort(key=lambda d: d.get("recordedAt", ""), reverse=True)
    return _envelope(docs, page, pageSize)


@router.get("/livestock/procurement/summary", response_model=MilkProcurementSummary)
async def get_procurement_summary(
    date: str | None = None,
    uid: str = Depends(_any_livestock_user),
):
    target_date = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    docs = await query("milk_collections", [("date", "==", target_date)], limit=500)
    docs = _scoped_collections(docs, await get_user(uid), uid)
    m_liters = sum(d.get("liters", 0.0) for d in docs if d.get("shift") == "morning")
    e_liters = sum(d.get("liters", 0.0) for d in docs if d.get("shift") == "evening")
    total_l = m_liters + e_liters
    avg_fat = round(sum(d.get("fatPercent", 0.0) for d in docs) / len(docs), 2) if docs else 0.0
    avg_snf = round(sum(d.get("snfPercent", 0.0) for d in docs) / len(docs), 2) if docs else 0.0
    payout = round(sum(d.get("totalAmount", 0.0) for d in docs), 2)

    return {
        "date": target_date,
        "totalMorningLiters": round(m_liters, 2),
        "totalEveningLiters": round(e_liters, 2),
        "totalLiters": round(total_l, 2),
        "avgFat": avg_fat,
        "avgSnf": avg_snf,
        "totalPayoutAmount": payout,
        "collectionsCount": len(docs),
    }


# =========================================================================
# 4. Breeding & Gestation Lifecycle
# =========================================================================

@router.post("/livestock/breeding", status_code=201, response_model=BreedingCycle)
async def record_breeding(body: BreedingCycleIn, uid: str = Depends(_any_livestock_user)):
    # Calculate gestation: 280 days for cow, 310 days for buffalo
    gestation_days = 310 if body.species == "buffalo" else 280
    try:
        dt = datetime.fromisoformat(body.aiDate)
    except Exception:
        dt = datetime.now(timezone.utc)
    from datetime import timedelta
    pd_due = (dt + timedelta(days=60)).strftime("%Y-%m-%d")
    calving_due = (dt + timedelta(days=gestation_days)).strftime("%Y-%m-%d")

    cycle_id = f"br_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": cycle_id,
        "animalId": body.animalId,
        "animalTagId": body.animalTagId,
        "animalName": body.animalName,
        "heatDate": body.heatDate,
        "aiDate": body.aiDate,
        "semenStrawId": body.semenStrawId,
        "bullBreed": body.bullBreed,
        "technicianName": body.technicianName,
        "species": body.species,
        "pregnancyCheckDueDate": pd_due,
        "pregnancyStatus": "pending",
        "expectedCalvingDate": calving_due,
        "actualCalvingDate": "",
        "calfGender": "",
        "status": "inseminated",
        "notes": body.notes,
        "createdAt": _now(),
    }
    await set_doc("breeding_cycles", cycle_id, doc)
    return doc


@router.get("/livestock/breeding")
async def list_breeding_cycles(
    status: str | None = None,
    animalTagId: str | None = None,
    uid: str = Depends(_any_livestock_user),
):
    docs = await query("breeding_cycles", [], limit=200)
    if status:
        docs = [d for d in docs if d.get("status") == status]
    if animalTagId:
        docs = [d for d in docs if d.get("animalTagId") == animalTagId]
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return {"data": docs}


@router.put("/livestock/breeding/{cycle_id}/status")
async def update_breeding_status(
    cycle_id: str,
    status: Literal["inseminated", "pregnant", "calved", "failed"],
    pregnancyStatus: str = "",
    calfGender: str = "",
    actualCalvingDate: str = "",
    uid: str = Depends(_any_livestock_user),
):
    doc = await get_doc("breeding_cycles", cycle_id)
    if not doc:
        _error(404, "CYCLE_NOT_FOUND", "Breeding cycle not found")
    doc["status"] = status
    if pregnancyStatus:
        doc["pregnancyStatus"] = pregnancyStatus
    if calfGender:
        doc["calfGender"] = calfGender
    if actualCalvingDate:
        doc["actualCalvingDate"] = actualCalvingDate
    await set_doc("breeding_cycles", cycle_id, doc)
    return doc


# =========================================================================
# 5. Veterinary & Clinical Operations
# =========================================================================

@router.post("/livestock/vet/records", status_code=201, response_model=VetRecord)
async def create_vet_record(body: VetRecordIn, uid: str = Depends(_any_livestock_user)):
    user = await get_user(uid)
    vet_name = (user.get("name") if user else "") or "डॉ. आनंद कुलकर्णी (पशुवैद्यक)"
    record_id = f"vr_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": record_id,
        "vetId": uid,
        "vetName": vet_name,
        "farmerId": body.farmerId,
        "farmerName": body.farmerName,
        "animalTagId": body.animalTagId,
        "animalName": body.animalName,
        "species": body.species,
        "visitDate": body.visitDate,
        "visitType": body.visitType,
        "temperatureF": body.temperatureF,
        "symptoms": body.symptoms,
        "diagnosis": body.diagnosis,
        "clinicalNotes": body.clinicalNotes,
        "prescriptions": body.prescriptions,
        "withdrawalPeriodDays": body.withdrawalPeriodDays,
        "feeCharged": body.feeCharged,
        "createdAt": _now(),
    }
    await set_doc("vet_records", record_id, doc)
    return doc


@router.get("/livestock/vet/records")
async def list_vet_records(
    animalTagId: str | None = None,
    uid: str = Depends(_any_livestock_user),
):
    docs = await query("vet_records", [], limit=200)
    if animalTagId:
        docs = [d for d in docs if d.get("animalTagId") == animalTagId]
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return {"data": docs}


@router.post("/livestock/vet/vaccinations", status_code=201, response_model=VaccinationSchedule)
async def schedule_vaccination(body: VaccinationScheduleIn, uid: str = Depends(_any_livestock_user)):
    # Calculate next booster date: FMD 6 months, others 12 months
    from datetime import timedelta
    try:
        dt = datetime.fromisoformat(body.administeredDate)
    except Exception:
        dt = datetime.now(timezone.utc)
    interval_days = 180 if body.disease == "FMD" else 365
    next_due = (dt + timedelta(days=interval_days)).strftime("%Y-%m-%d")

    vac_id = f"vac_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": vac_id,
        "animalTagId": body.animalTagId,
        "animalName": body.animalName,
        "disease": body.disease,
        "vaccineName": body.vaccineName,
        "batchNumber": body.batchNumber,
        "administeredDate": body.administeredDate,
        "nextDueDate": next_due,
        "administeredBy": body.administeredBy or "शासकीय पशुवैद्यकीय अधिकारी",
        "status": "completed",
        "createdAt": _now(),
    }
    await set_doc("vaccination_schedules", vac_id, doc)
    return doc


@router.get("/livestock/vet/vaccinations")
async def list_vaccinations(
    animalTagId: str | None = None,
    uid: str = Depends(_any_livestock_user),
):
    docs = await query("vaccination_schedules", [], limit=200)
    if animalTagId:
        docs = [d for d in docs if d.get("animalTagId") == animalTagId]
    docs.sort(key=lambda d: d.get("administeredDate", ""), reverse=True)
    return {"data": docs}


# =========================================================================
# 6. Gaushala Management & Cow Adoption
# =========================================================================

@router.post("/livestock/gaushala/adoptions", status_code=201, response_model=CowAdoption)
async def adopt_cow(body: CowAdoptionIn, uid: str = Depends(_farmer_seller)):
    user = await get_user(uid)
    gaushala = await get_doc("gaushalas", body.gaushalaId)
    gaushala_name = (gaushala.get("name") if gaushala else "") or "Shrimant Panchvati Desi Gaushala"
    adopt_id = f"adopt_{uuid.uuid4().hex[:10]}"
    cert_no = f"GOSH-{datetime.now(timezone.utc).year}-ADOPT-{uuid.uuid4().hex[:6].upper()}"

    doc = {
        "id": adopt_id,
        "gaushalaId": body.gaushalaId,
        "gaushalaName": gaushala_name,
        "cowTagId": body.cowTagId,
        "cowName": body.cowName,
        "donorId": uid,
        "donorName": body.donorName or (user.get("name") if user else "गोसेवक"),
        "donorPhone": body.donorPhone,
        "donorCity": body.donorCity,
        "tier": body.tier,
        "amountInr": body.amountInr,
        "billingCycle": body.billingCycle,
        "startDate": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "endDate": "2027-12-31",
        "status": "active",
        "certificateNumber": cert_no,
        "createdAt": _now(),
    }
    await set_doc("cow_adoptions", adopt_id, doc)
    return doc


@router.get("/livestock/gaushala/adoptions")
async def list_cow_adoptions(
    gaushalaId: str | None = None,
    uid: str = Depends(_farmer_seller),
):
    docs = await query("cow_adoptions", [], limit=200)
    if gaushalaId:
        docs = [d for d in docs if d.get("gaushalaId") == gaushalaId]
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return {"data": docs}


@router.post("/livestock/gaushala/donations", status_code=201, response_model=FodderDonation)
async def donate_fodder(body: FodderDonationIn, uid: str = Depends(_farmer_seller)):
    user = await get_user(uid)
    don_id = f"don_{uuid.uuid4().hex[:10]}"
    rcp_no = f"GOSH-RCP-{datetime.now(timezone.utc).year}-{uuid.uuid4().hex[:6].upper()}"

    doc = {
        "id": don_id,
        "gaushalaId": body.gaushalaId,
        "donorId": uid,
        "donorName": body.donorName or (user.get("name") if user else "गोसेवक"),
        "donorPhone": body.donorPhone,
        "donationType": body.donationType,
        "quantityDescription": body.quantityDescription,
        "amountInr": body.amountInr,
        "receiptNumber": rcp_no,
        "createdAt": _now(),
    }
    await set_doc("fodder_donations", don_id, doc)
    return doc


@router.get("/livestock/gaushala/donations")
async def list_fodder_donations(
    gaushalaId: str | None = None,
    uid: str = Depends(_farmer_seller),
):
    docs = await query("fodder_donations", [], limit=200)
    if gaushalaId:
        docs = [d for d in docs if d.get("gaushalaId") == gaushalaId]
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return {"data": docs}


@router.get("/livestock/gaushala/byproducts")
async def list_panchagavya_products(
    category: str | None = None,
    uid: str = Depends(_farmer_seller),
):
    docs = await query("panchagavya_products", [], limit=200)
    if category:
        docs = [d for d in docs if d.get("category") == category]
    docs.sort(key=lambda d: d.get("id", ""))
    return {"data": docs}


@router.post("/livestock/gaushala/byproducts", status_code=201, response_model=PanchagavyaProduct)
async def add_panchagavya_product(body: PanchagavyaProductIn, uid: str = Depends(_any_livestock_user)):
    prod_id = f"pancha_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": prod_id,
        "gaushalaId": body.gaushalaId or "gau-1",
        "title": body.title,
        "vernacularTitle": body.vernacularTitle or body.title,
        "category": body.category,
        "price": body.price,
        "unit": body.unit,
        "inStock": body.stockQuantity > 0,
        "stockQuantity": body.stockQuantity,
        "description": body.description,
        "imageUrl": body.imageUrl,
        "createdAt": _now(),
    }
    await set_doc("panchagavya_products", prod_id, doc)
    return doc
