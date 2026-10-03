from app.core.config import settings
from app.core.db import query, set_doc

GAUSHALAS = [
    {
        "id": "gau-1",
        "name": "Shrimant Panchvati Desi Gaushala",
        "trustName": "Shree Ram Panchavati Trust (रजि. क्र. 1884)",
        "address": "Panchavati, Nashik (नाशिक)",
        "district": "Nashik",
        "distanceKm": 6.2,
        "cowCount": 380,
        "breeds": ["गीर (Gir)", "साहिवाल (Sahiwal)", "डांगी (Dangi)", "खिल्लार (Khillar)"],
        "phone": "+91 98224 88771",
        "providesOrganicManure": True,
        "offersCowAdoption": True,
        "rating": 4.9,
        "facilities": "सेंद्रिय गोकृपामृत स्लरी, गांडूळ खत, पंचगव्य औषधी, मोफत पशुवैद्यकीय तपासणी कक्ष",
    },
    {
        "id": "gau-2",
        "name": "Gir Nandan Kamdhenu Kendra",
        "trustName": "Kamdhenu Seva Sanstha",
        "address": "Pimpalgaon Baswant Road, Niphad",
        "district": "Nashik",
        "distanceKm": 4.8,
        "cowCount": 195,
        "breeds": ["गीर (Gir)", "थारपारकर (Tharparkar)", "राठी (Rathi)"],
        "phone": "+91 94220 55667",
        "providesOrganicManure": True,
        "offersCowAdoption": True,
        "rating": 4.8,
        "facilities": "A2 शुद्ध दूध संकलन, शेणखत लाकूड निर्मिती (Gobar Logs for Fuel), गोमूत्र अर्क निर्मिती",
    },
    {
        "id": "gau-3",
        "name": "Khillar Shetkari Sanvardhan Goshala",
        "trustName": "Gramin Pashupalan Trust",
        "address": "Dindori Taluka, Nashik",
        "district": "Nashik",
        "distanceKm": 14.5,
        "cowCount": 120,
        "breeds": ["खिल्लार (Khillar)", "देवणी (Deoni)"],
        "phone": "+91 97651 22334",
        "providesOrganicManure": False,
        "offersCowAdoption": False,
        "rating": 4.7,
        "facilities": "बैल जोडी संगोपन, नैसर्गिक पैदास वीर्य केंद्र, देशी गाईंचे शेणखत पुरवठा",
    },
]

NURSERIES = [
    {
        "id": "nur-1",
        "name": "Govt Certified Horticulture Nursery",
        "ownerName": "कृषी विभाग, महाराष्ट्र शासन",
        "location": "Niphad, Nashik (निफाड कृषी केंद्र)",
        "distanceKm": 3.5,
        "phone": "+91 98230 44551",
        "rating": 4.9,
        "isGovtCertified": True,
        "availableSaplings": ["केसर आंबा (Kesar Mango)", "तैवान पेरू (Guava)", "भगवा डाळिंब (Pomegranate)", "कागदी लिंबू (Lemon)"],
        "priceRange": "₹45 - ₹160 प्रति रोप",
    },
    {
        "id": "nur-2",
        "name": "Shree Ganesh Agri Bio-Tech Nursery",
        "ownerName": "गणेश पांडुरंग शिंदे",
        "location": "Pimpalgaon Baswant (पिंपळगाव बसवंत)",
        "distanceKm": 8.0,
        "phone": "+91 94231 66772",
        "rating": 4.7,
        "isGovtCertified": True,
        "availableSaplings": ["कलमी चिकू (Chiku)", "अंजीर (Fig)", "द्राक्ष रोपे (Grape Rootstocks)", "सीताफळ (Golden Custard Apple)"],
        "priceRange": "₹55 - ₹180 प्रति रोप",
    },
    {
        "id": "nur-3",
        "name": "Kisan Mitra Timber & Fodder Nursery",
        "ownerName": "संजय बापूराव गायकवाड",
        "location": "Dindori Road, Nashik",
        "distanceKm": 12.3,
        "phone": "+91 98229 11223",
        "rating": 4.6,
        "isGovtCertified": False,
        "availableSaplings": ["सागवान टिशू कल्चर (Teak)", "मलाबार कडुनिंब (Melia Dubia)", "सुबाभूळ (Subabul)", "माणगा बांबू (Bamboo)"],
        "priceRange": "₹20 - ₹90 प्रति रोप",
    },
]

VETS = [
    {
        "id": "vet-1",
        "name": "Dr. Anand Kulkarni (M.V.Sc)",
        "qualification": "M.V.Sc (Animal Reproduction & Gynaecology)",
        "specialization": "गायी-म्हशींची कृत्रिम रेतन व प्रसूती तज्ज्ञ (Large Ruminants)",
        "clinicAddress": "Shop 4, Krishi Seva Kendra Complex, Niphad, Nashik",
        "distanceKm": 2.8,
        "phone": "+91 98220 11998",
        "experienceYears": 16,
        "consultationFeeRupees": 500,
        "rating": 4.9,
        "availableForFarmVisit": True,
        "nextAvailableSlot": "आज सायं. 04:30 ते 07:00",
        "emergencyAvailable": True,
    },
    {
        "id": "vet-2",
        "name": "Dr. Sunita Deshmukh (B.V.Sc & A.H.)",
        "qualification": "B.V.Sc & A.H. (Veterinary Medicine)",
        "specialization": "लाळ खुरकूत, लंपी त्वचा रोग व दुग्धज्वर उपचार",
        "clinicAddress": "Near Panchayat Samiti, Pimpalgaon Baswant",
        "distanceKm": 5.4,
        "phone": "+91 94222 33445",
        "experienceYears": 11,
        "consultationFeeRupees": 350,
        "rating": 4.8,
        "availableForFarmVisit": True,
        "nextAvailableSlot": "उद्या स. 09:00 ते दु. 01:00",
        "emergencyAvailable": False,
    },
    {
        "id": "vet-3",
        "name": "Dr. Rameshwar Patil (M.V.Sc Surgery)",
        "qualification": "M.V.Sc (Veterinary Surgery & Radiology)",
        "specialization": "हॉर्न कॅन्सर, पोटफुगी शस्त्रक्रिया व फ्रॅक्चर उपचार",
        "clinicAddress": "Opposite APMC Gate No. 2, Lasalgaon Road",
        "distanceKm": 9.1,
        "phone": "+91 97633 88990",
        "experienceYears": 20,
        "consultationFeeRupees": 600,
        "rating": 4.9,
        "availableForFarmVisit": True,
        "nextAvailableSlot": "आज दुपारी 02:00 ते 05:00",
        "emergencyAvailable": True,
    },
    {
        "id": "vet-4",
        "name": "Dr. Vikas Jadhav (B.V.Sc)",
        "qualification": "B.V.Sc (Animal Nutrition & Herd Health)",
        "specialization": "शेळीपालन, कुक्कुटपालन व चारा व्यवस्थापन सल्लागार",
        "clinicAddress": "Govt Veterinary Dispensary, Chandwad",
        "distanceKm": 16.0,
        "phone": "+91 98235 66778",
        "experienceYears": 8,
        "consultationFeeRupees": 200,
        "rating": 4.6,
        "availableForFarmVisit": False,
        "nextAvailableSlot": "सोमवारी सकाळी 10:00",
        "emergencyAvailable": False,
    },
]

DAIRY_PRODUCTS = [
    {
        "id": "dp-1",
        "title": "Gir Cow Vedic A2 Bilona Ghee (1 Litre Glass Jar)",
        "farmName": "Shrimant Panchvati Goshala",
        "category": "A2 Pure Ghee (तूप)",
        "price": 1850,
        "unit": "1 Litre Glass Jar",
        "rating": 4.9,
        "reviewsCount": 342,
        "purityCertification": "Lab Certified 100% Desi Gir Cow • Bilona Churned",
        "inStock": True,
        "description": "मातीच्या भांड्यात पारंपरिक दही घुसळून लाकडी रवीने तयार केलेले शुद्ध सात्विक A2 तूप.",
    },
    {
        "id": "dp-2",
        "title": "Natural Panchagavya Plant Growth Tonic (5 Litre Can)",
        "farmName": "Gir Nandan Kamdhenu Kendra",
        "category": "Organic Agri (पंचगव्य सेंद्रिय टॉनिक)",
        "price": 480,
        "unit": "5 Litre Can",
        "rating": 4.9,
        "reviewsCount": 189,
        "purityCertification": "Govt Bio-Stimulant Standard Compliant",
        "inStock": True,
        "description": "शेण, गोमूत्र, दूध, दही, तूप, गूळ व केळी यांचे नैसर्गिक मिश्रण. पिकांची रोगप्रतिकारशक्ती व फुलोरा वाढवण्यासाठी अत्यंत गुणकारी.",
    },
    {
        "id": "dp-3",
        "title": "Organic Cow Dung Logs for Fuel & Hawan (10 kg)",
        "farmName": "Kamdhenu Eco Products",
        "category": "Eco Fuel (गोमय इंधन)",
        "price": 240,
        "unit": "10 kg Bundle",
        "rating": 4.8,
        "reviewsCount": 145,
        "purityCertification": "100% Desi Cow Dung & Sawdust Free",
        "inStock": True,
        "description": "लाकडाला उत्तम पर्याय. शेतातील शेकोटी, पाणी तापवणे व होमहवनासाठी अत्यंत उपयुक्त.",
    },
    {
        "id": "dp-4",
        "title": "Fresh Malai Paneer (500g Vacuum Pack)",
        "farmName": "Sahyadri Dairy Collective",
        "category": "Paneer (पनीर)",
        "price": 210,
        "unit": "500g Pack",
        "rating": 4.8,
        "reviewsCount": 228,
        "purityCertification": "No Starch • 100% Whole Milk Purity",
        "inStock": True,
        "description": "अतिशय मऊ, प्रथिनयुक्त आणि कोणत्याही रसायनांशिवाय बनवलेले ताजे पनीर.",
    },
    {
        "id": "dp-5",
        "title": "Fresh White Butter (Makhan, 500g)",
        "farmName": "Panchavati Vedic Goshala",
        "category": "Butter (मक्खन)",
        "price": 450,
        "unit": "500g Pack",
        "rating": 4.8,
        "reviewsCount": 96,
        "purityCertification": "A2 Milk • No Added Colour or Preservatives",
        "inStock": True,
        "description": "देशी गायीच्या दह्यापासून बनवलेले ताजे पांढरे लोणी.",
    },
    {
        "id": "dp-6",
        "title": "A2 Set Curd (Dahi, 1kg Earthen Pot)",
        "farmName": "Gir Nandan Dairy Farm",
        "category": "Curd (दही)",
        "price": 120,
        "unit": "1kg Matka",
        "rating": 4.7,
        "reviewsCount": 180,
        "purityCertification": "A2 Milk • Earthen Pot Set • No Stabilizers",
        "inStock": False,
        "description": "मातीच्या मडक्यात दाखवलेले घट्ट दही.",
    },
]

# --- Extended Seed Data: Cattle, Milk Procurement, Gaushala Adoptions, Vet & Breeding ---

SAMPLE_ANIMALS = [
    {
        "id": "c-101",
        "tagId": "100987654321",
        "name": "कपिला (Kapila)",
        "species": "cow",
        "breed": "गीर (Gir)",
        "gender": "female",
        "ageMonths": 42,
        "lactationStatus": "lactating",
        "lactationCycle": 2,
        "dailyYieldLiters": 16.5,
        "sire": "Gir-Bhavnagar-04",
        "dam": "Gauri-10",
        "healthStatus": "healthy",
        "ownerType": "farmer",
        "ownerId": "dev-user-1",
        "ownerName": "रामसिंग (Ram Singh)",
        "photoUrl": "https://images.unsplash.com/photo-1546445317-29f4545e9d53?w=500",
        "createdAt": "2026-01-10T08:00:00Z",
    },
    {
        "id": "c-102",
        "tagId": "100987654322",
        "name": "गंगा (Ganga)",
        "species": "cow",
        "breed": "साहिवाल (Sahiwal)",
        "gender": "female",
        "ageMonths": 54,
        "lactationStatus": "pregnant",
        "lactationCycle": 3,
        "dailyYieldLiters": 14.0,
        "sire": "Sahiwal-Karnal-12",
        "dam": "Nandini-02",
        "healthStatus": "healthy",
        "ownerType": "farmer",
        "ownerId": "dev-user-1",
        "ownerName": "रामसिंग (Ram Singh)",
        "photoUrl": "https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?w=500",
        "createdAt": "2026-02-14T08:00:00Z",
    },
    {
        "id": "c-103",
        "tagId": "100987654323",
        "name": "भवानी (Bhavani)",
        "species": "buffalo",
        "breed": "मुर्राह (Murrah)",
        "gender": "female",
        "ageMonths": 38,
        "lactationStatus": "lactating",
        "lactationCycle": 1,
        "dailyYieldLiters": 18.0,
        "sire": "Murrah-Hisar-99",
        "dam": "Kaali-01",
        "healthStatus": "healthy",
        "ownerType": "farmer",
        "ownerId": "dev-user-1",
        "ownerName": "रामसिंग (Ram Singh)",
        "photoUrl": "https://images.unsplash.com/photo-1527153857715-3908f2ae5e81?w=500",
        "createdAt": "2026-03-01T08:00:00Z",
    },
    {
        "id": "c-104",
        "tagId": "100987654324",
        "name": "मंगला (Mangala)",
        "species": "cow",
        "breed": "खिल्लार (Khillar)",
        "gender": "female",
        "ageMonths": 68,
        "lactationStatus": "dry",
        "lactationCycle": 4,
        "dailyYieldLiters": 6.0,
        "sire": "Khillar-Satara-08",
        "dam": "Rani-04",
        "healthStatus": "healthy",
        "ownerType": "gaushala",
        "ownerId": "gau-1",
        "ownerName": "Shrimant Panchvati Desi Gaushala",
        "photoUrl": "https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=500",
        "createdAt": "2026-03-10T08:00:00Z",
    },
]

SAMPLE_MILK_COLLECTIONS = [
    {
        "id": "mc-101",
        "dairyId": "dairy-nashik-01",
        "dairyName": "श्री गणेश दुग्ध संकलन केंद्र (पिंपळगाव)",
        "farmerId": "dev-user-1",
        "farmerName": "रामसिंग पाटील",
        "farmerCode": "F-042",
        "farmerPhone": "+919999999999",
        "date": "2026-09-25",
        "shift": "morning",
        "milkType": "cow",
        "liters": 15.5,
        "fatPercent": 4.2,
        "snfPercent": 8.8,
        "clr": 28.5,
        "ratePerLiter": 38.5,
        "totalAmount": 596.75,
        "slipNumber": "SLIP-20260925-M-042",
        "status": "recorded",
        "recordedAt": "2026-09-25T06:45:00Z",
    },
    {
        "id": "mc-102",
        "dairyId": "dairy-nashik-01",
        "dairyName": "श्री गणेश दुग्ध संकलन केंद्र (पिंपळगाव)",
        "farmerId": "farmer-102",
        "farmerName": "तुकाराम जाधव",
        "farmerCode": "F-018",
        "farmerPhone": "+919822011223",
        "date": "2026-09-25",
        "shift": "morning",
        "milkType": "buffalo",
        "liters": 22.0,
        "fatPercent": 7.0,
        "snfPercent": 9.2,
        "clr": 30.0,
        "ratePerLiter": 58.0,
        "totalAmount": 1276.0,
        "slipNumber": "SLIP-20260925-M-018",
        "status": "recorded",
        "recordedAt": "2026-09-25T07:15:00Z",
    },
    {
        "id": "mc-103",
        "dairyId": "dairy-nashik-01",
        "dairyName": "श्री गणेश दुग्ध संकलन केंद्र (पिंपळगाव)",
        "farmerId": "dev-user-1",
        "farmerName": "रामसिंग पाटील",
        "farmerCode": "F-042",
        "farmerPhone": "+919999999999",
        "date": "2026-09-24",
        "shift": "evening",
        "milkType": "cow",
        "liters": 14.0,
        "fatPercent": 4.0,
        "snfPercent": 8.7,
        "clr": 28.0,
        "ratePerLiter": 37.2,
        "totalAmount": 520.8,
        "slipNumber": "SLIP-20260924-E-042",
        "status": "settled",
        "recordedAt": "2026-09-24T18:30:00Z",
    },
]

SAMPLE_BREEDING_CYCLES = [
    {
        "id": "br-101",
        "animalId": "c-102",
        "animalTagId": "100987654322",
        "animalName": "गंगा (Ganga)",
        "heatDate": "2026-05-10",
        "aiDate": "2026-05-11",
        "semenStrawId": "NDDB-SAHIWAL-A2-402",
        "bullBreed": "साहिवाल (Sahiwal A2)",
        "technicianName": "डॉ. आनंद कुलकर्णी",
        "species": "cow",
        "pregnancyCheckDueDate": "2026-07-11",
        "pregnancyStatus": "confirmed_pregnant",
        "expectedCalvingDate": "2027-02-15",
        "actualCalvingDate": "",
        "calfGender": "",
        "status": "pregnant",
        "notes": "गर्भावस्थेचा २ रा महिना पूर्ण. सोनोग्राफी व PD तपासणी सकारात्मक.",
        "createdAt": "2026-05-11T10:00:00Z",
    },
    {
        "id": "br-102",
        "animalId": "c-101",
        "animalTagId": "100987654321",
        "animalName": "कपिला (Kapila)",
        "heatDate": "2026-08-20",
        "aiDate": "2026-08-21",
        "semenStrawId": "SAG-GIR-PED-88",
        "bullBreed": "शुद्ध गीर (Gir Pedigree)",
        "technicianName": "डॉ. सुनीता देशमुख",
        "species": "cow",
        "pregnancyCheckDueDate": "2026-10-21",
        "pregnancyStatus": "pending",
        "expectedCalvingDate": "2027-05-28",
        "actualCalvingDate": "",
        "calfGender": "",
        "status": "inseminated",
        "notes": "कृत्रिम रेतन यशस्वी. ६० दिवसांनी गर्भतपासणी (PD) प्रस्तावित.",
        "createdAt": "2026-08-21T09:30:00Z",
    },
]

SAMPLE_VET_RECORDS = [
    {
        "id": "vr-101",
        "vetId": "vet-1",
        "vetName": "Dr. Anand Kulkarni (M.V.Sc)",
        "farmerId": "dev-user-1",
        "farmerName": "रामसिंग पाटील",
        "animalTagId": "100987654321",
        "animalName": "कपिला",
        "species": "cow",
        "visitDate": "2026-09-18",
        "visitType": "farm",
        "temperatureF": 102.4,
        "symptoms": ["कमी चारा खाणे", "उजव्या कासेवर सूज", "दूध पातळ येणे"],
        "diagnosis": "सुरुवातीचा कासदाह (Sub-acute Mastitis)",
        "clinicalNotes": "कासेचा दाह कमी करण्यासाठी अँटिबायोटिक व सूज प्रतिबंधक इंजेक्शन दिले. कास कोमट पाण्याने धुवून स्वच्छ ठेवावी.",
        "prescriptions": [
            {"medicine": "Intramammary Tube (Masticare)", "dosage": "1 tube twice daily", "durationDays": 3},
            {"medicine": "Inj. Meloxicam (Melonex)", "dosage": "15 ml IM", "durationDays": 2},
            {"medicine": "Vitamin H & E (Multistar)", "dosage": "10 ml daily", "durationDays": 10},
        ],
        "withdrawalPeriodDays": 3,
        "feeCharged": 650,
        "createdAt": "2026-09-18T11:00:00Z",
    },
]

SAMPLE_VACCINATIONS = [
    {
        "id": "vac-101",
        "animalTagId": "100987654321",
        "animalName": "कपिला",
        "disease": "FMD",
        "vaccineName": "Raksha-Ovac (FMD Bi-valent)",
        "batchNumber": "FMD-B8820",
        "administeredDate": "2026-03-15",
        "nextDueDate": "2026-09-15",
        "administeredBy": "पशुसंवर्धन विभाग, महाराष्ट्र शासन",
        "status": "completed",
        "createdAt": "2026-03-15T10:00:00Z",
    },
    {
        "id": "vac-102",
        "animalTagId": "100987654321",
        "animalName": "कपिला",
        "disease": "Lumpy_Skin",
        "vaccineName": "Lumpi-ProVacInd",
        "batchNumber": "LSD-2026-04",
        "administeredDate": "2026-06-10",
        "nextDueDate": "2027-06-10",
        "administeredBy": "डॉ. आनंद कुलकर्णी",
        "status": "completed",
        "createdAt": "2026-06-10T11:30:00Z",
    },
    {
        "id": "vac-103",
        "animalTagId": "100987654322",
        "animalName": "गंगा",
        "disease": "HS",
        "vaccineName": "Raksha-HS (घटसर्प लस)",
        "batchNumber": "HS-2026-M2",
        "administeredDate": "2026-05-20",
        "nextDueDate": "2027-05-20",
        "administeredBy": "डॉ. सुनीता देशमुख",
        "status": "completed",
        "createdAt": "2026-05-20T10:15:00Z",
    },
]

SAMPLE_COW_ADOPTIONS = [
    {
        "id": "adopt-101",
        "gaushalaId": "gau-1",
        "gaushalaName": "Shrimant Panchvati Desi Gaushala",
        "cowTagId": "100987654324",
        "cowName": "मंगला (Mangala)",
        "donorId": "donor-501",
        "donorName": "विनोद शहा",
        "donorPhone": "+919822001144",
        "donorCity": "पुणे (Pune)",
        "tier": "gau_gras",
        "amountInr": 1100,
        "billingCycle": "monthly",
        "startDate": "2026-01-01",
        "endDate": "2026-12-31",
        "status": "active",
        "certificateNumber": "GOSH-2026-ADOPT-0089",
        "createdAt": "2026-01-01T10:00:00Z",
    },
]

SAMPLE_FODDER_DONATIONS = [
    {
        "id": "don-101",
        "gaushalaId": "gau-1",
        "donorId": "donor-502",
        "donorName": "अशोकराव कदम",
        "donorPhone": "+919422119988",
        "donationType": "green_fodder",
        "quantityDescription": "२ ट्रॉली हिरवा मका चारा",
        "amountInr": 3500,
        "receiptNumber": "GOSH-RCP-2026-0412",
        "createdAt": "2026-09-20T14:30:00Z",
    },
]

SAMPLE_PANCHAGAVYA_PRODUCTS = [
    {
        "id": "pancha-1",
        "gaushalaId": "gau-1",
        "title": "Natural Gomutra Ark (Gomutra Distillate)",
        "vernacularTitle": "शुद्ध गोमूत्र अर्क (औषधी गुणवत्ता)",
        "category": "gomutra_ark",
        "price": 90,
        "unit": "500ml बाटली",
        "inStock": True,
        "stockQuantity": 85,
        "description": "तांब्याच्या पात्रात वाफवून शुद्ध केलेला देशी गीर गोमूत्र अर्क. पोटाचे विकार व प्रतिकारशक्तीसाठी उपयुक्त.",
        "imageUrl": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300",
        "createdAt": "2026-02-01T08:00:00Z",
    },
    {
        "id": "pancha-2",
        "gaushalaId": "gau-1",
        "title": "Desi Cow Vermicompost (Gobar Compost)",
        "vernacularTitle": "गांडूळ खत व घन जीवामृत (५० किलो)",
        "category": "compost",
        "price": 450,
        "unit": "50 kg Bag",
        "inStock": True,
        "stockQuantity": 200,
        "description": "देशी गाईंच्या शेणापासून तयार सेंद्रिय गांडूळ खत. जमिनीचा सेंद्रिय कर्ब (Carbon) वाढवण्यास सर्वोत्तम.",
        "imageUrl": "https://images.unsplash.com/photo-1585314062340-f1a5a7c9328d?w=300",
        "createdAt": "2026-02-15T08:00:00Z",
    },
    {
        "id": "pancha-3",
        "gaushalaId": "gau-1",
        "title": "Gobar Dhoop & Hawan Sticks",
        "vernacularTitle": "हर्बल गोमय धूपकांडी (१२ काड्या)",
        "category": "dhoop",
        "price": 120,
        "unit": "1 Box (12 Sticks)",
        "inStock": True,
        "stockQuantity": 150,
        "description": "शेण, भीमसेनी कापूर, गुग्गुळ व औषधी वनस्पतींपासून तयार नैसर्गिक अगरबत्ती.",
        "imageUrl": "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=300",
        "createdAt": "2026-03-01T08:00:00Z",
    },
]

# --- Dairy / Gaushala / Doctor management seeds (demo center) ---

SAMPLE_RATE_CHARTS = [
    {
        "id": "rc-demo-cow",
        "centerId": "center-demo",
        "species": "cow",
        "effectiveFrom": "2026-09-01",
        "baseRate": 35.0,
        "fatBase": 3.5,
        "snfBase": 8.5,
        "fatStep": 4.0,
        "snfStep": 2.5,
        "minRate": 28.0,
        "minFat": 3.0,
        "minSnf": 8.0,
        "active": True,
        "createdAt": "2026-09-01T08:00:00Z",
    },
    {
        "id": "rc-demo-buffalo",
        "centerId": "center-demo",
        "species": "buffalo",
        "effectiveFrom": "2026-09-01",
        "baseRate": 55.0,
        "fatBase": 6.0,
        "snfBase": 9.0,
        "fatStep": 5.0,
        "snfStep": 3.0,
        "minRate": 42.0,
        "minFat": 5.5,
        "minSnf": 8.5,
        "active": True,
        "createdAt": "2026-09-01T08:00:00Z",
    },
]

SAMPLE_DAIRY_MEMBERS = [
    {
        "id": "mem-demo-1",
        "centerId": "center-demo",
        "farmerUid": "dev-user-1",
        "name": "रामसिंग पाटील",
        "phone": "+919999999999",
        "village": "पिंपळगाव बसवंत",
        "memberCode": "F-042",
        "bankDetails": {"bankName": "SBI", "accountNo": "XXXXXX4521", "ifsc": "SBIN0021673"},
        "defaultSpecies": "cow",
        "deduction": 50.0,
        "status": "active",
        "createdAt": "2026-09-01T08:00:00Z",
    },
    {
        "id": "mem-demo-2",
        "centerId": "center-demo",
        "farmerUid": "",
        "name": "तुकाराम जाधव",
        "phone": "+919822011223",
        "village": "निफाड",
        "memberCode": "F-018",
        "bankDetails": {},
        "defaultSpecies": "buffalo",
        "deduction": 0.0,
        "status": "active",
        "createdAt": "2026-09-01T08:00:00Z",
    },
    {
        "id": "mem-demo-3",
        "centerId": "center-demo",
        "farmerUid": "",
        "name": "दिलीप शिंदे",
        "phone": "+919822456789",
        "village": "दिंडोरी",
        "memberCode": "F-099",
        "bankDetails": {},
        "defaultSpecies": "cow",
        "deduction": 25.0,
        "status": "active",
        "createdAt": "2026-09-01T08:00:00Z",
    },
]

SAMPLE_STOCK_ITEMS = [
    {
        "id": "stk-demo-1",
        "centerId": "center-demo",
        "name": "A2 दूध (Cow Milk)",
        "category": "milk",
        "unit": "liter",
        "stockQty": 250.0,
        "unitPrice": 62.0,
        "expiryDate": "",
        "createdAt": "2026-09-01T08:00:00Z",
    },
    {
        "id": "stk-demo-2",
        "centerId": "center-demo",
        "name": "बिलोना तूप (Bilona Ghee)",
        "category": "ghee",
        "unit": "500ml jar",
        "stockQty": 40.0,
        "unitPrice": 950.0,
        "expiryDate": "2027-03-31",
        "createdAt": "2026-09-01T08:00:00Z",
    },
]

SAMPLE_VACCINATION_CAMPAIGNS = [
    {
        "id": "cmp-demo-1",
        "title": "FMD मोहिम — नाशिक जिल्हा (Foot & Mouth Disease Drive)",
        "vaccine": "Raksha-Ovac FMD Bi-valent",
        "disease": "FMD",
        "fromDate": "2026-10-01",
        "toDate": "2026-10-31",
        "targetDistricts": ["Nashik"],
        "organizerId": "center-demo",
        "status": "upcoming",
        "createdAt": "2026-09-20T08:00:00Z",
    },
]

SAMPLE_VET_SCHEDULES = [
    {
        "vetId": "vet-1",
        "weeklySlots": [
            {"day": 0, "slots": [{"start": "09:00", "end": "13:00"}]},
            {"day": 2, "slots": [{"start": "09:00", "end": "13:00"}, {"start": "16:00", "end": "19:00"}]},
            {"day": 4, "slots": [{"start": "09:00", "end": "13:00"}]},
            {"day": 6, "slots": [{"start": "08:00", "end": "12:00"}]},
        ],
        "leaves": [],
        "emergencyAvailable": True,
        "teleAvailable": True,
        "updatedAt": "2026-09-01T08:00:00Z",
    },
]

SAMPLE_GAUSHALA_EXPENSES = [
    {
        "id": "exp-demo-1",
        "gaushalaId": "gau-1",
        "category": "fodder",
        "amount": 12500.0,
        "note": "मका चारा व सोयाबीन खळ खरेदी",
        "expenseDate": "2026-09-05",
        "createdBy": "center-demo",
        "createdAt": "2026-09-05T10:00:00Z",
    },
    {
        "id": "exp-demo-2",
        "gaushalaId": "gau-1",
        "category": "medical",
        "amount": 3400.0,
        "note": "वृद्ध गाईंसाठी औषधे व जंतुनाशक",
        "expenseDate": "2026-09-12",
        "createdBy": "center-demo",
        "createdAt": "2026-09-12T10:00:00Z",
    },
]


async def seed_livestock():
    if settings.env != "dev":
        return
    if not await query("gaushalas", [], limit=1):
        for item in GAUSHALAS:
            await set_doc("gaushalas", item["id"], item)
    if not await query("nurseries", [], limit=1):
        for item in NURSERIES:
            await set_doc("nurseries", item["id"], item)
    if not await query("vets", [], limit=1):
        for item in VETS:
            await set_doc("vets", item["id"], item)
    if not await query("dairy_products", [], limit=1):
        for item in DAIRY_PRODUCTS:
            await set_doc("dairy_products", item["id"], item)
    if not await query("livestock_animals", [], limit=1):
        for item in SAMPLE_ANIMALS:
            await set_doc("livestock_animals", item["id"], item)
    if not await query("milk_collections", [], limit=1):
        for item in SAMPLE_MILK_COLLECTIONS:
            await set_doc("milk_collections", item["id"], item)
    if not await query("breeding_cycles", [], limit=1):
        for item in SAMPLE_BREEDING_CYCLES:
            await set_doc("breeding_cycles", item["id"], item)
    if not await query("vet_records", [], limit=1):
        for item in SAMPLE_VET_RECORDS:
            await set_doc("vet_records", item["id"], item)
    if not await query("vaccination_schedules", [], limit=1):
        for item in SAMPLE_VACCINATIONS:
            await set_doc("vaccination_schedules", item["id"], item)
    if not await query("cow_adoptions", [], limit=1):
        for item in SAMPLE_COW_ADOPTIONS:
            await set_doc("cow_adoptions", item["id"], item)
    if not await query("fodder_donations", [], limit=1):
        for item in SAMPLE_FODDER_DONATIONS:
            await set_doc("fodder_donations", item["id"], item)
    if not await query("panchagavya_products", [], limit=1):
        for item in SAMPLE_PANCHAGAVYA_PRODUCTS:
            await set_doc("panchagavya_products", item["id"], item)
    if not await query("rate_charts", [], limit=1):
        for item in SAMPLE_RATE_CHARTS:
            await set_doc("rate_charts", item["id"], item)
    if not await query("dairy_members", [], limit=1):
        for item in SAMPLE_DAIRY_MEMBERS:
            await set_doc("dairy_members", item["id"], item)
    if not await query("dairy_stock_items", [], limit=1):
        for item in SAMPLE_STOCK_ITEMS:
            await set_doc("dairy_stock_items", item["id"], item)
    if not await query("vaccination_campaigns", [], limit=1):
        for item in SAMPLE_VACCINATION_CAMPAIGNS:
            await set_doc("vaccination_campaigns", item["id"], item)
    if not await query("vet_schedules", [], limit=1):
        for item in SAMPLE_VET_SCHEDULES:
            await set_doc("vet_schedules", item["vetId"], item)
    if not await query("gaushala_expenses", [], limit=1):
        for item in SAMPLE_GAUSHALA_EXPENSES:
            await set_doc("gaushala_expenses", item["id"], item)
