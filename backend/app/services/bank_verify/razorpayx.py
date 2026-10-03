"""Real penny-drop adapter via RazorpayX fund-account validation (WS-03).

Selected when BANK_VERIFY_PROVIDER=razorpayx (staging/prod). The stub adapter
is only allowed in dev/test.
"""
import logging

import httpx

from app.core.config import settings
from app.services.bank_verify.base import BankVerifyAdapter

logger = logging.getLogger(__name__)

RAZORPAYX_VALIDATIONS_URL = "https://api.razorpay.com/v1/fund_accounts/validations"


class RazorpayXBankVerifyAdapter(BankVerifyAdapter):
    async def penny_drop(self, account_number: str, ifsc: str, account_holder: str) -> dict:
        if not settings.razorpay_key_id or not settings.razorpay_key_secret:
            raise ValueError("razorpayx bank verification is not configured")
        payload = {
            "account_number": account_number,
            "ifsc": ifsc,
            "name": account_holder,
        }
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                RAZORPAYX_VALIDATIONS_URL,
                auth=(settings.razorpay_key_id, settings.razorpay_key_secret),
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
        result = data.get("results") or {}
        account_status = result.get("account_status")
        name_match = result.get("name_match_score")
        verified = data.get("status") == "completed" and account_status == "active"
        logger.info(
            "razorpayx penny-drop status=%s for %s", data.get("status"), account_number[-4:]
        )
        return {
            "verified": verified,
            "accountHolderMatch": bool(name_match and float(name_match) >= 0.5),
        }
