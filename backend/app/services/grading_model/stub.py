"""Deterministic grade stub — the fallback seam for brief M10 (phase-05).

The live implementation (`grading_model/gemini.py`) routes through the AI gateway
(`services/ai/gateway.py:analyze_image`) like the disease model; this stub is the
deterministic fallback every caller degrades to when the model is off/unavailable
or its answer fails validation.
"""
from app.services.grading_model.base import GradeModelAdapter

# AGMARK grade scale in descending quality order. The ±1-grade accuracy fixture
# (`tests/fixtures/ai/golden/grading.gate.v1.jsonl`) compares scale indices, so
# this tuple's order is the contract.
GRADE_SCALE = ("AGMARK A", "AGMARK B", "AGMARK C", "AGMARK D")

# Deterministic grade mapping for the golden refs: the image bytes carry a
# `grade:<letter>` token. Unknown images return the conservative default
# (AGMARK A, high confidence) so existing callers/tests are unchanged.
_DETERMINISTIC_GRADE_TOKENS: dict[bytes, int] = {
    b"grade:a": 0,
    b"grade:b": 1,
    b"grade:c": 2,
    b"grade:d": 3,
}

# Per-grade deterministic confidence. C/D fall below the 0.7 human-review
# threshold so the M10 gate can be exercised without a live model.
_GRADE_CONFIDENCE = {0: 0.92, 1: 0.80, 2: 0.62, 3: 0.50}
_GRADE_SHELF_LIFE_DAYS = {0: 12, 1: 9, 2: 6, 3: 3}
_GRADE_UNIFORMITY = {0: 88, 1: 76, 2: 62, 3: 48}
# Indicative recommended price (rupees/quintal) by grade — the endpoint converts
# it to integer paisa for the recommended price band.
_GRADE_PRICE_RUPEES = {0: 1650, 1: 1420, 2: 1180, 3: 900}

DEFAULT_GRADE_INDEX = 0


def deterministic_grade_index(image_bytes: bytes) -> int:
    """Deterministic AGMARK grade index read from the image ref token."""
    for token, index in _DETERMINISTIC_GRADE_TOKENS.items():
        if token in image_bytes:
            return index
    return DEFAULT_GRADE_INDEX


def deterministic_grade(image_bytes: bytes) -> dict:
    """Deterministic fallback grade assessment (M10, SDR step 5).

    Returns the AGMARK grade, shelf life, uniformity, an indicative recommended
    price (rupees/quintal) and a confidence, so the endpoint always has a
    well-formed shape even when the gateway is unavailable.
    """
    index = deterministic_grade_index(image_bytes)
    return {
        "grade": GRADE_SCALE[index],
        "uniformityPercent": _GRADE_UNIFORMITY[index],
        "shelfLifeDays": _GRADE_SHELF_LIFE_DAYS[index],
        "recommendedPrice": _GRADE_PRICE_RUPEES[index],
        "confidence": _GRADE_CONFIDENCE[index],
        "source": "stub",
    }


class StubGradeModel(GradeModelAdapter):
    async def scan(self, image_bytes: bytes) -> dict:
        return deterministic_grade(image_bytes)
