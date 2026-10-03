import re

from app.data.insurance_seed import RATES
from tests.test_diary import auth, seed_user


def _seed_rates(user_store):
    for rate in RATES:
        user_store[f"insurance_rates/{rate['id']}"] = rate


APPLY = {"cropName": "Wheat", "season": "Kharif", "landAreaAcres": 2}


async def test_policies_seeds_demo_on_first_read(client, user_store):
    token = seed_user(user_store)
    resp = await client.get("/v1/insurance/policies", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["data"][0]["policyNumber"] == "PMFBY-2026-0001"
    resp = await client.get("/v1/insurance/policies", headers=auth(token))
    assert resp.json()["total"] == 1


async def test_apply_computes_premium_exactly(client, user_store):
    _seed_rates(user_store)
    token = seed_user(user_store)
    resp = await client.post("/v1/insurance/policies/apply", json=APPLY, headers=auth(token))
    assert resp.status_code == 201
    body = resp.json()
    assert body["sumInsured"] == 80000
    assert body["farmerPremium"] == 1600.0
    assert body["govtSubsidy"] == 8400.0
    assert re.fullmatch(r"PMFBY-\d{4}-\d{4}", body["policyNumber"])


async def test_apply_unknown_crop_404(client, user_store):
    _seed_rates(user_store)
    token = seed_user(user_store)
    resp = await client.post(
        "/v1/insurance/policies/apply",
        json={"cropName": "Dragonfruit", "season": "Kharif", "landAreaAcres": 1},
        headers=auth(token),
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "RATE_NOT_FOUND"


async def test_certificate_returns_url(client, user_store, monkeypatch):
    _seed_rates(user_store)
    monkeypatch.setattr(
        "app.services.reports.upload_to_storage",
        lambda local_path, dest_path: "https://storage.example/cert.pdf",
    )
    token = seed_user(user_store)
    policy_id = (
        await client.post("/v1/insurance/policies/apply", json=APPLY, headers=auth(token))
    ).json()["id"]
    resp = await client.get(
        f"/v1/insurance/policies/{policy_id}/certificate", headers=auth(token)
    )
    assert resp.status_code == 200
    assert resp.json()["certificateUrl"] == "https://storage.example/cert.pdf"
    resp = await client.get("/v1/insurance/policies/nope/certificate", headers=auth(token))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "POLICY_NOT_FOUND"


async def test_rates_filter_by_season(client, user_store):
    _seed_rates(user_store)
    token = seed_user(user_store)
    resp = await client.get("/v1/insurance/rates?season=Kharif", headers=auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 3
    assert all(r["season"] == "Kharif" for r in body["data"])


async def test_forbidden_for_seller(client, user_store):
    token = seed_user(user_store, active_profile="seller")
    resp = await client.get("/v1/insurance/policies", headers=auth(token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"


async def test_policy_number_increments(client, user_store):
    _seed_rates(user_store)
    token = seed_user(user_store)
    await client.post("/v1/insurance/policies/apply", json=APPLY, headers=auth(token))
    resp = await client.post("/v1/insurance/policies/apply", json=APPLY, headers=auth(token))
    assert resp.json()["policyNumber"].endswith("-0002")


async def test_unauthenticated_401(client):
    resp = await client.get("/v1/insurance/policies")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "MISSING_TOKEN"
