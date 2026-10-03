"""Deterministic shim provider (AI_PROVIDER=shim) — CI/dev never calls paid APIs.

Answers come from `backend/tests/fixtures/ai/golden/*.jsonl`, keyed by
question-set id; unknown sets return schema-valid defaults.
"""
import hashlib
import json
import logging
import os

from app.services.ai import question_sets, privacy

log = logging.getLogger(__name__)

GOLDEN_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "tests", "fixtures", "ai", "golden")
)
EMBED_DIMENSIONS = 8

_fixture_cache: dict | None = None


def _load_fixtures() -> dict:
    global _fixture_cache
    if _fixture_cache is not None:
        return _fixture_cache
    fixtures: dict = {}
    try:
        for name in sorted(os.listdir(GOLDEN_DIR)):
            if not name.endswith(".jsonl"):
                continue
            with open(os.path.join(GOLDEN_DIR, name), encoding="utf-8") as handle:
                for line in handle:
                    line = line.strip()
                    if not line:
                        continue
                    record = json.loads(line)
                    key = record.get("questionSetId")
                    if key:
                        fixtures[key] = record
    except FileNotFoundError:
        log.warning("AI golden fixtures directory missing: %s", GOLDEN_DIR)
    _fixture_cache = fixtures
    return fixtures


async def decide(question_set_id: str, state: dict) -> tuple[dict, float]:
    record = _load_fixtures().get(question_set_id)
    if record is not None:
        return dict(record.get("answers") or {}), float(record.get("confidence", 0.9))
    return question_sets.fallback_answers(question_set_id, state), 0.5


async def generate(prompt: str, opts: dict | None = None) -> str:
    return "[shim] deterministic response — live AI provider not enabled"


async def analyze_image(image_bytes: bytes, prompt: str, schema: dict | None = None) -> dict:
    return {
        "diseaseName": "Early Blight",
        "crop": "Tomato",
        "pathogen": "Alternaria solani",
        "confidence": 0.87,
        "symptoms": "पत्तियों पर भूरे गोल धब्बे, किनारों पर पीलापन",
        "chemicalTreatment": "Mancozeb 75% WP",
        "organicTreatment": "नीम तेल 5% घोल",
        "dosage": "2.5 g/L",
        "estimatedCost": 450.0,
    }


async def embed(texts: list[str]) -> list[list[float]]:
    vectors = []
    for text in texts:
        digest = hashlib.sha256(text.encode()).digest()
        vectors.append([digest[i] / 255.0 for i in range(EMBED_DIMENSIONS)])
    return vectors


def sanitize_for_test(text: str) -> str:
    return privacy.sanitize_text(text)
