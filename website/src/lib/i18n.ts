// Lightweight, high-performance bilingual i18n dictionary (English and Hindi)
import { create } from 'zustand';

export type Language = 'en' | 'hi';

interface I18nStore {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Nav & Common
    'app.name': 'AGROVERCITY',
    'app.tagline': 'Kisan Setu • Digital Agri Ecosystem',
    'common.login': 'Log In',
    'common.logout': 'Sign Out',
    'common.register': 'Join Agrovercity',
    'common.search': 'Search commodities, mandis, equipment...',
    'common.notifications': 'Notifications',
    'common.coins': 'Kisan Coins',
    'common.switch_role': 'Switch Role',
    'common.view_all': 'View All',
    'common.submit': 'Submit',
    'common.cancel': 'Cancel',
    'common.save': 'Save Changes',
    'common.back': 'Back',
    'common.close': 'Close',
    'common.status': 'Status',
    'common.actions': 'Actions',
    'common.filter': 'Filter',
    'common.verified': 'Verified',
    'common.pending': 'Pending',

    // Personas
    'persona.farmer': 'Kisan / Farmer',
    'persona.landlord': 'Farm Landlord',
    'persona.transporter': 'Transporter / Gadi',
    'persona.seller': 'Agri Vyapari / Seller',
    'persona.equipmentOwner': 'Equipment Owner',
    'persona.broker': 'Agri Broker / Dalal',
    'persona.dairyManager': 'Dudh Dairy Manager',
    'persona.instructor': 'Gurukul Instructor',
    'persona.directBuyer': 'Direct B2B Buyer',
    'persona.customer': 'E-Market Customer',
    'persona.bankManager': 'Bank Loan Manager',
    'persona.insuranceProvider': 'Crop Insurance Desk',
    'persona.coldStorageProvider': 'Cold Storage Owner',
    'persona.gaushalaManager': 'Gaushala & VetNet',
    'persona.superadmin': 'Superadmin Console',

    // Farmer Hub
    'farmer.home': 'Farmer Cockpit',
    'farmer.mandi_rates': 'Mandi Live Rates',
    'farmer.produce_lots': 'Sell Crop Lots',
    'farmer.buyer_demands': 'Buyer Demands',
    'farmer.purchases': 'My Crop Sales & B2B Orders',
    'farmer.contracts': 'Buyer Supply Contracts',
    'farmer.transport': 'Book Gadi / Transport',
    'farmer.farm_diary': 'Farm Diary & P&L',
    'farmer.equipment': 'Rent Yantra / Machinery',
    'farmer.loans': 'KCC & Agri Loans',
    'farmer.insurance': 'PMFBY Crop Insurance',
    'farmer.land_records': '7/12 Land Records',
    'farmer.schemes': 'Govt Schemes & Vault',
    'farmer.water': 'Water & Weather Intelligence',

    // AI & Chat
    'ai.agronomist': 'AI Agronomist (Kisan Mitra)',
    'ai.disease_scan': 'Disease Leaf Scanner',
    'ai.chat_placeholder': 'Ask any crop, soil, pest, or mandi question in Hindi or English...',
  },
  hi: {
    // Nav & Common
    'app.name': 'एग्रोवर्सिटी',
    'app.tagline': 'किसान सेतु • सम्पूर्ण डिजिटल कृषि मंच',
    'common.login': 'लॉग इन',
    'common.logout': 'साइन आउट',
    'common.register': 'रजिस्टर करें',
    'common.search': 'फसल, मंडी, उपकरण खोजें...',
    'common.notifications': 'सूचनाएं',
    'common.coins': 'किसान सिक्के',
    'common.switch_role': 'भूमिका बदलें',
    'common.view_all': 'सभी देखें',
    'common.submit': 'जमा करें',
    'common.cancel': 'रद्द करें',
    'common.save': 'सुरक्षित करें',
    'common.back': 'वापस',
    'common.close': 'बंद करें',
    'common.status': 'स्थिति',
    'common.actions': 'कार्रवाई',
    'common.filter': 'फ़िल्टर',
    'common.verified': 'सत्यापित',
    'common.pending': 'प्रतीक्षारत',

    // Personas
    'persona.farmer': 'किसान भाई',
    'persona.landlord': 'जमीन मालिक',
    'persona.transporter': 'ट्रांसपोर्टर / गाड़ी',
    'persona.seller': 'कृषि व्यापारी / दुकानदार',
    'persona.equipmentOwner': 'यंत्र / ट्रैक्टर मालिक',
    'persona.broker': 'कृषि दलाल / ब्रोकर',
    'persona.dairyManager': 'दुग्ध डेयरी प्रबंधक',
    'persona.instructor': 'गुरुकुल शिक्षक',
    'persona.directBuyer': 'थोक खरीदार (B2B)',
    'persona.customer': 'ई-मार्केट ग्राहक',
    'persona.bankManager': 'बैंक प्रबंधक / लोन',
    'persona.insuranceProvider': 'फसल बीमा डेस्क',
    'persona.coldStorageProvider': 'कोल्ड स्टोरेज मालिक',
    'persona.gaushalaManager': 'गौशाला व पशु डॉक्टर',
    'persona.superadmin': 'सुपरएडमिन कंसोल',

    // Farmer Hub
    'farmer.home': 'किसान होम',
    'farmer.mandi_rates': 'लाइव मंडी भाव',
    'farmer.produce_lots': 'फसल लॉट बेचें',
    'farmer.buyer_demands': 'व्यापारी मांगें',
    'farmer.purchases': 'मेरी फसल बिक्री और ऑर्डर',
    'farmer.contracts': 'खरीदार अनुबंध (कॉन्ट्रैक्ट)',
    'farmer.transport': 'गाड़ी / लोडिंग बुक करें',
    'farmer.farm_diary': 'खाता-बही व नफा-नुकसान (P&L)',
    'farmer.equipment': 'यंत्र / रोटावेटर किराए पर लें',
    'farmer.loans': 'KCC और कृषि ऋण',
    'farmer.insurance': 'PMFBY फसल बीमा',
    'farmer.land_records': 'सात-बारह (7/12) उतारा',
    'farmer.schemes': 'सरकारी योजनाएं व लॉकर',
    'farmer.water': 'जल व मौसम सूचना',

    // AI & Chat
    'ai.agronomist': 'एआई कृषि मित्र',
    'ai.disease_scan': 'रोग पहचान स्कैनर',
    'ai.chat_placeholder': 'फसल, खाद, कीट या मंडी से जुड़ा कोई भी सवाल पूछें...',
  },
};

export const useI18nStore = create<I18nStore>((set, get) => ({
  language: 'en',
  setLanguage: (lang) => {
    localStorage.setItem('agrovercity_lang', lang);
    set({ language: lang });
  },
  t: (key: string) => {
    const lang = get().language;
    return translations[lang]?.[key] || translations['en']?.[key] || key;
  },
}));
