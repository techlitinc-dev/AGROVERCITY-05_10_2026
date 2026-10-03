"""Question-set registry (ai_implementation_plan §1.1).

Scaffolding only: individual question sets land with their briefs in later
phases. A set declares its schema (field -> default), confidence threshold,
automation level, and an optional deterministic fallback builder.
"""
from dataclasses import dataclass, field
from typing import Any, Callable

AUTOMATION_LEVELS = ("suggest", "require_confirm", "auto")


def _due_date_order(state: dict) -> list[str]:
    """Canonical ordering: urgent first, then dueAt ascending, then id."""
    tasks = state.get("tasks") or []
    ordered = sorted(
        tasks,
        key=lambda task: (
            0 if task.get("priority") == "urgent" else 1,
            task.get("dueAt") or "9999-12-31",
            task.get("id") or "",
        ),
    )
    return [task.get("id") for task in ordered if task.get("id")]


def _rank_fallback(state: dict) -> dict:
    """Deterministic due-date sort (SDR step 5 fallback for tasks.rank.v1)."""
    ranking = _due_date_order(state)
    return {
        "ranking": ranking,
        "headline_task": ranking[0] if ranking else None,
        "confidence": 0.0,
        "impacts": {},
    }


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

# Brief M5 — task ranking: orders /v1/tasks/* and picks the hero next-best
# action. Ranking annotates; the user still taps (automation stays `suggest`).
register(
    QuestionSet(
        id="tasks.rank.v1",
        version="v1",
        schema={"ranking": [], "headline_task": None, "confidence": 0.0, "impacts": {}},
        confidence_threshold=0.75,
        automation_level="suggest",
        fallback_fn=_rank_fallback,
    )
)

# Brief M2 — Kisan Mitra intent routing: routes human_needed / low-answerable
# messages to the existing expert-ticket path; money intent stays neutral.
register(
    QuestionSet(
        id="chatbot.intent.v1",
        version="v1",
        schema={"intent": "human_needed", "answerable": 0.0},
        confidence_threshold=0.6,
        automation_level="suggest",
    )
)

# Brief M2 — safety post-check on bot replies (contact info / financial
# advice / medical certainty). Any flag strips + regenerates once.
register(
    QuestionSet(
        id="chatbot.safety.v1",
        version="v1",
        schema={
            "has_contact_info": False,
            "has_financial_advice": False,
            "has_medical_certainty": False,
        },
        confidence_threshold=0.75,
        automation_level="suggest",
    )
)
