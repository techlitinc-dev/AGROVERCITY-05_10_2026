import hashlib
import hmac

import httpx

from app.core.config import settings


def create_razorpay_order(amount_paise: int, receipt: str) -> dict:
    if not settings.razorpay_key_id:
        return {"id": f"order_dev_{receipt}", "amount": amount_paise, "currency": "INR", "status": "created"}
    resp = httpx.post(
        "https://api.razorpay.com/v1/orders",
        auth=(settings.razorpay_key_id, settings.razorpay_key_secret),
        json={"amount": amount_paise, "currency": "INR", "receipt": receipt},
    )
    return resp.json()


def verify_razorpay_signature(razorpay_order_id: str, razorpay_payment_id: str, signature: str) -> bool:
    if not settings.razorpay_key_secret:
        return False
    expected = hmac.new(
        settings.razorpay_key_secret.encode(),
        f"{razorpay_order_id}|{razorpay_payment_id}".encode(),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


async def refund_razorpay_payment(payment_id: str, amount_paise: int) -> dict:
    if not settings.razorpay_key_id:
        return {"id": f"rfnd_dev_{payment_id}", "status": "processed"}
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://api.razorpay.com/v1/payments/{payment_id}/refund",
            auth=(settings.razorpay_key_id, settings.razorpay_key_secret),
            json={"amount": amount_paise},
        )
    return resp.json()


def verify_razorpay_webhook(payload: bytes, signature: str) -> bool:
    """Verify the X-Razorpay-Signature header against the dedicated webhook
    secret. An unset secret never accepts a webhook."""
    if not settings.razorpay_webhook_secret:
        return False
    expected = hmac.new(
        settings.razorpay_webhook_secret.encode(), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


async def list_razorpay_payments(count: int = 100) -> list[dict]:
    """Razorpay payments list used by the nightly reconciliation job."""
    if not settings.razorpay_key_id:
        return []
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(
            "https://api.razorpay.com/v1/payments",
            params={"count": count},
            auth=(settings.razorpay_key_id, settings.razorpay_key_secret),
        )
        resp.raise_for_status()
        return resp.json().get("items", [])


async def create_razorpayx_payout(
    fund_account_id: str, amount_paise: int, reference_id: str
) -> dict:
    """RazorpayX payout to a verified fund account (WS-03 payout rail)."""
    if not settings.razorpay_key_id:
        return {"id": f"pout_dev_{reference_id}", "status": "processed", "dryRun": True}
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            "https://api.razorpay.com/v1/payouts",
            auth=(settings.razorpay_key_id, settings.razorpay_key_secret),
            json={
                "account_number": settings.razorpay_key_id,
                "fund_account_id": fund_account_id,
                "amount": amount_paise,
                "currency": "INR",
                "mode": "IMPS",
                "purpose": "payout",
                "queue_if_low_balance": True,
                "reference_id": reference_id,
            },
        )
    return resp.json()
