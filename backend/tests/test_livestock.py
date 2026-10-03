from app.data.livestock_seed import (
    DAIRY_PRODUCTS,
    GAUSHALAS,
    NURSERIES,
    SAMPLE_ANIMALS,
    SAMPLE_BREEDING_CYCLES,
    SAMPLE_COW_ADOPTIONS,
    SAMPLE_MILK_COLLECTIONS,
    SAMPLE_PANCHAGAVYA_PRODUCTS,
    SAMPLE_VACCINATIONS,
    SAMPLE_VET_RECORDS,
    VETS,
)
from tests.test_diary import auth, seed_user


def seed_livestock_store(user_store):
    for item in GAUSHALAS:
        user_store[f"gaushalas/{item['id']}"] = item
    for item in NURSERIES:
        user_store[f"nurseries/{item['id']}"] = item
    for item in VETS:
        user_store[f"vets/{item['id']}"] = item
    for item in DAIRY_PRODUCTS:
        user_store[f"dairy_products/{item['id']}"] = item
    for item in SAMPLE_ANIMALS:
        user_store[f"livestock_animals/{item['id']}"] = item
    for item in SAMPLE_MILK_COLLECTIONS:
        user_store[f"milk_collections/{item['id']}"] = item
    for item in SAMPLE_BREEDING_CYCLES:
        user_store[f"breeding_cycles/{item['id']}"] = item
    for item in SAMPLE_VET_RECORDS:
        user_store[f"vet_records/{item['id']}"] = item
    for item in SAMPLE_VACCINATIONS:
        user_store[f"vaccination_schedules/{item['id']}"] = item
    for item in SAMPLE_COW_ADOPTIONS:
        user_store[f"cow_adoptions/{item['id']}"] = item
    for item in SAMPLE_PANCHAGAVYA_PRODUCTS:
        user_store[f"panchagavya_products/{item['id']}"] = item


BOOKING = {"visitType": "clinic", "slot": "2026-09-18T10:00:00+05:30", "animalType": "गाय"}


# --- Legacy / Baseline Tests ---

async def test_gaushalas_by_district(client, user_store):
    seed_livestock_store(user_store)
    token = seed_user(user_store)
    resp = await client.get("/v1/gaushalas?district=Nashik", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["total"] == 3


async def test_manure_order_201(client, user_store):
    seed_livestock_store(user_store)
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/gaushalas/gau-1/manure-order",
        json={"product": "गोबर खत", "quantity": "2 ट्रॅक्टर"},
        headers=auth(token),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "placed"
    order = user_store[f"users/uid-1/manure_orders/{body['orderId']}"]
    assert order["gaushalaId"] == "gau-1"


async def test_vets_emergency_filter(client, user_store):
    seed_livestock_store(user_store)
    token = seed_user(user_store)
    resp = await client.get("/v1/vets?emergency=true", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    distances = [v["distanceKm"] for v in body["data"]]
    assert distances == sorted(distances)
    assert all(v["emergencyAvailable"] for v in body["data"])


async def test_farm_visit_unavailable_400(client, user_store):
    seed_livestock_store(user_store)
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/vets/vet-4/book",
        json={**BOOKING, "visitType": "farm"},
        headers=auth(token),
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "FARM_VISIT_UNAVAILABLE"


async def test_vet_booking_visible_in_my_bookings(client, user_store):
    seed_livestock_store(user_store)
    token = seed_user(user_store)
    resp = await client.post("/v1/vets/vet-1/book", json=BOOKING, headers=auth(token))
    assert resp.status_code == 201
    assert resp.json()["status"] == "confirmed"
    resp = await client.get("/v1/users/me/bookings", headers=auth(token))
    assert resp.status_code == 200
    vet_bookings = resp.json()["vet"]
    assert len(vet_bookings) == 1
    assert vet_bookings[0]["vetName"] == "Dr. Anand Kulkarni (M.V.Sc)"


async def test_dairy_order_out_of_stock_409(client, user_store):
    seed_livestock_store(user_store)
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/dairy-products/dp-6/order",
        json={"quantity": 1},
        headers=auth(token),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "OUT_OF_STOCK"


async def test_dairy_order_total(client, user_store):
    seed_livestock_store(user_store)
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/dairy-products/dp-5/order",
        json={"quantity": 2},
        headers=auth(token),
    )
    assert resp.status_code == 201
    assert resp.json()["total"] == 900


# --- New Livestock, Dairy, Breeding, Vet & Gaushala Management Tests ---

async def test_register_and_list_animals(client, user_store):
    seed_livestock_store(user_store)
    token = seed_user(user_store)
    # Register new cattle
    new_cow = {
        "tagId": "100987654399",
        "name": "लक्ष्मी (Lakshmi)",
        "species": "cow",
        "breed": "गीर (Gir)",
        "gender": "female",
        "ageMonths": 36,
        "lactationStatus": "lactating",
        "lactationCycle": 1,
        "dailyYieldLiters": 15.0,
        "sire": "Gir-Bhavnagar-04",
        "dam": "Gauri-10",
        "healthStatus": "healthy",
        "ownerType": "farmer",
        "photoUrl": "",
    }
    resp = await client.post("/v1/livestock/animals", json=new_cow, headers=auth(token))
    assert resp.status_code == 201
    body = resp.json()
    assert body["tagId"] == "100987654399"
    assert body["name"] == "लक्ष्मी (Lakshmi)"

    # List animals
    list_resp = await client.get("/v1/livestock/animals?species=cow", headers=auth(token))
    assert list_resp.status_code == 200
    assert any(a["tagId"] == "100987654399" for a in list_resp.json()["data"])


async def test_add_animal_yield_log(client, user_store):
    seed_livestock_store(user_store)
    token = seed_user(user_store)
    log_data = {
        "date": "2026-09-25",
        "shift": "morning",
        "yieldLiters": 8.5,
        "fatPercent": 4.3,
        "snfPercent": 8.9,
        "notes": "सकाळचे दूध मोजले, गुणवत्ता उत्तम.",
    }
    resp = await client.post("/v1/livestock/animals/c-101/logs", json=log_data, headers=auth(token))
    assert resp.status_code == 201
    assert resp.json()["yieldLiters"] == 8.5

    list_resp = await client.get("/v1/livestock/animals/c-101/logs", headers=auth(token))
    assert list_resp.status_code == 200
    assert len(list_resp.json()["data"]) >= 1


async def test_rate_chart_calculation(client, user_store):
    token = seed_user(user_store)
    calc_data = {
        "milkType": "cow",
        "fatPercent": 4.5,
        "snfPercent": 8.8,
        "liters": 10.0,
    }
    resp = await client.post("/v1/livestock/procurement/rate-calc", json=calc_data, headers=auth(token))
    assert resp.status_code == 200
    res = resp.json()
    assert res["ratePerLiter"] > 35.0  # Base rate is 35.0, plus premiums
    assert res["totalAmount"] == round(res["ratePerLiter"] * 10.0, 2)


async def test_record_milk_collection_and_summary(client, user_store):
    seed_livestock_store(user_store)
    token = seed_user(user_store)
    col_data = {
        "farmerName": "दिलीप शिंदे",
        "farmerCode": "F-099",
        "farmerPhone": "+919822456789",
        "date": "2026-09-25",
        "shift": "morning",
        "milkType": "cow",
        "liters": 20.0,
        "fatPercent": 4.2,
        "snfPercent": 8.7,
        "clr": 28.5,
    }
    resp = await client.post("/v1/livestock/procurement/collections", json=col_data, headers=auth(token))
    assert resp.status_code == 201
    assert resp.json()["farmerCode"] == "F-099"
    assert "SLIP" in resp.json()["slipNumber"]

    # Check summary
    summary_resp = await client.get("/v1/livestock/procurement/summary?date=2026-09-25", headers=auth(token))
    assert summary_resp.status_code == 200
    sum_data = summary_resp.json()
    assert sum_data["totalMorningLiters"] >= 20.0
    assert sum_data["collectionsCount"] >= 1


async def test_breeding_cycle_workflow(client, user_store):
    seed_livestock_store(user_store)
    token = seed_user(user_store)
    cycle_data = {
        "animalId": "c-101",
        "animalTagId": "100987654321",
        "animalName": "कपिला",
        "heatDate": "2026-09-01",
        "aiDate": "2026-09-02",
        "semenStrawId": "GIR-NDDB-77",
        "bullBreed": "शुद्ध गीर",
        "technicianName": "डॉ. आनंद कुलकर्णी",
        "species": "cow",
        "notes": "पहिला डोस",
    }
    resp = await client.post("/v1/livestock/breeding", json=cycle_data, headers=auth(token))
    assert resp.status_code == 201
    cycle_id = resp.json()["id"]
    assert resp.json()["expectedCalvingDate"] != ""

    # Update status to pregnant
    update_resp = await client.put(
        f"/v1/livestock/breeding/{cycle_id}/status?status=pregnant&pregnancyStatus=confirmed_pregnant",
        headers=auth(token),
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["status"] == "pregnant"


async def test_vet_clinical_records(client, user_store):
    seed_livestock_store(user_store)
    token = seed_user(user_store)
    record_data = {
        "farmerName": "रामसिंग पाटील",
        "animalTagId": "100987654321",
        "animalName": "कपिला",
        "species": "cow",
        "visitDate": "2026-09-25",
        "visitType": "clinic",
        "temperatureF": 103.1,
        "symptoms": ["ताप", "नाकातून स्त्राव"],
        "diagnosis": "हवामान बदल सर्दी व खोकला",
        "clinicalNotes": "३ दिवस अँटिबायोटिक व आराम आवश्यक",
        "prescriptions": [{"medicine": "Paracetamol 500mg bolus", "dosage": "1 bolus twice daily"}],
        "feeCharged": 350,
    }
    resp = await client.post("/v1/livestock/vet/records", json=record_data, headers=auth(token))
    assert resp.status_code == 201
    assert resp.json()["diagnosis"] == "हवामान बदल सर्दी व खोकला"


async def test_vaccination_scheduler(client, user_store):
    seed_livestock_store(user_store)
    token = seed_user(user_store)
    vac_data = {
        "animalTagId": "100987654321",
        "animalName": "कपिला",
        "disease": "FMD",
        "vaccineName": "Raksha-Ovac FMD",
        "batchNumber": "FMD-BATCH-99",
        "administeredDate": "2026-09-25",
    }
    resp = await client.post("/v1/livestock/vet/vaccinations", json=vac_data, headers=auth(token))
    assert resp.status_code == 201
    assert resp.json()["nextDueDate"] != ""


async def test_gaushala_adoption_and_donations(client, user_store):
    seed_livestock_store(user_store)
    token = seed_user(user_store)
    adopt_data = {
        "gaushalaId": "gau-1",
        "cowTagId": "100987654324",
        "cowName": "मंगला",
        "donorName": "सुरेश मेहता",
        "donorPhone": "+919822334455",
        "donorCity": "मुंबई (Mumbai)",
        "tier": "gau_gras",
        "amountInr": 1100,
        "billingCycle": "monthly",
    }
    resp = await client.post("/v1/livestock/gaushala/adoptions", json=adopt_data, headers=auth(token))
    assert resp.status_code == 201
    assert resp.json()["certificateNumber"].startswith("GOSH-")

    # Fodder donation
    don_data = {
        "gaushalaId": "gau-1",
        "donorName": "सुरेश मेहता",
        "donationType": "green_fodder",
        "quantityDescription": "१ ट्रॉली हिरवा चारा",
        "amountInr": 1800,
    }
    don_resp = await client.post("/v1/livestock/gaushala/donations", json=don_data, headers=auth(token))
    assert don_resp.status_code == 201
    assert don_resp.json()["amountInr"] == 1800

    # List panchagavya products
    prods_resp = await client.get("/v1/livestock/gaushala/byproducts", headers=auth(token))
    assert prods_resp.status_code == 200
    assert len(prods_resp.json()["data"]) >= 1
