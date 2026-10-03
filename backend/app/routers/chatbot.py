"""FastAPI Router for Kisan Mitra Gemini AI Chatbot & Agronomist Expert Handoff."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.db import query
from app.core.deps import current_user_id
from app.models.chatbot import ChatMessageIn, ChatMessageOut, ExpertHandoffIn, ExpertHandoffOut
from app.services.chatbot import create_expert_ticket, process_chat_message
from app.services.users import get_user

router = APIRouter(prefix="/chatbot", tags=["chatbot"])


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
