/** Shared API types — contracts verified against backend/app (FastAPI). */

export interface ApiErrorBody {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
  deepLink?: string;
}

/** Backend user doc (merged over defaults). Kept permissive on purpose. */
export interface AuthUser {
  id?: string;
  uid?: string;
  name?: string;
  phone?: string;
  language?: string;
  preferredLanguage?: string;
  linkedProfiles?: string[];
  primaryProfile?: string;
  activeProfile?: string;
  village?: string;
  tehsil?: string;
  district?: string;
  state?: string;
  landAreaAcres?: number;
  soilType?: string;
  irrigationType?: string;
  activeCrops?: string[];
  farmBoundaryPoints?: Array<{ lat: number; lng: number }>;
  isOnboarded?: boolean;
  [key: string]: unknown;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  isNewUser: boolean;
  user: AuthUser;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
}

export interface LanguageInfo {
  code: string;
  name: string;
  englishName?: string;
  regions?: string[];
  audioText?: string;
}

export interface LanguagesResponse {
  languages: LanguageInfo[];
  regionalMapping?: Record<string, unknown>;
}

export interface AppConfig {
  minSupportedVersion?: string;
  forceUpdate?: boolean;
  maintenanceMode?: boolean;
  featureFlags?: Record<string, unknown>;
}

export interface RegionCropsResponse {
  district: string;
  kharif: string[];
  rabi: string[];
  suggested: string[];
}

export interface StatesResponse {
  states: string[];
}

export interface FarmBoundaryPoint {
  lat: number;
  lng: number;
}

export interface RegisterPayload {
  idToken: string;
  name: string;
  phone: string;
  state: string;
  district: string;
  tehsil: string;
  village: string;
  landAreaAcres: number;
  soilType: string;
  irrigationType: string;
  crops: string[];
  mpin: string;
  profiles: string[];
  primaryProfile: string;
  referralCode?: string;
  roleProfiles?: Record<string, Record<string, unknown>>;
  language: string;
  preferredLanguage: string;
  email?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  pincode?: string;
  addressLine?: string;
  alternatePhone?: string;
}

export interface Consents {
  dataSharing: boolean;
  location: boolean;
  marketing: boolean;
  updatedAt?: string;
}

export interface PersonaSetupPayload {
  profiles: string[];
  primaryProfile: string;
  roleProfiles?: Record<string, Record<string, unknown>>;
  village?: string;
  tehsil?: string;
  district?: string;
  landAreaAcres?: number;
  soilType?: string;
  irrigationType?: string;
  crops?: string[];
}
