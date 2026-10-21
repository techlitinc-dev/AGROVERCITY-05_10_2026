"""Deterministic sourcing recommendations for the Vyapari hub.

Ranks OPEN market lots for fit against the seller's business profile — no AI,
no randomness, recency as the final tiebreak:

  +3  lot state is in the seller's operatingStates
  +2  lot village/mandi is in the seller's mandis
  +2  the lot's crop appears in the seller's purchase history
      (seller_procurement subcollection or purchases as buyer)
  +1  the lot carries coordinates (enables distance sorting)

Lots are returned matchScore desc, then distance asc (unknown distance last),
then createdAt desc. An empty profile still returns lots (recency order, no
reason strings).
"""
import math
from typing import Any

from app.core.db import get_doc, query
from app.services.users import get_user

EARTH_RADIUS_KM = 6371.0


STATE_ALIASES = {
    "mh": "maharashtra", "maharashtra": "mh",
    "gj": "gujarat", "gujarat": "gj",
    "ka": "karnataka", "karnataka": "ka",
    "mp": "madhya pradesh", "madhya pradesh": "mp",
    "up": "uttar pradesh", "uttar pradesh": "up",
    "pb": "punjab", "punjab": "pb",
    "rj": "rajasthan", "rajasthan": "rj",
    "ap": "andhra pradesh", "andhra pradesh": "ap",
    "ts": "telangana", "telangana": "ts",
    "tn": "tamil nadu", "tamil nadu": "tn",
    "kl": "kerala", "kerala": "kl",
    "hr": "haryana", "haryana": "hr",
    "wb": "west bengal", "west bengal": "wb",
    "br": "bihar", "bihar": "br",
}


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def _seller_origin(user: dict) -> tuple[float, float] | None:
    lat = user.get("lat")
    lng = user.get("lng")
    if lat is None or lng is None:
        location = user.get("location") or {}
        if isinstance(location, dict):
            lat = location.get("lat")
            lng = location.get("lng")
    if lat is None or lng is None:
        return None
    try:
        return float(lat), float(lng)
    except (TypeError, ValueError):
        return None


async def _purchase_crops(uid: str) -> set[str]:
    crops: set[str] = set()
    procurement = await query(f"users/{uid}/seller_procurement", [], limit=1000)
    for doc in procurement:
        crop = (doc.get("crop") or "").strip().lower()
        if crop:
            crops.add(crop)
    purchases = await query("purchases", [("buyerId", "==", uid)], limit=2000)
    for doc in purchases:
        crop = (doc.get("crop") or "").strip().lower()
        if crop:
            crops.add(crop)
    return crops


def _lot_state(lot: dict) -> str:
    state = lot.get("state")
    if not state and isinstance(lot.get("location"), dict):
        state = lot["location"].get("state")
    return (state or "").strip()


async def recommend_lots(seller: dict, uid: str, limit: int = 20) -> list[dict[str, Any]]:
    profile = seller.get("roleProfile") or {}
    # Fall back to the raw role_profiles doc when the caller has no merged copy.
    if not profile:
        profile = (await get_doc(f"users/{uid}/role_profiles", "seller")) or {}

    operating_states = {s.strip().lower() for s in (profile.get("operatingStates") or []) if s and s.strip()}
    expanded_states = set(operating_states)
    for s in operating_states:
        alias = STATE_ALIASES.get(s)
        if alias:
            expanded_states.add(alias)
    mandis = {m.strip().lower() for m in (profile.get("mandis") or []) if m and m.strip()}
    bought_crops = await _purchase_crops(uid)
    origin = _seller_origin(seller)

    lots = await query("market_lots", [("status", "==", "open")], limit=2000)
    lots = [l for l in lots if l.get("farmerId") != uid]

    scored: list[dict[str, Any]] = []
    for lot in lots:
        score = 0
        reasons: list[str] = []
        farmer = await get_user(lot.get("farmerId") or "") or {}

        state = _lot_state(lot)
        if state and (state.lower() in expanded_states or any(st in state.lower() or state.lower() in st for st in expanded_states)):
            score += 3
            reasons.append(f"in your operating state {state}")

        village = (lot.get("village") or "").strip()
        mandi = (lot.get("mandi") or "").strip()
        district = (lot.get("district") or "").strip()
        f_village = (farmer.get("village") or "").strip()
        f_district = (farmer.get("district") or "").strip()
        f_mandi = (farmer.get("mandi") or "").strip()
        haystacks = [h.lower() for h in (village, mandi, district, f_village, f_district, f_mandi) if h]
        matched_mandi = next((m for m in mandis if any(m in h or h in m for h in haystacks)), None)
        if matched_mandi:
            score += 2
            reasons.append(f"near your mandi {matched_mandi}")

        crop = (lot.get("crop") or "").strip()
        if crop.lower() in bought_crops:
            score += 2
            reasons.append(f"you traded {crop} before")

        lat, lng = lot.get("lat"), lot.get("lng")
        distance_km = None
        if lat is not None and lng is not None and origin is not None:
            score += 1
            distance_km = round(haversine_km(origin[0], origin[1], float(lat), float(lng)), 2)

        rate = int(round(float(lot.get("expectedRate") or lot.get("expectedPricePerQuintal") or 0) * 100))
        scored.append(
            {
                "lotId": lot.get("id"),
                "farmerName": farmer.get("name") or "",
                "crop": crop,
                "variety": lot.get("variety"),
                "quantityQt": lot.get("quantityQuintals") or lot.get("quantityQuintal") or 0,
                "pricePaisa": rate,
                "state": state,
                "village": village,
                "lat": lat,
                "lng": lng,
                "distanceKm": distance_km,
                "matchScore": score,
                "reasons": reasons,
                "_createdAt": lot.get("createdAt") or "",
                "_distance": distance_km if distance_km is not None else float("inf"),
            }
        )

    # Stable sorts compose: recency first, then distance asc (unknown last),
    # then matchScore desc — the final order is score → distance → recency.
    scored.sort(key=lambda item: item["_createdAt"], reverse=True)
    scored.sort(key=lambda item: item["_distance"])
    scored.sort(key=lambda item: -item["matchScore"])

    items = []
    for item in scored[:limit]:
        item.pop("_createdAt", None)
        item.pop("_distance", None)
        items.append(item)
    return items
