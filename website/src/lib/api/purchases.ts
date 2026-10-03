import { api } from './client';
import type { Paged } from './trade';

/**
 * Purchases — the booking ledger (the Vyapari spec's "booking state machine",
 * simplified to what the backend implements). Verified against
 * backend/app/routers/purchases.py + purchase_settlement.py.
 */

export type PurchaseStatus =
  | 'confirmed'
  | 'advancePaid'
  | 'pickupScheduled'
  | 'inTransit'
  | 'delivered'
  | 'qcDisputed'
  | 'completed'
  | 'cancelled';

export type EscrowStatus = 'unfunded' | 'held' | 'released' | 'refunded';

export interface Escrow {
  status: EscrowStatus;
  amount: number;
  method?: string;
  reference?: string;
  fundedAt?: string | null;
  releasedAt?: string | null;
  refundedAt?: string | null;
  commission?: number | null;
  netRelease?: number | null;
}

/** Buyer view is redacted server-side: `otp` is farmer-only (spec F11). */
export interface Handover {
  otp?: string;
  generatedAt?: string | null;
  expiresAt?: string | null;
  verifiedAt?: string | null;
  attempts?: number;
}

export interface PurchaseEvent {
  at: string;
  status: string;
  note?: string;
}

export interface PurchasePayment {
  id: string;
  kind: string;
  amount: number;
  method: string;
  reference?: string;
  at: string;
}

export interface PurchaseQc {
  grade: 'A' | 'B' | 'C';
  acceptedQty: number;
  rejectedQty: number;
  note?: string;
  at: string;
}

export interface PurchaseRating {
  rating: number;
  review?: string;
  at: string;
}

export interface Purchase {
  id: string;
  buyerId: string;
  buyerName: string;
  farmerId: string;
  farmerName: string;
  source: { type: 'offer' | 'lot'; refId: string };
  crop: string;
  variety?: string;
  quantity: number;
  unit: string;
  agreedPricePerUnit: number;
  totalAmount: number;
  advancePaid?: number;
  status: PurchaseStatus;
  pickup?: { date: string; vehicleType: string; address: string; notes?: string };
  payments: PurchasePayment[];
  qc?: PurchaseQc;
  finalAmount?: number;
  invoice?: { number: string; issuedAt: string };
  events: PurchaseEvent[];
  rating?: { buyerToFarmer?: PurchaseRating | null; farmerToBuyer?: PurchaseRating | null };
  escrow?: Escrow;
  handover?: Handover;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseInvoice {
  purchaseId: string;
  number: string;
  issuedAt: string;
  [key: string]: unknown;
}

export async function createPurchase(payload: {
  lotId: string;
  quantity?: number;
}): Promise<Purchase> {
  const { data } = await api.post<Purchase>('/purchases', payload);
  return data;
}

export async function myPurchases(role?: 'farmer' | 'buyer', pageSize = 20): Promise<Paged<Purchase>> {
  const { data } = await api.get<Paged<Purchase>>('/purchases', {
    params: { ...(role ? { role } : {}), pageSize },
  });
  return data;
}

export async function getPurchase(purchaseId: string): Promise<Purchase> {
  const { data } = await api.get<Purchase>(`/purchases/${purchaseId}`);
  return data;
}

export async function payAdvance(
  purchaseId: string,
  payload: { amount: number; method: string; reference?: string }
): Promise<Purchase> {
  const { data } = await api.post<Purchase>(`/purchases/${purchaseId}/advance`, payload);
  return data;
}

export async function schedulePickup(
  purchaseId: string,
  payload: { date: string; vehicleType?: string; address: string; notes?: string }
): Promise<Purchase> {
  const { data } = await api.post<Purchase>(`/purchases/${purchaseId}/pickup`, payload);
  return data;
}

export async function dispatchPurchase(purchaseId: string): Promise<Purchase> {
  const { data } = await api.post<Purchase>(`/purchases/${purchaseId}/dispatch`);
  return data;
}

export async function deliverPurchase(purchaseId: string): Promise<Purchase> {
  const { data } = await api.post<Purchase>(`/purchases/${purchaseId}/deliver`);
  return data;
}

export async function cancelPurchase(
  purchaseId: string,
  payload: { reason: string }
): Promise<Purchase> {
  const { data } = await api.post<Purchase>(`/purchases/${purchaseId}/cancel`, payload);
  return data;
}

export async function recordQc(
  purchaseId: string,
  payload: { grade: 'A' | 'B' | 'C'; acceptedQty: number; rejectedQty: number; note?: string }
): Promise<Purchase> {
  const { data } = await api.post<Purchase>(`/purchases/${purchaseId}/qc`, payload);
  return data;
}

export async function resolveQcDispute(
  purchaseId: string,
  payload: { resolution: string }
): Promise<Purchase> {
  const { data } = await api.post<Purchase>(`/purchases/${purchaseId}/resolve`, payload);
  return data;
}

export async function recordPayment(
  purchaseId: string,
  payload: { amount: number; method: string; reference?: string; kind: 'balance' | 'full' }
): Promise<Purchase> {
  const { data } = await api.post<Purchase>(`/purchases/${purchaseId}/pay`, payload);
  return data;
}

export async function rateCounterparty(
  purchaseId: string,
  payload: { target: 'farmer' | 'buyer'; rating: number; review?: string }
): Promise<Purchase> {
  const { data } = await api.post<Purchase>(`/purchases/${purchaseId}/rate`, payload);
  return data;
}

export async function getInvoice(purchaseId: string): Promise<PurchaseInvoice> {
  const { data } = await api.get<PurchaseInvoice>(`/purchases/${purchaseId}/invoice`);
  return data;
}

// ---------- Escrow (spec C4) + handover OTP (spec F11) ----------

export async function fundEscrow(
  purchaseId: string,
  payload: { amount?: number; method: string; reference?: string }
): Promise<Purchase> {
  const { data } = await api.post<Purchase>(`/purchases/${purchaseId}/escrow/fund`, payload);
  return data;
}

export async function getHandoverOtp(purchaseId: string): Promise<{
  otp: string;
  expiresAt: string;
  verifiedAt?: string | null;
}> {
  const { data } = await api.get(`/purchases/${purchaseId}/handover-otp`);
  return data;
}

export async function verifyHandover(purchaseId: string, otp: string): Promise<Purchase> {
  const { data } = await api.post<Purchase>(`/purchases/${purchaseId}/handover/verify`, { otp });
  return data;
}

/** Sum of recorded payments (advance + pay endpoints append to payments[]). */
export function paidSoFar(p: Purchase): number {
  return (p.payments ?? []).reduce((sum, pay) => sum + (pay.amount || 0), 0);
}

/** Amount still owed: finalAmount when set (post-QC), else totalAmount, minus payments. */
export function amountDue(p: Purchase): number {
  const billable = p.finalAmount ?? p.totalAmount;
  return Math.max(0, billable - paidSoFar(p));
}
