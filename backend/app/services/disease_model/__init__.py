import os

from app.services.disease_model.base import DiseaseModelAdapter
from app.services.disease_model.gemini import GeminiDiseaseModel
from app.services.disease_model.stub import StubDiseaseModel

_ADAPTERS = {
    "gemini": GeminiDiseaseModel,
    "stub": StubDiseaseModel,
}


def get_disease_adapter() -> DiseaseModelAdapter:
    name = os.getenv("DISEASE_MODEL_ADAPTER", "gemini")
    if name not in _ADAPTERS:
        raise ValueError(f"unknown DISEASE_MODEL_ADAPTER: {name}")
    return _ADAPTERS[name]()
