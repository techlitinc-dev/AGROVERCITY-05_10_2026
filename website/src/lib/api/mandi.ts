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
