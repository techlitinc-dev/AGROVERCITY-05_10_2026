"""ai_decisions export-then-expire tests (phase-08 WS-04 task 4.5)."""
from datetime import datetime, timedelta, timezone

import pytest

from app.services.ai import decision_export

NOW = datetime(2026, 10, 8, 12, 0, tzinfo=timezone.utc)


def _seed(user_store, decision_id, age_days):
    user_store[f"ai_decisions/{decision_id}"] = {
        "id": decision_id,
        "questionSetId": "kyc.authenticity_risk.v1",
        "at": (NOW - timedelta(days=age_days)).isoformat(),
    }


async def test_export_then_expire(client, user_store):
    _seed(user_store, "fresh", 30)
    _seed(user_store, "expired", 91)
    _seed(user_store, "ancient", 400)

    result = await decision_export.export_expired_decisions(now=NOW)
    assert result["exported"] == 2

    # Exported THEN deleted.
    assert "ai_decisions/fresh" in user_store
    assert "ai_decisions/expired" not in user_store
    assert "ai_decisions/ancient" not in user_store
    assert "ai_decisions_exports/expired" in user_store
    assert "ai_decisions_exports/ancient" in user_store


async def test_no_delete_when_export_fails(client, user_store, monkeypatch):
    _seed(user_store, "expired", 100)

    def boom(*args, **kwargs):
        raise RuntimeError("cold storage down")

    monkeypatch.setattr("app.services.ai.decision_export.storage.upload_user_file", boom)
    result = await decision_export.export_expired_decisions(now=NOW)
    assert result["exported"] == 0
    assert result["skipped"] == 1
    # Never deleted without a verified export.
    assert "ai_decisions/expired" in user_store
    assert "ai_decisions_exports/expired" not in user_store
