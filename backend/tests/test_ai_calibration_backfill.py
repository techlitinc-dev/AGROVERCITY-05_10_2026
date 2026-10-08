"""Calibration weekly-report backfill (phase-08 WS-02 task 2.11)."""
from app.services.ai.calibration import backfill
from app.services.ai.calibration import iso_week_id


async def test_backfill_writes_at_least_four_weekly_reports(client, user_store):
    result = await backfill(weeks=6)
    weeks = {k.split("/", 1)[1] for k in user_store if k.startswith("ai_calibration/")}
    assert len(weeks) >= 4
    assert result["written"] >= 3
    # Idempotent across re-runs — never overwrites existing weeks.
    again = await backfill(weeks=6)
    assert again["written"] == 0
    assert f"weekly-{iso_week_id(0)}" in weeks
