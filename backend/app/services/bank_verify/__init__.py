import os

from app.services.bank_verify.base import BankVerifyAdapter
from app.services.bank_verify.stub import StubBankVerifyAdapter


def get_bank_verify_adapter() -> BankVerifyAdapter:
    # the real penny-drop provider (Razorpay/Cashfree) lands later; routers never change
    name = os.environ.get("BANK_VERIFY_ADAPTER", "stub")
    if name == "stub":
        return StubBankVerifyAdapter()
    raise ValueError(f"unknown BANK_VERIFY_ADAPTER: {name}")
