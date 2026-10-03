"""AI gateway — the single entry point for every model call (global rule 10).

Routers/services never call OpenRouter or Gemini directly. Routing, retries
(2 with backoff), timeouts (Jev 2 s, Gemini 20 s), deterministic fallback,
budget enforcement, and ai_decisions logging all live here. The app fully
works with AI_PROVIDER=shim (dev/test/CI).
"""
import asyncio
import logging
import time
from typing import Any, Literal

from pydantic import BaseModel

from app.core.config import settings
from app.services.ai import budget, config_store, decision_log, privacy, question_sets, shim
from app.services.ai.gemini_client import GeminiClient
from app.services.ai.jev_client import JevClient

log = logging.getLogger(__name__)

RETRY_ATTEMPTS = 2
RETRY_BASE_DELAY_SECONDS = 0.05

# Rough USD per 1k tokens for budget accounting (conservative placeholders).
_COST_PER_1K_TOKENS = {"jev": 0.0002, "gemini": 0.0005, "gemini_lite": 0.0001}


class DecisionResult(BaseModel):
    answers: dict[str, Any]
    confidence: float
    source: Literal["jev", "gemini", "fallback", "shim"]
    escalated: bool
    decision_id: str
    latency_ms: int


_jev_client: JevClient | None = None
_gemini_client: GeminiClient | None = None


def _get_jev_client() -> JevClient:
    global _jev_client
    if _jev_client is None:
        _jev_client = JevClient()
    return _jev_client


def _get_gemini_client() -> GeminiClient:
    global _gemini_client
    if _gemini_client is None:
        _gemini_client = GeminiClient()
    return _gemini_client


async def _with_retries(fn, *args, **kwargs):
    last_exc: Exception | None = None
    for attempt in range(RETRY_ATTEMPTS + 1):
        try:
            return await fn(*args, **kwargs)
        except budget.BudgetExhausted:
            raise
        except Exception as exc:  # noqa: BLE001 — retry any transport/model error
            last_exc = exc
            if attempt < RETRY_ATTEMPTS:
                await asyncio.sleep(RETRY_BASE_DELAY_SECONDS * (2**attempt))
    raise last_exc


def _questions_for(question_set_id: str) -> list[dict]:
    question_set = question_sets.get(question_set_id)
    if question_set is None:
        return []
    return [{"id": field_id} for field_id in question_set.schema]


def _estimate_cost(kind: str, text: str) -> float:
    return privacy.estimate_tokens(text) / 1000 * _COST_PER_1K_TOKENS.get(kind, 0.0005)


async def _finish(
    *,
    module: str,
    question_set_id: str,
    version: str,
    state: dict,
    answers: dict,
    confidence: float,
    source: str,
    escalated: bool,
    started: float,
    model: str,
    cost_usd: float,
) -> DecisionResult:
    latency_ms = int((time.monotonic() - started) * 1000)
    fallback_used = source == "fallback"
    decision_id = await decision_log.log_decision(
        module=module,
        question_set_id=question_set_id,
        version=version,
        state=state,
        answers=answers,
        confidence=confidence,
        latency_ms=latency_ms,
        cost_usd=cost_usd,
        model=model,
        source=source,
        fallback_used=fallback_used,
    )
    return DecisionResult(
        answers=answers,
        confidence=confidence,
        source=source,  # type: ignore[arg-type]
        escalated=escalated,
        decision_id=decision_id,
        latency_ms=latency_ms,
    )


async def decide(
    state: dict,
    question_set_id: str,
    ctx: str | None = None,
    module: str = "ai",
) -> DecisionResult:
    """Answer a question set for the given state with a deterministic fallback
    at every failure point. Never raises for provider/budget problems."""
    started = time.monotonic()
    clean_state = privacy.sanitize_state(state or {})
    question_set = question_sets.get(question_set_id)
    version = question_set.version if question_set else "v1"
    threshold = await config_store.threshold_for(
        question_set_id, question_set.confidence_threshold if question_set else 0.75
    )
    fallback = question_sets.fallback_answers(question_set_id, clean_state)

    if settings.ai_provider == "shim":
        answers, confidence = await shim.decide(question_set_id, clean_state)
        return await _finish(
            module=module, question_set_id=question_set_id, version=version,
            state=clean_state, answers=answers, confidence=confidence,
            source="shim", escalated=False, started=started, model="shim", cost_usd=0.0,
        )

    if not await config_store.module_enabled(module):
        return await _finish(
            module=module, question_set_id=question_set_id, version=version,
            state=clean_state, answers=fallback, confidence=0.0,
            source="fallback", escalated=True, started=started, model="none", cost_usd=0.0,
        )

    try:
        if await budget.over_budget(settings.ai_jev_model):
            raise budget.BudgetExhausted(settings.ai_jev_model)
        raw = await _with_retries(
            _get_jev_client().decide, _questions_for(question_set_id), clean_state, ctx
        )
        answers = dict(raw.get("answers") or {})
        confidence = float(raw.get("confidence", 0.0))
        if confidence < threshold:
            return await _finish(
                module=module, question_set_id=question_set_id, version=version,
                state=clean_state, answers=fallback, confidence=confidence,
                source="fallback", escalated=True, started=started,
                model=settings.ai_jev_model, cost_usd=0.0,
            )
        await budget.record_cost(settings.ai_jev_model, _estimate_cost("jev", str(clean_state)))
        return await _finish(
            module=module, question_set_id=question_set_id, version=version,
            state=clean_state, answers=answers, confidence=confidence,
            source="jev", escalated=False, started=started,
            model=settings.ai_jev_model, cost_usd=_estimate_cost("jev", str(clean_state)),
        )
    except budget.BudgetExhausted as exc:
        log.warning("AI budget exhausted (%s) — degrading to fallback", exc)
        return await _finish(
            module=module, question_set_id=question_set_id, version=version,
            state=clean_state, answers=fallback, confidence=0.0,
            source="fallback", escalated=True, started=started, model="none", cost_usd=0.0,
        )
    except Exception as exc:  # noqa: BLE001 — degrade, never error
        log.warning("decide failed (%s) — degrading to fallback", exc)
        return await _finish(
            module=module, question_set_id=question_set_id, version=version,
            state=clean_state, answers=fallback, confidence=0.0,
            source="fallback", escalated=True, started=started,
            model=settings.ai_jev_model, cost_usd=0.0,
        )


async def generate(prompt: str, opts: dict | None = None) -> str:
    """Free-form generation via Gemini; deterministic shim text on any failure."""
    started = time.monotonic()
    opts = dict(opts or {})
    module = opts.get("module", "ai")
    clean_prompt = privacy.trim_to_token_budget(privacy.sanitize_text(prompt))

    if settings.ai_provider == "shim" or not await config_store.module_enabled(module):
        text = await shim.generate(clean_prompt, opts)
        await decision_log.log_decision(
            module=module, question_set_id="generate.v1", version="v1",
            state={"prompt": clean_prompt}, answers={"text": text},
            confidence=1.0, latency_ms=int((time.monotonic() - started) * 1000),
            cost_usd=0.0, model="shim", source="shim", fallback_used=False,
        )
        return text

    try:
        model = opts.get("model") or settings.ai_gemini_model
        if await budget.over_budget(model):
            raise budget.BudgetExhausted(model)
        text = await _with_retries(
            _get_gemini_client().generate,
            clean_prompt,
            system=opts.get("system"),
            temperature=float(opts.get("temperature", 0.3)),
            max_output_tokens=int(opts.get("max_output_tokens", 800)),
            json_schema=opts.get("json_schema"),
            language=opts.get("language"),
        )
        cost = _estimate_cost("gemini", clean_prompt + text)
        await budget.record_cost(model, cost)
        await decision_log.log_decision(
            module=module, question_set_id="generate.v1", version="v1",
            state={"prompt": clean_prompt}, answers={"text": text},
            confidence=1.0, latency_ms=int((time.monotonic() - started) * 1000),
            cost_usd=cost, model=model, source="gemini", fallback_used=False,
        )
        return text
    except Exception as exc:  # noqa: BLE001 — degrade, never error
        log.warning("generate failed (%s) — degrading to shim fallback", exc)
        fallback_text = opts.get("fallback_text")
        text = fallback_text if fallback_text is not None else await shim.generate(clean_prompt, opts)
        await decision_log.log_decision(
            module=module, question_set_id="generate.v1", version="v1",
            state={"prompt": clean_prompt}, answers={"text": text},
            confidence=0.0, latency_ms=int((time.monotonic() - started) * 1000),
            cost_usd=0.0, model=settings.ai_gemini_model, source="fallback", fallback_used=True,
        )
        return text


async def analyze_image(image_bytes: bytes, prompt: str, schema: dict | None = None) -> dict:
    """Image analysis via Gemini vision; shim answer on any failure."""
    if settings.ai_provider == "shim":
        return await shim.analyze_image(image_bytes, prompt, schema)
    try:
        return await _with_retries(_get_gemini_client().analyze_image, image_bytes, prompt, schema)
    except Exception as exc:  # noqa: BLE001 — degrade, never error
        log.warning("analyze_image failed (%s) — degrading to shim fallback", exc)
        return await shim.analyze_image(image_bytes, prompt, schema)


async def embed(texts: list[str]) -> list[list[float]]:
    """Embeddings via Gemini; deterministic shim vectors on any failure."""
    clean = [privacy.trim_to_token_budget(privacy.sanitize_text(text)) for text in texts]
    if settings.ai_provider == "shim":
        return await shim.embed(clean)
    try:
        return await _with_retries(_get_gemini_client().embed, clean)
    except Exception as exc:  # noqa: BLE001 — degrade, never error
        log.warning("embed failed (%s) — degrading to shim fallback", exc)
        return await shim.embed(clean)
