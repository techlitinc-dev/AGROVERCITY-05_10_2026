"""End-to-End Test Suite: Acting as a Universal Omni-Persona User with All 6 Profiles.

Verifies complete multi-persona journey:
- User possesses ALL 6 agricultural profiles: farmer, farmLandlord, transporter, seller, equipmentRental, broker
- Seamlessly activates each persona in succession
- Executes persona-locked operations across agriculture, commerce, logistics, leasing, machinery, and brokerage
- Verifies Kisan Mitra Gemini AI Chatbot, AgriCoins Gamification, and Cross-Persona State Consistency
"""
import pytest
from datetime import datetime, timedelta, timezone

from app.services.tokens import create_access_token
from tests.test_diary import auth
from tests.test_advisory import PNG_BYTES

ALL_PROFILES = [
    "farmer",
    "farmLandlord",
    "transporter",
    "seller",
    "equipmentRental",
    "broker",
]


def seed_omni_user(user_store, uid="omni-user-777"):
    """Seeds a single user entity possessing all 6 linked agricultural personas."""
    user_store[f"users/{uid}"] = {
        "id": uid,
        "name": "Balaram Kisan (Universal Agro-Entrepreneur)",
        "phone": "+919876500001",
        "district": "Nashik",
        "state": "Maharashtra",
        "lat": 19.9975,
        "lng": 73.7898,
        "linkedProfiles": list(ALL_PROFILES),
        "activeProfile": "farmer",
        "primaryProfile": "farmer",
        "agriCoins": 500,
        "status": "active",
        "createdAt": "2026-09-01T00:00:00Z",
    }
    # Initialize persona profile subdocuments
    for p in ALL_PROFILES:
        user_store[f"users/{uid}/role_profiles/{p}"] = {
            "profileType": p,
            "activatedAt": "2026-09-01T00:00:00Z",
            "isPrimary": (p == "farmer"),
        }
    return create_access_token(uid)


async def _activate_persona(client, token, persona):
    resp = await client.post(f"/v1/users/me/profiles/{persona}/activate", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["activeProfile"] == persona


@pytest.mark.asyncio
async def test_omni_user_profile_inspection(client, user_store):
    token = seed_omni_user(user_store)
    resp = await client.get("/v1/users/me", headers=auth(token))
    assert resp.status_code == 200
    user = resp.json()
    assert len(user["linkedProfiles"]) == 6
    for p in ALL_PROFILES:
        assert p in user["linkedProfiles"]


@pytest.mark.asyncio
async def test_omni_user_as_farmer(client, user_store):
    token = seed_omni_user(user_store)
    await _activate_persona(client, token, "farmer")

    # 1. Gemini Crop Disease Scan
    scan_resp = await client.post(
        "/v1/advisory/disease-scan",
        files={"image": ("leaf.png", PNG_BYTES, "image/png")},
        headers=auth(token),
    )
    assert scan_resp.status_code == 200
    assert len(scan_resp.json()["results"]) >= 1

    # 2. Create Produce Lot for Mandi
    lot_resp = await client.post(
        "/v1/market/lots",
        json={
            "crop": "Wheat",
            "quantityQuintals": 60.0,
            "expectedRate": 2400,
            "harvestDate": "2026-10-01",
            "location": {"lat": 19.99, "lng": 73.78},
        },
        headers=auth(token),
    )
    assert lot_resp.status_code == 201
    assert lot_resp.json()["crop"] == "Wheat"

    # 3. Book Soil Health Test
    soil_resp = await client.post(
        "/v1/soil-tests/book",
        json={
            "address": "Survey 142/2A, Post Niphad, Nashik 422303",
            "slot": f"{(datetime.now() + timedelta(days=2)).strftime('%Y-%m-%d')} am",
        },
        headers=auth(token),
    )
    assert soil_resp.status_code == 201
    assert soil_resp.json()["status"] == "booked"


@pytest.mark.asyncio
async def test_omni_user_as_landlord(client, user_store):
    token = seed_omni_user(user_store)
    await _activate_persona(client, token, "farmLandlord")

    # 1. Post Farmland Plot for Lease
    plot_resp = await client.post(
        "/v1/land/plots",
        json={
            "name": "Irrigated 5-Acre Fertile Black Cotton Soil",
            "gatNumber": "142/2A",
            "areaAcres": 5.0,
            "soilType": "Black Cotton (काली मिट्टी)",
            "district": "Nashik",
            "village": "Niphad",
        },
        headers=auth(token),
    )
    assert plot_resp.status_code == 201
    assert plot_resp.json()["areaAcres"] == 5.0

    # 2. Search 7/12 Land Records
    rec_resp = await client.get("/v1/land-records/search?gatNumber=142", headers=auth(token))
    assert rec_resp.status_code == 200
    assert "data" in rec_resp.json()


@pytest.mark.asyncio
async def test_omni_user_as_transporter(client, user_store):
    token = seed_omni_user(user_store)
    await _activate_persona(client, token, "transporter")

    # 1. Register Commercial Transport Vehicle
    veh_resp = await client.post(
        "/v1/transport/vehicles",
        json={
            "registrationNo": "MH-15-EG-8822",
            "vehicleType": "Bolero Maxi",
            "capacityTonnes": 1.5,
        },
        headers=auth(token),
    )
    assert veh_resp.status_code == 201
    assert veh_resp.json()["registrationNo"] == "MH-15-EG-8822"

    # 2. View Transporter Settlements
    settle_resp = await client.get("/v1/transport/settlements", headers=auth(token))
    assert settle_resp.status_code == 200
    assert "data" in settle_resp.json()


@pytest.mark.asyncio
async def test_omni_user_as_seller(client, user_store):
    token = seed_omni_user(user_store)
    await _activate_persona(client, token, "seller")

    # 1. Post Daily Mandi Buying Rate
    rate_resp = await client.post(
        "/v1/seller/rates",
        json={
            "crop": "Soybean",
            "ratePerKg": 48.5,
            "mandiName": "Nashik APMC",
        },
        headers=auth(token),
    )
    assert rate_resp.status_code == 200

    # 2. View Seller Rates
    my_rates = await client.get("/v1/seller/rates/my", headers=auth(token))
    assert my_rates.status_code == 200


@pytest.mark.asyncio
async def test_omni_user_as_equipment_owner(client, user_store):
    token = seed_omni_user(user_store)
    await _activate_persona(client, token, "equipmentRental")

    # 1. Register Machinery in Fleet
    eq_resp = await client.post(
        "/v1/equipment",
        json={
            "name": "John Deere 5050 D Tractor (50 HP)",
            "type": "tractor",
            "hourlyRate": 700.0,
            "distanceKm": 1.5,
        },
        headers=auth(token),
    )
    assert eq_resp.status_code == 201

    # 2. View Equipment Settlements
    eq_settle = await client.get("/v1/equipment/settlements", headers=auth(token))
    assert eq_settle.status_code == 200


@pytest.mark.asyncio
async def test_omni_user_as_broker(client, user_store):
    token = seed_omni_user(user_store)
    await _activate_persona(client, token, "broker")

    # 1. Browse Corporate Buyer Contracts
    contracts_resp = await client.get("/v1/contracts", headers=auth(token))
    assert contracts_resp.status_code == 200
    assert "data" in contracts_resp.json()

    # 2. View Broker Commission Settlements
    broker_settle = await client.get("/v1/broker/settlements", headers=auth(token))
    assert broker_settle.status_code == 200


@pytest.mark.asyncio
async def test_omni_user_ai_chatbot_and_gamification(client, user_store):
    token = seed_omni_user(user_store)
    # Chatbot is accessible across all personas
    chat_resp = await client.post(
        "/v1/chatbot/messages",
        json={"text": "Barish aane par pyaz ki fasal mein kya karein?"},
        headers=auth(token),
    )
    assert chat_resp.status_code == 200
    assert chat_resp.json()["sender"] == "bot"

    # Gamification
    gam_resp = await client.get("/v1/gamification/status", headers=auth(token))
    assert gam_resp.status_code == 200
    gam_body = gam_resp.json()
    assert gam_body["level"]["tier"] == "gold"
    assert gam_body["level"]["title"] == "खुशहाल"
    assert gam_body["agriCoins"] == 500
    assert len(gam_body["badges"]) == 8
