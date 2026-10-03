from tests.test_diary import auth, seed_user


async def test_chatbot_send_message_saturation_keyword(client, user_store):
    token = seed_user(user_store, uid="uid-cb-1", name="Ramesh Pawar")
    resp = await client.post(
        "/v1/chatbot/messages",
        json={"text": "Kya main is saal tamatar ki boyi karu?"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["sender"] == "bot"
    assert "मार्केट सैचुरेशन" in data["text"] or "tamatar" in data["text"].lower() or "टमाटर" in data["text"]
    assert data["richCardType"] == "saturation"
    assert data["richCardData"]["crop"] == "Tomato (टमाटर)"
    assert len(data["quickReplies"]) > 0


async def test_chatbot_send_message_weather_keyword(client, user_store):
    token = seed_user(user_store, uid="uid-cb-2", name="Kiran Patil")
    resp = await client.post(
        "/v1/chatbot/messages",
        json={"text": "Aaj ka mausam kaisa rahega?"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "मौसम" in data["text"] or "weather" in data["text"].lower() or "बारिश" in data["text"]
    assert len(data["quickReplies"]) > 0


async def test_chatbot_history_retrieval(client, user_store):
    token = seed_user(user_store, uid="uid-cb-3")
    # Send message
    await client.post(
        "/v1/chatbot/messages",
        json={"text": "Urea ki matra kitni daalein?", "sessionId": "sess-test-101"},
        headers=auth(token),
    )
    # Fetch history
    resp = await client.get("/v1/chatbot/history?sessionId=sess-test-101", headers=auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    assert data["sessionId"] == "sess-test-101"
    assert "Urea" in data["data"][0]["userQuery"]


async def test_chatbot_expert_handoff_creation(client, user_store):
    token = seed_user(user_store, uid="uid-cb-4")
    resp = await client.post(
        "/v1/chatbot/expert-handoff",
        json={
            "query": "Pattiyon par ajeeb safed kide dikh rahe hain, kripya doctor ki madad dein",
            "category": "crop_health",
            "urgency": "high",
            "crop": "Pomegranate",
        },
        headers=auth(token),
    )
    assert resp.status_code == 201
    ticket = resp.json()
    assert ticket["status"] == "queued"
    assert ticket["urgency"] == "high"
    assert "KVK" in ticket["assignedDesk"]
    assert ticket["estimatedWaitMinutes"] == 15


async def test_chatbot_list_available_experts(client, user_store):
    token = seed_user(user_store, uid="uid-cb-5")
    resp = await client.get("/v1/chatbot/experts", headers=auth(token))
    assert resp.status_code == 200
    experts = resp.json()["data"]
    assert len(experts) >= 3
    assert any(e["specialization"].startswith("Cotton") for e in experts)
