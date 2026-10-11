import { api } from './client';
import type { AppConfig, LanguagesResponse, RegionCropsResponse, StatesResponse } from './types';

/** Public reference endpoints — no auth required. */

export async function fetchAppConfig(version: string, platform: string): Promise<AppConfig | null> {
  try {
    const { data } = await api.get<AppConfig>('/app-config', { params: { version, platform } });
    return data;
  } catch {
    return null; // fail-open, same as mobile
  }
}

export async function fetchLanguages(): Promise<LanguagesResponse> {
  const { data } = await api.get<LanguagesResponse>('/languages');
  return data;
}

export async function fetchRegionCrops(district: string): Promise<RegionCropsResponse> {
  const { data } = await api.get<RegionCropsResponse>('/regions/crops', { params: { district } });
  return data;
}

/** M33 (phase-08 WS-01) — admin-curated crops for a district (active rows only). */
export interface DistrictCropsResponse {
  district: string;
  crops: string[];
  status: string;
}

export async function fetchDistrictCrops(district: string): Promise<DistrictCropsResponse> {
  const { data } = await api.get<DistrictCropsResponse>('/reference/district-crops', {
    params: { district },
  });
  return data;
}

export async function fetchStates(): Promise<StatesResponse> {
  const { data } = await api.get<StatesResponse>('/states');
  return data;
}

/**
 * M33 (phase-08 WS-01, task 1.39) — reverse geocode a GPS fix into a district
 * plus the languages suggested for that region. Public endpoint (no auth).
 */
export interface GeoReverseResponse {
  state: string;
  district: string;
  region: string;
  suggestedLanguages: string[];
}

export async function fetchGeoReverse(lat: number, lng: number): Promise<GeoReverseResponse> {
  const { data } = await api.get<GeoReverseResponse>('/geo/reverse', { params: { lat, lng } });
  return data;
}

/** One MSP reference row — price is integer paisa. (WS-01 task 1.26) */
export interface MspEntry {
  crop: string;
  msp_paisa: number;
  season?: string;
}

/**
 * GET /v1/reference/msp → MSP reference rows. Public endpoint; crops without a
 * notified MSP are simply absent (the UI renders an "unavailable" label).
 */
export async function fetchMsp(): Promise<MspEntry[]> {
  const { data } = await api.get<{ items: MspEntry[] }>('/reference/msp');
  return data.items;
}
