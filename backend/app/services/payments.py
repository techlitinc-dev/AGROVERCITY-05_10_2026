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
