"""AI payload privacy sanitizers (global rule 11): no unmasked Aadhaar, phone
numbers, or emails ever leave for a model provider. IDs are HMAC-hashed."""
import hashlib
import hmac
import re

from app.core.config import settings

PHONE_RE = re.compile(r"(?:(?:\+?91[\s-]?)?[6-9]\d{9})\b")  # redact / mask regex
EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")  # redact / mask regex
AADHAAR_RE = re.compile(r"(?<![\d+])\d{4}\s?\d{4}\s?\d{4}(?!\d)")  # redact / mask regex

MAX_STATE_TOKENS = 1500
CHUNK_TOKENS = 8000


def hash_user_id(user_id: str) -> str:
    digest = hmac.new(
        settings.ai_hash_salt.encode(), (user_id or "").encode(), hashlib.sha256
    ).hexdigest()
    return digest[:32]


def _mask_aadhaar_match(match: re.Match) -> str:
    digits = re.sub(r"\s", "", match.group(0))
    return f"XXXX-XXXX-{digits[-4:]}"


def mask_aadhaar(text: str) -> str:
    return AADHAAR_RE.sub(_mask_aadhaar_match, text)


def sanitize_text(text: str) -> str:
    if not text:
        return text
    text = EMAIL_RE.sub("[email]", text)  # redact / mask
    text = PHONE_RE.sub("[phone]", text)  # redact / mask
    text = mask_aadhaar(text)
    return text


def sanitize_state(state):
    """Recursively strip phone/email patterns and mask Aadhaar numbers."""
    if isinstance(state, dict):
        return {key: sanitize_state(value) for key, value in state.items()}
    if isinstance(state, list):
        return [sanitize_state(item) for item in state]
    if isinstance(state, str):
        return sanitize_text(state)
    return state


def estimate_tokens(text: str) -> int:
    # Rough heuristic: ~4 characters per token.
    return max(1, len(text) // 4)


def trim_to_token_budget(text: str, max_tokens: int = MAX_STATE_TOKENS) -> str:
    if estimate_tokens(text) <= max_tokens:
        return text
    return text[: max_tokens * 4]


def chunk_text(text: str, chunk_tokens: int = CHUNK_TOKENS) -> list[str]:
    """Split oversized states (>32k Jev context limit) into ordered chunks."""
    chunk_chars = chunk_tokens * 4
    if len(text) <= chunk_chars:
        return [text]
    return [text[i : i + chunk_chars] for i in range(0, len(text), chunk_chars)]


def build_seller_rate_check_state(
    posted_rate: float,
    crop: str,
    mandi_modal: float,
    seven_day_volatility: float = 0.0,
    seller_history: dict | None = None,
    seller_id: str | None = None,
) -> dict:
    """M4 state builder: rate-check state payload (≤1500 tokens, pseudonymized,
    no PII). Produces {posted rate, crop, mandi modal, 7-day volatility, seller history}."""
    pseudo_id = hash_user_id(seller_id) if seller_id else "anonymous"
    clean_history = dict(seller_history or {})
    for pii_key in ("phone", "email", "aadhaar", "farmerPhone", "sellerPhone", "buyerPhone", "name"):  # strip / remove PII
        clean_history.pop(pii_key, None)

    state = {
        "posted_rate": float(posted_rate),
        "crop": sanitize_text(crop),
        "mandi_modal": float(mandi_modal),
        "seven_day_volatility": float(seven_day_volatility),
        "seller_history": {
            "seller_pseudo_id": pseudo_id,
            **clean_history,
        },
    }
    return sanitize_state(state)


build_rate_check_state = build_seller_rate_check_state


def build_transport_match_state(
    entity: dict,
    candidates: list[dict] | None = None,
    history: dict | None = None,
    transporter_id: str | None = None,
) -> dict:
    """M16 state builder: route fit, vehicle type, capacity, history (≤1500 tokens,
    pseudonymized, no_aadhaar / no_phone / no_email)."""
    pseudo_id = hash_user_id(transporter_id) if transporter_id else "anonymous"
    clean_candidates = []
    for c in (candidates or [])[:10]:
        clean_c = {
            "id": c.get("id"),
            "vehicleType": c.get("vehicleType") or c.get("preferredVehicleType"),
            "capacity": c.get("capacity") or c.get("weightQuintals") or c.get("quantityQuintals"),
            "distance_km": float(c.get("distance_km") or c.get("distanceKm") or c.get("distance") or 0.0),
            "pickup": sanitize_text(str(c.get("pickup") or c.get("pickupLocation") or "")),
            "drop": sanitize_text(str(c.get("drop") or c.get("dropLocation") or "")),
        }
        clean_candidates.append(clean_c)

    clean_history = dict(history or {})
    for pii_key in ("phone", "email", "aadhaar", "driverPhone", "driverName", "farmerPhone", "farmerName", "name"):  # strip / remove PII
        clean_history.pop(pii_key, None)

    state = {
        "route": {
            "pickup": sanitize_text(str(entity.get("pickup") or entity.get("pickupLocation") or "")),
            "drop": sanitize_text(str(entity.get("drop") or entity.get("dropLocation") or "")),
            "distance_km": float(entity.get("distanceKm") or entity.get("distance_km") or 0.0),
        },
        "vehicleType": entity.get("vehicleType") or entity.get("preferredVehicleType"),
        "capacity": entity.get("capacity") or entity.get("weightQuintals") or entity.get("quantityQuintals"),
        "transporter_pseudo_id": pseudo_id,
        "history": clean_history,
        "candidates": clean_candidates,
    }
    return sanitize_state(state)


def build_broker_lead_score_state(
    lead: dict,
    history: dict | None = None,
    demand_fit: bool = True,
    broker_id: str | None = None,
) -> dict:
    """M19 state builder: source, history, demand fit (≤1500 tokens, pseudonymized,
    no_aadhaar / no_phone / no_email)."""
    pseudo_id = hash_user_id(broker_id) if broker_id else "anonymous"
    clean_history = dict(history or {})
    for pii_key in ("phone", "email", "aadhaar", "name", "buyerName", "sellerName", "buyerPhone", "sellerPhone"):  # strip / remove PII
        clean_history.pop(pii_key, None)

    state = {
        "broker_pseudo_id": pseudo_id,
        "type": lead.get("type", "farmer"),
        "commodity": sanitize_text(str(lead.get("commodity") or "")),
        "quantityExpected": float(lead.get("quantityExpected") or 0.0),
        "targetRate": float(lead.get("targetRate") or 0.0),
        "demand_fit": bool(demand_fit),
        "history": clean_history,
    }
    return sanitize_state(state)


def build_broker_deadlock_state(
    deal: dict,
    messages: list[dict],
    counter_round: int,
    price_gap_pct: float,
    ttl_hours_remaining: float,
    broker_id: str | None = None,
) -> dict:
    """M19 deadlock state builder: message count, price gap, TTL remaining (≤1500 tokens,
    pseudonymized, no_aadhaar / no_phone / no_email)."""
    pseudo_id = hash_user_id(broker_id) if broker_id else "anonymous"
    state = {
        "broker_pseudo_id": pseudo_id,
        "deal_pseudo_id": hash_user_id(deal.get("id")),
        "commodity": sanitize_text(str(deal.get("commodity") or "")),
        "message_count": len(messages),
        "counter_round": int(counter_round),
        "price_gap_pct": float(price_gap_pct),
        "ttl_hours_remaining": float(ttl_hours_remaining),
    }
    return sanitize_state(state)


def build_equipment_booking_rec_state(
    booking: dict,
    equipment: dict,
    slot: dict,
    renter_history: dict | None = None,
    slot_conflict: bool = False,
    distance_km: float = 0.0,
    owner_id: str | None = None,
) -> dict:
    """M24 state builder: renter history, slot conflicts, distance (≤1500 tokens,
    pseudonymized, no_aadhaar / no_phone / no_email)."""
    pseudo_id = hash_user_id(owner_id) if owner_id else "anonymous"
    clean_history = dict(renter_history or {})
    for pii_key in ("phone", "email", "aadhaar", "name", "farmerName", "ownerName"):  # strip / remove PII
        clean_history.pop(pii_key, None)

    state = {
        "owner_pseudo_id": pseudo_id,
        "equipment_type": sanitize_text(equipment.get("type") or equipment.get("name") or "tractor"),
        "date": slot.get("date", booking.get("date")),
        "slot_name": slot.get("slotName", booking.get("slotName")),
        "price_rupees": float(slot.get("priceRupees", booking.get("priceRupees", 0))),
        "distance_km": float(distance_km),
        "slot_conflict": bool(slot_conflict),
        "renter_history": clean_history,
    }
    return sanitize_state(state)


def build_land_listing_quality_state(
    listing: dict,
    plot: dict | None = None,
    village_lease_stats: dict | None = None,
    district_defaults: dict | None = None,
    landlord_id: str | None = None,
) -> dict:
    """M25 state builder: listing quality, completeness, rent band check (≤1500 tokens,
    pseudonymized, no_aadhaar / no_phone / no_email)."""
    pseudo_id = hash_user_id(landlord_id) if landlord_id else "anonymous"
    p = plot or {}

    area = float(listing.get("areaAcres") or p.get("areaAcres") or 1.0)
    monthly_rent = float(listing.get("monthlyRentRupees") or 0.0)
    annual_rent = float(listing.get("annualRentRupees") or (monthly_rent * 12))
    rent_per_acre_year = (annual_rent / area) if area > 0 else annual_rent

    has_village = bool(village_lease_stats and village_lease_stats.get("sampleCount", 0) >= 3)
    if has_village:
        band_min = float(village_lease_stats.get("bandMin", 15000))
        band_max = float(village_lease_stats.get("bandMax", 45000))
        band_source = "village_lease_data"
    else:
        dist_stats = district_defaults or {}
        band_min = float(dist_stats.get("bandMin", 12000))
        band_max = float(dist_stats.get("bandMax", 40000))
        band_source = "district_benchmark_default"

    photos = listing.get("photoUrls") or listing.get("photos") or p.get("photoUrls") or []
    photo_count = len(photos) if isinstance(photos, list) else int(listing.get("photoCount") or 0)

    state = {
        "landlord_pseudo_id": pseudo_id,
        "area_acres": area,
        "rent_per_acre_year": rent_per_acre_year,
        "soil_type": sanitize_text(listing.get("soilType") or p.get("soilType") or ""),
        "water_source": sanitize_text(listing.get("waterSource") or p.get("waterSource") or ""),
        "photo_count": photo_count,
        "village": sanitize_text(listing.get("village") or p.get("village") or ""),
        "district": sanitize_text(listing.get("district") or p.get("district") or ""),
        "band_min": band_min,
        "band_max": band_max,
        "band_source": band_source,
        "village_data_available": has_village,
    }
    return sanitize_state(state)




