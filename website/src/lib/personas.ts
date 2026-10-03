import { t } from './i18n';

/**
 * Persona registry — mirrors the mobile UserProfileRegistry
 * (apps/mobile/lib/models/user_profile_type.dart) and the backend role profile
 * models (backend/app/models/role_profiles.py).
 *
 * hasRoleProfile=false personas only get linked (no extra fields in register).
 * farmer has no role profile either — farm data lives on the user doc itself.
 */
export interface Persona {
  type: string;
  en: string;
  native: string;
  tagline: string;
  icon: string;
  color: string;
  dark: string;
  hasRoleProfile: boolean;
}

export const PERSONAS: Persona[] = [
  { type: 'farmer', en: 'Farmer', native: 'किसान', tagline: 'I grow & sell produce', icon: '🌾', color: '#43A047', dark: '#2E7D32', hasRoleProfile: false },
  { type: 'farmLandlord', en: 'Farm Landlord', native: 'भूमिधारक', tagline: 'I lease out farmland', icon: '🏞️', color: '#8B5CF6', dark: '#7C3AED', hasRoleProfile: true },
  { type: 'transport', en: 'Transporter', native: 'वाहन मालक', tagline: 'I move produce', icon: '🚚', color: '#0284C7', dark: '#0369A1', hasRoleProfile: true },
  { type: 'seller', en: 'Seller / Vyapari', native: 'व्यापारी', tagline: 'I trade & buy produce', icon: '🏪', color: '#EA580C', dark: '#C2410C', hasRoleProfile: true },
  { type: 'equipmentRental', en: 'Equipment Owner', native: 'उपकरण मालक', tagline: 'I rent farm machinery', icon: '🚜', color: '#F59E0B', dark: '#D97706', hasRoleProfile: true },
  { type: 'broker', en: 'Broker / Dalal', native: 'दलाल', tagline: 'I connect buyers & sellers', icon: '🤝', color: '#14B8A6', dark: '#0D9488', hasRoleProfile: true },
  { type: 'instructor', en: 'Instructor', native: 'प्रशिक्षक', tagline: 'I teach farming', icon: '🎓', color: '#7C3AED', dark: '#6D28D9', hasRoleProfile: true },
  { type: 'dairyManager', en: 'Dairy & Gaushala', native: 'डेयरी', tagline: 'I run a dairy center', icon: '🐄', color: '#0D9488', dark: '#0F766E', hasRoleProfile: true },
  { type: 'customer', en: 'E-Market Customer', native: 'ग्राहक', tagline: 'I buy farm produce', icon: '🛍️', color: '#DB2777', dark: '#BE185D', hasRoleProfile: true },
  { type: 'directBuyer', en: 'Direct Buyer', native: 'सीधा खरीदार', tagline: 'I buy directly from farms', icon: '🏭', color: '#4F46E5', dark: '#4338CA', hasRoleProfile: true },
  { type: 'bankManager', en: 'Bank Manager', native: 'बैंक प्रबंधक', tagline: 'I manage agri credit', icon: '🏦', color: '#334155', dark: '#1E293B', hasRoleProfile: true },
  { type: 'insuranceProvider', en: 'Insurance Provider', native: 'बीमा प्रदाता', tagline: 'I provide crop insurance', icon: '🛡️', color: '#0F766E', dark: '#115E59', hasRoleProfile: false },
  { type: 'coldStorageProvider', en: 'Cold Storage', native: 'शीतगृह', tagline: 'I store produce', icon: '🧊', color: '#0284C7', dark: '#0369A1', hasRoleProfile: false },
];

export const VALID_PROFILE_TYPES = PERSONAS.map((p) => p.type);

export function personaByType(type: string): Persona | undefined {
  return PERSONAS.find((p) => p.type === type);
}

/** Localized persona name for the active language (falls back to English). */
export function personaLabel(type: string): string {
  const persona = personaByType(type);
  if (!persona) return type;
  const label = t(`persona_${type}`);
  return label === `persona_${type}` ? persona.en : label;
}
