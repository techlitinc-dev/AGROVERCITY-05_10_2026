from datetime import date, timedelta

from app.data.livestock_seed import SAMPLE_VET_SCHEDULES, VETS
from tests.test_diary import auth, seed_user

VET_PHONE = "+91 98220 11998"

MANAGED_VET = {
    "name": "Dr. Test Kulkarni",
    "phone": VET_PHONE,
    "qualification": "M.V.Sc",
    "specializations": ["gynaecology"],
    "clinicAddress": "Niphad, Nashik",
    "experienceYears": 12,
    "feeClinic": 500,
    "feeFarm": 700,
    "feeTele": 300,
    "visitTypes": ["clinic", "farm", "tele"],
    "serviceDistricts": ["Nashik"],
    "languages": ["mr", "hi", "en"],
    "vetCouncilRegNo": "MVSC-2009-4421",
}

ANIMAL = {
    "tagId": "100987654321",
    "name": "कपिला",
    "species": "cow",
    "breed": "गीर (Gir)",
    "gender": "female",
    "ageMonths": 42,
    "lactationStatus": "lactating",
    "lactationCycle": 2,
    "dailyYieldLiters": 16.5,
    "healthStatus": "healthy",
    "ownerType": "farmer",
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

CAMPAIGN = {
    "title": "FMD मोहिम — नाशिक",
    "vaccine": "Raksha-Ovac FMD",
    "disease": "FMD",
    "fromDate": "2026-10-01",
    "toDate": "2026-10-31",
    "targetDistricts": ["Nashik"],
}


def _mgr(user_store):
    return seed_user(user_store, uid="mgr-1", active_profile="dairyManager")


def _farmer(user_store, uid="farmer-1"):
    return seed_user(user_store, uid=uid, active_profile="farmer")


def _vet_user(user_store, uid="vet-user-1", phone=VET_PHONE):
    return seed_user(user_store, uid=uid, active_profile="farmer", phone=phone)


async def _create_managed_vet(client, token, payload=MANAGED_VET):
    resp = await client.post("/v1/livestock/vets/managed", json=payload, headers=auth(token))
    assert resp.status_code == 201
    return resp.json()


async def _claim(client, token):
    resp = await client.post("/v1/livestock/vets/claim", headers=auth(token))
    assert resp.status_code == 200
    return resp.json()


async def _book(client, farmer_token, vet_id, animal_id=""):
    body = {**APPOINTMENT, "vetId": vet_id, "animalId": animal_id}
    resp = await client.post("/v1/livestock/appointments", json=body, headers=auth(farmer_token))
    assert resp.status_code == 201
    return resp.json()


def _notifications_for(user_store, uid):
    return [d for d in user_store.values() if d.get("userId") == uid]


# --- Managed directory (manager CRUD) ---

async def test_manager_vet_crud(client, user_store):
    token = _mgr(user_store)
    vet = await _create_managed_vet(client, token)
    assert vet["status"] == "active"
    assert vet["onboardedBy"] == "mgr-1"
    assert vet["claimedByUid"] == ""
    assert vet["feeClinic"] == 500
    assert vet["consultationFeeRupees"] == 500

    resp = await client.get("/v1/livestock/vets/managed", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["data"][0]["claimed"] is False

    resp = await client.put(
        f"/v1/livestock/vets/managed/{vet['id']}",
        json={**MANAGED_VET, "feeClinic": 600, "experienceYears": 13},
        headers=auth(token),
    )
    assert resp.status_code == 200
    stored = user_store[f"vets/{vet['id']}"]
    assert stored["feeClinic"] == 600
    assert stored["experienceYears"] == 13
    assert stored["consultationFeeRupees"] == 600


async def test_manager_vet_deactivate(client, user_store):
    token = _mgr(user_store)
    vet = await _create_managed_vet(client, token)
    resp = await client.delete(f"/v1/livestock/vets/managed/{vet['id']}", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["status"] == "inactive"
    assert user_store[f"vets/{vet['id']}"]["status"] == "inactive"
    # vet still retrievable (soft delete)
    assert user_store[f"vets/{vet['id']}"]["name"] == MANAGED_VET["name"]


async def test_vet_crud_forbidden_for_farmer(client, user_store):
    farmer_token = _farmer(user_store)
    resp = await client.post(
        "/v1/livestock/vets/managed", json=MANAGED_VET, headers=auth(farmer_token)
    )
    assert resp.status_code == 403
    resp = await client.get("/v1/livestock/vets/managed", headers=auth(farmer_token))
    assert resp.status_code == 403


# --- Claim ---

async def test_claim_by_phone_match(client, user_store):
    _mgr(user_store)
    vet = await _create_managed_vet(client, seed_user(user_store, uid="mgr-1", active_profile="dairyManager"))
    vet_token = _vet_user(user_store)
    claimed = await _claim(client, vet_token)
    assert claimed["id"] == vet["id"]
    assert claimed["claimedByUid"] == "vet-user-1"
    assert user_store[f"vets/{vet['id']}"]["claimedByUid"] == "vet-user-1"


async def test_claim_already_claimed_guard(client, user_store):
    mgr_token = _mgr(user_store)
    vet = await _create_managed_vet(client, mgr_token)
    await _claim(client, _vet_user(user_store))
    other_token = _vet_user(user_store, uid="vet-user-2")
    resp = await client.post("/v1/livestock/vets/claim", headers=auth(other_token))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "ALREADY_CLAIMED"
    assert user_store[f"vets/{vet['id']}"]["claimedByUid"] == "vet-user-1"


async def test_claim_404_for_non_matching_phone(client, user_store):
    mgr_token = _mgr(user_store)
    await _create_managed_vet(client, mgr_token)
    stranger = _vet_user(user_store, uid="stranger-1", phone="+919000000000")
    resp = await client.post("/v1/livestock/vets/claim", headers=auth(stranger))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "VET_NOT_FOUND"


async def test_vet_me_requires_claim(client, user_store):
    token = _vet_user(user_store, phone="+919000000000")
    resp = await client.get("/v1/livestock/vets/me", headers=auth(token))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "VET_PROFILE_NOT_FOUND"


async def test_vet_me_after_claim(client, user_store):
    mgr_token = _mgr(user_store)
    await _create_managed_vet(client, mgr_token)
    vet_token = _vet_user(user_store)
    await _claim(client, vet_token)
    resp = await client.get("/v1/livestock/vets/me", headers=auth(vet_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["vet"]["claimedByUid"] == "vet-user-1"
    assert body["schedule"]["vetId"] == body["vet"]["id"]
    assert "totalAppointments" in body["stats"]
    assert "monthEarnings" in body["stats"]
    assert "ratingAvg" in body["stats"]


# --- Schedule ---

async def test_schedule_merge_put(client, user_store):
    mgr_token = _mgr(user_store)
    vet = await _create_managed_vet(client, mgr_token)
    vet_token = _vet_user(user_store)
    await _claim(client, vet_token)

    resp = await client.put(
        "/v1/livestock/vets/me/schedule",
        json={
            "weeklySlots": [{"day": 1, "slots": [{"start": "09:00", "end": "13:00"}]}],
            "leaves": ["2026-10-02"],
            "emergencyAvailable": True,
            "teleAvailable": True,
        },
        headers=auth(vet_token),
    )
    assert resp.status_code == 200
    assert resp.json()["weeklySlots"][0]["day"] == 1

    # second PUT merges leaves, leaves weeklySlots untouched
    resp = await client.put(
        "/v1/livestock/vets/me/schedule",
        json={"leaves": ["2026-10-05"]},
        headers=auth(vet_token),
    )
    assert resp.status_code == 200
    schedule = resp.json()
    assert sorted(schedule["leaves"]) == ["2026-10-02", "2026-10-05"]
    assert schedule["weeklySlots"][0]["day"] == 1
    assert schedule["emergencyAvailable"] is True
    assert user_store[f"vet_schedules/{vet['id']}"]["teleAvailable"] is True


# --- Appointments ---

async def test_appointment_create_and_farmer_list(client, user_store):
    mgr_token = _mgr(user_store)
    vet = await _create_managed_vet(client, mgr_token)
    vet_token = _vet_user(user_store)
    await _claim(client, vet_token)
    farmer_token = _farmer(user_store)

    appt = await _book(client, farmer_token, vet["id"])
    assert appt["status"] == "requested"
    assert appt["farmerUid"] == "farmer-1"
    assert appt["fee"] == 500
    assert appt["vetName"] == MANAGED_VET["name"]
    assert user_store[f"appointments/{appt['id']}"]["status"] == "requested"

    # FCM to the claimed vet on create
    vet_notifications = _notifications_for(user_store, "vet-user-1")
    assert len(vet_notifications) == 1
    assert vet_notifications[0]["data"]["kind"] == "appointment_requested"

    resp = await client.get("/v1/livestock/appointments", headers=auth(farmer_token))
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    assert resp.json()["data"][0]["id"] == appt["id"]


async def test_manager_sees_all_appointments_newest_first(client, user_store):
    mgr_token = _mgr(user_store)
    vet = await _create_managed_vet(client, mgr_token)
    vet_token = _vet_user(user_store)
    await _claim(client, vet_token)
    farmer_1 = _farmer(user_store, "farmer-1")
    farmer_2 = _farmer(user_store, "farmer-2")
    appt_1 = await _book(client, farmer_1, vet["id"])
    appt_2 = await _book(client, farmer_2, vet["id"])

    resp = await client.get("/v1/livestock/appointments", headers=auth(mgr_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    ids = [a["id"] for a in body["data"]]
    assert appt_1["id"] in ids
    assert appt_2["id"] in ids
    assert body["data"][0]["id"] == appt_2["id"]  # newest first

    # status filter composes with the manager scope
    await client.post(
        f"/v1/livestock/appointments/{appt_1['id']}/status",
        json={"status": "confirmed"},
        headers=auth(vet_token),
    )
    resp = await client.get("/v1/livestock/appointments?status=confirmed", headers=auth(mgr_token))
    assert resp.json()["total"] == 1
    assert resp.json()["data"][0]["id"] == appt_1["id"]

    # date filter composes too
    resp = await client.get(
        f"/v1/livestock/appointments?date={APPOINTMENT['slotDate']}&status=requested",
        headers=auth(mgr_token),
    )
    assert resp.json()["total"] == 1
    assert resp.json()["data"][0]["id"] == appt_2["id"]


async def test_farmer_appointments_still_scoped_to_own(client, user_store):
    mgr_token = _mgr(user_store)
    vet = await _create_managed_vet(client, mgr_token)
    vet_token = _vet_user(user_store)
    await _claim(client, vet_token)
    farmer_1 = _farmer(user_store, "farmer-1")
    farmer_2 = _farmer(user_store, "farmer-2")
    appt_1 = await _book(client, farmer_1, vet["id"])
    await _book(client, farmer_2, vet["id"])

    resp = await client.get("/v1/livestock/appointments", headers=auth(farmer_1))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["data"][0]["id"] == appt_1["id"]


async def test_appointment_respects_weekly_schedule(client, user_store):
    user_store["vets/vet-1"] = dict(VETS[0])
    user_store["vet_schedules/vet-1"] = dict(SAMPLE_VET_SCHEDULES[0])
    vet_token = _vet_user(user_store)
    await _claim(client, vet_token)
    farmer_token = _farmer(user_store)

    today = date(2026, 9, 26)
    monday = (today + timedelta(days=(0 - today.weekday()) % 7)).isoformat()
    tuesday = (today + timedelta(days=(1 - today.weekday()) % 7)).isoformat()

    ok = await client.post(
        "/v1/livestock/appointments",
        json={**APPOINTMENT, "vetId": "vet-1", "slotDate": monday},
        headers=auth(farmer_token),
    )
    assert ok.status_code == 201

    bad = await client.post(
        "/v1/livestock/appointments",
        json={**APPOINTMENT, "vetId": "vet-1", "slotDate": tuesday},
        headers=auth(farmer_token),
    )
    assert bad.status_code == 400
    assert bad.json()["error"]["code"] == "SLOT_UNAVAILABLE"


async def test_appointment_vet_lifecycle_with_inline_prescription(client, user_store):
    mgr_token = _mgr(user_store)
    vet = await _create_managed_vet(client, mgr_token)
    vet_token = _vet_user(user_store)
    await _claim(client, vet_token)
    farmer_token = _farmer(user_store)
    appt = await _book(client, farmer_token, vet["id"], animal_id="c-101")

    resp = await client.post(
        f"/v1/livestock/appointments/{appt['id']}/status",
        json={"status": "confirmed"},
        headers=auth(vet_token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "confirmed"
    farmer_notifications = _notifications_for(user_store, "farmer-1")
    assert any(n["data"]["kind"] == "appointment_status" for n in farmer_notifications)

    resp = await client.post(
        f"/v1/livestock/appointments/{appt['id']}/status",
        json={"status": "in-progress"},
        headers=auth(vet_token),
    )
    assert resp.status_code == 200

    resp = await client.post(
        f"/v1/livestock/appointments/{appt['id']}/status",
        json={"status": "completed", "vetNotes": "उत्तम प्रतिसाद", "prescription": PRESCRIPTION},
        headers=auth(vet_token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "completed"
    assert body["vetNotes"] == "उत्तम प्रतिसाद"
    rx_id = body["prescriptionId"]
    assert rx_id

    rx = user_store[f"prescriptions/{rx_id}"]
    assert rx["appointmentId"] == appt["id"]
    assert rx["vetId"] == vet["id"]
    assert rx["farmerUid"] == "farmer-1"
    assert rx["animalId"] == "c-101"
    assert rx["diagnosis"] == PRESCRIPTION["diagnosis"]
    assert rx["medicines"][0]["name"] == "Intramammary Tube"
    assert rx["milkWithdrawalDays"] == 3


async def test_farmer_cannot_confirm_appointment(client, user_store):
    mgr_token = _mgr(user_store)
    vet = await _create_managed_vet(client, mgr_token)
    vet_token = _vet_user(user_store)
    await _claim(client, vet_token)
    farmer_token = _farmer(user_store)
    appt = await _book(client, farmer_token, vet["id"])

    resp = await client.post(
        f"/v1/livestock/appointments/{appt['id']}/status",
        json={"status": "confirmed"},
        headers=auth(farmer_token),
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"


async def test_farmer_can_cancel_appointment(client, user_store):
    mgr_token = _mgr(user_store)
    vet = await _create_managed_vet(client, mgr_token)
    vet_token = _vet_user(user_store)
    await _claim(client, vet_token)
    farmer_token = _farmer(user_store)
    appt = await _book(client, farmer_token, vet["id"])

    resp = await client.post(
        f"/v1/livestock/appointments/{appt['id']}/status",
        json={"status": "cancelled", "cancelReason": "जरूरी काम"},
        headers=auth(farmer_token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"
    assert resp.json()["cancelReason"] == "जरूरी काम"
    # vet (counterparty) is notified of the cancellation
    assert _notifications_for(user_store, "vet-user-1")

    resp = await client.post(
        f"/v1/livestock/appointments/{appt['id']}/status",
        json={"status": "cancelled"},
        headers=auth(farmer_token),
    )
    assert resp.status_code == 403


async def test_other_vet_cannot_confirm(client, user_store):
    mgr_token = _mgr(user_store)
    vet = await _create_managed_vet(client, mgr_token)
    await _create_managed_vet(
        client, mgr_token, {**MANAGED_VET, "phone": "+91 94222 33445", "name": "Dr. Other"}
    )
    vet_token = _vet_user(user_store)
    await _claim(client, vet_token)
    other_vet_token = _vet_user(user_store, uid="vet-user-2", phone="+91 94222 33445")
    await _claim(client, other_vet_token)

    farmer_token = _farmer(user_store)
    appt = await _book(client, farmer_token, vet["id"])
    resp = await client.post(
        f"/v1/livestock/appointments/{appt['id']}/status",
        json={"status": "confirmed"},
        headers=auth(other_vet_token),
    )
    assert resp.status_code == 403


async def test_appointment_invalid_transition_409(client, user_store):
    mgr_token = _mgr(user_store)
    vet = await _create_managed_vet(client, mgr_token)
    vet_token = _vet_user(user_store)
    await _claim(client, vet_token)
    farmer_token = _farmer(user_store)
    appt = await _book(client, farmer_token, vet["id"])

    resp = await client.post(
        f"/v1/livestock/appointments/{appt['id']}/status",
        json={"status": "in-progress"},
        headers=auth(vet_token),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "INVALID_TRANSITION"

    resp = await client.post(
        f"/v1/livestock/appointments/{appt['id']}/status",
        json={"status": "completed"},
        headers=auth(vet_token),
    )
    assert resp.status_code == 409


async def test_vet_inbox_filter(client, user_store):
    mgr_token = _mgr(user_store)
    vet = await _create_managed_vet(client, mgr_token)
    vet_token = _vet_user(user_store)
    await _claim(client, vet_token)
    farmer_token = _farmer(user_store)
    appt = await _book(client, farmer_token, vet["id"])
    await _book(client, farmer_token, vet["id"])

    resp = await client.get("/v1/livestock/vets/me/appointments?status=requested", headers=auth(vet_token))
    assert resp.status_code == 200
    assert resp.json()["total"] == 2

    await client.post(
        f"/v1/livestock/appointments/{appt['id']}/status",
        json={"status": "confirmed"},
        headers=auth(vet_token),
    )
    resp = await client.get("/v1/livestock/vets/me/appointments?status=confirmed", headers=auth(vet_token))
    assert resp.json()["total"] == 1
    resp = await client.get(
        f"/v1/livestock/vets/me/appointments?date={APPOINTMENT['slotDate']}", headers=auth(vet_token)
    )
    assert resp.json()["total"] == 2


# --- Prescriptions ---

async def _setup_with_animal(client, user_store):
    mgr_token = _mgr(user_store)
    vet = await _create_managed_vet(client, mgr_token)
    vet_token = _vet_user(user_store)
    await _claim(client, vet_token)
    farmer_token = _farmer(user_store)
    resp = await client.post("/v1/livestock/animals", json=ANIMAL, headers=auth(farmer_token))
    assert resp.status_code == 201
    animal_id = resp.json()["id"]
    return mgr_token, vet, vet_token, farmer_token, animal_id


async def test_prescription_create_by_vet(client, user_store):
    _, vet, vet_token, farmer_token, animal_id = await _setup_with_animal(client, user_store)
    resp = await client.post(
        "/v1/livestock/prescriptions",
        json={"animalId": animal_id, **PRESCRIPTION},
        headers=auth(vet_token),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["vetId"] == vet["id"]
    assert body["farmerUid"] == "farmer-1"
    assert body["animalId"] == animal_id


async def test_prescription_create_forbidden_for_plain_farmer(client, user_store):
    _, _, _, farmer_token, animal_id = await _setup_with_animal(client, user_store)
    resp = await client.post(
        "/v1/livestock/prescriptions",
        json={"animalId": animal_id, **PRESCRIPTION},
        headers=auth(farmer_token),
    )
    assert resp.status_code == 403


async def test_prescription_access_rules(client, user_store):
    mgr_token, _, vet_token, farmer_token, animal_id = await _setup_with_animal(client, user_store)
    resp = await client.post(
        "/v1/livestock/prescriptions",
        json={"animalId": animal_id, **PRESCRIPTION},
        headers=auth(vet_token),
    )
    rx_id = resp.json()["id"]

    # owner can read
    resp = await client.get(f"/v1/livestock/prescriptions?animalId={animal_id}", headers=auth(farmer_token))
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    assert resp.json()["data"][0]["id"] == rx_id

    # manager can read
    resp = await client.get(f"/v1/livestock/prescriptions?animalId={animal_id}", headers=auth(mgr_token))
    assert resp.status_code == 200

    # another claimed vet can read
    resp = await client.get(f"/v1/livestock/prescriptions?animalId={animal_id}", headers=auth(vet_token))
    assert resp.status_code == 200

    # unrelated farmer cannot
    stranger = _farmer(user_store, uid="farmer-9")
    resp = await client.get(f"/v1/livestock/prescriptions?animalId={animal_id}", headers=auth(stranger))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"


async def test_prescription_list_scoping(client, user_store):
    mgr_token, vet, vet_token, farmer_token, animal_id = await _setup_with_animal(client, user_store)
    await client.post(
        "/v1/livestock/prescriptions",
        json={"animalId": animal_id, **PRESCRIPTION},
        headers=auth(vet_token),
    )
    vet_docs = await client.get("/v1/livestock/prescriptions", headers=auth(vet_token))
    assert vet_docs.status_code == 200
    assert vet_docs.json()["total"] == 1
    assert vet_docs.json()["data"][0]["vetId"] == vet["id"]

    farmer_docs = await client.get("/v1/livestock/prescriptions", headers=auth(farmer_token))
    assert farmer_docs.status_code == 200
    assert farmer_docs.json()["total"] == 1
    assert farmer_docs.json()["data"][0]["farmerUid"] == "farmer-1"

    mgr_docs = await client.get("/v1/livestock/prescriptions", headers=auth(mgr_token))
    assert mgr_docs.json()["total"] == 1


# --- Vaccination campaigns ---

async def test_campaigns_create_list_detail(client, user_store):
    mgr_token = _mgr(user_store)
    farmer_token = _farmer(user_store)
    resp = await client.post(
        "/v1/livestock/vet/campaigns", json=CAMPAIGN, headers=auth(mgr_token)
    )
    assert resp.status_code == 201
    campaign = resp.json()
    assert campaign["organizerId"] == "mgr-1"
    assert campaign["status"] == "upcoming"

    resp = await client.get("/v1/livestock/vet/campaigns", headers=auth(farmer_token))
    assert resp.status_code == 200
    assert resp.json()["total"] == 1

    resp = await client.get(f"/v1/livestock/vet/campaigns/{campaign['id']}", headers=auth(farmer_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == CAMPAIGN["title"]
    assert body["enrollments"] == []
    assert body["enrollmentCount"] == 0

    resp = await client.get("/v1/livestock/vet/campaigns?status=active", headers=auth(farmer_token))
    assert resp.json()["total"] == 0


async def test_campaign_create_forbidden_for_farmer(client, user_store):
    farmer_token = _farmer(user_store)
    resp = await client.post("/v1/livestock/vet/campaigns", json=CAMPAIGN, headers=auth(farmer_token))
    assert resp.status_code == 403


async def test_campaign_enroll_own_animal(client, user_store):
    mgr_token = _mgr(user_store)
    resp = await client.post("/v1/livestock/vet/campaigns", json=CAMPAIGN, headers=auth(mgr_token))
    campaign_id = resp.json()["id"]
    farmer_token = _farmer(user_store)
    resp = await client.post("/v1/livestock/animals", json=ANIMAL, headers=auth(farmer_token))
    animal_id = resp.json()["id"]

    resp = await client.post(
        f"/v1/livestock/vet/campaigns/{campaign_id}/enroll",
        json={"animalId": animal_id},
        headers=auth(farmer_token),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "enrolled"
    assert body["farmerUid"] == "farmer-1"
    enrollment_id = body["id"]
    assert user_store[f"campaign_enrollments/{enrollment_id}"]["campaignId"] == campaign_id

    # reminder notification to the farmer
    notifications = _notifications_for(user_store, "farmer-1")
    assert any(n["data"]["kind"] == "campaign_enrolled" for n in notifications)

    # duplicate enrollment rejected
    resp = await client.post(
        f"/v1/livestock/vet/campaigns/{campaign_id}/enroll",
        json={"animalId": animal_id},
        headers=auth(farmer_token),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "ALREADY_ENROLLED"

    resp = await client.get(f"/v1/livestock/vet/campaigns/{campaign_id}", headers=auth(farmer_token))
    assert resp.json()["enrollmentCount"] == 1


async def test_campaign_enroll_other_animal_403(client, user_store):
    mgr_token = _mgr(user_store)
    resp = await client.post("/v1/livestock/vet/campaigns", json=CAMPAIGN, headers=auth(mgr_token))
    campaign_id = resp.json()["id"]
    farmer_token = _farmer(user_store)
    resp = await client.post("/v1/livestock/animals", json=ANIMAL, headers=auth(farmer_token))
    animal_id = resp.json()["id"]

    other_farmer = _farmer(user_store, uid="farmer-2")
    resp = await client.post(
        f"/v1/livestock/vet/campaigns/{campaign_id}/enroll",
        json={"animalId": animal_id},
        headers=auth(other_farmer),
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"


async def test_campaign_mark_vaccinated(client, user_store):
    mgr_token = _mgr(user_store)
    vet = await _create_managed_vet(client, mgr_token)
    vet_token = _vet_user(user_store)
    await _claim(client, vet_token)
    resp = await client.post("/v1/livestock/vet/campaigns", json=CAMPAIGN, headers=auth(mgr_token))
    campaign_id = resp.json()["id"]
    farmer_token = _farmer(user_store)
    resp = await client.post("/v1/livestock/animals", json=ANIMAL, headers=auth(farmer_token))
    animal_id = resp.json()["id"]
    await client.post(
        f"/v1/livestock/vet/campaigns/{campaign_id}/enroll",
        json={"animalId": animal_id},
        headers=auth(farmer_token),
    )

    # manager can mark
    resp = await client.post(
        f"/v1/livestock/vet/campaigns/{campaign_id}/mark-vaccinated",
        json={"animalId": animal_id},
        headers=auth(mgr_token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "vaccinated"
    assert resp.json()["vaccinatedAt"] != ""
    enrollment_id = resp.json()["id"]
    assert user_store[f"campaign_enrollments/{enrollment_id}"]["status"] == "vaccinated"

    # unknown animal enrollment → 404
    resp = await client.post(
        f"/v1/livestock/vet/campaigns/{campaign_id}/mark-vaccinated",
        json={"animalId": "c-missing"},
        headers=auth(mgr_token),
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "ENROLLMENT_NOT_FOUND"

    # a second campaign where the vet marks vaccinated
    resp = await client.post(
        "/v1/livestock/vet/campaigns",
        json={**CAMPAIGN, "title": "HS मोहिम"},
        headers=auth(mgr_token),
    )
    campaign_2 = resp.json()["id"]
    resp = await client.post(
        f"/v1/livestock/vet/campaigns/{campaign_2}/enroll",
        json={"animalId": animal_id},
        headers=auth(farmer_token),
    )
    assert resp.status_code == 201
    resp = await client.post(
        f"/v1/livestock/vet/campaigns/{campaign_2}/mark-vaccinated",
        json={"animalId": animal_id},
        headers=auth(vet_token),
    )
    assert resp.status_code == 200


# --- Earnings ---

async def test_vet_earnings_sum(client, user_store):
    mgr_token = _mgr(user_store)
    vet = await _create_managed_vet(client, mgr_token)
    vet_token = _vet_user(user_store)
    await _claim(client, vet_token)
    farmer_token = _farmer(user_store)

    for _ in range(2):
        appt = await _book(client, farmer_token, vet["id"])
        await client.post(
            f"/v1/livestock/appointments/{appt['id']}/status",
            json={"status": "confirmed"},
            headers=auth(vet_token),
        )
        await client.post(
            f"/v1/livestock/appointments/{appt['id']}/status",
            json={"status": "in-progress"},
            headers=auth(vet_token),
        )
        await client.post(
            f"/v1/livestock/appointments/{appt['id']}/status",
            json={"status": "completed"},
            headers=auth(vet_token),
        )

    month = date.today().strftime("%Y-%m")
    resp = await client.get(f"/v1/livestock/vets/me/earnings?month={month}", headers=auth(vet_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["completedAppointments"] == 2
    assert body["totalEarnings"] == 1000.0
    assert "ratingAvg" in body

    resp = await client.get("/v1/livestock/vets/me/earnings?month=2030-01", headers=auth(vet_token))
    assert resp.json()["totalEarnings"] == 0.0
