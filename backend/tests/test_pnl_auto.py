"""Auto-fed P&L / diary entries (phase-05 WS-04 tasks 4.4, 4.8, 4.15).

`record_auto_entry` writes the single source-linked cashbook entry that is also
the P&L line; it must be idempotent on (source_kind, source_id) and carry the
source doc id. A completed marketplace order must feed it with zero manual entry.
"""
from tests.test_marketplace import seeded  # noqa: F401
from tests.test_orders import _place, _token


async def test_record_auto_entry_is_idempotent_and_traceable(client, user_store):
    from app.services.pnl_engine import record_auto_entry

    first = await record_auto_entry("uid-1", "income", 125050, "lot_sale", "lot_sale", "lot-1")
    second = await record_auto_entry("uid-1", "income", 125050, "lot_sale", "lot_sale", "lot-1")
    assert first == second
    docs = [d for k, d in user_store.items() if k.startswith("users/uid-1/diary_entries/")]
    assert len(docs) == 1
    entry = docs[0]
    assert entry["auto"] is True
    assert entry["sourceKind"] == "lot_sale"
    assert entry["sourceId"] == "lot-1"
    assert entry["type"] == "income"
    assert entry["amount"] == 1250.5


async def test_record_auto_entry_rejects_bad_direction(client, user_store):
    import pytest

    from app.services.pnl_engine import record_auto_entry

    with pytest.raises(ValueError):
        await record_auto_entry("uid-1", "transfer", 100, "x", "k", "s")


async def test_auto_entry_feeds_pnl_dashboard(client, user_store):
    from app.services.pnl_engine import build_dashboard, record_auto_entry

    await record_auto_entry("uid-1", "income", 500000, "lot_sale", "lot_sale", "lot-9")
    entries = [d for k, d in user_store.items() if k.startswith("users/uid-1/diary_entries/")]
    dashboard = build_dashboard(entries)
    assert dashboard["summary"]["income"] == 5000.0
    assert dashboard["crops"][0]["cropName"] == "other"


async def test_marketplace_order_auto_feeds_diary(client, seeded, user_store):
    token = await _token(client)
    resp = await _place(client, token, idempotencyKey="key-auto-pnl")
    assert resp.status_code == 200
    entries = [d for k, d in user_store.items() if "/diary_entries/" in k]
    auto = [e for e in entries if e.get("sourceKind") == "marketplace_order"]
    assert len(auto) == 1
    assert auto[0]["type"] == "expense"
    assert auto[0]["sourceId"] == resp.json()["orderId"]


async def test_marketplace_order_replay_does_not_duplicate_auto_entry(client, seeded, user_store):
    token = await _token(client)
    resp1 = await _place(client, token, idempotencyKey="key-auto-replay")
    resp2 = await _place(client, token, idempotencyKey="key-auto-replay")
    assert resp1.json() == resp2.json()
    entries = [d for k, d in user_store.items() if "/diary_entries/" in k]
    auto = [e for e in entries if e.get("sourceKind") == "marketplace_order"]
    assert len(auto) == 1
