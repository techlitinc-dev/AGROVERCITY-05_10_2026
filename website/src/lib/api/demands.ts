import { api } from './client';
import type { Paged } from './trade';

/**
 * Demands — reverse listings ("wanted orders", spec V4). Write endpoints require
 * directBuyer OR seller activeProfile (backend expanded 2026-10, see plan §3);
 * the open list is readable by any authenticated user.
 * Verified against backend/app/routers/demands.py.
 */

export type DemandStatus = 'open' | 'closed' | 'fulfilled';
export type DemandFrequency = 'oneTime' | 'weekly' | 'monthly';

export interface Demand {
  id: string;
  crop: string;
  variety?: string;
  quantity: number;
  unit: string;
  qualityGrade: 'A' | 'B' | 'C';
  maxPrice: number;
  packaging?: string;
  deliveryLocation?: string;
  neededBy?: string;
  frequency: DemandFrequency;
  notes?: string;
  buyerId: string;
  buyerName: string;
  buyerCompany?: string;
  state?: string;
  status: DemandStatus;
  offersCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DemandPayload {
  crop: string;
  variety?: string;
  quantity: number;
  unit?: string;
  qualityGrade?: 'A' | 'B' | 'C';
  maxPrice: number;
  packaging?: string;
  deliveryLocation?: string;
  neededBy?: string;
  frequency?: DemandFrequency;
  notes?: string;
}

export async function createDemand(payload: DemandPayload): Promise<Demand> {
  const { data } = await api.post<Demand>('/demands', payload);
  return data;
}

/** status=open → all open demands; status=all → mine only. */
export async function listDemands(params: {
  status?: 'open' | 'all';
  crop?: string;
  state?: string;
  page?: number;
  pageSize?: number;
}): Promise<Paged<Demand>> {
  const { data } = await api.get<Paged<Demand>>('/demands', { params });
  return data;
}

export async function getDemand(demandId: string): Promise<Demand> {
  const { data } = await api.get<Demand>(`/demands/${demandId}`);
  return data;
}

export async function updateDemand(
  demandId: string,
  payload: Partial<DemandPayload>
): Promise<Demand> {
  const { data } = await api.put<Demand>(`/demands/${demandId}`, payload);
  return data;
}

export async function closeDemand(demandId: string): Promise<Demand> {
  const { data } = await api.post<Demand>(`/demands/${demandId}/close`);
  return data;
}

export async function reopenDemand(demandId: string): Promise<Demand> {
  const { data } = await api.post<Demand>(`/demands/${demandId}/reopen`);
  return data;
}

export async function deleteDemand(demandId: string): Promise<void> {
  await api.delete(`/demands/${demandId}`);
}
