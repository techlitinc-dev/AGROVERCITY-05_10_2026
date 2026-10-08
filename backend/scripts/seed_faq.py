"""Seed `faq_articles` from the legal/help copy + basic app-help entries (WS-05).

Idempotent upsert keyed by slugified title + lang; also indexes each article in
the shared `search_index` (faq) so the M30 support agent can retrieve it.
Run: `cd backend && .venv/bin/python scripts/seed_faq.py`
"""
import asyncio
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.db import get_doc, set_doc
from app.services import search_index

FAQ_SEED = [
    {
        "category": "app_help",
        "lang": "en",
        "title": "How do I add a plot?",
        "body": "Open the Land section from your dashboard, tap Add plot, and enter the plot size, village, district and soil type. You can also draw the boundary on the farm map.",
    },
    {
        "category": "app_help",
        "lang": "hi",
        "title": "प्लॉट कैसे जोड़ें?",
        "body": "डैशबोर्ड से भूमि अनुभाग खोलें, प्लॉट जोड़ें पर टैप करें और प्लॉट का आकार, गाँव, ज़िला तथा मिट्टी का प्रकार भरें। आप खेत नक्शे पर सीमा भी बना सकते हैं।",
    },
    {
        "category": "app_help",
        "lang": "en",
        "title": "How do I create a lot for sale?",
        "body": "Go to Sell Produce, tap Create lot, choose the crop, quantity in quintals and your expected rate, add photos, and publish. Buyers can then send you offers.",
    },
    {
        "category": "app_help",
        "lang": "hi",
        "title": "बिक्री के लिए लॉट कैसे बनाएँ?",
        "body": "उपज बेचें में जाएँ, लॉट बनाएँ पर टैप करें, फसल, क्विंटल में मात्रा और अपेक्षित भाव चुनें, फोटो जोड़ें और प्रकाशित करें। इसके बाद खरीदार आपको ऑफ़र भेज सकते हैं।",
    },
    {
        "category": "app_help",
        "lang": "en",
        "title": "How do I book transport for my produce?",
        "body": "Open the Load Board, post a load with pickup and drop locations and weight, then accept a transporter's bid. Chat unlocks once a transporter is confirmed.",
    },
    {
        "category": "app_help",
        "lang": "hi",
        "title": "अपनी उपज के लिए परिवहन कैसे बुक करें?",
        "body": "लोड बोर्ड खोलें, पिकअप और ड्रॉप स्थान तथा वज़न के साथ लोड पोस्ट करें, फिर ट्रांसपोर्टर की बोली स्वीकार करें। ट्रांसपोर्टर पक्का होने पर चैट खुल जाती है।",
    },
    {
        "category": "app_help",
        "lang": "en",
        "title": "How do I check today's mandi bhav?",
        "body": "Open the Mandi section to see today's modal price for your crops by district, and set a price alert to be notified when the rate crosses your target.",
    },
    {
        "category": "app_help",
        "lang": "hi",
        "title": "आज का मंडी भाव कैसे देखें?",
        "body": "मंडी अनुभाग खोलकर ज़िले के अनुसार अपनी फसलों का आज का मॉडल भाव देखें, और भाव आपके लक्ष्य तक पहुँचने पर सूचना पाने के लिए मूल्य अलर्ट लगाएँ।",
    },
    {
        "category": "app_help",
        "lang": "en",
        "title": "How do I change my notification settings?",
        "body": "Open Settings, tap Notification settings, and toggle categories (tasks, trade, payments, social, marketing) and channels (push, SMS, in-app). You can also opt into digest mode or override quiet hours.",
    },
    {
        "category": "app_help",
        "lang": "hi",
        "title": "अपनी सूचना सेटिंग्स कैसे बदलें?",
        "body": "सेटिंग्स खोलें, सूचना सेटिंग्स पर टैप करें, और श्रेणियाँ (कार्य, व्यापार, भुगतान, सामाजिक, मार्केटिंग) तथा चैनल (पुश, एसएमएस, इन-ऐप) चालू/बंद करें। डाइजेस्ट मोड चुन सकते हैं या शांत समय ओवरराइड कर सकते हैं।",
    },
    {
        "category": "legal",
        "lang": "en",
        "title": "How do I delete my account?",
        "body": "Open Settings, go to Delete account, read the consequences, and enter your MPIN to confirm. Your profile and data are purged; this cannot be undone.",
    },
    {
        "category": "legal",
        "lang": "hi",
        "title": "अपना खाता कैसे हटाएँ?",
        "body": "सेटिंग्स खोलें, खाता हटाएँ में जाएँ, परिणाम पढ़ें, और पुष्टि के लिए अपना MPIN दर्ज करें। आपकी प्रोफ़ाइल और डेटा हटा दिया जाता है; इसे पूर्ववत नहीं किया जा सकता।",
    },
    {
        "category": "legal",
        "lang": "en",
        "title": "How do I request a refund?",
        "body": "Raise cancellations, disputes and refund requests from the order or booking detail screen, or through Help & Support. Keep photos of the produce and the weighbridge slip.",
    },
    {
        "category": "legal",
        "lang": "hi",
        "title": "धनवापसी कैसे माँगें?",
        "body": "रद्दीकरण, विवाद और धनवापसी अनुरोध ऑर्डर या बुकिंग विवरण स्क्रीन से, या Help & Support से करें। उपज की फोटो और कांटा पर्ची रखें।",
    },
]


def _slug(title: str, lang: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return f"{lang}-{base}"[:80]


async def main() -> int:
    now = datetime.now(timezone.utc).isoformat()
    for item in FAQ_SEED:
        doc_id = f"faq_{_slug(item['title'], item['lang'])}"
        existing = await get_doc("faq_articles", doc_id)
        doc = {
            "id": doc_id,
            **item,
            "status": "published",
            "createdAt": existing.get("createdAt") if existing else now,
        }
        await set_doc("faq_articles", doc_id, doc)
        await search_index.upsert_document("faq", doc_id, f"{item['title']}. {item['body']}")
    return len(FAQ_SEED)


if __name__ == "__main__":
    print(asyncio.run(main()))
