from app.core.db import query, set_doc

# X16 (WS-05 task 5.9): v1 streams ONLY licensed embedded channels. DD Kisan
# publishes a public licensed HLS endpoint; the remaining seeded channels keep
# the neutral test placeholder until a licensed URL is referenced in the repo
# (no invented stream URLs).
DD_KISAN_HLS = "https://ddkisan.akamaized.net/hls/live/2007789/ddkisan/master.m3u8"
HLS_PLACEHOLDER = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"

NEWS = [
    {
        "id": "news-1",
        "title": "Centre Hikes Onion Export Minimum Price & Buffer Procurement",
        "vernacularTitle": "केंद्र सरकारकडून नाफेड व एनसीसीएफ द्वारे 5 लाख टन कांदा खरेदीचे आदेश जारी",
        "category": "market-policy",
        "source": "Agri Ministry Press Bureau",
        "timestamp": "2026-09-17T08:30:00Z",
        "summary": "शेतकऱ्यांना रास्त भाव मिळण्यासाठी थेट खरेदी केंद्रांवर ₹2,200 प्रतिक्विंटलने खरेदी सुरू करण्याचे निर्देश.",
        "content": "नासिक, पुणे आणि अहमदनगर जिल्ह्यात कांद्याचे कोसळलेले भाव सावरण्यासाठी ग्राहक संरक्षण मंत्रालयाने तात्काळ हस्तक्षेप केला आहे. थेट शेतकऱ्यांच्या बँक खात्यात 48 तासांत डीबीटी द्वारे रक्कम जमा केली जाईल.",
        "isBreaking": True,
        "audioText": "ताजी कृषी बातमी: केंद्र सरकारने नाफेड द्वारे पाच लाख टन कांदा खरेदी करण्याचे आदेश दिले आहेत. प्रति क्विंटल बावीसशे रुपये दर दिला जाईल.",
        "impactRating": "High Bullish 📈",
    },
    {
        "id": "news-2",
        "title": "IMD Issues 48-Hour Thunderstorm & Spray Alert for Central Maharashtra",
        "vernacularTitle": "मध्य महाराष्ट्र व मराठवाड्यात पुढील 48 तासांत वादळी वाऱ्यासह पावसाचा इशारा",
        "category": "weather-alert",
        "source": "IMD Weather Forecasting Division",
        "timestamp": "2026-09-17T07:00:00Z",
        "summary": "नाशिक, जालना, छत्रपती संभाजीनगर येथे हलका ते मध्यम पाऊस शक्य. द्राक्ष व भाजीपाला फवारणी पुढे ढकलावी.",
        "content": "अरबी समुद्रात निर्माण झालेल्या कमी दाबाच्या पट्ट्यामुळे दुपारनंतर ढगाळ वातावरण राहून विजांच्या कडकडाटासह पाऊस होईल. कीटकनाशक फवारणी आज करू नये.",
        "isBreaking": False,
        "audioText": "हवामान इशारा: पुढील अठ्ठेचाळीस तासांत नाशिक आणि मराठवाड्यात पावसाची शक्यता आहे. फवारणी कामे थांबवावीत.",
        "impactRating": "Caution ⚠️",
    },
    {
        "id": "news-3",
        "title": "PM-KUSUM Solar Pump 4th Phase Online Portal Open with 60% Subsidy",
        "vernacularTitle": "महाकृषी ऊर्जा अभियानांतर्गत 1 लाख नवीन सौर कृषी पंपांचे अर्ज सुरू",
        "category": "govt-subsidy",
        "source": "Mahavitaran Energy Portal",
        "timestamp": "2026-09-17T05:00:00Z",
        "summary": "3 HP, 5 HP आणि 7.5 HP सौर पंपांवर सर्वसाधारण प्रवर्गाला 60% तर SC/ST प्रवर्गाला 85% अनुदान उपलब्ध.",
        "content": "अर्ज करण्यासाठी 7/12 उतारा, आधार कार्ड आणि विहिरीचा पाण्याचा दाखला आवश्यक आहे. अर्ज प्रक्रिया डिजिटल पोर्टलवर सुरू झाली आहे.",
        "isBreaking": False,
        "audioText": "सौर पंप योजना: महावितरणच्या संकेतस्थळावर नवीन एक लाख सौर पंपांचे अर्ज सुरू झाले आहेत.",
        "impactRating": "Subsidy Benefit ⚡",
    },
    {
        "id": "news-4",
        "title": "Record Demand for Organic Bio-Fertilizers & Nano Urea in Kharif Sowing",
        "vernacularTitle": "नॅनो युरिया व नॅनो डीएपीच्या वापरामुळे शेतकऱ्यांची खत बिलात 40% बचत",
        "category": "agri-tech",
        "source": "ICAR Field Trials Report",
        "timestamp": "2026-09-17T02:00:00Z",
        "summary": "पारंपरिक दाणेदार खतांच्या तुलनेत नॅनो खतांची कार्यक्षमता 85% जास्त असल्याचे नव्या संशोधनात सिद्ध.",
        "content": "पानांवर थेट फवारणी केल्यामुळे जमिनीचे आरोग्य सुधारते आणि पिकाची रोगप्रतिकार शक्ती वाढते.",
        "isBreaking": False,
        "audioText": "खत तंत्रज्ञान: नॅनो खतांच्या वापरामुळे पिकाची उत्पादकता वाढून चाळीस टक्के खर्चाची बचत होत आहे.",
        "impactRating": "Tech Insight 💡",
    },
    {
        "id": "news-5",
        "title": "Hailstorm Warning for Vidarbha Orange & Cotton Belt This Weekend",
        "vernacularTitle": "विदर्भातील संत्रा व कापूस पट्ट्यासाठी गारपिटीचा इशारा",
        "category": "weather-alert",
        "source": "IMD Regional Centre Nagpur",
        "timestamp": "2026-09-16T18:00:00Z",
        "summary": "अमरावती व नागपूर जिल्ह्यात शनिवारी गारपीट होण्याची शक्यता; पिके झाकण्यासाठी शेडनेट वापरावे.",
        "content": "कमी दाबाच्या पट्ट्यामुळे विदर्भात स्थानिक गारपीट होऊ शकते. पक्व संत्रे लवकर काढून साठवावीत, कापूस काढणी पुढे ढकलावी.",
        "isBreaking": False,
        "audioText": "गारपीट इशारा: विदर्भात शनिवारी गारपीट होण्याची शक्यता आहे. पिकांचे संरक्षण करावे.",
        "impactRating": "Caution ⚠️",
    },
    {
        "id": "news-6",
        "title": "Nashik APMC Sees Record Onion Arrivals; Floor Price Stabilizes",
        "vernacularTitle": "नाशिक बाजार समितीत कांद्याची विक्रमी आवक; तळभाव स्थिर",
        "category": "market-policy",
        "source": "Nashik APMC Market Committee",
        "timestamp": "2026-09-16T12:00:00Z",
        "summary": "लासलगाव APMC मध्ये 2.1 लाख क्विंटल कांदा आवक; सरासरी भाव ₹1,850 प्रतिक्विंटलवर स्थिर.",
        "content": "निर्यात धोरणामुळे व्यापाऱ्यांचा विश्वास वाढला असून तळभावाला आधार मिळाला आहे. येणाऱ्या आठवड्यात आवक आणखी वाढण्याचा अंदाज.",
        "isBreaking": False,
        "audioText": "बाजारभाव: नाशिक बाजार समितीत कांद्याची विक्रमी आवक झाली असून भाव स्थिर आहेत.",
        "impactRating": "Neutral ➖",
    },
]

CHANNELS = [
    {
        "id": "ch-1",
        "channelName": "DD Kisan",
        "broadcaster": "Doordarshan Agri Central",
        "programTitle": "Mausam Khabar & Kharif Crop Advisory",
        "currentSpeaker": "Dr. Sandeep Kumar (IMD Scientist)",
        "liveViewersCount": 14280,
        "isLiveNow": True,
        "category": "Weather & Advisory",
        "streamThumbnail": "assets/ai.png",
        "streamUrl": DD_KISAN_HLS,
        "scheduleTime": "Live Now (24x7)",
    },
    {
        "id": "ch-2",
        "channelName": "Nashik APMC Auction",
        "broadcaster": "Doordarshan Sahyadri",
        "programTitle": "Pimpalgaon & Nashik APMC Live Mandi Auction",
        "currentSpeaker": "Sambhaji Gaikwad (APMC Secretary)",
        "liveViewersCount": 8950,
        "isLiveNow": True,
        "category": "Live Mandi Auction",
        "streamThumbnail": "assets/app_icon.png",
        "streamUrl": HLS_PLACEHOLDER,
        "scheduleTime": "Live: 10:00 AM – 4:00 PM",
    },
    {
        "id": "ch-3",
        "channelName": "KVK Live",
        "broadcaster": "ICAR-KVK Yashwantrao Chavan Open University",
        "programTitle": "Micro-Irrigation & Automation Masterclass",
        "currentSpeaker": "Er. Ramesh Deshmukh (Water Engineer)",
        "liveViewersCount": 4210,
        "isLiveNow": False,
        "category": "Technical Training",
        "streamThumbnail": "assets/ai.png",
        "streamUrl": HLS_PLACEHOLDER,
        "scheduleTime": "Live Today 2:30 PM",
    },
    {
        "id": "ch-4",
        "channelName": "Maharashtra Agri TV",
        "broadcaster": "Maharashtra State Agro Media",
        "programTitle": "Export Grapes & Pomegranate Success Blueprint",
        "currentSpeaker": "Kailash Patil (National Progressive Farmer)",
        "liveViewersCount": 6120,
        "isLiveNow": False,
        "category": "Farmer Stories",
        "streamThumbnail": "assets/app_icon.png",
        "streamUrl": HLS_PLACEHOLDER,
        "scheduleTime": "Today 6:00 PM Live",
    },
]


SCHEDULED_BROADCASTS = [
    {
        "id": "bcast-1",
        "channelName": "KVK Live Masterclass",
        "programTitle": "सोयाबीन खोडकिड व बुरशी नियंत्रण थेट संवाद",
        "speakerName": "Dr. Hemant Patil (Senior Entomologist)",
        "speakerRole": "मुख्य शास्त्रज्ञ, केव्हीके बारामती",
        "scheduledStart": "उद्या सकाळी 11:00 AM",
        "topic": "Pest & Disease Management",
        "reminderCount": 342,
        "hasReminder": False,
        "thumbnailUrl": "assets/ai.png",
    },
    {
        "id": "bcast-2",
        "channelName": "Maharashtra Agri TV",
        "programTitle": "डाळिंब बागेत ठिबक ऑटोमेशन व फर्टिगेशन नियोजन",
        "speakerName": "Prof. Sanjay Shinde (Irrigation Specialist)",
        "speakerRole": "सिंचन तज्ज्ञ, महात्मा फुले कृषी विद्यापीठ",
        "scheduledStart": "उद्या दुपारी 4:00 PM",
        "topic": "Micro-Irrigation Tech",
        "reminderCount": 218,
        "hasReminder": False,
        "thumbnailUrl": "assets/app_icon.png",
    },
    {
        "id": "bcast-3",
        "channelName": "Sahyadri Mandi Live",
        "programTitle": "कांदा व टोमॅटो निर्यात धोरण व पुढील 15 दिवसांचे भाव",
        "speakerName": "Sambhaji Gaikwad (APMC Advisor)",
        "speakerRole": "बाजार समिती मुख्य सल्लागार",
        "scheduledStart": "28 Sep सकाळी 10:30 AM",
        "topic": "Market Trends & Export",
        "reminderCount": 590,
        "hasReminder": False,
        "thumbnailUrl": "assets/ai.png",
    },
]

LIVE_POLLS = [
    {
        "id": "poll-101",
        "channelId": "ch-1",
        "question": "यंदाच्या हंगामात तुमच्या भागात सोयाबीन पिकावर खोडकिडीचा प्रादुर्भाव जाणवला का?",
        "options": [
            "हो, मोठ्या प्रमाणावर (Severe)",
            "हो, मर्यादित स्वरूपात (Mild)",
            "नाही, पीक सुरक्षित आहे (None)",
        ],
        "votes": {"0": 142, "1": 89, "2": 24},
        "totalVotes": 255,
        "isActive": True,
        "createdAt": "2026-09-17T08:00:00Z",
    }
]

LIVE_QUESTIONS = [
    {
        "id": "q-1",
        "channelId": "ch-1",
        "userId": "u-guest-1",
        "userName": "अशोक सावंत (सांगली)",
        "questionText": "ढगाळ हवामानात क्लोरपायरिफॉस सोबत बुरशीनाशक एकत्र फवारणे योग्य आहे का?",
        "upvotesCount": 28,
        "isAnswered": True,
        "createdAt": "2026-09-17T08:10:00Z",
    },
    {
        "id": "q-2",
        "channelId": "ch-1",
        "userId": "u-guest-2",
        "userName": "दत्तात्रेय मोरे (जालना)",
        "questionText": "कपाशीमध्ये पातेगळ रोखण्यासाठी सूक्ष्म अन्नद्रव्यांचे प्रमाण किती ठेवावे?",
        "upvotesCount": 19,
        "isAnswered": False,
        "createdAt": "2026-09-17T08:15:00Z",
    },
]


async def seed_content():
    if not await query("news", [], limit=1):
        for item in NEWS:
            await set_doc("news", item["id"], item)
    if not await query("channels", [], limit=1):
        for channel in CHANNELS:
            await set_doc("channels", channel["id"], channel)
    if not await query("broadcast_schedules", [], limit=1):
        for bcast in SCHEDULED_BROADCASTS:
            await set_doc("broadcast_schedules", bcast["id"], bcast)
    if not await query("channels/ch-1/polls", [], limit=1):
        for poll in LIVE_POLLS:
            await set_doc("channels/ch-1/polls", poll["id"], poll)
    if not await query("channels/ch-1/questions", [], limit=1):
        for q in LIVE_QUESTIONS:
            await set_doc("channels/ch-1/questions", q["id"], q)

