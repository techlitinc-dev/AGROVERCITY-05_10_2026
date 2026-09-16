import type { LanguageCode } from './common';

export interface GeoReverseRes {
  state: string;
  district: string;
  region: string;
  suggestedLanguages: LanguageCode[];
}

export interface RegionCropsRes {
  district: string;
  kharif: string[];
  rabi: string[];
  suggested: string[];
}

export interface LanguageInfo {
  code: LanguageCode;
  name: string;
  nativeName: string;
  region: string;
  audioText: string;
}

export interface LanguagesRes {
  languages: LanguageInfo[];
  regionalMapping: Record<string, LanguageCode[]>;
}
