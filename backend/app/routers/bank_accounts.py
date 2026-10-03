"""Bank accounts: CRUD + penny-drop verify + set primary.

Encryption at rest is provided by Firestore (AES-256/GMEK by default).
Never log full account numbers — log the masked form only.
"""

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import delete_doc, get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.bank_accounts import BankAccountIn, BankAccountOut
from app.services.bank_verify import get_bank_verify_adapter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bank-accounts", tags=["bank-accounts"])


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


def _out(account: dict) -> BankAccountOut:
    return BankAccountOut(
        id=account["id"],
        accountHolder=account["accountHolder"],
        accountNumberMasked="XXXX" + account["accountNumber"][-4:],
        ifsc=account["ifsc"],
        bankName=account["bankName"],
        isPrimary=account.get("isPrimary", False),
        verifyStatus=account.get("verifyStatus", "unverified"),
        createdAt=account["createdAt"],
    )


async def _accounts(uid: str) -> list[dict]:
    return await query(f"users/{uid}/bank_accounts", [], limit=1000)


async def _require_account(uid: str, account_id: str) -> dict:
    account = await get_doc(f"users/{uid}/bank_accounts", account_id)
    if account is None:
        _error(404, "BANK_ACCOUNT_NOT_FOUND", "bank account not found")
    return account


@router.get("")
async def list_accounts(uid: str = Depends(current_user_id)):
    accounts = await _accounts(uid)
    accounts.sort(key=lambda a: (not a.get("isPrimary", False), a.get("createdAt", "")))
    return {
        "data": [_out(a).model_dump() for a in accounts],
        "page": 1,
        "pageSize": 20,
        "total": len(accounts),
    }


@router.post("", status_code=201, response_model=BankAccountOut)
async def create_account(body: BankAccountIn, uid: str = Depends(current_user_id)):
    existing = await _accounts(uid)
    account = {
        "id": uuid.uuid4().hex,
        **body.model_dump(),
        "isPrimary": len(existing) == 0,
        "verifyStatus": "unverified",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc(f"users/{uid}/bank_accounts", account["id"], account)
    return _out(account)


@router.post("/{account_id}/verify", response_model=BankAccountOut)
async def verify_account(account_id: str, uid: str = Depends(current_user_id)):
    account = await _require_account(uid, account_id)
    account["verifyStatus"] = "pending"
    await set_doc(f"users/{uid}/bank_accounts", account_id, account)
    adapter = get_bank_verify_adapter()
    result = await adapter.penny_drop(
        account["accountNumber"], account["ifsc"], account["accountHolder"]
    )
    account["verifyStatus"] = "verified" if result.get("verified") else "failed"
    # never log full account numbers
    logger.info(
        "penny-drop %s for %s", account["verifyStatus"], _out(account).accountNumberMasked
    )
    await set_doc(f"users/{uid}/bank_accounts", account_id, account)
    return _out(account)


@router.post("/{account_id}/set-primary")
async def set_primary(account_id: str, uid: str = Depends(current_user_id)):
    account = await _require_account(uid, account_id)
    for other in await _accounts(uid):
        flag = other["id"] == account_id
        if other.get("isPrimary", False) != flag:
            other["isPrimary"] = flag
            await set_doc(f"users/{uid}/bank_accounts", other["id"], other)
    return {"primaryId": account_id}


@router.delete("/{account_id}", status_code=204)
async def delete_account(account_id: str, uid: str = Depends(current_user_id)):
    account = await _require_account(uid, account_id)
    await delete_doc(f"users/{uid}/bank_accounts", account_id)
    if account.get("isPrimary"):
        remaining = await _accounts(uid)
        if remaining:
            remaining.sort(key=lambda a: a.get("createdAt", ""))
            oldest = remaining[0]
            oldest["isPrimary"] = True
            await set_doc(f"users/{uid}/bank_accounts", oldest["id"], oldest)
