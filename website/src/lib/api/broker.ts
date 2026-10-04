import { api } from './client';
import type { Paged } from './trade';
import { useSessionStore } from '../../stores/session';

/**
 * Broker / Dalal deal desk — types + wrappers mirroring backend/app/routers/broker.py
 * and the farmer-side counterpart (seller by phone match).
 */

// ---------- Types ----------

export type DealStatus =
  | 'negotiating'
  | 'contract_issued'
  | 'accepted'
  | 'in_transit'
  | 'completed'
  | 'cancelled';

export interface EvidenceEntry {
  id: string;
  blobPath: string;
  kind?: 'photo' | 'weighbridge' | 'loading' | 'delivery' | 'damage';
  uploadedBy: string;
  createdAt: string;
}

export interface Deal {
  id: string;
  brokerId: string;
  brokerName?: string;
  buyerName: string;
  buyerPhone: string;
  buyerCompany?: string;
  sellerName: string;
  sellerPhone: string;
  commodity: string;
  variety?: string;
  grade?: string;
  quantityQuintals: number;
  agreedRate: number;
  deliveryLocation?: string;
  brokerCommissionPct: number;
  paymentTerms?: string;
  notes?: string;
  status: DealStatus;
  grossAmount: number;
  commissionAmount: number;
  createdAt: string;
  updatedAt: string;
  sellerUid?: string;
  buyerUid?: string;
  evidence?: EvidenceEntry[];
  cancelReason?: string;
  deadlockRisk?: number;
  suggestMediator?: boolean;
}

export interface DealCreate {
  buyerName: string;
  buyerPhone: string;
  buyerCompany?: string;
  sellerName: string;
  sellerPhone: string;
  commodity: string;
  variety?: string;
  grade?: string;
  quantityQuintals: number;
  agreedRate: number;
  deliveryLocation?: string;
  brokerCommissionPct?: number;
  paymentTerms?: string;
  notes?: string;
}

export type DealUpdate = Partial<Omit<DealCreate, 'buyerName' | 'sellerName'>> & {
  status?: DealStatus;
  cancelReason?: string;
};

export interface DealMessage {
  id: string;
  dealId: string;
  senderId: string;
  senderRole: 'broker' | 'buyer' | 'seller';
  senderName: string;
  text: string;
  amountOffer: number | null;
  createdAt: string;
}

export type LeadStatus = 'active' | 'contacted' | 'negotiating' | 'converted' | 'dropped';
export type LeadType = 'farmer' | 'buyer' | 'trader';

export interface Lead {
  id: string;
  brokerId: string;
  name: string;
  phone: string;
  type: LeadType;
  commodity?: string;
  quantityExpected?: number;
  targetRate?: number;
  location?: string;
  notes?: string;
  status: LeadStatus;
  score?: number;
  deadlockRisk?: number;
  createdAt: string;
  updatedAt: string;
}

export type LeadCreate = Omit<Lead, 'id' | 'brokerId' | 'status' | 'createdAt' | 'updatedAt'>;
export type LeadUpdate = Partial<LeadCreate> & { status?: LeadStatus };

export interface CommissionsSummary {
  totalEarned: number;
  pendingPayout: number;
  completedDealsCount: number;
  activeDealsCount: number;
  deals: Deal[];
}

export type SettlementStatus = 'pending' | 'approved' | 'paid';

export interface Settlement {
  id: string;
  role: string;
  entityId: string;
  periodStart: string;
  periodEnd: string;
  grossRupees: number;
  commissionRupees: number;
  netRupees: number;
  status: SettlementStatus;
  sourceIds: string[];
  createdAt: string;
}

// ---------- Broker endpoints ----------

/**
 * Defensive ownership guard (plan §1.1): always filter the paged response to
 * the session uid's brokerId so a fresh broker never sees someone else's deals.
 */
function ownDealsOnly(paged: Paged<Deal>): Paged<Deal> {
  const user = useSessionStore.getState().user;
  const uid = user?.id ?? user?.uid;
  if (!uid) return paged;
  const data = paged.data.filter((d) => d.brokerId === uid);
  return { ...paged, data, total: data.length };
}

export async function listDeals(params: {
  status?: DealStatus;
  page?: number;
  pageSize?: number;
} = {}): Promise<Paged<Deal>> {
  const { data } = await api.get<Paged<Deal>>('/broker/deals', { params });
  return ownDealsOnly(data);
}

export async function createDeal(body: DealCreate): Promise<Deal> {
  const { data } = await api.post<Deal>('/broker/deals', body);
  return data;
}

export async function getDeal(dealId: string): Promise<Deal> {
  const { data } = await api.get<Deal>(`/broker/deals/${dealId}`);
  return data;
}

export async function updateDeal(dealId: string, body: DealUpdate): Promise<Deal> {
  const { data } = await api.put<Deal>(`/broker/deals/${dealId}`, body);
  return data;
}

export async function cancelDeal(dealId: string, reason?: string): Promise<{ ok: true; status: 'cancelled' }> {
  const { data } = await api.delete<{ ok: true; status: 'cancelled' }>(`/broker/deals/${dealId}`, {
    data: reason ? { reason } : undefined,
  });
  return data;
}

export async function listDealMessages(dealId: string): Promise<{ data: DealMessage[] }> {
  const { data } = await api.get<{ data: DealMessage[] }>(`/broker/deals/${dealId}/messages`);
  return data;
}

export async function sendDealMessage(
  dealId: string,
  body: { senderRole: 'broker' | 'buyer'; senderName?: string; text: string; amountOffer?: number }
): Promise<DealMessage> {
  const { data } = await api.post<DealMessage>(`/broker/deals/${dealId}/messages`, body);
  return data;
}

export async function listLeads(params: { type?: LeadType; status?: LeadStatus } = {}): Promise<{ data: Lead[]; total: number }> {
  const { data } = await api.get<{ data: Lead[]; total: number }>('/broker/leads', { params });
  return data;
}

export async function createLead(body: LeadCreate): Promise<Lead> {
  const { data } = await api.post<Lead>('/broker/leads', body);
  return data;
}

export async function updateLead(leadId: string, body: LeadUpdate): Promise<Lead> {
  const { data } = await api.put<Lead>(`/broker/leads/${leadId}`, body);
  return data;
}

export async function dropLead(leadId: string): Promise<{ ok: true; status: 'dropped' }> {
  const { data } = await api.delete<{ ok: true; status: 'dropped' }>(`/broker/leads/${leadId}`);
  return data;
}

export async function getCommissions(): Promise<CommissionsSummary> {
  const { data } = await api.get<CommissionsSummary>('/broker/commissions');
  return data;
}

export async function listSettlements(params: { page?: number; pageSize?: number } = {}): Promise<Paged<Settlement>> {
  const { data } = await api.get<Paged<Settlement>>('/broker/settlements', { params });
  return data;
}

// ---------- Farmer-side (seller by phone match) ----------

export async function listFarmerDeals(params: {
  status?: DealStatus;
  page?: number;
  pageSize?: number;
} = {}): Promise<Paged<Deal>> {
  const { data } = await api.get<Paged<Deal>>('/farmer/deals', { params });
  return data;
}

export async function getFarmerDeal(dealId: string): Promise<Deal> {
  const { data } = await api.get<Deal>(`/farmer/deals/${dealId}`);
  return data;
}

export async function listFarmerDealMessages(dealId: string): Promise<{ data: DealMessage[] }> {
  const { data } = await api.get<{ data: DealMessage[] }>(`/farmer/deals/${dealId}/messages`);
  return data;
}

export async function sendFarmerDealMessage(
  dealId: string,
  body: { senderName?: string; text: string; amountOffer?: number }
): Promise<DealMessage> {
  const { data } = await api.post<DealMessage>(`/farmer/deals/${dealId}/messages`, body);
  return data;
}

export async function respondToDeal(
  dealId: string,
  body: { action: 'accept' | 'decline'; reason?: string }
): Promise<Deal> {
  const { data } = await api.post<Deal>(`/farmer/deals/${dealId}/respond`, body);
  return data;
}

// ---------- Evidence (multipart, spec F8/B10) ----------

export async function uploadDealEvidence(
  dealId: string,
  file: File,
  role: 'broker' | 'farmer',
  kind?: EvidenceEntry['kind']
): Promise<EvidenceEntry> {
  const form = new FormData();
  form.append('file', file);
  if (kind) form.append('kind', kind);
  const { data } = await api.post<EvidenceEntry>(`/${role}/deals/${dealId}/evidence`, form);
  return data;
}

// ---------- Display helpers ----------

/** C1: numbers are never shown in full — "+919876500006" → "+91 •• •••• •006". */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const last3 = digits.slice(-3);
  if (digits.length >= 10) return `+91 •• •••• •${last3}`;
  return `•• •••• •${last3}`;
}

/** B8: vehicle plates render masked — "MH 12 AB 1234" → "MH 12 •• 1234". */
export function maskPlate(plate: string): string {
  const tokens = plate.trim().split(/\s+/).filter(Boolean);
  if (tokens.length >= 4) return `${tokens[0]} ${tokens[1]} •• ${tokens[tokens.length - 1]}`;
  if (tokens.length >= 2) return `${tokens[0]} •• ${tokens[tokens.length - 1]}`;
  return '••';
}

/** The three visible numbers (plan §2.1 — never make a user calculate). */
export function dealMath(
  quantityQuintals: number,
  agreedRate: number,
  pct: number
): { gross: number; commission: number; payout: number } {
  const gross = quantityQuintals * agreedRate;
  const commission = (gross * pct) / 100;
  return { gross, commission, payout: gross - commission };
}

export { inr } from './trade';
