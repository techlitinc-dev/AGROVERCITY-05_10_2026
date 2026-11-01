"""Farmer ⇄ Industrial Buyer sourcing workflow (one-time + recurring).

Covers the spec's backend test matrix: requirement CRUD with validation,
discovery without private-contact leakage, deterministic crop matching +
audience isolation, applications (partial/multi-farmer rules, lot prefill
ownership, recurring answers), buyer-side contact unlock (KYC + terms + MPIN,
role + ownership + eligibility), idempotency, single chat room, no
transaction-object creation, user-reported outcomes, requirement duplication,
pause/fulfil, distinct verification badges, and lead-connection ratings.
"""
from app.core.security import hash_mpin
from tests.test_demands_offers import _create_demand
from tests.test_direct_buyer import _register_buyer, _seed_user
from tests.test_lots import LOT_BODY
from tests.test_users import _auth, _register

FUTURE = "2026-12-15"

ONE_TIME_BODY = {
    "crop": "Soybean",
    "variety": "JS-335",
    "quantity": 100,
    "unit": "quintal",
    "qualityGrade": "A",
    "maxPrice": 4800,
    "deliveryLocation": "Nashik APMC Yard",
    "neededBy": "2026-12-31",
    "partialAllowed": True,
    "multipleFarmersAllowed": True,
}

RECURRING_BODY = {
    "crop": "Wheat",
    "quantity": 500,
    "unit": "quintal",
    "supplyType": "recurring",
    "frequency": "weekly",
    "quantityPerDelivery": 25,
    "startDate": "2026-11-10",
    "endDate": "2027-05-31",
    "deliveryLocation": "Nashik APMC Yard",
    "targetPrice": 2400,
    "targetUnit": "quintal",
    "partialAllowed": True,
    "multipleFarmersAllowed": True,
}

APPLY_BODY = {
    "pricePerUnit": 4500,
    "quantity": 40,
    "supplyBasis": "farmGate",
    "availableDate": "2026-12-01",
    "termsAccepted": True,
    "mpin": "1234",
}


async def _buyer(client, **demand_overrides):
    token = (await _register_buyer(client)).json()["accessToken"]
    demand = (await _create_demand(client, token, **demand_overrides)).json()
    return token, demand


def _farmer(user_store, uid="uid-f1", name="Ram Patel", mpin="1234", **extra):
    seeded = {"mpinHash": hash_mpin(mpin)} if mpin else {}
    seeded.update(extra)
    return _seed_user(user_store, uid, name, **seeded)


async def _apply(client, demand_id, farmer_token, **overrides):
    return await client.post(
        "/v1/leads",
        json={"demandId": demand_id, **APPLY_BODY, **overrides},
        headers=_auth(farmer_token),
    )


# ------------------------------------------------------------ requirements


async def test_industrial_buyer_creates_one_time_requirement(client):
    token = (await _register_buyer(client)).json()["accessToken"]
    resp = await _create_demand(client, token, **ONE_TIME_BODY)
    assert resp.status_code == 201
    body = resp.json()
    assert body["supplyType"] == "oneTime"
    assert body["audience"] == "industrialBuyer"
    assert body["status"] == "open"
    assert body["partialAllowed"] is True
    assert body["multipleFarmersAllowed"] is True
    assert body["applicationsCount"] == 0


async def test_industrial_buyer_creates_recurring_requirement(client):
    token = (await _register_buyer(client)).json()["accessToken"]
    resp = await _create_demand(client, token, **RECURRING_BODY)
    assert resp.status_code == 201
    body = resp.json()
    assert body["supplyType"] == "recurring"
    assert body["frequency"] == "weekly"
    assert body["quantityPerDelivery"] == 25
    assert body["startDate"] == "2026-11-10"
    assert body["endDate"] == "2027-05-31"
    assert body["targetPrice"] == 2400
    assert body["targetUnit"] == "quintal"


async def test_invalid_recurring_schedule_rejected(client):
    token = (await _register_buyer(client)).json()["accessToken"]
    base = {**RECURRING_BODY}
    for overrides, code in [
        ({"quantityPerDelivery": None}, "INVALID_RECURRING_SCHEDULE"),
        ({"startDate": ""}, "INVALID_RECURRING_SCHEDULE"),
        ({"frequency": "oneTime"}, "INVALID_RECURRING_SCHEDULE"),
        ({"startDate": "2026-01-01"}, "VALIDATION_ERROR"),
        ({"endDate": "2026-11-09"}, "INVALID_DATE_RANGE"),
    ]:
        body = {k: v for k, v in {**base, **overrides}.items() if v is not None}
        resp = await _create_demand(client, token, **body)
        assert resp.status_code == 422, (overrides, resp.text)
        assert resp.json()["error"]["code"] == code, overrides


async def test_draft_skips_schedule_validation_and_publishes_later(client):
    token = (await _register_buyer(client)).json()["accessToken"]
    draft = await _create_demand(
        client,
        token,
        crop="Maize",
        quantity=50,
        deliveryLocation="",
        status="draft",
    )
    assert draft.status_code == 201
    assert draft.json()["status"] == "draft"

    bad_publish = await client.put(
        f"/v1/demands/{draft.json()['id']}",
        json={"status": "open"},
        headers=_auth(token),
    )
    assert bad_publish.status_code == 422  # delivery location still required

    ok = await client.put(
        f"/v1/demands/{draft.json()['id']}",
        json={"status": "open", "deliveryLocation": "Nashik APMC"},
        headers=_auth(token),
    )
    assert ok.status_code == 200
    assert ok.json()["status"] == "open"


async def test_duplicate_requirement_copies_fields_only(client, user_store):
    token, demand = await _buyer(client, **ONE_TIME_BODY)
    farmer_token = _farmer(user_store)
    await _apply(client, demand["id"], farmer_token)
    await client.post(f"/v1/demands/{demand['id']}/close", headers=_auth(token))

    dup = await client.post(f"/v1/demands/{demand['id']}/duplicate", headers=_auth(token))
    assert dup.status_code == 201
    copy = dup.json()
    assert copy["id"] != demand["id"]
    assert copy["status"] == "draft"
    assert copy["crop"] == demand["crop"]
    assert copy["variety"] == demand["variety"]
    assert copy["quantity"] == demand["quantity"]
    assert copy["supplyType"] == "oneTime"
    assert copy["neededBy"] == demand["neededBy"]
    assert copy["applicationsCount"] == 0
    assert copy["offersCount"] == 0
    # Statuses/outcomes of the source never leak into the copy.
    assert "contactRevealedAt" not in copy
    leads = [k for k in user_store if k.startswith("leads/")]
    assert len(leads) == 1


async def test_pause_resume_fulfil_requirement(client, user_store):
    token, demand = await _buyer(client, **ONE_TIME_BODY)
    farmer_token = _farmer(user_store)
    await _apply(client, demand["id"], farmer_token)

    paused = await client.post(f"/v1/demands/{demand['id']}/pause", headers=_auth(token))
    assert paused.status_code == 200
    assert paused.json()["status"] == "paused"
    blocked = await _apply(client, demand["id"], _farmer(user_store, uid="uid-f2", name="Sham Rao"))
    assert blocked.status_code == 409
    notifs = [v for k, v in user_store.items() if k.startswith("notifications/")]
    assert any(n.get("type") == "demand_paused" for n in notifs)

    resumed = await client.post(f"/v1/demands/{demand['id']}/resume", headers=_auth(token))
    assert resumed.json()["status"] == "open"

    fulfilled = await client.post(f"/v1/demands/{demand['id']}/fulfil", headers=_auth(token))
    assert fulfilled.status_code == 200
    assert fulfilled.json()["status"] == "fulfilled"
    blocked2 = await _apply(client, demand["id"], _farmer(user_store, uid="uid-f3", name="Kisan Yadav"))
    assert blocked2.status_code == 409
    notifs = [v for k, v in user_store.items() if k.startswith("notifications/")]
    assert any(n.get("type") == "demand_fulfilled" for n in notifs)
    # Fulfilment is idempotent.
    again = await client.post(f"/v1/demands/{demand['id']}/fulfil", headers=_auth(token))
    assert again.status_code == 200


# ------------------------------------------------------------ discovery


async def test_farmer_discovery_never_exposes_private_contacts(client, user_store):
    token, demand = await _buyer(client, **ONE_TIME_BODY)
    farmer_token = _farmer(user_store)

    browse = await client.get("/v1/demands/browse", headers=_auth(farmer_token))
    row = next(d for d in browse.json()["data"] if d["id"] == demand["id"])
    for banned in ("phone", "whatsapp", "phoneDigits", "whatsappDigits", "buyerContact", "kyc", "aadhaar"):
        assert row.get(banned) is None, banned
    summary = row["buyerSummary"]
    assert "identityVerified" in summary and "businessVerified" in summary

    detail = await client.get(f"/v1/demands/{demand['id']}", headers=_auth(farmer_token))
    for banned in ("phone", "whatsapp", "buyerContact"):
        assert detail.json().get(banned) is None, banned


async def test_matches_your_crops_and_audience_isolation(client, user_store):
    buyer_token = (await _register_buyer(client)).json()["accessToken"]
    seller_token = _seed_user(user_store, "uid-s1", "Vijay Vyapari", active="seller")
    await _create_demand(client, buyer_token, **{**ONE_TIME_BODY, "crop": "Soybean"})
    await _create_demand(client, buyer_token, **{**ONE_TIME_BODY, "crop": "Onion"})
    await _create_demand(client, seller_token, crop="Tomato", quantity=30, deliveryLocation="Pune APMC")

    farmer_token = _farmer(user_store, activeCrops=["Soybean"])
    matches = await client.get("/v1/demands/matches", headers=_auth(farmer_token))
    assert matches.status_code == 200
    crops = {d["crop"] for d in matches.json()["data"]}
    assert crops == {"Soybean"}
    assert matches.json()["data"][0]["match"]["cropMatch"] is True

    # Farmers can still browse the full open feed (all audiences).
    browse = await client.get("/v1/demands/browse", headers=_auth(farmer_token))
    assert browse.json()["total"] == 3
    # The industrial audience filter keeps vyapari posts out of buyer feeds.
    scoped = await client.get(
        "/v1/demands/browse", params={"audience": "industrialBuyer"}, headers=_auth(farmer_token)
    )
    assert scoped.json()["total"] == 2


async def test_discovery_filters(client, user_store):
    buyer_token = (await _register_buyer(client)).json()["accessToken"]
    await _create_demand(client, buyer_token, **{**ONE_TIME_BODY, "crop": "Soybean", "quantity": 100})
    await _create_demand(
        client, buyer_token, **{**RECURRING_BODY, "crop": "Wheat", "district": "Nashik"}
    )
    farmer_token = _farmer(user_store)

    by_type = await client.get("/v1/demands/browse", params={"supplyType": "recurring"}, headers=_auth(farmer_token))
    assert {d["crop"] for d in by_type.json()["data"]} == {"Wheat"}

    by_qty = await client.get(
        "/v1/demands/browse", params={"quantityMin": 200, "quantityMax": 600}, headers=_auth(farmer_token)
    )
    assert {d["crop"] for d in by_qty.json()["data"]} == {"Wheat"}

    by_district = await client.get("/v1/demands/browse", params={"district": "nashik"}, headers=_auth(farmer_token))
    assert {d["crop"] for d in by_district.json()["data"]} == {"Wheat"}

    by_date = await client.get(
        "/v1/demands/browse", params={"supplyDate": "2026-12-01"}, headers=_auth(farmer_token)
    )
    # Wheat recurring starts 2026-11-10 (covers Dec 1); Soybean neededBy 2026-12-31.
    assert {d["crop"] for d in by_date.json()["data"]} == {"Soybean", "Wheat"}


# ------------------------------------------------------------ applications


async def test_farmer_valid_application_with_full_fields(client, user_store):
    token, demand = await _buyer(client, **ONE_TIME_BODY)
    farmer_token = _farmer(user_store)
    resp = await _apply(
        client,
        demand["id"],
        farmer_token,
        qualityDetails="Grade A, machine cleaned",
        packagingCapability="50kg gunny bags",
        certifications=["NPOP"],
        message="Ready for sampling",
    )
    assert resp.status_code == 201
    lead = resp.json()["lead"]
    assert lead["status"] == "submitted"
    assert lead["supplyBasis"] == "farmGate"
    assert lead["availableDate"] == "2026-12-01"
    assert lead["unit"] == "quintal"
    assert lead["qualityDetails"] == "Grade A, machine cleaned"
    assert lead["packagingCapability"] == "50kg gunny bags"
    assert lead["certifications"] == ["NPOP"]
    assert lead["farmerContact"] is None and lead["buyerContact"] is None


async def test_partial_quantity_and_multi_farmer_rules(client, user_store):
    token, demand = await _buyer(client, **{**ONE_TIME_BODY, "partialAllowed": False})
    farmer_token = _farmer(user_store)
    partial = await _apply(client, demand["id"], farmer_token, quantity=40)
    assert partial.status_code == 422
    assert partial.json()["error"]["code"] == "PARTIAL_NOT_ALLOWED"

    full = await _apply(client, demand["id"], farmer_token, quantity=100)
    assert full.status_code == 201
    # Multi-farmer: another farmer can still apply to the same requirement.
    other = await _apply(
        client, demand["id"], _farmer(user_store, uid="uid-f2", name="Sham Rao"), quantity=100
    )
    assert other.status_code == 201


async def test_invalid_application_fields_rejected(client, user_store):
    token, demand = await _buyer(client, **ONE_TIME_BODY)
    farmer_token = _farmer(user_store)
    cases = [
        ({"availableDate": ""}, 422),
        ({"availableDate": "2026-01-01"}, 422),
        ({"availableDate": "not-a-date"}, 422),
        ({"supplyBasis": "hovercraft"}, 422),
        ({"pricePerUnit": 0}, 422),
        ({"quantity": 0}, 422),
        ({"termsAccepted": False}, 422),
    ]
    for overrides, status in cases:
        resp = await _apply(client, demand["id"], farmer_token, **overrides)
        assert resp.status_code == status, (overrides, resp.text)


async def test_source_lot_ownership_and_prefill(client, user_store):
    token, demand = await _buyer(client, **ONE_TIME_BODY)
    farmer_token = _farmer(user_store)
    other_token = _farmer(user_store, uid="uid-f2", name="Sham Rao", mpin=None)
    lot_resp = await client.post("/v1/market/lots", json={**LOT_BODY, "crop": "Soybean"}, headers=_auth(farmer_token))
    lot = lot_resp.json()
    assert lot["status"] == "open"

    stolen = await _apply(client, demand["id"], other_token, sourceLotId=lot["id"])
    assert stolen.status_code == 403
    assert stolen.json()["error"]["code"] == "NOT_YOUR_LOT"

    ok = await _apply(client, demand["id"], farmer_token, sourceLotId=lot["id"], photos=[])
    assert ok.status_code == 201
    lead = ok.json()["lead"]
    assert lead["sourceLotId"] == lot["id"]
    assert lead["sourceLot"]["crop"] == "Soybean"
    assert lead["sourceLot"]["quantityQuintals"] == lot["quantityQuintals"]
    # Photos fell back to the lot's photos (client sent none).
    assert lead["photos"] == (lot.get("photos") or [])


async def test_recurring_supply_answer_required(client, user_store):
    token, demand = await _buyer(client, **RECURRING_BODY)
    farmer_token = _farmer(user_store)
    missing = await _apply(client, demand["id"], farmer_token, canRecur=None)
    assert missing.status_code == 422
    assert missing.json()["error"]["code"] == "RECURRING_ANSWER_REQUIRED"

    ok = await _apply(
        client, demand["id"], farmer_token, canRecur=True, availabilityNote="Weekly through rabi season"
    )
    assert ok.status_code == 201
    assert ok.json()["lead"]["canRecur"] is True


async def test_withdrawn_application_can_reapply(client, user_store):
    token, demand = await _buyer(client, **ONE_TIME_BODY)
    farmer_token = _farmer(user_store)
    first = (await _apply(client, demand["id"], farmer_token)).json()["lead"]
    withdrawn = await client.post(
        f"/v1/leads/{first['id']}/outcome",
        json={"outcome": "withdrawn"},
        headers=_auth(farmer_token),
    )
    assert withdrawn.status_code == 200
    assert withdrawn.json()["status"] == "withdrawn"
    # A withdrawn application is no longer active — a fresh application works.
    second = await _apply(client, demand["id"], farmer_token)
    assert second.status_code == 201
    assert second.json()["lead"]["id"] != first["id"]


# ------------------------------------------------------------ contact unlock


async def _applied(client, user_store, demand_overrides=None, farmer_uid="uid-f1"):
    token, demand = await _buyer(client, **(demand_overrides or ONE_TIME_BODY))
    farmer_token = _farmer(user_store, uid=farmer_uid, name=f"Farmer {farmer_uid}")
    apply_overrides = {}
    if demand.get("supplyType") == "recurring":
        apply_overrides["canRecur"] = True
    lead = (await _apply(client, demand["id"], farmer_token, **apply_overrides)).json()["lead"]
    return token, demand, farmer_token, lead


async def test_contact_unlock_requires_ownership_role_terms_mpin(client, user_store):
    buyer_token, demand, farmer_token, lead = await _applied(client, user_store)
    lead_id = lead["id"]

    # Stranger cannot unlock.
    stranger = _farmer(user_store, uid="uid-x", name="Stranger", mpin=None)
    resp = await client.post(
        f"/v1/leads/{lead_id}/unlock", json={"termsAccepted": True}, headers=_auth(stranger)
    )
    assert resp.status_code == 404

    # Terms missing → 422; wrong MPIN → 401 (registered buyer has MPIN 1234).
    no_terms = await client.post(f"/v1/leads/{lead_id}/unlock", json={}, headers=_auth(buyer_token))
    assert no_terms.status_code == 422
    bad_mpin = await client.post(
        f"/v1/leads/{lead_id}/unlock", json={"termsAccepted": True, "mpin": "9999"}, headers=_auth(buyer_token)
    )
    assert bad_mpin.status_code == 401

    # Another industrial buyer (not the owner) cannot unlock either.
    other_buyer = _seed_user(user_store, "uid-b2", "Other Buyer", active="directBuyer")
    not_owner = await client.post(
        f"/v1/leads/{lead_id}/unlock", json={"termsAccepted": True}, headers=_auth(other_buyer)
    )
    assert not_owner.status_code == 404  # not a participant at all

    ok = await client.post(
        f"/v1/leads/{lead_id}/unlock", json={"termsAccepted": True, "mpin": "1234"}, headers=_auth(buyer_token)
    )
    assert ok.status_code == 200
    body = ok.json()
    assert body["status"] == "contacted"
    assert body["contactRevealedAt"]
    assert body["farmerContact"]["phone"] == "+919876543210"
    assert body["buyerContact"]["fullName"] == "Ram Patil"
    assert body["termsAcceptedAt"] and body["termsVersion"] == "dc-1.0"
    # Both parties are notified; no phone numbers inside notification payloads.
    notifs = [v for k, v in user_store.items() if k.startswith("notifications/")]
    unlock_notifs = [n for n in notifs if n.get("type") == "contact_unlocked"]
    assert len(unlock_notifs) == 2
    for n in unlock_notifs:
        assert not n.get("phone")


async def test_unlock_idempotent_single_chat_room_no_transaction_objects(client, user_store):
    buyer_token, demand, farmer_token, lead = await _applied(client, user_store)
    lead_id = lead["id"]
    first = await client.post(
        f"/v1/leads/{lead_id}/unlock", json={"termsAccepted": True, "mpin": "1234"}, headers=_auth(buyer_token)
    )
    second = await client.post(
        f"/v1/leads/{lead_id}/unlock", json={"termsAccepted": True, "mpin": "1234"}, headers=_auth(buyer_token)
    )
    assert first.status_code == 200 and second.status_code == 200
    assert second.json()["farmerContact"]["phone"] == first.json()["farmerContact"]["phone"]

    rooms = [k for k in user_store if k.startswith("chat_rooms/") and "/messages" not in k]
    assert len(rooms) == 1
    leads = [k for k in user_store if k.startswith("leads/")]
    assert len(leads) == 1

    # Contact unlock does NOT accept the quote, close the requirement, or
    # create any purchase/PO/contract/invoice/payment/settlement object.
    assert second.json()["status"] == "contacted"
    demand_doc = user_store[f"demands/{demand['id']}"]
    assert demand_doc["status"] == "applicationsReceived"
    for banned in ("purchases", "orders", "procurement_orders", "invoices", "escrow", "settlements", "supply_contracts"):
        assert not any(k.startswith(f"{banned}/") for k in user_store), banned

    # The farmer can revisit the connection without a new application.
    revisit = await client.post(
        f"/v1/leads/{lead_id}/unlock", json={"termsAccepted": True, "mpin": "1234"}, headers=_auth(farmer_token)
    )
    assert revisit.status_code == 200
    assert revisit.json()["buyerContact"]["fullName"]


async def test_unlock_rejected_for_terminal_applications(client, user_store):
    buyer_token, demand, farmer_token, lead = await _applied(client, user_store)
    await client.post(
        f"/v1/leads/{lead['id']}/outcome", json={"outcome": "withdrawn"}, headers=_auth(farmer_token)
    )
    resp = await client.post(
        f"/v1/leads/{lead['id']}/unlock", json={"termsAccepted": True, "mpin": "1234"}, headers=_auth(buyer_token)
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "APPLICATION_NOT_ELIGIBLE"


async def test_farmer_cannot_self_unlock_before_buyer_accepts(client, user_store):
    """Contacts stay hidden until the BUYER accepts the connection — the
    applicant cannot reveal the buyer's contact by calling unlock early."""
    buyer_token, demand, farmer_token, lead = await _applied(client, user_store)
    resp = await client.post(
        f"/v1/leads/{lead['id']}/unlock",
        json={"termsAccepted": True, "mpin": "1234"},
        headers=_auth(farmer_token),
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "NOT_UNLOCKED_YET"
    # Nothing was revealed.
    again = await client.get("/v1/leads/mine?filter=received&source=demand", headers=_auth(farmer_token))
    row = again.json()["data"][0]
    assert row["farmerContact"] is None
    assert row["buyerContact"] is None


# ------------------------------------------------------------ outcomes


async def test_deal_done_outcome_is_user_reported_only(client, user_store):
    buyer_token, demand, farmer_token, lead = await _applied(client, user_store)
    await client.post(
        f"/v1/leads/{lead['id']}/unlock", json={"termsAccepted": True, "mpin": "1234"}, headers=_auth(buyer_token)
    )
    resp = await client.post(
        f"/v1/leads/{lead['id']}/outcome",
        json={
            "outcome": "deal_done_offline",
            "finalQuantity": 80,
            "finalUnit": "quintal",
            "finalPrice": 4450,
            "finalPriceUnit": "quintal",
            "supplyStartDate": "2026-12-05",
            "arrangementType": "oneTime",
        },
        headers=_auth(farmer_token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "dealDone"
    details = body["dealDetails"]
    assert details["finalQuantity"] == 80
    assert details["finalPrice"] == 4450
    assert details["arrangementType"] == "oneTime"
    assert details["reportedBy"] == "uid-f1"

    # Still no transaction objects; the requirement is NOT auto-fulfilled.
    for banned in ("purchases", "orders", "procurement_orders", "invoices", "escrow", "settlements"):
        assert not any(k.startswith(f"{banned}/") for k in user_store), banned
    assert user_store[f"demands/{demand['id']}"]["status"] == "applicationsReceived"
    notifs = [v for k, v in user_store.items() if k.startswith("notifications/")]
    assert any(n.get("type") == "lead_outcome_updated" for n in notifs)


async def test_recurring_requirement_full_flow_never_generates_orders(client, user_store):
    buyer_token, demand, farmer_token, lead = await _applied(client, user_store, RECURRING_BODY)
    await client.post(
        f"/v1/leads/{lead['id']}/unlock", json={"termsAccepted": True, "mpin": "1234"}, headers=_auth(buyer_token)
    )
    resp = await client.post(
        f"/v1/leads/{lead['id']}/outcome",
        json={
            "outcome": "deal_done_offline",
            "finalQuantity": 25,
            "arrangementType": "recurring",
            "supplyStartDate": "2026-11-12",
        },
        headers=_auth(buyer_token),
    )
    assert resp.status_code == 200
    assert resp.json()["dealDetails"]["arrangementType"] == "recurring"
    # Recurring sourcing interest only — never recurring orders/invoices/billing.
    for banned in (
        "purchases", "orders", "procurement_orders", "invoices", "escrow",
        "settlements", "recurring_orders", "subscriptions", "billing_cycles",
    ):
        assert not any(k.startswith(f"{banned}/") for k in user_store), banned


async def test_stranger_cannot_record_outcome_or_view_connection(client, user_store):
    buyer_token, demand, farmer_token, lead = await _applied(client, user_store)
    stranger = _farmer(user_store, uid="uid-x", name="Stranger", mpin=None)
    resp = await client.post(
        f"/v1/leads/{lead['id']}/outcome", json={"outcome": "did_not_happen"}, headers=_auth(stranger)
    )
    assert resp.status_code == 404


# ------------------------------------------------------------ verification


async def test_verification_badges_distinct_and_server_derived(client, user_store):
    buyer_token = (await _register_buyer(client)).json()["accessToken"]
    await _create_demand(client, buyer_token, **ONE_TIME_BODY)
    farmer_token = _farmer(user_store)

    # Identity KYC verified (default) but no reviewed business documents.
    browse = await client.get("/v1/demands/browse", headers=_auth(farmer_token))
    summary = browse.json()["data"][0]["buyerSummary"]
    assert summary["identityVerified"] is True
    assert summary["businessVerified"] is False

    # A pending (uploaded, not reviewed) case must not infer business verified.
    user_store["kyc_cases/case1"] = {
        "id": "case1", "userId": "uid-1", "persona": "directBuyer", "status": "pending",
        "docs": [{"type": "gst", "status": "pending"}],
    }
    browse = await client.get("/v1/demands/browse", headers=_auth(farmer_token))
    assert browse.json()["data"][0]["buyerSummary"]["businessVerified"] is False

    # Reviewed + verified directBuyer case → business verified.
    user_store["kyc_cases/case1"]["status"] = "verified"
    browse = await client.get("/v1/demands/browse", headers=_auth(farmer_token))
    assert browse.json()["data"][0]["buyerSummary"]["businessVerified"] is True


# ------------------------------------------------------------ ratings


async def test_lead_connection_rating_rules(client, user_store):
    buyer_token, demand, farmer_token, lead = await _applied(client, user_store)
    lead_id = lead["id"]

    # Too early: application not contacted yet.
    early = await client.post(
        "/v1/ratings",
        json={"bookingKind": "lead_connection", "bookingId": lead_id, "stars": 5},
        headers=_auth(farmer_token),
    )
    assert early.status_code == 409

    # Strangers cannot rate.
    stranger = _farmer(user_store, uid="uid-x", name="Stranger", mpin=None)
    sresp = await client.post(
        "/v1/ratings",
        json={"bookingKind": "lead_connection", "bookingId": lead_id, "stars": 5},
        headers=_auth(stranger),
    )
    assert sresp.status_code == 403

    await client.post(
        f"/v1/leads/{lead_id}/unlock", json={"termsAccepted": True, "mpin": "1234"}, headers=_auth(buyer_token)
    )
    ok = await client.post(
        "/v1/ratings",
        json={"bookingKind": "lead_connection", "bookingId": lead_id, "stars": 4, "comment": "Prompt sampler"},
        headers=_auth(farmer_token),
    )
    assert ok.status_code == 201
    assert ok.json()["providerId"] == "uid-1"

    # One rating per party.
    dup = await client.post(
        "/v1/ratings",
        json={"bookingKind": "lead_connection", "bookingId": lead_id, "stars": 5},
        headers=_auth(farmer_token),
    )
    assert dup.status_code == 409
    other_side = await client.post(
        "/v1/ratings",
        json={"bookingKind": "lead_connection", "bookingId": lead_id, "stars": 5},
        headers=_auth(buyer_token),
    )
    assert other_side.status_code == 201
    assert other_side.json()["providerId"] == "uid-f1"
