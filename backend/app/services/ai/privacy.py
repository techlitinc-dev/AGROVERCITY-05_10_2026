"""AI payload privacy sanitizers (global rule 11): no unmasked Aadhaar, phone
numbers, or emails ever leave for a model provider. IDs are HMAC-hashed."""
import hashlib
import hmac
import re
from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.core.db import get_doc, query

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


def build_loan_prescreen_state(application: dict) -> dict:
    """M14 state builder: loan-relevant aggregates only — amount, purpose,
    land/crop summary, repayment-history summary and uploaded doc types.
    Pseudonymized, ≤1500 tokens, no Aadhaar / phone / email (rule 11)."""
    # Local import keeps privacy.py free of AI-module import cycles at call time.
    from app.services.ai.question_sets import LOAN_REQUIRED_DOC_TYPES

    app = dict(application or {})
    applicant = app.get("userId") or app.get("farmerId") or ""

    repayment_raw = app.get("repaymentHistory") or {}
    if isinstance(repayment_raw, list):
        total = len(repayment_raw)
        on_time = sum(
            1 for r in repayment_raw if isinstance(r, dict) and r.get("status") in ("disbursed", "closed")
        )
        overdue = sum(1 for r in repayment_raw if isinstance(r, dict) and r.get("overdue"))
        defaults = sum(1 for r in repayment_raw if isinstance(r, dict) and r.get("defaulted"))
    else:
        total = int(repayment_raw.get("total") or 0)
        on_time = int(repayment_raw.get("onTime") or 0)
        overdue = int(repayment_raw.get("overdue") or 0)
        defaults = int(repayment_raw.get("defaults") or 0)

    uploaded: list[str] = []
    for doc in app.get("documents") or []:
        if isinstance(doc, dict):
            uploaded.append(str(doc.get("type") or doc.get("documentType") or doc.get("name") or ""))
        elif isinstance(doc, str):
            uploaded.append(doc)
    uploaded.extend(str(t) for t in (app.get("documentTypes") or []))

    crops = app.get("primaryCrops") or app.get("crops") or []
    try:
        credit_score = int(app.get("farmerCreditScore") or app.get("creditScore") or 0)
    except (TypeError, ValueError):
        credit_score = 0

    state = {
        "applicant_pseudo_id": hash_user_id(str(applicant)),
        "amount": float(app.get("amount") or 0),
        "purpose": sanitize_text(str(app.get("purpose") or "")),
        "land_holding_acres": float(app.get("landHoldingAcres") or app.get("land_holding_acres") or 0.0),
        "primary_crops": [sanitize_text(str(crop)) for crop in crops][:10],
        "credit_score": credit_score,
        "repayment": {"total": total, "on_time": on_time, "overdue": overdue, "defaults": defaults},
        "uploaded_doc_types": [sanitize_text(str(token)) for token in uploaded if token][:20],
        "required_doc_types": list(app.get("requiredDocTypes") or LOAN_REQUIRED_DOC_TYPES),
        "district": sanitize_text(str(app.get("district") or "")),
    }
    return sanitize_state(state)


def build_claim_triage_state(claim: dict) -> dict:
    """M15 state builder: crop / loss-type / photo-metadata aggregates only.
    Pseudonymized claim id, ≤1500 tokens, no Aadhaar / phone / email (rule 11)."""
    # Local import keeps privacy.py free of AI-module import cycles at call time.
    from app.services.ai.question_sets import REQUIRED_CLAIM_PHOTOS

    c = dict(claim or {})
    photos = c.get("damagePhotos") or []
    photo_count = len(photos) if isinstance(photos, (list, tuple)) else int(c.get("photoCount") or 0)

    try:
        loss_percent = float(c.get("estimatedLossPercent") or 0.0)
    except (TypeError, ValueError):
        loss_percent = 0.0

    state = {
        "claim_pseudo_id": hash_user_id(str(c.get("id") or c.get("claimId") or "")),
        "crop": sanitize_text(str(c.get("cropName") or "")),
        "calamity_type": sanitize_text(str(c.get("calamityType") or "")),
        "crop_stage": sanitize_text(str(c.get("cropStage") or "")),
        "estimated_loss_percent": loss_percent,
        "photo_count": photo_count,
        "required_photo_count": int(c.get("requiredPhotoCount") or REQUIRED_CLAIM_PHOTOS),
        "gps_present": bool(c.get("gpsCoordinates")),
        "district": sanitize_text(str(c.get("farmerDistrict") or c.get("district") or "")),
    }
    if c.get("fraudSignal") is not None:
        try:
            state["fraud_signal"] = float(c.get("fraudSignal") or 0.0)
        except (TypeError, ValueError):
            state["fraud_signal"] = 0.0
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


def build_chat_guardrail_state(text: str, sender_id: str | None = None) -> dict:
    """M6 (WS-01) state builder: the chat message text only, with the sender
    pseudonymized and any phone/email/Aadhaar masked (≤1500 tokens, no PII)."""
    return sanitize_state(
        {
            "sender_pseudo_id": hash_user_id(sender_id) if sender_id else "anonymous",
            "message": sanitize_text(str(text or "")),
        }
    )


def build_ugc_moderation_state(text: str, author_id: str | None = None) -> dict:
    """WS-01 state builder for `content.moderation.v1`: the UGC text only, with
    the author pseudonymized and any phone/email/Aadhaar masked (no PII)."""
    return sanitize_state(
        {
            "author_pseudo_id": hash_user_id(author_id) if author_id else "anonymous",
            "text": sanitize_text(str(text or "")),
        }
    )


def _to_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def build_adulteration_state(member_history: list[dict], today: dict) -> dict:
    """M17 state builder: pseudonymized member ref + the member's FAT/SNF series
    plus today's reading only (≤1500 tokens, no names/phones, rule 11)."""
    history = member_history or []
    fat_series: list[float] = []
    snf_series: list[float] = []
    pseudo_id = "anonymous"
    for row in history:
        if not isinstance(row, dict):
            continue
        clean_row = dict(row)
        for pii_key in ("name", "farmerName", "phone", "email", "aadhaar"):  # strip / remove PII
            clean_row.pop(pii_key, None)
        uid = clean_row.get("memberId") or clean_row.get("farmerUid") or clean_row.get("farmerId")
        if uid and pseudo_id == "anonymous":
            pseudo_id = hash_user_id(str(uid))
        fat_series.append(round(_to_float(clean_row.get("fatPercent") or clean_row.get("fat")), 3))
        snf_series.append(round(_to_float(clean_row.get("snfPercent") or clean_row.get("snf")), 3))

    t = today or {}
    member_uid = t.get("memberId") or t.get("farmerUid") or t.get("farmerId")
    if member_uid:
        pseudo_id = hash_user_id(str(member_uid))

    state = {
        "member_pseudo_id": pseudo_id,
        "window_days": int(t.get("windowDays") or 30),
        "history": {"fat": fat_series[-30:], "snf": snf_series[-30:]},
        "today": {
            "fat": round(_to_float(t.get("fatPercent") or t.get("fat")), 3),
            "snf": round(_to_float(t.get("snfPercent") or t.get("snf")), 3),
        },
    }
    return sanitize_state(state)


def build_contract_attractiveness_state(
    contract: dict, mandiTrend: list, farmerCropHistory: list
) -> dict:
    """M18 state builder: contract formula-pricing terms, crop mandi trend series
    and aggregated farmer crop history (≤1500 tokens, pseudonymized, no PII,
    rule 11). The contract's money fields are passed as numeric rates, never as
    free text, and buyer/farmer identifiers are HMAC-hashed."""
    c = dict(contract or {})
    for pii_key in (
        "farmerName",
        "buyerCompany",
        "name",
        "phone",
        "farmerPhone",
        "buyerPhone",
        "email",
        "aadhaar",
        "termsText",
    ):  # strip / remove PII
        c.pop(pii_key, None)

    trend: list[dict] = []
    for point in (mandiTrend or [])[-12:]:
        if isinstance(point, dict):
            trend.append(
                {
                    "date": sanitize_text(str(point.get("date") or point.get("week") or "")),
                    "modal": round(_to_float(point.get("modalPrice") or point.get("modal")), 2),
                }
            )
        else:
            trend.append({"date": "", "modal": round(_to_float(point), 2)})
    modals = [point["modal"] for point in trend if point["modal"] > 0]
    avg = round(sum(modals) / len(modals), 2) if modals else 0.0

    crop_counts: dict[str, int] = {}
    for row in farmerCropHistory or []:
        if not isinstance(row, dict):
            continue
        crop = str(row.get("crop") or "").strip()
        if crop:
            crop_counts[crop] = crop_counts.get(crop, 0) + 1

    schedule = c.get("schedule") or {}
    state = {
        "contract_pseudo_id": hash_user_id(str(c.get("id") or "")),
        "farmer_pseudo_id": hash_user_id(str(c.get("farmerId") or "")),
        "crop": sanitize_text(str(c.get("crop") or "")),
        "price_type": str(c.get("priceType") or "fixed"),
        "base_rate": round(_to_float(c.get("baseRate")), 2),
        "premium_per_quintal": round(_to_float(c.get("premiumPerQuintal")), 2),
        "quantity_total": round(_to_float(c.get("quantityTotal")), 2),
        "payment_terms_days": int(_to_float(c.get("paymentTermsDays"))),
        "schedule": {
            "frequency": str(schedule.get("frequency") or ""),
            "qtyPerDelivery": round(_to_float(schedule.get("qtyPerDelivery")), 2),
        },
        "mandi_benchmark": {"avg": avg, "sample_count": len(modals), "series": trend},
        "farmer_crop_history": {
            "prior_count": len(farmerCropHistory or []),
            "crop_counts": crop_counts,
        },
    }
    return sanitize_state(state)






def build_kyc_risk_state(
    doc_type: str,
    name_match: bool = True,
    dob_match: bool = True,
    doc_age_days: int = 0,
    image_quality_ok: bool = True,
    extracted_field_count: int = 0,
) -> dict:
    """M11 state builder: consistency + quality signals only (booleans/counts),
    never the document's PII — pseudonymized, no Aadhaar / phone / email."""
    return sanitize_state(
        {
            "doc_type": doc_type,
            "name_match": bool(name_match),
            "dob_match": bool(dob_match),
            "doc_age_days": int(doc_age_days or 0),
            "image_quality_ok": bool(image_quality_ok),
            "extracted_field_count": int(extracted_field_count or 0),
        }
    )


def _month_index(month: str) -> int | None:
    try:
        year, mon = str(month).split("-")[:2]
        return int(year) * 12 + int(mon)
    except (TypeError, ValueError):
        return None


def _trailing_savings_streak(months: list[str]) -> int:
    """Consecutive deposit months ending at the latest recorded month."""
    indexes = sorted({idx for idx in (_month_index(m) for m in months) if idx is not None})
    if not indexes:
        return 0
    now = datetime.now(timezone.utc)
    current = now.year * 12 + now.month
    # Ignore a stale ledger whose latest entry is older than last month.
    if indexes[-1] < current - 1:
        return 0
    streak = 1
    for previous, following in zip(reversed(indexes[:-1]), reversed(indexes)):
        if following - previous == 1:
            streak += 1
        else:
            break
    return streak


def _days_since(raw, now: datetime) -> int:
    if not raw:
        return 0
    try:
        stamp = datetime.fromisoformat(str(raw))
        if stamp.tzinfo is None:
            stamp = stamp.replace(tzinfo=timezone.utc)
    except ValueError:
        return 0
    return max(0, (now - stamp).days)


async def build_shg_readiness_state(shg_id: str) -> dict:
    """M26 state builder: real SHG ledger signals only — savings regularity,
    meeting attendance rate, enterprise-income trend, record-keeping. The SHG id
    is HMAC-hashed; no member names / phones / emails (rule 11), ≤1500 tokens."""
    group = await get_doc("shg_groups", str(shg_id)) or {}
    deposits = await query(f"shg_groups/{shg_id}/deposits", [], limit=1000)
    meetings = await query("shg_meetings", [("groupId", "==", str(shg_id))], limit=1000)
    member_uid = str(group.get("memberUid") or "")
    enterprises = (
        await query("home_enterprises", [("ownerUid", "==", member_uid)], limit=200)
        if member_uid
        else []
    )

    savings_streak = _trailing_savings_streak(
        [str(d.get("month") or "") for d in deposits if d.get("month")]
    )
    total_marked = present = 0
    for meeting in meetings:
        attendance = meeting.get("attendance") or []
        total_marked += len(attendance)
        present += sum(1 for a in attendance if isinstance(a, dict) and a.get("present"))
    attendance_rate = round(present / total_marked, 3) if total_marked else 0.0

    cutoff = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
    income_entries = sum(
        1 for e in enterprises if str(e.get("createdAt") or "") >= cutoff
    )

    return sanitize_state(
        {
            "shgHash": hash_user_id(str(shg_id)),
            "savings_regularity": round(min(1.0, savings_streak / 12.0), 2),
            "meeting_attendance_rate": attendance_rate,
            "enterprise_income_trend": round(min(1.0, income_entries / 6.0), 2),
            "savings_streak_months": savings_streak,
            "enterprise_income_entries_90d": income_entries,
            "record_keeping": bool(deposits) and bool(meetings),
        }
    )


async def build_churn_state(user_id: str, now: datetime | None = None) -> dict:
    """M28 state builder: activity recency + re-engagement hints only, with the
    user id HMAC-hashed (no phone/email), ≤1500 tokens."""
    now = now or datetime.now(timezone.utc)
    user = await get_doc("users", str(user_id)) or {}
    last_active = (
        user.get("lastActiveAt")
        or user.get("lastSeenAt")
        or user.get("lastLoginAt")
        or user.get("createdAt")
    )
    offers = await query("offers", [("toId", "==", str(user_id))], limit=50)
    pending_offer = any(o.get("status") == "pending" for o in offers)

    return sanitize_state(
        {
            "user_pseudo_id": hash_user_id(str(user_id)),
            "inactivity_days": _days_since(last_active, now),
            "pending_offer": pending_offer,
            "mandi_price_move": bool(user.get("priceAlertActive")),
            "new_scheme": False,
            "language": str(user.get("language") or "en"),
        }
    )


async def build_agent_rule_match_state(
    user_id: str, module: str, event: dict, rules: list[dict] | None = None
) -> dict:
    """M29 state builder: the user's active rules for a module (id + parsed
    condition only) and the event payload. The user id is HMAC-hashed and no
    personal identifiers enter the payload (rule 11), ≤1500 tokens."""
    if rules is None:
        rules = await query(
            "agent_rules",
            [
                ("userHash", "==", hash_user_id(str(user_id))),
                ("module", "==", module),
                ("active", "==", True),
            ],
            limit=50,
        )
    clean_rules = [
        {"ruleId": r.get("ruleId") or r.get("id"), "condition": r.get("condition") or {}}
        for r in rules
        if isinstance(r, dict)
    ]
    clean_event = {
        str(key): value
        for key, value in (event or {}).items()
        if key not in ("phone", "email", "aadhaar", "name")
    }
    return sanitize_state(
        {
            "user_pseudo_id": hash_user_id(str(user_id)),
            "module": module,
            "event": clean_event,
            "rules": clean_rules,
        }
    )
