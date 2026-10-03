"""FastAPI Router for Kisan Mitra Gemini AI Chatbot & Agronomist Expert Handoff."""
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.db import get_doc, set_doc, query
from app.core.deps import current_user_id
from app.models.chatbot import ChatMessageIn, ChatMessageOut, ExpertHandoffIn, ExpertHandoffOut
from app.services.chatbot import process_chat_message
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
    ticket_id = f"tkt_{uuid.uuid4().hex[:8]}"
    now_iso = datetime.now(timezone.utc).isoformat()
    
    # Assign desk based on category
    desk_map = {
        "crop_health": "Krishi Vigyan Kendra (KVK) Plant Pathology Desk",
        "soil": "District Soil Testing & Chemistry Laboratory",
        "irrigation": "Micro-Irrigation & Water Engineering Cell",
        "livestock": "Animal Husbandry & Veterinary Service Desk",
        "finance": "Lead District Bank & KCC Facilitation Center",
    }
    assigned_desk = desk_map.get(body.category, "General Agricultural Advisory Cell")
    
    ticket = {
        "id": ticket_id,
        "userId": uid,
        "sessionId": body.sessionId,
        "query": body.query,
        "category": body.category,
        "urgency": body.urgency,
        "crop": body.crop,
        "photoUrl": body.photoUrl,
        "notes": body.notes,
        "status": "queued",
        "assignedDesk": assigned_desk,
        "createdAt": now_iso,
        "estimatedWaitMinutes": 15 if body.urgency in ("high", "emergency") else 45,
    }
    
    await set_doc("expert_tickets", ticket_id, ticket)
    await set_doc(f"users/{uid}/expert_tickets", ticket_id, ticket)
    
    return ExpertHandoffOut(
        ticketId=ticket_id,
        status="queued",
        category=body.category,
        urgency=body.urgency,
        assignedDesk=assigned_desk,
        estimatedWaitMinutes=ticket["estimatedWaitMinutes"],
        createdAt=now_iso,
    )


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
