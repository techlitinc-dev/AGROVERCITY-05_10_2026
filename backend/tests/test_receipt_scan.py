"""M28 receipt-scan tests (phase-08 WS-01).

Covers: golden field accuracy >= 85% on shim; confirm-only (no diary entry is
written by the scan — totals/analytics unchanged until save); flag-off degrades
to the manual form.
"""
import json
import os

import pytest

from app.core.config import settings
from app.services import receipt_scan
from app.services.ai import config_store
from tests.test_diary import ENTRY, auth, seed_user

FIXTURE_DIR = os.path.join(os.path.dirname(__file__), "fixtures", "ai", "golden", "receipt_scan")
FIELDS = ("amount_paisa", "category", "party", "date", "entry_type")


@pytest.fixture(autouse=True)
def _shim_mode(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "shim")
    config_store.clear_cache()
    yield
    config_store.clear_cache()


def _fixture_pairs():
    for name in sorted(os.listdir(FIXTURE_DIR)):
        if name.endswith(".json"):
            with open(os.path.join(FIXTURE_DIR, name), encoding="utf-8") as handle:
                yield name.replace(".json", ".jpg"), json.load(handle)


async def test_golden_field_accuracy(client, user_store):
    pairs = list(_fixture_pairs())
    assert len(pairs) >= 3
    matched = total = 0
    for image_name, expected in pairs:
        prefill = await receipt_scan.scan_receipt(image_name)
        for field in FIELDS:
            total += 1
            if prefill.get(field) == expected.get(field):
                matched += 1
    accuracy = matched / total
    assert accuracy >= 0.85, f"receipt field accuracy {accuracy:.3f} below 0.85"


async def test_scan_is_confirm_only(client, user_store):
    token = seed_user(user_store, uid="uid-receipt-1")
    resp = await client.post(
        "/v1/diary/receipt-scan",
        json={"storagePath": "diary/uid-receipt-1/receipt_01.jpg"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["available"] is True
    assert body["prefill"]["amount_paisa"] == 45000
    # No diary entry is created by the scan (confirm-only).
    assert [k for k in user_store if k.startswith("users/uid-receipt-1/diary_entries/")] == []

    # Saving the prefilled entry DOES change totals — only then.
    resp = await client.post("/v1/diary/entries", json=ENTRY, headers=auth(token))
    assert resp.status_code == 201
    assert [k for k in user_store if k.startswith("users/uid-receipt-1/diary_entries/")]


async def test_flag_off_degrades(client, user_store):
    token = seed_user(user_store, uid="uid-receipt-2")
    user_store["platform_config/ai"] = {"modules": {"receipt_scan": False}}
    config_store.clear_cache()
    resp = await client.post(
        "/v1/diary/receipt-scan",
        json={"storagePath": "diary/x.jpg"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    assert resp.json() == {"available": False, "prefill": None}
