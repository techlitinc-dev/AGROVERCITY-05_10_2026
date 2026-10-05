import { api } from './client';
import type { Paged } from './trade';

/**
 * Offers — structured negotiation (the ONLY pre-booking channel, spec G1).
 * Verified against backend/app/routers/offers.py.
 */

export type OfferStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'countered'
  | 'expired';

export interface OfferCounter {
  pricePerUnit: number;
  by: string;
  note?: string;
  at: string;
}

export interface Offer {
  id: string;
  targetType: 'demand' | 'lot';
  targetId: string;
  fromId: string;
  fromName: string;
  fromRole: string;
  /** WS-03: true when the buyer earned the Verified Vyapari trust tier. */
  fromVerified?: boolean;
  toId: string;
  toName: string;
  pricePerUnit: number;
  quantity: number;
  unit: string;
  message?: string;
  status: OfferStatus;
  counter?: OfferCounter;
  /** Counter rounds elapsed (capped at 3). */
  rounds?: number;
  /** ISO timestamp — offer auto-expires 24h after creation (or last counter). */
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OfferCreatePayload {
  targetType: 'demand' | 'lot';
  targetId: string;
  pricePerUnit: number;
  quantity: number;
  message?: string;
}

export async function createOffer(payload: OfferCreatePayload): Promise<Offer> {
  const { data } = await api.post<Offer>('/offers', payload);
  return data;
}

export async function myOffers(
  filter: 'sent' | 'received',
  targetType?: 'demand' | 'lot'
): Promise<Paged<Offer>> {
  const { data } = await api.get<Paged<Offer>>('/offers/mine', {
    params: { filter, ...(targetType ? { targetType } : {}) },
  });
  return data;
}

export async function getOffer(offerId: string): Promise<Offer> {
  const { data } = await api.get<Offer>(`/offers/${offerId}`);
  return data;
}

export async function acceptOffer(offerId: string): Promise<unknown> {
  const { data } = await api.post(`/offers/${offerId}/accept`);
  return data;
}

export async function rejectOffer(offerId: string): Promise<Offer> {
  const { data } = await api.post<Offer>(`/offers/${offerId}/reject`);
  return data;
}

export async function withdrawOffer(offerId: string): Promise<Offer> {
  const { data } = await api.post<Offer>(`/offers/${offerId}/withdraw`);
  return data;
}

export async function counterOffer(
  offerId: string,
  payload: { pricePerUnit: number; note?: string }
): Promise<Offer> {
  const { data } = await api.post<Offer>(`/offers/${offerId}/counter`, payload);
  return data;
}
