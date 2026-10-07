"""Smart-mandi selection math + AI state builder (phase-05 WS-01, brief M12 / SDR).

Money is integer paisa everywhere and every financial result is computed with
plain integer arithmetic — no floats. The deterministic net-after-transport
ranking defined here is both the fallback when the model is off/failed AND the
truth the AI ranking is checked against (golden fixture
`backend/tests/fixtures/ai/golden/mandi.smart_select.v1.jsonl`).
"""
from app.services.ai.privacy import sanitize_state

# Bound the payload well inside the 1,500-token privacy budget.
MAX_CANDIDATE_MANDIS = 12

# Keys never allowed to reach a model provider (rule 11).
_PII_KEYS = ("phone", "email", "aadhaar", "name", "farmerName", "ownerName", "farmerPhone")


def _as_int(value, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _as_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def net_after_transport_paisa(
    modal_price_paisa: int,
    qty,
    transport_fare_paisa: int,
    commission_paisa: int,
) -> int:
    """Net realisation at a mandi: modal × qty − transport − commission.

    Every argument and the return value are integer paisa; quantity is a whole
    number of quintals. Reinforces the card line:
        mandi price − transport − commission = net
    """
    return (
        _as_int(modal_price_paisa) * _as_int(qty)
        - _as_int(transport_fare_paisa)
        - _as_int(commission_paisa)
    )


def _vehicle_for_qty(qty_quintals: int) -> dict:
    """Smallest core vehicle whose capacity covers the lot (1 quintal = 0.1 t)."""
    # Local import keeps services free of a router import cycle at module load.
    from app.routers.transport import CORE_VEHICLE_TYPES

    qty = max(0, _as_int(qty_quintals))
    for vehicle in CORE_VEHICLE_TYPES:
        if _as_int(vehicle["capacityTonnes"] * 10) >= qty:
            return vehicle
    return CORE_VEHICLE_TYPES[-1]


def transport_fare_estimate_paisa(distance_km, qty_quintals) -> int:
    """Transport fare estimate in integer paisa.

    Mirrors `POST /v1/transport/fare-estimate` (baseFare + perKmRate × distanceKm
    from the transport module's core rate card, quoted in rupees) and converts
    once to paisa. Surge is a transporter-side lever and is deliberately NOT
    applied here.
    """
    vehicle = _vehicle_for_qty(qty_quintals)
    distance = _as_float(distance_km)
    rupees = vehicle["baseFare"] + vehicle["perKmRate"] * distance
    return int(round(rupees * 100))


def _rupees_to_paisa(value) -> int:
    """mandi_prices stores modal prices in rupees/quintal — convert once."""
    return int(round(_as_float(value) * 100))


def build_smart_select_state(
    lot: dict,
    farmer_location: dict,
    candidate_mandis: list[dict],
) -> dict:
    """Build the ≤1,500-token SDR state payload for `mandi.smart_select.v1`.

    Shape: {crop, qty_quintals, district, farmer_location, candidates:[{mandi,
    modal_price_paisa, distance_km, transport_fare_paisa, commission_paisa,
    net_paisa}], net_ranking}. Candidate mandis carry a modal price (paisa or
    rupees), a distance, an optional pre-computed fare/commission, and the
    transport fare falls back to the transport module's own estimate. The whole
    payload is passed through `services/ai/privacy.py` scrubbing, so no phone /
    email / unmasked Aadhaar ever leaves (rule 11).
    """
    lot = dict(lot or {})
    location = dict(farmer_location or {})
    for key in _PII_KEYS:
        location.pop(key, None)

    qty = _as_int(
        lot.get("quantity_quintals") or lot.get("quantityQuintals") or lot.get("qty")
    )
    crop = str(lot.get("crop") or "")
    district = str(lot.get("district") or location.get("district") or "")

    candidates: list[dict] = []
    for candidate in (candidate_mandis or [])[:MAX_CANDIDATE_MANDIS]:
        if not isinstance(candidate, dict):
            continue
        name = str(
            candidate.get("mandi") or candidate.get("mandiName") or candidate.get("name") or ""
        )
        if not name:
            continue
        modal_paisa = candidate.get("modal_price_paisa")
        if modal_paisa is None:
            modal_paisa = _rupees_to_paisa(candidate.get("modalPrice"))
        distance = _as_float(candidate.get("distance_km") or candidate.get("distanceKm"))
        fare = candidate.get("transport_fare_paisa")
        if fare is None:
            fare = transport_fare_estimate_paisa(distance, qty)
        commission = _as_int(
            candidate.get("commission_paisa") or candidate.get("commissionPaisa")
        )
        candidates.append(
            {
                "mandi": name,
                "modal_price_paisa": _as_int(modal_paisa),
                "distance_km": distance,
                "transport_fare_paisa": _as_int(fare),
                "commission_paisa": commission,
                "net_paisa": net_after_transport_paisa(modal_paisa, qty, fare, commission),
            }
        )

    candidates.sort(key=lambda item: (-item["net_paisa"], item["mandi"].lower()))

    state = {
        "crop": crop,
        "qty_quintals": qty,
        "district": district,
        "farmer_location": {
            key: location[key]
            for key in ("district", "state", "village")
            if location.get(key) is not None
        },
        "candidates": candidates,
        "net_ranking": [item["mandi"] for item in candidates],
    }
    return sanitize_state(state)
