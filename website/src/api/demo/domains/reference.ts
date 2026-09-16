import { register } from '../registry';
import type { GeoReverseRes, LanguagesRes, RegionCropsRes } from '@/api/types';

// features.md §2.3 district crop mapping (8 districts)
const DISTRICT_CROPS: Record<string, { kharif: string[]; rabi: string[]; suggested: string[] }> = {
  nashik: { kharif: ['onion', 'tomato', 'soybean'], rabi: ['wheat', 'grape', 'onion'], suggested: ['tomato', 'onion', 'grape', 'wheat'] },
  nagpur: { kharif: ['cotton', 'soybean', 'orange'], rabi: ['wheat', 'chana', 'orange'], suggested: ['orange', 'cotton', 'soybean'] },
  ludhiana: { kharif: ['rice', 'maize', 'cotton'], rabi: ['wheat', 'potato', 'mustard'], suggested: ['wheat', 'rice', 'potato'] },
  pune: { kharif: ['onion', 'tomato', 'sugarcane'], rabi: ['wheat', 'onion', 'jowar'], suggested: ['onion', 'sugarcane', 'tomato'] },
  indore: { kharif: ['soybean', 'maize', 'cotton'], rabi: ['wheat', 'chana', 'potato'], suggested: ['soybean', 'wheat', 'chana'] },
  surat: { kharif: ['banana', 'cotton', 'paddy'], rabi: ['sugarcane', 'wheat', 'vegetables'], suggested: ['banana', 'cotton', 'sugarcane'] },
  jaipur: { kharif: ['bajra', 'moong', 'groundnut'], rabi: ['mustard', 'wheat', 'chana'], suggested: ['bajra', 'mustard', 'wheat'] },
  lucknow: { kharif: ['paddy', 'maize', 'mentha'], rabi: ['wheat', 'potato', 'mustard'], suggested: ['potato', 'wheat', 'mentha'] },
};

register('GET', '/geo/reverse', () => {
  const body: GeoReverseRes = {
    state: 'Maharashtra',
    district: 'Nashik',
    region: 'West',
    suggestedLanguages: ['mr', 'hi'],
  };
  return { status: 200, body };
});

register('GET', '/regions/crops', ({ query }) => {
  const district = (query.district ?? 'Nashik').toLowerCase();
  const found = DISTRICT_CROPS[district] ?? DISTRICT_CROPS.nashik;
  const body: RegionCropsRes = {
    district: query.district ?? 'Nashik',
    kharif: found.kharif,
    rabi: found.rabi,
    suggested: found.suggested,
  };
  return { status: 200, body };
});

register('GET', '/languages', () => {
  const body: LanguagesRes = {
    languages: [
      { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', region: 'North', audioText: 'नमस्ते, किसान सेतु में आपका स्वागत है' },
      { code: 'mr', name: 'Marathi', nativeName: 'मराठी', region: 'West', audioText: 'नमस्कार, किसान सेतु मध्ये आपले स्वागत आहे' },
      { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', region: 'West', audioText: 'નમસ્તે, કિસાન સેતુ માં આપનું સ્વાગત છે' },
      { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', region: 'North', audioText: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ, ਕਿਸਾਨ ਸੇਤੂ ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ' },
      { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', region: 'South', audioText: 'నమస్తే, కిసాన్ సేతుకు స్వాగతం' },
      { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', region: 'South', audioText: 'வணக்கம், கிசான் சேதுவிற்கு வருக' },
      { code: 'en', name: 'English', nativeName: 'English', region: 'All', audioText: 'Namaste, welcome to Kisan Setu' },
    ],
    regionalMapping: {
      North: ['pa', 'hi'],
      Central: ['hi'],
      West: ['mr', 'gu'],
      East: ['hi'],
      NorthEast: ['hi'],
      South: ['ta', 'te'],
    },
  };
  return { status: 200, body };
});
