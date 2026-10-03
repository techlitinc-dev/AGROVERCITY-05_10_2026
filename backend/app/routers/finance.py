import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.models.finance import (
    CreditScoreOut,
    KccOut,
    LoanApplyIn,
    LoanApplyOut,
    LoanCalcIn,
    LoanCalcOut,
)
from app.models.loans import LoanApplicationOut
from app.routers.users import require_role
from app.services import loans as loans_service
from app.services.users import get_user

router = APIRouter(prefix="/finance", tags=["finance"])

TIER_LIMITS = {"Bronze": 25000, "Silver": 50000, "Gold": 100000, "Platinum": 200000}
FACTORS = ["Timely KCC repayment", "Crop insurance coverage", "3-season income history"]


def _error(status_code: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": field_errors or {}},
    )


async def _any_user(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    return uid


async def _farmer(uid: str = Depends(current_user_id)) -> str:
    user = await get_user(uid)
    if user is None:
        _error(404, "NOT_FOUND", "user not found")
    require_role(user, "farmer")
    return uid


@router.get("/credit-score", response_model=CreditScoreOut)
async def credit_score(uid: str = Depends(_any_user)):
    user = await get_user(uid)
    score = user.get("kisanCreditScore") or 650
    tier = user.get("creditTier") or "Silver"
    return CreditScoreOut(
        kisanCreditScore=score,
        creditTier=tier,
        creditLimit=TIER_LIMITS.get(tier, 50000),
        factors=FACTORS,
    )


@router.post("/loan-calculator", response_model=LoanCalcOut)
async def loan_calculator(body: LoanCalcIn, uid: str = Depends(_any_user)):
    n = body.tenureMonths
    r = body.interestRate / 12 / 100
    emi = body.amount * r * (1 + r) ** n / ((1 + r) ** n - 1)
    emi = round(emi, 2)
    total_payable = round(emi * n, 2)
    return LoanCalcOut(
        emi=emi,
        totalInterest=round(total_payable - body.amount, 2),
        totalPayable=total_payable,
    )


@router.get("/kcc", response_model=KccOut)
async def kcc(uid: str = Depends(_farmer)):
    user = await get_user(uid)
    kcc_limit = user.get("kccLimit") or 0
    if not kcc_limit:
        _error(404, "KCC_NOT_FOUND", "no KCC linked to this account")
    phone = user.get("phone", "")
    return KccOut(
        bankName=user.get("bankName", ""),
        cardNumberMasked="XXXX-XXXX-" + phone[-4:],
        kccLimit=kcc_limit,
        availableLimit=kcc_limit,
    )


@router.post("/loans/apply", status_code=201, response_model=LoanApplyOut)
async def apply_loan(body: LoanApplyIn, uid: str = Depends(_farmer)):
    user = await get_user(uid)
    bank_account_id = None
    bank_account_last4 = None
    bank_ifsc = None
    if body.bankAccountId:
        account = await get_doc(f"users/{uid}/bank_accounts", body.bankAccountId)
        if account is None:
            _error(404, "BANK_ACCOUNT_NOT_FOUND", "bank account not found")
        bank_account_id = body.bankAccountId
        bank_account_last4 = str(account["accountNumber"])[-4:]
        bank_ifsc = account.get("ifsc")
    score = (user or {}).get("kisanCreditScore") or 650
    now = datetime.now(timezone.utc).isoformat()
    application_id = uuid.uuid4().hex
    loan = {
        **body.model_dump(),
        "id": application_id,
        "userId": uid,
        "status": "submitted",
        "statusText": loans_service.LOAN_STATUS_TEXT["submitted"],
        "farmerName": (user or {}).get("name") or (user or {}).get("phone"),
        "farmerPhone": (user or {}).get("phone"),
        "farmerCreditScore": score,
        "farmerCreditTier": (user or {}).get("creditTier") or loans_service.tier_for_score(score),
        "applicationNumber": await loans_service.next_application_number(),
        "bankAccountLast4": bank_account_last4,
        "bankIfsc": bank_ifsc,
        "documents": [],
        "timeline": [
            {
                "status": "submitted",
                "statusText": loans_service.LOAN_STATUS_TEXT["submitted"],
                "note": None,
                "at": now,
                "by": uid,
            }
        ],
        "createdAt": now,
        "updatedAt": None,
    }
    if bank_account_id:
        loan["bankAccountId"] = bank_account_id
    await set_doc("loan_applications", application_id, loan)
    return LoanApplyOut(applicationId=application_id, status="submitted")


@router.get("/loans")
async def list_loans(uid: str = Depends(_farmer)):
    docs = await query("loan_applications", [("userId", "==", uid)], limit=1000)
    docs.sort(key=lambda d: d.get("createdAt", ""), reverse=True)
    data = [loans_service.to_out(d).model_dump() for d in docs]
    return {"data": data, "page": 1, "pageSize": 20, "total": len(data)}
