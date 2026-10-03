"""Question-set registry (ai_implementation_plan §1.1).

Scaffolding only: individual question sets land with their briefs in later
phases. A set declares its schema (field -> default), confidence threshold,
automation level, and an optional deterministic fallback builder.
"""
from dataclasses import dataclass, field
from typing import Any, Callable

AUTOMATION_LEVELS = ("suggest", "require_confirm", "auto")


@dataclass
class QuestionSet:
    id: str
    version: str
    schema: dict[str, Any] = field(default_factory=dict)
    state_builder: Callable | None = None
    confidence_threshold: float = 0.75
    automation_level: str = "suggest"
    fallback_fn: Callable | None = None


REGISTRY: dict[str, QuestionSet] = {}


def register(question_set: QuestionSet) -> QuestionSet:
    REGISTRY[question_set.id] = question_set
    return question_set


def get(question_set_id: str) -> QuestionSet | None:
    return REGISTRY.get(question_set_id)


def schema_defaults(question_set_id: str) -> dict[str, Any]:
    question_set = get(question_set_id)
    if question_set is None:
        return {}
    return dict(question_set.schema)


def fallback_answers(question_set_id: str, state: dict | None = None) -> dict[str, Any]:
    question_set = get(question_set_id)
    if question_set is not None and question_set.fallback_fn is not None:
        return question_set.fallback_fn(state or {})
    return schema_defaults(question_set_id)


register(
    QuestionSet(
        id="sample.agronomy.v1",
        version="v1",
        schema={"crop": "unknown", "sowingWindow": "not-available"},
        confidence_threshold=0.75,
        automation_level="suggest",
    )
)
