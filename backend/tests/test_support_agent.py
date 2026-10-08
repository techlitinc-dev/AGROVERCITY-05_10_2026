"""WS-05 support / FAQ / M30 AI-support-agent tests."""
from app.services import search_index
from app.services.ai import gateway
from tests.test_admin import ADMIN_MUTATION_HEADERS
from tests.test_diary import auth, seed_user

VECTORS = {
    "q": [1.0, 0.0, 0.0],
    "alpha": [1.0, 0.0, 0.0],
    "beta": [0.9, 0.1, 0.0],
    "gamma": [0.0, 1.0, 0.0],
}

SHIM_COPY = "[shim] deterministic response — live AI provider not enabled"


async def _fake_embed(texts):
    return [VECTORS.get(text, [0.0, 0.0, 1.0]) for text in texts]


async def _plot_embed(texts):
    return [[1.0, 0.0, 0.0] if "plot" in text.lower() else [0.0, 1.0, 0.0] for text in texts]


async def test_search_similar_cosine_order(client, user_store, monkeypatch):
    monkeypatch.setattr(gateway, "embed", _fake_embed)
    for doc_id in ("alpha", "beta", "gamma"):
        await search_index.upsert_document("faq", doc_id, doc_id)

    hits = await search_index.search_similar("faq", "q", limit=3)
    assert [h["docId"] for h in hits] == ["alpha", "beta", "gamma"]
    assert hits[0]["score"] > hits[1]["score"] > hits[2]["score"]

    limited = await search_index.search_similar("faq", "q", limit=2)
    assert [h["docId"] for h in limited] == ["alpha", "beta"]


async def test_faq_crud(client, user_store):
    article = {
        "category": "app_help", "lang": "en", "title": "How to add a plot",
        "body": "Open the Land section and tap Add plot.", "status": "published",
    }
    resp = await client.post("/v1/faq", json=article, headers=ADMIN_MUTATION_HEADERS)
    assert resp.status_code == 201
    article_id = resp.json()["id"]

    resp = await client.get("/v1/faq?lang=en")
    assert resp.status_code == 200
    assert any(a["id"] == article_id for a in resp.json()["data"])

    # non-admin cannot create
    token = seed_user(user_store)
    resp = await client.post("/v1/faq", json=article, headers=auth(token))
    assert resp.status_code == 403

    # a draft never appears in the public list
    resp = await client.post(
        "/v1/faq", json={**article, "status": "draft", "title": "Draft article"},
        headers=ADMIN_MUTATION_HEADERS,
    )
    draft_id = resp.json()["id"]
    resp = await client.get("/v1/faq?lang=en")
    assert all(a["id"] != draft_id for a in resp.json()["data"])


async def test_expert_ticket_list_and_thread(client, user_store):
    for ticket_id, uid in (("tkt-1", "uid-1"), ("tkt-2", "uid-1"), ("tkt-3", "uid-2")):
        ticket = {
            "id": ticket_id, "userId": uid, "query": "crop issue", "status": "queued",
            "createdAt": f"2026-10-0{ticket_id[-1]}T00:00:00+00:00",
        }
        user_store[f"users/{uid}/expert_tickets/{ticket_id}"] = ticket
        user_store[f"expert_tickets/{ticket_id}"] = ticket

    token = seed_user(user_store, uid="uid-1")
    resp = await client.get("/v1/chatbot/expert-tickets", headers=auth(token))
    assert resp.status_code == 200
    ids = [t["id"] for t in resp.json()["data"]]
    assert set(ids) == {"tkt-1", "tkt-2"}

    # owner posts + reads a message
    resp = await client.post(
        "/v1/chatbot/expert-tickets/tkt-1/messages", json={"text": "any update?"}, headers=auth(token)
    )
    assert resp.status_code == 201
    resp = await client.get("/v1/chatbot/expert-tickets/tkt-1/messages", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["data"][0]["text"] == "any update?"

    # non-owner is forbidden
    other = seed_user(user_store, uid="uid-9")
    resp = await client.get("/v1/chatbot/expert-tickets/tkt-1/messages", headers=auth(other))
    assert resp.status_code == 403


async def test_support_intent_routing_table(client, user_store):
    cases = {
        "how do I add a plot?": "app_help",
        "where is my payment?": "money",
        "mera paisa kahan hai": "money",
        "change my bank account": "money",
        "login problem": "account",
        "tell me about the weather": "other",
    }
    for question, category in cases.items():
        decision = await gateway.decide({"question": question}, "support.intent.v1")
        assert decision.answers["category"] == category, question


async def test_money_escalation_invariant(client, user_store):
    token = seed_user(user_store)
    for question in ("where is my payment?", "mera paisa kahan hai", "change my bank account"):
        resp = await client.post("/v1/support/ask", json={"question": question, "lang": "en"}, headers=auth(token))
        assert resp.status_code == 200
        assert resp.json()["kind"] == "ticket", question
        assert any(k.startswith(f"users/uid-1/expert_tickets/") for k in user_store)


async def test_citation_required_and_shim_golden(client, user_store, monkeypatch):
    monkeypatch.setattr(gateway, "embed", _plot_embed)
    user_store["faq_articles/faq-1"] = {
        "id": "faq-1", "category": "app_help", "lang": "en", "status": "published",
        "title": "How to add a plot",
        "body": "To add a plot, open the Land section and tap Add plot.",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    await search_index.upsert_document("faq", "faq-1", "To add a plot open the Land section")

    token = seed_user(user_store)
    resp = await client.post(
        "/v1/support/ask", json={"question": "how do I add a plot?", "lang": "en"}, headers=auth(token)
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["kind"] == "answer"
    assert body["answer"] == SHIM_COPY  # shim canned answer
    assert body["sources"] == ["faq-1"]
    for source in body["sources"]:
        assert f"faq_articles/{source}" in user_store



async def test_support_outcome_events(client, user_store, monkeypatch):
    monkeypatch.setattr(gateway, "embed", _plot_embed)
    user_store["faq_articles/faq-1"] = {
        "id": "faq-1", "category": "app_help", "lang": "en", "status": "published",
        "title": "How to add a plot",
        "body": "To add a plot, open the Land section and tap Add plot.",
        "createdAt": "2026-10-01T00:00:00+00:00",
    }
    await search_index.upsert_document("faq", "faq-1", "To add a plot open the Land section")

    token = seed_user(user_store)
    await client.post(
        "/v1/support/ask", json={"question": "how do I add a plot?", "lang": "en"}, headers=auth(token)
    )
    resolved = [
        v for k, v in user_store.items()
        if k.startswith("analytics_events/") and v.get("name") == "support_resolved"
    ]
    assert len(resolved) == 1 and resolved[0]["props"]["sources_count"] >= 1

    await client.post(
        "/v1/support/ask", json={"question": "where is my payment?", "lang": "en"}, headers=auth(token)
    )
    escalated = [
        v for k, v in user_store.items()
        if k.startswith("analytics_events/") and v.get("name") == "support_escalated"
    ]
    assert len(escalated) == 1
    assert escalated[0]["props"]["category"] == "money"
