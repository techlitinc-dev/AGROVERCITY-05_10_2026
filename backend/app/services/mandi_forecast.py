"""Nightly mandi price forecast (phase-05 WS-01, brief M12 / SGR).

For every (crop, mandi) pair seen in the mandi price history plus the current
arrivals, ask the model — ONLY through `app/services/ai/gateway.py` (rule 10) —
for a projected 7/30-day price band, validate it with Pydantic, retry the repair
once, and cache the result per (crop, mandi) in the `mandi_forecasts`
collection. The band is NEVER computed per page-view: `GET /v1/mandi/forecast`
only reads this cache.

Money is integer paisa everywhere. When the model is off/failed (including
`AI_PROVIDER=shim`) the band degrades to a deterministic, history-derived
estimate — honest, never an invented number. Pairs with no price data at all are
skipped entirely. The gateway writes the `ai_decisions` row for each call.
"""
import json
import logging
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field, ValidationError, model_validator

from app.core.db import query, set_doc
from app.services.ai import gateway

log = logging.getLogger(__name__)

CACHE_COLLECTION = "mandi_forecasts"
FORECAST_MODULE = "mandi_forecast"
CONFIDENCE_CLASSES = ("low", "medium", "high")
HORIZONS = (7, 30)
# How many recent daily prices are sent to the model (keeps the prompt small).
MAX_PROMPT_POINTS = 30


class MandiForecastBand(BaseModel):
    """One projected price band. `confidence_class` is a fixed choice set."""

    horizon_days: int = Field(ge=1, le=60)
    band_low_paisa: int = Field(ge=0)
    band_high_paisa: int = Field(ge=0)
    confidence_class: Literal["low", "medium", "high"]

    @model_validator(mode="after")
    def _band_ordered(self) -> "MandiForecastBand":
        if self.band_high_paisa < self.band_low_paisa:
            raise ValueError("band_high_paisa must be >= band_low_paisa")
        return self


class MandiForecastPayload(BaseModel):
    bands: list[MandiForecastBand] = Field(min_length=1)


def _paisa(value) -> int:
    """Rupees/quintal (the mandi_prices unit) → integer paisa."""
    try:
        return int(round(float(value) * 100))
    except (TypeError, ValueError):
        return 0


def forecast_doc_id(crop: str, mandi: str) -> str:
    """Deterministic cache doc id for a (crop, mandi) pair."""
    raw = f"{crop.strip().lower()}__{mandi.strip().lower()}"
    slug = "".join(ch if (ch.isalnum() or ch in "-_") else "_" for ch in raw)
    return slug[:120]


def _clean_json_str(raw: str) -> str:
    cleaned = (raw or "").strip()
    if "```" in cleaned:
        parts = cleaned.split("```")
        if len(parts) >= 2:
            cleaned = parts[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
            cleaned = cleaned.strip()
    return cleaned


async def collect_series() -> dict[tuple[str, str], dict]:
    """(crop, mandi) → {crop, mandi, arrivals, prices_paisa (ascending)}.

    Built from the mandi price history plus the current mandi price rows (which
    also carry the arrivals figure). Only pairs with at least one observed price
    are returned — nothing is extrapolated from nothing.
    """
    history = await query("mandi_price_history", [], limit=10000)
    prices = await query("mandi_prices", [], limit=5000)

    series: dict[tuple[str, str], dict] = {}
    for doc in history:
        crop = str(doc.get("commodity") or "").strip()
        mandi = str(doc.get("mandiName") or "").strip()
        if not crop or not mandi:
            continue
        entry = series.setdefault(
            (crop, mandi), {"crop": crop, "mandi": mandi, "arrivals": None, "points": []}
        )
        entry["points"].append(
            {"date": str(doc.get("date") or ""), "modalPrice": doc.get("modalPrice")}
        )

    for doc in prices:
        crop = str(doc.get("commodity") or "").strip()
        mandi = str(doc.get("mandiName") or "").strip()
        if not crop or not mandi:
            continue
        entry = series.setdefault(
            (crop, mandi), {"crop": crop, "mandi": mandi, "arrivals": None, "points": []}
        )
        arrivals = doc.get("arrivalsQuintals")
        if arrivals is not None:
            entry["arrivals"] = arrivals
        if not entry["points"]:
            entry["points"].append(
                {"date": str(doc.get("updatedAt") or ""), "modalPrice": doc.get("modalPrice")}
            )

    for entry in series.values():
        entry["points"].sort(key=lambda point: point["date"])
        entry["prices_paisa"] = [_paisa(point["modalPrice"]) for point in entry["points"]]
        entry["prices_paisa"] = [value for value in entry["prices_paisa"] if value > 0]
    return {key: entry for key, entry in series.items() if entry["prices_paisa"]}


def deterministic_bands(prices_paisa: list[int]) -> list[MandiForecastBand]:
    """History-derived fallback: the observed low/high of the horizon window.

    Honest by construction — the band edges are actual observed prices, and a
    thin window lowers the confidence class instead of inventing width.
    """
    bands: list[MandiForecastBand] = []
    for horizon in HORIZONS:
        window = prices_paisa[-horizon:] if len(prices_paisa) >= horizon else list(prices_paisa)
        if not window:
            continue
        bands.append(
            MandiForecastBand(
                horizon_days=horizon,
                band_low_paisa=min(window),
                band_high_paisa=max(window),
                confidence_class="medium" if len(window) >= 7 else "low",
            )
        )
    return bands


def _prompt(entry: dict) -> str:
    series = entry["prices_paisa"][-MAX_PROMPT_POINTS:]
    return (
        "You are an Indian agri-market price forecasting assistant. "
        f"Crop: {entry['crop']}. Mandi: {entry['mandi']}. "
        f"Recent daily modal prices in paisa (oldest to newest): {series}. "
        f"Current arrivals (quintals): {entry['arrivals']}. "
        "Project a 7-day and a 30-day modal-price band. Output ONLY valid JSON "
        'matching: {"bands": [{"horizon_days": 7, "band_low_paisa": 0, '
        '"band_high_paisa": 0, "confidence_class": "low|medium|high"}, '
        '{"horizon_days": 30, "band_low_paisa": 0, "band_high_paisa": 0, '
        '"confidence_class": "low|medium|high"}]}'
    )


async def _model_bands(entry: dict) -> list[MandiForecastBand]:
    """One model call + exactly one repair retry; raises on double failure."""
    prompt = _prompt(entry)
    raw = await gateway.generate(prompt, {"module": FORECAST_MODULE})
    try:
        parsed = MandiForecastPayload.model_validate(json.loads(_clean_json_str(raw)))
        return parsed.bands
    except (json.JSONDecodeError, ValidationError, ValueError) as first_error:
        repair_prompt = (
            "Rewrite the following text as strictly valid JSON matching "
            '{"bands": [{"horizon_days": 7, "band_low_paisa": 0, "band_high_paisa": 0, '
            '"confidence_class": "low|medium|high"}]}:\n'
            f"{raw}\nValidation error: {first_error}"
        )
        repaired = await gateway.generate(repair_prompt, {"module": FORECAST_MODULE})
        parsed = MandiForecastPayload.model_validate(json.loads(_clean_json_str(repaired)))
        return parsed.bands


async def forecast_pair(entry: dict) -> dict:
    """Forecast + cache one (crop, mandi) pair; degrades to the history band."""
    prices_paisa = entry["prices_paisa"]
    source = "ai"
    try:
        bands = await _model_bands(entry)
        fallback_used = False
    except Exception as exc:  # noqa: BLE001 — never fail the nightly job
        log.warning(
            "mandi forecast model failed for %s / %s (%s) — using history band",
            entry["crop"],
            entry["mandi"],
            exc,
        )
        bands = deterministic_bands(prices_paisa)
        source = "fallback"
        fallback_used = True

    doc = {
        "id": forecast_doc_id(entry["crop"], entry["mandi"]),
        "crop": entry["crop"],
        "mandi": entry["mandi"],
        "bands": [band.model_dump() for band in bands],
        "source": source,
        "fallbackUsed": fallback_used,
        "sampleDays": len(prices_paisa),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc(CACHE_COLLECTION, doc["id"], doc)
    return doc


async def run_nightly_forecast() -> int:
    """Scheduled job: cache a 7/30-day band for every observed (crop, mandi).

    Returns the number of pairs cached. Runs off the request path only — the
    read endpoint never triggers a model call.
    """
    series = await collect_series()
    count = 0
    for entry in series.values():
        try:
            await forecast_pair(entry)
            count += 1
        except Exception as err:  # noqa: BLE001 — one bad pair never stops the run
            log.error("mandi forecast failed for %s / %s: %s", entry["crop"], entry["mandi"], err)
    return count
