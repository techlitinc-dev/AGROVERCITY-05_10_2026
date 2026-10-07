"""Scheme matching (phase-05 WS-05, brief M21 / SDR).

(1) every hand-derived golden case must match `rules_verdict` exactly — the
    rules engine decides eligibility/missing, never the model;
(2) the `/schemes/matches` endpoint returns the rules engine's truth set with
    explanations, matched-to-profile first;
(3) eligible schemes with missing documents emit a task naming those docs;
(4) the vernacular explanation is cached per (scheme, profile-class, lang) and
    degrades to the deterministic localized template with the AI flag off.
"""
import json
from pathlib import Path

import pytest

from app.data.schemes_seed import SCHEMES
from app.services import schemes_match
from app.services.ai import config_store
from app.services.eligibility import evaluate, is_eligible, missing_documents
from tests.test_diary import auth, seed_user

GOLDEN_PATH = (
    Path(__file__).parent / "fixtures" / "ai" / "golden" / "schemes.match.v1.jsonl"
)
GOLDEN_CASES = [
    json.loads(line)
    for line in GOLDEN_PATH.read_text(encoding="utf-8").splitlines()
    if line.strip()
]

BY_ID = {scheme["id"]: scheme for scheme in SCHEMES}


def _seed_schemes(user_store):
    for scheme in SCHEMES:
        user_store[f"schemes/{scheme['id']}"] = scheme


@pytest.mark.parametrize("case", GOLDEN_CASES, ids=[case["id"] for case in GOLDEN_CASES])
def test_rules_verdict_matches_golden(case):
    verdict = schemes_match.rules_verdict(case["profile"], case["scheme"])
    assert verdict["eligible"] is case["expected_eligible"]
    assert verdict["missing"] == case["expected_missing"]


async def test_matches_equal_rules_engine(client, user_store):
    _seed_schemes(user_store)
    token = seed_user(user_store, landAreaAcres=5, state="Maharashtra")

    resp = await client.get("/v1/schemes/matches", headers=auth(token))
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert {row["schemeId"] for row in data} == set(BY_ID)

    user = user_store["users/uid-1"]
    profile = {**user, "vaultDocTypes": []}
    for row in data:
        scheme = BY_ID[row["schemeId"]]
        rules = scheme.get("eligibilityRules") or {}
        assert row["eligible"] == is_eligible(profile, rules)
        assert row["missing"] == missing_documents(scheme["documentsRequired"], [])
        assert row["explanation"]
        assert row["checklist"] == evaluate(profile, rules)

    # matched-to-profile first: every eligible scheme precedes the ineligible ones.
    flags = [row["eligible"] for row in data]
    assert flags == sorted(flags, reverse=True)


async def test_missing_doc_tasks_name_the_docs(client, user_store):
    _seed_schemes(user_store)
    token = seed_user(user_store, landAreaAcres=1, state="Gujarat", kccLimit=50000)
    user_store["users/uid-1/vault_documents/v1"] = {"id": "v1", "docType": "aadhaar"}

    resp = await client.get("/v1/schemes/matches", headers=auth(token))
    assert resp.status_code == 200

    tasks = [doc for key, doc in user_store.items() if key.startswith("tasks/")]
    assert tasks
    missing_task = next(t for t in tasks if t["sourceId"] == "pmksy-drip")
    assert "7/12" in missing_task["subtitle"]
    assert "Bank passbook" in missing_task["subtitle"]
    assert missing_task["module"] == "schemes"
    assert missing_task["deepLink"] == "/dashboard/p/schemes"


async def test_explain_match_cache_and_flag_off_fallback(client, user_store, fake_redis):
    scheme = {"id": "pm-kisan", "name": "PM-KISAN"}
    verdict = {"eligible": True, "missing": []}
    profile = {"state": "Maharashtra", "landAreaAcres": 5}

    config_store.clear_cache()
    text_en = await schemes_match.explain_match(scheme, "en", verdict, profile)
    assert "PM-KISAN" in text_en
    assert not text_en.startswith("[shim]")
    # cached under (scheme_id, profile-class, lang)
    cached = await fake_redis.get("schemes_explain:pm-kisan:Maharashtra:small:en")
    assert cached == text_en
    assert await schemes_match.explain_match(scheme, "en", verdict, profile) == text_en

    text_hi = await schemes_match.explain_match(scheme, "hi", verdict, profile)
    assert text_hi != text_en

    # AI flag off -> deterministic localized template built from the rules output.
    user_store["platform_config/ai"] = {
        "modules": {"schemes_match": False},
        "thresholds": {},
        "automation": {},
    }
    config_store.clear_cache()
    off = await schemes_match.explain_match(
        {"id": "x", "name": "X"}, "en", {"eligible": False, "missing": []}, profile
    )
    assert "X" in off
    assert not off.startswith("[shim]")
    config_store.clear_cache()
