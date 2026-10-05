"""WS-06 vet gating tests.

Covers: the ₹299 vet-Pro entitlement wall on campaign tools, the verified-vet
credential gate (`VET_NOT_VERIFIED`), the admin credential mutation + its
audit_logs row, and the herd-health task lifecycle emitted through the phase-01
task engine.

The vet tier config is seeded the way `backend/app/services/billing.py`
registers plans (persona `vet`, ₹299/mo Pro), so the gate is exercised without
touching the shared plans registry.
"""
from tests.test_diary import auth, seed_user

VET_PHONE = "+91 98220 11998"
ADMIN_TOKEN = "admin-token"

MANAGED_VET = {
    "name": "Dr. Gating Kulkarni",
    "phone": VET_PHONE,
    "qualification": "M.V.Sc",
    "specializations": ["gynaecology"],
    "clinicAddress": "Niphad, Nashik",
    "experienceYears": 12,
    "feeClinic": 500,
    "feeFarm": 700,
    "feeTele": 300,
    "visitTypes": ["clinic", "farm", "tele"],
}

CAMPAIGN = {
    "title": "FMD मोहिम — नाशिक",
    "vaccine": "Raksha-Ovac FMD",
    "disease": "FMD",
    "fromDate": "2026-10-01",
    "toDate": "2026-10-31",
    "targetDistricts": ["Nashik"],
}

ANIMAL = {
    "tagId": "100987654321",
    "name": "कपिला",
    "species": "cow",
    "breed": "Gir",
    "gender": "female",
    "ageMonths": 42,
    "lactationStatus": "lactating",
    "lactationCycle": 2,
    "dailyYieldLiters": 16.5,
    "healthStatus": "healthy",
}

APPOINTMENT = {
    "visitType": "clinic",
    "slotDate": "2026-09-28",
    "slotTime": "10:00",
    "symptoms": "ताप व कास",
    "fee": 500,
}

PRESCRIPTION = {
    "diagnosis": "सुरुवातीचा कासदाह",
    "medicines": [{"name": "Intramammary Tube", "dosage": "1 tube twice daily", "durationDays": 3}],
    "advice": "कास स्वच्छ ठेवावी",
    "milkWithdrawalDays": 3,
    "followUpDate": "2026-10-05",
}

VET_FEATURES = ["vetCampaigns", "vetScheduleEditor"]


def _seed_vet_plan(user_store, uid, tier):
    """Register the vet plan docs exactly as billing.py's plans registry would."""
    if tier == "free":
        user_store["plans/vet_free"] = {
            "planId": "vet_free",
            "persona": "vet",
            "tier": "free",
            "priceMonthlyPaisa": 0,
            "limits": {"vetCampaigns": 0, "vetScheduleEditor": 0},
            "features": [],
        }
        return
    user_store["plans/vet_pro"] = {
        "planId": "vet_pro",
        "persona": "vet",
        "tier": "pro",
        "priceMonthlyPaisa": 29900,
        "limits": {},
        "features": VET_FEATURES,
    }
    user_store[f"subscriptions/sub_{uid}"] = {
        "id": f"sub_{uid}",
        "userId": uid,
        "planId": "vet_pro",
        "status": "active",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }


async def _vet_with_profile(client, user_store, uid="vet-user-1", phone=VET_PHONE):
    """Manager onboards a vet; the vet claims the profile by phone match."""
    mgr_token = seed_user(user_store, uid="mgr-1", active_profile="dairyManager")
    resp = await client.post(
        "/v1/livestock/vets/managed", json={**MANAGED_VET, "phone": phone}, headers=auth(mgr_token)
    )
    assert resp.status_code == 201
    vet = resp.json()
    vet_token = seed_user(user_store, uid=uid, active_profile="farmer", phone=phone)
    resp = await client.post("/v1/livestock/vets/claim", headers=auth(vet_token))
    assert resp.status_code == 200
    return vet, vet_token


async def _set_credential(client, vet_id, status="verified"):
    resp = await client.post(
        f"/v1/livestock/vets/managed/{vet_id}/credential",
        json={"status": status, "reason": "council registration checked"},
        headers=auth(ADMIN_TOKEN),
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


# --- Entitlement wall (₹299 vet Pro) ---

async def test_free_vet_blocked_from_campaign_creation(client, user_store):
    vet, vet_token = await _vet_with_profile(client, user_store)
    _seed_vet_plan(user_store, "vet-user-1", "free")
    await _set_credential(client, vet["id"])

    resp = await client.post("/v1/livestock/vet/campaigns", json=CAMPAIGN, headers=auth(vet_token))
    assert resp.status_code == 402, resp.text
    body = resp.json()["error"]
    assert body["code"] == "ENTITLEMENT_EXCEEDED"
    assert body["planId"] == "vet_free"


async def test_pro_vet_creates_campaign(client, user_store):
    vet, vet_token = await _vet_with_profile(client, user_store)
    _seed_vet_plan(user_store, "vet-user-1", "pro")
    await _set_credential(client, vet["id"])

    resp = await client.post("/v1/livestock/vet/campaigns", json=CAMPAIGN, headers=auth(vet_token))
    assert resp.status_code == 201, resp.text
    campaign = resp.json()
    assert campaign["organizerId"] == "vet-user-1"
    assert campaign["status"] == "upcoming"


async def test_free_vet_schedule_editor_gated(client, user_store):
    vet, vet_token = await _vet_with_profile(client, user_store)
    _seed_vet_plan(user_store, "vet-user-1", "free")

    resp = await client.put(
        "/v1/livestock/vets/me/schedule",
        json={"emergencyAvailable": True},
        headers=auth(vet_token),
    )
    assert resp.status_code == 402
    assert resp.json()["error"]["code"] == "ENTITLEMENT_EXCEEDED"

    # Pro unlocks the schedule editor
    _seed_vet_plan(user_store, "vet-user-1", "pro")
    resp = await client.put(
        "/v1/livestock/vets/me/schedule",
        json={"emergencyAvailable": True},
        headers=auth(vet_token),
    )
    assert resp.status_code == 200
    assert resp.json()["emergencyAvailable"] is True


# --- Credential verification gate ---

async def test_unverified_pro_vet_blocked_from_campaign(client, user_store):
    vet, vet_token = await _vet_with_profile(client, user_store)
    _seed_vet_plan(user_store, "vet-user-1", "pro")
    # credentialStatus defaults to "pending" — Pro but not verified
    assert vet["credentialStatus"] == "pending"

    resp = await client.post("/v1/livestock/vet/campaigns", json=CAMPAIGN, headers=auth(vet_token))
    assert resp.status_code == 403, resp.text
    assert resp.json()["error"]["code"] == "VET_NOT_VERIFIED"

    # after verification the same call succeeds
    await _set_credential(client, vet["id"])
    resp = await client.post("/v1/livestock/vet/campaigns", json=CAMPAIGN, headers=auth(vet_token))
    assert resp.status_code == 201


async def test_free_vet_keeps_appointments_and_basic_prescriptions(client, user_store):
    vet, vet_token = await _vet_with_profile(client, user_store)
    _seed_vet_plan(user_store, "vet-user-1", "free")
    farmer_token = seed_user(user_store, uid="farmer-1", active_profile="farmer")

    resp = await client.post(
        "/v1/livestock/appointments",
        json={**APPOINTMENT, "vetId": vet["id"]},
        headers=auth(farmer_token),
    )
    assert resp.status_code == 201, resp.text
    appt = resp.json()
    resp = await client.post(
        f"/v1/livestock/appointments/{appt['id']}/status",
        json={"status": "confirmed"},
        headers=auth(vet_token),
    )
    assert resp.status_code == 200

    resp = await client.post("/v1/livestock/animals", json=ANIMAL, headers=auth(farmer_token))
    assert resp.status_code == 201
    animal_id = resp.json()["id"]
    resp = await client.post(
        "/v1/livestock/prescriptions",
        json={"animalId": animal_id, **PRESCRIPTION},
        headers=auth(vet_token),
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["vetId"] == vet["id"]


async def test_credential_status_mutation_writes_audit(client, user_store):
    vet, _ = await _vet_with_profile(client, user_store)
    returned = await _set_credential(client, vet["id"], "verified")
    assert returned["credentialStatus"] == "verified"
    assert user_store[f"vets/{vet['id']}"]["credentialStatus"] == "verified"

    logs = [doc for key, doc in user_store.items() if key.startswith("audit_logs/")]
    assert len(logs) == 1
    assert logs[0]["action"] == "VET_CREDENTIAL_UPDATE"
    assert logs[0]["status"] == "verified"
    assert logs[0]["reason"] == "council registration checked"
    assert logs[0]["actorId"]

    # filtered list endpoint for the future admin queue
    mgr_token = seed_user(user_store, uid="mgr-1", active_profile="dairyManager")
    resp = await client.get(
        "/v1/livestock/vets/managed?credentialStatus=verified", headers=auth(mgr_token)
    )
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    resp = await client.get(
        "/v1/livestock/vets/managed?credentialStatus=pending", headers=auth(mgr_token)
    )
    assert resp.json()["total"] == 0


# --- Herd-health task lifecycle (phase-01 task engine) ---

async def test_herd_health_task_lifecycle(client, user_store):
    mgr_token = seed_user(user_store, uid="mgr-1", active_profile="dairyManager")
    resp = await client.post("/v1/livestock/vet/campaigns", json=CAMPAIGN, headers=auth(mgr_token))
    assert resp.status_code == 201
    campaign_id = resp.json()["id"]

    farmer_token = seed_user(user_store, uid="farmer-1", active_profile="farmer")
    resp = await client.post("/v1/livestock/animals", json=ANIMAL, headers=auth(farmer_token))
    assert resp.status_code == 201
    animal_id = resp.json()["id"]

    # 1) a vaccination record with a due date emits a farmer task deep-linked to the animal
    resp = await client.post(
        "/v1/livestock/vet/vaccinations",
        json={
            "animalTagId": animal_id,
            "animalName": ANIMAL["name"],
            "disease": "FMD",
            "vaccineName": "Raksha-Ovac FMD",
            "administeredDate": "2026-09-25",
        },
        headers=auth(farmer_token),
    )
    assert resp.status_code == 201, resp.text
    due = resp.json()["nextDueDate"]
    assert due

    tasks = [doc for key, doc in user_store.items() if key.startswith("tasks/")]
    vac_tasks = [task for task in tasks if task.get("kind") == "vaccination_due"]
    assert len(vac_tasks) == 1
    assert vac_tasks[0]["userId"] == "farmer-1"
    assert vac_tasks[0]["dueAt"] == due
    assert vac_tasks[0]["deepLink"] == f"/livestock/animals/{animal_id}"
    assert vac_tasks[0]["title"]["en"].startswith("vaccination due:")
    assert vac_tasks[0]["title"]["hi"]
    assert vac_tasks[0]["status"] == "open"

    # 2) campaign enrollment emits a task deep-linked to the campaign
    resp = await client.post(
        f"/v1/livestock/vet/campaigns/{campaign_id}/enroll",
        json={"animalId": animal_id},
        headers=auth(farmer_token),
    )
    assert resp.status_code == 201, resp.text
    tasks = [doc for key, doc in user_store.items() if key.startswith("tasks/")]
    camp_tasks = [task for task in tasks if task.get("kind") == "campaign_vaccination_due"]
    assert len(camp_tasks) == 1
    assert camp_tasks[0]["userId"] == "farmer-1"
    assert camp_tasks[0]["deepLink"] == f"/vetnet/campaigns/{campaign_id}"

    # 3) mark-vaccinated resolves the farmer's open herd-health tasks
    resp = await client.post(
        f"/v1/livestock/vet/campaigns/{campaign_id}/mark-vaccinated",
        json={"animalId": animal_id},
        headers=auth(mgr_token),
    )
    assert resp.status_code == 200, resp.text
    tasks = [doc for key, doc in user_store.items() if key.startswith("tasks/")]
    assert len(tasks) == 2
    assert all(task["status"] == "done" for task in tasks)
