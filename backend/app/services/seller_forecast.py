"""Nightly procurement forecast job per seller over 90-day procurement/sales (M4, SGR).
Generates suggested_procurement with Gemini via gateway.generate(), validates with
Pydantic with one repair retry, caches for 24h, and falls back to static template text.
"""
import json
import logging
from datetime import datetime, timedelta, timezone

from pydantic import BaseModel, Field, ValidationError

from app.core.db import get_doc, query, set_doc
from app.services.ai import decision_log, gateway

log = logging.getLogger(__name__)

CACHE_HOURS = 24


class ProcurementSuggestion(BaseModel):
    crop: str
    qty_quintal: float
    reason: str


class SellerForecastPayload(BaseModel):
    suggested_procurement: list[ProcurementSuggestion] = Field(default_factory=list)


STATIC_FALLBACK = {
    "suggested_procurement": [
        {
            "crop": "Onion",
            "qty_quintal": 25.0,
            "reason": "Stable seasonal demand based on regional mandi arrivals (स्थानीय मंडी आवक के आधार पर स्थिर मौसमी मांग)",
        },
        {
            "crop": "Wheat",
            "qty_quintal": 40.0,
            "reason": "Consistent procurement turnover and steady local mandi liquidity (स्थानीय मंडी में निरंतर मांग और उठाव)",
        },
    ]
}


def _clean_json_str(raw: str) -> str:
    cleaned = raw.strip()
    if "```" in cleaned:
        parts = cleaned.split("```")
        if len(parts) >= 2:
            cleaned = parts[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
            cleaned = cleaned.strip()
    return cleaned


async def generate_seller_forecast(seller_uid: str, force: bool = False) -> dict:
    """Generate or retrieve cached 24h procurement forecast for a vyapari."""
    now = datetime.now(timezone.utc)
    if not force:
        cached = await get_doc("seller_forecasts", seller_uid)
        if cached:
            expires_at = cached.get("expiresAt")
            if expires_at and datetime.fromisoformat(str(expires_at)) > now:
                return cached.get("forecast", STATIC_FALLBACK)

    # 90-day history aggregation
    cutoff = (now - timedelta(days=90)).isoformat()
    lots = await query(f"users/{seller_uid}/seller_procurement", [], limit=500)
    recent_lots = [l for l in lots if str(l.get("createdAt", "")) >= cutoff]

    sales = await query(f"users/{seller_uid}/pos_sales", [], limit=500)
    recent_sales = [s for s in sales if str(s.get("createdAt", "")) >= cutoff]

    crop_procured: dict[str, float] = {}
    for lot in recent_lots:
        crop = lot.get("crop", "Unknown")
        crop_procured[crop] = round(crop_procured.get(crop, 0.0) + float(lot.get("netWeightQuintals", 0.0) or 0.0), 2)

    crop_sold: dict[str, float] = {}
    for sale in recent_sales:
        crop = sale.get("crop", "Unknown")
        crop_sold[crop] = round(crop_sold.get(crop, 0.0) + float(sale.get("quantityKg", 0.0) or 0.0) / 100.0, 2)

    prompt = (
        "You are an expert Indian agri-market demand forecasting assistant. "
        "Analyze this 90-day transaction summary for a grain/produce vyapari:\n"
        f"Procured by crop (quintals): {crop_procured}\n"
        f"Sold by crop (quintals): {crop_sold}\n"
        "Generate a 7-day procurement recommendation. Output ONLY valid JSON matching this schema:\n"
        '{"suggested_procurement": [{"crop": "string", "qty_quintal": 25.0, "reason": "bilingual rationale"}]}'
    )

    forecast_data: dict
    fallback_used = False
    source = "gemini"

    try:
        raw = await gateway.generate(prompt)
        cleaned = _clean_json_str(raw)
        parsed = json.loads(cleaned)
        validated = SellerForecastPayload.model_validate(parsed)
        forecast_data = validated.model_dump()
    except (json.JSONDecodeError, ValidationError, Exception) as exc:
        log.warning("First generation failed for seller %s (%s) — attempting repair retry", seller_uid, exc)
        try:
            repair_prompt = (
                "Fix and format the following text into strictly valid JSON matching "
                '{"suggested_procurement": [{"crop": "string", "qty_quintal": 25.0, "reason": "string"}]}:\n'
                f"{raw if 'raw' in locals() else str(exc)}"
            )
            repaired_raw = await gateway.generate(repair_prompt)
            cleaned_rep = _clean_json_str(repaired_raw)
            parsed_rep = json.loads(cleaned_rep)
            validated_rep = SellerForecastPayload.model_validate(parsed_rep)
            forecast_data = validated_rep.model_dump()
        except Exception as retry_exc:
            log.warning("Repair retry failed for seller %s (%s) — using static fallback", seller_uid, retry_exc)
            forecast_data = dict(STATIC_FALLBACK)
            fallback_used = True
            source = "fallback"

    # Log cost & decision
    await decision_log.log_decision(
        module="seller_forecast",
        question_set_id="seller.forecast.v1",
        version="v1",
        state={"seller_id": seller_uid, "crop_procured": crop_procured, "crop_sold": crop_sold},
        answers=forecast_data,
        confidence=0.85 if not fallback_used else 0.0,
        latency_ms=0,
        cost_usd=0.0005 if not fallback_used else 0.0,
        model="gemini" if not fallback_used else "none",
        source=source,
        fallback_used=fallback_used,
    )

    # 24h cache persistence
    cached_doc = {
        "id": seller_uid,
        "sellerId": seller_uid,
        "forecast": forecast_data,
        "updatedAt": now.isoformat(),
        "expiresAt": (now + timedelta(hours=CACHE_HOURS)).isoformat(),
    }
    await set_doc("seller_forecasts", seller_uid, cached_doc)
    return forecast_data


async def get_seller_forecast(seller_uid: str) -> dict | None:
    """Read cached forecast if valid, else None."""
    doc = await get_doc("seller_forecasts", seller_uid)
    if not doc:
        return None
    expires_at = doc.get("expiresAt")
    if expires_at:
        try:
            if datetime.fromisoformat(str(expires_at)) <= datetime.now(timezone.utc):
                return None
        except ValueError:
            pass
    return doc.get("forecast")


async def run_nightly_seller_forecasts() -> int:
    """Scheduled job runner across all sellers."""
    users = await query("users", [], limit=1000)
    sellers = [u for u in users if "seller" in (u.get("linkedProfiles") or [u.get("activeProfile")])]
    count = 0
    for seller in sellers:
        uid = seller.get("id") or seller.get("uid")
        if uid:
            try:
                await generate_seller_forecast(uid)
                count += 1
            except Exception as err:
                log.error("Failed nightly forecast for seller %s: %s", uid, err)
    return count
