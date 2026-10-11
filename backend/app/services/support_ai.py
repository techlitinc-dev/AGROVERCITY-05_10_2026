"""AI support agent service (WS-05 M30).

The router never calls the AI gateway directly (rule 10): intent
classification and the grounded FAQ answer both go through here. Money/account
escalation stays enforced in the router (code, not the prompt).
"""
from app.services.ai import gateway, privacy

SUPPORT_INTENT_MODULE = "support_intent"
SUPPORT_ANSWER_MODULE = "support_answer"


async def classify_intent(question: str, lang: str) -> dict:
    """Classify a support question via `support.intent.v1`; returns the answers."""
    state = privacy.sanitize_state({"question": question, "lang": lang})
    decision = await gateway.decide(state, "support.intent.v1", module=SUPPORT_INTENT_MODULE)
    return decision.answers or {}


async def answer_question(question: str, lang: str, grounded: str) -> str:
    """Answer from the retrieved FAQ snippets only; the snippets are also the
    gateway fallback text so a provider failure still returns sources."""
    prompt = (
        f"Answer the user's question in {lang} using ONLY the FAQ snippets below. "
        f"Do not invent policy.\n\nFAQ:\n{grounded}\n\nQuestion: {question}"
    )
    return await gateway.generate(
        prompt, {"module": SUPPORT_ANSWER_MODULE, "fallback_text": grounded, "language": lang}
    )
