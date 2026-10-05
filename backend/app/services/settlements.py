from datetime import datetime, timezone

from app.core.db import get_doc, query, set_doc
from app.services.payments import create_razorpayx_payout

DEFAULT_CONFIG = {
    "transportPct": 10,
    "equipmentRentalPct": 12,
    "brokerPct": 2,
    # WS-03 step 8: vyapari commission 2% min ₹50 (effective-dated, versioned —
    # admin edits go through maker-checker, the services only consume).
    "sellerPct": 2,
    "sellerMinRupees": 50,
    # WS-02 step 10: direct-buyer settlement commission 1–2% (effective-dated,
    # versioned — admin edits go through maker-checker, the services consume).
    "directBuyerPct": 2,
    "version": 1,
    "effectiveFrom": "2026-10-01T00:00:00+00:00",
}
PCT_KEYS = {"transport": "transportPct", "equipmentRental": "equipmentRentalPct", "broker": "brokerPct"}

# TDS 194-O on marketplace gross (integer paisa everywhere in the ledger).
TDS_194O_RATE = 0.01
GST_RATE = 0.18


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
        if role == "broker":
            # WS-05 step 11: brokerPct stays configurable 0-10 (effective-dated,
            # maker-checker); commission stacks with the subscription tier.
            pct = min(10, max(0, int(pct)))
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
            # WS-03: TDS 194-O ledger + GST commission invoice (integer paisa).
            gross_paisa = gross * 100
            tds_paisa = int(round(gross_paisa * TDS_194O_RATE))
            await set_doc(
                "tds_ledger",
                f"tds_{doc_id}",
                {
                    "txnId": doc_id,
                    "persona": role,
                    "entityId": entity_id,
                    "grossPaisa": gross_paisa,
                    "tdsPaisa": tds_paisa,
                    "section": "194-O",
                    "period": f"{period_start}..{period_end}",
                    "at": now,
                },
            )
            commission_paisa = commission * 100
            gst_paisa = int(round(commission_paisa * GST_RATE))
            await set_doc(
                "invoices",
                f"inv_{doc_id}",
                {
                    "id": f"inv_{doc_id}",
                    "kind": "commission",
                    "persona": role,
                    "userId": entity_id,
                    "periodStart": period_start,
                    "periodEnd": period_end,
                    "grossPaisa": gross_paisa,
                    "commissionPaisa": commission_paisa,
                    "gstPaisa": gst_paisa,
                    "totalPaisa": commission_paisa + gst_paisa,
                    "issuedAt": now,
                },
            )
            if existing is None:
                created += 1
            else:
                updated += 1
    return {"created": created, "updated": updated}


async def process_payouts(period_start: str, period_end: str) -> dict:
    """Weekly payout pass: pending settlements move real money to the
    beneficiary's verified bank account; beneficiaries without one are put
    `onHold` with a reason."""
    settlements = await query("settlements", [], limit=2000)
    now = datetime.now(timezone.utc).isoformat()
    paid = on_hold = 0
    for settlement in settlements:
        if settlement.get("periodStart") != period_start or settlement.get("status") != "pending":
            continue
        accounts = await query(f"users/{settlement['entityId']}/bank_accounts", [], limit=50)
        verified = [a for a in accounts if a.get("verifyStatus") == "verified"]
        if not verified:
            settlement["payoutStatus"] = "onHold"
            settlement["payoutHoldReason"] = "no verified bank account"
            await set_doc("settlements", settlement["id"], settlement)
            on_hold += 1
            continue
        account = sorted(
            verified, key=lambda a: (not a.get("isPrimary", False), a.get("createdAt", ""))
        )[0]
        payout = await create_razorpayx_payout(
            account.get("razorpayFundAccountId") or account["id"],
            int(settlement["netRupees"]) * 100,
            f"settle_{settlement['id']}",
        )
        settlement["status"] = "paid"
        settlement["payoutStatus"] = "paid"
        settlement["payoutRef"] = payout.get("id")
        settlement["paidAt"] = now
        await set_doc("settlements", settlement["id"], settlement)
        # Rule 3: every financial mutation writes an audit_logs entry.
        await set_doc(
            "audit_logs",
            f"aud_payout_{settlement['id']}_{now[:19]}",
            {
                "action": "SETTLEMENT_PAYOUT",
                "entityId": settlement["entityId"],
                "role": settlement.get("role"),
                "settlementId": settlement["id"],
                "amountPaisa": int(settlement["netRupees"]) * 100,
                "payoutRef": payout.get("id"),
                "periodStart": period_start,
                "periodEnd": period_end,
                "at": now,
            },
        )
        paid += 1
    return {"paid": paid, "onHold": on_hold, "periodStart": period_start, "periodEnd": period_end}
