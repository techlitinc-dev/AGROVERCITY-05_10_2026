import { api } from './client';

/**
 * Trade domain types + lot endpoints — contracts verified against
 * backend/app/routers/lots.py and the Firestore doc shapes.
 */

export interface Paged<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface LotLocation {
  village?: string;
  district?: string;
  state?: string;
  lat?: number;
  lng?: number;
}

export type LotStatus = 'open' | 'sold' | 'withdrawn';

export interface Lot {
  id: string;
  crop: string;
  variety?: string;
  quantityQuintals: number;
  expectedRate: number;
  harvestDate: string;
  photos: string[];
  location: LotLocation;
  farmerId: string;
  status: LotStatus;
  createdAt: string;
  /** Enriched by /direct-buyer/feed only; absent on plain lot docs. */
  farmerName?: string;
  farmerVillage?: string;
}

export interface LotPayload {
  crop: string;
  quantityQuintals: number;
  expectedRate: number;
  harvestDate: string;
  photos: string[];
  location: LotLocation;
}

export type LotSort = 'newest' | 'price' | 'ready-date';

export interface LotBrowseParams {
  crop?: string;
  state?: string;
  minRate?: number;
  maxRate?: number;
  minQty?: number;
  harvestBefore?: string;
  sort?: LotSort;
  page?: number;
  pageSize?: number;
}

export async function createLot(payload: LotPayload): Promise<Lot> {
  const { data } = await api.post<Lot>('/market/lots', payload);
  return data;
}

export async function myLots(status?: LotStatus): Promise<Lot[]> {
  const { data } = await api.get<Paged<Lot>>('/market/lots', {
    params: status ? { status } : {},
  });
  return data.data;
}

export async function browseLots(params: LotBrowseParams = {}): Promise<Paged<Lot>> {
  const { data } = await api.get<Paged<Lot>>('/market/lots/browse', { params });
  return data;
}

export async function getLot(lotId: string): Promise<Lot> {
  const { data } = await api.get<Lot>(`/market/lots/${lotId}`);
  return data;
}

export async function updateLot(lotId: string, payload: LotPayload): Promise<Lot> {
  const { data } = await api.put<Lot>(`/market/lots/${lotId}`, payload);
  return data;
}

export async function withdrawLot(lotId: string): Promise<{ ok: boolean; status: string }> {
  const { data } = await api.delete(`/market/lots/${lotId}`);
  return data;
}

/** Formats a number Indian-style with ₹ (price inputs are ₹/quintal). */
export function inr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}
