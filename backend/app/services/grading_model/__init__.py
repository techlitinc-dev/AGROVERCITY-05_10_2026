import os

from app.services.grading_model.base import GradeModelAdapter
from app.services.grading_model.stub import StubGradeModel

_ADAPTERS = {
    "stub": StubGradeModel,
}


def get_grading_adapter() -> GradeModelAdapter:
    name = os.getenv("GRADE_MODEL_ADAPTER", "stub")
    if name not in _ADAPTERS:
        raise ValueError(f"unknown GRADE_MODEL_ADAPTER: {name}")
    return _ADAPTERS[name]()
