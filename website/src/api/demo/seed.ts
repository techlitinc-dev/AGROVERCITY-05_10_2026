import type { DemoDb } from './db';

const NOW = '2026-09-14T06:30:00Z';
const TODAY = '2026-09-14';

export const DEMO_UID = 'u_demo1';
export const DEMO_PHONE = '+919876543210';
export const DEMO_MPIN = '1234';

export function buildSeed(): DemoDb {
  return {
    users: {
      [DEMO_UID]: {
        id: DEMO_UID,
        name: 'Ram Singh',
        vernacularName: 'राम सिंह',
        phone: DEMO_PHONE,
        village: 'Sinnar',
        tehsil: 'Sinnar',
        district: 'Nashik',
        state: 'Maharashtra',
        landAreaAcres: 5.5,
        soilType: 'blackCotton',
        irrigationType: 'drip',
        kisanCreditScore: 785,
        creditTier: 'A',
        krishiRatnaLevel: 4,
        krishiRatnaTitle: 'Krishi Daksh',
        streakDays: 12,
        agriCoins: 1250,
        bankName: 'HDFC Bank',
        kccLimit: 150000,
        activeCrops: ['tomato', 'onion', 'wheat'],
        farmBoundaryPoints: [
          { lat: 19.8451, lng: 74.4577 },
          { lat: 19.8461, lng: 74.4597 },
          { lat: 19.8441, lng: 74.4607 },
          { lat: 19.8431, lng: 74.4587 },
        ],
        linkedProfiles: ['farmer', 'farmLandlord', 'transport', 'seller', 'equipmentRental', 'broker'],
        activeProfile: 'farmer',
        primaryProfile: 'farmer',
        fpoId: 'fpo_sahyadri',
        mpin: DEMO_MPIN,
      },
    },
    userIdsByPhone: { [DEMO_PHONE]: DEMO_UID },
    otpSessions: {},
    refreshTokens: {},
    sessions: [
      { id: 'ses_1', deviceName: 'This browser', platform: 'web', lastSeenAt: NOW, current: true },
    ],
    settings: {
      [DEMO_UID]: { language: 'hi', womenMode: false, highContrast: false, darkMode: false },
    },
    consents: {
      [DEMO_UID]: {
        saturationShare: true,
        locationForAdvisory: true,
        marketingPush: false,
        voiceDataProcessing: true,
        updatedAt: NOW,
      },
    },
    mandiPrices: [
      { id: 'mp_1', mandiName: 'Nashik APMC', distanceKm: 18, commodity: 'onion', variety: 'लाल कांदा', minPrice: 1200, maxPrice: 1650, modalPrice: 1450, msp: null, trend: 'up', changePercent: 3.2, arrivalsQuintals: 850, updatedAt: NOW },
      { id: 'mp_2', mandiName: 'Pimpalgaon', distanceKm: 32, commodity: 'onion', variety: 'लाल कांदा', minPrice: 1250, maxPrice: 1700, modalPrice: 1500, msp: null, trend: 'up', changePercent: 4.1, arrivalsQuintals: 1200, updatedAt: NOW },
      { id: 'mp_3', mandiName: 'Lasalgaon', distanceKm: 45, commodity: 'onion', variety: 'लाल कांदा', minPrice: 1180, maxPrice: 1680, modalPrice: 1420, msp: null, trend: 'flat', changePercent: 0.4, arrivalsQuintals: 2100, updatedAt: NOW },
      { id: 'mp_4', mandiName: 'Nashik APMC', distanceKm: 18, commodity: 'tomato', variety: 'देशी टमाटर', minPrice: 1500, maxPrice: 2100, modalPrice: 1800, msp: null, trend: 'down', changePercent: -2.1, arrivalsQuintals: 640, updatedAt: NOW },
      { id: 'mp_5', mandiName: 'Pimpalgaon', distanceKm: 32, commodity: 'tomato', variety: 'देशी टमाटर', minPrice: 1600, maxPrice: 2250, modalPrice: 1900, msp: null, trend: 'up', changePercent: 1.8, arrivalsQuintals: 520, updatedAt: NOW },
      { id: 'mp_6', mandiName: 'Nashik APMC', distanceKm: 18, commodity: 'wheat', variety: 'लोकवान गेहूं', minPrice: 2300, maxPrice: 2500, modalPrice: 2400, msp: 2275, trend: 'up', changePercent: 0.9, arrivalsQuintals: 410, updatedAt: NOW },
    ],
    vyapariRates: [
      { id: 'vr_1', crop: 'onion', rateDisplay: '₹1,500/क्विंटल', priceChange: 60, changeDir: 'up', mandiName: 'Pimpalgaon', vyapariCount: 14, lastUpdated: NOW },
      { id: 'vr_2', crop: 'tomato', rateDisplay: '₹1,850/क्विंटल', priceChange: -40, changeDir: 'down', mandiName: 'Nashik APMC', vyapariCount: 9, lastUpdated: NOW },
      { id: 'vr_3', crop: 'wheat', rateDisplay: '₹2,400/क्विंटल', priceChange: 20, changeDir: 'up', mandiName: 'Nashik APMC', vyapariCount: 6, lastUpdated: NOW },
    ],
    products: [
      { id: 'prd_1', title: 'Tomato Seeds (Abhinav)', vernacularTitle: 'टमाटर बीज (अभिनव)', category: 'seeds', brand: 'Syngenta', rating: 4.4, reviewsCount: 212, dealerName: 'Shree Agro Kendra', distanceKm: 4.2, mrp: 950, discountedPrice: 780, bnplAvailable: true, batchNo: 'SYG-2026-T31' },
      { id: 'prd_2', title: 'Nano Urea 500ml', vernacularTitle: 'नैनो यूरिया 500ml', category: 'fertilizer', brand: 'IFFCO', rating: 4.1, reviewsCount: 540, dealerName: 'IFFCO Bazar Sinnar', distanceKm: 6.8, mrp: 240, discountedPrice: 225, bnplAvailable: false, batchNo: 'IFC-NU-778' },
      { id: 'prd_3', title: 'Mancozeb 75% WP 1kg', vernacularTitle: 'मॅन्कोझेब 75% 1kg', category: 'pesticide', brand: 'Tata Rallis', rating: 4.6, reviewsCount: 388, dealerName: 'Kisan Seva Kendra', distanceKm: 3.1, mrp: 620, discountedPrice: 540, bnplAvailable: true, batchNo: 'TRL-MZ-221' },
    ],
    cart: [],
    orders: [],
    contracts: [
      { id: 'con_1', buyerCompany: 'Shakti Flour Mill', buyerRating: 4.3, crop: 'wheat', lockedRateQuintal: 2450, mspCurrentRate: 2275, premiumAboveMSP: 175, minQuantityQuintals: 50, deliveryLocation: 'Nashik MIDC', paymentTerms: '7 days after delivery', status: 'open', contractDuration: 'Rabi 2026-27' },
    ],
    vehicles: [
      { id: 'veh_9f2c', ownerId: DEMO_UID, type: 'tataAce', registrationNo: 'MH15AB1234', capacityTonnes: 1.5, baseFare: 500, perKmRate: 28, verificationStatus: 'verified', isActive: true, docStatus: 'ok', createdAt: NOW },
    ],
    transportBookings: [],
    equipmentList: [
      { id: 'eq_1', name: 'Mahindra 575 Tractor', vernacularName: 'महिंद्रा ट्रॅक्टर', type: 'tractor', ownerType: 'fpo', hourlyRate: 650, distanceKm: 5.2, isActive: true },
      { id: 'eq_2', name: 'Drone Sprayer', vernacularName: 'ड्रोन स्प्रेयर', type: 'drone', ownerType: 'private', hourlyRate: 0, perAcreRate: 350, distanceKm: 8.4, isActive: true },
    ],
    slots: [],
    slotBookings: [],
    diaryEntries: [
      { id: 'di_1', title: 'यूरिया खरेदी', category: 'fertilizer', type: 'expense', amount: 2250, date: '2026-09-10', cropName: 'tomato', notes: 'IFFCO Bazar' },
      { id: 'di_2', title: 'टमाटर विक्री', category: 'mandiSale', type: 'income', amount: 27000, date: '2026-09-08', cropName: 'tomato', notes: 'Nashik APMC 15q @ 1800' },
    ],
    schemes: [
      { id: 'pm-kisan', name: 'PM-KISAN', vernacularName: 'पीएम-किसान', category: 'income', eligible: true, benefitAmount: 6000, documentsRequired: ['aadhaar', 'landRecord712', 'bankPassbook'], status: 'open', nextDeadline: '2026-10-31', description: 'प्रति वर्ष ₹6,000 तीन हप्त्यांत' },
      { id: 'pmfby', name: 'PM Fasal Bima Yojana', vernacularName: 'पीएम फसल बीमा', category: 'insurance', eligible: true, benefitAmount: 0, documentsRequired: ['aadhaar', 'landRecord712'], status: 'closingSoon', nextDeadline: '2026-09-30', description: 'पीक विमा — खरीप 2026' },
      { id: 'pm-kusum', name: 'PM-KUSUM', vernacularName: 'पीएम-कुसुम', category: 'solar', eligible: true, benefitAmount: 0, documentsRequired: ['aadhaar', 'bankPassbook'], status: 'open', nextDeadline: '2026-12-15', description: 'सोलर पंप अनुदान' },
      { id: 'shc', name: 'Soil Health Card', vernacularName: 'मृदा आरोग्य कार्ड', category: 'soil', eligible: true, benefitAmount: 0, documentsRequired: ['aadhaar'], status: 'open', nextDeadline: '2026-11-30', description: 'मोफत माती चाचणी' },
    ],
    vaultDocs: [],
    policies: [
      { id: 'pol_1', policyNumber: 'PMFBY-MH-2026-881234', schemeName: 'PMFBY', vernacularSchemeName: 'पीएम फसल बीमा', cropName: 'tomato', vernacularCropName: 'टमाटर', season: 'kharif', year: 2026, landAreaAcres: 2.0, sumInsured: 140000, farmerPremium: 2800, govtSubsidy: 11200, status: 'active', insuranceCompany: 'HDFC Ergo', coverageStartDate: '2026-06-15', coverageEndDate: '2026-12-31', bankName: 'HDFC Bank', kccAccountNo: '****7890', certificateUrl: 'https://demo.local/cert/pol_1.pdf' },
    ],
    claims: [
      { id: 'claim_12', claimNumber: 'CLM-2026-MH-0042', policyId: 'pol_1', cropName: 'tomato', vernacularCropName: 'टमाटर', calamityType: 'heavyRain', dateOfDamage: '2026-08-28', estimatedLossPercent: 40, requestedAmount: 56000, approvedAmount: null, status: 'surveyorAssigned', statusText: 'सर्वेक्षक नियुक्त', surveyorName: 'A. Deshmukh', surveyorPhone: '+919811122233', surveyorVisitDate: '2026-09-16', gpsCoordinates: '19.8451,74.4577', village: 'Sinnar', damagePhotos: [], submittedAt: '2026-08-29T05:00:00Z', dbtTransactionId: null, bankAccountLast4: '7890', timeline: [ { status: 'intimated', at: '2026-08-29T05:00:00Z' }, { status: 'surveyorAssigned', at: '2026-09-02T09:00:00Z' } ], appealOf: null, round: 1 },
    ],
    landRecords: [],
    fpoPools: [
      { id: 'pool_1', item: 'Nano Urea (500ml box)', bookedUnits: 380, targetUnits: 500, discountPercent: 18, deadline: '2026-09-20' },
    ],
    notifications: [
      { id: 'ntf_1', type: 'claim_update', title: 'बीमा दावा अपडेट', body: 'CLM-2026-MH-0042 — सर्वेक्षक नियुक्त झाला', refId: 'claim_12', route: 'cropInsurance', read: false, at: NOW },
      { id: 'ntf_2', type: 'coins_awarded', title: '+50 AgriCoins', body: 'आजचे तातडीचे काम पूर्ण केल्याबद्दल', route: 'krishiRatna', read: true, at: '2026-09-13T10:00:00Z' },
    ],
    addresses: [
      { id: 'addr_1', userId: DEMO_UID, label: 'farm', line: 'Plot 12, near Hanuman temple', village: 'Sinnar', district: 'Nashik', pincode: '422103', phone: DEMO_PHONE, isDefault: true, createdAt: NOW },
    ],
    bankAccounts: [
      { id: 'ba_4', bankName: 'HDFC Bank', accountLast4: '7890', ifsc: 'HDFC0001234', accountHolderName: 'Ram Singh', accountType: 'savings', verificationStatus: 'verified', verificationMethod: 'pennyDrop', isPrimary: true, createdAt: NOW },
    ],
    chats: [],
    chatMessages: {},
    supportThreads: [],
    supportMessages: {},
    sellerRates: [],
    inventory: [],
    sales: [],
    procurements: [],
    ledgerEntries: {},
    deals: [],
    leads: [],
    commissions: [],
    landPlots: [],
    leases: [],
    rentPayments: [],
    listings: [],
    leaseRequests: [],
    lots: [],
    requirements: [],
    farmPlots: [
      { id: 'fplot_1', farmerId: DEMO_UID, name: 'Plot A', areaAcres: 2.0, soilType: 'blackCotton', irrigationType: 'drip', khasraNumber: '45/1', boundaryPoints: [], isPrimary: true, currentCrop: 'tomato', createdAt: NOW },
    ],
    cropCycles: [
      { id: 'cycle_8', plotId: 'fplot_1', farmerId: DEMO_UID, crop: 'tomato', season: 'kharif', sowingDate: '2026-06-15', expectedHarvestDate: '2026-10-15', expectedYieldQuintals: 180, actualYieldQuintals: null, stage: 'flowering', status: 'active', createdAt: NOW },
    ],
    tasks: [
      { id: 'task_a1', title: 'टमाटरवर मँकोझेब फवारणी', whyNow: 'फुलधारणा अवस्था, दिवस 42 — सकाळी 6–9', source: 'cropStage', cropCycleId: 'cycle_8', status: 'pending', snoozedUntil: null, date: TODAY },
    ],
    soilTests: [],
    aggregatedBookings: [
      { type: 'equipment', refId: 'eqb_12', title: 'ट्रॅक्टर — सकाळ स्लॉट', scheduledAt: '2026-09-15T06:00:00Z', status: 'confirmed', amountRupees: 800, cancellable: true },
      { type: 'transport', refId: 'tbk_7', title: 'Sinnar → Nashik APMC', scheduledAt: '2026-09-16T05:30:00Z', status: 'requested', amountRupees: 1500, cancellable: false },
    ],
    rewards: [
      { id: 'rw_1', title: 'IFFCO ₹200 व्हाउचर', coinCost: 300, type: 'voucher' },
      { id: 'rw_2', title: 'मोफत माती चाचणी', coinCost: 500, type: 'service' },
      { id: 'rw_3', title: 'शास्त्रज्ञांशी 1-on-1 व्हिडिओ कॉल', coinCost: 800, type: 'service' },
    ],
    coinLedger: [
      { id: 'cl_1', delta: 50, reason: 'urgentTask', balanceAfter: 1250, at: NOW },
    ],
    referrals: [],
    coldStorages: [
      { id: 'wh_12', name: 'Sahyadri Cold Storage', distanceKm: 12, tempRange: '2–8°C', availableMT: 40, ratePerQuintalMonth: 65 },
    ],
    news: [
      { id: 'news_9', title: 'Onion export duty relaxed', vernacularTitle: 'कांदा निर्यात शुल्क शिथिल', category: 'marketPolicy', source: 'PIB', timestamp: NOW, summary: 'कांदा निर्यातीवरील शुल्क कमी करण्यात आले', content: '...', isBreaking: true, audioText: 'कांदा निर्यात शुल्क शिथिल झाले आहे', impactRating: 4 },
    ],
    channels: [
      { id: 'ch_1', channelName: 'DD Kisan', vernacularName: 'डीडी किसान', broadcaster: 'Prasar Bharati', programTitle: 'Mandi Samachar', vernacularProgram: 'मंडी समाचार', currentSpeaker: 'कृषी तज्ज्ञ', liveViewersCount: 1240, isLiveNow: true, category: 'tv', streamThumbnail: '', streamUrl: 'https://demo.local/hls/ddkisan.m3u8', scheduleTime: '18:00' },
    ],
    workshops: [],
    expertTalks: [],
    videos: [],
    blogs: [],
  };
}
