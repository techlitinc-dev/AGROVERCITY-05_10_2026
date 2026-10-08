"""FastAPI Router for Kisan Mitra Gemini AI Chatbot & Agronomist Expert Handoff."""
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.db import get_doc, query, set_doc
from app.core.deps import current_user_id
from app.core.pagination import fetch_page
from app.models.chatbot import ChatMessageIn, ChatMessageOut, ExpertHandoffIn, ExpertHandoffOut
from app.services.chatbot import create_expert_ticket, process_chat_message
from app.services.users import get_user

router = APIRouter(prefix="/chatbot", tags=["chatbot"])


def _error(status_code: int, code: str, message: str):
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "fieldErrors": {}},
    )


class TicketMessageIn(BaseModel):
    text: str = Field(..., min_length=1)


def _is_admin(user: dict) -> bool:
    return bool(user.get("isAdmin")) or user.get("activeProfile") == "admin"


@router.post("/messages", response_model=ChatMessageOut)
async def send_chatbot_message(
    body: ChatMessageIn,
    uid: str = Depends(current_user_id),
):
    user = await get_user(uid)
    user_name = user.get("name", "Kisan") if user else "Kisan"
    return await process_chat_message(uid, body, user_name=user_name)


@router.get("/history")
async def get_chat_history(
    sessionId: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    uid: str = Depends(current_user_id),
):
    filters = []
    if sessionId:
        filters.append(("sessionId", "==", sessionId))
    
    docs = await query(f"users/{uid}/chatbot_messages", filters=filters, limit=limit)
    docs.sort(key=lambda d: d.get("timestamp", ""))
    return {"data": docs, "sessionId": sessionId, "total": len(docs)}


@router.post("/expert-handoff", response_model=ExpertHandoffOut, status_code=201)
async def request_expert_handoff(
    body: ExpertHandoffIn,
    uid: str = Depends(current_user_id),
):
    ticket = await create_expert_ticket(
        uid,
        body.query,
        category=body.category,
        urgency=body.urgency,
        session_id=body.sessionId,
        crop=body.crop,
        photo_url=body.photoUrl,
        notes=body.notes,
    )
    return ExpertHandoffOut(
        ticketId=ticket["id"],
        status=ticket["status"],
        category=ticket["category"],
        urgency=ticket["urgency"],
        assignedDesk=ticket["assignedDesk"],
        estimatedWaitMinutes=ticket["estimatedWaitMinutes"],
        createdAt=ticket["createdAt"],
    )


@router.get("/handoffs")
async def list_my_handoffs(uid: str = Depends(current_user_id)):
    """The caller's expert-handoff tickets (thread view for Kisan Mitra 2.0)."""
    tickets = await query(f"users/{uid}/expert_tickets", [], limit=100)
    tickets.sort(key=lambda t: t.get("createdAt", ""), reverse=True)
    return {"data": tickets, "total": len(tickets)}


# --- WS-05 F20: expert_tickets as in-app support threads -------------------
@router.get("/expert-tickets")
async def list_expert_tickets(
    cursor: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    uid: str = Depends(current_user_id),
):
    page = await fetch_page(
        f"users/{uid}/expert_tickets",
        [],
        order_field="createdAt",
        descending=True,
        cursor=cursor,
        page_size=limit,
    )
    return {"data": page["items"], "nextCursor": page["nextCursor"]}


async def _require_ticket_access(ticket_id: str, uid: str) -> dict:
    ticket = await get_doc("expert_tickets", ticket_id)
    if ticket is None:
        _error(404, "TICKET_NOT_FOUND", "ticket not found")
    user = await get_user(uid) or {}
    if ticket.get("userId") != uid and not _is_admin(user):
        _error(403, "FORBIDDEN", "only the ticket owner can access this thread")
    return ticket


@router.get("/expert-tickets/{ticket_id}/messages")
async def get_ticket_messages(ticket_id: str, uid: str = Depends(current_user_id)):
    await _require_ticket_access(ticket_id, uid)
    docs = await query(f"expert_tickets/{ticket_id}/messages", [], limit=500)
    docs.sort(key=lambda m: m.get("createdAt", ""))
    return {"data": docs, "total": len(docs)}


@router.post("/expert-tickets/{ticket_id}/messages", status_code=201)
async def post_ticket_message(
    ticket_id: str, body: TicketMessageIn, uid: str = Depends(current_user_id)
):
    await _require_ticket_access(ticket_id, uid)
    text = body.text.strip()
    if not text:
        _error(422, "VALIDATION_ERROR", "message text required")
    user = await get_user(uid) or {}
    message = {
        "id": f"tmsg_{uuid.uuid4().hex[:12]}",
        "ticketId": ticket_id,
        "authorUid": uid,
        "authorRole": "agent" if _is_admin(user) else "user",
        "text": text,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await set_doc(f"expert_tickets/{ticket_id}/messages", message["id"], message)
    return message


@router.get("/experts")
async def list_available_experts(uid: str = Depends(current_user_id)):
    """List certified agronomists and KVK scientists currently available for consult."""
    experts = [
        {
            "id": "exp-01",
            "name": "Dr. Vasantrao Deshmukh",
            "title": "Senior Agronomist & Soil Specialist",
            "institution": "Dr. PDKV Agriculture University / KVK Akola",
            "experienceYears": 18,
            "rating": 4.9,
            "languages": ["Hindi", "Marathi", "English"],
            "specialization": "Cotton, Soybean & IPM Treatments",
            "isOnline": True,
            "nextSlot": "Today 2:30 PM",
        },
        {
            "id": "exp-02",
            "name": "Dr. Anita Sharma",
            "title": "Horticulture & Plant Pathologist",
            "institution": "MPKV Rahuri / KVK Nashik",
            "experienceYears": 14,
            "rating": 4.8,
            "languages": ["Hindi", "English"],
            "specialization": "Tomato, Pomegranate & Protected Cultivation",
            "isOnline": True,
            "nextSlot": "Today 3:00 PM",
        },
        {
            "id": "exp-03",
            "name": "Dr. Rajeshwar Patil",
            "title": "Veterinary Doctor & Dairy Specialist",
            "institution": "Maharashtra Animal & Fishery Sciences Univ.",
            "experienceYears": 12,
            "rating": 4.9,
            "languages": ["Hindi", "Marathi"],
            "specialization": "Cattle Disease, Nutrition & Milking Hygiene",
            "isOnline": True,
            "nextSlot": "Available Now (Emergency)",
        }
    ]
    return {"data": experts, "total": len(experts)}
