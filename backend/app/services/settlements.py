from datetime import datetime, timezone

from app.core.db import get_doc, query, set_doc

DEFAULT_CONFIG = {"transportPct": 10, "equipmentRentalPct": 12, "brokerPct": 2}
PCT_KEYS = {"transport": "transportPct", "equipmentRental": "equipmentRentalPct", "broker": "brokerPct"}


async def _config() -> dict:
    config = await get_doc("platform_config", "settlements")
    if config is None:
        config = dict(DEFAULT_CONFIG)
        await set_doc("platform_config", "settlements", config)
    return config


def _in_period(date_str: str | None, period_start: str, period_end: str) -> bool:
    day = (date_str or "")[:10]
    return bool(day) and period_start <= day <= period_end


async def run_settlements(period_start: str, period_end: str) -> dict:
    config = await _config()
    # role -> entityId -> {gross, sourceIds}
    totals: dict[str, dict[str, dict]] = {role: {} for role in PCT_KEYS}

    bookings = await query("transport_bookings", [("status", "==", "delivered")], limit=1000)
    for booking in bookings:
        if not _in_period(booking.get("date"), period_start, period_end):
            continue
        vehicle = await get_doc("vehicles", booking.get("vehicleId") or "")
        if vehicle is None:
            continue
        bucket = totals["transport"].setdefault(vehicle["ownerId"], {"gross": 0, "sourceIds": []})
        bucket["gross"] += int(booking.get("fare", 0))
        bucket["sourceIds"].append(booking["id"])

    bookings = await query("equipment_bookings", [("status", "==", "completed")], limit=1000)
    for booking in bookings:
        if not _in_period(booking.get("date"), period_start, period_end):
            continue
        equipment = await get_doc("equipment", booking.get("equipmentId") or "")
        if equipment is None:
            continue
        bucket = totals["equipmentRental"].setdefault(
            equipment["ownerId"], {"gross": 0, "sourceIds": []}
        )
        bucket["gross"] += int(booking.get("priceRupees", 0))
        bucket["sourceIds"].append(booking["id"])

    # completed broker deals: gross flows into the broker's settlement
    deals = await query("broker_deals", [("status", "==", "completed")], limit=1000)
    for deal in deals:
        if not _in_period(deal.get("date") or deal.get("createdAt"), period_start, period_end):
            continue
        broker_id = deal.get("brokerId")
        if not broker_id:
            continue
        bucket = totals["broker"].setdefault(broker_id, {"gross": 0, "sourceIds": []})
        bucket["gross"] += int(deal.get("grossAmount") or 0)
        bucket["sourceIds"].append(deal["id"])

    created = updated = 0
    now = datetime.now(timezone.utc).isoformat()
    for role, entities in totals.items():
        pct = config[PCT_KEYS[role]]
        for entity_id, bucket in entities.items():
            doc_id = f"st_{role}_{entity_id[:8]}_{period_start}"
            existing = await get_doc("settlements", doc_id)
            if existing is not None and existing.get("status") != "pending":
                continue
            gross = int(bucket["gross"])
            commission = int(round(gross * pct / 100))
            doc = {
                "id": doc_id,
                "role": role,
                "entityId": entity_id,
                "periodStart": period_start,
                "periodEnd": period_end,
                "grossRupees": gross,
                "commissionRupees": commission,
                "netRupees": gross - commission,
                "status": "pending",
                "sourceIds": bucket["sourceIds"],
                "createdAt": existing["createdAt"] if existing else now,
            }
            await set_doc("settlements", doc_id, doc)
            if existing is None:
                created += 1
            else:
                updated += 1
    return {"created": created, "updated": updated}
