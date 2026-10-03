from datetime import date, datetime, timedelta, timezone
import json
import os

from app.services import task_ranking
from app.services.ai import config_store, gateway
from app.services.tasks import COLLECTION, DEEP_LINKS, emit_task
from tests.test_diary import auth, seed_user

RANK_FIXTURE = os.path.join(
    os.path.dirname(__file__), "fixtures", "ai", "golden", "tasks.rank.v1.jsonl"
)


def _task_docs(user_store):
    return [doc for key, doc in user_store.items() if key.startswith(f"{COLLECTION}/")]


async def _emit(uid="uid-1", **overrides):
    payload = {
        "user_id": uid,
        "persona": "farmer",
        "module": "trade",
        "kind": "new_offers",
        "title_en": "3 new offers on your onion lot",
        "title_hi": "आपके प्याज लॉट पर 3 नए ऑफर",
        "subtitle": "Lot #lot-1 · highest ₹1,850/quintal",
        "priority": "today",
        "deep_link": DEEP_LINKS["trade"],
        "source_id": "lot-1",
    }
    payload.update(overrides)
    return await emit_task(**payload)


# ---------------- emit + dedupe (task 1.14) ----------------


async def test_emit_task_creates_doc(client, user_store):
    task_id = await _emit()
    docs = _task_docs(user_store)
    assert len(docs) == 1
    doc = docs[0]
    assert doc["taskId"] == task_id
    assert doc["userId"] == "uid-1"
    assert doc["persona"] == "farmer"
    assert doc["module"] == "trade"
    assert doc["kind"] == "new_offers"
    assert doc["title"]["en"] == "3 new offers on your onion lot"
    assert doc["title"]["hi"] == "आपके प्याज लॉट पर 3 नए ऑफर"
    assert doc["subtitle"]
    assert doc["priority"] == "today"
    assert doc["deepLink"] == "/dashboard/p/myOffers"
    assert doc["dueAt"] is None
    assert doc["status"] == "open"
    assert doc["sourceId"] == "lot-1"
    assert doc["dedupeKey"] == "uid-1:trade:new_offers:lot-1"
    assert doc["decisionId"] is None
    assert doc["coinsAwarded"] == 0
    assert doc["createdAt"]
    assert doc["updatedAt"]


async def test_emit_task_dedupes_on_source(client, user_store):
    first = await _emit(subtitle="first")
    second = await _emit(subtitle="updated subtitle", priority="urgent")
    docs = _task_docs(user_store)
    assert len(docs) == 1
    assert first == second
    doc = docs[0]
    assert doc["subtitle"] == "updated subtitle"
    assert doc["priority"] == "urgent"
    assert doc["status"] == "open"


async def test_emit_never_resurrects_done(client, user_store):
    task_id = await _emit()
    user_store[f"{COLLECTION}/{task_id}"]["status"] = "done"
    await _emit(subtitle="re-fired")
    doc = user_store[f"{COLLECTION}/{task_id}"]
    assert doc["status"] == "done"
    assert doc["subtitle"] == "re-fired"


# ---------------- today + summary (task 1.15) ----------------


async def test_today_returns_urgent_and_due_open_tasks(client, user_store):
    today = date.today().isoformat()
    future = (date.today() + timedelta(days=10)).isoformat()
    await _emit(kind="urgent_one", source_id="s1", priority="urgent", due_at=f"{today}T06:00:00+00:00")
    await _emit(kind="today_one", source_id="s2", priority="today", due_at=f"{today}T18:00:00+00:00")
    await _emit(kind="due_today", source_id="s3", priority="upcoming", due_at=f"{today}T10:00:00+00:00")
    await _emit(kind="future", source_id="s4", priority="upcoming", due_at=f"{future}T10:00:00+00:00")
    done = await _emit(kind="done_one", source_id="s5", priority="urgent")
    user_store[f"{COLLECTION}/{done}"]["status"] = "done"
    dismissed = await _emit(kind="dismissed_one", source_id="s6", priority="urgent")
    user_store[f"{COLLECTION}/{dismissed}"]["status"] = "dismissed"

    token = seed_user(user_store)
    resp = await client.get("/v1/tasks/today", headers=auth(token))
    assert resp.status_code == 200
    kinds = [task["kind"] for task in resp.json()["items"]]
    assert kinds == ["urgent_one", "due_today", "today_one"]


async def test_summary_counts_and_top_urgent(client, user_store):
    for i in range(4):
        await _emit(
            persona="farmer",
            module="trade",
            kind=f"urgent_{i}",
            source_id=f"u{i}",
            priority="urgent",
            due_at=f"2026-10-0{i + 1}T06:00:00+00:00",
        )
    await _emit(persona="farmer", module="land", kind="rent_due", source_id="r1", priority="today")
    await _emit(persona="transport", module="transport", kind="booking_request", source_id="b1", priority="urgent")

    token = seed_user(user_store)
    resp = await client.get("/v1/tasks/summary?persona=all", headers=auth(token))
    assert resp.status_code == 200
    personas = resp.json()["personas"]
    assert personas["farmer"]["moduleCounts"] == {"trade": 4, "land": 1}
    assert personas["transport"]["moduleCounts"] == {"transport": 1}
    assert len(personas["farmer"]["topUrgent"]) == 3
    assert len(personas["transport"]["topUrgent"]) == 1

    single = await client.get("/v1/tasks/summary?persona=transport", headers=auth(token))
    assert set(single.json()["personas"].keys()) == {"transport"}


# ---------------- done / dismiss (task 1.16) ----------------


async def test_done_transition(client, user_store):
    task_id = await _emit()
    token = seed_user(user_store)
    resp = await client.post(
        f"/v1/tasks/{task_id}/done",
        json={"decisionId": "dec_abc"},
        headers={**auth(token), "Idempotency-Key": "key-done-1"},
    )
    assert resp.status_code == 200
    assert resp.json()["task"]["status"] == "done"
    assert user_store[f"{COLLECTION}/{task_id}"]["status"] == "done"
    assert user_store[f"{COLLECTION}/{task_id}"]["decisionId"] == "dec_abc"


async def test_dismiss_transition(client, user_store):
    task_id = await _emit()
    token = seed_user(user_store)
    resp = await client.post(
        f"/v1/tasks/{task_id}/dismiss",
        headers={**auth(token), "Idempotency-Key": "key-dismiss-1"},
    )
    assert resp.status_code == 200
    assert resp.json()["task"]["status"] == "dismissed"
    assert user_store[f"{COLLECTION}/{task_id}"]["status"] == "dismissed"


async def test_done_idempotent_replay(client, user_store):
    task_id = await _emit()
    token = seed_user(user_store)
    headers = {**auth(token), "Idempotency-Key": "key-replay-1"}
    first = await client.post(f"/v1/tasks/{task_id}/done", headers=headers)
    updated_at = user_store[f"{COLLECTION}/{task_id}"]["updatedAt"]
    second = await client.post(f"/v1/tasks/{task_id}/done", headers=headers)
    assert first.json() == second.json()
    assert user_store[f"{COLLECTION}/{task_id}"]["updatedAt"] == updated_at


async def test_done_cross_user_404(client, user_store):
    task_id = await _emit(uid="uid-other")
    token = seed_user(user_store, uid="uid-1")
    resp = await client.post(
        f"/v1/tasks/{task_id}/done",
        headers={**auth(token), "Idempotency-Key": "key-404"},
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "TASK_NOT_FOUND"


async def test_done_then_dismiss_409(client, user_store):
    task_id = await _emit()
    token = seed_user(user_store)
    await client.post(
        f"/v1/tasks/{task_id}/done",
        headers={**auth(token), "Idempotency-Key": "key-a"},
    )
    resp = await client.post(
        f"/v1/tasks/{task_id}/dismiss",
        headers={**auth(token), "Idempotency-Key": "key-b"},
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "TASK_ALREADY_DONE"


async def test_done_requires_idempotency_key(client, user_store):
    task_id = await _emit()
    token = seed_user(user_store)
    resp = await client.post(f"/v1/tasks/{task_id}/done", headers=auth(token))
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "IDEMPOTENCY_KEY_REQUIRED"


# ---------------- pagination + envelope (task 1.17) ----------------


async def test_list_cursor_round_trip(client, user_store):
    base = datetime.now(timezone.utc)
    for i in range(5):
        task_id = await _emit(kind=f"page_{i}", source_id=f"p{i}")
        user_store[f"{COLLECTION}/{task_id}"]["createdAt"] = (base - timedelta(minutes=i)).isoformat()
    token = seed_user(user_store)

    seen: list[str] = []
    cursor = None
    for _ in range(5):
        params = {"status": "open", "pageSize": 2}
        if cursor:
            params["cursor"] = cursor
        resp = await client.get("/v1/tasks", params=params, headers=auth(token))
        assert resp.status_code == 200
        body = resp.json()
        seen.extend(task["taskId"] for task in body["items"])
        cursor = body.get("nextCursor")
        if not cursor:
            break
    assert len(seen) == 5
    assert len(set(seen)) == 5


async def test_error_envelope_shape(client, user_store):
    token = seed_user(user_store)
    resp = await client.get("/v1/tasks?status=bogus", headers=auth(token))
    assert resp.status_code == 400
    body = resp.json()
    assert set(body.keys()) == {"error"}
    assert set(body["error"].keys()) == {"code", "message", "fieldErrors"}
    assert body["error"]["code"] == "INVALID_STATUS"


async def test_invalid_cursor_envelope(client, user_store):
    token = seed_user(user_store)
    resp = await client.get("/v1/tasks?cursor=not-a-cursor", headers=auth(token))
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "INVALID_CURSOR"


# ---------------- ranking (task 3.9 / 3.10) ----------------


async def test_rank_v1_shim_is_deterministic(client, user_store):
    today = date.today().isoformat()
    await _emit(kind="a", source_id="s1", priority="urgent", due_at=f"{today}T06:00:00+00:00")
    await _emit(kind="b", source_id="s2", priority="today")
    token = seed_user(user_store)
    first = await client.get("/v1/tasks/today", headers=auth(token))
    second = await client.get("/v1/tasks/today", headers=auth(token))
    ids1 = [(item["taskId"], bool(item.get("headline_task"))) for item in first.json()["items"]]
    ids2 = [(item["taskId"], bool(item.get("headline_task"))) for item in second.json()["items"]]
    assert ids1 == ids2
    assert any(item.get("headline_task") for item in first.json()["items"])


async def test_rank_v1_golden_fixture(client, user_store):
    with open(RANK_FIXTURE, encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            case = json.loads(line)
            result = await gateway.decide(case["input"], "tasks.rank.v1", module="tasks")
            assert result.answers["ranking"] == case["output"]["ranking"]
            assert result.answers["headline_task"] == case["output"]["headline_task"]
            assert result.confidence == case["output"]["confidence"]


async def test_rank_chunking_merges_twelve_tasks(client, user_store):
    tasks = [
        {
            "taskId": f"t{i:02d}",
            "userId": "uid-1",
            "persona": "farmer",
            "module": "trade",
            "kind": "k",
            "title": {"en": "x", "hi": "x"},
            "subtitle": "",
            "priority": "today",
            "deepLink": DEEP_LINKS["trade"],
            "dueAt": f"2026-10-{i + 1:02d}T06:00:00+00:00",
            "status": "open",
            "sourceId": f"s{i}",
            "coinsAwarded": 0,
            "createdAt": "2026-10-01T00:00:00+00:00",
            "updatedAt": "2026-10-01T00:00:00+00:00",
        }
        for i in range(12)
    ]
    ranked, headline = await task_ranking.rank_tasks("uid-1", "farmer", tasks)
    assert [task["taskId"] for task in ranked] == [f"t{i:02d}" for i in range(12)]
    assert headline == "t00"


async def test_rank_fallback_on_gateway_error(client, user_store, monkeypatch):
    today = date.today().isoformat()
    await _emit(kind="late", source_id="s1", priority="upcoming", due_at=f"{today}T20:00:00+00:00")
    await _emit(kind="early", source_id="s2", priority="upcoming", due_at=f"{today}T08:00:00+00:00")

    async def boom(*args, **kwargs):
        raise RuntimeError("gateway down")

    monkeypatch.setattr("app.services.ai.gateway.decide", boom)
    token = seed_user(user_store)
    resp = await client.get("/v1/tasks/today", headers=auth(token))
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert [item["kind"] for item in items] == ["early", "late"]
    assert not any(item.get("headline_task") for item in items)


async def test_rank_flag_off_due_date_order(client, user_store):
    config_store.clear_cache()
    user_store["platform_config/ai"] = {
        "modules": {"tasks": False},
        "thresholds": {},
        "automation": {},
    }
    today = date.today().isoformat()
    await _emit(kind="late", source_id="s1", priority="upcoming", due_at=f"{today}T20:00:00+00:00")
    await _emit(kind="early", source_id="s2", priority="upcoming", due_at=f"{today}T08:00:00+00:00")
    token = seed_user(user_store)
    resp = await client.get("/v1/tasks/today", headers=auth(token))
    assert resp.status_code == 200
    assert [item["kind"] for item in resp.json()["items"]] == ["early", "late"]
    decisions = [key for key in user_store if key.startswith("ai_decisions/")]
    assert decisions == []
    config_store.clear_cache()


async def test_done_outcome_hook_records_within_24h(client, user_store):
    task_id = await _emit()
    token = seed_user(user_store)
    ranked = await client.get("/v1/tasks/today", headers=auth(token))
    headline = next(item for item in ranked.json()["items"] if item.get("headline_task"))
    decision_id = headline["decisionId"]
    assert decision_id
    resp = await client.post(
        f"/v1/tasks/{task_id}/done",
        json={"decisionId": decision_id},
        headers={**auth(token), "Idempotency-Key": "key-outcome-1"},
    )
    assert resp.status_code == 200
    assert f"ai_outcomes/{decision_id}" in user_store
    assert user_store[f"ai_outcomes/{decision_id}"]["outcome"] == "task-completed-within-24h"
