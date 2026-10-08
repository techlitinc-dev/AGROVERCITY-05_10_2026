"""AI response contract validation (phase-08 WS-02 task 2.9).

Guards against channel drift: a model/provider response must carry every field
the registered question set declares, with a compatible JSON type. A vocabulary
change on the provider side fails loudly here instead of silently degrading.
"""
from app.services.ai import question_sets


class ContractViolation(ValueError):
    """Raised when a model response violates the registered question-set schema."""


def _check_type(question_set_id: str, field: str, value, default) -> None:
    if default is None:
        return  # nullable choice — any JSON value (or None) is acceptable
    if isinstance(default, bool):
        ok = isinstance(value, bool)
    elif isinstance(default, (int, float)):
        ok = isinstance(value, (int, float)) and not isinstance(value, bool)
    elif isinstance(default, str):
        ok = isinstance(value, str)
    elif isinstance(default, list):
        ok = isinstance(value, list)
    elif isinstance(default, dict):
        ok = isinstance(value, dict)
    else:
        ok = True
    if not ok:
        raise ContractViolation(f"TYPE_MISMATCH:{question_set_id}:{field}")


def validate_answers(question_set_id: str, answers: dict) -> None:
    """Raise `ContractViolation` when `answers` violates the question-set schema."""
    question_set = question_sets.get(question_set_id)
    if question_set is None:
        raise ContractViolation(f"UNKNOWN_QUESTION_SET:{question_set_id}")
    answers = answers or {}
    for field, default in question_set.schema.items():
        if field not in answers:
            raise ContractViolation(f"MISSING_FIELD:{question_set_id}:{field}")
        _check_type(question_set_id, field, answers[field], default)
