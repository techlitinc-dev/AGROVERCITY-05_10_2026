import os

from app.services.ai import gateway
from app.services.grading_model.base import GradeModelAdapter
from app.services.grading_model.gemini import GRADING_MODULE, GeminiGradeModel
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


async def grading_gate(confidence: float, grade) -> gateway.DecisionResult:
    """M10 human-review gate over a grading result via `grading.gate.v1`
    (rule 10 — routers never call the gateway)."""
    return await gateway.decide(
        {"confidence": confidence, "grade": grade},
        "grading.gate.v1",
        module=GRADING_MODULE,
    )
