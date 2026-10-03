"""AI payload privacy sanitizers (global rule 11): no unmasked Aadhaar, phone
numbers, or emails ever leave for a model provider. IDs are HMAC-hashed."""
import hashlib
import hmac
import re

from app.core.config import settings

PHONE_RE = re.compile(r"(?:(?:\+?91[\s-]?)?[6-9]\d{9})\b")
EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
AADHAAR_RE = re.compile(r"(?<![\d+])\d{4}\s?\d{4}\s?\d{4}(?!\d)")

MAX_STATE_TOKENS = 1500
CHUNK_TOKENS = 8000


def hash_user_id(user_id: str) -> str:
    digest = hmac.new(
        settings.ai_hash_salt.encode(), (user_id or "").encode(), hashlib.sha256
    ).hexdigest()
    return digest[:32]


def _mask_aadhaar_match(match: re.Match) -> str:
    digits = re.sub(r"\s", "", match.group(0))
    return f"XXXX-XXXX-{digits[-4:]}"


def mask_aadhaar(text: str) -> str:
    return AADHAAR_RE.sub(_mask_aadhaar_match, text)


def sanitize_text(text: str) -> str:
    if not text:
        return text
    text = EMAIL_RE.sub("[email]", text)
    text = PHONE_RE.sub("[phone]", text)
    text = mask_aadhaar(text)
    return text


def sanitize_state(state):
    """Recursively strip phone/email patterns and mask Aadhaar numbers."""
    if isinstance(state, dict):
        return {key: sanitize_state(value) for key, value in state.items()}
    if isinstance(state, list):
        return [sanitize_state(item) for item in state]
    if isinstance(state, str):
        return sanitize_text(state)
    return state


def estimate_tokens(text: str) -> int:
    # Rough heuristic: ~4 characters per token.
    return max(1, len(text) // 4)


def trim_to_token_budget(text: str, max_tokens: int = MAX_STATE_TOKENS) -> str:
    if estimate_tokens(text) <= max_tokens:
        return text
    return text[: max_tokens * 4]


def chunk_text(text: str, chunk_tokens: int = CHUNK_TOKENS) -> list[str]:
    """Split oversized states (>32k Jev context limit) into ordered chunks."""
    chunk_chars = chunk_tokens * 4
    if len(text) <= chunk_chars:
        return [text]
    return [text[i : i + chunk_chars] for i in range(0, len(text), chunk_chars)]
