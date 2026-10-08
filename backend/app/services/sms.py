"""SMS fallback provider interface (WS-02).

`send_sms` dispatches on env `SMS_PROVIDER=msg91|twilio|stub` (default `stub`).
DLT template registration is still pending, so the stub — which only logs — is
the shipping default. DLT template IDs live in the admin-editable Firestore doc
`platform_config/sms_templates`.
"""
import logging
import os

import httpx

from app.core.db import get_doc

log = logging.getLogger(__name__)


async def get_template_id(name: str) -> str:
    doc = await get_doc("platform_config", "sms_templates") or {}
    return str(doc.get(name) or "")


async def _send_stub(phone: str, template_id: str, vars: dict) -> dict:
    log.info("sms stub: phone=%s template=%s vars=%s", phone, template_id, vars)
    return {"provider": "stub", "status": "logged"}


async def _send_msg91(phone: str, template_id: str, vars: dict) -> dict:
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            "https://api.msg91.com/api/v5/flow/",
            headers={"authkey": os.getenv("MSG91_AUTH_KEY", "")},
            json={"template_id": template_id, "recipients": [{"mobiles": phone, **vars}]},
        )
        response.raise_for_status()
    return {"provider": "msg91", "status": "sent"}


async def _send_twilio(phone: str, template_id: str, vars: dict) -> dict:
    sid = os.getenv("TWILIO_ACCOUNT_SID", "")
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json",
            auth=(sid, os.getenv("TWILIO_AUTH_TOKEN", "")),
            data={
                "To": phone,
                "From": os.getenv("TWILIO_FROM", ""),
                "Body": vars.get("body", template_id),
            },
        )
        response.raise_for_status()
    return {"provider": "twilio", "status": "sent"}


async def send_sms(phone: str, template_id: str, vars: dict) -> dict:
    provider = (os.getenv("SMS_PROVIDER") or "stub").lower()
    if provider == "msg91":
        return await _send_msg91(phone, template_id, vars)
    if provider == "twilio":
        return await _send_twilio(phone, template_id, vars)
    return await _send_stub(phone, template_id, vars)
