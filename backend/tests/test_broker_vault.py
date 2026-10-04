"""B4: typed deal-documents vault — weigh_slip / quality_report / payment_proof
kinds with per-kind caps; both parties can view only post-acceptance."""
import pytest

from tests.test_broker_deals import (
    DEAL_BODY,
    FAKE_PNG,
    _patch_storage,
    _seed_broker,
    _seed_farmer,
)
from tests.test_diary import auth


async def _deal(client, user_store, broker):
    _seed_farmer(user_store)
    resp = await client.post("/v1/broker/deals", json=DEAL_BODY, headers=auth(broker))
    assert resp.status_code == 201
    return resp.json()


async def _upload(client, token, deal_id, kind):
    return await client.post(
        f"/v1/broker/deals/{deal_id}/evidence",
        data={"kind": kind},
        files={"file": ("slip.png", FAKE_PNG, "image/png")},
        headers=auth(token),
    )


async def test_vault_kinds_upload_and_group(client, user_store, monkeypatch):
    _patch_storage(monkeypatch)
    broker = _seed_broker(user_store)
    deal = await _deal(client, user_store, broker)

    for kind in ("weigh_slip", "quality_report", "payment_proof", "photo"):
        resp = await _upload(client, broker, deal["id"], kind)
        assert resp.status_code == 201, resp.json()

    # accept the deal so the vault opens
    user_store[f"broker_deals/{deal['id']}"]["status"] = "accepted"
    resp = await client.get(f"/v1/broker/deals/{deal['id']}/vault", headers=auth(broker))
    assert resp.status_code == 200
    vault = resp.json()
    assert vault["total"] == 3  # photo stays out of the typed vault
    assert {e["kind"] for e in vault["data"]} == {"weigh_slip", "quality_report", "payment_proof"}


async def test_vault_locked_before_acceptance(client, user_store, monkeypatch):
    _patch_storage(monkeypatch)
    broker = _seed_broker(user_store)
    deal = await _deal(client, user_store, broker)
    await _upload(client, broker, deal["id"], "weigh_slip")

    resp = await client.get(f"/v1/broker/deals/{deal['id']}/vault", headers=auth(broker))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "VAULT_LOCKED"


async def test_farmer_sees_vault_post_acceptance(client, user_store, monkeypatch):
    _patch_storage(monkeypatch)
    broker = _seed_broker(user_store)
    farmer = _seed_farmer(user_store)
    deal = await _deal(client, user_store, broker)
    await _upload(client, broker, deal["id"], "payment_proof")

    resp = await client.get(f"/v1/farmer/deals/{deal['id']}/vault", headers=auth(farmer))
    assert resp.status_code == 409

    user_store[f"broker_deals/{deal['id']}"]["status"] = "accepted"
    resp = await client.get(f"/v1/farmer/deals/{deal['id']}/vault", headers=auth(farmer))
    assert resp.status_code == 200
    assert resp.json()["total"] == 1


async def test_kind_cap_per_vault_kind(client, user_store, monkeypatch):
    _patch_storage(monkeypatch)
    broker = _seed_broker(user_store)
    deal = await _deal(client, user_store, broker)
    for _ in range(5):
        assert (await _upload(client, broker, deal["id"], "weigh_slip")).status_code == 201
    resp = await _upload(client, broker, deal["id"], "weigh_slip")
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "VAULT_KIND_LIMIT"


async def test_invalid_kind_rejected(client, user_store, monkeypatch):
    _patch_storage(monkeypatch)
    broker = _seed_broker(user_store)
    deal = await _deal(client, user_store, broker)
    resp = await client.post(
        f"/v1/broker/deals/{deal['id']}/evidence",
        data={"kind": "astrology"},
        files={"file": ("x.png", FAKE_PNG, "image/png")},
        headers=auth(broker),
    )
    assert resp.status_code == 422
