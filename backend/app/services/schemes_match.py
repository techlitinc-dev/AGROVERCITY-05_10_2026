"""Government-scheme matching (phase-05 WS-05, brief M21 / SDR).

Rules decide; the model only ranks and explains. `rules_verdict()` derives the
`eligible` / `missing` truth EXCLUSIVELY from `services/eligibility.py`; the AI
(brief `schemes.match.v1`) contributes a `fit` score for ordering and a
vernacular "why eligible / what to do" line. The deterministic fallback is the
rules verdict plus a missing-document penalty, so shim / AI-off runs answer
identically to the rules engine (golden fixture
`backend/tests/fixtures/ai/golden/schemes.match.v1.jsonl`).
"""
import json

from app.core.cache import cache_get, cache_set
from app.services import eligibility as eligibility_rules
from app.services.ai import config_store, gateway
from app.services.ai.privacy import sanitize_state
from app.services.tasks import emit_task

SCHEMES_MATCH_MODULE = "schemes_match"
SCHEMES_MATCH_QUESTION_SET = "schemes.match.v1"
SCHEMES_DEEP_LINK = "/dashboard/p/schemes"

# Cache TTL for the vernacular explanation, keyed by (scheme, profile-class, lang).
EXPLAIN_CACHE_TTL_SECONDS = 6 * 60 * 60


def profile_class(profile: dict) -> str:
    """Coarse bucket so explanations cache across similar profiles.

    Deliberately PII-free: state + a land-size band only.
    """
    state = str((profile or {}).get("state") or "")
    try:
        acres = float((profile or {}).get("landAreaAcres") or 0.0)
    except (TypeError, ValueError):
        acres = 0.0
    if acres <= 2:
        band = "marginal"
    elif acres <= 10:
        band = "small"
    else:
        band = "large"
    return f"{state}:{band}"


def rules_verdict(profile: dict, scheme: dict) -> dict:
    """Eligibility + missing docs from the rules engine ONLY."""
    rules = (scheme or {}).get("eligibilityRules") or {}
    eligible = eligibility_rules.is_eligible(profile or {}, rules)
    missing = eligibility_rules.missing_documents(
        (scheme or {}).get("documentsRequired") or [],
        (profile or {}).get("vaultDocTypes") or [],
    )
    if not eligible:
        fit = 0.0
    else:
        fit = round(max(0.4, 1.0 - 0.15 * len(missing)), 2)
    return {
        "eligible": eligible,
        "missing": missing,
        "fit": fit,
        "checklist": eligibility_rules.evaluate(profile or {}, rules),
    }


def build_match_state(profile: dict, scheme: dict, verdict: dict) -> dict:
    """≤1,500-token, PII-scrubbed state for `schemes.match.v1` (rule 11)."""
    state = {
        "scheme_id": str((scheme or {}).get("id") or ""),
        "scheme_name": str((scheme or {}).get("name") or ""),
        "category": str((scheme or {}).get("category") or ""),
        "eligible": bool(verdict.get("eligible")),
        "missing": [str(doc) for doc in (verdict.get("missing") or [])],
        "profile_class": profile_class(profile),
    }
    return sanitize_state(state)


def _deterministic_explanation(scheme: dict, verdict: dict, lang: str) -> str:
    """Localized template built from the rules output (AI off/failed fallback)."""
    name = str((scheme or {}).get("name") or "")
    missing = [str(doc) for doc in (verdict.get("missing") or [])]
    if not verdict.get("eligible"):
        if lang == "hi":
            return f"आप इस समय {name} की पात्रता शर्तें पूरी नहीं करते। विवरण के लिए चेकलिस्ट देखें।"
        return f"You do not currently meet the eligibility rules for {name}. See the checklist for details."
    if missing:
        docs = ", ".join(missing)
        if lang == "hi":
            return f"आप {name} के लिए पात्र हैं, लेकिन {docs} अपलोड करना बाकी है। दस्तावेज़ वॉल्ट में जोड़ें।"
        return f"You are eligible for {name}, but upload {docs} to finish your application."
    if lang == "hi":
        return f"आप {name} की सभी पात्रता शर्तें पूरी करते हैं। ऐप में या आधिकारिक पोर्टल पर आवेदन करें।"
    return f"You meet every eligibility rule for {name}. Apply in the app or on the official portal."


async def explain_match(scheme: dict, lang: str, verdict: dict, profile: dict) -> str:
    """Vernacular "why eligible / what to do" line (M21).

    Gemini (through the gateway only — rule 10) generates the line; it is cached
    per (scheme, profile-class, lang). On AI off/failed — or whenever the shim
    provider answers, which cannot truly generate — the deterministic template
    built from the rules output is returned instead.
    """
    scheme_id = str((scheme or {}).get("id") or "")
    pclass = profile_class(profile)
    cache_key = f"schemes_explain:{scheme_id}:{pclass}:{lang}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    template = _deterministic_explanation(scheme, verdict, lang)
    if not await config_store.module_enabled(SCHEMES_MATCH_MODULE):
        text = template
    else:
        prompt = (
            f"Scheme: {scheme.get('name')}. Eligible: {bool(verdict.get('eligible'))}. "
            f"Missing documents: {', '.join(verdict.get('missing') or []) or 'none'}. "
            f"Write one short sentence (language: {lang}) for a small farmer explaining why they "
            "are or are not eligible and what to do next. Do not invent facts."
        )
        try:
            generated = await gateway.generate(
                prompt,
                {"module": SCHEMES_MATCH_MODULE, "language": lang, "fallback_text": template},
            )
        except Exception:  # noqa: BLE001 — degrade, never block the match read
            generated = ""
        # The shim provider cannot truly generate; fall back to the localized
        # template so dev/CI never surfaces a non-localized placeholder.
        if not generated or generated.startswith("[shim]"):
            text = template
        else:
            text = generated

    await cache_set(cache_key, text, ttl_seconds=EXPLAIN_CACHE_TTL_SECONDS)
    return text


async def match_schemes(
    profile: dict,
    schemes: list[dict],
    lang: str = "en",
    emit_tasks: bool = True,
) -> list[dict]:
    """Match a farmer profile against the schemes collection (M21).

    Eligibility + missing docs come from the rules engine (never the model); the
    model only adds a `fit` score. Results are ordered matched-to-profile first
    (eligible, then fewer missing docs, then name). Eligible schemes with missing
    documents emit a task naming the missing docs.
    """
    user_id = str((profile or {}).get("id") or (profile or {}).get("userId") or "")
    results: list[dict] = []
    for scheme in schemes or []:
        verdict = rules_verdict(profile, scheme)
        fit = verdict["fit"]
        state = build_match_state(profile, scheme, verdict)
        try:
            decision = await gateway.decide(
                state, SCHEMES_MATCH_QUESTION_SET, ctx=user_id or None, module=SCHEMES_MATCH_MODULE
            )
            answer_fit = (decision.answers or {}).get("fit")
            if isinstance(answer_fit, (int, float)):
                fit = float(answer_fit)
        except Exception:  # noqa: BLE001 — the rules verdict stands regardless
            pass

        explanation = await explain_match(scheme, lang, verdict, profile)
        results.append(
            {
                "schemeId": scheme.get("id"),
                "name": scheme.get("name"),
                "category": scheme.get("category"),
                "eligible": verdict["eligible"],
                "missing": verdict["missing"],
                "fit": fit,
                "checklist": verdict["checklist"],
                "explanation": explanation,
            }
        )

    results.sort(
        key=lambda row: (
            not row["eligible"],
            len(row["missing"]),
            str(row["name"] or "").lower(),
        )
    )

    if emit_tasks and user_id:
        await emit_missing_doc_tasks(user_id, results)
    return results


async def emit_missing_doc_tasks(user_id: str, matches: list[dict]) -> list[str]:
    """Task-engine emission (M21): one task per eligible scheme with missing docs."""
    task_ids: list[str] = []
    for row in matches or []:
        missing = row.get("missing") or []
        if not row.get("eligible") or not missing:
            continue
        scheme_id = str(row.get("schemeId") or "")
        docs = ", ".join(str(doc) for doc in missing)
        task_id = await emit_task(
            user_id,
            persona="farmer",
            module="schemes",
            kind="scheme_missing_docs",
            title_en=f"Upload {docs} for {row.get('name')}",
            title_hi=f"{row.get('name')} के लिए {docs} अपलोड करें",
            subtitle=docs,
            priority="upcoming",
            deep_link=SCHEMES_DEEP_LINK,
            source_id=scheme_id,
        )
        task_ids.append(task_id)
    return task_ids
