"""Kisan Mitra AI Chatbot Service.

Powered by Google Gemini 2.5 Flash / Pro models for conversational agronomy,
crop diagnostics, mandi rate interpretation, and weather advisory.
"""
import re
import uuid
from datetime import datetime, timezone

from app.core.config import settings
from app.core.db import set_doc
from app.models.chatbot import ChatMessageIn, ChatMessageOut
from app.services.ai import gateway, privacy

KISAN_MITRA_SYSTEM_PROMPT = """
You are Kisan Mitra (किसान मित्र), an expert rural smart-agriculture AI advisor for India.
You converse respectfully in simple Hindi / Hinglish / English, matching the user's language.
Your domain expertise includes:
1. Crop nutrition (NPK, micronutrients, compost, organic biofertilizers)
2. Pest & disease diagnosis with IPM treatments (chemical + organic alternatives)
3. Mandi rates, saturation warnings, and MSP lock-in strategies
4. Weather-based spray and irrigation timing (rain radar alerts)
5. Govt schemes (PM-KISAN, PMFBY crop insurance, Soil Health Card, PM-KUSUM)

Format your response in friendly, clear markdown with emojis.
When relevant, recommend next steps (e.g. spray schedule, soil test, booking yantra).
"""

_DESK_MAP = {
    "crop_health": "Krishi Vigyan Kendra (KVK) Plant Pathology Desk",
    "soil": "District Soil Testing & Chemistry Laboratory",
    "irrigation": "Micro-Irrigation & Water Engineering Cell",
    "livestock": "Animal Husbandry & Veterinary Service Desk",
    "finance": "Lead District Bank & KCC Facilitation Center",
}

_INTENT_CATEGORY = {
    "money": "finance",
    "agronomy": "crop_health",
    "market": "crop_health",
    "app_help": "crop_health",
}

HANDOFF_COPY = {
    "hi": "🙏 आपका सवाल कृषि विशेषज्ञ को भेज दिया गया है। विशेषज्ञ का जवाब इसी चैट में आएगा।",
    "en": "🙏 Your question has been shared with an agronomy expert. The expert's answer will arrive in this chat.",
    "mr": "🙏 तुमचा प्रश्न कृषी तज्ञांना पाठवला आहे. तज्ञांचे उत्तर याच चॅटमध्ये येईल.",
}

MONEY_NEUTRAL_COPY = {
    "hi": (
        "💰 ऋण, बीमा या वित्तीय निर्णयों पर मैं केवल सामान्य जानकारी दे सकता हूँ — "
        "व्यक्तिगत सलाह नहीं। कृपया बैंक या बीमा विशेषज्ञ से परामर्श करें। "
        "चाहें तो मैं आपकी बात हमारे वित्त विशेषज्ञ तक पहुँचा दूँ।"
    ),
    "en": (
        "💰 For loans, insurance or financial decisions I can only share general "
        "information — never personal advice. Please consult a bank or insurance "
        "expert. If you wish, I can connect you with our finance expert."
    ),
    "mr": (
        "💰 कर्ज, विमा किंवा आर्थिक निर्णयांबद्दल मी फक्त सामान्य माहिती देऊ शकतो — "
        "वैयक्तिक सल्ला नाही. कृपया बँक किंवा विमा तज्ञांचा सल्ला घ्या. "
        "हवे असल्यास मी तुमचा प्रश्न आमच्या वित्त तज्ञांपर्यंत पोहोचवतो."
    ),
}

SAFE_FALLBACK = {
    "hi": "🙏 मैं इस विषय पर सुरक्षित उत्तर नहीं दे सकता। कृपया कृषि विशेषज्ञ से सलाह लें — मैं आपकी बात उन्हें भेज सकता हूँ।",
    "en": "🙏 I can't safely answer this topic. Please consult an agronomy expert — I can forward your question to them.",
    "mr": "🙏 मी या विषयावर सुरक्षित उत्तर देऊ शकत नाही. कृपया कृषी तज्ञांचा सल्ला घ्या — मी तुमचा प्रश्न त्यांना पाठवू शकतो.",
}

_CONTACT_STRIP_RE = re.compile(
    r"(?:(?:\+?91[\s-]?)?[6-9]\d{9})|(?:[\w.+-]+@[\w-]+\.[\w.-]+)|(?:https?://\S+|www\.\S+)"
)


def copy_for(copy_map: dict, language: str | None) -> str:
    lang = (language or "hi").split("-")[0]
    return copy_map.get(lang) or copy_map.get("hi")


async def create_expert_ticket(
    uid: str,
    query: str,
    category: str = "crop_health",
    urgency: str = "medium",
    session_id: str | None = None,
    crop: str | None = None,
    photo_url: str | None = None,
    notes: str | None = None,
) -> dict:
    """Shared expert-ticket writer (message-flow handoff + /expert-handoff)."""
    ticket_id = f"tkt_{uuid.uuid4().hex[:8]}"
    now_iso = datetime.now(timezone.utc).isoformat()
    assigned_desk = _DESK_MAP.get(category, "General Agricultural Advisory Cell")
    ticket = {
        "id": ticket_id,
        "userId": uid,
        "sessionId": session_id,
        "query": query,
        "category": category,
        "urgency": urgency,
        "crop": crop,
        "photoUrl": photo_url,
        "notes": notes,
        "status": "queued",
        "assignedDesk": assigned_desk,
        "createdAt": now_iso,
        "estimatedWaitMinutes": 15 if urgency in ("high", "emergency") else 45,
    }
    await set_doc("expert_tickets", ticket_id, ticket)
    await set_doc(f"users/{uid}/expert_tickets", ticket_id, ticket)
    return ticket


async def _persona_context(user_id: str) -> tuple[str, str]:
    """Active persona + a compact numbers-layer snippet for the system prompt."""
    from app.services.users import get_user

    user = await get_user(user_id) or {}
    persona = user.get("activeProfile") or user.get("primaryProfile") or "farmer"
    snippet = ""
    try:
        from app.routers.intelligence import intelligence as intelligence_payload

        payload = await intelligence_payload(uid=user_id)
        kpis = (payload or {}).get("kpis") or []
        snippet = "; ".join(
            f"{kpi.get('key')}: {kpi.get('value')}{kpi.get('unit') or ''}" for kpi in kpis[:4]
        )
    except Exception:  # noqa: BLE001 — snippet is best-effort context
        snippet = ""
    return persona, snippet


def build_system_prompt(persona: str, snippet: str, language: str | None) -> str:
    header = f"User persona: {persona}. Preferred language: {language or 'hi'}."
    if snippet:
        header += f"\nNumbers context (read-only): {snippet}"
    return f"{header}\n\n{KISAN_MITRA_SYSTEM_PROMPT}"


def strip_contact_info(text: str) -> str:
    return _CONTACT_STRIP_RE.sub("[…]", text)


async def _safety_flags(text: str) -> dict:
    """Contact detection runs locally on the raw text (the gateway sanitizer
    masks phones/emails before any model payload — rule 11); the model check
    for financial/medical advice still routes through the gateway."""
    local_contact = bool(_CONTACT_STRIP_RE.search(text))
    masked = strip_contact_info(text) if local_contact else text
    check = await gateway.decide({"reply": masked}, "chatbot.safety.v1", module="chatbot")
    return {
        "has_contact_info": bool(check.answers.get("has_contact_info")) or local_contact,
        "has_financial_advice": bool(check.answers.get("has_financial_advice")),
        "has_medical_certainty": bool(check.answers.get("has_medical_certainty")),
    }


async def _apply_safety(text: str, language: str | None) -> str:
    """chatbot.safety.v1 post-check: strip + regenerate once; else safe fallback."""
    if not text:
        return text
    flags = await _safety_flags(text)
    if not any(flags.values()):
        return text

    stripped = strip_contact_info(text)
    stripped_flags = await _safety_flags(stripped)
    if not any(stripped_flags.values()):
        return stripped

    regenerated = await gateway.generate(
        "Rewrite this reply without phone numbers, links, financial advice or "
        f"medical guarantees — keep it helpful and neutral:\n{stripped}",
        {
            "system": "You are Kisan Mitra, a careful agronomy advisor.",
            "module": "chatbot",
            "fallback_text": "",
        },
    )
    if regenerated:
        regen_flags = await _safety_flags(regenerated)
        if not any(regen_flags.values()):
            return regenerated
    return copy_for(SAFE_FALLBACK, language)


async def process_chat_message(user_id: str, payload: ChatMessageIn, user_name: str = "Kisan") -> ChatMessageOut:
    session_id = payload.sessionId or f"sess_{uuid.uuid4().hex[:8]}"
    msg_id = f"msg_{uuid.uuid4().hex[:12]}"
    now_iso = datetime.now(timezone.utc).isoformat()

    bot_text = ""
    rich_card_type = None
    rich_card_data = None
    quick_replies = []
    suggested_actions = []
    handoff_suggested = False

    # Brief M2: Jev intent routing decides whether this is a bot answer at all.
    persona, snippet = await _persona_context(user_id)
    intent_result = await gateway.decide(
        {
            "message": payload.text,
            "persona": persona,
            "language": payload.language or "hi",
            "user": privacy.hash_user_id(user_id),
        },
        "chatbot.intent.v1",
        module="chatbot",
    )
    intent = intent_result.answers.get("intent") or "agronomy"
    answerable = float(intent_result.answers.get("answerable") or 0.0)

    if intent == "human_needed" or answerable < 0.6:
        ticket = await create_expert_ticket(
            user_id,
            payload.text,
            category=_INTENT_CATEGORY.get(intent, "crop_health"),
            urgency="high" if intent == "human_needed" else "medium",
            session_id=session_id,
        )
        bot_text = copy_for(HANDOFF_COPY, payload.language)
        handoff_suggested = True
        rich_card_type = "expert_handoff"
        rich_card_data = {
            "ticketId": ticket["id"],
            "status": ticket["status"],
            "assignedDesk": ticket["assignedDesk"],
        }
    elif intent == "money":
        # Rule 12: money never exceeds require_confirm — neutral + handoff offer.
        bot_text = copy_for(MONEY_NEUTRAL_COPY, payload.language)
        handoff_suggested = True
        quick_replies = ["कृषि विशेषज्ञ से बात 📞", "आज का मौसम 🌤️", "मंडी भाव 📈"]

    # All model calls go through the AI gateway (global rule 10). In dev/test the
    # provider is `shim` and the agronomic rule engine below is the response.
    if not bot_text and settings.ai_provider == "live":
        bot_text = await gateway.generate(
            f"User: {user_name}\nLocation/Context: {payload.context}\nQuery: {payload.text}",
            {
                "system": build_system_prompt(persona, snippet, payload.language),
                "temperature": 0.3,
                "max_output_tokens": 800,
                "module": "chatbot",
                "fallback_text": "",
            },
        )

    # Agronomic Rule Engine Fallback or Enrichment
    if not bot_text:
        q_lower = payload.text.lower()
        if any(k in q_lower for k in ["tamatar", "tomato", "sow", "boyi"]):
            bot_text = (
                "⚠️ **मार्केट सैचुरेशन अलर्ट (Market Saturation Alert):**\n"
                f"राम राम {user_name} जी! आपके 5 किमी दायरे में 12+ किसानों ने टमाटर की बुवाई दर्ज की है। "
                "आवक 200% बढ़ने से मंडी भाव ₹12-15/किलो तक गिरने का अनुमान है। "
                "बेहतर मुनाफे के लिए आप **शिमला मिर्च (Capsicum)** या **गेंदा फूल** की अंतर-फसल चुन सकते हैं।"
            )
            rich_card_type = "saturation"
            rich_card_data = {
                "crop": "Tomato (टमाटर)",
                "sowingCount": 12,
                "radiusKm": 5,
                "arrivalIncrease": "200%",
                "predictedPrice": "₹12-15/kg",
                "riskLevel": "yellow",
                "alternativeCrop": "Capsicum (शिमला मिर्च)",
                "altPrice": "₹28-35/kg",
            }
            quick_replies = ["शिमला मिर्च जानकारी 🌶️", "टमाटर भाव मंडी 📈", "कृषि विशेषज्ञ से बात 📞"]
            suggested_actions = [{"title": "View Capsicum Advisory", "route": "/advisory/capsicum"}]
        elif any(k in q_lower for k in ["mausam", "weather", "barish", "rain"]):
            bot_text = (
                f"🌤️ **आज का मौसम अपडेट ({user_name} जी के खेत के लिए):**\n"
                "तापमान: 28°C · आर्द्रता: 72% · हवा: 14 km/h उत्तर-पूर्व से।\n"
                "दोपहर 2:00 से 5:00 बजे के बीच 60% हल्की बारिश की संभावना है। "
                "आज कीटनाशक छिड़काव टालें ताकि दवा बह न जाए।"
            )
            quick_replies = ["स्प्रे अलर्ट 🌧️", "मंडी भाव 📈", "यंत्र बुकिंग 🚜"]
            suggested_actions = [{"title": "Check 7-Day Forecast", "route": "/weather"}]
        elif any(k in q_lower for k in ["keeda", "pest", "disease", "rog", "bimari"]):
            bot_text = (
                "📸 **फसल रोग स्कैन सहायक:**\n"
                "पत्तियों पर लक्षण दिखते ही हमारे AI कैमरा से फोटो खींचें। "
                "Gemini AI तुरंत बीमारी का नाम, जैविक उपचार (नीम अर्क) और रासायनिक दवा की सटीक मात्रा बताएगा।"
            )
            quick_replies = ["फोटो स्कैन करें 📸", "जैविक उपचार 🌿", "डॉक्टर परामर्श 👨‍⚕️"]
            suggested_actions = [{"title": "Open Disease Scanner", "route": "/disease-scan"}]
        else:
            bot_text = (
                f"राम राम {user_name} जी! मैं किसान सेतु का AI सलाहकार **किसान मित्र** हूँ।\n"
                "मैं फसल सुरक्षा, जैविक खेती, मंडी भाव, सरकारी योजनाओं (PM-KISAN) और यंत्र बुकिंग में आपकी मदद कर सकता हूँ। "
                "आप नीचे दिए गए विकल्पों में से चुन सकते हैं या अपना सवाल पूछ सकते हैं।"
            )
            quick_replies = ["आज का मौसम 🌤️", "मंडी भाव 📈", "फसल रोग स्कैन 📸", "केसीसी लोन 💳"]

    # Brief M2 safety post-check: strip + regenerate once, else safe fallback.
    if bot_text:
        bot_text = await _apply_safety(bot_text, payload.language)

    # Save to user chat history in Firestore
    chat_record = {
        "id": msg_id,
        "sessionId": session_id,
        "userId": user_id,
        "userQuery": payload.text,
        "botResponse": bot_text,
        "richCardType": rich_card_type,
        "richCardData": rich_card_data,
        "timestamp": now_iso,
    }
    await set_doc(f"users/{user_id}/chatbot_messages", msg_id, chat_record)

    return ChatMessageOut(
        id=msg_id,
        sessionId=session_id,
        sender="bot",
        text=bot_text,
        timestamp=now_iso,
        language=payload.language or "hi",
        richCardType=rich_card_type,
        richCardData=rich_card_data,
        quickReplies=quick_replies,
        suggestedActions=suggested_actions,
        isExpertHandoffSuggested=handoff_suggested
        or "expert" in payload.text.lower()
        or "डॉक्टर" in payload.text,
    )
