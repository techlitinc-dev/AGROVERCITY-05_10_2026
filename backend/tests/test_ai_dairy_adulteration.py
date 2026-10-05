"""M17 `dairy.adulteration.v1` AI tests (WS-07 task 7.20).

Covers:
(1) a seeded adulteration pattern (stable member history, then a diluted
    reading) is flagged on the shim — >=85% of the seeded anomalous entries;
(2) zero false-blocks — every collection POST succeeds regardless of the flag;
(3) gateway raising -> deterministic fallback annotation + the collection still
    saves and the decision is logged with `fallbackUsed`;
(4) flag off -> collections save with NO annotation and no `ai_decisions` rows;
(5) the member statement for a cycle containing a flagged collection carries the
    note field the UI renders (en + hi).

Plus a light check that the weekly route-summary job reads STORED annotations
only (no per-collection gateway calls).
"""
from datetime import date, timedelta

import pytest

from app.core.config import settings
from app.services.ai import config_store
from tests.test_diary import auth, seed_user

MGR_1 = {"uid": "mgr-1", "active_profile": "dairyManager"}
TARGET_DATE = "2026-10-15"
HISTORY_DATES = [f"2026-10-{day:02d}" for day in range(1, 6)]  # 5 stable readings
MEMBERS = [f"mem_g{i}" for i in range(8)]


@pytest.fixture(autouse=True)
def _shim_mode(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "shim")
    config_store.clear_cache()
    yield
    config_store.clear_cache()


def _payload(**overrides):
    payload = {
        "farmerName": "रामसिंग पाटील",
        "farmerCode": "F-042",
        "farmerId": "farmer-1",
        "date": TARGET_DATE,
        "shift": "morning",
        "milkType": "cow",
        "liters": 10.0,
        "fatPercent": 4.0,
        "snfPercent": 9.0,
    }
    payload.update(overrides)
    return payload


def _seed_history(user_store, member_id, fat=4.0, snf=9.0):
    for idx, day in enumerate(HISTORY_DATES):
        doc_id = f"seed_{member_id}_{idx}"
        user_store[f"milk_collections/{doc_id}"] = {
            "id": doc_id,
            "dairyId": "mgr-1",
            "memberId": member_id,
            "farmerId": "farmer-1",
            "farmerCode": "F-042",
            "date": day,
            "fatPercent": fat,
            "snfPercent": snf,
            "liters": 10.0,
        }


def _new_collection(user_store, member_id):
    return next(
        (
            doc
            for key, doc in user_store.items()
            if key.startswith("milk_collections/")
            and doc.get("memberId") == member_id
            and doc.get("date") == TARGET_DATE
        ),
        None,
    )


def _decisions(user_store):
    return [doc for key, doc in user_store.items() if key.startswith("ai_decisions/")]


def _adulteration_decisions(user_store):
    return [d for d in _decisions(user_store) if d.get("questionSetId") == "dairy.adulteration.v1"]


async def _record(client, token, payload):
    return await client.post("/v1/livestock/procurement/collections", json=payload, headers=auth(token))


# --------------------------------------------------------------------------- #
# (1) seeded adulteration pattern -> flagged (>=85%)
# --------------------------------------------------------------------------- #


async def test_seeded_adulteration_pattern_flagged(client, user_store):
    token = seed_user(user_store, **MGR_1)
    flagged = 0
    for member_id in MEMBERS:
        _seed_history(user_store, member_id)  # stable FAT 4.0 / SNF 9.0
        resp = await _record(
            client,
            token,
            _payload(memberId=member_id, fatPercent=3.0, snfPercent=8.0),  # diluted reading
        )
        assert resp.status_code == 201
        doc = _new_collection(user_store, member_id)
        assert doc is not None
        annotation = doc.get("adulteration") or {}
        if annotation.get("anomaly") is True:
            flagged += 1
        assert (annotation.get("baseline") or {}).get("windowDays") == 30

    rate = flagged / len(MEMBERS)
    assert rate >= 0.85, f"detection rate {rate:.2f} below 0.85"

    # every call was logged with cost + confidence + fallbackUsed
    logged = _adulteration_decisions(user_store)
    assert logged
    assert all("costUsd" in row and "confidence" in row and "fallbackUsed" in row for row in logged)


# --------------------------------------------------------------------------- #
# (2) zero false-blocks — collections always save
# --------------------------------------------------------------------------- #


async def test_zero_false_blocks_collections_always_save(client, user_store):
    token = seed_user(user_store, **MGR_1)
    _seed_history(user_store, "mem_block")

    # anomalous reading — still saves, with the flag attached
    resp = await _record(client, token, _payload(memberId="mem_block", fatPercent=2.2, snfPercent=6.5))
    assert resp.status_code == 201
    doc = _new_collection(user_store, "mem_block")
    assert doc is not None
    assert (doc.get("adulteration") or {}).get("anomaly") is True

    # normal reading for a member with no history — saves, no flag
    resp = await _record(
        client, token, _payload(memberId="mem_clean", farmerCode="F-999", fatPercent=4.1, snfPercent=9.05)
    )
    assert resp.status_code == 201
    clean = _new_collection(user_store, "mem_clean")
    assert clean is not None
    assert (clean.get("adulteration") or {}).get("anomaly") is False


# --------------------------------------------------------------------------- #
# (3) gateway raising -> fallback annotation + collection still saves
# --------------------------------------------------------------------------- #


async def test_fallback_when_gateway_raises(client, user_store, monkeypatch):
    token = seed_user(user_store, **MGR_1)
    _seed_history(user_store, "mem_fallback")

    async def boom(*args, **kwargs):
        raise RuntimeError("AI gateway unavailable")

    monkeypatch.setattr("app.services.ai.gateway.decide", boom)

    resp = await _record(client, token, _payload(memberId="mem_fallback", fatPercent=3.0, snfPercent=8.0))
    assert resp.status_code == 201  # never blocked by an AI failure
    doc = _new_collection(user_store, "mem_fallback")
    assert doc is not None
    assert (doc.get("adulteration") or {}).get("anomaly") is True

    fallback_dec = next(
        (d for d in _adulteration_decisions(user_store) if d.get("fallbackUsed") is True), None
    )
    assert fallback_dec is not None
    assert fallback_dec["source"] == "fallback"
    assert fallback_dec["costUsd"] == 0.0


# --------------------------------------------------------------------------- #
# (4) flag off -> collections save with no annotation, no decisions
# --------------------------------------------------------------------------- #


async def test_flag_off_no_annotation(client, user_store):
    token = seed_user(user_store, **MGR_1)
    _seed_history(user_store, "mem_off")

    user_store["platform_config/ai"] = {
        "modules": {"dairy_adulteration": False},
        "thresholds": {"dairy.adulteration.v1": 0.75},
        "automation": {"dairy.adulteration.v1": "suggest"},
    }
    config_store.clear_cache()

    before = len(_decisions(user_store))
    resp = await _record(client, token, _payload(memberId="mem_off", fatPercent=2.2, snfPercent=6.5))
    assert resp.status_code == 201
    doc = _new_collection(user_store, "mem_off")
    assert doc is not None
    assert "adulteration" not in doc
    assert len(_decisions(user_store)) == before


# --------------------------------------------------------------------------- #
# (5) member statement carries the note field
# --------------------------------------------------------------------------- #


async def test_statement_carries_flag_note(client, user_store):
    token = seed_user(user_store, **MGR_1)
    member = (
        await client.post(
            "/v1/livestock/dairy/members",
            json={"name": "Member Flag", "phone": "+919888800001", "village": "गाव", "farmerCode": "M-FLAG"},
            headers=auth(token),
        )
    ).json()
    member_id = member["id"]

    _seed_history(user_store, member_id)
    resp = await _record(client, token, _payload(memberId=member_id, fatPercent=3.0, snfPercent=8.0))
    assert resp.status_code == 201

    statement = (
        await client.get(f"/v1/livestock/dairy/members/{member_id}/statement", headers=auth(token))
    ).json()
    assert statement["flaggedCount"] >= 1
    assert statement["flagNote"] is not None
    assert statement["flagNote"]["en"] and statement["flagNote"]["hi"]


# --------------------------------------------------------------------------- #
# weekly route-summary job reads STORED annotations (no per-collection calls)
# --------------------------------------------------------------------------- #


async def test_weekly_route_summary_reads_stored_annotations(client, user_store):
    token = seed_user(user_store, **MGR_1)
    today = date.today()
    recent = (today - timedelta(days=1)).isoformat()
    user_store["dairy_routes/rt_flag"] = {
        "id": "rt_flag",
        "managerId": "mgr-1",
        "routeName": "Morning Alpha",
        "scheduledDate": recent,
        "stops": [{"farmerId": "farmer-1", "farmerName": "Ram", "sequence": 1}],
    }
    for idx in range(3):
        user_store[f"milk_collections/rt_c{idx}"] = {
            "id": f"rt_c{idx}",
            "dairyId": "mgr-1",
            "memberId": "mem_rt",
            "farmerId": "farmer-1",
            "farmerCode": "F-042",
            "date": recent,
            "fatPercent": 4.0,
            "snfPercent": 9.0,
            "adulteration": {"anomaly": idx < 2, "confidence": 0.9},
        }

    before = len(_decisions(user_store))
    resp = await client.post("/v1/jobs/dairy/adulteration/route-summary", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["routes"] == 1
    assert body["flagged"] == 2

    summary = user_store["dairy_route_anomaly_summaries/dairy_route_anomaly_rt_flag_" + today.isoformat()]
    assert summary["routeId"] == "rt_flag"
    assert summary["flagged"] == 2
    assert summary["total"] == 3
    assert summary["topMembers"][0]["flagged"] == 2
    # the job made no new gateway calls (reads stored annotations only)
    assert len(_decisions(user_store)) == before
