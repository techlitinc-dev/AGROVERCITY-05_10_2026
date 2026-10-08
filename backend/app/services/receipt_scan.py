"""M28 receipt / weigh-slip scan (phase-08 WS-01).

Extracts structured diary-entry fields from an uploaded receipt photo via
`gateway.analyze_image()` (vision) with a Pydantic schema and exactly one repair
retry. CONFIRM-ONLY: the endpoint that calls this never writes a diary entry —
the UI prefills the form and the user taps save. Money is integer paisa (rule 3).
"""
import logging
import os
from typing import Literal

from pydantic import BaseModel, ValidationError

from app.services import storage
from app.services.ai import config_store, gateway

log = logging.getLogger(__name__)

MODULE = "receipt_scan"

RECEIPT_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "amount_paisa": {"type": "integer"},
        "category": {"type": "string"},
        "party": {"type": "string"},
        "date": {"type": "string"},
        "entry_type": {"type": "string", "enum": ["expense", "income"]},
    },
    "required": ["amount_paisa", "category", "party", "date", "entry_type"],
}


class ReceiptScanResult(BaseModel):
    amount_paisa: int
    category: str
    party: str
    date: str
    entry_type: Literal["expense", "income"]
    confidence: float = 0.0


class ReceiptScanUnavailable(Exception):
    """Raised when the receipt-scan module flag is off."""


def _validate(raw: dict) -> ReceiptScanResult | None:
    try:
        return ReceiptScanResult(**{k: raw.get(k) for k in ReceiptScanResult.model_fields if k in raw})
    except ValidationError:
        return None


PROMPT = (
    "You are a receipt parser. Read the attached shop receipt or weigh-slip and "
    "return JSON with keys amount_paisa (integer paisa, no symbols), category, "
    "party (shop/seller name), date (ISO YYYY-MM-DD), and entry_type "
    "('expense' or 'income'). Do not invent values; use best-effort from the image."
)


async def scan_receipt(storage_path: str) -> dict:
    """Return a validated prefilled diary-entry payload (never persists an entry)."""
    if not await config_store.module_enabled(MODULE):
        raise ReceiptScanUnavailable()

    image_bytes = storage.read_blob(storage_path)
    prompt = f"{PROMPT}\nFile: {os.path.basename(storage_path or 'receipt.jpg')}"
    raw = await gateway.analyze_image(image_bytes, prompt, RECEIPT_SCHEMA, module=MODULE)
    result = _validate(raw or {})
    if result is None:
        # Exactly one repair retry with an explicit JSON-only instruction.
        repair_prompt = (
            "Return ONLY valid JSON matching this schema "
            '{"amount_paisa": <int>, "category": "<str>", "party": "<str>", '
            '"date": "YYYY-MM-DD", "entry_type": "expense"|"income"}.'
        )
        raw = await gateway.analyze_image(image_bytes, repair_prompt, RECEIPT_SCHEMA, module=MODULE)
        result = _validate(raw or {})
    if result is None:
        raise ValueError("RECEIPT_EXTRACTION_FAILED")
    return result.model_dump()
