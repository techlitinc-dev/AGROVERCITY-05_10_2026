import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.db import get_doc, set_doc

# Curated direct-buyer contract templates (phase-05 WS-01 task 1.20). The
# template picker in directbuyer/ContractFormPage.tsx prefills the form's
# title/terms from these docs; buyers can still write a custom contract.
TEMPLATES = [
    {
        "template_id": "wheat-preharvest-lock",
        "crop": "Wheat",
        "title_en": "Pre-harvest rate lock — Wheat",
        "title_hi": "बुवाई से पहले भाव लॉक — गेहूं",
        "terms_text_en": (
            "The buyer locks the agreed rate per quintal before sowing. The farmer "
            "delivers the full minimum quantity to the stated hub after harvest. "
            "Payment is released via bank DBT within 24 hours of weighing and "
            "quality acceptance."
        ),
        "terms_text_hi": (
            "खरीदार बुवाई से पहले प्रति क्विंटल तय भाव लॉक करता है। किसान कटाई के बाद "
            "पूरी तय मात्रा निर्धारित हब पर पहुंचाता है। तौल और गुणवत्ता स्वीकृति के "
            "24 घंटे के भीतर बैंक DBT से भुगतान होता है।"
        ),
    },
    {
        "template_id": "tomato-weekly-supply",
        "crop": "Tomato",
        "title_en": "Weekly harvest supply — Tomato (Grade A)",
        "title_hi": "साप्ताहिक आपूर्ति — टमाटर (ग्रेड A)",
        "terms_text_en": (
            "The farmer supplies Grade A tomato weekly at the locked rate. Grade A "
            "quality is mandatory at the collection center; rejected lots are "
            "returned at the farmer's cost. Settlement is digital and daily via "
            "UPI/NEFT."
        ),
        "terms_text_hi": (
            "किसान हर हफ्ते तय भाव पर ग्रेड A टमाटर की आपूर्ति करता है। संग्रह केंद्र "
            "पर ग्रेड A गुणवत्ता अनिवार्य है; अस्वीकृत खेप किसान के खर्च पर वापस होती "
            "है। भुगतान रोजाना UPI/NEFT से डिजिटल होता है।"
        ),
    },
    {
        "template_id": "onion-full-season",
        "crop": "Onion",
        "title_en": "Full-season agreement — Red Onion (export size)",
        "title_hi": "पूरे सीज़न का अनुबंध — लाल प्याज (निर्यात आकार)",
        "terms_text_en": (
            "A full-season agreement at the locked rate. A 30% advance is paid at "
            "sowing against this verified contract; the balance 70% is paid at gate "
            "delivery after export-size grading (55mm+)."
        ),
        "terms_text_hi": (
            "तय भाव पर पूरे सीज़न का अनुबंध। इस सत्यापित अनुबंध के आधार पर बुवाई के "
            "समय 30% एडवांस मिलता है; बाकी 70% निर्यात आकार (55 मि.मी.+) की ग्रेडिंग "
            "के बाद गेट डिलीवरी पर मिलता है।"
        ),
    },
    {
        "template_id": "soybean-gate-delivery",
        "crop": "Soybean",
        "title_en": "Gate-delivery purchase — Soybean",
        "title_hi": "गेट डिलीवरी खरीद — सोयाबीन",
        "terms_text_en": (
            "The farmer delivers cleaned soybean at the warehouse gate at the locked "
            "rate. Moisture must be at or below 12% and foreign matter at or below "
            "2%. Weighbridge slip governs the final payable weight and payment is "
            "made by bank transfer within 48 hours."
        ),
        "terms_text_hi": (
            "किसान साफ सोयाबीन तय भाव पर गोदाम गेट पर पहुंचाता है। नमी 12% या कम और "
            "बाहरी पदार्थ 2% या कम होना चाहिए। अंतिम भुगतान वजन वेब्रिज स्लिप से तय "
            "होता है और 48 घंटे के भीतर बैंक ट्रांसफर से भुगतान होता है।"
        ),
    },
]


async def main():
    now = datetime.now(timezone.utc).isoformat()
    seeded = 0
    for template in TEMPLATES:
        if await get_doc("contract_templates", template["template_id"]) is not None:
            continue
        await set_doc(
            "contract_templates",
            template["template_id"],
            {**template, "created_at": now},
        )
        seeded += 1
    print(f"seeded {seeded} contract templates, skipped {len(TEMPLATES) - seeded} existing")


if __name__ == "__main__":
    asyncio.run(main())
