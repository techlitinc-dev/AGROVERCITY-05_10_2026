"""SR 4 + SR 14 — customer produce browse filters & seasonal nutrition calendar."""
import pytest

from app.main import app
from app.routers import customer_seasonal as customer_seasonal_module
from tests.test_diary import auth, seed_user

# The router is registered in app/main.py by the integration owner; mounting it
# here too keeps this suite self-contained (duplicate registration is harmless —
# FastAPI matches the first, identical routes).
@pytest.fixture(scope="session", autouse=True)
def _register_customer_seasonal_router():
    app.include_router(customer_seasonal_module.router, prefix="/v1")


HARVEST_RECENT = "2026-10-18"
HARVEST_OLDER = "2026-10-10"

LOTS = [
    {
        "id": "lot-veg-1",
        "crop": "Tomato (Desi)",
        "grade": "Grade A",
        "quantityQuintals": 10.0,
        "expectedRate": 2400.0,
        "status": "open",
        "organic": True,
        "tags": ["organic"],
        "farmerId": "farmer-1",
        "createdAt": "2026-10-15T00:00:00+00:00",
        "harvestDate": HARVEST_RECENT,
        "latitude": 20.0,
        "longitude": 73.8,
    },
    {
        "id": "lot-veg-2",
        "crop": "Onion (Nashik Red)",
        "grade": "Grade B",
        "quantityQuintals": 40.0,
        "expectedRate": 1800.0,
        "status": "open",
        "organic": False,
        "tags": [],
        "farmerId": "farmer-2",
        "createdAt": "2026-10-12T00:00:00+00:00",
        "harvestDate": HARVEST_OLDER,
        "latitude": 20.1,
        "longitude": 73.9,
    },
    {
        "id": "lot-fruit-1",
        "crop": "Alphonso Mango",
        "grade": "Grade A",
        "quantityQuintals": 5.0,
        "expectedRate": 9500.0,
        "status": "open",
        "organic": False,
        "tags": ["Organic", "export"],
        "farmerId": "farmer-1",
        "createdAt": "2026-10-14T00:00:00+00:00",
        "harvestDate": HARVEST_RECENT,
        "latitude": 20.2,
        "longitude": 73.7,
    },
    {
        "id": "lot-grain-1",
        "crop": "Sharbati Wheat",
        "grade": "Grade A",
        "quantityQuintals": 120.0,
        "expectedRate": 3200.0,
        "status": "open",
        "organic": False,
        "tags": [],
        "farmerId": "farmer-2",
        "createdAt": "2026-10-11T00:00:00+00:00",
        "harvestDate": "2026-04-20",
    },
    {
        "id": "lot-dairy-1",
        "crop": "Full Cream Milk",
        "grade": "",
        "quantityQuintals": 2.0,
        "expectedRate": 560.0,
        "status": "open",
        "organic": True,
        "tags": ["farm-fresh"],
        "farmerId": "farmer-1",
        "createdAt": "2026-10-16T00:00:00+00:00",
        "harvestDate": HARVEST_RECENT,
    },
    {
        "id": "lot-ghee-1",
        "crop": "A2 Desi Ghee",
        "grade": "",
        "quantityQuintals": 1.0,
        "expectedRate": 48000.0,
        "status": "open",
        "organic": False,
        "tags": ["a2", "bilonA2"],
        "farmerId": "farmer-2",
        "createdAt": "2026-10-09T00:00:00+00:00",
        "harvestDate": "2026-10-01",
    },
    {
        "id": "lot-closed-1",
        "crop": "Tomato (Hybrid)",
        "grade": "Grade A",
        "quantityQuintals": 8.0,
        "expectedRate": 2000.0,
        "status": "closed",
        "organic": False,
        "tags": [],
        "farmerId": "farmer-1",
        "createdAt": "2026-10-08T00:00:00+00:00",
        "harvestDate": HARVEST_OLDER,
    },
]

FARMERS = [
    {"id": "farmer-1", "name": "Sunita Pawar", "rating": 4.6},
    {"id": "farmer-2", "name": "Ganesh Jadhav", "rating": 4.1},
]

OPEN_LOT_IDS = {l["id"] for l in LOTS if l["status"] == "open"}


@pytest.fixture
def seeded(user_store):
    for doc in LOTS:
        user_store[f"market_lots/{doc['id']}"] = doc
    for doc in FARMERS:
        user_store[f"users/{doc['id']}"] = doc
    return user_store


# ---------------------------------------------------------------- seasonal


async def test_seasonal_requires_auth(client):
    resp = await client.get("/v1/customer/seasonal")
    assert resp.status_code == 401


async def test_seasonal_seed_fallback(client, user_store):
    token = seed_user(user_store, uid="cust-seasonal-1", active_profile="customer")

    resp = await client.get("/v1/customer/seasonal", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()

    months = body["months"]
    assert len(months) == 12
    assert [m["month"] for m in months] == [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ]
    for month in months:
        assert isinstance(month["produce"], list) and len(month["produce"]) >= 5

    guides = body["guides"]
    assert 3 <= len(guides) <= 5
    titles = {g["title"] for g in guides}
    assert "Iron-Rich Foods" in titles
    assert "Protein-Rich Foods" in titles
    for guide in guides:
        assert guide["id"] and guide["items"] and guide["note"]

    recipes = body["recipes"]
    assert len(recipes) >= 1
    for recipe in recipes:
        assert recipe["id"] and recipe["title"] and recipe["produce"]
        assert recipe["steps"] and recipe["nutritionNote"]


async def test_seasonal_serves_seeded_doc(client, user_store):
    token = seed_user(user_store, uid="cust-seasonal-2", active_profile="customer")
    user_store["customer_seasonal/default"] = {
        "id": "default",
        "months": [{"month": "January", "produce": ["Test Crop"]}],
        "guides": [{"id": "g1", "title": "Custom Guide", "items": ["X"], "note": "n"}],
        "recipes": [],
    }

    resp = await client.get("/v1/customer/seasonal", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["months"][0]["produce"] == ["Test Crop"]
    assert body["guides"][0]["title"] == "Custom Guide"


# ---------------------------------------------------------------- produce


async def test_produce_requires_auth(client, seeded):
    resp = await client.get("/v1/customer/produce")
    assert resp.status_code == 401


async def test_produce_lists_open_lots_only(client, seeded):
    token = seed_user(seeded, uid="cust-1", active_profile="customer")

    resp = await client.get("/v1/customer/produce", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == len(OPEN_LOT_IDS)
    assert {item["id"] for item in body["data"]} == OPEN_LOT_IDS
    # closed lot never leaks
    assert "lot-closed-1" not in {item["id"] for item in body["data"]}


async def test_produce_category_vegetable_excludes_fruit(client, seeded):
    token = seed_user(seeded, uid="cust-2", active_profile="customer")

    resp = await client.get("/v1/customer/produce", params={"category": "vegetable"}, headers=auth(token))
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) >= 2
    crops = {item["crop"] for item in data}
    assert crops == {"Tomato (Desi)", "Onion (Nashik Red)"}
    for item in data:
        assert item["category"] == "vegetable"


async def test_produce_category_a2_ghee(client, seeded):
    token = seed_user(seeded, uid="cust-3", active_profile="customer")

    resp = await client.get("/v1/customer/produce", params={"category": "a2_ghee"}, headers=auth(token))
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert [item["crop"] for item in data] == ["A2 Desi Ghee"]


async def test_produce_organic_filter(client, seeded):
    token = seed_user(seeded, uid="cust-4", active_profile="customer")

    resp = await client.get("/v1/customer/produce", params={"organic": "true"}, headers=auth(token))
    assert resp.status_code == 200
    data = resp.json()["data"]
    # lot-veg-1 (organic flag) + lot-fruit-1 ("Organic" tag) + lot-dairy-1 (organic flag)
    assert {item["id"] for item in data} == {"lot-veg-1", "lot-fruit-1", "lot-dairy-1"}
    for item in data:
        assert item["organic"] is True


async def test_produce_sort_price_ascending(client, seeded):
    token = seed_user(seeded, uid="cust-5", active_profile="customer")

    resp = await client.get("/v1/customer/produce", params={"sort": "price"}, headers=auth(token))
    assert resp.status_code == 200
    prices = [item["pricePaisa"] for item in resp.json()["data"]]
    assert prices == sorted(prices)
    # milk (₹560) is the cheapest seeded open lot
    assert prices[0] == 56000


async def test_produce_pagination_shape(client, seeded):
    token = seed_user(seeded, uid="cust-6", active_profile="customer")

    resp = await client.get(
        "/v1/customer/produce", params={"page": 1, "pageSize": 2}, headers=auth(token)
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["page"] == 1
    assert body["pageSize"] == 2
    assert body["total"] == len(OPEN_LOT_IDS)
    assert len(body["data"]) == 2

    resp = await client.get(
        "/v1/customer/produce", params={"page": 3, "pageSize": 2}, headers=auth(token)
    )
    body = resp.json()
    assert len(body["data"]) == 2
    first_page_ids = {i["id"] for i in (await client.get(
        "/v1/customer/produce", params={"page": 1, "pageSize": 2}, headers=auth(token)
    )).json()["data"]}
    third_page_ids = {i["id"] for i in body["data"]}
    assert first_page_ids.isdisjoint(third_page_ids)


async def test_produce_crop_search(client, seeded):
    token = seed_user(seeded, uid="cust-7", active_profile="customer")

    resp = await client.get("/v1/customer/produce", params={"crop": "tomato"}, headers=auth(token))
    assert resp.status_code == 200
    data = resp.json()["data"]
    # only the open tomato lot — the closed hybrid tomato is excluded
    assert [item["id"] for item in data] == ["lot-veg-1"]


async def test_produce_item_shape_resilient_fields(client, seeded):
    token = seed_user(seeded, uid="cust-8", active_profile="customer")

    resp = await client.get("/v1/customer/produce", headers=auth(token))
    assert resp.status_code == 200
    by_id = {item["id"]: item for item in resp.json()["data"]}
    tomato = by_id["lot-veg-1"]
    assert tomato["crop"] == "Tomato (Desi)"
    assert tomato["grade"] == "Grade A"
    assert tomato["quantityQuintals"] == 10.0
    assert tomato["pricePaisa"] == 240000
    assert tomato["farmerName"] == "Sunita Pawar"
    assert tomato["farmerRating"] == 4.6
    assert tomato["organic"] is True
    assert tomato["freshnessDays"] is not None
    # grain lot has no coordinates → distance stays None, not an error
    assert by_id["lot-grain-1"]["distanceKm"] is None
