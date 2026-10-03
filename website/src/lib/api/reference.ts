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

export async function fetchStates(): Promise<StatesResponse> {
  const { data } = await api.get<StatesResponse>('/states');
  return data;
}
