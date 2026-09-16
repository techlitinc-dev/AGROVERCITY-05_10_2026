from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.core.security import verify_mpin
from app.models.contracts import AcceptContractRequest, AcceptContractResponse, ContractOut
from app.routers.users import require_role
from app.services.users import get_user

router = APIRouter(prefix="/contracts", tags=["contracts"])


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def _contract_viewer(uid: str = Depends(current_user_id)) -> dict:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer", "seller", "broker")
    return user


async def _contract_signer(uid: str = Depends(current_user_id)) -> dict:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer", "seller")
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
    data = [ContractOut(**d).model_dump(exclude_none=True) for d in docs[start:start + pageSize]]
    return {"data": data, "page": page, "pageSize": pageSize, "total": total}


@router.get("/{contract_id}", response_model=ContractOut)
async def get_contract(contract_id: str, user: dict = Depends(_contract_viewer)):
    doc = await get_doc("contracts", contract_id)
    if doc is None:
        _error(404, "CONTRACT_NOT_FOUND", "contract not found")
    return doc


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
    if contract.get("status") != "open":
        _error(409, "CONTRACT_NOT_OPEN", "contract is not open for acceptance")
    uid = user["id"]
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
    contract["status"] = "accepted"
    contract["acceptedBy"] = uid
    await set_doc("contracts", contract_id, contract)
    return AcceptContractResponse(ok=True, status="accepted", contractId=contract_id)
