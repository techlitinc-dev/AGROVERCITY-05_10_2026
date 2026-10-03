/**
 * Full language catalogue (24 languages) — the single source of truth for the
 * onboarding language-select step and the header switcher.
 *
 * Mirrors backend/app/data/languages.py so the onboarding page renders every
 * language immediately, even before the backend list loads (the API response
 * is merged on top for audio previews / future additions).
 */
export interface LanguageCatalogueEntry {
  code: string;
  /** Native-script name shown to users. */
  name: string;
  englishName: string;
  /** Primary region first — the picker groups by the first entry. */
  regions: string[];
  audioText: string;
}

export const LANGUAGE_CATALOGUE: LanguageCatalogueEntry[] = [
  { code: 'en', name: 'English', englishName: 'English', regions: ['North', 'Central', 'West', 'East', 'NorthEast', 'South'], audioText: 'Namaste, welcome to AGROVERCITY' },
  { code: 'hi', name: 'हिन्दी', englishName: 'Hindi', regions: ['North', 'Central', 'West'], audioText: 'नमस्ते, AGROVERCITY में आपका स्वागत है' },
  { code: 'mr', name: 'मराठी', englishName: 'Marathi', regions: ['West'], audioText: 'नमस्कार, AGROVERCITY मध्ये आपले स्वागत आहे' },
  { code: 'gu', name: 'ગુજરાતી', englishName: 'Gujarati', regions: ['West'], audioText: 'નમસ્તે, AGROVERCITY માં આપનું સ્વાગત છે' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ', englishName: 'Punjabi', regions: ['North'], audioText: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ, AGROVERCITY ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ' },
  { code: 'te', name: 'తెలుగు', englishName: 'Telugu', regions: ['South'], audioText: 'నమస్తే, AGROVERCITY కు స్వాగతం' },
  { code: 'ta', name: 'தமிழ்', englishName: 'Tamil', regions: ['South'], audioText: 'வணக்கம், AGROVERCITY இற்கு வரவேற்கிறோம்' },
  { code: 'bn', name: 'বাংলা', englishName: 'Bengali', regions: ['East'], audioText: 'নমস্কার, AGROVERCITY তে আপনাকে স্বাগতম' },
  { code: 'ur', name: 'اردو', englishName: 'Urdu', regions: ['North', 'East'], audioText: 'نمستے، AGROVERCITY میں خوش آمدید' },
  { code: 'kn', name: 'ಕನ್ನಡ', englishName: 'Kannada', regions: ['South'], audioText: 'ನಮಸ್ಕಾರ, AGROVERCITY ಗೆ ಸ್ವಾಗತ' },
  { code: 'ml', name: 'മലയാളം', englishName: 'Malayalam', regions: ['South'], audioText: 'നമസ്കാരം, AGROVERCITY യിലേക്ക് സ്വാഗതം' },
  { code: 'or', name: 'ଓଡ଼ିଆ', englishName: 'Odia', regions: ['East'], audioText: 'ନମସ୍କାର, AGROVERCITY କୁ ସ୍ୱାଗତ' },
  { code: 'as', name: 'অসমীয়া', englishName: 'Assamese', regions: ['NorthEast'], audioText: 'নমস্কাৰ, AGROVERCITY লৈ স্বাগতম' },
  { code: 'ne', name: 'नेपाली', englishName: 'Nepali', regions: ['North', 'NorthEast'], audioText: 'नमस्ते, AGROVERCITY मा स्वागत छ' },
  { code: 'bho', name: 'भोजपुरी', englishName: 'Bhojpuri', regions: ['East', 'Central'], audioText: 'प्रणाम, AGROVERCITY में स्वागत बा' },
  { code: 'mai', name: 'मैथिली', englishName: 'Maithili', regions: ['East'], audioText: 'नमस्कार, AGROVERCITY मे स्वागत' },
  { code: 'doi', name: 'डोगरी', englishName: 'Dogri', regions: ['North'], audioText: 'नमस्कार, AGROVERCITY च स्वागत' },
  { code: 'ks', name: 'कश्मीरी', englishName: 'Kashmiri', regions: ['North'], audioText: 'नमस्कार, AGROVERCITY मंज़ स्वागत' },
  { code: 'kok', name: 'कोंकणी', englishName: 'Konkani', regions: ['West'], audioText: 'नमस्कार, AGROVERCITY त स्वागत' },
  { code: 'brx', name: 'बड़ो', englishName: 'Bodo', regions: ['NorthEast'], audioText: 'नमस्कार, AGROVERCITY याव स्वागत' },
  { code: 'sat', name: 'संताली', englishName: 'Santali', regions: ['East'], audioText: 'नमस्कार, AGROVERCITY रे स्वागत' },
  { code: 'sd', name: 'सिन्धी', englishName: 'Sindhi', regions: ['West', 'North'], audioText: 'नमस्कार, AGROVERCITY में स्वागत' },
  { code: 'sa', name: 'संस्कृतम्', englishName: 'Sanskrit', regions: ['Central'], audioText: 'नमस्ते, AGROVERCITY प्रति स्वागतम्' },
  { code: 'mni', name: 'মৈতৈলোন্', englishName: 'Manipuri', regions: ['NorthEast'], audioText: 'নমস্কার, AGROVERCITY দা স্বাগতম' },
];

export function languageByCode(code: string): LanguageCatalogueEntry | undefined {
  return LANGUAGE_CATALOGUE.find((l) => l.code === code);
}
