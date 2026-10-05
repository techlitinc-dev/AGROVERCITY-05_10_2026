import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import get_doc, query, set_doc
from app.core.deps import admin_user, current_user_id
from app.models.livestock_mgmt import (
    AppointmentIn,
    AppointmentStatusIn,
    CampaignEnrollIn,
    CampaignIn,
    CampaignVaccinatedIn,
    PrescriptionIn,
    VetCredentialIn,
    VetManagedIn,
    VetSchedulePutIn,
)
from app.routers.ratings import provider_rating_fields
from app.routers.users import require_role
from app.services import tasks as tasks_service
from app.services.billing import check_entitlement, require_entitlement
from app.services.notifications import send_fcm_to_user
from app.services.tasks import emit_task
from app.services.users import get_user

router = APIRouter(tags=["livestock"])

# WS-06: vet Pro tier feature keys (plan config entry: persona "vet", ₹299/mo).
VET_FEATURE_CAMPAIGNS = "vetCampaigns"
VET_FEATURE_SCHEDULE = "vetScheduleEditor"

_VET_TRANSITIONS = {
    "requested": {"confirmed", "cancelled"},
    "confirmed": {"in-progress", "cancelled"},
    "in-progress": {"completed"},
}


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _envelope(docs: list[dict], page: int, page_size: int) -> dict:
    total = len(docs)
    start = (page - 1) * page_size
    return {"data": docs[start:start + page_size], "page": page, "pageSize": page_size, "total": total}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _notify(uid: str, title: str, body: str, data: dict):
    if not uid:
        return
    await send_fcm_to_user(uid, title, body, data)


async def _manager(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "dairyManager")
    return uid


async def _livestock_user(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer", "seller", "dairyManager")
    return uid


async def _find_claimed_vet(uid: str) -> dict | None:
    docs = await query("vets", [("claimedByUid", "==", uid)], limit=10)
    return docs[0] if docs else None


async def _vet_owner(uid: str = Depends(current_user_id)) -> dict:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    vet = await _find_claimed_vet(uid)
    if vet is None:
        _error(404, "VET_PROFILE_NOT_FOUND", "no claimed vet profile for this user")
    return vet


async def _manager_or_vet(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    if user.get("activeProfile") == "dairyManager":
        return uid
    if await _find_claimed_vet(uid) is None:
        _error(403, "FORBIDDEN_ROLE", "insufficient role for this action")
    return uid


def _default_schedule(vet_id: str) -> dict:
    return {
        "vetId": vet_id,
        "weeklySlots": [],
        "leaves": [],
        "emergencyAvailable": False,
        "teleAvailable": False,
        "updatedAt": _now(),
    }


async def _campaign_creator(uid: str = Depends(_manager_or_vet)) -> str:
    """Campaign tools are a vet Pro feature (WS-06 §6.6) and require a verified
    vet credential (§6.3). Managers are unaffected — they carry no vet profile.
    """
    vet = await _find_claimed_vet(uid)
    if vet is not None:
        await check_entitlement(uid, "vet", VET_FEATURE_CAMPAIGNS)
        if vet.get("credentialStatus", "pending") != "verified":
            _error(403, "VET_NOT_VERIFIED", "vet credentials are not verified yet")
    return uid


# Herd-health task kinds (WS-06 §6.14) — emitted by the vaccination scheduler and
# campaign enrollment, resolved by mark-vaccinated. Single task-engine store, no
# parallel reminder system.
HERD_HEALTH_TASK_KINDS = ("vaccination_due", "campaign_vaccination_due")


async def _resolve_animal_tasks(user_id: str, animal_id: str) -> None:
    """Mark the owning farmer's open herd-health tasks for an animal as done.

    The task engine exposes no resolve helper (only emit_task + the /tasks router),
    so this mirrors the completion path in app/routers/tasks.py: status -> "done".
    """
    if not user_id or not animal_id:
        return
    rows = await query(
        tasks_service.COLLECTION,
        [("userId", "==", user_id), ("status", "==", "open")],
        limit=500,
    )
    for doc in rows:
        if doc.get("kind") not in HERD_HEALTH_TASK_KINDS:
            continue
        source_id = doc.get("sourceId") or ""
        if source_id == animal_id or source_id.endswith(f":{animal_id}"):
            doc["status"] = "done"
            doc["resolvedBy"] = "mark-vaccinated"
            doc["updatedAt"] = _now()
            await set_doc(tasks_service.COLLECTION, doc["taskId"], doc)


# =========================================================================
# Managed vet directory (manager)
# =========================================================================

@router.get("/livestock/vets/managed")
async def list_managed_vets(
    credentialStatus: str | None = None,
    page: int = 1,
    pageSize: int = 50,
    uid: str = Depends(_manager),
):
    docs = await query("vets", [], limit=500)
    docs.sort(key=lambda d: d.get("name", ""))
    for doc in docs:
        doc["claimed"] = bool(doc.get("claimedByUid"))
        # WS-06: records predating credential verification behave as "pending".
        doc["credentialStatus"] = doc.get("credentialStatus", "pending")
        doc["credentialDocs"] = doc.get("credentialDocs", [])
        doc.update(await provider_rating_fields(doc["id"]))
    if credentialStatus:
        docs = [d for d in docs if d["credentialStatus"] == credentialStatus]
    return _envelope(docs, page, pageSize)


@router.post("/livestock/vets/managed", status_code=201)
async def create_managed_vet(body: VetManagedIn, uid: str = Depends(_manager)):
    vet_id = f"vet_{uuid.uuid4().hex[:12]}"
    doc = {
        "id": vet_id,
        "name": body.name,
        "phone": body.phone,
        "qualification": body.qualification,
        "specializations": body.specializations,
        "clinicAddress": body.clinicAddress,
        "experienceYears": body.experienceYears,
        "feeClinic": body.feeClinic,
        "feeFarm": body.feeFarm,
        "feeTele": body.feeTele,
        "consultationFeeRupees": body.feeClinic,
        "visitTypes": body.visitTypes,
        "serviceDistricts": body.serviceDistricts,
        "languages": body.languages,
        "vetCouncilRegNo": body.vetCouncilRegNo,
        "emergencyAvailable": body.emergencyAvailable,
        "availableForFarmVisit": body.availableForFarmVisit,
        "credentialStatus": body.credentialStatus,
        "credentialDocs": body.credentialDocs,
        "distanceKm": 0.0,
        "rating": 0.0,
        "nextAvailableSlot": "",
        "claimedByUid": "",
        "status": "active",
        "onboardedBy": uid,
        "createdAt": _now(),
    }
    await set_doc("vets", vet_id, doc)
    return doc


@router.put("/livestock/vets/managed/{vet_id}")
async def update_managed_vet(vet_id: str, body: VetManagedIn, uid: str = Depends(_manager)):
    doc = await get_doc("vets", vet_id)
    if not doc:
        _error(404, "VET_NOT_FOUND", "vet not found")
    doc.update({
        "name": body.name,
        "phone": body.phone,
        "qualification": body.qualification,
        "specializations": body.specializations,
        "clinicAddress": body.clinicAddress,
        "experienceYears": body.experienceYears,
        "feeClinic": body.feeClinic,
        "feeFarm": body.feeFarm,
        "feeTele": body.feeTele,
        "consultationFeeRupees": body.feeClinic,
        "visitTypes": body.visitTypes,
        "serviceDistricts": body.serviceDistricts,
        "languages": body.languages,
        "vetCouncilRegNo": body.vetCouncilRegNo,
        "emergencyAvailable": body.emergencyAvailable,
        "availableForFarmVisit": body.availableForFarmVisit,
        "credentialStatus": body.credentialStatus,
        "credentialDocs": body.credentialDocs,
        "updatedAt": _now(),
    })
    await set_doc("vets", vet_id, doc)
    return doc


@router.delete("/livestock/vets/managed/{vet_id}")
async def deactivate_managed_vet(vet_id: str, uid: str = Depends(_manager)):
    doc = await get_doc("vets", vet_id)
    if not doc:
        _error(404, "VET_NOT_FOUND", "vet not found")
    doc["status"] = "inactive"
    doc["updatedAt"] = _now()
    await set_doc("vets", vet_id, doc)
    return doc


@router.post("/livestock/vets/managed/{vet_id}/credential")
async def update_vet_credential(
    vet_id: str,
    body: VetCredentialIn,
    claims: dict = Depends(admin_user),
):
    """Admin credential-verification decision (WS-06).

    The admin console signs in with a Firebase ID token (see core/deps.admin_user);
    every decision writes an audit_logs row with actor + reason (rule 8).
    """
    doc = await get_doc("vets", vet_id)
    if not doc:
        _error(404, "VET_NOT_FOUND", "vet not found")
    doc["credentialStatus"] = body.status
    doc["credentialUpdatedAt"] = _now()
    await set_doc("vets", vet_id, doc)
    await set_doc(
        "audit_logs",
        f"aud_vetcred_{vet_id}_{uuid.uuid4().hex[:10]}",
        {
            "action": "VET_CREDENTIAL_UPDATE",
            "actorId": claims.get("uid", ""),
            "targetId": vet_id,
            "status": body.status,
            "reason": body.reason,
            "at": _now(),
        },
    )
    return doc


# =========================================================================
# Vet claim & workspace
# =========================================================================

@router.post("/livestock/vets/claim")
async def claim_vet_profile(uid: str = Depends(current_user_id)):
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    phone = user.get("phone", "")
    docs = await query("vets", [("phone", "==", phone)], limit=10)
    if not docs:
        _error(404, "VET_NOT_FOUND", "no vet profile matches this phone number")
    vet = docs[0]
    claimed = vet.get("claimedByUid", "")
    if claimed and claimed != uid:
        _error(409, "ALREADY_CLAIMED", "this vet profile is already claimed")
    vet["claimedByUid"] = uid
    vet["updatedAt"] = _now()
    await set_doc("vets", vet["id"], vet)
    return vet


@router.get("/livestock/vets/me")
async def my_vet_workspace(vet: dict = Depends(_vet_owner)):
    today = datetime.now(timezone.utc).strftime("%Y-%m")
    appointments = await query("appointments", [("vetId", "==", vet["id"])], limit=500)
    month_completed = [
        a for a in appointments
        if a.get("status") == "completed" and (a.get("completedAt") or a.get("updatedAt", "")).startswith(today)
    ]
    return {
        "vet": vet,
        "schedule": await get_doc("vet_schedules", vet["id"]) or _default_schedule(vet["id"]),
        "stats": {
            "totalAppointments": len(appointments),
            "monthEarnings": round(sum(a.get("fee", 0.0) for a in month_completed), 2),
            **await provider_rating_fields(vet["id"]),
        },
    }


@router.get("/livestock/vets/me/schedule")
async def get_my_schedule(vet: dict = Depends(_vet_owner)):
    return await get_doc("vet_schedules", vet["id"]) or _default_schedule(vet["id"])


@router.put("/livestock/vets/me/schedule")
async def update_my_schedule(
    body: VetSchedulePutIn,
    vet: dict = Depends(_vet_owner),
    _ent: dict = Depends(require_entitlement("vet", VET_FEATURE_SCHEDULE)),
):
    doc = await get_doc("vet_schedules", vet["id"]) or _default_schedule(vet["id"])
    if body.weeklySlots is not None:
        doc["weeklySlots"] = [s.model_dump() for s in body.weeklySlots]
    if body.leaves is not None:
        doc["leaves"] = list(dict.fromkeys((doc.get("leaves") or []) + body.leaves))
    if body.emergencyAvailable is not None:
        doc["emergencyAvailable"] = body.emergencyAvailable
    if body.teleAvailable is not None:
        doc["teleAvailable"] = body.teleAvailable
    doc["updatedAt"] = _now()
    await set_doc("vet_schedules", vet["id"], doc)
    return doc


@router.get("/livestock/vets/me/appointments")
async def my_appointments(
    status: str | None = None,
    date: str | None = None,
    page: int = 1,
    pageSize: int = 50,
    vet: dict = Depends(_vet_owner),
):
    docs = await query("appointments", [("vetId", "==", vet["id"])], limit=500)
    if status:
        docs = [d for d in docs if d.get("status") == status]
    if date:
        docs = [d for d in docs if d.get("slotDate") == date]
    docs.sort(key=lambda d: (d.get("slotDate", ""), d.get("slotTime", "")))
    return _envelope(docs, page, pageSize)


@router.get("/livestock/vets/me/earnings")
async def my_earnings(month: str | None = None, vet: dict = Depends(_vet_owner)):
    target = month or datetime.now(timezone.utc).strftime("%Y-%m")
    docs = await query("appointments", [("vetId", "==", vet["id"])], limit=500)
    completed = [
        d for d in docs
        if d.get("status") == "completed" and (d.get("completedAt") or d.get("updatedAt", "")).startswith(target)
    ]
    return {
        "month": target,
        "completedAppointments": len(completed),
        "totalEarnings": round(sum(d.get("fee", 0.0) for d in completed), 2),
        **await provider_rating_fields(vet["id"]),
    }


# =========================================================================
# Appointments
# =========================================================================

async def _create_prescription_doc(
    vet_id: str,
    farmer_uid: str,
    animal_id: str,
    appointment_id: str,
    diagnosis: str,
    medicines: list[dict],
    advice: str,
    milk_withdrawal_days: int,
    follow_up_date: str,
) -> dict:
    rx_id = f"rx_{uuid.uuid4().hex[:12]}"
    doc = {
        "id": rx_id,
        "appointmentId": appointment_id,
        "vetId": vet_id,
        "animalId": animal_id,
        "farmerUid": farmer_uid,
        "diagnosis": diagnosis,
        "medicines": medicines,
        "advice": advice,
        "milkWithdrawalDays": milk_withdrawal_days,
        "followUpDate": follow_up_date,
        "createdAt": _now(),
    }
    await set_doc("prescriptions", rx_id, doc)
    return doc


@router.post("/livestock/appointments", status_code=201)
async def create_appointment(body: AppointmentIn, uid: str = Depends(_livestock_user)):
    vet_doc = await get_doc("vets", body.vetId)
    if not vet_doc:
        _error(404, "VET_NOT_FOUND", "vet not found")
    if vet_doc.get("status", "active") == "inactive":
        _error(409, "VET_INACTIVE", "vet is not accepting appointments")
    schedule = await get_doc("vet_schedules", body.vetId)
    if schedule:
        weekly = schedule.get("weeklySlots") or []
        if weekly:
            try:
                weekday = datetime.fromisoformat(body.slotDate).weekday()
            except ValueError:
                _error(422, "VALIDATION_ERROR", "slotDate must be a valid date")
            covered = any(slot.get("day") == weekday for slot in weekly)
            if not covered:
                _error(400, "SLOT_UNAVAILABLE", "vet has no slots on this weekday")
        if body.visitType == "tele" and schedule.get("teleAvailable") is False:
            _error(400, "TELE_UNAVAILABLE", "vet does not offer teleconsultation")
    user = await get_user(uid)
    fee_by_type = {"clinic": vet_doc.get("feeClinic", 0), "farm": vet_doc.get("feeFarm", 0), "tele": vet_doc.get("feeTele", 0)}
    appt_id = f"ap_{uuid.uuid4().hex[:12]}"
    doc = {
        "id": appt_id,
        "vetId": body.vetId,
        "vetName": vet_doc.get("name", ""),
        "farmerUid": uid,
        "farmerName": (user.get("name") if user else "") or "पशुपालक शेतकरी",
        "animalId": body.animalId,
        "visitType": body.visitType,
        "slotDate": body.slotDate,
        "slotTime": body.slotTime,
        "symptoms": body.symptoms,
        "address": body.address,
        "fee": body.fee or fee_by_type.get(body.visitType, 0) or vet_doc.get("consultationFeeRupees", 0),
        "status": "requested",
        "createdAt": _now(),
        "updatedAt": _now(),
    }
    await set_doc("appointments", appt_id, doc)
    await _notify(
        vet_doc.get("claimedByUid", ""),
        "नवीन अपॉइंटमेंट (New Appointment Request)",
        f"{doc['farmerName']} ने {body.slotDate} {body.slotTime} स्लॉट पर अपॉइंटमेंट मांगा है।",
        {"kind": "appointment_requested", "appointmentId": appt_id, "status": "requested"},
    )
    return doc


@router.get("/livestock/appointments")
async def list_my_appointments(
    status: str | None = None,
    date: str | None = None,
    page: int = 1,
    pageSize: int = 20,
    uid: str = Depends(_livestock_user),
):
    user = await get_user(uid)
    if user and user.get("activeProfile") == "dairyManager":
        docs = await query("appointments", [], limit=1000)
        docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    else:
        docs = await query("appointments", [("farmerUid", "==", uid)], limit=500)
        docs.sort(key=lambda d: (d.get("slotDate", ""), d.get("slotTime", "")), reverse=True)
    if status:
        docs = [d for d in docs if d.get("status") == status]
    if date:
        docs = [d for d in docs if d.get("slotDate") == date]
    return _envelope(docs, page, pageSize)


@router.post("/livestock/appointments/{appt_id}/status")
async def update_appointment_status(appt_id: str, body: AppointmentStatusIn, uid: str = Depends(current_user_id)):
    appt = await get_doc("appointments", appt_id)
    if not appt:
        _error(404, "APPOINTMENT_NOT_FOUND", "appointment not found")
    vet_doc = await _find_claimed_vet(uid)
    is_vet = vet_doc is not None and vet_doc["id"] == appt.get("vetId")
    is_farmer = appt.get("farmerUid") == uid
    if not is_vet and not is_farmer:
        _error(403, "FORBIDDEN_ROLE", "not a party to this appointment")
    current = appt.get("status", "requested")
    if is_vet:
        if body.status not in _VET_TRANSITIONS.get(current, set()):
            _error(409, "INVALID_TRANSITION", f"cannot move appointment from {current} to {body.status}")
    else:
        if body.status != "cancelled" or current not in ("requested", "confirmed"):
            _error(403, "FORBIDDEN_ROLE", "farmer can only cancel a requested or confirmed appointment")
    appt["status"] = body.status
    appt["updatedAt"] = _now()
    if body.status == "cancelled":
        appt["cancelReason"] = body.cancelReason
    if body.status == "completed":
        appt["completedAt"] = _now()
        if body.vetNotes:
            appt["vetNotes"] = body.vetNotes
        if body.prescription is not None:
            rx = await _create_prescription_doc(
                appt["vetId"], appt["farmerUid"], appt.get("animalId", ""), appt_id,
                body.prescription.diagnosis,
                [m.model_dump() for m in body.prescription.medicines],
                body.prescription.advice,
                body.prescription.milkWithdrawalDays,
                body.prescription.followUpDate,
            )
            appt["prescriptionId"] = rx["id"]
    await set_doc("appointments", appt_id, appt)
    counterparty = appt["farmerUid"] if is_vet else (vet_doc or {}).get("claimedByUid", "")
    await _notify(
        counterparty,
        "अपॉइंटमेंट अपडेट (Appointment Update)",
        f"अपॉइंटमेंट {appt_id} की स्थिति अब '{body.status}' है।",
        {"kind": "appointment_status", "appointmentId": appt_id, "status": body.status},
    )
    return appt


# =========================================================================
# Prescriptions
# =========================================================================

@router.post("/livestock/prescriptions", status_code=201)
async def create_prescription(body: PrescriptionIn, uid: str = Depends(_manager_or_vet)):
    animal = await get_doc("livestock_animals", body.animalId)
    if not animal:
        _error(404, "ANIMAL_NOT_FOUND", "animal not found")
    vet_doc = await _find_claimed_vet(uid)
    return await _create_prescription_doc(
        vet_doc["id"] if vet_doc else "",
        animal.get("ownerId", ""),
        body.animalId,
        body.appointmentId,
        body.diagnosis,
        [m.model_dump() for m in body.medicines],
        body.advice,
        body.milkWithdrawalDays,
        body.followUpDate,
    )


@router.get("/livestock/prescriptions")
async def list_prescriptions(animalId: str | None = None, uid: str = Depends(current_user_id)):
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    is_manager = user.get("activeProfile") == "dairyManager"
    vet_doc = await _find_claimed_vet(uid)
    if animalId:
        animal = await get_doc("livestock_animals", animalId)
        if not animal:
            _error(404, "ANIMAL_NOT_FOUND", "animal not found")
        allowed = is_manager or vet_doc is not None or animal.get("ownerId") == uid
        if not allowed:
            _error(403, "FORBIDDEN_ROLE", "no access to prescriptions for this animal")
        docs = await query("prescriptions", [("animalId", "==", animalId)], limit=200)
    elif is_manager:
        docs = await query("prescriptions", [], limit=500)
    elif vet_doc is not None:
        docs = await query("prescriptions", [("vetId", "==", vet_doc["id"])], limit=500)
    else:
        docs = await query("prescriptions", [("farmerUid", "==", uid)], limit=500)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    return {"data": docs, "total": len(docs)}


# =========================================================================
# Vaccination campaigns
# =========================================================================

@router.get("/livestock/vet/campaigns")
async def list_campaigns(
    status: str | None = None,
    page: int = 1,
    pageSize: int = 20,
    uid: str = Depends(_livestock_user),
):
    docs = await query("vaccination_campaigns", [], limit=200)
    if status:
        docs = [d for d in docs if d.get("status") == status]
    docs.sort(key=lambda d: d.get("fromDate", ""))
    return _envelope(docs, page, pageSize)


@router.post("/livestock/vet/campaigns", status_code=201)
async def create_campaign(body: CampaignIn, uid: str = Depends(_campaign_creator)):
    campaign_id = f"cmp_{uuid.uuid4().hex[:12]}"
    doc = {
        "id": campaign_id,
        "title": body.title,
        "vaccine": body.vaccine,
        "disease": body.disease,
        "fromDate": body.fromDate,
        "toDate": body.toDate,
        "targetDistricts": body.targetDistricts,
        "organizerId": uid,
        "status": body.status,
        "createdAt": _now(),
    }
    await set_doc("vaccination_campaigns", campaign_id, doc)
    return doc


@router.get("/livestock/vet/campaigns/{campaign_id}")
async def get_campaign(campaign_id: str, uid: str = Depends(_livestock_user)):
    doc = await get_doc("vaccination_campaigns", campaign_id)
    if not doc:
        _error(404, "CAMPAIGN_NOT_FOUND", "campaign not found")
    enrollments = await query("campaign_enrollments", [("campaignId", "==", campaign_id)], limit=500)
    return {**doc, "enrollments": enrollments, "enrollmentCount": len(enrollments)}


@router.post("/livestock/vet/campaigns/{campaign_id}/enroll", status_code=201)
async def enroll_campaign(campaign_id: str, body: CampaignEnrollIn, uid: str = Depends(_livestock_user)):
    campaign = await get_doc("vaccination_campaigns", campaign_id)
    if not campaign:
        _error(404, "CAMPAIGN_NOT_FOUND", "campaign not found")
    if campaign.get("status") == "closed":
        _error(409, "CAMPAIGN_CLOSED", "campaign is closed")
    animal = await get_doc("livestock_animals", body.animalId)
    if not animal:
        _error(404, "ANIMAL_NOT_FOUND", "animal not found")
    if animal.get("ownerId") != uid:
        _error(403, "FORBIDDEN_ROLE", "you can only enroll your own animal")
    existing = await query(
        "campaign_enrollments",
        [("campaignId", "==", campaign_id), ("animalId", "==", body.animalId)],
        limit=1,
    )
    if existing:
        _error(409, "ALREADY_ENROLLED", "animal is already enrolled in this campaign")
    enrollment_id = f"cre_{uuid.uuid4().hex[:12]}"
    doc = {
        "id": enrollment_id,
        "campaignId": campaign_id,
        "animalId": body.animalId,
        "farmerUid": uid,
        "status": "enrolled",
        "vaccinatedAt": "",
        "createdAt": _now(),
    }
    await set_doc("campaign_enrollments", enrollment_id, doc)
    await _notify(
        uid,
        "लसीकरण आठवण (Vaccination Reminder)",
        f"{campaign['title']}: {campaign['fromDate']} ते {campaign['toDate']} दरम्यान लसीकरण करा.",
        {"kind": "campaign_enrolled", "campaignId": campaign_id, "enrollmentId": enrollment_id},
    )
    # WS-06 §6.14: herd-health task to the owning farmer (deep-links to the campaign).
    due = campaign.get("fromDate") or campaign.get("toDate") or ""
    animal_label = animal.get("name") or animal.get("tagId") or body.animalId
    await emit_task(
        uid,
        persona="farmer",
        module="vet",
        kind="campaign_vaccination_due",
        title_en=f"vaccination due: {animal_label}, {due}",
        title_hi=f"लसीकरण बाकी: {animal_label}, {due}",
        subtitle=campaign.get("title", ""),
        priority="upcoming",
        deep_link=f"/vetnet/campaigns/{campaign_id}",
        source_id=f"{campaign_id}:{body.animalId}",
        due_at=due or None,
    )
    return doc


@router.post("/livestock/vet/campaigns/{campaign_id}/mark-vaccinated")
async def mark_vaccinated(campaign_id: str, body: CampaignVaccinatedIn, uid: str = Depends(_manager_or_vet)):
    campaign = await get_doc("vaccination_campaigns", campaign_id)
    if not campaign:
        _error(404, "CAMPAIGN_NOT_FOUND", "campaign not found")
    enrollments = await query(
        "campaign_enrollments",
        [("campaignId", "==", campaign_id), ("animalId", "==", body.animalId)],
        limit=1,
    )
    if not enrollments:
        _error(404, "ENROLLMENT_NOT_FOUND", "enrollment not found for this animal")
    enrollment = enrollments[0]
    enrollment["status"] = "vaccinated"
    enrollment["vaccinatedAt"] = _now()
    await set_doc("campaign_enrollments", enrollment["id"], enrollment)
    await _notify(
        enrollment.get("farmerUid", ""),
        "लसीकरण पूर्ण (Vaccination Done)",
        f"{campaign['title']} — आपके पशु का लसीकरण पूरा हुआ।",
        {"kind": "campaign_vaccinated", "campaignId": campaign_id, "animalId": body.animalId},
    )
    # WS-06 §6.14: mark-vaccinated resolves the farmer's open herd-health task(s).
    await _resolve_animal_tasks(enrollment.get("farmerUid", ""), body.animalId)
    return enrollment
