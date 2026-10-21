"""Customer hub home + AI recommendations (SR 1, SR 23)."""
from app.main import app
from app.routers import customer_hub
from app.services.billing import seed_plans
from tests.test_diary import auth, seed_user

# customer_hub is registered in main.py by the integration owner; mount it here
# as well so the endpoints are exercised under /v1 exactly as in production.
app.include_router(customer_hub.router, prefix="/v1")

NOW = "2026-10-20T00:00:00+00:00"

PRODUCTS = [
    {
        "id": "prod-veg-1",
        "title": "Organic Spinach Bundle",
        "category": "Vegetables",
        "isOrganic": True,
        "discountedPrice": 40,
        "unit": "500 g",
        "rating": 4.8,
        "salesCount": 120,
        "sellerId": "farmer-1",
        "createdAt": "2026-10-01T00:00:00+00:00",
    },
    {
        "id": "prod-veg-2",
        "title": "Organic Tomato",
        "category": "Vegetables",
        "isOrganic": True,
        "discountedPrice": 60,
        "unit": "1 kg",
        "rating": 4.5,
        "salesCount": 90,
        "sellerId": "farmer-1",
        "createdAt": "2026-10-02T00:00:00+00:00",
    },
    {
        "id": "prod-veg-3",
        "title": "Organic Carrot",
        "category": "Vegetables",
        "isOrganic": True,
        "discountedPrice": 55,
        "unit": "500 g",
        "rating": 4.2,
        "sellerId": "farmer-2",
        "createdAt": "2026-10-03T00:00:00+00:00",
    },
    {
        "id": "prod-veg-4",
        "title": "Organic Okra",
        "category": "Vegetables",
        "isOrganic": True,
        "discountedPrice": 50,
        "unit": "500 g",
        "rating": 4.0,
        "sellerId": "farmer-2",
        "createdAt": "2026-10-04T00:00:00+00:00",
    },
    {
        "id": "prod-fruit-1",
        "title": "Organic Pomegranate",
        "category": "Fruits",
        "isOrganic": True,
        "discountedPrice": 180,
        "unit": "1 kg",
        "rating": 4.6,
        "sellerId": "farmer-1",
        "createdAt": "2026-10-05T00:00:00+00:00",
    },
    {
        "id": "prod-fruit-2",
        "title": "Organic Guava",
        "category": "Fruits",
        "isOrganic": True,
        "discountedPrice": 90,
        "unit": "1 kg",
        "rating": 4.3,
        "sellerId": "farmer-1",
        "createdAt": "2026-10-06T00:00:00+00:00",
    },
    {
        "id": "prod-nonorganic",
        "title": "Hybrid Tomato (Regular)",
        "category": "Vegetables",
        "isOrganic": False,
        "discountedPrice": 35,
        "unit": "1 kg",
        "rating": 5.0,
        "salesCount": 500,
        "sellerId": "farmer-2",
        "createdAt": "2026-10-07T00:00:00+00:00",
    },
    {
        "id": "prod-seeds-1",
        "title": "Seminis Tomato Seeds",
        "category": "Seeds",
        "discountedPrice": 899,
        "unit": "10 g",
        "rating": 4.7,
        "sellerId": "seller-1",
        "createdAt": "2026-10-08T00:00:00+00:00",
    },
]

ORGANIC_IDS = {p["id"] for p in PRODUCTS if p.get("isOrganic")}


def _seed_products(user_store):
    for doc in PRODUCTS:
        user_store[f"products/{doc['id']}"] = doc


async def test_home_empty_store_is_safe(client, user_store):
    token = seed_user(user_store, active_profile="customer")
    resp = await client.get("/v1/customer/home", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["seasonalPicks"] == []
    assert body["activeOrders"] == []
    assert body["subscriptionNext"] == []
    assert body["coinBalance"] == 0
    assert body["followedOffers"] == []
    assert body["unreadNotifications"] == 0

    resp = await client.get("/v1/customer/recommendations", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["basket"] == []
    assert body["bestPrice"] == []
    assert body["seasonalAlternatives"] == []


async def test_home_sections_populated(client, user_store):
    token = seed_user(user_store, uid="uid-cust", active_profile="customer", agriCoins=120)
    _seed_products(user_store)
    user_store["orders/ord-active"] = {
        "id": "ord-active",
        "userId": "uid-cust",
        "status": "shipped",
        "total": 450,
        "createdAt": NOW,
    }
    user_store["orders/ord-delivered"] = {
        "id": "ord-delivered",
        "userId": "uid-cust",
        "status": "delivered",
        "total": 200,
        "createdAt": NOW,
    }
    user_store["customer_subscriptions/sub_1"] = {
        "id": "sub_1",
        "customerId": "uid-cust",
        "crop": "Tomato",
        "qtyKg": 5,
        "frequency": "weekly",
        "nextRunAt": "2026-10-27T00:00:00+00:00",
        "status": "active",
    }
    user_store["customer_subscriptions/sub_2"] = {
        "id": "sub_2",
        "customerId": "uid-cust",
        "crop": "Onion",
        "frequency": "daily",
        "nextRunAt": "2026-10-21T00:00:00+00:00",
        "status": "cancelled",
    }
    user_store["follows/uid-cust_farmer-1"] = {
        "followerId": "uid-cust",
        "targetId": "farmer-1",
        "createdAt": NOW,
    }
    user_store["notifications/notif-1"] = {
        "userId": "uid-cust",
        "title": "Order shipped",
        "read": False,
        "createdAt": NOW,
    }
    user_store["notifications/notif-2"] = {
        "userId": "uid-cust",
        "title": "Welcome",
        "read": True,
        "createdAt": NOW,
    }

    resp = await client.get("/v1/customer/home", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()

    # Active orders strip: only the non-terminal order, with the right shape.
    assert [o["id"] for o in body["activeOrders"]] == ["ord-active"]
    assert body["activeOrders"][0]["status"] == "shipped"
    assert body["activeOrders"][0]["total"] == 450

    # Subscription next delivery: active only, crop label + nextRunAt + frequency.
    assert [s["id"] for s in body["subscriptionNext"]] == ["sub_1"]
    assert body["subscriptionNext"][0]["label"] == "Tomato · 5 kg"
    assert body["subscriptionNext"][0]["frequency"] == "weekly"
    assert body["subscriptionNext"][0]["nextRunAt"] == "2026-10-27T00:00:00+00:00"

    # Coins straight from the user doc (gamification balance field).
    assert body["coinBalance"] == 120

    # Followed farmers' products, newest first.
    assert [o["id"] for o in body["followedOffers"]] == ["prod-fruit-2", "prod-fruit-1", "prod-veg-2", "prod-veg-1"]
    assert all(o["sellerId"] == "farmer-1" for o in body["followedOffers"])
    assert body["followedOffers"][0]["name"]

    # Seasonal picks: produce categories surface from the seeded catalogue.
    pick_ids = {p["id"] for p in body["seasonalPicks"]}
    assert "prod-veg-1" in pick_ids
    assert all(p["price"] > 0 and p["name"] for p in body["seasonalPicks"])

    # One unread of two notifications.
    assert body["unreadNotifications"] == 1


async def test_recommendations_respect_dietary_and_family_size(client, user_store):
    token = seed_user(
        user_store,
        uid="uid-cust",
        active_profile="customer",
        dietaryPreference="organic",
        familySize=5,
    )
    _seed_products(user_store)
    # Repurchase history: Vegetables dominate, Fruits once.
    user_store["orders/ord-1"] = {
        "id": "ord-1",
        "userId": "uid-cust",
        "status": "delivered",
        "items": [{"productId": "prod-veg-1", "quantity": 3}],
        "total": 120,
        "createdAt": NOW,
    }
    user_store["orders/ord-2"] = {
        "id": "ord-2",
        "userId": "uid-cust",
        "status": "delivered",
        "items": [{"productId": "prod-veg-2", "quantity": 2}],
        "total": 120,
        "createdAt": NOW,
    }
    user_store["orders/ord-3"] = {
        "id": "ord-3",
        "userId": "uid-cust",
        "status": "delivered",
        "items": [{"productId": "prod-fruit-1", "quantity": 1}],
        "total": 180,
        "createdAt": NOW,
    }

    resp = await client.get("/v1/customer/recommendations", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    basket = body["basket"]

    assert 0 < len(basket) <= 6
    assert all(item["id"] in ORGANIC_IDS for item in basket), "organic preference must filter the basket"
    assert "prod-nonorganic" not in {item["id"] for item in basket}

    # Repurchased-category picks carry the family-size reason.
    reasons = [item.get("reason", "") for item in basket]
    assert any("family of 5" in r for r in reasons)

    # Best price board: one cheapest entry per distinct category.
    best = body["bestPrice"]
    categories = [item["category"] for item in best]
    assert len(categories) == len(set(categories))
    by_id = {p["id"]: p for p in PRODUCTS}
    for item in best:
        if item["id"] in by_id:
            assert item["price"] <= min(
                p["discountedPrice"] for p in PRODUCTS if p["category"] == by_id[item["id"]]["category"]
            )


async def test_recommendations_cold_start_fallback(client, user_store):
    token = seed_user(user_store, active_profile="customer")
    _seed_products(user_store)
    resp = await client.get("/v1/customer/recommendations", headers=auth(token))
    assert resp.status_code == 200
    basket = resp.json()["basket"]
    assert len(basket) == 6  # top-rated fallback fills the basket
    assert basket[0]["reason"] == "Top rated on the mall"


async def test_billing_plans_list_emarket_customer_premiums(client, user_store):
    await seed_plans()
    resp = await client.get("/v1/billing/plans", params={"persona": "emarketCustomer"})
    assert resp.status_code == 200
    plans = {p["planId"]: p for p in resp.json()["data"]}

    assert "emarketCustomer_free" in plans
    intro = plans["emarketCustomer_first_month_intro"]
    assert intro["priceMonthlyPaisa"] == 900
    assert intro["promo"] is True
    monthly = plans["emarketCustomer_premium_monthly"]
    assert monthly["priceMonthlyPaisa"] == 9900
    assert monthly["interval"] == "month"
    assert {"free_delivery_above", "priority_slots", "member_prices"} <= set(monthly["features"])
    yearly = plans["emarketCustomer_premium_yearly"]
    assert yearly["priceMonthlyPaisa"] == 99900
    assert yearly["interval"] == "year"
    assert yearly["priceRupeesPerYear"] == 99900
