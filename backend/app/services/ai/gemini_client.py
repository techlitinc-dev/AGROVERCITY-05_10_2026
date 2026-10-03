"""Gemini wrapper via the google-genai SDK (AI Studio key direct — never
OpenRouter for Gemini). Used for generate / analyze_image / embed and token
counting for cost logging."""
import json
import logging

from app.core.config import settings

log = logging.getLogger(__name__)

GEMINI_TIMEOUT_SECONDS = 20.0


class GeminiClient:
    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.api_key = api_key or settings.gemini_api_key
        self.model = model or settings.ai_gemini_model

    def _client(self):
        if not self.api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured")
        from google import genai

        return genai.Client(api_key=self.api_key)

    async def generate(
        self,
        prompt: str,
        *,
        system: str | None = None,
        temperature: float = 0.3,
        max_output_tokens: int = 800,
        json_schema: dict | None = None,
        language: str | None = None,
    ) -> str:
        from google.genai import types

        client = self._client()
        contents = []
        if system:
            contents.append(types.Part.from_text(text=system))
        contents.append(types.Part.from_text(text=prompt))
        config = types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_output_tokens,
            response_mime_type="application/json" if json_schema else None,
            response_schema=json_schema,
        )
        response = client.models.generate_content(model=self.model, contents=contents, config=config)
        return response.text or ""

    async def analyze_image(self, image_bytes: bytes, prompt: str, schema: dict | None = None) -> dict:
        from google.genai import types

        client = self._client()
        mime_type = "image/png" if image_bytes.startswith(b"\x89PNG") else "image/jpeg"
        response = client.models.generate_content(
            model=self.model,
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                prompt,
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2,
            ),
        )
        parsed = json.loads(response.text or "{}")
        if isinstance(parsed, list):
            return parsed[0] if parsed else {}
        return parsed

    async def embed(self, texts: list[str]) -> list[list[float]]:
        client = self._client()
        response = client.models.embed_content(
            model=settings.ai_gemini_embed_model,
            contents=texts,
        )
        return [list(embedding.values) for embedding in response.embeddings]

    def count_tokens(self, text: str) -> int:
        from google.genai import types

        client = self._client()
        result = client.models.count_tokens(model=self.model, contents=types.Part.from_text(text=text))
        return int(result.total_tokens or 0)
