from tests.test_diary import auth, seed_user

BODY = {"address": "Plot A, Ozarkhed, Nashik 422003", "slot": "2026-09-20 am"}


def _seed_plot(user_store, uid="uid-1", plot_id="plot-1"):
    user_store[f"users/{uid}/land_plots/{plot_id}"] = {
        "id": plot_id,
        "name": "Plot A",
        "village": "Ozarkhed",
        "district": "Nashik",
        "areaAcres": 2.0,
        "status": "vacant",
    }


async def test_book_201(client, user_store):
    token = seed_user(user_store)
    resp = await client.post("/v1/soil-tests/book", json=BODY, headers=auth(token))
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "booked"
    assert body["resultPdfUrl"] is None
    assert body["bookedAt"]


async def test_double_book_same_plot_409(client, user_store):
    token = seed_user(user_store)
    _seed_plot(user_store)
    payload = {**BODY, "plotId": "plot-1"}
    resp = await client.post("/v1/soil-tests/book", json=payload, headers=auth(token))
    assert resp.status_code == 201
    resp = await client.post("/v1/soil-tests/book", json=payload, headers=auth(token))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "SOIL_TEST_ALREADY_BOOKED"


async def test_book_without_plot_ok(client, user_store):
    token = seed_user(user_store)
    resp = await client.post("/v1/soil-tests/book", json=BODY, headers=auth(token))
    assert resp.status_code == 201
    assert resp.json()["plotId"] is None
    resp = await client.post("/v1/soil-tests/book", json=BODY, headers=auth(token))
    assert resp.status_code == 201


async def test_foreign_plot_404(client, user_store):
    token = seed_user(user_store)
    _seed_plot(user_store, uid="uid-other")
    resp = await client.post(
        "/v1/soil-tests/book", json={**BODY, "plotId": "plot-1"}, headers=auth(token)
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "PLOT_NOT_FOUND"


async def test_list_sorted_desc(client, user_store):
    token = seed_user(user_store)
    await client.post("/v1/soil-tests/book", json=BODY, headers=auth(token))
    await client.post(
        "/v1/soil-tests/book",
        json={**BODY, "address": "Plot B, Dindori, Nashik 422202"},
        headers=auth(token),
    )
    resp = await client.get("/v1/soil-tests", headers=auth(token))
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 2
    assert data[0]["bookedAt"] >= data[1]["bookedAt"]
    assert data[0]["address"].startswith("Plot B")
