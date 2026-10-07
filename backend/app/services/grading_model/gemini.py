"""Gateway-routed produce grader (brief M10, global rule 10).

Vision analysis goes through `services/ai/gateway.py:analyze_image` — routers
never call Gemini/OpenRouter directly. The response is validated by a Pydantic
model with exactly one repair retry; on any failure the deterministic stub
(`grading_model/stub.py`) answers, so the endpoint never errors and shim/dev/CI
keep working.
"""
import json
import logging

from pydantic import BaseModel, Field

from app.services.ai import gateway
from app.services.grading_model.base import GradeModelAdapter
from app.services.grading_model.stub import deterministic_grade

logger = logging.getLogger(__name__)

# Gateway module flag (platform_config/ai `modules`); absent == enabled.
GRADING_MODULE = "postharvest_grading"

GRADING_PROMPT = (
    "You are an AGMARK produce grader. Analyse this produce photo and return ONLY "
    'the JSON object: {"grade": "AGMARK A|AGMARK B|AGMARK C|AGMARK D", '
    '"shelfLifeDays": integer days, "recommendedPrice": integer rupees per quintal, '
    '"uniformityPercent": integer 0-100, "confidence": float 0-1}.'
)

GRADING_REPAIR_PROMPT = (
    "Rewrite the answer as a single strictly valid JSON object with exactly the "
    "keys grade, shelfLifeDays, recommendedPrice, uniformityPercent, confidence."
)

GRADING_SCHEMA = {
    "grade": "AGMARK A",
    "shelfLifeDays": 0,
    "recommendedPrice": 0,
    "uniformityPercent": 0,
    "confidence": 0.0,
}


class GradeAssessment(BaseModel):
    grade: str
    shelfLifeDays: int = Field(ge=0)
    recommendedPrice: int = Field(ge=0)
    uniformityPercent: int = Field(ge=0, le=100)
    confidence: float = Field(ge=0, le=1)


def _clean_json(raw: str) -> str:
    text = (raw or "").strip()
    if text.startswith("```"):
        text = text.strip("`")
        if "\n" in text:
            text = text.split("\n", 1)[1]
    return text


async def _analyze_once(image_bytes: bytes, prompt: str) -> GradeAssessment | None:
    raw = await gateway.analyze_image(
        image_bytes, prompt, schema=GRADING_SCHEMA, module=GRADING_MODULE
    )
    payload = raw
    if isinstance(raw, str):
        try:
            payload = json.loads(_clean_json(raw))
        except (TypeError, ValueError):
            return None
    try:
        return GradeAssessment.model_validate(payload)
    except Exception:  # noqa: BLE001 — an invalid answer triggers the repair retry
        return None


class GeminiGradeModel(GradeModelAdapter):
    async def scan(self, image_bytes: bytes) -> dict:
        assessment = await _analyze_once(image_bytes, GRADING_PROMPT)
        if assessment is None:
            assessment = await _analyze_once(image_bytes, GRADING_REPAIR_PROMPT)
        if assessment is None:
            logger.warning("grading vision validation failed twice — using deterministic stub")
            return deterministic_grade(image_bytes)
        result = assessment.model_dump()
        result["source"] = "ai"
        return result
