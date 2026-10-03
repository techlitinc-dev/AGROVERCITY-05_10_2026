from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ChatMessageIn(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000, description="Farmer query or prompt")
    sessionId: Optional[str] = Field(None, description="Conversation session ID for multi-turn context")
    language: Optional[str] = Field("hi", description="Preferred vernacular language code (hi, mr, gu, pa, te, ta, en)")
    imageUrl: Optional[str] = Field(None, description="Optional photo URL of crop, pest, or document")
    context: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Contextual farm/crop metadata")


class ChatMessageOut(BaseModel):
    id: str
    sessionId: str
    sender: str = "bot"
    text: str
    timestamp: str
    language: str = "hi"
    richCardType: Optional[str] = None
    richCardData: Optional[Dict[str, Any]] = None
    quickReplies: List[str] = Field(default_factory=list)
    suggestedActions: List[Dict[str, Any]] = Field(default_factory=list)
    audioUrl: Optional[str] = None
    isExpertHandoffSuggested: bool = False


class ExpertHandoffIn(BaseModel):
    sessionId: Optional[str] = None
    query: str = Field(..., min_length=5)
    category: str = Field("crop_health", description="crop_health | soil | irrigation | livestock | finance")
    urgency: str = Field("medium", description="low | medium | high | emergency")
    crop: Optional[str] = None
    photoUrl: Optional[str] = None
    notes: Optional[str] = None


class ExpertHandoffOut(BaseModel):
    ticketId: str
    status: str = "queued"
    category: str
    urgency: str
    assignedDesk: str
    estimatedWaitMinutes: int
    createdAt: str
