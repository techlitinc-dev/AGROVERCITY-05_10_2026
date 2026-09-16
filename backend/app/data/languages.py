LANGUAGES: list[dict] = [
    {
        "code": "hi",
        "name": "हिन्दी",
        "englishName": "Hindi",
        "regions": ["North", "Central", "West"],
        "audioText": "नमस्ते, किसान सेतु में आपका स्वागत है",
    },
    {
        "code": "mr",
        "name": "मराठी",
        "englishName": "Marathi",
        "regions": ["West"],
        "audioText": "नमस्कार, किसान सेतु मध्ये आपले स्वागत आहे",
    },
    {
        "code": "gu",
        "name": "ગુજરાતી",
        "englishName": "Gujarati",
        "regions": ["West"],
        "audioText": "નમસ્તે, કિસાન સેતુમાં આપનું સ્વાગત છે",
    },
    {
        "code": "pa",
        "name": "ਪੰਜਾਬੀ",
        "englishName": "Punjabi",
        "regions": ["North"],
        "audioText": "ਸਤ ਸ੍ਰੀ ਅਕਾਲ, ਕਿਸਾਨ ਸੇਤੂ ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ",
    },
    {
        "code": "te",
        "name": "తెలుగు",
        "englishName": "Telugu",
        "regions": ["South"],
        "audioText": "నమస్తే, కిసాన్ సేతుకు స్వాగతం",
    },
    {
        "code": "ta",
        "name": "தமிழ்",
        "englishName": "Tamil",
        "regions": ["South"],
        "audioText": "வணக்கம், கிசான் சேதுவிற்கு வரவேற்கிறோம்",
    },
    {
        "code": "en",
        "name": "English",
        "englishName": "English",
        "regions": ["North", "Central", "West", "East", "NorthEast", "South"],
        "audioText": "Namaste, welcome to Kisan Setu",
    },
]

REGIONAL_MAPPING: dict[str, list[str]] = {
    "North": ["pa", "hi"],
    "Central": ["hi"],
    "West": ["mr", "gu"],
    "East": [],
    "NorthEast": [],
    "South": ["te", "ta"],
}
