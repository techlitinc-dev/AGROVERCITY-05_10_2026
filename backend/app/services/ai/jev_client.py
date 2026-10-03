"""OpenRouter HTTP client for the Jev decision model (typesafe/jev-1.13).

One HTTP call per decide() batching all questions (ai_implementation_plan §1.1).
Gateway owns retries/timeouts; this client is a thin transport.
"""
import json
import logging

import httpx

from app.core.config import settings

log = logging.getLogger(__name__)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
JEV_TIMEOUT_SECONDS = 2.0

DECIDE_SYSTEM_PROMPT = (
    "You are a decision model for an Indian agri-platform. Answer every question "
    "as JSON: {\"answers\": {<questionId>: <answer>}, \"confidence\": 0.0-1.0}. "
    "Use only the provided state; never invent facts."
)


class JevClient:
    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.api_key = api_key or settings.openrouter_api_key
        self.model = model or settings.ai_jev_model
        self.timeout = JEV_TIMEOUT_SECONDS

    async def decide(self, questions: list[dict], state: dict, ctx: str | None = None) -> dict:
        if not self.api_key:
            raise RuntimeError("OPENROUTER_API_KEY is not configured")
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": DECIDE_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": json.dumps(
                        {"questions": questions, "state": state, "context": ctx},
                        ensure_ascii=False,
                        default=str,
                    ),
                },
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.0,
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "HTTP-Referer": "https://agrovercity.in",
            "X-Title": "AGROVERCITY",
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(OPENROUTER_URL, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
        content = (data.get("choices") or [{}])[0].get("message", {}).get("content") or "{}"
        parsed = json.loads(content)
        if not isinstance(parsed, dict):
            raise ValueError("jev response is not a JSON object")
        return {
            "answers": parsed.get("answers") or {},
            "confidence": float(parsed.get("confidence", 0.0)),
        }
