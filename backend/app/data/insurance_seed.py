from app.core.db import query, set_doc

RATES = [
    {
        "id": "wheat-kharif",
        "cropName": "Wheat",
        "category": "kharif-crops",
        "season": "Kharif",
        "sumInsuredPerAcre": 40000,
        "farmerSharePercent": 2.0,
        "totalActuarialRatePercent": 12.5,
        "cutoffDate": "2026-07-31",
    },
    {
        "id": "onion-kharif",
        "cropName": "Onion",
        "category": "kharif-crops",
        "season": "Kharif",
        "sumInsuredPerAcre": 35000,
        "farmerSharePercent": 2.0,
        "totalActuarialRatePercent": 11.0,
        "cutoffDate": "2026-07-31",
    },
    {
        "id": "soybean-kharif",
        "cropName": "Soybean",
        "category": "kharif-crops",
        "season": "Kharif",
        "sumInsuredPerAcre": 30000,
        "farmerSharePercent": 2.0,
        "totalActuarialRatePercent": 10.0,
        "cutoffDate": "2026-07-31",
    },
    {
        "id": "wheat-rabi",
        "cropName": "Wheat",
        "category": "rabi-crops",
        "season": "Rabi",
        "sumInsuredPerAcre": 38000,
        "farmerSharePercent": 1.5,
        "totalActuarialRatePercent": 9.5,
        "cutoffDate": "2026-12-15",
    },
    {
        "id": "gram-rabi",
        "cropName": "Gram",
        "category": "rabi-crops",
        "season": "Rabi",
        "sumInsuredPerAcre": 32000,
        "farmerSharePercent": 1.5,
        "totalActuarialRatePercent": 9.0,
        "cutoffDate": "2026-12-15",
    },
    {
        "id": "sugarcane-annual",
        "cropName": "Sugarcane",
        "category": "annual",
        "season": "Annual",
        "sumInsuredPerAcre": 90000,
        "farmerSharePercent": 5.0,
        "totalActuarialRatePercent": 14.0,
        "cutoffDate": "2026-12-31",
    },
]

SCHEMES = [
    {
        "id": "pmfby",
        "code": "PMFBY",
        "titleEn": "Pradhan Mantri Fasal Bima Yojana",
        "titleHi": "प्रधानमंत्री फसल बीमा योजना",
        "descriptionEn": "Comprehensive risk insurance covering yield losses due to non-preventable natural risks from pre-sowing to post-harvest.",
        "descriptionHi": "बुवाई पूर्व से लेकर कटाई उपरांत तक सभी अपरिहार्य प्राकृतिक आपदाओं से फसल नुकसान का व्यापक जोखिम सुरक्षा कवच।",
        "category": "crop",
        "premiumShareRules": "Farmer pays 2.0% for Kharif, 1.5% for Rabi, 5.0% for annual commercial/horticultural crops. Balance premium shared 50:50 by Central and State Govts.",
        "applicableCrops": ["Wheat", "Onion", "Soybean", "Gram", "Cotton", "Paddy", "Mustard", "Sugarcane"],
        "cutoffNotice": "Kharif cutoff: 31 July | Rabi cutoff: 15 December",
        "claimWindowHours": 72,
    },
    {
        "id": "rwbcis",
        "code": "RWBCIS",
        "titleEn": "Restructured Weather Based Crop Insurance Scheme",
        "titleHi": "पुनर्गठित मौसम आधारित फसल बीमा योजना",
        "descriptionEn": "Parametric weather index insurance mitigating hardship caused by adverse weather conditions like rainfall deficit, excess rain, frost, heat waves and humidity.",
        "descriptionHi": "मौसम सूचकांक आधारित बीमा जो वर्षा की कमी, अतिवृष्टि, पाला, लू और आर्द्रता जैसी प्रतिकूल मौसमी स्थितियों से नुकसान की भरपाई करता है।",
        "category": "weather",
        "premiumShareRules": "Farmer pays actuarial capped rate (max 5%). Center & State pay 50:50 subsidy. Direct parametric triggers without waiting for field survey.",
        "applicableCrops": ["Tomato", "Pomegranate", "Grapes", "Orange", "Banana", "Chilli"],
        "cutoffNotice": "Seasonal automated weather trigger based on IMD grid stations",
        "claimWindowHours": 48,
    },
    {
        "id": "pashu-bima",
        "code": "PASHU-BIMA",
        "titleEn": "Comprehensive Livestock & Dairy Insurance Scheme",
        "titleHi": "व्यापक पशुधन एवं डेयरी सुरक्षा बीमा योजना",
        "descriptionEn": "Protects farmers and dairy managers against capital loss due to animal death, disease, calving complications, or permanent total disability.",
        "descriptionHi": "दुधारू गाय, भैंस और अन्य पशुओं की आकस्मिक मृत्यु, बीमारी या स्थायी अक्षमता से होने वाले वित्तीय नुकसान से सुरक्षा।",
        "category": "livestock",
        "premiumShareRules": "Farmer pays 20-30% premium. Govt provides 70-80% subsidy for SC/ST and small/marginal dairy farmers. RFID Ear-Tag mandatory.",
        "applicableCrops": ["Indigenous Cow", "Crossbreed Cow", "Murrah Buffalo", "Goat", "Sheep"],
        "cutoffNotice": "Year-round rolling coverage with veterinary health certificate",
        "claimWindowHours": 24,
    },
    {
        "id": "solar-pump-shield",
        "code": "SOLAR-PUMP",
        "titleEn": "PM-KUSUM Solar Agri-Pump & Micro-Irrigation Shield",
        "titleHi": "सोलर कृषि पंप एवं ड्रिप सिंचाई उपकरण सुरक्षा योजना",
        "descriptionEn": "All-risk insurance for off-grid and grid-connected solar agricultural pumps, micro-inverters, panels and drip networks against lightning, storm and theft.",
        "descriptionHi": "सोलर पंप सेट, सोलर पैनल, इन्वर्टर और ड्रिप-स्प्रिंकलर नेटवर्क को आकाशीय बिजली, आंधी, तूफान और चोरी से पूर्ण सुरक्षा।",
        "category": "equipment",
        "premiumShareRules": "Nominal annual premium of 1.25% of capital asset cost. 50% subsidized under state renewable mission.",
        "applicableCrops": ["Solar Submersible Pump", "Surface Solar Pump", "Drip Lateral Network", "Sprinkler Set"],
        "cutoffNotice": "Available at equipment commissioning with warranty tie-up",
        "claimWindowHours": 72,
    },
]


async def seed_insurance_rates():
    existing = await query("insurance_rates", [], limit=1)
    if existing:
        return
    for rate in RATES:
        await set_doc("insurance_rates", rate["id"], rate)


async def seed_insurance_schemes():
    existing = await query("insurance_schemes", [], limit=1)
    if existing:
        return
    for scheme in SCHEMES:
        await set_doc("insurance_schemes", scheme["id"], scheme)
