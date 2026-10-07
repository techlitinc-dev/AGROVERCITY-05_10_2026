import os

from app.services.grading_model.base import GradeModelAdapter
from app.services.grading_model.gemini import GeminiGradeModel
from app.services.grading_model.stub import StubGradeModel

_ADAPTERS = {
    "gemini": GeminiGradeModel,
    "stub": StubGradeModel,
}


def get_grading_adapter() -> GradeModelAdapter:
    # Default to the gateway-backed adapter (M10); the deterministic stub answers
    # whenever the gateway is unavailable or its answer fails validation.
    name = os.getenv("GRADE_MODEL_ADAPTER", "gemini")
    if name not in _ADAPTERS:
        raise ValueError(f"unknown GRADE_MODEL_ADAPTER: {name}")
    return _ADAPTERS[name]()
