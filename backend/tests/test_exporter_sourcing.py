"""Farmer–exporter direct-connect sourcing workflow (spec §19 backend tests).

Exporter publishes a structured sourcing RFQ → farmers apply with quantity /
price / quality / supply details → exporter compares → contact unlock via
KYC + terms + MPIN → direct negotiation → user-reported outcome. No
payments, escrow, shipping, customs, settlements, or export orders are ever
created in this flow.
"""

import json
from datetime import date, timedelta

from app.core.security import hash_mpin
from app.services.tokens import create_access_token
from tests.test_users import _auth, _register

WINDOW = {
    "from": (date.today() + timedelta(days=5)).isoformat(),
    "to": (date.today() + timedelta(days=20)).isoformat(),
}
AVAILABLE_DATE = (date.today() + timedelta(days=7)).isoformat()
PAST_DATE = (date.today() - timedelta(days=1)).isoformat()

EXPORTER_PROFILE = {"companyName": "Agro Exports Pvt Ltd", "iecNumber": "IEC1234567"}

RFQ_BODY = {
    "crop": "Onion",
    "variety": "Red Nasik",
    "quantityQuintals": 100,
    "quantityUnit": "quintal",
    "maxRatePerQuintal": 2500,
    "packing": "50 kg mesh bags",
    "deliveryWindow": WINDOW,
    "deliveryLocation": "Nashik, Maharashtra",
    "paymentTermsDays": 30,
    "notes": "Export grade",
    "partialQuantityAllowed": True,
    "multiFarmerAllowed": True,
    "requiredCertifications": ["GlobalGAP"],
    "residueRequirements": "MRL compliant",
    "packagingRequirements": "Mesh bags, palletized",
    "destinationCountry": "UAE",
    "targetPrice": 300,
    "currency": "USD",
}

APPLICATION_BODY = {
    "quantityOffered": 40,
    "quantityUnit": "quintal",
    "price": 2200,
    "priceUnit": "quintal",
    "currency": "INR",
    "supplyBasis": "farmGate",
    "availableDate": AVAILABLE_DATE,
    "supplyLocation": "Nashik, Maharashtra",
    "termsAccepted": True,
    "qualityDetails": "A grade, 8% moisture",
    "certificationNames": ["GlobalGAP"],
    "packagingCapability": "Can pack in mesh bags",
    "previousExperience": "Supplied to exporter last season",
    "message": "Ready to supply",
}


async def _exporter_token(client, user_store, uid="uid-1", verified_business=True, mpin=None):
    if uid == "uid-1":
        resp = await _register(
            client,
            name="Esha Exporter",
            profiles=["exporter"],
            primaryProfile="exporter",
            roleProfiles={"exporter": EXPORTER_PROFILE},
        )
        assert resp.status_code == 200, resp.text
        token = resp.json()["accessToken"]
    else:
        token = _seed_user(user_store, uid, "Other Exporter", active="exporter")
    if verified_business:
        user_store[f"kyc_cases/kyc_{uid[:8]}_exporter"] = {
            "caseId": f"kyc_{uid[:8]}_exporter",
            "userId": uid,
            "persona": "exporter",
            "status": "verified",
            "submittedAt": "2026-10-01T00:00:00+00:00",
            "docs": [],
        }
    if mpin:
        user_store[f"users/{uid}"]["mpinHash"] = hash_mpin(mpin)
    return token


def _seed_user(user_store, uid, name, active="seller", **extra):
    user_store[f"users/{uid}"] = {
        "id": uid,
        "name": name,
        "phone": "+919876543210",
        "whatsapp": "+919876543210",
        "linkedProfiles": [active],
        "primaryProfile": active,
        "activeProfile": active,
        "kycStatus": "verified",
        **extra,
    }
    return create_access_token(uid)


async def _create_rfq(client, token, idempotency_key, **overrides):
    body = {**RFQ_BODY, **overrides}
    return await client.post(
        "/v1/exporter/rfqs", json=body, headers={**_auth(token), "Idempotency-Key": idempotency_key}
    )


async def _apply(client, farmer_tok, rfq_id, key, **overrides):
    body = {**APPLICATION_BODY, **overrides}
    return await client.post(
        f"/v1/exporter/rfqs/{rfq_id}/applications",
        json=body,
        headers={**_auth(farmer_tok), "Idempotency-Key": key},
    )


def _notifications_for(user_store, uid, ntype):
    return [
        doc
        for key, doc in user_store.items()
        if key.startswith("notifications/")
        and doc.get("userId") == uid
        and doc.get("type") == ntype
    ]


def _no_value(obj, forbidden):
    if isinstance(obj, dict):
        return all(_no_value(v, forbidden) for v in obj.values())
    if isinstance(obj, list):
        return all(_no_value(v, forbidden) for v in obj)
    return obj != forbidden


def _no_private_contacts(payload: dict):
    raw = json.dumps(payload)
    for forbidden in ("+919876543210", "9876543210", "whatsapp"):
        assert forbidden not in raw, f"private contact leaked: {forbidden}"


# ==========================================
# RFQ publication
# ==========================================


async def test_exporter_creates_structured_rfq_and_draft_publish_flow(client, user_store):
    token = await _exporter_token(client, user_store)

    created = await _create_rfq(client, token, "rfq-struct-1")
    assert created.status_code == 201, created.text
    rfq = created.json()
    assert rfq["status"] == "open"
    assert rfq["partialQuantityAllowed"] is True
    assert rfq["multiFarmerAllowed"] is True
    assert rfq["requiredCertifications"] == ["GlobalGAP"]
    assert rfq["destinationCountry"] == "UAE"
    assert rfq["currency"] == "USD"

    # draft → not visible to farmers until published
    draft = await _create_rfq(
        client, token, "rfq-draft-1", crop="Wheat", publish=False, deliveryWindow=WINDOW
    )
    assert draft.status_code == 201, draft.text
    assert draft.json()["status"] == "draft"
    farmer_tok = _seed_user(user_store, "uid-f1", "Farmer F1", active="farmer")
    seen = await client.get("/v1/exporter/opportunities", headers=_auth(farmer_tok))
    assert seen.status_code == 200
    assert seen.json()["total"] == 1  # only the open Onion RFQ

    draft_id = draft.json()["id"]
    published = await client.post(f"/v1/exporter/rfqs/{draft_id}/publish", headers=_auth(token))
    assert published.status_code == 200
    assert published.json()["status"] == "open"
    again = await client.post(f"/v1/exporter/rfqs/{draft_id}/publish", headers=_auth(token))
    assert again.status_code == 409

    # edit a published RFQ
    edited = await client.put(
        f"/v1/exporter/rfqs/{draft_id}",
        json={"targetPrice": 320, "packagingRequirements": "Jute bags"},
        headers=_auth(token),
    )
    assert edited.status_code == 200
    assert edited.json()["targetPrice"] == 320
    assert edited.json()["packagingRequirements"] == "Jute bags"

    # bad window on edit
    bad = await client.put(
        f"/v1/exporter/rfqs/{draft_id}",
        json={"deliveryWindow": {"from": WINDOW["to"], "to": WINDOW["from"]}},
        headers=_auth(token),
    )
    assert bad.status_code == 422

    # a fulfilled RFQ cannot be edited
    await client.post(f"/v1/exporter/rfqs/{draft_id}/fulfill", headers=_auth(token))
    edit_fulfilled = await client.put(
        f"/v1/exporter/rfqs/{draft_id}", json={"notes": "nope"}, headers=_auth(token)
    )
    assert edit_fulfilled.status_code == 409


async def test_unverified_exporter_cannot_publish(client, user_store):
    resp = await _register(
        client,
        name="Ravi Rough",
        profiles=["exporter"],
        primaryProfile="exporter",
        roleProfiles={"exporter": EXPORTER_PROFILE},
    )
    assert resp.status_code == 200
    user_store["users/uid-1"]["kycStatus"] = "pending"
    token = resp.json()["accessToken"]

    denied = await _create_rfq(client, token, "rfq-unverified")
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "KYC_REQUIRED"

    draft = await _create_rfq(
        client, token, "rfq-unverified-draft", publish=False, deliveryWindow=WINDOW
    )
    assert draft.status_code == 403


# ==========================================
# Farmer opportunity discovery (privacy + badges)
# ==========================================


async def test_farmer_opportunities_privacy_filters_and_badges(client, user_store):
    token = await _exporter_token(client, user_store)
    rfq_id = (await _create_rfq(client, token, "rfq-opp-1")).json()["id"]
    farmer_tok = _seed_user(user_store, "uid-f1", "Farmer F1", active="farmer")

    listed = await client.get("/v1/exporter/opportunities", headers=_auth(farmer_tok))
    assert listed.status_code == 200
    entry = listed.json()["data"][0]
    assert entry["id"] == rfq_id
    assert entry["exporter"]["identityVerified"] is True
    assert entry["exporter"]["businessVerified"] is True  # reviewed case seeded
    assert entry["exporter"]["verified"] is True  # legacy alias
    _no_private_contacts(entry)

    # filters
    assert (
        await client.get(
            "/v1/exporter/opportunities", params={"crop": "oni"}, headers=_auth(farmer_tok)
        )
    ).json()["total"] == 1
    assert (
        await client.get(
            "/v1/exporter/opportunities", params={"certification": "gap"}, headers=_auth(farmer_tok)
        )
    ).json()["total"] == 1
    assert (
        await client.get(
            "/v1/exporter/opportunities",
            params={"minQuantity": 200},
            headers=_auth(farmer_tok),
        )
    ).json()["total"] == 0
    assert (
        await client.get(
            "/v1/exporter/opportunities",
            params={"maxQuantity": 100},
            headers=_auth(farmer_tok),
        )
    ).json()["total"] == 1
    assert (
        await client.get(
            "/v1/exporter/opportunities",
            params={"requiredBy": WINDOW["to"]},
            headers=_auth(farmer_tok),
        )
    ).json()["total"] == 1

    detail = await client.get(f"/v1/exporter/opportunities/{rfq_id}", headers=_auth(farmer_tok))
    assert detail.status_code == 200
    assert detail.json()["myApplicationId"] is None
    _no_private_contacts(detail.json())

    # identity KYC alone must NOT imply export-business verified
    token2 = await _exporter_token(client, user_store, uid="uid-e2", verified_business=False)
    rfq2 = (await _create_rfq(client, token2, "rfq-opp-2")).json()["id"]
    detail2 = await client.get(f"/v1/exporter/opportunities/{rfq2}", headers=_auth(farmer_tok))
    assert detail2.json()["exporter"]["identityVerified"] is True
    assert detail2.json()["exporter"]["businessVerified"] is False


async def test_exporter_endpoints_reject_farmers_and_farmers_reject_exporters(client, user_store):
    token = await _exporter_token(client, user_store)
    rfq_id = (await _create_rfq(client, token, "rfq-gate-1")).json()["id"]
    farmer_tok = _seed_user(user_store, "uid-f1", "Farmer F1", active="farmer")

    # legacy seller/exporter surfaces stay closed to farmers
    assert (await client.get("/v1/exporter/rfqs", headers=_auth(farmer_tok))).status_code == 403
    assert (
        await client.get(f"/v1/exporter/rfqs/{rfq_id}/quotes", headers=_auth(farmer_tok))
    ).status_code == 403
    # new farmer surfaces stay closed to exporters
    assert (await client.get("/v1/exporter/opportunities", headers=_auth(token))).status_code == 403
    assert (
        await client.get("/v1/exporter/applications/mine", headers=_auth(token))
    ).status_code == 403
    assert (
        await client.get("/v1/exporter/connections/mine", headers=_auth(token))
    ).status_code == 403


# ==========================================
# Farmer applications
# ==========================================


async def test_farmer_application_validation_and_duplicate(client, user_store):
    token = await _exporter_token(client, user_store)
    rfq_id = (await _create_rfq(client, token, "rfq-app-1")).json()["id"]
    farmer_tok = _seed_user(user_store, "uid-f1", "Farmer F1", active="farmer")

    # terms acknowledgement required
    no_terms = await _apply(client, farmer_tok, rfq_id, "app-no-terms", termsAccepted=False)
    assert no_terms.status_code == 422
    assert no_terms.json()["error"]["code"] == "TERMS_REQUIRED"

    # unverified farmer blocked
    user_store["users/uid-f1"]["kycStatus"] = "pending"
    unverified = await _apply(client, farmer_tok, rfq_id, "app-unverified")
    assert unverified.status_code == 403
    assert unverified.json()["error"]["code"] == "KYC_REQUIRED"
    user_store["users/uid-f1"]["kycStatus"] = "verified"

    # invalid quantity / over-offer / past date / bad currency
    assert (await _apply(client, farmer_tok, rfq_id, "app-q0", quantityOffered=0)).status_code == 422
    over = await _apply(client, farmer_tok, rfq_id, "app-over", quantityOffered=101)
    assert over.status_code == 422
    assert "quantityOffered" in over.json()["error"]["fieldErrors"]
    stale = await _apply(client, farmer_tok, rfq_id, "app-stale", availableDate=PAST_DATE)
    assert stale.status_code == 422
    assert (await _apply(client, farmer_tok, rfq_id, "app-cur", currency="R")).status_code == 422

    # valid application
    created = await _apply(client, farmer_tok, rfq_id, "app-1")
    assert created.status_code == 201, created.text
    app = created.json()
    assert app["id"].startswith("exq_")
    assert app["status"] == "submitted"
    assert app["applicantRole"] == "farmer"
    assert app["farmer"]["identityVerified"] is True
    assert app["exporter"]["businessVerified"] is True
    assert app["rfq"]["crop"] == "Onion"
    assert app["termsText"].startswith("Agrovercity only connects farmers and exporters")
    # legacy-shape mirrors present for existing list endpoints
    assert app["ratePerQuintal"] == 2200
    assert app["availableQuintals"] == 40.0

    # exporter notified
    notes = _notifications_for(user_store, "uid-1", "application_received")
    assert len(notes) == 1
    assert "rfq=" in notes[0]["data"]["deepLink"]

    # duplicate active application prevented
    dup = await _apply(client, farmer_tok, rfq_id, "app-2", price=2100)
    assert dup.status_code == 409
    assert dup.json()["error"]["code"] == "DUPLICATE_APPLICATION"

    # idempotent replay of the same key returns the same application
    replay = await _apply(client, farmer_tok, rfq_id, "app-1")
    assert replay.status_code == 201
    assert replay.json()["id"] == app["id"]

    # opportunity detail now exposes the live application id
    detail = await client.get(f"/v1/exporter/opportunities/{rfq_id}", headers=_auth(farmer_tok))
    assert detail.json()["myApplicationId"] == app["id"]


async def test_partial_quantity_rules_and_multi_farmer_sourcing(client, user_store):
    token = await _exporter_token(client, user_store)
    rfq_id = (
        await _create_rfq(client, token, "rfq-full-1", partialQuantityAllowed=False)
    ).json()["id"]
    farmer1 = _seed_user(user_store, "uid-f1", "Farmer F1", active="farmer")
    farmer2 = _seed_user(user_store, "uid-f2", "Farmer F2", active="farmer")

    # partial offer rejected when the RFQ requires full quantity
    partial = await _apply(client, farmer1, rfq_id, "app-partial")
    assert partial.status_code == 422
    assert partial.json()["error"]["code"] == "PARTIAL_NOT_ALLOWED"

    # MT-unit offer normalised against the quintal requirement (10 q = 1 MT)
    full = await _apply(
        client, farmer1, rfq_id, "app-full", quantityOffered=10, quantityUnit="MT"
    )
    assert full.status_code == 201

    # second farmer can also apply — multi-farmer collective sourcing supported
    second = await _apply(client, farmer2, rfq_id, "app-second", quantityOffered=10, quantityUnit="MT")
    assert second.status_code == 201

    board = await client.get(f"/v1/exporter/rfqs/{rfq_id}/applications", headers=_auth(token))
    assert board.status_code == 200
    assert board.json()["total"] == 2
    # no auto-fulfilment from offered quantities
    rfq = user_store[f"export_rfqs/{rfq_id}"]
    assert rfq["status"] == "open"
    assert rfq["fulfilledQuintals"] == 0.0
    # no export orders / purchases exist
    assert not [k for k in user_store if k.startswith("export_orders/")]
    assert not [k for k in user_store if k.startswith("purchases/")]


async def test_closed_paused_fulfilled_rfqs_reject_applications(client, user_store):
    token = await _exporter_token(client, user_store)
    farmer_tok = _seed_user(user_store, "uid-f1", "Farmer F1", active="farmer")

    rfq_id = (await _create_rfq(client, token, "rfq-lc-1")).json()["id"]
    await client.post(f"/v1/exporter/rfqs/{rfq_id}/close", headers=_auth(token))
    closed = await _apply(client, farmer_tok, rfq_id, "app-closed")
    assert closed.status_code == 409
    assert closed.json()["error"]["code"] == "RFQ_NOT_OPEN"
    await client.post(f"/v1/exporter/rfqs/{rfq_id}/reopen", headers=_auth(token))

    await client.post(f"/v1/exporter/rfqs/{rfq_id}/pause", headers=_auth(token))
    paused = await _apply(client, farmer_tok, rfq_id, "app-paused")
    assert paused.status_code == 409
    # paused RFQs are hidden from discovery
    listed = await client.get("/v1/exporter/opportunities", headers=_auth(farmer_tok))
    assert listed.json()["total"] == 0
    await client.post(f"/v1/exporter/rfqs/{rfq_id}/resume", headers=_auth(token))

    await client.post(f"/v1/exporter/rfqs/{rfq_id}/fulfill", headers=_auth(token))
    fulfilled = await _apply(client, farmer_tok, rfq_id, "app-fulfilled")
    assert fulfilled.status_code == 409
    # exporter reopens sourcing → applications accepted again
    await client.post(f"/v1/exporter/rfqs/{rfq_id}/reopen", headers=_auth(token))
    assert (await _apply(client, farmer_tok, rfq_id, "app-after-reopen")).status_code == 201


async def test_source_lot_ownership_validation(client, user_store):
    token = await _exporter_token(client, user_store)
    rfq_id = (await _create_rfq(client, token, "rfq-lot-1")).json()["id"]
    farmer1 = _seed_user(user_store, "uid-f1", "Farmer F1", active="farmer")
    farmer2 = _seed_user(user_store, "uid-f2", "Farmer F2", active="farmer")

    user_store["market_lots/lot_1"] = {
        "id": "lot_1",
        "farmerId": "uid-f1",
        "crop": "Onion",
        "quantityQuintals": 50,
        "location": "Nashik",
        "harvestDate": AVAILABLE_DATE,
        "photos": ["https://example.com/p.jpg"],
    }

    # someone else's lot is rejected
    stolen = await _apply(client, farmer2, rfq_id, "app-stolen-lot", sourceLotId="lot_1")
    assert stolen.status_code == 422
    assert "sourceLotId" in stolen.json()["error"]["fieldErrors"]

    own = await _apply(client, farmer1, rfq_id, "app-own-lot", sourceLotId="lot_1")
    assert own.status_code == 201
    snapshot = own.json()["sourceLot"]
    assert snapshot["id"] == "lot_1"
    assert snapshot["crop"] == "Onion"
    assert snapshot["harvestDate"] == AVAILABLE_DATE
    assert "farmerId" not in snapshot  # ownership data stays server-side


async def test_certificate_verified_only_after_review(client, user_store):
    token = await _exporter_token(client, user_store)
    rfq_id = (await _create_rfq(client, token, "rfq-cert-1")).json()["id"]
    farmer_tok = _seed_user(user_store, "uid-f1", "Farmer F1", active="farmer")

    user_store["users/uid-f1/vault_documents/doc_1"] = {
        "id": "doc_1",
        "docType": "other",
        "fileName": "gap.pdf",
        "status": "pending",  # uploaded but NOT reviewed
    }
    # unknown document reference rejected
    ghost = await _apply(client, farmer_tok, rfq_id, "app-ghost-doc", documentIds=["doc_nope"])
    assert ghost.status_code == 422

    uploaded = await _apply(client, farmer_tok, rfq_id, "app-pending-doc", documentIds=["doc_1"])
    assert uploaded.status_code == 201
    assert uploaded.json()["documents"][0]["verified"] is False  # never inferred from upload

    # after an actual review the same reference is genuinely verified
    user_store["users/uid-f1/vault_documents/doc_1"]["status"] = "verified"
    await client.post(
        f"/v1/exporter/applications/{uploaded.json()['id']}/withdraw", headers=_auth(farmer_tok)
    )
    reviewed = await _apply(client, farmer_tok, rfq_id, "app-reviewed-doc", documentIds=["doc_1"])
    assert reviewed.status_code == 201
    assert reviewed.json()["documents"][0]["verified"] is True


# ==========================================
# Comparison, permissions, contact unlock
# ==========================================


async def _submitted_application(client, user_store, mpin=None):
    token = await _exporter_token(client, user_store, mpin=mpin)
    rfq_id = (await _create_rfq(client, token, "rfq-cu-1")).json()["id"]
    farmer_tok = _seed_user(user_store, "uid-f1", "Farmer F1", active="farmer")
    app_id = (await _apply(client, farmer_tok, rfq_id, "app-cu-1")).json()["id"]
    return token, farmer_tok, rfq_id, app_id


async def test_only_rfq_owner_can_review_or_contact(client, user_store):
    token, farmer_tok, rfq_id, app_id = await _submitted_application(client, user_store)
    other_exporter = await _exporter_token(client, user_store, uid="uid-e2")

    denied_board = await client.get(
        f"/v1/exporter/rfqs/{rfq_id}/applications", headers=_auth(other_exporter)
    )
    assert denied_board.status_code == 403
    denied_contact = await client.post(
        f"/v1/exporter/applications/{app_id}/contact",
        json={"termsAccepted": True},
        headers={**_auth(other_exporter), "Idempotency-Key": "contact-x"},
    )
    assert denied_contact.status_code == 403

    # non-participants cannot read the application at all
    stranger = _seed_user(user_store, "uid-s9", "Random Seller")
    assert (await client.get(f"/v1/exporter/applications/{app_id}", headers=_auth(stranger))).status_code == 403


async def test_contact_unlock_requires_terms_and_mpin(client, user_store):
    token, farmer_tok, rfq_id, app_id = await _submitted_application(client, user_store, mpin="4321")

    no_terms = await client.post(
        f"/v1/exporter/applications/{app_id}/contact",
        json={"termsAccepted": False, "mpin": "4321"},
        headers={**_auth(token), "Idempotency-Key": "cu-no-terms"},
    )
    assert no_terms.status_code == 422
    assert no_terms.json()["error"]["code"] == "TERMS_REQUIRED"

    no_mpin = await client.post(
        f"/v1/exporter/applications/{app_id}/contact",
        json={"termsAccepted": True},
        headers={**_auth(token), "Idempotency-Key": "cu-no-mpin"},
    )
    assert no_mpin.status_code == 401

    wrong_mpin = await client.post(
        f"/v1/exporter/applications/{app_id}/contact",
        json={"termsAccepted": True, "mpin": "0000"},
        headers={**_auth(token), "Idempotency-Key": "cu-wrong"},
    )
    assert wrong_mpin.status_code == 401
    assert wrong_mpin.json()["error"]["code"] == "WRONG_MPIN"

    # MPIN is never stored on the application
    unlocked = await client.post(
        f"/v1/exporter/applications/{app_id}/contact",
        json={"termsAccepted": True, "mpin": "4321"},
        headers={**_auth(token), "Idempotency-Key": "cu-ok"},
    )
    assert unlocked.status_code == 200, unlocked.text
    body = unlocked.json()
    assert body["status"] == "contacted"
    assert body["exporterConsent"]["mpinVerified"] is True
    assert body["exporterConsent"]["termsVersion"]
    assert _no_value(body["exporterConsent"], "4321")
    assert _no_value(user_store[f"export_quotes/{app_id}"], "4321")
    farmer_contact = body["contactReveal"]["farmer"]
    assert farmer_contact["phoneDigits"] == "919876543210"
    assert farmer_contact["whatsappDigits"] == "919876543210"
    assert body["chatRoomId"].startswith("dm_")
    assert len(body["negotiationChecklist"]) == 9


async def test_contact_unlock_blocked_for_unverified_farmer(client, user_store):
    token = await _exporter_token(client, user_store)
    rfq_id = (await _create_rfq(client, token, "rfq-cu-farmer-kyc")).json()["id"]
    farmer_tok = _seed_user(user_store, "uid-f1", "Farmer F1", active="farmer")
    app_id = (await _apply(client, farmer_tok, rfq_id, "app-cu-kyc")).json()["id"]
    user_store["users/uid-f1"]["kycStatus"] = "pending"

    blocked = await client.post(
        f"/v1/exporter/applications/{app_id}/contact",
        json={"termsAccepted": True},
        headers={**_auth(token), "Idempotency-Key": "cu-farmer-kyc"},
    )
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "COUNTERPARTY_KYC_REQUIRED"


async def test_contact_unlock_idempotent_single_room_no_order(client, user_store):
    token, farmer_tok, rfq_id, app_id = await _submitted_application(client, user_store, mpin="4321")
    body1 = (
        await client.post(
            f"/v1/exporter/applications/{app_id}/contact",
            json={"termsAccepted": True, "mpin": "4321"},
            headers={**_auth(token), "Idempotency-Key": "cu-once"},
        )
    ).json()
    body2 = (
        await client.post(
            f"/v1/exporter/applications/{app_id}/contact",
            json={"termsAccepted": True, "mpin": "4321"},
            headers={**_auth(token), "Idempotency-Key": "cu-twice"},
        )
    ).json()
    assert body2["status"] == "contacted"
    assert body2["chatRoomId"] == body1["chatRoomId"]
    assert body2["contactReveal"]["revealedAt"] == body1["contactReveal"]["revealedAt"]

    # exactly one chat room for the pair
    rooms = [k for k in user_store if k.startswith("chat_rooms/")]
    assert len(rooms) == 1

    # unlock does NOT accept the quote, create an order, purchase, or payment
    stored = user_store[f"export_quotes/{app_id}"]
    assert stored["status"] == "contacted"
    assert not [k for k in user_store if k.startswith("export_orders/")]
    assert not [k for k in user_store if k.startswith("purchases/")]

    # both parties were notified
    assert _notifications_for(user_store, "uid-f1", "contact_unlocked")
    assert _notifications_for(user_store, "uid-1", "contact_unlocked")
    assert _notifications_for(user_store, "uid-f1", "chat_unlocked")

    # each party sees the other's contact; a stranger sees nothing
    farmer_view = await client.get(f"/v1/exporter/applications/{app_id}", headers=_auth(farmer_tok))
    assert farmer_view.json()["contactReveal"]["exporter"]["fullName"] == "Esha Exporter"
    stranger = _seed_user(user_store, "uid-s9", "Random Seller")
    stranger_view = await client.get(f"/v1/exporter/applications/{app_id}", headers=_auth(stranger))
    assert stranger_view.status_code == 403


async def test_connections_listed_for_both_personas(client, user_store):
    token, farmer_tok, rfq_id, app_id = await _submitted_application(client, user_store, mpin="4321")
    await client.post(
        f"/v1/exporter/applications/{app_id}/contact",
        json={"termsAccepted": True, "mpin": "4321"},
        headers={**_auth(token), "Idempotency-Key": "cu-conn"},
    )

    exporter_conns = await client.get("/v1/exporter/connections", headers=_auth(token))
    assert exporter_conns.status_code == 200
    assert exporter_conns.json()["total"] == 1
    conn = exporter_conns.json()["data"][0]
    assert conn["status"] == "contacted"
    assert conn["contactReveal"]["farmer"]["phoneDigits"] == "919876543210"

    farmer_conns = await client.get("/v1/exporter/connections/mine", headers=_auth(farmer_tok))
    assert farmer_conns.status_code == 200
    assert farmer_conns.json()["total"] == 1
    fconn = farmer_conns.json()["data"][0]
    assert fconn["contactReveal"]["exporter"]["fullName"] == "Esha Exporter"


# ==========================================
# Dismiss / withdraw / outcomes
# ==========================================


async def test_withdraw_and_dismiss_flows(client, user_store):
    token, farmer_tok, rfq_id, app_id = await _submitted_application(client, user_store)

    # exporter cannot withdraw; farmer cannot dismiss
    assert (
        await client.post(f"/v1/exporter/applications/{app_id}/withdraw", headers=_auth(token))
    ).status_code == 403
    assert (
        await client.post(f"/v1/exporter/applications/{app_id}/dismiss", headers=_auth(farmer_tok))
    ).status_code == 403

    withdrawn = await client.post(
        f"/v1/exporter/applications/{app_id}/withdraw", headers=_auth(farmer_tok)
    )
    assert withdrawn.status_code == 200
    assert withdrawn.json()["status"] == "withdrawn"
    assert _notifications_for(user_store, "uid-1", "application_withdrawn")

    # farmer can apply again after withdrawing
    again = await _apply(client, farmer_tok, rfq_id, "app-again", price=2100)
    assert again.status_code == 201

    dismissed = await client.post(
        f"/v1/exporter/applications/{again.json()['id']}/dismiss", headers=_auth(token)
    )
    assert dismissed.status_code == 200
    assert dismissed.json()["status"] == "dismissed"
    assert _notifications_for(user_store, "uid-f1", "application_dismissed")

    # dismissed application cannot be contacted
    contact = await client.post(
        f"/v1/exporter/applications/{again.json()['id']}/contact",
        json={"termsAccepted": True},
        headers={**_auth(token), "Idempotency-Key": "cu-dismissed"},
    )
    assert contact.status_code == 409


async def test_outcome_is_user_reported_without_trade_objects(client, user_store):
    token, farmer_tok, rfq_id, app_id = await _submitted_application(client, user_store, mpin="4321")
    await client.post(
        f"/v1/exporter/applications/{app_id}/contact",
        json={"termsAccepted": True, "mpin": "4321"},
        headers={**_auth(token), "Idempotency-Key": "cu-outcome"},
    )

    # outcome before contact is not allowed (fresh RFQ path)
    other_rfq = (await _create_rfq(client, token, "rfq-outcome-2")).json()["id"]
    other_app = (await _apply(client, farmer_tok, other_rfq, "app-outcome-2")).json()["id"]
    early = await client.post(
        f"/v1/exporter/applications/{other_app}/outcome",
        json={"outcome": "dealDoneOffline"},
        headers=_auth(farmer_tok),
    )
    assert early.status_code == 409

    done = await client.post(
        f"/v1/exporter/applications/{app_id}/outcome",
        json={
            "outcome": "dealDoneOffline",
            "finalQuantity": 40,
            "finalQuantityUnit": "quintal",
            "finalPrice": 2300,
            "finalPriceUnit": "quintal",
            "finalCurrency": "INR",
            "supplyDate": AVAILABLE_DATE,
            "collectionLocation": "Nashik",
        },
        headers=_auth(farmer_tok),
    )
    assert done.status_code == 200, done.text
    body = done.json()
    assert body["status"] == "dealDone"
    assert body["outcome"]["value"] == "dealDoneOffline"
    assert body["outcome"]["dealDetails"]["finalPrice"] == 2300
    assert _notifications_for(user_store, "uid-1", "outcome_updated")

    # still no export order / purchase / payment objects anywhere
    assert not [k for k in user_store if k.startswith("export_orders/")]
    assert not [k for k in user_store if k.startswith("purchases/")]

    # exporter reports "still in contact" on the other connection — stays contacted
    unlocked2 = await client.post(
        f"/v1/exporter/applications/{other_app}/contact",
        json={"termsAccepted": True, "mpin": "4321"},
        headers={**_auth(token), "Idempotency-Key": "cu-outcome-2"},
    )
    assert unlocked2.status_code == 200
    still = await client.post(
        f"/v1/exporter/applications/{other_app}/outcome",
        json={"outcome": "stillInContact"},
        headers=_auth(token),
    )
    assert still.status_code == 200
    assert still.json()["status"] == "contacted"
    assert still.json()["outcome"]["value"] == "stillInContact"


async def test_my_applications_status_filter(client, user_store):
    token, farmer_tok, rfq_id, app_id = await _submitted_application(client, user_store)
    unlocked = await client.post(
        f"/v1/exporter/applications/{app_id}/contact",
        json={"termsAccepted": True, "mpin": "1234"},
        headers={**_auth(token), "Idempotency-Key": "cu-filter"},
    )
    assert unlocked.status_code == 200
    submitted = await client.get(
        "/v1/exporter/applications/mine", params={"status": "submitted"}, headers=_auth(farmer_tok)
    )
    assert submitted.json()["total"] == 0
    contacted = await client.get(
        "/v1/exporter/applications/mine", params={"status": "contacted"}, headers=_auth(farmer_tok)
    )
    assert contacted.json()["total"] == 1
    assert contacted.json()["data"][0]["chatRoomId"]


# ==========================================
# Ratings + issue reports on connections
# ==========================================


async def test_export_connection_ratings(client, user_store):
    token, farmer_tok, rfq_id, app_id = await _submitted_application(client, user_store, mpin="4321")
    await client.post(
        f"/v1/exporter/applications/{app_id}/contact",
        json={"termsAccepted": True, "mpin": "4321"},
        headers={**_auth(token), "Idempotency-Key": "cu-rate"},
    )

    # rating before contact blocked
    fresh_rfq = (await _create_rfq(client, token, "rfq-rate-2")).json()["id"]
    fresh_app = (await _apply(client, farmer_tok, fresh_rfq, "app-rate-2")).json()["id"]
    early = await client.post(
        "/v1/ratings",
        json={"bookingKind": "export_connection", "bookingId": fresh_app, "stars": 5},
        headers=_auth(farmer_tok),
    )
    assert early.status_code == 409

    farmer_rate = await client.post(
        "/v1/ratings",
        json={
            "bookingKind": "export_connection",
            "bookingId": app_id,
            "stars": 4,
            "comment": "Responsive exporter",
        },
        headers=_auth(farmer_tok),
    )
    assert farmer_rate.status_code == 201, farmer_rate.text
    assert farmer_rate.json()["providerId"] == "uid-1"

    exporter_rate = await client.post(
        "/v1/ratings",
        json={"bookingKind": "export_connection", "bookingId": app_id, "stars": 5},
        headers=_auth(token),
    )
    assert exporter_rate.status_code == 201
    assert exporter_rate.json()["providerId"] == "uid-f1"

    # one rating per party
    dup = await client.post(
        "/v1/ratings",
        json={"bookingKind": "export_connection", "bookingId": app_id, "stars": 3},
        headers=_auth(farmer_tok),
    )
    assert dup.status_code == 409

    stranger = _seed_user(user_store, "uid-s9", "Random Seller")
    outsider = await client.post(
        "/v1/ratings",
        json={"bookingKind": "export_connection", "bookingId": app_id, "stars": 1},
        headers=_auth(stranger),
    )
    assert outsider.status_code == 403


async def test_issue_report_creates_dispute_without_trade_action(client, user_store):
    token, farmer_tok, rfq_id, app_id = await _submitted_application(client, user_store, mpin="4321")
    await client.post(
        f"/v1/exporter/applications/{app_id}/contact",
        json={"termsAccepted": True, "mpin": "4321"},
        headers={**_auth(token), "Idempotency-Key": "cu-report"},
    )

    outsider = _seed_user(user_store, "uid-s9", "Random Seller")
    denied = await client.post(
        f"/v1/exporter/applications/{app_id}/report",
        json={"category": "conduct", "summary": "this should not be allowed for outsiders"},
        headers=_auth(outsider),
    )
    assert denied.status_code == 403

    reported = await client.post(
        f"/v1/exporter/applications/{app_id}/report",
        json={"category": "misrepresented_quantity_quality", "summary": "Quantity was overstated"},
        headers=_auth(farmer_tok),
    )
    assert reported.status_code == 201, reported.text
    dispute = reported.json()
    assert dispute["source"] == "export_application"
    assert dispute["sourceId"] == app_id
    assert "misrepresented_quantity_quality" in dispute["summary"]

    # issue reports never create payment/shipping/settlement side effects
    assert not [k for k in user_store if k.startswith("export_orders/")]
    assert not [k for k in user_store if k.startswith("settlements/")]


async def test_export_readiness_profile_roundtrip(client, user_store):
    farmer_tok = _seed_user(user_store, "uid-f1", "Farmer F1", active="farmer")

    empty = await client.get("/v1/exporter/readiness/mine", headers=_auth(farmer_tok))
    assert empty.status_code == 200
    assert empty.json()["crops"] == []

    saved = await client.put(
        "/v1/exporter/readiness/mine",
        json={
            "crops": [
                {"crop": "Onion", "normalQuantity": 50, "unit": "quintal",
                 "availableFrom": AVAILABLE_DATE, "availableTo": WINDOW["to"]}
            ],
            "district": "Nashik",
            "state": "Maharashtra",
            "certifications": ["GlobalGAP"],
            "residueTestRefs": ["lab-report-1"],
            "packagingCapability": "Mesh bags",
            "previousExportExperience": "One export consignment",
        },
        headers=_auth(farmer_tok),
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["crops"][0]["crop"] == "Onion"

    loaded = await client.get("/v1/exporter/readiness/mine", headers=_auth(farmer_tok))
    assert loaded.json()["certifications"] == ["GlobalGAP"]
    assert loaded.json()["packagingCapability"] == "Mesh bags"

    # exporters cannot use the farmer readiness surface
    token = await _exporter_token(client, user_store, uid="uid-e2")
    denied = await client.get("/v1/exporter/readiness/mine", headers=_auth(token))
    assert denied.status_code == 403
