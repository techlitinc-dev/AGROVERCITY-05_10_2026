import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Response

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.core.security import verify_mpin
from app.models.contracts import (
    AcceptContractRequest,
    AcceptContractResponse,
    ContractCancel,
    ContractCreate,
    ContractDecline,
    ContractOut,
    ContractUpdate,
    DeliveryCreate,
)
from app.routers.users import require_role
from app.services.ai import config_store, decision_log, gateway, question_sets
from app.services.ai import outcomes as ai_outcomes
from app.services.ai.privacy import build_contract_attractiveness_state
from app.services.notify import notify_user
from app.services.tasks import DEEP_LINKS, emit_task
from app.services.users import get_user

log = logging.getLogger(__name__)

router = APIRouter(prefix="/contracts", tags=["contracts"])

TERMINAL_STATUSES = ("cancelled", "declined")

# --- WS-07 M18 — contract attractiveness -----------------------------------
# Scores the contract's expected income vs the 12-week mandi trend + agronomy
# risk flags for the farmer grow-for-us card. The explanation is cached per
# `decisionId` on the contract doc: a second read makes NO new gateway call and
# writes no new `ai_decisions` row. Automation stays at `suggest`, and the e-sign
# flow is untouched (hook calls only).
CONTRACT_ATTRACTIVENESS_MODULE = "contracts_attractiveness"
CONTRACT_ATTRACTIVENESS_QUESTION_SET = "contracts.attractiveness.v1"
CONTRACT_ATTRACTIVENESS_WINDOW_DAYS = 84  # ≈12 weeks


# WS-02 step 7 — corporate-buyer KYC gate. Food businesses need FSSAI,
# exporters need IEC/APEDA, everyone else needs GST. Checked against the
# phase-00 `kyc_cases` pipeline; the admin verification queue is phase-07.
BUYER_KYC_DOCS: dict[str, set[str]] = {
    "processor": {"fssai"},
    "hotel": {"fssai"},
    "institutional": {"fssai"},
    "exporter": {"iec", "apeda"},
    "retailer": {"gst"},
    "wholesaler": {"gst"},
}
BUYER_KYC_DEFAULT: set[str] = {"gst"}
KYC_DOC_TYPES = ("fssai", "iec", "apeda", "gst")


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def _assert_buyer_kyc(uid: str):
    """Require an approved corporate-buyer KYC doc per the buyer's business
    type (FSSAI / IEC / APEDA / GST) before a contract can be created."""
    from app.services import kyc as kyc_service

    profile = await get_doc(f"users/{uid}/role_profiles", "directBuyer")
    if not profile:
        profile = await get_doc(f"users/{uid}/role_profiles", "seller") or {}
    buyer_type = (
        (profile or {}).get("buyerType")
        or (profile or {}).get("businessType")
        or (profile or {}).get("companyType")
        or ""
    ).lower()
    required = BUYER_KYC_DOCS.get(buyer_type, BUYER_KYC_DEFAULT)

    verified: set[str] = set()
    for case in await kyc_service.cases_for_user(uid):
        for doc in case.get("docs") or []:
            if doc.get("status") in ("verified", "approved"):
                doc_type = (doc.get("type") or doc.get("docType") or "").lower()
                if doc_type:
                    verified.add(doc_type)

    if not (required & verified):
        doc_type = sorted(required)[0]
        raise HTTPException(
            status_code=403,
            detail={
                "code": "KYC_REQUIRED",
                "message": (
                    "an approved corporate KYC document "
                    f"({', '.join(sorted(required))}) is required to create contracts"
                ),
                "deepLink": f"/dashboard/profile?section=kyc&docType={doc_type}",
            },
        )


async def _assert_contract_entitlement(uid: str):
    """WS-02 step 10: cap active contracts per the buyer org's plan
    (Free = 1, Pro = 5, Enterprise = unlimited). Over-limit raises the phase-00
    402 ENTITLEMENT_EXCEEDED envelope."""
    from app.services import billing
    from app.services.buyer_org import get_buyer_org_by_member

    org, _ = await get_buyer_org_by_member(uid)
    owner_uid = (org or {}).get("adminUid") or uid
    member_uids = {owner_uid}
    for member in (org or {}).get("members", []):
        if member.get("uid"):
            member_uids.add(member["uid"])

    plan = await billing.effective_plan(owner_uid, "directBuyer")
    limit = (plan.get("limits") or {}).get("contracts_active")
    if limit is None:
        return
    contracts = await query("contracts", [], limit=1000)
    active = [
        c
        for c in contracts
        if c.get("buyerId") in member_uids and c.get("status") not in ("cancelled", "declined")
    ]
    if len(active) >= int(limit):
        billing._raise_over_limit(plan, "contracts_active", int(limit), len(active))


async def _notify(uid: str | None, *, type: str, title: str, body: str, path: str | None = None):
    if not uid:
        return
    try:
        await notify_user(uid, type=type, title=title, body=body, path=path)
    except Exception:
        pass  # notifications are best-effort — never break the contract flow


def _modal_from_docs(crop: str, mandi_name: str, mandi_docs: list[dict]) -> float | None:
    crop_l = (crop or "").lower()
    mandi_l = (mandi_name or "").lower()
    matches = [
        d
        for d in mandi_docs
        if crop_l in (d.get("commodity") or "").lower()
        and (not mandi_l or mandi_l in (d.get("mandiName") or d.get("mandi") or "").lower())
    ]
    if not matches:
        return None
    return round(sum(d.get("modalPrice", 0) for d in matches) / len(matches), 2)


def _price_from_docs(contract: dict, mandi_docs: list[dict]) -> float | None:
    price_type = contract.get("priceType")
    if not price_type:
        return None
    if price_type == "fixed":
        return contract.get("baseRate")
    modal = _modal_from_docs(contract.get("crop"), contract.get("mandiName"), mandi_docs)
    if modal is None:
        return None
    return round(modal + (contract.get("premiumPerQuintal") or 0), 2)


async def _enrich_with_current_price(contracts: list[dict]) -> list[dict]:
    if not any(c.get("priceType") for c in contracts):
        return contracts
    mandi_docs = await query("mandi_prices", [], limit=1000)
    return [{**c, "currentPrice": _price_from_docs(c, mandi_docs)} for c in contracts]


async def _build_mandi_trend(crop: str, mandi_name: str) -> list[dict]:
    """12-week mandi trend series for the contract crop (M18 state input).

    Reads `mandi_price_history` when present; falls back to the current
    `mandi_prices` modal as a single-point series so the score still computes."""
    crop_l = (crop or "").lower()
    mandi_l = (mandi_name or "").lower()

    def _matches(doc: dict) -> bool:
        if crop_l and crop_l not in (doc.get("commodity") or "").lower():
            return False
        if mandi_l and mandi_l not in (doc.get("mandiName") or doc.get("mandi") or "").lower():
            return False
        return True

    points: list[dict] = []
    for doc in await query("mandi_price_history", [], limit=10000):
        if not _matches(doc):
            continue
        modal = float(doc.get("modalPrice") or 0.0)
        if modal > 0:
            points.append({"date": str(doc.get("date") or ""), "modalPrice": modal})
    points.sort(key=lambda p: p["date"])
    if points:
        latest = points[-1]["date"]
        try:
            cutoff = (
                datetime.fromisoformat(latest) - timedelta(days=CONTRACT_ATTRACTIVENESS_WINDOW_DAYS)
            ).date().isoformat()
            points = [p for p in points if not p["date"] or p["date"] >= cutoff]
        except (TypeError, ValueError):
            pass
        return points[-12:]

    mandi_docs = [d for d in await query("mandi_prices", [], limit=1000) if _matches(d)]
    if mandi_docs:
        modal = round(
            sum(float(d.get("modalPrice") or 0.0) for d in mandi_docs) / len(mandi_docs), 2
        )
        return [{"date": "", "modalPrice": modal}]
    return []


async def _farmer_crop_history(farmer_id: str, exclude_contract_id: str | None) -> list[dict]:
    if not farmer_id:
        return []
    docs = await query("contracts", [("farmerId", "==", farmer_id)], limit=200)
    return [{"crop": d.get("crop")} for d in docs if d.get("id") != exclude_contract_id]


async def attach_contract_attractiveness(contract: dict, *, persist: bool = True) -> dict | None:
    """M18 — compute/attach the `attractiveness` annotation on a contract.

    Returns the annotation, or None when the `contracts_attractiveness` flag is
    off (the contract is unchanged). The explanation is cached per `decisionId`
    stored on the doc: a second read is a pure cache hit (no gateway call, no new
    `ai_decisions` row). Provider failures degrade to the deterministic fallback,
    logged with `fallbackUsed`. This never touches status or the e-sign flow.
    """
    if not await config_store.module_enabled(CONTRACT_ATTRACTIVENESS_MODULE):
        return None

    cached = contract.get("attractiveness")
    if isinstance(cached, dict) and cached.get("decisionId"):
        return cached

    mandi_trend = await _build_mandi_trend(contract.get("crop"), contract.get("mandiName"))
    crop_history = await _farmer_crop_history(contract.get("farmerId"), contract.get("id"))
    state = build_contract_attractiveness_state(contract, mandi_trend, crop_history)
    try:
        decision = await gateway.decide(
            state,
            CONTRACT_ATTRACTIVENESS_QUESTION_SET,
            ctx=contract.get("farmerId"),
            module=CONTRACT_ATTRACTIVENESS_MODULE,
        )
        answers = dict(decision.answers or {})
        confidence = float(decision.confidence or 0.0)
        decision_id = decision.decision_id
    except Exception as exc:  # noqa: BLE001 — degrade, never break the contract flow
        log.warning("contract attractiveness decide failed (%s) — degrading to fallback", exc)
        answers = question_sets.fallback_answers(CONTRACT_ATTRACTIVENESS_QUESTION_SET, state)
        confidence = 0.0
        decision_id = await decision_log.log_decision(
            module=CONTRACT_ATTRACTIVENESS_MODULE,
            question_set_id=CONTRACT_ATTRACTIVENESS_QUESTION_SET,
            version="v1",
            state=state,
            answers=answers,
            confidence=0.0,
            latency_ms=0,
            cost_usd=0.0,
            model="none",
            source="fallback",
            fallback_used=True,
        )

    annotation = {
        "incomeVsMandi": round(float(answers.get("incomeVsMandi") or 0.0), 2),
        "riskFlags": [str(flag) for flag in (answers.get("riskFlags") or [])],
        "explanation": str(answers.get("explanation") or ""),
        "confidence": round(confidence, 3),
        "decisionId": decision_id,
    }
    contract["attractiveness"] = annotation
    if persist and contract.get("id"):
        await set_doc("contracts", contract["id"], contract)
    return annotation


async def _enrich_with_attractiveness(contracts: list[dict]) -> list[dict]:
    for contract in contracts:
        await attach_contract_attractiveness(contract)
    return contracts


async def _record_attractiveness_outcome(contract: dict, outcome: str) -> None:
    """M18 outcome hook (task 7.24) — call from the accept/decline handlers.

    Hook call only: it never touches the e-sign logic or the contract status.
    """
    contract_id = contract.get("id")
    if not contract_id:
        return
    try:
        await ai_outcomes.record_attractiveness_outcome(
            contract_id,
            outcome,
            decision_id=(contract.get("attractiveness") or {}).get("decisionId"),
        )
    except Exception as exc:  # noqa: BLE001 — bookkeeping must not block a decision
        log.warning("contract attractiveness outcome hook failed (%s)", exc)


def _validate_price_rule(doc: dict):
    if doc.get("priceType") == "fixed" and not (doc.get("baseRate") or 0) > 0:
        _error(422, "VALIDATION_ERROR", "baseRate is required for fixed contracts", {"baseRate": "baseRate > 0 is required when priceType is fixed"})
    if doc.get("priceType") == "mandiLinked" and not (doc.get("mandiName") or "").strip():
        _error(422, "VALIDATION_ERROR", "mandiName is required for mandi-linked contracts", {"mandiName": "mandiName is required when priceType is mandiLinked"})


def _sync_legacy_mirror(doc: dict):
    """New targeted contracts still populate the legacy seed fields so the
    original ContractOut shape (buyerRating, lockedRateQuintal, ...) validates."""
    if doc.get("baseRate") is not None:
        doc["lockedRateQuintal"] = doc["baseRate"]
    else:
        doc.setdefault("lockedRateQuintal", 0)
    if doc.get("quantityTotal") is not None:
        doc["minQuantityQuintals"] = doc["quantityTotal"]
    schedule = doc.get("schedule") or {}
    if schedule:
        doc["contractDuration"] = f"{schedule.get('startDate', '')} → {schedule.get('endDate', '')} ({schedule.get('frequency', '')})"
    if doc.get("paymentTermsDays") is not None:
        doc["paymentTerms"] = f"Net {doc['paymentTermsDays']} days" if doc["paymentTermsDays"] > 0 else "On delivery"
    if doc.get("premiumPerQuintal"):
        doc["premiumAboveMSP"] = f"+₹{doc['premiumPerQuintal']}/Quintal"


async def _contract_viewer(uid: str = Depends(current_user_id)) -> dict:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer", "seller", "broker", "directBuyer")
    return user


async def _contract_signer(uid: str = Depends(current_user_id)) -> dict:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer", "seller")
    return user


async def _contract_buyer(uid: str = Depends(current_user_id)) -> dict:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "directBuyer", "seller")
    return user


@router.get("")
async def list_contracts(
    status: str | None = None,
    page: int = 1,
    pageSize: int = 20,
    user: dict = Depends(_contract_viewer),
):
    docs = await query("contracts", [], limit=1000)
    if status:
        docs = [d for d in docs if d.get("status") == status]
    total = len(docs)
    start = (page - 1) * pageSize
    page_docs = docs[start:start + pageSize]
    page_docs = await _enrich_with_current_price(page_docs)
    data = [ContractOut(**d).model_dump(exclude_none=True) for d in page_docs]
    return {"data": data, "page": page, "pageSize": pageSize, "total": total}


@router.post("", status_code=201)
async def create_contract(body: ContractCreate, user: dict = Depends(_contract_buyer)):
    uid = user["id"]
    from app.services.buyer_org import require_org_role
    await require_org_role(uid, "procurement", "admin")
    await _assert_buyer_kyc(uid)
    await _assert_contract_entitlement(uid)
    farmer = await get_doc("users", body.farmerId)
    if farmer is None:
        _error(404, "FARMER_NOT_FOUND", "farmer not found")
    doc = body.model_dump()
    if doc.get("specId") and not doc.get("specSnapshot"):
        spec = await get_doc("crop_specs", doc["specId"])
        if spec:
            doc["specSnapshot"] = spec
    _validate_price_rule(doc)

    buyer_company = user.get("name") or "Buyer"
    direct_profile = await get_doc(f"users/{uid}/role_profiles", "directBuyer")
    if direct_profile and direct_profile.get("companyName"):
        buyer_company = direct_profile["companyName"]
    else:
        seller_profile = await get_doc(f"users/{uid}/role_profiles", "seller")
        if seller_profile and seller_profile.get("shopName"):
            buyer_company = seller_profile["shopName"]

    contract_id = f"con_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    doc.update(
        {
            "id": contract_id,
            "buyerId": uid,
            "buyerCompany": buyer_company,
            "buyerRating": 0,
            "mspCurrentRate": 0,
            "premiumAboveMSP": "",
            "status": "offered",
            "deliveries": [],
            "deliveriesGenerated": 0,
            "createdAt": now,
            "updatedAt": now,
        }
    )
    _sync_legacy_mirror(doc)
    await set_doc("contracts", contract_id, doc)
    # WS-07 M18 — annotate the grow-for-us card with the attractiveness score
    # (cached on the doc). Never blocks creation.
    await attach_contract_attractiveness(doc)
    await _notify(
        body.farmerId,
        type="contract_offer_received",
        title="Contract offer / अनुबंध ऑफर",
        body=f"{buyer_company} offered a contract: {body.crop} × {body.quantityTotal}q",
        path=f"/dashboard/p/myContracts/{contract_id}",
    )
    return ContractOut(**doc).model_dump(exclude_none=True)


@router.get("/mine")
async def my_contracts(
    role: str = "buyer",
    status: str | None = None,
    user: dict = Depends(_contract_viewer),
):
    uid = user["id"]
    if role == "buyer":
        require_role(user, "directBuyer", "seller")
        docs = await query("contracts", [("buyerId", "==", uid)], limit=1000)
    elif role == "farmer":
        require_role(user, "farmer")
        docs = await query("contracts", [("farmerId", "==", uid)], limit=1000)
    else:
        _error(422, "VALIDATION_ERROR", "role must be buyer or farmer", {"role": "must be buyer or farmer"})
    if status:
        docs = [d for d in docs if d.get("status") == status]
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    docs = await _enrich_with_current_price(docs)
    docs = await _enrich_with_attractiveness(docs)
    return {"data": docs, "total": len(docs)}


@router.get("/{contract_id}", response_model=ContractOut)
async def get_contract(contract_id: str, user: dict = Depends(_contract_viewer)):
    doc = await get_doc("contracts", contract_id)
    if doc is None:
        _error(404, "CONTRACT_NOT_FOUND", "contract not found")
    doc = (await _enrich_with_current_price([doc]))[0]
    return doc


@router.put("/{contract_id}")
async def update_contract(contract_id: str, body: ContractUpdate, user: dict = Depends(_contract_buyer)):
    uid = user["id"]
    doc = await get_doc("contracts", contract_id)
    if doc is None:
        _error(404, "CONTRACT_NOT_FOUND", "contract not found")
    from app.services.buyer_org import require_org_role
    await require_org_role(uid, "procurement", "admin", org_owner_uid=doc.get("buyerId"))
    if doc.get("status") != "offered":
        _error(409, "CONTRACT_NOT_OPEN", "only offered contracts can be edited")
    updates = body.model_dump(exclude_unset=True, exclude_none=True)
    doc.update(updates)
    _validate_price_rule(doc)
    _sync_legacy_mirror(doc)
    # WS-07 M18 — terms changed, so drop the cached score and re-score on write.
    doc.pop("attractiveness", None)
    doc["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("contracts", contract_id, doc)
    await attach_contract_attractiveness(doc)
    doc = (await _enrich_with_current_price([doc]))[0]
    return ContractOut(**doc).model_dump(exclude_none=True)


@router.post("/{contract_id}/cancel")
async def cancel_contract(contract_id: str, body: ContractCancel, user: dict = Depends(_contract_buyer)):
    uid = user["id"]
    doc = await get_doc("contracts", contract_id)
    if doc is None:
        _error(404, "CONTRACT_NOT_FOUND", "contract not found")
    if doc.get("buyerId") != uid:
        _error(403, "FORBIDDEN", "only the offering buyer can cancel this contract")
    if doc.get("status") in TERMINAL_STATUSES:
        _error(409, "CONTRACT_NOT_OPEN", "contract is already closed")
    doc["status"] = "cancelled"
    doc["cancelReason"] = body.reason
    doc["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("contracts", contract_id, doc)
    await _notify(
        doc.get("farmerId"),
        type="contract_cancelled",
        title="Contract cancelled / अनुबंध रद्द",
        body=f"{doc.get('buyerCompany', 'Buyer')} cancelled the {doc.get('crop', '')} contract",
        path=f"/dashboard/p/myContracts/{contract_id}",
    )
    return ContractOut(**doc).model_dump(exclude_none=True)


@router.post("/{contract_id}/decline")
async def decline_contract(contract_id: str, body: ContractDecline, user: dict = Depends(_contract_signer)):
    uid = user["id"]
    doc = await get_doc("contracts", contract_id)
    if doc is None:
        _error(404, "CONTRACT_NOT_FOUND", "contract not found")
    require_role(user, "farmer")
    if not doc.get("farmerId") or doc.get("farmerId") != uid:
        _error(403, "FORBIDDEN", "this contract is not offered to you")
    if doc.get("status") != "offered":
        _error(409, "CONTRACT_NOT_OPEN", "contract is not open for a decision")
    doc["status"] = "declined"
    doc["declineReason"] = body.reason
    doc["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await set_doc("contracts", contract_id, doc)
    await _record_attractiveness_outcome(doc, "declined")
    await _notify(
        doc.get("buyerId"),
        type="contract_declined",
        title="Contract declined / अनुबंध अस्वीकृत",
        body=f"{user.get('name', 'Farmer')} declined the {doc.get('crop', '')} contract",
        path=f"/dashboard/p/contracts/{contract_id}",
    )
    return ContractOut(**doc).model_dump(exclude_none=True)


@router.post("/{contract_id}/accept", response_model=AcceptContractResponse)
async def accept_contract(
    contract_id: str,
    body: AcceptContractRequest,
    user: dict = Depends(_contract_signer),
):
    contract = await get_doc("contracts", contract_id)
    if contract is None:
        _error(404, "CONTRACT_NOT_FOUND", "contract not found")
    if user.get("mpinHash") is None:
        _error(409, "MPIN_NOT_SET", "MPIN is not set for this account")
    if not verify_mpin(body.mpin, user["mpinHash"]):
        _error(401, "WRONG_MPIN", "incorrect MPIN")
    uid = user["id"]
    targeted = contract.get("farmerId")
    if targeted and targeted != uid:
        _error(403, "FORBIDDEN", "this contract is not offered to you")
    if targeted:
        if contract.get("status") != "offered":
            _error(409, "CONTRACT_NOT_OPEN", "contract is not open for acceptance")
    elif contract.get("status") != "open":
        _error(409, "CONTRACT_NOT_OPEN", "contract is not open for acceptance")
    now = datetime.now(timezone.utc).isoformat()
    await set_doc(
        f"contracts/{contract_id}/acceptances",
        uid,
        {
            "userId": uid,
            "signatureData": body.signatureData,
            "consentTimestamp": body.consentTimestamp,
            "acceptedAt": now,
        },
    )
    contract["status"] = "active" if targeted else "accepted"
    contract["acceptedBy"] = uid
    contract["acceptedAt"] = now
    await set_doc("contracts", contract_id, contract)
    await _record_attractiveness_outcome(contract, "accepted")
    await _notify(
        contract.get("buyerId"),
        type="contract_accepted",
        title="Contract accepted / अनुबंध स्वीकृत",
        body=f"{user.get('name', 'Farmer')} accepted the {contract.get('crop', '')} contract",
        path=f"/dashboard/p/contracts/{contract_id}",
    )
    return AcceptContractResponse(ok=True, status=contract["status"], contractId=contract_id)


@router.post("/{contract_id}/deliveries")
async def create_delivery(
    contract_id: str,
    body: DeliveryCreate,
    response: Response,
    user: dict = Depends(_contract_buyer),
):
    uid = user["id"]
    contract = await get_doc("contracts", contract_id)
    if contract is None:
        _error(404, "CONTRACT_NOT_FOUND", "contract not found")
    if contract.get("buyerId") != uid:
        _error(403, "FORBIDDEN", "only the contract buyer can generate deliveries")
    if contract.get("status") != "active":
        _error(409, "CONTRACT_NOT_OPEN", "deliveries can only be generated for active contracts")

    deliveries = list(contract.get("deliveries") or [])
    existing = next((d for d in deliveries if d.get("slotDate") == body.slotDate), None)
    if existing:
        response.status_code = 200
        return await get_doc("purchases", existing["purchaseId"]) or existing

    mandi_docs = await query("mandi_prices", [], limit=1000)
    price_type = contract.get("priceType")
    if price_type == "fixed":
        rate = contract.get("baseRate") or 0
    elif price_type == "mandiLinked":
        modal = _modal_from_docs(contract.get("crop"), contract.get("mandiName"), mandi_docs)
        if modal is None:
            _error(422, "NO_MANDI_DATA", "no mandi data available for the contract crop", {"priceType": "no mandi data for this crop and mandi"})
        rate = round(modal + (contract.get("premiumPerQuintal") or 0), 2)
    else:
        rate = contract.get("baseRate") or contract.get("lockedRateQuintal") or 0

    qty = (contract.get("schedule") or {}).get("qtyPerDelivery") or 0
    farmer = await get_doc("users", contract.get("farmerId") or "") or {}
    purchase_id = f"pur_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    purchase = {
        "id": purchase_id,
        "buyerId": uid,
        "buyerName": contract.get("buyerCompany", ""),
        "farmerId": contract.get("farmerId"),
        "farmerName": farmer.get("name", ""),
        "source": {"type": "contract", "refId": contract_id},
        "crop": contract.get("crop", ""),
        "variety": "",
        "quantity": qty,
        "unit": "quintal",
        "agreedPricePerUnit": rate,
        "totalAmount": round(rate * qty, 2),
        "advancePaid": 0,
        "status": "confirmed",
        "pickup": None,
        "payments": [],
        "qc": None,
        "finalAmount": None,
        "invoice": None,
        "events": [{"status": "confirmed", "at": now, "note": "contract delivery"}],
        "rating": {"buyerToFarmer": None, "farmerToBuyer": None},
        "escrow": {
            "status": "unfunded",
            "amount": 0,
            "method": "",
            "reference": "",
            "fundedAt": None,
            "releasedAt": None,
            "refundedAt": None,
            "commission": 0,
            "netRelease": 0,
        },
        "handover": {
            "otp": None,
            "generatedAt": None,
            "expiresAt": None,
            "verifiedAt": None,
            "attempts": 0,
        },
        "contractId": contract_id,
        "deliverySlot": body.slotDate,
        "specSnapshot": contract.get("specSnapshot"),
        "createdAt": now,
        "updatedAt": now,
    }
    await set_doc("purchases", purchase_id, purchase)

    deliveries.append({"slotDate": body.slotDate, "purchaseId": purchase_id})
    contract["deliveries"] = deliveries
    contract["deliveriesGenerated"] = (contract.get("deliveriesGenerated") or 0) + 1
    contract["updatedAt"] = now
    await set_doc("contracts", contract_id, contract)
    # WS-05 task emission (module: contracts) — delivery due for the farmer.
    if contract.get("farmerId"):
        await emit_task(
            contract["farmerId"],
            persona="farmer",
            module="contracts",
            kind="contract_delivery_due",
            title_en="Contract delivery due",
            title_hi="अनुबंध डिलीवरी देय",
            subtitle=f"{contract.get('crop', '')} — {qty}q on {body.slotDate}",
            priority="today",
            deep_link=f"{DEEP_LINKS['my_contracts']}/{contract_id}",
            source_id=f"{contract_id}:{body.slotDate}",
            due_at=body.slotDate,
        )

    await _notify(
        contract.get("farmerId"),
        type="booking_confirmed",
        title="Delivery booked / डिलीवरी बुक",
        body=f"{contract.get('crop', '')} — {qty}q on {body.slotDate}",
        path=f"/dashboard/p/purchases/{purchase_id}",
    )
    response.status_code = 201
    return purchase


@router.get("/{contract_id}/deliveries")
async def list_deliveries(contract_id: str, user: dict = Depends(_contract_viewer)):
    uid = user["id"]
    contract = await get_doc("contracts", contract_id)
    if contract is None:
        _error(404, "CONTRACT_NOT_FOUND", "contract not found")
    if uid != contract.get("buyerId") and uid != contract.get("farmerId"):
        _error(403, "FORBIDDEN", "only contract participants can view deliveries")
    data = []
    completed = cancelled = 0
    for slot in contract.get("deliveries") or []:
        purchase = await get_doc("purchases", slot.get("purchaseId") or "")
        status = purchase.get("status") if purchase else "pending"
        if status == "completed":
            completed += 1
        elif status == "cancelled":
            cancelled += 1
        item = {"slotDate": slot.get("slotDate"), "purchaseId": slot.get("purchaseId"), "status": status}
        if purchase and purchase.get("finalAmount") is not None:
            item["finalAmount"] = purchase["finalAmount"]
        data.append(item)
    return {
        "data": data,
        "fulfilment": {
            "total": len(data),
            "completed": completed,
            "cancelled": cancelled,
            "pending": len(data) - completed - cancelled,
        },
    }
