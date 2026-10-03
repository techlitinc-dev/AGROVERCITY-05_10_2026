from app.core.db import query, set_doc

SCHEMES = [
    {
        "id": "pm-kisan",
        "name": "PM-KISAN",
        "category": "income-support",
        "benefitAmount": "₹6,000/वर्ष",
        "documentsRequired": ["Aadhaar", "7/12", "Bank passbook"],
        "status": "open",
        "nextDeadline": "2026-12-31",
        "description": "सभी किसान परिवारों को प्रति वर्ष ₹6,000 की आय सहायता।",
        "eligibilityRules": {"maxLandAcres": 10, "states": [], "requiresKcc": False},
    },
    {
        "id": "pmfby",
        "name": "PMFBY",
        "category": "insurance",
        "benefitAmount": "फसल बीमा कवर",
        "documentsRequired": ["Aadhaar", "7/12", "Bank passbook"],
        "status": "open",
        "nextDeadline": "2026-10-31",
        "description": "प्रधानमंत्री फसल बीमा योजना — फसल नुकसान पर बीमा सुरक्षा।",
        "eligibilityRules": {"states": ["Maharashtra"]},
    },
    {
        "id": "soil-health-card",
        "name": "Soil Health Card",
        "category": "soil",
        "benefitAmount": "मुफ़्त मिट्टी परीक्षण",
        "documentsRequired": ["Aadhaar", "7/12"],
        "status": "open",
        "nextDeadline": "2026-12-31",
        "description": "अपनी मिट्टी की मुफ़्त जाँच कराएँ और स्वास्थ्य कार्ड पाएँ।",
        "eligibilityRules": {},
    },
    {
        "id": "pm-kusum",
        "name": "PM-KUSUM",
        "category": "solar",
        "benefitAmount": "सोलर पंप पर 60% सब्सिडी",
        "documentsRequired": ["Aadhaar", "7/12", "Bank passbook"],
        "status": "open",
        "nextDeadline": "2026-11-30",
        "description": "छोटे किसानों के लिए सौर ऊर्जा पंप सब्सिडी योजना।",
        "eligibilityRules": {"maxLandAcres": 2},
    },
    {
        "id": "enam",
        "name": "eNAM",
        "category": "market",
        "benefitAmount": "राष्ट्रीय बाज़ार पहुँच",
        "documentsRequired": ["Aadhaar", "Bank passbook"],
        "status": "open",
        "nextDeadline": "2026-12-31",
        "description": "राष्ट्रीय इलेक्ट्रॉनिक कृषि बाज़ार — ऑनलाइन फसल बिक्री।",
        "eligibilityRules": {},
    },
    {
        "id": "pmksy-drip",
        "name": "PMKSY Drip Subsidy",
        "category": "irrigation",
        "benefitAmount": "ड्रिप सिंचाई पर 55% सब्सिडी",
        "documentsRequired": ["Aadhaar", "7/12", "Bank passbook"],
        "status": "open",
        "nextDeadline": "2026-09-30",
        "description": "सूक्ष्म सिंचाई (ड्रिप/स्प्रिंकलर) पर सब्सिडी।",
        "eligibilityRules": {"states": ["Gujarat"], "requiresKcc": True},
    },
]

PORTALS = [
    {"schemeId": "pm-kisan", "portalUrl": "https://pmkisan.gov.in"},
    {"schemeId": "pmfby", "portalUrl": "https://pmfby.gov.in"},
    {"schemeId": "soil-health-card", "portalUrl": "https://soilhealth.dac.gov.in"},
    {"schemeId": "pm-kusum", "portalUrl": "https://pmkusum.mnre.gov.in"},
    {"schemeId": "enam", "portalUrl": "https://enam.gov.in"},
]


async def seed_schemes():
    existing = await query("schemes", [], limit=1)
    if existing:
        return
    for scheme in SCHEMES:
        await set_doc("schemes", scheme["id"], scheme)
