"""AI support agent (WS-05 M30).

Answers app-help questions from the FAQ corpus with citations and always
escalates money/account questions to a human ticket. Money/account escalation is
enforced in code (not the prompt); every answer is grounded in retrieved FAQ
articles and rendered with its source doc ids.
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from app.core.db import query, set_doc
from app.core.deps import current_user_id
from app.services import idempotency, search_index
from app.services.ai import gateway, privacy
from app.services.chatbot import create_expert_ticket

router = APIRouter(prefix="/support", tags=["support"])

FAQ_INDEX = "faq"
SUPPORT_INTENT_MODULE = "support_intent"
SUPPORT_ANSWER_MODULE = "support_answer"
RETRIEVAL_CONFIDENCE_FLOOR = 0.5


class AskIn(BaseModel):
    question: str = Field(..., min_length=1)
    lang: str = "en"


def _error(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": {}},
    )


async def _keyword_faq(question: str) -> list[dict]:
    words = [w for w in question.lower().split() if len(w) > 3]
    docs = await query("faq_articles", [("status", "==", "published")], limit=500)
    hits = []
    for doc in docs:
        haystack = f"{doc.get('title', '')} {doc.get('body', '')}".lower()
        if any(word in haystack for word in words):
            hits.append({"docId": doc["id"], "text": doc.get("body", ""), "score": 0.5})
    return hits


async def _record(uid: str, question: str, outcome: str, category: str, sources: list[str]) -> str:
    conversation_id = f"sup_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    await set_doc(
        "support_conversations",
        conversation_id,
        {
            "id": conversation_id,
            "uid": uid,
            "question": question,
            "outcome": outcome,
            "category": category,
            "sources": sources,
            "createdAt": now,
        },
    )
    # WS-09 task 9.9 — support outcome analytics (deterministic event id).
    resolved = outcome == "resolved"
    await set_doc(
        "analytics_events",
        f"support_{conversation_id}",
        {
            "eventId": f"support_{conversation_id}",
            "userId": uid,
            "persona": None,
            "name": "support_resolved" if resolved else "support_escalated",
            "props": {"sources_count": len(sources)} if resolved else {"category": category},
            "sessionId": None,
            "clientTs": None,
            "serverTs": now,
        },
    )
    return conversation_id


async def _escalate(uid: str, question: str, category: str) -> dict:
    ticket = await create_expert_ticket(uid, question, category=category, urgency="normal")
    await _record(uid, question, "escalated", category, [])
    return {"kind": "ticket", "ticketId": ticket["id"]}


@router.post("/ask")
async def ask_support(
    body: AskIn,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    uid: str = Depends(current_user_id),
):
    stored = await idempotency.replay("support.ask", idempotency_key)
    if stored is not None:
        return stored

    state = privacy.sanitize_state({"question": body.question, "lang": body.lang})
    decision = await gateway.decide(state, "support.intent.v1", module=SUPPORT_INTENT_MODULE)
    answers = decision.answers or {}
    category = str(answers.get("category") or "other")
    escalate = bool(answers.get("escalate")) or category in ("money", "account")

    if escalate:
        result = await _escalate(uid, body.question, category)
        if idempotency_key:
            await idempotency.store("support.ask", idempotency_key, result)
        return result

    # Retrieval: semantic FAQ hits, keyword fallback when confidence is low.
    try:
        hits = await search_index.search_similar(FAQ_INDEX, body.question, limit=3)
    except Exception:  # noqa: BLE001 — retrieval failure falls back to keyword
        hits = []
    if not hits or (hits[0].get("score") or 0.0) < RETRIEVAL_CONFIDENCE_FLOOR:
        hits = await _keyword_faq(body.question)
    if not hits:
        result = await _escalate(uid, body.question, category)
        if idempotency_key:
            await idempotency.store("support.ask", idempotency_key, result)
        return result

    sources = [hit["docId"] for hit in hits]
    grounded = "\n\n".join(hit.get("text", "") for hit in hits)
    prompt = (
        f"Answer the user's question in {body.lang} using ONLY the FAQ snippets below. "
        f"Do not invent policy.\n\nFAQ:\n{grounded}\n\nQuestion: {body.question}"
    )
    answer = await gateway.generate(
        prompt, {"module": SUPPORT_ANSWER_MODULE, "fallback_text": grounded, "language": body.lang}
    )
    await _record(uid, body.question, "resolved", category, sources)
    result = {"kind": "answer", "answer": answer, "sources": sources}
    if idempotency_key:
        await idempotency.store("support.ask", idempotency_key, result)
    return result
