"""Deterministic grade stub — the fallback seam for brief M10 (phase-05).

The real implementation will route through the AI gateway
(`services/ai/gateway.py:analyze_image`) like the disease model; until then this
stub is the deterministic fallback every caller degrades to.
"""
from app.services.grading_model.base import GradeModelAdapter


class StubGradeModel(GradeModelAdapter):
    async def scan(self, image_bytes: bytes) -> dict:
        return {
            "grade": "AGMARK A",
            "uniformityPercent": 88,
            "shelfLifeDays": 12,
            "recommendedPrice": 1650,
        }
