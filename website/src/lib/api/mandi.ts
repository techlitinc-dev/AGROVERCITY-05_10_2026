import { api } from './client';
import type { Paged } from './trade';

/**
 * Mandi reference data — price transparency cards (spec F7/V3).
 * Verified against backend/app/routers/mandi.py (roles farmer|seller|broker).
 */

export interface MandiPrice {
  id?: string;
  mandiName: string;
  distanceKm?: number;
  commodity: string;
  variety?: string;
  minPrice?: number;
  maxPrice?: number;
  modalPrice?: number;
  msp?: number;
  trend?: string;
  arrivals?: string;
  [key: string]: unknown;
}

export interface MandiInfo {
  id: string;
  name: string;
  district: string;
  state: string;
}

export interface VyapariRate {
  id?: string;
  crop: string;
  ratePerKg: number;
  mandiName: string;
  [key: string]: unknown;
}

export interface MandiCompareItem {
  mandiName: string;
  modalPrice: number;
  transportCost: number;
  netProfit: number;
}

export interface PricePoint {
  date: string;
  modalPrice: number;
}

export async function mandiPrices(params?: {
  page?: number;
  pageSize?: number;
}): Promise<Paged<MandiPrice>> {
  const { data } = await api.get<Paged<MandiPrice>>('/mandi/prices', { params });
  return data;
}

export async function mandiList(): Promise<{ data: MandiInfo[] }> {
  const { data } = await api.get<{ data: MandiInfo[] }>('/mandi/list');
  return data;
}

export async function vyapariRates(crops?: string[]): Promise<{ data: VyapariRate[] }> {
  const { data } = await api.get<{ data: VyapariRate[] }>('/mandi/vyapari-rates', {
    params: crops?.length ? { crops: crops.join(',') } : {},
  });
  return data;
}

export async function mandiCompare(
  crop: string,
  quantityQuintals: number
): Promise<{ data: MandiCompareItem[] }> {
  const { data } = await api.get<{ data: MandiCompareItem[] }>('/mandi/compare', {
    params: { crop, quantityQuintals },
  });
  return data;
}

export async function mandiPriceHistory(params: {
  crop: string;
  mandi?: string;
  months?: number;
}): Promise<{ data: PricePoint[] }> {
  const { data } = await api.get<{ data: PricePoint[] }>('/mandi/prices/history', { params });
  return data;
}

/**
 * Smart mandi selection (brief M12, SDR) — POST /v1/mandi/smart-select.
 *
 * Backend quirks (verified against backend/app/routers/mandi.py):
 * - All money is integer paisa (`…Paisa` fields); quantities are whole quintals.
 * - The endpoint is a compute call that launches at `suggest`: the AI only
 *   supplies the ordering + `explainKey`, the net-after-transport money is always
 *   plain integer arithmetic. `source` is `fallback` whenever the AI answer is
 *   missing/invalid or the feature flag is off.
 * - 422 (`NO_MANDI_DATA`) when the crop has no mandi price rows.
 */
export interface SmartSelectCandidate {
  rank: number;
  mandi: string;
  /** Mandi modal price, integer paisa per quintal. */
  modalPricePaisa: number;
  distanceKm: number;
  transportFarePaisa: number;
  commissionPaisa: number;
  /** modal × qty − transport − commission, integer paisa. */
  netPaisa: number;
}

export interface SmartSelectResult {
  crop: string;
  quantityQuintals: number;
  district: string;
  source: 'ai' | 'fallback';
  automationLevel: string;
  confidence: number;
  decisionId: string | null;
  explainKey: string;
  best: SmartSelectCandidate | null;
  candidates: SmartSelectCandidate[];
}

export async function mandiSmartSelect(payload: {
  crop: string;
  quantityQuintals: number;
  district?: string;
}): Promise<{ data: SmartSelectResult }> {
  const { data } = await api.post<{ data: SmartSelectResult }>('/mandi/smart-select', payload);
  return data;
}

/** Integer paisa → ₹ display string (2 decimals) — smart-select money is paisa. */
export function paisaInr(paisa: number): string {
  return `₹${(paisa / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Cached 7/30-day price band — GET /v1/mandi/forecast (brief M12, SGR).
 *
 * Backend quirks: read-only (the model runs in a nightly job, never here); the
 * band money is integer paisa; a missing cache entry answers the standard 404
 * envelope (`FORECAST_NOT_FOUND`) so callers must keep the plain compare view.
 */
export interface MandiForecastBand {
  horizon_days: number;
  band_low_paisa: number;
  band_high_paisa: number;
  confidence_class: 'low' | 'medium' | 'high';
}

export interface MandiForecast {
  crop: string;
  mandi: string;
  bands: MandiForecastBand[];
  source: 'ai' | 'fallback';
  fallbackUsed: boolean;
  sampleDays: number;
  updatedAt: string;
}

export async function mandiForecast(params: {
  crop: string;
  mandi: string;
}): Promise<{ data: MandiForecast }> {
  const { data } = await api.get<{ data: MandiForecast }>('/mandi/forecast', { params });
  return data;
}
