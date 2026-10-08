from tests.test_diary import auth, seed_user

MANDI = {
    "mandi_prices/m1": {
        "id": "m1", "commodity": "Tomato (टमाटर)", "modalPrice": 1950, "mandiName": "Pimpalgaon Baswant APMC",
    },
    "mandi_prices/m2": {
        "id": "m2", "commodity": "Tomato (टमाटर)", "modalPrice": 2150, "mandiName": "Nashik APMC",
    },
}


def _notifications_for(user_store, uid):
    return [
        doc
        for key, doc in user_store.items()
        if key.startswith("notifications/") and doc.get("userId") == uid
    ]


async def test_create_rejects_crop_without_mandi_data(client, user_store):
    for key, doc in MANDI.items():
        user_store[key] = doc
    token = seed_user(user_store, uid="uid-1", active_profile="farmer")
    resp = await client.post(
        "/v1/price-alerts",
        json={"crop": "Dragonfruit", "targetPrice": 100, "above": True},
        headers=auth(token),
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["fieldErrors"] == {"crop": "no mandi data for this crop"}
    # case-insensitive contains: "tomato" matches "Tomato (टमाटर)"
    resp = await client.post(
        "/v1/price-alerts",
        json={"crop": "tomato", "targetPrice": 1500},
        headers=auth(token),
    )
    assert resp.status_code == 201


async def test_create_returns_current_modal(client, user_store):
    for key, doc in MANDI.items():
        user_store[key] = doc
    token = seed_user(user_store, uid="uid-1", active_profile="farmer")
    resp = await client.post(
        "/v1/price-alerts",
        json={"crop": "Tomato", "targetPrice": 1500, "above": True},
        headers=auth(token),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["crop"] == "Tomato"
    assert body["targetPrice"] == 1500
    assert body["above"] is True
    assert body["currentModal"] == 2050  # avg of 1950 and 2150
    assert body["fired"] is False
    assert body["createdAt"]


async def test_list_fires_notification_when_crossed(client, user_store):
    for key, doc in MANDI.items():
        user_store[key] = doc
    token = seed_user(user_store, uid="uid-1", active_profile="farmer", phone="+919876543210")
    await client.post(
        "/v1/price-alerts",
        json={"crop": "Tomato", "targetPrice": 1500, "above": True},
        headers=auth(token),
    )
    resp = await client.get("/v1/price-alerts", headers=auth(token))
    assert resp.status_code == 200
    item = resp.json()["data"][0]
    assert item["fired"] is True
    assert item["currentModal"] == 2050

    notes = _notifications_for(user_store, "uid-1")
    assert len(notes) == 1
    note = notes[0]
    assert note["type"] == "price_alert"
    assert note["title"] == "Price alert / भाव अलर्ट"
    assert "Tomato" in note["body"]
    assert "2050" in note["body"]
    assert "1500" in note["body"]
    assert "≥" in note["body"]
    assert "9876543210" not in note["body"]  # never leak phone numbers
    assert note["data"]["deepLink"] == "/dashboard/p/mandi"

    # second list: already fired, no duplicate notification
    resp = await client.get("/v1/price-alerts", headers=auth(token))
    assert resp.json()["data"][0]["fired"] is True
    assert len(_notifications_for(user_store, "uid-1")) == 1


async def test_below_direction(client, user_store):
    for key, doc in MANDI.items():
        user_store[key] = doc
    token = seed_user(user_store, uid="uid-1", active_profile="farmer")
    await client.post(
        "/v1/price-alerts",
        json={"crop": "Tomato", "targetPrice": 2500, "above": False},
        headers=auth(token),
    )
    await client.post(
        "/v1/price-alerts",
        json={"crop": "Tomato", "targetPrice": 1500, "above": False},
        headers=auth(token),
    )
    resp = await client.get("/v1/price-alerts", headers=auth(token))
    data = {d["targetPrice"]: d for d in resp.json()["data"]}
    assert data[2500]["fired"] is True  # modal 2050 ≤ 2500
    assert data[1500]["fired"] is False  # modal 2050 > 1500
    notes = _notifications_for(user_store, "uid-1")
    assert len(notes) == 1
    assert "≤" in notes[0]["body"]


async def test_delete_own_only(client, user_store):
    for key, doc in MANDI.items():
        user_store[key] = doc
    token = seed_user(user_store, uid="uid-1", active_profile="farmer")
    other = seed_user(user_store, uid="uid-2", active_profile="farmer")
    alert_id = (
        await client.post(
            "/v1/price-alerts",
            json={"crop": "Tomato", "targetPrice": 1500},
            headers=auth(token),
        )
    ).json()["id"]

    resp = await client.delete(f"/v1/price-alerts/{alert_id}", headers=auth(other))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "ALERT_NOT_FOUND"

    resp = await client.delete(f"/v1/price-alerts/{alert_id}", headers=auth(token))
    assert resp.status_code == 204

    resp = await client.delete(f"/v1/price-alerts/{alert_id}", headers=auth(token))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "ALERT_NOT_FOUND"
