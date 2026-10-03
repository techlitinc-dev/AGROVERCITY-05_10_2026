import os

from app.core.config import settings
from app.services.bank_verify.base import BankVerifyAdapter
from app.services.bank_verify.razorpayx import RazorpayXBankVerifyAdapter
from app.services.bank_verify.stub import StubBankVerifyAdapter


def get_bank_verify_adapter() -> BankVerifyAdapter:
    name = os.environ.get("BANK_VERIFY_ADAPTER") or settings.bank_verify_provider
    if name == "stub":
        if settings.env not in ("dev", "test"):
            raise ValueError("the always-verified stub is only allowed in dev/test")
        return StubBankVerifyAdapter()
    if name == "razorpayx":
        return RazorpayXBankVerifyAdapter()
    raise ValueError(f"unknown bank_verify_provider: {name}")
