import pytest

from tests.test_users import _auth, _register

PRODUCTS = [
    {
        "id": "prod-1",
        "title": "IFFCO Nano DAP (500 ml Bottle)",
        "vernacularTitle": "इफको नैनो डीएपी (500 मिली)",
        "category": "Fertilizer (खाद)",
        "brand": "IFFCO Official",
        "rating": 4.8,
        "reviewsCount": 324,
        "dealerName": "Kisan Suvidha Kendra - Pimpalgaon",
        "distanceKm": 2.1,
        "mrp": 600,
        "discountedPrice": 570,
        "bnplAvailable": True,
        "batchNo": "IFFCO-DAP-2026-993",
    },
    {
        "id": "prod-2",
        "title": "Bayer Nativo Fungicide (100 gm)",
        "vernacularTitle": "बायेर नेटिवो कवकनाशी (100 ग्राम)",
        "category": "Pesticide (फफूंदनाशक)",
        "brand": "Bayer CropScience",
        "rating": 4.9,
        "reviewsCount": 512,
        "dealerName": "Maharashtra Krishi Seva Kendra",
        "distanceKm": 3.8,
        "mrp": 850,
        "discountedPrice": 790,
        "bnplAvailable": True,
        "batchNo": "BAY-NAT-44821-QR",
    },
    {
        "id": "prod-3",
        "title": "Seminis Tomato Seeds - Abhinav (10g)",
        "vernacularTitle": "सेमिनिस अभिनव टमाटर बीज (10 ग्राम)",
        "category": "Seeds (प्रमाणित बीज)",
        "brand": "Seminis / Bayer",
        "rating": 4.7,
        "reviewsCount": 890,
        "dealerName": "Gramin Krishi Vikas Bhandar",
        "distanceKm": 5.0,
        "mrp": 980,
        "discountedPrice": 899,
        "bnplAvailable": True,
        "batchNo": "SEM-ABH-88301-GEN",
    },
    {
        "id": "prod-5",
        "title": "IFFCO Urea (45 kg Bag)",
        "vernacularTitle": "इफको यूरिया (45 किग्रा बोरी)",
        "category": "Fertilizer (खाद)",
        "brand": "IFFCO Official",
        "rating": 4.6,
        "reviewsCount": 1024,
        "dealerName": "Kisan Suvidha Kendra - Pimpalgaon",
        "distanceKm": 2.1,
        "mrp": 320,
        "discountedPrice": 290,
        "bnplAvailable": False,
        "batchNo": "IFFCO-UREA-2026-111",
    },
]


@pytest.fixture
def seeded(user_store):
    for doc in PRODUCTS:
        user_store[f"products/{doc['id']}"] = doc
        user_store[f"certificates/{doc['batchNo']}"] = {
            "batchNo": doc["batchNo"],
            "certifier": "AGMARK / Ministry of Agriculture",
            "certificateNo": "AGM-2026-0001",
            "valid": True,
            "verifiedAt": "2026-09-16T00:00:00+00:00",
        }
    return user_store


async def _token(client):
    resp = await _register(client)
    return resp.json()["accessToken"]


async def test_products_list_and_category_filter(client, seeded):
    token = await _token(client)
    resp = await client.get("/v1/products", params={"category": "seeds"}, headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["id"] == "prod-3"


async def test_products_query_search(client, seeded):
    token = await _token(client)
    resp = await client.get("/v1/products", params={"query": "urea"}, headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert "Urea" in data[0]["title"]


async def test_product_404(client, seeded):
    token = await _token(client)
    resp = await client.get("/v1/products/nope", headers=_auth(token))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "PRODUCT_NOT_FOUND"


async def test_certificate_by_batch(client, seeded):
    token = await _token(client)
    resp = await client.get("/v1/products/prod-3/certificate", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["valid"] is True
    assert body["certifier"] == "AGMARK / Ministry of Agriculture"


async def test_cart_add_update_delete(client, seeded):
    token = await _token(client)
    headers = _auth(token)
    resp = await client.post("/v1/cart/items", json={"productId": "prod-1", "quantity": 2}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["cartTotal"] == 2 * 570
    resp = await client.put("/v1/cart/items/prod-1", json={"quantity": 1}, headers=headers)
    assert resp.json()["cartTotal"] == 570
    resp = await client.delete("/v1/cart/items/prod-1", headers=headers)
    assert resp.json()["data"] == []
    assert resp.json()["cartTotal"] == 0


async def test_cart_add_unknown_product_404(client, seeded):
    token = await _token(client)
    resp = await client.post("/v1/cart/items", json={"productId": "nope", "quantity": 1}, headers=_auth(token))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "PRODUCT_NOT_FOUND"
